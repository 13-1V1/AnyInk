// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helpers for B9 photo-flow (not shipped). jsdom has no ImageBitmap, no canvas that reads
	pixels back and no WebAssembly potrace worker, so the flow's tests stand in for three things,
	each as close to the real one as Node allows:
	- fakeDecoder(images): bitmap_cache.js setDecoderForTests: "decodes" a File by its name to
	  the fixture's real pixels (decoded beforehand with sharp, photo/tests/fixture_image.js) and
	  "encodes" a Blob that remembers them, so readTracePixels (mocked with fakePixelsOf) hands
	  the same pixels back for the stored photo.
	- fakeTrace(imageData, options, placement): autotrace.js autoTraceImageData: the real
	  binarize (the same cutoff, Photo mode and Remove specks), potrace's own speck filter
	  (params.js turdsize), and one closed box per ink piece placed by the facade's own mapping
	  (fontX = x + (px + offsetX) * scale, fontY = y - (py + offsetY) * scale). Every call is
	  logged in fakeTrace.calls.
	- box(x0, y0, x1, y1): a closed Path in font units.
*/
import { Path } from '../../../project_data/path.js';
import { binarize, labelPieces } from '../../autotrace/binarize.js';
import { normalizeOptions, toPotraceOptions } from '../../autotrace/params.js';

/** Pixels of every Blob the fake decoder made. */
const pixelsOfBlob = new WeakMap();

/**
 * @param {Object<String, {data: Uint8ClampedArray, width: Number, height: Number}>} images -
 *   the decoded fixture by file name
 * @returns {{decode: Function, encode: Function}}
 */
export function fakeDecoder(images) {
	return {
		decode: async (file) => {
			const image = images[file?.name];
			if (!image) throw new Error(`fake decoder: no pixels for ${file?.name}`);
			return { width: image.width, height: image.height, image, close() {} };
		},
		encode: async (bitmap, { type }) => {
			const blob = new Blob([new Uint8Array(16)], { type });
			pixelsOfBlob.set(blob, bitmap.image);
			return blob;
		},
	};
}

/**
 * readTracePixels as the mock: the stored photo's pixels in the rect.
 * @param {Blob} blob
 * @param {{x: Number, y: Number, width: Number, height: Number}} rect
 * @returns {Promise<{imageData: Object, rect: Object, ratio: Number}>}
 */
export async function fakePixelsOf(blob, rect) {
	const image = pixelsOfBlob.get(blob);
	if (!image) throw Object.assign(new Error('fake pixels: unknown photo'), { code: 'read-failed' });
	if (rect.x === 0 && rect.y === 0 && rect.width === image.width && rect.height === image.height) {
		return { imageData: image, rect: { ...rect }, ratio: 1 };
	}
	throw new Error('fake pixels: the flow reads whole photos only');
}

/**
 * autoTraceImageData's stand-in (see the header).
 * @returns {Promise<Object>}
 */
export async function fakeTrace(imageData, options, placement) {
	const opts = normalizeOptions(options);
	fakeTrace.calls.push({ imageData, options: opts, placement });
	const { mask, width, height, threshold, autoThreshold } = binarize(imageData, opts);
	const scale = placement.scale;
	const { turdsize } = toPotraceOptions(opts, { scale, upm: placement.upm });
	const { labels, count, sizes } = labelPieces(mask, width, height, 1);
	const boxes = [];
	for (let label = 1; label <= count; label++) {
		boxes[label] = { left: width, top: height, right: -1, bottom: -1 };
	}
	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		if (!label) continue;
		const x = i % width;
		const y = (i - x) / width;
		const b = boxes[label];
		if (x < b.left) b.left = x;
		if (x > b.right) b.right = x;
		if (y < b.top) b.top = y;
		if (y > b.bottom) b.bottom = y;
	}
	const ox = placement.offsetX || 0;
	const oy = placement.offsetY || 0;
	const shapes = [];
	for (let label = 1; label <= count; label++) {
		if (sizes[label] <= turdsize) continue;
		const b = boxes[label];
		shapes.push(
			box(
				placement.x + (b.left + ox) * scale,
				placement.y - (b.bottom + 1 + oy) * scale,
				placement.x + (b.right + 1 + ox) * scale,
				placement.y - (b.top + oy) * scale
			)
		);
	}
	return {
		shapes,
		points: shapes.length * 4,
		ms: 1,
		threshold,
		autoThreshold,
		width,
		height,
		timings: { binarize: 0, trace: 0, shapes: 0 },
	};
}
fakeTrace.calls = [];

/**
 * @returns {Object} a closed Path through the four corners, counterclockwise in font units
 */
export function box(x0, y0, x1, y1, name = 'Box') {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name,
		pathPoints: [corner(x0, y0), corner(x1, y0), corner(x1, y1), corner(x0, y1)],
	});
}
