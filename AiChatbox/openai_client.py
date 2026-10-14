"""
Thin wrapper around an OpenAI-compatible Chat Completions API, matching
OllamaClient's interface (chat / chat_json) so resolver.py and the test
harness don't need to know or care which backend they're talking to.

IMPORTANT -- verify before relying on this: this assumes the standard
OpenAI Chat Completions request shape, with "reasoning_effort" as a
top-level field ("low" | "medium" | "high") -- the documented mechanism
OpenAI's own reasoning-tier models use. There is no verified information
here about a model called "GPT-5.6 Luna" specifically; if your provider
serves it through a different API shape (the newer Responses API, a proxy
with its own reasoning-control field or values, a different JSON-mode
mechanism), adjust chat() below to match your provider's actual docs
rather than assuming this is correct as-is.
"""

import json

from openai import OpenAI


class OpenAIError(RuntimeError):
    pass


class OpenAIClient:
    def __init__(self, model, reasoning_effort="medium", api_key=None, base_url=None, timeout=120):
        self.model = model
        self.reasoning_effort = reasoning_effort
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    def _post(self, payload):
        try:
            resp = self._client.chat.completions.create(**payload)
        except Exception as e:
            raise OpenAIError(
                f"OpenAI API call failed for model {self.model!r}: {e}"
            ) from e
        return resp

    def chat(self, messages, json_mode=False, temperature=0.1):
        payload = {"model": self.model, "messages": messages}
        if self.reasoning_effort:
            # Reasoning-tier models generally reject/ignore a custom
            # temperature -- reasoning_effort is the control knob instead.
            payload["reasoning_effort"] = self.reasoning_effort
        else:
            payload["temperature"] = temperature
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        resp = self._post(payload)
        try:
            return resp.choices[0].message.content
        except (KeyError, IndexError, AttributeError) as e:
            raise OpenAIError(f"Unexpected OpenAI response shape: {resp}") from e

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
        raise OpenAIError(f"Model did not return valid JSON after {retries + 1} attempt(s): {last_err}")
