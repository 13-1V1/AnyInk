// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S1 step 8 (docs/SKETCH.md 5 "The Bumpy check"): the Bumpy measure.
	  - the Gate 2 dead-end replay's two Brush strokes on small a (fixtures/dead_end_a.gs2.json)
	    are bumpy, read straight from glyph.anyink.nib.strokes
	  - clean a, r, s, e, B (and o) centerlines are not, at thickness 60, 99 and 200
	  - a short r ear is never counted, however shaky
	  - the pieces of a sketch are judged through a toSkeleton (sketch/curves.js in the app)
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	BUMP_DEGREES,
	LENGTH_SHARE,
	bumpyPieces,
	bumpyStrokes,
	countBumps,
	headings,
	isBumpy,
	measureBumps,
	resample,
	smoothSamples,
} from '../bumpy.js';
import { arc, cleanLetters, line, wobble } from './clean_letters.js';

const here = dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(readFileSync(join(here, 'fixtures', 'dead_end_a.gs2.json'), 'utf8'));
const smallA = project.glyphs['glyph-0x61'];

describe('the pieces of the measure', () => {
	it('resample: a point every step along the line, both ends kept', () => {
		const samples = resample(
			[
				[0, 0],
				[10, 0],
				[10, 7],
			],
			2
		);
		expect(samples.length).toBe(10);
		expect(samples[5]).toEqual([10, 0]);
		expect(samples.at(-1)).toEqual([10, 7]);
	});

	it('resample closed: walks back to the start without a doubled point', () => {
		const samples = resample(
			[
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10],
			],
			5,
			{ closed: true }
		);
		expect(samples.length).toBe(8);
	});

	it('smoothSamples: a window of half the thickness averages each sample with its neighbors', () => {
		const out = smoothSamples(
			[
				[0, 0],
				[1, 3],
				[2, 0],
				[3, 3],
				[4, 0],
			],
			1,
			2
		);
		expect(out[0]).toEqual([0, 0]);
		expect(out[1]).toEqual([1, 1]);
		expect(out.at(-1)).toEqual([4, 0]);
	});

	it('headings unwrap past 180 degrees, so a ring keeps turning one way', () => {
		const ring = Array.from({ length: 40 }, (_, i) => [Math.cos(i / 6), Math.sin(i / 6)]);
		const heading = headings(ring);
		expect(heading.at(-1) - heading[0]).toBeGreaterThan(360);
	});

	it(`countBumps: a turn of side only counts after ${BUMP_DEGREES} degrees of swing`, () => {
		expect(countBumps([0, 10, 20, 10, 20, 10])).toBe(3);
		expect(countBumps([0, 5, 0, 5, 0, 5, 0])).toBe(0);
		expect(countBumps([0, 30, 60, 90, 120])).toBe(0);
		expect(countBumps([0, 30, 60, 50, 20])).toBe(1);
	});
});

describe('the dead-end replay: both Brush strokes on small a are bumpy', () => {
	const strokes = smallA.anyink.nib.strokes;

	it('the fixture holds the two strokes at the Brush default thickness', () => {
		expect(strokes.map((stroke) => stroke.id)).toEqual([1, 2]);
		expect(strokes.every((stroke) => stroke.size === 99)).toBe(true);
	});

	it('bumpyStrokes reads glyph.anyink.nib.strokes and names both', () => {
		const found = bumpyStrokes(smallA);
		expect(found.map((stroke) => stroke.id)).toEqual([1, 2]);
		for (const stroke of found) {
			expect(stroke.key).toBe(strokes.find((one) => one.id === stroke.id).key);
			expect(stroke.bumps).toBeGreaterThanOrEqual(3);
			expect(stroke.perThousand).toBeGreaterThan(4);
		}
	});

	it('each stroke has well over the bumps a clean letter has', () => {
		for (const stroke of strokes) {
			const result = measureBumps(stroke.skeleton, stroke.size);
			expect(result.counted).toBe(true);
			expect(result.bumps).toBeGreaterThanOrEqual(10);
		}
	});

	it('a letter with no strokes, or no anyink at all, has none', () => {
		expect(bumpyStrokes({})).toEqual([]);
		expect(bumpyStrokes({ anyink: { nib: { strokes: [] } } })).toEqual([]);
		expect(bumpyStrokes(null)).toEqual([]);
	});
});

describe('clean sketched letters are never bumpy', () => {
	const letters = cleanLetters();
	for (const thickness of [60, 99, 200]) {
		for (const [char, pieces] of Object.entries(letters)) {
			it(`${char} at ${thickness}`, () => {
				for (const { name, skeleton, closed } of pieces) {
					const result = measureBumps(skeleton, thickness, { closed });
					expect(result.bumpy, `${char} ${name}: ${result.bumps} bumps`).toBe(false);
					expect(result.bumps, `${char} ${name}`).toBeLessThanOrEqual(2);
				}
			});
		}
	}

	it('the long pieces are judged (they are not passed only for being short)', () => {
		const judged = Object.values(letters)
			.flat()
			.filter(({ skeleton, closed }) => measureBumps(skeleton, 99, { closed }).counted);
		expect(judged.map(({ name }) => name)).toEqual(
			expect.arrayContaining(['hook and stem', 'bowl', 'spine', 'bar and bowl', 'top bowl', 'ring'])
		);
	});

	it('a shaky hand on the same letters is bumpy (the measure has teeth)', () => {
		const { s, e } = letters;
		expect(isBumpy(wobble(s[0].skeleton, 12, 150), 99)).toBe(true);
		expect(isBumpy(wobble(e[0].skeleton, 12, 150), 99)).toBe(true);
	});

	it('a wobble too small to turn the line 8 degrees is not', () => {
		expect(isBumpy(wobble(letters.s[0].skeleton, 1, 150), 99)).toBe(false);
	});

	it('the seam of a closed ring is never a bump', () => {
		for (const start of [0, 37, 90, 200]) {
			const ring = arc(300, 550, 250, 500, start, start + 360);
			expect(measureBumps(ring, 99, { closed: true }).bumps).toBe(0);
		}
	});
});

