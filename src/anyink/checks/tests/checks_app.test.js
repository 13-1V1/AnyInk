// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration: initChecks (checks_app.js, called by app/main.js at boot) wires the real
// checks into every screen, so one "Needs a look" shows everywhere (UX-BEGINNER.md 4.2 "Ready",
// "Needs a look" and Filters; 4.0 rules 7 and 9; D-037's one truth): the board's tile is amber
// with the reason and the progress line, the rail and the Next line count it out; the tile's
// own fix and [Looks fine to me] under "Needs a look" are one Undo step each and the board stays
// the board; the Next line's rule 7 offers the fix in the letter view; a fix that flips other
// letters says so once (the one voice, D-042). All tools shows none of it.
// Written to fail first: checks_app.js didn't exist (nothing set the coach's 'checks' source or
// the 'fixLetter' and 'looksFine' actions, so the board showed every inked letter Ready).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { resetBoardForTests, tileOf } from '../../board/board_page.js';
import { resetFiltersForTests } from '../../board/filters.js';
import { hasCoachAction, resetCoachActionsForTests, runCoachAction } from '../../coach/actions.js';
import { getCoach } from '../../coach/coach_state.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { glyphId } from '../../spacing/tests/fixtures.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { refreshSimpleTopBar } from '../../topbar/simple_top_bar.js';
import { findBanned } from '../../words/banned.js';
import { resetChecksCacheForTests } from '../cache.js';
import { initChecks, stopChecksForTests } from '../checks_app.js';
import { isLooksFine } from '../looks_fine.js';
import { AUTO, checksFont, FONT, moved, plain, shapesFor } from './letters.js';

beforeAll(() => {
	if (!customElements.get('anyink-save-status')) {
		customElements.define('anyink-save-status', SaveStatusElement);
	}
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
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
	resetChecksCacheForTests();
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	];
	setModeForTests('simple');
	initChecks();
	// the Next line's coach follows the steps as the app's does (its element starts it)
	getCoach().start();
});
afterEach(() => {
	stopChecksForTests();
	resetChecksCacheForTests();
	quiet.forEach((spy) => spy.mockRestore());
	document.body.innerHTML = '';
	setModeForTests('all');
});

const N = glyphId('n');

/** h o a e sit right; small n floats 10 % of the letter box over the writing line */
function checksEditor({ page = 'Overview' } = {}) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = checksFont({
		...plain('hoae'),
		n: { shapes: moved(shapesFor('n'), 0, Math.round(FONT.upm * 0.1)), anyink: { ...AUTO } },
	});
	editor.project.settings.project.name = 'Brennan Hand';
	editor.nav.page = page;
	return editor;
}

/** The real Navigator draws the page (the top bar, the Next line's state, the page) */
function draw(editor, page = editor.nav.page) {
	if (!document.querySelector('#app__wrapper')) {
		document.body.innerHTML = '<div id="app__wrapper"></div>';
	}
	editor.nav.page = page;
	editor.nav.panel = 'Attributes';
	editor.navigate();
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	refreshSimpleTopBar(document);
	return document.querySelector('[data-anyink-board]');
}

