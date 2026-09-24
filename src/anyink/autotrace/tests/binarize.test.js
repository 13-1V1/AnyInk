// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8: auto-trace binarization (src/anyink/autotrace/binarize.js), on synthetic
// ImageData-like objects. Covers Rec. 601 gray with alpha on white, Otsu on bimodal images
// (the cut lands in the gap), the global threshold and invert, Bradley-Roth beating a global
// threshold under a strong left-to-right lighting gradient, despeckle (specks out, pinholes
// filled, a 3 px stroke and ink on the edge kept), crop / clamp / downscale math (one factor
// on both axes, alpha premultiplied, features land at p * factor), maskToImageData, and
// binarize() as a whole (auto vs manual threshold, light ink on dark paper, photo mode's
// Threshold shift, blank paper giving no ink), the photo-mode paper map that keeps
// strokes wider than the Bradley-Roth window solid, and (fix, 09/24/2026) the full-size
// pass matched to the preview: a despeckle kernel of any size, the blur to one preview
// pixel that keeps noise specks at the preview's count, and a given Otsu split.
// Finalize: the full-size pass that follows the preview (binarizeFollowingPreview): the
// same pieces as the preview at any shrink, thin lines and slits shown exactly when the
// preview shows them, and the paper evenness figure (paperSpread).
import { describe, expect, it } from 'vitest';
import {
	ADAPTIVE_T,
	autoSplit,
	binarize,
	binarizeFollowingPreview,
	labelPieces,
	despeckleSizeFor,
	clampRect,
	cropImageData,
	despeckle,
	downscaleImageData,
	estimatePaper,
	hasInk,
	PAPER_INK_SHARE,
	invertMask,
	maskToImageData,
	otsu,
	otsuThreshold,
	thresholdAdaptive,
	thresholdGlobal,
	toGray,
} from '../binarize.js';

// --------------------------------------------------------------
// Synthetic images
// --------------------------------------------------------------

/** ImageData-like from a gray(x, y) function (or RGBA via rgba(x, y) -> [r, g, b, a]). */
function makeImage(width, height, paint) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const v = paint(x, y);
			const [r, g, b, a] = Array.isArray(v) ? v : [v, v, v, 255];
			const p = (y * width + x) * 4;
			data[p] = r;
			data[p + 1] = g;
			data[p + 2] = b;
			data[p + 3] = a;
		}
	}
	return { data, width, height };
}

/** Deterministic noise in -amp..amp (a tiny LCG, so tests never flake). */
function noise(seed = 1) {
	let s = seed >>> 0;
	return (amp) => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return Math.round(((s / 2 ** 32) * 2 - 1) * amp);
	};
}

/** A mask from rows of '#' (ink) and '.' (paper). */
function maskFrom(rows) {
	const width = rows[0].length;
	const mask = new Uint8Array(width * rows.length);
	rows.forEach((row, y) => [...row].forEach((c, x) => (mask[y * width + x] = c === '#' ? 1 : 0)));
	return { mask, width, height: rows.length };
}

function count(mask) {
	let n = 0;
	for (const v of mask) n += v;
	return n;
}

/** Share of pixels where mask and truth disagree. */
function errorRate(mask, truth) {
	let wrong = 0;
	for (let i = 0; i < mask.length; i++) if (mask[i] !== truth[i]) wrong++;
	return wrong / mask.length;
}

// --------------------------------------------------------------
// Gray
// --------------------------------------------------------------

describe('toGray', () => {
	it('uses Rec. 601 luma weights', () => {
		const px = [
			[255, 0, 0, 255],
			[0, 255, 0, 255],
			[0, 0, 255, 255],
			[255, 255, 255, 255],
			[0, 0, 0, 255],
			[10, 200, 60, 255],
		];
		const gray = toGray(makeImage(px.length, 1, (x) => px[x]));
		expect([...gray]).toEqual([
			76,
			150,
			29,
			255,
			0,
			Math.round(0.299 * 10 + 0.587 * 200 + 0.114 * 60),
		]);
	});

	it('composites alpha on white paper', () => {
		const px = [
			[0, 0, 0, 0], // transparent: paper
			[0, 0, 0, 51], // 20 % black
			[100, 100, 100, 51],
			[255, 0, 0, 0], // a color with no alpha is still paper
		];
		const gray = toGray(makeImage(px.length, 1, (x) => px[x]));
		expect(gray[0]).toBe(255);
		expect(gray[1]).toBe(204); // 255 * 0.8
		expect(gray[2]).toBe(224); // 100 * 0.2 + 255 * 0.8
		expect(gray[3]).toBe(255);
	});
});

