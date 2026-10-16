// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK guides layer overlay (Milestone 5, D-008).
	Draws only three things on top of the finished canvas: the hovered or dragged line in
	the touch color (2 px wide while dragging), a live value label next to the pointer, and
	during a baseline drag a ghost of the current glyph where it will land. Colors come from
	theme tokens at draw time.
	B4: the readout says the house words in both modes ("small-letter line 1100", "right space
	88"; UX-BEGINNER.md 2.4 B), from src/anyink/words; the tail line is never shown as a
	negative number.
	B15 fix (first-timer H1): setReadoutWords(fn) lets Move the guide lines (fontinfo/move_lines.js)
	word a line's readout while it is on: the line's name, no unit number, and why it stopped
	(fn returns '' or null to keep the usual words). In Simple's letter view the readout starts
	right of the line labels' column (letter/guide_lines.js labelColumnRight), never on one; a
	readout setReadoutWords words for a horizontal line sits just above that line, not by the
	pointer (which may have gone on past where the line stopped).
*/
import { getCurrentProject } from '../../app/main.js';
import { drawGlyph } from '../../display_canvas/draw_paths.js';
import { labelColumnRight, letterCanvasOn } from '../letter/guide_lines.js';
import { token } from '../theme/theme.js';
import { word } from '../words/words.js';
import { LIVE_LABELS, metricValue } from './metrics_math.js';
import { guidesLayerState } from './state.js';

const LABEL_FONT = '10px Tahoma, Verdana, sans-serif';
const GHOST_ALPHA = 0.3;

/** B15 fix: (line, value) -> String | null, while Move the guide lines is on */
let readoutWords = null;

/**
 * @param {Function | null} fn - (line, value) -> the readout's words, or '' / null for the usual
 */
export function setReadoutWords(fn) {
	readoutWords = typeof fn === 'function' ? fn : null;
}

/**
 * Called by edit_canvas.js after the guides on the glyph canvas and after the groups on
 * the kern canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} view - {dx, dy, dz}
 * @param {Object} item - the item being edited (Glyph, Ligature, Component, or KernGroup)
 */
export function drawGuidesLayerOverlay(ctx, view, item) {
	const state = guidesLayerState;
	const line = state.line;
	if (!ctx || !view || !line) return;
	if (!state.hover && !state.dragging) return;

	const project = getCurrentProject();
	const font = project.settings.font;
	const dragging = !!state.dragging;
	const value = currentLineValue(line, item, font, state);
	const width = ctx.canvas?.width || 0;
	const height = ctx.canvas?.height || 0;
	const dz = view.dz;

	ctx.save();
	ctx.fillStyle = token('--canvas-guide-hover');
	const thickness = dragging ? 2 : 1;

	if (line.orientation === 'h') {
		let y = view.dy - value * dz;
		y = value > 0 ? Math.floor(y) : Math.ceil(y);
		ctx.fillRect(0, dragging ? y - 1 : y, width, thickness);
	} else {
		const x = Math.floor(view.dx + value * dz);
		const pad = 200 * dz;
		const top = view.dy - metricValue(font, 'ascent') * dz - pad;
		const tall = project.totalVertical * dz + pad * 2;
		ctx.fillRect(dragging ? x - 1 : x, top, thickness, tall);
	}

	if (dragging && line.kind === 'baseline' && state.baselineDelta && canGhost(item)) {
		const ghostView = { dx: view.dx, dy: view.dy + state.baselineDelta * dz, dz };
		drawGlyph(item, ctx, ghostView, GHOST_ALPHA);
	}

	const minX = letterCanvasOn() ? labelColumnRight(ctx) : 0;
	const onLine = line.orientation === 'h' && !!readoutWords?.(line, value);
	const anchor = onLine ? { x: state.pointer.x, y: view.dy - value * dz } : state.pointer;
	drawLiveLabel(ctx, labelText(line, value, item, state), anchor, width, height, minX);
	ctx.restore();
}

/**
 * The Em value the line sits at right now.
 * @param {Object} line - descriptor
 * @param {Object} item - current item
 * @param {Object} font - settings.font
 * @param {Object} state - guidesLayerState
 * @returns {Number}
 */
export function currentLineValue(line, item, font, state) {
	switch (line.kind) {
		case 'metric':
			return metricValue(font, line.key);
		case 'baseline':
			return state.dragging ? state.baselineDelta : 0;
		case 'guide': {
			const guide = getCurrentProject().settings.app.guides?.custom?.[line.index];
			return guide ? Math.round(Number(guide.location)) || 0 : line.value;
		}
		case 'sideBearing':
			return line.side === 'rsb' ? Number(item?.advanceWidth) || 0 : 0;
		default:
			return line.value;
	}
}

/**
 * Text for the live readout, e.g. 'small-letter line 1100'.
 * @param {Object} line - descriptor
 * @param {Number} value - current Em value of the line
 * @param {Object} item - current item
 * @param {Object} state - guidesLayerState
 * @returns {String}
 */
export function labelText(line, value, item, state) {
	const own = readoutWords?.(line, value);
	if (own) return own;
	const readout = (label, shown) =>
		word('canvas.readout', { label: String(label ?? ''), value: String(shown ?? '') });
	switch (line.kind) {
		case 'metric':
			// The tail line says how far down it reaches, never a negative number (2.4 B)
			return readout(LIVE_LABELS[line.key], line.key === 'descent' ? Math.abs(value) : value);
		case 'baseline': {
			const d = state.dragging ? state.baselineDelta : 0;
			return readout(LIVE_LABELS.baseline, `${d > 0 ? '+' : ''}${d}`);
		}
		case 'guide': {
			const guide = getCurrentProject().settings.app.guides?.custom?.[line.index];
			return readout(guide?.name || line.label, value);
		}
		case 'sideBearing': {
			const raw = line.side === 'lsb' ? item?.leftSideBearing : item?.rightSideBearing;
			const shown = Math.round((Number(raw) || 0) * 100) / 100;
			return readout(LIVE_LABELS[line.side], shown);
		}
		default:
			return readout(line.label || line.id, value);
	}
}

function canGhost(item) {
	return !!(item && item.objType !== 'KernGroup' && Array.isArray(item.shapes) && item.shapes.length);
}

function drawLiveLabel(ctx, text, pointer, width, height, minX = 0) {
	ctx.font = LABEL_FONT;
	const textWidth = ctx.measureText ? ctx.measureText(text).width : text.length * 6;
	let x = pointer.x + 12;
	let y = pointer.y - 10;
	if (x + textWidth + 4 > width) x = pointer.x - textWidth - 12;
	if (x < 4) x = 4;
	if (x < minX) x = minX;
	if (y < 12) y = pointer.y + 20;
	if (y > height - 4) y = height - 4;

	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = token('--canvas-label-halo');
	ctx.strokeText(text, x, y);
	ctx.fillStyle = token('--canvas-guide-label');
	ctx.fillText(text, x, y);
}
