// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 fixes (UX-BEGINNER.md 4.2, 4.3, 7.2, 7.3, section 10 B11): Fit spacing, Sit on the line,
// Match size, Remove N specks, Shrink to fit and Fix it are each one Undo step with a plain
// title, on the letter open in the letter view or on a board tile's letter (the board stays the
// board); nothing to fix makes no step; one Undo puts the letter back exactly; a fix that makes
// another letter need a look says so in a toast (Simple), and a fix on a letter he isn't
// looking at says which.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sitsAtFit } from '../../spacing/auto_space.js';
import { inkBounds } from '../../spacing/measure.js';
import { isAutomatic } from '../../spacing/owner.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { getTrace } from '../../trace/trace_model.js';
import { historyText } from '../../words/history_text.js';
import { findBanned } from '../../words/banned.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { useNeedsALook } from '../fix_step.js';
import {
	FIX,
	applyFix,
	fitSpacing,
	fixIdOf,
	fixIt,
	fixLabel,
	matchSize,
	removeSpecks,
	runFixAction,
	shrinkToFit,
	sitOnLine,
} from '../fixes.js';
import { fixEditor, glyphId, photo, saved, shapesOf, speck } from './fix_fixtures.js';

const N = glyphId('n');
const O = glyphId('o');
const H = glyphId('H');

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
	resetToastsForTests();
});
afterEach(() => {
	useNeedsALook(null);
	resetToastsForTests();
	warn.mockRestore();
});

const steps = (editor) => editor.history.length;
const letter = (editor, id) => editor.project.glyphs[id];
const toastKeys = () => toastLog().map((record) => record.key);

/** The other letters of a small font, so the fixes run among neighbors */
const NEIGHBORS = {
	o: { shapes: shapesOf('o', { x0: 60 }), anyink: { spacing: 'auto' } },
	H: { shapes: shapesOf('H', { x0: 60 }), anyink: { spacing: 'auto' } },
};

/**
 * Runs a fix and checks it is one Undo step titled `title`, that Undo puts the letter back
 * exactly and Redo brings the fix back.
 */
function expectOneStep(editor, char, run, title) {
	const before = saved(editor, char);
	const count = steps(editor);
	const result = run();
	expect(result.done).toBe(true);
	expect(result.title).toBe(title);
	expect(steps(editor)).toBe(count + 1);
	expect(editor.history.queue[0].title).toBe(title);
	expect(editor.history.queue[0].itemID).toBe(glyphId(char));
	expect(historyText(title)).toBe(title);
	expect(findBanned(title)).toEqual([]);
	const after = saved(editor, char);
	expect(after).not.toBe(before);
	editor.history.restoreState();
	expect(saved(editor, char)).toBe(before);
	expect(steps(editor)).toBe(count);
	editor.history.redoState();
	expect(saved(editor, char)).toBe(after);
	return result;
}

