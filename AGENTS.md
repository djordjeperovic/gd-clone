Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Repository Guidance

- Keep edits scoped to the user request; avoid touching gameplay source files unless explicitly asked.
- After non-trivial edits, run:
  - `npm run test:run`
  - `npm run build`
- Preserve deterministic automation hooks and flow:
  - `window.advanceTime` and `window.render_game_to_text`
  - `scripts/e2e/harness.html` RAF-disable behavior
  - `scripts/e2e/generate-complete-actions.mjs` and `complete-actions.json` alignment
- Do not add copyrighted third-party game assets (art, audio, fonts, level data). Prefer original or clearly licensed assets.
- Do not add third-party trademarks/logos into UI, package metadata, or docs beyond factual nominative references.
- Keep generated automation artifacts out of source control (for example `output/`).
