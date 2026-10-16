// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Move the guide lines (UX-BEGINNER.md 4.8, 7.3, 7.6, section 10 B15):
	  - Move the guide lines unlocks the top, capitals, small-letter and tail lines (never the
	    writing line) and shows the purple banner; [Done] locks them again
	  - from the board it opens small n; in a letter it stays on that letter
	  - releasing a dragged line is ONE whole-font Undo step that also refits every automatic
	    letter (B11's moveLine); one Undo puts the line and the letters back
	  - the checks run again and a toast says how many letters changed state
	  - a release that moved nothing is no step; while locked, nothing changes how steps record
	  - arrow-key presses on one line stay one step (B3's bursts)
	  - only in Simple with 'fontDetails' on; the Menu's door event starts it; leaving the letter
	    view ends it
	  - no banned word on the banner
	Written before the code: move_lines.js did not exist.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commitSettingsHistory, setFontMetric } from '../../metrics/font_metrics.js';
import { METRIC_LABELS } from '../../metrics/metrics_math.js';
import { guidesLayerState } from '../../metrics/state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { isGuideLineLocked, guideLinesMoving } from '../../mode/locks.js';
import { setModeForTests } from '../../mode/mode.js';
import { sitsAtFit } from '../../spacing/auto_space.js';
import { inkBounds } from '../../spacing/measure.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { MOVE_GUIDE_LINES_EVENT, openDoor } from '../../topbar/doors.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { impliedLine } from '../../checks/fit_lines_to_writing.js';
import { useNeedsALook } from '../../checks/fix_step.js';
import { fixEditor, glyphId, shapesOf } from '../../checks/tests/fix_fixtures.js';
import { History } from '../../../project_editor/history.js';
import {
	BANNER_NAME,
	installMoveLines,
	isMovingLines,
	linesOf,
	movedLines,
	startMovingLines,
	stopMovingLines,
} from '../move_lines.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '<div id="app__wrapper"><header id="app__top-bar"></header></div>';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ fontDetails: true, checks: true });
	resetToastsForTests();
	guidesLayerState.line = false;
});
afterEach(() => {
	stopMovingLines();
	useNeedsALook(null);
	resetToastsForTests();
	guidesLayerState.line = false;
	warn.mockRestore();
});

const auto = { spacing: 'auto' };
/** n, u and m written 30 % taller than the small-letter line (650 against 500), and H */
const letters = () => ({
	n: { shapes: shapesOf('n', { k: 1.3 }), anyink: auto },
	u: { shapes: shapesOf('u', { k: 1.3 }), anyink: auto },
	m: { shapes: shapesOf('m', { k: 1.3 }), anyink: auto },
	H: { shapes: shapesOf('H'), anyink: auto },
});
/** The letter view on small n */
const onN = () => fixEditor(letters(), { open: 'n' });
const fontJSON = (editor) => JSON.stringify(editor.project.save());
const font = (editor) => editor.project.settings.font;
const everyAutomaticAtFit = (editor) =>
	Object.values(editor.project.glyphs)
		.filter((item) => item.anyink?.spacing === 'auto' && inkBounds(item))
		.every((item) => sitsAtFit(item, editor.project));
const banner = () => document.querySelector(`[data-anyink-banner="${BANNER_NAME}"]`);

/**
 * A guide-line drag as the guides layer makes it: the press, the ticks (no step), then the
 * release's settings step (guides_layer.js finishDrag -> commitSettingsHistory).
 */
function drag(key, to) {
	globalThis.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
	guidesLayerState.line = { kind: 'metric', key, id: key };
	setFontMetric(key, to, { history: false });
	commitSettingsHistory(`Moved ${METRIC_LABELS[key]} to ${to}`);
}

/** An arrow-key press on a hovered line (guides_layer.js nudgeLine) */
function nudge(key, by) {
	globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
	guidesLayerState.line = { kind: 'metric', key, id: key };
	setFontMetric(key, font(globalThis.__editor).xHeight + by, {
		verb: 'Moved',
		burst: `metric ${key}`,
	});
}