describe('each fix is one Undo step with a plain title', () => {
	it('Fit spacing: a letter with ink and no width gets automatic spacing', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n'), advanceWidth: 0, anyink: { spacing: 'manual' } },
		});
		expectOneStep(editor, 'n', () => fitSpacing(editor, N), 'fitted the spacing of small n');
		const n = letter(editor, N);
		expect(isAutomatic(n)).toBe(true);
		expect(n.advanceWidth).toBeGreaterThan(0);
		expect(sitsAtFit(n, editor.project)).toBe(true);
	});

	it('Sit on the line: a floating letter sits on the writing line, its photo with it', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: {
				shapes: shapesOf('n', { dy: 80 }),
				advanceWidth: 600,
				anyink: { spacing: 'auto', trace: photo({ y: 980 }) },
			},
		});
		expectOneStep(editor, 'n', () => sitOnLine(editor, N), 'sat small n on the writing line');
		const n = letter(editor, N);
		expect(inkBounds(n).yMin).toBe(0);
		expect(getTrace(n).y).toBe(900);
	});

	it('Match size: a letter 40 % too big takes its line height and is refit', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n', { k: 1.4 }), advanceWidth: 700, anyink: { spacing: 'auto' } },
		});
		expectOneStep(editor, 'n', () => matchSize(editor, N), 'resized small n to fit its line');
		const n = letter(editor, N);
		expect(inkBounds(n).yMax).toBe(500);
		expect(sitsAtFit(n, editor.project)).toBe(true);
	});

	it('Match size keeps the left and right space of a letter he spaced himself', () => {
		const editor = fixEditor({
			n: { shapes: shapesOf('n', { k: 0.6 }), advanceWidth: 400, anyink: { spacing: 'manual' } },
		});
		const n = letter(editor, N);
		const before = inkBounds(n);
		const right = n.advanceWidth - before.xMax;
		matchSize(editor, N);
		const after = inkBounds(n);
		expect(after.xMin).toBe(before.xMin);
		expect(n.advanceWidth - after.xMax).toBe(right);
		expect(isAutomatic(n)).toBe(false);
	});

	it('Remove N specks: the specks go, the letter stays', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: {
				shapes: [...shapesOf('n'), speck(700, 300), speck(800, 100, 15), speck(-60, 250)],
				advanceWidth: 600,
				anyink: { spacing: 'auto' },
			},
		});
		const result = expectOneStep(
			editor,
			'n',
			() => removeSpecks(editor, N),
			'removed 3 specks from small n'
		);
		expect(result.fix).toBe(FIX.removeSpecks);
		expect(letter(editor, N).shapes).toHaveLength(1);
	});

	it('Shrink to fit: a letter poking past the top line fits under it', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			l: { shapes: shapesOf('l', { k: 1.3 }), advanceWidth: 300, anyink: { spacing: 'auto' } },
		});
		expectOneStep(
			editor,
			'l',
			() => shrinkToFit(editor, glyphId('l')),
			'shrank small l to fit between the guide lines'
		);
		expect(inkBounds(letter(editor, glyphId('l'))).yMax).toBeLessThanOrEqual(800);
	});

	it('Fix it: rounds the letter and refits it', () => {
		const nudged = shapesOf('n').map((shape) => ({
			...shape,
			pathPoints: shape.pathPoints.map((point) => ({
				...point,
				p: { coord: { x: point.p.coord.x + 0.4, y: point.p.coord.y + 0.3 } },
			})),
		}));
		const editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: nudged, advanceWidth: 0, anyink: { spacing: 'manual' } },
		});
		expectOneStep(editor, 'n', () => fixIt(editor, N), 'fixed small n for the font file');
		const n = letter(editor, N);
		expect(n.advanceWidth).toBeGreaterThan(0);
		const coords = n.shapes.flatMap((s) => s.pathPoints.flatMap((p) => [p.p.x, p.p.y]));
		expect(coords.every(Number.isInteger)).toBe(true);
	});
});

describe('where the fix is pressed', () => {
	it('on a board tile: the board stays the board and nothing else is selected', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n', { dy: 80 }), advanceWidth: 600, anyink: { spacing: 'auto' } },
		});
		editor._selectedGlyphID = O;
		const views = { ...editor._views };
		const result = sitOnLine(editor, N);
		expect(result.done).toBe(true);
		expect(editor.nav.page).toBe('Overview');
		expect(editor._selectedGlyphID).toBe(O);
		expect(editor._views).toEqual(views);
		expect(editor.history.queue[0].itemID).toBe(N);
		// Undo on the board stays on the board too
		editor.history.restoreState();
		expect(editor.nav.page).toBe('Overview');
		expect(inkBounds(letter(editor, N)).yMin).toBe(80);
		expect(toastKeys()).not.toContain('fixes.toast.fixedOther');
	});

	it('in the letter view of that letter: a step there, no toast', () => {
		const editor = fixEditor(
			{ ...NEIGHBORS, n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } } },
			{ open: 'n' }
		);
		expect(sitOnLine(editor, N).done).toBe(true);
		expect(editor.selectedItemID).toBe(N);
		expect(toastKeys()).not.toContain('fixes.toast.fixedOther');
	});

	it('in the letter view of another letter: the view stays, and a toast names the letter', () => {
		const editor = fixEditor(
			{ ...NEIGHBORS, n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } } },
			{ open: 'o' }
		);
		expect(sitOnLine(editor, N).done).toBe(true);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe(O);
		expect(editor.history.queue[0].itemID).toBe(N);
		const said = toastLog().find((record) => record.key === 'fixes.toast.fixedOther');
		expect(said?.text).toBe('Fixed small n');
	});
});

