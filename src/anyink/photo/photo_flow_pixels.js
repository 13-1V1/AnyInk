// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: the pixels the flow reads and traces (docs/UX-BEGINNER.md 4.4, 7.7). Pure except
	readPhotoPixels, which needs a browser canvas (autotrace/trace_pixels.js).

	A part is traced from the photo's pixels round it (trace_region.js regionForPart: the part
	plus paper on every side, so the automatic ink cutoff sees paper), but in a tight hand that
	paper margin also holds the edge of the letter beside it. So before tracing, every bit of ink
	there that isn't the part's own (the photo's ink mask minus the part's mask, ink_parts.js) is
	painted with the paper's own color, grown by OTHER_INK_GROW_PX so its soft edge goes too, and
	never over the part's own ink. A box he drew is a part whose mask is all the ink inside it,
	so nothing inside his box is ever painted. The paint is the middle color of the paper in the
	area (a phone photo's paper is gray, not white: white blotches would make Photo mode's local
	cutoff see ink in the paper beside them), and dark paper under light ink stays dark.

	  isHeicBytes(bytes)    true for an HEIC photo by its first bytes (an ISO file box 'ftyp' with
	                        an HEIC brand), whatever the file is named: an iPhone photo renamed
	                        .jpg still gets the HEIC message (7.7), not "damaged"
	  isHeicFile(file)      true by its type or its name (.heic, .heif, .hif)
	  readPhotoPixels(blob, { width, height })   -> Promise<ImageData-like> of the whole stored
	                        photo (browser only)
	  paperColor(image, inkMask, region)   -> [r, g, b], the per-channel middle of the pixels
	                        that aren't ink in the region (white when there are none)
	  partPixels(image, region, { inkMask, part })   -> { data, width, height, x, y } the region
	                        (clamped to the photo; x, y = its top-left in the photo) with other
	                        ink painted out, or null when nothing of it is in the photo. part: {
	                        left, top, right, bottom, mask } (ink_parts.js); without an inkMask or
	                        a part mask the crop comes back as it is
*/
import { clampRect, cropImageData } from '../autotrace/binarize.js';
import { readTracePixels } from '../autotrace/trace_pixels.js';

/** Other ink is painted out this many pixels past its own edge (its soft, gray rim). */
export const OTHER_INK_GROW_PX = 2;

/** The ISO file-box brands an HEIC photo carries (iPhone: 'heic'; bursts and HEVC: the rest). */
export const HEIC_BRANDS = Object.freeze([
	'heic',
	'heix',
	'hevc',
	'hevx',
	'heim',
	'heis',
	'hevm',
	'hevs',
]);

/** Brands of a HEIF that may hold an HEIC picture (then its other brands decide). */
const HEIF_BRANDS = ['mif1', 'msf1'];

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_EXTENSIONS = ['heic', 'heif', 'hif'];

// --------------------------------------------------------------
// HEIC
// --------------------------------------------------------------

/**
 * @param {Uint8Array | ArrayBuffer} bytes - the start of the file is enough
 * @returns {Boolean}
 */
export function isHeicBytes(bytes) {
	const u8 =
		bytes instanceof Uint8Array
			? bytes
			: bytes instanceof ArrayBuffer
			? new Uint8Array(bytes)
			: null;
	if (!u8 || u8.length < 12) return false;
	if (text(u8, 4, 4) !== 'ftyp') return false;
	const size = ((u8[0] << 24) | (u8[1] << 16) | (u8[2] << 8) | u8[3]) >>> 0;
	const end = Math.min(u8.length, size >= 16 ? size : 16);
	const major = text(u8, 8, 4);
	if (HEIC_BRANDS.includes(major)) return true;
	if (!HEIF_BRANDS.includes(major)) return false;
	// The compatible brands follow the 4-byte minor version
	for (let at = 16; at + 4 <= end; at += 4) {
		if (HEIC_BRANDS.includes(text(u8, at, 4))) return true;
	}
	return false;
}

/**
 * @param {{name?: String, type?: String}} file
 * @returns {Boolean}
 */
export function isHeicFile(file) {
	const type = String(file?.type || '')
		.toLowerCase()
		.split(';')[0]
		.trim();
	const ext = (/\.([a-z0-9]+)$/i.exec(String(file?.name || ''))?.[1] || '').toLowerCase();
	return HEIC_TYPES.includes(type) || HEIC_EXTENSIONS.includes(ext);
}

function text(u8, at, length) {
	let out = '';
	for (let i = at; i < at + length && i < u8.length; i++) out += String.fromCharCode(u8[i]);
	return out;
}

// --------------------------------------------------------------
// Reading and preparing pixels
// --------------------------------------------------------------

