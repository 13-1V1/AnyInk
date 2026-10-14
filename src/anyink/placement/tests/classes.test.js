// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement: the vertical class of every letter and its target lines (UX-BEGINNER B3).
import { describe, expect, it } from 'vitest';
import {
	feedsScale,
	guideLines,
	isPunctuation,
	isRoundLetter,
	lineTargets,
	tailKind,
	verticalClass,
} from '../classes.js';

// The upstream new-font metrics (glyphr_studio_project.js): the five guide lines.
const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const O = 0.015 * 2048; // round overshoot, 30.72 units

describe('verticalClass: every letter is in exactly one class', () => {
	const table = {
		small: 'acemnorsuvwxz',
		tall: 'bdfhkl',
		t: 't',
		i: 'i',
		tail: 'gjpqy',
		capital: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		figure: '0123456789',
		period: '.',
		comma: ',',
		apostrophe: '\'"`',
		mark: '?!',
		hyphen: '-',
		colon: ':',
		semicolon: ';',
		bracket: '()[]{}',
	};
	for (const [name, chars] of Object.entries(table)) {
		it(`${name}: ${chars}`, () => {
			for (const char of chars) expect(verticalClass(char), char).toBe(name);
		});
	}

	it('the 26 + 26 letters fall in one class each, and none is left as a symbol', () => {
		const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		for (const char of letters) expect(verticalClass(char), char).not.toBe('symbol');
	});

	it('anything else is a symbol on the capitals line; accented letters follow their case', () => {
		expect(verticalClass('&')).toBe('symbol');
		expect(verticalClass('@')).toBe('symbol');
		expect(verticalClass('É')).toBe('capital');
		expect(verticalClass('é')).toBe('small');
		expect(verticalClass('')).toBe('symbol');
		expect(verticalClass(undefined)).toBe('symbol');
		expect(verticalClass('ab')).toBe('symbol');
	});
});

describe('round letters, tails, punctuation and what feeds the photo scale', () => {
	it('round letters are exactly o c e s O C G Q S', () => {
		const round = [...'ocesOCGQS'];
		for (const char of round) expect(isRoundLetter(char), char).toBe(true);
		for (const char of 'abdgnpquvxyzBDHIQ'.replace('Q', ''))
			expect(isRoundLetter(char), char).toBe(false);
		expect(isRoundLetter('.')).toBe(false);
	});

	it('g j p q y always have a tail; Q J f may; the comma and semicolon hang one too', () => {
		for (const char of 'gjpqy,;') expect(tailKind(char), char).toBe('always');
		for (const char of 'QJf') expect(tailKind(char), char).toBe('optional');
		for (const char of "aBbdtO.'?-") expect(tailKind(char), char).toBe('never');
	});

	it('punctuation and symbols never feed the scale; plain letters do; numbers do not', () => {
		for (const char of '.,\'"?!-:;()&') {
			expect(isPunctuation(char), char).toBe(true);
			expect(feedsScale(char), char).toBe(false);
		}
		for (const char of 'aBgQfH') {
			expect(isPunctuation(char), char).toBe(false);
			expect(feedsScale(char), char).toBe(true);
		}
		expect(feedsScale('7')).toBe(false);
		expect(feedsScale('É')).toBe(false);
	});
});

describe('guideLines', () => {
	it('reads the five lines and the letter box from the font settings', () => {
		expect(guideLines(FONT)).toEqual({
			top: 1550,
			capitals: 1480,
			small: 1100,
			writing: 0,
			tail: -440,
			box: 2048,
			overshoot: O,
		});
	});

	it('a positive descent still means a line below the writing line', () => {
		expect(guideLines({ ...FONT, descent: 440 }).tail).toBe(-440);
	});

	it('missing settings fall back to the new-font values', () => {
		expect(guideLines({})).toEqual(guideLines(FONT));
		expect(guideLines(undefined)).toEqual(guideLines(FONT));
	});
});

