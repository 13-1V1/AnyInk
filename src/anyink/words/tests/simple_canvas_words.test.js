// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "Simple canvas text is never scanned; with context characters on
// (set in More tools), Simple's letter canvas draws 'kern: N' and upstream item names, with
// hotspots into hidden pages"). UX-BEGINNER.md 2.3 scans the words drawn on the canvas in Simple,
// and 6.2 hides the Context characters panel; so Simple never draws the neighbor letters, their
// names or their gap values, even when a font had them turned on in More tools. All tools draws
// them as before (Glyphr Studio's own words).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { resetGuidesLayerState } from '../../metrics/state.js';
import { setModeForTests } from '../../mode/mode.js';
import { scanSimpleScreen, startCanvasSpy } from './banned_scan.js';

/** B4 + B5 fix pass: scanned strict (2.4 E and G too). */
const scanStrict = (name, build, options = {}) =>
	scanSimpleScreen(name, build, { strict: true, ...options });

/** Capital A of the simple example, its neighbors turned on as More tools leaves them. */
function letterWithNeighbors() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedGlyph.contextCharacters = 'CABC';
	editor.selectedTool = 'resize';
	editor.view = { dx: 300, dy: 700, dz: 0.25 };
	Object.assign(editor.project.settings.app.contextCharacters, {
		showCharacters: true,
		showGuides: true,
	});
	return editor;
}

function redraw(editor) {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	const ctx = canvas.getContext('2d');
	EditCanvas.prototype.redraw.call(
		{ ctx, width: 1200, height: 1000, editingItemID: editor.selectedItemID },
		'test'
	);
}

/** Upstream's neighbor labels: item names ('Capital Letter B', 'Ligature A B') and 'kern: N'. */
const NEIGHBOR_TEXT = /letter b|letter c|ligature|kern/i;

beforeEach(() => {
	resetGuidesLayerState();
	vi.stubGlobal('requestAnimationFrame', (callback) => callback());
});
afterEach(() => {
	vi.unstubAllGlobals();
	setModeForTests('all');
});

describe('neighbor letters on the letter canvas', () => {
	it('All tools draws them, with their names and gap values (as before)', () => {
		setModeForTests('all');
		const spy = startCanvasSpy();
		try {
			redraw(letterWithNeighbors());
			expect(spy.texts.filter((text) => NEIGHBOR_TEXT.test(text)).length).toBeGreaterThan(0);
		} finally {
			spy.stop();
		}
	});

	scanStrict('Simple draws none of them, though More tools turned them on', ({ canvas }) => {
		redraw(letterWithNeighbors());
		expect(canvas.texts.filter((text) => NEIGHBOR_TEXT.test(text))).toEqual([]);
		return null;
	});
});
