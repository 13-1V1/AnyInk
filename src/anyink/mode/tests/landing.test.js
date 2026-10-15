// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 6.3, section 10 B5 "the landing rule (undo to a Kerning entry turns on the
// band)"), on the real History: a gap changed in More tools on the Kerning page, then Simple on
// the letter view; Simple's Undo (B2) moves the view to the changed item, the Kerning page, which
// Simple hides. The landing rule runs on that navigate: More tools turns on for the visit, the
// band says "Undo took you to one of the More tools pages. [Back to my letters]", and Back to my
// letters returns to Simple on the letter view. The editor's navigate() stands in for the wiring
// (Navigator.navigate asks arriveAt before it draws the page).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { B, R, twoLetterProject } from '../../history/tests/two_letters.js';
import { flagsOn } from '../features.js';
import { getMode, getVisit, setModeForTests } from '../mode.js';
import { arriveAt, backToSimple, bandState, makeBand, withLandingCause } from '../band.js';

const KERN = 'kern-1';
const NO_FLAGS = flagsOn();

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

/** Two letters and one gap fix between them (B then r). */
function editorWithAGap() {
	const data = twoLetterProject().save();
	data.kerning = { [KERN]: { leftGroup: ['0x42'], rightGroup: ['0x72'], value: 0 } };
	const editor = new ProjectEditor();
	editor.project = new GlyphrStudioProject(data);
	setCurrentProjectEditor(editor);
	const pages = [];
	// the wiring: every navigate asks the landing rule first, then draws
	editor.navigate = () => {
		arriveAt(editor.nav.page, { isOn: NO_FLAGS });
		pages.push(editor.nav.page);
	};
	return { editor, pages };
}

/** More tools: on the Kerning page, nudge the gap the way the arrow keys do (one item step). */
function nudgeTheGapInMoreTools(editor) {
	editor.nav.page = 'Kerning';
	editor.selectedKernGroupID = KERN;
	editor.selectedKernGroup.value += 10;
	editor.history.addState(`Nudged kern group ${KERN} by 10`);
}

describe('undo lands on a page Simple hides', () => {
	it('Simple undo of a More tools gap change: the Kerning page renders, with the landing band', () => {
		const { editor, pages } = editorWithAGap();
		nudgeTheGapInMoreTools(editor);
		expect(editor.project.kerning[KERN].value).toBe(10);

		// back to Simple, looking at a letter
		setModeForTests('simple');
		editor.nav.page = 'Characters';
		editor.selectedItemID = B;

		withLandingCause('undo', () => editor.history.restoreState());

		expect(editor.project.kerning[KERN].value).toBe(0);
		expect(pages).toEqual(['Kerning']);
		expect(editor.nav.page).toBe('Kerning');
		expect(getMode()).toBe('all');
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'undo' });
		expect(bandState().kind).toBe('landed');
		expect(makeBand().textContent).toBe(
			'Undo took you to one of the More tools pages.Back to my letters'
		);

		// Back to my letters
		backToSimple({ editor, isOn: NO_FLAGS });
		expect(getMode()).toBe('simple');
		expect(editor.nav.page).toBe('Characters');
		expect(bandState()).toBe(null);
		// the gap stays undone: looking around is never a step
		expect(editor.project.kerning[KERN].value).toBe(0);
	});

	it('Simple undo of a letter change stays in Simple (letters live on a page Simple shows)', () => {
		const { editor, pages } = editorWithAGap();
		setModeForTests('simple');
		editor.nav.page = 'Characters';
		editor.selectedItemID = R;
		editor.selectedItem.advanceWidth = 300;
		editor.history.addState('gave small r a width');
		editor.selectedItemID = B;
		withLandingCause('undo', () => editor.history.restoreState());
		expect(pages).toEqual(['Characters']);
		expect(editor.selectedItemID).toBe(R);
		expect(getMode()).toBe('simple');
		expect(bandState()).toBe(null);
	});

	it('All tools (the launch default): undo onto Kerning is today’s undo, no band', () => {
		const { editor, pages } = editorWithAGap();
		nudgeTheGapInMoreTools(editor);
		editor.history.restoreState();
		expect(editor.project.kerning[KERN].value).toBe(0);
		expect(getMode()).toBe('all');
		expect(bandState()).toBe(null);
		expect(pages.every((page) => page === 'Kerning')).toBe(true);
	});
});
