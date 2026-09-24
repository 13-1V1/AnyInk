// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK guides layer (Milestone 5, D-008).
	An always-active layer that gets first look at pointer events on the edit canvas,
	so metric lines (ascender, cap height, x-height, baseline, descender), custom guides,
	and side bearings can be dragged with any tool active.

	Contract used by the hooks in src/edit_canvas/events_mouse.js and edit_canvas.js:
	- handleGuidesLayerEvent(event): called for left-button mousedown / mousemove / mouseup
	  BEFORE the active tool sees the event. Return true to swallow the event.
	- drawGuidesLayerOverlay(ctx, view, item): called after the guides are drawn, on both the
	  glyph and kern canvases; draws hover / drag highlights and live value labels.
	- guidesLayerState: { hover, dragging } read by the drawing code.

	This file is a scaffold; the milestone-5 metrics track fills it in.
*/

export const guidesLayerState = {
	/** @type {String|false} which line is under the pointer, e.g. 'xHeight', 'lsb', 'guide:0' */
	hover: false,
	/** @type {String|false} which line is being dragged */
	dragging: false,
};

/**
 * @param {MouseEvent} _event
 * @returns {Boolean} true when the layer consumed the event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleGuidesLayerEvent(_event) {
	return false;
}

/**
 * @param {CanvasRenderingContext2D} _ctx
 * @param {Object} _view - {dx, dy, dz}
 * @param {Object} _item - the item being edited (Glyph, Ligature, Component, or KernGroup)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function drawGuidesLayerOverlay(_ctx, _view, _item) {}
