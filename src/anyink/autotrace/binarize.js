// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: turning a photo or scan into black ink on white paper (Milestone 8).
	Pure: works on ImageData-like objects {data: Uint8ClampedArray (RGBA), width, height}, so
	it runs in vitest, on the main thread, or in a worker. Nothing here mutates its input.
	Owner: TRACK A (params, binarize, worker, client, facade).

	Contract (RESEARCH 2.1, D-016):
	- toGray(imageData) -> Uint8Array: Rec. 601 luma, alpha composited on white.
	- otsuThreshold(gray) -> 1..255 (128 for a one-tone image): ink is darker than it. When
	  several cutoffs split the histogram equally well (an empty gap between ink and paper),
	  the middle of that gap is used, not its dark edge.
	- thresholdGlobal(gray, width, height, t) -> Uint8Array mask (1 = ink: darker than t).
	- thresholdAdaptive(gray, width, height, { windowFraction = 1/8, t = 0.15 } = {}) -> mask:
	  Bradley-Roth with an integral image. A pixel is ink when it is more than t (15 %)
	  darker than the mean of the square window around it; the window's side is
	  windowFraction of the image's long side. For photos with uneven light.
	- despeckle(mask, width, height, size = 3) -> mask: size x size open (drops ink specks
	  and hairs thinner than size px), then size x size close (fills pinholes and cracks
	  thinner than size px). The image counts as continuing past its edge (edge pixels
	  repeated), so ink touching the edge is not eaten and paper beside the edge is not
	  filled. Any size costs the same (running window counts).
	- despeckleSizeFor(previewPixel) -> the kernel side for an image whose preview pixel is
	  previewPixel of its pixels: 3 at the preview's size; above it, the width of 2.5
	  preview pixels rounded up (at least 3). A line 2 to 3 preview pixels wide survives the
	  preview's 3x3 only when it lands on 3 whole pixels, so 2.5 is where it survives half
	  the time: 'Remove specks' then drops the same features at both sizes.
	- blurGray(gray, width, height, side) -> Uint8Array: a box blur side px wide (fractional
	  sides get partial end taps, and the box stays centered), edges repeated.
	- estimatePaper(gray, width, height, { radiusFraction = 1/8 } = {}) -> Uint8Array: the
	  paper brightness under each pixel: the brightest pixel of each block (a 64-block grid
	  on the long side), spread to the brightest within radiusFraction of the long side,
	  smoothed, and interpolated back to full size.
	- invertMask(mask) -> mask.
	- clampRect(rect, width, height) -> the whole-pixel part of rect inside the image
	  (fractional edges round outward).
	- cropImageData(imageData, rect) -> ImageData-like (a copy of the clamped rect).
	- downscaleImageData(imageData, maxSide) -> { imageData, factor }: area-averaged (alpha
	  premultiplied), factor = new / old size, the SAME on both axes (the last row and
	  column may be a partial pixel, which is averaged with transparent paper), so image
	  pixel p maps back to p / factor exactly. An image already inside maxSide comes back
	  as the same object with factor 1.
	- maskToImageData(mask, width, height) -> ImageData-like: black ink, white paper, alpha 255.
	- autoSplit(imageData, options) -> Otsu's split ({ threshold, contrast, mean }) of the
	  image's gray, inverted first for light ink on dark paper: what 'auto' picks.
	- binarize(imageData, options, { previewPixel = 1, split } = {}) -> { mask, width,
	  height, threshold, autoThreshold }:
	  gray, blurred to one preview pixel when previewPixel > 1 (see below), inverted for
	  light ink on dark paper, Otsu (autoThreshold; `split` replaces this image's own), then
	    scan:  thresholdGlobal at threshold ('auto' = autoThreshold);
	    photo: thresholdAdaptive, PLUS every pixel darker than half the local paper
	           brightness (estimatePaper). Bradley-Roth alone hollows out any stroke wider
	           than its window (a marker 'O' filling the glyph box traced as two thin rings);
	           the paper map reaches past the middle of strokes up to a quarter of the image
	           wide, while Bradley-Roth still catches faint pencil. The Threshold slider
	           shifts both cutoffs by s = (threshold - autoThreshold) / 510: Bradley-Roth's
	           t = 0.15 - s and the paper share 0.5 + s, so 'auto' is the plain method and a
	           higher Threshold means more ink, as in scan mode;
	  then despeckle (despeckleSizeFor(previewPixel)). In scan mode with 'auto', an image
	  with no real contrast (blank paper, or a crop inside one big blot) is all paper or all
	  ink, never Otsu splitting its grain into noise. The result also carries `split` (the
	  Otsu split used) and paperSpread, how uneven the paper is (95th minus 5th percentile
	  of estimatePaper, in gray levels; a clean scan is near 0, a phone photo lit from one
	  side 40 or more): always in Photo mode, and in Scan mode when `measurePaper` is true.
	- binarize(imageData, options, { previewPixel, split, measurePaper }) is the full form.
	- binarizeFollowingPreview(imageData, previewImageData, options, { factor }) -> as
	  binarize: the full-size pass, where the preview decides what is ink and the full size
	  places the edges (followPreviewMask; see there). The facade's apply uses it.
	- potracePaths(mask, width, height, turdsize = 0) -> { shown, paths }: potrace's own
	  split of a mask into outlines (a port of its decompose.c, turn policy 'minority'),
	  each { area, ink }, and `shown`, the mask as potrace draws it at that turdsize.
	  potraceShown(mask, width, height, turdsize) -> just `shown`. followPreviewMask uses
	  it for the preview as potrace shows it (fix, 10/13/2026; see potraceShown).

	Full size matched to the preview (first fix, 09/24/2026; the facade now uses
	binarizeFollowingPreview instead, and binarize's previewPixel stays for callers that
	have no preview pixels). The preview traces a copy shrunk so
	one of its pixels covers previewPixel x previewPixel pixels of the full-size image, and
	that averaging hides sensor noise and features thinner than a preview pixel. The
	full-size apply used to see them all: a noisy photo previewed as 77 shapes and applied
	as 44,000, and a 2 px line or slit showed in the preview but not in the result. So the
	full-size pass (previewPixel > 1) blurs its gray with the same box before anything else
	(the same noise level and the same thin-feature loss as the preview, sampled finer),
	sizes the despeckle kernel to match the preview's 3x3 (despeckleSizeFor), and takes
	the preview's Otsu split
	(`split`) so the Auto value on the slider is the cutoff used.
*/
import { normalizeOptions } from './params.js';

/** Bradley-Roth's darker-than-the-local-mean share. */
export const ADAPTIVE_T = 0.15;

/** Bradley-Roth's window, as a share of the image's long side. */
export const ADAPTIVE_WINDOW_FRACTION = 1 / 8;

/**
 * Otsu's two classes must differ by at least this many gray levels for 'auto' to find ink.
 * Blank paper grain differs by about 10; pencil on paper by 80 or more.
 */
export const MIN_AUTO_CONTRAST = 40;

/** Photo mode: a pixel darker than this share of the local paper brightness is ink. */
export const PAPER_INK_SHARE = 0.5;

/** estimatePaper: how far to look for paper, as a share of the image's long side. */
export const PAPER_RADIUS_FRACTION = 1 / 8;

/** estimatePaper: blocks across the long side. */
const PAPER_GRID = 64;

/** despeckle's kernel side at the preview's own size, in pixels. */
export const DESPECKLE_SIZE = 3;

/** A full-size pass drops what is narrower than this many preview pixels. */
export const DESPECKLE_PREVIEW_WIDTH = 2.5;

/** despeckle runs four passes (open, then close): the edge padding is four reaches. */
const DESPECKLE_PASSES = 4;

// --------------------------------------------------------------
// Gray and thresholds
// --------------------------------------------------------------

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @returns {Uint8Array} one gray level per pixel, 0 black .. 255 white
 */
export function toGray(imageData) {
	const { data } = imageData;
	const n = pixelCount(imageData);
	const gray = new Uint8Array(n);
	for (let i = 0, p = 0; i < n; i++, p += 4) {
		const a = data[p + 3];
		// Rec. 601 luma in thousandths (0 .. 255000), composited on white by alpha
		const luma = 299 * data[p] + 587 * data[p + 1] + 114 * data[p + 2];
		gray[i] = ((luma * a + 255000 * (255 - a) + 127500) / 255000) | 0;
	}
	return gray;
}

/**
 * @param {Uint8Array} gray
 * @returns {Number} 1..255: ink is darker than this (128 when the image has one tone)
 */
export function otsuThreshold(gray) {
	return otsu(gray).threshold;
}

/**
 * Otsu's method, with the class means kept for the contrast check.
 * @param {Uint8Array} gray
 * @returns {{threshold: Number, contrast: Number, mean: Number}} contrast = light class
 *   mean minus dark class mean; mean = the whole image's mean gray
 */
export function otsu(gray) {
	const total = gray?.length || 0;
	if (!total) return { threshold: 128, contrast: 0, mean: 255 };
	const hist = new Float64Array(256);
	for (let i = 0; i < total; i++) hist[gray[i]]++;
	let sumAll = 0;
	for (let k = 0; k < 256; k++) sumAll += k * hist[k];
	const mean = sumAll / total;

	let weightDark = 0;
	let sumDark = 0;
	let best = -1;
	let first = -1;
	let last = -1;
	let contrast = 0;
	for (let k = 0; k < 256; k++) {
		weightDark += hist[k];
		if (weightDark === 0) continue;
		const weightLight = total - weightDark;
		if (weightLight === 0) break;
		sumDark += k * hist[k];
		const meanDark = sumDark / weightDark;
		const meanLight = (sumAll - sumDark) / weightLight;
		const between = weightDark * weightLight * (meanDark - meanLight) ** 2;
		if (between > best) {
			best = between;
			first = last = k;
			contrast = meanLight - meanDark;
		} else if (between === best) {
			last = k;
		}
	}
	if (first < 0) return { threshold: 128, contrast: 0, mean };
	// Dark class is 0..k, so ink is darker than k + 1; the middle of a tie is the safest cut
	return { threshold: Math.floor((first + last) / 2) + 1, contrast, mean };
}

/**
 * @param {Uint8Array} gray
 * @param {Number} width
 * @param {Number} height
 * @param {Number} t - 0..256: ink is darker than this
 * @returns {Uint8Array} 1 = ink
 */
export function thresholdGlobal(gray, width, height, t) {
	const n = width * height;
	const mask = new Uint8Array(n);
	for (let i = 0; i < n; i++) mask[i] = gray[i] < t ? 1 : 0;
	return mask;
}

/**
 * Bradley-Roth adaptive threshold (integral image, so the window size costs nothing).
 * @param {Uint8Array} gray
 * @param {Number} width
 * @param {Number} height
 * @param {{windowFraction?: Number, t?: Number}} [options] - window side as a share of the
 *   long side; t = how much darker than the local mean a pixel must be (0.15 = 15 %)
 * @returns {Uint8Array} 1 = ink
 */
export function thresholdAdaptive(
	gray,
	width,
	height,
	{ windowFraction = ADAPTIVE_WINDOW_FRACTION, t = ADAPTIVE_T } = {}
) {
	const n = width * height;
	const mask = new Uint8Array(n);
	if (!n) return mask;

	const stride = width + 1;
	const size = stride * (height + 1);
	// Sums reach n * 255: Uint32 holds that up to 16.8 million pixels
	const integral = n * 255 < 2 ** 32 ? new Uint32Array(size) : new Float64Array(size);
	for (let y = 0; y < height; y++) {
		let row = 0;
		const above = y * stride + 1;
		const here = above + stride;
		const start = y * width;
		for (let x = 0; x < width; x++) {
			row += gray[start + x];
			integral[here + x] = integral[above + x] + row;
		}
	}

	const side = Math.max(3, Math.round(Math.max(width, height) * windowFraction));
	const half = Math.floor(side / 2);
	const keep = 1 - t;
	for (let y = 0; y < height; y++) {
		const y1 = Math.max(0, y - half);
		const y2 = Math.min(height - 1, y + half);
		const top = y1 * stride;
		const bottom = (y2 + 1) * stride;
		const rows = y2 - y1 + 1;
		const start = y * width;
		for (let x = 0; x < width; x++) {
			const x1 = Math.max(0, x - half);
			const x2 = Math.min(width - 1, x + half) + 1;
			const sum =
				integral[bottom + x2] - integral[bottom + x1] - integral[top + x2] + integral[top + x1];
			const count = (x2 - x1) * rows;
			mask[start + x] = gray[start + x] * count < sum * keep ? 1 : 0;
		}
	}
	return mask;
}

/**
 * The paper brightness under each pixel, for photos: ink is judged against the paper
 * around it, however wide the stroke it sits in (up to twice the radius).
 * @param {Uint8Array} gray
 * @param {Number} width
 * @param {Number} height
 * @param {{radiusFraction?: Number}} [options] - how far to look for paper, as a share of
 *   the long side
 * @returns {Uint8Array} 1..255 per pixel
 */
export function estimatePaper(
	gray,
	width,
	height,
	{ radiusFraction = PAPER_RADIUS_FRACTION } = {}
) {
	const n = width * height;
	const paper = new Uint8Array(n);
	if (!n) return paper;
	const long = Math.max(width, height);
	const block = Math.max(1, Math.round(long / PAPER_GRID));
	const gw = Math.ceil(width / block);
	const gh = Math.ceil(height / block);

	// Per column: its block, and the two block centers it sits between (with the weight)
	const colBlock = new Int32Array(width);
	const colLeft = new Int32Array(width);
	const colRight = new Int32Array(width);
	const colWeight = new Float32Array(width);
	for (let x = 0; x < width; x++) {
		colBlock[x] = Math.floor(x / block);
		const gx = Math.min(gw - 1, Math.max(0, (x + 0.5) / block - 0.5));
		colLeft[x] = Math.floor(gx);
		colRight[x] = Math.min(gw - 1, colLeft[x] + 1);
		colWeight[x] = gx - colLeft[x];
	}

	// The brightest pixel of each block
	let grid = new Float32Array(gw * gh);
	for (let y = 0; y < height; y++) {
		const row = Math.floor(y / block) * gw;
		const start = y * width;
		for (let x = 0; x < width; x++) {
			const g = row + colBlock[x];
			const v = gray[start + x];
			if (v > grid[g]) grid[g] = v;
		}
	}
	// Spread to the brightest block within the radius, then smooth the steps away
	const radius = Math.max(1, Math.round((long * radiusFraction) / block));
	grid = gridPass(grid, gw, gh, radius, Math.max);
	grid = gridPass(grid, gw, gh, Math.max(1, Math.ceil(radius / 2)), null);

	// Back to full size: bilinear between block centers, one grid row blend per image row
	const line = new Float32Array(gw);
	for (let y = 0; y < height; y++) {
		const gy = Math.min(gh - 1, Math.max(0, (y + 0.5) / block - 0.5));
		const top = Math.floor(gy) * gw;
		const bottom = Math.min(gh - 1, Math.floor(gy) + 1) * gw;
		const fy = gy - Math.floor(gy);
		for (let g = 0; g < gw; g++) line[g] = grid[top + g] * (1 - fy) + grid[bottom + g] * fy;
		const start = y * width;
		for (let x = 0; x < width; x++) {
			const fx = colWeight[x];
			const v = line[colLeft[x]] * (1 - fx) + line[colRight[x]] * fx;
			paper[start + x] = v < 1 ? 1 : v + 0.5;
		}
	}
	return paper;
}

/**
 * A separable square pass over the block grid: the maximum (combine = Math.max) or the
 * mean (combine = null) of each cell's neighbors within radius, edges clamped.
 */
function gridPass(grid, gw, gh, radius, combine) {
	const across = new Float32Array(gw * gh);
	const out = new Float32Array(gw * gh);
	const pass = (src, dst, count, stride, lines, lineStride) => {
		for (let line = 0; line < lines; line++) {
			const base = line * lineStride;
			for (let i = 0; i < count; i++) {
				const from = Math.max(0, i - radius);
				const to = Math.min(count - 1, i + radius);
				let acc = 0;
				for (let k = from; k <= to; k++) {
					const v = src[base + k * stride];
					acc = combine ? combine(acc, v) : acc + v;
				}
				dst[base + i * stride] = combine ? acc : acc / (to - from + 1);
			}
		}
	};
	pass(grid, across, gw, 1, gh, gw);
	pass(across, out, gh, gw, gw, 1);
	return out;
}

// --------------------------------------------------------------
// Mask clean-up
// --------------------------------------------------------------

/**
 * size x size open, then size x size close.
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @param {Number} [size] - kernel side in pixels (DESPECKLE_SIZE; below 2 changes nothing)
 * @returns {Uint8Array} a new mask
 */
export function despeckle(mask, width, height, size = DESPECKLE_SIZE) {
	if (!(width > 0) || !(height > 0)) return new Uint8Array(0);
	const k = Math.max(1, Math.round(Number(size) || DESPECKLE_SIZE));
	if (k < 2) return mask.slice(0, width * height);
	// The window runs lo px back and hi px on (lo = hi for an odd side). Erosion uses it as
	// is and dilation mirrored, so an open or close with an even side does not shift ink.
	const lo = Math.floor((k - 1) / 2);
	const hi = k - 1 - lo;
	// Work on a copy padded with the original edge pixels repeated outward, so the image
	// reads as continuing past its edge (a crop cuts through the scan). Four passes reach
	// 4 x hi px in, so that pad keeps the pad's own border out of the result.
	const pad = DESPECKLE_PASSES * hi;
	const w = width + 2 * pad;
	const h = height + 2 * pad;
	const padded = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		const sy = Math.min(height - 1, Math.max(0, y - pad)) * width;
		for (let x = 0; x < w; x++) {
			padded[y * w + x] = mask[sy + Math.min(width - 1, Math.max(0, x - pad))];
		}
	}
	const erode = (src) => morph(src, w, h, lo, hi, true);
	const dilate = (src) => morph(src, w, h, hi, lo, false);
	const opened = dilate(erode(padded));
	const closed = erode(dilate(opened));
	const out = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		const from = (y + pad) * w + pad;
		out.set(closed.subarray(from, from + width), y * width);
	}
	return out;
}

