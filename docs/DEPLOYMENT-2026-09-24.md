# Deployment — 09/24/2026

- [x] Confirm main matches origin and review the Pages workflow and publication scope.
- [x] Commit the verified application, tracing, autosave and PWA changes; push main.
- [x] Wait for GitHub Actions tests/build/deploy and verify the public app and offline assets.

Authorized by Brennan: deploy. No font projects, exports, credentials or local build output are included. Previous verification: 1,885 passing tests, zero lint errors, successful production build and PWA checks. Windows-only native font test skips on Linux CI.

Published application commit: 3af8d27b09f1e557fa03b51808c2eb87471bae86.
GitHub Actions: https://github.com/13-1V1/AnyInk/actions/runs/36040048275 — success.
Live app: https://13-1v1.github.io/AnyInk/

The first run stopped on a five-second timeout in a 48-combination image regression. Split into six parameterized cases, preserving all assertions. Retry passed tests, build and deployment. Subsequent concurrent local tracing edits were excluded from the release and preserved.

Live Chrome verification in a disposable persistent profile: HTTP 200, ANY-INK standalone manifest, active service worker, successful offline reload, no page errors. Served bundle index-CMfMcsgj.js matches the verified production build. Desktop installation remains a separate interactive check.
