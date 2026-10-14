// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { PROBLEM } from '../../fontcheck/validate.js';
import { SHOW_ME, buildFailureText, firstCheckProblem, hintFor, moreText } from '../font_status.js';

const BANNED = /\b(glyph|character|unicode|otf|advance|metrics|baseline|path|item)\b/i;

describe('buildFailureText', () => {
	it('says in plain words which letter keeps the font from showing', () => {
		expect(buildFailureText({ name: 'small a' })).toBe(
			"Can't show your font yet: small a needs fixing."
		);
		expect(buildFailureText({ name: 'the joined letters ff', plural: true })).toBe(
			"Can't show your font yet: the joined letters ff need fixing."
		);
	});

	it('still says so when no letter can be named', () => {
		const text = buildFailureText(null);
		expect(text).toBe("Can't show your font yet: one of your letters needs fixing.");
		expect(text).not.toMatch(BANNED);
	});

	it('labels the button with a verb', () => {
		expect(SHOW_ME).toBe('Show me');
	});
});

describe('firstCheckProblem', () => {
	const a = {
		itemId: 'glyph-0x61',
		problem: 'width',
		message: "small a has a problem the font file can't hold.",
	};
	const b = {
		itemId: 'glyph-0x62',
		problem: 'points',
		message: "small b has a problem the font file can't hold.",
	};
	const c = {
		...b,
		itemId: 'glyph-0x63',
		message: "small c has a problem the font file can't hold.",
	};

	it('picks the first problem the font check found, and its kind', () => {
		expect(firstCheckProblem({ problems: [a] })).toEqual({
			itemId: 'glyph-0x61',
			problem: 'width',
			text: a.message,
			more: 0,
			moreGaps: 0,
		});
	});

	it('counts gaps apart from letters (B1 fix pass): a gap is not a letter', () => {
		const gap = { itemId: 'kern-0', problem: PROBLEM.kern, message: 'The gap between ... can hold.' };
		const gap2 = { ...gap, itemId: 'kern-3' };
		expect(firstCheckProblem({ problems: [a, gap] })).toMatchObject({ more: 0, moreGaps: 1 });
		expect(firstCheckProblem({ problems: [a, b, gap, gap2] })).toMatchObject({ more: 1, moreGaps: 2 });
		expect(firstCheckProblem({ problems: [gap, a, gap2] })).toMatchObject({
			itemId: 'kern-0',
			more: 1,
			moreGaps: 1,
		});
	});

	it('counts the other letters with problems, each letter once', () => {
		const a2 = { ...a, problem: 'points', message: 'small a has a second problem.' };
		expect(firstCheckProblem({ problems: [a, a2, b, c] }).more).toBe(2);
		expect(firstCheckProblem({ problems: [a, a2] }).more).toBe(0);
	});

	it('gives null when the font is fine', () => {
		expect(firstCheckProblem({ problems: [] })).toBe(null);
	});

	it('skips entries with no words and survives odd payloads', () => {
		expect(firstCheckProblem({ problems: [{ itemId: 'glyph-0x61' }, b] })).toEqual({
			itemId: 'glyph-0x62',
			problem: 'points',
			text: b.message,
			more: 0,
			moreGaps: 0,
		});
		expect(firstCheckProblem(undefined)).toBe(null);
		expect(firstCheckProblem({})).toBe(null);
		expect(firstCheckProblem({ problems: 'nope' })).toBe(null);
		expect(firstCheckProblem({ problems: [{ message: 'no id' }] })).toEqual({
			itemId: null,
			problem: null,
			text: 'no id',
			more: 0,
			moreGaps: 0,
		});
	});
});

describe('moreText', () => {
	it('says how many more letters need fixing, in plain words', () => {
		expect(moreText(0)).toBe('');
		expect(moreText(1)).toBe('1 more letter needs fixing too.');
		expect(moreText(2)).toBe('2 more letters need fixing too.');
		expect(moreText(undefined)).toBe('');
		expect(moreText(2)).not.toMatch(BANNED);
	});

	it('names gaps as gaps, never as letters (B1 fix pass)', () => {
		// after a letter
		expect(moreText(0, 1)).toBe('1 gap needs fixing too.');
		expect(moreText(0, 2)).toBe('2 gaps need fixing too.');
		expect(moreText(2, 1)).toBe('2 more letters and 1 gap need fixing too.');
		// after a gap
		expect(moreText(0, 1, true)).toBe('1 more gap needs fixing too.');
		expect(moreText(1, 0, true)).toBe('1 letter needs fixing too.');
		expect(moreText(1, 2, true)).toBe('1 letter and 2 more gaps need fixing too.');
		expect(moreText(2, 1)).not.toMatch(BANNED);
	});
});

describe('hintFor (B1 fix pass)', () => {
	it('says what to do when Fix it cannot fix it, in one plain sentence', () => {
		expect(hintFor(PROBLEM.point, false)).toBe('Show me, then drag the far point back near the letter.');
		expect(hintFor(PROBLEM.kern, false)).toBe('Show me, then set the gap to a smaller number.');
		expect(hintFor(PROBLEM.shape, false)).toBe(
			'Show me, then delete the stray shape in the letter it is made from.'
		);
		[PROBLEM.point, PROBLEM.kern, PROBLEM.shape].forEach((kind) =>
			expect(hintFor(kind, false)).not.toMatch(BANNED)
		);
	});

	it('says nothing more when Fix it is there, or for an unknown kind', () => {
		expect(hintFor(PROBLEM.inkNoWidth, true)).toBe('');
		expect(hintFor(PROBLEM.shape, true)).toBe('');
		expect(hintFor('something-else', false)).toBe('');
		expect(hintFor(null, false)).toBe('');
	});
});