/**
 * The despeckle kernel side for a full-size pass whose preview pixel covers previewPixel
 * of its pixels: DESPECKLE_PREVIEW_WIDTH preview pixels in its own pixels, rounded up, at
 * least 3 (3 at the preview's own size).
 * @param {Number} [previewPixel] - 1 at the preview's own size
 * @returns {Number} whole pixels
 */
export function despeckleSizeFor(previewPixel = 1) {
	const side = Number(previewPixel) > 1 ? Number(previewPixel) : 1;
	return Math.max(DESPECKLE_SIZE, Math.ceil(DESPECKLE_PREVIEW_WIDTH * side - 1e-9));
}

/**
 * @param {Uint8Array} mask
 * @returns {Uint8Array} a new mask, ink and paper swapped
 */
export function invertMask(mask) {
	const out = new Uint8Array(mask.length);
	for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1;
	return out;
}

/**
 * Separable binary minimum (erode: every pixel of the window is ink) or maximum (dilate:
 * any is), over a window from `back` px before to `on` px after each pixel, on both axes.
 * Neighbors outside the image are ignored. Running counts, so the window size costs
 * nothing.
 */
function morph(src, width, height, back, on, isErode) {
	const n = width * height;
	// Row pass: a prefix sum per row
	const rowPass = new Uint8Array(n);
	const prefix = new Int32Array(width + 1);
	for (let y = 0; y < height; y++) {
		const start = y * width;
		for (let x = 0; x < width; x++) prefix[x + 1] = prefix[x] + src[start + x];
		for (let x = 0; x < width; x++) {
			const x1 = x - back > 0 ? x - back : 0;
			const x2 = x + on < width - 1 ? x + on : width - 1;
			const inked = prefix[x2 + 1] - prefix[x1];
			if (isErode) rowPass[start + x] = inked === x2 - x1 + 1 ? 1 : 0;
			else rowPass[start + x] = inked > 0 ? 1 : 0;
		}
	}
	// Column pass: a count per column over the rows in the window, slid down row by row
	const out = new Uint8Array(n);
	const counts = new Int32Array(width);
	let added = -1;
	let removed = -1;
	for (let y = 0; y < height; y++) {
		const top = y - back > 0 ? y - back : 0;
		const bottom = y + on < height - 1 ? y + on : height - 1;
		while (added < bottom) {
			added++;
			const row = added * width;
			for (let x = 0; x < width; x++) counts[x] += rowPass[row + x];
		}
		while (removed < top - 1) {
			removed++;
			const row = removed * width;
			for (let x = 0; x < width; x++) counts[x] -= rowPass[row + x];
		}
		const rows = bottom - top + 1;
		const start = y * width;
		for (let x = 0; x < width; x++) {
			if (isErode) out[start + x] = counts[x] === rows ? 1 : 0;
			else out[start + x] = counts[x] > 0 ? 1 : 0;
		}
	}
	return out;
}

