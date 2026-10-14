// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 fix pass (walkthrough p9): opening a letter must never change it. The Characters,
// Ligatures and Components pages run new_path.js removeStopCreatingNewPathButton every time a
// letter is selected, and it gave a one-shape letter with width 0 a width of its own
// (checkForFirstShapeAutoRSB) with no Undo step: an Overview tile, the letter chooser,
// Ctrl+Period or an Undo that moved between letters all changed the letter they opened. Only
// finishing a path (the Done button) still gives the letter its first width.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../app/main.js';
import { importGlyphrProjectFromText } from '../../project_editor/import_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import simpleExampleProject from '../../samples/simpleExampleProject.json';
import { removeStopCreatingNewPathButton } from '../tools/new_path.js';

const box = {
	pathPoints: [
		{ p: { coord: { x: 100, y: 0 } } },
		{ p: { coord: { x: 400, y: 0 } } },
		{ p: { coord: { x: 400, y: 500 } } },
		{ p: { coord: { x: 100, y: 500 } } },
	],
};

let previous;
let editor;

beforeEach(() => {
	previous = getCurrentProjectEditor();
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.project.settings.app.autoRightBearingOnFirstShape = 50;
	editor.nav.page = 'Characters';
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	document.body.innerHTML = '';
	setCurrentProjectEditor(previous);
	vi.restoreAllMocks();
});

/** small b with one shape and width 0, as a traced letter is. */
function oneShapeLetter() {
	editor.selectedItemID = 'glyph-0x62';
	const b = editor.selectedItem;
	b.addOneShape(structuredClone(box));
	b.advanceWidth = 0;
	return b;
}

describe('opening a letter', () => {
	it('leaves a one-shape letter with width 0 exactly as it is', () => {
		const b = oneShapeLetter();
		editor.selectedItemID = 'glyph-0x41';
		editor.selectedItemID = 'glyph-0x62'; // what an Overview tile does
		removeStopCreatingNewPathButton(); // the page's selection handler
		expect(b.advanceWidth).toBe(0);
	});
});

describe('finishing a path with the Done button', () => {
	it('still gives the letter its first width', () => {
		const b = oneShapeLetter();
		const done = document.createElement('button');
		done.id = 'done-creating-path-button';
		document.body.appendChild(done);
		editor.eventHandlers = { ...editor.eventHandlers, tool_addPath: { newPath: {}, firstPoint: false } };
		removeStopCreatingNewPathButton();
		expect(b.advanceWidth).toBe(400 + 50);
		expect(document.querySelector('#done-creating-path-button')).toBe(null);
	});
});
