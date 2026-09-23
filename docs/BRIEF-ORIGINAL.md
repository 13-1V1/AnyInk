# ANY-INK — Build Brief (original, verbatim from Brennan, 09/23/2026)

A personal, purely visual font editor. Fork of Glyphr Studio v2, renamed and reskinned, shipped as an installable PWA.

* Display name: ANY-INK
* Repo / folder / code name: `AnyInk`
* User: Brennan only. Not a public product. No accounts, no telemetry, no onboarding for strangers.
* Platform: Windows PC, Chrome or Edge (both support PWA install and the File System Access API). Other browsers are not a target.
* Build with: the `software-studio` skill. Before starting, also check for any other skills that fit this build.

## 1. Goal

Draw, edit, space, and export my own fonts without writing code or editing font data as text. Anything I'd do in a font editor, I do by clicking, dragging, and looking.

## 2. Source (search-before-build: done)

* Upstream: https://github.com/glyphr-studio/Glyphr-Studio-2
* Plain JavaScript, no UI framework, Vite build, runs with no back-end.
* Already has: pen and pointer tools, boolean path ops, components, kerning, ligatures, multi-project editing, OTF/TTF/WOFF/SVG import, OTF export.
* Fork from the latest tagged release, not a random commit. Record the tag in CLAUDE.md. Keep upstream as a git remote so bug fixes can be pulled in later if they merge cleanly.
* License is GPL-3.0. Keep it. Keep the original copyright notice and LICENSE file. Credit Glyphr Studio in the About screen.

Fork it, then customize. Do not rewrite systems that already work.

## 3. What "purely visual" means

* Every edit to a glyph, its spacing, or the font's metrics happens on the canvas or through visual controls: drag handles, sliders, swatches, toggles.
* No code panels, no script consoles, no raw OpenType feature-file editing, no editing font data as text or JSON.
* Typing is still fine for plain words: font name, glyph names, and sample text in the preview strip.
* Number fields can stay as a secondary readout next to a visual control, never as the only way to change something.

## 4. Scope

### Keep from upstream (as-is, reskinned)

Glyph editing, pen and pointer tools, boolean path ops, components, ligatures, import, export, and multi-project copy/paste.

### Change

1. Rename. All visible "Glyphr Studio" branding becomes ANY-INK. Keep credits and license.
2. Reskin: modern minimalist. Clean, flat, lots of breathing room, thin lines, no clutter.
   * App chrome (toolbars, panels, menus) is dark.
   * Editing canvas (the glyph drawing area) defaults to a white background with dark outlines, like ink on paper.
   * Canvas theme toggle: one click switches the canvas to dark. Remember the choice between sessions.
   * Two-tone accent: green + purple. Each color has one job so they never compete:
      * Green `#16A34A` marks what you're touching: selected points, active tool, primary buttons, current glyph.
      * Purple `#7C3AED` marks structure: bezier handles, guide lines, metrics lines, kerning indicators.
      * Both must stay clearly visible on the white canvas, the dark canvas, and the dark chrome. If one fails, adjust the shade but keep the hue family.
   * Define every color as a theme token in one file. No hard-coded colors in components.
3. Visual metrics. Baseline, x-height, cap height, ascender, and descender are purple guide lines you drag up and down on the canvas. Changes show live in the preview strip.
4. Visual kerning. Kern by dragging the right letter of a pair left or right in a live pair view. If upstream kerning is number-entry only, build this on top of upstream's kerning data. Don't replace the data model.
5. Preview strip. Extend upstream's test-drive preview into an always-visible strip along the bottom of the editor. It shows the current font in real words, updates live as you draw, and has editable sample text and a size slider in points.
6. Files.
   * Open, Save, and Save As go straight to my folders through the File System Access API. Remember the last-used folder.
   * Autosave writes to the open file on a short timer and on every glyph switch. A brand-new project that hasn't been saved yet is covered by crash recovery until the first Save.
   * Crash recovery keeps a rolling copy in browser storage (IndexedDB). On launch after a crash, offer to restore it.
   * Export OTF to a folder I pick.
   * Project file format: extend upstream's project file. It must also store nib skeletons and settings, alternates, roughen settings with the untouched originals, and trace images. Trace images are saved in the project but never in the exported font. Older project files must still open.
7. PWA.
   * Manifest, service worker, and a pen-nib app icon in green and purple on a dark background, flat and minimal to match the UI. Provide all the icon sizes Windows and Chrome need.
   * Installs from Chrome/Edge with a desktop icon and its own window, and works fully offline.
   * Updates: when a new version is deployed, show a small "Update ready — reload" notice. Never reload on its own and lose work.
8. Hosting. GitHub Pages (https is required for PWA install). The repo must be public for free Pages; that's fine since the code is GPL anyway. Font project files are never committed to the repo.

### Add (only if upstream lacks it; check first)

* Undo/redo that covers every action, including metrics and kerning drags.
* Trace layer: drop in a photo or scan of hand lettering, set its opacity with a slider, and draw over it. The image is reference only and never exported.

### Out of scope

Variable fonts, color fonts, poster/mockup previews, collaboration, cloud sync, a plugin system, and anything multi-user.

## 5. Creative features

These are the features that make ANY-INK mine and not just a reskin. Search for existing free libraries before building each one (candidates are noted but not verified).

1. Handwriting sheet → font.
   * Generate a printable template on US Letter (8.5 × 11 in): a labeled grid of boxes, one per character, with baseline and x-height guides and corner registration marks. Choose which character sets to include (A–Z, a–z, 0–9, punctuation).
   * Fill it in by hand, scan or photograph it, and drop the image into ANY-INK.
   * ANY-INK finds the registration marks, straightens the page, splits it into boxes, auto-traces each one, places each glyph on the baseline, and sets a sensible default spacing (side bearings) so the font is typeable right away.
   * Show a visual review grid: every traced letter beside its scan, with accept, retrace, or redraw per glyph.