/**
 * Box blur `side` px wide on both axes, centered: whole taps in the middle and partial taps
 * at the ends for a fractional or even side (side 2 = weights 0.25, 0.5, 0.25). Each output
 * pixel averages the same area one preview pixel averages. Edges repeated.
 * @param {Uint8Array} gray
 * @param {Number} width
 * @param {Number} height
 * @param {Number} side - box width in pixels; 1 or less returns a copy
 * @returns {Uint8Array}
 */
export function blurGray(gray, width, height, side) {
	const n = width * height;
	if (!(side > 1) || !n) return gray.slice(0, n);
	const half = side / 2;
	const reach = Math.ceil(half - 0.5);
	const taps = new Float32Array(2 * reach + 1);
	for (let d = -reach; d <= reach; d++) {
		taps[d + reach] = Math.max(0, Math.min(d + 0.5, half) - Math.max(d - 0.5, -half)) / side;
	}
	const across = new Float32Array(n);
	for (let y = 0; y < height; y++) {
		const start = y * width;
		for (let x = 0; x < width; x++) {
			let acc = 0;
			for (let d = -reach; d <= reach; d++) {
				const xx = x + d < 0 ? 0 : x + d >= width ? width - 1 : x + d;
				acc += taps[d + reach] * gray[start + xx];
			}
			across[start + x] = acc;
		}
	}
	const out = new Uint8Array(n);
	for (let y = 0; y < height; y++) {
		const start = y * width;
		for (let x = 0; x < width; x++) {
			let acc = 0;
			for (let d = -reach; d <= reach; d++) {
				const yy = y + d < 0 ? 0 : y + d >= height ? height - 1 : y + d;
				acc += taps[d + reach] * across[yy * width + x];
			}
			out[start + x] = acc + 0.5;
		}
	}
	return out;
}

