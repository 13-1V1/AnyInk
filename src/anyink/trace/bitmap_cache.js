// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: image decoding and the bitmap cache (Milestone 7, D-023).
	Owner: TRACK A (model + draw + bitmap cache).

	- decodeImageFile(fileOrBlob, {maxSide = 2000}) -> Promise<{blob, type, width, height}>:
	  PNG / JPEG / WebP only (plain-words error otherwise, HEIC included), decoded with
	  createImageBitmap(..., {imageOrientation: 'from-image'}) so phone photos stand up
	  straight, long side capped, then re-encoded once (image/webp at 0.92 when the
	  browser can, else image/png). The stored asset is small and already upright, so
	  every later decode is cheap and needs no EXIF handling.
	  Every rejection is an Error whose message can go straight into a toast, with a
	  `code`: 'not-a-file' | 'heic' | 'unsupported' | 'no-decoder' | 'decode-failed' |
	  'encode-failed'.
	- getBitmap(blob) -> ImageBitmap | null: synchronous lookup for the redraw loop,
	  keyed by the Blob object (editor.assets.get(id).blob). A miss starts one async
	  decode and returns null; a Blob that failed to decode is not retried, so a broken
	  image can never cause a redraw loop. The cache is least-recently-used and holds
	  BITMAP_CACHE_SIZE bitmaps (the glyph on screen plus a few recent neighbors); the
	  one pushed out is close()d. editor.assets keeps every Blob for the whole session
	  (undo can bring a removed trace back), so a cache keyed by those Blobs has to let
	  go by itself: a 2000 x 1500 image is about 12 MB decoded, and one photo per glyph
	  for ~70 glyphs would otherwise keep ~840 MB alive. A caller must draw a bitmap
	  right after getBitmap returns it (never keep it across an await), and must not
	  need more than BITMAP_CACHE_SIZE different images per redraw, or they would evict
	  each other and decode forever.
	- onBitmapReady(fn) -> unsubscribe: fn runs (no arguments) once each time a pending
	  decode finishes, so the edit canvas can redraw (edit_canvas.js subscribes).
	- setDecoderForTests(impl): jsdom has no real createImageBitmap or OffscreenCanvas.
	  impl = { decode(blob, options) -> Promise<bitmap-like {width, height, close?}>,
	           encode?(bitmap, {width, height, type, quality}) -> Promise<Blob> }.
	  Setting (or clearing, with null) the decoder also empties the cache (and closes
	  the bitmaps in it).
	Nothing in this file touches a browser API at import time; the decoder is looked up
	when it is needed.
*/
import { isImageType, normalizeType } from '../assets/asset_store.js';

/** Long-side cap for a trace image, in pixels (D-023). */
export const TRACE_MAX_SIDE = 2000;

/** WebP quality for the one re-encode. */
export const ENCODE_QUALITY = 0.92;

/**
 * How many decoded bitmaps the redraw cache keeps. The edit canvas draws one trace (the
 * item on screen); the rest make stepping back and forth between neighbors instant.
 */
export const BITMAP_CACHE_SIZE = 4;

/** Messages a decode can reject with, in plain words (toast-ready). */
export const DECODE_MESSAGES = Object.freeze({
	notAFile: 'That is not an image file. Use a PNG, JPEG, or WebP image.',
	heic:
		'iPhone HEIC photos cannot be opened here. Save the photo as a JPEG first ' +
		'(on the iPhone: Settings > Camera > Formats > Most Compatible), then try again.',
	noDecoder: 'This browser cannot open images for tracing. Use Chrome or Edge.',
	decodeFailed:
		'This image could not be opened. It may be damaged, or saved in a format the ' +
		'browser cannot read. Save it again as a PNG or JPEG and try again.',
	encodeFailed: 'This image could not be prepared for tracing. Try a smaller PNG or JPEG.',
});

/**
 * The message for a file that is not PNG, JPEG, or WebP.
 * @param {File | Blob} file
 * @returns {String} e.g. 'Only PNG, JPEG, or WebP images can be traced over. This is a GIF image.'
 */
