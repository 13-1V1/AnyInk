// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper (B12 tryit-gaps): an editor on a small font with made letters (spacing fixtures'
	shapes, whole units), and a TextBlock-like layout of a word on it, the shape the preview
	strip's DisplayCanvas hands hit_test.js: blocks of charData { char, item, view: { dx, dy,
	dz }, widths: { advance, kern }, isVisible, lineNumber }.

	  gapsEditor({ mode, letters, open, own })   the current editor; letters: chars with ink
	                                        (default 'enoHt'), all automatic; open: a letter to
	                                        have open; own: { char: spacingProject spec } for
	                                        letters set up by hand (their spacing as given)
	  layoutWord(project, text, { x0, baseline, dz })   charData for text on one line, the kern
	                                        lookup's values between letters
*/
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { kernOffsetFor } from '../../kerning/kern_lookup.js';
import { setModeForTests } from '../../mode/mode.js';
import { fitAllAutomatic } from '../../spacing/auto_space.js';
import { glyphId, spacingProject } from '../../spacing/tests/fixtures.js';

/**
 * @param {Object} [options]
 * @param {'simple' | 'all'} [options.mode]
 * @param {String} [options.letters] - letters with ink
 * @param {String} [options.open] - the letter open in the letter view
 * @param {Number} [options.grid]
 * @param {Object} [options.own]
 * @returns {ProjectEditor}
 */
export function gapsEditor({
	mode = 'simple',
	letters = 'enoHt',
	open = '',
	grid = 1000,
	own = {},
} = {}) {
	setModeForTests(mode);
	const spec = {};
	[...letters].forEach((char) => {
		spec[char] = { anyink: { spacing: 'auto' } };
	});
	Object.assign(spec, own);
	const project = spacingProject(grid, spec);
	fitAllAutomatic(project);
	const editor = new ProjectEditor();
	editor.project = project;
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	if (open) editor.selectedItemID = glyphId(open);
	return editor;
}

/**
 * @param {Object} project
 * @param {String} text
 * @param {{x0?: Number, baseline?: Number, dz?: Number}} [options]
 * @returns {Array<Array<Object>>} TextBlock.data
 */
export function layoutWord(project, text, { x0 = 10, baseline = 100, dz = 0.1 } = {}) {
	const chars = [...text];
	let x = x0;
	const block = chars.map((char, index) => {
		const item = project.glyphs[glyphId(char)] || false;
		const advance = item ? Number(item.advanceWidth) : 500;
		const kern = index < chars.length - 1 ? kernOffsetFor(project, char, chars[index + 1]) : 0;
		const data = {
			char,
			item,
			view: { dx: x, dy: baseline, dz },
			widths: { advance, kern },
			isVisible: true,
			lineNumber: 0,
		};
		x += (advance + kern) * dz;
		return data;
	});
	return [block];
}
