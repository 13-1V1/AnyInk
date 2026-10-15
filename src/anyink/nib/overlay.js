// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: a see-through canvas laid exactly over the edit canvas while a stroke is drawn, for
	the live picture (preview.js). The edit canvas redraws itself on its own schedule (a frame
	after anything changes), so the picture can't live there: it would vanish on any redraw mid
	stroke. This canvas takes no pointer events and is cleared once the real ink is on the edit
	canvas (the frame after its redraw), so the stroke never blinks out between the two.

	  makePreviewOverlay(canvas)   { begin(), fix(shapes, view), draw(shapes, view), clear(),
	                               clearAfterRedraw(), remove() }
	                               canvas: the edit canvas (in its shadow root); the overlay is
	                               put beside it on the first draw and lined up with it then
	    fix(shapes, view)          B8 + B9 fix: the picture of the stroke's frozen part
	                               (skeleton.js), painted once onto a layer kept off screen; each
	                               draw copies that layer and paints only the tail, so a frame
	                               costs the same however long the stroke is (begin() empties it)
	The ink color is the canvas token --canvas-ink (theme.js token, D-006), the color the letter's
	own ink is drawn in.
*/
import { token } from '../theme/theme.js';
import { drawPreview } from './preview.js';

const OVERLAY_CLASS = 'anyink-nib-preview';

/**
 * @param {HTMLCanvasElement} canvas - the edit canvas
 * @returns {{draw: Function, clear: Function, clearAfterRedraw: Function, remove: Function}}
 */
export function makePreviewOverlay(canvas) {
	let overlay = null;
	let ctx = null;
	/** The frozen part's picture, off screen, and whether anything is on it */
	let layer = null;
	let layerCtx = null;
	let fixed = false;

	const place = () => {
		const parent = canvas?.parentNode;
		if (!parent) return false;
		if (!overlay || overlay.parentNode !== parent) {
			overlay = canvas.ownerDocument.createElement('canvas');
			overlay.className = OVERLAY_CLASS;
			overlay.setAttribute('aria-hidden', 'true');
			Object.assign(overlay.style, {
				position: 'absolute',
				left: '0px',
				top: '0px',
				pointerEvents: 'none',
			});
			parent.insertBefore(overlay, canvas.nextSibling);
			ctx = overlay.getContext('2d');
		}
		overlay.width = canvas.width;
		overlay.height = canvas.height;
		const target = canvas.getBoundingClientRect();
		overlay.style.width = `${target.width}px`;
		overlay.style.height = `${target.height}px`;
		// line it up wherever its containing block is: move it by however far it is off
		overlay.style.left = '0px';
		overlay.style.top = '0px';
		const here = overlay.getBoundingClientRect();
		overlay.style.left = `${target.left - here.left}px`;
		overlay.style.top = `${target.top - here.top}px`;
		return true;
	};

	const clear = () => {
		if (ctx && overlay) ctx.clearRect(0, 0, overlay.width, overlay.height);
	};

	/** An empty off-screen layer the overlay's size */
	const freshLayer = () => {
		fixed = false;
		if (!overlay) return;
		if (!layer) {
			layer = canvas.ownerDocument.createElement('canvas');
			layerCtx = layer.getContext('2d');
		}
		layer.width = overlay.width;
		layer.height = overlay.height;
		layerCtx?.clearRect(0, 0, layer.width, layer.height);
	};

	return {
		/** Lines the overlay up with the canvas and empties it; call when a stroke starts */
		begin() {
			place();
			clear();
			freshLayer();
		},
		/**
		 * @param {Array<Array<[Number, Number]>>} shapes - font units, the frozen part's picture
		 * @param {{dx: Number, dy: Number, dz: Number}} view
		 */
		fix(shapes, view) {
			if (!overlay && !place()) return;
			if (!layer || layer.width !== overlay.width || layer.height !== overlay.height) {
				freshLayer();
			}
			if (!layerCtx || !shapes.length) return;
			drawPreview(layerCtx, shapes, view, token('--canvas-ink'));
			fixed = true;
		},
		/**
		 * @param {Array<Array<[Number, Number]>>} shapes - font units (the tail's picture)
		 * @param {{dx: Number, dy: Number, dz: Number}} view
		 */
		draw(shapes, view) {
			if (!overlay && !place()) return;
			clear();
			if (fixed && layer) ctx.drawImage(layer, 0, 0);
			drawPreview(ctx, shapes, view, token('--canvas-ink'));
		},
		clear,
		/** Clears it once the edit canvas has drawn the real ink (its redraw is the frame before) */
		clearAfterRedraw() {
			const later = globalThis.requestAnimationFrame;
			if (typeof later !== 'function') return clear();
			later(() => later(clear));
		},
		remove() {
			overlay?.remove();
			overlay = null;
			ctx = null;
			layer = null;
			layerCtx = null;
			fixed = false;
		},
	};
}
