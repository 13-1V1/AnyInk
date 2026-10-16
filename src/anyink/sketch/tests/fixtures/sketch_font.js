// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 test fixture: a font on STORED_FONT's lines whose letters hold the given sketches and no
	ink yet, opened in a fresh editor (fontcheck/tests/fixtures.js openProject), as a work file
	saved mid-sketch would open.

	  sketchFontJSON(letters)    letters: { char: sketch }; the project JSON
	  openSketchFont(letters)    the editor
	  glyphIdOf(char)            'glyph-0x6E'
*/
import { openProject } from '../../../fontcheck/tests/fixtures.js';
import { STORED_FONT } from './stored_sketches.js';

export const glyphIdOf = (char) =>
	`glyph-0x${char.codePointAt(0).toString(16).toUpperCase().padStart(2, '0')}`;

/**
 * @param {Object<String, Object>} letters
 * @returns {Object}
 */
export function sketchFontJSON(letters) {
	const glyphs = {};
	Object.entries(letters).forEach(([char, sketch]) => {
		const id = glyphIdOf(char);
		glyphs[id] = { id, advanceWidth: 0, shapes: [], anyink: { sketch: structuredClone(sketch) } };
	});
	return {
		settings: {
			project: {
				name: 'Sketch Font',
				latestVersion: '2.10.5',
				initialVersion: '2.10.5',
				id: 'g2_SKETCHFONT',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F', enabled: true }],
			},
			font: { family: 'Sketch Font', style: 'Regular', ...STORED_FONT },
			app: { exportLigatures: true, exportKerning: true, exportUneditedItems: true },
		},
		glyphs,
	};
}

/**
 * @param {Object<String, Object>} letters
 * @returns {Object} ProjectEditor
 */
export function openSketchFont(letters) {
	return openProject(sketchFontJSON(letters));
}
