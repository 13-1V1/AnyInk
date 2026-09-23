# ANY-INK — Intake brief (Phase 0)

**Core purpose, one sentence:** Let Brennan draw, space, and export his own fonts
entirely by clicking, dragging, and looking, with no code and no font data as text.

**Who the user is:** Brennan Meyer, sole user. Works in Godot, CNC, audio, game dev.
Comfortable with technical tools but wants a font editor that behaves like a drawing
app. American; imperial units everywhere a person reads.

**Platform:** Windows 11 PC, Chrome or Edge. Installable PWA hosted on GitHub Pages,
fully offline after install. No back-end, no accounts, no telemetry.

**Source:** Fork of Glyphr Studio 2 at tag v2.10.5 (GPL-3.0-or-later). Keep upstream
as a remote. Do not rewrite systems that already work.

The original brief is preserved verbatim in [BRIEF-ORIGINAL.md](BRIEF-ORIGINAL.md).
It is the contract for scope, colors, milestones, and "done when".

## What the brief does not say (open questions the studio answers itself)
1. Which places in upstream force text/code entry, and which milestone replaces each.
2. What upstream already provides for undo, kerning UI, metrics editing, and preview.
3. Whether upstream already uses the File System Access API (there is a `file_io.js`).
4. How alternates get a glyph identity that survives export (non-Unicode glyph IDs).
5. Whether font-flux-js can write GSUB `calt`, or export needs a post-process step.
6. Which libraries, if any, to adopt for auto-trace, path offset, curve fitting,
   perspective correction, and seeded noise, and whether their licenses fit GPL-3.
7. How the extended project file stays backward-compatible with plain `.gs2` files.
8. How much of the handwriting-sheet pipeline can avoid a multi-megabyte OpenCV build.
9. The exact theme token set that keeps green and purple legible on white canvas,
   dark canvas, and dark chrome.

## Premise check
- Glyphr Studio 2 is plain JS + Vite with no back-end: **confirmed** by cloning,
  building, and running v2.10.5 unchanged (613 tests pass).
- GPL-3.0 fork with public GitHub Pages hosting: **consistent** with the license.
- Chrome/Edge PWA install with File System Access API on Windows: **true** for
  Chromium browsers; Firefox and Safari are not targets, matching the brief.
- Two gates only (design doc, acceptance): the studio proceeds without asking
  between them and records decisions in `docs/DECISIONS.md`.
