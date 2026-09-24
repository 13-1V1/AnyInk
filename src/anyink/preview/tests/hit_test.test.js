// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { findCharAtPoint, navigationTargetForChar } from '../hit_test.js';

const font = { ascent: 800, descent: -200 };
const dz = 0.1; // 100 px per 1000 units

function charData(char, id, dx, advance = 500, extra = {}) {
	return {
		char,
		item: id ? { id } : undefined,
		view: { dx, dy: 100, dz },
		widths: { advance, kern: 0, aggregate: 0 },
		isVisible: true,
		lineNumber: 0,
		...extra,
	};
}

// "AB C": A at 10..60, B at 60..110, space 110..135, C 135..185; baseline y = 100
const data = [
	[
		charData('A', 'glyph-0x41', 10),
		charData('B', 'glyph-0x42', 60),
		charData(' ', 'glyph-0x20', 110, 250),
		charData('C', 'glyph-0x43', 135),
	],
];

describe('findCharAtPoint', () => {
	it('finds the glyph whose advance box contains the point', () => {
		expect(findCharAtPoint(data, 30, 60, font).char).toBe('A');
		expect(findCharAtPoint(data, 61, 60, font).char).toBe('B');
		expect(findCharAtPoint(data, 150, 60, font).char).toBe('C');
	});

	it('uses ascent above and descent below the baseline', () => {
		expect(findCharAtPoint(data, 30, 20, font).char).toBe('A'); // 100 - 80 = 20 is the top
		expect(findCharAtPoint(data, 30, 19, font)).toBe(false);
		expect(findCharAtPoint(data, 30, 120, font).char).toBe('A'); // 100 + 20 = 120 is the bottom
		expect(findCharAtPoint(data, 30, 121, font)).toBe(false);
	});

	it('misses gaps and the space between words', () => {
		expect(findCharAtPoint(data, 5, 60, font)).toBe(false);
		expect(findCharAtPoint(data, 200, 60, font)).toBe(false);
		expect(findCharAtPoint(data, 120, 60, font).char).toBe(' ');
	});

	it('ignores characters that were never laid out', () => {
		const hidden = [[charData('Z', 'glyph-0x5A', 10, 500, { isVisible: false })]];
		expect(findCharAtPoint(hidden, 30, 60, font)).toBe(false);
		const noView = [[charData('Z', 'glyph-0x5A', 10, 500, { view: false })]];
		expect(findCharAtPoint(noView, 30, 60, font)).toBe(false);
	});

	it('copes with a positive descent and bad input', () => {
		expect(findCharAtPoint(data, 30, 120, { ascent: 800, descent: 200 }).char).toBe('A');
		expect(findCharAtPoint(undefined, 0, 0, font)).toBe(false);
		expect(findCharAtPoint(data, 30, 60, undefined)).toBe(false);
	});
});

describe('navigationTargetForChar', () => {
	it('sends glyphs to Characters and ligatures to Ligatures', () => {
		expect(navigationTargetForChar(charData('A', 'glyph-0x41', 0))).toEqual({
			id: 'glyph-0x41',
			page: 'Characters',
		});
		expect(navigationTargetForChar(charData('fi', 'liga-fi', 0))).toEqual({
			id: 'liga-fi',
			page: 'Ligatures',
		});
	});

	it('does nothing for missing items or other ids', () => {
		expect(navigationTargetForChar(charData('?', undefined, 0))).toBe(false);
		expect(navigationTargetForChar(charData('k', 'kern-0', 0))).toBe(false);
		expect(navigationTargetForChar(false)).toBe(false);
	});
});