describe('nothing to fix, nothing recorded', () => {
	it.each([
		['fitSpacing', fitSpacing],
		['sitOnLine', sitOnLine],
		['matchSize', matchSize],
		['removeSpecks', removeSpecks],
		['shrinkToFit', shrinkToFit],
	])('%s on a letter already right makes no step', (_name, fix) => {
		const editor = fixEditor({ n: { shapes: shapesOf('n'), anyink: { spacing: 'auto' } } });
		// Put it at its fit first, outside the count
		fitSpacing(editor, N);
		const count = steps(editor);
		const before = saved(editor, 'n');
		expect(fix(editor, N).done).toBe(false);
		expect(steps(editor)).toBe(count);
		expect(saved(editor, 'n')).toBe(before);
	});

	it('Fix it on a letter the font file can hold makes no step', () => {
		const editor = fixEditor({
			n: { shapes: shapesOf('n'), advanceWidth: 600, anyink: { spacing: 'manual' } },
		});
		expect(fixIt(editor, N).done).toBe(false);
		expect(steps(editor)).toBe(0);
	});

	it('a letter that does not exist, or an unknown fix, does nothing', () => {
		const editor = fixEditor({ n: { shapes: shapesOf('n', { dy: 80 }) } });
		expect(applyFix(editor, glyphId('z'), FIX.sitOnLine).done).toBe(false);
		expect(applyFix(editor, N, 'paint it blue').done).toBe(false);
		expect(steps(editor)).toBe(0);
	});
});

describe("the checks track's { id, reason, fix } contract", () => {
	it('takes a fix id, { id } or { fix }', () => {
		expect(fixIdOf('sitOnLine')).toBe(FIX.sitOnLine);
		expect(fixIdOf({ id: 'removeSpecks', count: 3 })).toBe(FIX.removeSpecks);
		expect(fixIdOf({ fix: 'moveLine', line: 'small' })).toBe(FIX.moveLine);
		expect(fixIdOf('looksFine')).toBeNull();
	});

	it("names each button in house words, with the specks' count", () => {
		expect(fixLabel('fitSpacing')).toBe('Fit spacing');
		expect(fixLabel('sitOnLine')).toBe('Sit on the line');
		expect(fixLabel('matchSize')).toBe('Match size');
		expect(fixLabel({ id: 'removeSpecks', count: 3 })).toBe('Remove 3 specks');
		expect(fixLabel('removeSpecks', { count: 1 })).toBe('Remove 1 speck');
		expect(fixLabel('shrinkToFit')).toBe('Shrink to fit');
		expect(fixLabel('fixIt')).toBe('Fix it');
		expect(fixLabel('moveLine')).toBe('Move the line to fit your writing');
		Object.values(FIX).forEach((id) => expect(findBanned(fixLabel(id, { count: 2 }))).toEqual([]));
	});

	it('applyFix runs the fix a check names on its letter', () => {
		const editor = fixEditor({
			n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } },
		});
		const check = {
			id: 'offLine',
			reason: 'small n floats above the writing line.',
			fix: 'sitOnLine',
		};
		const result = applyFix(editor, N, check.fix);
		expect(result).toMatchObject({ done: true, fix: 'sitOnLine', itemId: N });
		expect(inkBounds(letter(editor, N)).yMin).toBe(0);
	});
});

