// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: drawing on the edit canvas (Milestone 7).
	Owner: TRACK A (model + draw + bitmap cache).

	Hooks (src/edit_canvas/edit_canvas.js, redrawGlyphEdit):
	- drawTraceImage: right after clearRect, so the image sits under the grid, guides,
	  and outlines. globalAlpha = opacity, ctx.filter invert when invert, high-quality
	  smoothing, save / restore. Draws nothing while the bitmap is still decoding (the
	  cache calls onBitmapReady and the canvas redraws), when the trace is hidden, or
	  when its image is missing from editor.assets.
	- drawTraceAffordances: right after drawGuidesLayerOverlay. Bounding box (structure
	  purple, touch green while the body is hovered or dragged) and four square corner
	  handles (touch green; the hovered or dragged one filled; no hover highlight while a
	  metric line is hovered or dragged, since a press goes to the line), only when the Trace panel
	  is open and the trace is visible and unlocked. The handles also need the Resize
	  tool, the only tool that can grab them (D-028); with any other tool the frame alone
	  shows where the image is. While a drag runs, a small readout
	  beside it says where the image is or how big it is (DESIGN_DOC 6: live readouts
	  next to the thing being dragged). The box shows even while the image decodes or
	  when the image is missing, so the trace can always be found and removed.
	Colors come from theme.js token() only. Canvas math is inlined (canvas = dx + x*dz,
	dy - y*dz), matching sXcX / sYcY in edit_canvas.js without importing it.
*/
import { guidesLayerState } from '../metrics/state.js';
import { token } from '../theme/theme.js';
import { getBitmap } from './bitmap_cache.js';
import { isTraceLayerTool, traceLayerState } from './trace_layer.js';
import { getTrace, TRACE_CORNERS } from './trace_model.js';

/** Side of a drawn corner handle, in screen pixels. */
export const TRACE_HANDLE_PX = 9;

/** How far from a corner (screen pixels, in x and in y) a press still grabs its handle. */
export const TRACE_HANDLE_HIT_PX = 7;

const LABEL_FONT = '10px Tahoma, Verdana, sans-serif';
const LABEL_GAP_PX = 10;

/**
 * The corner hit radius for hitTestTrace, in font units, at a zoom level.
 * @param {Object} view - {dx, dy, dz}
 * @returns {Number}
 */
export function traceHandleRadiusFU(view) {
	const dz = Number(view?.dz);
	return dz > 0 ? TRACE_HANDLE_HIT_PX / dz : TRACE_HANDLE_HIT_PX;
}

/**
 * The trace's rectangle on the canvas, in canvas pixels.
 * @param {Object} trace - a normalized trace
 * @param {Object} view - {dx, dy, dz}
 * @returns {{x: Number, y: Number, width: Number, height: Number} | null}
 */
