// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 finalize (hostile pass on the placement fix): rows written at different sizes.
// - Capital rows and small-letter rows share no kind of letter, so their sizes can't be
//   compared; sorting them on one scale anyway shrank small rows written at the right size
//   (73 to 77 % on a whole-alphabet page). Sizes are now compared only inside a set of rows
//   that share kinds of letter; a set that shares none with the small letters (the capitals)
//   is tied to the small-letter row next to it.
// - A page that shrinks a little every row never split into groups (rows from 127 % down to
//   80 %). Each row now gets its own size, faded in between ROW_SIZE_DEAD (7 %) and
//   ROW_SIZE_SHARE (15 %) off the page's usual size, so a messy hand's wobble stays one size.
// - While letters were named one by one, rows jumped between groups and earlier letters went
//   x1.21, x0.83, x1.18 ... The sizes now move smoothly, so they never swing back and forth.
// - Only letters whose whole height is their body say how big a row was written: a p or g whose
//   bowl closes above the line made its row look written smaller and grew it (n came out 9 %
//   over its line on the lens's slanted page).
import { describe, expect, it } from 'vitest';
import { placePart } from '../fit_lines.js';
import { photoScale } from '../photo_scale.js';
import { partGeometry } from '../seat.js';
import { photoOf } from './letters.js';
import { arc, drawPart } from './raster.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };

/** The placed letter's ink height in font units */
function heightOf(photo, id) {
	const placed = placePart(photo, id, FONT);
	return partGeometry(photo.parts.find((part) => part.id === id)).height * placed.scale;
}

/**
 * Rows of letters: [{ chars, base, unit }], each letter 150 px apart.
 * @param {{jitter?: Number, seed?: Number}} [hand] - each letter up to `jitter` bigger or
 *   smaller (a steady hand's wobble), repeatable from `seed`
 */
function page(rows, height, { jitter = 0, seed = 1 } = {}) {
	let state = seed;
	const wobble = () => {
		state = (state * 16807) % 2147483647;
		return 1 + jitter * (2 * (state / 2147483647) - 1);
	};
	const specs = [];
	rows.forEach(({ chars, base, unit = 2 }) => {
		[...chars].forEach((char, i) =>
			specs.push({ char, x0: 60 + 150 * i, base, unit: unit * wobble() })
		);
	});
	return photoOf(specs, { width: 1400, height });
}

/** The ids of the parts in row r (rows as given to page) */
function idsOfRow(rows, r) {
	let start = 0;
	for (let i = 0; i < r; i++) start += rows[i].chars.length;
	return [...rows[r].chars].map((_, i) => `p${start + i + 1}`);
}

describe('a whole-alphabet page: capital rows and small-letter rows', () => {
	const rows = [
		{ chars: 'BHAY', base: 230 },
		{ chars: 'YHBA', base: 480 },
		{ chars: 'anmuz', base: 650 },
		{ chars: 'xnaum', base: 820, unit: 1.44 },
	];

	it('only the last small row written smaller: every small letter comes out the same height', () => {
		const photo = page(rows, 900);
		for (const r of [2, 3]) {
			for (const id of idsOfRow(rows, r)) {
				expect(Math.abs(heightOf(photo, id) / 1100 - 1), id).toBeLessThanOrEqual(0.03);
			}
		}
	});

	it('the capitals take the size of the small-letter row next to them', () => {
		const photo = page(rows, 900);
		const info = photoScale(photo, FONT);
		const near = info.scales[idsOfRow(rows, 2)[0]];
		for (const id of [...idsOfRow(rows, 0), ...idsOfRow(rows, 1)]) {
			expect(info.scales[id] / near, id).toBeCloseTo(1, 6);
		}
	});
});

describe('a page that shrinks a little every row', () => {
	const rows = [
		{ chars: 'BHAY', base: 230 },
		{ chars: 'anmuxz', base: 400, unit: 2 },
		{ chars: 'anmuxz', base: 560, unit: 1.84 },
		{ chars: 'anmuxz', base: 710, unit: 1.68 },
		{ chars: 'anmuxz', base: 850, unit: 1.54 },
		{ chars: 'anmuxz', base: 980, unit: 1.4 },
	];

	it('every small letter comes out within 8 % of its line height', () => {
		const photo = page(rows, 1080);
		for (let r = 1; r < rows.length; r++) {
			for (const id of idsOfRow(rows, r)) {
				expect(Math.abs(heightOf(photo, id) / 1100 - 1), id).toBeLessThanOrEqual(0.08);
			}
		}
	});

	it.each([7, 9, 3])(
		'named one letter at a time (wobble seed %i), no letter swings bigger then smaller by over 10 %',
		(seed) => {
			const photo = page(rows, 1080, { jitter: 0.08, seed: seed * 7919 });
			const all = photo.uses;
			const order = photo.parts.map((part) => part.id);
			const named = { ...photo, uses: {} };
			const history = {};
			for (const id of order) {
				named.uses[id] = all[id];
				const info = photoScale(named, FONT);
				for (const known of Object.keys(named.uses)) {
					(history[known] ||= []).push(info.scales[known]);
				}
			}
			for (const [id, scales] of Object.entries(history)) {
				let up = false;
				let down = false;
				for (let i = 1; i < scales.length; i++) {
					const change = scales[i] / scales[i - 1];
					if (change > 1.1) up = true;
					if (change < 1 / 1.1) down = true;
				}
				expect(up && down, `${id}: ${scales.map((s) => s.toFixed(2)).join(' ')}`).toBe(false);
			}
		}
	);
});

describe('one size where the rows only wobble', () => {
	it('rows a few percent apart keep one scale', () => {
		const rows = [
			{ chars: 'anmuz', base: 300, unit: 2 },
			{ chars: 'xnaum', base: 470, unit: 1.92 },
			{ chars: 'zuman', base: 640, unit: 2.06 },
		];
		const photo = page(rows, 760);
		const info = photoScale(photo, FONT);
		expect(new Set(Object.values(info.scales)).size).toBe(1);
	});
});

describe('tail letters never say how big a row was written', () => {
	it('a row whose p and g close their bowls high keeps the size of the row above it', () => {
		const rows = [
			{ chars: 'pgpga', base: 300 },
			{ chars: 'pgnpg', base: 520 },
		];
		const photo = page(rows, 680);
		// p and g in the second row: bowls closing 9 cap units above the line, as many hands
		// write them
		const highBowl = {
			p: [
				[
					[0, -60],
					[0, 44],
				],
				arc(22, -34.5, 22, 25.5, 0, Math.PI * 2),
			],
			g: [
				arc(22, -34.5, 22, 25.5, 0, Math.PI * 2),
				[
					[44, -60],
					[44, 26],
				],
				arc(24, 26, 20, 18, 0, Math.PI),
			],
		};
		for (const [index, char] of [
			[0, 'p'],
			[1, 'g'],
			[3, 'p'],
			[4, 'g'],
		]) {
			const id = idsOfRow(rows, 1)[index];
			const x0 = 60 + 150 * index;
			const strokes = highBowl[char].map((stroke) =>
				stroke.map(([x, y]) => [x0 + x * 2, 520 + y * 2])
			);
			photo.parts[photo.parts.findIndex((part) => part.id === id)] = drawPart(strokes, 12, {
				width: 1400,
				height: 680,
				id,
			});
		}
		const info = photoScale(photo, FONT);
		expect(new Set(Object.values(info.scales)).size).toBe(1);
	});
});
