// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14 + B15 fix track (fontinfo), first-timer finding H1: Menu > Move the guide lines..., the
	small-letter line dragged up stopped ON the capitals line (1480 of 1480), the capitals line's
	label vanished, and the readout said "capitals line 1480" on top of "Top line".
	  - while the lines are unlocked the small-letter line stays a clear distance (a tenth of the
	    letter box) below the capitals line, and the capitals line as far above it; a font whose
	    lines are already closer never jumps
	  - the readout names the line he holds, with no unit number, and says why it stopped
	  - after the release the readout still names the line he let go, not the one under the
	    pointer
	  - the readout starts right of the line labels' column, never on top of one
	  - All tools, and Simple with the lines locked again, behave as before
	Written before the code: each test failed against move_lines.js as it was.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixEditor, shapesOf } from '../../checks/tests/fix_fixtures.js';
import { useNeedsALook } from '../../checks/fix_step.js';
import { labelColumnRight } from '../../letter/guide_lines.js';
import { setFontMetric } from '../../metrics/font_metrics.js';
import { handleGuidesLayerEvent } from '../../metrics/guides_layer.js';
import { LIVE_LABELS } from '../../metrics/metrics_math.js';
import { drawGuidesLayerOverlay, labelText } from '../../metrics/overlay.js';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { clearGap, keepClear } from '../line_gap.js';
import { startMovingLines, stopMovingLines } from '../move_lines.js';

// The fixture font (upm 1000): top 800, capitals 700, small-letter 500, tail -200
const view = { dx: 300, dy: 900, dz: 0.5 };
const yOf = (em) => view.dy - em * view.dz;
const mouse = (type, x, y, down = false) => ({
	type,
	offsetX: x,
	offsetY: y,
	buttons: type === 'mouseup' ? 0 : down ? 1 : 0,
	shiftKey: false,
});

let warn;
let editor;
const font = () => editor.project.settings.font;

function onN() {
	const auto = { spacing: 'auto' };
	const made = fixEditor(
		{ n: { shapes: shapesOf('n'), anyink: auto }, H: { shapes: shapesOf('H'), anyink: auto } },
		{ open: 'n' }
	);
	Object.assign(made.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
	});
	made.project.settings.app.guides.systemShowGuides = true;
	made.view = { ...view };
	made.selectedTool = 'resize';
	return made;
}

/** A real drag on the guides layer: press on `from`, move to `to`, let go at `to` */
function drag(from, to) {
	expect(handleGuidesLayerEvent(mouse('mousedown', 60, yOf(from)))).toBe(true);
	handleGuidesLayerEvent(mouse('mousemove', 60, yOf(to), true));
	const during = labelText(guidesLayerState.line, font()[guidesLayerState.line.key], null, guidesLayerState);
	handleGuidesLayerEvent(mouse('mouseup', 60, yOf(to)));
	return during;
}

beforeEach(() => {
	document.body.innerHTML = '<div id="app__wrapper"><header id="app__top-bar"></header></div>';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ fontDetails: true, checks: true, letterView: true });
	resetToastsForTests();
	resetGuidesLayerState();
	editor = onN();
});
afterEach(() => {
	stopMovingLines();
	useNeedsALook(null);
	resetToastsForTests();
	resetGuidesLayerState();
	warn.mockRestore();
});

describe('the clear gap (pure)', () => {
	it('is a tenth of the letter box, in whole units', () => {
		expect(clearGap({ upm: 1000 })).toBe(100);
		expect(clearGap({ upm: 2048 })).toBe(205);
		expect(clearGap({})).toBe(100);
	});

	it('keeps the small-letter line below the capitals line, and the capitals line above it', () => {
		const lines = { upm: 1000, ascent: 800, capHeight: 700, xHeight: 500, descent: -200 };
		expect(keepClear(lines, 'xHeight', 700, 500)).toEqual({ value: 600, stopped: true });
		expect(keepClear(lines, 'xHeight', 560, 500)).toEqual({ value: 560, stopped: false });
		expect(keepClear(lines, 'capHeight', 500, 700)).toEqual({ value: 600, stopped: true });
		expect(keepClear(lines, 'capHeight', 760, 700)).toEqual({ value: 760, stopped: false });
		expect(keepClear(lines, 'ascent', 900, 800)).toEqual({ value: 900, stopped: false });
	});

	it('a font whose lines are already closer never jumps; it only moves apart', () => {
		const close = { upm: 1000, capHeight: 700, xHeight: 660 };
		expect(keepClear(close, 'xHeight', 680, 660)).toEqual({ value: 660, stopped: true });
		expect(keepClear(close, 'xHeight', 640, 660)).toEqual({ value: 640, stopped: false });
		expect(keepClear(close, 'capHeight', 680, 700)).toEqual({ value: 700, stopped: true });
	});
});

