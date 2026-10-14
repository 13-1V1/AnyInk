// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for B3 placement: draws pen strokes into an ink mask (1 = ink), the way a
	felt-tip leaves a line of one width, and cuts a part out of a mask. Pixel (x, y) is ink when
	its center is within half the pen width of a stroke. Image pixels, y down.
*/

/**
 * @param {Number} width
 * @param {Number} height
 * @param {Array<Array<[Number, Number]>>} strokes - polylines in pixels
 * @param {Number} pen - pen width in pixels
 * @returns {Uint8Array} mask, row-major
 */
export function rasterize(width, height, strokes, pen) {
	const mask = new Uint8Array(width * height);
	const r = pen / 2;
	for (const stroke of strokes) {
		for (let i = 0; i < stroke.length; i++) {
			const a = stroke[i];
			const b = stroke[Math.min(i + 1, stroke.length - 1)];
			const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 1));
			const x1 = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0]) + r + 1));
			const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 1));
			const y1 = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1]) + r + 1));
			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					if (distanceToSegment(x + 0.5, y + 0.5, a, b) <= r) mask[y * width + x] = 1;
				}
			}
		}
	}
	return mask;
}

/**
 * Points along an ellipse arc (angles in radians, 0 = right, y down so PI / 2 = bottom).
 * @returns {Array<[Number, Number]>}
 */
export function arc(cx, cy, rx, ry, from = 0, to = Math.PI * 2, steps = 72) {
	const points = [];
	for (let i = 0; i <= steps; i++) {
		const t = from + ((to - from) * i) / steps;
		points.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
	}
	return points;
}

/**
 * The part made of every ink pixel of a mask, cut to its tight box.
 * @param {Uint8Array} mask
 * @param {Number} width
 * @param {Number} height
 * @param {String} id
 * @returns {{id: String, left: Number, top: Number, right: Number, bottom: Number,
 *   mask: Uint8Array}}
 */
export function partFromMask(mask, width, height, id = 'p1') {
	let left = width;
	let right = -1;
	let top = height;
	let bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y * width + x]) continue;
			if (x < left) left = x;
			if (x > right) right = x;
			if (y < top) top = y;
			if (y > bottom) bottom = y;
		}
	}
	const w = right - left + 1;
	const h = bottom - top + 1;
	const own = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) own[y * w + x] = mask[(y + top) * width + x + left];
	}
	return { id, left, top, right: right + 1, bottom: bottom + 1, mask: own };
}

/** Draws strokes and returns the part, in one go. */
export function drawPart(strokes, pen, { width = 400, height = 400, id = 'p1' } = {}) {
	return partFromMask(rasterize(width, height, strokes, pen), width, height, id);
}

/** A part that is only a box (no mask), for row and line tests. */
export function boxPart(id, left, top, right, bottom, extra = {}) {
	return { id, left, top, right, bottom, ...extra };
}

function distanceToSegment(px, py, a, b) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length2 = dx * dx + dy * dy;
	let t = length2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / length2 : 0;
	t = Math.max(0, Math.min(1, t));
	const x = a[0] + t * dx;
	const y = a[1] + t * dy;
	return Math.hypot(px - x, py - y);
}
