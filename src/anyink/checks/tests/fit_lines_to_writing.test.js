// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 "Move the line to fit your writing" (UX-BEGINNER.md 4.2, 4.8, 7.3, section 10 B11): the
// line moves to the median of his letters on it, as one whole-font Undo step that also refits
// every automatic letter; one Undo puts the line and the refits back, Redo brings both again;
// moving a line keeps the lines in order; a move that makes letters need a look says so; B15's
// drag records its step through the same helper.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sitsAtFit } from '../../spacing/auto_space.js';
import { inkBounds } from '../../spacing/measure.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { findBanned } from '../../words/banned.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import {
	fitLineToWriting,
	impliedLine,
	lineMedian,
	lineMoveWay,
	lineMoveWays,
	lineName,
	lineOfLetter,
	linePlan,
	moveLine,
	waysFromValues,
} from '../fit_lines_to_writing.js';
import { useNeedsALook } from '../fix_step.js';
import { applyFix, runFixAction } from '../fixes.js';
import { FONT, fixEditor, glyphId, shapesOf } from './fix_fixtures.js';

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

const auto = { spacing: 'auto' };
/** Small letters written 30 % taller than the small-letter line (650 against 500) */
function bigSmallLetters(extra = {}) {
	return {
		n: { shapes: shapesOf('n', { k: 1.3 }), anyink: auto },
		u: { shapes: shapesOf('u', { k: 1.3 }), anyink: auto },
		m: { shapes: shapesOf('m', { k: 1.3 }), anyink: auto },
		H: { shapes: shapesOf('H'), anyink: auto },
		...extra,
	};
}
const fontJSON = (editor) => JSON.stringify(editor.project.save());
const xHeightOf = (editor) => editor.project.settings.font.xHeight;
const everyAutomaticAtFit = (editor) =>
	Object.values(editor.project.glyphs)
		.filter((item) => item.anyink?.spacing === 'auto' && inkBounds(item))
		.every((item) => sitsAtFit(item, editor.project));

describe('which line a letter is sized by', () => {
	it('small letters (tails, i and j too) by the small-letter line, tall ones by the top line', () => {
		expect([...'acemnorsuvwxz'].every((c) => lineOfLetter(c) === 'small')).toBe(true);
		expect([...'gjpqyi'].every((c) => lineOfLetter(c) === 'small')).toBe(true);
		expect([...'bdfhkl'].every((c) => lineOfLetter(c) === 'top')).toBe(true);
		expect(lineOfLetter('B')).toBe('capitals');
		expect(lineOfLetter('7')).toBe('capitals');
		expect(lineOfLetter('é')).toBe('small');
		// t's top sits between two lines; punctuation is never part of a median
		expect([...'t.,!?-'].map(lineOfLetter)).toEqual(Array(6).fill(null));
	});

	it('takes line names and font keys', () => {
		expect(lineName('small')).toBe('small');
		expect(lineName('xHeight')).toBe('small');
		expect(lineName('capHeight')).toBe('capitals');
		expect(lineName('ascent')).toBe('top');
		expect(lineName('descent')).toBe('tail');
		expect(lineName('baseline')).toBeNull();
	});

	it("reads a letter's size as the line it asks for, round letters' overshoot taken off", () => {
		const editor = fixEditor(bigSmallLetters({ o: { shapes: shapesOf('o', { k: 1.3 }) } }));
		const font = editor.project.settings.font;
		expect(impliedLine(editor.project.glyphs[glyphId('n')], font)).toEqual({
			line: 'small',
			value: 650,
			height: 650,
			round: false,
		});
		// o is 650 tall; its line sits 1.5 % of the letter box inside it at both ends
		expect(impliedLine(editor.project.glyphs[glyphId('o')], font)).toEqual({
			line: 'small',
			value: 620,
			height: 650,
			round: true,
		});
		expect(lineMedian(editor.project, 'small')).toBe(650);
		expect(lineMedian(editor.project, 'capitals')).toBe(700);
		expect(lineMedian(editor.project, 'top')).toBeNull();
	});
});

