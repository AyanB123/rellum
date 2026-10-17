# Rellum

**Your words, lit from within.**

Rellum is a local-first desktop AI writing copilot. Press a hotkey in *any* app,
and a sleek popup appears next to your selection. A local language model
improves, proofreads, or condenses your text — then pastes it right back where
it was. No cloud. No account. No telemetry. Your words never leave your machine.

```text
select text → hotkey → Improve / Proofread / Condense → pasted back in place
```

## Highlights

- **Works everywhere** — email clients, editors, browsers, IDEs, chat apps.
- **Local-first & private** — talks only to an OpenAI-compatible endpoint *you*
  choose (Ollama, LM Studio, llama.cpp, vLLM, or any LAN server).
- **Clipboard-safe** — your clipboard is preserved and restored every time.
- **Streamed results** — see the rewrite as it is generated.
- **Optional computer-use** — a vision+control engine for autonomous tasks with
  a hard kill switch (vision models run locally too).
- **Optional browser automation** — drives *your real Chrome profile* via CDP,
  so logged-in sessions just work.
- **Polished UI** — a dark, minimal popup with fluid motion, built with care.

## Install

Download the latest installer for Windows from
[Releases](https://github.com/AyanB123/rellum/releases), or build from source:

```bash
pnpm install
pnpm dev
```

## Quick start

1. Make sure a local model server is running (e.g. `ollama serve` with your
   favorite model, LM Studio, or `llama-server`).
2. Launch Rellum. It lives in your tray.
3. Select some text anywhere, press `Ctrl+Shift+Space`, choose an action.

## Development

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design and
[CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow.

```bash
pnpm install
pnpm dev       # run with hot reload
pnpm test      # unit tests
pnpm package   # build distribables
```

## Privacy

Rellum makes **no network calls except to your configured model endpoint**.
There is no telemetry, crash reporting, or analytics. See
[PRIVACY.md](./PRIVACY.md).

## License

MIT — see [LICENSE](./LICENSE).
