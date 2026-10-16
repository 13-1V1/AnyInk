// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3: the side table (UX-BEGINNER 10, B3), base letters for accented ones, punctuation, and the
// width limits B11 uses.
import { describe, expect, it } from 'vitest';
import {
	NARROW_LETTERS,
	SIDE,
	baseLetter,
	isNaturallyNarrow,
	isPunctuation,
	lineHeightOf,
	tableSides,
	widthLimits,
	widthProblem,
} from '../letter_classes.js';
import { GRIDS, letter, rect, spacingProject } from './fixtures.js';

const TABLE = {
	'S/S': 'HIMNUhilmnu!',
	'S/R': 'BDPbp',
	'S/O': 'EFKLRkrtf',
	'R/R': 'OQSos.,?',
	'R/S': 'adgqG',
	'R/O': 'Cce',
	'O/S': 'Jj',
	'O/O': "ATVWXYZvwxyz'-",
};

describe('the side table', () => {
	it.each(Object.entries(TABLE))('%s: %s', (pair, chars) => {
		const [left, right] = pair.split('/');
		[...chars].forEach((char) => {
			expect(tableSides(char), char).toEqual({ left, right });
		});
	});

	it('covers every capital and small letter exactly once', () => {
		const all = Object.values(TABLE).join('');
		expect(new Set(all).size).toBe(all.length);
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('').forEach((char) => {
			expect(tableSides(char), char).not.toBeNull();
		});
	});

	it('uses the three side kinds by name', () => {
		expect(SIDE).toEqual({ straight: 'S', round: 'R', open: 'O' });
	});

	it('gives an accented letter its base letter: é is like e, Ö like O, ñ like n', () => {
		expect(baseLetter('é')).toBe('e');
		expect(tableSides('é')).toEqual({ left: 'R', right: 'O' });
		expect(tableSides('Ö')).toEqual({ left: 'R', right: 'R' });
		expect(tableSides('ñ')).toEqual({ left: 'S', right: 'S' });
	});

	it('has no entry for numbers, other symbols or letters it does not know', () => {
		['1', '7', 'ß', 'Ħ', 'ø', '&', '|', ' ', '', 'ab'].forEach((char) => {
			expect(tableSides(char), char).toBeNull();
		});
	});
});

describe('punctuation', () => {
	it('is every punctuation mark, and nothing else', () => {
		[...'.,\'?!-:;"()/'].forEach((char) => expect(isPunctuation(char), char).toBe(true));
		[...'aZ1| +$~'].forEach((char) => expect(isPunctuation(char), char).toBe(false));
		expect(isPunctuation('')).toBe(false);
		expect(isPunctuation('..')).toBe(false);
	});
});

describe('line heights', () => {
	it.each([1000, 2048])('follow the letter type at %i units', (grid) => {
		const font = GRIDS[grid];
		expect(lineHeightOf('n', font)).toBe(font.xHeight);
		expect(lineHeightOf('g', font)).toBe(font.xHeight);
		expect(lineHeightOf('b', font)).toBe(font.ascent);
		expect(lineHeightOf('t', font)).toBe((font.xHeight + font.ascent) / 2);
		expect(lineHeightOf('H', font)).toBe(font.capHeight);
		expect(lineHeightOf('7', font)).toBe(font.capHeight);
		expect(lineHeightOf('é', font)).toBe(font.xHeight);
		expect(lineHeightOf('ŋ', font)).toBe(font.xHeight);
	});
});

describe('width limits (B11 uses them)', () => {
	it('gives naturally narrow letters no lower limit', () => {
		expect(NARROW_LETTERS).toBe("ijlI1!.,':;-|");
		[...NARROW_LETTERS, 'í'].forEach((char) => {
			expect(isNaturallyNarrow(char), char).toBe(true);
			expect(widthLimits(char, GRIDS[2048]).min, char).toBeNull();
		});
		expect(isNaturallyNarrow('n')).toBe(false);
	});

	it.each([1000, 2048])(
		'at %i units: 25%% of its own line height, 150%% of the letter box',
		(grid) => {
			const font = GRIDS[grid];
			expect(widthLimits('n', font)).toEqual({
				min: Math.round(font.xHeight * 0.25),
				max: Math.round(font.upm * 1.5),
			});
			expect(widthLimits('H', font).min).toBe(Math.round(font.capHeight * 0.25));
			expect(widthLimits('b', font).min).toBe(Math.round(font.ascent * 0.25));
			expect(widthLimits('.', font)).toEqual({ min: null, max: Math.round(font.upm * 1.5) });
		}
	);

	it('names a letter too narrow or too wide, and leaves an empty one alone', () => {
		const font = GRIDS[2048];
		const project = spacingProject(2048, {
			n: { shapes: [rect(10, 0, 100, 1100)], advanceWidth: 120 },
			m: { shapes: [rect(10, 0, 3100, 1100)], advanceWidth: 3200 },
			o: { shapes: [rect(10, 0, 600, 1100)], advanceWidth: 700 },
			i: { shapes: [rect(10, 0, 40, 1100)], advanceWidth: 60 },
			x: { shapes: [], advanceWidth: 0 },
		});
		expect(widthProblem(letter(project, 'n'), font)).toBe('narrow');
		expect(widthProblem(letter(project, 'm'), font)).toBe('wide');
		expect(widthProblem(letter(project, 'o'), font)).toBeNull();
		expect(widthProblem(letter(project, 'i'), font)).toBeNull();
		expect(widthProblem(letter(project, 'x'), font)).toBeNull();
	});
});
