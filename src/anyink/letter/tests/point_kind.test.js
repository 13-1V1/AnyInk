// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 point kind (UX-BEGINNER.md 4.3 Fine-tune "This point", 2.1 "smooth / corner", 2.4 C): the
// card's [Smooth] [Corner] buttons for the one picked point. Smooth is Glyphr Studio's 'flat' (the
// handles in one line; "smooth (even)" stays a More tools word), and both buttons write whole
// numbers (principle 5) and one Undo step in plain words.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { historyText } from '../../words/history_text.js';
import { word } from '../../words/words.js';
import {
	makePointCorner,
	makePointSmooth,
	pickedPoint,
	pointKind,
	POINT_KINDS,
	pointKindWords,
	setPickedPointKind,
	setPointKind,
} from '../point_kind.js';
import { box, letterWith } from './auto_hole_shapes.js';

/** A box's points, clockwise from the top left: (0,600) (600,600) (600,0) (0,0) */
function boxPoints() {
	const { shapes } = letterWith(box(0, 0, 600, 600));
	return shapes[0].pathPoints;
}

const isWhole = (point) =>
	[point.p.x, point.p.y, point.h1.x, point.h1.y, point.h2.x, point.h2.y].every(Number.isInteger);

/** Cross product of (h1 - p) and (h2 - p): 0 when the handles are in one line through p */
const bend = (point) =>
	(point.h1.x - point.p.x) * (point.h2.y - point.p.y) -
	(point.h1.y - point.p.y) * (point.h2.x - point.p.x);

describe('what kind a point is', () => {
	it('symmetric and flat points are smooth; corner points are corners', () => {
		const [a, b, c] = boxPoints();
		a.type = 'corner';
		expect(pointKind(a)).toBe('corner');
		b.makeFlat();
		expect(pointKind(b)).toBe('smooth');
		c.makeSymmetric();
		expect(pointKind(c)).toBe('smooth');
		expect(POINT_KINDS).toEqual(['smooth', 'corner']);
	});

	it('the buttons say the house words, from the words file', () => {
		expect(pointKindWords('smooth')).toEqual({
			text: word('letterTools.point.smooth'),
			hint: expect.any(String),
		});
		expect(pointKindWords('smooth').text).toBe('Smooth');
		expect(pointKindWords('corner').text).toBe('Corner');
	});
});

describe('Smooth', () => {
	it('a sharp corner of a box gets two curve handles in one line, a third of the way to each neighbor, in whole numbers', () => {
		const points = boxPoints();
		const top = points[1]; // (600, 600); previous (0, 600), next (600, 0)
		expect(makePointSmooth(top)).toBe(true);
		expect(pointKind(top)).toBe('smooth');
		expect(top.type).toBe('flat');
		expect(top.h1.use && top.h2.use).toBe(true);
		expect(isWhole(top)).toBe(true);
		expect(Math.abs(bend(top))).toBeLessThan(600); // in one line, to within the rounding
		// along the line from the previous point to the next one
		expect(top.h1.x).toBeLessThan(600);
		expect(top.h1.y).toBeGreaterThan(600);
		expect(top.h2.x).toBeGreaterThan(600);
		expect(top.h2.y).toBeLessThan(600);
		expect(Math.hypot(top.h1.x - 600, top.h1.y - 600)).toBeCloseTo(200, -1);
		expect(Math.hypot(top.h2.x - 600, top.h2.y - 600)).toBeCloseTo(200, -1);
	});

	it('a corner whose handles bend is lined up, keeping each handle its length', () => {
		const [point] = boxPoints(); // (0, 600)
		point.h1.coord = { x: -100, y: 600 }; // pointing left
		point.h2.coord = { x: 0, y: 700 }; // pointing up: a right-angle bend
		expect(makePointSmooth(point)).toBe(true);
		expect(isWhole(point)).toBe(true);
		expect(Math.abs(bend(point))).toBeLessThan(150);
		expect(Math.hypot(point.h1.x - 0, point.h1.y - 600)).toBeCloseTo(100, -1);
		expect(Math.hypot(point.h2.x - 0, point.h2.y - 600)).toBeCloseTo(100, -1);
	});

	it('a point that is already smooth is left alone', () => {
		const [, point] = boxPoints();
		makePointSmooth(point);
		const before = JSON.stringify(point.save());
		expect(makePointSmooth(point)).toBe(false);
		expect(JSON.stringify(point.save())).toBe(before);
	});
});

describe('Corner', () => {
	it('a smooth point turns sharp: its curve handles go and it becomes a corner', () => {
		const [, point] = boxPoints();
		makePointSmooth(point);
		expect(makePointCorner(point)).toBe(true);
		expect(pointKind(point)).toBe('corner');
		expect(point.h1.use).toBe(false);
		expect(point.h2.use).toBe(false);
		expect(makePointCorner(point)).toBe(false); // already a corner
	});

	it('setPointKind picks by name and refuses anything else', () => {
		const [point] = boxPoints();
		expect(setPointKind(point, 'smooth')).toBe(true);
		expect(setPointKind(point, 'corner')).toBe(true);
		expect(setPointKind(point, 'symmetric')).toBe(false);
		expect(pointKind(point)).toBe('corner');
	});
});

describe('the picked point, in the app', () => {
	let editor;
	let warn;
	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		editor = twoLetterEditor();
		setModeForTests('simple');
		showItem(editor, B);
		editor.selectedItem.addOneShape(box(0, 0, 600, 600));
		editor.history.addState('Added path: Rectangle 1');
	});
	afterEach(() => {
		warn.mockRestore();
		setModeForTests('all');
	});

	const shape = () => editor.selectedItem.shapes[0];

	it('works only with exactly one point picked', () => {
		expect(pickedPoint(editor)).toBeNull();
		expect(setPickedPointKind(editor, 'smooth')).toBe(false);
		editor.multiSelect.points.select(shape().pathPoints[0]);
		editor.multiSelect.points.add(shape().pathPoints[1]);
		expect(pickedPoint(editor)).toBeNull();
		expect(setPickedPointKind(editor, 'smooth')).toBe(false);
		editor.multiSelect.points.clear();
		editor.multiSelect.points.select(shape().pathPoints[1]);
		expect(pickedPoint(editor)).toBe(shape().pathPoints[1]);
	});

	it('Smooth then Corner: one Undo step each, in plain words; Undo brings the corner back', () => {
		editor.multiSelect.points.select(shape().pathPoints[1]);
		const steps = editor.history.queue.length;
		expect(setPickedPointKind(editor, 'smooth')).toBe(true);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('made a point smooth');
		expect(historyText(editor.history.queue[0].title)).toBe('made a point smooth');
		expect(setPickedPointKind(editor, 'smooth')).toBe(false); // no change, no step
		expect(editor.history.queue.length).toBe(steps + 1);

		editor.history.restoreState();
		const point = editor.selectedItem.shapes[0].pathPoints[1];
		expect(pointKind(point)).toBe('corner');
		expect(point.h1.use).toBe(false);

		editor.multiSelect.points.select(point);
		setPickedPointKind(editor, 'smooth');
		expect(setPickedPointKind(editor, 'corner')).toBe(true);
		expect(editor.history.queue[0].title).toBe('made a point a corner');
	});
});
