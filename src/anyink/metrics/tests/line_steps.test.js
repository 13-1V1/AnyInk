// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B3 finalize (UX-BEGINNER 7.3, D-033, D-034): Undo steps for the guide lines.
//   - Simple: moving the writing line (baseline) is about no letter, so Undo from another letter
//     never jumps to the one that was open. All tools names the open letter, as before.
//   - Simple: quick presses of an arrow key on one line (a held key, or presses less than
//     BURST_MS apart) are one step, so a held Shift+Arrow never fills the Undo list with
//     whole-font copies and never pushes earlier steps out. All tools: one step per press.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	B,
	R,
	shapeCount,
	square,
	traceInto,
	twoLetterEditor,
} from '../../history/tests/two_letters.js';
import { setModeForTests } from '../../mode/mode.js';
import { METRIC_LABELS } from '../metrics_math.js';
import { showItem } from '../../preview/show_item.js';
import { BURST_MS } from '../../../project_editor/history.js';
import { moveBaseline } from '../font_metrics.js';
import { nudgeLine } from '../guides_layer.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	vi.restoreAllMocks();
	setModeForTests('all');
});

/** Trace B and r (in Simple both become automatic). */
function traceBThenR(mode) {
	setModeForTests(mode);
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor)).toBe(true);
	showItem(editor, R);
	expect(traceInto(editor, 60)).toBe(true);
	return editor;
}

describe('moving the writing line (baseline)', () => {
	it('Simple: the step is about no letter, so Undo from another letter stays there', () => {
		const editor = traceBThenR('simple');
		showItem(editor, B);
		const descent = editor.project.settings.font.descent;
		moveBaseline(1);
		expect(editor.history.queue[0].itemID).toBe(false);
		expect(editor.history.queue[1].itemID).toBe(false);
		showItem(editor, R);
		const navigate = vi.spyOn(editor, 'navigate');
		const result = editor.history.restoreState();
		expect(result.title).toBe('Moved baseline');
		expect(result.moved).toBe(false);
		expect(result.showMe).toBeNull();
		expect(editor.selectedItemID).toBe(R);
		expect(navigate).not.toHaveBeenCalled();
		expect(editor.project.settings.font.descent).toBe(descent);
	});

	it('All tools: the step still names the open letter, as before', () => {
		const editor = traceBThenR('all');
		showItem(editor, B);
		moveBaseline(1);
		expect(editor.history.queue[0].itemID).toBe(B);
		expect(editor.history.queue[1].itemID).toBe(B);
	});
});

describe('quick presses of an arrow key on one guide line', () => {
	const xHeightLine = () => ({ kind: 'metric', key: 'xHeight', orientation: 'h' });

	/** n presses of Shift+Down on the small-letter line, gapMs apart */
	function nudged(presses, { mode = 'simple', gapMs = 0 } = {}) {
		const editor = traceBThenR(mode);
		const before = editor.history.queue.length;
		const stepsBefore = editor.history.length;
		let now = Date.now();
		vi.spyOn(Date, 'now').mockImplementation(() => now);
		for (let i = 0; i < presses; i++) {
			now += gapMs;
			nudgeLine(editor, xHeightLine(), -10);
		}
		vi.mocked(Date.now).mockRestore();
		return {
			editor,
			added: editor.history.queue.length - before,
			steps: editor.history.length - stepsBefore,
		};
	}

	it('Simple, 31 presses of a held key: one whole-font step; earlier traces stay undoable', () => {
		const { editor, added } = nudged(31);
		expect(editor.project.settings.font.xHeight).toBe(190);
		expect(added).toBe(2); // one pre / post pair
		expect(editor.history.queue[1].title).toBe(`Moved ${METRIC_LABELS.xHeight} to 190`);
		expect(editor.history.undoFloor).toBe(null);

		const result = editor.history.restoreState();
		expect(result.title).toBe(`Moved ${METRIC_LABELS.xHeight} to 190`);
		expect(editor.project.settings.font.xHeight).toBe(500);
		editor.history.restoreState();
		editor.history.restoreState();
		expect(shapeCount(editor, B)).toBe(0);
		expect(shapeCount(editor, R)).toBe(0);
		expect(editor.history.queue).toHaveLength(0);
	});

	it('Simple: presses further apart than BURST_MS are steps of their own', () => {
		const { editor, steps } = nudged(3, { gapMs: BURST_MS + 1 });
		expect(editor.project.settings.font.xHeight).toBe(470);
		expect(steps).toBe(3);
		editor.history.restoreState();
		expect(editor.project.settings.font.xHeight).toBe(480);
	});

	it('Simple: a burst stops at any other step', () => {
		const { editor } = nudged(2);
		showItem(editor, B);
		editor.selectedItem.addOneShape(square(700, 100).save());
		editor.history.addState('Added a shape to B');
		nudgeLine(editor, xHeightLine(), -20); // 480 to 460: the gap rule's G moves a unit
		const kinds = editor.history.queue.slice(0, 5).map((entry) => entry.wholeProjectSave);
		// a new pair, the item step, the burst's pair
		expect(kinds).toEqual([true, true, false, true, true]);
		expect(editor.project.settings.font.xHeight).toBe(460);
		editor.history.restoreState();
		expect(editor.project.settings.font.xHeight).toBe(480);
	});

	it('Simple: a burst on a custom guide (no gaps move) is one settings step', () => {
		const editor = traceBThenR('simple');
		editor.project.settings.app.guides.custom = [{ name: 'my guide', location: 300 }];
		editor.history.addSettingsState('Added my guide');
		const before = editor.history.queue.length;
		for (let i = 0; i < 5; i++) nudgeLine(editor, { kind: 'guide', index: 0, orientation: 'h' }, 1);
		expect(editor.history.queue.length - before).toBe(1);
		expect(editor.history.queue[0].title).toBe('Moved my guide to 305');
		editor.history.restoreState();
		expect(editor.project.settings.app.guides.custom[0].location).toBe(300);
	});

	it('All tools: every press is a settings step of its own, as before', () => {
		const { editor, added } = nudged(5, { mode: 'all' });
		expect(added).toBe(5);
		expect(editor.history.queue.slice(0, 5).every((entry) => entry.settingsSave)).toBe(true);
	});
});
