// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7, "The empty letter: one green door"), with the 'sketch' flag on:
	  - [Sketch it] is the green button on every empty letter, its key L printed beside it and its
	    line under it; [Use a photo] outlined after it;
	  - unless a photo part waits: [Use the same photo] green, [Sketch it] outlined right under it;
	    a photo he is done with never leads;
	  - "Draw it with points" and the Brush button are gone; the Brush and "No photo yet? How to
	    take one" sit in the quiet More ways fold, shut until pressed;
	  - "or sketch the outline instead" is a quiet link with a picture;
	  - [Sketch it] picks the Line with the letter's way Centerline; the outline link picks it with
	    the way Outline; a letter with pieces keeps its way;
	  - the box stays while the Line the letter opened with is picked, steps aside while a piece is
	    open, and every word passes the strict banned-word scan.
	With the flag off the box is exactly as before. Written to fail first (none of it existed).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { flagsOn, resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { pickOpeningTool, resetOpeningToolForTests } from '../../nib/default_tool.js';
import { addPiece, addPoint, newSketch, setSketch, sketchOf } from '../../sketch/model.js';
import {
	clearOpenPiece,
	resetUndoGateForTests,
	setOpenPiece,
} from '../../sketch/tools/undo_gate.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { makeEmptyOverlay, overlayButtons, overlayShows } from '../empty_overlay.js';
import { doorButtons, moreWays, openSketchDoor, setDoorWay } from '../sketch_door.js';
import { resetLetterViewForTests } from '../view_switches.js';

function openB({ sketch = true } = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, sketch });
	const editor = twoLetterEditor();
	// the Point pen's state, which any tool pick puts down (new_path.js)
	editor.eventHandlers.tool_addPath = {};
	editor.selectedGlyphID = B;
	editor.selectedGlyph;
	editor.selectedTool = 'resize';
	return editor;
}

const overlay = () => document.querySelector('[data-anyink-overlay]');
const shown = () => !!overlay() && !overlay().hidden;
const action = (id) => document.querySelector(`[data-anyink-overlay-action="${id}"]`);
const link = (name) => document.querySelector(`[data-anyink-overlay-link="${name}"]`);
const greens = () =>
	[...overlay().querySelectorAll('.anyink-primary')].map((b) => b.textContent.trim());

