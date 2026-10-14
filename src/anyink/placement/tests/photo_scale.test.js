// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement: one scale per photo (UX-BEGINNER 4.4 "One size for the whole photo"): the median
// over the letters named from it, and earlier untouched letters follow.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { partGeometry } from '../seat.js';
import {
	applyFollow,
	FOLLOW_SHARE,
	isUntouched,
	letterRatio,
	photoScale,
	rescaleMap,
	shouldFollow,
} from '../photo_scale.js';
import { placePart } from '../fit_lines.js';
import { lineTargets } from '../classes.js';
import { drawLetter, photoOf } from './letters.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const O = 0.015 * 2048;
const height = (part) => partGeometry(part).height;

describe('letterRatio: font units per pixel that would put one letter on its lines', () => {
	it('a letter with no tail fills its class height', () => {
		const a = drawLetter('a');
		expect(letterRatio(a, 'a', FONT)).toBeCloseTo(1100 / height(a), 9);
		const B = drawLetter('B');
		expect(letterRatio(B, 'B', FONT)).toBeCloseTo(1480 / height(B), 9);
		const f = drawLetter('f');
		expect(letterRatio(f, 'f', FONT)).toBeCloseTo(1550 / height(f), 9);
	});

	it('a tail letter with a bowl is sized by its body (hole bottom plus one stroke)', () => {
		const g = drawLetter('g');
		expect(letterRatio(g, 'g', FONT)).toBeCloseTo(1100 / (306 - partGeometry(g).top), 9);
		const Q = drawLetter('Q', { tail: true });
		expect(letterRatio(Q, 'Q', FONT, { tail: true })).toBeCloseTo(
			(1480 + 2 * O) / (306 - partGeometry(Q).top),
			9
		);
	});

	it('a tail letter with no bowl is sized from its top to its tail line', () => {
		const f = drawLetter('f', { tail: true });
		expect(letterRatio(f, 'f', FONT, { tail: true })).toBeCloseTo((1550 + 396) / height(f), 9);
		const y = drawLetter('y');
		expect(letterRatio(y, 'y', FONT)).toBeCloseTo((1100 + 396) / height(y), 9);
	});

	it('with a writing line from its row, a tail letter with no bowl is sized by its body', () => {
		// The f's body runs from its top to the line (300 px); its tail is longer than the font's
		const f = drawLetter('f', { tail: true });
		const top = partGeometry(f).top;
		expect(letterRatio(f, 'f', FONT, { tail: true, linePx: 300 })).toBeCloseTo(
			1550 / (300 - top),
			9
		);
		// A bowl still sizes the letter (its seat may take the row line: seat.js bodyBottom)
		const g = drawLetter('g');
		expect(letterRatio(g, 'g', FONT, { linePx: 290 })).toBeCloseTo(
			1100 / (306 - partGeometry(g).top),
			9
		);
		// No tail on: the line is not needed
		const a = drawLetter('a');
		expect(letterRatio(a, 'a', FONT, { linePx: 250 })).toBeCloseTo(1100 / height(a), 9);
	});

	it('in a row, a dropping f counts with its body, not its tail', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 230 },
			{ char: 'f', x0: 400, drawTail: true },
		]);
		const info = photoScale(photo, FONT);
		expect(info.tails.p3).toBe(true);
		expect(info.ratios.p3).toBeCloseTo(1550 / (306 - partGeometry(photo.parts[2]).top), 9);
	});

	it('punctuation by its own class: the period is 12 % of the small-letter height, the hyphen by width', () => {
		const dot = drawLetter('.');
		expect(letterRatio(dot, '.', FONT)).toBeCloseTo(132 / height(dot), 9);
		const hyphen = drawLetter('-');
		expect(letterRatio(hyphen, '-', FONT)).toBeCloseTo(550 / partGeometry(hyphen).width, 9);
	});

	it('no part, no ratio', () => {
		expect(letterRatio(null, 'a', FONT)).toBe(null);
	});
});