// --------------------------------------------------------------
// Otsu and the global threshold
// --------------------------------------------------------------

describe('otsuThreshold', () => {
	it('lands between the two modes of a bimodal image (middle of the gap)', () => {
		const rand = noise(7);
		const gray = toGray(makeImage(80, 60, (x) => (x < 40 ? 50 : 200) + rand(10)));
		const t = otsuThreshold(gray);
		expect(t).toBeGreaterThan(60);
		expect(t).toBeLessThanOrEqual(190);
		expect(Math.abs(t - 125)).toBeLessThanOrEqual(15);
		// And it separates them perfectly
		const mask = thresholdGlobal(gray, 80, 60, t);
		for (let y = 0; y < 60; y++) {
			for (let x = 0; x < 80; x++) expect(mask[y * 80 + x]).toBe(x < 40 ? 1 : 0);
		}
	});

	it('handles a little ink on a lot of paper', () => {
		const rand = noise(3);
		const gray = toGray(
			makeImage(100, 100, (x, y) => (x > 40 && x < 50 && y > 10 ? 30 : 230) + rand(8))
		);
		const t = otsuThreshold(gray);
		expect(t).toBeGreaterThan(38);
		expect(t).toBeLessThan(222);
	});

	it('gives 128 for a one-tone or empty image', () => {
		expect(otsuThreshold(new Uint8Array(100).fill(255))).toBe(128);
		expect(otsuThreshold(new Uint8Array(0))).toBe(128);
		expect(otsu(new Uint8Array(10).fill(40)).contrast).toBe(0);
	});
});

describe('thresholdGlobal and invertMask', () => {
	it('ink is strictly darker than the cutoff; invert swaps ink and paper', () => {
		const gray = Uint8Array.from([0, 10, 127, 128, 200, 255]);
		const mask = thresholdGlobal(gray, 6, 1, 128);
		expect([...mask]).toEqual([1, 1, 1, 0, 0, 0]);
		expect([...invertMask(mask)]).toEqual([0, 0, 0, 1, 1, 1]);
		expect([...mask]).toEqual([1, 1, 1, 0, 0, 0]); // input untouched
		expect([...thresholdGlobal(gray, 6, 1, 0)]).toEqual([0, 0, 0, 0, 0, 0]);
		expect([...thresholdGlobal(gray, 6, 1, 256)]).toEqual([1, 1, 1, 1, 1, 1]);
	});
});

// --------------------------------------------------------------
// Bradley-Roth
// --------------------------------------------------------------

describe('thresholdAdaptive (Bradley-Roth)', () => {
	// Paper runs from 250 on the left to 60 on the right (a phone photo lit from one
	// side). Ink strokes, 6 px wide every 30 px, are 60 % darker than the paper under them,
	// so ink on the left (100) is LIGHTER than paper on the right (60).
	const width = 300;
	const height = 90;
	const isInk = (x, y) => x % 30 >= 12 && x % 30 < 18 && y >= 15 && y < 75;
	const paper = (x) => 250 - (190 * x) / (width - 1);
	const photo = makeImage(width, height, (x, y) => Math.round(paper(x) * (isInk(x, y) ? 0.4 : 1)));
	const truth = new Uint8Array(width * height);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) truth[y * width + x] = isInk(x, y) ? 1 : 0;
	const gray = toGray(photo);

	it('a global threshold fails on the gradient', () => {
		const mask = thresholdGlobal(gray, width, height, otsuThreshold(gray));
		expect(errorRate(mask, truth)).toBeGreaterThan(0.15);
		// No single cutoff works: the best one still gets a lot wrong
		let best = 1;
		for (let t = 0; t <= 256; t += 4)
			best = Math.min(best, errorRate(thresholdGlobal(gray, width, height, t), truth));
		expect(best).toBeGreaterThan(0.05);
	});

	it('the adaptive threshold separates ink from paper everywhere', () => {
		const mask = thresholdAdaptive(gray, width, height);
		expect(errorRate(mask, truth)).toBeLessThan(0.005);
		// Both the light-side and the dark-side strokes are found
		expect(mask[45 * width + 14]).toBe(1);
		expect(mask[45 * width + 284]).toBe(1);
		expect(mask[45 * width + 5]).toBe(0);
		expect(mask[45 * width + 295]).toBe(0);
	});

	it('t sets how much darker than the local mean ink must be', () => {
		const loose = count(thresholdAdaptive(gray, width, height, { t: 0.05 }));
		const normal = count(thresholdAdaptive(gray, width, height, { t: ADAPTIVE_T }));
		const strict = count(thresholdAdaptive(gray, width, height, { t: 0.7 }));
		expect(loose).toBeGreaterThanOrEqual(normal);
		expect(strict).toBeLessThan(normal);
		expect(strict).toBe(0); // nothing is 70 % darker than its surroundings
	});

	it('finds nothing on evenly lit blank paper', () => {
		const rand = noise(11);
		const blank = toGray(makeImage(120, 80, () => 235 + rand(6)));
		expect(count(thresholdAdaptive(blank, 120, 80))).toBe(0);
	});
});

