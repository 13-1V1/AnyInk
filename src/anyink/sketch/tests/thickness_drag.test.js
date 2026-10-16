// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 Thickness drag (docs/SKETCH.md section 3 "While dragging"): the real sweep drawn at most once
	an animation frame, a narrow topic per tick, nothing in the font changed until the release, ONE
	step on release, Esc records nothing; the see-through layer paints the paper over the old ink
	then the new ink.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sketchOf } from '../model.js';
import { THICKNESS_TOPIC, makeThicknessLayer, startThicknessDrag } from '../thickness_drag.js';
import { resetThicknessAllForTests, thicknessOffer } from '../thickness_all.js';
import { N_ID, R_ID, sketchedEditor, stemWidth } from './thickness_fixture.js';

/** A frame queue the test runs by hand */
function frames() {
	const queue = [];
	return {
		frame: (fn) => queue.push(fn),
		cancelFrame: vi.fn(),
		run() {
			const now = queue.splice(0);
			now.forEach((fn) => fn());
			return now.length;
		},
	};
}

function fakeOverlay() {
	return { draw: vi.fn(), clear: vi.fn(), clearAfterRedraw: vi.fn() };
}

/** The stem's width: the outline points left of the arch and below its join (the round foot) */
function spanX(outlines) {
	const xs = outlines
		.flat()
		.filter(([x, y]) => y < 700 && x < 300)
		.map(([x]) => x);
	return Math.max(...xs) - Math.min(...xs);
}

beforeEach(() => {
	setModeForTests('simple');
	setFeaturesForTests({ sketch: true });
	resetThicknessAllForTests();
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('dragging the Thickness slider', () => {
	it('draws once a frame however many moves come, and says so on its narrow topic', () => {
		const editor = sketchedEditor();
		const told = [];
		editor.subscribe({
			topic: THICKNESS_TOPIC,
			subscriberID: 'test.thickness.drag',
			callback: (data) => told.push(data),
		});
		const queue = frames();
		const overlay = fakeOverlay();
		const drag = startThicknessDrag(editor, { overlay, ...queue });
		drag.move(120);
		drag.move(150);
		drag.move(180);
		expect(overlay.draw).not.toHaveBeenCalled();
		expect(queue.run()).toBe(1);
		expect(overlay.draw).toHaveBeenCalledTimes(1);
		expect(told).toEqual([{ itemId: N_ID, thickness: 180, dragging: true }]);
		drag.move(200);
		queue.run();
		expect(overlay.draw).toHaveBeenCalledTimes(2);
		expect(told.at(-1)).toEqual({ itemId: N_ID, thickness: 200, dragging: true });
	});

	it('paints the paper over the ink as it is, then the real ink at the new thickness', () => {
		const editor = sketchedEditor();
		const queue = frames();
		const overlay = fakeOverlay();
		const drag = startThicknessDrag(editor, { overlay, ...queue });
		drag.move(200);
		queue.run();
		const [cover, ink, view] = overlay.draw.mock.calls[0];
		expect(spanX(cover)).toBeGreaterThan(97);
		expect(spanX(cover)).toBeLessThan(102);
		expect(spanX(ink)).toBeGreaterThan(197);
		expect(spanX(ink)).toBeLessThan(203);
		expect(view).toEqual({ ...editor.view });
	});

	it('changes nothing in the font while dragging; the release is ONE step', () => {
		const editor = sketchedEditor();
		const item = editor.project.getItem(N_ID);
		const before = JSON.stringify(item.save());
		const steps = editor.history.queue.length;
		const queue = frames();
		const overlay = fakeOverlay();
		const drag = startThicknessDrag(editor, { overlay, ...queue });
		for (let value = 100; value <= 200; value += 10) {
			drag.move(value);
			queue.run();
		}
		expect(JSON.stringify(item.save())).toBe(before);
		expect(editor.history.queue.length).toBe(steps);
		expect(editor.project.settings.anyink?.sketchThickness ?? null).toBe(null);
		expect(drag.end(200)).toBe(true);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(sketchOf(item).thickness).toBe(200);
		expect(stemWidth(item)).toBeGreaterThan(197);
		expect(overlay.clearAfterRedraw).toHaveBeenCalledTimes(1);
		// a frame still queued draws nothing after the release
		drag.move(120);
		queue.run();
		expect(overlay.draw).toHaveBeenCalledTimes(11);
	});

	it('Esc (cancel) records nothing and clears the picture; the topic says where it went back to', () => {
		const editor = sketchedEditor();
		const told = [];
		editor.subscribe({
			topic: THICKNESS_TOPIC,
			subscriberID: 'test.thickness.cancel',
			callback: (data) => told.push(data),
		});
		const steps = editor.history.queue.length;
		const queue = frames();
		const overlay = fakeOverlay();
		const drag = startThicknessDrag(editor, { overlay, ...queue });
		drag.move(180);
		drag.cancel();
		expect(queue.run()).toBe(1);
		expect(overlay.draw).not.toHaveBeenCalled();
		expect(overlay.clear).toHaveBeenCalled();
		expect(editor.history.queue.length).toBe(steps);
		expect(told.at(-1)).toEqual({ itemId: N_ID, thickness: 99, dragging: false });
	});

	it('let go where it started: no step', () => {
		const editor = sketchedEditor();
		const steps = editor.history.queue.length;
		const drag = startThicknessDrag(editor, { overlay: fakeOverlay(), ...frames() });
		drag.move(150);
		expect(drag.end(99)).toBe(false);
		expect(editor.history.queue.length).toBe(steps);
	});

	it('the release offers the thickness to the other sketched letters when they differ', () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99, [R_ID]: 99 } });
		const drag = startThicknessDrag(editor, { overlay: fakeOverlay(), ...frames() });
		drag.end(150);
		expect(thicknessOffer(editor)).toEqual({ count: 2, thickness: 150, itemId: N_ID });
	});

	it('no sketch on the open letter: no drag', () => {
		const editor = sketchedEditor({ letters: {} });
		expect(startThicknessDrag(editor, { overlay: fakeOverlay() })).toBe(null);
	});
});

describe('the see-through layer over the edit canvas', () => {
	it('sits beside the canvas, takes no pointer, and paints with the paper and ink tokens', () => {
		const host = document.createElement('div');
		const canvas = document.createElement('canvas');
		canvas.width = 400;
		canvas.height = 300;
		host.appendChild(canvas);
		document.body.appendChild(host);
		const layer = makeThicknessLayer(canvas);
		layer.draw(
			[
				[
					[0, 0],
					[10, 0],
					[10, 10],
				],
			],
			[
				[
					[0, 0],
					[20, 0],
					[20, 20],
				],
			],
			{ dx: 0, dy: 300, dz: 1 }
		);
		const made = host.querySelector('canvas.anyink-sketch-thickness-layer');
		expect(made).not.toBeNull();
		expect(made.style.pointerEvents).toBe('none');
		expect(made.getAttribute('aria-hidden')).toBe('true');
		expect(made.width).toBe(400);
		layer.remove();
		expect(host.querySelector('canvas.anyink-sketch-thickness-layer')).toBeNull();
	});
});
