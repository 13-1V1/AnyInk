// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core fix (the B8 + B9 first-timer walk): only the pen's ink makes parts. On his phone
// photos a finger smudge joined the e's part (the traced e floated over the writing line), and a
// hand's shadow, punch holes, a notebook's red margin line and blue ruled lines each became a
// part with the green box, counted as letters. These photos are drawn here pixel by pixel (warm
// paper, felt-tip letters with a camera's soft edge, then the trouble on top), binarized the way
// the parts finder does (photoInk's own binarize, Photo mode), and letterInk must keep the
// letters and nothing else. Written before letter_ink.js existed (failed on the missing module).
import { describe, expect, it } from 'vitest';
import { binarize, labelPieces } from '../../autotrace/binarize.js';
import { arc, rasterize } from '../../placement/tests/raster.js';
import { LETTER_STROKES } from '../../placement/tests/letters.js';
import {
	COLOR_SHARE,
	CORE_SHARE,
	EDGE_DARK_SHARE,
	EDGE_SPAN_SHARE,
	FAINT_SHARE,
	THIN_LENGTH,
	THIN_SHARE,
	letterInk,
} from '../letter_ink.js';

const PAPER = [244, 238, 222];
const BLACK = [30, 29, 34];

/** A photo of warm paper. */
function sheet(width, height, paper = PAPER) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = paper[0];
		data[i * 4 + 1] = paper[1];
		data[i * 4 + 2] = paper[2];
		data[i * 4 + 3] = 255;
	}
	return { data, width, height };
}

/** Lays ink of one color where the mask says (opacity 0..1). */
function ink(image, mask, color, opacity = 0.97) {
	for (let i = 0; i < mask.length; i++) {
		if (!mask[i]) continue;
		for (let c = 0; c < 3; c++) {
			const at = i * 4 + c;
			image.data[at] = image.data[at] * (1 - opacity) + color[c] * opacity;
		}
	}
	return image;
}

/** Darkens the photo by `amount` (0..1) where shade(x, y) is 1, smoothly. */
function darken(image, shade, amount) {
	const { width, height, data } = image;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const f = shade(x, y);
			if (!(f > 0)) continue;
			for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] *= 1 - amount * f;
		}
	}
	return image;
}

/** A camera's soft edge: a 3 x 3 box blur. */
function soften(image) {
	const { width, height, data } = image;
	const out = new Uint8ClampedArray(data);
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			for (let c = 0; c < 3; c++) {
				let sum = 0;
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) sum += data[((y + dy) * width + x + dx) * 4 + c];
				}
				out[(y * width + x) * 4 + c] = sum / 9;
			}
		}
	}
	image.data.set(out);
	return image;
}

/** Strokes of letters written in a row (cap units, see placement/tests/letters.js). */
function row(chars, { x0 = 160, base = 330, unit = 1.6, step = 120 } = {}) {
	const strokes = [];
	const boxes = [];
	[...chars].forEach((char, i) => {
		const left = x0 + i * step;
		const own = LETTER_STROKES[char]({}).map((stroke) =>
			stroke.map(([x, y]) => [left + x * unit, base + y * unit])
		);
		strokes.push(...own);
		const xs = own.flat().map((p) => p[0]);
		const ys = own.flat().map((p) => p[1]);
		boxes.push({
			char,
			left: Math.min(...xs),
			right: Math.max(...xs),
			top: Math.min(...ys),
			bottom: Math.max(...ys),
		});
	});
	return { strokes, boxes };
}

/** The photo's ink as the parts finder binarizes it (Photo mode, automatic cutoff, specks off). */
const photoMask = (image, lightInk = false) =>
	binarize(image, { mode: 'photo', threshold: 'auto', despeckle: true, invert: lightInk }).mask;

/** The pieces of a mask with their boxes (right and bottom exclusive) and their labels. */
function piecesOf(mask, width, height) {
	const { labels, count } = labelPieces(mask, width, height, 1);
	const boxes = Array.from({ length: count + 1 }, () => ({
		left: width,
		top: height,
		right: 0,
		bottom: 0,
		area: 0,
	}));
	for (let i = 0; i < labels.length; i++) {
		if (!labels[i]) continue;
		const b = boxes[labels[i]];
		const x = i % width;
		const y = (i - x) / width;
		b.left = Math.min(b.left, x);
		b.top = Math.min(b.top, y);
		b.right = Math.max(b.right, x + 1);
		b.bottom = Math.max(b.bottom, y + 1);
		b.area++;
	}
	const list = boxes.slice(1);
	/** The piece holding the ink nearest (x, y), within 3 px; null on paper. */
	list.at = (x, y) => {
		for (let r = 0; r <= 3; r++) {
			for (let dy = -r; dy <= r; dy++) {
				for (let dx = -r; dx <= r; dx++) {
					const label = labels[(y + dy) * width + x + dx];
					if (label) return boxes[label];
				}
			}
		}
		return null;
	};
	return list;
}