// --------------------------------------------------------------
// Despeckle
// --------------------------------------------------------------

describe('despeckle', () => {
	it('removes isolated 1 px specks', () => {
		const { mask, width, height } = maskFrom([
			'..........',
			'.#........',
			'..........',
			'.....#....',
			'..........',
			'........#.',
		]);
		expect(count(despeckle(mask, width, height))).toBe(0);
	});

	it('fills 1 px pinholes in solid ink', () => {
		const { mask, width, height } = maskFrom([
			'########',
			'########',
			'##.#####',
			'########',
			'#####.##',
			'########',
		]);
		expect(count(despeckle(mask, width, height))).toBe(width * height);
	});

	it('keeps a 3 px stroke exactly, and ink touching the image edge', () => {
		// Shapes 3 px apart: closer ones are bridged by the close step, which is its job
		const rows = [
			'###.............',
			'###.............',
			'###.............',
			'................',
			'................',
			'................',
			'.....##########.',
			'.....##########.',
			'.....##########.',
			'................',
			'................',
			'................',
			'..............##',
			'..............##',
			'..............##',
		];
		const { mask, width, height } = maskFrom(rows);
		const out = despeckle(mask, width, height);
		expect([...out]).toEqual([...mask]);
	});

	it('does not change its input', () => {
		const { mask, width, height } = maskFrom(['.#.', '...', '...']);
		despeckle(mask, width, height);
		expect(mask[1]).toBe(1);
	});
});

// --------------------------------------------------------------
// Crop, clamp, downscale, back to pixels
// --------------------------------------------------------------

describe('cropImageData and clampRect', () => {
	const image = makeImage(4, 3, (x, y) => y * 4 + x); // gray = pixel index

	it('copies just the rect', () => {
		const out = cropImageData(image, { x: 1, y: 1, width: 2, height: 2 });
		expect(out.width).toBe(2);
		expect(out.height).toBe(2);
		expect([...toGray(out)]).toEqual([5, 6, 9, 10]);
		expect(out.data).not.toBe(image.data);
	});

	it('clamps a rect hanging off the image, and rounds fractional edges outward', () => {
		expect(clampRect({ x: -2, y: 1, width: 4, height: 5 }, 4, 3)).toEqual({
			x: 0,
			y: 1,
			width: 2,
			height: 2,
		});
		expect(clampRect({ x: 0.5, y: 0.2, width: 1.2, height: 1 }, 4, 3)).toEqual({
			x: 0,
			y: 0,
			width: 2,
			height: 2,
		});
		expect(clampRect({ x: 10, y: 0, width: 5, height: 5 }, 4, 3)).toMatchObject({ width: 0 });
		const out = cropImageData(image, { x: -2, y: 1, width: 4, height: 5 });
		expect([...toGray(out)]).toEqual([4, 5, 8, 9]);
		expect(cropImageData(image, { x: 9, y: 9, width: 2, height: 2 })).toMatchObject({
			width: 0,
			height: 0,
		});
	});
});

