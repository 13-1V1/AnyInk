// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: options and the slider-to-potrace mapping (Milestone 8). Pure.
	Owner: TRACK A (params, binarize, worker, client, facade).

	Options (every slider is 0..1 except Threshold, which is a gray level):
	  mode           'scan' (one cutoff for the whole image) | 'photo' (a cutoff that follows
	                 the local paper brightness, for phone photos with uneven light)
	  threshold      'auto' (Otsu) | 0..255: pixels darker than this are ink (photo mode:
	                 moves the local cutoff up or down by the same amount, see binarize.js)
	  smoothing      0..1 -> potrace alphamax 0..1.3334 (0 = every corner sharp)
	  detail         0..1 -> smaller kept shapes and a tighter curve fit as it rises
	  despeckle      3x3 open then close on the black-and-white image
	  invert         light ink on dark paper
	  insideBoxOnly  trace only the part of the image inside the glyph box

	toPotraceOptions(options, { scale, upm, previewScale }) -> { turdsize, alphamax,
	  opttolerance, turnpolicy: 'minority', pathonly: false, extractcolors: false }:
	- alphamax = smoothing * 1.3334 (potrace's own range; 1 is potrace's default).
	- opttolerance = 0.5 at detail 0, falling in a straight line to 0.05 at detail 1.
	- turdsize: the smallest kept shape is a square whose side is SPECK_SIDE_EM of the em
	  (3 %, 30 font units at 1000 units per em) at detail 0, shrinking in a straight line to
	  nothing at detail 1. Its area in font units becomes pixels through the image's scale:
	  px area = fu area / scale^2, rounded. So a speck the size of a comma's tail is kept or
	  dropped the same way whether the image is 500 or 2000 pixels tall.
	  Floor (fix, 09/24/2026): never below the area of one preview pixel, floor((previewScale
	  / scale)^2), which is 1 px at the preview's own size and 4 px for a full-size trace of
	  a preview shrunk by half. At Detail 100 % the font-unit speck is 0, and a full-size
	  apply then kept every noise speck the preview could not show (44,000 shapes from a
	  photo whose preview had 77).
	  scale = font units per pixel of the image potrace sees (after any crop or downscale);
	  previewScale = font units per pixel of the preview of the same image (the coarser of
	  the two; default scale); upm = the font's units per em (default 1000).
	The worker turns turnpolicy 'minority' into potrace's number (4).
*/

/** Every auto-trace option, at its default. */
export const AUTOTRACE_DEFAULTS = Object.freeze({
	mode: 'scan',
	threshold: 'auto',
	smoothing: 0.75,
	detail: 0.6,
	despeckle: true,
	invert: false,
	insideBoxOnly: true,
});

/** Top of potrace's alphamax range (4/3: above it potrace makes no corners at all). */
export const ALPHAMAX_MAX = 1.3334;

/** opttolerance at detail 0 and at detail 1. */
export const OPTTOLERANCE_LOW_DETAIL = 0.5;
export const OPTTOLERANCE_HIGH_DETAIL = 0.05;

/** Side of the smallest kept shape at detail 0, as a share of the em square. */
export const SPECK_SIDE_EM = 0.03;

/** Units per em when the caller does not say. */
export const DEFAULT_UPM = 1000;

const MODES = ['scan', 'photo'];
const BOOLEAN_KEYS = ['despeckle', 'invert', 'insideBoxOnly'];

/**
 * A full, clamped options object. Unknown keys are dropped; anything missing or unusable
 * takes its default. threshold is 'auto' or a whole number 0..255.
 * @param {Object} [raw] - any subset of AUTOTRACE_DEFAULTS
 * @returns {Object}
 */
export function normalizeOptions(raw) {
	const source = raw && typeof raw === 'object' ? raw : {};
	const out = { ...AUTOTRACE_DEFAULTS };

	if (MODES.includes(source.mode)) out.mode = source.mode;

	const threshold = finite(source.threshold);
	out.threshold = threshold === null ? 'auto' : Math.round(clamp(threshold, 0, 255));

	for (const key of ['smoothing', 'detail']) {
		const value = finite(source[key]);
		if (value !== null) out[key] = clamp(value, 0, 1);
	}
	for (const key of BOOLEAN_KEYS) {
		if (typeof source[key] === 'boolean') out[key] = source[key];
	}
	return out;
}

/**
 * Maps the sliders onto potrace's parameters.
 * @param {Object} options - auto-trace options (normalized here again, so raw is fine)
 * @param {{scale?: Number, upm?: Number, previewScale?: Number}} [placement] - font units
 *   per image pixel of the image potrace sees, the font's units per em, and font units per
 *   pixel of the preview of that image (default scale)
 * @returns {{turdsize: Number, alphamax: Number, opttolerance: Number, turnpolicy: String,
 *   pathonly: Boolean, extractcolors: Boolean}}
 */
export function toPotraceOptions(options, { scale, upm, previewScale } = {}) {
	const { smoothing, detail } = normalizeOptions(options);
	return {
		turdsize: turdsizeFor(detail, scale, upm, previewScale),
		alphamax: smoothing * ALPHAMAX_MAX,
		opttolerance:
			OPTTOLERANCE_LOW_DETAIL + (OPTTOLERANCE_HIGH_DETAIL - OPTTOLERANCE_LOW_DETAIL) * detail,
		turnpolicy: 'minority',
		pathonly: false,
		extractcolors: false,
	};
}

/**
 * Area, in square font units, of the smallest shape kept at this Detail.
 * @param {Number} detail - 0..1
 * @param {Number} [upm]
 * @returns {Number}
 */
export function speckAreaFontUnits(detail, upm = DEFAULT_UPM) {
	const em = finite(upm) > 0 ? finite(upm) : DEFAULT_UPM;
	const side = SPECK_SIDE_EM * em * (1 - clamp(finite(detail) ?? 0, 0, 1));
	return side * side;
}

/**
 * potrace's turdsize (pixels) for this Detail at this image scale: the font-unit speck in
 * pixels, but never less than one preview pixel (previewPixelArea).
 * @param {Number} detail - 0..1
 * @param {Number} [scale] - font units per pixel (default 1)
 * @param {Number} [upm]
 * @param {Number} [previewScale] - font units per preview pixel (default scale)
 * @returns {Number} whole pixels, at least 1
 */
export function turdsizeFor(detail, scale, upm, previewScale) {
	const s = finite(scale) > 0 ? finite(scale) : 1;
	const speck = Math.round(speckAreaFontUnits(detail, upm) / (s * s));
	return Math.max(speck, previewPixelArea(s, previewScale));
}

/**
 * The area of one preview pixel in whole pixels of the traced image: potrace drops shapes
 * up to this size even at Detail 100 %, so a full-size trace never keeps specks the
 * preview was too coarse to show. 1 at the preview's own size.
 * @param {Number} scale - font units per pixel of the traced image
 * @param {Number} [previewScale] - font units per preview pixel (default scale; a value
 *   finer than scale counts as scale)
 * @returns {Number} whole pixels, at least 1
 */
export function previewPixelArea(scale, previewScale) {
	const s = finite(scale) > 0 ? finite(scale) : 1;
	const side = Math.max(1, (finite(previewScale) > 0 ? finite(previewScale) : s) / s);
	return Math.max(1, Math.floor(side * side + 1e-9));
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** @returns {Number | null} the value when it is a finite number, else null */
function finite(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value, low, high) {
	return Math.min(high, Math.max(low, value));
}
