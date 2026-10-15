// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (new problem "Simple keeps invisible neighbor-name links after a More tools
// visit: a click on blank canvas jumps to another letter"): the neighbor letters' names are links
// (canvas hotspots), registered while they are drawn. Simple doesn't draw them (UX-BEGINNER.md
// 2.3, 6.2), so Simple must have no links either; nor may All tools after the neighbors are
// turned off. A redraw that draws no neighbor letters clears the links.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../app/main.js';
import { resetGuidesLayerState } from '../../anyink/metrics/state.js';
import { setModeForTests } from '../../anyink/mode/mode.js';
import { importGlyphrProjectFromText } from '../../project_editor/import_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import simpleExampleProject from '../../samples/simpleExampleProject.json';
import { isHotspotHere } from '../context_characters.js';
import { EditCanvas } from '../edit_canvas.js';

const WIDTH = 1200;
const HEIGHT = 1000;

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
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	EditCanvas.prototype.redraw.call(
		{ ctx: canvas.getContext('2d'), width: WIDTH, height: HEIGHT, editingItemID: 'glyph-0x41' },
		'test'
	);
}

/** Every 4 px of the canvas that is a link. */
function linkCount() {
	let count = 0;
	for (let x = 0; x < WIDTH; x += 4) {
		for (let y = 0; y < HEIGHT; y += 4) if (isHotspotHere(x, y)) count++;
	}
	return count;
}

beforeEach(() => {
	resetGuidesLayerState();
	vi.stubGlobal('requestAnimationFrame', (callback) => callback());
});
afterEach(() => {
	vi.unstubAllGlobals();
	setModeForTests('all');
});

describe('neighbor-name links on the letter canvas', () => {
	it('All tools: drawn names are links (as before)', () => {
		redraw(letterWithNeighbors());
		expect(linkCount()).toBeGreaterThan(0);
	});

	it('Back to simple: the next redraw draws no names, so it leaves no links', () => {
		const editor = letterWithNeighbors();
		redraw(editor);
		expect(linkCount()).toBeGreaterThan(0);
		setModeForTests('simple');
		redraw(editor);
		expect(linkCount()).toBe(0);
	});

	it('All tools: turning the neighbors off takes their links away too', () => {
		const editor = letterWithNeighbors();
		redraw(editor);
		editor.project.settings.app.contextCharacters.showCharacters = false;
		redraw(editor);
		expect(linkCount()).toBe(0);
	});
});
