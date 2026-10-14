// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../../app/main.js';
import { removeStopCreatingNewPathButton } from '../../../edit_canvas/tools/new_path.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { navigationTargetForId } from '../hit_test.js';
import { showItem } from '../show_item.js';

function fakeEditor() {
	return { nav: { page: 'Overview' }, selectedItemID: false, navigate: vi.fn() };
}

describe('navigationTargetForId', () => {
	it('sends letters to Characters, joined letters to Ligatures and gaps to Kerning', () => {
		expect(navigationTargetForId('glyph-0x61')).toEqual({ id: 'glyph-0x61', page: 'Characters' });
		expect(navigationTargetForId('liga-0x66-0x66')).toEqual({
			id: 'liga-0x66-0x66',
			page: 'Ligatures',
		});
		expect(navigationTargetForId('kern-0')).toEqual({ id: 'kern-0', page: 'Kerning' });
		expect(navigationTargetForId('comp-0')).toBe(false);
		expect(navigationTargetForId(null)).toBe(false);
	});
});

describe('showItem', () => {
	it('opens that letter in the editor', () => {
		const editor = fakeEditor();
		expect(showItem(editor, 'glyph-0x61')).toBe(true);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe('glyph-0x61');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('opens a gap on the Kerning page', () => {
		const editor = fakeEditor();
		expect(showItem(editor, 'kern-0')).toBe(true);
		expect(editor.nav.page).toBe('Kerning');
		expect(editor.selectedItemID).toBe('kern-0');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('does nothing without an editor or a letter', () => {
		const editor = fakeEditor();
		expect(showItem(editor, null)).toBe(false);
		expect(showItem(editor, 'comp-0')).toBe(false);
		expect(showItem(null, 'glyph-0x61')).toBe(false);
		expect(editor.navigate).not.toHaveBeenCalled();
	});
});

// Walkthrough p9: a one-stroke trace on small l (width 0, one shape). Pressing Show me while l
// was already open re-selected l; the Characters page's selection handler
// (characters.js -> new_path.js removeStopCreatingNewPathButton -> checkForFirstShapeAutoRSB)
// then set its width (0 -> 1420.9) with no Undo step, and Ctrl+Z took the whole trace away.
describe('showItem on the letter that is already open', () => {
	let previous;
	let editor;
	let l;

	beforeEach(() => {
		previous = getCurrentProjectEditor();
		editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		editor.project = importGlyphrProjectFromText(simpleExampleProject);
		editor.nav.page = 'Characters';
		editor.selectedItemID = 'glyph-0x6C';
		l = editor.selectedItem;
		const at = (x, y) => ({ p: { coord: { x, y } } });
		l.addOneShape({ pathPoints: [at(100, 0), at(400.4, 0), at(400.4, 500), at(100, 500)] });
		l.advanceWidth = 0;
		editor.history.addState('one stroke on small l');
		// What the Characters page runs on every letter selection (characters.js)
		editor.subscribe({
			topic: 'whichGlyphIsSelected',
			subscriberID: 'editCanvas.selectedGlyph',
			callback: () => removeStopCreatingNewPathButton(),
		});
		editor.navigate = vi.fn();
	});

	afterEach(() => {
		setCurrentProjectEditor(previous);
		document.body.innerHTML = '';
	});

	it('leaves the letter as it is: no new page, no width change, no Undo step', () => {
		expect(editor.project.settings.app.autoRightBearingOnFirstShape).toBeGreaterThan(-1);
		const steps = editor.history.queue.length;
		const published = [];
		editor.subscribe({
			topic: 'whichGlyphIsSelected',
			subscriberID: 'anyink.previewTest.selected',
			callback: (id) => published.push(id),
		});

		expect(showItem(editor, 'glyph-0x6C')).toBe(true);
		expect(l.advanceWidth).toBe(0);
		expect(editor.navigate).not.toHaveBeenCalled();
		expect(published).toEqual([]);
		expect(editor.history.queue.length).toBe(steps);
	});

	it('fits the open letter in view', () => {
		const wrapper = document.createElement('div');
		wrapper.className = 'editor-page__edit-canvas-wrapper';
		document.body.appendChild(wrapper);
		const fit = vi.spyOn(editor, 'autoFitView').mockImplementation(() => editor.view);
		showItem(editor, 'glyph-0x6C');
		expect(fit).toHaveBeenCalledTimes(1);
	});

	it('does not reset the view when there is no edit canvas on screen', () => {
		const fit = vi.spyOn(editor, 'autoFitView');
		showItem(editor, 'glyph-0x6C');
		expect(fit).not.toHaveBeenCalled();
	});

	it('still opens another letter', () => {
		expect(showItem(editor, 'glyph-0x61')).toBe(true);
		expect(editor.selectedItemID).toBe('glyph-0x61');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('opening it from another letter does not change it either', () => {
		editor.selectedItemID = 'glyph-0x61';
		expect(l.advanceWidth).toBe(0);
		showItem(editor, 'glyph-0x6C');
		expect(editor.selectedItemID).toBe('glyph-0x6C');
		expect(l.advanceWidth).toBe(0);
		// and the step that records the move holds it as it was
		expect(editor.history.queue[0].itemState.advanceWidth).toBe(0);
	});
});

// Upstream's undo keeps one "Navigated to" step per move between letters (Overview, the letter
// chooser, Ctrl+Period all record it) and reads the step under the newest one to find a letter's
// earlier state. Show me used to move without it, so the first Undo after an edit there only
// moved back to the old letter and dropped that edit for good ("Navigated without undo-ing").
describe('showItem keeps Undo working on the letter it opens', () => {
	let previous;
	let editor;

	beforeEach(() => {
		previous = getCurrentProjectEditor();
		editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		editor.project = importGlyphrProjectFromText(simpleExampleProject);
		editor.nav.page = 'Characters';
		editor.selectedItemID = 'glyph-0x41';
		editor.selectedItem.advanceWidth = 600;
		editor.history.addState('changed A');
		editor.navigate = vi.fn();
	});

	afterEach(() => {
		setCurrentProjectEditor(previous);
	});

	it('records the move the way the letter chooser does', () => {
		const steps = editor.history.queue.length;
		showItem(editor, 'glyph-0x42');
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].itemID).toBe('glyph-0x42');
		expect(editor.history.queue[0].title).toBe(
			`Navigated to ${editor.project.getItemName('glyph-0x42', true)}`
		);
	});

	it('an edit right after Show me is undone by the first Undo', () => {
		showItem(editor, 'glyph-0x42');
		const b = editor.selectedItem;
		const width = b.advanceWidth;
		b.advanceWidth = width + 100;
		editor.history.addState('wider B');

		editor.history.restoreState();
		expect(editor.selectedItemID).toBe('glyph-0x42');
		expect(editor.project.getItem('glyph-0x42').advanceWidth).toBe(width);
	});
});
