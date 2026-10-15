// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 + B9 finalize: the second hostile pass on which ink in a part is the letter's
// (photo_flow_ink.js), each case as it happened in Chrome.
// - trimCutInk dropped his own stroke when the box edge ran a few pixels into it beside a
//   touching neighbor: the m lost its first stem (notebook photo, box edge 486 / 488) and the
//   n its right leg (first-try photo, box edge 1095). The a's box (1090, 1100) must stay clean.
// - the blob rule threw away bold dots: a heavy period was skipped as junk and could not be
//   traced, and an i and a j lost their dots.
// Written to fail on the code before the finalize pass (the rules missing).
import { describe, expect, it } from 'vitest';
import { findInk, partFromBox, photoInk } from '../ink_parts.js';
import { isJunkPart, keepPenPieces, trimCutInk } from '../photo_flow_ink.js';
import { loadPhotoFixture } from './fixture_image.js';

/** The photo's ink and pen, as the flow reads them (record.find of these phone photos). */
async function photo(name) {
	const { image } = await loadPhotoFixture(name);
	const { mask } = photoInk(image, { paper: 'photo' });
	const { stroke } = findInk(mask, image.width, image.height);
	return { image, mask, stroke };
}

/** The trimmed ink of a box he drew: its extent in photo pixels and its left / right columns. */
function trimmedBox({ image, mask, stroke }, [left, top, right, bottom]) {
	const part = partFromBox(mask, image.width, image.height, { left, top, right, bottom });
	const trimmed = trimCutInk(part, mask, image.width, image.height, { stroke });
	const w = part.right - part.left;
	const h = part.bottom - part.top;
	const out = { left: Infinity, right: -Infinity, bottom: -Infinity, column: [] };
	for (let x = 0; x < w; x++) {
		let count = 0;
		for (let y = 0; y < h; y++) {
			if (!trimmed[y * w + x]) continue;
			count++;
			out.left = Math.min(out.left, part.left + x);
			out.right = Math.max(out.right, part.left + x + 1);
			out.bottom = Math.max(out.bottom, part.top + y + 1);
		}
		out.column.push(count);
	}
	out.part = part;
	return out;
}

describe("trimCutInk keeps his own stroke the box edge clipped (the m's stem, the n's leg)", () => {
	it('notebook: an m box with its left edge 1 to 3 pixels into the first stem keeps that stem', async () => {
		const page = await photo('notebook-alphabet-phone');
		for (const edge of [486, 488]) {
			const m = trimmedBox(page, [edge, 1190, 580, 1310]);
			// the stem: about 90 pixels of ink in each of the box's first columns
			expect(m.left, `edge ${edge}`).toBe(edge);
			expect(Math.min(...m.column.slice(0, 3)), `edge ${edge}`).toBeGreaterThan(80);
		}
	});

	it("first-try: an n box with its right edge on the n's right leg keeps the leg to its foot", async () => {
		const page = await photo('first-try-phone');
		for (const edge of [1092, 1095]) {
			const n = trimmedBox(page, [986, 261, edge, 427]);
			expect(n.right, `edge ${edge}`).toBe(edge);
			expect(n.bottom, `edge ${edge}`).toBeGreaterThanOrEqual(420);
			expect(Math.min(...n.column.slice(-3)), `edge ${edge}`).toBeGreaterThan(100);
		}
	});

	it("the a's box still leaves out the n's leg it cuts, and a wide n box the a's side", async () => {
		const page = await photo('first-try-phone');
		for (const edge of [1090, 1095, 1100]) {
			expect(trimmedBox(page, [edge, 280, 1230, 435]).left, `edge ${edge}`).toBeGreaterThanOrEqual(
				1100
			);
		}
		expect(trimmedBox(page, [980, 250, 1110, 440]).right).toBeLessThanOrEqual(1101);
	});
});

/** A width x height mask with these disks [cx, cy, r] and bars [x0, y0, x1, y1]. */
function mask(width, height, { disks = [], bars = [] }) {
	const out = new Uint8Array(width * height);
	for (const [cx, cy, r] of disks) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++)
				if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) out[y * width + x] = 1;
		}
	}
	for (const [x0, y0, x1, y1] of bars) {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y * width + x] = 1;
	}
	return out;
}

describe("a bold dot is the pen's ink (a heavy period, the dots of i and j)", () => {
	const PEN = 14;
	const part = (m, w, h) => ({ left: 0, top: 0, right: w, bottom: h, mask: m });

	it('a period 39 px across (2.8 pens) is a letter part, not junk', () => {
		const dot = mask(60, 60, { disks: [[30, 30, 19.5]] });
		expect(isJunkPart(part(dot, 60, 60), PEN)).toBe(false);
		expect(keepPenPieces(dot, 60, 60, { stroke: PEN }).blob).toBe(0);
	});

	it('an i and a j keep a dot 42 px across (3 pens) above their stems', () => {
		const i = mask(60, 160, { disks: [[30, 22, 21]], bars: [[23, 60, 37, 160]] });
		const kept = keepPenPieces(i, 60, 160, { stroke: PEN });
		expect(kept.blob).toBe(0);
		expect(kept.mask[22 * 60 + 30]).toBe(1);
	});

	it('a punch hole as black as the pen (4 pens) and a scribble are still no letter', () => {
		expect(isJunkPart(part(mask(70, 70, { disks: [[35, 35, 28]] }), 70, 70), PEN)).toBe(true);
		// a scribbled-out blob: a lumpy square, not round
		const scribble = mask(80, 50, { bars: [[0, 0, 80, 50]] });
		expect(isJunkPart(part(scribble, 80, 50), PEN)).toBe(true);
	});
});
