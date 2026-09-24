// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK slider math (Milestone 5, audit C4 and D3).
	Pure number helpers shared by every slider row: clamping, step snapping, Shift
	snapping, keyboard nudges, readout formatting, and the relative-delta math that lets
	a transform slider keep transforming when it is dragged further.
	No DOM, no upstream imports, so every function here is unit tested directly.
*/

/**
 * Parse anything into a finite number, or fall back.
 * @param {*} value
 * @param {Number} fallback
 * @returns {Number}
 */
export function toNumber(value, fallback = 0) {
	const n = typeof value === 'number' ? value : parseFloat(value);
	return Number.isFinite(n) ? n : fallback;
}

/**
 * Keep a value inside [min, max].
 * @param {Number} value
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
export function clamp(value, min, max) {
	if (min > max) [min, max] = [max, min];
	return Math.min(max, Math.max(min, value));
}

/**
 * How many decimals a step needs: 1 -> 0, 0.5 -> 1, 0.01 -> 2.
 * @param {Number} step
 * @returns {Number}
 */
export function decimalsForStep(step) {
	const s = Math.abs(toNumber(step, 1));
	if (s === 0 || s >= 1) return 0;
	const text = s.toString();
	if (text.includes('e-')) return parseInt(text.split('e-')[1]);
	return (text.split('.')[1] || '').length;
}

/**
 * Round a value to a multiple of `step` counted from `origin`, then clamp.
 * @param {Number} value
 * @param {Number} step
 * @param {Number} min
 * @param {Number} max
 * @param {Number} [origin] - where the step grid starts (defaults to min)
 * @returns {Number}
 */
export function snapToStep(value, step, min, max, origin = min) {
	step = Math.abs(toNumber(step, 1)) || 1;
	const decimals = decimalsForStep(step);
	const snapped = Math.round((value - origin) / step) * step + origin;
	return clamp(Number(snapped.toFixed(decimals)), min, max);
}

/**
 * Shift-drag snap: round to the nearest multiple of `multiple` counted from zero
 * (so a -45..45 slider snaps to -40, -30, ... 0, 10, ...), then clamp.
 * @param {Number} value
 * @param {Number} multiple - e.g. 10 units, or 0.1 for a scale factor
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
export function snapToMultiple(value, multiple, min, max) {
	multiple = Math.abs(toNumber(multiple, 10)) || 10;
	return snapToStep(value, multiple, min, max, 0);
}

/**
 * Arrow-key nudge: one step, or ten steps with Shift, clamped and kept on the step grid.
 * @param {Number} value - current value
 * @param {Number} direction - -1 or +1
 * @param {Object} o - { step, min, max, big }
 * @returns {Number}
 */
export function nudge(value, direction, { step = 1, min, max, big = false }) {
	const amount = step * (big ? 10 : 1) * Math.sign(direction || 1);
	return snapToStep(value + amount, step, min, max);
}

/**
 * Text for a readout: fixed decimals derived from the step so the width is stable.
 * @param {Number} value
 * @param {Number} step
 * @returns {String}
 */
export function formatValue(value, step = 1) {
	const n = toNumber(value, 0);
	const text = n.toFixed(decimalsForStep(step));
	return text === '-0' ? '0' : text;
}

/**
 * Skew is additive in tan(angle), not in degrees: skewing by a then by b moves x by
 * y * (tan a + tan b). To land on `nextDeg` after `lastDeg` was already applied, skew by
 * atan(tan(next) - tan(last)). Result in degrees.
 * @param {Number} lastDeg - angle already applied
 * @param {Number} nextDeg - angle the slider now shows
 * @returns {Number} - degrees to apply now
 */
export function skewAngleDelta(lastDeg, nextDeg) {
	const rad = (d) => (d * Math.PI) / 180;
	const deg = (r) => (r * 180) / Math.PI;
	const delta = deg(Math.atan(Math.tan(rad(nextDeg)) - Math.tan(rad(lastDeg))));
	return Math.abs(delta) < 1e-9 ? 0 : delta;
}

/**
 * Plain additive delta for distances and rotation angles.
 * @param {Number} last
 * @param {Number} next
 * @returns {Number}
 */
export function additiveDelta(last, next) {
	const delta = next - last;
	return Math.abs(delta) < 1e-9 ? 0 : delta;
}

/**
 * Clamp a slider's max to the font's units per em when that can be read.
 * @param {Number} fallbackMax - e.g. 2048
 * @param {*} upm - project.settings.font.upm, possibly missing or a string
 * @returns {Number}
 */
export function maxFromUpm(fallbackMax, upm) {
	const n = toNumber(upm, 0);
	return n > 0 ? n : fallbackMax;
}
