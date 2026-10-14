// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement: the photo's x / y / scale so the picked part lands on its lines (UX-BEGINNER 4.4
// "Placement", B3 unit tests "placement of a, g, B, Q, f and a period").
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { followPlan, placePart } from '../fit_lines.js';
import { applyFollow, photoScale } from '../photo_scale.js';
import { partGeometry } from '../seat.js';
import { photoOf, turner } from './letters.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const O = 0.015 * 2048;
// photoOf: 2 px per cap unit, a 12 px pen; a stroke on the writing line ends at 306 px.
const LINE_PX = 306;

/** Where a pixel row of the photo lands, in font units, under a placement. */
const fontY = (placed, px) => placed.y - px * placed.scale;
const fontX = (placed, px) => placed.x + px * placed.scale;

/** The placed letter's ink edges in font units. */
function inkFU(photo, id, placed) {
	const g = partGeometry(photo.parts.find((part) => part.id === id));
	return {
		top: fontY(placed, g.top),
		bottom: fontY(placed, g.bottom),
		left: fontX(placed, g.left),
		line: fontY(placed, LINE_PX),
	};
}

const alone = (char, extra = {}) => photoOf([{ char, x0: 60, ...extra }]);
// A whole unit of rounding on y, plus a pixel of rasterizing at about 8 units per pixel
const NEAR = 0.5;

describe('placement of a letter alone in its photo', () => {
	it('a: small-letter line to writing line', () => {
		const photo = alone('a');
		const placed = placePart(photo, 'p1', FONT);
		const ink = inkFU(photo, 'p1', placed);
		expect(placed.seat).toBe('bottom');
		expect(ink.bottom).toBeCloseTo(0, 0);
		expect(Math.abs(ink.bottom)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.top - 1100)).toBeLessThanOrEqual(NEAR);
	});

	it('B: capitals line to writing line', () => {
		const photo = alone('B');
		const ink = inkFU(photo, 'p1', placePart(photo, 'p1', FONT));
		expect(Math.abs(ink.bottom)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.top - 1480)).toBeLessThanOrEqual(NEAR);
	});

	it('g: the bowl sits on the writing line and reaches the small-letter line; the tail hangs below', () => {
		const photo = alone('g');
		const placed = placePart(photo, 'p1', FONT);
		const ink = inkFU(photo, 'p1', placed);
		expect(placed).toMatchObject({ tail: true, bodyFrom: 'counter' });
		expect(Math.abs(fontY(placed, LINE_PX))).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.top - 1100)).toBeLessThanOrEqual(NEAR);
		expect(ink.bottom).toBeLessThan(-0.25 * 1100);
	});

	it('Q with a tail: the round bowl overshoots both lines by 1.5 %, the tail hangs below', () => {
		const photo = alone('Q', { drawTail: true });
		const placed = placePart(photo, 'p1', FONT);
		const ink = inkFU(photo, 'p1', placed);
		expect(placed.tail).toBe(true);
		expect(Math.abs(fontY(placed, LINE_PX) - -O)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.top - (1480 + O))).toBeLessThanOrEqual(NEAR);
		expect(ink.bottom).toBeLessThan(-O - 100);
	});

	it('Q with its tail inside the bowl sits on its ink', () => {
		const photo = alone('Q', { drawTail: false });
		const placed = placePart(photo, 'p1', FONT);
		const ink = inkFU(photo, 'p1', placed);
		expect(placed.tail).toBe(false);
		expect(Math.abs(ink.bottom - -O)).toBeLessThanOrEqual(NEAR);
	});

	it('f standing: top line to writing line', () => {
		const photo = alone('f', { drawTail: false });
		const ink = inkFU(photo, 'p1', placePart(photo, 'p1', FONT));
		expect(Math.abs(ink.bottom)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.top - 1550)).toBeLessThanOrEqual(NEAR);
	});

	it('a dropping f with [It has a tail]: top on the top line, the tail to the tail line', () => {
		const photo = alone('f', { drawTail: true, use: { tail: true } });
		const placed = placePart(photo, 'p1', FONT);
		const ink = inkFU(photo, 'p1', placed);
		expect(placed).toMatchObject({ tail: true, bodyFrom: 'span' });
		expect(Math.abs(ink.top - 1550)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.bottom - -396)).toBeLessThanOrEqual(NEAR);
	});

	it('a period: 12 % of the small-letter height, on the writing line', () => {
		const photo = alone('.');
		const ink = inkFU(photo, 'p1', placePart(photo, 'p1', FONT));
		expect(Math.abs(ink.bottom)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.top - 132)).toBeLessThanOrEqual(NEAR);
	});

	it('the apostrophe hangs from the capitals line and the hyphen centers on half the small-letter height', () => {
		const apostrophe = alone("'");
		expect(
			Math.abs(inkFU(apostrophe, 'p1', placePart(apostrophe, 'p1', FONT)).top - 1480)
		).toBeLessThanOrEqual(NEAR);
		const hyphen = alone('-');
		const ink = inkFU(hyphen, 'p1', placePart(hyphen, 'p1', FONT));
		expect(Math.abs((ink.top + ink.bottom) / 2 - 550)).toBeLessThanOrEqual(NEAR);
	});
});

