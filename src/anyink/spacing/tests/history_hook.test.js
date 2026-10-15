// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 hooks (UX-BEGINNER 7.2, section 10 B3): the spacing hook at the top of History.addState.
// Simple refits an automatic letter inside the same Undo step; an edge drag or side nudge marks
// the letter "set by you" first, so it never snaps back. All tools never refits: any step that
// changes an automatic letter's left space or width marks it "set by you" (Attributes fields,
// auto-fit, a moved shape, Transforms, Global actions side bearings, edge drags). The faint photo
// moves with the shapes whenever spacing moves them. The letter-spacing slider (B12's whole-font
// step) moves letters set by hand too and stops at touching.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress } from '../../../edit_canvas/events_keyboard.js';
import { addRangeToSelectedFilterInputs } from '../../../pages/global_actions/page.js';
import { makeCard_SideBearings } from '../../../pages/global_actions/move_and_resize.js';
import { makeCard_glyphAttributes } from '../../../panels/card_glyph.js';
import { makePanel_Transforms } from '../../../panels/transforms.js';
import { Glyph } from '../../../project_data/glyph.js';
import { applyAutoTrace } from '../../autotrace/apply.js';
import { square, B, R, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFineTuneOpen } from '../../letter/view_switches.js';
import { handleGuidesLayerEvent, nudgeLine } from '../../metrics/guides_layer.js';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { fitSpacing, setExtra } from '../auto_space.js';
import { extraRange } from '../extra.js';
import { inkBounds } from '../measure.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	// editor.navigate() without an #app__wrapper only warns; keep test output quiet
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetGuidesLayerState();
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
	vi.useRealTimers();
	eventHandlerData.isCtrlDown = false;
	eventHandlerData.isShiftDown = false;
});

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

const VIEW = { dx: 100, dy: 500, dz: 0.5 };
const xOf = (em) => VIEW.dx + em * VIEW.dz;
const titles = (editor) => editor.history.queue.map((entry) => entry.title);
const glyphOf = (editor, id) => editor.project.glyphs[id];
const ownerOf = (item) => item?.anyink?.spacing;

/** What the fitter makes of a copy of the letter (the live letter is not touched). */
function fittedCopy(item, project) {
	const copy = new Glyph(item.save());
	copy.parent = project;
	fitSpacing(copy, project);
	return copy;
}

/** @returns {Boolean} true when fitting the letter again would change nothing */
function isFitted(item, project) {
	const copy = fittedCopy(item, project);
	return copy.leftSideBearing === item.leftSideBearing && copy.advanceWidth === item.advanceWidth;
}

/**
 * Not refit: the letter keeps what the edit made of it, which is not what the fitter would make.
 * (A spy can't count the hook's calls: the setup file loads History, and with it the fitter,
 * before a test file's mocks exist.)
 */
function expectNotRefit(item, project) {
	expect(isFitted(item, project)).toBe(false);
}

/** Every point and handle, as numbers. */
function coordinates(item) {
	const out = [];
	item.shapes.forEach((shape) =>
		shape.pathPoints.forEach((point) => {
			out.push(point.p.x, point.p.y, point.h1.x, point.h1.y, point.h2.x, point.h2.y);
		})
	);
	return out;
}

/** Simple: open B and trace a square into it (the first ink: automatic, fitted). */
function simpleB({ x0 = 100 } = {}) {
	setModeForTests('simple');
	const editor = twoLetterEditor();
	showItem(editor, B);
	expect(traceInto(editor, x0)).toBe(true);
	return editor;
}

/** The letter made in Simple, then fine-tuned in All tools (More tools). */
function allToolsB() {
	const editor = simpleB();
	setModeForTests('all');
	expect(ownerOf(glyphOf(editor, B))).toBe('auto');
	return editor;
}

/** Edge lines on, a known view and the arrow tool, as on the letter's edit canvas. */
function onCanvas(editor) {
	Object.assign(editor.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
		leftSide: true,
		rightSide: true,
	});
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
	editor.editCanvas ||= { redraw() {} }; // no real canvas in jsdom
	return editor;
}

function mouse(type, x, y, { down = false } = {}) {
	return {
		type,
		offsetX: x,
		offsetY: y,
		button: 0,
		buttons: type === 'mouseup' ? 0 : down ? 1 : 0,
	};
}

