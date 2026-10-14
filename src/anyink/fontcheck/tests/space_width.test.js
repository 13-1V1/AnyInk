// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 fix: one click on the Space tile makes a space with no shapes and width 0, and the
	File menu export writes it 0 wide, so every word typed in Word runs together. The
	export stays as it is (B1 leaves the File menu export unchanged; B14's addSpaceIfMissing
	replaces that space), and the font check names it so the preview's run-together words
	have a reason next to them.
*/
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { PROBLEM, validateFont } from '../validate.js';
import { edgeProjectJSON, openProject, square } from './fixtures.js';

const NO_SPACE_WIDTH = {
	itemId: 'glyph-0x20',
	problem: PROBLEM.spaceNoWidth,
	message: 'The space has no width, so your words would run together.',
};

/** The edge project (it has no space) with these extra letters and settings. */
function openWith(glyphs = {}, app = {}) {
	const json = edgeProjectJSON({ app });
	Object.assign(json.glyphs, glyphs);
	return openProject(json);
}

/** The space's width in the exported font file. */
async function exportedSpaceWidth() {
	const buffer = await ioFont_exportFont('otf', true);
	return FontFlux.open(buffer).glyphs.find((g) => g.unicode === 0x20)?.advanceWidth;
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('a space with no width', () => {
	it('opening the Space tile once is enough, and the check says so', async () => {
		const editor = openWith();
		expect(validateFont(editor.project)).toEqual([]);
		// no space yet: the font file gets the font library's quarter-wide one
		expect(await exportedSpaceWidth()).toBe(512);

		editor.selectedGlyphID = 'glyph-0x20';
		expect(editor.selectedGlyph.shapes).toHaveLength(0); // the tile only opened it
		expect(validateFont(editor.project)).toEqual([NO_SPACE_WIDTH]);
		// the check agrees with the font file: that space really is 0 wide
		expect(await exportedSpaceWidth()).toBe(0);
	});

	it('a no-break space with no width is named too (B1 fix pass)', () => {
		const { project } = openWith({
			'glyph-0xA0': { id: 'glyph-0xA0', advanceWidth: 0, shapes: [] },
		});
		project.settings.project.characterRanges[1].enabled = true; // Latin-1 Supplement
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0xA0',
				problem: PROBLEM.spaceNoWidth,
				message: 'The no-break space has no width, so your words would run together.',
			},
		]);
	});

	it('a width that rounds to 0 counts', () => {
		const { project } = openWith({
			'glyph-0x20': { id: 'glyph-0x20', advanceWidth: 0.4, shapes: [] },
		});
		expect(validateFont(project)).toEqual([NO_SPACE_WIDTH]);
	});

	it('a space with ink and no width is named once, for the ink', () => {
		const { project } = openWith({
			'glyph-0x20': { id: 'glyph-0x20', advanceWidth: 0, shapes: [square()] },
		});
		expect(validateFont(project).map((p) => p.problem)).toEqual([PROBLEM.inkNoWidth]);
	});
});

describe('spaces that are fine', () => {
	it('a space with a width', () => {
		const { project } = openWith({
			'glyph-0x20': { id: 'glyph-0x20', advanceWidth: 512, shapes: [] },
		});
		expect(validateFont(project)).toEqual([]);
	});

	it('an opened space the font file leaves out (unedited letters off)', () => {
		const editor = openWith({}, { exportUneditedItems: false });
		editor.selectedGlyphID = 'glyph-0x20';
		expect(editor.selectedGlyph.shapes).toHaveLength(0);
		expect(validateFont(editor.project)).toEqual([]);
	});

	it('with addSpaceIfMissing, the export replaces it, so nothing is named', () => {
		const editor = openWith();
		editor.selectedGlyphID = 'glyph-0x20';
		expect(editor.selectedGlyph.shapes).toHaveLength(0);
		expect(validateFont(editor.project, { addSpaceIfMissing: true })).toEqual([]);
	});

	it('other empty letters with no width are not named (they have no ink)', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 0, shapes: [] },
		});
		expect(validateFont(project)).toEqual([]);
	});
});