describe('placement in a row of 3 or more: one scale, the row line where a shape cannot tell', () => {
	// a is written 4 px low, the period 2 px high; the g, the Q and the dropping f hang tails
	const row = () =>
		photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 230, base: 304 },
			{ char: 'g', x0: 380 },
			{ char: 'Q', x0: 520, drawTail: true },
			{ char: 'f', x0: 720, drawTail: true },
			{ char: 'n', x0: 830 },
			{ char: 'H', x0: 950 },
			{ char: '.', x0: 1080, base: 298 },
		]);

	it('one scale; the a and the period sit on the line; the f finds its body on the row line', () => {
		const photo = row();
		const info = photoScale(photo, FONT);
		for (const part of photo.parts) {
			const placed = placePart(photo, part.id, FONT);
			expect(placed.seat, part.id).toBe('bottom');
			expect(placed.scale, part.id).toBe(info.scale);
			expect(Math.abs(placed.linePx - LINE_PX), part.id).toBeLessThanOrEqual(1);
		}
		for (const id of ['p2', 'p8']) {
			expect(Math.abs(inkFU(photo, id, placePart(photo, id, FONT)).bottom), id).toBeLessThanOrEqual(
				NEAR
			);
		}
		const f = placePart(photo, 'p5', FONT);
		expect(f).toMatchObject({ tail: true, bodyFrom: 'row' });
		expect(Math.abs(fontY(f, LINE_PX))).toBeLessThanOrEqual(0.005 * 2048);
		for (const id of ['p3', 'p4']) expect(placePart(photo, id, FONT).bodyFrom, id).toBe('counter');
	});

	it('the tails of g, Q and a dropping f hang below the line on their own', () => {
		const photo = row();
		expect(photoScale(photo, FONT).tails).toMatchObject({ p3: true, p4: true, p5: true });
		for (const id of ['p3', 'p4', 'p5']) {
			const ink = inkFU(photo, id, placePart(photo, id, FONT));
			expect(ink.bottom, id).toBeLessThan(-100);
		}
	});

	it('one scale for all, set by the letters (the period never votes)', () => {
		const photo = row();
		const withDot = photoScale(photo, FONT).scale;
		delete photo.uses.p8;
		expect(photoScale(photo, FONT).scale).toBe(withDot);
	});
});