describe('the lines keep their order', () => {
	it('pushes the top line up with the capitals line, and the capitals line with the small one', () => {
		expect(linePlan(FONT, 'capitals', 900)).toEqual({ capHeight: 900, ascent: 900 });
		expect(linePlan(FONT, 'small', 750)).toEqual({ xHeight: 750, capHeight: 750 });
		expect(linePlan(FONT, 'top', 600)).toEqual({ ascent: 600, capHeight: 600 });
		expect(linePlan(FONT, 'tail', 40)).toEqual({ descent: -1 });
		expect(linePlan(FONT, 'small', 500.4)).toEqual({});
	});
});

describe('the lines stay inside the letter box (fix pass)', () => {
	it('a line pushed up stops at the top of the letter box, the tail line at its bottom', () => {
		// The letter box is 1,000 units here: no line goes more than that from the writing line
		expect(linePlan(FONT, 'small', 1200)).toEqual({ xHeight: 1000, capHeight: 1000, ascent: 1000 });
		expect(linePlan(FONT, 'top', 1500)).toEqual({ ascent: 1000 });
		expect(linePlan(FONT, 'tail', -1400)).toEqual({ descent: -1000 });
	});

	it('a font whose top line is past the box already keeps it there; no move takes it further', () => {
		const tall = { ...FONT, ascent: 1100 };
		expect(linePlan(tall, 'capitals', 1300)).toEqual({ capHeight: 1100 });
		expect(linePlan(tall, 'small', 600)).toEqual({ xHeight: 600 });
		expect(linePlan(tall, 'top', 900)).toEqual({ ascent: 900 });
	});

	it("B15's drag past the box stops at it", () => {
		const editor = fixEditor(bigSmallLetters());
		const result = moveLine(editor, 'ascent', 1400);
		expect(result).toMatchObject({ done: true, line: 'top', value: 1000 });
		expect(editor.project.settings.font.ascent).toBe(1000);
	});
});

describe('never pushes another line past letters that fit it (fix pass)', () => {
	/** n, u and m twice as tall as the small-letter line (1,000 against 500) */
	const twiceAsTall = (extra = {}) => ({
		n: { shapes: shapesOf('n', { k: 2 }), anyink: auto },
		u: { shapes: shapesOf('u', { k: 2 }), anyink: auto },
		m: { shapes: shapesOf('m', { k: 2 }), anyink: auto },
		...extra,
	});
	const linesOf = (editor) => {
		const { ascent, capHeight, xHeight, descent } = editor.project.settings.font;
		return { ascent, capHeight, xHeight, descent };
	};
	const LINES = { ascent: 800, capHeight: 700, xHeight: 500, descent: -200 };

	it('H and A fit the capitals line: the small-letter line is not offered the move', () => {
		// Moving it to 1,000 would push the capitals line to 1,000, and H and A (700) would be
		// too short for it; their own Move the line would pull it back down
		const editor = fixEditor(
			twiceAsTall({
				H: { shapes: shapesOf('H'), anyink: auto },
				A: { shapes: shapesOf('A'), anyink: auto },
			})
		);
		expect(lineMoveWays(editor.project)).toEqual({ small: null, capitals: null, top: null });
	});

	it('pressed from an old button, the move resizes the letter instead, and the lines stay', () => {
		const editor = fixEditor(
			twiceAsTall({
				H: { shapes: shapesOf('H'), anyink: auto },
				A: { shapes: shapesOf('A'), anyink: auto },
			})
		);
		expect(fitLineToWriting(editor, 'small').done).toBe(false);
		const result = applyFix(editor, glyphId('n'), { id: 'moveLine', line: 'xHeight' });
		expect(result).toMatchObject({ done: true, fix: 'matchSize' });
		expect(linesOf(editor)).toEqual(LINES);
	});

	it('with no letters on the lines it pushes, the line moves, the others along with it', () => {
		const editor = fixEditor(twiceAsTall());
		expect(lineMoveWays(editor.project).small).toBe('big');
		const result = fitLineToWriting(editor, 'small');
		expect(result).toMatchObject({ done: true, value: 1000 });
		expect(linesOf(editor)).toEqual({
			ascent: 1000,
			capHeight: 1000,
			xHeight: 1000,
			descent: -200,
		});
	});

	it('writing bigger than the letter box: the line is not offered the move, and never goes past', () => {
		const editor = fixEditor({
			n: { shapes: shapesOf('n', { k: 2.4 }), anyink: auto },
			u: { shapes: shapesOf('u', { k: 2.4 }), anyink: auto },
		});
		expect(lineMedian(editor.project, 'small')).toBe(1200);
		expect(lineMoveWays(editor.project).small).toBeNull();
		expect(fitLineToWriting(editor, 'small').done).toBe(false);
		const result = applyFix(editor, glyphId('n'), { id: 'moveLine', line: 'xHeight' });
		expect(result).toMatchObject({ done: true, fix: 'matchSize' });
		expect(linesOf(editor)).toEqual(LINES);
	});

	it("the checks' plain numbers (no heights) are judged the same way", () => {
		const font = { ...FONT };
		// capitals letters at 700 fit now and would be too short at 1,000
		expect(waysFromValues({ small: [1000, 1000], capitals: [700, 700], top: [] }, font)).toEqual({
			small: null,
			capitals: null,
			top: null,
		});
		expect(waysFromValues({ small: [1000, 1000], capitals: [], top: [] }, font).small).toBe('big');
		expect(waysFromValues({ small: [1200, 1200], capitals: [], top: [] }, font).small).toBeNull();
		// a move that pushes no line is judged by its own letters only, as before
		expect(waysFromValues({ small: [650, 650], capitals: [700], top: [] }, font).small).toBe('big');
		// down too: the top line at 440 would pull the capitals line under H (700), not under n
		expect(waysFromValues({ top: [440, 440], capitals: [700], small: [500] }, font).top).toBeNull();
		expect(waysFromValues({ top: [440, 440], capitals: [], small: [500] }, font).top).toBe('small');
	});

	it('a round letter is judged by its own height when the values carry it (impliedLine does)', () => {
		const font = { ...FONT };
		// An O 760 tall (its line value 730, the overshoot off) fits the capitals line at 1,000
		// (76 %); a plain 730 might be a straight letter that wouldn't (73 %), so it isn't pushed
		const O = { line: 'capitals', value: 730, height: 760 };
		expect(waysFromValues({ small: [1000, 1000], capitals: [O] }, font).small).toBe('big');
		expect(waysFromValues({ small: [1000, 1000], capitals: [730] }, font).small).toBeNull();
	});

	it('a letter include() leaves out of the median is still kept by a line pushed past it', () => {
		const editor = fixEditor(
			twiceAsTall({
				H: { shapes: shapesOf('H'), anyink: auto },
				A: { shapes: shapesOf('A'), anyink: auto },
			})
		);
		const smallOnly = (item) => /[a-z]/.test(item.chars);
		expect(lineMoveWays(editor.project, { include: smallOnly }).small).toBeNull();
		expect(fitLineToWriting(editor, 'small', { include: smallOnly }).done).toBe(false);
	});
});

