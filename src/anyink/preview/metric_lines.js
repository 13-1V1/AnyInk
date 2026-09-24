// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Where the font's vertical metrics land on a preview canvas.
	Given one line's view (dy = baseline in CSS px, dz = px per font unit) and the
	project's font settings, returns the y for ascender, cap height, x-height,
	baseline, and descender. Pure; the DisplayCanvas draws the lines.
*/

export const METRIC_LINE_NAMES = ['ascent', 'capHeight', 'xHeight', 'baseline', 'descent'];

/**
 * @param {{dy: Number, dz: Number}} view - line view (baseline y, scale)
 * @param {Object} font - project.settings.font (ascent, capHeight, xHeight, descent)
 * @returns {Array<{name: String, y: Number}>} top to bottom
 */
export function metricLineYs(view, font) {
	const dy = Number(view?.dy) || 0;
	const dz = Number(view?.dz) || 0;
	const num = (v) => Number(v) || 0;
	return [
		{ name: 'ascent', y: dy - num(font?.ascent) * dz },
		{ name: 'capHeight', y: dy - num(font?.capHeight) * dz },
		{ name: 'xHeight', y: dy - num(font?.xHeight) * dz },
		{ name: 'baseline', y: dy },
		// descent is stored negative (-200); guard against a positive value too
		{ name: 'descent', y: dy + Math.abs(num(font?.descent)) * dz },
	];
}
