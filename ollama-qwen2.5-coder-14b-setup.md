# Ollama and Qwen2.5-Coder 14B Setup Guide

This guide helps a teammate install [Ollama](https://ollama.com/) and run the local
`qwen2.5-coder:14b` coding model.

It covers:

- Ollama installation on macOS, Windows, and Linux
- Model download and first-run verification
- Hardware and GPU considerations
- A local API smoke test
- Optional Python and Node.js integration

It does not cover Docker deployment, exposing Ollama to a network, or changing the
application's repository configuration.

## Quick start

After installing Ollama, run:

```bash
ollama run qwen2.5-coder:14b
```

If the model is not already installed, Ollama downloads it automatically. The official
Ollama model page lists this model at approximately **9.0 GB** with a **32K context
window**.

## Prerequisites

### Operating system

- **macOS:** macOS 14 Sonoma or later. Download the official macOS application from
  the [Ollama download page](https://ollama.com/download).
- **Windows:** Windows 10 or later.
- **Linux:** Use the official installation script below.

### Storage and network

- A reliable Internet connection is required for the first model download.
- Reserve at least 10 GB of free disk space for the model. Keep additional space
  available for Ollama, other models, and temporary files.

### GPU support

GPU acceleration is optional. Ollama can also load a model into system memory, but
CPU-only execution may be slower.

- **Apple:** Ollama supports Apple GPUs through Metal.
- **NVIDIA:** Ollama's current hardware documentation lists support for compute
  capability 5.0 or later with driver version 550 or later. GPUs with compute
  capability 5.0 through 6.2 require driver version 570 or later.
- **AMD:** Ollama's current documentation describes ROCm v7/HIP7 support for the
  listed Linux and Windows GPUs.

The model's download size is not a universal RAM or VRAM minimum. Memory usage also
depends on context length, concurrent requests, and whether the model is loaded on the
CPU, GPU, or both.

For the basic Ollama CLI workflow, Python, PyTorch, Transformers, and a separate model
runtime are not required. Install the optional language libraries only if the project
needs to call Ollama from Python or Node.js.

## Install Ollama

### macOS

1. Open the [official Ollama download page](https://ollama.com/download).
2. Download and install the macOS application.
3. Open a new Terminal window and verify the installation:

```bash
ollama --version
```

### Windows

Open PowerShell and run the official installation command:

```powershell
irm https://ollama.com/install.ps1 | iex
```

Alternatively, download the Windows installer from the [official download page](https://ollama.com/download/windows).

Verify the installation in a new PowerShell window:

```powershell
ollama --version
```

### Linux

Run the official installation script:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify the installation:

```bash
ollama --version
```

If the Ollama server is not already running, start it in a separate terminal:

```bash
ollama serve
```

On macOS and Windows, the installed application normally runs the local server in the
background. If a command reports that the server cannot be reached, open the Ollama
application and try again.

## Download and run Qwen2.5-Coder 14B

Use `pull` when you want to download the model explicitly:

```bash
ollama pull qwen2.5-coder:14b
```

Check the locally available models:

```bash
ollama list
```

Start an interactive coding session:

```bash
ollama run qwen2.5-coder:14b
```

Try a simple prompt:

```text
Write a TypeScript function that validates an email address.
```

## Verify GPU or CPU loading

While the model is running, open another terminal and run:

```bash
ollama ps
```

The `PROCESSOR` column shows where the model is loaded:

- `100% GPU`: the model is fully loaded on the GPU.
- `100% CPU`: the model is fully loaded in system memory.
- A `CPU/GPU` percentage split: the model is distributed between system memory and GPU memory.

If memory is limited, reduce the context length or close other applications before
starting the model. A larger context uses more memory.

## Local API smoke test

Ollama exposes a local HTTP API at `http://localhost:11434/api` by default. With the
model installed, run:

```bash
curl http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:14b",
    "messages": [
      {
        "role": "user",
        "content": "Write a TypeScript function that validates an email address."
      }
    ],
    "stream": false
  }'
```

The response should contain the model's answer in the returned JSON.

## Optional project integration

### Node.js / JavaScript

Install the official Ollama JavaScript library:

```bash
npm install ollama
```

Example:

```javascript
import ollama from 'ollama';

const response = await ollama.chat({
  model: 'qwen2.5-coder:14b',
  messages: [
    {
      role: 'user',
      content: 'Explain this function.',
    },
  ],
});

console.log(response.message.content);
```

See the [official ollama-js repository](https://github.com/ollama/ollama-js) for the
current API and streaming examples.

### Python

Create an isolated environment and install the official Python library:

```bash
python -m venv .venv
source .venv/bin/activate
pip install ollama
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

Example:

```python
from ollama import chat

response = chat(
    model="qwen2.5-coder:14b",
    messages=[
        {
            "role": "user",
            "content": "Explain this function.",
        }
    ],
)

print(response.message.content)
```

See the [official ollama-python repository](https://github.com/ollama/ollama-python)
for the current API and Python version requirements.

### OpenAI-compatible clients

Ollama provides a local OpenAI-compatible endpoint:

```text
http://localhost:11434/v1
```

Configure the client with:

```text
Base URL: http://localhost:11434/v1
Model: qwen2.5-coder:14b
```

Local requests do not require an Ollama API key. The exact configuration may vary by
OpenAI-compatible client.

## Troubleshooting

### `ollama: command not found`

- Open a new terminal after installation.
- Confirm that Ollama is installed from the official installer.
- On macOS or Windows, open the Ollama application before retrying.

### Connection refused on port 11434

The local Ollama server is not running. Open the Ollama application, or run:

```bash
ollama serve
```

Do not start a second server if the application is already using port 11434.

### The model is slow

Run `ollama ps` to check whether the model is using the CPU, GPU, or both. CPU-only
execution and GPU memory pressure can reduce performance.

### The model does not fit in memory

- Close other applications that use significant memory.
- Reduce the context length.
- Avoid loading multiple large models at the same time.
- Use a smaller Qwen2.5-Coder model if the machine still cannot load the 14B model.

## Official references

- [Ollama downloads](https://ollama.com/download)
- [Qwen2.5-Coder model page](https://registry.ollama.com/library/qwen2.5-coder)
- [Ollama hardware support](https://docs.ollama.com/gpu)
- [Ollama FAQ](https://docs.ollama.com/faq)
- [Ollama API introduction](https://docs.ollama.com/api/introduction)
- [Ollama Python library](https://github.com/ollama/ollama-python)
- [Ollama JavaScript library](https://github.com/ollama/ollama-js)
