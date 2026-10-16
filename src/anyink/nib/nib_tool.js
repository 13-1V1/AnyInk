// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8: the Brush on the edit canvas (UX-BEGINNER.md 4.3 Tools "Brush B", 10 B8; D-014, RESEARCH
	2.3). The one tool that listens to pointer events: every other tool keeps upstream's mouse
	events. A press with the Brush picked:
	  - pointerdown (primary pointer, main button or pen tip): preventDefault, so Chrome sends no
	    mousedown / mousemove / mouseup for this press and upstream's handlers stay quiet;
	    setPointerCapture, so the stroke keeps coming off the canvas; the keyboard and Simple's
	    toasts are treated as any canvas press treats them (events_mouse.js)
	  - pointermove: every coalesced sample (getCoalescedEvents: the ones Chrome saw between two
	    frames), each through the 1 euro filter in screen pixels, then into font units through the
	    view as it was at the press, then into the stroke's skeleton (skeleton.js builds it as the
	    samples come); the live picture is drawn once a frame (preview.js on the overlay,
	    perfect-freehand): the skeleton's frozen part is pictured once onto the overlay's kept
	    layer and only its tail is pictured again each frame (B8 + B9 fix: a frame used to refit
	    and redraw the whole stroke, up to 125 ms late in a long one)
	  - pointerup: the filter settles on where the pen stopped, the skeleton is finished and inked
	    as it is (so the ink is the picture) and put into the letter as one Undo step (commit.js),
	    the edit canvas redraws, the picture goes
	  - pointercancel, or the capture lost with no pointerup: the stroke is dropped, nothing changes
	Nothing happens for the middle button (it pans), the right button, a pen's eraser, a second
	finger, or while Space pans (the tool is 'pan' then). A press whose letter or font changed
	before it ended goes nowhere. While the Brush is picked the canvas takes touch-action: none, so
	a finger or pen draws instead of scrolling the page.

	  makeNibTool(canvas, { getEditor })   { down, move, up, cancel, active }: the handlers, which
	                                   take pointer events (or anything shaped like one, for tests).
	                                   It also follows the editor: the tool's touch-action, and the
	                                   letter's strokes sorted out whenever it changes: tags put
	                                   back after a load, pasted copies made strokes of their own
	                                   (stroke_record.js reconcileStrokes)
	  attachNib(canvas)                makeNibTool on the app's editor, with its listeners on the
	                                   canvas (events.js initEventHandlers)
	  Tool_Nib                         upstream's mouse-tool shape for the Brush (events_mouse.js):
	                                   a press never reaches it; pointing shows a crosshair
	  lastStrokeForChecks()            { samples, size, pixel, view, strokeId, skeleton, preview,
	                                   frozenCurves, frames, worstFrameMs } of the last stroke
	                                   committed, for
	                                   tests/nib.html and the real-browser checks: preview is the
	                                   picture as the overlay held it at release (kept layer plus
	                                   tail), worstFrameMs the slowest frame's picture work
*/
import { closeEveryTypeOfDialog } from '../../controls/dialogs/dialogs.js';
import { getCurrentProjectEditor } from '../../app/main.js';
import { setCursor } from '../../edit_canvas/cursors.js';
import { releaseFocus } from '../controls/focus_release.js';
import { brushSize } from './brush_size.js';
import { commitStroke } from './commit.js';
import { makeStrokeFilter } from './filter.js';
import { nibWidth } from './ink.js';
import { makePreviewOverlay } from './overlay.js';
import { previewFromSkeleton } from './preview.js';
import { makeSkeletonBuilder } from './skeleton.js';
import { reconcileStrokes, strokeRecordFinder } from './stroke_record.js';

export const NIB_TOOL = 'nib';
/** Subscriber ids (never a substring of another, D-024) */
const TOUCH_SUBSCRIBER = 'anyink.nib.touchAction';
const RETAG_SUBSCRIBER = 'anyink.nib.reconcileStrokes';
const RETAG_TOPICS = [
	'currentItem',
	'whichGlyphIsSelected',
	'whichLigatureIsSelected',
	'whichComponentIsSelected',
];
/** Items the brush draws on */
const DRAWABLE = Object.freeze(['Glyph', 'Ligature', 'Component']);