describe('lineTargets (font units, y-up)', () => {
	const t = (char, options) => lineTargets(char, FONT, options);

	it('small letters: small-letter line to writing line', () => {
		expect(t('a')).toMatchObject({ top: 1100, bottom: 0, seat: 'bottom', round: false });
		expect(t('n')).toMatchObject({ top: 1100, bottom: 0 });
	});

	it('round letters get 1.5 % of the letter box above and below', () => {
		expect(t('o').top).toBeCloseTo(1100 + O, 6);
		expect(t('o').bottom).toBeCloseTo(-O, 6);
		expect(t('O').top).toBeCloseTo(1480 + O, 6);
		expect(t('Q').bottom).toBeCloseTo(-O, 6);
		expect(t('S').round).toBe(true);
	});

	it('tall letters reach the top line; t stops halfway; the i dot sits 60 % of the way up', () => {
		expect(t('b')).toMatchObject({ top: 1550, bottom: 0 });
		expect(t('f')).toMatchObject({ top: 1550, bottom: 0 });
		expect(t('t').top).toBe(1325);
		expect(t('i').top).toBeCloseTo(1100 + 0.6 * 450, 6);
	});

	it('tail letters: body on the small-letter line, tail to 90 % of the tail line; j dots like i', () => {
		expect(t('g')).toMatchObject({ top: 1100, bottom: 0, tailBottom: -396 });
		expect(t('y').tailBottom).toBe(-396);
		expect(t('j').top).toBeCloseTo(1370, 6);
		expect(t('j').tailBottom).toBe(-396);
	});

	it('capitals sit on the capitals line; Q J f can carry a tail when it is on', () => {
		expect(t('B')).toMatchObject({ top: 1480, bottom: 0, tailBottom: null });
		expect(t('J')).toMatchObject({ top: 1480, tailBottom: null });
		expect(t('J', { tail: true }).tailBottom).toBe(-396);
		expect(t('f', { tail: true }).tailBottom).toBe(-396);
		// Q's tail has no line of its own: its size comes from the bowl
		expect(t('Q', { tail: true }).tailBottom).toBe(null);
		// [No tail] turns an always-tail letter into a plain one
		expect(t('g', { tail: false }).tailBottom).toBe(null);
	});

	it('period and comma: 12 % of the small-letter height; the comma tail reaches 40 % toward the tail line', () => {
		expect(t('.').top).toBeCloseTo(132, 6);
		expect(t('.').bottom).toBe(0);
		expect(t(',').top).toBeCloseTo(132, 6);
		expect(t(',').tailBottom).toBeCloseTo(-176, 6);
	});

	it("' hangs from the capitals line, 25 % of its height; ? and ! use the capitals line", () => {
		expect(t("'")).toMatchObject({ top: 1480, bottom: 1110, seat: 'top' });
		expect(t('?')).toMatchObject({ top: 1480, bottom: 0, seat: 'bottom' });
		expect(t('!')).toMatchObject({ top: 1480, bottom: 0 });
	});

	it('the hyphen is centered on half the small-letter height and sized by its width', () => {
		const hyphen = t('-');
		expect(hyphen.seat).toBe('center');
		expect(hyphen.center).toBe(550);
		expect(hyphen.width).toBe(550);
	});

	it('numbers sit on the capitals line', () => {
		expect(t('7')).toMatchObject({ top: 1480, bottom: 0, seat: 'bottom' });
	});

	it('every target is in font units of this font (a 1,000 box scales)', () => {
		const small = { upm: 1000, ascent: 750, capHeight: 700, xHeight: 500, descent: -250 };
		expect(lineTargets('o', small).bottom).toBeCloseTo(-15, 6);
		expect(lineTargets('g', small).tailBottom).toBe(-225);
		expect(lineTargets('.', small).top).toBeCloseTo(60, 6);
	});
});
