# Self-hosting Rellum

Rellum needs one thing from you: an **OpenAI-compatible model endpoint**. It never
phones home — all completions go to the server you configure.

## 1. Pick a local server

| Server | Start command | Default base URL |
|---|---|---|
| [Ollama](https://ollama.com) | `ollama serve` then `ollama pull llama3.1` | `http://127.0.0.1:11434/v1` |
| [LM Studio](https://lmstudio.ai) | Start the local server in the app | `http://127.0.0.1:1234/v1` |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | `llama-server -m model.gguf --port 8080` | `http://127.0.0.1:8080/v1` |
| [vLLM](https://docs.vllm.ai) | `vllm serve <model>` | `http://127.0.0.1:8000/v1` |

Any server that implements `POST /v1/chat/completions` and `GET /v1/models` works,
including remote ones (OpenRouter, OpenAI, a homelab box) — Rellum simply does not
*require* one.

## 2. Configure Rellum

Open the tray menu → **Settings → Model endpoint**:

1. Press **Detect endpoints** — Rellum probes common localhost ports and lists what answers.
2. Pick a detected endpoint (or type a base URL), press **Test**.
3. Choose a model from the dropdown and save.

## 3. GPU notes

- **NVIDIA**: use the CUDA build of your server (llama.cpp ships `-ngl 99`-style
  offloading; Ollama uses CUDA automatically). Rellum reports your GPU vendor in
  Settings → Computer use when vision models are enabled.
- **Intel / AMD**: Vulkan or SYCL builds of llama.cpp work well on Windows.
- **No GPU**: small 3–8B instruct models run acceptably on CPU; expect a few
  seconds per rewrite.

## 4. Vision (computer use)

Computer use sends screenshots to the **same endpoint** with an image-capable model
(e.g. `qwen2.5-vl`, `llava`, `minicpm-v` in Ollama). Everything stays local.

## 5. Privacy checklist

- No DNS beyond your endpoint: verify with `Get-NetTCPConnection` or Little Snitch.
- Settings are plaintext JSON in `%APPDATA%/Rellum/rellum-settings.json` — no secrets
  are stored unless you put an API key in settings.
