// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2: a letter-set toggle (settings.anyink.letterSet, UX-BEGINNER 4.2) and a name change (Font
// name writes the project name and the font family, 4.8) each undo and redo as one settings step,
// in both modes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { B, traceInto, twoLetterEditor } from './two_letters.js';

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

describe.each(['all', 'simple'])('settings steps in %s', (mode) => {
	beforeEach(() => setModeForTests(mode));

	it('a letter-set toggle undoes and redoes as a settings step', () => {
		const editor = twoLetterEditor();
		const anyink = editor.project.settings.anyink;
		expect(anyink.letterSet).toBeUndefined();

		anyink.letterSet = 'quick+numbers';
		editor.history.addSettingsState('added numbers & symbols');
		expect(editor.history.length).toBe(1);
		expect(editor.history.queue[0].settingsSave).toBe(true);

		editor.history.restoreState();
		expect('letterSet' in editor.project.settings.anyink).toBe(false);
		expect(editor.project.settings.anyink).toBe(anyink);

		editor.history.redoState();
		expect(editor.project.settings.anyink.letterSet).toBe('quick+numbers');

		anyink.letterSet = 'quick';
		editor.history.addSettingsState('hid numbers & symbols');
		editor.history.restoreState();
		expect(anyink.letterSet).toBe('quick+numbers');
	});

	it('a name change (project name and font family together) undoes as one settings step', () => {
		const editor = twoLetterEditor();
		const settings = editor.project.settings;
		settings.project.name = 'Brennan Hand';
		settings.font.family = 'Brennan Hand';
		editor.history.addSettingsState('named the font Brennan Hand');

		editor.history.restoreState();
		expect(settings.project.name).toBe('Two Letters');
		expect(settings.font.family).toBe('Two Letters');
		expect(editor.history.queue).toHaveLength(0);

		editor.history.redoState();
		expect(settings.project.name).toBe('Brennan Hand');
		expect(settings.font.family).toBe('Brennan Hand');
	});

	it('undo of a settings step leaves settings.anyink keys it did not change', () => {
		const editor = twoLetterEditor();
		const anyink = editor.project.settings.anyink;
		anyink.letterSet = 'quick+numbers';
		editor.history.addSettingsState('added numbers & symbols');
		// a later item step that writes a photo record (B9's "traced r" is an item step)
		editor.selectedGlyphID = B;
		anyink.photos = { img1: { scale: 1.5 } };
		traceInto(editor);

		editor.history.restoreState(); // the trace
		editor.history.restoreState(); // the letter set
		expect('letterSet' in anyink).toBe(false);
		expect(anyink.photos).toEqual({ img1: { scale: 1.5 } });
	});
});
