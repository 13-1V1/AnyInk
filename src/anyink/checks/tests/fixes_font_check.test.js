// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 fix pass: the checks' [Fix it] for a font-file problem (B1's font check, read by the checks
// cache) clears at once. Before, the cache kept the font check's old list until the check ran
// again 2 s after the change, so the letter stayed amber with the same green [Fix it], and a
// second press did nothing (UX-BEGINNER.md principle 6: a fix button never does nothing; 4.2 the
// board's tiles; D-042's one "Needs a look"). The coach's own fixFontProblem runs the font check
// right after it fixes (coach/actions.js); the checks' fixLetter does the same now.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCoachAction } from '../../coach/actions.js';
import { getLastFontCheck, runFontCheckNow } from '../../fontcheck/font_check.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { initChecks, stopChecksForTests } from '../checks_app.js';
import { recordLetterStep } from '../fix_step.js';
import { runFixAction } from '../fixes.js';
import { fixEditor, glyphId } from './fix_fixtures.js';
import { checksFont, plain, shapesFor } from './letters.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ checks: true, board: true });
	resetToastsForTests();
	resetChecksCacheForTests();
});
afterEach(() => {
	stopChecksForTests();
	resetChecksCacheForTests();
	resetToastsForTests();
	setModeForTests('all');
	warn.mockRestore();
});

const N = glyphId('n');
/** A stray line of 2 points: the font file can't hold it (B1: "a shape with only 2 points") */
const STRAY = {
	pathPoints: [{ p: { coord: { x: 10, y: 10 } } }, { p: { coord: { x: 50, y: 60 } } }],
};

/** The board, with the app's checks wired as main.js wires them, and the font checked once */
function board() {
	const editor = fixEditor({});
	editor.project = checksFont({
		...plain('hoae'),
		n: { shapes: [...shapesFor('n'), STRAY] },
	});
	editor.nav.page = 'Overview';
	initChecks({ getEditor: () => editor });
	runFontCheckNow(editor);
	return editor;
}

const look = (editor) => getChecksCache().state(editor, editor.project.glyphs[N]).needsLook;
const fontProblems = (editor) =>
	(getLastFontCheck(editor)?.problems || []).filter((entry) => entry.itemId === N);

describe("the checks' Fix it for a font-file problem", () => {
	it('is gone the moment it is pressed, with no wait for the font check', () => {
		const editor = board();
		expect(fontProblems(editor)).toHaveLength(1);
		const first = look(editor);
		expect(first).toMatchObject({ id: 'fontFile', fix: 'fixIt' });
		const steps = editor.history.length;

		// The board's tile and the Next line press it this way
		runCoachAction('fixLetter', { char: 'n', check: first.id, ...first.args }, { editor });
		expect(editor.history.length).toBe(steps + 1);
		expect(fontProblems(editor)).toEqual([]);
		expect(look(editor)).toBeNull();
		expect(getChecksCache().isReady(editor.project.glyphs[N], { editor })).toBe(true);
	});

	it('a press on a [Fix it] the font check had not caught up with clears it too', () => {
		// He took the stray line out himself. B10 + B11 finalize: the font check runs at his step
		// (checks_app.js), so the stale [Fix it] is gone before he can press it; pressed anyway
		// (a press sent before the step), it makes no step and leaves nothing to press
		const editor = board();
		const stale = look(editor);
		expect(stale).toMatchObject({ id: 'fontFile', fix: 'fixIt' });
		recordLetterStep(editor, N, 'erased in small n', (item) => {
			item.shapes.splice(item.shapes.length - 1, 1);
			return true;
		});
		expect(look(editor)).toBeNull();
		const steps = editor.history.length;

		expect(runFixAction({ char: 'n', check: stale.id, ...stale.args }, { editor })).toBe(false);
		// Nothing was left to fix: no step, and the button doesn't stay to be pressed again
		expect(editor.history.length).toBe(steps);
		expect(look(editor)).toBeNull();
	});

	// B10 + B11 finalize (the hostile pass's C4): Undo right after [Fix it] read Ready for 2 s
	// while the font file couldn't hold the letter, then turned amber with no step in between
	it('Undo right after [Fix it]: Needs a look again at once, with its [Fix it]', () => {
		const editor = board();
		const first = look(editor);
		runCoachAction('fixLetter', { char: 'n', check: first.id, ...first.args }, { editor });
		expect(look(editor)).toBeNull();
		editor.history.restoreState();
		expect(fontProblems(editor)).toHaveLength(1);
		expect(look(editor)).toMatchObject({ id: 'fontFile', fix: 'fixIt' });
		expect(getChecksCache().isReady(editor.project.glyphs[N], { editor })).toBe(false);
	});

	// the hostile pass's C5: a point too far out (point-range) has no safe fix
	it('a problem Fix it cannot fix offers no [Fix it]: only Looks fine to me', () => {
		const editor = board();
		const n = editor.project.glyphs[N];
		recordLetterStep(editor, N, 'moved a point in small n', (item) => {
			item.shapes.splice(item.shapes.length - 1, 1);
			item.shapes[0].pathPoints[0].p.x = 40000;
			return true;
		});
		const problem = fontProblems(editor)[0];
		expect(problem?.problem).toBe('point-range');
		const now = look(editor);
		expect(now).toMatchObject({ id: 'fontFile', fix: null, fixLabel: '' });
		expect(getChecksCache().isReady(n, { editor })).toBe(false);
	});
});
