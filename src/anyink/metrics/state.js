// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK guides layer state (Milestone 5, D-008).
	One small object shared by the event handling (guides_layer.js) and the drawing
	(overlay.js), so neither has to import the other.
*/

export const guidesLayerState = {
	/** @type {String | false} which line is under the pointer, e.g. 'xHeight', 'lsb', 'guide:0' */
	hover: false,
	/** @type {String | false} which line is being dragged */
	dragging: false,
	/** @type {Object | false} descriptor of the hovered or dragged line (see hit_test.js) */
	line: false,
	/** last pointer position on the canvas, in canvas pixels */
	pointer: { x: -100, y: -100 },
	/** baseline drag only: Em distance the line has been pulled from y = 0 */
	baselineDelta: 0,
	/** side bearing drag only: canvas x the next delta is measured from */
	anchorX: 0,
	/** true once the current drag has changed a value */
	changed: false,
};

/** Forget hover and drag (page change, pointer left the canvas). */
export function resetGuidesLayerState() {
	guidesLayerState.hover = false;
	guidesLayerState.dragging = false;
	guidesLayerState.line = false;
	guidesLayerState.baselineDelta = 0;
	guidesLayerState.anchorX = 0;
	guidesLayerState.changed = false;
}
