#!/usr/bin/env python3
"""
Local speech-to-text service for live dictation.

The Backend splits the microphone stream into utterances and posts each one here as raw 16 kHz
mono PCM16 little-endian audio. Audio is transcribed in memory and never written to disk.

    POST /transcribe[?language=en]   body: PCM16 audio  ->  {"text": "...", "language": "en"}
    GET  /health                     ->  {"status": "ok", "model": "...", "device": "..."}

It listens on 127.0.0.1 by default: only the Backend on the same machine should reach it.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from urllib.parse import parse_qs, urlsplit

from whisper_engine import (
    WhisperEngine,
    cuda_device_count,
    register_cuda_libraries,
    resolve_settings,
)

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
TRANSCRIBE_PATH = "/transcribe"
HEALTH_PATH = "/health"

# The Backend caps one utterance at 20 s (640 kB); anything past 30 s is not from our client.
MAX_AUDIO_BYTES = 30 * 16_000 * 2
LANGUAGE_PATTERN = re.compile(r"^[a-z]{2,3}$")


class RequestError(Exception):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class TranscribeRequest:
    language: Optional[str]
    body_length: int


def parse_transcribe_request(raw_path: str, content_length: Optional[str]) -> TranscribeRequest:
    """Validates everything except the body itself, so a bad request is refused before reading it."""
    query = parse_qs(urlsplit(raw_path).query)
    language_values = query.get("language", [])
    language = language_values[0] if language_values else None
    if language is not None and not LANGUAGE_PATTERN.match(language):
        raise RequestError(HTTPStatus.BAD_REQUEST, "language must be a Whisper language code")

    if content_length is None or not content_length.isdigit():
        raise RequestError(HTTPStatus.LENGTH_REQUIRED, "Content-Length is required")
    body_length = int(content_length)
    if body_length == 0:
        raise RequestError(HTTPStatus.BAD_REQUEST, "Audio is empty")
    if body_length > MAX_AUDIO_BYTES:
        raise RequestError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Audio is too long")
    if body_length % 2 != 0:
        raise RequestError(HTTPStatus.BAD_REQUEST, "PCM16 audio must have an even byte length")
    return TranscribeRequest(language=language, body_length=body_length)


def create_handler(engine: WhisperEngine) -> type[BaseHTTPRequestHandler]:
    class SpeechRequestHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (http.server naming)
            if urlsplit(self.path).path != HEALTH_PATH:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
                return
            self._send_json(
                HTTPStatus.OK,
                {"status": "ok", "model": engine.settings.model, "device": engine.settings.device},
            )

        def do_POST(self) -> None:  # noqa: N802 (http.server naming)
            if urlsplit(self.path).path != TRANSCRIBE_PATH:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
                return
            try:
                request = parse_transcribe_request(self.path, self.headers.get("Content-Length"))
            except RequestError as error:
                self._send_json(error.status, {"error": error.message})
                return

            pcm = self.rfile.read(request.body_length)
            started = time.perf_counter()
            try:
                result = engine.transcribe(pcm, request.language)
            except Exception as error:  # the model failing must not kill the server thread
                self.log_error("Transcription failed: %s", error)
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Transcription failed"})
                return
            self._send_json(
                HTTPStatus.OK,
                {
                    "text": result.text,
                    "language": result.language,
                    "elapsedMs": round((time.perf_counter() - started) * 1000),
                },
            )

        def _send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return SpeechRequestHandler


def main() -> None:
    register_cuda_libraries()
    settings = resolve_settings(os.environ, cuda_device_count())
    print(f"Loading Whisper {settings.model} on {settings.device} ({settings.compute_type})...")
    engine = WhisperEngine(settings)
    engine.warm_up()

    host = os.environ.get("SPEECH_SERVICE_HOST", DEFAULT_HOST)
    port = int(os.environ.get("SPEECH_SERVICE_PORT", str(DEFAULT_PORT)))
    server = ThreadingHTTPServer((host, port), create_handler(engine))
    print(f"Speech service listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
