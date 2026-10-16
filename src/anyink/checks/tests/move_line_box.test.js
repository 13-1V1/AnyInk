// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 fix pass, with the real checks (cache.js): [Move the line to fit your writing] keeps every
// line inside the letter box and never pushes another line past letters that fit it now
// (UX-BEGINNER.md principle 6 "a fix button never does nothing", 4.2, 7.2). The critic's case:
// small a and n written twice as tall as the small-letter line (2,200 against 1,100), with H and
// B Ready on the capitals line. Moving the small-letter line to them pushed the capitals and top
// lines to 2,200, past the 2,048 letter box, and made H and B too short; their own green [Move
// the line] pulled it back down, a and n needed a look again, and round it went. Now a and n
// get [Match size], and pressing every green button there is settles.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { checksSource, getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { useNeedsALook } from '../fix_step.js';
import { runFixAction } from '../fixes.js';
import { fixEditor, glyphId } from './fix_fixtures.js';
import { AUTO, checksFont, scaled, shapesFor } from './letters.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ checks: true, board: true });
	resetToastsForTests();
	resetChecksCacheForTests();
	useNeedsALook(checksSource);
});
afterEach(() => {
	useNeedsALook(null);
	resetChecksCacheForTests();
	resetToastsForTests();
	setModeForTests('all');
	warn.mockRestore();
});

/** The default letter box: 2,048 units; its lines as a new font has them */
const LINES = { ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };

/**
 * An editor on the default grid; `twice` letters drawn at twice their size, `fit` letters as
 * the fixtures draw them.
 */
function editorWith(twice, fit = '') {
	const letters = {};
	[...twice].forEach((char) => {
		letters[char] = { shapes: scaled(shapesFor(char), 2), anyink: { ...AUTO } };
	});
	[...fit].forEach((char) => (letters[char] = null));
	const editor = fixEditor({});
	editor.project = checksFont(letters);
	editor.nav.page = 'Overview';
	return editor;
}

const linesOf = (editor) => {
	const { ascent, capHeight, xHeight, descent } = editor.project.settings.font;
	return { ascent, capHeight, xHeight, descent };
};
const look = (editor, char) => checksSource(editor.project.glyphs[glyphId(char)], { editor });

/** The first letter (in code order) that needs a look, as the board's Needs a look lists them */
function firstLook(editor) {
	const states = [...getChecksCache().states(editor).values()].filter((state) => state.needsLook);
	states.sort((a, b) => a.char.codePointAt(0) - b.char.codePointAt(0));
	return states[0] ? { char: states[0].char, look: states[0].needsLook } : null;
}

/** Presses every green button there is, one at a time, the way he would; at most `max` */
function pressEverything(editor, max = 8) {
	const presses = [];
	const box = editor.project.settings.font.upm;
	for (let i = 0; i < max; i++) {
		const next = firstLook(editor);
		if (!next) break;
		presses.push(`${next.char}:${next.look.fix}`);
		const args = { char: next.char, check: next.look.id, ...next.look.args };
		expect(runFixAction(args, { editor })).toBe(true);
		const lines = linesOf(editor);
		expect(Math.max(lines.ascent, lines.capHeight, lines.xHeight)).toBeLessThanOrEqual(box);
		expect(lines.descent).toBeGreaterThanOrEqual(-box);
	}
	return presses;
}

describe('Move the line with H and B already Ready (the critic case)', () => {
	it('a and n are offered Match size: the move would push the capitals line past H and B', () => {
		const editor = editorWith('an', 'HB');
		expect(look(editor, 'a')).toMatchObject({ id: 'size', fix: 'matchSize' });
		expect(look(editor, 'n')).toMatchObject({ id: 'size', fix: 'matchSize' });
		expect(look(editor, 'H')).toBeNull();
		expect(look(editor, 'B')).toBeNull();
	});

	it('pressing every green button settles: two presses, no line moved, every letter Ready', () => {
		const editor = editorWith('an', 'HB');
		expect(pressEverything(editor)).toEqual(['a:matchSize', 'n:matchSize']);
		expect(firstLook(editor)).toBeNull();
		expect(linesOf(editor)).toEqual(LINES);
		['a', 'n', 'H', 'B'].forEach((char) =>
			expect(getChecksCache().isReady(editor.project.glyphs[glyphId(char)], { editor })).toBe(true)
		);
	});
});

describe('Move the line when nothing else is on the lines it pushes', () => {
	it('writing past the letter box: Match size, and the lines stay inside it', () => {
		// a and n at 2,200 are taller than the whole 2,048 letter box: no line can go there
		const editor = editorWith('an');
		expect(look(editor, 'a')).toMatchObject({ id: 'size', fix: 'matchSize' });
		expect(pressEverything(editor)).toEqual(['a:matchSize', 'n:matchSize']);
		expect(linesOf(editor)).toEqual(LINES);
	});

	it('writing inside the letter box: the line moves to it once, and every letter is Ready', () => {
		// a and n at 1.6 times the line (1,760): the capitals and top lines go along, inside the box
		const editor = fixEditor({});
		editor.project = checksFont({
			a: { shapes: scaled(shapesFor('a'), 1.6), anyink: { ...AUTO } },
			n: { shapes: scaled(shapesFor('n'), 1.6), anyink: { ...AUTO } },
		});
		editor.nav.page = 'Overview';
		expect(look(editor, 'a')).toMatchObject({ id: 'size', fix: 'moveLine' });
		expect(pressEverything(editor)).toEqual(['a:moveLine']);
		expect(linesOf(editor)).toEqual({
			ascent: 1760,
			capHeight: 1760,
			xHeight: 1760,
			descent: -440,
		});
		expect(firstLook(editor)).toBeNull();
	});
});