export function unsupportedMessage(file) {
	return (
		`Only PNG, JPEG, or WebP images can be traced over. This is ${describeFile(file)}. ` +
		'Save it as a PNG or JPEG and try again.'
	);
}

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_EXTENSIONS = ['heic', 'heif', 'hif'];
const EXTENSION_TYPES = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	jfif: 'image/jpeg',
	webp: 'image/webp',
};
const UNTYPED = ['', 'application/octet-stream'];
const FRIENDLY_TYPES = {
	'image/gif': 'a GIF image',
	'image/bmp': 'a BMP image',
	'image/tiff': 'a TIFF image',
	'image/avif': 'an AVIF image',
	'image/svg+xml': 'an SVG drawing (drop it on the canvas to import its shapes instead)',
	'image/x-icon': 'an icon file',
	'image/vnd.microsoft.icon': 'an icon file',
	'application/pdf': 'a PDF',
};
const FRIENDLY_EXTENSIONS = {
	gif: 'image/gif',
	bmp: 'image/bmp',
	tif: 'image/tiff',
	tiff: 'image/tiff',
	avif: 'image/avif',
	svg: 'image/svg+xml',
	ico: 'image/x-icon',
	pdf: 'application/pdf',
};

// --------------------------------------------------------------
// Decoder selection
// --------------------------------------------------------------

let testDecoder = null;

const browserDecoder = Object.freeze({
	decode: (blob, options) => globalThis.createImageBitmap(blob, options),
	encode: encodeWithCanvas,
});

/** @returns {Object | null} the decoder to use right now, or null when there is none */
function activeDecoder() {
	if (testDecoder) return testDecoder;
	if (typeof globalThis.createImageBitmap === 'function') return browserDecoder;
	return null;
}

/**
 * Replaces the browser decoder (tests only). Pass null to restore the default.
 * Also empties the bitmap cache, so each test starts cold.
 * @param {Object | null} impl - { decode(blob, options), encode?(bitmap, options) }
 */
export function setDecoderForTests(impl) {
	testDecoder = impl && typeof impl === 'object' && typeof impl.decode === 'function' ? impl : null;
	resetCache();
}

// --------------------------------------------------------------
// Decode a new image (import)
// --------------------------------------------------------------

/**
 * Decodes, caps, and re-encodes an image for the trace layer.
 * @param {File | Blob} fileOrBlob - a File from a drop, paste, or picker, or a typed Blob
 * @param {{maxSide?: Number}} [options] - long-side cap in pixels, default 2000
 * @returns {Promise<{blob: Blob, type: String, width: Number, height: Number}>}
 *   width / height are the pixel size of the returned (stored) image
 * @throws {Error} with a plain-words message and a `code` (see the header)
 */
export async function decodeImageFile(fileOrBlob, { maxSide = TRACE_MAX_SIDE } = {}) {
	if (!isBlobLike(fileOrBlob)) throw traceImageError('not-a-file', DECODE_MESSAGES.notAFile);

	const type = resolveImageType(fileOrBlob);
	if (type === 'heic') throw traceImageError('heic', DECODE_MESSAGES.heic);
	if (!type) throw traceImageError('unsupported', unsupportedMessage(fileOrBlob));

	const decoder = activeDecoder();
	if (!decoder) throw traceImageError('no-decoder', DECODE_MESSAGES.noDecoder);

	let bitmap;
	try {
		bitmap = await decoder.decode(fileOrBlob, { imageOrientation: 'from-image' });
	} catch (cause) {
		throw traceImageError('decode-failed', DECODE_MESSAGES.decodeFailed, cause);
	}

	try {
		const sourceWidth = Number(bitmap?.width);
		const sourceHeight = Number(bitmap?.height);
		if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
			throw traceImageError('decode-failed', DECODE_MESSAGES.decodeFailed);
		}
		const cap = Number(maxSide) > 0 ? Number(maxSide) : TRACE_MAX_SIDE;
		const { width, height } = fitWithin(sourceWidth, sourceHeight, cap);
		const blob = await encodeOnce(decoder, bitmap, width, height);
		return { blob, type: normalizeType(blob.type), width, height };
	} finally {
		closeBitmap(bitmap);
	}
}

