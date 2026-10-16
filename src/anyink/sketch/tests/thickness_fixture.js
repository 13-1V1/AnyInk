// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 thickness-card fixture: a font on STORED_FONT's lines with sketched letters built for real
	(build.js rebuildItem), so the thickness tests read real ink.

	  sketchedEditor({ letters, open })   ProjectEditor on a font with the stored n sketch in each
	                         letter of `letters` ({ id: thickness }), built; `open` is opened
	  stemWidth(item)        the n stem's (piece 1) ink width (font units)
	  stemBox(item)          the stem's ink box { xMin, xMax, yMin, yMax }
	  N_ID, A_ID, O_ID, R_ID, S_ID, U_ID   letter ids
*/
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { clearBuildCache, rebuildItem } from '../build.js';
import { setSketch } from '../model.js';
import { builtShapes } from '../sketch_record.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';

export const N_ID = 'glyph-0x6E';
export const A_ID = 'glyph-0x61';
export const O_ID = 'glyph-0x6F';
export const R_ID = 'glyph-0x72';
export const S_ID = 'glyph-0x73';
export const U_ID = 'glyph-0x75';

/**
 * @param {{letters?: Object<String, Number>, open?: String, fontThickness?: Number | null}} [o]
 * @returns {ProjectEditor}
 */
export function sketchedEditor({
	letters = { [N_ID]: 99 },
	open = N_ID,
	fontThickness = null,
} = {}) {
	clearBuildCache();
	const glyphs = {};
	for (const id of [N_ID, A_ID, O_ID, R_ID, S_ID, U_ID]) {
		glyphs[id] = { id, advanceWidth: 700, shapes: [] };
	}
	const editor = new ProjectEditor();
	editor.project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Sketched',
				id: 'g2_SKETCHED',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'Sketched', ...STORED_FONT },
		},
		glyphs,
	});
	if (fontThickness !== null) editor.project.settings.anyink = { sketchThickness: fontThickness };
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	for (const [id, thickness] of Object.entries(letters)) {
		const item = editor.project.getItem(id);
		const sketch = storedSketch('n');
		sketch.key = `sk_${id}`;
		sketch.thickness = thickness;
		setSketch(item, sketch);
		rebuildItem(item, { project: editor.project });
	}
	editor.selectedGlyphID = open;
	// the font as opened: the built letters (Undo past the first step comes back here)
	editor.history.initialize(editor.project);
	return editor;
}

/** The bounds of one piece's built shapes */
function pieceBox(item, pieceId) {
	const boxes = builtShapes(item)
		.filter((shape) => shape.anyink?.sketchId === pieceId)
		.map((shape) => shape.maxes);
	return {
		xMin: Math.min(...boxes.map((box) => box.xMin)),
		xMax: Math.max(...boxes.map((box) => box.xMax)),
		yMin: Math.min(...boxes.map((box) => box.yMin)),
		yMax: Math.max(...boxes.map((box) => box.yMax)),
	};
}

/**
 * @param {Object} item
 * @returns {Number} the stem's (piece 1, a plumb Line) ink width
 */
export function stemWidth(item) {
	const box = pieceBox(item, 1);
	return box.xMax - box.xMin;
}

/** @returns {{xMin, xMax, yMin, yMax}} the stem's ink box */
export function stemBox(item) {
	return pieceBox(item, 1);
}
