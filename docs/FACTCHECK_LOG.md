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
| esm-potrace-wasm | 0.5.1 (to add, M8) | npm field `GPL-2.0` (deprecated SPDX form); upstream repo `src/potrace.js` header: "either version 2 of the License, or (at your option) any later version" and line 20 `@license SPDX-License-Identifier: GPL-2.0-or-later`; Potrace README: same wording | Fetched 09/23/2026 from https://raw.githubusercontent.com/tomayac/esm-potrace-wasm/main/src/potrace.js and https://potrace.sourceforge.net/README | **Verified GPL-2.0-or-later** (D-016). The published package ships only `dist/` plus a GPLv2 LICENSE text, so keep this row as the evidence. Credit Potrace (Peter Selinger) and the wrapper (Thomas Steiner) on About. Note from the spike: the package cannot be imported in Node ESM; browser-only. |
| clipper2-ts | 2.0.1-18 (pin, M10) | BSL-1.0 | npm registry | OK (Boost is GPL-compatible per FSF list). |
| fit-curve | 0.2.0 (vendor, M10) | MIT | https://github.com/soswow/fit-curve | OK. Keep the MIT header in the vendored file. |
| simplify-js | 1.2.4 (vendor, M10) | BSD-2-Clause | https://mourner.github.io/simplify-js/ | OK. |
| 1eurofilter | 1.3.0 (M10) | BSD-3-Clause | https://www.npmjs.com/package/1eurofilter | OK. |
| perfect-freehand | 1.2.3 (pin, M10) | MIT | https://github.com/steveruizok/perfect-freehand | OK. |
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

## Pending checks (owner: the milestone that adds the text)
- Export note "In Word, turn on Contextual Alternates under Font > Advanced" (M11): source https://support.microsoft.com/en-US/Word/font-advanced-settings.
- Handwriting sheet instructions "scan at 300 to 600 dpi in grayscale, not black-and-white" (M9): source Calligraphr FAQ, plus our own test scans.
- "Use Windows Ink must be on in the Wacom driver for pressure" (M10): source SevenPens devnotes and Chromium pen_event_processor.cc.