/** Drags a side line by dxPx screen pixels and lets go. */
function dragSide(editor, side, dxPx) {
	const glyph = editor.selectedItem;
	const x = side === 'lsb' ? xOf(0) : xOf(glyph.advanceWidth);
	expect(handleGuidesLayerEvent(mouse('mousedown', x, 300))).toBe(true);
	expect(guidesLayerState.dragging).toBe(side);
	handleGuidesLayerEvent(mouse('mousemove', x + dxPx, 300, { down: true }));
	handleGuidesLayerEvent(mouse('mouseup', x + dxPx, 300));
}

/** A photo under the letter, its left edge 30 units left of the ink. */
function putPhotoUnder(editor, id = B) {
	const glyph = glyphOf(editor, id);
	setTrace(glyph, {
		asset: 'img-b3hook01',
		width: 300,
		height: 300,
		x: glyph.leftSideBearing - 30,
		y: 700,
		scale: 2,
	});
	return glyph;
}

/** How far the photo's left edge sits from the ink's left edge (it should never change). */
const photoToInk = (glyph) => getTrace(glyph).x - glyph.leftSideBearing;

// --------------------------------------------------------------
// Simple: the refit rides inside the step
// --------------------------------------------------------------

describe('Simple: an automatic letter is refit inside the same Undo step', () => {
	it('a letter first given ink starts automatic and is fitted in the step that inked it', () => {
		const editor = simpleB({ x0: 100 });
		const glyph = glyphOf(editor, B);
		expect(ownerOf(glyph)).toBe('auto');
		expect(glyph.leftSideBearing).not.toBe(100);
		expect(isFitted(glyph, editor.project)).toBe(true);
		// One step, and it holds the fitted letter
		expect(titles(editor)).toHaveLength(1);
		const step = editor.history.queue[0].itemState;
		expect(step.leftSideBearing).toBe(glyph.leftSideBearing);
		expect(step.advanceWidth).toBe(glyph.advanceWidth);
		expect(ownerOf(step)).toBe('auto');
	});

	it('adding a shape refits in that one step; one Undo goes back to the fitted letter before it', () => {
		const editor = simpleB();
		const glyph = glyphOf(editor, B);
		const before = {
			lsb: glyph.leftSideBearing,
			width: glyph.advanceWidth,
			ink: coordinates(glyph),
		};

		// A narrow piece far to the left, through the real apply path (mode 'add')
		const added = applyAutoTrace({
			editor,
			item: glyph,
			shapes: [square(-300, 100)],
			mode: 'add',
		});
		expect(added).toBe(true);
		expect(titles(editor)).toHaveLength(2);
		expect(glyph.shapes).toHaveLength(2);
		expect(isFitted(glyph, editor.project)).toBe(true);
		expect(glyph.leftSideBearing).toBe(before.lsb);
		expect(glyph.advanceWidth).toBeGreaterThan(before.width);
		const after = { width: glyph.advanceWidth, ink: coordinates(glyph) };

		// One press undoes the edit and its refit together
		editor.history.restoreState();
		const back = glyphOf(editor, B);
		expect(back.shapes).toHaveLength(1);
		expect(back.advanceWidth).toBe(before.width);
		expect(coordinates(back)).toEqual(before.ink);
		expect(titles(editor)).toHaveLength(1);

		editor.history.redoState();
		const again = glyphOf(editor, B);
		expect(again.advanceWidth).toBe(after.width);
		expect(coordinates(again)).toEqual(after.ink);
	});

	it('the ink stays put on screen: the view shifts by what the refit moved', () => {
		setModeForTests('simple');
		const editor = onCanvas(twoLetterEditor());
		showItem(editor, B);
		onCanvas(editor);
		traceInto(editor, 100);
		const glyph = glyphOf(editor, B);
		const moved = glyph.leftSideBearing - 100;
		expect(moved).not.toBe(0);
		expect(editor.view.dx).toBeCloseTo(VIEW.dx - moved * VIEW.dz, 6);
	});

	it('a fitter that fails never costs the step: it is kept, unfitted, with a warning', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		const glyph = editor.selectedItem;
		glyph.addOneShape(square(100).save());
		glyph.shapes[0].updateShapePosition = () => {
			throw new Error('cannot move');
		};
		editor.history.addState('Added path');
		expect(titles(editor)).toEqual(['Added path']);
		expect(glyph.leftSideBearing).toBe(100);
		expect(warn).toHaveBeenCalledWith(
			'ANY-INK spacing: the step was kept without its spacing check',
			expect.any(Error)
		);
	});

	it('a letter set by hand is never refit', () => {
		const editor = simpleB();
		const glyph = glyphOf(editor, B);
		glyph.anyink.spacing = 'manual';
		glyph.shapes[0].updateShapePosition(250, 0);
		const lsb = glyph.leftSideBearing;
		editor.history.addState('Nudged shape(s) by 250, 0');
		expect(glyph.leftSideBearing).toBe(lsb);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
	});

	it('a letter that already had ink and no owner (an old or imported font) is never re-spaced', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		const glyph = glyphOf(editor, R);
		glyph.addOneShape(square(130, 300).save());
		editor.history.initialize(editor.project); // the font as opened: r already has ink
		showItem(editor, R);
		const r = editor.selectedItem;
		r.shapes[0].updateShapePosition(10, 0);
		editor.history.addState('Nudged shape(s) by 10, 0');
		expect(ownerOf(r)).toBeUndefined();
		expect(r.leftSideBearing).toBe(140);
		expectNotRefit(r, editor.project);
	});

	it('writes whole numbers: a fractional trace with { round: true } comes out whole and fitted', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, R);
		const r = editor.selectedItem;
		const ok = applyAutoTrace(
			{ editor, item: r, shapes: [square(100.4, 299.3)], mode: 'replace' },
			{ round: true, title: 'traced r' }
		);
		expect(ok).toBe(true);
		expect(titles(editor)).toEqual(['traced r']);
		expect(coordinates(r).every(Number.isInteger)).toBe(true);
		expect(Number.isInteger(r.advanceWidth)).toBe(true);
		expect(Number.isInteger(r.leftSideBearing)).toBe(true);
		expect(r.advanceWidth).toBeGreaterThan(0);
		expect(isFitted(r, editor.project)).toBe(true);
	});

	it('a refit of whole-number ink stays whole', () => {
		const editor = simpleB();
		const glyph = glyphOf(editor, B);
		glyph.shapes[0].updateShapePosition(37, 0);
		editor.history.addState('Nudged shape(s) by 37, 0');
		expect(coordinates(glyph).every(Number.isInteger)).toBe(true);
		expect(Number.isInteger(glyph.advanceWidth)).toBe(true);
	});
});

