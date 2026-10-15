// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: what the Next line's button does (UX-BEGINNER.md 4.0). B6 + B7 fix pass (hostile
// probe_failed): after a failed save the line's button is Fix, and it opens the same box as the
// status pill's Fix (4.11, 7.7): "Couldn't save to Brennan Hand.gs2. A backup copy is kept."
// [Try again] [Save somewhere else], not a second plain Save on the handle that just failed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { ACTION_EVENT, hasCoachAction, resetCoachActionsForTests, runCoachAction } from '../actions.js';

beforeEach(() => {
	setModeForTests('simple');
	// the error box closes with an animation jsdom doesn't have
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
});
afterEach(() => {
	resetCoachActionsForTests();
	document.body.innerHTML = '';
});

describe('the Next line actions', () => {
	it('fixSave opens the status pill\'s Fix box: Try again, or Save somewhere else', () => {
		const editor = twoLetterEditor();
		editor.loadedFileHandle = {
			kind: 'file',
			name: 'Brennan Hand.gs2',
			getFile() {},
			createWritable() {},
			queryPermission() {},
			requestPermission() {},
		};
		const save = vi.spyOn(editor, 'saveProjectFile').mockResolvedValue(true);
		const heard = vi.fn();
		window.addEventListener(ACTION_EVENT, heard);
		expect(hasCoachAction('fixSave')).toBe(true);
		expect(runCoachAction('fixSave', null, { editor })).toBe(true);
		window.removeEventListener(ACTION_EVENT, heard);
		expect(heard).toHaveBeenCalledTimes(1);
		// nothing saved yet: the box says what happened and lets him choose
		expect(save).not.toHaveBeenCalled();
		const box = document.querySelector('#error[data-anyink-error="error.saveFailed"]');
		expect(box).not.toBe(null);
		expect(box.textContent).toContain('A backup copy is kept.');
		const choices = [...box.querySelectorAll('[data-anyink-choice]')].map(
			(el) => el.dataset.anyinkChoice
		);
		expect(choices).toEqual(['error.button.tryAgain', 'error.button.saveElsewhere']);
		box.querySelector('[data-anyink-choice="error.button.saveElsewhere"]').click();
		expect(save).toHaveBeenLastCalledWith(true);
	});
});
