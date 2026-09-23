# tests/ — minimal feature pages

One page per feature, loading only what that feature touches. Start them with
`npm run pages` (Vite on port 5174, repo root, never built). Pages import from
`../src/...`. Set `window.log = () => {}` before importing upstream modules that
call the bare `log()` helper. Vitest unit tests live beside the code in `src/`.
