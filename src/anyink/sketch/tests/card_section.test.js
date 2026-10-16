// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 card (docs/SKETCH.md sections 3, 5 and 7 "Card sections"): on a sketched letter in Simple
	with the 'sketch' flag on, Thickness sits alone right under the header with its readout in
	inches on 1 in capitals; dragging it is one step on release, Esc puts it back; Fine-tune opens
	on a sketched letter and starts with Sketch (the way, Ends Round / Flat, Use this thickness on
	all letters while another letter differs); built shapes get no Merge and no Solid / Hole.
	With the flag off, or in All tools, the card is as before. Strict banned-word scans.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	cardSections,
	fineTuneParts,
	letterCardState,
	makeLetterCard,
	resetLetterCardForTests,
	shapeOptions,
} from '../../letter/letter_card.js';
import {
	displayModeKey,
	makeViewSwitches,
	resetLetterViewForTests,
	setFineTuneOpen,
} from '../../letter/view_switches.js';
import { word } from '../../words/words.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import {
	KEY_PAUSE,
	setLetterEnds,
	showsSketchSection,
	sketchCardState,
} from '../card_section.js';
import { newSketch, setSketch, sketchOf } from '../model.js';
import { resetThicknessAllForTests } from '../thickness_all.js';
import { N_ID, R_ID, U_ID, sketchedEditor, stemWidth } from './thickness_fixture.js';

const q = (selector) => document.querySelector(selector);
const qa = (selector) => [...document.querySelectorAll(selector)];
const sections = () => qa('[data-anyink-card]').map((el) => el.dataset.anyinkCard);
const fine = () => qa('[data-anyink-fine]').map((el) => el.dataset.anyinkFine);

/** Simple, the letter view and the sketch on (checks off: the stored n is not a real font) */
function open(options = {}, flags = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, checks: false, sketch: true, ...flags });
	const editor = sketchedEditor(options);
	editor.selectedTool = 'resize';
	return editor;
}

function mount(editor) {
	const card = makeLetterCard(editor);
	document.body.appendChild(card);
	return card;
}

