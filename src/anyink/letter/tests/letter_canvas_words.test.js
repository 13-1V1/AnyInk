// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 letter view, the canvas side: the banned-word scan (UX-BEGINNER.md 2.3, principle 2) over
// every word the letter view draws on its canvas in Simple: the five line labels, the guide
// letter, the edges' "left space" / "right space" and their drag readout, and the neighbor
// labels. Registered with the B4 scan helper (words/tests/banned_scan.js).
import { afterEach, beforeEach, describe, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { resetGuideLetterForTests } from '../guide_letter.js';
import { resetNeighborsForTests } from '../neighbors.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

const VIEW = Object.freeze({ dx: 300, dy: 700, dz: 0.25 });

beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (callback) => callback()); // draw now, not next frame
	resetGuidesLayerState();
	resetLetterViewForTests();
	resetGuideLetterForTests();
	resetNeighborsForTests();
});
afterEach(() => vi.unstubAllGlobals());

/**
 * The simple example font plus an H, an n and an a (copies of its A, so the neighbors show), one
 * letter open on the Characters page, Simple's letter view on.
 */
function letterEditor(id) {
	setFeaturesForTests({ letterView: true });
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	const json = structuredClone(simpleExampleProject);
	['0x48', '0x6E', '0x61'].forEach((hex) => {
		json.glyphs[`glyph-${hex}`] = { ...structuredClone(json.glyphs['glyph-0x41']), id: `glyph-${hex}` };
	});
	editor.project = importGlyphrProjectFromText(json);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = id;
	editor.selectedGlyph; // the letter record, as opening it makes
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
	return editor;
}

function redraw(editor) {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	const host = {
		ctx: canvas.getContext('2d'),
		width: 1200,
		height: 1000,
		editingItemID: editor.selectedItemID,
	};
	EditCanvas.prototype.redraw.call(host, 'test');
}

describe('the letter view canvas (B7)', () => {
	scanSimpleScreen('an empty letter: the labeled guide lines and the guide letter', () => {
		const editor = letterEditor('glyph-0x71'); // small q: none in the example font
		redraw(editor);
		return null;
	});

	scanSimpleScreen('a ready letter, Fine-tune open: edges, spaces, neighbors with their label', () => {
		const editor = letterEditor('glyph-0x41'); // Capital A, beside his H when it has one
		setFineTuneOpen(true);
		redraw(editor);
		editor.selectedGlyphID = 'glyph-0x61'; // small a, beside his n
		editor.selectedGlyph;
		redraw(editor);
		return null;
	});

	scanSimpleScreen('pointing at an edge, then dragging it', () => {
		const editor = letterEditor('glyph-0x41');
		setFineTuneOpen(true);
		['lsb', 'rsb'].forEach((side) => {
			Object.assign(guidesLayerState, {
				hover: side,
				dragging: false,
				line: { id: side, kind: 'sideBearing', side, orientation: 'v', value: 0 },
				pointer: { x: 300, y: 300 },
			});
			redraw(editor);
			guidesLayerState.dragging = side;
			redraw(editor);
		});
		return null;
	});
});
