#!/usr/bin/env python3
"""
CLI entry point for testing the chatbot's context-resolution design against
the hosted OpenAI-compatible model. See chatbot_harness.py for the actual
resolution logic, guardrails, and scripted scenarios -- this file just
wires up an OpenAIClient and hands it off.

Setup (one time):
    pip install -r requirements.txt
    add OPENAI_API_KEY to .env (and optionally OPENAI_MODEL, so you don't
    need to pass --model every time)

Usage:
    python test_chatbot_openai.py                          # run the scripted test conversations
    python test_chatbot_openai.py --interactive             # chat manually from the terminal
    python test_chatbot_openai.py --interactive --reasoning-effort low
    python test_chatbot_openai.py --model gpt-5.6-luna
"""

import argparse
import os

from dotenv import load_dotenv

from chatbot_harness import run_scenarios, run_interactive
from openai_client import OpenAIClient

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default=os.environ.get("OPENAI_MODEL"), help="OpenAI model id (default: $OPENAI_MODEL)")
    parser.add_argument("--reasoning-effort", choices=["low", "medium", "high"], default=os.environ.get("OPENAI_REASONING_EFFORT", "medium"), help="reasoning effort (default: medium, or $OPENAI_REASONING_EFFORT)")
    parser.add_argument("--interactive", action="store_true", help="chat manually instead of running the scripted scenarios")
    args = parser.parse_args()

    if not args.model:
        parser.error("no model specified -- pass --model or set $OPENAI_MODEL in .env")

    client = OpenAIClient(model=args.model, reasoning_effort=args.reasoning_effort)

    if args.interactive:
        run_interactive(client)
    else:
        run_scenarios(client)


if __name__ == "__main__":
    main()
