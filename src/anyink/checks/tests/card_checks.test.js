// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration: the letter card with the checks (UX-BEGINNER.md 4.3 Header: "Needs a
// look: <reason>" with [Looks fine to me] (outlined); a soft note as a quiet line; the fix
// button is the Next line's, never repeated in the card; 4.2 "Ready"). Simple with 'checks' on,
// the card reading the checks cache (the Next line's own source), on letters drawn from the
// font's lines (checks/tests/letters.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import {
	cardSections,
	letterCardState,
	makeLetterCard,
	resetLetterCardForTests,
} from '../../letter/letter_card.js';
import { resetLetterViewForTests } from '../../letter/view_switches.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { glyphId } from '../../spacing/tests/fixtures.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { findBanned, findUppercase } from '../../words/banned.js';
import { word } from '../../words/words.js';
import { getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { isLooksFine } from '../looks_fine.js';
import { AUTO, checksFont, FONT, moved, plain, rect, shapesFor, STROKE } from './letters.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, checks: true });
	resetToastsForTests();
	resetChecksCacheForTests();
	resetLetterCardForTests();
	resetLetterViewForTests();
});
afterEach(() => {
	resetChecksCacheForTests();
	resetToastsForTests();
	warn.mockRestore();
});

const N = glyphId('n');
const L = glyphId('l');

/**
 * small n floats 10 % of the letter box over the writing line; small l is drawn with a pen
 * twice as thick as the others (a soft note, never "Needs a look")
 */
function cardEditor(open = 'n') {
	const editor = new ProjectEditor();
	editor.project = checksFont({
		...plain('hoae'),
		n: { shapes: moved(shapesFor('n'), 0, Math.round(FONT.upm * 0.1)), anyink: { ...AUTO } },
		l: [rect(100, 0, 100 + 2 * STROKE, FONT.ascent)],
	});
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = glyphId(open);
	void editor.selectedGlyph;
	return editor;
}

function mount(editor) {
	const card = makeLetterCard(editor);
	document.body.appendChild(card);
	return card;
}

const q = (selector) => document.querySelector(selector);
const chip = () => q('.anyink-letter-card [data-anyink-state]');
const sections = () =>
	[...document.querySelectorAll('[data-anyink-card]')].map((el) => el.dataset.anyinkCard);

describe('the letter card with the checks on', () => {
	it('a letter that needs a look: the amber chip says why, with Looks fine to me (outlined)', () => {
		const editor = cardEditor('n');
		mount(editor);
		expect(chip().dataset.anyinkState).toBe('needsLook');
		expect(chip().textContent.trim()).toBe('Needs a look: floats above the writing line');
		expect(chip().title).toBe('small n floats above the writing line.');
		expect(sections()).toEqual(['header', 'look', 'main', 'fineTune']);
		const looksFine = q('[data-anyink-action="looksFine"]');
		expect(looksFine.textContent).toBe(word('checks.looksFine'));
		// outlined: never the green button (the Next line's [Sit on the line] is the one)
		expect(looksFine.classList.contains('anyink-primary')).toBe(false);
		// the fix button is the Next line's, never repeated in the card
		expect(q('.anyink-letter-card').textContent).not.toContain(word('fixes.button.sitOnLine'));
		const said = q('.anyink-letter-card').textContent;
		expect(findBanned(said, { strict: true })).toEqual([]);
		expect(findUppercase(q('.anyink-letter-card'))).toEqual([]);
	});

	it('Looks fine to me is one step named for the letter; the chip says Ready; Undo brings the look back', () => {
		const editor = cardEditor('n');
		mount(editor);
		const steps = editor.history.queue.length;
		q('[data-anyink-action="looksFine"]').click();
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('said small n looks fine');
		expect(isLooksFine(editor.project.glyphs[N], 'offLine')).toBe(true);
		expect(getChecksCache().state(editor, editor.project.glyphs[N]).ready).toBe(true);
		expect(chip().dataset.anyinkState).toBe('ready');
		expect(chip().textContent.trim()).toBe(word('letter.state.ready'));
		expect(q('[data-anyink-action="looksFine"]')).toBeNull();

		editor.history.restoreState();
		expect(isLooksFine(editor.project.glyphs[N], 'offLine')).toBe(false);
		expect(getChecksCache().state(editor, editor.project.glyphs[N]).needsLook?.id).toBe('offLine');
		expect(chip().dataset.anyinkState).toBe('needsLook');
	});

	it('a soft note is a quiet line, and the letter stays Ready', () => {
		const editor = cardEditor('l');
		mount(editor);
		expect(getChecksCache().state(editor, editor.project.glyphs[L]).ready).toBe(true);
		expect(chip().dataset.anyinkState).toBe('ready');
		expect(q('.anyink-letter-card__note').textContent).toBe(word('checks.note.thicker'));
		expect(q('[data-anyink-action="looksFine"]')).toBeNull();
	});

	it('the photo card running (step C of a new trace): no Looks fine to me beside its Use it', () => {
		const editor = cardEditor('n');
		const state = letterCardState(editor);
		expect(cardSections(state)).toContain('look');
		expect(cardSections({ ...state, photoCardOpen: true })).not.toContain('look');
	});

	it('All tools and Simple without the checks: the card says Ready, as B7 did', () => {
		setFeaturesForTests({ checks: false });
		const editor = cardEditor('n');
		expect(letterCardState(editor)).toMatchObject({ status: 'ready', look: null, notes: [] });
		setFeaturesForTests({ checks: true });
		setModeForTests('all');
		expect(letterCardState(editor)).toMatchObject({ status: 'ready', look: null, notes: [] });
	});
});
