// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter view, the canvas side: the edges and spaces (UX-BEGINNER.md 4.3 Canvas, 7.2). In
	Simple with the letter view on, and only while Fine-tune is open (view_switches.js
	fineTuneShows('edges'), the letter-card track's state): two purple edges at the left and
	right of the letter's width, with the spaces between the ink and each edge shaded light
	purple, from the top line to the tail line. A space the ink reaches past is not shaded.

	Pointing at an edge outlines it in green and says "left space" / "right space" by the
	pointer, with no number (principle 3: numbers only while something is dragged). While it is
	dragged, the guides layer's own readout shows ("right space 88", metrics/overlay.js). The drag
	itself is B3's: guides_layer.js marks the letter "set by you" (spacing/owner.js 'manual')
	before its one Undo step, so the refit never snaps it back, and a left-edge drag moves the
	view so the ink stays still. This file only draws and says when the overlay keeps quiet.

	All tools, and Simple before the letter view's flag is on, draw the edges as before
	(edit_canvas.js drawSystemGuidelines).

	  edgesShown(item)                 true while the letter view shows this letter's edges
	  edgeLayout(item, view, font)     pure: { left, right, top, bottom, ink: { left, right },
	                                   spaces: [{ side, x0, x1 }] } in canvas px
	  drawEdges(ctx, view, item, project, { alpha, thickness })   true when drawn
	  hidesLayerOverlay(item, state)   true when edit_canvas.js must not draw the guides layer's
	                                   overlay: in the letter view a side edge pointed at (this
	                                   file says its name instead), or any side edge while the
	                                   edges are hidden
*/
import { guidesLayerState } from '../metrics/state.js';
import { token, withAlpha } from '../theme/theme.js';
import { word } from '../words/words.js';
import { letterCanvasOn } from './guide_lines.js';
import { fineTuneShows } from './view_switches.js';

/** Letters with spacing of their own (not reusable parts, not gaps) */
const SPACED_TYPES = Object.freeze(['Glyph', 'Ligature']);
/** The spaces' light purple: the guide token at this strength */
export const SPACE_SHADE_ALPHA = 0.1;
/** How far the edges reach past the top line and the tail line, in font units */
const EDGE_PAD = 50;
/** The pointed-at edge is this many canvas px wider each side (the green outline) */
const HOVER_GROW = 1;
/** The guides layer's readout style (metrics/overlay.js), so pressing just adds the number */
const LABEL_FONT = '10px Tahoma, Verdana, sans-serif';

/**
 * @param {Object | false} item - the open item
 * @returns {Boolean} true while the letter view shows this letter's edges
 */
export function edgesShown(item) {
	if (!letterCanvasOn() || !fineTuneShows('edges')) return false;
	if (!item || !SPACED_TYPES.includes(item.objType)) return false;
	return !!item.shapes?.length;
}

/**
 * @param {Object} item - a letter with shapes
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object} font - project.settings.font
 * @returns {{left: Number, right: Number, top: Number, bottom: Number,
 *   ink: {left: Number, right: Number} | null, spaces: Array<{side: String, x0: Number,
 *   x1: Number}>}} canvas px: the edges' x, the letter box's top and bottom (top line to tail
 *   line), the ink's sides, and the shaded spaces
 */
export function edgeLayout(item, view, font) {
	const sx = (x) => view.dx + x * view.dz;
	const sy = (y) => view.dy - y * view.dz;
	const width = Number(item?.advanceWidth) || 0;
	const top = sy(Math.max(Number(font?.ascent) || 0, Number(font?.capHeight) || 0));
	const bottom = sy(-Math.abs(Number(font?.descent) || 0));
	const layout = { left: sx(0), right: sx(width), top, bottom, ink: null, spaces: [] };
	const maxes = inkSides(item);
	if (!maxes) return layout;
	layout.ink = { left: sx(maxes.xMin), right: sx(maxes.xMax) };
	if (maxes.xMin > 0) layout.spaces.push({ side: 'lsb', x0: sx(0), x1: sx(maxes.xMin) });
	if (maxes.xMax < width) layout.spaces.push({ side: 'rsb', x0: sx(maxes.xMax), x1: sx(width) });
	return layout;
}

/**
 * @param {Object} item
 * @returns {{xMin: Number, xMax: Number} | null} the ink's left and right, font units
 */
function inkSides(item) {
	if (!item?.shapes?.length) return null;
	try {
		const { xMin, xMax } = item.maxes || {};
		if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax < xMin) return null;
		return { xMin, xMax };
	} catch {
		return null;
	}
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object | false} item - the open letter
 * @param {Object} project
 * @param {{alpha?: Number, thickness?: Number, state?: Object}} [options] - alpha and thickness
 *   from guide_strength.js systemGuideStroke (the writing line's 3:1); state: the guides layer's
 * @returns {Boolean} true when drawn
 */
export function drawEdges(ctx, view, item, project, options = {}) {
	if (!(Number(view?.dz) > 0) || !edgesShown(item)) return false;
	const { alpha = 1, thickness = 1, state = guidesLayerState } = options;
	const font = project?.settings?.font || {};
	const layout = edgeLayout(item, view, font);
	const pad = EDGE_PAD * view.dz;
	const pointed = pointedEdge(state);

	ctx.save();
	// The spaces, light purple, under the edges
	ctx.fillStyle = withAlpha(token('--canvas-guide'), SPACE_SHADE_ALPHA);
	layout.spaces.forEach((space) => {
		ctx.fillRect(space.x0, layout.top, space.x1 - space.x0, layout.bottom - layout.top);
	});

	// The edges: purple; the one pointed at or dragged, green and wider
	[
		['lsb', layout.left],
		['rsb', layout.right],
	].forEach(([side, at]) => {
		const touched = pointed === side || state?.dragging === side;
		const grow = touched ? HOVER_GROW : 0;
		ctx.fillStyle = touched ? token('--canvas-guide-hover') : withAlpha(token('--canvas-guide'), alpha);
		ctx.fillRect(
			Math.floor(at) - grow,
			layout.top - pad,
			thickness + grow * 2,
			layout.bottom - layout.top + pad * 2
		);
	});

	// Pointing (not dragging): the edge's name by the pointer, no number
	if (pointed && !state?.dragging) {
		drawPointerLabel(ctx, word(pointed === 'lsb' ? 'space.lsb' : 'space.rsb'), state.pointer);
	}
	ctx.restore();
	return true;
}

/**
 * @param {Object | false} item - the open letter
 * @param {Object} [state] - the guides layer's state
 * @returns {Boolean} true when the guides layer's overlay must not be drawn now
 */
export function hidesLayerOverlay(item, state = guidesLayerState) {
	if (!letterCanvasOn()) return false;
	const line = state?.line;
	if (!line || line.kind !== 'sideBearing') return false;
	if (!state.hover && !state.dragging) return false;
	if (!edgesShown(item)) return true;
	return !state.dragging;
}

/**
 * @param {Object} state - the guides layer's state
 * @returns {'lsb' | 'rsb' | false} the side edge under the pointer
 */
function pointedEdge(state) {
	const side = state?.hover;
	return side === 'lsb' || side === 'rsb' ? side : false;
}

/**
 * The name by the pointer, where the drag readout will show (metrics/overlay.js drawLiveLabel).
 * @param {CanvasRenderingContext2D} ctx
 * @param {String} text
 * @param {{x: Number, y: Number}} pointer
 */
function drawPointerLabel(ctx, text, pointer = { x: 0, y: 0 }) {
	const width = ctx.canvas?.width || 0;
	const height = ctx.canvas?.height || 0;
	ctx.font = LABEL_FONT;
	const textWidth = ctx.measureText ? ctx.measureText(text).width : text.length * 6;
	let x = pointer.x + 12;
	let y = pointer.y - 10;
	if (width && x + textWidth + 4 > width) x = pointer.x - textWidth - 12;
	if (x < 4) x = 4;
	if (y < 12) y = pointer.y + 20;
	if (height && y > height - 4) y = height - 4;
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = token('--canvas-label-halo');
	ctx.strokeText(text, x, y);
	ctx.fillStyle = token('--canvas-guide-label');
	ctx.fillText(text, x, y);
}