/**
 * The size an image gets when its long side is capped. Aspect ratio kept, rounded to
 * whole pixels, never below 1 x 1. Images already inside the cap keep their size.
 * @param {Number} width - pixels
 * @param {Number} height - pixels
 * @param {Number} maxSide - pixels
 * @returns {{width: Number, height: Number}}
 */
export function fitWithin(width, height, maxSide) {
	const long = Math.max(width, height);
	if (!(long > maxSide)) return { width: Math.round(width), height: Math.round(height) };
	const k = maxSide / long;
	return {
		width: Math.max(1, Math.round(width * k)),
		height: Math.max(1, Math.round(height * k)),
	};
}

/**
 * WebP first; PNG when the browser handed back something else (it cannot encode WebP)
 * or the WebP attempt failed.
 */
async function encodeOnce(decoder, bitmap, width, height) {
	const encode = typeof decoder.encode === 'function' ? decoder.encode : encodeWithCanvas;

	let blob = null;
	try {
		blob = await encode(bitmap, { width, height, type: 'image/webp', quality: ENCODE_QUALITY });
	} catch {
		blob = null;
	}
	const firstType = normalizeType(blob?.type);
	if (usableBlob(blob) && (firstType === 'image/webp' || firstType === 'image/png')) return blob;

	try {
		blob = await encode(bitmap, { width, height, type: 'image/png' });
	} catch (cause) {
		throw traceImageError('encode-failed', DECODE_MESSAGES.encodeFailed, cause);
	}
	if (usableBlob(blob) && normalizeType(blob.type) === 'image/png') return blob;
	throw traceImageError('encode-failed', DECODE_MESSAGES.encodeFailed);
}

/**
 * The browser encoder: draw the bitmap at the capped size (high-quality smoothing),
 * then encode. OffscreenCanvas when there is one, a detached <canvas> otherwise.
 * @param {ImageBitmap} source
 * @param {{width: Number, height: Number, type: String, quality?: Number}} options
 * @returns {Promise<Blob>}
 */
async function encodeWithCanvas(source, { width, height, type, quality }) {
	const canvas = makeCanvas(width, height);
	const ctx = canvas?.getContext?.('2d');
	if (!ctx) throw new Error('No canvas is available to encode the image.');
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
	if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type, quality });
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
			type,
			quality
		);
	});
}

function makeCanvas(width, height) {
	if (typeof globalThis.OffscreenCanvas === 'function') {
		return new globalThis.OffscreenCanvas(width, height);
	}
	if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		return canvas;
	}
	return null;
}

// --------------------------------------------------------------
// The redraw-loop cache
// --------------------------------------------------------------

const bitmaps = new Map(); // Blob -> ImageBitmap, oldest use first (least recently used)
let pending = new WeakMap(); // Blob -> Promise
let failed = new WeakSet(); // Blobs that could not be decoded (never retried)
let generation = 0; // bumped by resetCache, so a decode started before a reset is dropped
const readyListeners = new Set();

function resetCache() {
	generation += 1;
	for (const bitmap of bitmaps.values()) closeBitmap(bitmap);
	bitmaps.clear();
	pending = new WeakMap();
	failed = new WeakSet();
}

/**
 * @param {Blob} blob - an asset's Blob (editor.assets.get(id).blob)
 * @returns {ImageBitmap | null} the decoded bitmap, or null while it is not ready
 *   (or when it can never be: no decoder, not a Blob, or a failed decode). Draw it
 *   right away; a later decode can evict and close it.
 */