// --------------------------------------------------------------
// Crop, downscale, and back to pixels
// --------------------------------------------------------------

/**
 * @param {{x: Number, y: Number, width: Number, height: Number}} rect - image pixels
 * @param {Number} width - image width
 * @param {Number} height - image height
 * @returns {{x: Number, y: Number, width: Number, height: Number}} whole pixels inside
 *   the image (width or height 0 when nothing overlaps)
 */
export function clampRect(rect, width, height) {
	const rx = num(rect?.x);
	const ry = num(rect?.y);
	const x0 = clamp(Math.floor(rx), 0, width);
	const y0 = clamp(Math.floor(ry), 0, height);
	const x1 = clamp(Math.ceil(rx + num(rect?.width)), 0, width);
	const y1 = clamp(Math.ceil(ry + num(rect?.height)), 0, height);
	return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {{x: Number, y: Number, width: Number, height: Number}} rect - image pixels
 * @returns {{data: Uint8ClampedArray, width: Number, height: Number}} a copy of the part
 *   of rect inside the image (0 x 0 when nothing overlaps)
 */
export function cropImageData(imageData, rect) {
	const { x, y, width, height } = clampRect(rect, imageData.width, imageData.height);
	const data = new Uint8ClampedArray(width * height * 4);
	const rowBytes = width * 4;
	for (let row = 0; row < height; row++) {
		const from = ((y + row) * imageData.width + x) * 4;
		data.set(imageData.data.subarray(from, from + rowBytes), row * rowBytes);
	}
	return { data, width, height };
}

/**
 * Area-averaged downscale to a long side of maxSide.
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {Number} maxSide - long side cap, in pixels
 * @returns {{imageData: Object, factor: Number}} factor = new / old size (both axes)
 */
export function downscaleImageData(imageData, maxSide) {
	const { width, height, data } = imageData;
	const long = Math.max(width, height);
	if (!(maxSide > 0) || !(long > maxSide)) return { imageData, factor: 1 };

	const factor = maxSide / long;
	const newWidth = Math.max(1, Math.ceil(width * factor - 1e-9));
	const newHeight = Math.max(1, Math.ceil(height * factor - 1e-9));
	const across = spans(width, newWidth, factor);
	const down = spans(height, newHeight, factor);

	// Row pass: premultiplied RGB plus alpha, per output column, for every input row
	const mid = new Float32Array(newWidth * height * 4);
	for (let y = 0; y < height; y++) {
		const rowIn = y * width;
		const rowOut = y * newWidth;
		for (let j = 0; j < newWidth; j++) {
			let r = 0;
			let g = 0;
			let b = 0;
			let a = 0;
			const { start, weights } = across[j];
			for (let k = 0; k < weights.length; k++) {
				const p = (rowIn + start + k) * 4;
				const wa = weights[k] * data[p + 3];
				r += data[p] * wa;
				g += data[p + 1] * wa;
				b += data[p + 2] * wa;
				a += wa;
			}
			const q = (rowOut + j) * 4;
			mid[q] = r;
			mid[q + 1] = g;
			mid[q + 2] = b;
			mid[q + 3] = a;
		}
	}

	// Column pass, then un-premultiply. Each output pixel's full area is 1 / factor^2
	// input pixels; any part of it past the image edge counts as transparent.
	const out = new Uint8ClampedArray(newWidth * newHeight * 4);
	const area = factor * factor;
	for (let i = 0; i < newHeight; i++) {
		const { start, weights } = down[i];
		for (let j = 0; j < newWidth; j++) {
			let r = 0;
			let g = 0;
			let b = 0;
			let a = 0;
			for (let k = 0; k < weights.length; k++) {
				const q = ((start + k) * newWidth + j) * 4;
				const w = weights[k];
				r += mid[q] * w;
				g += mid[q + 1] * w;
				b += mid[q + 2] * w;
				a += mid[q + 3] * w;
			}
			const o = (i * newWidth + j) * 4;
			if (a > 0) {
				out[o] = Math.round(r / a);
				out[o + 1] = Math.round(g / a);
				out[o + 2] = Math.round(b / a);
			}
			out[o + 3] = Math.round(a * area);
		}
	}
	return { imageData: { data: out, width: newWidth, height: newHeight }, factor };
}

/**
 * For each output cell, the input cells it covers and how much of each (in input pixels).
 * Output cell j covers input [j / factor, (j + 1) / factor), cut at the image edge.
 */
function spans(sizeIn, sizeOut, factor) {
	const out = new Array(sizeOut);
	for (let j = 0; j < sizeOut; j++) {
		const from = j / factor;
		const to = Math.min(sizeIn, (j + 1) / factor);
		const start = Math.min(sizeIn - 1, Math.floor(from));
		const end = Math.max(start + 1, Math.ceil(to));
		const weights = new Float64Array(end - start);
		for (let i = start; i < end; i++) {
			weights[i - start] = Math.max(0, Math.min(i + 1, to) - Math.max(i, from));
		}
		out[j] = { start, weights };
	}
	return out;
}

/**
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @returns {{data: Uint8ClampedArray, width: Number, height: Number}} black ink on white
 *   paper, alpha 255
 */
export function maskToImageData(mask, width, height) {
	const n = width * height;
	const data = new Uint8ClampedArray(n * 4).fill(255);
	for (let i = 0, p = 0; i < n; i++, p += 4) {
		if (mask[i]) data[p] = data[p + 1] = data[p + 2] = 0;
	}
	return { data, width, height };
}

// --------------------------------------------------------------
// The whole step
// --------------------------------------------------------------

/**
 * Otsu's split of an image as binarize sees it at its own size ('auto').
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {Object} [options] - auto-trace options (only invert matters)
 * @returns {{threshold: Number, contrast: Number, mean: Number}}
 */
export function autoSplit(imageData, options) {
	return otsu(grayFor(imageData, normalizeOptions(options), 1));
}

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {Object} options - auto-trace options (params.js; normalized here again)
 * @param {{previewPixel?: Number, split?: {threshold: Number, contrast: Number,
 *   mean: Number}, measurePaper?: Boolean}} [match] - for a full-size pass: how many of its
 *   pixels one preview pixel covers (blur and despeckle size follow it), and the preview's
 *   Otsu split; measurePaper: report paperSpread in Scan mode too
 * @returns {{mask: Uint8Array, width: Number, height: Number, threshold: Number,
 *   autoThreshold: Number, split: Object, paperSpread?: Number}} threshold = the gray
 *   level used (autoThreshold under 'auto')
 */
export function binarize(
	imageData,
	options,
	{ previewPixel = 1, split: given, measurePaper = false } = {}
) {
	const opts = normalizeOptions(options);
	const width = imageData.width;
	const height = imageData.height;
	const coarse = Number(previewPixel) > 1 ? Number(previewPixel) : 1;
	const gray = grayFor(imageData, opts, coarse);

	const split = isSplit(given) ? given : otsu(gray);
	const autoThreshold = split.threshold;
	const isAuto = opts.threshold === 'auto';
	const threshold = isAuto ? autoThreshold : opts.threshold;

	let mask;
	// Paper brightness across the image: photo mode needs it, and on request (measurePaper)
	// scan mode reports how uneven it is (paperSpread): whether Photo mode would help
	let paper = null;
	if (opts.mode === 'photo' || measurePaper) paper = estimatePaper(gray, width, height);
	if (opts.mode === 'photo') {
		const shift = (threshold - autoThreshold) / 510;
		mask = thresholdAdaptive(gray, width, height, { t: ADAPTIVE_T - shift });
		const share = PAPER_INK_SHARE + shift;
		for (let i = 0; i < mask.length; i++) {
			if (!mask[i] && gray[i] < paper[i] * share) mask[i] = 1;
		}
	} else if (isAuto && split.contrast < MIN_AUTO_CONTRAST) {
		// No real ink/paper split: all paper when the image is light, all ink when dark
		mask = new Uint8Array(width * height).fill(split.mean < 128 ? 1 : 0);
	} else {
		mask = thresholdGlobal(gray, width, height, threshold);
	}
	if (opts.despeckle) mask = despeckle(mask, width, height, despeckleSizeFor(coarse));
	const out = { mask, width, height, threshold, autoThreshold, split };
	if (paper) out.paperSpread = spreadOf(paper);
	return out;
}

/**
 * The full-size pass of an image whose preview the user saw: the preview decides what is
 * there, the full size only places the edges of large shapes (fix, 09/24/2026).
 * The preview is binarized exactly as the preview pass does it (its own Otsu split, 3x3
 * Remove specks), and the full size with the preview's split, its gray blurred to one
 * preview pixel, and no Remove specks. followPreviewMask then combines the two (see
 * there), so every piece of ink and every hole in the result is one the preview showed,
 * at any shrink. Blurring the full size and sizing its Remove specks to match the preview
 * could not promise that: features at the kernel's width flipped between the two sizes,
 * and a preview shrunk by 1.1 to 1.4 hid 3 to 7 times the specks the apply then kept.
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData - full size
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} previewImageData - the
 *   same pixels shrunk by `factor` (downscaleImageData)
 * @param {Object} options - auto-trace options
 * @param {{factor: Number, speckArea?: Number}} shrink - preview size / full size (below
 *   1), and the preview's speck filter (its potrace turdsize, in preview pixels): pieces
 *   and holes up to this size are not in the preview, so they are not in the result
 * @returns {{mask: Uint8Array, width: Number, height: Number, threshold: Number,
 *   autoThreshold: Number, split: Object}} threshold and split: the preview's
 */
export function binarizeFollowingPreview(
	imageData,
	previewImageData,
	options,
	{ factor, speckArea = 0 } = {}
) {
	const opts = normalizeOptions(options);
	const preview = binarize(previewImageData, opts);
	const full = binarize(
		imageData,
		{ ...opts, despeckle: false },
		{ previewPixel: 1 / factor, split: preview.split }
	);
	const mask = followPreviewMask(
		preview.mask,
		preview.width,
		preview.height,
		full.mask,
		full.width,
		full.height,
		factor,
		{ speckArea }
	);
	return {
		mask,
		width: full.width,
		height: full.height,
		threshold: preview.threshold,
		autoThreshold: preview.autoThreshold,
		split: preview.split,
	};
}

/** A piece the full size finds on its own is dropped up to this many preview pixels. */
export const FOLLOW_FRAGMENT_PREVIEW_PIXELS = 2;

/**
 * The mask rule of binarizeFollowingPreview. It works on the preview as potrace shows it
 * (potraceShown: potrace's own outlines of area up to speckArea taken out, so a speck or
 * pinhole of two corner-touching pixels, which potrace joins, stays), with 4-connected
 * pieces:
 * - A preview pixel whose 3 x 3 neighborhood is all ink is ink at full size; all paper,
 *   paper.
 * - On an edge between a large piece of ink and a large piece of paper (a large piece has
 *   a pixel whose 3 x 3 neighborhood is all its own; the paper around everything counts
 *   as large), the full size decides pixel by pixel: that is where it adds precision.
 * - Everywhere else on an edge (specks, lines and slits no more than 2 preview pixels
 *   wide, which have no such pixel) the preview pixel is copied, so the full size keeps
 *   exactly the thin things the preview showed and adds none.
 * - Last, a piece of ink or paper the full size made on its own inside those edges (it
 *   touches no ink, or no paper, the preview decided, nor for paper the image's border) is
 *   flipped when it is no larger than FOLLOW_FRAGMENT_PREVIEW_PIXELS preview pixels: noise
 *   the preview averaged away. A larger one (an arm the full size broke off) stays.
 * Preview neighbors past its edge repeat the edge pixel. Full pixel x is preview pixel
 * floor((x + 0.5) * factor) (downscaleImageData's cells).
 * @param {Uint8Array} previewMask
 * @param {Number} pw
 * @param {Number} ph
 * @param {Uint8Array} fullMask
 * @param {Number} fw
 * @param {Number} fh
 * @param {Number} factor - preview size / full size
 * @param {{speckArea?: Number}} [shown] - the preview's potrace turdsize, preview pixels
 * @returns {Uint8Array} full size, 1 = ink
 */
export function followPreviewMask(
	previewMask,
	pw,
	ph,
	fullMask,
	fw,
	fh,
	factor,
	{ speckArea = 0 } = {}
) {
	const shown = potraceShown(previewMask, pw, ph, speckArea);
	const n = pw * ph;

	// 0 = paper all around, 1 = ink all around, 2 = on an edge
	const state = new Uint8Array(n);
	forNeighborhoods(pw, ph, (i, around) => {
		let inked = 0;
		for (let k = 0; k < 9; k++) inked += shown[around[k]];
		state[i] = inked === 0 ? 0 : inked === 9 ? 1 : 2;
	});

	// Large pieces: those with a pixel whose neighborhood is all their own
	const ink = labelPieces(shown, pw, ph, 1);
	const paper = labelPieces(shown, pw, ph, 0);
	const largeInk = new Uint8Array(ink.count + 1);
	const largePaper = new Uint8Array(paper.count + 1);
	for (let i = 0; i < n; i++) {
		if (state[i] === 1) largeInk[ink.labels[i]] = 1;
		else if (state[i] === 0) largePaper[paper.labels[i]] = 1;
	}
	for (let id = 1; id <= paper.count; id++) if (paper.border[id]) largePaper[id] = 1;

	// What each preview pixel does at full size: 0 paper, 1 ink, 2 the full size decides
	const action = new Uint8Array(n);
	forNeighborhoods(pw, ph, (i, around) => {
		if (state[i] !== 2) {
			action[i] = state[i];
			return;
		}
		let nearInk = false;
		let nearPaper = false;
		for (let k = 0; k < 9; k++) {
			const j = around[k];
			if (shown[j]) {
				if (largeInk[ink.labels[j]]) nearInk = true;
			} else if (largePaper[paper.labels[j]]) {
				nearPaper = true;
			}
		}
		action[i] = nearInk && nearPaper ? 2 : shown[i];
	});

	const colOf = new Int32Array(fw);
	for (let x = 0; x < fw; x++) colOf[x] = Math.min(pw - 1, Math.floor((x + 0.5) * factor));
	const out = new Uint8Array(fw * fh);
	const decided = new Uint8Array(fw * fh);
	let refined = 0;
	for (let y = 0; y < fh; y++) {
		const row = Math.min(ph - 1, Math.floor((y + 0.5) * factor)) * pw;
		const start = y * fw;
		for (let x = 0; x < fw; x++) {
			const a = action[row + colOf[x]];
			if (a === 2) {
				out[start + x] = fullMask[start + x];
				refined++;
			} else {
				out[start + x] = a;
				decided[start + x] = 1;
			}
		}
	}
	if (refined) {
		const fragment = FOLLOW_FRAGMENT_PREVIEW_PIXELS / (factor * factor);
		flipFloatingPieces(out, decided, fw, fh, 1, fragment);
		flipFloatingPieces(out, decided, fw, fh, 0, fragment);
	}
	return out;
}

/**
 * Calls visit(i, around) for every pixel; around holds the 9 indices of its 3 x 3
 * neighborhood (edges repeated) and is reused between calls.
 */
function forNeighborhoods(width, height, visit) {
	const around = new Int32Array(9);
	for (let y = 0; y < height; y++) {
		const r0 = Math.max(0, y - 1) * width;
		const r1 = y * width;
		const r2 = Math.min(height - 1, y + 1) * width;
		for (let x = 0; x < width; x++) {
			const c0 = Math.max(0, x - 1);
			const c2 = Math.min(width - 1, x + 1);
			around[0] = r0 + c0;
			around[1] = r0 + x;
			around[2] = r0 + c2;
			around[3] = r1 + c0;
			around[4] = r1 + x;
			around[5] = r1 + c2;
			around[6] = r2 + c0;
			around[7] = r2 + x;
			around[8] = r2 + c2;
			visit(r1 + x, around);
		}
	}
}

/**
 * 4-connected pieces of the pixels equal to `value` (1 ink, 0 paper).
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @param {0 | 1} value
 * @returns {{labels: Int32Array, count: Number, sizes: Int32Array, border: Uint8Array}}
 *   labels 1..count per pixel (0 = the other value); sizes and border (the piece touches
 *   the image's edge) indexed by label
 */
export function labelPieces(mask, width, height, value) {
	const n = width * height;
	const labels = new Int32Array(n);
	const stack = new Int32Array(n);
	const sizes = [0];
	const border = [0];
	let count = 0;
	const want = value ? 1 : 0;
	for (let seed = 0; seed < n; seed++) {
		if (labels[seed] || (mask[seed] ? 1 : 0) !== want) continue;
		count++;
		let size = 0;
		let touches = 0;
		let top = 0;
		stack[top++] = seed;
		labels[seed] = count;
		while (top) {
			const i = stack[--top];
			size++;
			const x = i % width;
			const y = (i - x) / width;
			if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touches = 1;
			if (x > 0 && !labels[i - 1] && (mask[i - 1] ? 1 : 0) === want) {
				labels[i - 1] = count;
				stack[top++] = i - 1;
			}
			if (x < width - 1 && !labels[i + 1] && (mask[i + 1] ? 1 : 0) === want) {
				labels[i + 1] = count;
				stack[top++] = i + 1;
			}
			if (y > 0 && !labels[i - width] && (mask[i - width] ? 1 : 0) === want) {
				labels[i - width] = count;
				stack[top++] = i - width;
			}
			if (y < height - 1 && !labels[i + width] && (mask[i + width] ? 1 : 0) === want) {
				labels[i + width] = count;
				stack[top++] = i + width;
			}
		}
		sizes.push(size);
		border.push(touches);
	}
	return { labels, count, sizes: Int32Array.from(sizes), border: Uint8Array.from(border) };
}

/**
 * A mask as potrace draws it at this turdsize (fix, 10/13/2026): every path of
 * potracePaths whose area is no more than turdsize taken out.
 *
 * This replaced dropping 4-connected pieces, which disagreed with potrace in two ways, so a
 * speck the preview showed could vanish from the applied result:
 * - potrace (turnpolicy 'minority', what the worker asks for) joins two pixels that touch
 *   only at a corner when their color is the rarer one around that corner. Two corner-
 *   touching ink pixels on paper are one path of area 2, kept at turdsize 1; as 4-connected
 *   pieces they were two pieces of 1, both dropped. The same for a pinhole of two corner-
 *   touching paper pixels in ink.
 * - A path's area is everything inside its outline, holes included: a ring of 8 pixels
 *   around a 1-pixel hole has area 9.
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @param {Number} turdsize - potrace drops paths of this area or less (below 1: none)
 * @returns {Uint8Array} a new mask, 1 = ink
 */
export function potraceShown(mask, width, height, turdsize) {
	if (!(turdsize >= 1)) {
		const n = width * height;
		const copy = new Uint8Array(n);
		for (let i = 0; i < n; i++) copy[i] = mask[i] ? 1 : 0;
		return copy;
	}
	return potracePaths(mask, width, height, turdsize).shown;
}

/**
 * potrace's own split of a bitmap into paths: a port of potrace 1.16's decompose.c
 * (bm_to_pathlist, findpath, xor_path, majority), the version esm-potrace-wasm builds, with
 * the 'minority' turn policy. Each path is an outline potrace traces: an ink piece's outer
 * edge, or a hole's edge inside one. esm-potrace-wasm puts image row 0 at the top of
 * potrace's y-up bitmap, so potrace's scan order is this mask's row order. Checked against
 * the WASM itself on random masks (the same path areas at every turdsize).
 * @param {Uint8Array} mask - 1 = ink
 * @param {Number} width
 * @param {Number} height
 * @param {Number} [turdsize] - paths of this area or less are left out of `shown`
 * @returns {{shown: Uint8Array, paths: Array<{area: Number, ink: Boolean}>}} shown = what
 *   potrace draws; paths in potrace's order, area = pixels inside the outline (holes
 *   included), ink = an ink piece's outline (false: a hole's)
 */
export function potracePaths(mask, width, height, turdsize = 0) {
	const n = width * height;
	const shown = new Uint8Array(n);
	for (let i = 0; i < n; i++) shown[i] = mask[i] ? 1 : 0;
	const paths = [];
	if (!n) return { shown, paths };
	// What is left to trace: each traced path's inside is inverted, as potrace does
	const left = shown.slice();
	// potrace's BM_GET at (x, y), y up from the bottom row; outside the image is paper
	const get = (x, y) =>
		x >= 0 && x < width && y >= 0 && y < height ? left[(height - 1 - y) * width + x] : 0;
	// potrace's majority(): 1 when ink is the more common color around corner (x, y)
	const majority = (x, y) => {
		for (let i = 2; i < 5; i++) {
			let ct = 0;
			for (let a = -i + 1; a <= i - 1; a++) {
				ct += get(x + a, y + i - 1) ? 1 : -1;
				ct += get(x + i - 1, y + a - 1) ? 1 : -1;
				ct += get(x + a - 1, y - i) ? 1 : -1;
				ct += get(x - i, y + a) ? 1 : -1;
			}
			if (ct > 0) return 1;
			if (ct < 0) return 0;
		}
		return 0;
	};
	// The path's vertical edges: x, then the image row of the pixel row the edge runs along
	let edges = new Int32Array(1024);
	for (let seed = 0; seed < n; seed++) {
		if (!left[seed]) continue;
		// findpath from the top-left corner of the first pixel left, heading down
		const x0 = seed % width;
		const y0 = height - (seed - x0) / width;
		let x = x0;
		let y = y0;
		let dirx = 0;
		let diry = -1;
		let area = 0;
		let count = 0;
		for (;;) {
			x += dirx;
			y += diry;
			area += x * diry;
			if (diry) {
				if (count + 2 > edges.length) {
					const grown = new Int32Array(edges.length * 2);
					grown.set(edges);
					edges = grown;
				}
				edges[count++] = x;
				edges[count++] = height - 1 - (diry < 0 ? y : y - 1);
			}
			if (x === x0 && y === y0) break;
			const c = get(x + ((dirx + diry - 1) >> 1), y + ((diry - dirx - 1) >> 1));
			const d = get(x + ((dirx - diry - 1) >> 1), y + ((diry + dirx - 1) >> 1));
			let turn = 0; // 1 right, -1 left
			if (c && !d) turn = majority(x, y) ? -1 : 1; // ambiguous: join the rarer color
			else if (c) turn = 1;
			else if (!d) turn = -1;
			if (turn > 0) {
				const t = dirx;
				dirx = diry;
				diry = -t;
			} else if (turn < 0) {
				const t = dirx;
				dirx = -diry;
				diry = t;
			}
		}
		paths.push({ area, ink: !!mask[seed] });
		// xor_path: invert the path's inside (the pixels between each vertical edge and x0,
		// an even number of times outside it); a dropped path leaves the drawing as well
		const drop = area <= turdsize;
		for (let k = 0; k < count; k += 2) {
			const ex = edges[k];
			const row = edges[k + 1] * width;
			const from = row + (ex < x0 ? ex : x0);
			const to = row + (ex < x0 ? x0 : ex);
			for (let i = from; i < to; i++) left[i] ^= 1;
			if (drop) for (let i = from; i < to; i++) shown[i] ^= 1;
		}
	}
	return { shown, paths };
}

/**
 * Flips the pieces of `value` that lie wholly in undecided pixels, touch no decided pixel
 * of the same value (nor, for paper, the image's edge), and are no larger than `fragment`
 * pixels. Only undecided pixels are walked.
 */
function flipFloatingPieces(out, decided, width, height, value, fragment) {
	const n = width * height;
	const seen = new Uint8Array(n);
	const piece = [];
	const visit = (j) => {
		if (out[j] !== value) return false;
		if (decided[j]) return true;
		if (!seen[j]) {
			seen[j] = 1;
			piece.push(j);
		}
		return false;
	};
	for (let seed = 0; seed < n; seed++) {
		if (decided[seed] || seen[seed] || out[seed] !== value) continue;
		piece.length = 0;
		piece.push(seed);
		seen[seed] = 1;
		let anchored = false;
		for (let k = 0; k < piece.length; k++) {
			const i = piece[k];
			const x = i % width;
			const y = (i - x) / width;
			if (!value && (x === 0 || y === 0 || x === width - 1 || y === height - 1)) {
				anchored = true;
			}
			if (x > 0 && visit(i - 1)) anchored = true;
			if (x < width - 1 && visit(i + 1)) anchored = true;
			if (y > 0 && visit(i - width)) anchored = true;
			if (y < height - 1 && visit(i + width)) anchored = true;
		}
		if (!anchored && piece.length <= fragment) {
			for (const i of piece) out[i] = value ? 0 : 1;
		}
	}
}

/** How uneven a paper map is: its 95th minus its 5th percentile, in gray levels. */
function spreadOf(paper) {
	const n = paper.length;
	if (!n) return 0;
	const hist = new Uint32Array(256);
	for (let i = 0; i < n; i++) hist[paper[i]]++;
	const low = n * 0.05;
	const high = n * 0.95;
	let seen = 0;
	let p5 = -1;
	let p95 = 255;
	for (let k = 0; k < 256; k++) {
		seen += hist[k];
		if (p5 < 0 && seen > low) p5 = k;
		if (seen >= high) {
			p95 = k;
			break;
		}
	}
	return Math.max(0, p95 - Math.max(0, p5));
}

/** Gray, blurred to one preview pixel (side > 1), inverted for light ink on dark paper. */
function grayFor(imageData, opts, side) {
	let gray = toGray(imageData);
	if (side > 1) gray = blurGray(gray, imageData.width, imageData.height, side);
	if (opts.invert) {
		for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];
	}
	return gray;
}

function isSplit(split) {
	return (
		!!split &&
		Number.isFinite(split.threshold) &&
		Number.isFinite(split.contrast) &&
		Number.isFinite(split.mean)
	);
}

/**
 * @param {Uint8Array} mask
 * @returns {Boolean} true when any pixel is ink
 */
export function hasInk(mask) {
	for (let i = 0; i < mask.length; i++) if (mask[i]) return true;
	return false;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function pixelCount(imageData) {
	const n = Math.max(0, imageData.width * imageData.height) || 0;
	return Math.min(n, Math.floor((imageData.data?.length || 0) / 4));
}

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function clamp(value, low, high) {
	return Math.min(high, Math.max(low, value));
}
