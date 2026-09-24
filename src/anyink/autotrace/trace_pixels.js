// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: reading the pixels of a trace image (Milestone 8).
	Owner: TRACK A (params, binarize, worker, client, facade). Browser only in practice
	(it needs a canvas that can read pixels back); the facade tests mock this module.

	- readTracePixels(blob, rect, size) -> Promise<{ imageData, rect, ratio }>
	  blob  = the trace's asset Blob (editor.assets.get(trace.asset).blob)
	  rect  = the part to read, in the trace's stored pixels (trace.width x trace.height)
	  size  = { width, height } of the stored image (trace.width, trace.height)
	  imageData = an ImageData of just that part, at the decoded bitmap's resolution;
	  rect      = that part in bitmap pixels (whole pixels, clamped to the bitmap);
	  ratio     = bitmap pixels per stored pixel (1 unless the decode came back another size).
	The bitmap comes from the redraw cache (bitmap_cache.js) when the edit canvas already
	decoded it, which is the usual case: the trace is on screen. The pixels are copied out in
	the same tick, because the cache may close a bitmap as soon as another image is drawn.
	On a miss (a hidden trace, or a decode still running) the Blob is decoded once here and
	closed right after the copy, so nothing waits on the cache and nothing is left open.
	Only the part inside rect is drawn, so a big scan never becomes one huge ImageData.
*/
import { getBitmap } from '../trace/bitmap_cache.js';
import { clampRect } from './binarize.js';

/** Plain-words message for an image that cannot be read. */
export const READ_FAILED_MESSAGE =
	'The trace image could not be read. Add the image again in the Trace panel.';

/**
 * @param {Blob} blob
 * @param {{x: Number, y: Number, width: Number, height: Number}} rect - stored-image pixels
 * @param {{width: Number, height: Number}} size - the stored image's pixel size
 * @returns {Promise<{imageData: {data: Uint8ClampedArray, width: Number, height: Number},
 *   rect: {x: Number, y: Number, width: Number, height: Number}, ratio: Number}>}
 */
export async function readTracePixels(blob, rect, size) {
	const cached = getBitmap(blob);
	if (cached) return copyRegion(cached, rect, size);

	if (typeof globalThis.createImageBitmap !== 'function') throw readError();
	let bitmap;
	try {
		bitmap = await globalThis.createImageBitmap(blob, { imageOrientation: 'from-image' });
	} catch (cause) {
		throw readError(cause);
	}
	try {
		return copyRegion(bitmap, rect, size);
	} finally {
		try {
			bitmap.close?.();
		} catch {
			// garbage-collected anyway
		}
	}
}

/** Draws only the rect of the bitmap onto a small canvas and reads it back. */
function copyRegion(bitmap, rect, size) {
	const ratio = size?.width > 0 ? bitmap.width / size.width : 1;
	const ratioY = size?.height > 0 ? bitmap.height / size.height : ratio;
	const part = clampRect(
		{
			x: rect.x * ratio,
			y: rect.y * ratioY,
			width: rect.width * ratio,
			height: rect.height * ratioY,
		},
		bitmap.width,
		bitmap.height
	);
	if (!part.width || !part.height) throw readError();

	const canvas = makeCanvas(part.width, part.height);
	const ctx = canvas?.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw readError();
	ctx.drawImage(bitmap, part.x, part.y, part.width, part.height, 0, 0, part.width, part.height);
	const image = ctx.getImageData(0, 0, part.width, part.height);
	return {
		imageData: { data: image.data, width: image.width, height: image.height },
		rect: part,
		ratio,
	};
}

function makeCanvas(width, height) {
	if (typeof globalThis.OffscreenCanvas === 'function') {
		return new globalThis.OffscreenCanvas(width, height);
	}
	if (typeof document !== 'undefined') {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		return canvas;
	}
	return null;
}

function readError(cause) {
	const error = new Error(READ_FAILED_MESSAGE);
	error.code = 'read-failed';
	if (cause !== undefined) error.cause = cause;
	return error;
}
