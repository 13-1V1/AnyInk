// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for the B9 photo-flow fix pass (not shipped): a small page drawn in pixels, for
	the cases the photo fixtures don't hold exactly (a punch hole as black as the pen, a short
	dark bit of a ruled line, two letters touching where a box cuts one of them, a letter written
	far too big). Hard edges, no noise: the shapes are what the parts finder and the flow see.

	  makePage(width, height)  -> { data, width, height, file(name), bar, disk, ring }
	    bar(x0, y0, x1, y1)        fills the pixels x0 <= x < x1, y0 <= y < y1
	    disk(cx, cy, r)            fills the pixels within r of (cx, cy)
	    ring(cx, cy, r, thick)     fills r - thick < distance <= r
	    file(name)                 a File of this page for addPhotoFile with flow_fakes.js
	                               fakeDecoder (the decoder looks pages up by file name); its
	                               bytes differ per name, so each page is its own photo
	  PAPER, PEN                   the paper's and the pen's colors
*/

export const PAPER = [244, 243, 238];
export const PEN = [24, 24, 28];

/**
 * @param {Number} width
 * @param {Number} height
 * @returns {Object} the page (see the header)
 */
export function makePage(width, height) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) data.set([...PAPER, 255], i * 4);
	const page = { data, width, height };
	const ink = (x, y, color = PEN) => {
		if (x < 0 || y < 0 || x >= width || y >= height) return;
		data.set([...color, 255], (y * width + x) * 4);
	};
	page.bar = (x0, y0, x1, y1, color) => {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) ink(x, y, color);
		return page;
	};
	page.disk = (cx, cy, r, color) => {
		for (let y = Math.floor(cy - r); y <= cy + r; y++) {
			for (let x = Math.floor(cx - r); x <= cx + r; x++) {
				if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) ink(x, y, color);
			}
		}
		return page;
	};
	page.ring = (cx, cy, r, thick, color) => {
		for (let y = Math.floor(cy - r); y <= cy + r; y++) {
			for (let x = Math.floor(cx - r); x <= cx + r; x++) {
				const d = Math.hypot(x - cx, y - cy);
				if (d <= r && d > r - thick) ink(x, y, color);
			}
		}
		return page;
	};
	page.file = (name) =>
		new File([new TextEncoder().encode(`synthetic page ${name}`)], name, { type: 'image/png' });
	return page;
}
