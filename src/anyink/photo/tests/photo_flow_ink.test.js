// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow fix pass: which ink in a part is the letter's (photo_flow_ink.js), on masks drawn
// here and on the first-timer's notebook photo's own numbers (a 12-pixel felt-tip).
import { describe, expect, it } from 'vitest';
import {
	BLOB_SHARE,
	PEN_SHARE,
	THIN_SHARE,
	hasInk,
	inkThickness,
	isJunkPart,
	keepPenPieces,
	trimCutInk,
} from '../photo_flow_ink.js';

const PEN = 12;

/** A width x height mask with the given rectangles [x0, y0, x1, y1] and disks [cx, cy, r] set. */
function mask(width, height, { bars = [], disks = [], rings = [] } = {}) {
	const out = new Uint8Array(width * height);
	for (const [x0, y0, x1, y1] of bars) {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y * width + x] = 1;
	}
	for (const [cx, cy, r] of disks) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++)
				if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) out[y * width + x] = 1;
		}
	}
	for (const [cx, cy, r, t] of rings) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const d = Math.hypot(x - cx, y - cy);
				if (d <= r && d > r - t) out[y * width + x] = 1;
			}
		}
	}
	return out;
}

/** The part of a whole-photo mask inside a box: { left, top, right, bottom, mask }. */
function cut(photo, width, box) {
	const w = box.right - box.left;
	const h = box.bottom - box.top;
	const m = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) m[y * w + x] = photo[(y + box.top) * width + x + box.left];
	}
	return { ...box, mask: m };
}

/** The leftmost and rightmost columns with ink. */
function span(m, w) {
	let left = Infinity;
	let right = -Infinity;
	for (let i = 0; i < m.length; i++) {
		if (!m[i]) continue;
		left = Math.min(left, i % w);
		right = Math.max(right, i % w);
	}
	return [left, right];
}

describe('how thick a piece is, against the pen', () => {
	it('a pen stroke reads one pen thick, a dot of the pen one pen across, a ruled line a quarter', () => {
		const m = mask(200, 100, {
			bars: [
				[10, 10, 22, 90],
				[40, 50, 160, 53],
			],
			disks: [[180, 30, 6]],
		});
		const { labels, thickness } = inkThickness(m, 200, 100);
		const at = (x, y) => thickness[labels[y * 200 + x]];
		// (a stroke an even number of pixels wide reads one less: it has no middle pixel)
		expect(at(15, 50)).toBeGreaterThanOrEqual(11);
		expect(at(15, 50)).toBeLessThanOrEqual(12);
		expect(at(100, 51)).toBe(3);
		expect(at(180, 30)).toBeGreaterThanOrEqual(11);
	});

	it('the rules: under half a pen is no pen; over 2.5 pens and mostly deep is a blob', () => {
		expect([THIN_SHARE, BLOB_SHARE, PEN_SHARE]).toEqual([0.5, 2.5, 0.75]);
		// A stem, a short dark bit of ruled line, a punch hole as black as the pen
		const m = mask(300, 120, {
			bars: [
				[10, 10, 22, 110],
				[60, 60, 76, 63],
			],
			disks: [[200, 60, 22]],
		});
		const kept = keepPenPieces(m, 300, 120, { stroke: PEN });
		expect(kept).toMatchObject({ thin: 1, blob: 1 });
		expect(kept.mask[50 * 300 + 15]).toBe(1);
		expect(kept.mask[61 * 300 + 65]).toBe(0);
		expect(kept.mask[60 * 300 + 200]).toBe(0);
		// Without a pen nothing is judged
		expect(keepPenPieces(m, 300, 120)).toMatchObject({ thin: 0, blob: 0 });
	});

	it('a letter a smudge touches keeps its pen share, so it never goes with the smudge', () => {
		// An o of the pen with a 3-pen smudge on its side, as one piece
		const m = mask(200, 200, { rings: [[80, 100, 50, 12]], disks: [[140, 100, 18]] });
		const { count, thickness, penShare } = inkThickness(m, 200, 200, { stroke: PEN });
		expect(count).toBe(1);
		expect(thickness[1]).toBeGreaterThan(BLOB_SHARE * PEN);
		expect(penShare[1]).toBeGreaterThan(PEN_SHARE);
		expect(hasInk(keepPenPieces(m, 200, 200, { stroke: PEN }).mask)).toBe(true);
	});

	it('isJunkPart: a part of ruled-line bits, a punch hole; never a letter or a dot', () => {
		const part = (m, w, h) => ({ left: 0, top: 0, right: w, bottom: h, mask: m });
		expect(
			isJunkPart(
				part(
					mask(100, 20, {
						bars: [
							[0, 5, 40, 8],
							[50, 6, 90, 9],
						],
					}),
					100,
					20
				),
				PEN
			)
		).toBe(true);
		expect(isJunkPart(part(mask(50, 50, { disks: [[25, 25, 22]] }), 50, 50), PEN)).toBe(true);
		expect(isJunkPart(part(mask(20, 100, { bars: [[4, 0, 16, 100]] }), 20, 100), PEN)).toBe(false);
		expect(isJunkPart(part(mask(14, 14, { disks: [[7, 7, 6]] }), 14, 14), PEN)).toBe(false);
		// Without the pen nothing is junk
		expect(isJunkPart(part(mask(50, 50, { disks: [[25, 25, 22]] }), 50, 50), 0)).toBe(false);
	});
});

