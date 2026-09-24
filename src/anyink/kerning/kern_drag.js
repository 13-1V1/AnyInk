// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kern drag math (Milestone 5, audit B5).
	Pure functions behind Tool_Kern: where the drag zone is, whether the pointer is in it,
	and what value a pointer position maps to. No DOM, no editor; everything is passed in.

	Em space: x = 0 is the right edge of the left group, the right group starts at x = value.
	Canvas space: view {dx, dy, dz} as in edit_canvas.js (cx = dx + sx * dz, cy = dy - sy * dz).
*/

export const LINE_GRAB_PX = 6; // pixels either side of the x = value line
export const SNAP_STEP = 10; // Shift snaps the value to this many em units

/**
 * Snap a value to the nearest multiple of a step.
 * @param {Number} value
 * @param {Number} [step]
 * @returns {Number}
 */
export function snapTo(value, step = SNAP_STEP) {
	if (!step) return Math.round(value) || 0;
	return Math.round(value / step) * step || 0; // `|| 0` turns -0 into 0
}

/**
 * Value for a pointer position. Measures from the first pointer x and the starting value,
 * so rounding every tick never loses sub-unit motion.
 * @param {Number} startValue - kern value when the drag began
 * @param {Number} firstX - pointer x (canvas px) when the drag began
 * @param {Number} currentX - pointer x now
 * @param {Number} dz - view zoom (canvas px per em unit)
 * @param {Boolean} [snap] - Shift held: snap to multiples of SNAP_STEP
 * @returns {Number} integer em units
 */
export function dragValue(startValue, firstX, currentX, dz, snap = false) {
	const zoom = dz || 1;
	const raw = Number(startValue) + (currentX - firstX) / zoom;
	return snap ? snapTo(raw) : Math.round(raw) || 0;
}

/**
 * The drag zone in em units: the right group's ink area plus the x = value line.
 * @param {Object} kernGroup - KernGroup
 * @param {Object} metrics - { rightWidth, ascent, descent } (rightWidth from kernGroupSideMaxWidth)
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number, lineX: Number}}
 */
export function getDragZone(kernGroup, { rightWidth = 0, ascent = 0, descent = 0 } = {}) {
	const value = Number(kernGroup?.value) || 0;
	return {
		xMin: value,
		xMax: value + Math.max(0, rightWidth),
		yMin: Math.min(descent, ascent),
		yMax: Math.max(descent, ascent),
		lineX: value,
	};
}

/**
 * Is a canvas pixel position inside the drag zone?
 * @param {{x: Number, y: Number}} mouse - canvas px
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object} zone - from getDragZone
 * @param {Number} [linePx] - grab tolerance around the value line, in px
 * @returns {Boolean}
 */
export function isPointerInDragZone(mouse, view, zone, linePx = LINE_GRAB_PX) {
	if (!mouse || !view || !zone) return false;
	const dz = view.dz || 1;
	const emX = (mouse.x - view.dx) / dz;
	const emY = (view.dy - mouse.y) / dz;
	const inInk = emX >= zone.xMin && emX <= zone.xMax && emY >= zone.yMin && emY <= zone.yMax;
	if (inInk) return true;
	const lineCanvasX = view.dx + zone.lineX * dz;
	return Math.abs(mouse.x - lineCanvasX) <= linePx;
}

/**
 * A class group has more than one member on either side.
 * @param {Object} kernGroup
 * @returns {Boolean}
 */
export function isClassGroup(kernGroup) {
	return (kernGroup?.leftGroup?.length || 0) > 1 || (kernGroup?.rightGroup?.length || 0) > 1;
}