/**
 * The whole stored photo's pixels (the parts are measured in these).
 * @param {Blob} blob - the photo's asset Blob
 * @param {{width: Number, height: Number}} size - the stored photo's pixel size
 * @returns {Promise<{data: Uint8ClampedArray, width: Number, height: Number}>}
 */
export async function readPhotoPixels(blob, size) {
	const rect = { x: 0, y: 0, width: size.width, height: size.height };
	const { imageData } = await readTracePixels(blob, rect, size);
	return imageData;
}

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} image
 * @param {Uint8Array | null} inkMask - 1 = ink, the photo's size
 * @param {{x: Number, y: Number, width: Number, height: Number}} region
 * @returns {Array<Number>} [r, g, b]
 */
export function paperColor(image, inkMask, region) {
	const { x, y, width, height } = clampRect(region, image.width, image.height);
	const counts = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
	let total = 0;
	for (let row = y; row < y + height; row++) {
		for (let col = x; col < x + width; col++) {
			const i = row * image.width + col;
			if (inkMask && inkMask[i]) continue;
			const at = i * 4;
			counts[0][image.data[at]]++;
			counts[1][image.data[at + 1]]++;
			counts[2][image.data[at + 2]]++;
			total++;
		}
	}
	if (!total) return [255, 255, 255];
	return counts.map((histogram) => middleOf(histogram, total));
}

/** The middle value of a 256-bin histogram holding `total` values. */
function middleOf(histogram, total) {
	const half = total / 2;
	let seen = 0;
	for (let value = 0; value < 256; value++) {
		seen += histogram[value];
		if (seen >= half) return value;
	}
	return 255;
}

/**
 * The region to trace, with every bit of ink that isn't the part's own painted out.
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} image - the whole photo
 * @param {{x: Number, y: Number, width: Number, height: Number}} region - photo pixels
 * @param {{inkMask?: Uint8Array, part?: Object}} [options]
 * @returns {{data: Uint8ClampedArray, width: Number, height: Number, x: Number, y: Number} | null}
 */
export function partPixels(image, region, { inkMask, part } = {}) {
	const rect = clampRect(region, image.width, image.height);
	if (!rect.width || !rect.height) return null;
	const crop = cropImageData(image, rect);
	const out = { ...crop, x: rect.x, y: rect.y };
	if (!inkMask || inkMask.length < image.width * image.height) return out;

	const own = ownInk(rect, part);
	if (!own) return out;
	const other = otherInk(rect, image.width, inkMask, own);
	if (!other.some(Boolean)) return out;

	const [r, g, b] = paperColor(image, inkMask, rect);
	for (let i = 0; i < other.length; i++) {
		if (!other[i]) continue;
		const at = i * 4;
		out.data[at] = r;
		out.data[at + 1] = g;
		out.data[at + 2] = b;
		out.data[at + 3] = 255;
	}
	return out;
}

/**
 * The part's own ink, laid on the region (1 = the part's ink), or null with no usable mask.
 * @param {{x: Number, y: Number, width: Number, height: Number}} rect
 * @param {Object} part - { left, top, right, bottom, mask }
 * @returns {Uint8Array | null}
 */
function ownInk(rect, part) {
	const mask = part?.mask;
	const w = Number(part?.right) - Number(part?.left);
	const h = Number(part?.bottom) - Number(part?.top);
	if (!(mask instanceof Uint8Array) || !(w > 0) || !(h > 0) || mask.length < w * h) return null;
	const own = new Uint8Array(rect.width * rect.height);
	for (let py = 0; py < h; py++) {
		const y = part.top + py - rect.y;
		if (y < 0 || y >= rect.height) continue;
		for (let px = 0; px < w; px++) {
			const x = part.left + px - rect.x;
			if (x < 0 || x >= rect.width || !mask[py * w + px]) continue;
			own[y * rect.width + x] = 1;
		}
	}
	return own;
}

/**
 * Ink in the region that isn't the part's, grown by OTHER_INK_GROW_PX (never onto the part).
 * @returns {Uint8Array} 1 = paint it out
 */
function otherInk(rect, imageWidth, inkMask, own) {
	const { width, height } = rect;
	let other = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		const from = (rect.y + y) * imageWidth + rect.x;
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			if (inkMask[from + x] && !own[i]) other[i] = 1;
		}
	}
	for (let step = 0; step < OTHER_INK_GROW_PX; step++) other = growOnce(other, width, height, own);
	return other;
}

/** One pixel of growth (4-connected), never onto `keep`. */
function growOnce(mask, width, height, keep) {
	const out = mask.slice();
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			if (mask[i] || keep[i]) continue;
			if (
				(x > 0 && mask[i - 1]) ||
				(x + 1 < width && mask[i + 1]) ||
				(y > 0 && mask[i - width]) ||
				(y + 1 < height && mask[i + width])
			) {
				out[i] = 1;
			}
		}
	}
	return out;
}
