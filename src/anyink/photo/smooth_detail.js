// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-core: the one "Smooth --o-- Detailed" slider of the photo card's Adjust section
	(docs/UX-BEGINNER.md 4.4 step C). Pure: no DOM, no editor.

	One slider moves auto-trace's two settings, Smoothing and Detail (autotrace/params.js: 0..1
	each, mapped there onto potrace's alphamax, opttolerance and turdsize), together along one
	curve. More tools keeps the two separate sliders; this module only says where on the curve
	two settings sit.

	The slider runs from 0 (Smooth) to 1 (Detailed), starting at 0.5, which is auto-trace's own
	defaults (smoothing 0.75, detail 0.6), so a photo traced in Simple and one traced in More
	tools with untouched sliders come out the same. Moving toward Detailed lowers smoothing
	(potrace keeps more corners) and raises detail (a tighter curve fit and smaller kept
	specks); toward Smooth the reverse. Neither end reaches potrace's extremes:
	- Smooth stops at smoothing 0.95 (alphamax 1.27): at 1.0 (4/3) potrace makes no corner at
	  all, and the corner of an E or a Z melts.
	- Detailed stops at smoothing 0.45 (alphamax 0.6), below which a felt-tip curve turns into
	  a polygon, and at detail 0.88: at 1.0 the kept speck shrinks to one pixel, and paper grain
	  in a phone photo comes back as hundreds of dots.
	The table bends a little: toward Detailed it is mostly smoothing that moves (corners come
	back first), toward Smooth mostly detail (small bumps and specks go first).

	  SMOOTH_DETAIL_TABLE         [{ at, smoothing, detail }], at from 0 to 1, frozen
	  SMOOTH_DETAIL_DEFAULT       0.5
	  optionsForSlider(value)     { smoothing, detail } for a slider value (straight lines
	                              between the table's rows; out of range clamps; not a number:
	                              the default)
	  sliderForOptions(options)   the slider value for { smoothing, detail }: the nearest point
	                              of the curve (each setting counts alike), so settings moved
	                              apart in More tools show where they are closest; a missing
	                              setting takes auto-trace's default
*/
import { AUTOTRACE_DEFAULTS } from '../autotrace/params.js';

/** The curve the slider moves along, Smooth (0) to Detailed (1). */
export const SMOOTH_DETAIL_TABLE = Object.freeze(
	[
		{ at: 0, smoothing: 0.95, detail: 0.25 },
		{ at: 0.25, smoothing: 0.86, detail: 0.44 },
		{ at: 0.5, smoothing: AUTOTRACE_DEFAULTS.smoothing, detail: AUTOTRACE_DEFAULTS.detail },
		{ at: 0.75, smoothing: 0.6, detail: 0.75 },
		{ at: 1, smoothing: 0.45, detail: 0.88 },
	].map((row) => Object.freeze(row))
);

/** Where the slider starts: auto-trace's own defaults. */
export const SMOOTH_DETAIL_DEFAULT = 0.5;

/**
 * @param {Number} value - 0 (Smooth) .. 1 (Detailed)
 * @returns {{smoothing: Number, detail: Number}}
 */
export function optionsForSlider(value) {
	const v = typeof value === 'number' && Number.isFinite(value) ? value : SMOOTH_DETAIL_DEFAULT;
	const at = Math.min(1, Math.max(0, v));
	const table = SMOOTH_DETAIL_TABLE;
	let i = 1;
	while (i < table.length - 1 && table[i].at < at) i++;
	const a = table[i - 1];
	const b = table[i];
	const t = (at - a.at) / (b.at - a.at);
	if (t <= 0) return { smoothing: a.smoothing, detail: a.detail };
	if (t >= 1) return { smoothing: b.smoothing, detail: b.detail };
	return {
		smoothing: a.smoothing + (b.smoothing - a.smoothing) * t,
		detail: a.detail + (b.detail - a.detail) * t,
	};
}

/**
 * @param {{smoothing?: Number, detail?: Number}} options
 * @returns {Number} 0..1, the slider value at the curve's nearest point
 */
export function sliderForOptions(options) {
	const source = options && typeof options === 'object' ? options : {};
	const read = (key) =>
		typeof source[key] === 'number' && Number.isFinite(source[key])
			? Math.min(1, Math.max(0, source[key]))
			: AUTOTRACE_DEFAULTS[key];
	const s = read('smoothing');
	const d = read('detail');
	const table = SMOOTH_DETAIL_TABLE;
	let best = { distance: Infinity, at: SMOOTH_DETAIL_DEFAULT };
	for (let i = 1; i < table.length; i++) {
		const a = table[i - 1];
		const b = table[i];
		const ds = b.smoothing - a.smoothing;
		const dd = b.detail - a.detail;
		const length = ds * ds + dd * dd;
		let t = length ? ((s - a.smoothing) * ds + (d - a.detail) * dd) / length : 0;
		t = Math.min(1, Math.max(0, t));
		const ps = a.smoothing + ds * t - s;
		const pd = a.detail + dd * t - d;
		const distance = ps * ps + pd * pd;
		if (distance < best.distance - 1e-12) best = { distance, at: a.at + (b.at - a.at) * t };
	}
	return best.at;
}
