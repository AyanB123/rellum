# Contributing

Thanks for wanting to help! Rellum is a small, focused app — quality over
features.

## Workflow

1. Fork, then create a branch: `feat/my-feature` or `fix/my-bug`.
2. Keep commits focused; use
   [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(popup): add condense animation`.
3. `pnpm lint && pnpm typecheck && pnpm test` must pass.
4. Open a PR describing what changed and why. Screenshots/GIFs for UI changes.

## Code standards

- TypeScript strict mode. No `any` in committed code.
- Prefer small modules with a single responsibility.
- UI: Tailwind utility classes; keep the design tokens in one place.
- Every new IPC channel needs a type in `src/shared/ipc.ts` and a preload
  binding — no ad-hoc `ipcRenderer.send` strings.

## Design principles

- Local-first: never add a cloud dependency.
- Privacy: never log user content.
- Respect the user's clipboard, focus, and attention.