const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const progress = (board) => text(board.querySelector('.anyink-board__progress'));
const rail = () =>
	text(document.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count'));

describe('initChecks', () => {
	it("sets the Next line's checks source and the fix and Looks fine actions", () => {
		expect(hasCoachAction('fixLetter')).toBe(true);
		expect(hasCoachAction('looksFine')).toBe(true);
		const editor = checksEditor();
		const n = getCoach()
			.state()
			.letters.find((letter) => letter.char === 'n');
		expect(n).toMatchObject({ ink: true, ready: false });
		expect(n.needsLook).toMatchObject({ id: 'offLine', fix: 'sitOnLine' });
		expect(editor.project.glyphs[N]).toBeTruthy();
	});
});

describe('the board, the rail and the Next line say one thing', () => {
	it('small n is amber with its reason; 4 of 58 ready on the board and the rail; rule 9', () => {
		const editor = checksEditor();
		const board = draw(editor);
		const tile = tileOf(board, 'n');
		expect(tile.getAttribute('session-state')).toBe('needsLook');
		expect(tile.getAttribute('caption')).toBe('Needs a look');
		expect(tile.title).toBe('small n · Needs a look: floats above the writing line');
		expect(tileOf(board, 'o').getAttribute('session-state')).toBe('ready');
		expect(progress(board)).toBe('4 of 58 ready');
		expect(rail()).toBe('4/58');
		const line = getCoach().line();
		expect(line).toMatchObject({ rule: 9, sentence: '1 letter needs a look.' });
		expect(findBanned(tile.title, { strict: true })).toEqual([]);
	});

	it("Show me puts the board on Needs a look; the line then offers small n's own fix, which works there", () => {
		const editor = checksEditor();
		let board = draw(editor);
		expect(getCoach().line()).toMatchObject({ rule: 9, button: 'Show me' });
		runCoachAction('showNeedsLook', null, { editor });
		board = draw(editor);
		expect(board.getAttribute('data-filter')).toBe('needsLook');
		const line = getCoach().line();
		expect(line).toMatchObject({
			rule: 9,
			sentence: 'small n floats above the writing line.',
			button: 'Sit on the line',
		});
		const steps = editor.history.queue.length;
		expect(runCoachAction(line.action, line.args, { editor })).toBe(true);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('sat small n on the writing line');
		expect(editor.nav.page).toBe('Overview');
		// All again (no letter needs a look now: the filters go, every letter shows)
		board = draw(editor);
		expect(board.querySelector('.anyink-board__filters')).toBeNull();
	});

	it('in the letter view the Next line says the reason with the fix (rule 7)', () => {
		const editor = checksEditor({ page: 'Characters' });
		editor.selectedGlyphID = N;
		expect(getCoach().line()).toMatchObject({
			rule: 7,
			sentence: 'small n floats above the writing line.',
			button: 'Sit on the line',
		});
	});
});

describe("Needs a look on the board: the tile's own buttons", () => {
	it('[Looks fine to me] is one step about small n; the tile is Ready; the board stays the board', () => {
		const editor = checksEditor();
		const board = draw(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		const steps = editor.history.queue.length;
		board.querySelector('[data-anyink-board-fix="looksFine"]').click();
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('said small n looks fine');
		expect(isLooksFine(editor.project.glyphs[N], 'offLine')).toBe(true);
		expect(editor.nav.page).toBe('Overview');
		const again = draw(editor);
		expect(tileOf(again, 'n').getAttribute('session-state')).toBe('ready');
		expect(progress(again)).toBe('5 of 58 ready');
		expect(rail()).toBe('5/58');
	});

	it('[Sit on the line] is one step that seats small n; the board stays the board', () => {
		const editor = checksEditor();
		const board = draw(editor);
		board.querySelector('[data-anyink-board-filter="needsLook"]').click();
		const fix = board.querySelector('[data-anyink-board-fix="fix"]');
		expect(fix.textContent).toBe('Sit on the line');
		const steps = editor.history.queue.length;
		fix.click();
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('sat small n on the writing line');
		expect(editor.nav.page).toBe('Overview');
		const again = draw(editor);
		expect(tileOf(again, 'n').getAttribute('session-state')).toBe('ready');
		expect(progress(again)).toBe('5 of 58 ready');
	});

	it("the Next line's [Sit on the line] in the letter view runs the same fix", () => {
		const editor = checksEditor({ page: 'Characters' });
		editor.selectedGlyphID = N;
		const line = getCoach().line();
		expect(runCoachAction(line.action, line.args, { editor })).toBe(true);
		expect(editor.history.queue[0].title).toBe('sat small n on the writing line');
		expect(
			getCoach()
				.state()
				.letters.find((letter) => letter.char === 'n').ready
		).toBe(true);
	});
});

describe('one voice for letters a change flips (D-042)', () => {
	it('moving the line says so in one toast, never two', async () => {
		const editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		// five letters 30 % over the small-letter line, two a little under it: the line moves
		// up to the five, and a and r are then too short for it
		const sized = (char, k) => ({ shapes: scaled(char, k), anyink: { ...AUTO } });
		editor.project = checksFont({
			n: sized('n', 1.3),
			u: sized('u', 1.3),
			m: sized('m', 1.3),
			x: sized('x', 1.3),
			z: sized('z', 1.3),
			a: sized('a', 0.9),
			r: sized('r', 0.9),
		});
		editor.nav.page = 'Overview';
		const look = getCoach()
			.state()
			.letters.find((letter) => letter.char === 'n').needsLook;
		expect(look.fix).toBe('moveLine');
		runCoachAction('fixLetter', { char: 'n', check: look.id, ...look.args }, { editor });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const flips = toastLog().filter((record) =>
			/Flipped|need a look/.test(String(record.key) + record.text)
		);
		expect(flips.map((record) => record.text)).toEqual([
			'Moving the line made 2 letters need a look.',
		]);
	});
});

describe('All tools', () => {
	it("no amber tile, no filters: the Overview is upstream's", () => {
		setModeForTests('all');
		const editor = checksEditor();
		draw(editor);
		expect(document.querySelector('[data-anyink-board]')).toBeNull();
		expect(document.querySelector('.anyink-board__filters')).toBeNull();
	});
});

/** A letter drawn k times its line's size (fixes_real_checks's letters, at this grid) */
function scaled(char, k) {
	return shapesFor(char).map((shape) => ({
		...shape,
		pathPoints: shape.pathPoints.map((point) => {
			const map = (coord) => coord && { x: 100 + (coord.x - 100) * k, y: coord.y * k };
			return {
				...point,
				p: { ...point.p, coord: map(point.p.coord) },
				...(point.h1 ? { h1: { ...point.h1, coord: map(point.h1.coord) } } : {}),
				...(point.h2 ? { h2: { ...point.h2, coord: map(point.h2.coord) } } : {}),
			};
		}),
	}));
}
