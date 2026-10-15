// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: the live preview on the edit canvas (Milestone 8).
	Owner: TRACK B (svg_to_shapes, trace_region, apply, preview_draw).

	Hook: src/edit_canvas/edit_canvas.js redrawGlyphEdit calls drawAutoTracePreview right
	after drawTraceAffordances. The canvas redraws on 'autoTrace' through its '*'
	subscription (pub_sub.js allTopics includes 'autoTrace').

	Contract:
	- drawAutoTracePreview(ctx, view, item, editor) draws the session's result
	  (autotrace_session.js getSession()) over the glyph as a dashed outline plus a light fill,
	  with touch (green) tokens through theme.js token(): it is what the user is about to
	  make. Draws only while a session with a ready result exists for this item.
	  Canvas math: canvasX = view.dx + x * view.dz, canvasY = view.dy - y * view.dz.
	- previewShapesFor(item, editor?) -> the shapes the preview would draw for this item, or
	  null. Matches the session's item by object or by id, and only for the session's editor.

	Details:
	- "A ready result" is the session's last finished trace. While a newer trace runs
	  (status 'tracing') the last result stays up, so dragging a slider never flickers the
	  preview off and on; an error, or a session with no result yet, draws nothing.
	- The fill uses the nonzero rule, the same rule drawGlyph and the exported font use, so a
	  hole in the preview is a hole in the result.
	- Only while the Trace panel (where the Auto-trace card lives) is open: the session ends
	  when the panel changes, and this check keeps a panel switch that skips navigate()
	  from leaving a stale preview behind.
	- B8 + B9 integration: in Simple the photo flow's step C draws here too (the green dashed
	  traced outline over the photo, UX-BEGINNER.md 4.4 "Step C"): the photo screens register
	  photo/photo_flow_state.js photoPreviewShapes with setPhotoPreview (photo_app.js, at boot),
	  so this file never imports the photo flow (and through it the app). Simple has no Trace
	  panel, so that check is All tools' own.
	- setPhotoPreview(fn): fn(item, editor) -> the step C shapes for that letter, or null; null
	  takes it off.
*/
import { isSimpleMode } from '../mode/mode.js';
import { token, withAlpha } from '../theme/theme.js';
import { getSession } from './autotrace_session.js';

/** How strong the light fill is (touch green at this alpha). */
export const PREVIEW_FILL_ALPHA = 0.18;

/** Simple's step C shapes (photo_flow_state.js photoPreviewShapes), registered at boot. */
let photoPreview = null;

/**
 * @param {Function | null} fn - (item, editor) => Array | null
 * @returns {Function | null} the one it replaced
 */
export function setPhotoPreview(fn) {
	const previous = photoPreview;
	photoPreview = typeof fn === 'function' ? fn : null;
	return previous;
}

/** Outline width and dash pattern, in screen pixels. */
export const PREVIEW_LINE_WIDTH = 1.5;
export const PREVIEW_DASH = Object.freeze([6, 4]);

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object} item - the item on the canvas
 * @param {Object} editor - ProjectEditor
 */
export function drawAutoTracePreview(ctx, view, item, editor) {
	if (!ctx || !view || !item) return;
	const shapes = shapesToDraw(item, editor);
	if (!shapes) return;

	const dx = Number(view.dx);
	const dy = Number(view.dy);
	const dz = Number(view.dz);
	if (![dx, dy, dz].every(Number.isFinite) || !(dz > 0)) return;
	const cx = (x) => dx + x * dz;
	const cy = (y) => dy - y * dz;

	const touch = token('--canvas-selection');
	ctx.save();
	ctx.beginPath();
	let drew = false;
	for (const shape of shapes) drew = addPath(ctx, shape, cx, cy) || drew;
	if (drew) {
		ctx.fillStyle = withAlpha(touch, PREVIEW_FILL_ALPHA);
		ctx.fill('nonzero');
		ctx.setLineDash([...PREVIEW_DASH]);
		ctx.lineWidth = PREVIEW_LINE_WIDTH;
		ctx.strokeStyle = touch;
		ctx.stroke();
	}
	ctx.restore();
}

/**
 * Simple: the photo flow's step C; All tools: the Auto-trace card's session, while the Trace
 * panel is open.
 * @param {Object} item
 * @param {Object} [editor]
 * @returns {Array | null}
 */
function shapesToDraw(item, editor) {
	if (isSimpleMode()) {
		try {
			return photoPreview?.(item, editor) || null;
		} catch {
			return null;
		}
	}
	if (editor?.nav && editor.nav.panel !== 'Trace') return null;
	return previewShapesFor(item, editor);
}

/**
 * @param {Object} item
 * @param {Object} [editor] - the canvas's editor; another editor's session never draws here
 *   (two open projects can hold the same glyph id)
 * @returns {Array | null} the session's result shapes for this item, or null
 */
export function previewShapesFor(item, editor) {
	let session;
	try {
		session = getSession();
	} catch {
		return null;
	}
	if (!session || !item) return null;
	if (editor && session.editor && session.editor !== editor) return null;
	// The same object, or the same id (undo swaps the glyph object for a copy)
	const sameItem = session.item === item || (!!session.itemId && item.id === session.itemId);
	if (!sameItem) return null;
	if (session.status !== 'ready' && session.status !== 'tracing') return null;
	const shapes = session.result?.shapes;
	return Array.isArray(shapes) && shapes.length ? shapes : null;
}

/**
 * Adds one closed Path to the current canvas path (the same segments drawPathToCanvas makes).
 * @returns {Boolean} true when something was added
 */
function addPath(ctx, shape, cx, cy) {
	const points = shape?.pathPoints;
	if (!Array.isArray(points) || points.length < 2) return false;
	ctx.moveTo(cx(points[0].p.x), cy(points[0].p.y));
	for (let i = 0; i < points.length; i++) {
		const pp = points[i];
		const np = points[(i + 1) % points.length];
		if (!pp.h2.use && !np.h1.use) {
			ctx.lineTo(cx(np.p.x), cy(np.p.y));
		} else {
			ctx.bezierCurveTo(cx(pp.h2.x), cy(pp.h2.y), cx(np.h1.x), cy(np.h1.y), cx(np.p.x), cy(np.p.y));
		}
	}
	ctx.closePath();
	return true;
}
