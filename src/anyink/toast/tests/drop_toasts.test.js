// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 fix track: what a drop on a letter says when it brings nothing in (UX-BEGINNER.md principle
// 6, never silently wrong; 7.7 plain messages). Through the canvas's real drop handler
// (edit_canvas/events_drag_drop_paste.js), in Simple and in All tools:
//   - a drawing (.svg) with no shapes, or one that can't be read: Simple says so; All tools
//     says nothing, as before
//   - his own work file (.gs2) dropped on a letter: Simple says how to open it (Ctrl+O, 7.6);
//     All tools keeps its drop hint
//   - the hint shown while a file is dragged over the letter gives way at once to the drop's
//     own toast (one stream, toast/queue.js), never holding it up for its 6 s
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { handleDropSVGonEditCanvas } from '../../../edit_canvas/events_drag_drop_paste.js';
import { showToast } from '../../../controls/dialogs/dialogs.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setModeForTests } from '../../mode/mode.js';
import { DROP_HINT } from '../../trace/paste_drop.js';
import { word } from '../../words/words.js';
import { isWorkFile } from '../drop_toasts.js';
import { resetToastsForTests, toastLog } from '../toast.js';

const live = () =>
	[...document.querySelectorAll('#toast')].filter((el) => !el.hasAttribute('data-leaving'));
const shownText = () => live().at(-1)?.textContent.replace(/\s+/g, ' ').trim() ?? '';

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	resetToastsForTests();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	resetToastsForTests();
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

/** The simple example font, Capital A open on the Characters page. */
function letterEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedGlyph;
	return editor;
}

/** Drops one file on the canvas, as Chrome hands it over. */
function drop(file) {
	const event = new Event('drop', { cancelable: true });
	event.dataTransfer = { files: [file] };
	handleDropSVGonEditCanvas(event);
}

const svg = (body, name = 'drawing.svg') =>
	new File([`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`], name, {
		type: 'image/svg+xml',
	});
const workFile = () => new File(['{"projectSettings":{}}'], 'Brennan Hand.gs2', { type: '' });

describe('isWorkFile', () => {
	it('knows a work file by its ending, any case', () => {
		expect(isWorkFile(workFile())).toBe(true);
		expect(isWorkFile({ name: 'OLD.GS2' })).toBe(true);
		expect(isWorkFile({ name: 'notes.gs2.txt' })).toBe(false);
		expect(isWorkFile({ name: 'drawing.svg' })).toBe(false);
		expect(isWorkFile(null)).toBe(false);
	});
});

describe('Simple', () => {
	beforeEach(() => setModeForTests('simple'));

	it('a drawing with no shapes says so, and brings nothing in', async () => {
		const editor = letterEditor();
		const shapes = editor.selectedItem.shapes.length;
		drop(svg(''));
		await vi.waitFor(() => expect(toastLog().at(-1)).toMatchObject({ key: 'toast.drawingEmpty' }));
		expect(shownText()).toBe('That drawing has no shapes ANY-INK can use.');
		expect(editor.selectedItem.shapes.length).toBe(shapes);
		// the one message: not also upstream's error box ("Text on the operating system
		// clipboard does not appear to be SVG ...", wrong for a drop and in pro words)
		expect(document.querySelector('#error')).toBeNull();
	});

	it("a drawing that can't be read says the same", async () => {
		letterEditor();
		drop(new File(['not a drawing at all'], 'broken.svg', { type: 'image/svg+xml' }));
		await vi.waitFor(() => expect(toastLog().at(-1)).toMatchObject({ key: 'toast.drawingEmpty' }));
	});

	it('his own work file dropped on a letter says how to open it', () => {
		letterEditor();
		drop(workFile());
		expect(toastLog().at(-1)).toMatchObject({ key: 'toast.dropWorkFile', shown: true });
		expect(shownText()).toBe(word('toast.dropWorkFile'));
		expect(shownText()).toBe("That's an ANY-INK work file. To open it, press Ctrl+O.");
	});

	it('the drag-over hint gives way at once to what the drop did', () => {
		letterEditor();
		showToast(DROP_HINT); // events.js, on drag enter
		// B8 + B9 integration: photos are on, so the hint offers them (the drawings-only hint retired)
		expect(shownText()).toBe(word('toast.dropHint'));
		drop(workFile());
		expect(shownText()).toBe(word('toast.dropWorkFile'));
		expect(live()).toHaveLength(1);
	});
});

describe('All tools: as before', () => {
	it("a drawing with no shapes: upstream's error box, no toast", async () => {
		letterEditor();
		drop(svg(''));
		await vi.waitFor(() => expect(document.querySelector('#error')).not.toBeNull());
		expect(live()).toEqual([]);
	});

	it('a work file dropped on a letter gets the drop hint', () => {
		letterEditor();
		drop(workFile());
		expect(live()[0].innerHTML).toBe(DROP_HINT);
	});
});