export function getBitmap(blob) {
	if (!isBlobLike(blob)) return null;
	const hit = bitmaps.get(blob);
	if (hit) {
		// Most recently used goes to the end of the Map's order
		bitmaps.delete(blob);
		bitmaps.set(blob, hit);
		return hit;
	}
	if (pending.has(blob) || failed.has(blob)) return null;

	const decoder = activeDecoder();
	if (!decoder) return null;

	const startedIn = generation;
	let decoding;
	try {
		decoding = Promise.resolve(decoder.decode(blob, { imageOrientation: 'from-image' }));
	} catch (e) {
		decoding = Promise.reject(e);
	}
	const job = decoding
		.then(
			(bitmap) => {
				if (generation !== startedIn) {
					closeBitmap(bitmap); // the cache was reset meanwhile
					return;
				}
				if (bitmap && Number(bitmap.width) > 0 && Number(bitmap.height) > 0) {
					remember(blob, bitmap);
				} else {
					failed.add(blob);
				}
			},
			() => {
				if (generation === startedIn) failed.add(blob);
			}
		)
		.then(() => {
			if (generation !== startedIn) return;
			pending.delete(blob);
			notifyReady();
		});
	pending.set(blob, job);
	return null;
}

/** Adds a bitmap as the most recent one and closes whatever falls off the old end. */
function remember(blob, bitmap) {
	bitmaps.set(blob, bitmap);
	while (bitmaps.size > BITMAP_CACHE_SIZE) {
		const [oldest, old] = bitmaps.entries().next().value;
		bitmaps.delete(oldest);
		closeBitmap(old);
	}
}

function closeBitmap(bitmap) {
	try {
		bitmap?.close?.();
	} catch {
		// a bitmap that cannot be closed is garbage-collected anyway
	}
}

/**
 * @param {Function} fn - called with no arguments when a pending decode finishes
 * @returns {Function} unsubscribe
 */
export function onBitmapReady(fn) {
	if (typeof fn !== 'function') return () => {};
	readyListeners.add(fn);
	return () => {
		readyListeners.delete(fn);
	};
}

function notifyReady() {
	for (const fn of [...readyListeners]) {
		try {
			fn();
		} catch (e) {
			console.warn('ANY-INK trace: a bitmap-ready listener failed', e);
		}
	}
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * @param {File | Blob} file
 * @returns {String | 'heic' | null} the image MIME type we will decode, 'heic' for an
 *   iPhone photo, or null for anything else
 */
function resolveImageType(file) {
	const mime = normalizeType(file.type);
	const ext = extensionOf(file.name);
	if (isImageType(mime)) return mime;
	if (HEIC_TYPES.includes(mime)) return 'heic';
	if (UNTYPED.includes(mime)) {
		if (HEIC_EXTENSIONS.includes(ext)) return 'heic';
		if (EXTENSION_TYPES[ext]) return EXTENSION_TYPES[ext];
	}
	return null;
}

function describeFile(file) {
	const mime = normalizeType(file?.type);
	const ext = extensionOf(file?.name);
	const known = FRIENDLY_TYPES[mime] || FRIENDLY_TYPES[FRIENDLY_EXTENSIONS[ext]];
	if (known) return known;
	if (ext) return `a .${ext} file`;
	const [major, minor] = mime.split('/');
	if (major === 'image' && minor) return `a ${minor.replace(/^x-/, '').toUpperCase()} image`;
	if (major === 'text') return 'a text file';
	if (major === 'video') return 'a video';
	if (major === 'audio') return 'a sound file';
	if (mime && !UNTYPED.includes(mime)) return 'not an image';
	return 'a file with no image type';
}

function extensionOf(name) {
	const match = /\.([a-z0-9]+)$/i.exec(String(name || ''));
	return match ? match[1].toLowerCase() : '';
}

function isBlobLike(value) {
	return (
		!!value &&
		typeof value === 'object' &&
		typeof value.size === 'number' &&
		typeof value.slice === 'function'
	);
}

function usableBlob(blob) {
	return isBlobLike(blob) && blob.size > 0;
}

function traceImageError(code, message, cause) {
	const error = new Error(message);
	error.code = code;
	if (cause !== undefined) error.cause = cause;
	return error;
}