beforeEach(() => {
	resetLetterViewForTests();
	resetOpeningToolForTests();
	resetUndoGateForTests();
});
afterEach(() => {
	resetFeaturesForTests();
	resetUndoGateForTests();
	resetOpeningToolForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('which doors, in which order (the first one green)', () => {
	const on = flagsOn('brush', 'photo', 'sketch');

	it('[Sketch it] first; [Use a photo] after it', () => {
		expect(doorButtons(on)).toEqual(['sketchIt', 'usePhoto']);
		expect(overlayButtons(on)).toEqual(['sketchIt', 'usePhoto']);
	});

	it('a photo part waiting: [Use the same photo] leads, [Sketch it] right under it', () => {
		expect(overlayButtons(on, { samePhoto: true })).toEqual([
			'useSamePhoto',
			'sketchIt',
			'chooseAnother',
		]);
	});

	it('a photo he is done with never leads', () => {
		expect(overlayButtons(on, { samePhoto: true, done: true })).toEqual([
			'sketchIt',
			'chooseAnother',
			'useSamePhoto',
		]);
	});

	it('no photos: [Sketch it] alone; More ways holds the Brush, and How with photos', () => {
		expect(overlayButtons(flagsOn('brush', 'sketch'))).toEqual(['sketchIt']);
		expect(moreWays(flagsOn('brush', 'sketch'))).toEqual(['brush']);
		expect(moreWays(on)).toEqual(['brush', 'how']);
	});

	it('guard, the flag off: the buttons as before', () => {
		expect(overlayButtons(flagsOn('brush', 'photo'))).toEqual(['usePhoto', 'drawBrush']);
		expect(overlayButtons(flagsOn())).toEqual(['drawPoints']);
	});
});

describe('the box on an empty letter', () => {
	it('[Sketch it] green with L printed and its line; no Brush or "Draw it with points" button', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(shown()).toBe(true);
		expect(greens()).toEqual([word('sketch.door.sketchIt')]);
		const row = action('sketchIt').parentElement;
		expect(row.querySelector('.anyink-empty-overlay__key').textContent).toBe('L');
		expect(overlay().textContent).toContain(word('sketch.door.sketchItLine'));
		expect(action('usePhoto').classList.contains('anyink-outlined')).toBe(true);
		expect(action('drawBrush')).toBeNull();
		expect(action('drawPoints')).toBeNull();
		expect(overlay().textContent).toContain(word('letter.overlay.dropHere'));
	});

	it('the outline door is a quiet link with its picture', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		const outline = link('outline');
		expect(outline.textContent).toBe(word('sketch.door.outline'));
		expect(outline.classList.contains('anyink-primary')).toBe(false);
		expect(outline.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
	});

	it('More ways is shut until pressed, then holds the Brush and How', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		const more = link('more');
		const fold = overlay().querySelector('[data-anyink-overlay-more]');
		expect(more.getAttribute('aria-expanded')).toBe('false');
		expect(fold.hidden).toBe(true);
		more.click();
		expect(fold.hidden).toBe(false);
		expect(more.getAttribute('aria-expanded')).toBe('true');
		expect(fold.querySelector('[data-anyink-overlay-link="brush"]').textContent).toBe(
			word('sketch.door.brush')
		);
		expect(fold.querySelector('[data-anyink-overlay-link="how"]').textContent).toBe(
			word('letter.overlay.how')
		);
		// the Brush from the fold is his own pick: the box steps aside
		fold.querySelector('[data-anyink-overlay-link="brush"]').click();
		expect(editor.selectedTool).toBe('nib');
		expect(shown()).toBe(false);
	});

	it('[Sketch it] picks the Line with the way Centerline; the box steps aside', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		action('sketchIt').click();
		expect(editor.selectedTool).toBe('sketchLine');
		expect(sketchOf(editor.selectedGlyph).way).toBe('center');
		expect(shown()).toBe(false);
	});

	it('the outline link picks the Line with the way Outline', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		link('outline').click();
		expect(editor.selectedTool).toBe('sketchLine');
		const sketch = sketchOf(editor.selectedGlyph);
		expect(sketch.way).toBe('outline');
		expect(sketch.pieces).toEqual([]);
		expect(sketch.thickness).toBeGreaterThan(0);
	});

	it('the Line the letter opened with keeps the box; a piece open puts it away', () => {
		const editor = openB();
		document.body.appendChild(makeEmptyOverlay(editor));
		pickOpeningTool(editor, 'sketchLine', (tool) => (editor.selectedTool = tool));
		editor.publish('whichToolIsSelected', 'sketchLine');
		expect(shown()).toBe(true);
		const piece = { pointCount: () => 1, removeLastPoint() {}, cancel() {}, finish() {} };
		setOpenPiece(piece);
		expect(overlayShows(editor)).toBe(false);
		expect(shown()).toBe(false);
		clearOpenPiece(piece);
		expect(shown()).toBe(true);
	});

	it('guard, the flag off: the Brush button, no sketch door', () => {
		const editor = openB({ sketch: false });
		document.body.appendChild(makeEmptyOverlay(editor));
		expect(greens()).toEqual([word('letter.overlay.usePhoto')]);
		expect(action('drawBrush')).not.toBeNull();
		expect(action('sketchIt')).toBeNull();
		expect(link('outline')).toBeNull();
		expect(link('more')).toBeNull();
		expect(link('how')).not.toBeNull();
	});
});

describe("the letter's way, chosen at the door", () => {
	it('a letter with pieces keeps its way; a newer or set-aside sketch is left alone', () => {
		const editor = openB();
		const item = editor.selectedGlyph;
		const sketch = newSketch({ way: 'center', thickness: 99 });
		const a = addPoint(sketch, { x: 0, y: 0 });
		const b = addPoint(sketch, { x: 0, y: 500 });
		addPiece(sketch, { parts: [{ type: 'line', from: a, to: b }] });
		setSketch(item, sketch);
		expect(setDoorWay(item, 'outline', editor.project)).toBe(false);
		expect(sketchOf(item).way).toBe('center');
		setSketch(item, { ...newSketch(), setAside: true });
		expect(setDoorWay(item, 'outline', editor.project)).toBe(false);
		expect(setDoorWay(item, 'sideways', editor.project)).toBe(false);
	});

	it('an empty sketch changes its way; no record: nothing to set, the Line still picked', () => {
		const editor = openB();
		setSketch(editor.selectedGlyph, newSketch({ way: 'outline' }));
		expect(setDoorWay(editor.selectedGlyph, 'center', editor.project)).toBe(true);
		expect(sketchOf(editor.selectedGlyph).way).toBe('center');
		const picked = [];
		editor.selectedGlyphID = '';
		expect(openSketchDoor(editor, 'outline', { pick: (tool) => picked.push(tool) })).toBe(true);
		expect(picked).toEqual(['sketchLine']);
	});
});

scanSimpleScreen(
	"S3: the empty letter's sketch door, More ways open",
	() => {
		setFeaturesForTests({ letterView: true, sketch: true });
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		editor.selectedTool = 'resize';
		const box = makeEmptyOverlay(editor);
		document.body.appendChild(box);
		box.querySelector('[data-anyink-overlay-link="more"]').click();
		return box;
	},
	{ strict: true }
);