describe('Move the line to fit your writing', () => {
	it('moves the line to the median of his letters on it, as one whole-font step', () => {
		const editor = fixEditor(bigSmallLetters());
		const before = fontJSON(editor);
		const count = editor.history.length;
		const result = fitLineToWriting(editor, glyphId('n'));
		expect(result).toMatchObject({ done: true, line: 'small', value: 650 });
		expect(result.title).toBe('moved the small-letter line to fit your writing');
		expect(historyText(result.title)).toBe(result.title);
		expect(findBanned(result.title)).toEqual([]);
		expect(xHeightOf(editor)).toBe(650);
		expect(editor.history.length).toBe(count + 1);
		expect(editor.history.queue[1].wholeProjectSave).toBe(true);
		expect(editor.history.queue[1].itemID).toBe(false);
		// The gaps hang on the small-letter line: every automatic letter is at its new fit
		expect(everyAutomaticAtFit(editor)).toBe(true);
		const after = fontJSON(editor);
		expect(after).not.toBe(before);

		// One Undo puts the line and the refits back; Redo brings both again
		editor.history.restoreState();
		expect(xHeightOf(editor)).toBe(500);
		expect(fontJSON(editor)).toBe(before);
		editor.history.redoState();
		expect(xHeightOf(editor)).toBe(650);
		expect(fontJSON(editor)).toBe(after);
	});

	it('refits the automatic letters in All tools too, with the same one step', () => {
		setModeForTests('all');
		const editor = fixEditor(bigSmallLetters());
		const before = fontJSON(editor);
		expect(fitLineToWriting(editor, 'small').done).toBe(true);
		expect(everyAutomaticAtFit(editor)).toBe(true);
		editor.history.restoreState();
		expect(fontJSON(editor)).toBe(before);
	});

	it("is the moveLine fix of the checks' contract", () => {
		const editor = fixEditor(bigSmallLetters());
		const result = applyFix(editor, glyphId('u'), { id: 'moveLine', line: 'small' });
		expect(result).toMatchObject({ done: true, fix: 'moveLine' });
		expect(xHeightOf(editor)).toBe(650);
	});

	it('counts only the letters include() lets in', () => {
		const editor = fixEditor(bigSmallLetters({ a: { shapes: shapesOf('a'), anyink: auto } }));
		const onlyN = (item) => item.id === glyphId('n');
		expect(lineMedian(editor.project, 'small')).toBe(650);
		expect(lineMedian(editor.project, 'small', { include: (item) => item.chars === 'a' })).toBe(
			500
		);
		expect(fitLineToWriting(editor, 'small', { include: onlyN }).value).toBe(650);
	});

	it('does nothing when no letter is on that line, or the line is already there', () => {
		const editor = fixEditor({ H: { shapes: shapesOf('H'), anyink: auto } });
		expect(fitLineToWriting(editor, 'small').done).toBe(false);
		expect(fitLineToWriting(editor, 'capitals').done).toBe(false);
		expect(editor.history.length).toBe(0);
	});
});