describe('which lines moved', () => {
	it('reads the four movable lines and says which moved, from where', () => {
		const lines = { ascent: 800, capHeight: 700, xHeight: 500, descent: -200 };
		expect(linesOf({ ...lines, baseline: 3, upm: 1000 })).toEqual(lines);
		expect(movedLines({ ...lines }, lines)).toBeNull();
		expect(movedLines({ ...lines, xHeight: 560 }, lines)).toEqual({
			line: 'small',
			value: 560,
			from: lines,
		});
		expect(movedLines({ ...lines, descent: -260 }, lines)).toMatchObject({
			line: 'tail',
			value: -260,
		});
	});
});

describe('unlocking', () => {
	it('unlocks the top, capitals, small-letter and tail lines, never the writing line', () => {
		const editor = onN();
		expect(isGuideLineLocked('metric')).toBe(true);
		expect(startMovingLines({ editor })).toBe(true);
		expect(isMovingLines()).toBe(true);
		expect(guideLinesMoving()).toBe(true);
		expect(isGuideLineLocked('metric')).toBe(false);
		expect(isGuideLineLocked('baseline')).toBe(true);
		expect(banner()?.textContent).toContain(word('fontinfo.banner.text'));
		banner().querySelector('[data-anyink-move-lines-action="done"]').click();
		expect(isMovingLines()).toBe(false);
		expect(isGuideLineLocked('metric')).toBe(true);
		expect(banner()).toBeNull();
	});

	it('only in Simple with Font details on', () => {
		const editor = onN();
		setModeForTests('all');
		expect(startMovingLines({ editor })).toBe(false);
		setModeForTests('simple');
		setFeaturesForTests({ fontDetails: false });
		expect(startMovingLines({ editor })).toBe(false);
		expect(isMovingLines()).toBe(false);
	});

	it('stays on the letter that is open; from the board it opens small n', () => {
		const inLetter = fixEditor(letters(), { open: 'H' });
		inLetter.navigate = vi.fn();
		startMovingLines({ editor: inLetter });
		expect(inLetter.navigate).not.toHaveBeenCalled();
		expect(inLetter.selectedItemID).toBe(glyphId('H'));
		stopMovingLines();

		const onBoard = fixEditor(letters(), { page: 'Overview' });
		onBoard.navigate = vi.fn();
		startMovingLines({ editor: onBoard });
		expect(onBoard.navigate).toHaveBeenCalled();
		expect(onBoard.nav.page).toBe('Characters');
		expect(onBoard.selectedItemID).toBe(glyphId('n'));
	});

	it('leaving the letter view, or going to All tools, locks them again', () => {
		const editor = onN();
		startMovingLines({ editor });
		editor.nav.page = 'Overview';
		globalThis.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Overview', appLevel: false } })
		);
		expect(isMovingLines()).toBe(false);
		startMovingLines({ editor: onN() });
		setModeForTests('all');
		globalThis.dispatchEvent(new CustomEvent('anyink-mode-change', { detail: { mode: 'all' } }));
		expect(isMovingLines()).toBe(false);
	});

	it('a page change within the letter view puts the banner back', () => {
		const editor = onN();
		startMovingLines({ editor });
		// the navigator redraws the wrapper on every page change
		document.querySelector('#app__wrapper').innerHTML = '<header id="app__top-bar"></header>';
		globalThis.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Characters', appLevel: false } })
		);
		expect(isMovingLines()).toBe(true);
		expect(banner()).not.toBeNull();
	});

	it("answers the Menu's door", () => {
		const editor = onN();
		const uninstall = installMoveLines({ getEditor: () => editor });
		openDoor(MOVE_GUIDE_LINES_EVENT);
		expect(isMovingLines()).toBe(true);
		stopMovingLines();
		uninstall();
		openDoor(MOVE_GUIDE_LINES_EVENT);
		expect(isMovingLines()).toBe(false);
	});
});

