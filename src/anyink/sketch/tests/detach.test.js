// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 hash detach (docs/SKETCH.md section 7, D-047 point 1), through real History steps: the
	open letter's ink is rebuilt from its sketch inside every step; built shapes changed outside a
	follow plan (an edited point, a deleted shape) set the sketch aside inside that step instead
	of being rebuilt over, his changes kept; deleted built shapes never come back; Undo brings the
	sketch and its ink back; in Simple a toast says so with [Undo] (after the step is recorded, so
	[Undo] is that step), in All tools nothing is said.
	Checked to fail: with the hook's hash check taken out, the rebuild puts the edited and the
	deleted shapes back and the set-aside tests fail.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { detachIfChanged, isDetached } from '../detach.js';
import { sketchOf } from '../model.js';
import { builtMatches, isBuiltShape } from '../sketch_record.js';
import { word } from '../../words/words.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';

/** the Simple toast that says the sketch is set aside, if one shows */
function asideToast() {
	return [...document.querySelectorAll('#toast[data-anyink-toast="simple"]')].find(
		(element) =>
			!element.hasAttribute('data-leaving') &&
			element.querySelector('.anyink-toast__text')?.textContent ===
				word('sketch.toast.setAside', { letter: 'small n' })
	);
}

const N = glyphIdOf('n');
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

let warn;
beforeEach(() => {
	document.querySelectorAll('#toast').forEach((element) => element.remove());
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

/** small n sketched, its ink built by a first step */
function sketchedN() {
	const editor = openSketchFont({ n: storedSketch('n') });
	showItem(editor, N);
	editor.history.addState('sketched a line on small n');
	return editor;
}

describe('the rebuild inside every step', () => {
	it('the first step builds the ink, matched to its hash', () => {
		const editor = sketchedN();
		const n = editor.selectedItem;
		expect(n.shapes.length).toBeGreaterThanOrEqual(2);
		expect(n.shapes.every(isBuiltShape)).toBe(true);
		expect(builtMatches(n)).toBe(true);
		expect(sketchOf(n).setAside).toBe(false);
	});

	it('a sketch change in a step is ink in that same step; Undo brings the old ink back', () => {
		const editor = sketchedN();
		const before = JSON.stringify(editor.selectedItem.shapes.map((shape) => shape.save()));
		sketchOf(editor.selectedItem).points.rightFoot.x += 80;
		editor.history.addState('moved a sketch point on small n');
		const after = JSON.stringify(editor.selectedItem.shapes.map((shape) => shape.save()));
		expect(after).not.toBe(before);
		expect(builtMatches(editor.selectedItem)).toBe(true);
		editor.history.restoreState();
		expect(JSON.stringify(editor.selectedItem.shapes.map((shape) => shape.save()))).toBe(before);
		expect(builtMatches(editor.selectedItem)).toBe(true);
	});
});

describe('changed behind the sketch: set aside, never rebuilt over', () => {
	it('an edited built point: set aside in that step, the edit kept; Undo brings the sketch back', () => {
		const editor = sketchedN();
		const n = editor.selectedItem;
		n.shapes[0].pathPoints[1].p.x += 45;
		const edited = JSON.stringify(n.shapes.map((shape) => shape.save()));
		editor.history.addState('Moved a point');
		const now = editor.selectedItem;
		expect(sketchOf(now).setAside).toBe(true);
		expect(JSON.stringify(now.shapes.map((shape) => shape.save()))).toBe(edited);
		// later steps leave it alone too
		sketchOf(now).points.rightFoot.x += 80;
		editor.history.addState('another step');
		expect(JSON.stringify(editor.selectedItem.shapes.map((shape) => shape.save()))).toBe(edited);
		editor.history.restoreState();
		editor.history.restoreState();
		expect(sketchOf(editor.selectedItem).setAside).toBe(false);
		expect(builtMatches(editor.selectedItem)).toBe(true);
	});

	it('a deleted built shape never comes back', () => {
		const editor = sketchedN();
		const n = editor.selectedItem;
		const count = n.shapes.length;
		n.shapes.splice(0, 1);
		editor.history.addState('Deleted a shape');
		expect(sketchOf(editor.selectedItem).setAside).toBe(true);
		expect(editor.selectedItem.shapes).toHaveLength(count - 1);
		editor.history.addState('another step');
		expect(editor.selectedItem.shapes).toHaveLength(count - 1);
	});

	it('Simple with the flag on: the toast after the step, its [Undo] for that step', async () => {
		setModeForTests('simple');
		setFeaturesForTests({ sketch: true });
		const editor = sketchedN();
		editor.selectedItem.shapes[0].pathPoints[1].p.y += 30;
		editor.history.addState('Moved a point');
		expect(asideToast()).toBeUndefined(); // not before the step is recorded
		for (let tries = 0; tries < 40 && !asideToast(); tries++) await settle();
		const shown = asideToast();
		expect(shown).toBeTruthy();
		expect(shown.dataset.kind).toBe('destructive');
		shown.querySelector('.anyink-toast__action').click();
		expect(sketchOf(editor.project.getItem(N)).setAside).toBe(false);
		expect(builtMatches(editor.project.getItem(N))).toBe(true);
	});

	it('All tools: set aside quietly', async () => {
		setFeaturesForTests({ sketch: true });
		const editor = sketchedN();
		editor.selectedItem.shapes[0].pathPoints[1].p.y += 30;
		editor.history.addState('Moved a point');
		await settle();
		expect(sketchOf(editor.selectedItem).setAside).toBe(true);
		expect(asideToast()).toBeUndefined();
	});

	it('detachIfChanged and isDetached on their own', () => {
		const editor = sketchedN();
		const n = editor.selectedItem;
		expect(isDetached(n)).toBe(false);
		expect(detachIfChanged(n)).toBe(false);
		n.shapes[0].pathPoints[0].p.x -= 10;
		expect(isDetached(n)).toBe(true);
		expect(detachIfChanged(n, { say: false })).toBe(true);
		expect(sketchOf(n).setAside).toBe(true);
		expect(isDetached(n)).toBe(false);
	});
});
