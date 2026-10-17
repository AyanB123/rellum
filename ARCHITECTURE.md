# Rellum — Architecture Specification (v1, clean-room)

> Working name: **Rellum** (final name pending brand research). This document is an original
> specification for a local-first desktop AI writing copilot with optional computer-use
> and browser-automation capabilities. Written from product-level requirements only.

## 1. Product summary

A tiny, always-resident desktop companion:

- Press a **global hotkey** in any app → the current **selection** is captured.
- A **sleek popup** materializes near the caret/selection with three rewrite actions:
  *Improve*, *Proofread*, *Condense* (plus custom user prompts later).
- The chosen **local LLM** streams a rewrite; the result can be **pasted back in place**,
  **copied**, or **regenerated** (retry chains on the previous output).
- Optional **computer-use mode**: full-screen vision (screenshot → VLM) + programmatic
  mouse/keyboard control for autonomous task execution.
- Optional **browser mode**: drives the user's *real* Chrome (their profile, their
  logged-in sessions) via CDP for web automation.
- **Local-first**: no cloud, no telemetry, no account. The only network calls go to a
  user-configured OpenAI-compatible local endpoint (llama.cpp / LM Studio / vLLM / Ollama).

## 2. Core loop (text mode)

```
hotkey (default Ctrl+Shift+Space)
  → preserve clipboard
  → clear clipboard
  → send Ctrl+C
  → poll clipboard (<= 300ms budget, retry a few frames)
  → restore clipboard
  → compute popup position: caret/selection anchor if known, else pointer
  → show popup near anchor (frameless, always-on-top, skipTaskbar)
  → stream rewrite from local LLM (OpenAI-compatible /v1/chat/completions)
  → actions: paste-back (clipboard + Ctrl+V) | copy | retry(prev output)
```

Clipboard preservation is mandatory: the user's clipboard must never be clobbered.
Both directions use the same save/restore dance. Fallback when the target app drops
Ctrl+C injection: an inline editable textarea in the popup ("paste here or type").

## 3. Runtime topologies

The app must work in all of these, auto-detected, no config required:

| Topology | Vision/text LLM | Notes |
|---|---|---|
| A. Existing local server | any OpenAI-compatible endpoint | default; auto-detect :11434 (Ollama), :1234 (LM Studio), :8080 (llama.cpp), :20128 |
| B. Embedded llama.cpp | bundled binary | lazily downloaded per-model on first use; CUDA build for NVIDIA, Vulkan build else |
| C. No local model | disabled with clear error + setup guide | detect GPU: vendor string lookup, not torch |

## 3.1 GPU detection

`nvidia-smi` presence → NVIDIA (CUDA-capable llama.cpp build). Windows: use
`dxdiag`/WMI `Win32_VideoController.Name` for vendor. Expose in settings UI
("Vision engine: CUDA (NVIDIA)" / "Vulkan (Intel/AMD)" / "CPU").

## 4. Windows stack

- **Shell**: Electron (main + preload + renderer), TypeScript strict.
- **Renderer**: React 18 + Vite; Tailwind CSS; lucide icons; framer-motion for
  popup entrance/exit; frameless, transparent, always-on-top popup window.
- **Keyboard**: native `globalShortcut` for hotkey; automation via **nut.js**
  (forked/patched for per-platform builds) or SendInput via koffi FFI. robotjs is
  abandoned; nut.js is the maintained option and supports clipboard-restore-safe typing.
- **Active window/app title**: call GetForegroundWindow + GetWindowText via koffi
  (no extra native dep like PaymoActiveWindow).
- **Popup positioning**: caret rect is not directly accessible cross-app on Windows;
  use pointer position + monitor work-area clamping. (Documented limitation.)
- **Packaging**: electron-builder (nsis + portable), auto-update via GitHub Releases
  (electron-updater + generic provider).

## 5. Vision / computer-use subsystem

- Screenshot: `desktopCapturer` full-screen (all displays) → PNG.
- VLM: OpenAI-compatible multimodal endpoint, `image_url` with base64 data URI.
- Action grammar: `click(x,y) | double_click | right_click | scroll(dx,dy) |
  type(text) | hotkey(keys...) | wait(ms) | done(summary)`.
- Grounding the vision model: split screen into per-monitor images; scale by device
  pixel ratio; keep a bounded action history; VLM returns JSON actions only.
- Control backend: nut.js (SendInput). `delivery_mode`-style guard: computer-use
  actions always require an explicit run banner + user-visible overlay + ESC kill-switch
  (global, always registered while a computer-use run is active).

- **Vision engines**:
  - `llama.cpp` with `--mmproj` for Qwen2.5-VL / SmolVLM / InternVL GGUFs (Vulkan/CUDA);
  - Ollama vision models (`llava`, `qwen2.5vl`) via native API;
  - any remote OpenAI-compatible vision endpoint for users who opt in.

## 6. Browser automation subsystem

- **Real Chrome profile**: launch the user's actual Chrome binary with
  `--user-data-dir` pointing at their real profile (default profile) and
  `--remote-debugging-port=9222` (+ `--profile-directory` when a specific profile is
  chosen). Requires Chrome to be fully closed first (lock on profile). App offers
  "attach to running Chrome" if the port is already up.
- Driver: Playwright (core, no browser download) connecting over CDP
  (`chromium.connectOverCDP`). No playwright-bundled browsers shipped.
- Capabilities in UI: navigate, click, fill, screenshot, extract text; agent-driven
  flows via the same action grammar + DOM-first (Playwright selectors) then
  vision-fallback.

## 7. Security & privacy

- No telemetry, no analytics, no crash reporting to third parties. Opt-in local logs.
- Clipboard is never logged. Screenshots live only in RAM/temp; paths configurable.
- Computer-use & browser agent both require explicit user action to start; visual
  overlay always on; ESC kill switch; action log written to local SQLite.
- Settings stored via electron-store (plaintext JSON, user's own machine).
- CSP strict; contextIsolation; no nodeIntegration in renderer.

## 8. Repo & workflow conventions

- Node >= 20, pnpm, TypeScript strict, ESLint + Prettier, Vitest, Playwright smoke test.
- Conventional Commits + semantic-release; GitHub Actions: lint/test/build matrix;
  release workflow drafts GH Releases with built artifacts (nsis + portable + dmg later).
- MIT license. DCO/CLA not required. CODEOWNERS single maintainer. Security policy file.
- Docs: README with GIFs, ARCHITECTURE.md, SELF-HOSTING.md, PRIVACY.md, CONTRIBUTING.md.
- Package name must not collide with npm existing packages; check before publish.

## 9. Milestones

1. M1: text loop end-to-end (hotkey → popup → LLM → paste-back) with settings UI.
2. M2: branding, onboarding, auto-detect local endpoints, embedded llama.cpp download.
3. M3: computer-use vision loop + kill switch + overlay.
4. M4: browser automation over real Chrome profile (CDP).
5. M5: packaging, CI, docs, website one-pager, release v0.1.0.
