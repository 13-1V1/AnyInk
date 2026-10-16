// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration (the board-page track's need 1, the fixes track's need 5): the rail's
// "1 Letters N/58" counts with the board's Ready rule (board_page.js readyRuleFor: ink, and no
// check that needs a look while 'checks' is on), so the rail, the board's "N of 58 ready" and
// the Next line say one number (UX-BEGINNER.md 4.0 Top bar, 4.2 "Ready"; D-037's one truth).
// Written to fail first: the rail counted ink only (7/58 beside the board's 6 of 58).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCoachSource } from '../../coach/coach_state.js';
import { resetCoachActionsForTests } from '../../coach/actions.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { resetBoardForTests } from '../../board/board_page.js';
import { resetFiltersForTests } from '../../board/filters.js';
import { boardEditor, lookChecks, openPage } from '../../board/tests/board_font.js';
import { refreshSimpleTopBar } from '../simple_top_bar.js';

beforeAll(() => {
	if (!customElements.get('anyink-save-status')) {
		customElements.define('anyink-save-status', SaveStatusElement);
	}
});
let quiet = [];
beforeEach(() => {
	if (!Element.prototype.animate) {
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	}
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	resetBoardForTests();
	resetFiltersForTests();
	resetToastsForTests();
	resetCoachActionsForTests();
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	];
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	document.body.innerHTML = '';
	setModeForTests('all');
});

const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const rail = () =>
	text(document.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count'));
const boardProgress = (board) => text(board.querySelector('.anyink-board__progress'));

describe('the rail counts the way the board does', () => {
	it('checks on: small e needs a look, so the rail says 6/58 beside "6 of 58 ready"', () => {
		setModeForTests('simple');
		setFeaturesForTests({ board: true, checks: true });
		setCoachSource('checks', lookChecks());
		const board = openPage(boardEditor());
		refreshSimpleTopBar(document);
		expect(boardProgress(board)).toBe('6 of 58 ready');
		expect(rail()).toBe('6/58');
	});

	it('a second letter that needs a look takes one more off both', () => {
		setModeForTests('simple');
		setFeaturesForTests({ board: true, checks: true });
		setCoachSource('checks', lookChecks(['e', 'n']));
		const board = openPage(boardEditor());
		refreshSimpleTopBar(document);
		expect(boardProgress(board)).toBe('5 of 58 ready');
		expect(rail()).toBe('5/58');
	});

	it('checks off: Ready is ink, 7 of 58 on both', () => {
		setModeForTests('simple');
		setFeaturesForTests({ board: true, checks: false });
		setCoachSource('checks', lookChecks());
		const board = openPage(boardEditor());
		refreshSimpleTopBar(document);
		expect(boardProgress(board)).toBe('7 of 58 ready');
		expect(rail()).toBe('7/58');
	});
});
