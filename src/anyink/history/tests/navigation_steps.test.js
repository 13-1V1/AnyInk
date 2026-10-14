// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 (the B1 leftover in docs/TEST_LOG.md): upstream's "Navigated to" Undo steps made a saved work
// file "pending" (title dot, autosave, leave warning) although looking at a letter changes
// nothing. In Simple there are no navigation steps at all; in All tools a navigation step is
// still recorded (upstream's undo reads it) but never changes the saved state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSaveStatus, setSaveStatus } from '../../files/save_status.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { getDirtyGeneration } from '../../recovery/recovery.js';
import { isNavigationTitle } from '../history_helpers.js';
import { B, R, traceInto, twoLetterEditor } from './two_letters.js';

const FILE = { kind: 'file', name: 'Two Letters.gs2' };

let warn;
beforeEach(() => {
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

/** What every save path does after a clean write (project_files.js settleSavedState). */
function saved(editor) {
	editor.setProjectAsSaved();
	setSaveStatus(editor, { file: 'saved', error: '' });
}

describe('isNavigationTitle', () => {
	it("knows upstream's navigation titles and nothing else", () => {
		expect(isNavigationTitle('Navigated to LATIN CAPITAL LETTER B')).toBe(true);
		expect(isNavigationTitle('Auto-traced 1 shape (4 points)')).toBe(false);
		expect(isNavigationTitle('Navigated')).toBe(false);
		expect(isNavigationTitle(undefined)).toBe(false);
	});
});

describe('All tools: a navigation step never changes the saved state', () => {
	it('looking at another letter after a save keeps the work file saved', () => {
		const editor = twoLetterEditor({ fileHandle: FILE });
		editor.selectedGlyphID = B;
		traceInto(editor);
		saved(editor);
		const generation = getDirtyGeneration();

		showItem(editor, R);
		expect(editor.history.queue[0].title.startsWith('Navigated to')).toBe(true);
		expect(getSaveStatus(editor).file).toBe('saved');
		expect(document.title).toBe('ANY-INK');
		expect(editor.history.isAtSavedState()).toBe(true);
		expect(getDirtyGeneration()).toBe(generation);
	});

	it('undo of an edit made after looking around comes back to "saved"', () => {
		const editor = twoLetterEditor({ fileHandle: FILE });
		editor.selectedGlyphID = B;
		traceInto(editor);
		saved(editor);
		showItem(editor, R);
		traceInto(editor);
		expect(document.title).toBe('ANY-INK •');
		expect(getSaveStatus(editor).file).toBe('pending');
		editor.history.restoreState(); // r back to empty: the file's state
		expect(document.title).toBe('ANY-INK');
	});

	it('a navigation step on unsaved work leaves it unsaved, and still clears redo', () => {
		const editor = twoLetterEditor({ fileHandle: FILE });
		editor.selectedGlyphID = B;
		traceInto(editor);
		traceInto(editor, 60);
		editor.history.restoreState();
		expect(editor.history.redoQueue).toHaveLength(1);
		showItem(editor, R);
		expect(document.title).toBe('ANY-INK •');
		expect(getSaveStatus(editor).file).toBe('pending');
		expect(editor.history.isAtSavedState()).toBe(false);
		expect(editor.history.redoQueue).toHaveLength(0);
	});

	it('a font opened from its file stays saved while letters are looked at', () => {
		const editor = twoLetterEditor({ fileHandle: FILE });
		showItem(editor, B);
		showItem(editor, R);
		expect(editor.history.queue).toHaveLength(2);
		expect(getSaveStatus(editor).file).toBe('saved');
		expect(document.title).toBe('ANY-INK');
	});

	it('undo and redo of a lone navigation step keep a saved font saved', () => {
		const editor = twoLetterEditor({ fileHandle: FILE });
		showItem(editor, R);
		expect(editor.history.queue).toHaveLength(1);
		const generation = getDirtyGeneration();
		editor.history.restoreState(); // nothing older: back to r as loaded, which it still is
		expect(editor.history.queue).toHaveLength(0);
		expect(document.title).toBe('ANY-INK');
		expect(editor.history.isAtSavedState()).toBe(true);
		expect(getSaveStatus(editor).file).toBe('saved');
		editor.history.redoState();
		expect(editor.history.queue).toHaveLength(1);
		expect(document.title).toBe('ANY-INK');
		expect(editor.history.isAtSavedState()).toBe(true);
		expect(getSaveStatus(editor).file).toBe('saved');
		expect(getDirtyGeneration()).toBe(generation);
	});

	it("upstream's navigation-only press keeps the saved state (and leaves nothing to redo)", () => {
		const editor = twoLetterEditor({ fileHandle: FILE });
		editor.selectedGlyphID = B;
		traceInto(editor);
		saved(editor);
		showItem(editor, R);
		editor.history.restoreState(); // only moves back to B
		expect(editor.selectedGlyphID).toBe(B);
		expect(document.title).toBe('ANY-INK');
		expect(editor.history.isAtSavedState()).toBe(true);
		expect(editor.history.redoQueue).toHaveLength(0);
	});
});

describe('Simple: no navigation steps at all', () => {
	it('opening letters adds nothing to the Undo list and changes nothing about saving', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor({ fileHandle: FILE });
		editor.selectedGlyphID = B;
		traceInto(editor);
		saved(editor);
		const generation = getDirtyGeneration();
		showItem(editor, R);
		showItem(editor, B);
		editor.history.addState('Navigated to LATIN SMALL LETTER R');
		expect(editor.history.queue).toHaveLength(1);
		expect(getSaveStatus(editor).file).toBe('saved');
		expect(document.title).toBe('ANY-INK');
		expect(getDirtyGeneration()).toBe(generation);
	});
});
