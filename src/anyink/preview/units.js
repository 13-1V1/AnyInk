// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Type-size units for the preview strip and the Live preview panel.
	The user sees points; TextBlockOptions.fontSize stays in CSS pixels so project
	files keep working (px = pt * 96 / 72, D-011). Pure functions, no DOM.
	B4: the readout's unit is the house word (words.js unit.pt).
*/
import { word } from '../words/words.js';

export const MIN_PT = 8;
export const MAX_PT = 200;
export const DEFAULT_PT = 48;
export const SNAP_PT = 10;

/**
 * @param {Number} pt - points
 * @returns {Number} CSS pixels (not rounded; 48 pt = 64 px exactly)
 */
export function ptToPx(pt) {
	return (Number(pt) * 96) / 72;
}

/**
 * @param {Number} px - CSS pixels
 * @returns {Number} points (not rounded)
 */
export function pxToPt(px) {
	return (Number(px) * 72) / 96;
}

/**
 * Whole points inside the slider range. Anything unparseable becomes the default.
 * @param {*} pt
 * @returns {Number}
 */
export function clampPt(pt) {
	const n = Number(pt);
	if (!Number.isFinite(n)) return DEFAULT_PT;
	return Math.min(MAX_PT, Math.max(MIN_PT, Math.round(n)));
}

/**
 * Shift-drag snapping: round to the nearest step, then clamp.
 * @param {Number} pt
 * @param {Number} [step]
 * @returns {Number}
 */
export function snapPt(pt, step = SNAP_PT) {
	const n = Number(pt);
	if (!Number.isFinite(n)) return DEFAULT_PT;
	return clampPt(Math.round(n / step) * step);
}

/**
 * Arrow-key nudge: 1 pt, or one snap step with Shift.
 * @param {Number} pt
 * @param {Number} direction - +1 or -1
 * @param {Boolean} [big] - Shift held
 * @returns {Number}
 */
export function nudgePt(pt, direction, big = false) {
	const dir = direction < 0 ? -1 : 1;
	return clampPt(clampPt(pt) + dir * (big ? SNAP_PT : 1));
}

/**
 * Readout text next to the slider.
 * @param {Number} pt
 * @returns {String} e.g. '48 pt'
 */
export function formatPt(pt) {
	return word('unit.pt', { size: Math.round(Number(pt) || 0) });
}
