// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: the font check and the export use one list of letters, so they can never disagree
	(UX-BEGINNER 7.2). For each way the list can change, the letters the check looks at
	are exactly the letters in the exported font file, and a broken letter is named by the
	check only when the font file holds it.
*/
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { checkedItems, validateFont } from '../validate.js';
import { edgeProjectJSON, openProject, twoPointShape } from './fixtures.js';

/** Our own names for the letters in a font file (FontFlux's stand-in space is not ours). */
function lettersInFont(buffer) {
	return FontFlux.open(buffer)
		.glyphs.map((glyph) => glyph.name)
		.filter((name) => /^(uni[0-9A-F]{4}|u[0-9A-F]{6}|lig\..+)$/.test(name))
		.sort();
}

/** The same names for the letters the check looks at. */
function lettersChecked(project, options) {
	return checkedItems(project, options)
		.map((item) => {
			if (item.id.startsWith('liga-')) {
				return (
					'lig.' +
					item.gsub.map((code) => code.toString(16).toUpperCase().padStart(4, '0')).join('.')
				);
			}
			return 'uni' + parseInt(item.id.slice(6), 16).toString(16).toUpperCase().padStart(4, '0');
		})
		.sort();
}

const VARIANTS = [
	['the File menu export (all options off)', {}, {}],
	['unedited letters left out', { app: { exportUneditedItems: false } }, {}],
	['ligatures off', { app: { exportLigatures: false } }, {}],
	['omitEmptyLetters', {}, { omitEmptyLetters: true }],
	['addSpaceIfMissing', {}, { addSpaceIfMissing: true }],
	['both options', {}, { omitEmptyLetters: true, addSpaceIfMissing: true }],
];

function openVariant(overrides) {
	const editor = openProject(edgeProjectJSON(overrides));
	editor.selectedGlyphID = 'glyph-0x45'; // E opened and never edited
	return editor.selectedGlyph && editor;
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('the check and the export use the same list', () => {
	for (const [name, overrides, options] of VARIANTS) {
		it(`${name}: the check looks at exactly the letters in the font file`, async () => {
			const { project } = openVariant(overrides);
			const checked = lettersChecked(project, options);
			const exported = lettersInFont(await ioFont_exportFont('otf', true, options));
			expect(checked).toEqual(exported);
		});
	}

	it('a broken letter is named only when the font file holds it', async () => {
		const json = edgeProjectJSON();
		// break every letter in the project the same way, including é (its range is off)
		Object.values(json.glyphs).forEach((glyph) => {
			glyph.shapes = [twoPointShape()];
			glyph.advanceWidth = 500;
		});
		const { project } = openProject(json);
		const named = validateFont(project).map((problem) => problem.itemId);
		expect(named).toContain('glyph-0x41');
		expect(named).not.toContain('glyph-0xE9');

		const fontNames = lettersInFont(await ioFont_exportFont('otf', true));
		named
			.filter((id) => id.startsWith('glyph-'))
			.forEach((id) => {
				const code = parseInt(id.slice(6), 16).toString(16).toUpperCase().padStart(4, '0');
				expect(fontNames).toContain(`uni${code}`);
			});
	});
});
