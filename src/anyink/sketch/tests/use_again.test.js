// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize (door-coach verifier): a press of V and a drag on built ink set the sketch aside,
	and the card then had no Thickness and no way back, while the old purple lines were still
	drawn as if live and a new piece went into the set-aside sketch, where it never made ink.
	Now: the card says the sketch is set aside and offers [Use the sketch again] (one step: the
	ink built from the sketch again, his changes to its shapes gone; Undo puts it back), the draw
	layer leaves a set-aside sketch out, and a sketch tool starts a new sketch on that letter.
	Written to fail first (use_again.js did not exist; the card returned nothing).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { makeSketchSection, sketchCardState } from '../card_section.js';
import { sketchOf } from '../model.js';
import { builtMatches, isBuiltShape } from '../sketch_record.js';
import { sketchPicture, storedSketchShows } from '../tools/draw_layer.js';
import { SketchTool } from '../tools/line.js';
import { canUseAgain, useSketchAgain } from '../use_again.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';

const N = glyphIdOf('n');
const saved = (item) => JSON.stringify(item.shapes.map((shape) => shape.save()));

/** small n sketched and built, then a built point dragged: the sketch set aside */
function setAsideN() {
	const editor = openSketchFont({ n: storedSketch('n') });
	showItem(editor, N);
	editor.history.addState('sketched a line on small n');
	const built = saved(editor.selectedItem);
	editor.selectedItem.shapes[0].pathPoints[1].p.x += 45;
	editor.history.addState('Moved a point');
	expect(sketchOf(editor.selectedItem).setAside).toBe(true);
	return { editor, built };
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, checks: false, sketch: true });
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('the way back from a set-aside sketch', () => {
	it('the card says so and offers [Use the sketch again]', () => {
		const { editor } = setAsideN();
		const state = sketchCardState(editor);
		expect(state).toMatchObject({ setAside: true });
		const section = makeSketchSection(state, editor);
		expect(section.querySelector('.anyink-sketch-card__quiet').textContent).toBe(
			'The sketch is set aside. The shapes are your own now.'
		);
		expect(section.querySelector('[data-anyink-sketch="useAgain"]').textContent).toBe(
			'Use the sketch again'
		);
		expect(section.querySelector('.anyink-sketch-thickness__slider')).toBe(null);
	});

	it('pressing it is ONE step: the sketch live, its own ink back; Undo sets it aside again', () => {
		const { editor, built } = setAsideN();
		const changed = saved(editor.selectedItem);
		const steps = editor.history.queue.length;
		const section = makeSketchSection(sketchCardState(editor), editor);
		document.body.append(section);
		section.querySelector('[data-anyink-sketch="useAgain"]').click();
		const n = editor.selectedItem;
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe("used small n's sketch again");
		expect(sketchOf(n).setAside).toBe(false);
		expect(builtMatches(n)).toBe(true);
		expect(saved(n)).toBe(built);
		expect(n.shapes.every(isBuiltShape)).toBe(true);
		editor.history.restoreState();
		expect(sketchOf(editor.selectedItem).setAside).toBe(true);
		expect(saved(editor.selectedItem)).toBe(changed);
	});

	it('nothing to take back: a live sketch, or none', () => {
		const editor = openSketchFont({ n: storedSketch('n') });
		showItem(editor, N);
		editor.history.addState('sketched a line on small n');
		expect(canUseAgain(editor.selectedItem)).toBe(false);
		expect(useSketchAgain(editor)).toBe(false);
	});
});

describe('a set-aside sketch is no longer drawn or drawn on', () => {
	it('the draw layer leaves it out', () => {
		const { editor } = setAsideN();
		editor.selectedTool = 'resize';
		expect(storedSketchShows(editor, editor.selectedItem, { isOn: () => true })).toBe(false);
		const picture = sketchPicture(editor.selectedItem, editor.project, {});
		expect(picture.pieces).toEqual([]);
	});

	it('a sketch tool starts a new sketch on that letter', () => {
		const { editor } = setAsideN();
		const tool = new SketchTool({ getSketch: () => sketchOf(editor.selectedItem) }, 'line');
		expect(tool.storedSketch()).toBe(null);
	});
});
