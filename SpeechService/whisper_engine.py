"""
Loads one faster-whisper model and turns 16 kHz mono PCM16 audio into text.

The model choice is the main latency/accuracy trade-off. With an NVIDIA GPU, large-v3-turbo gives
near large-v3 accuracy (English, Chinese and code-switching) in a fraction of a second per
utterance. Without one, `small` on the CPU is the largest model that still answers in about two
seconds, so `auto` picks between the two. WHISPER_MODEL, WHISPER_DEVICE and WHISPER_COMPUTE_TYPE
override the choice.

Measured on an RTX 5070 laptop GPU with 6 to 11 s clips: large-v3-turbo answers in 0.4 to 0.7 s,
full large-v3 in 2 to 3 s, and small on the CPU in about 2 s.
"""

from __future__ import annotations

import os
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional

import numpy as np

SAMPLE_RATE_HERTZ = 16_000
PCM16_FULL_SCALE = 32_768.0

GPU_DEFAULT_MODEL = "large-v3-turbo"
GPU_DEFAULT_COMPUTE_TYPE = "float16"
CPU_DEFAULT_MODEL = "small"
CPU_DEFAULT_COMPUTE_TYPE = "int8"
AUTO = "auto"

# One beam keeps latency low; with large-v3-turbo five beams gave the same text in our clips.
BEAM_SIZE = 1

# A laptop microphone across the room peaks around 0.02 of full scale. Whisper is trained on
# normal levels, so a quiet clip is raised to this peak; the gain cap stops pure hiss from being
# blown up into something the model mistakes for words.
TARGET_PEAK = 0.5
MAX_GAIN = 30.0

# No hotwords by default. Pet-care hotwords fixed a few Chinese homophones on clean clips, but on a
# real laptop microphone Whisper repeated them as speech ("allergic to chicken" in Chinese, three times over a noisy
# pause), and an invented allergy in a pet's record is worse than a misheard word the owner sees
# and corrects. WHISPER_HOTWORDS can still set some for an experiment.


@dataclass(frozen=True)
class EngineSettings:
    model: str
    device: str
    compute_type: str
    hotwords: Optional[str] = None


@dataclass(frozen=True)
class Transcription:
    text: str
    language: str


def register_cuda_libraries() -> None:
    """
    pip's nvidia-cublas-cu12 and nvidia-cudnn-cu12 wheels put their DLLs under
    site-packages/nvidia/*/bin, which Windows does not search. CTranslate2 loads them by name, so
    the folders have to be on PATH before the first GPU call.
    """
    if sys.platform != "win32":
        return
    for site_path in sys.path:
        nvidia_root = Path(site_path) / "nvidia"
        if not nvidia_root.is_dir():
            continue
        for bin_dir in nvidia_root.glob("*/bin"):
            os.add_dll_directory(str(bin_dir))
            os.environ["PATH"] = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"


def cuda_device_count() -> int:
    import ctranslate2

    return ctranslate2.get_cuda_device_count()


def resolve_settings(env: Mapping[str, str], gpu_count: int) -> EngineSettings:
    requested_device = env.get("WHISPER_DEVICE", AUTO).strip() or AUTO
    device = requested_device if requested_device != AUTO else ("cuda" if gpu_count > 0 else "cpu")
    if device not in ("cuda", "cpu"):
        raise ValueError("WHISPER_DEVICE must be auto, cuda or cpu")

    on_gpu = device == "cuda"
    model = env.get("WHISPER_MODEL", "").strip() or (GPU_DEFAULT_MODEL if on_gpu else CPU_DEFAULT_MODEL)
    compute_type = env.get("WHISPER_COMPUTE_TYPE", "").strip() or (
        GPU_DEFAULT_COMPUTE_TYPE if on_gpu else CPU_DEFAULT_COMPUTE_TYPE
    )
    hotwords = env.get("WHISPER_HOTWORDS", "").strip() or None
    return EngineSettings(model=model, device=device, compute_type=compute_type, hotwords=hotwords)


def pcm16_to_float32(pcm: bytes) -> np.ndarray:
    return np.frombuffer(pcm, dtype="<i2").astype(np.float32) / PCM16_FULL_SCALE


def normalize_level(audio: np.ndarray) -> np.ndarray:
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak == 0.0 or peak >= TARGET_PEAK:
        return audio
    return audio * min(TARGET_PEAK / peak, MAX_GAIN)


class WhisperEngine:
    """Thread-safe wrapper: the HTTP server is threaded, the model runs one utterance at a time."""

    def __init__(self, settings: EngineSettings) -> None:
        from faster_whisper import WhisperModel

        self.settings = settings
        self._model = WhisperModel(
            settings.model, device=settings.device, compute_type=settings.compute_type
        )
        self._lock = threading.Lock()

    def warm_up(self) -> None:
        """The first GPU call compiles kernels; paying that at boot keeps the first dictation fast."""
        self.transcribe(bytes(SAMPLE_RATE_HERTZ * 2), language=None)

    def transcribe(self, pcm: bytes, language: Optional[str]) -> Transcription:
        audio = normalize_level(pcm16_to_float32(pcm))
        with self._lock:
            segments, info = self._model.transcribe(
                audio,
                language=language,
                beam_size=BEAM_SIZE,
                # Each request is one utterance; carrying text over only invites repeated phrases.
                condition_on_previous_text=False,
                # Background noise alone makes Whisper invent phrases; the VAD drops it first.
                vad_filter=True,
                hotwords=self.settings.hotwords,
            )
            text = "".join(segment.text for segment in segments).strip()
        return Transcription(text=text, language=info.language)