beforeEach(() => {
	resetLetterCardForTests();
	resetLetterViewForTests();
	resetThicknessAllForTests();
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('what the sketch parts of the card show', () => {
	it('a sketched letter: Thickness right under the header, with its readout', () => {
		const editor = open();
		const state = sketchCardState(editor);
		expect(state).toMatchObject({
			itemId: N_ID,
			way: 'center',
			pieces: true,
			centerline: true,
			openEnds: true,
			thickness: 99,
			readout: '0.07 in wide on 1 in capitals',
			ends: 'round',
			newer: false,
			others: 0,
		});
		expect(showsSketchSection(state)).toBe(true);
		mount(editor);
		// S3 fix: no [Draw over it] on a sketched letter, so no main buttons (letter_card.js)
		expect(sections()).toEqual(['header', 'sketch', 'fineTune']);
		expect(q('[data-anyink-sketch="readout"]').textContent).toBe('0.07 in wide on 1 in capitals');
		expect(q('[data-anyink-sketch="readout"]').title).toBe(
			'How wide the stroke is when the capitals are 1 inch tall.'
		);
		const slider = q('.anyink-sketch-thickness__slider');
		expect(slider.value).toBe('99');
		expect(slider.min).toBe(String(Math.round(0.03 * 1100)));
		expect(slider.max).toBe(String(Math.round(0.24 * 1100)));
		// never typed: no number field on the card
		expect(qa('input[type="number"], input[type="text"]')).toEqual([]);
	});

	it('flag off, All tools, or a letter with no sketch: the card is as before', () => {
		const off = open({}, { sketch: false });
		expect(sketchCardState(off)).toBe(null);
		mount(off);
		expect(sections()).not.toContain('sketch');
		expect(qa('[data-anyink-sketch]')).toEqual([]);
		document.body.innerHTML = '';

		const all = open();
		setModeForTests('all');
		expect(sketchCardState(all)).toBe(null);
		setModeForTests('simple');

		const plain = open({ letters: {}, open: U_ID });
		expect(sketchCardState(plain)).toBe(null);
		expect(cardSections(letterCardState(plain))).toEqual(['header']);
	});

	it('an Outline-only letter: no Thickness on top; Fine-tune names its way', () => {
		const editor = open();
		const sketch = sketchOf(editor.project.getItem(N_ID));
		sketch.way = 'outline';
		sketch.pieces = sketch.pieces.map((piece) => ({ ...piece, use: 'outline' }));
		const state = sketchCardState(editor);
		expect(state.centerline).toBe(false);
		expect(showsSketchSection(state)).toBe(false);
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(sections()).not.toContain('sketch');
		expect(fine()[0]).toBe('sketch');
		expect(q('[data-anyink-sketch="way"]').textContent).toBe(word('sketch.card.wayOutline'));
		expect(qa('[data-anyink-ends]')).toEqual([]);
	});

	it('a sketch from a newer ANY-INK shows its quiet line, never a slider', () => {
		const editor = open();
		sketchOf(editor.project.getItem(N_ID)).v = 9;
		mount(editor);
		expect(sections()).toContain('sketch');
		expect(q('.anyink-sketch-card__quiet').textContent).toBe(word('sketch.card.newer'));
		expect(q('.anyink-sketch-thickness__slider')).toBeNull();
	});

	it('a set-aside sketch: no Thickness, only its quiet line and the way back (S3 finalize)', () => {
		const editor = open();
		sketchOf(editor.project.getItem(N_ID)).setAside = true;
		const state = sketchCardState(editor);
		expect(state).toMatchObject({ setAside: true });
		expect(state.centerline).toBeUndefined();
		mount(editor);
		expect(q('.anyink-sketch-thickness__slider')).toBe(null);
		expect(q('[data-anyink-sketch="useAgain"]')).not.toBe(null);
	});

	it('a sketched letter with no ink yet still opens Fine-tune, Sketch first, no empty Shapes', () => {
		const editor = open({ letters: {}, open: U_ID });
		const sketch = newSketch({ thickness: 99 });
		sketch.points = {
			a: { x: 100, y: 100, kind: 'corner' },
			b: { x: 400, y: 100, kind: 'corner' },
		};
		sketch.way = 'outline';
		sketch.pieces = [
			{
				id: 1,
				key: 'pc_1',
				use: 'outline',
				closed: false,
				parts: [{ type: 'line', from: 'a', to: 'b' }],
			},
		];
		setSketch(editor.project.getItem(U_ID), sketch);
		const state = letterCardState(editor);
		expect(state.status).toBe('empty');
		expect(cardSections(state)).toEqual(['header', 'fineTune']);
		expect(fineTuneParts({ ...state, fineTuneOpen: true })).toEqual([
			'sketch',
			'spacing',
			'moreTools',
		]);
	});
});

describe('the Thickness slider on the card', () => {
	it('a drag shows the readout as it goes and records ONE step on release', () => {
		const editor = open();
		mount(editor);
		const steps = editor.history.queue.length;
		const slider = q('.anyink-sketch-thickness__slider');
		slider.dispatchEvent(new Event('pointerdown'));
		for (const value of [120, 150, 180]) {
			slider.value = String(value);
			slider.dispatchEvent(new Event('input'));
		}
		expect(q('[data-anyink-sketch="readout"]').textContent).toBe(
			`${(180 / 1480).toFixed(2)} in wide on 1 in capitals`
		);
		expect(editor.history.queue.length).toBe(steps);
		slider.dispatchEvent(new Event('change'));
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('changed the thickness of small n');
		const item = editor.project.getItem(N_ID);
		expect(sketchOf(item).thickness).toBe(180);
		expect(stemWidth(item)).toBeGreaterThan(177);
		expect(editor.project.settings.anyink.sketchThickness).toBe(180);
	});

	it('Esc while dragging puts the slider and the readout back and records nothing', () => {
		const editor = open();
		mount(editor);
		const steps = editor.history.queue.length;
		const slider = q('.anyink-sketch-thickness__slider');
		slider.dispatchEvent(new Event('pointerdown'));
		slider.value = '170';
		slider.dispatchEvent(new Event('input'));
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(slider.value).toBe('99');
		expect(q('[data-anyink-sketch="readout"]').textContent).toBe('0.07 in wide on 1 in capitals');
		// the browser's change after a put-back starts no step either
		slider.dispatchEvent(new Event('change'));
		expect(editor.history.queue.length).toBe(steps);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(99);
	});
});

// S3 fix (thickness-card): in Chrome each arrow key on a range input fires input then change, and
// each change was its own step (99 -> 147 by keyboard: 48 steps, a quarter of the 200 cap). And
// Esc stopped only the preview: the mouse still held the thumb, the next input started a new drag
// and the release recorded a step.
describe('the Thickness slider by keyboard, and after Esc', () => {
	/** Chrome's events for one arrow key press on a range input */
	function arrow(slider, key = 'ArrowRight') {
		slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		slider.value = String(Number(slider.value) + (key === 'ArrowRight' ? 1 : -1));
		slider.dispatchEvent(new Event('input'));
		slider.dispatchEvent(new Event('change'));
	}

	afterEach(() => vi.useRealTimers());

	it('held arrow keys are ONE step, recorded after a short pause', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const editor = open();
		mount(editor);
		const steps = editor.history.queue.length;
		const slider = q('.anyink-sketch-thickness__slider');
		slider.focus();
		for (let i = 0; i < 48; i++) arrow(slider);
		expect(editor.history.queue.length).toBe(steps);
		expect(q('[data-anyink-sketch="readout"]').textContent).toBe(
			`${(147 / 1480).toFixed(2)} in wide on 1 in capitals`
		);
		vi.advanceTimersByTime(KEY_PAUSE + 10);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(147);
	});

	it('leaving the slider records the burst at once; a second burst is a second step', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const editor = open();
		mount(editor);
		const steps = editor.history.queue.length;
		let slider = q('.anyink-sketch-thickness__slider');
		for (let i = 0; i < 5; i++) arrow(slider);
		slider.dispatchEvent(new Event('blur'));
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(104);
		vi.advanceTimersByTime(KEY_PAUSE + 10);
		expect(editor.history.queue.length).toBe(steps + 1);
		document.body.innerHTML = '';
		mount(editor);
		slider = q('.anyink-sketch-thickness__slider');
		for (let i = 0; i < 3; i++) arrow(slider, 'ArrowLeft');
		vi.advanceTimersByTime(KEY_PAUSE + 10);
		expect(editor.history.queue.length).toBe(steps + 2);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(101);
	});

	it('a burst left waiting never lands on another letter', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const editor = open({ letters: { [N_ID]: 99, [R_ID]: 99 } });
		mount(editor);
		const steps = editor.history.queue.length;
		const slider = q('.anyink-sketch-thickness__slider');
		for (let i = 0; i < 5; i++) arrow(slider);
		editor.selectedGlyphID = R_ID;
		vi.advanceTimersByTime(KEY_PAUSE + 10);
		expect(editor.history.queue.length).toBe(steps);
		expect(sketchOf(editor.project.getItem(R_ID)).thickness).toBe(99);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(99);
	});

	it("Esc mid-burst records nothing, and the burst's later change does not either", () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const editor = open();
		mount(editor);
		const steps = editor.history.queue.length;
		const slider = q('.anyink-sketch-thickness__slider');
		for (let i = 0; i < 5; i++) arrow(slider);
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(slider.value).toBe('99');
		vi.advanceTimersByTime(KEY_PAUSE + 10);
		expect(editor.history.queue.length).toBe(steps);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(99);
	});

	it('Esc, then the mouse still held and moved: the thumb stays put and the release records nothing', () => {
		const editor = open();
		mount(editor);
		const steps = editor.history.queue.length;
		const slider = q('.anyink-sketch-thickness__slider');
		slider.dispatchEvent(new Event('pointerdown'));
		slider.value = '170';
		slider.dispatchEvent(new Event('input'));
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		for (const value of [180, 200, 220]) {
			slider.value = String(value);
			slider.dispatchEvent(new Event('input'));
			expect(slider.value).toBe('99');
			expect(q('[data-anyink-sketch="readout"]').textContent).toBe('0.07 in wide on 1 in capitals');
		}
		slider.value = '220';
		slider.dispatchEvent(new Event('change'));
		expect(slider.value).toBe('99');
		expect(editor.history.queue.length).toBe(steps);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(99);
		// the next press is a drag again
		slider.dispatchEvent(new Event('pointerdown'));
		slider.value = '150';
		slider.dispatchEvent(new Event('input'));
		slider.dispatchEvent(new Event('change'));
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(sketchOf(editor.project.getItem(N_ID)).thickness).toBe(150);
	});
});

