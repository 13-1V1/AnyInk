// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 fix (hostile finding "brush cost grows with stroke length"): every frame used to fit
	the whole stroke's skeleton again (125 ms a frame late in a 44-second stroke) and the release
	fitted it once more. Now the skeleton is built as the samples come in (skeleton.js
	makeSkeletonBuilder): the settled front of it is frozen and only the tail is fitted again.
	  - a frame refits a bounded number of samples however long the stroke grows
	  - frozen curves never change while the stroke goes on
	  - built frame by frame or all at once, it is the same skeleton, so the picture he sees, the
	    ink he gets and makeSkeleton on the same samples agree
	  - where a frozen part meets the next the line carries straight on (no kink)
	  - through the Brush: the picture as the overlay held it at release (kept layer plus tail)
	    matches the ink within 2 % of the nib, and the stroke is inked from that skeleton
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { resetBrushForTests, setBrushShare } from '../brush_size.js';
import { sub, turnAt } from '../geometry.js';
import { flattenContour, outlineGap } from '../match.js';
import { lastStrokeForChecks, makeNibTool } from '../nib_tool.js';
import { CORNER_TURN, FREEZE_SAMPLES, makeSkeleton, makeSkeletonBuilder } from '../skeleton.js';
import { strokeRecords } from '../stroke_record.js';
import { makeStrokeFilter } from '../filter.js';
import { arc, asMouse } from './strokes.js';

const SIZE = 99;
const DZ = 0.4;
const PIXEL = 1 / DZ;

/** Loops in a row, like a run of cursive l's, font units */
function loops(count, r = 150) {
	const points = [];
	for (let i = 0; i < count; i++) {
		points.push(...arc(i * r * 1.2, 300, r, -90, 270, 3).slice(i ? 1 : 0));
	}
	return points;
}

/** 15 slow loops (about 44 seconds of drawing at 120 samples a second) */
const LONG = asMouse(loops(15), { dz: DZ, speed: 150, jitter: 0.6 });

describe('the skeleton is built as the samples come in', () => {
	it('a frame refits a bounded number of samples, however long the stroke', () => {
		expect(LONG.length).toBeGreaterThan(4000);
		const builder = makeSkeletonBuilder({ size: SIZE, pixel: PIXEL });
		let most = 0;
		LONG.forEach((point) => {
			builder.add(point);
			most = Math.max(most, builder.tailSamples());
		});
		expect(builder.frozenCount()).toBeGreaterThan(20);
		expect(most).toBeLessThanOrEqual(2 * FREEZE_SAMPLES);
	});

	it('frozen curves never change while the stroke goes on', () => {
		const builder = makeSkeletonBuilder({ size: SIZE, pixel: PIXEL });
		let earlier = null;
		LONG.forEach((point, i) => {
			builder.add(point);
			if (i === 1500) earlier = builder.frozenSince(0);
		});
		expect(earlier.length).toBeGreaterThan(3);
		expect(builder.frozenSince(0).slice(0, earlier.length)).toEqual(earlier);
	});

	it('frame by frame or all at once, it is the same skeleton', () => {
		const builder = makeSkeletonBuilder({ size: SIZE, pixel: PIXEL });
		LONG.forEach((point, i) => {
			builder.add(point);
			// a frame now and then, as the Brush draws them
			if (i % 2 === 0) builder.curves();
		});
		expect(builder.finish()).toEqual(makeSkeleton(LONG, { size: SIZE, pixel: PIXEL }));
	});

	// B8 + B9 finalize (second hostile pass): a pen resting mid-stroke keeps sending samples a
	// fraction of a pixel apart; the tail never froze and each frame smoothed thousands of them
	// (78 ms frames after 10 s at 240 Hz, 214 ms after 20 s)
	it('a pen held still mid-stroke for 20 s: the tail stays short, so every frame stays cheap', () => {
		const filter = makeStrokeFilter();
		const rate = 240;
		const out = [];
		let t = 0;
		const send = (x, y) => {
			const p = filter.push(x, y, t);
			out.push([p.x / DZ, p.y / DZ]);
			t += 1 / rate;
		};
		for (let i = 0; i <= 100; i++) send(100 + i, 200);
		for (let i = 0; i < 20 * rate; i++)
			send(200 + 0.2 * Math.sin(i * 1.3), 200 + 0.2 * Math.cos(i * 0.7));
		for (let i = 1; i <= 100; i++) send(200, 200 + i);
		const builder = makeSkeletonBuilder({ size: SIZE, pixel: PIXEL });
		let most = 0;
		out.forEach((point) => {
			builder.add(point);
			most = Math.max(most, builder.tailSamples());
		});
		expect(most).toBeLessThanOrEqual(2 * FREEZE_SAMPLES);
		const skeleton = builder.finish();
		expect(skeleton.at(-1)[3]).toEqual(out.at(-1).map(Math.round));
	});

	it('a press held a long time that wanders less than a unit is still a dot', () => {
		const held = Array.from({ length: 400 }, (_, i) => [
			300 + 0.4 * Math.sin(i * 1.7) + 0.3 * Math.cos(i * 0.9),
			300 + 0.4 * Math.cos(i * 1.3),
		]);
		const skeleton = makeSkeleton(held, { size: SIZE, pixel: PIXEL });
		expect(skeleton).toHaveLength(1);
		expect(new Set(skeleton[0].map(String)).size).toBe(1);
		expect(skeleton[0][0]).toEqual([300, 300]);
	});

	it('where one frozen part meets the next, the line carries straight on', () => {
		const skeleton = makeSkeleton(LONG, { size: SIZE, pixel: PIXEL });
		let kinks = 0;
		skeleton.slice(1).forEach((curve, i) => {
			const before = skeleton[i];
			const out = sub(before[3], before[2]);
			const into = sub(curve[1], curve[0]);
			if (!(Math.hypot(...out) > 3 && Math.hypot(...into) > 3)) return;
			const turn = Math.abs(turnAt([0, 0], out, [out[0] + into[0], out[1] + into[1]]));
			if (turn > 12 && turn < CORNER_TURN) kinks += 1;
		});
		expect(kinks).toBe(0);
	});
});