describe('every letter sits its body on the writing line, wherever it was written (D-034)', () => {
	// The wobble of a sample page repeats in every word of a font, so a letter written 4 px low
	// must not hang 4 px low in every word: each body bottom goes on its line
	const BOX = 2048;
	const ON = 0.005 * BOX;

	it('in a row of 3 or more: written high or low, each bottom lands on the line', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 200, base: 304 },
			{ char: 'n', x0: 320, base: 297 },
			{ char: 'o', x0: 440, base: 303 },
			{ char: 'e', x0: 560, base: 296 },
			{ char: 'H', x0: 680, base: 302 },
			{ char: '.', x0: 800, base: 305 },
		]);
		const info = photoScale(photo, FONT);
		for (const [id, target] of [
			['p1', 0],
			['p2', 0],
			['p3', 0],
			['p4', -O],
			['p5', -O],
			['p6', 0],
			['p7', 0],
		]) {
			const placed = placePart(photo, id, FONT);
			expect(Math.abs(inkFU(photo, id, placed).bottom - target), id).toBeLessThanOrEqual(ON);
		}
		for (const part of photo.parts) {
			const placed = placePart(photo, part.id, FONT);
			expect(placed.seat, part.id).toBe('bottom');
			expect(placed.scale, part.id).toBe(info.scale);
		}
	});

	it('a capitals row whose Q waits for its tail: A and Y each sit on the line, not on their average', () => {
		const photo = photoOf([
			{ char: 'A', x0: 60 },
			{ char: 'Q', x0: 230, drawTail: true },
			{ char: 'Y', x0: 430, base: 292 },
		]);
		const info = photoScale(photo, FONT);
		// Two bottoms are not enough for a row line
		expect(info.lines).toEqual({ p1: null, p2: null, p3: null });
		for (const id of ['p1', 'p3']) {
			const placed = placePart(photo, id, FONT);
			expect(Math.abs(inkFU(photo, id, placed).bottom), id).toBeLessThanOrEqual(NEAR);
		}
		const Q = placePart(photo, 'p2', FONT);
		expect(Q).toMatchObject({ tail: true, bodyFrom: 'counter' });
		expect(Math.abs(fontY(Q, LINE_PX) - -O)).toBeLessThanOrEqual(NEAR);
	});

	it('an apostrophe and a hyphen in a row take their own lines, as alone', () => {
		const photo = photoOf([
			{ char: 'H', x0: 60 },
			{ char: "'", x0: 200, base: 320 },
			{ char: 'a', x0: 260 },
			{ char: '-', x0: 380, base: 330 },
			{ char: 'n', x0: 480 },
		]);
		const apostrophe = inkFU(photo, 'p2', placePart(photo, 'p2', FONT));
		expect(Math.abs(apostrophe.top - 1480)).toBeLessThanOrEqual(NEAR);
		const hyphen = inkFU(photo, 'p4', placePart(photo, 'p4', FONT));
		expect(Math.abs((hyphen.top + hyphen.bottom) / 2 - 550)).toBeLessThanOrEqual(NEAR);
	});
});

describe('a photo taken with the phone held 1.5 degrees off square', () => {
	const BOX = 2048;
	const TILT = 1.5;
	const W = 1600;
	const H = 700;
	const specs = [
		{ char: 'B', x0: 60 },
		{ char: 'a', x0: 200 },
		{ char: 'n', x0: 320 },
		{ char: 'j', x0: 440 },
		{ char: 'o', x0: 520 },
		{ char: 'y', x0: 640 },
		{ char: 'e', x0: 760 },
		{ char: 'H', x0: 900 },
		{ char: 'f', x0: 1060, drawTail: true },
		{ char: 'l', x0: 1160 },
		{ char: '.', x0: 1220 },
	];
	/** Where the pen's line under the middle of the part lands, font units. */
	function penLine(photo, id, placed, tilt) {
		const g = partGeometry(photo.parts.find((part) => part.id === id));
		const middle = (g.left + g.right) / 2;
		// The square photo's pen line y = LINE_PX, turned with the photo, at the part's middle
		const turn = turner(tilt, W, H);
		const [ax, ay] = turn([0, LINE_PX]);
		const [bx, by] = turn([W, LINE_PX]);
		return fontY(placed, ay + ((middle - ax) * (by - ay)) / (bx - ax));
	}

	it('every letter lands where the square photo puts it, within 0.5 % of the letter box', () => {
		const square = photoOf(specs, { width: W, height: H });
		const tilted = photoOf(specs, { width: W, height: H, tilt: TILT });
		for (const part of tilted.parts) {
			const straight = penLine(square, part.id, placePart(square, part.id, FONT), 0);
			const turned = penLine(tilted, part.id, placePart(tilted, part.id, FONT), TILT);
			expect(Math.abs(turned - straight), part.id).toBeLessThanOrEqual(0.005 * BOX);
		}
		const info = photoScale(tilted, FONT);
		expect(Math.abs(Math.atan(info.slope) * (180 / Math.PI) - TILT)).toBeLessThanOrEqual(0.15);
		expect(info.tails).toEqual(photoScale(square, FONT).tails);
	});

	it('the row line follows the tilt: j, y and the dropping f find their body on it', () => {
		const tilted = photoOf(specs, { width: W, height: H, tilt: TILT });
		for (const id of ['p4', 'p6', 'p9']) {
			const placed = placePart(tilted, id, FONT);
			expect(placed.bodyFrom, id).toBe('row');
			expect(Math.abs(penLine(tilted, id, placed, TILT)), id).toBeLessThanOrEqual(0.005 * BOX);
		}
	});
});

