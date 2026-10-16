// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix (thickness-card): a Circle drawn between two writing lines stays a circle at every
	thickness. Probe run3: an o drawn at 264 (r 449) slid to 33 had its top and bottom moved by
	the edge rule while its plumb sides stayed, 932 wide by 1161 tall, and the stored circle still
	said rx 449 / ry 449. Now the circle is solved again: center kept, rx = ry = the new half gap.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { edgeY } from '../edge_rule.js';
import { setSketch, sketchOf, thicknessRange } from '../model.js';
import { commitThickness, previewOutlines, withThickness } from '../thickness.js';
import { STORED_FONT } from './fixtures/stored_sketches.js';
import { N_ID, sketchedEditor } from './thickness_fixture.js';
import { rebuildItem } from '../build.js';

const project = { settings: { font: STORED_FONT, anyink: {} } };
const { min, max } = thicknessRange(project);

/** What circle_tool.js stores for a click on the writing line, then on the small-letter line */
function circleBetweenLines(thickness, { cx = 627, use = 'center' } = {}) {
	const pin = (on) => ({
		on,
		...(use === 'outline' ? {} : { inset: 'edge' }),
		kind: 'smooth',
		lock: 'level',
	});
	const top = pin('small');
	const bottom = pin('writing');
	const topY = edgeY(top, STORED_FONT, thickness);
	const bottomY = edgeY(bottom, STORED_FONT, thickness);
	const r = (topY - bottomY) / 2;
	const cy = (topY + bottomY) / 2;
	return {
		v: 1,
		build: 1,
		key: 'sk_circle_o',
		way: use,
		thickness,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points: {
			p1: { x: cx + r, y: cy, kind: 'smooth', lock: 'plumb' },
			p2: { x: cx, y: topY, ...top },
			p3: { x: cx - r, y: cy, kind: 'smooth', lock: 'plumb' },
			p4: { x: cx, y: bottomY, ...bottom },
		},
		pieces: [
			{
				id: 1,
				key: 'pc_o',
				use,
				closed: true,
				circle: { cx, cy, rx: r, ry: r },
				parts: [{ type: 'spline', points: ['p1', 'p2', 'p3', 'p4'] }],
			},
		],
		relations: [],
		setAside: false,
		at: 1760659200000,
	};
}

/** The box of the swept ink */
function inkBox(sketch, value) {
	const all = previewOutlines(sketch, project, value).flat();
	const xs = all.map(([x]) => x);
	const ys = all.map(([, y]) => y);
	return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function expectRound(sketch) {
	const { p1, p2, p3, p4 } = sketch.points;
	const circle = sketch.pieces[0].circle;
	expect(circle.rx).toBeCloseTo(circle.ry, 6);
	expect(p1.x - p3.x).toBeCloseTo(p2.y - p4.y, 6);
	expect(p1.x - circle.cx).toBeCloseTo(circle.rx, 6);
	expect(p2.y - circle.cy).toBeCloseTo(circle.ry, 6);
	expect(p1.y).toBeCloseTo(circle.cy, 6);
	expect(p3.y).toBeCloseTo(circle.cy, 6);
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	vi.restoreAllMocks();
});

describe('a circle between two lines stays a circle when the thickness changes', () => {
	it.each([
		[264, min],
		[264, 99],
		[99, max],
		[min, max],
	])('drawn at %i, set to %i: points, stored circle and ink are round', (from, to) => {
		const drawn = circleBetweenLines(from);
		const next = withThickness(drawn, project, to);
		expectRound(next);
		// the center is kept
		expect(next.pieces[0].circle.cx).toBe(drawn.pieces[0].circle.cx);
		// its ink edges still touch both lines
		const { w, h } = inkBox(next, to);
		expect(Math.abs(w - h)).toBeLessThanOrEqual(1);
		// and the sketch passed in is left as it was
		expectRound(drawn);
	});

	it('back at the thickness it was drawn at, it is the circle it was', () => {
		const drawn = circleBetweenLines(264);
		const there = withThickness(withThickness(drawn, project, min), project, 264);
		for (const id of ['p1', 'p2', 'p3', 'p4']) {
			expect(there.points[id].x).toBeCloseTo(drawn.points[id].x, 6);
			expect(there.points[id].y).toBeCloseTo(drawn.points[id].y, 6);
		}
	});

	it('the slider step on the open letter keeps it round (the real build)', () => {
		const editor = sketchedEditor({ letters: {} });
		const item = editor.project.getItem(N_ID);
		setSketch(item, circleBetweenLines(264));
		rebuildItem(item, { project: editor.project });
		editor.history.addState('sketched a circle');
		for (const value of [min, 99, max]) {
			commitThickness(editor, value);
			expectRound(sketchOf(item));
			const boxes = item.shapes.map((shape) => shape.maxes);
			const w = Math.max(...boxes.map((b) => b.xMax)) - Math.min(...boxes.map((b) => b.xMin));
			const h = Math.max(...boxes.map((b) => b.yMax)) - Math.min(...boxes.map((b) => b.yMin));
			// the build's refit wanders a unit or so from the swept outline (before the fix: 229)
			expect(Math.abs(w - h)).toBeLessThanOrEqual(2);
		}
	});

	it('an oval (Shift) between free points is left as it is', () => {
		const oval = circleBetweenLines(99);
		oval.pieces[0].circle = { cx: 627, cy: 550, rx: 300, ry: 200 };
		Object.assign(oval.points.p1, { x: 927, y: 550 });
		Object.assign(oval.points.p3, { x: 327, y: 550 });
		for (const id of ['p2', 'p4']) {
			delete oval.points[id].on;
			delete oval.points[id].inset;
		}
		oval.points.p2.y = 750;
		oval.points.p4.y = 350;
		const next = withThickness(oval, project, 200);
		expect(next.pieces[0].circle).toEqual(oval.pieces[0].circle);
		expect(next.points).toEqual(oval.points);
	});

	it('an Outline circle (its points on the lines themselves) never moves', () => {
		const ring = circleBetweenLines(99, { use: 'outline' });
		const next = withThickness(ring, project, 200);
		expect(next.points).toEqual(ring.points);
		expect(next.pieces[0].circle).toEqual(ring.pieces[0].circle);
	});
});
