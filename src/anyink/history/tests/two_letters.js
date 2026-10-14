// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B2 fixture: a bare editor on a font with two letters, Capital B and small r, both still empty
	(the records opening a letter makes). Used by the B2 unit tests and by tests/undo.html.
	traceInto() puts a square into the open letter through the real auto-trace apply path, the
	same one step "Use it" makes.
*/
import { applyAutoTrace } from '../../autotrace/apply.js';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';

export const B = 'glyph-0x42';
export const R = 'glyph-0x72';

export function twoLetterProject() {
	return new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Two Letters',
				id: 'g2_TWOLETTERS',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: {
				family: 'Two Letters',
				upm: 1000,
				ascent: 800,
				descent: -200,
				capHeight: 700,
				xHeight: 500,
			},
		},
		glyphs: {
			[B]: { id: B, advanceWidth: 0, shapes: [] },
			[R]: { id: R, advanceWidth: 0, shapes: [] },
		},
	});
}

/**
 * @param {Object} [options]
 * @param {Object} [options.fileHandle] - set before the project, as the .gs2 open paths do
 * @param {String} [options.page] - nav page to start on (default 'Characters')
 * @returns {ProjectEditor} the current editor
 */
export function twoLetterEditor({ fileHandle = false, page = 'Characters' } = {}) {
	const editor = new ProjectEditor();
	editor.loadedFileHandle = fileHandle;
	editor.project = twoLetterProject();
	setCurrentProjectEditor(editor);
	editor.nav.page = page;
	return editor;
}

/**
 * A square, x0 to x0 + size, sitting on the writing line.
 * @param {Number} [x0]
 * @param {Number} [size]
 * @returns {Path}
 */
export function square(x0 = 100, size = 400) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name: 'Traced',
		pathPoints: [corner(x0, 0), corner(x0 + size, 0), corner(x0 + size, size), corner(x0, size)],
	});
}

/**
 * Traces a square into the open letter: one Undo step, like Use it.
 * @param {ProjectEditor} editor
 * @param {Number} [x0]
 * @returns {Boolean}
 */
export function traceInto(editor, x0 = 100) {
	return applyAutoTrace({
		editor,
		item: editor.selectedItem,
		shapes: [square(x0)],
		mode: 'replace',
	});
}

/** @returns {Number} how many shapes a letter has (0 when it has no record) */
export function shapeCount(editor, id) {
	return editor.project.glyphs[id]?.shapes?.length || 0;
}
