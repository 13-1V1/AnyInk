# ANY-INK — Theme and reskin spec (Milestone 4)

Written 09/23/2026. This is the contract for every file touched during the reskin.

## Direction
Modern minimalist. Dark chrome that recedes; the canvas is a white sheet of paper floating
on it, with dark ink and hairline purple structure. One click makes the sheet slate.
Flat surfaces, thin lines, generous padding, few borders, no gradients, no glow.
Type is quiet (FiraGo, already bundled); the user's own font in the preview strip is
the display face of this app. Eyebrow labels (PAGE, EDITING, PANEL) are tiny, tracked,
uppercase, faint.

## The only source of color
`src/anyink/theme/tokens.css`. No other file may contain a color literal (hex, rgb, hsl,
or a named color other than `transparent` / `currentColor` / `inherit`). This includes
inline styles in JS strings, SVG icon strings, shadow-DOM stylesheets imported with
`?inline`, and canvas drawing code.

Canvas and other JS code get colors from `src/anyink/theme/theme.js`:

```js
import { token, withAlpha, onThemeChange } from '../anyink/theme/theme.js';
ctx.strokeStyle = token('--canvas-guide');                 // read at draw time, never at module load
ctx.fillStyle = withAlpha(token('--canvas-ink'), 0.28);    // real alpha, replaces getColorFromRGBA
```
`token()` is cached and cleared on theme change, so calling it inside draw functions is cheap.
Never store a token value in a module-level constant.

## Token roles

| Token | Use it for |
|---|---|
| `--chrome-bg` | page background behind everything |
| `--chrome-bg-raised` | cards, panels, menus, dialogs, tiles |
| `--chrome-bg-sunken` | top bar, wells, text fields, code chips |
| `--chrome-bg-hover` | hover on rows, tiles, menu items, secondary buttons |
| `--chrome-border` | hairline dividers between regions (use `var(--hairline)`) |
| `--chrome-border-strong` | borders on fields, toggles, buttons that need an edge |
| `--chrome-text` / `-muted` / `-faint` | body text / secondary text / eyebrows and hints |
| `--chrome-text-inverse` | text on a green (touch) fill |
| `--touch` / `-hover` / `-active` / `-soft` | primary buttons, selected tiles and rows, active tool button, checked checkbox accent, current glyph, focus |
| `--structure` / `-strong` / `-deep` / `-soft` | anything that shows structure in the chrome: link color, tab underline, info-bubble icon, kern chips, structural icons |
| `--danger` / `-soft` | delete buttons, error toasts |
| `--warning` / `-soft` | warnings |
| `--field-*` | inputs, textareas, input-number, option-chooser, sliders |
| `--canvas-*` | everything drawn on an edit or display canvas, plus the canvas wrapper background |

## Mapping from upstream tokens and literals

Judge by role, not by the old name. Typical cases:

| Old | New |
|---|---|
| `--blue-l97`, `--blue-l99`, `--offWhite`, `white` as a page or card background | `--chrome-bg` (page) or `--chrome-bg-raised` (card) |
| `--blue-l95`, `--gray-l95` hover backgrounds | `--chrome-bg-hover` |
| `--blue-l85`, `--gray-l85`, `--gray-l90` borders | `--chrome-border` (divider) or `--chrome-border-strong` (control edge) |
| `--blue-l20/l30/l40` nav buttons, `--blue-l50/l55/l65` links | nav buttons: `--chrome-bg-sunken` with `--chrome-text`; links: `--structure` (hover `--structure-strong`) |
| `--accent-color`, `--accent-color-dark`, selected states, `--enabled-active-fill` | `--touch` family |
| `--enabled-resting-text` and other `--enabled-*` text | `--chrome-text` / `--chrome-text-muted` |
| `--disabled-*` | `--chrome-text-faint`, `--field-disabled-*` |
| `--red`, `--darkRed`, `--lightRed` | `--danger`, `--danger-soft` |
| `--green-l90` toast background | `--touch-soft` with `--chrome-text` text |
| `--purple-*` fancy toast / accents | `--structure-soft` background, `--structure` text |
| `--orange-*` (upstream's warning and canvas labels) | `--warning` in chrome; `--canvas-link` / `--canvas-kern` on canvas |
| `--royal-*` icon fills | `--structure` (structural icons) or `--chrome-text-muted` (neutral icons) |
| `--dark-gradient-background` | `--chrome-bg` (flat, no gradient) |
| `--l1/l2/l3-shadow` | `--shadow-card` (cards) or `--shadow-menu` (menus, dialogs); most cards need none |
| canvas guide/grid rgb constants (`guide.js`) | `--canvas-guide`, `--canvas-guide-muted`, `--canvas-grid` |
| canvas `'#000'` glyph fill, `'#FFF'` handle fill, `'white'` halos | `--canvas-ink`, `--canvas-handle-fill`, `--canvas-label-halo` |
| `accentColors.blue.l65` selection, `uiColors.accent` points | `--canvas-selection`, `--canvas-point` (+ `--canvas-point-selected` when selected) |
| `accentColors.green.l65` component-instance selection, `royal` outline-mode strokes | `--canvas-component`, `--canvas-ink-outline` |
| `'orange'` kern rect in display canvas, `purple.l60/l70` kern lines | `--canvas-kern-positive` / `--canvas-kern-negative`, `--canvas-kern` |
| `'red'` quality-check rings | `--canvas-error` |

Canvas points: unselected on-curve points are hollow purple (`--canvas-point` stroke,
`--canvas-point-fill`); the selected point is solid green (`--canvas-point-selected`).
Handles are purple lines with small hollow purple dots. Bounding box and selected path
outline are green. Drag-to-select box: `--canvas-selection` stroke, `--canvas-selection-soft` fill.

## Shape and spacing
- Radius: `--radius` (6px) on cards, buttons, fields; `--radius-sm` on chips; `--radius-lg` on dialogs.
- Borders: hairlines only where regions meet. Cards are distinguished by surface, not border.
- Padding: cards `--space-4`; between cards `--space-3`; page content `--space-5`.
- Buttons: primary = `--touch` fill, `--chrome-text-inverse` text, weight 600, no gradient, no animation;
  secondary = transparent with `--chrome-border-strong` border and `--chrome-text`; danger = `--danger` outline.
  Hover: primary `--touch-hover`, secondary `--chrome-bg-hover`. Focus: `box-shadow: var(--focus-ring)`.
- Fields: `--field-bg`, `--field-border`, focus border `--field-border-focus`, text `--field-text`.
- Sliders: `accent-color: var(--touch)`; never the hue-shifting hsl.
- Scrollbars: thumb `--chrome-scrollbar`, track transparent.
- Delete `--global-focus-style` dashed outlines; use `--focus-ring`.
- Keep every existing class name, id, and DOM structure. This is a restyle, not a re-layout.
  Dimensions (panel widths, grid columns, canvas sizes) stay as they are unless a rule here says otherwise.

## Canvas wrapper and toggle
`.editor-page__edit-canvas-wrapper` (and the live preview wrapper) use `background-color: var(--canvas-bg)`
with `box-shadow: 0 0 0 1px var(--chrome-border), 0 8px 24px var(--canvas-paper-edge)` so the sheet floats.
The dark toggle is a view-tool button (paper / slate icon) that calls `toggleCanvasTheme()` and redraws
(the edit canvas subscribes with `onThemeChange`). `initTheme()` runs from `index.html` before the app boots.
The pop-out window gets `tokens.css` injected and `applyThemeTo(popDoc)`.

## Legibility study (computed 09/23/2026, WCAG contrast ratios)
| Pair | Ratio | Verdict |
|---|---|---|
| `--chrome-text` #e8e9ec on `--chrome-bg` #141519 | 15.0:1 | text OK |
| `--chrome-text-muted` #9a9da6 on #141519 | 6.7:1 | text OK |
| `--chrome-text-faint` #83868f on #141519 | 4.9:1 | small text OK |
| `--touch` #16a34a on #141519 | 5.5:1 | icons, borders, text OK |
| `--chrome-text-inverse` #141519 on `--touch` #16a34a | 5.5:1 | button text OK |
| `--structure` #a78bfa on #141519 | 6.7:1 | text and lines OK |
| `--structure-deep` #7c3aed on #141519 | 3.2:1 | NOT for dark chrome (that is why the lifted shade exists) |
| `--canvas-guide` #7c3aed on white | 5.7:1 | lines OK |
| `--canvas-selection` #16a34a on white | 3.3:1 | lines and fills OK (non-text needs 3:1) |
| `--canvas-guide` #a78bfa on `--canvas-bg` dark #1b1c22 | 6.2:1 | lines OK |
| `--canvas-selection` #22c55e on #1b1c22 | 7.5:1 | OK |
| `--canvas-ink` #111318 on white / #f3f4f6 on #1b1c22 | 18.6:1 / 15.4:1 | OK |
