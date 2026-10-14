// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 finalize (hostile pass, finding 3): the 4.4 parts rule joined ink pieces whose
// left-to-right spans overlapped by half the narrower piece, whatever lay between them up and
// down, so on the How card's own whole-alphabet page every column of letters became one part
// (9 parts for 25 letters, the tallest 1,299 px). Pieces are now one letter only when they also
// share their height (a crossbar, a pen lift), or when one is a dot sitting close above or below
// its letter (i, j, !, ?, :, ;), even drifted a little to the side; a dot joins only the
// nearest piece.
// The stand-in finder is B9's reference for ink_parts.js.
import { describe, expect, it } from 'vitest';
import { LETTER_STROKES } from './letters.js';
import { arc, rasterize } from './raster.js';
import { findParts } from './ink_parts_lite.js';

const TWO_PI = Math.PI * 2;
const UNIT = 1.5;
const PEN = 9;
const W = 1400;
const H = 1000;

/** Extra strokes the shared helper has no shape for, in cap units (y down, line at 0) */
const MORE = {
	i: () => [
		[
			[0, -60],
			[0, 0],
		],
		[
			[0, -80],
			[1, -79],
		],
	],
	'!': () => [
		[
			[0, -100],
			[0, -24],
		],
		[
			[0, -4],
			[1, -5],
		],
	],
	// An i whose dot drifted right, as a slanted or hurried hand puts it
	í: () => [
		[
			[0, -60],
			[0, 0],
		],
		[
			[16, -80],
			[17, -79],
		],
	],
	':': () => [
		[
			[0, -40],
			[1, -41],
		],
		[
			[0, -4],
			[1, -5],
		],
	],
	'?': () => [
		[...arc(18, -78, 18, 20, Math.PI, TWO_PI * 1.15), [18, -40], [18, -24]],
		[
			[18, -4],
			[19, -5],
		],
	],
};

/**
 * A page of rows written one under the other, columns lined up and close together, as the How
 * card's whole-alphabet page comes out.
 */
function page(rows) {
	const strokes = [];
	const key = [];
	rows.forEach(({ chars, base }) => {
		[...chars].forEach((char, i) => {
			const x0 = 80 + i * 150;
			const shape = (MORE[char] || LETTER_STROKES[char])({});
			const pixels = shape.map((stroke) =>
				stroke.map(([x, y]) => [x0 + x * UNIT, base + y * UNIT])
			);
			strokes.push(...pixels);
			const ys = pixels.flat().map(([, y]) => y);
			const xs = pixels.flat().map(([x]) => x);
			key.push({
				char,
				x: (Math.min(...xs) + Math.max(...xs)) / 2,
				y: (Math.min(...ys) + Math.max(...ys)) / 2,
			});
		});
	});
	const mask = rasterize(W, H, strokes, PEN);
	return { key, parts: findParts(mask, W, H) };
}

const holds = (part, k) =>
	k.x >= part.left && k.x < part.right && k.y >= part.top && k.y < part.bottom;

describe('findParts on a whole page, rows written close under each other', () => {
	const rows = [
		{ chars: 'AQYHB', base: 190 },
		{ chars: 'aegijlm', base: 420 },
		{ chars: 'noipyuj', base: 690 },
		{ chars: '!,.:x?', base: 940 },
	];

	it('finds one part per letter: no column of letters becomes one part', () => {
		const { key, parts } = page(rows);
		expect(parts).toHaveLength(key.length);
		for (const part of parts) {
			expect(key.filter((k) => holds(part, k)).length, JSON.stringify(part.id)).toBe(1);
		}
	});

	it('i, j, !, ? and : keep their dots: each is one part', () => {
		const { key, parts } = page(rows);
		for (const k of key.filter((entry) => 'ij!?:'.includes(entry.char))) {
			const owner = parts.filter((part) => holds(part, k));
			expect(owner, k.char).toHaveLength(1);
			// The part reaches up (or down) to the dot
			const [part] = owner;
			expect(part.bottom - part.top, k.char).toBeGreaterThan(40 * UNIT);
		}
	});

	it('a dot drifted right of its stem still joins it, not the letter beside it', () => {
		const { key, parts } = page([
			{ chars: 'líl', base: 200 },
			{ chars: 'ní', base: 450 },
		]);
		expect(parts).toHaveLength(key.length);
		for (const k of key.filter((entry) => entry.char === 'í')) {
			const [part] = parts.filter((p) => holds(p, k));
			expect(part.bottom - part.top).toBeGreaterThan(70 * UNIT);
		}
	});

	it('parts come in reading order: rows top to bottom, left to right', () => {
		const { key, parts } = page(rows);
		const chars = parts.map((part) => key.find((k) => holds(part, k)).char).join('');
		expect(chars).toBe(rows.map((row) => row.chars).join(''));
	});
});