describe('downscaleImageData', () => {
	it('returns the same image, factor 1, when it already fits', () => {
		const image = makeImage(10, 5, () => 0);
		const out = downscaleImageData(image, 10);
		expect(out.imageData).toBe(image);
		expect(out.factor).toBe(1);
		expect(downscaleImageData(image, 0).factor).toBe(1);
	});

	it('averages blocks by area, with alpha premultiplied', () => {
		const px = [
			[0, 0, 0, 255],
			[100, 100, 100, 255],
			[255, 0, 0, 0],
			[0, 0, 0, 255],
			[200, 200, 200, 255],
			[100, 100, 100, 255],
			[255, 0, 0, 0],
			[0, 0, 0, 255],
		];
		const image = makeImage(4, 2, (x, y) => px[y * 4 + x]);
		const { imageData, factor } = downscaleImageData(image, 2);
		expect(factor).toBe(0.5);
		expect([imageData.width, imageData.height]).toEqual([2, 1]);
		expect([...imageData.data.subarray(0, 4)]).toEqual([100, 100, 100, 255]);
		// Two transparent red pixels add no red: black at half alpha
		expect([...imageData.data.subarray(4, 8)]).toEqual([0, 0, 0, 128]);
	});

	it('uses one factor on both axes; a partial last pixel is part paper', () => {
		const image = makeImage(3, 2, () => 0);
		const { imageData, factor } = downscaleImageData(image, 2);
		expect(factor).toBeCloseTo(2 / 3, 12);
		expect([imageData.width, imageData.height]).toEqual([2, 2]);
		// Row 1 covers input rows 1.5 .. 3, of which only 1.5 .. 2 exists: a third of it
		expect(imageData.data[3]).toBe(255);
		expect(imageData.data[(1 * 2 + 0) * 4 + 3]).toBe(85);
		// Through toGray that partial row is light gray, not ink
		expect(toGray(imageData)[2]).toBe(170);
	});

	it('puts features at p * factor (placement math)', () => {
		// A black band at x 400..499 and y 200..299 of a 1000 x 600 white image
		const image = makeImage(1000, 600, (x, y) =>
			x >= 400 && x < 500 && y >= 200 && y < 300 ? 0 : 255
		);
		const { imageData, factor } = downscaleImageData(image, 100);
		expect(factor).toBe(0.1);
		expect([imageData.width, imageData.height]).toEqual([100, 60]);
		const gray = toGray(imageData);
		const at = (x, y) => gray[y * 100 + x];
		for (let x = 40; x < 50; x++) expect(at(x, 25)).toBe(0);
		for (let y = 20; y < 30; y++) expect(at(45, y)).toBe(0);
		expect(at(39, 25)).toBe(255);
		expect(at(50, 25)).toBe(255);
		expect(at(45, 19)).toBe(255);
		expect(at(45, 30)).toBe(255);
	});
});

describe('maskToImageData', () => {
	it('draws black ink on white paper, fully opaque', () => {
		const out = maskToImageData(Uint8Array.from([1, 0, 0, 1]), 2, 2);
		expect(out.width).toBe(2);
		expect(out.height).toBe(2);
		expect([...out.data]).toEqual([
			0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255,
		]);
		expect(out.data).toBeInstanceOf(Uint8ClampedArray);
	});
});

// --------------------------------------------------------------
// binarize()
// --------------------------------------------------------------

describe('binarize', () => {
	// A black ring (an 'O') on white paper with light noise
	const rand = noise(5);
	const ring = (x, y) => {
		const d = Math.hypot(x - 50, y - 50);
		return d >= 25 && d <= 40;
	};
	const scan = makeImage(100, 100, (x, y) => (ring(x, y) ? 25 : 235) + rand(6));

	it('scan, auto: Otsu finds the ring, and threshold reports the value used', () => {
		const out = binarize(scan, { despeckle: false });
		expect(out.width).toBe(100);
		expect(out.height).toBe(100);
		expect(out.threshold).toBe(out.autoThreshold);
		expect(out.autoThreshold).toBe(otsuThreshold(toGray(scan)));
		expect(out.mask[50 * 100 + 17]).toBe(1); // on the ring
		expect(out.mask[50 * 100 + 50]).toBe(0); // the counter stays open
		expect(out.mask[3]).toBe(0);
	});

	it('a manual threshold is used as given, and more threshold means more ink', () => {
		const none = binarize(scan, { threshold: 0 });
		const all = binarize(scan, { threshold: 255 });
		expect(none.threshold).toBe(0);
		expect(hasInk(none.mask)).toBe(false);
		expect(count(all.mask)).toBe(100 * 100);
	});

	it('light ink on dark paper: invert finds the same ring', () => {
		const negative = makeImage(100, 100, (x, y) => (ring(x, y) ? 230 : 20));
		const normal = binarize(negative, {});
		const inverted = binarize(negative, { invert: true });
		expect(normal.mask[50 * 100 + 17]).toBe(0);
		expect(inverted.mask[50 * 100 + 17]).toBe(1);
		expect(inverted.mask[50 * 100 + 50]).toBe(0);
		expect(inverted.mask[0]).toBe(0);
	});

	it('photo mode follows the light; Threshold shifts its local cutoff', () => {
		const width = 240;
		const height = 80;
		const isInk = (x, y) => x % 40 >= 16 && x % 40 < 24 && y >= 10 && y < 70;
		const lit = makeImage(width, height, (x, y) =>
			Math.round((245 - (180 * x) / width) * (isInk(x, y) ? 0.45 : 1))
		);
		const truth = new Uint8Array(width * height);
		for (let y = 0; y < height; y++)
			for (let x = 0; x < width; x++) truth[y * width + x] = isInk(x, y) ? 1 : 0;

		const photo = binarize(lit, { mode: 'photo' });
		const scanned = binarize(lit, { mode: 'scan' });
		expect(errorRate(photo.mask, truth)).toBeLessThan(0.01);
		expect(errorRate(scanned.mask, truth)).toBeGreaterThan(0.05);

		const lower = binarize(lit, {
			mode: 'photo',
			threshold: photo.autoThreshold - 60,
			despeckle: false,
		});
		const auto = binarize(lit, { mode: 'photo', despeckle: false });
		const higher = binarize(lit, {
			mode: 'photo',
			threshold: photo.autoThreshold + 60,
			despeckle: false,
		});
		expect(count(lower.mask)).toBeLessThanOrEqual(count(auto.mask));
		expect(count(higher.mask)).toBeGreaterThan(count(auto.mask));
	});

	it('blank paper with grain gives no ink in scan mode (no noise shapes)', () => {
		const grain = noise(9);
		const blank = makeImage(120, 90, () => 232 + grain(9));
		const out = binarize(blank, {});
		expect(hasInk(out.mask)).toBe(false);
		// ...but a crop inside one big blot is all ink
		const blot = makeImage(40, 40, () => 20 + grain(9));
		expect(count(binarize(blot, {}).mask)).toBe(40 * 40);
	});

	it('despeckle is on by default and can be turned off', () => {
		const dusty = makeImage(60, 60, (x, y) =>
			(x === 10 && y === 10) || (x >= 20 && x < 40 && y >= 20 && y < 40) ? 0 : 255
		);
		expect(binarize(dusty, {}).mask[10 * 60 + 10]).toBe(0);
		expect(binarize(dusty, { despeckle: false }).mask[10 * 60 + 10]).toBe(1);
		expect(binarize(dusty, {}).mask[30 * 60 + 30]).toBe(1);
	});
});

