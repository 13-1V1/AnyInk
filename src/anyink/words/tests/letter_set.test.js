// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "'Basic Latin' / 'General Punctuation' (Unicode block names) on
// the Simple Overview and letter chooser"). UX-BEGINNER.md 2.4 E: a character range or Unicode
// block is a "letter set" and its name and codes are never shown in Simple. letterSetName(range)
// names a range the project has enabled in house words; a range with no house name is named by
// a few of its own letters, never a code.
import { describe, expect, it } from 'vitest';
import { findBanned, findNeverShown } from '../banned.js';
import { letterSetName } from '../letter_set.js';

const range = (begin, end, name) => ({ begin, end, name, enabled: true });

describe('letterSetName', () => {
	it('the ranges a font usually has', () => {
		expect(letterSetName(range(0x20, 0x7e, 'Basic Latin'))).toBe(
			'Letters, numbers and punctuation'
		);
		expect(letterSetName(range(0x21, 0x7f, 'Basic Latin'))).toBe(
			'Letters, numbers and punctuation'
		);
		expect(letterSetName(range(0xa0, 0xff, 'Latin-1 Supplement'))).toBe('Accented letters');
		expect(letterSetName(range(0x100, 0x17f, 'Latin Extended-A'))).toBe('More accented letters');
		expect(letterSetName(range(0x180, 0x24f, 'Latin Extended-B'))).toBe('More accented letters');
		expect(letterSetName(range(0x2000, 0x206f, 'General Punctuation'))).toBe('Punctuation');
	});

	it('any other range: a few of its own letters, no name or code', () => {
		expect(letterSetName(range(0x391, 0x3a9, 'Greek and Coptic'))).toBe('Letters like Α Β Γ');
		expect(letterSetName(range(0x20a0, 0x20cf, 'Currency Symbols'))).toBe('Letters like ₠ ₡ ₢');
	});

	it("names nothing it can't show: no Unicode block name, no code, no banned word", () => {
		const ranges = [
			range(0x20, 0x7e, 'Basic Latin'),
			range(0xa0, 0xff, 'Latin-1 Supplement'),
			range(0x2000, 0x206f, 'General Punctuation'),
			range(0x391, 0x3a9, 'Greek and Coptic'),
			range(0x0, 0x1f, 'Basic Latin Controls'),
			{},
		];
		ranges.forEach((r) => {
			const name = letterSetName(r);
			expect(name).not.toBe('');
			expect(findBanned(name)).toEqual([]);
			expect(findNeverShown(name)).toEqual([]);
			expect(name).not.toMatch(/0x|U\+|\b[0-9A-F]{4}\b/);
		});
	});
});
