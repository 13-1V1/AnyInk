// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 tryit-gaps: the four pieces go into Try it's slots (expand.js makeTryIt: 'note', 'spacing',
// 'gaps', 'sheet') and follow its 'anyink-try-it-change' event: the board's Letter spacing...
// opens the section, the handle watches the sheet only while Try it is open.
// Written to fail first: the install functions did not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { TRY_IT_CHANGE_EVENT, TRY_IT_SLOTS } from '../expand.js';
import { TRY_IT_CHANGE, installGapHandle, stripLayout } from '../gap_handle.js';
import { installGapList } from '../gap_list.js';
import { installLetterSpacing } from '../letter_spacing.js';
import { installWordNote } from '../word_note.js';
import { gapsEditor, layoutWord } from './gaps_fixture.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

function fakeController(editor) {
	const slots = {};
	TRY_IT_SLOTS.forEach((name) => {
		slots[name] = document.createElement('div');
		document.body.appendChild(slots[name]);
	});
	const canvasWrapper = document.createElement('div');
	const canvas = document.createElement('canvas');
	canvasWrapper.appendChild(canvas);
	const strip = document.createElement('div');
	strip.appendChild(canvasWrapper);
	document.body.appendChild(strip);
	Object.assign(strip, {
		editor,
		canvasWrapper,
		renderer: {
			canvas,
			textBlock: { data: layoutWord(editor.project, 'Hen'), project: editor.project },
		},
	});
	return { slots, strip };
}

const say = (detail) => window.dispatchEvent(new CustomEvent(TRY_IT_CHANGE, { detail }));

describe("Try it's slots", () => {
	it('listens for the event the Try it shell sends', () => {
		expect(TRY_IT_CHANGE).toBe(TRY_IT_CHANGE_EVENT);
	});

	it('fills spacing, gaps and note, and opens letter spacing when asked', () => {
		const editor = gapsEditor();
		const controller = fakeController(editor);
		const off = [installLetterSpacing, installGapList, installWordNote].map((install) =>
			install(controller)
		);
		expect(controller.slots.spacing.querySelector('details.anyink-tryit-spacing')).toBeTruthy();
		expect(controller.slots.gaps.querySelector('details.anyink-gap-list')).toBeTruthy();
		expect(controller.slots.note.querySelector('p.anyink-word-note')).toBeTruthy();
		say({ open: true, section: 'letterSpacing', cause: 'coach' });
		expect(controller.slots.spacing.querySelector('details').open).toBe(true);
		off.forEach((uninstall) => uninstall());
		expect(controller.slots.spacing.children).toHaveLength(0);
	});

	it('the handle lives in the sheet slot only while Try it is open', () => {
		const editor = gapsEditor();
		const controller = fakeController(editor);
		expect(stripLayout(controller.strip)?.font).toBe(editor.project.settings.font);
		const uninstall = installGapHandle(controller);
		expect(controller.slots.sheet.querySelector('.anyink-gap-handle')).toBe(null);
		say({ open: true });
		const handle = controller.slots.sheet.querySelector('.anyink-gap-handle');
		expect(handle).toBeTruthy();
		const n = stripLayout(controller.strip).data[0][2];
		controller.strip.canvasWrapper.dispatchEvent(
			new MouseEvent('pointermove', { bubbles: true, clientX: n.view.dx, clientY: 80 })
		);
		expect(handle.hidden).toBe(false);
		controller.strip.dispatchEvent(new Event('anyink-strip-redraw'));
		expect(handle.hidden).toBe(true);
		say({ open: false });
		expect(controller.slots.sheet.querySelector('.anyink-gap-handle')).toBe(null);
		uninstall();
	});
});
