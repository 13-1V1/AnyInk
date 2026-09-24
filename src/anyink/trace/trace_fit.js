// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: placement helpers for the Trace panel and for replacing an image
	(Milestone 7). Owner: TRACK C (import + panel). Pure: no DOM, no editor.

	All numbers are font units, y-up; a trace's (x, y) is the image's TOP-LEFT corner and
	its drawn size is width * scale by height * scale (see trace_model.js).
	- fitTraceToBand: scale so the image height fills a band (top to bottom), top edge on
	  the band's top, left edge at 0. Used by 'Fit to em' and 'Fit to cap height'.
	- fitBands: the two bands for a font (em = ascent to descent, cap = cap height to
	  the baseline).
	- keepPlacementForNewImage: 'Replace image' keeps the top-left corner and the height
	  the old image had on the canvas, so a better scan of the same lettering lands in the
	  same spot. The new trace is shown even if the old one was hidden.
	- placementSummary: rounded numbers for the panel's secondary readout.
*/

/**
 * @param {Object} trace
 * @param {Number} top - font units (y-up)
 * @param {Number} bottom - font units, below top
 * @returns {Object | null} a new trace, or null when the band or the image has no height
 */
export function fitTraceToBand(trace, top, bottom) {
	if (!trace) return null;
	const band = Number(top) - Number(bottom);
	const height = Number(trace.height);
	if (!Number.isFinite(band) || band <= 0) return null;
	if (!Number.isFinite(height) || height <= 0) return null;
	return { ...trace, scale: band / height, x: 0, y: Number(top) };
}

/**
 * @param {Object} font - project.settings.font (ascent, descent, capHeight)
 * @returns {{em: {top: Number, bottom: Number}, cap: {top: Number, bottom: Number}}}
 */
export function fitBands(font = {}) {
	const ascent = Number(font.ascent) || 0;
	const descent = Number(font.descent) || 0;
	const capHeight = Number(font.capHeight) || 0;
	return {
		em: { top: ascent, bottom: descent },
		cap: { top: capHeight, bottom: 0 },
	};
}

/**
 * @param {{top: Number, bottom: Number}} band
 * @returns {Boolean} true when a trace can be fitted to this band
 */
export function isUsableBand(band) {
	return !!band && Number.isFinite(band.top - band.bottom) && band.top - band.bottom > 0;
}

/**
 * The trace for a replacement image: same top-left corner, same height on the canvas,
 * same opacity / lock / invert, shown.
 * @param {Object} oldTrace
 * @param {{asset: String, width: Number, height: Number}} image - the new, decoded image
 * @returns {Object | null} a new trace, or null when either size is unusable
 */
export function keepPlacementForNewImage(oldTrace, image) {
	if (!oldTrace || !image) return null;
	const oldHeightFU = Number(oldTrace.height) * Number(oldTrace.scale);
	const newHeight = Number(image.height);
	if (!(oldHeightFU > 0) || !(newHeight > 0) || !(Number(image.width) > 0)) return null;
	return {
		...oldTrace,
		asset: image.asset,
		width: Number(image.width),
		height: newHeight,
		scale: oldHeightFU / newHeight,
		visible: true,
	};
}

/**
 * @param {Object} trace
 * @returns {{x: Number, y: Number, width: Number, height: Number} | null} rounded font units:
 *   top-left corner and drawn size
 */
export function placementSummary(trace) {
	if (!trace) return null;
	const scale = Number(trace.scale) || 0;
	return {
		x: Math.round(Number(trace.x) || 0),
		y: Math.round(Number(trace.y) || 0),
		width: Math.round((Number(trace.width) || 0) * scale),
		height: Math.round((Number(trace.height) || 0) * scale),
	};
}