let lastStroke = null;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{getEditor?: () => Object}} [options]
 * @returns {{down: Function, move: Function, up: Function, cancel: Function, active: Function}}
 */
export function makeNibTool(canvas, { getEditor = getCurrentProjectEditor } = {}) {
	const overlay = makePreviewOverlay(canvas);
	let stroke = null;
	let frame = 0;

	followEditor(canvas, getEditor());

	const addSample = (event) => {
		const rect = stroke.rect;
		const px = event.clientX - rect.left - (canvas.clientLeft || 0);
		const py = event.clientY - rect.top - (canvas.clientTop || 0);
		if (!Number.isFinite(px) || !Number.isFinite(py)) return;
		const t = Number.isFinite(event.timeStamp) ? event.timeStamp / 1000 : undefined;
		stroke.raw = { px, py, t };
		// B16: a sharp corner in the raw samples goes in as it is (filter.js take)
		stroke.filter.take(px, py, t).forEach(add);
	};
	const add = ({ x, y }) => {
		const { dx, dy, dz } = stroke.view;
		const point = [(x - dx) / dz, (dy - y) / dz];
		stroke.samples.push(point);
		stroke.builder.add(point);
	};

	/** The skeleton's newly frozen curves onto the overlay's kept layer, once */
	const fixFrozen = () => {
		const { builder } = stroke;
		if (builder.frozenCount() <= stroke.fixedCurves) return;
		const shapes = previewFromSkeleton(builder.frozenSince(stroke.fixedCurves), stroke.size);
		stroke.fixedCurves = builder.frozenCount();
		stroke.fixedShapes.push(...shapes);
		overlay.fix(shapes, stroke.view);
	};

	const drawFrame = () => {
		frame = 0;
		if (!stroke) return;
		const started = now();
		fixFrozen();
		overlay.draw(previewFromSkeleton(stroke.builder.tail(), stroke.size), stroke.view);
		stroke.frames += 1;
		stroke.worstFrameMs = Math.max(stroke.worstFrameMs, now() - started);
	};
	const schedule = () => {
		if (frame) return;
		const later = globalThis.requestAnimationFrame;
		if (typeof later === 'function') frame = later(drawFrame) || 1;
		else drawFrame();
	};

	const release = (pointerId) => {
		try {
			if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
		} catch {
			// the capture is already gone
		}
	};

	return {
		/**
		 * @param {PointerEvent} event
		 * @returns {Boolean} true when a stroke started
		 */
		down(event) {
			const editor = getEditor();
			if (stroke || !canDraw(event, editor)) return false;
			event.preventDefault?.();
			try {
				canvas.setPointerCapture?.(event.pointerId);
			} catch {
				// no capture (the pointer is already gone): the stroke still works on the canvas
			}
			// as any press on the canvas does (events_mouse.js handleMouseEvents)
			closeEveryTypeOfDialog({ fromCanvas: true });
			releaseFocus();
			const view = { ...editor.view };
			const size = nibWidth(brushSize(editor.project));
			const pixel = view.dz > 0 ? 1 / view.dz : 0;
			stroke = {
				pointerId: event.pointerId,
				editor,
				itemId: editor.selectedItemID,
				filter: makeStrokeFilter(),
				builder: makeSkeletonBuilder({ size, pixel }),
				samples: [],
				raw: null,
				view,
				size,
				pixel,
				rect: canvas.getBoundingClientRect(),
				fixedCurves: 0,
				fixedShapes: [],
				frames: 0,
				worstFrameMs: 0,
			};
			addSample(event);
			overlay.begin();
			schedule();
			return true;
		},

		/** @param {PointerEvent} event */
		move(event) {
			if (!stroke || event.pointerId !== stroke.pointerId) return false;
			const coalesced = event.getCoalescedEvents?.();
			(coalesced?.length ? coalesced : [event]).forEach(addSample);
			schedule();
			return true;
		},

		/**
		 * @param {PointerEvent} event
		 * @returns {Object | null} the commit's result, or null
		 */
		up(event) {
			if (!stroke || event.pointerId !== stroke.pointerId) return null;
			addSample(event);
			if (stroke.raw) {
				const { px, py, t } = stroke.raw;
				stroke.filter.settle(px, py, t).forEach(add);
			}
			const done = stroke;
			stroke = null;
			release(done.pointerId);
			const editor = getEditor();
			const sameLetter =
				editor === done.editor &&
				editor.selectedItemID === done.itemId &&
				editor.selectedTool === NIB_TOOL;
			const skeleton = sameLetter ? done.builder.finish() : null;
			const result = sameLetter
				? commitStroke(editor, done.samples, { size: done.size, pixel: done.pixel, skeleton })
				: null;
			if (result) {
				lastStroke = {
					samples: done.samples,
					size: done.size,
					pixel: done.pixel,
					view: done.view,
					strokeId: result.strokeId,
					skeleton,
					// worked out only when a check asks
					get preview() {
						const rest = previewFromSkeleton(skeleton.slice(done.fixedCurves), done.size);
						return [...done.fixedShapes, ...rest];
					},
					frozenCurves: done.fixedCurves,
					frames: done.frames,
					worstFrameMs: done.worstFrameMs,
				};
				editor.editCanvas?.redraw?.('nib:stroke');
				overlay.clearAfterRedraw();
			} else {
				overlay.clear();
			}
			return result;
		},

		/** @param {PointerEvent} event */
		cancel(event) {
			if (!stroke || (event && event.pointerId !== stroke.pointerId)) return false;
			release(stroke.pointerId);
			stroke = null;
			overlay.clear();
			return true;
		},

		active: () => stroke !== null,
	};
}