describe("B15's guide-line drag records its step here", () => {
	it('a line already dragged to its place is one step back to where it was', () => {
		const editor = fixEditor(bigSmallLetters());
		const before = fontJSON(editor);
		editor.project.settings.font.xHeight = 600; // the drag's ticks
		const result = moveLine(editor, 'xHeight', 600, { from: 500 });
		expect(result).toMatchObject({ done: true, line: 'small', value: 600 });
		expect(result.title).toBe('moved the small-letter line');
		expect(everyAutomaticAtFit(editor)).toBe(true);
		editor.history.restoreState();
		expect(xHeightOf(editor)).toBe(500);
		expect(fontJSON(editor)).toBe(before);
	});
});

describe('a moved line that makes letters need a look says so', () => {
	// A stand-in for the checks' size check: more than 25 % off its line
	const offItsLine = (item, { editor }) => {
		const implied = impliedLine(item, editor.project.settings.font);
		const line = editor.project.settings.font.xHeight;
		return !!implied && implied.line === 'small' && Math.abs(implied.value / line - 1) > 0.25;
	};

	it('counts them', () => {
		const editor = fixEditor(
			bigSmallLetters({
				r: { shapes: shapesOf('r', { k: 0.9 }), anyink: auto },
				a: { shapes: shapesOf('a', { k: 0.9 }), anyink: auto },
			})
		);
		useNeedsALook(offItsLine);
		const result = fitLineToWriting(editor, 'small');
		expect(result.value).toBe(650);
		expect(result.flipped).toEqual([glyphId('a'), glyphId('r')]);
		const said = toastLog().find((record) => record.key === 'fixes.toast.lineFlippedMany');
		expect(said?.text).toBe('Moving the line made 2 letters need a look.');
	});

	it('names one', () => {
		const editor = fixEditor(
			bigSmallLetters({ r: { shapes: shapesOf('r', { k: 0.9 }), anyink: auto } })
		);
		useNeedsALook(offItsLine);
		expect(fitLineToWriting(editor, 'small').flipped).toEqual([glyphId('r')]);
		const said = toastLog().find((record) => record.key === 'fixes.toast.lineFlippedOne');
		expect(said?.text).toBe('Moving the line made small r need a look.');
	});

	it('says nothing when none flipped', () => {
		const editor = fixEditor(bigSmallLetters());
		useNeedsALook(offItsLine);
		expect(fitLineToWriting(editor, 'small').flipped).toEqual([]);
		expect(toastLog().filter((record) => record.key?.startsWith('fixes.toast.'))).toEqual([]);
	});
});

scanSimpleScreen('B11 fixes: Move the line to fit your writing, its toast and its Undo', () => {
	setFeaturesForTests({ checks: true });
	const editor = fixEditor(
		bigSmallLetters({ r: { shapes: shapesOf('r', { k: 0.9 }), anyink: auto } })
	);
	useNeedsALook((item, { editor: ed }) => {
		const implied = impliedLine(item, ed.project.settings.font);
		return !!implied && Math.abs(implied.value / ed.project.settings.font.xHeight - 1) > 0.25;
	});
	fitLineToWriting(editor, 'small');
	editor.history.restoreState();
	return { root: null };
});

