// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, written to fail first: Simple's font file toasts say "Made", as Use in
// Word's card does ("Made BrennanHand-Test1.otf."), never "Exported" (2.3 calls it a font file
// he makes).
import { describe, expect, it } from 'vitest';
import { word } from '../words.js';

describe('the font file toasts say Made', () => {
	it('made, and made but a letter needs fixing', () => {
		expect(word('toast.fontFileExported', { file: 'A.otf', folder: 'My Fonts' })).toBe(
			'Made A.otf in My Fonts'
		);
		expect(
			word('check.exportedButNeedsFixing', {
				file: 'A.otf',
				folder: 'My Fonts',
				clause: 'small a needs fixing.',
			})
		).toBe('Made A.otf in My Fonts, but small a needs fixing.');
	});
});
