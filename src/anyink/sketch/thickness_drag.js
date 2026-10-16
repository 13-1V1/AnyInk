// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 3, "While dragging"): the Thickness slider's drag. Each move draws
	the letter's real swept ink at the new thickness (thickness.js previewOutlines, no refit, so
	nothing jumps on release), at most once an animation frame, on a see-through layer over the
	edit canvas, and says so on the narrow topic 'sketchThickness' ({ itemId, thickness,
	dragging: true }). Nothing in the font changes until the release, which records ONE item step
	(thickness.js commitThickness), says { dragging: false } and notes the Use on all offer
	(thickness_all.js). Esc, or the slider let go where it
	started, records nothing.

	The layer first covers the letter's Centerline ink as it is now (swept once, at the press)
	with the paper, then paints the new ink, so a thinner stroke looks thinner while it is dragged.

	  startThicknessDrag(editor, { overlay, frame, cancelFrame })   { move(value), end(value),
	                         cancel(), value() }; overlay: { draw(cover, ink, view), clear(),
	                         clearAfterRedraw() } (default: a layer over editor.editCanvas);
	                         frame / cancelFrame: requestAnimationFrame's pair (tests pass their own)
	  makeThicknessLayer(canvas)   the see-through layer, lined up as nib/overlay.js does
	  THICKNESS_TOPIC      'sketchThickness'
*/
import { token } from '../theme/theme.js';
import { drawPreview } from '../nib/preview.js';
import { isSketchActive, sketchOf } from './model.js';
import { noteThicknessOffer } from './thickness_all.js';
import { clampThickness, commitThickness, letterThickness, previewOutlines } from './thickness.js';

export const THICKNESS_TOPIC = 'sketchThickness';

const LAYER_CLASS = 'anyink-sketch-thickness-layer';

/**
 * A see-through canvas laid over the edit canvas, lined up with it at each draw (as
 * nib/overlay.js does), taking no pointer events.
 * @param {HTMLCanvasElement} canvas - the edit canvas
 * @returns {{draw: Function, clear: Function, clearAfterRedraw: Function, remove: Function}}
 */
export function makeThicknessLayer(canvas) {
	let layer = null;
	let ctx = null;
	const place = () => {
		const parent = canvas?.parentNode;
		if (!parent) return false;
		if (!layer || layer.parentNode !== parent) {
			layer = canvas.ownerDocument.createElement('canvas');
			layer.className = LAYER_CLASS;
			layer.setAttribute('aria-hidden', 'true');
			Object.assign(layer.style, {
				position: 'absolute',
				pointerEvents: 'none',
				background: 'transparent',
			});
			parent.insertBefore(layer, canvas.nextSibling);
			ctx = layer.getContext('2d');
		}
		layer.width = canvas.width;
		layer.height = canvas.height;
		const target = canvas.getBoundingClientRect();
		layer.style.width = `${target.width}px`;
		layer.style.height = `${target.height}px`;
		layer.style.left = '0px';
		layer.style.top = '0px';
		const here = layer.getBoundingClientRect();
		layer.style.left = `${target.left - here.left}px`;
		layer.style.top = `${target.top - here.top}px`;
		return true;
	};
	const clear = () => {
		if (ctx && layer) ctx.clearRect(0, 0, layer.width, layer.height);
	};
	return {
		/**
		 * @param {Array} cover - the ink as it is now (painted with the paper)
		 * @param {Array} ink - the ink at the dragged thickness
		 * @param {{dx: Number, dy: Number, dz: Number}} view
		 */
		draw(cover, ink, view) {
			if (!place() || !ctx) return;
			clear();
			drawPreview(ctx, cover, view, token('--canvas-bg'));
			drawPreview(ctx, ink, view, token('--canvas-ink'));
		},
		clear,
		/** Clears once the edit canvas has drawn the real ink (its redraw is the frame before) */
		clearAfterRedraw() {
			const later = globalThis.requestAnimationFrame;
			if (typeof later !== 'function') return clear();
			later(() => later(clear));
		},
		remove() {
			layer?.remove();
			layer = null;
			ctx = null;
		},
	};
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {{overlay?: Object, frame?: Function, cancelFrame?: Function}} [options]
 * @returns {{move: Function, end: Function, cancel: Function, value: Function} | null} null when
 *   the open letter has no active sketch
 */
export function startThicknessDrag(editor, options = {}) {
	const item = editor?.selectedItem;
	const sketch = sketchOf(item);
	const project = editor?.project;
	if (!project || !isSketchActive(sketch)) return null;
	const frame = options.frame || globalThis.requestAnimationFrame?.bind(globalThis);
	const cancelFrame = options.cancelFrame || globalThis.cancelAnimationFrame?.bind(globalThis);
	const overlay = options.overlay || defaultLayer(editor);
	const itemId = editor.selectedItemID;
	const from = letterThickness(item, project);
	const cover = previewOutlines(sketch, project, from);
	let wanted = from;
	let pending = 0;
	let done = false;

	const tell = (thickness, dragging) =>
		editor.publish?.(THICKNESS_TOPIC, { itemId, thickness, dragging });

	const paint = () => {
		pending = 0;
		if (done) return;
		overlay?.draw(cover, previewOutlines(sketch, project, wanted), { ...editor.view });
		tell(wanted, true);
	};

	const stopFrame = () => {
		if (pending && typeof cancelFrame === 'function') cancelFrame(pending);
		pending = 0;
	};

	return {
		move(value) {
			if (done) return;
			wanted = clampThickness(project, value);
			if (pending) return;
			if (typeof frame === 'function') pending = frame(paint) || 1;
			else paint();
		},
		end(value = wanted) {
			if (done) return false;
			done = true;
			stopFrame();
			wanted = clampThickness(project, value);
			const recorded = wanted !== from && commitThickness(editor, wanted);
			// rule 25: the other sketched letters at another thickness are offered this one
			if (recorded) noteThicknessOffer(editor);
			tell(wanted, false);
			if (recorded) overlay?.clearAfterRedraw();
			else overlay?.clear();
			return recorded;
		},
		cancel() {
			if (done) return;
			done = true;
			stopFrame();
			overlay?.clear();
			tell(from, false);
		},
		value: () => wanted,
	};
}

/** One layer per edit canvas */
const layers = new WeakMap();
function defaultLayer(editor) {
	const canvas = editor?.editCanvas?.canvas;
	if (!canvas) return null;
	if (!layers.has(canvas)) layers.set(canvas, makeThicknessLayer(canvas));
	return layers.get(canvas);
}
