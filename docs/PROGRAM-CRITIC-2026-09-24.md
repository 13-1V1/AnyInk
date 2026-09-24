# Review: ANY-INK 0.1.0, current working tree
*Personal visual font editor · reviewed 2026-09-24 · bar applied: personal prototype, milestones 1–8*

## Verdict
**6.4/10 — Promising, but the promised save protection is incomplete.**
The editor runs, the real auto-trace worker produces outlines quickly, and a generated OTF renders correctly in Chrome. Browser recovery also survives a reload and restores the glyph and undo queue. The biggest gap is that automatic recovery snapshots do not write the open project file, despite the design promising file autosave; continuous editing also exceeds the promised few seconds of recoverable work.

## Scorecard
| Dimension | Score | One-line justification (evidence-tied) |
|-----------|:-----:|----------------------------------------|
| Functionality & completeness | 7/10 | Sample editing, tracing and OTF generation work; open-file autosave is absent from the exercised edit paths. |
| Reliability & robustness | 5/10 | Real IndexedDB restore and failure feedback work, but the automated probes expose a 14-second unprotected editing window. |
| Performance & efficiency | 7/10 | Real worker pipeline medians 48–207 ms on generated 1,000–2,000 px images; full Photo processing includes substantial main-thread work. |
| UX & design | 7/10 | Clear canvas/chrome separation and persistent text preview; save-protection wording overstates the observed guarantee. Limited desktop smoke review. |
| Code quality & architecture | 8/10 | Feature modules and isolated pages are practical; 1,809 existing tests pass and focused tests can drive real editor/history/recovery code. |
| Security & safety | N/T | No dedicated adversarial security review or native filesystem permission/collision test in this pass. |
| Polish & documentation | 5/10 | Useful test pages and design records, but milestone/context documents disagree and the stated autosave behavior is not delivered. |
| **Overall (weighted)** | **6.4/10** | Default rubric weights, excluding security and renormalizing the remaining 90%. |

## What I tested (and didn't)
- **Tested:** working tree based on `56c7c6bd`, including existing uncommitted auto-trace changes. Reconnaissance, complete existing Vitest suite, lint, production Vite compilation, Chrome sample-project navigation and canvas inspection, real worker/image-pipeline benchmarks, actual OTF generation and browser rendering, actual IndexedDB snapshot/reload/restore, injected storage failure and recovery, and two repeated controlled timer/file-write probes.
- **Plan followed:** inspect current scope; run baseline checks; exercise isolated pages and reproduce save gaps; integrate one full-app smoke check; write this report. No application implementation was changed.
- **Harness:** `tests/critic-recovery.test.js`, retained for reproduction. Uses real ProjectEditor, GlyphrStudioProject, History, pub/sub and recovery; virtual time, injected in-memory storage driver, and an instrumented file handle. This is evidence of missing file-write calls, not a native disk test. The tests deliberately assert the observed defects and must be changed when those defects are fixed.
- **Browser harnesses:** `tests/autotrace.html` and `tests/recovery.html`, served at localhost:5184; full app at localhost:5185. These isolated origins avoid the user's live hosted project.
- **Not tested:** OS process termination/power loss, native file pickers and actual disk writes, real concurrent browser writers, full accessibility/keyboard/tablet audit, sustained memory use, hostile font imports, Windows font installation, Edge, production-host runtime, PWA installation/offline/update behavior, handwritten scans, sheet conversion, nibs, alternates, weight and roughen. Later milestones are unfinished scope, not newly discovered regressions. Reload recovery is not equivalent to a hard-crash test.

## Strengths
- **The tracing pipeline is real and fast on its fixtures.** Chrome ran the actual worker/WASM implementation; the square-with-hole test produced one SVG path with two subpaths in 10 ms on a warm run.
- **Export preserves counters in the tested glyph.** Applying the ring fixture and pressing “Export and look” built a 2,112-byte OTF in 14 ms; the page's rendered-font probe reported “paper: the hole stayed a hole.” This does not establish Windows compatibility for all fonts.
- **Recovery is materially improved from the old workflow report.** The current code uses distinct session keys. In Chrome, snapshot width 610 and one undo entry survived reload and restored exactly. A simulated quota failure returned false and displayed a save-your-work warning; switching back to real IndexedDB produced a successful width-620 snapshot with two undo entries.
- **Good isolated tooling.** Existing feature pages let tracing and recovery be tested without repeatedly loading the full app. The complete existing suite passed: 115 files, 1,809 tests.