// S3 finalize (thickness-card verifier): Esc during a drag reached the sketch tool first (no
// data to tell it the slider was being dragged), and a recorded burst left the keyboard on the page
describe('the Thickness slider tells the key route it is being dragged, and keeps the keyboard', () => {
	afterEach(() => vi.useRealTimers());

	it('marked as dragged from the first move until the step or Esc', () => {
		const editor = open();
		mount(editor);
		const slider = q('.anyink-sketch-thickness__slider');
		slider.dispatchEvent(new Event('pointerdown'));
		expect(slider.dataset.anyinkDragging).toBeUndefined();
		slider.value = '150';
		slider.dispatchEvent(new Event('input'));
		expect(slider.dataset.anyinkDragging).toBe('true');
		slider.dispatchEvent(new Event('change'));
		expect(slider.dataset.anyinkDragging).toBeUndefined();
		slider.dispatchEvent(new Event('pointerdown'));
		slider.value = '170';
		slider.dispatchEvent(new Event('input'));
		expect(slider.dataset.anyinkDragging).toBe('true');
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(slider.dataset.anyinkDragging).toBeUndefined();
	});

	it('the card drawn again after a recorded burst puts the keyboard back on the slider', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] });
		const editor = open();
		mount(editor);
		const slider = q('.anyink-sketch-thickness__slider');
		slider.focus();
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		slider.value = '100';
		slider.dispatchEvent(new Event('input'));
		slider.dispatchEvent(new Event('change'));
		vi.advanceTimersByTime(KEY_PAUSE + 10);
		vi.advanceTimersByTime(50);
		// the step drew the card again: the old slider is gone, the new one has the keyboard
		expect(slider.isConnected).toBe(false);
		expect(document.activeElement).toBe(q('.anyink-sketch-thickness__slider'));
	});

	it("the slider's arrow keys never reach the app's key map (its nudge would take them)", () => {
		const editor = open();
		mount(editor);
		const slider = q('.anyink-sketch-thickness__slider');
		const heard = [];
		const listen = (event) => heard.push(event.key);
		document.addEventListener('keydown', listen);
		for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageUp']) {
			slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		}
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
		document.removeEventListener('keydown', listen);
		expect(heard).toEqual(['z']);
	});

	it('a card drawn with no burst behind it never takes the keyboard', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] });
		const editor = open();
		mount(editor);
		document.body.innerHTML = '';
		mount(editor);
		vi.advanceTimersByTime(50);
		expect(document.activeElement).toBe(document.body);
	});
});

