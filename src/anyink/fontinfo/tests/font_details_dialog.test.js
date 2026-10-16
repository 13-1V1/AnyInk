// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Font details (UX-BEGINNER.md 4.8, 7.3, section 10 B15):
	  - Font name writes both the project name and the font family, as ONE settings Undo step;
	    one Undo puts both back
	  - Your name and Copyright are settings steps too; Copyright fills itself from Your name and
	    the year, inside the same step, until he edits it
	  - each field change is one step when the field loses focus (or Enter, or the dialog closes)
	  - Numbers & symbols is the board's own switch (one settings step)
	  - Move the guide lines... closes the dialog and unlocks the lines
	  - only in Simple with 'fontDetails' on; the top bar's door event opens it
	  - no banned word on the dialog
	Written before the code: font_details_dialog.js did not exist.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLinesMoving } from '../../mode/locks.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { FONT_DETAILS_EVENT, openDoor } from '../../topbar/doors.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { fixEditor } from '../../checks/tests/fix_fixtures.js';
import {
	autoCopyright,
	closeFontDetails,
	copyrightFollows,
	FONT_DETAILS_NAME,
	installFontDetails,
	isFontDetailsOpen,
	openFontDetails,
	readDetails,
	setCopyright,
	setFontName,
	setYourName,
} from '../font_details_dialog.js';
import { stopMovingLines } from '../move_lines.js';

const YEAR = new Date().getFullYear();

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ fontDetails: true });
	resetToastsForTests();
});
afterEach(() => {
	closeFontDetails();
	stopMovingLines();
	resetToastsForTests();
	warn.mockRestore();
});

/** A font with one letter open, at the 1,000-unit grid */
const anEditor = (options = { open: 'n' }) => fixEditor({}, options);
const settings = (editor) => editor.project.settings;
const steps = (editor) => editor.history.length;
const topTitle = (editor) => editor.history.queue[0]?.title;

const dialog = () => document.querySelector(`[data-anyink-dialog="${FONT_DETAILS_NAME}"]`);
const field = (name) => dialog()?.querySelector(`[data-anyink-fontinfo-field="${name}"]`);
const action = (name) => dialog()?.querySelector(`[data-anyink-fontinfo-action="${name}"]`);
/** Types into a field and leaves it, as he would */
function typeAndLeave(name, value) {
	const input = field(name);
	input.focus();
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
	input.blur();
}

describe('the font name goes to both places as one settings step', () => {
	it('writes the project name and the font family; one Undo puts both back', () => {
		const editor = anEditor();
		const before = steps(editor);
		expect(setFontName(editor, '  Brennan Hand  ')).toBe(true);
		expect(settings(editor).project.name).toBe('Brennan Hand');
		expect(settings(editor).font.family).toBe('Brennan Hand');
		expect(steps(editor)).toBe(before + 1);
		expect(editor.history.queue[0].settingsSave).toBe(true);
		expect(historyText(topTitle(editor))).toBe('changed the font name');
		editor.history.restoreState();
		expect(settings(editor).project.name).toBe('Spacing 1000');
		expect(settings(editor).font.family).toBe('Spacing 1000');
	});

	it('a blank name or the same name is no step', () => {
		const editor = anEditor();
		const before = steps(editor);
		expect(setFontName(editor, '   ')).toBe(false);
		expect(setFontName(editor, 'Spacing 1000')).toBe(false);
		expect(steps(editor)).toBe(before);
		expect(settings(editor).project.name).toBe('Spacing 1000');
	});

	it('a family that had drifted from the project name is brought back with it', () => {
		const editor = anEditor();
		settings(editor).font.family = 'Old family';
		expect(setFontName(editor, 'Spacing 1000')).toBe(true);
		expect(settings(editor).font.family).toBe('Spacing 1000');
	});
});

describe('Copyright fills itself from Your name until he edits it', () => {
	it('the rule', () => {
		expect(autoCopyright('Brennan Meyer', 2026)).toBe('Copyright 2026 Brennan Meyer');
		expect(autoCopyright('  ', 2026)).toBe('');
		expect(copyrightFollows('', '')).toBe(true);
		expect(copyrightFollows('', 'Brennan Meyer')).toBe(true);
		expect(copyrightFollows('Copyright 2025 Brennan Meyer', 'Brennan Meyer')).toBe(true);
		expect(copyrightFollows('Copyright 2026 Someone Else', 'Brennan Meyer')).toBe(false);
		expect(copyrightFollows('(c) Brennan', 'Brennan')).toBe(false);
	});

	it('Your name fills Copyright in the same step; one Undo puts both back', () => {
		const editor = anEditor();
		const before = steps(editor);
		expect(setYourName(editor, 'Brennan Meyer')).toBe(true);
		expect(settings(editor).font.designer).toBe('Brennan Meyer');
		expect(settings(editor).font.copyright).toBe(`Copyright ${YEAR} Brennan Meyer`);
		expect(steps(editor)).toBe(before + 1);
		expect(historyText(topTitle(editor))).toBe('changed your name');
		editor.history.restoreState();
		expect(settings(editor).font.designer).toBe('');
		expect(settings(editor).font.copyright).toBe('');
	});

	it('follows a name change, and stops once he writes his own', () => {
		const editor = anEditor();
		setYourName(editor, 'Brennan');
		setYourName(editor, 'Brennan Meyer');
		expect(settings(editor).font.copyright).toBe(`Copyright ${YEAR} Brennan Meyer`);
		expect(setCopyright(editor, 'Copyright 2026 B. Meyer Type')).toBe(true);
		expect(historyText(topTitle(editor))).toBe('changed the copyright');
		setYourName(editor, 'B. Meyer');
		expect(settings(editor).font.copyright).toBe('Copyright 2026 B. Meyer Type');
	});

	it('reads what the dialog shows', () => {
		const editor = anEditor();
		setFontName(editor, 'Brennan Hand');
		setYourName(editor, 'Brennan Meyer');
		expect(readDetails(editor.project)).toEqual({
			fontName: 'Brennan Hand',
			yourName: 'Brennan Meyer',
			copyright: `Copyright ${YEAR} Brennan Meyer`,
			numbers: false,
		});
	});
});

