# gdclone

`gdclone` is a deterministic, browser-based Geometry Dash-inspired platformer prototype built with TypeScript and Vite.

It focuses on clean game-loop architecture, reproducible tests, and CI-friendly end-to-end verification.

## Project Overview

This project implements a single-level auto-runner where the player jumps over spikes, uses jump and dash orbs, auto-triggers jump pads, flips gravity through portals, and manages speed changes. The runtime uses a fixed-step simulation for predictable behavior in both gameplay and tests.

### Features

- Fixed-step (60 FPS) deterministic runtime with authored level data
- Multiple run states: menu, running, practice, paused, dead, complete
- Practice mode with checkpoints and restart behavior
- Speed-change triggers plus jump orbs, dash orbs, jump pads, and gravity portals
- Lightweight synthesized SFX (no external audio assets required)
- Deterministic test hooks for automation (`window.advanceTime`, `window.render_game_to_text`)
- Saved best completion time and lowest completion crash count across refreshes (localStorage)
- Mobile landscape handling with portrait pause overlay, safe-area-aware viewport fit, and letterboxed 800x450 rendering
- Unit tests for collision and audio behavior
- Deterministic Playwright-based e2e completion test

## Controls

- `Space` or `ArrowUp`: jump (also starts a run from menu); activates jump/dash orbs while overlapping
- Left click / tap on canvas: jump
- `R`: restart run
- `P`: toggle practice mode
- `Esc`: pause/resume
- `F`: toggle fullscreen

## Mobile Landscape Behavior

- Internal gameplay resolution remains fixed at `800x450`; canvas display scales uniformly to fit without cropping or stretching.
- On likely-phone portrait viewports, a rotate-to-landscape overlay is shown and gameplay simulation is paused.
- Rotating back to landscape hides the overlay and resumes simulation automatically.
- On phone user gestures (`tap/click` and `Space`), the app makes a best-effort attempt to enter fullscreen and lock landscape orientation (without crashing if unsupported/denied).

## Quick Start

### Prerequisites

- Node.js (current LTS recommended)
- npm

### Install and Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal (usually `http://127.0.0.1:5173` or `http://localhost:5173`).

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run test:run`: run Vitest once in non-watch mode
- `npm run test:e2e:complete`: run deterministic end-to-end completion test
- `npm run build`: type-check (`tsc`) and build production assets with Vite
- `npm run preview`: preview the production build locally

## Deterministic E2E Completion Test

`npm run test:e2e:complete` validates that the level can be completed reliably in an automated environment.

It works by:

1. Starting a local Vite server on `127.0.0.1:4173`.
2. Loading [`scripts/e2e/harness.html`](./scripts/e2e/harness.html), which disables `requestAnimationFrame` so time is advanced only through `window.advanceTime`.
3. Replaying the authored action sequence from [`scripts/e2e/complete-actions.json`](./scripts/e2e/complete-actions.json).
4. Reading the latest `state-*.json` in `output/e2e-complete/` and asserting completion fields (`mode`, `completedRunSeconds`, `bestCompletionSeconds`, `crashCount`).

This keeps the test stable and reproducible compared with live real-time input on the normal game route.

## Project Structure

```text
src/
  main.ts                 # app bootstrap + canvas mount + deterministic hooks
  style.css               # shell/game presentation
  game/
    runtime.ts            # core loop, state transitions, collision + triggers
    renderer.ts           # drawing and overlays
    input.ts              # keyboard/pointer/touch controls
    levelData.ts          # authored level objects and triggers
    collision.ts          # collision and helper utilities
    audio.ts              # synthesized SFX
    *.test.ts             # deterministic unit tests
scripts/
  e2e/
    harness.html          # RAF-disabled deterministic harness
    generate-complete-actions.mjs
    complete-actions.json
    test-complete.mjs     # e2e orchestration and assertions
```

## Known Caveats

- Playwright browser binaries are required for `test:e2e:complete`. On a fresh machine, run:

```bash
npx playwright install chromium
```

- The deterministic e2e test intentionally uses the harness route (`/scripts/e2e/harness.html`) instead of the normal game route to avoid timing flakiness.

## Legal Notes

- This repository is licensed under Apache-2.0. See [`LICENSE`](./LICENSE).
- The Apache-2.0 license is a good fit here because it is free/open-source and explicitly states that trademark rights are **not** granted by the license.
- This project does **not** grant rights to third-party IP (names, logos, music, level data, or assets from commercial games).
- See [`NOTICE`](./NOTICE) for trademark and attribution notes.

## GitHub Pages Deployment

- Workflow: `.github/workflows/pages.yml`
- Triggers: push to `main`, plus manual `workflow_dispatch`
- Build/deploy flow: `npm ci` -> compute Vite `base` from `GITHUB_REPOSITORY` -> `npm run build -- --base=...` -> upload `dist` -> deploy to Pages
- URL pattern for project sites: `https://<owner>.github.io/<repo>/`
- URL pattern for user/org sites (`<owner>.github.io` repo): `https://<owner>.github.io/`

## Publishing Checklist

- Verify the selected license works for your distribution goals.
- Push to your public GitHub repository and verify the CI workflow in `.github/workflows/ci.yml` passes.

Repository URL: `https://github.com/djordjeperovic/gd-clone`