// --------------------------------------------------------------
// Simple: edge drags and side nudges never snap back
// --------------------------------------------------------------

// B6 + B7 finalize (letter card verdict: "Set by you" after the first point; letter tools: the
// flag read null after a Ctrl+Z mid-shape): in Simple a letter starts automatic at its first
// shape, a Point pen click included, so every step of the shape holds the flag
describe('Simple: a letter starts automatic at its first shape, before it has ink', () => {
	it('one point (no ink yet): automatic, in that step; an Undo back to it keeps the flag', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		const glyph = glyphOf(editor, B);
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		glyph.addOneShape({ name: 'Path 1', pathPoints: [corner(100, 0)] });
		editor.history.addState('New path: added point 0');
		expect(ownerOf(glyphOf(editor, B))).toBe('auto');
		expect(ownerOf(editor.history.queue[0].itemState)).toBe('auto');
		glyphOf(editor, B).shapes[0].addPathPoint({ p: { coord: { x: 400, y: 0 } } });
		editor.history.addState('New path: added point 1');
		editor.history.restoreState();
		expect(ownerOf(glyphOf(editor, B))).toBe('auto');
	});
});

describe('Simple: an edge drag or side nudge marks the letter set by you, so it never snaps back', () => {
	beforeEach(() => setFineTuneOpen(true, null)); // B7: the edges show (and move) in Fine-tune

	it('a left-edge drag stays where it was dropped, as one step; Undo brings back automatic', () => {
		const editor = onCanvas(simpleB());
		const glyph = editor.selectedItem;
		const fitted = { lsb: glyph.leftSideBearing, width: glyph.advanceWidth };

		// 30 px right = 60 units: the edge moves right, so the left space shrinks by 60
		dragSide(editor, 'lsb', 30);
		expect(glyph.leftSideBearing).toBe(fitted.lsb - 60);
		expect(ownerOf(glyph)).toBe('manual');
		expect(titles(editor)[0]).toBe('Updated left side bearing.');
		expect(titles(editor)).toHaveLength(2);
		expectNotRefit(glyph, editor.project);
		expect(ownerOf(editor.history.queue[0].itemState)).toBe('manual');

		editor.history.restoreState();
		const back = glyphOf(editor, B);
		expect(ownerOf(back)).toBe('auto');
		expect(back.leftSideBearing).toBe(fitted.lsb);
		expect(back.advanceWidth).toBe(fitted.width);
	});

	it('a right-edge drag stays where it was dropped', () => {
		const editor = onCanvas(simpleB());
		const glyph = editor.selectedItem;
		const width = glyph.advanceWidth;
		dragSide(editor, 'rsb', 50); // 100 units wider
		expect(glyph.advanceWidth).toBe(width + 100);
		expect(ownerOf(glyph)).toBe('manual');
		expect(titles(editor)[0]).toBe('Updated right side bearing.');
		expectNotRefit(glyph, editor.project);
	});

	it('an arrow-key nudge of a side line stays put', () => {
		const editor = onCanvas(simpleB());
		const glyph = editor.selectedItem;
		const lsb = glyph.leftSideBearing;
		nudgeLine(
			editor,
			{ id: 'lsb', kind: 'sideBearing', side: 'lsb', orientation: 'v', value: 0 },
			10
		);
		expect(glyph.leftSideBearing).toBe(lsb - 10);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);

		const width = glyph.advanceWidth;
		nudgeLine(
			editor,
			{ id: 'rsb', kind: 'sideBearing', side: 'rsb', orientation: 'v', value: width },
			-10
		);
		expect(glyph.advanceWidth).toBe(width - 10);
		expect(titles(editor).slice(0, 2)).toEqual([
			'Updated right side bearing.',
			'Updated left side bearing.',
		]);
	});

	it('the photo stays under the ink after a left-edge drag', () => {
		const editor = onCanvas(simpleB());
		const glyph = putPhotoUnder(editor);
		const gap = photoToInk(glyph);
		dragSide(editor, 'lsb', -40); // 80 units more left space
		expect(photoToInk(glyph)).toBe(gap);
		expect(getTrace(editor.history.queue[0].itemState).x).toBe(getTrace(glyph).x);
	});
});

