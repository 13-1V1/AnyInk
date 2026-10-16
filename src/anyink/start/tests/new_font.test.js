// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 + B13 integration: Menu > Start a new font... (UX-BEGINNER.md 4.9: "Start screen; same check
// as above"; 7.4 confirmation 4). The Simple Menu row sends 'anyink-start-new-font'
// (topbar/doors.js NEW_FONT_EVENT); nothing listened for it. Written to fail first: new_font.js
// did not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NEW_FONT_EVENT } from '../../topbar/doors.js';
import { word } from '../../words/words.js';
import { installNewFont, startNewFontCommand } from '../new_font.js';

const box = () => document.querySelector('#modal-dialog');
const buttons = () => [...(box()?.querySelectorAll('fancy-button') || [])];
const choice = (name) => box()?.querySelector(`[data-anyink-choice="${name}"]`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 150));

let editor;
let goToStart;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	editor = { saveProjectFile: vi.fn(async () => true) };
	goToStart = vi.fn(async () => {});
});
afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('startNewFontCommand', () => {
	it('nothing unsaved: straight to the start screen, no box', async () => {
		expect(await startNewFontCommand({ editor, unsaved: () => false, goToStart })).toBe('start');
		expect(goToStart).toHaveBeenCalledWith(editor);
		expect(box()).toBeNull();
	});

	it('unsaved work: the box, [Save] green and [Cancel] outlined, and no start screen yet', async () => {
		expect(await startNewFontCommand({ editor, unsaved: () => true, goToStart })).toBe('asked');
		expect(box().textContent).toContain(word('open.unsaved'));
		expect(buttons().map((b) => b.textContent.trim())).toEqual([
			word('open.save'),
			word('open.cancel'),
		]);
		expect(choice('save').hasAttribute('secondary')).toBe(false);
		expect(choice('cancel').hasAttribute('secondary')).toBe(true);
		expect(goToStart).not.toHaveBeenCalled();
	});

	it('Cancel: the box goes, his font stays', async () => {
		await startNewFontCommand({ editor, unsaved: () => true, goToStart });
		choice('cancel').click();
		await flush();
		expect(goToStart).not.toHaveBeenCalled();
	});

	it('Save that saves: the start screen, with no second click (no picker needed)', async () => {
		let unsaved = true;
		editor.saveProjectFile = vi.fn(async () => {
			unsaved = false;
		});
		await startNewFontCommand({ editor, unsaved: () => unsaved, goToStart });
		choice('save').click();
		await flush();
		expect(editor.saveProjectFile).toHaveBeenCalledTimes(1);
		expect(goToStart).toHaveBeenCalledWith(editor);
	});

	it('Save that did not save (cancelled): the box closes and his font stays', async () => {
		await startNewFontCommand({ editor, unsaved: () => true, goToStart });
		choice('save').click();
		await flush();
		expect(goToStart).not.toHaveBeenCalled();
	});
});

describe('installNewFont', () => {
	it("answers the Menu row's event, once per press", async () => {
		const run = vi.fn();
		const off = installNewFont({ run });
		window.dispatchEvent(new CustomEvent(NEW_FONT_EVENT, { detail: { cause: 'menu' } }));
		expect(run).toHaveBeenCalledTimes(1);
		off();
		window.dispatchEvent(new CustomEvent(NEW_FONT_EVENT, { detail: { cause: 'menu' } }));
		expect(run).toHaveBeenCalledTimes(1);
	});
});