// --------------------------------------------------------------
// Photo mode and wide strokes
// --------------------------------------------------------------

describe('estimatePaper and wide strokes in photo mode', () => {
	// A marker 'O' filling the crop: a ring 200 px wide in a 600 px image, lit from the left.
	// Bradley-Roth's window (1/8 of 600 = 75 px) sits entirely inside the stroke.
	const size = 600;
	const inRing = (x, y) => {
		const d = Math.hypot(x - 300, y - 300);
		return d >= 90 && d <= 290;
	};
	const light = (x) => 240 - (120 * x) / size;
	const grain = noise(21);
	const photo = makeImage(
		size,
		size,
		(x, y) => Math.round(light(x) * (inRing(x, y) ? 0.3 : 1)) + grain(5)
	);
	const deepInStroke = [];
	for (let y = 0; y < size; y += 6) {
		for (let x = 0; x < size; x += 6) {
			const d = Math.hypot(x - 300, y - 300);
			if (d >= 100 && d <= 280) deepInStroke.push(y * size + x);
		}
	}
	const filled = (mask) => deepInStroke.filter((i) => mask[i]).length / deepInStroke.length;

	it('Bradley-Roth alone hollows the stroke out', () => {
		const gray = toGray(photo);
		expect(filled(thresholdAdaptive(gray, size, size))).toBeLessThan(0.7);
	});

	it('photo mode keeps it solid, with the counter and the paper clear', () => {
		const out = binarize(photo, { mode: 'photo' });
		expect(filled(out.mask)).toBeGreaterThan(0.99);
		expect(out.mask[300 * size + 300]).toBe(0); // the counter
		expect(out.mask[10 * size + 10]).toBe(0); // bright paper
		expect(out.mask[590 * size + 590]).toBe(0); // dim paper
	});

	it('the paper map follows the light and ignores the ink', () => {
		const paper = estimatePaper(toGray(photo), size, size);
		expect(paper.length).toBe(size * size);
		// In the middle of the stroke the map reads far above the ink, so the ink stays
		// under half of it (this stroke is 200 px, past the 150 px the radius is sized for)
		for (const [x, y] of [
			[110, 300],
			[300, 110],
			[490, 300],
			[300, 490],
		]) {
			const ink = light(x) * 0.3 + 5;
			expect(paper[y * size + x] * PAPER_INK_SHARE).toBeGreaterThan(ink * 1.1);
		}
		// It never reads far below the real paper on blank paper, left or right
		expect(Math.abs(paper[10 * size + 10] - light(10))).toBeLessThan(25);
		expect(paper[590 * size + 590]).toBeGreaterThan(light(590) - 10);
	});

	it('faint pencil on paper is still found (Bradley-Roth part)', () => {
		const pencil = makeImage(
			200,
			100,
			(x, y) => (x >= 90 && x < 96 && y > 20 && y < 80 ? 175 : 235) + grain(3)
		);
		const out = binarize(pencil, { mode: 'photo' });
		expect(out.mask[50 * 200 + 92]).toBe(1);
		expect(count(out.mask)).toBeLessThan(6 * 60 * 1.3);
	});

	it('handles an empty image', () => {
		expect(estimatePaper(new Uint8Array(0), 0, 0).length).toBe(0);
	});
});

