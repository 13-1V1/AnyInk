# Windows OTF release verification

Verified 09/24/2026. **PASS: real ANY-INK OTF export, Windows private font loading,
native text measurement and offscreen GDI rendering.** A GUI font installation and
typing in Word or another interactive application remain **unverified**. Do not
mark that separate critic requirement complete on the strength of this test.

## Repeat

From `C:/Users/brenn/AnyInk`, with the existing dependencies installed:

```powershell
npx vitest run tests/font-release.test.js
```

Requires Windows and Windows PowerShell (`powershell.exe`, .NET Framework
System.Drawing, and GDI). The test explicitly skips on non-Windows hosts. It
starts no browser, app window, dev server, or full editor UI. Vitest's existing
jsdom/canvas setup supplies the environment needed by the project model; native
rendering occurs in a separate Windows PowerShell process and uses real GDI.

Each run creates a unique `%TEMP%/anyink-font-release-*` directory containing:

- `representative.otf`: actual exported font, not a mocked font buffer.
- `manifest.json`: unique family, FontFlux version, SHA-256, tables and pixel probes.
- `A.png` through `F.png`, plus `text.png`: native raster evidence.
- `native-results.json` and `native-output.txt`: measurements, loader/removal
  results, and subprocess output. A nonzero test exit is a failure even if a
  partial report exists (cleanup writes a report on failure too).

Vitest may hide successful console output. Locate the newest run with:

```powershell
Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'anyink-font-release-*' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

Files are retained in temp for review. No fonts or font projects are written into
the repository. Existing `.gitignore` ignores exported OTF/TTF/WOFF/WOFF2 files;
`git check-ignore tests/font-release-generated.otf` confirmed the OTF rule.
No dependency changes, permanent font installation, registry edits, or commits.

## Export and native checks

The test follows `tests/autotrace.html`'s **Export and look** path:
`potraceSvgToShapes` converts the existing real Potrace SVG fixtures to project
Paths, and `ioFont_exportFont('otf', true)` builds the font. A cloned sample
project supplies settings; its glyphs, components and kerning are replaced by
this small isolated fixture. The test does not retrace pixels or exercise the
Auto-trace Apply button/history. F references a real translated ComponentInstance.

The installed `font-flux-js` is **2.9.0**. Inspection of its actual bundled
`dist/font-flux-js.js` export dispatcher (`Tv`, `Cv`) confirmed that `otf` forces
CFF and then writes the SFNT container; `sfnt` writes the current outline flavor.
ANY-INK's testing branch requests `sfnt`, while its production save branch
requests `otf`. This test asserts the resulting `OTTO` signature and `CFF ` table,
so a silent TrueType export cannot pass. It does not exercise destination picking
or the production file-write branch.

Assertions cover:

- CFF and GPOS tables, all six encoded outlines, contour counts, and 1000-font-unit
  advances; the exported A/B kerning pair round-trips as **-100 font units**.
- SHA-256 checked again by the native process before loading the OTF.
- `AddFontResourceExW` with `FR_PRIVATE` (16) returns a positive font count.
- `CreateFontW` at a 200-pixel em selects the unique family; `GetTextFaceW` must
  return that exact name. `GetGlyphIndicesW` rejects missing glyphs/.notdef,
  preventing an unnoticed fallback-font pass.
- `GetTextExtentPoint32W` measures each glyph and a repeated text string.
- `TextOutW` renders to a System.Drawing bitmap at an explicit baseline. Every
  glyph must contain ink. Sixteen interior pixels assert paper or ink with
  tolerances that avoid antialiased boundaries.
- GDI font objects are deselected/deleted, DCs and bitmaps released, and
  `RemoveFontResourceExW` called in `finally`; removal must succeed.

The bitmap's black/white values are diagnostic test signals, not app theme colors.

## Recorded passing run

Command: `npx vitest run tests/font-release.test.js` — **1 file, 1 test passed**,
3.95 seconds total (native/export test 1.39 seconds).

Windows reported `Microsoft Windows NT 10.0.26200.0`. Font family:
`AnyInk-dca1e877`. OTF length: **2456 bytes**.

SHA-256:
`29be019f4b32d2723a019e02d568a657155c5a99d58e7c66ddd3332f0345eecf`

Evidence directory:
`C:/Users/brenn/AppData/Local/Temp/anyink-font-release-rcZ7pr`.
The random family and font timestamps mean later hashes can differ.

| Encoded character | Fixture appearance | CFF contours | Native ink pixels | Pixel probes |
| --- | --- | ---: | ---: | ---: |
| A | Traced O, curved ring and counter | 2 | 16232 | 4 |
| B | Bullseye: outer ring, hole, inner island | 3 | 14532 | 4 |
| C | Traced A with counter | 2 | 5733 | 1 |
| D | Square with square hole | 2 | 20000 | 2 |
| E | Lowercase i: separate dot and stem | 2 | 3441 | 3 |
| F | Ring component translated +50 x, -25 y font units | 2 | 16232 | 2 |

Each glyph measured **200 pixels**. `ABCDEF ABCDEF` measured **2450 pixels**:
twelve 200-pixel advances and a 50-pixel space. Loader returned **1**; removal
returned **true**. The native montage was also visually inspected: holes, island,
detached dot, and component offset were present. Ink-pixel counts are recorded
evidence, not brittle cross-machine golden assertions.

## Limits and release status

- **No GUI installation or Word/other interactive app session was exercised.**
  The external consumer here is a dedicated PowerShell/C# process calling the
  Windows native font APIs. FR_PRIVATE intentionally does not expose the font
  to other processes, so opening Word during this run would not test this font.
- Kerning was checked in the exported data using FontFlux's parser. GDI TextOut
  here uses ordinary advances; the 2450-pixel result does **not** demonstrate
  native GPOS shaping. WPF/DirectWrite/Word shaping and kerning remain unverified.
- This checks representative outlines at one large size. It is not an exhaustive
  font validator, small-size hinting test, all-Unicode test, ligature test, or
  TTF/WOFF/WOFF2 verification. It does not validate every future user font.
- No full build or broad suite was run for these isolated test-only changes.
  Existing user changes were preserved; only `tests/font-release*` and this doc
  were added.

## Official API references

- Microsoft: [AddFontResourceExW](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-addfontresourceexw)
  documents OTF support, process-private visibility and process-exit cleanup.
- Microsoft: [RemoveFontResourceExW](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-removefontresourceexw)
  is the matching explicit removal API.
- Microsoft: [Font and Text Functions](https://learn.microsoft.com/en-us/windows/win32/gdi/font-and-text-functions)
  describes face lookup, glyph indices, text measurement and output.
