// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-ui, moved here by the B8 + B9 integration: drawing a photo into a canvas, for the
	photo dialog's view, the photo card's thumbnails and the empty-letter overlay's thumbnail. No
	imports, so the letter view can draw a thumbnail without importing the dialog (photo_dialog.js
	re-exports both).

	  paintPhoto(canvas, image, { fit })   draws a photo into a canvas ('fill' or 'contain');
	                 image: an ImageBitmap, <img>, <canvas>, ImageData or Blob (or a Promise of one);
	                 resolves true when drawn
	  fitSize(boxW, boxH, w, h)            the photo's size inside the view, aspect kept
*/

/**
 * @param {HTMLCanvasElement} canvas
 * @param {*} source - ImageBitmap, <img>, <canvas>, ImageData, Blob, or a Promise of one
 * @param {{fit?: 'fill' | 'contain'}} [options]
 * @returns {Promise<Boolean>} true when drawn
 */
export async function paintPhoto(canvas, source, { fit = 'fill' } = {}) {
	try {
		let image = source && typeof source.then === 'function' ? await source : source;
		if (isBlob(image)) image = await decodeBlob(image);
		if (!image || !canvas) return false;
		const context = canvas.getContext('2d');
		if (!context) return false;
		if (isImageData(image)) image = await imageDataSource(image);
		if (!image) return false;
		const w = Number(image.naturalWidth || image.width) || canvas.width;
		const h = Number(image.naturalHeight || image.height) || canvas.height;
		let box = { x: 0, y: 0, w: canvas.width, h: canvas.height };
		if (fit === 'contain') {
			const size = fitSize(canvas.width, canvas.height, w, h);
			box = {
				x: (canvas.width - size.width) / 2,
				y: (canvas.height - size.height) / 2,
				w: size.width,
				h: size.height,
			};
			context.clearRect(0, 0, canvas.width, canvas.height);
		}
		context.drawImage(image, box.x, box.y, box.w, box.h);
		return true;
	} catch (error) {
		console.warn('ANY-INK photo: the photo could not be drawn', error);
		return false;
	}
}

function isBlob(value) {
	return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isImageData(value) {
	return (
		!!value &&
		typeof value === 'object' &&
		value.data instanceof Uint8ClampedArray &&
		Number.isFinite(value.width) &&
		Number.isFinite(value.height) &&
		typeof value.getContext !== 'function'
	);
}

/**
 * An ImageData as something drawImage takes. B8 + B9 integration (found in Chrome): the photo
 * flow's pixels are a plain { data, width, height } (photo_flow_pixels.js), which neither
 * createImageBitmap nor putImageData takes, so the dialog stayed on "Loading the photo...": a
 * real ImageData is made from it first.
 */
async function imageDataSource(pixels) {
	const imageData = asImageData(pixels);
	if (!imageData) return null;
	if (typeof createImageBitmap === 'function') {
		try {
			return await createImageBitmap(imageData);
		} catch {
			// fall back to a canvas
		}
	}
	const canvas = globalThis.document.createElement('canvas');
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	canvas.getContext('2d')?.putImageData(imageData, 0, 0);
	return canvas;
}

/** A Blob as something drawImage takes. */
function decodeBlob(blob) {
	if (typeof createImageBitmap === 'function') {
		return createImageBitmap(blob).catch(() => null);
	}
	return new Promise((resolve) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		img.src = url;
	});
}

/**
 * @param {Number} boxW
 * @param {Number} boxH
 * @param {Number} w
 * @param {Number} h
 * @returns {{width: Number, height: Number}} w x h scaled to fit inside the box
 */
export function fitSize(boxW, boxH, w, h) {
	if (!(w > 0 && h > 0 && boxW > 0 && boxH > 0)) return { width: 0, height: 0 };
	const scale = Math.min(boxW / w, boxH / h);
	return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} pixels
 * @returns {ImageData | null}
 */
function asImageData(pixels) {
	if (typeof ImageData === 'undefined') return pixels;
	if (pixels instanceof ImageData) return pixels;
	try {
		return new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
	} catch {
		return null;
	}
}