describe("trimCutInk: a box he drew without the neighbor's cut end", () => {
	// An n (legs 300..312 and 350..362, its arch on top) touching an a (a ring 360..432), and an
	// o by itself (a ring 484..556)
	const W = 600;
	const H = 400;
	const photo = mask(W, H, {
		bars: [
			[300, 180, 312, 270],
			[350, 180, 362, 270],
			[300, 180, 362, 192],
		],
		rings: [
			[396, 230, 36, 12],
			[520, 230, 36, 12],
		],
	});

	it("the n's leg the box cut goes; the a keeps its own ink", () => {
		const part = cut(photo, W, { left: 354, top: 180, right: 433, bottom: 270 });
		expect(span(part.mask, 79)[0]).toBe(0);
		const trimmed = trimCutInk(part, photo, W, H, { stroke: PEN });
		const [left, right] = span(trimmed, 79);
		// The a starts at x 360 (6 in the box); the leg's sliver (354..359) is gone
		expect(left).toBeGreaterThanOrEqual(6);
		expect(left).toBeLessThanOrEqual(9);
		expect(right).toBe(78);
		// Most of the a is still there
		const before = part.mask.reduce((a, b) => a + b, 0);
		const after = trimmed.reduce((a, b) => a + b, 0);
		expect(after).toBeGreaterThan(0.75 * (before - 6 * 90));
	});

	it('a letter he only clipped keeps everything inside the box', () => {
		// The box cuts 3 pixels off the o's right side: the o is mostly inside, so it stays
		const part = cut(photo, W, { left: 484, top: 194, right: 553, bottom: 267 });
		const trimmed = trimCutInk(part, photo, W, H, { stroke: PEN });
		expect(Array.from(trimmed)).toEqual(Array.from(part.mask));
	});

	it("a neighbor's hook reaching deep into the box goes, the far end with it", () => {
		// A V-like stem, and W's stroke coming in from the right edge and bending down
		const page = mask(W, H, {
			bars: [
				[100, 100, 112, 220],
				[150, 150, 260, 162],
				[150, 150, 162, 200],
				[258, 100, 270, 220],
			],
		});
		const part = cut(page, W, { left: 95, top: 95, right: 200, bottom: 225 });
		const trimmed = trimCutInk(part, page, W, H, { stroke: PEN });
		const [left, right] = span(trimmed, 105);
		expect([left, right]).toEqual([5, 16]);
	});

	it('nothing cut: the mask comes back as it was (a copy)', () => {
		const part = cut(photo, W, { left: 295, top: 175, right: 440, bottom: 275 });
		const trimmed = trimCutInk(part, photo, W, H, { stroke: PEN });
		expect(trimmed).not.toBe(part.mask);
		expect(Array.from(trimmed)).toEqual(Array.from(part.mask));
	});
});