// --------------------------------------------------------------
// The photo moves with the shapes
// --------------------------------------------------------------

describe('the photo moves with the shapes whenever spacing moves them', () => {
	it('stays under the ink after a refit, in the same Undo step', () => {
		const editor = simpleB();
		const glyph = putPhotoUnder(editor);
		const gap = photoToInk(glyph);
		const photoBefore = getTrace(glyph).x;
		// Move the ink 200 units right (the photo stays where it is): the refit then moves both
		glyph.shapes[0].updateShapePosition(200, 0);
		editor.history.addState('Nudged shape(s) by 200, 0');
		expect(isFitted(glyph, editor.project)).toBe(true);
		expect(photoToInk(glyph)).toBe(gap - 200);
		expect(getTrace(glyph).x).not.toBe(photoBefore + 200);
		expect(getTrace(editor.history.queue[0].itemState)).toEqual(getTrace(glyph));
	});
});

describe('the letter-spacing slider: one whole-font step in Simple', () => {
	/** Left space and right space, from the ink */
	const sidesOf = (item) => {
		const ink = inkBounds(item);
		return { left: ink.xMin, right: item.advanceWidth - ink.xMax };
	};

	/** B automatic; r set by hand with 10 units each side; a photo under each. */
	function twoSpacedLetters() {
		const editor = simpleB();
		showItem(editor, R);
		traceInto(editor, 60);
		const r = glyphOf(editor, R);
		r.anyink.spacing = 'manual';
		r.shapes[0].updateShapePosition(10 - r.leftSideBearing, 0);
		r.advanceWidth = r.maxes.xMax + 10;
		editor.history.addState('set r by hand');
		putPhotoUnder(editor, B);
		putPhotoUnder(editor, R);
		editor.history.addState('photo under r');
		return editor;
	}

	/** What Try it's slider does on release (B12): one whole-font step around setExtra, about no letter. */
	function slide(editor, value) {
		editor.history.addWholeProjectChangePreState('moved all letters closer', { itemID: null });
		const result = setExtra(editor.project, value);
		editor.history.addWholeProjectChangePostState();
		return result;
	}

	it('moves letters set by hand too, and stops at touching: no side goes below zero', () => {
		const editor = twoSpacedLetters();
		const before = { B: sidesOf(glyphOf(editor, B)), r: sidesOf(glyphOf(editor, R)) };
		expect(before.r).toEqual({ left: 10, right: 10 });
		const { min } = extraRange(editor.project);
		expect(min).toBeLessThan(-10);

		slide(editor, min); // the far left end
		const after = { B: sidesOf(glyphOf(editor, B)), r: sidesOf(glyphOf(editor, R)) };
		expect(after.r).toEqual({ left: 0, right: 0 }); // touching, never overlapping
		expect(after.B.left).toBeGreaterThanOrEqual(0);
		expect(after.B.right).toBeGreaterThanOrEqual(0);
		expect(after.B.left + after.B.right).toBeLessThan(before.B.left + before.B.right);
		// Simple never flips the owner on a whole-font step
		expect(ownerOf(glyphOf(editor, B))).toBe('auto');
		expect(ownerOf(glyphOf(editor, R))).toBe('manual');
		expect(isFitted(glyphOf(editor, B), editor.project)).toBe(true); // fitted with the extra

		// Further apart moves the hand-set letter by the extra on each side
		slide(editor, 7);
		expect(sidesOf(glyphOf(editor, R))).toEqual({ left: 17, right: 17 });
	});

	it('keeps every photo under its ink, and one Undo puts every letter back', () => {
		const editor = twoSpacedLetters();
		const gaps = { B: photoToInk(glyphOf(editor, B)), r: photoToInk(glyphOf(editor, R)) };
		const lefts = { B: glyphOf(editor, B).leftSideBearing, r: glyphOf(editor, R).leftSideBearing };

		slide(editor, extraRange(editor.project).min);
		expect(glyphOf(editor, R).leftSideBearing).not.toBe(lefts.r);
		expect(photoToInk(glyphOf(editor, B))).toBe(gaps.B);
		expect(photoToInk(glyphOf(editor, R))).toBe(gaps.r);

		const result = editor.history.restoreState();
		expect(result.done).toBe(true);
		expect(glyphOf(editor, B).leftSideBearing).toBe(lefts.B);
		expect(glyphOf(editor, R).leftSideBearing).toBe(lefts.r);
		expect(photoToInk(glyphOf(editor, R))).toBe(gaps.r);
	});
});

