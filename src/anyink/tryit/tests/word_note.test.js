// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 (UX-BEGINNER.md 4.6: "The first gap fix shows the 'Word needs one setting' line, until Use in
// Word has shown its step 4 once"; section 10 B12 stub: before B14 the note has no pointer to step
// 3). Unit test "the Word note appears after the first gap fix".
// Written to fail first: src/anyink/tryit/word_note.js did not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import { beginGapDrag, removeGapFix } from '../gap_handle.js';
import {
	WORD_STEP_PREF,
	makeWordNote,
	markWordGapStepShown,
	shouldShowWordNote,
	wordNoteText,
} from '../word_note.js';
import { gapsEditor } from './gaps_fixture.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	localStorage.clear();
	resetPrefsCache();
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

const NOW = 'Word needs one setting for gap fixes. Use in Word will show you.';
const LATER =
	'Word needs one setting for gap fixes. Nothing to do now: you will be shown it when you put your font in Word.';
/** Shown, or keeping its place with nothing in it (never display: none). */
const isEmpty = (element) => {
	expect(element.hidden).toBe(false);
	expect(getComputedStyle(element).display).not.toBe('none');
	const empty = element.classList.contains('is-empty');
	expect(getComputedStyle(element).visibility).toBe(empty ? 'hidden' : 'visible');
	return empty;
};

function fix(editor) {
	const drag = beginGapDrag(editor, 'e', 'n');
	drag.set(-35);
	return drag.finish();
}

describe('the Word note', () => {
	it('appears after the first gap fix, and goes with the last one', () => {
		const editor = gapsEditor();
		const note = makeWordNote({ getEditor: () => editor });
		document.body.appendChild(note.element);
		expect(shouldShowWordNote(editor.project)).toBe(false);
		expect(isEmpty(note.element)).toBe(true);
		fix(editor);
		expect(shouldShowWordNote(editor.project)).toBe(true);
		expect(isEmpty(note.element)).toBe(false);
		// B14 + B15 integration: Use in Word is on in the app, so the note points at it
		expect(note.element.textContent).toBe(NOW);
		removeGapFix(editor, 'e', 'n');
		expect(isEmpty(note.element)).toBe(true);
		note.detach();
	});

	it('stays away once Use in Word has shown its gap-fix step', () => {
		const editor = gapsEditor();
		const note = makeWordNote({ getEditor: () => editor });
		document.body.appendChild(note.element);
		fix(editor);
		expect(isEmpty(note.element)).toBe(false);
		markWordGapStepShown();
		note.refresh();
		expect(isEmpty(note.element)).toBe(true);
		expect(shouldShowWordNote(editor.project)).toBe(false);
		expect(WORD_STEP_PREF).toBeTruthy();
	});

	it('says where to look only once Use in Word is built (B14)', () => {
		expect(wordNoteText()).toBe(NOW);
		setFeaturesForTests({ useInWord: false });
		expect(wordNoteText()).toBe(LATER);
	});
});

scanSimpleScreen('Try it: the Word note after a gap fix', () => {
	const editor = gapsEditor();
	const note = makeWordNote({ getEditor: () => editor });
	document.body.appendChild(note.element);
	fix(editor);
	return note.element;
});

// B12 fix pass (findings: "The whole line of letters jumps up ... as soon as he starts dragging a
// gap handle" and "The Word note gives a to-do with nothing to press"; "'Gaps you fixed' lists
// every one-pair kern group, including hundreds from an imported font"). Written to fail first:
// the note was display: none until the first live drag tick, said only "Word needs one setting
// for gap fixes.", and counted every one-pair rule.
describe('the Word note keeps its place and comes on release', () => {
	it('keeps its row while empty, and shows only when the step is written, not mid-drag', () => {
		const editor = gapsEditor();
		const note = makeWordNote({ getEditor: () => editor });
		document.body.appendChild(note.element);
		expect(isEmpty(note.element)).toBe(true);
		expect(note.element.textContent).not.toBe(''); // a line's height, kept
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-20);
		drag.set(-30);
		expect(isEmpty(note.element)).toBe(true); // nothing comes under the pointer
		drag.finish();
		expect(isEmpty(note.element)).toBe(false);
		note.detach();
	});

	it('says nothing is needed now before Use in Word exists', () => {
		setFeaturesForTests({ useInWord: false });
		const text = wordNoteText();
		expect(text).toMatch(/^Word needs one setting for gap fixes\. /);
		expect(text).toMatch(/Nothing to do now/);
	});

	it("an imported font's pair rules never bring the note", () => {
		const editor = gapsEditor();
		editor.project.addItemByType(
			new KernGroup({ leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -40 }),
			'KernGroup'
		);
		expect(shouldShowWordNote(editor.project)).toBe(false);
		const note = makeWordNote({ getEditor: () => editor });
		document.body.appendChild(note.element);
		expect(isEmpty(note.element)).toBe(true);
	});
});