describe('photoScale: one scale for the whole photo', () => {
	const row = (named = {}) =>
		photoOf([
			{ char: 'B', x0: 60, ...named.B },
			{ char: 'a', x0: 260, ...named.a },
			{ char: 'H', x0: 420, ...named.H },
		]);

	it('is the median of the named letters (two capitals outvote one small letter)', () => {
		const photo = row();
		const info = photoScale(photo, FONT);
		const B = letterRatio(photo.parts[0], 'B', FONT);
		expect(info.scale).toBeCloseTo(B, 9);
		expect(info.from.sort()).toEqual(['p1', 'p2', 'p3']);
	});

	it('changes when a letter is named, and only then', () => {
		const photo = row({ a: { named: false }, H: { named: false } });
		const first = photoScale(photo, FONT).scale;
		expect(first).toBeCloseTo(letterRatio(photo.parts[0], 'B', FONT), 9);
		photo.uses.p2 = { char: 'a' };
		const second = photoScale(photo, FONT).scale;
		const a = letterRatio(photo.parts[1], 'a', FONT);
		expect(second).toBeCloseTo((first + a) / 2, 9);
	});

	it('punctuation is never part of the median while a letter is named', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: '.', x0: 200 },
			{ char: '-', x0: 260 },
		]);
		const info = photoScale(photo, FONT);
		expect(info.scale).toBeCloseTo(letterRatio(photo.parts[0], 'B', FONT), 9);
		expect(info.from).toEqual(['p1']);
	});

	it('a photo of only punctuation is sized by it', () => {
		const photo = photoOf([{ char: '.', x0: 60 }]);
		expect(photoScale(photo, FONT).scale).toBeCloseTo(132 / height(photo.parts[0]), 9);
	});

	it('nothing named, no scale', () => {
		const photo = photoOf([{ char: 'B', x0: 60, named: false }]);
		expect(photoScale(photo, FONT)).toMatchObject({ scale: null, from: [] });
		expect(photoScale(null, FONT)).toMatchObject({ scale: null, from: [] });
	});

	it('guesses the tail of Q J f, and his [It has a tail] / [No tail] wins', () => {
		const photo = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'Q', x0: 220, drawTail: true },
			{ char: 'f', x0: 460, drawTail: false },
		]);
		expect(photoScale(photo, FONT).tails).toMatchObject({ p1: false, p2: true, p3: false });
		photo.uses.p2.tail = false;
		photo.uses.p3.tail = true;
		expect(photoScale(photo, FONT).tails).toMatchObject({ p2: false, p3: true });
	});

	it('reports the row line of each part in a row of 3 or more', () => {
		const info = photoScale(row(), FONT);
		for (const id of ['p1', 'p2', 'p3']) expect(info.lines[id]).toBe(306);
		const pair = photoOf([
			{ char: 'B', x0: 60 },
			{ char: 'a', x0: 260 },
		]);
		expect(photoScale(pair, FONT).lines).toEqual({ p1: null, p2: null });
	});
});