describe('a letter with a tail next to one other letter', () => {
	it('a dropping f beside an a sits its body where the a sits', () => {
		const photo = photoOf([
			{ char: 'a', x0: 60 },
			{ char: 'f', x0: 220, drawTail: true },
		]);
		const placed = placePart(photo, 'p2', FONT);
		expect(placed).toMatchObject({ tail: true, bodyFrom: 'partner' });
		expect(Math.abs(fontY(placed, LINE_PX))).toBeLessThanOrEqual(NEAR);
	});

	it('a g beside an a still uses its own bowl', () => {
		const photo = photoOf([
			{ char: 'a', x0: 60 },
			{ char: 'g', x0: 220, base: 310 },
		]);
		const placed = placePart(photo, 'p2', FONT);
		expect(placed.bodyFrom).toBe('counter');
		expect(Math.abs(fontY(placed, LINE_PX + 10))).toBeLessThanOrEqual(NEAR);
	});
});

describe('placePart output', () => {
	it('x puts the left ink edge at the left space asked for; x and y are whole units', () => {
		const photo = alone('B');
		for (const left of [0, 88]) {
			const placed = placePart(photo, 'p1', FONT, { left });
			expect(Number.isInteger(placed.x)).toBe(true);
			expect(Number.isInteger(placed.y)).toBe(true);
			expect(Math.abs(inkFU(photo, 'p1', placed).left - left)).toBeLessThanOrEqual(NEAR);
		}
	});

	it('works the same at a 1,000 letter box', () => {
		const font = { upm: 1000, ascent: 750, capHeight: 700, xHeight: 500, descent: -250 };
		const photo = alone('a');
		const placed = placePart(photo, 'p1', font);
		const ink = inkFU(photo, 'p1', placed);
		expect(Math.abs(ink.top - 500)).toBeLessThanOrEqual(NEAR);
		expect(Math.abs(ink.bottom)).toBeLessThanOrEqual(NEAR);
	});

	it('an unnamed or unknown part has no placement', () => {
		const photo = photoOf([{ char: 'B', x0: 60, named: false }]);
		expect(placePart(photo, 'p1', FONT)).toBe(null);
		expect(placePart(photo, 'nope', FONT)).toBe(null);
	});
});