/** The pieces bigger than a speck. */
const bigPieces = (mask, width, height) => piecesOf(mask, width, height).filter((p) => p.area > 30);

/** Each piece lies inside one letter's box grown by `grow` (the pen and its soft edge). */
function eachInsideALetter(pieces, boxes, grow) {
	return pieces.every((p) =>
		boxes.some(
			(b) =>
				p.left >= b.left - grow &&
				p.right <= b.right + grow &&
				p.top >= b.top - grow &&
				p.bottom <= b.bottom + grow
		)
	);
}

const inkAt = (mask, width, x, y, r = 2) => {
	for (let dy = -r; dy <= r; dy++) {
		for (let dx = -r; dx <= r; dx++) if (mask[(y + dy) * width + x + dx]) return true;
	}
	return false;
};

const W = 1100;
const H = 620;

/** "nHaxe" in black felt-tip, the pen 9 px, a camera's soft edge. */
function lettersPhoto({ color = BLACK, opacity = 0.97 } = {}) {
	const letters = row('nHaxe');
	const image = ink(sheet(W, H), rasterize(W, H, letters.strokes, 9), color, opacity);
	return { image, letters };
}

describe('letterInk: only the pen ink stays', () => {
	it('the rules as named (the share of the page ink a pixel and a piece must reach, and the rest)', () => {
		expect(CORE_SHARE).toBe(0.6);
		expect(FAINT_SHARE).toBe(0.6);
		expect(COLOR_SHARE).toBeGreaterThan(0.1);
		expect(COLOR_SHARE).toBeLessThan(0.25);
		expect(THIN_SHARE).toBe(0.5);
		expect(THIN_LENGTH).toBe(8);
		expect(EDGE_SPAN_SHARE).toBe(0.5);
		expect(EDGE_DARK_SHARE).toBe(0.8);
	});

	it('clean letters come back as binarize found them, at most a soft edge pixel less', () => {
		const { image } = lettersPhoto();
		soften(image);
		const mask = photoMask(image);
		const out = letterInk(image, mask);
		expect(out.junk).toEqual([]);
		expect(out.darkness).toBeGreaterThan(0.75);
		expect(out.stroke).toBeGreaterThan(7);
		expect(out.stroke).toBeLessThan(13);
		let same = 0;
		let total = 0;
		for (let i = 0; i < mask.length; i++) {
			total += mask[i];
			same += mask[i] & out.mask[i];
		}
		// at most the soft edge's last pixel goes
		expect(same / total).toBeGreaterThan(0.93);
		expect(out.mask).not.toBe(mask);
	});

	it('a gray finger smudge under a letter is cut off it: the letter ends where its own ink does', () => {
		const { image, letters } = lettersPhoto();
		const e = letters.boxes[4];
		// a smear a third darker at its middle, over the e's foot
		const cx = Math.round((e.left + e.right) / 2 + 10);
		const cy = Math.round(e.bottom + 10);
		darken(image, (x, y) => Math.max(0, 1 - Math.hypot((x - cx) / 60, (y - cy) / 30)) ** 0.8, 0.32);
		soften(image);
		const mask = photoMask(image);
		// binarize marks the smudge, joined to the e
		expect(inkAt(mask, W, cx, cy)).toBe(true);
		const eInk = [Math.round(e.left), Math.round((e.top + e.bottom) / 2)];
		expect(piecesOf(mask, W, H).at(...eInk).bottom).toBeGreaterThan(e.bottom + 20);

		const out = letterInk(image, mask);
		expect(inkAt(out.mask, W, cx, cy)).toBe(false);
		const pieces = piecesOf(out.mask, W, H);
		expect(pieces.at(...eInk).bottom).toBeLessThanOrEqual(e.bottom + 4.5 + 3);
		expect(eachInsideALetter(bigPieces(out.mask, W, H), letters.boxes, 4.5 + 3)).toBe(true);
	});

	it("a hand's shadow reaching the photo's bottom edge is not ink", () => {
		const { image } = lettersPhoto();
		// a soft-edged shadow over the bottom left corner, half as bright
		darken(image, (x, y) => Math.max(0, Math.min(1, (y - 440 - 0.35 * x) / 30)), 0.5);
		soften(image);
		const mask = photoMask(image);
		expect(piecesOf(mask, W, H).some((p) => p.bottom === H && p.area > 200)).toBe(true);
		const out = letterInk(image, mask);
		expect(bigPieces(out.mask, W, H)).toHaveLength(5);
		expect(piecesOf(out.mask, W, H).some((p) => p.bottom === H)).toBe(false);
	});

	it('punch holes (brown discs) are not ink', () => {
		const { image } = lettersPhoto();
		const holes = [
			[60, 120],
			[60, 500],
		];
		const disc = rasterize(
			W,
			H,
			holes.map(([x, y]) => arc(x, y, 9, 9)),
			28
		);
		ink(image, disc, [112, 86, 60], 1);
		soften(image);
		const mask = photoMask(image);
		for (const [x, y] of holes) expect(inkAt(mask, W, x, y)).toBe(true);
		const out = letterInk(image, mask);
		for (const [x, y] of holes) expect(inkAt(out.mask, W, x, y, 6)).toBe(false);
		expect(out.junk.filter((j) => j.why === 'colored')).toHaveLength(2);
		expect(bigPieces(out.mask, W, H)).toHaveLength(5);
	});

	it("a notebook's red margin line and blue ruled lines are not ink, even across a letter", () => {
		const { image, letters } = lettersPhoto();
		const lines = [];
		// ruled lines every 60 px, one through the middle of the letters, one on the writing line
		for (let y = 90; y < H; y += 60)
			lines.push([
				[0, y],
				[W, y],
			]);
		ink(image, rasterize(W, H, lines, 3), [120, 160, 215], 0.8);
		// the margin line, 3 px, just left of the n
		ink(
			image,
			rasterize(
				W,
				H,
				[
					[
						[130, 0],
						[130, H],
					],
				],
				3
			),
			[215, 95, 105],
			0.95
		);
		soften(image);
		const mask = photoMask(image);
		expect(inkAt(mask, W, 130, 20)).toBe(true);
		const out = letterInk(image, mask);
		expect(inkAt(out.mask, W, 130, 20, 1)).toBe(false);
		expect(inkAt(out.mask, W, 1000, 90, 1)).toBe(false);
		const pieces = bigPieces(out.mask, W, H);
		expect(pieces).toHaveLength(5);
		// no letter carries a line with it
		expect(eachInsideALetter(pieces, letters.boxes, 4.5 + 3)).toBe(true);
	});

	it('blue ballpoint letters stay: the color rule is against the page ink, not black', () => {
		const { image } = lettersPhoto({ color: [40, 70, 170] });
		soften(image);
		const mask = photoMask(image);
		const out = letterInk(image, mask);
		expect(out.junk).toEqual([]);
		expect(bigPieces(out.mask, W, H)).toHaveLength(5);
	});

	it('pencil-gray letters on their own stay: faint is against the page ink', () => {
		const { image } = lettersPhoto({ color: [150, 150, 150], opacity: 0.9 });
		soften(image);
		const out = letterInk(image, photoMask(image));
		expect(out.junk).toEqual([]);
		expect(bigPieces(out.mask, W, H)).toHaveLength(5);
	});

	it('an i dot and a period stay, however small', () => {
		const strokes = [
			...row('nx').strokes,
			[
				[480, 330 - 60 * 1.6],
				[480, 330],
			],
			arc(480, 330 - 82 * 1.6, 1, 1),
			arc(560, 326, 1, 1),
		];
		const image = soften(ink(sheet(W, H), rasterize(W, H, strokes, 9), BLACK));
		const out = letterInk(image, photoMask(image));
		expect(out.junk).toEqual([]);
		expect(inkAt(out.mask, W, 480, Math.round(330 - 82 * 1.6), 1)).toBe(true);
		expect(inkAt(out.mask, W, 560, 326, 1)).toBe(true);
	});

	it("a scrap of ink the photo's edge cuts is dropped; a whole letter touching the edge stays", () => {
		const letters = row('nHa');
		const H2 = 400;
		// the H runs off the top of the photo
		const strokes = [
			...letters.strokes.map((s) => s.map(([x, y]) => [x, y - 180])),
			// a scrap at the right edge: a corner of something written past the photo
			[
				[W - 14, 260],
				[W + 10, 268],
			],
		];
		const image = soften(ink(sheet(W, H2), rasterize(W, H2, strokes, 9), BLACK));
		const mask = photoMask(image);
		const out = letterInk(image, mask);
		const pieces = bigPieces(out.mask, W, H2);
		expect(pieces).toHaveLength(3);
		expect(pieces.some((p) => p.top === 0)).toBe(true);
		expect(out.junk.filter((j) => j.why === 'edge')).toHaveLength(1);
		expect(inkAt(out.mask, W, W - 5, 264)).toBe(false);
	});

	it('light ink on dark paper (white gel pen on black card) reads the same way', () => {
		const letters = row('nHaxe');
		const image = sheet(W, H, [26, 24, 30]);
		ink(image, rasterize(W, H, letters.strokes, 9), [235, 235, 232]);
		// a faint gray-white smudge under the e
		const e = letters.boxes[4];
		const cx = (e.left + e.right) / 2;
		const cy = e.bottom + 30;
		const smear = rasterize(W, H, [arc(cx, cy, 14, 8)], 30);
		ink(image, smear, [235, 235, 232], 0.25);
		soften(image);
		const mask = photoMask(image, true);
		const out = letterInk(image, mask, { lightInk: true });
		expect(inkAt(out.mask, W, Math.round(cx), Math.round(cy))).toBe(false);
		expect(bigPieces(out.mask, W, H)).toHaveLength(5);
	});

	it('blank paper, no mask, or a broken image: an empty answer, never a throw', () => {
		const blank = sheet(200, 100);
		expect(letterInk(blank, new Uint8Array(200 * 100)).mask.every((v) => v === 0)).toBe(true);
		expect(letterInk(blank, null).mask).toHaveLength(200 * 100);
		expect(letterInk({ data: new Uint8ClampedArray(0), width: 0, height: 0 }, null).junk).toEqual(
			[]
		);
		expect(() => letterInk(null, null)).not.toThrow();
	});
});

