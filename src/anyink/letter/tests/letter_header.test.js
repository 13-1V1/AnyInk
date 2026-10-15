// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter header (UX-BEGINNER.md 4.3 "Header row"): "<- All letters" goes to the board (the
	Overview, where B10 mounts it), the letter's name comes from letterName, and "< A" / "C >"
	step through the board's order (4.2: the Quick font, A to Z, a to z, then . , ' ? ! -, and
	the numbers and symbols once they are added). Opening a letter is looking around: never an
	Undo step (7.3).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { goToLetters, lettersPage } from '../../topbar/letters_page.js';
import { word } from '../../words/words.js';
import { boardOrder, letterIdOf, makeLetterHeader, stepLetter } from '../letter_header.js';
import { resetLetterViewForTests } from '../view_switches.js';

const QUICK_PUNCTUATION = ['.', ',', "'", '?', '!', '-'];

beforeEach(() => {
	resetLetterViewForTests();
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
});
afterEach(() => {
	document.body.innerHTML = '';
});

describe('the board order', () => {
	it('is the Quick font: A to Z, a to z, then the punctuation (58 letters)', () => {
		const order = boardOrder({ settings: {} });
		expect(order).toHaveLength(58);
		expect(order.slice(0, 3)).toEqual(['A', 'B', 'C']);
		expect(order.slice(26, 29)).toEqual(['a', 'b', 'c']);
		expect(order.slice(52)).toEqual(QUICK_PUNCTUATION);
	});

	it('adds the numbers and symbols at the end once they are added', () => {
		const order = boardOrder({ settings: { anyink: { letterSet: 'quick+numbers' } } });
		expect(order).toHaveLength(80);
		expect(order.slice(58, 61)).toEqual(['0', '1', '2']);
		expect(order.at(-1)).toBe('*');
	});

	it('steps to the previous and next letter, round the ends', () => {
		const project = { settings: {} };
		expect(stepLetter(project, 'a', -1)).toBe('Z');
		expect(stepLetter(project, 'a', 1)).toBe('b');
		expect(stepLetter(project, 'A', -1)).toBe('-');
		expect(stepLetter(project, '-', 1)).toBe('A');
		expect(stepLetter({ settings: { anyink: { letterSet: 'quick+numbers' } } }, '-', 1)).toBe('0');
	});

	it('has no previous or next for a letter the board does not show', () => {
		expect(stepLetter({ settings: {} }, 'é', 1)).toBe(null);
		expect(stepLetter({ settings: {} }, '', 1)).toBe(null);
	});

	it("knows each letter's record id", () => {
		expect(letterIdOf('B')).toBe('glyph-0x42');
		expect(letterIdOf('?')).toBe('glyph-0x3F');
	});
});

describe('the header', () => {
	const open = (id = 'glyph-0x42') => {
		const editor = sampleEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = id;
		editor.selectedGlyph;
		const header = makeLetterHeader(editor);
		document.body.appendChild(header);
		return { editor, header };
	};
	const part = (name) => document.querySelector(`[data-anyink-letter="${name}"]`);

	it('says the way back, the name, and the letters on either side', () => {
		open();
		expect(part('back').textContent.trim()).toBe(word('letter.back'));
		expect(part('name').textContent.trim()).toBe('Capital B');
		expect(part('previous').textContent.trim()).toBe('‹ A');
		expect(part('previous').title).toBe(word('letter.goTo', { name: 'Capital A' }));
		expect(part('next').textContent.trim()).toBe('C ›');
		expect(part('next').title).toBe(word('letter.goTo', { name: 'Capital C' }));
	});

	it('the next letter opens with no Undo step, and the header follows', () => {
		const { editor } = open();
		const steps = editor.history.queue.length;
		part('next').click();
		expect(editor.selectedGlyphID).toBe('glyph-0x43');
		expect(editor.history.queue.length).toBe(steps);
		expect(part('name').textContent.trim()).toBe('Capital C');
		expect(part('previous').textContent.trim()).toBe('‹ B');
	});

	it('a letter picked elsewhere (an undo, the strip) updates the header too', () => {
		const { editor } = open();
		editor.selectedGlyphID = 'glyph-0x61';
		expect(part('name').textContent.trim()).toBe('small a');
		expect(part('previous').textContent.trim()).toBe('‹ Z');
	});

	it('"<- All letters" goes to the board', () => {
		const { editor } = open();
		editor.navigate = vi.fn();
		part('back').click();
		expect(editor.nav.page).toBe('Overview');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	// B6 + B7 fix pass (letter-card track): "<- All letters" went to the Overview while the rail's
	// "1 Letters" and the logo went to Simple home: two "letters" buttons, two places. One place now
	// (topbar/letters_page.js), whatever the flags say.
	it('"<- All letters" goes where the logo and "1 Letters" go, with any flags on', () => {
		[
			{ letterView: true, board: false },
			{ letterView: true, board: true },
			{ letterView: false, board: false },
			{ letterView: false, board: true },
		].forEach((flags) => {
			setFeaturesForTests(flags);
			const { editor } = open();
			editor.navigate = vi.fn();
			part('back').click();
			const rail = { nav: { page: 'Characters' }, navigate: vi.fn() };
			goToLetters(rail);
			expect(editor.nav.page, JSON.stringify(flags)).toBe(rail.nav.page);
			expect(editor.nav.page, JSON.stringify(flags)).toBe(lettersPage());
			expect(editor.navigate).toHaveBeenCalledTimes(1);
			document.body.innerHTML = '';
		});
	});

	it('going back is looking around: no Undo step', () => {
		const { editor } = open();
		editor.navigate = vi.fn();
		const steps = editor.history.queue.length;
		part('back').click();
		expect(editor.history.queue.length).toBe(steps);
	});

	it('a letter off the board has no previous or next, only the way back', () => {
		open('glyph-0xE9');
		expect(part('name').textContent.trim()).toBe('small é');
		expect(part('previous')).toBeNull();
		expect(part('next')).toBeNull();
		expect(part('back')).not.toBeNull();
	});
});
