# ANY-INK

A personal, purely visual font editor. Draw, space, and export your own fonts by
clicking, dragging, and looking. No code, no font data as text.

ANY-INK is a fork of [Glyphr Studio v2](https://github.com/glyphr-studio/Glyphr-Studio-2)
by Matthew LaGrandeur, forked at release v2.10.5 and licensed under the
GNU General Public License v3 or later (see `LICENSE-gpl-3.0.txt`). The glyph editor,
pen and pointer tools, boolean path operations, components, ligatures, kerning data,
and font import/export all come from Glyphr Studio.

## What ANY-INK adds

- A dark, minimal chrome with a white (or dark) editing canvas.
- Draggable font metrics, drag-to-kern, and an always-on preview strip.
- Open / Save / Save As straight to folders, autosave, and crash recovery.
- Trace layer and auto-trace, a printable handwriting sheet that becomes a font,
  a calligraphy nib brush, a weight slider, hand-drawn alternates that cycle as you
  type, and a roughen / ink-bleed effect.
- Installable as a PWA that works offline.

## Running it

```
npm install
npm run dev      # dev server on http://localhost:5173
npm run build    # production build to dist/
npx vitest run   # tests
```

Windows 11 with Chrome or Edge is the only supported platform.

## Project layout

See `CLAUDE.md` for the codebase map and house rules, and `docs/` for the design
brief, research, decisions, and test logs.
