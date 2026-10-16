// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration: the banned-word scan (UX-BEGINNER.md 2.3, strict) on the Simple screens
// the integration joined: the letter card with "Needs a look" and a soft note, the board under
// "Needs a look" with the real checks and the Next line's guided rule 9 (D-042), the toast a
// moved line says, and the box a dropped work file asks with.
import { afterEach, beforeAll, beforeEach, describe, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { makeBoard, resetBoardForTests } from '../../board/board_page.js';
import { resetFiltersForTests, setBoardFilter } from '../../board/filters.js';
import { resetCoachActionsForTests, runCoachAction } from '../../coach/actions.js';
import { getCoach } from '../../coach/coach_state.js';
import { openDroppedFont } from '../../files/open_font.js';
import { makeLetterCard, resetLetterCardForTests } from '../../letter/letter_card.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { glyphId } from '../../spacing/tests/fixtures.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { resetChecksCacheForTests } from '../cache.js';
import { initChecks, stopChecksForTests } from '../checks_app.js';
import { AUTO, checksFont, FONT, moved, plain, rect, shapesFor, STROKE } from './letters.js';

beforeAll(() => {
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
});
let quiet = [];
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) {
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	}
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	quiet = [vi.spyOn(console, 'warn').mockImplementation(() => {})];
	resetBoardForTests();
	resetFiltersForTests();
	resetToastsForTests();
	resetCoachActionsForTests();
	resetChecksCacheForTests();
	resetLetterCardForTests();
	setFeaturesForTests({ letterView: true, board: true, checks: true });
	initChecks();
});
afterEach(() => {
	stopChecksForTests();
	resetChecksCacheForTests();
	quiet.forEach((spy) => spy.mockRestore());
	document.body.innerHTML = '';
});

/** small n floats; small e is drawn 45 % too tall; small l with a pen twice as thick */
function brokenEditor({ page = 'Overview', open = null } = {}) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = checksFont({
		...plain('hoa'),
		n: { shapes: moved(shapesFor('n'), 0, Math.round(FONT.upm * 0.1)), anyink: { ...AUTO } },
		e: {
			shapes: shapesFor('e').map((shape) => ({
				...shape,
				pathPoints: shape.pathPoints.map((point) => {
					const map = (c) => c && { x: 100 + (c.x - 100) * 1.45, y: c.y * 1.45 };
					return {
						...point,
						p: { ...point.p, coord: map(point.p.coord) },
						...(point.h1 ? { h1: { ...point.h1, coord: map(point.h1.coord) } } : {}),
						...(point.h2 ? { h2: { ...point.h2, coord: map(point.h2.coord) } } : {}),
					};
				}),
			})),
			anyink: { ...AUTO },
		},
		l: [rect(100, 0, 100 + 2 * STROKE, FONT.ascent)],
	});
	editor.nav.page = page;
	if (open) editor.selectedGlyphID = glyphId(open);
	return editor;
}

/** The Next line's words as the coach element would show them */
function lineTexts() {
	const line = getCoach().line();
	return [line.sentence, line.button].filter(Boolean);
}

describe('B10 + B11 screens say no banned word (strict)', () => {
	scanSimpleScreen(
		'the letter card: Needs a look with Looks fine to me, and the Next line with the fix',
		() => {
			const editor = brokenEditor({ page: 'Characters', open: 'e' });
			const card = makeLetterCard(editor);
			document.body.appendChild(card);
			return { root: card, texts: { 'Next line': lineTexts() } };
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'the letter card: a soft note',
		() => {
			const editor = brokenEditor({ page: 'Characters', open: 'l' });
			const card = makeLetterCard(editor);
			document.body.appendChild(card);
			return card;
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'the board on Needs a look with the real checks, and the guided Next line',
		() => {
			const editor = brokenEditor();
			setBoardFilter(editor, 'needsLook');
			const board = makeBoard(editor);
			document.body.appendChild(board);
			return { root: board, texts: { 'Next line': lineTexts() } };
		},
		{ strict: true }
	);

	scanSimpleScreen(
		"a tile's fix and Looks fine to me, and the steps' names",
		() => {
			const editor = brokenEditor();
			runCoachAction('fixLetter', { char: 'n', check: 'offLine', fix: 'sitOnLine' }, { editor });
			runCoachAction('looksFine', { char: 'e', check: 'size' }, { editor });
			return { root: null, texts: { 'Undo titles': editor.history.queue.map((e) => e.title) } };
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'a work file dropped with unsaved work: the box',
		async () => {
			const editor = brokenEditor();
			await openDroppedFont({
				editor,
				file: new File(['{}'], 'Brennan Hand.gs2'),
				handle: null,
				unsaved: () => true,
			});
			return document.querySelector('#modal-dialog');
		},
		{ strict: true }
	);
});