describe('the dialog', () => {
	it('opens only in Simple with Font details on', () => {
		const editor = anEditor();
		setModeForTests('all');
		expect(openFontDetails({ editor })).toBeNull();
		setModeForTests('simple');
		setFeaturesForTests({ fontDetails: false });
		expect(openFontDetails({ editor })).toBeNull();
		setFeaturesForTests({ fontDetails: true });
		expect(openFontDetails({ editor })).not.toBeNull();
		expect(isFontDetailsOpen()).toBe(true);
		expect(dialog()).not.toBeNull();
	});

	it('shows the font as it is, with one green button (Done)', () => {
		const editor = anEditor();
		setYourName(editor, 'Brennan Meyer');
		openFontDetails({ editor });
		expect(field('fontName').value).toBe('Spacing 1000');
		expect(field('yourName').value).toBe('Brennan Meyer');
		expect(field('copyright').value).toBe(`Copyright ${YEAR} Brennan Meyer`);
		const greens = [...dialog().querySelectorAll('.anyink-primary')].map((b) => b.textContent);
		expect(greens).toEqual([word('fontinfo.done')]);
		expect(dialog().textContent).toContain(word('fontinfo.moreLetters'));
	});

	it('a field change is one step when the field loses focus', () => {
		const editor = anEditor();
		openFontDetails({ editor });
		const before = steps(editor);
		typeAndLeave('fontName', 'Brennan Hand');
		expect(steps(editor)).toBe(before + 1);
		expect(settings(editor).font.family).toBe('Brennan Hand');
		// leaving it again with nothing new is no step
		field('fontName').dispatchEvent(new Event('change', { bubbles: true }));
		field('fontName').blur();
		expect(steps(editor)).toBe(before + 1);
		typeAndLeave('yourName', 'Brennan Meyer');
		expect(steps(editor)).toBe(before + 2);
		// the copyright field shows what Your name filled in
		expect(field('copyright').value).toBe(`Copyright ${YEAR} Brennan Meyer`);
	});

	it('typing alone is no step; Enter is, and closing the dialog keeps what was typed', () => {
		const editor = anEditor();
		openFontDetails({ editor });
		const before = steps(editor);
		const input = field('fontName');
		input.focus();
		input.value = 'Brennan Hand';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(steps(editor)).toBe(before);
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(steps(editor)).toBe(before + 1);
		const name = field('yourName');
		name.focus();
		name.value = 'Brennan Meyer';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		action('done').click();
		expect(isFontDetailsOpen()).toBe(false);
		expect(settings(editor).font.designer).toBe('Brennan Meyer');
		expect(steps(editor)).toBe(before + 2);
	});

	it('Escape closes it and keeps what was typed', () => {
		const editor = anEditor();
		openFontDetails({ editor });
		const input = field('copyright');
		input.focus();
		input.value = 'Copyright 2026 Me';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(isFontDetailsOpen()).toBe(false);
		expect(settings(editor).font.copyright).toBe('Copyright 2026 Me');
	});

	it('a blank font name goes back to the name it had', () => {
		const editor = anEditor();
		openFontDetails({ editor });
		const before = steps(editor);
		typeAndLeave('fontName', '   ');
		expect(field('fontName').value).toBe('Spacing 1000');
		expect(steps(editor)).toBe(before);
	});

	it('Numbers & symbols is the board switch: one settings step each way', () => {
		const editor = anEditor();
		openFontDetails({ editor });
		const toggle = action('numbers');
		expect(toggle.getAttribute('aria-checked')).toBe('false');
		const before = steps(editor);
		toggle.click();
		expect(settings(editor).anyink.letterSet).toBe('quick+numbers');
		expect(toggle.getAttribute('aria-checked')).toBe('true');
		expect(steps(editor)).toBe(before + 1);
		toggle.click();
		expect(settings(editor).anyink.letterSet).toBe('quick');
		expect(steps(editor)).toBe(before + 2);
	});

	it('Move the guide lines... closes it and unlocks the lines', () => {
		const editor = anEditor();
		openFontDetails({ editor });
		action('moveLines').click();
		expect(isFontDetailsOpen()).toBe(false);
		expect(guideLinesMoving()).toBe(true);
	});

	it("answers the top bar's door", () => {
		const editor = anEditor();
		const uninstall = installFontDetails({ getEditor: () => editor });
		openDoor(FONT_DETAILS_EVENT, { cause: 'fontName' });
		expect(isFontDetailsOpen()).toBe(true);
		closeFontDetails();
		uninstall();
		openDoor(FONT_DETAILS_EVENT, { cause: 'menu' });
		expect(isFontDetailsOpen()).toBe(false);
	});
});

scanSimpleScreen('Font details dialog', () => {
	setFeaturesForTests({ fontDetails: true });
	const editor = anEditor();
	setYourName(editor, 'Brennan Meyer');
	openFontDetails({ editor });
	return dialog();
});