// --------------------------------------------------------------
// Full size matched to the preview (fix, 09/24/2026)
// --------------------------------------------------------------

/** 4-connected ink blobs bigger than minArea pixels. */
function blobs(mask, width, height, minArea = 0) {
	const seen = new Uint8Array(width * height);
	const stack = new Int32Array(width * height);
	let found = 0;
	for (let i = 0; i < mask.length; i++) {
		if (seen[i] || !mask[i]) continue;
		let top = 0;
		let size = 0;
		stack[top++] = i;
		seen[i] = 1;
		while (top) {
			const j = stack[--top];
			size++;
			const x = j % width;
			for (const k of [x > 0 ? j - 1 : -1, x < width - 1 ? j + 1 : -1, j - width, j + width]) {
				if (k >= 0 && k < mask.length && !seen[k] && mask[k]) {
					seen[k] = 1;
					stack[top++] = k;
				}
			}
		}
		if (size > minArea) found++;
	}
	return found;
}

describe('despeckle with a bigger kernel', () => {
	/** Vertical ink bars of the given widths, 12 px apart, on a 64 px tall strip. */
	function bars(widths, gap = 12) {
		const width = widths.reduce((sum, w) => sum + w + gap, gap);
		const mask = new Uint8Array(width * 64);
		let x = gap;
		for (const w of widths) {
			for (let y = 8; y < 56; y++) mask.fill(1, y * width + x, y * width + x + w);
			x += w + gap;
		}
		return { mask, width, height: 64 };
	}

	it('size 6 drops ink narrower than 6 px and keeps 6 px ink exactly', () => {
		const { mask, width, height } = bars([5, 6]);
		const out = despeckle(mask, width, height, 6);
		const column = (x) => out[32 * width + x];
		expect(column(12 + 2)).toBe(0); // the 5 px bar is gone
		// The 6 px bar is untouched
		const six = 12 + 5 + 12;
		for (let x = six - 1; x <= six + 6; x++) {
			expect(column(x)).toBe(x >= six && x < six + 6 ? 1 : 0);
		}
	});

	it('size 6 fills gaps narrower than 6 px and leaves 6 px gaps open', () => {
		// Two solid blocks 5 px apart, then two 6 px apart
		const width = 80;
		const height = 40;
		const mask = new Uint8Array(width * height);
		const block = (x0, x1) => {
			for (let y = 5; y < 35; y++) mask.fill(1, y * width + x0, y * width + x1);
		};
		block(5, 20);
		block(25, 40); // gap 20..24: 5 px
		block(50, 65);
		block(71, 78); // gap 65..70: 6 px
		const out = despeckle(mask, width, height, 6);
		expect(out[20 * width + 22]).toBe(1);
		expect(out[20 * width + 67]).toBe(0);
	});

	it('size 3 is the old 3x3, and the default', () => {
		const { mask, width, height } = bars([2, 3, 4]);
		expect([...despeckle(mask, width, height, 3)]).toEqual([...despeckle(mask, width, height)]);
		expect(despeckleSizeFor(1)).toBe(3);
		expect(despeckleSizeFor(1.2)).toBe(3);
		expect(despeckleSizeFor(2)).toBe(5); // 2.5 preview pixels
		expect(despeckleSizeFor(2.4)).toBe(6);
		expect(despeckleSizeFor(4)).toBe(10);
		expect(despeckleSizeFor(0.5)).toBe(3);
	});
});

