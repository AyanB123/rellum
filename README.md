# Rellum

**Your words, lit from within.**

Rellum is a local-first desktop AI writing copilot. Press a hotkey in *any* app and a sleek
popup appears next to your selection. A local language model improves, proofreads, or condenses
your text — then pastes it right back where it was. No cloud. No account. No telemetry.

```text
select text → Ctrl+Shift+Space → Improve / Proofread / Condense → pasted back in place
```

## Highlights

- **Works everywhere** — email clients, editors, browsers, IDEs, chat apps. If you can select
  text, Rellum can rewrite it.
- **Local-first & private** — Rellum talks only to an OpenAI-compatible endpoint *you* choose
  (Ollama, LM Studio, llama.cpp, vLLM, or any server on your LAN). See [PRIVACY.md](./PRIVACY.md).
- **Clipboard-safe** — your clipboard is preserved and restored on every capture.
- **Keyboard-first** — `↑↓` to choose an action, `Enter` to run, `Esc` to back out. Never touch the mouse.
- **Streamed results** — watch the rewrite appear live, with changed words highlighted.
- **Optional computer use** — an experimental screen-vision agent for autonomous tasks, with a
  hard `Esc` kill switch and an always-visible overlay. Vision models run on your endpoint too.
- **Optional browser automation** — drive *your real Chrome profile* over CDP (see
  Settings → Browser). Logged-in sessions just work. Rellum never closes a Chrome it didn't launch.
- **Polished & light** — a dark, minimal, motion-considerate UI. One small process in your tray.

## Install

Grab the latest Windows installer from
[Releases](https://github.com/AyanB123/rellum/releases), or build from source:

```bash
pnpm install
pnpm dev
```

> macOS and Linux builds are planned; the codebase is already cross-platform where possible.

## Quick start

1. Run a local model server, e.g.:
   - [Ollama](https://ollama.com): `ollama serve` + `ollama pull llama3.1`
   - [LM Studio](https://lmstudio.ai): start the local server
   - llama.cpp: `llama-server -m model.gguf --port 8080`
2. Launch Rellum — it lives in your tray. Settings opens on first run.
3. Press **Detect endpoints** and Rellum finds your server. Pick a model, done.
4. Select some text anywhere, press `Ctrl+Shift+Space`, choose an action.

Full details in [SELF-HOSTING.md](./SELF-HOSTING.md).

## How it works

1. You press the hotkey. Rellum saves your clipboard, clears it, sends `Ctrl+C`, and reads the
   selection — all within ~400ms — then restores your clipboard exactly as it was.
2. A frameless popup appears near your cursor with three actions.
3. The rewrite streams from your model server via the OpenAI-compatible API (SSE).
4. **Paste in app** returns focus to the app you were using and pastes the result over the
   selection. **Copy** keeps it. **Retry differently** regenerates with the previous attempt as
   context.

Architecture details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Development

```bash
pnpm install
pnpm dev        # hot-reload dev session
pnpm typecheck  # strict TS
pnpm lint
pnpm test       # vitest unit tests
pnpm package    # build installers/portable
```

A tiny mock model server is included for smoke tests: `node scripts/mock-llm-server.mjs`.

## Contributing

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Keep it local-first, private, and polished.

## License

MIT — see [LICENSE](./LICENSE).
