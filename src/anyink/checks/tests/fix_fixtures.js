// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11 fixes fixtures: an editor on a font at the 1,000-unit grid (top line 800, capitals line
	700, small-letter line 500, tail line -200) whose letters are drawn from the spacing
	fixtures (src/anyink/spacing/tests/fixtures.js), plus ways to put a letter off its line or
	off its size, specks, and a photo under it. Used by the fixes unit tests.
*/
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import {
	glyphId,
	GRIDS,
	letterShapes,
	rect,
	spacingProject,
} from '../../spacing/tests/fixtures.js';

export const FONT = GRIDS[1000];

/**
 * Shapes moved and scaled: x' = x0 + (x - x0) * k, y' = y * k + dy (y from the writing line).
 * @param {Array<Object>} shapes - Path save objects
 * @param {{k?: Number, dy?: Number, x0?: Number}} [options]
 * @returns {Array<Object>}
 */
export function moved(shapes, { k = 1, dy = 0, x0 = 100 } = {}) {
	const map = (coord) => coord && { x: x0 + (coord.x - x0) * k, y: coord.y * k + dy };
	return shapes.map((shape) => ({
		...shape,
		pathPoints: shape.pathPoints.map((point) => ({
			...point,
			p: { ...point.p, coord: map(point.p.coord) },
			...(point.h1 ? { h1: { ...point.h1, coord: map(point.h1.coord) } } : {}),
			...(point.h2 ? { h2: { ...point.h2, coord: map(point.h2.coord) } } : {}),
		})),
	}));
}

/**
 * @param {String} char
 * @param {{k?: Number, dy?: Number, x0?: Number}} [options] - as moved()
 * @returns {Array<Object>} the fixture letter's shapes, moved and scaled
 */
export function shapesOf(char, options = {}) {
	return moved(letterShapes(char, FONT, options.x0 ?? 100), options);
}

/** A small square of ink: a speck when it is small enough and beside the letter. */
export function speck(x, y, size = 20) {
	return rect(x, y, x + size, y + size);
}

/**
 * @param {Object<String, Object>} letters - { char: { shapes?, advanceWidth?, anyink? } }
 * @param {{page?: String, open?: String}} [options] - page: the nav page (default the board's,
 *   'Overview'); open: the letter open in the letter view (page 'Characters')
 * @returns {ProjectEditor} the current editor
 */
export function fixEditor(letters, { page = 'Overview', open = null } = {}) {
	const editor = new ProjectEditor();
	editor.project = spacingProject(1000, letters);
	setCurrentProjectEditor(editor);
	editor.nav.page = open ? 'Characters' : page;
	if (open) editor._selectedGlyphID = glyphId(open);
	return editor;
}

/** A fake photo record under a letter (the trace model's numbers only). */
export function photo({ x = 50, y = 900, scale = 2 } = {}) {
	return {
		asset: 'img-fixture',
		width: 400,
		height: 500,
		x,
		y,
		scale,
		opacity: 0.25,
		visible: true,
		locked: true,
		invert: false,
	};
}

/** @returns {Object} the letter's save data, for "Undo put it back exactly" */
export function saved(editor, char) {
	return JSON.stringify(editor.project.glyphs[glyphId(char)].save());
}

export { glyphId };
