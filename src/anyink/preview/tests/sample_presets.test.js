// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	CONTROL_STRINGS,
	DEFAULT_SAMPLE_TEXT,
	GLYPH_SETS,
	PANGRAMS,
	makeGlyphContextText,
	makePresetRows,
} from '../sample_presets.js';
import { word } from '../../words/words.js';

const isPangram = (text) =>
	'abcdefghijklmnopqrstuvwxyz'.split('').every((letter) => text.toLowerCase().includes(letter));

describe('preset data', () => {
	it('every pangram really uses every letter', () => {
		PANGRAMS.forEach((text) => expect(isPangram(text), text).toBe(true));
	});

	it('the default sample text is the first pangram (matches upstream)', () => {
		expect(DEFAULT_SAMPLE_TEXT).toBe('the five boxing wizards jump quickly');
		expect(PANGRAMS[0]).toBe(DEFAULT_SAMPLE_TEXT);
	});

	it('has the HHAV and nnav control strings', () => {
		expect(CONTROL_STRINGS.map((row) => row.name)).toEqual(['HHAV', 'nnav']);
		expect(CONTROL_STRINGS[0].text.startsWith('HHAV')).toBe(true);
		expect(CONTROL_STRINGS[1].text.startsWith('nnav')).toBe(true);
	});

	it('glyph sets are a-z, A-Z, 0-9', () => {
		expect(GLYPH_SETS.map((row) => row.text)).toEqual([
			'abcdefghijklmnopqrstuvwxyz',
			'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
			'0123456789',
		]);
	});
});

describe('makeGlyphContextText', () => {
	it('puts the glyph between straight and round neighbors', () => {
		expect(makeGlyphContextText('a')).toBe('HHaHHOOaOO nnannooaoo');
	});

	it('prefers a stored context string that differs from the glyph', () => {
		expect(makeGlyphContextText('a', 'cat')).toBe('cat');
		expect(makeGlyphContextText('a', 'a')).toBe('HHaHHOOaOO nnannooaoo');
	});

	it('returns nothing without a glyph', () => {
		expect(makeGlyphContextText('')).toBe('');
		expect(makeGlyphContextText(undefined, 'stored')).toBe('');
	});
});

describe('makePresetRows', () => {
	it('lists context, pangrams, control strings, then glyph sets', () => {
		const rows = makePresetRows({ currentChar: 'g' });
		const groups = [...new Set(rows.map((row) => row.group))];
		expect(groups).toEqual(['context', 'pangrams', 'control', 'sets']);
		expect(rows[0].text).toBe(makeGlyphContextText('g'));
		// B4: in house words (strip_words.test.js): 'small g with its neighbors'
		expect(rows[0].name).toBe(word('strip.sampleNeighbors', { letter: 'small g' }));
		expect(rows.filter((row) => row.group === 'pangrams')).toHaveLength(PANGRAMS.length);
		expect(rows.filter((row) => row.group === 'sets')).toHaveLength(3);
	});

	// B1 fix pass: the Presets hints said "glyph" and "26 glyphs" (UX-BEGINNER 2.3 bans the word)
	it('hints use house words: letters, capitals, small letters', () => {
		const notes = makePresetRows({ currentChar: 'g' }).map((row) => row.note);
		notes.forEach((note) => expect(note).not.toMatch(/\bglyphs?\b|\bcaps\b|\blowercase\b/i));
		expect(notes).toContain('this letter');
		expect(notes).toContain('26 letters');
		expect(notes).toContain('capitals');
		expect(notes).toContain('small letters');
	});

	it('skips the context row when no glyph is being edited', () => {
		const rows = makePresetRows();
		expect(rows[0].group).toBe('pangrams');
		expect(rows.some((row) => row.group === 'context')).toBe(false);
	});

	it('every row has text and a name', () => {
		makePresetRows({ currentChar: 'A', storedContext: 'HAH' }).forEach((row) => {
			expect(typeof row.name).toBe('string');
			expect(row.name.length).toBeGreaterThan(0);
			expect(row.text.length).toBeGreaterThan(0);
		});
	});
});