describe('followPlan: earlier untouched letters follow the new scale', () => {
	/** A traced letter: its trace placed by placePart and photoFit set, as Use it leaves it. */
	function useIt(photo, id, items) {
		const placed = placePart(photo, id, FONT);
		const item = new Glyph({ id: photo.uses[id].itemId, advanceWidth: 500 });
		setTrace(item, {
			asset: photo.asset,
			width: 1600,
			height: 700,
			x: placed.x,
			y: placed.y,
			scale: placed.scale,
		});
		item.anyink.photoFit = { asset: photo.asset, part: id };
		items.set(item.id, item);
		return item;
	}

	it('naming letters one by one keeps every letter from the photo within 3 % of its scale', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 230 },
			{ char: 'H', x0: 420 },
		]);
		// Name B only, then a, then H, as the photo dialog would
		const all = { ...photo.uses };
		photo.uses = { p1: all.p1 };
		const items = new Map();
		const getItem = (id) => items.get(id);
		useIt(photo, 'p1', items);

		photo.uses.p2 = all.p2;
		let plan = followPlan(photo, FONT, { getItem, except: 'p2' });
		// B alone set 1480/212; with a the median moves 9.7 %: B follows
		expect(plan.map((entry) => entry.partId)).toEqual(['p1']);
		expect(plan[0]).toMatchObject({ char: 'B', itemId: 'item-p1', resized: true });
		plan.forEach((entry) => applyFollow(items.get(entry.itemId), entry));
		useIt(photo, 'p2', items);

		// With H the median falls back to the capitals' 1480/212: B and a both follow
		photo.uses.p3 = all.p3;
		plan = followPlan(photo, FONT, { getItem, except: 'p3' });
		expect(plan.map((entry) => entry.partId).sort()).toEqual(['p1', 'p2']);
		plan.forEach((entry) => applyFollow(items.get(entry.itemId), entry));
		useIt(photo, 'p3', items);

		const scale = photoScale(photo, FONT).scale;
		for (const item of items.values()) {
			expect(Math.abs(scale / getTrace(item).scale - 1)).toBeLessThanOrEqual(0.03 + 1e-9);
		}
	});

	it('a row written smaller: once 3 of its letters are named, the earlier ones follow its size', () => {
		const photo = photoOf(
			[
				{ char: 'a', x0: 60, base: 300 },
				{ char: 'n', x0: 200, base: 300 },
				{ char: 'o', x0: 330, base: 300 },
				{ char: 'e', x0: 480, base: 300 },
				{ char: 'u', x0: 60, base: 560, unit: 1.44 },
				{ char: 'c', x0: 160, base: 560, unit: 1.44 },
				{ char: 'z', x0: 260, base: 560, unit: 1.44 },
			],
			{ height: 700 }
		);
		const all = { ...photo.uses };
		photo.uses = {};
		const items = new Map();
		const getItem = (id) => items.get(id);
		const name = (id) => {
			photo.uses[id] = all[id];
			const plan = followPlan(photo, FONT, { getItem, except: id });
			plan.forEach((entry) => applyFollow(items.get(entry.itemId), entry));
			useIt(photo, id, items);
			return plan;
		};
		for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) name(id);
		const plan = name('p7');
		expect(plan.map((entry) => entry.partId).sort()).toEqual(['p5', 'p6']);
		expect(plan.every((entry) => entry.resized)).toBe(true);
		// Every letter ends within 3 % of its own row's size, and the small row is 1 / 0.72 bigger
		const info = photoScale(photo, FONT);
		for (const [id, use] of Object.entries(photo.uses)) {
			const scale = getTrace(items.get(use.itemId)).scale;
			expect(Math.abs(info.scales[id] / scale - 1), id).toBeLessThanOrEqual(0.03 + 1e-9);
		}
		const ratio = getTrace(items.get('item-p5')).scale / getTrace(items.get('item-p1')).scale;
		expect(ratio).toBeGreaterThan(1.25);
	});

	it('a letter he changed since tracing stays as it is', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 260, named: false },
		]);
		const items = new Map();
		const B = useIt(photo, 'p1', items);
		delete B.anyink.photoFit;
		photo.uses.p2 = { char: 'a', itemId: 'item-p2' };
		expect(followPlan(photo, FONT, { getItem: (id) => items.get(id), except: 'p2' })).toEqual([]);
	});

	it('no follow under 3 %', () => {
		// H written 2 % bigger than B moves the median 1 %
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'H', x0: 260, unit: 2.04, named: false },
		]);
		const items = new Map();
		useIt(photo, 'p1', items);
		photo.uses.p2 = { char: 'H', itemId: 'item-p2' };
		expect(followPlan(photo, FONT, { getItem: (id) => items.get(id), except: 'p2' })).toEqual([]);
	});

	it('a follower keeps its left ink edge where spacing put it, in whole units', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 260, named: false },
		]);
		const items = new Map();
		const B = useIt(photo, 'p1', items);
		// Spacing moved B 120 units right after Use it
		setTrace(B, { ...getTrace(B), x: getTrace(B).x + 120 });
		photo.uses.p2 = { char: 'a', itemId: 'item-p2' };
		const [entry] = followPlan(photo, FONT, { getItem: (id) => items.get(id), except: 'p2' });
		expect(entry).toMatchObject({ partId: 'p1', resized: true });
		const g = partGeometry(photo.parts[0]);
		const before = entry.from.x + g.left * entry.from.scale;
		const after = entry.to.x + g.left * entry.to.scale;
		expect(Math.abs(after - before)).toBeLessThanOrEqual(0.5);
		expect(Number.isInteger(entry.to.x) && Number.isInteger(entry.to.y)).toBe(true);
		// Its body bottom is still on the writing line at the new scale
		expect(Math.abs(entry.to.y - LINE_PX * entry.to.scale)).toBeLessThanOrEqual(NEAR);
	});
});
