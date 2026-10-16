// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 fix (first-timer H1): while Move the guide lines is on, the small-letter line keeps a clear
	distance below the capitals line, and the capitals line as far above it. Dragged together, the
	two lines sat on each other: small letters as tall as capitals, one label gone, and the line he
	held looked like the other one. The gap is a tenth of the letter box (upm), in whole units. A
	font whose two lines are closer already never jumps: the line only moves apart from there.
	Pure; move_lines.js hands it to the metrics writer (font_metrics.js setMetricLimit) while the
	lines are unlocked.

	  clearGap(font)                         whole units between the two lines
	  keepClear(font, key, value, current)   { value, stopped }: the value the line may take
	                                         (after the metrics writer's own order clamp), and
	                                         whether the gap stopped it short of `value`
*/
import { whole } from '../spacing/round.js';

/** The share of the letter box kept between the small-letter and capitals lines */
export const CLEAR_GAP_SHARE = 0.1;
const FALLBACK_UPM = 1000;

/**
 * @param {Object} font - settings.font
 * @returns {Number} whole units
 */
export function clearGap(font) {
	const upm = Number(font?.upm) > 0 ? Number(font.upm) : FALLBACK_UPM;
	return whole(upm * CLEAR_GAP_SHARE);
}

/**
 * @param {Object} font - settings.font (the other line is read from here)
 * @param {String} key - 'xHeight' | 'capHeight' (any other line passes through)
 * @param {Number} value - where the line would go
 * @param {Number} current - where it is now
 * @returns {{value: Number, stopped: Boolean}}
 */
export function keepClear(font, key, value, current) {
	const gap = clearGap(font);
	if (key === 'xHeight') {
		const highest = Math.max(whole(font.capHeight) - gap, Math.min(current, value));
		return value > highest ? { value: highest, stopped: true } : { value, stopped: false };
	}
	if (key === 'capHeight') {
		const lowest = Math.min(whole(font.xHeight) + gap, Math.max(current, value));
		return value < lowest ? { value: lowest, stopped: true } : { value, stopped: false };
	}
	return { value, stopped: false };
}