describe('Fine-tune > Sketch', () => {
	it('Ends: Round / Flat for the letter, one step each, the pressed one shown', () => {
		const editor = open();
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(fine()).toEqual(['sketch', 'shapes', 'spacing', 'moreTools']);
		expect(q('[data-anyink-ends="round"]').getAttribute('aria-pressed')).toBe('true');
		const steps = editor.history.queue.length;
		q('[data-anyink-ends="flat"]').click();
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('made the ends flat on small n');
		expect(sketchOf(editor.project.getItem(N_ID)).ends).toBe('flat');
		expect(q('[data-anyink-ends="flat"]').getAttribute('aria-pressed')).toBe('true');
		// already flat: nothing
		expect(setLetterEnds(editor, 'flat')).toBe(false);
		expect(editor.history.queue.length).toBe(steps + 1);
		editor.history.restoreState();
		expect(sketchOf(editor.project.getItem(N_ID)).ends).toBe('round');
	});

	it('[Use this thickness on all letters] only while another sketched letter differs', async () => {
		const editor = open({ letters: { [N_ID]: 99, [R_ID]: 140 } });
		setFineTuneOpen(true, editor);
		mount(editor);
		const button = q('[data-anyink-action="thicknessOnAll"]');
		expect(button.textContent).toBe('Use this thickness on all letters');
		button.click();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(sketchOf(editor.project.getItem(R_ID)).thickness).toBe(99);
		expect(editor.history.queue[1].title).toBe('set the thickness for every sketched letter');
		document.body.innerHTML = '';
		resetLetterCardForTests();
		mount(editor);
		expect(q('[data-anyink-action="thicknessOnAll"]')).toBeNull();
	});

	it('Clear letter clears the sketch too, in the same step; Undo brings both back', () => {
		const editor = open();
		setFineTuneOpen(true, editor);
		mount(editor);
		q('[data-anyink-toggle="shapeOptions"]').click();
		const steps = editor.history.queue.length;
		q('[data-anyink-action="clear"]').click();
		const item = () => editor.project.getItem(N_ID);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(item().shapes).toEqual([]);
		expect(sketchOf(item())).toBe(null);
		editor.history.restoreState();
		expect(sketchOf(item()).pieces).toHaveLength(2);
		expect(sketchOf(item()).setAside).toBe(false);
		expect(item().shapes.length).toBeGreaterThan(0);
	});

	it('built shapes: never merged, no Solid / Hole switch', () => {
		const editor = open();
		const state = letterCardState(editor);
		expect(state.mergeable).toBe(0);
		expect(state.shapes.every((shape) => shape.fixed)).toBe(true);
		expect(shapeOptions(state)).not.toContain('merge');
	});
});

