// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 (UX-BEGINNER.md 4.6): in Try it his letters are big. One line sits in the middle of the
	sheet, the way the strip centers it; words that run past the sheet's edge wrap onto more lines
	with an ordinary gap between them instead of falling off the sheet.
*/
import { describe, expect, it } from 'vitest';
import {
	centeringLineGap,
	TRY_IT_LINE_RATIO,
	TRY_IT_PAGE_PADDING,
	tryItLineGap,
	tryItLayout,
	writtenOffSheet,
} from '../layout.js';

const charData = (char, isVisible) => ({ char, isVisible });

describe('Try it line gaps', () => {
	it('wrapped lines: an ordinary gap, a share of the type size, in whole px', () => {
		expect(tryItLineGap(96)).toBe(Math.round(96 * TRY_IT_LINE_RATIO));
		expect(tryItLineGap(-5)).toBe(0);
		expect(tryItLineGap(NaN)).toBe(0);
	});

	it('one line: centered in the sheet; more lines: the ordinary gap', () => {
		const one = tryItLayout({ areaHeight: 500, fontSizePx: 96, wraps: false });
		expect(one.pagePadding).toBe(TRY_IT_PAGE_PADDING);
		expect(one.lineGap).toBe(centeringLineGap(500, TRY_IT_PAGE_PADDING, 96));
		const more = tryItLayout({ areaHeight: 500, fontSizePx: 96, wraps: true });
		expect(more.lineGap).toBe(tryItLineGap(96));
	});
});

describe('letters off the sheet', () => {
	it('a written letter the layout could not place is off the sheet; spaces never count', () => {
		expect(writtenOffSheet({ data: [[charData('a', true), charData(' ', false)]] })).toBe(false);
		expect(writtenOffSheet({ data: [[charData('a', true)], [charData('b', false)]] })).toBe(true);
		expect(writtenOffSheet(null)).toBe(false);
	});
});
