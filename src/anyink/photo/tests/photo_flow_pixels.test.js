// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow: the pixels a part is traced from (photo_flow_pixels.js): only the picked
// part's own ink, other letters reaching into its paper margin painted out with the paper's
// own color; and the HEIC sniff that catches an iPhone photo whatever it is named (7.7).
import { describe, expect, it } from 'vitest';
import { binarize, labelPieces } from '../../autotrace/binarize.js';
import {
	OTHER_INK_GROW_PX,
	isHeicBytes,
	isHeicFile,
	paperColor,
	partPixels,
} from '../photo_flow_pixels.js';

const PAPER = [236, 230, 222];
const INK = [24, 24, 30];

/** A width x height RGBA image of paper with dark rectangles [l, t, r, b) on it. */
function page(width, height, rects, { paper = PAPER, ink = INK } = {}) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) data.set([...paper, 255], i * 4);
	for (const [l, t, r, b] of rects) {
		for (let y = t; y < b; y++)
			for (let x = l; x < r; x++) data.set([...ink, 255], (y * width + x) * 4);
	}
	return { data, width, height };
}

/** The ink mask of an image: 1 where it is dark (or light, on dark paper). */
function maskOf(image, light = false) {
	const mask = new Uint8Array(image.width * image.height);
	for (let i = 0; i < mask.length; i++) {
		const g = image.data[i * 4];
		mask[i] = light ? (g > 128 ? 1 : 0) : g < 128 ? 1 : 0;
	}
	return mask;
}

/** A part's own mask cut from the photo's mask. */
function partOf(image, mask, box) {
	const [left, top, right, bottom] = box;
	const w = right - left;
	const own = new Uint8Array(w * (bottom - top));
	for (let y = top; y < bottom; y++)
		for (let x = left; x < right; x++) own[(y - top) * w + x - left] = mask[y * image.width + x];
	return { id: 'p1', left, top, right, bottom, mask: own };
}

function pixel(image, x, y) {
	return [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3)];
}

describe('isHeicBytes / isHeicFile: an iPhone photo, whatever its name says', () => {
	const box = (brand, compatible = []) => {
		const text = `\0\0\0\x18ftyp${brand}\0\0\0\0${compatible.join('')}`;
		return Uint8Array.from(text, (c) => c.charCodeAt(0));
	};

	it('knows the HEIC brands, and a HEIF whose other brands say HEIC', () => {
		expect(isHeicBytes(box('heic'))).toBe(true);
		expect(isHeicBytes(box('heix'))).toBe(true);
		expect(isHeicBytes(box('hevc'))).toBe(true);
		expect(isHeicBytes(box('mif1', ['miaf', 'heic']))).toBe(true);
	});

	it('a JPEG, an AVIF, a plain HEIF of something else, or too few bytes is not HEIC', () => {
		expect(isHeicBytes(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1))).toBe(
			false
		);
		expect(isHeicBytes(box('avif', ['mif1', 'miaf']))).toBe(false);
		expect(isHeicBytes(box('mif1', ['avif']))).toBe(false);
		expect(isHeicBytes(new Uint8Array(6))).toBe(false);
		expect(isHeicBytes(null)).toBe(false);
	});

	it('by its type or its name', () => {
		expect(isHeicFile({ name: 'IMG_0012.HEIC', type: '' })).toBe(true);
		expect(isHeicFile({ name: 'photo', type: 'image/heif' })).toBe(true);
		expect(isHeicFile({ name: 'IMG_0012.jpg', type: 'image/jpeg' })).toBe(false);
	});
});

describe('partPixels: only the picked part is traced', () => {
	// Two letters 6 px apart: the left one is the part
	const image = page(120, 60, [
		[20, 10, 50, 50],
		[56, 10, 90, 50],
	]);
	const mask = maskOf(image);
	const part = partOf(image, mask, [20, 10, 50, 50]);
	const region = { x: 10, y: 0, width: 70, height: 60 };

	it("paints the neighbor's ink with the paper's color; the part's own ink is untouched", () => {
		const out = partPixels(image, region, { inkMask: mask, part });
		expect(out.width).toBe(70);
		expect(out.height).toBe(60);
		// The part, at photo x 30 -> crop x 20
		expect(pixel(out, 20, 30)).toEqual(INK);
		// The neighbor, at photo x 60 -> crop x 50, and its edge at photo x 56 -> crop x 46
		expect(pixel(out, 50, 30)).toEqual(PAPER);
		expect(pixel(out, 46, 30)).toEqual(PAPER);
		// What is left to trace is one piece: the part
		const { mask: left } = binarize(out, { mode: 'scan' });
		expect(labelPieces(left, out.width, out.height, 1).count).toBe(1);
	});

	it('never paints over the part, even where the grown neighbor reaches it', () => {
		const out = partPixels(image, region, { inkMask: mask, part });
		// The part's right edge (photo x 49 -> crop x 39) sits 6 px from the neighbor
		expect(OTHER_INK_GROW_PX).toBeLessThan(6);
		expect(pixel(out, 39, 30)).toEqual(INK);
	});

	it('a box he drew round both keeps both (his box is the part)', () => {
		const both = partOf(image, mask, [20, 10, 90, 50]);
		const out = partPixels(
			image,
			{ x: 10, y: 0, width: 90, height: 60 },
			{ inkMask: mask, part: both }
		);
		expect(pixel(out, 50, 30)).toEqual(INK);
		const { mask: left } = binarize(out, { mode: 'scan' });
		expect(labelPieces(left, out.width, out.height, 1).count).toBe(2);
	});

	it('light ink on dark paper: the paint is the dark paper', () => {
		const dark = page(
			120,
			60,
			[
				[20, 10, 50, 50],
				[56, 10, 90, 50],
			],
			{
				paper: [20, 22, 26],
				ink: [240, 240, 240],
			}
		);
		const light = maskOf(dark, true);
		const out = partPixels(dark, region, {
			inkMask: light,
			part: partOf(dark, light, [20, 10, 50, 50]),
		});
		expect(pixel(out, 50, 30)).toEqual([20, 22, 26]);
		expect(pixel(out, 20, 30)).toEqual([240, 240, 240]);
	});

	it('the paper color is the middle color of what is not ink', () => {
		expect(paperColor(image, mask, region)).toEqual(PAPER);
	});

	it('no ink mask: the crop as it is', () => {
		const out = partPixels(image, region, { part });
		expect(pixel(out, 50, 30)).toEqual(INK);
	});

	it('a region outside the photo is clamped; nothing left is null', () => {
		expect(
			partPixels(image, { x: 100, y: 40, width: 50, height: 50 }, { inkMask: mask, part }).width
		).toBe(20);
		expect(
			partPixels(image, { x: 200, y: 0, width: 5, height: 5 }, { inkMask: mask, part })
		).toBeNull();
	});
});
