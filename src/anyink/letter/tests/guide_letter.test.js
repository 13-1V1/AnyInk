// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 letter view, the guide letter (UX-BEGINNER.md 4.3 Canvas, 7.1 #3): a faint outlined
// system-font letter sized to the right lines. It shows on an empty letter and stays while he
// draws, until he leaves the letter; the Guide letter switch shows or hides it on a letter with
// ink. Its left side sits where automatic spacing puts the ink's left side, and it stays still on
// screen when a refit moves the shapes and the view, just as the ink does.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lineTargets } from '../../placement/classes.js';
import { B, R, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { sideGap } from '../../spacing/gap_rule.js';
import {
	drawGuideLetter,
	followRefits,
	guideLetterChar,
	guideLetterLayout,
	guideLetterShown,
	leftSpaceFor,
	resetGuideLetterForTests,
} from '../guide_letter.js';
import { isGuideLetterOn, resetLetterViewForTests, setGuideLetter } from '../view_switches.js';

const FONT = Object.freeze({ upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 });
const VIEW = Object.freeze({ dx: 100, dy: 500, dz: 0.5 });
/** A measured letter at 200 px: 140 px above the baseline, 40 below, 10 px left bearing. */
const METRICS = Object.freeze({ ascent: 140, descent: 40, left: -10, right: 110 });

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal('requestAnimationFrame', (callback) => callback()); // draw now, not next frame
	resetGuideLetterForTests();
	resetLetterViewForTests();
});
afterEach(() => {
	warn.mockRestore();
	vi.unstubAllGlobals();
	resetGuideLetterForTests();
	resetLetterViewForTests();
});

const sY = (y, view = VIEW) => view.dy - y * view.dz;
const sX = (x, view = VIEW) => view.dx + x * view.dz;

function simpleLetterView() {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
}

/** Simple, Capital B open (empty), a known view. */
function emptyB() {
	simpleLetterView();
	const editor = twoLetterEditor();
	showItem(editor, B);
	editor.view = { ...VIEW };
	editor.editCanvas = { redraw() {} };
	return editor;
}

function context() {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	return canvas.getContext('2d');
}

describe('which letters get a guide letter', () => {
	it('a letter, a number or a punctuation mark; not the space or joined letters', () => {
		expect(guideLetterChar({ objType: 'Glyph', char: 'B', shapes: [] })).toBe('B');
		expect(guideLetterChar({ objType: 'Glyph', char: '7', shapes: [] })).toBe('7');
		expect(guideLetterChar({ objType: 'Glyph', char: '?', shapes: [] })).toBe('?');
		expect(guideLetterChar({ objType: 'Glyph', char: ' ', shapes: [] })).toBe('');
		expect(guideLetterChar({ objType: 'Ligature', char: 'fi', shapes: [] })).toBe('');
		expect(guideLetterChar({ objType: 'Component', char: '', shapes: [] })).toBe('');
		expect(guideLetterChar(false)).toBe('');
	});
});

describe('guideLetterLayout: sized to the right lines', () => {
	it.each([
		['B', 'capital'],
		['b', 'tall'],
		['x', 'small'],
		['g', 'tail'],
		['o', 'small, round'],
		['t', 't'],
	])('%s (%s): its ink runs from its class top to its class bottom', (char) => {
		const target = lineTargets(char, FONT);
		const bottom = target.tailBottom ?? target.bottom;
		const layout = guideLetterLayout(char, FONT, METRICS, VIEW, 88);
		expect(layout.ink.top).toBeCloseTo(sY(target.top), 6);
		expect(layout.ink.bottom).toBeCloseTo(sY(bottom), 6);
		expect(layout.ink.left).toBeCloseTo(sX(88), 6);
		// one scale both ways: the letter is not stretched
		const scale = layout.scale;
		expect(layout.ink.right - layout.ink.left).toBeCloseTo((METRICS.left + METRICS.right) * scale, 6);
	});

	it('the hyphen is sized by its width and centered on half the small-letter line', () => {
		const target = lineTargets('-', FONT);
		const layout = guideLetterLayout('-', FONT, { ascent: 60, descent: -40, left: 0, right: 80 }, VIEW, 0);
		expect(layout.ink.right - layout.ink.left).toBeCloseTo(target.width * VIEW.dz, 6);
		expect((layout.ink.top + layout.ink.bottom) / 2).toBeCloseTo(sY(target.center), 6);
	});

	it('nothing to draw when the measured letter has no height', () => {
		expect(guideLetterLayout('B', FONT, { ascent: 0, descent: 0, left: 0, right: 0 }, VIEW, 0)).toBe(
			null
		);
	});

	it("its left side sits where automatic spacing puts the ink's left side", () => {
		const g = FONT.xHeight * 0.08;
		expect(leftSpaceFor('B', FONT)).toBe(sideGap('S', FONT)); // a stem: straight
		expect(leftSpaceFor('o', FONT)).toBe(sideGap('R', FONT)); // round
		expect(leftSpaceFor('A', FONT)).toBe(sideGap('O', FONT)); // open
		expect(leftSpaceFor('?', FONT)).toBe(Math.round(0.6 * g)); // punctuation
	});
});