/**
 * The app's Brush on one edit canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {Object} the tool
 */
export function attachNib(canvas) {
	const tool = makeNibTool(canvas);
	canvas.addEventListener('pointerdown', (event) => tool.down(event));
	canvas.addEventListener('pointermove', (event) => tool.move(event));
	canvas.addEventListener('pointerup', (event) => tool.up(event));
	canvas.addEventListener('pointercancel', (event) => tool.cancel(event));
	// a capture lost without a pointerup (the canvas went away mid stroke): drop the stroke
	canvas.addEventListener('lostpointercapture', (event) => tool.cancel(event));
	return tool;
}

/**
 * Upstream's mouse-tool shape for the Brush. The Brush's own press stops Chrome's mouse events,
 * so only pointing (a mousemove with no button) reaches it.
 */
export class Tool_Nib {
	mousedown() {}
	mousemove() {
		setCursor('crosshair');
	}
	mouseup() {}
}

/** @returns {Number} milliseconds */
const now = () => globalThis.performance?.now?.() ?? Date.now();

/** @returns {Object | null} */
export function lastStrokeForChecks() {
	return lastStroke;
}

/**
 * @param {PointerEvent} event
 * @param {Object} editor
 * @returns {Boolean}
 */
function canDraw(event, editor) {
	if (!editor || editor.selectedTool !== NIB_TOOL) return false;
	if (event?.isPrimary === false || event?.button !== 0) return false;
	if (!(editor.view?.dz > 0)) return false;
	return DRAWABLE.includes(editor.selectedItem?.objType);
}

/** touch-action follows the picked tool; stroke tags follow the letter */
function followEditor(canvas, editor) {
	if (!editor?.subscribe) return;
	const touch = (tool) => {
		if (canvas?.style) canvas.style.touchAction = tool === NIB_TOOL ? 'none' : '';
	};
	touch(editor.selectedTool);
	editor.subscribe({
		topic: 'whichToolIsSelected',
		subscriberID: TOUCH_SUBSCRIBER,
		callback: touch,
	});
	editor.subscribe({
		topic: RETAG_TOPICS,
		subscriberID: RETAG_SUBSCRIBER,
		callback: () =>
			reconcileStrokes(editor.selectedItem, {
				findRecord: strokeRecordFinder(editor.project),
			}),
	});
}
