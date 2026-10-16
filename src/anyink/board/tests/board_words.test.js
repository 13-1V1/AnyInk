// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-page: the letter board says no banned word (UX-BEGINNER.md 2.3; principle 2), in
	every state it has, strict (2.4 E and G: no "project", no Unicode block names): the top bar,
	the Next line and the board of a new font; the seeded font with B11's checks on, "Needs a
	look" picked (a reason and its fixes on the tile), Letter spacing... and Numbers & symbols
	added; a finished section's toast. Sentence case: no heading or label in capitals (2.2).
	Written before board_page.js existed (red: no board was drawn, so the scan of the board had
	nothing to look at, and the test's own checks for the board failed).
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect } from 'vitest';
import { resetCoachActionsForTests } from '../../coach/actions.js';
import { setCoachSource } from '../../coach/coach_state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { openLetterFromBoard, resetBoardForTests } from '../board_page.js';
import { resetFiltersForTests } from '../filters.js';
import { addLetter, boardEditor, lookChecks, openPage, square } from './board_font.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');

/** The stylesheets that decide what shows and its case (vitest skips CSS imports). */
function addStyles() {
	['anyink/mode/hide.css', 'anyink/mode/simple_labels.css', 'anyink/board/board.css'].forEach(
		(path) => {
			const style = document.createElement('style');
			style.dataset.scan = path;
			style.textContent = css(path);
			document.head.appendChild(style);
		}
	);
}

beforeEach(() => {
	if (!Element.prototype.animate) {
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	}
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	resetBoardForTests();
	resetFiltersForTests();
	resetToastsForTests();
	resetCoachActionsForTests();
});
afterEach(() => {
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

const q = (selector) => document.querySelector(selector);

describe('the letter board says no banned word (2.3)', () => {
	scanSimpleScreen('a new font: the top bar, the Next line and the board', () => {
		setFeaturesForTests({ board: true });
		addStyles();
		const board = openPage(boardEditor({ seed: false }));
		expect(board).not.toBeNull();
		return q('#app__wrapper');
	});

	scanSimpleScreen(
		'the seeded font, checks on, Needs a look picked, Letter spacing, Numbers & symbols added',
		() => {
			setFeaturesForTests({ board: true, checks: true, tryIt: true });
			setCoachSource('checks', lookChecks());
			addStyles();
			const board = openPage(boardEditor());
			q('[data-anyink-board-tool="numbers"]').click();
			expect(q('[data-anyink-board-section="numbers"]')).not.toBeNull();
			expect(q('[data-anyink-board-tool="letterSpacing"]')).not.toBeNull();
			const scanAll = board.cloneNode(true);
			q('[data-anyink-board-filter="needsLook"]').click();
			expect(q('.anyink-board__look')).not.toBeNull();
			// the All view too, as it was before the pick
			q('#app__wrapper').appendChild(scanAll);
			return q('#app__wrapper');
		}
	);

	scanSimpleScreen('a section finished: its check mark and its toast', () => {
		setFeaturesForTests({ board: true });
		addStyles();
		const editor = boardEditor({ seed: false });
		[...'abcdefghijklmnopqrstuvwxy'].forEach((char) => addLetter(editor.project, char, [square()]));
		openPage(editor);
		openLetterFromBoard(editor, 'z');
		editor.selectedGlyph.addOneShape(square());
		editor.history.addState('drew z');
		openPage(editor, 'Overview');
		expect(q('[data-anyink-board-section="small"]').hasAttribute('data-done')).toBe(true);
		return q('#app__wrapper');
	});
});