describe('a page written big, then smaller (D-034): a row written smaller gets its own size', () => {
	// Capitals and a first row of small letters full size, then a row at 72 % (he ran out of room)
	const page = ({ second = 1.44, capitals = 2 } = {}) =>
		photoOf(
			[
				{ char: 'B', x0: 60, base: 220, unit: capitals },
				{ char: 'H', x0: 230, base: 220, unit: capitals },
				{ char: 'A', x0: 400, base: 220, unit: capitals },
				{ char: 'a', x0: 60, base: 420 },
				{ char: 'n', x0: 200, base: 420 },
				{ char: 'o', x0: 330, base: 420 },
				{ char: 'e', x0: 480, base: 420 },
				{ char: 'm', x0: 620, base: 420 },
				{ char: 'u', x0: 60, base: 620, unit: second },
				{ char: 'c', x0: 160, base: 620, unit: second },
				{ char: 'z', x0: 260, base: 620, unit: second },
				{ char: 'x', x0: 350, base: 620, unit: second },
				{ char: 'v', x0: 440, base: 620, unit: second },
			],
			{ height: 700 }
		);
	/** The placed letter's ink height in font units. */
	const heightOf = (photo, id) => {
		const placed = placePart(photo, id, FONT);
		return partGeometry(photo.parts.find((part) => part.id === id)).height * placed.scale;
	};

	it('the smaller row comes out as tall as the big one', () => {
		const photo = page();
		// Every small letter here is written as tall as the others in its row
		for (const id of ['p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13'])
			expect(Math.abs(heightOf(photo, id) / 1100 - 1), id).toBeLessThanOrEqual(0.03);
	});

	it('each row keeps one size: the capitals go with the row next to them', () => {
		const photo = page();
		const info = photoScale(photo, FONT);
		const scaleOf = (id) => info.scales[id];
		expect(info.groups.length).toBe(2);
		for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'])
			expect(scaleOf(id), id).toBe(scaleOf('p4'));
		for (const id of ['p9', 'p10', 'p11', 'p12', 'p13'])
			expect(scaleOf(id), id).toBe(scaleOf('p9'));
		// Written at 72 % with the same pen: about 1.34 times the scale
		expect(scaleOf('p9') / scaleOf('p4')).toBeGreaterThan(1.3);
		// The photo's own scale is the one most of its letters share
		expect(info.scale).toBe(scaleOf('p4'));
		expect(info.groups.find((group) => group.main).parts).toContain('p1');
	});

	it('capitals written taller than the font draws them are not a smaller row: one size', () => {
		const photo = page({ second: 2, capitals: 2.5 });
		const info = photoScale(photo, FONT);
		expect(info.groups.length).toBe(1);
		expect(new Set(Object.values(info.scales)).size).toBe(1);
	});

	it('capitals written tall in the big rows never shrink the small letters of the smaller rows', () => {
		// His capitals stand 30 % taller than the font draws them, and make half the big rows'
		// letters, so the big rows' median sits between his capitals and his small letters
		const photo = photoOf(
			[
				{ char: 'B', x0: 60, base: 220, unit: 2.6 },
				{ char: 'H', x0: 230, base: 220, unit: 2.6 },
				{ char: 'A', x0: 400, base: 220, unit: 2.6 },
				{ char: 'a', x0: 60, base: 420 },
				{ char: 'n', x0: 200, base: 420 },
				{ char: 'm', x0: 330, base: 420 },
				{ char: 'u', x0: 60, base: 620, unit: 1.44 },
				{ char: 'n', x0: 160, base: 620, unit: 1.44 },
				{ char: 'z', x0: 260, base: 620, unit: 1.44 },
				{ char: 'x', x0: 350, base: 620, unit: 1.44 },
				{ char: 'v', x0: 440, base: 620, unit: 1.44 },
			],
			{ height: 700 }
		);
		expect(photoScale(photo, FONT).groups.length).toBe(2);
		// Every small letter, from a big row or the smaller one, comes out the same height (the
		// letters drawn here are all as tall as each other in their row, and none is round)
		const fill = ['p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'].map((id) => {
			const t = lineTargets(photo.uses[id].char, FONT);
			return heightOf(photo, id) / (t.top - t.bottom);
		});
		expect(Math.max(...fill) / Math.min(...fill) - 1).toBeLessThanOrEqual(0.03);
	});

	it('letter-to-letter wobble of a messy page is not a smaller row: one size', () => {
		// Each letter up to 12 % bigger or smaller, the two rows the same size on the whole
		const sizes = [2.2, 1.8, 2.15, 1.85, 2.0];
		const photo = photoOf(
			[
				...['a', 'n', 'o', 'e', 'm'].map((char, i) => ({
					char,
					x0: 60 + 150 * i,
					base: 300,
					unit: sizes[i],
				})),
				...['u', 'c', 'z', 'x', 'v'].map((char, i) => ({
					char,
					x0: 60 + 120 * i,
					base: 560,
					unit: sizes[4 - i],
				})),
			],
			{ height: 700 }
		);
		const info = photoScale(photo, FONT);
		expect(info.groups.length).toBe(1);
		expect(new Set(Object.values(info.scales)).size).toBe(1);
	});
});

