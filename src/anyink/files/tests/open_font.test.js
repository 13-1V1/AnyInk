// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 7.6, 4.9): Ctrl+O opens a saved font with the file picker, in both
// modes, instead of a new window. Work the work file doesn't hold is never dropped: a box says
// "Your work has changes that aren't saved. [Save] [Cancel]", and after Save it reads "Saved.
// [Open a font...]", a new click, so Chrome's one-picker-per-click rule holds.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { word } from '../../words/words.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { openFontCommand } from '../open_font.js';
import { fakeApi } from './fakes.js';

// The picker is the real one behind the file API seam: a fake that counts its opens (cancelled).
let api;
const picker = {
	get calls() {
		return api.calls.open.length;
	},
};

const box = () => document.querySelector('#modal-dialog');
const buttons = () => [...(box()?.querySelectorAll('fancy-button') || [])];
const buttonNamed = (key) => buttons().find((b) => b.textContent.trim() === word(key));
/** A closing dialog animates out for 120 ms (dialogs.js animateRemove) */
const flush = () => new Promise((resolve) => setTimeout(resolve, 150));
/** The picker opens after the file module looks up where to start (IndexedDB) */
async function pickerOpened() {
	const end = Date.now() + 2000;
	while (Date.now() < end && picker.calls === 0) await new Promise((r) => setTimeout(r, 10));
	return picker.calls;
}

let editor;
let opened;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	opened = [];
	vi.spyOn(window, 'open').mockImplementation((...args) => opened.push(args));
	api = fakeApi({ open: [], save: undefined });
	setFileApi(api);
	editor = { saveProjectFile: vi.fn(async () => true) };
});
afterEach(() => {
	resetFileApi();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('openFontCommand (Ctrl+O)', () => {
	it('nothing unsaved: straight to the file picker, no new window', async () => {
		expect(await openFontCommand({ editor, unsaved: () => false })).toBe('picker');
		expect(await pickerOpened()).toBe(1);
		expect(opened).toEqual([]);
		expect(box()).toBeNull();
	});

	it('unsaved work: the box, and no picker yet', async () => {
		await openFontCommand({ editor, unsaved: () => true });
		expect(picker.calls).toBe(0);
		expect(box().textContent).toContain(word('open.unsaved'));
		expect(buttons().map((b) => b.textContent.trim())).toEqual([
			word('open.save'),
			word('open.cancel'),
		]);
	});

	it('Cancel: the box closes, nothing saved, nothing opened', async () => {
		await openFontCommand({ editor, unsaved: () => true });
		buttonNamed('open.cancel').click();
		await flush();
		expect(box()).toBeNull();
		expect(editor.saveProjectFile).not.toHaveBeenCalled();
		expect(picker.calls).toBe(0);
	});

	it('Save: saves, then "Saved. [Open a font...]"; that new click opens the picker', async () => {
		let unsaved = true;
		editor.saveProjectFile = vi.fn(async () => {
			unsaved = false;
		});
		await openFontCommand({ editor, unsaved: () => unsaved });
		buttonNamed('open.save').click();
		await flush();
		expect(editor.saveProjectFile).toHaveBeenCalledTimes(1);
		expect(picker.calls).toBe(0);
		expect(box().textContent).toContain(word('open.saved'));
		buttonNamed('open.openFont').click();
		expect(await pickerOpened()).toBe(1);
		await flush();
		expect(box()).toBeNull();
	});

	it('Save cancelled or failed: the box closes and nothing is opened', async () => {
		await openFontCommand({ editor, unsaved: () => true });
		buttonNamed('open.save').click();
		await flush();
		expect(box()).toBeNull();
		expect(picker.calls).toBe(0);
	});

	it('a browser with no file picker keeps the old Ctrl+O: the app in a new window', async () => {
		resetFileApi();
		await openFontCommand({ editor, unsaved: () => true });
		expect(opened).toEqual([[window.location.href, '_blank']]);
		expect(picker.calls).toBe(0);
		expect(box()).toBeNull();
	});

	it('the box says no banned word', async () => {
		const { scanDom } = await import('../../words/banned.js');
		await openFontCommand({ editor, unsaved: () => true });
		expect(scanDom(box())).toEqual([]);
	});
});