export function traceCanvasRect(trace, view) {
	if (!trace || !view) return null;
	const dz = Number(view.dz);
	const rect = {
		x: Number(view.dx) + trace.x * dz,
		y: Number(view.dy) - trace.y * dz,
		width: trace.width * trace.scale * dz,
		height: trace.height * trace.scale * dz,
	};
	const finite = [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
	return finite && rect.width > 0 && rect.height > 0 ? rect : null;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} view - {dx, dy, dz}
 * @param {Object} item - the item on the canvas (Glyph; KernGroup never gets here)
 * @param {Object} editor - ProjectEditor (assets)
 */
export function drawTraceImage(ctx, view, item, editor) {
	if (!ctx || !view) return;
	const trace = getTrace(item);
	if (!trace || !trace.visible) return;

	const blob = editor?.assets?.get?.(trace.asset)?.blob;
	if (!blob) return;
	const bitmap = getBitmap(blob);
	if (!bitmap || !(bitmap.width > 0) || !(bitmap.height > 0)) return;

	const rect = traceCanvasRect(trace, view);
	if (!rect) return;

	ctx.save();
	ctx.globalAlpha = trace.opacity;
	if (trace.invert) ctx.filter = 'invert(1)';
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} view - {dx, dy, dz}
 * @param {Object} item - the item on the canvas
 * @param {Object} editor - ProjectEditor (nav)
 */
export function drawTraceAffordances(ctx, view, item, editor) {
	if (!ctx || !view || editor?.nav?.panel !== 'Trace') return;
	const trace = getTrace(item);
	if (!trace || !trace.visible || trace.locked) return;
	const rect = traceCanvasRect(trace, view);
	if (!rect) return;

	// Hover and drag belong to the Resize tool; with any other tool, the frame only.
	// A metric line under the pointer (or being dragged) owns the pointer: the guides layer
	// sees mousemoves first, so the trace layer's hover can be stale while a press would
	// grab the line. Only a trace drag in progress still shows as grabbed.
	const grabbable = isTraceLayerTool(editor);
	const dragging = (grabbable && traceLayerState.dragging) || false;
	const lineOwnsPointer = !!(guidesLayerState.hover || guidesLayerState.dragging);
	const hover = lineOwnsPointer ? false : traceLayerState.hover;
	const active = (grabbable && (dragging || hover)) || false;
	const touch = token('--canvas-selection');

	ctx.save();

	// Frame: purple structure; green while the body is the thing being touched
	const bodyActive = active === 'move';
	ctx.lineWidth = bodyActive ? 2 : 1;
	ctx.strokeStyle = bodyActive ? touch : token('--canvas-trace-frame');
	ctx.strokeRect(crisp(rect.x), crisp(rect.y), Math.round(rect.width), Math.round(rect.height));

	if (!grabbable) {
		ctx.restore();
		return;
	}

	// Corner handles: green outline, filled green when hovered or dragged
	const half = TRACE_HANDLE_PX / 2;
	ctx.lineWidth = 1;
	for (const corner of TRACE_CORNERS) {
		const p = cornerOf(rect, corner);
		const hot = active === corner;
		ctx.fillStyle = hot ? touch : token('--canvas-handle-fill');
		ctx.fillRect(Math.round(p.x - half), Math.round(p.y - half), TRACE_HANDLE_PX, TRACE_HANDLE_PX);
		ctx.strokeStyle = touch;
		ctx.strokeRect(crisp(p.x - half), crisp(p.y - half), TRACE_HANDLE_PX - 1, TRACE_HANDLE_PX - 1);
	}

	if (dragging) drawReadout(ctx, trace, rect, dragging);

	ctx.restore();
}

/**
 * The words shown beside a drag, in font units.
 * @param {Object} trace - normalized trace
 * @param {'nw' | 'ne' | 'sw' | 'se' | 'move'} part - what is being dragged
 * @returns {String} 'left 0, top 800' for a move; '812 wide, 1000 tall' for a resize
 */
export function traceReadoutText(trace, part) {
	if (part === 'move') return `left ${Math.round(trace.x)}, top ${Math.round(trace.y)}`;
	const wide = Math.round(trace.width * trace.scale);
	const tall = Math.round(trace.height * trace.scale);
	return `${wide} wide, ${tall} tall`;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function drawReadout(ctx, trace, rect, part) {
	const text = traceReadoutText(trace, part);
	ctx.font = LABEL_FONT;
	const textWidth = ctx.measureText ? ctx.measureText(text).width : text.length * 6;
	const canvasWidth = ctx.canvas?.width || Infinity;
	const canvasHeight = ctx.canvas?.height || Infinity;

	// Beside the dragged corner, outside the image; above the top-left corner for a move
	const anchor = part === 'move' ? cornerOf(rect, 'nw') : cornerOf(rect, part);
	const onRight = part === 'ne' || part === 'se';
	const below = part === 'sw' || part === 'se';
	let x = onRight
		? anchor.x + LABEL_GAP_PX
		: anchor.x - (part === 'move' ? 0 : textWidth + LABEL_GAP_PX);
	let y = below ? anchor.y + LABEL_GAP_PX + 10 : anchor.y - LABEL_GAP_PX;
	x = Math.min(Math.max(4, x), canvasWidth - textWidth - 4);
	y = Math.min(Math.max(12, y), canvasHeight - 4);

	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = token('--canvas-label-halo');
	ctx.strokeText(text, x, y);
	ctx.fillStyle = token('--canvas-guide-label');
	ctx.fillText(text, x, y);
}

function cornerOf(rect, corner) {
	const right = corner === 'ne' || corner === 'se';
	const bottom = corner === 'sw' || corner === 'se';
	return { x: right ? rect.x + rect.width : rect.x, y: bottom ? rect.y + rect.height : rect.y };
}

/** Half-pixel offset so 1 px strokes land on one pixel row. */
function crisp(value) {
	return Math.round(value) + 0.5;
}
