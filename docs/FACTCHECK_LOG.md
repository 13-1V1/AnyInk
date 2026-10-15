# ANY-INK — Fact-check log

Every claim the app makes (help text, export notes, credits, licenses) and every dependency,
checked against a source in [RESEARCH.md SOURCES](RESEARCH.md#sources). Newest at the bottom.

## Dependencies and licenses

| Dependency | Version | License string | Source of truth | Verdict |
|---|---|---|---|---|
| font-flux-js | 2.9.0 | GPL-3.0-only (package.json) | node_modules/font-flux-js/package.json | OK. Combined distribution is effectively GPL-3.0-only; ANY-INK stays GPL-3.0-or-later, upstream ships the same combination. Credit on About. |
| bezier-boolean | 1.0.6 | GPL-3.0-only | node_modules/bezier-boolean/package.json | OK, same note as above. |
| @mattlag/xmltojson | 2.0.2 | GPL-3.0 | node_modules | OK. |
| svg-to-bezier | 2.3.0 | GPL-3.0 | node_modules | OK. Was mis-declared as a devDependency although imported at runtime; moved to dependencies 09/23/2026. |
| esm-potrace-wasm | 0.5.1 (added M8, pinned 0.5.1) | npm field `GPL-2.0` (deprecated SPDX form); upstream repo `src/potrace.js` header: "either version 2 of the License, or (at your option) any later version" and line 20 `@license SPDX-License-Identifier: GPL-2.0-or-later`; Potrace README: same wording | Fetched 09/23/2026 from https://raw.githubusercontent.com/tomayac/esm-potrace-wasm/main/src/potrace.js and https://potrace.sourceforge.net/README | **Verified GPL-2.0-or-later** (D-016). The published package ships only `dist/` plus a GPLv2 LICENSE text, so keep this row as the evidence. Credit Potrace (Peter Selinger) and the wrapper (Thomas Steiner) on About. Note from the spike: the package cannot be imported in Node ESM; browser-only. |
| clipper2-ts | 2.0.1-18 (pinned exactly, installed B8 10/15/2026; was planned for M10) | BSL-1.0 | npm registry; installed `node_modules/clipper2-ts/package.json` (2.0.1-18, BSL-1.0), checked 10/15/2026 (B8 + B9 finalize) | OK (Boost is GPL-compatible per FSF list). Shipped: the Brush unites its nib hulls with it; credited on About, license in THIRD-PARTY-NOTICES. |
| fit-curve | 0.2.0 (vendored B8 10/15/2026 as `src/anyink/nib/vendor/fit_curve.js`) | MIT | https://github.com/soswow/fit-curve; the vendored file's header, checked 10/15/2026 | OK. The MIT header stays in the vendored file. |
| simplify-js | 1.2.4 (vendored B8 10/15/2026 as `src/anyink/nib/vendor/simplify.js`) | BSD-2-Clause | https://mourner.github.io/simplify-js/; the vendored file's header, checked 10/15/2026 | OK. Notice ships in THIRD-PARTY-NOTICES. |
| 1eurofilter | 1.3.0 (pinned exactly, installed B8 10/15/2026) | BSD-3-Clause | https://www.npmjs.com/package/1eurofilter; installed `node_modules/1eurofilter/package.json` (1.3.0, BSD-3-Clause), checked 10/15/2026 | OK. Notice ships in THIRD-PARTY-NOTICES. |
| perfect-freehand | 1.2.3 (pinned exactly, installed B8 10/15/2026) | MIT | https://github.com/steveruizok/perfect-freehand; installed `node_modules/perfect-freehand/package.json` (1.2.3, MIT), checked 10/15/2026 | OK. The Brush's live picture only (RESEARCH 2.3). |
| simplex-noise | 4.0.3 (pin, M13) | MIT | https://github.com/jwagner/simplex-noise.js | OK. |
| js-aruco2 | 2.0.0 (vendor 2 files, M9) | MIT | https://raw.githubusercontent.com/damianofalcioni/js-aruco2/master/LICENSE.txt | OK. Keep LICENSE text with the vendored files. |
| idb-keyval | 6.3.0 (M6) | Apache-2.0 | https://registry.npmjs.org/idb-keyval | OK (Apache-2.0 is compatible with GPLv3, not GPLv2). |
| vite-plugin-pwa | 1.3.0 (dev, M14) | MIT | https://registry.npmjs.org/vite-plugin-pwa/latest | OK, build-time only. |
| harfbuzzjs | 1.6.2 (dev, M11) | MIT | https://github.com/harfbuzz/harfbuzzjs | OK, tests only, never shipped. |

## Claims in the app

| Date | Claim | Where | Source | Result |
|---|---|---|---|---|
| 09/23/2026 | "ANY-INK is a personal fork of Glyphr Studio v2 ... by Matthew LaGrandeur ... Copyright © 2010 - 2026" | About > Credits | upstream index.html GPL notice, README | Correct. |
| 09/23/2026 | Library list on About (Font Flux JS, bezier-boolean, SVG-to-Bézier, XMLtoJSON, all GPL) | About > Credits | node_modules package.json files | Correct. New libraries must be appended as they are adopted. |
| 09/23/2026 | "The upstream help site still covers the shared editing features" | Help page | https://www.glyphrstudio.com/help | Correct for pen/pointer tools, components, ligatures, import/export. ANY-INK-specific features are not covered there. |
| 09/24/2026 | Potrace card: "the bitmap tracer by Peter Selinger", "GNU General Public License, version 2 or (at your option) any later version", "Copyright © 2001 - 2019, Peter Selinger" | About > Credits (M8) | https://potrace.sourceforge.net/README (fetched 09/24/2026: "Copyright (C) 2001-2019 Peter Selinger", "either version 2 of the License, or (at your option) any later version") | Correct. |
| 09/24/2026 | esm-potrace-wasm card: "Potrace compiled to WebAssembly for the browser, by Thomas Steiner", GPL 2 or later, "Copyright © 2021, Thomas Steiner" | About > Credits (M8) | upstream `src/potrace.js` header (checked by the M8 scaffold 09/24/2026: "Copyright (C) 2021 Thomas Steiner", `SPDX-License-Identifier: GPL-2.0-or-later`) | Correct. |
| 10/15/2026 | Clipper2 (clipper2-ts) card: "Clipper2 by Angus Johnson; TypeScript port by Jeremy Tribby", Boost Software License 1.0, "Copyright © 2010 - 2025, Angus Johnson" | About > Credits (B8 + B9 integration) | `node_modules/clipper2-ts/package.json` (2.0.1-18, `license: BSL-1.0`, author "Angus Johnson (original C# version), TypeScript port by Jeremy Tribby"), its LICENSE (Boost 1.0) and `src/Clipper.ts` header ("Copyright : Angus Johnson 2010-2025"), read 10/15/2026 | Correct. The full license ships in `src/public/THIRD-PARTY-NOTICES.txt`. |
| 10/15/2026 | perfect-freehand card: "by Steve Ruiz", MIT License, "Copyright © 2021, Stephen Ruiz Ltd" | About > Credits (B8 + B9 integration) | `node_modules/perfect-freehand/package.json` (1.2.3, MIT, author Steve Ruiz) and LICENSE ("Copyright (c) 2021 Stephen Ruiz Ltd"), read 10/15/2026 | Correct. Full text in THIRD-PARTY-NOTICES. |
| 10/15/2026 | 1€ filter (1eurofilter) card: "by Géry Casiez and Alix Goguey", BSD 3-Clause License, "Copyright © 2019, Inria" | About > Credits (B8 + B9 integration) | `node_modules/1eurofilter/package.json` (1.3.0, BSD-3-Clause, author "Géry Casiez and Alix Goguey") and `dist/OneEuroFilter.js` header ("Copyright 2019 Inria", the BSD-3 text), read 10/15/2026 | Correct. Clause 2 (binary redistribution reproduces the notice in the documentation or other materials): the notice and conditions ship in THIRD-PARTY-NOTICES, linked from About. |
| 10/15/2026 | fit-curve card: "Philip J. Schneider's method", MIT License, "Copyright © 2014, Volker Poplawski" | About > Credits (B8 + B9 integration) | the vendored `src/anyink/nib/vendor/fit_curve.js` header (the package's LICENSE: "Copyright (c) 2014 Volker Poplawski"; "Algorithm for Automatically Fitting Digitized Curves by Philip J. Schneider"), read 10/15/2026 | Correct. Full text in THIRD-PARTY-NOTICES and the vendored file. |
| 10/15/2026 | Simplify.js card: "by Vladimir Agafonkin", BSD 2-Clause License, "Copyright © 2017, Vladimir Agafonkin" | About > Credits (B8 + B9 integration) | the vendored `src/anyink/nib/vendor/simplify.js` header (the package's LICENSE: "Copyright (c) 2017, Vladimir Agafonkin", BSD-2 text), read 10/15/2026 | Correct. Clause 2 met as for the 1€ filter. |

## Pending checks (owner: the milestone that adds the text)
- Export note "In Word, turn on Contextual Alternates under Font > Advanced" (M11): source https://support.microsoft.com/en-US/Word/font-advanced-settings.
- Handwriting sheet instructions "scan at 300 to 600 dpi in grayscale, not black-and-white" (M9): source Calligraphr FAQ, plus our own test scans.
- "Use Windows Ink must be on in the Wacom driver for pressure" (M10): source SevenPens devnotes and Chromium pen_event_processor.cc.

## 09/24/2026 critic fix verification sources
- Existing upstream and ANY-INK reader/writer, recovery, worker and test modules were inspected before adding code. File APIs reuse the existing writeToHandle helper and history model; PWA reuses vite-plugin-pwa/Workbox.
- Chrome's File System Access documentation requires checking permission on reused handles; background saves use queryPermission only. https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- Vite PWA documents prompt updates and registration strategies. Automatic page reload is explicitly disabled in ANY-INK. https://vite-pwa-org.netlify.app/guide/prompt-for-update
- Native Windows font evidence and API references are in FONT-VERIFICATION.md. Private process loading/rendering is not claimed as a GUI install or Word session.
- Correction: the original M6 few-seconds promise was not satisfied by a 15-second max-wait timer. File autosave and the 3-second recovery scheduler are now independently exercised; storage failures/suspension remain explicit limits.
- The installed software-studio SKILL.md references supporting files absent from that plugin bundle. The build follows its readable core instructions and the project's explicit rules; no absent reference was treated as read.