describe('only pieces longer than 6x the thickness count', () => {
	it('a short r ear is never counted, however shaky', () => {
		const ear = cleanLetters().r[1].skeleton;
		const shaky = wobble(ear, 15, 90);
		const result = measureBumps(shaky, 99);
		expect(result.bumps).toBeGreaterThanOrEqual(3);
		expect(result.length).toBeLessThanOrEqual(LENGTH_SHARE * 99);
		expect(result.counted).toBe(false);
		expect(result.bumpy).toBe(false);
	});

	it('the same shake on a long stroke is bumpy', () => {
		const long = [line([0, 0], [0, 1400])];
		expect(isBumpy(wobble(long, 15, 90), 99)).toBe(true);
	});

	it('nothing to measure gives nothing', () => {
		expect(measureBumps([], 99)).toMatchObject({ length: 0, bumps: 0, bumpy: false });
		expect(measureBumps(undefined, 99).bumpy).toBe(false);
		expect(measureBumps([line([0, 0], [0, 900])], 0).bumpy).toBe(false);
	});
});

describe('bumpyPieces: sketch pieces through their centerline', () => {
	const sketch = {
		thickness: 99,
		pieces: [
			{ id: 1, key: 'pc_1', use: 'center', closed: false, skeleton: cleanLetters().s[0].skeleton },
			{
				id: 2,
				key: 'pc_2',
				use: 'center',
				closed: false,
				skeleton: smallA.anyink.nib.strokes[0].skeleton,
			},
			{
				id: 3,
				key: 'pc_3',
				use: 'helper',
				closed: false,
				skeleton: smallA.anyink.nib.strokes[1].skeleton,
			},
			{ id: 4, key: 'pc_4', use: 'outline', closed: true, skeleton: cleanLetters().o[0].skeleton },
		],
	};
	const toSkeleton = (piece) => piece.skeleton;

	it('names the bumpy piece, skips helper lines, passes clean pieces', () => {
		expect(bumpyPieces(sketch, toSkeleton).map((piece) => piece.key)).toEqual(['pc_2']);
	});

	it('without a toSkeleton there is nothing to judge', () => {
		expect(bumpyPieces(sketch)).toEqual([]);
		expect(bumpyPieces(null, toSkeleton)).toEqual([]);
	});
});

describe('the rate is per letter box, so a font scaled to another letter box keeps its verdict', () => {
	// Fix track (measures): the same wobble at 1,000 units per letter box is the 2,048 drawing at
	// 1000/2048 scale. Before the fix it had twice the bumps per 1,000 font units and flipped to
	// Bumpy.
	const k = 1000 / 2048;
	const scale = (skeleton) => skeleton.map((curve) => curve.map(([x, y]) => [x * k, y * k]));
	const calm = wobble([line([0, 0], [0, 1400])], 30, 450); // 5 bumps, about 3.4 per 1,000
	const shaky = wobble([line([0, 0], [0, 1400])], 30, 350); // 7 bumps, about 4.7 per 1,000

	it('a calm wobble passes at 2,048 and at 1,000 units per letter box', () => {
		const big = measureBumps(calm, 99, { font: { upm: 2048 } });
		const small = measureBumps(scale(calm), 99 * k, { font: { upm: 1000 } });
		expect(big.bumps).toBe(5);
		expect(small.bumps).toBe(big.bumps);
		expect(small.perThousand).toBeCloseTo(big.perThousand, 6);
		expect(big.bumpy).toBe(false);
		expect(small.bumpy).toBe(false);
	});

	it('a shaky one is Bumpy at both', () => {
		expect(measureBumps(shaky, 99, { font: { upm: 2048 } }).bumpy).toBe(true);
		expect(measureBumps(scale(shaky), 99 * k, { font: { upm: 1000 } }).bumpy).toBe(true);
	});

	it('the rate is per 1,000 units of a 2,048-unit letter box; a font with no upm is 2,048', () => {
		const result = measureBumps(scale(calm), 99 * k, { font: { upm: 1000 } });
		expect(result.perThousand).toBeCloseTo(
			(result.bumps * 1000 * 1000) / (result.length * 2048),
			6
		);
		expect(measureBumps(calm, 99).perThousand).toBeCloseTo(
			measureBumps(calm, 99, { font: { upm: 2048 } }).perThousand,
			9
		);
	});

	it('bumpyStrokes and bumpyPieces pass the font on', () => {
		const glyph = {
			anyink: { nib: { strokes: [{ id: 1, key: 'st_1', size: 99 * k, skeleton: scale(calm) }] } },
		};
		expect(bumpyStrokes(glyph, { font: { upm: 1000 } })).toEqual([]);
		const sketch = {
			thickness: 99 * k,
			pieces: [{ id: 1, key: 'pc_1', use: 'center', closed: false, skeleton: scale(calm) }],
		};
		expect(bumpyPieces(sketch, (piece) => piece.skeleton, { font: { upm: 1000 } })).toEqual([]);
	});
});