describe("the Next line's fixLetter action", () => {
	const fixable = () =>
		fixEditor({ n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } } });

	it('runs in Simple with the checks flag on', () => {
		const editor = fixable();
		expect(runFixAction({ char: 'n', check: 'offLine', fix: 'sitOnLine' }, { editor })).toBe(true);
		expect(inkBounds(letter(editor, N)).yMin).toBe(0);
	});

	it('does nothing in All tools, or while the checks flag is off', () => {
		let editor = fixable();
		setModeForTests('all');
		expect(runFixAction({ char: 'n', fix: 'sitOnLine' }, { editor })).toBe(false);
		setModeForTests('simple');
		setFeaturesForTests({ checks: false });
		editor = fixable();
		expect(runFixAction({ char: 'n', fix: 'sitOnLine' }, { editor })).toBe(false);
		expect(steps(editor)).toBe(0);
	});
});

describe('a fix that flips another letter says so', () => {
	// A stand-in for the checks track's "needs a look": Capital H needs a look while small n is
	// not on the writing line (the real checks compare letters with each other too: the size
	// check's "2 or more off the same way", the soft note's median)
	const hWatchesN = (item, { editor }) =>
		item.id === H && inkBounds(editor.project.glyphs[N])?.yMin === 0;

	it('names the letter that now needs a look, with Show me', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } },
		});
		useNeedsALook(hWatchesN);
		const result = sitOnLine(editor, N);
		expect(result.flipped).toEqual([H]);
		const said = toastLog().find((record) => record.key === 'fixes.toast.fixFlippedOne');
		expect(said?.text).toBe('Fixing small n made Capital H need a look.');
		expect(findBanned(said.text)).toEqual([]);
	});

	it('counts them when more than one flipped', () => {
		const editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } },
		});
		useNeedsALook(
			(item, ctx) => item.id !== N && inkBounds(ctx.editor.project.glyphs[N]).yMin === 0
		);
		const result = sitOnLine(editor, N);
		expect(result.flipped).toEqual([H, O]);
		const said = toastLog().find((record) => record.key === 'fixes.toast.fixFlippedMany');
		expect(said?.text).toBe('Fixing small n made 2 letters need a look.');
	});

	it('says nothing when no other letter changed state, or in All tools', () => {
		let editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } },
		});
		useNeedsALook(() => false);
		expect(sitOnLine(editor, N).flipped).toEqual([]);
		expect(toastKeys().filter((key) => key?.startsWith('fixes.toast.'))).toEqual([]);
		setModeForTests('all');
		editor = fixEditor({
			...NEIGHBORS,
			n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } },
		});
		useNeedsALook(hWatchesN);
		expect(sitOnLine(editor, N).flipped).toEqual([H]);
		expect(toastKeys().filter((key) => key?.startsWith('fixes.toast.'))).toEqual([]);
	});
});

scanSimpleScreen('B11 fixes: a fix, the toast it makes and its Undo', () => {
	setFeaturesForTests({ checks: true });
	const editor = fixEditor(
		{ ...NEIGHBORS, n: { shapes: shapesOf('n', { dy: 80 }), anyink: { spacing: 'auto' } } },
		{ open: 'o' }
	);
	useNeedsALook(
		(item, { editor: ed }) => item.id === H && inkBounds(ed.project.glyphs[N]).yMin === 0
	);
	sitOnLine(editor, N);
	removeSpecks(editor, O);
	editor.history.restoreState();
	return { root: null };
});

describe('every fix a check can name is here', () => {
	it('runs each of checks.js FIX', async () => {
		const { FIX: CHECK_FIX } = await import('../checks.js');
		Object.values(CHECK_FIX).forEach((id) => expect(fixIdOf(id)).toBe(id));
		Object.values(CHECK_FIX).forEach((id) => expect(fixLabel(id, { count: 2 })).not.toBe(''));
	});
});