describe('binarize at full size, matched to the preview', () => {
	// A 'photo': an ink ring on paper lit from one corner, with strong sensor noise
	const W = 400;
	const H = 300;
	const gauss = (() => {
		let s = 11;
		const next = () => {
			s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
			return (s + 0.5) / 2 ** 32;
		};
		return () => Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next());
	})();
	const photo = makeImage(W, H, (x, y) => {
		const d = Math.hypot(x - 200, y - 150);
		const paper = 235 - 45 * (x / W) - 45 * (y / H);
		return Math.round((d > 50 && d < 90 ? 45 : paper) + 28 * gauss());
	});
	const options = { mode: 'photo', despeckle: false };

	it('blurred to one preview pixel, the full-size pass keeps about the specks the preview shows', () => {
		const { imageData: small, factor } = downscaleImageData(photo, W / 2);
		expect(factor).toBe(0.5);
		const preview = binarize(small, options);
		// What potrace keeps: the preview drops single pixels, the full size one preview pixel
		const shown = blobs(preview.mask, small.width, small.height, 1);
		const raw = blobs(binarize(photo, options).mask, W, H, 4);
		const matched = blobs(binarize(photo, options, { previewPixel: 2 }).mask, W, H, 4);
		expect(raw).toBeGreaterThan(4 * shown); // the speck explosion (189 against 25)
		expect(matched).toBeLessThanOrEqual(shown + 5); // 5
		// With Remove specks on, both are the one ring
		const cleanPreview = binarize(small, { mode: 'photo' });
		const cleanFull = binarize(photo, { mode: 'photo' }, { previewPixel: 2 });
		expect(blobs(cleanPreview.mask, small.width, small.height, 1)).toBe(1);
		expect(blobs(cleanFull.mask, W, H, 4)).toBe(1);
	});

	it('Remove specks sizes its kernel to the preview pixel: a 4 px line goes at half size', () => {
		const line = (w) =>
			makeImage(120, 80, (x, y) => (x >= 60 && x < 60 + w && y > 10 && y < 70 ? 10 : 240));
		expect(binarize(line(4), {}).mask[40 * 120 + 61]).toBe(1); // 3x3 keeps it
		// Its preview (half size) has a 2 px line, which the preview's 3x3 drops
		expect(binarize(line(4), {}, { previewPixel: 2 }).mask[40 * 120 + 61]).toBe(0);
		// 6 px is 3 preview pixels: kept at both sizes
		expect(binarize(line(6), {}, { previewPixel: 2 }).mask[40 * 120 + 62]).toBe(1);
	});

	it('uses a given Otsu split, so Auto is the value the preview showed', () => {
		const split = { threshold: 200, contrast: 150, mean: 180 };
		const out = binarize(photo, { mode: 'scan', despeckle: false }, { split });
		expect(out.autoThreshold).toBe(200);
		expect(out.threshold).toBe(200);
		const own = binarize(photo, { mode: 'scan', despeckle: false });
		expect(own.autoThreshold).not.toBe(200);
		expect(count(out.mask)).toBeGreaterThan(count(own.mask));
		// autoSplit is that split for an image (after Light ink on dark paper)
		expect(autoSplit(photo, {}).threshold).toBe(own.autoThreshold);
		const inverted = binarize(photo, { invert: true, despeckle: false });
		expect(autoSplit(photo, { invert: true }).threshold).toBe(inverted.autoThreshold);
	});
});

// --------------------------------------------------------------
// Finalize, 09/24/2026: the full-size pass follows the preview
// --------------------------------------------------------------