// B8 + B9 finalize (second hostile pass, IMG_6001 and IMG_6009 in Chrome): a letter written
// lighter broke into fragments (C kept a 10 x 7 bit), and a page written with two pens lost every
// letter of the second one as 'colored'. Written to fail on the code before the pass.
describe('letterInk: lighter letters and a second pen stay', () => {
	/** "HAnoe" in black, then "cxu" at about half the darkness, a camera's soft edge. */
	function lighterPhoto() {
		const letters = row('HAnoecxu', { step: 115 });
		const image = sheet(W + 100, H);
		const width = W + 100;
		const black = rasterize(width, H, letters.strokes.slice(0, countStrokes('HAnoe')), 9);
		const gray = rasterize(width, H, letters.strokes.slice(countStrokes('HAnoe')), 9);
		ink(image, black, BLACK);
		ink(image, gray, BLACK, 0.5);
		soften(image);
		return { image, letters, width };
	}
	const countStrokes = (chars) =>
		[...chars].reduce((sum, char) => sum + LETTER_STROKES[char]({}).length, 0);

	it('a letter written at half the darkness of the rest is one whole piece, not bits', () => {
		const { image, letters, width } = lighterPhoto();
		const mask = photoMask(image);
		const out = letterInk(image, mask);
		const pieces = bigPieces(out.mask, width, H);
		expect(pieces).toHaveLength(8);
		// each lighter letter keeps nearly all the ink binarize found round it
		const inkIn = (m, box) => {
			let count = 0;
			for (let y = Math.floor(box.top) - 6; y <= box.bottom + 6; y++) {
				for (let x = Math.floor(box.left) - 6; x <= box.right + 6; x++) count += m[y * width + x];
			}
			return count;
		};
		for (const box of letters.boxes.slice(5)) {
			expect(inkIn(out.mask, box) / inkIn(mask, box), box.char).toBeGreaterThan(0.85);
		}
	});

	it('capitals in black felt-tip and small letters in blue ballpoint: every letter stays', () => {
		const caps = row('HABY', { step: 140 });
		const small = row('naoeu', { x0: 160, base: 520, step: 120 });
		const image = sheet(W, H);
		ink(image, rasterize(W, H, caps.strokes, 11), BLACK);
		ink(image, rasterize(W, H, small.strokes, 9), [40, 70, 170]);
		// a red margin line and a brown punch hole still go
		ink(image, rasterize(W, H, [[[100, 0], [100, H]]], 3), [215, 95, 105], 0.95);
		ink(image, rasterize(W, H, [arc(50, 300, 9, 9)], 28), [112, 86, 60], 1);
		soften(image);
		const out = letterInk(image, photoMask(image));
		expect(bigPieces(out.mask, W, H)).toHaveLength(9);
		expect(inkAt(out.mask, W, 100, 30, 1)).toBe(false);
		expect(inkAt(out.mask, W, 50, 300, 6)).toBe(false);
		expect(out.junk.every((j) => j.left < 130)).toBe(true);
	});
});