describe('whether the line is off his letters (for the checks: offer Move the line only then)', () => {
	it('says which way, once the middle of his letters on a line is past the 25 % a size check allows', () => {
		const editor = fixEditor(bigSmallLetters());
		expect(lineMoveWays(editor.project)).toEqual({ small: 'big', capitals: null, top: null });
		expect(lineMoveWay(editor.project, 'small')).toBe('big');
		expect(lineMoveWay(editor.project, 'xHeight')).toBe('big');
		expect(lineMoveWay(editor.project, 'capHeight')).toBeNull();
		const short = fixEditor({
			n: { shapes: shapesOf('n', { k: 0.6 }), anyink: auto },
			u: { shapes: shapesOf('u', { k: 0.6 }), anyink: auto },
		});
		expect(lineMoveWay(short.project, 'small')).toBe('small');
	});

	it('says nothing once the line has moved to them, though the letters it flipped are off', () => {
		const editor = fixEditor(
			bigSmallLetters({
				x: { shapes: shapesOf('x', { k: 1.3 }), anyink: auto },
				r: { shapes: shapesOf('r', { k: 0.9 }), anyink: auto },
				a: { shapes: shapesOf('a', { k: 0.9 }), anyink: auto },
			})
		);
		expect(fitLineToWriting(editor, 'small').value).toBe(650);
		expect(lineMoveWay(editor.project, 'small')).toBeNull();
	});

	it('says nothing when only a few letters are off and most fit the line', () => {
		const editor = fixEditor({
			a: { shapes: shapesOf('a', { k: 1.3 }), anyink: auto },
			u: { shapes: shapesOf('u', { k: 1.3 }), anyink: auto },
			n: { shapes: shapesOf('n'), anyink: auto },
			m: { shapes: shapesOf('m'), anyink: auto },
			r: { shapes: shapesOf('r'), anyink: auto },
		});
		expect(lineMoveWay(editor.project, 'small')).toBeNull();
	});

	it('takes include() as the median does, and never names the tail line or t', () => {
		const editor = fixEditor(bigSmallLetters({ a: { shapes: shapesOf('a'), anyink: auto } }));
		const onlyA = (item) => item.chars === 'a';
		expect(lineMoveWay(editor.project, 'small', { include: onlyA })).toBeNull();
		expect(lineMoveWay(editor.project, 'tail')).toBeNull();
		expect(lineMoveWay(editor.project, 'between')).toBeNull();
		expect(lineMoveWay(null, 'small')).toBeNull();
	});
});

describe("the Next line's fixLetter action", () => {
	it('moves the line the size check names', () => {
		const editor = fixEditor(bigSmallLetters());
		const args = { char: 'n', check: 'size', fix: 'moveLine', way: 'big', line: 'xHeight' };
		expect(runFixAction(args, { editor })).toBe(true);
		expect(xHeightOf(editor)).toBe(650);
	});
});

describe('never a dead button', () => {
	it('when the median leaves the line where it is, the letter pressed is resized instead', () => {
		// Two small letters 30 % too big among five that fit: the check offers Move the line (2 off
		// the same way), but the median of his letters is the line itself
		const editor = fixEditor({
			a: { shapes: shapesOf('a', { k: 1.3 }), anyink: auto },
			u: { shapes: shapesOf('u', { k: 1.3 }), anyink: auto },
			n: { shapes: shapesOf('n'), anyink: auto },
			m: { shapes: shapesOf('m'), anyink: auto },
			r: { shapes: shapesOf('r'), anyink: auto },
			e: { shapes: shapesOf('e'), anyink: auto },
			x: { shapes: shapesOf('x'), anyink: auto },
		});
		expect(lineMedian(editor.project, 'small')).toBe(500);
		const result = applyFix(editor, glyphId('a'), { id: 'moveLine', line: 'xHeight' });
		expect(result).toMatchObject({ done: true, fix: 'matchSize' });
		expect(result.title).toBe('resized small a to fit its line');
		expect(xHeightOf(editor)).toBe(500);
		expect(
			impliedLine(editor.project.glyphs[glyphId('a')], editor.project.settings.font).value
		).toBe(500);
	});
});