describe('binarizeFollowingPreview (finalize)', () => {
	/** A seeded 0..1 random stream, so the noise is the same on every run. */
	function seeded(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state * 1664525 + 1013904223) >>> 0;
			return state / 2 ** 32;
		};
	}
	/** Ink pieces bigger than `area` pixels (what potrace keeps at turdsize `area`). */
	function pieces(mask, width, height, area) {
		const ink = labelPieces(mask, width, height, 1);
		let n = 0;
		for (let id = 1; id <= ink.count; id++) if (ink.sizes[id] > area) n++;
		return n;
	}

	it("a noisy photo shrunk by 1.3 keeps exactly the preview's specks (the old rule kept several times more)", () => {
		const random = seeded(1316);
		// A bold bar on paper lit from 232 down to 178, with sensor noise
		const W = 1300;
		const H = 420;
		const photo = makeImage(W, H, (x, y) => {
			const ink = x > 300 && x < 520 && y > 60 && y < 360;
			const paper = 232 - (54 * (x + y)) / (W + H);
			return (ink ? 40 : paper) + (random() - 0.5) * 70;
		});
		const options = { mode: 'photo', detail: 1, despeckle: false };
		const { imageData: small, factor } = downscaleImageData(photo, 1000);
		const preview = binarize(small, options);
		const shown = pieces(preview.mask, small.width, small.height, 1);
		expect(shown).toBeGreaterThan(3);
		const full = binarizeFollowingPreview(photo, small, options, { factor, speckArea: 1 });
		expect(pieces(full.mask, W, H, 0)).toBe(shown);
		// The first fix (blur to one preview pixel) kept far more at this shrink
		const old = binarize(photo, options, { previewPixel: 1 / factor, split: preview.split });
		expect(pieces(old.mask, W, H, 1)).toBeGreaterThan(shown);
		// Threshold and the Auto value are the preview's
		expect(full.autoThreshold).toBe(preview.autoThreshold);
	});

	// Keep each image case within its own timeout on slower CI runners.
	it.each([
		[2000, 'line', 4],
		[2000, 'slit', 5],
		[2000, 'slit', 6],
		[1250, 'line', 3],
		[1250, 'slit', 3],
		[1333, 'line', 3],
	])('thin lines/slits match preview at 8 alignments: %i %s %i', (W, kind, width) => {
		let shownCount = 0;
		for (let offset = 0; offset < 8; offset++) {
			const x0 = 400 + offset;
			const image = makeImage(W, 200, (x, y) => {
				if (y < 40 || y > 160) return 240;
				if (kind === 'line') return x >= x0 && x < x0 + width ? 10 : 240;
				const left = x >= x0 - 60 && x < x0;
				const right = x >= x0 + width && x < x0 + width + 60;
				return left || right ? 10 : 240;
			});
			const { imageData: small, factor } = downscaleImageData(image, 1000);
			const preview = binarize(small, {});
			const full = binarizeFollowingPreview(image, small, {}, { factor, speckArea: 1 });
			const row = Math.floor(100 * factor) * small.width;
			let previewShows = false;
			for (let x = Math.floor(x0 * factor); x <= Math.floor((x0 + width - 1) * factor); x++) {
				const ink = preview.mask[row + x] === 1;
				if (kind === 'line' ? ink : !ink) previewShows = true;
			}
			let fullShows = false;
			for (let x = x0; x < x0 + width; x++) {
				const ink = full.mask[100 * W + x] === 1;
				if (kind === 'line' ? ink : !ink) fullShows = true;
			}
			expect(fullShows, `${W} ${kind} ${width} at +${offset}`).toBe(previewShows);
			if (previewShows) shownCount++;
		}
		// Each case is one the old rule got wrong somewhere: not all shown, or not all gone
		expect([W, kind, width, shownCount]).not.toEqual([W, kind, width, -1]);
	});

	it('large shapes keep full-size edges; counters stay open', () => {
		// A ring (an O) 2.4 times larger than its preview, with a counter
		const W = 2400;
		const ring = makeImage(W, 900, (x, y) => {
			const d = Math.hypot(x - 1200, y - 450);
			return d > 200 && d < 380 ? 15 : 235;
		});
		const { imageData: small, factor } = downscaleImageData(ring, 1000);
		const full = binarizeFollowingPreview(ring, small, {}, { factor, speckArea: 2 });
		// One piece of ink, and paper inside it (the counter) and around it
		expect(pieces(full.mask, W, 900, 0)).toBe(1);
		const paper = labelPieces(full.mask, W, 900, 0);
		expect(paper.count).toBe(2);
		// The edge is placed at full size: the inner edge within a pixel of radius 200
		const row = 450 * W;
		let inner = 0;
		for (let x = 1200; x < 1700; x++) {
			if (full.mask[row + x]) {
				inner = x - 1200;
				break;
			}
		}
		expect(Math.abs(inner - 200)).toBeLessThanOrEqual(1);
	});

	it('paperSpread: near 0 for a clean scan, large for a photo lit from one side', () => {
		const clean = makeImage(400, 300, (x, y) =>
			x > 150 && x < 250 && y > 100 && y < 200 ? 20 : 240
		);
		const lit = makeImage(400, 300, (x, y) =>
			x > 150 && x < 250 && y > 100 && y < 200 ? 20 : 240 - Math.round((80 * x) / 400)
		);
		expect(binarize(clean, {}, { measurePaper: true }).paperSpread).toBeLessThan(5);
		expect(binarize(lit, {}, { measurePaper: true }).paperSpread).toBeGreaterThanOrEqual(24);
		// Photo mode measures it anyway (it needs the paper map)
		expect(binarize(lit, { mode: 'photo' }).paperSpread).toBeGreaterThanOrEqual(24);
		// Not measured unless asked in Scan mode
		expect(binarize(lit, {}, { previewPixel: 2 }).paperSpread).toBeUndefined();
	});
});
