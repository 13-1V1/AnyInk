// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 seam: the fixes with the checks track's real "needs a look" (cache.js checksSource, the
// source fix_step.js useNeedsALook takes; UX-BEGINNER.md 4.2: "If a later change flips a letter
// he isn't looking at, a toast says so: 'Moving the line made 3 letters need a look. [Show
// me]'"). The cache keeps its answers until the save revision moves, so these check that a fix
// step asks it before and after the step and sees the change; that one Undo of the moved line
// puts the line, the refits and every letter's state back; and that a fix that flips nothing
// says nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { fitAllAutomatic, sitsAtFit } from '../../spacing/auto_space.js';
import { inkBounds } from '../../spacing/measure.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { findBanned } from '../../words/banned.js';
import { checksSource, resetChecksCacheForTests } from '../cache.js';
import { fitLineToWriting } from '../fit_lines_to_writing.js';
import { useNeedsALook } from '../fix_step.js';
import { applyFix, runFixAction } from '../fixes.js';
import { fixEditor, glyphId, shapesOf } from './fix_fixtures.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
	resetToastsForTests();
	resetChecksCacheForTests();
	useNeedsALook(checksSource);
});
afterEach(() => {
	useNeedsALook(null);
	resetChecksCacheForTests();
	resetToastsForTests();
	warn.mockRestore();
});

const auto = { spacing: 'auto' };
const A = glyphId('a');
const R = glyphId('r');

/**
 * Five small letters written 30 % taller than the small-letter line (650 against 500) and two
 * a little short of it (450), none of them round (a round letter's overshoot comes off its
 * size): the line belongs at 650, and there a and r are more than 25 % too short.
 */
function lineFont() {
	const big = (char) => ({ shapes: shapesOf(char, { k: 1.3 }), anyink: auto });
	const short = (char) => ({ shapes: shapesOf(char, { k: 0.9 }), anyink: auto });
	return fitted({
		n: big('n'),
		u: big('u'),
		m: big('m'),
		x: big('x'),
		z: big('z'),
		a: short('a'),
		r: short('r'),
		H: { shapes: shapesOf('H'), anyink: auto },
	});
}

/** An editor whose automatic letters start at their fit, as a traced font's do */
function fitted(letters) {
	const editor = fixEditor(letters);
	fitAllAutomatic(editor.project);
	return editor;
}

const needsLook = (editor, id) => checksSource(editor.project.glyphs[id], { editor });
const lineToasts = () =>
	toastLog().filter((record) => String(record.key).startsWith('fixes.toast.line'));

describe('with the real checks: Move the line to fit your writing', () => {
	it("offers itself on the big letters, and the move says which ready letters it flipped", () => {
		const editor = lineFont();
		expect(needsLook(editor, glyphId('n'))?.fix).toBe('moveLine');
		expect(needsLook(editor, A)).toBeNull();
		expect(needsLook(editor, R)).toBeNull();

		const look = needsLook(editor, glyphId('n'));
		const result = applyFix(editor, glyphId('n'), look.args);
		expect(result).toMatchObject({ done: true, fix: 'moveLine' });
		expect(editor.project.settings.font.xHeight).toBe(650);
		expect(result.flipped).toEqual([A, R]);
		expect(needsLook(editor, A)?.id).toBe('size');
		expect(needsLook(editor, R)?.id).toBe('size');
		expect(needsLook(editor, glyphId('n'))).toBeNull();

		const said = lineToasts();
		expect(said.map((record) => record.text)).toEqual([
			'Moving the line made 2 letters need a look.',
		]);
		expect(findBanned(said[0].text, { strict: true })).toEqual([]);
	});

	it('one Undo puts the line, the refits and every letter back as they were', () => {
		const editor = lineFont();
		const before = JSON.stringify(editor.project.save());
		const n = glyphId('n');
		fitLineToWriting(editor, n);
		expect(needsLook(editor, R)?.id).toBe('size');
		editor.history.restoreState();
		expect(editor.project.settings.font.xHeight).toBe(500);
		expect(JSON.stringify(editor.project.save())).toBe(before);
		expect(needsLook(editor, R)).toBeNull();
		expect(needsLook(editor, A)).toBeNull();
		expect(needsLook(editor, n)?.fix).toBe('moveLine');
		Object.values(editor.project.glyphs)
			.filter((item) => inkBounds(item))
			.forEach((item) => expect(sitsAtFit(item, editor.project)).toBe(true));
	});

	it("runs from the Next line's and the board's fixLetter args", () => {
		const editor = lineFont();
		const look = needsLook(editor, glyphId('u'));
		const args = { char: 'u', check: look.id, ...look.args };
		expect(runFixAction(args, { editor })).toBe(true);
		expect(editor.project.settings.font.xHeight).toBe(650);
		expect(lineToasts()).toHaveLength(1);
	});
});

describe('with the real checks: a fix that flips no other letter says nothing', () => {
	it('Sit on the line on one letter leaves the others as they were', () => {
		const editor = fitted({
			n: { shapes: shapesOf('n', { dy: 80 }), anyink: auto },
			o: { shapes: shapesOf('o', { x0: 60 }), anyink: auto },
			H: { shapes: shapesOf('H', { x0: 60 }), anyink: auto },
		});
		const n = glyphId('n');
		const look = needsLook(editor, n);
		expect(look?.fix).toBe('sitOnLine');
		const result = applyFix(editor, n, look.args);
		expect(result.done).toBe(true);
		expect(result.flipped).toEqual([]);
		expect(needsLook(editor, n)).toBeNull();
		expect(toastLog().filter((record) => /Flipped/.test(String(record.key)))).toEqual([]);
	});
});
