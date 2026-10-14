"""
Thin wrapper around Ollama's /api/chat endpoint. Nothing here is
pet-care-specific. It's just JSON-mode chat with retries.
"""

import json
import requests


class OllamaError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, model="llama3.1", host="http://localhost:11434", timeout=120):
        self.model = model
        self.host = host.rstrip("/")
        self.timeout = timeout

    def _post(self, payload):
        try:
            resp = requests.post(f"{self.host}/api/chat", json=payload, timeout=self.timeout)
        except requests.exceptions.ConnectionError as e:
            raise OllamaError(
                f"Could not reach Ollama at {self.host}. Is it running? "
                f"Start it with `ollama serve` and make sure you've run "
                f"`ollama pull {self.model}`."
            ) from e
        if resp.status_code != 200:
            raise OllamaError(f"Ollama returned HTTP {resp.status_code}: {resp.text[:500]}")
        return resp.json()

    def chat(self, messages, json_mode=False, temperature=0.1):
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if json_mode:
            payload["format"] = "json"
        data = self._post(payload)
        try:
            return data["message"]["content"]
        except (KeyError, TypeError) as e:
            raise OllamaError(f"Unexpected Ollama response shape: {data}") from e

    def chat_json(self, messages, temperature=0.1, retries=1):
        """Chat in JSON mode and parse the result, retrying once on bad JSON."""
        last_err = None
        for attempt in range(retries + 1):
            raw = self.chat(messages, json_mode=True, temperature=temperature)
            try:
                return json.loads(raw)
            except json.JSONDecodeError as e:
                last_err = e
                messages = messages + [
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": "That wasn't valid JSON. Reply with ONLY the JSON object, nothing else."},
                ]
        raise OllamaError(f"Model did not return valid JSON after {retries + 1} attempt(s): {last_err}")
