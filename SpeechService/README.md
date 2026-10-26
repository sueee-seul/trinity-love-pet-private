# Speech service (local Whisper)

This small Python service turns speech into text for live dictation. It runs
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) on your own machine. It needs no
cloud account and no API key, and audio never leaves the machine.

The Backend talks to it. The browser never does.

```
Browser mic -> WS /api/speech/stream (Backend) -> POST /transcribe (this service) -> Whisper
```

The Backend splits the stream into utterances at short pauses. It posts each utterance here and
sends the text back to the browser.

## Set up

Python 3.10 or newer is needed.

```bash
pip install -r SpeechService/requirements.txt
```

The requirements include NVIDIA cuBLAS and cuDNN wheels, so no system CUDA install is needed.
On a machine without an NVIDIA GPU they install but are not used.

## Run

```bash
npm run dev:speech
```

This is the same as `python SpeechService/server.py`. `npm run dev` also starts it.

The first run downloads the model from Hugging Face into `~/.cache/huggingface`. That is about
1.6 GB for `large-v3-turbo` and about 0.5 GB for `small`. Startup then loads the model and warms it
up. Dictation fails with "Speech could not be transcribed" until the log says
`Speech service listening`.

## Model choice

| Machine           | Default model    | Speed (6 to 11 s clip) | Notes                               |
| ----------------- | ---------------- | ---------------------- | ----------------------------------- |
| NVIDIA GPU (CUDA) | `large-v3-turbo` | 0.4 to 0.7 s           | Best accuracy for Chinese and mixed |
| CPU only          | `small`          | about 2 s              | Good English; Chinese mostly right  |

Speeds were measured on an RTX 5070 laptop GPU and a Ryzen 9 8940HX. Full `large-v3` was 3 to 4
times slower than `large-v3-turbo` and no more accurate on our clips.

Whisper finds the spoken language by itself, so English, Chinese and about 90 other languages
work without settings.

## Settings

All are optional environment variables.

| Variable               | Default                       | Meaning                                          |
| ---------------------- | ----------------------------- | ------------------------------------------------ |
| `WHISPER_MODEL`        | `large-v3-turbo` or `small`   | Any faster-whisper model name.                   |
| `WHISPER_DEVICE`       | `auto`                        | `auto`, `cuda` or `cpu`.                         |
| `WHISPER_COMPUTE_TYPE` | `float16` (GPU), `int8` (CPU) | CTranslate2 compute type.                        |
| `WHISPER_HOTWORDS`     | none                          | Words that bias recognition. See below.          |
| `SPEECH_SERVICE_HOST`  | `127.0.0.1`                   | Keep it local. Only the Backend should call it.  |
| `SPEECH_SERVICE_PORT`  | `8765`                        | Must match `WHISPER_SERVICE_URL` in the Backend. |

Hotwords are off on purpose. Pet-care hotwords fixed a few Chinese homophones on clean test clips,
but on a real laptop microphone Whisper repeated them as if they were spoken, for example
"allergic to chicken" in Chinese during a pause. A made-up allergy is worse than a misheard word
that the owner can see and fix.

## API

- `GET /health` returns `{"status": "ok", "model": "...", "device": "..."}`.
- `POST /transcribe?language=en` takes raw 16 kHz mono PCM16 little-endian audio as the body.
  `language` is optional. It returns `{"text": "...", "language": "zh", "elapsedMs": 512}`.
  Empty, odd-length or longer than 30 s audio is refused with a 4xx status.

## Test

```bash
python -m unittest discover -s SpeechService/tests
```
