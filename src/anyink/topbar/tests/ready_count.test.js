// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 (UX-BEGINNER.md 4.0 Top bar "1 Letters 7/58", 4.2 Letter set): the rail's ready count is
// ready / total over the board's letter set, the Quick font (58) or the Quick font with Numbers &
// symbols; the space is never counted, letters outside the set never count, and counting never
// makes a letter record.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { setModeForTests } from '../../mode/mode.js';
import { B, R, square, twoLetterProject } from '../../history/tests/two_letters.js';
import { boardLetters, NUMBERS_SET, QUICK_SET, readyCount } from '../ready_count.js';

afterEach(() => {
	setModeForTests('all');
	vi.restoreAllMocks();
});

describe('the board letter set', () => {
	it("the Quick font: A to Z, a to z and . , ' ? ! - (58 letters, no space)", () => {
		expect(QUICK_SET).toHaveLength(58);
		expect(QUICK_SET).not.toContain(' ');
		expect(QUICK_SET.slice(52)).toEqual(['.', ',', "'", '?', '!', '-']);
		expect(boardLetters(twoLetterProject())).toEqual([...QUICK_SET]);
	});

	it('+ Numbers & symbols adds 0 to 9 and : ; " ( ) & @ # $ % / *', () => {
		const project = twoLetterProject();
		project.settings.anyink = { ...(project.settings.anyink || {}), letterSet: 'quick+numbers' };
		expect(NUMBERS_SET).toHaveLength(22);
		expect(boardLetters(project)).toHaveLength(58 + 22);
	});
});

describe('ready / total', () => {
	it('a new font: 0 of 58, and counting makes no letter record', () => {
		const project = twoLetterProject();
		const before = Object.keys(project.glyphs).sort();
		expect(readyCount(project)).toEqual({ ready: 0, total: 58 });
		expect(Object.keys(project.glyphs).sort()).toEqual(before);
	});

	it('a letter with ink is ready (until B11 brings the checks); an empty record is not', () => {
		const project = twoLetterProject();
		project.glyphs[B].addOneShape(square());
		expect(readyCount(project)).toEqual({ ready: 1, total: 58 });
		project.glyphs[R].addOneShape(square());
		expect(readyCount(project)).toEqual({ ready: 2, total: 58 });
	});

	it('letters outside the set never count (a space, a number before Numbers & symbols)', () => {
		const project = twoLetterProject();
		project.addItemByType(new Glyph({ id: 'glyph-0x37' }), 'Glyph', 'glyph-0x37');
		project.glyphs['glyph-0x37'].addOneShape(square());
		expect(readyCount(project)).toEqual({ ready: 0, total: 58 });
		project.settings.anyink = { ...(project.settings.anyink || {}), letterSet: 'quick+numbers' };
		expect(readyCount(project)).toEqual({ ready: 1, total: 80 });
	});

	it('B11 passes its own rule', () => {
		const project = twoLetterProject();
		project.glyphs[B].addOneShape(square());
		project.glyphs[R].addOneShape(square());
		const isReady = (item, char) => char !== 'r';
		expect(readyCount(project, { isReady })).toEqual({ ready: 1, total: 58 });
	});
});