// --------------------------------------------------------------
// All tools: never refit; a changed left space or width marks the letter set by you
// --------------------------------------------------------------

describe('All tools: flips to "set by you" and never refits', () => {
	it('Attributes: typing a left space', () => {
		const editor = allToolsB();
		const glyph = editor.selectedItem;
		const card = makeCard_glyphAttributes(glyph);
		document.body.appendChild(card);
		const field = card.querySelector('.singleInput-leftSideBearing');
		field.value = '150';
		field.dispatchEvent(new Event('change'));
		expect(glyph.leftSideBearing).toBe(150);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
		// Undo (upstream's, unchanged) brings back automatic with the fitted space
		editor.history.restoreState();
		expect(ownerOf(glyphOf(editor, B))).toBe('auto');
	});

	it('Attributes: typing a width', () => {
		const editor = allToolsB();
		const glyph = editor.selectedItem;
		const card = makeCard_glyphAttributes(glyph);
		document.body.appendChild(card);
		const field = card.querySelector('.singleInput-advanceWidth');
		field.value = String(glyph.advanceWidth + 77);
		const width = glyph.advanceWidth + 77;
		field.dispatchEvent(new Event('change'));
		expect(glyph.advanceWidth).toBe(width);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
	});

	it('Attributes: the auto-fit width button', () => {
		const editor = allToolsB();
		const glyph = editor.selectedItem;
		const card = makeCard_glyphAttributes(glyph);
		document.body.appendChild(card);
		card.querySelector('.panel-card__action-button').click();
		expect(glyph.advanceWidth).toBe(glyph.maxes.xMax);
		expect(titles(editor)[0]).toBe('Auto-fit advance width');
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
	});

	it('a shape moved with the arrow keys', () => {
		const editor = onCanvas(allToolsB());
		const glyph = editor.selectedItem;
		const lsb = glyph.leftSideBearing;
		editor.multiSelect.shapes.add(glyph.shapes[0]);
		handleKeyPress(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(titles(editor)[0]).toBe('Nudged shape(s) by 1, 0');
		expect(glyph.leftSideBearing).toBe(lsb + 1);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
	});

	it('a shape moved up or down only keeps automatic (neither the left space nor the width changed)', () => {
		const editor = onCanvas(allToolsB());
		const glyph = editor.selectedItem;
		editor.multiSelect.shapes.add(glyph.shapes[0]);
		handleKeyPress(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		expect(titles(editor)[0]).toBe('Nudged shape(s) by 0, 1');
		expect(ownerOf(glyph)).toBe('auto');
	});

	it('Transforms: a skew that moves the shape tops left', () => {
		const editor = allToolsB();
		const glyph = editor.selectedItem;
		const lsb = glyph.leftSideBearing;
		const holder = document.createElement('div');
		makePanel_Transforms().forEach((card) => holder.appendChild(card));
		document.body.appendChild(holder);
		editor.multiSelect.shapes.add(glyph.shapes[0]);
		const bar = holder.querySelector('#skewDistance_slider');
		bar.value = '-100';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		bar.dispatchEvent(new Event('change', { bubbles: true }));
		expect(glyph.leftSideBearing).toBeLessThan(lsb);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
	});

	it('Global actions: side bearings for every letter, one whole-font step; Undo brings back automatic', () => {
		vi.useFakeTimers();
		const editor = allToolsB();
		const fittedLSB = editor.selectedItem.leftSideBearing;
		const project = editor.project;
		project.settings.project.characterRanges.forEach((range) =>
			addRangeToSelectedFilterInputs(range)
		);
		const card = makeCard_SideBearings();
		document.body.appendChild(card);
		const left = card.querySelector('#sideBearingLeft');
		left.value = '20';
		left.dispatchEvent(new Event('input', { bubbles: true }));
		left.dispatchEvent(new Event('change', { bubbles: true }));
		card.querySelector('fancy-button').click();
		vi.runAllTimers();

		const after = glyphOf(editor, B);
		expect(after.leftSideBearing).toBe(20);
		expect(ownerOf(after)).toBe('manual');
		expectNotRefit(after, editor.project);
		expect(editor.history.queue[0].wholeProjectSave).toBe(true);

		editor.history.restoreState();
		expect(ownerOf(glyphOf(editor, B))).toBe('auto');
		expect(glyphOf(editor, B).leftSideBearing).toBe(fittedLSB);
	});

	it('an edge drag', () => {
		const editor = onCanvas(allToolsB());
		const glyph = editor.selectedItem;
		dragSide(editor, 'lsb', 10);
		expect(ownerOf(glyph)).toBe('manual');
		expectNotRefit(glyph, editor.project);
	});

	it('the photo stays where it is on an All tools edge drag (as before B3)', () => {
		const editor = onCanvas(allToolsB());
		const glyph = putPhotoUnder(editor);
		const photo = getTrace(glyph).x;
		dragSide(editor, 'lsb', 10);
		expect(getTrace(glyph).x).toBe(photo);
	});

	it('a letter with no owner gets none: its data stays exactly as before', () => {
		const editor = twoLetterEditor();
		showItem(editor, R);
		const r = editor.selectedItem;
		r.addOneShape(square(100, 300).save());
		editor.history.addState('Added path');
		const card = makeCard_glyphAttributes(r);
		document.body.appendChild(card);
		const field = card.querySelector('.singleInput-leftSideBearing');
		field.value = '60';
		field.dispatchEvent(new Event('change'));
		expect(r.leftSideBearing).toBe(60);
		expect(r.save().anyink).toBeUndefined();
		expectNotRefit(r, editor.project);
	});

	it('looking at another letter never refits or flips', () => {
		const editor = allToolsB();
		showItem(editor, R);
		showItem(editor, B);
		expect(titles(editor)[0]).toMatch(/^Navigated to/);
		expect(ownerOf(glyphOf(editor, B))).toBe('auto');
	});
});