describe('See-through (Fine-tune\'s "Outline only", renamed with the sketch on)', () => {
	it('the switch says See-through with the flag on, Outline only with it off', () => {
		setFeaturesForTests({ sketch: true });
		expect(displayModeKey()).toBe('view.seeThrough');
		expect(word('view.seeThrough')).toBe('See-through');
		setFeaturesForTests({ sketch: false });
		expect(displayModeKey()).toBe('view.displayMode');
		expect(word('view.displayMode')).toBe('Outline only');
	});

	it('the switch on screen follows the flag; same switch, same state', () => {
		const editor = open();
		setFineTuneOpen(true, editor);
		const group = makeViewSwitches(editor);
		document.body.appendChild(group);
		const label = () =>
			q('[data-anyink-switch="outlineOnly"] .anyink-letter-switch__label').textContent;
		expect(label()).toBe('See-through');
		const filled = editor.project.settings.app.canvasDisplayModeFilled;
		q('[data-anyink-switch="outlineOnly"]').click();
		expect(editor.project.settings.app.canvasDisplayModeFilled).toBe(!filled);
		setFeaturesForTests({ sketch: false });
		q('[data-anyink-switch="outlineOnly"]').click();
		expect(label()).toBe('Outline only');
	});
});

describe('the sketch card says no banned word (strict)', () => {
	scanSimpleScreen(
		'a sketched n: Thickness on top, Fine-tune open with Sketch and its Ends',
		() => {
			const editor = open({ letters: { [N_ID]: 99, [R_ID]: 140 } });
			setFineTuneOpen(true, editor);
			const card = mount(editor);
			card.appendChild(makeViewSwitches(editor));
			expect(q('[data-anyink-sketch="thickness"]')).not.toBeNull();
			expect(q('[data-anyink-action="thicknessOnAll"]')).not.toBeNull();
			return card;
		}
	);

	scanSimpleScreen('an outline letter and the rebuilding pill', async () => {
		const editor = open({ letters: { [N_ID]: 99, [R_ID]: 140 } });
		const sketch = sketchOf(editor.project.getItem(N_ID));
		sketch.way = 'outline';
		setFineTuneOpen(true, editor);
		const card = mount(editor);
		const pill = document.createElement('div');
		pill.textContent = word('sketch.thickness.rebuilding');
		card.appendChild(pill);
		return card;
	});
});
