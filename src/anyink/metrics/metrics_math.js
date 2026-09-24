// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK metrics math (Milestone 5, D-008 / D-009).
	Pure helpers shared by the guides layer, the settings readouts, and the tests:
	which font metrics exist, their labels, clamping so the metric lines keep their
	order, the Shift-to-10 snap, and the baseline-shift arithmetic. No imports, no DOM.
*/

/** Every settings.font key the Font settings page treats as an Em value. */
export const FONT_METRIC_KEYS = [
	'upm',
	'ascent',
	'descent',
	'capHeight',
	'xHeight',
	'overshoot',
	'lineGap',
];

/** The horizontal metric lines a user can drag on the canvas (baseline is y = 0). */
export const DRAGGABLE_METRIC_KEYS = ['ascent', 'capHeight', 'xHeight', 'descent'];

/**
 * Metric lines that move with the drawing when the baseline is dragged (D-009).
 * The drawing shifts by -delta and these shift by -delta too, so every line stays
 * where it was on the outlines; only y = 0 moves.
 */
export const BASELINE_SHIFTED_KEYS = ['ascent', 'capHeight', 'xHeight', 'descent'];

/** Title-case labels for history entries and panels. */
export const METRIC_LABELS = {
	upm: 'UPM',
	ascent: 'Ascent',
	capHeight: 'Cap height',
	xHeight: 'X height',
	baseline: 'Baseline',
	descent: 'Descent',
	overshoot: 'Overshoot',
	lineGap: 'Line gap',
	lsb: 'Left side bearing',
	rsb: 'Right side bearing',
};

/** Lowercase labels for the live canvas readout next to the pointer. */
export const LIVE_LABELS = {
	ascent: 'ascent',
	capHeight: 'cap height',
	xHeight: 'x-height',
	baseline: 'baseline',
	descent: 'descent',
	lsb: 'left side bearing',
	rsb: 'right side bearing',
};

/**
 * @param {String} key
 * @returns {Boolean} true when key is one of settings.font's Em metrics
 */
export function isFontMetricKey(key) {
	return FONT_METRIC_KEYS.includes(key);
}

/**
 * Rounds to the nearest unit, or to the nearest 10 when Shift is held.
 * @param {Number} value - raw Em value
 * @param {Boolean} shouldSnap - Shift key state
 * @returns {Number}
 */
export function snapToTen(value, shouldSnap = true) {
	const v = Number(value) || 0;
	if (shouldSnap) return Math.round(v / 10) * 10;
	return Math.round(v);
}

/**
 * Safe integer read of a font metric.
 * @param {Object} font - settings.font
 * @param {String} key
 * @returns {Number}
 */
export function metricValue(font, key) {
	const v = Math.round(Number(font?.[key]));
	return Number.isFinite(v) ? v : 0;
}

/**
 * Clamps a new value for one metric so the lines keep their order:
 * descent < 0 < xHeight <= capHeight <= ascent (at least one unit from zero).
 * upm stays positive, overshoot stays non-negative, lineGap is only rounded.
 * A non-numeric value returns the current value unchanged.
 * @param {Object} font - settings.font (read only)
 * @param {String} key - which metric
 * @param {Number} value - requested value
 * @returns {Number} the value to store
 */
export function clampFontMetric(font, key, value) {
	const v = Math.round(Number(value));
	if (!Number.isFinite(v)) return metricValue(font, key);
	const ascent = metricValue(font, 'ascent');
	const capHeight = metricValue(font, 'capHeight');
	const xHeight = metricValue(font, 'xHeight');

	switch (key) {
		case 'ascent':
			return Math.max(v, capHeight);
		case 'capHeight':
			return Math.min(Math.max(v, xHeight), ascent);
		case 'xHeight':
			return Math.min(Math.max(v, 1), capHeight);
		case 'descent':
			return Math.min(v, -1);
		case 'upm':
			return Math.max(v, 1);
		case 'overshoot':
			return Math.max(v, 0);
		default:
			return v;
	}
}

/**
 * Clamps a baseline drag so the shifted metrics stay in order:
 * xHeight - delta >= 1 and descent - delta <= -1.
 * @param {Object} font - settings.font (read only)
 * @param {Number} delta - requested Em delta (positive = baseline dragged up)
 * @returns {Number}
 */
export function clampBaselineDelta(font, delta) {
	const d = Math.round(Number(delta));
	if (!Number.isFinite(d)) return 0;
	const maxUp = metricValue(font, 'xHeight') - 1;
	const maxDown = metricValue(font, 'descent') + 1;
	return Math.min(Math.max(d, maxDown), maxUp);
}

/**
 * The metric values after a baseline drag of delta (D-009): the outlines move by
 * -delta, and so do the metric lines, so they stay put on the drawing.
 * @param {Object} font - settings.font (read only)
 * @param {Number} delta - Em delta (already clamped)
 * @returns {Object} { ascent, capHeight, xHeight, descent }
 */
export function shiftedMetricsForBaseline(font, delta) {
	const d = Math.round(Number(delta)) || 0;
	const result = {};
	BASELINE_SHIFTED_KEYS.forEach((key) => {
		result[key] = metricValue(font, key) - d;
	});
	return result;
}
