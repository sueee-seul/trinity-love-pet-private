#!/usr/bin/env python3
"""
CLI entry point for testing the chatbot's context-resolution design against
a local Ollama model. See chatbot_harness.py for the actual resolution
logic, guardrails, and scripted scenarios -- this file just wires up an
OllamaClient and hands it off.

Setup (one time):
    ollama pull llama3.1        # or whatever model you pass with --model
    ollama serve                 # usually already running as a background service
    pip install -r requirements.txt

Usage:
    python test_chatbot_ollama.py                  # run the scripted test conversations
    python test_chatbot_ollama.py --interactive     # chat manually against mock data
    python test_chatbot_ollama.py --model qwen2.5   # use a different local model
    python test_chatbot_ollama.py --host http://192.168.1.50:11434
"""

import argparse
import os

from dotenv import load_dotenv

from chatbot_harness import run_scenarios, run_interactive
from ollama_client import OllamaClient

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default=os.environ.get("OLLAMA_MODEL", "llama3.1"), help="Ollama model tag (default: llama3.1, or $OLLAMA_MODEL)")
    parser.add_argument("--host", default=os.environ.get("OLLAMA_HOST", "http://localhost:11434"), help="Ollama host (default: http://localhost:11434, or $OLLAMA_HOST)")
    parser.add_argument("--interactive", action="store_true", help="chat manually instead of running the scripted scenarios")
    args = parser.parse_args()

    client = OllamaClient(model=args.model, host=args.host)

    if args.interactive:
        run_interactive(client)
    else:
        run_scenarios(client)


if __name__ == "__main__":
    main()