describe('dragging a line while they are unlocked', () => {
	it('the small-letter line dragged onto the capitals line stops a clear distance below it', () => {
		startMovingLines({ editor });
		drag(500, 700);
		expect(font().xHeight).toBe(600);
		expect(font().capHeight).toBe(700);
		drag(600, 760);
		expect(font().xHeight).toBe(600);
	});

	it('the capitals line dragged onto the small-letter line stops above it', () => {
		startMovingLines({ editor });
		drag(700, 480);
		expect(font().capHeight).toBe(600);
		expect(font().xHeight).toBe(500);
	});

	it('an arrow-key press at the gap moves nothing', () => {
		startMovingLines({ editor });
		drag(500, 700);
		expect(setFontMetric('xHeight', 601, { verb: 'Moved', burst: 'metric xHeight' })).toBe(600);
		expect(font().xHeight).toBe(600);
	});
});

describe('the readout', () => {
	it('names the line he holds, with no unit number, and says why it stopped', () => {
		startMovingLines({ editor });
		const small = LIVE_LABELS.xHeight;
		expect(drag(500, 560)).toBe(small);
		expect(drag(560, 700)).toBe(word('fontinfo.readout.smallStops', { line: small }));
		expect(drag(700, 480)).toBe(
			word('fontinfo.readout.capitalsStops', { line: LIVE_LABELS.capHeight })
		);
		expect(drag(-200, -260)).toBe(LIVE_LABELS.descent);
	});

	it('after the release it still names the line he let go, not the one under the pointer', () => {
		startMovingLines({ editor });
		drag(500, 700); // let go on the capitals line; the small-letter line stopped at 600
		expect(guidesLayerState.hover).toBe('xHeight');
		expect(guidesLayerState.line.key).toBe('xHeight');
	});

	it('starts right of the line labels, never on top of one', () => {
		startMovingLines({ editor });
		const canvas = document.createElement('canvas');
		canvas.width = 1000;
		canvas.height = 1000;
		const ctx = canvas.getContext('2d');
		const xs = [];
		const fill = ctx.fillText.bind(ctx);
		ctx.fillText = (text, x, y) => {
			xs.push(x);
			return fill(text, x, y);
		};
		handleGuidesLayerEvent(mouse('mousedown', 10, yOf(500)));
		handleGuidesLayerEvent(mouse('mousemove', 10, yOf(560), true));
		drawGuidesLayerOverlay(ctx, editor.view, editor.selectedItem);
		handleGuidesLayerEvent(mouse('mouseup', 10, yOf(560)));
		expect(xs.length).toBe(1);
		expect(xs[0]).toBeGreaterThanOrEqual(labelColumnRight(ctx));
		expect(labelColumnRight(ctx)).toBeGreaterThan(20);
	});

	it('sits just above the line it names, even when the pointer went on past where it stopped', () => {
		startMovingLines({ editor });
		const canvas = document.createElement('canvas');
		canvas.width = 1000;
		canvas.height = 1000;
		const ctx = canvas.getContext('2d');
		const ys = [];
		ctx.fillText = (text, x, y) => ys.push(y);
		handleGuidesLayerEvent(mouse('mousedown', 300, yOf(500)));
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(790), true)); // stopped at 600
		drawGuidesLayerOverlay(ctx, editor.view, editor.selectedItem);
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(790)));
		drawGuidesLayerOverlay(ctx, editor.view, editor.selectedItem); // after the release
		expect(font().xHeight).toBe(600);
		ys.forEach((y) => {
			expect(y).toBeLessThan(yOf(600));
			expect(y).toBeGreaterThan(yOf(600) - 14);
		});
		expect(ys.length).toBe(2);
	});
});

describe('All tools, and the lines locked again, as before', () => {
	it('locked again: no gap and the readout has its number', () => {
		startMovingLines({ editor });
		stopMovingLines();
		setModeForTests('all');
		expect(setFontMetric('xHeight', 700, { history: false })).toBe(700);
		const line = { kind: 'metric', key: 'xHeight', id: 'xHeight' };
		expect(labelText(line, 700, null, guidesLayerState)).toBe(
			word('canvas.readout', { label: LIVE_LABELS.xHeight, value: '700' })
		);
	});

	it('All tools: the readout starts by the pointer as it always did', () => {
		setModeForTests('all');
		const canvas = document.createElement('canvas');
		canvas.width = 1000;
		canvas.height = 1000;
		const ctx = canvas.getContext('2d');
		const xs = [];
		ctx.fillText = (text, x) => xs.push(x);
		handleGuidesLayerEvent(mouse('mousedown', 10, yOf(500)));
		drawGuidesLayerOverlay(ctx, editor.view, editor.selectedItem);
		handleGuidesLayerEvent(mouse('mouseup', 10, yOf(500)));
		expect(xs).toEqual([22]);
	});
});

scanSimpleScreen('Move the guide lines readouts', () => {
	const box = document.createElement('div');
	box.textContent = [
		word('fontinfo.readout.smallStops', { line: LIVE_LABELS.xHeight }),
		word('fontinfo.readout.capitalsStops', { line: LIVE_LABELS.capHeight }),
	].join(' ');
	return box;
});
