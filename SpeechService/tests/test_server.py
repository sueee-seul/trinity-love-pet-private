import os
import sys
import unittest
from http import HTTPStatus

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from server import MAX_AUDIO_BYTES, RequestError, parse_transcribe_request  # noqa: E402
from whisper_engine import (  # noqa: E402
    MAX_GAIN,
    TARGET_PEAK,
    normalize_level,
    pcm16_to_float32,
    resolve_settings,
)


class ParseTranscribeRequestTest(unittest.TestCase):
    def test_accepts_audio_without_a_language(self) -> None:
        request = parse_transcribe_request("/transcribe", "3200")
        self.assertIsNone(request.language)
        self.assertEqual(request.body_length, 3200)

    def test_accepts_a_language_hint(self) -> None:
        self.assertEqual(parse_transcribe_request("/transcribe?language=zh", "2").language, "zh")

    def assert_refused(self, path: str, length: str | None, status: HTTPStatus) -> None:
        with self.assertRaises(RequestError) as caught:
            parse_transcribe_request(path, length)
        self.assertEqual(caught.exception.status, status)

    def test_refuses_a_malformed_language(self) -> None:
        self.assert_refused("/transcribe?language=../etc", "2", HTTPStatus.BAD_REQUEST)

    def test_refuses_missing_or_bad_length(self) -> None:
        self.assert_refused("/transcribe", None, HTTPStatus.LENGTH_REQUIRED)
        self.assert_refused("/transcribe", "-4", HTTPStatus.LENGTH_REQUIRED)

    def test_refuses_empty_odd_and_oversized_audio(self) -> None:
        self.assert_refused("/transcribe", "0", HTTPStatus.BAD_REQUEST)
        self.assert_refused("/transcribe", "3", HTTPStatus.BAD_REQUEST)
        self.assert_refused(
            "/transcribe", str(MAX_AUDIO_BYTES + 2), HTTPStatus.REQUEST_ENTITY_TOO_LARGE
        )


class ResolveSettingsTest(unittest.TestCase):
    def test_auto_uses_turbo_on_a_gpu(self) -> None:
        settings = resolve_settings({}, gpu_count=1)
        self.assertEqual((settings.model, settings.device, settings.compute_type),
                         ("large-v3-turbo", "cuda", "float16"))

    def test_auto_falls_back_to_small_on_the_cpu(self) -> None:
        settings = resolve_settings({}, gpu_count=0)
        self.assertEqual((settings.model, settings.device, settings.compute_type),
                         ("small", "cpu", "int8"))

    def test_environment_overrides_win(self) -> None:
        settings = resolve_settings(
            {"WHISPER_DEVICE": "cpu", "WHISPER_MODEL": "medium", "WHISPER_COMPUTE_TYPE": "int8_float32"},
            gpu_count=1,
        )
        self.assertEqual((settings.model, settings.device, settings.compute_type),
                         ("medium", "cpu", "int8_float32"))

    def test_uses_no_hotwords_unless_configured(self) -> None:
        # Hotwords were echoed into transcripts as invented speech; they must stay opt-in.
        self.assertIsNone(resolve_settings({}, gpu_count=0).hotwords)
        self.assertEqual(
            resolve_settings({"WHISPER_HOTWORDS": "parrot"}, gpu_count=0).hotwords, "parrot"
        )

    def test_rejects_an_unknown_device(self) -> None:
        with self.assertRaises(ValueError):
            resolve_settings({"WHISPER_DEVICE": "tpu"}, gpu_count=0)


class Pcm16ToFloat32Test(unittest.TestCase):
    def test_scales_little_endian_samples_to_unit_range(self) -> None:
        audio = pcm16_to_float32(bytes([0x00, 0x80, 0x00, 0x00, 0xFF, 0x7F]))
        self.assertEqual(audio.tolist()[0], -1.0)
        self.assertEqual(audio.tolist()[1], 0.0)
        self.assertAlmostEqual(audio.tolist()[2], 32767 / 32768)


class NormalizeLevelTest(unittest.TestCase):
    def test_raises_a_quiet_clip_to_the_target_peak(self) -> None:
        quiet = np.array([0.0, 0.02, -0.025], dtype=np.float32)
        self.assertAlmostEqual(float(np.max(np.abs(normalize_level(quiet)))), TARGET_PEAK, places=5)

    def test_caps_the_gain_for_near_silence(self) -> None:
        hiss = np.array([0.001, -0.001], dtype=np.float32)
        self.assertAlmostEqual(float(normalize_level(hiss)[0]), 0.001 * MAX_GAIN, places=6)

    def test_leaves_loud_and_silent_clips_alone(self) -> None:
        loud = np.array([0.9, -0.6], dtype=np.float32)
        silent = np.zeros(4, dtype=np.float32)
        self.assertIs(normalize_level(loud), loud)
        self.assertIs(normalize_level(silent), silent)


if __name__ == "__main__":
    unittest.main()
