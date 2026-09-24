# Critic fixes — September 24, 2026

Follow-up to [the critic review](PROGRAM-CRITIC-2026-09-24.md). Its score and observations describe the earlier build, not this fix pass.

## Implemented

- Open project files now autosave on a three-second schedule and on glyph switches. A switch during a slow write flushes the newer revision as soon as that write finishes.
- Recovery snapshots run independently, with a three-second maximum scheduling delay during continuous editing. Slow storage or browser suspension can still delay completion.
- The top bar distinguishes saved files, pending edits, recovery-only protection, and failures. Background saves never launch a picker or request permission.
- Manual and automatic writes share a queue. Revision/history checks prevent stale writes from marking newer work saved; ended sessions cannot restart autosave. Web Locks coordinate tabs, and file fingerprints detect external changes before replacement. Recovery retains the expected file version.
- Trace preprocessing runs in the existing worker. Crop, preview/final tracing, advice, and cancellation behavior are covered by focused tests.
- Production builds now include the PWA manifest, Windows/Chrome icon sizes, offline cache, and explicit update prompt. Updates checkpoint edits before activation and refuse to reload when recovery fails or another app window is open.
- AGENTS.md, ROADMAP, DECISIONS and verification records now describe the implemented state and remaining release checks.

## Final integration checks

- npx vitest run: **119 files, 1,885 tests passed**.
- npm run lint: **zero errors**, five existing upstream warnings.
- npm run build: passed; 24 precache entries, no test pages in production.
- node tests/pwa.verify.mjs: all six production-browser checks passed on the final build.
- git diff --check: passed.

Known build warnings remain for upstream browser externalizations, potrace module packaging, the large application chunk, and a PWA-plugin deprecated bundler option.

## Evidence

- Real Chrome file handles in OPFS and IndexedDB: continuous editing reached disk, glyph-switch saves completed, and external changes survived a conflicting autosave.
- A disposable renderer was killed with CDP, without a pagehide cleanup. Recovery restored glyph width 604 and four undo entries.
- Full editor smoke: creating an outline changed the top-bar status from pending to recovery protected; no browser warning/error logs appeared.
- Production PWA harness: manifest/icon/installability checks, offline boot including worker/WASM/fonts, waiting updates, multi-window blocking, recovery-failure blocking, and explicit update followed by offline restart passed. Chrome and Edge evidence is detailed in [PWA verification](PWA-VERIFICATION.md).
- Exported OTF passed process-private Windows native loading, glyph lookup, and rendered-pixel checks. See [font verification](FONT-VERIFICATION.md).
- Worker benchmark preserved SVG output while reducing the measured main-thread preprocessing stall from 135–173 ms to about 7 ms on the exercised image.

## Remaining release checks

These fixes have not been deployed. Desktop installation from GitHub Pages, a real deployed update, native picker permission behavior after restart, GUI font installation, and typing in Word remain unperformed. Private Windows font loading and OPFS tests do not substitute for those checks. Contextual alternates and the other later creative milestones remain separate work.

No existing user project files were changed. Existing uncommitted work was preserved. No commit was created by this fix pass.