## Stress-test results
| Test / exact action | Measured result | Assessment |
|---|---|---|
| `npx vitest run` before adding critic harness | 115 files / 1,809 tests passed; 30.32 s | Baseline passes; does not cover the missing requirements below. |
| `npm run lint` | 0 errors, 5 existing warnings | Pass with known warnings. |
| `npx vite build ./src/ --emptyOutDir --base=/app/` | Success; main JS 3,069.54 kB, gzip 678.65 kB; worker 79.37 kB | Compilation verified without rewriting app_config. Browser-externalization/CommonJS and chunk-size warnings remain. |
| Auto-trace page → Time 1000 and 2000 px, both modes | 1000 Scan: median 49 ms, first 234 ms; Photo: 48 ms, first 62 ms | Fast on generated fixture. |
| Same benchmark, 2000 px | Scan: median 152 ms, first 162 ms; Photo: 207 ms, first 215 ms | Photo binarization alone reported 155 ms; possible brief UI stalls, not a measured frame-time failure. |
| Trace square, then ring fixture → Replace outlines → Export and look | 1 path / 2 subpaths; OTF counter remained paper | Real worker and exporter pass this fixture. |
| Recovery page → Edit → snapshot → show record → reload → Restore → show record | Width 610 and undo queue length 1 restored | Real IndexedDB persistence verified. |
| Recovery page → Break storage → Edit → snapshot → Fix storage → snapshot → show record | Failure warning; then true, width 620, queue length 2 | Failure injected through page's fake driver; repaired write used actual IndexedDB. |
| `npx vitest run tests/critic-recovery.test.js --reporter=verbose` | Both repetitions: zero snapshots after 14 one-second edits; one at 15 s; zero file writes after 75 s and a glyph switch | Confirms both save-protection gaps. |

## Bugs & risks (severity-ranked)
- **[P1 / High] Open-file autosave is missing.** In each of two probes, attach a granted `.gs2` handle to a real editor, change a glyph through real History, advance timers, switch glyph and advance another minute. Recovery captures width 615, but `createWritable` is called **zero times**. `src/anyink/recovery/recovery.js` writes `recSet`, and its glyph-switch hook only invokes that snapshot path. `docs/DESIGN_DOC.md` promises writes to the open file every few seconds and on glyph switches. **Fix:** add serialized background file saves for already-authorized handles, retain recovery until the corresponding file revision is safely written, and report permission/write failures without opening background pickers. Add a test asserting file contents after timer and glyph-switch events.
- **[P1 / High] Continuous editing can lose substantially more than a few seconds.** `SNAPSHOT_MAX_WAIT_MS` is 15,000. In both probes, one completed edit per second leaves **no recovery record at 14 seconds**; the first appears at 15 seconds. A hard crash before that write can lose the entire streak; no hard crash was needed to demonstrate absence of any saved snapshot. **Fix:** enforce a short maximum interval consistent with the brief (for example 3–5 seconds), independently of the trailing debounce, and verify continuous edits plus slow writes. Do not rely on pagehide to protect against abrupt termination.
- **[P2 / Medium] Completion records overstate protection and disagree about progress.** Disk AGENTS lists M7/M8 pending while ROADMAP marks both done; ROADMAP also says “at most a few seconds” next to a documented 15-second limit. This is a directly observed documentation mismatch, not a runtime reproduction. **Fix:** reconcile AGENTS/ROADMAP/TEST_LOG with delivered and verified behavior, and reopen M6 acceptance until its original file-autosave requirement passes.

## UX findings
The desktop glyph view has a readable white drawing area, dark panels, clear selected-tool green and a useful persistent sample strip. The bundled Oblegg sample retains its saved guide visibility, so not all metric lines appear immediately; test discoverability with a fresh project before drawing broader conclusions. The recovery page's “every few seconds” wording is too reassuring for a 15-second maximum during continuous work. A persistent indication distinguishing “saved to file,” “recovery copy saved,” and “not yet protected” would make the actual state understandable.

## Recommendations (prioritized)
1. **[P1]** Complete open-file autosave with race-safe file writes and native Chrome verification before depending on the editor for irreplaceable work.
2. **[P1]** Tighten the maximum recovery interval and prove the promised loss bound under continuous edits, delayed writes and a forcibly terminated tab.
3. **[P2]** Reconcile progress documents and save-state wording. Preserve the existing isolated tests and convert the critic probes into required-behavior regressions after fixing them.
4. **[P2]** Before release, verify native file collisions/permissions, multi-tab editing, Windows OTF installation, and production offline/install/update behavior. Consider moving full-resolution binarization off the main thread if real scans produce noticeable stalls.

## Bottom line
This is a credible personal prototype with working tracing, rendering and browser recovery. It is not yet safe to treat the promised autosave guarantees as complete. Finishing and proving those guarantees would raise confidence more than adding another creative feature now.


Follow-up: [implemented fixes and verification](FIX-REPORT-2026-09-24.md). The review above remains a historical record of the earlier build.