describe('the follow rule', () => {
	it('a letter follows when its scale is more than 3 % off the photo scale', () => {
		expect(FOLLOW_SHARE).toBe(0.03);
		expect(shouldFollow(10, 10.2)).toBe(false);
		expect(shouldFollow(10, 10.3)).toBe(false);
		expect(shouldFollow(10, 10.4)).toBe(true);
		expect(shouldFollow(10, 9.6)).toBe(true);
		expect(shouldFollow(10, 9.8)).toBe(false);
		expect(shouldFollow(0, 10)).toBe(false);
	});

	it('only letters he has not changed since tracing follow (anyink.photoFit), from this photo', () => {
		const glyph = (photoFit) => ({ anyink: photoFit === undefined ? {} : { photoFit } });
		expect(isUntouched(glyph({ asset: 'img-1', part: 'p1' }), 'img-1')).toBe(true);
		expect(isUntouched(glyph({ asset: 'img-1' }), 'img-2')).toBe(false);
		expect(isUntouched(glyph(true), 'img-1')).toBe(true);
		expect(isUntouched(glyph(false), 'img-1')).toBe(false);
		expect(isUntouched(glyph(undefined), 'img-1')).toBe(false);
		expect(isUntouched(null, 'img-1')).toBe(false);
	});

	it('rescaleMap keeps every photo pixel under the same spot of the photo', () => {
		const from = { x: 10, y: 1000, scale: 5 };
		const to = { x: 20, y: 1100, scale: 6 };
		const map = rescaleMap(from, to);
		// photo pixel (4, 8): font (30, 960) before, (44, 1052) after
		expect(map.k).toBeCloseTo(1.2, 12);
		expect(map.x(30)).toBeCloseTo(44, 9);
		expect(map.y(960)).toBeCloseTo(1052, 9);
	});

	it('applyFollow moves the shapes, the photo and the width together, in whole units', () => {
		const glyph = new Glyph({ id: 'glyph-0x42', advanceWidth: 600 });
		glyph.shapes = [
			new Path({
				pathPoints: [
					{
						type: 'corner',
						p: { coord: { x: 100, y: 0 } },
						h1: { coord: { x: 100, y: 0 }, use: false },
						h2: { coord: { x: 130, y: 0 }, use: false },
					},
					{
						type: 'flat',
						p: { coord: { x: 300, y: 0 } },
						h1: { coord: { x: 280, y: -20 } },
						h2: { coord: { x: 320, y: 20 } },
					},
					{ type: 'corner', p: { coord: { x: 200, y: 400 } } },
				],
			}),
		];
		setTrace(glyph, {
			asset: 'img-1',
			width: 400,
			height: 300,
			x: 50,
			y: 900,
			scale: 3,
			opacity: 0.25,
			locked: true,
		});
		const from = getTrace(glyph);
		const to = { ...from, x: 20, y: 950, scale: 3.3 };
		expect(applyFollow(glyph, { from, to })).toBe(true);

		const map = rescaleMap(from, to);
		const [a, b, c] = glyph.shapes[0].pathPoints;
		expect([a.p.x, a.p.y]).toEqual([Math.round(map.x(100)), Math.round(map.y(0))]);
		expect([b.p.x, b.p.y]).toEqual([Math.round(map.x(300)), Math.round(map.y(0))]);
		expect([b.h1.x, b.h1.y]).toEqual([Math.round(map.x(280)), Math.round(map.y(-20))]);
		expect([c.p.x, c.p.y]).toEqual([Math.round(map.x(200)), Math.round(map.y(400))]);
		// A handle that is off stays parked the same distance from its point
		expect(a.h2.use).toBe(false);
		expect(a.h2.coord.x - a.p.coord.x).toBe(30);
		for (const point of glyph.shapes[0].pathPoints) {
			for (const v of [
				point.p.x,
				point.p.y,
				point.h1.coord.x,
				point.h1.coord.y,
				point.h2.coord.x,
				point.h2.coord.y,
			]) {
				expect(Number.isInteger(v)).toBe(true);
			}
		}
		expect(getTrace(glyph)).toMatchObject({
			x: 20,
			y: 950,
			scale: 3.3,
			opacity: 0.25,
			locked: true,
		});
		expect(glyph.advanceWidth).toBe(Math.round(map.x(600)));
	});

	it('applyFollow says no to an item with no trace to follow', () => {
		expect(applyFollow(new Glyph({}), { from: null, to: { x: 0, y: 0, scale: 1 } })).toBe(false);
		expect(applyFollow(null, {})).toBe(false);
	});
});