2. Auto-trace.
   * Turn any dropped image into clean outlines, with sliders for threshold, smoothing, and detail.
   * Used by the sheet feature and on its own. The manual trace layer stays for hand tracing.
   * Candidate: a potrace JS/WASM port.
3. Nib brush.
   * Draw a centerline (skeleton) with the tablet or mouse. ANY-INK inks it like a calligraphy nib, with sliders for width, angle, and nib shape (flat, round, pointed). An optional toggle lets tablet pen pressure vary the width.
   * The skeleton stays editable. Changing the nib settings re-inks the letter, or every letter at once.
   * "Flatten to outline" converts it to normal editable paths.
   * Candidates: a curve-fitting library for smoothing tablet strokes, and a path-offset library for inking.
4. Weight slider.
   * One slider makes the font bolder or thinner by growing or shrinking outlines, with a live before/after in the preview strip.
   * Whole font: Apply saves the result as a new font project (e.g. "MyFont Bold") and never overwrites the original.
   * Selected glyphs: Apply changes them in place, undoable. This is for evening out letters that came out too thin or thick.
   * Candidate: Clipper2 JS for path offsetting.
5. Hand-made alternates.
   * Draw 2–3 versions of any letter. In the glyph view, alternates sit side by side as visual tabs.
   * On export, the font automatically cycles alternates as you type (OpenType contextual alternates), so repeated letters don't look stamped.
   * The user never sees or edits feature code. If upstream's exporter can't write this, extend it.
   * Alternates inherit the base letter's spacing and kerning unless changed.
   * The preview strip shows the cycling live.
6. Roughen / ink bleed.
   * Distress sliders: edge roughness, ink spread, and random seed for a "reroll" button.
   * Preview live, then apply to selected glyphs or the whole font. The original is kept so the effect can be removed or changed later.

All six follow the same rules as everything else: visual controls only, undoable, and each built as its own module with its own test page in `tests/`.

## 6. Units

* Glyph coordinates use font units (units per em). That's the format's native unit, so it's fine.
* Type sizes are shown in points (pt). Physical measurements, if any, are in inches.
* No millimeters or other metric units anywhere in the UI.

## 7. Code rules (Brennan's standing rules)

* File header. Every new file starts with this two-line header in the file's own comment syntax, using the real date the file is written (MM/DD/YYYY). Never copy the date from this brief.
  ```
  Created by: Brennan Meyer with use of Claude Code MM/DD/YYYY Santa Clarita, CA
  brennanmmeyer@gmail.com
  ```
   * For upstream files you modify, add the header above the existing GPL notice. Never remove upstream notices.
   * Files with no comment syntax (JSON, the web manifest) skip the header.
* Unix way. Small modular pieces, each doing one job. New features go in their own modules, not bolted into big upstream files.
* Design for the end user, not for what's easiest to code.
* Input: full keyboard shortcuts plus mouse and pen-tablet support. Gamepad isn't needed (this isn't a game).

## 8. Workflow rules

* Plan first. Anything over about 3 steps gets a written plan, and each step is checked before the next starts.
* Search before building. Before adding any feature, check upstream, npm, and GitHub for an existing free solution to use.
* Minimal test pages. When building or fixing one feature, don't load the whole app. Make a minimal test page in `tests/` that loads only what that feature touches. Iterate there, then integrate and verify once in the real build. Reuse an existing test page when one fits. Configure Vite so `tests/` is never in the production build.
* Full-app bugs. If a bug only reproduces in the full app, say so and work in the real build.
* CLAUDE.md. Create it at the start. Run `/init` after any major milestone to keep project context current.

## 9. Milestones

Each milestone ends with a verified working state before moving on.

1. Fork and run. Clone the latest upstream release, build it, and confirm it runs unchanged. Create CLAUDE.md.
2. Rename. Change all branding to ANY-INK. Credits and license stay intact.
3. Visual audit. List every place that forces code or font-data-as-text entry. Hide each one, or map it to the milestone that replaces it with a visual control. Note what upstream already has for undo, kerning, metrics, and preview.
4. Reskin. Theme tokens, dark chrome, white canvas with dark toggle, green/purple accents. Check contrast on both canvases.
5. Visual editing. Draggable metrics, drag kerning, preview strip, and any undo gaps.
6. Files. Open, Save, Save As, autosave, crash recovery, OTF export, and the extended project format. Each later feature adds its data to the format as it's built.
7. Trace layer.
8. Auto-trace. Built before the sheet feature, since the sheet depends on it.
9. Handwriting sheet. Template, scan import, split, auto-trace, review grid.
10. Nib brush.
11. Alternates. Including export, verified by typing repeated letters in another app.
12. Weight slider.
13. Roughen / ink bleed.
14. PWA. Manifest, service worker, pen-nib icon, update notice. Test install and offline on localhost first.
15. Deploy. Publish to GitHub Pages and install on my PC from there.
16. End-to-end check.
   * Fill in a handwriting sheet, scan it, and build a font from it (A–Z, a–z, 0–9).
   * Add alternates for a few letters, kern a few pairs, and make a Bold with the weight slider.
   * Export both as OTF, install them in Windows, and type with them in another app.
   * Kill the tab mid-edit and confirm crash recovery works.

## 10. Done when

* ANY-INK installs from a desktop icon, opens in its own window, and runs offline.
* I can make a complete font start to finish without writing code or editing font data as text.
* I can go from a hand-filled sheet to an installed font.
* The exported OTF installs in Windows and works in other apps, with alternates cycling as I type.
* Autosave and crash recovery lose no more than a few seconds of work.
* No Glyphr branding remains except the credits and license.