describe('through the Brush', () => {
	let editor;
	let canvas;
	let tool;
	let clock = 1000;

	const event = (type, [x, y]) => {
		clock += 8;
		return {
			type,
			pointerId: 1,
			pointerType: 'mouse',
			isPrimary: true,
			button: type === 'pointermove' ? -1 : 0,
			buttons: type === 'pointerup' ? 0 : 1,
			clientX: editor.view.dx + x * editor.view.dz,
			clientY: editor.view.dy - y * editor.view.dz,
			timeStamp: clock,
			preventDefault: () => {},
		};
	};

	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
		document.body.innerHTML = '';
		resetToastsForTests();
		resetBrushForTests();
		setModeForTests('simple');
		setFeaturesForTests({ brush: true });
		editor = twoLetterEditor();
		showItem(editor, B);
		editor.view = { dx: 300, dy: 700, dz: DZ };
		editor.editCanvas = { redraw: () => {} };
		editor.selectedTool = 'nib';
		canvas = document.createElement('canvas');
		document.body.appendChild(canvas);
		tool = makeNibTool(canvas, { getEditor: () => editor });
	});
	afterEach(() => {
		vi.restoreAllMocks();
		resetToastsForTests();
		document.body.innerHTML = '';
	});

	it('a long stroke: the picture at release matches the ink, inked from that skeleton', () => {
		setBrushShare(0.2); // a 100-unit nib, so 2 % is well above whole-unit rounding
		const path = loops(4, 120).map(([x, y]) => [x / 2, y / 2]);
		const frames = [];
		globalThis.requestAnimationFrame = (callback) => frames.push(callback);
		tool.down(event('pointerdown', path[0]));
		path.slice(1).forEach((point, i) => {
			tool.move(event('pointermove', point));
			if (i % 2) frames.splice(0).forEach((callback) => callback());
		});
		const result = tool.up(event('pointerup', path.at(-1)));
		delete globalThis.requestAnimationFrame;
		expect(result).not.toBe(null);
		const last = lastStrokeForChecks();
		expect(last.size).toBe(100);
		expect(last.frames).toBeGreaterThan(50);
		expect(last.frozenCurves).toBeGreaterThan(0);
		// the stroke was long enough to freeze, and was inked from the skeleton built while drawing
		expect(strokeRecords(editor.selectedItem)[0].skeleton).toEqual(last.skeleton);
		expect(last.skeleton).toEqual(makeSkeleton(last.samples, { size: last.size, pixel: PIXEL }));
		const ink = result.ink.contours.map((contour) => flattenContour(contour.segments, 0.1));
		expect(outlineGap(last.preview, ink)).toBeLessThanOrEqual(0.02 * last.size);
	});
});
