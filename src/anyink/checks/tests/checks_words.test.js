// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 checks in plain words (UX-BEGINNER.md 2.2, 2.3, principle 2): every reason, short reason,
// fix label, soft note and the Looks fine words, for a font where every check fires, pass the
// strict banned-word scan as the board's tiles and the letter card would show them; reasons are
// one sentence that starts with the letter's full name; every fix has a button label.
import { describe, expect, it } from 'vitest';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word, wordEntry } from '../../words/words.js';
import { CHECK, FIX, checkFont, checkLetter, describeChecks, twoLettersCheck } from '../checks.js';
import { softNotes } from '../soft_notes.js';
import {
	FONT,
	STROKE,
	checksFont,
	comma,
	letter,
	moved,
	rect,
	scaled,
	shapesFor,
	speck,
} from './letters.js';

/** A font where every check fires on some letter */
function troubledFont() {
	const project = checksFont({
		n: [...shapesFor('n'), speck(1400, 500, 20)], // a speck
		o: moved(shapesFor('o'), 0, 300), // floats
		r: moved(shapesFor('r'), 0, -200), // sinks
		B: scaled(shapesFor('B'), 1.4), // too tall
		E: scaled(shapesFor('E'), 0.6), // too short
		t: scaled(shapesFor('t'), 0.6), // too short for its guide lines
		l: [rect(100, 0, 100 + STROKE, FONT.ascent + 300)], // pokes above the top line
		y: [...shapesFor('y'), rect(300, FONT.descent - 300, 300 + STROKE, 0)], // pokes below
		m: [rect(100, 0, 140, FONT.xHeight)], // too narrow
		w: [rect(100, 0, 100 + Math.round(FONT.upm * 1.6), FONT.xHeight)], // too wide
		h: shapesFor('h'),
		',': comma(100, 400), // a floating comma
		'.': moved(shapesFor('.'), 0, -200), // a sinking period
	});
	const h = letter(project, 'h');
	h.anyink.spacing = 'manual';
	h.advanceWidth = Math.round(h.advanceWidth * 0.4); // hangs
	return project;
}

describe('checks in plain words', () => {
	it('every check id, in some letter of the troubled font', () => {
		const project = troubledFont();
		const ids = new Set();
		checkFont(project, { pokesAsNote: false }).forEach((checks) =>
			checks.forEach((check) => ids.add(check.id))
		);
		const blank = checksFont({ x: shapesFor('x') }, { fit: false });
		checkLetter(letter(blank, 'x'), {
			font: FONT,
			fontProblems: [{ itemId: letter(blank, 'x').id, problem: 'point-range', message: 'm' }],
		}).forEach((check) => ids.add(check.id));
		// B16: the two-letters check needs the photo list, so cache.js adds it (b16_two_letters)
		const two = describeChecks(letter(blank, 'x'), [twoLettersCheck()]);
		expect(two[0]).toMatchObject({
			reason: 'small x may be two letters that touch.',
			short: 'may be two letters that touch',
			fixLabel: 'Draw a box',
		});
		two.forEach((check) => ids.add(check.id));
		// S3 finalize: the sketch's unfinished look brings its own words (cache.js adds it,
		// checks/tests/sketch_unfinished_check.test.js); described as given, no fix button
		const unfinished = describeChecks(letter(blank, 'x'), [
			{
				id: CHECK.sketchUnfinished,
				fix: null,
				args: { reason: 'small x looks unfinished.', short: 'looks unfinished' },
			},
		]);
		expect(unfinished[0]).toMatchObject({
			reason: 'small x looks unfinished.',
			short: 'looks unfinished',
			fixLabel: '',
		});
		unfinished.forEach((check) => ids.add(check.id));
		expect([...ids].sort()).toEqual(Object.values(CHECK).sort());
	});

	it('reasons are one sentence starting with the full letter name; short ones have no name', () => {
		const project = troubledFont();
		checkFont(project, { pokesAsNote: false }).forEach((checks, id) => {
			const name = project.glyphs[id].chars;
			checks.forEach((check) => {
				expect(check.reason).toMatch(/^(small |Capital |The )/);
				expect(check.reason.endsWith('.')).toBe(true);
				expect(check.reason).not.toContain('!');
				expect(check.short).not.toMatch(/^(small|Capital|The) /);
				expect(check.short.endsWith('.')).toBe(false);
				expect([name, check.fixLabel]).not.toEqual([name, '']);
			});
		});
	});

	it('every fix has a button label, and Looks fine to me has its words', () => {
		Object.values(FIX).forEach((fix) => {
			expect([fix, !!wordEntry(`fixes.button.${fix}`)]).toEqual([fix, true]);
		});
		expect(word('checks.looksFine')).toBe('Looks fine to me');
		expect(word('checks.state.needsLookWhy', { reason: 'floats above the writing line' })).toBe(
			'Needs a look: floats above the writing line'
		);
	});

	scanSimpleScreen('the checks: every reason, fix, note and Looks fine as tiles show them', () => {
		const project = troubledFont();
		const root = document.createElement('div');
		const lines = [];
		checkFont(project, { pokesAsNote: false }).forEach((checks) => {
			checks.forEach((check) => {
				lines.push(check.reason, word('checks.state.needsLookWhy', { reason: check.short }));
				lines.push(check.fixLabel, word('checks.looksFine'));
			});
		});
		const rows = [
			{ id: 'a', char: 'a', stroke: 100, ready: true },
			{ id: 'b', char: 'b', stroke: 100, ready: true },
			{ id: 'c', char: 'c', stroke: 100, ready: true },
			{ id: 'd', char: 'd', stroke: 100, ready: true },
			{ id: 'e', char: 'e', stroke: 100, ready: true },
			{ id: 'f', char: 'f', stroke: 200, ready: true },
			{ id: 'g', char: 'g', stroke: 40, ready: true },
			{ id: 'h', char: 'h', stroke: 100, ready: true, pokes: 'top' },
		];
		softNotes(rows).forEach((notes) => notes.forEach((note) => lines.push(note.text)));
		lines.push(word('checks.state.needsLook'));
		lines.forEach((text) => {
			const p = document.createElement('p');
			p.textContent = text;
			root.appendChild(p);
		});
		document.body.appendChild(root);
		return root;
	});
});