describe('when it shows', () => {
	it('never in All tools, nor in Simple before the letter view lands', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(false);
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false }); // on in the app since B7
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(false);
	});

	it('on an empty letter, and it stays while he draws until he leaves the letter', () => {
		const editor = emptyB();
		const project = editor.project;
		expect(guideLetterShown(editor.selectedItem, project)).toBe(true);
		traceInto(editor, 300); // his first ink, one step, refit
		expect(editor.selectedItem.shapes).toHaveLength(1);
		expect(guideLetterShown(editor.selectedItem, project)).toBe(true);

		// He leaves: small r, then back to B. B has ink now, so no guide letter
		showItem(editor, R);
		expect(guideLetterShown(editor.selectedItem, project)).toBe(true); // r is empty
		showItem(editor, B);
		expect(guideLetterShown(editor.selectedItem, project)).toBe(false);
	});

	it('leaving the letter page ends the visit too (the board, Help)', () => {
		const editor = emptyB();
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(true);
		traceInto(editor, 300);
		window.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Overview', appLevel: false } })
		);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(false);
	});

	it('a page drawn again on the letter page keeps the visit', () => {
		const editor = emptyB();
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(true);
		traceInto(editor, 300);
		window.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Characters', appLevel: false } })
		);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(true);
	});

	it('the Guide letter switch shows or hides it on a letter with ink, for this visit', () => {
		const editor = emptyB();
		traceInto(editor, 300);
		showItem(editor, R);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(true); // r: empty
		showItem(editor, B); // B has ink: off by default
		const item = editor.selectedItem;
		expect(guideLetterShown(item, editor.project)).toBe(false);
		expect(isGuideLetterOn(item)).toBe(false);
		setGuideLetter(false);
		expect(guideLetterShown(item, editor.project)).toBe(false);
		setGuideLetter(true);
		expect(guideLetterShown(item, editor.project)).toBe(true);
		// back after leaving: the automatic rule again
		showItem(editor, R);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(true);
		showItem(editor, B);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(false);
	});

	it('an empty letter always shows it: the switch lives in Fine-tune, which needs ink', () => {
		const editor = emptyB();
		setGuideLetter(false);
		expect(guideLetterShown(editor.selectedItem, editor.project)).toBe(true);
	});

	it('the switch never touches the font', () => {
		const editor = emptyB();
		traceInto(editor, 300);
		const before = JSON.stringify(editor.project.save());
		const steps = editor.history.queue.length;
		setGuideLetter(false);
		setGuideLetter(true);
		expect(JSON.stringify(editor.project.save())).toBe(before);
		expect(editor.history.queue).toHaveLength(steps);
	});
});

describe('drawing', () => {
	it('draws the letter faintly: an outline over a light fill, in the ink token', () => {
		const editor = emptyB();
		const ctx = context();
		expect(drawGuideLetter(ctx, editor.view, editor.selectedItem, editor.project)).toBe(true);
		const kinds = ctx.__getEvents().map((e) => e.type);
		expect(kinds).toContain('fillText');
		expect(kinds).toContain('strokeText');
		const drawn = ctx.__getEvents().filter((e) => e.type === 'fillText' || e.type === 'strokeText');
		drawn.forEach((e) => expect(e.props.text).toBe('B'));
	});

	it('draws nothing where it does not show', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		const ctx = context();
		expect(drawGuideLetter(ctx, VIEW, editor.selectedItem, editor.project)).toBe(false);
		expect(ctx.__getEvents()).toHaveLength(0);
	});
});

describe('it stays still on screen through a refit, like the ink', () => {
	/** Where the guide letter is drawn on screen right now (its translation). */
	function onScreen(editor) {
		followRefits(editor.selectedItem, editor.view, editor.project);
		const ctx = context();
		drawGuideLetter(ctx, editor.view, editor.selectedItem, editor.project);
		return ctx.__getEvents().find((e) => e.type === 'fillText').transform[4];
	}

	it('the first ink drawn right of the guide: the refit moves the view, the guide stays', () => {
		const editor = emptyB();
		const item = () => editor.selectedItem;
		const before = onScreen(editor);
		// His first shape far right of where spacing puts the left side
		item().addOneShape(square(400).save());
		editor.history.addState('Added a rectangle');
		const moved = item().leftSideBearing - 400;
		expect(moved).not.toBe(0); // the refit moved the shapes...
		expect(editor.view.dx).toBeCloseTo(VIEW.dx - moved * VIEW.dz, 6); // ...and the view back
		expect(onScreen(editor)).toBeCloseTo(before, 6); // the guide letter did not jump
	});

	it('a later shape and its refit: still no jump', () => {
		const editor = emptyB();
		const item = () => editor.selectedItem;
		onScreen(editor); // opened empty: the canvas draws before he draws
		item().addOneShape(square(400).save());
		editor.history.addState('Added a rectangle');
		const before = onScreen(editor);
		// A second shape further left: the refit moves everything right, the view left
		item().addOneShape(square(-200, 100).save());
		const dx = editor.view.dx;
		editor.history.addState('Added a rectangle');
		expect(editor.view.dx).not.toBe(dx);
		expect(onScreen(editor)).toBeCloseTo(before, 6);
	});

	it('panning moves it with the canvas', () => {
		const editor = emptyB();
		const start = onScreen(editor);
		editor.view = { dx: VIEW.dx + 40 };
		expect(onScreen(editor)).toBeCloseTo(start + 40, 6);
	});
});