describe('a dragged line is one whole-font step that refits the automatic letters', () => {
	it('the small-letter line: one step; one Undo puts the line and the letters back', () => {
		const editor = onN();
		const before = fontJSON(editor);
		const count = editor.history.length;
		startMovingLines({ editor });
		drag('xHeight', 600);
		expect(font(editor).xHeight).toBe(600);
		expect(editor.history.length).toBe(count + 1);
		const pre = editor.history.queue[1];
		expect(pre.wholeProjectSave).toBe(true);
		expect(pre.itemID).toBe(false); // about no letter (D-033)
		expect(historyText(pre.title)).toBe('moved the small-letter line');
		expect(everyAutomaticAtFit(editor)).toBe(true);
		editor.history.restoreState();
		expect(font(editor).xHeight).toBe(500);
		expect(fontJSON(editor)).toBe(before);
	});

	it('the capitals line too, and a second drag is a second step', () => {
		const editor = onN();
		const count = editor.history.length;
		startMovingLines({ editor });
		drag('capHeight', 760);
		drag('capHeight', 740);
		expect(font(editor).capHeight).toBe(740);
		expect(editor.history.length).toBe(count + 2);
		editor.history.restoreState();
		expect(font(editor).capHeight).toBe(760);
		editor.history.restoreState();
		expect(font(editor).capHeight).toBe(700);
	});

	it('a release that moved nothing is no step', () => {
		const editor = onN();
		const count = editor.history.length;
		startMovingLines({ editor });
		drag('xHeight', 500);
		expect(editor.history.length).toBe(count);
	});

	it('locked again, steps record as they always did', () => {
		const editor = onN();
		startMovingLines({ editor });
		stopMovingLines();
		expect(Object.hasOwn(editor.history, 'addSettingsState')).toBe(false);
		expect(editor.history.addSettingsState).toBe(History.prototype.addSettingsState);
	});

	it('other settings steps while the lines are unlocked are left alone', () => {
		const editor = onN();
		startMovingLines({ editor });
		editor.project.settings.anyink = { letterSet: 'quick+numbers' };
		editor.history.addSettingsState('added numbers & symbols');
		expect(editor.history.queue[0].settingsSave).toBe(true);
		expect(editor.history.queue[0].title).toBe('added numbers & symbols');
	});

	it('arrow-key presses on one line stay one step (bursts)', () => {
		const editor = onN();
		globalThis.__editor = editor;
		const count = editor.history.length;
		startMovingLines({ editor });
		nudge('xHeight', 1);
		nudge('xHeight', 1);
		nudge('xHeight', 1);
		expect(font(editor).xHeight).toBe(503);
		expect(editor.history.length).toBe(count + 1);
		expect(everyAutomaticAtFit(editor)).toBe(true);
		editor.history.restoreState();
		expect(font(editor).xHeight).toBe(500);
		delete globalThis.__editor;
	});
});

describe('the checks run again and a toast says how many letters changed', () => {
	// A stand-in for the checks' size check: more than `share` off its line (25 % by default)
	const offBy =
		(share) =>
		(item, { editor }) => {
			const implied = impliedLine(item, editor.project.settings.font);
			const line = editor.project.settings.font.xHeight;
			return !!implied && implied.line === 'small' && Math.abs(implied.value / line - 1) > share;
		};
	const offItsLine = offBy(0.25);

	it('letters that need a look now', () => {
		const editor = fixEditor(
			{ ...letters(), r: { shapes: shapesOf('r'), anyink: auto }, a: { shapes: shapesOf('a'), anyink: auto } },
			{ open: 'n' }
		);
		// fix track: the small-letter line stops 100 below the capitals line (700), so 600 is as
		// high as it goes; r and a (500) are then more than 15 % short of it
		useNeedsALook(offBy(0.15));
		startMovingLines({ editor });
		drag('xHeight', 600);
		const said = toastLog().find((record) => record.key === 'fixes.toast.lineFlippedMany');
		expect(said?.text).toBe('Moving the line made 2 letters need a look.');
	});

	it('letters that look right again', () => {
		const editor = onN();
		useNeedsALook(offItsLine);
		startMovingLines({ editor });
		drag('xHeight', 600);
		const said = toastLog().find((record) => record.key === 'fontinfo.toast.lineCleared');
		expect(said?.text).toBe('Moving the line made 3 letters look right.');
	});
});

scanSimpleScreen('Move the guide lines banner', () => {
	setFeaturesForTests({ fontDetails: true });
	document.body.innerHTML = '<div id="app__wrapper"><header id="app__top-bar"></header></div>';
	startMovingLines({ editor: onN() });
	return document.body;
});
