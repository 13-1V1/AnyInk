// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 fix track tools: arc_snap.js, an arc's top or bottom on a writing line (pure). The extreme
	is found only where the arc turns level between its ends; the 3-point bend and the tangent end
	put it where the edge rule puts a round top (Centerline: r inside plus the overshoot; Outline:
	on the line plus the overshoot); a top past a line is only shown; Ctrl snaps nothing.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { arcDirs, bulgeFromMiddle } from '../../arc.js';
import { edgeThickness } from '../../edge_rule.js';
import { arcExtreme, extremeTargets, snapBulge, snapTangentEnd } from '../arc_snap.js';
import { FONT, RADIUS, THICKNESS } from './fake_ctx.js';

const lines = guideLines(FONT);
const r = edgeThickness(FONT, THICKNESS) / 2;
const context = (extra = {}) => ({ font: FONT, thickness: THICKNESS, use: 'center', radius: RADIUS, ...extra });

describe('arcExtreme', () => {
	it('a half circle over its chord has its top in the middle', () => {
		const top = arcExtreme([0, 0], [200, 0], -1, 'top');
		expect(top.x).toBeCloseTo(100, 9);
		expect(top.y).toBeCloseTo(100, 9);
		expect(arcExtreme([0, 0], [200, 0], -1, 'bottom')).toBe(null);
	});

	it('none where the arc does not turn level between its ends', () => {
		// a quarter leaving up and turning right: it reaches its top only at its end
		expect(arcExtreme([0, 0], [100, 100], 0.2, 'top')).toBe(null);
		expect(arcExtreme([0, 0], [100, 0], 0, 'top')).toBe(null);
	});
});

describe('extremeTargets', () => {
	it('tops under the top, capitals and small-letter lines, bottoms over the writing and tail lines', () => {
		const byOn = Object.fromEntries(extremeTargets(FONT, THICKNESS, 'center').map((t) => [t.on, t]));
		expect(byOn.small).toMatchObject({ side: 'top', y: lines.small - r + lines.overshoot });
		expect(byOn.capitals).toMatchObject({ side: 'top', y: lines.capitals - r + lines.overshoot });
		expect(byOn.top).toMatchObject({ side: 'top', y: lines.top - r });
		expect(byOn.writing).toMatchObject({ side: 'bottom', y: lines.writing + r - lines.overshoot });
		expect(byOn.tail).toMatchObject({ side: 'bottom', y: lines.tail + r });
		const outline = Object.fromEntries(extremeTargets(FONT, THICKNESS, 'outline').map((t) => [t.on, t]));
		expect(outline.small.y).toBe(lines.small + lines.overshoot);
	});
});

describe('snapBulge', () => {
	it('near the line: the top goes to the target and the line is named', () => {
		const out = snapBulge([300, 600], [700, 600], { x: 500, y: lines.small - 10 }, context());
		expect(arcExtreme([300, 600], [700, 600], out.bulge, 'top').y).toBeCloseTo(lines.small - r + lines.overshoot, 6);
		expect(out.snap).toMatchObject({ on: 'small', touches: true, tag: { key: 'line.xHeight' } });
	});

	it('a bottom near the writing line sits r above it, less the overshoot', () => {
		const out = snapBulge([300, 600], [700, 600], { x: 500, y: lines.writing + 8 }, context());
		expect(arcExtreme([300, 600], [700, 600], out.bulge, 'bottom').y).toBeCloseTo(lines.writing + r - lines.overshoot, 6);
	});

	it('far from every line, or with Ctrl: the bulge from the pointer', () => {
		const free = bulgeFromMiddle([300, 600], [700, 600], [500, 800]);
		expect(snapBulge([300, 600], [700, 600], { x: 500, y: 800 }, context())).toEqual({ bulge: free, snap: null });
		const ctrl = snapBulge([300, 600], [700, 600], { x: 500, y: lines.small }, context({ ctrl: true }));
		expect(ctrl.snap).toBe(null);
	});

	it('a top past the line is only shown', () => {
		const out = snapBulge([300, 900], [700, 900], { x: 500, y: lines.small + 150 }, context());
		expect(out.snap).toMatchObject({ on: 'small', touches: false });
		expect(out.bulge).toBeCloseTo(bulgeFromMiddle([300, 900], [700, 900], [500, lines.small + 150]), 9);
	});
});

describe('snapTangentEnd', () => {
	it('leaving a plumb stem up: the end moves round the circle whose top is on the line', () => {
		const target = lines.small - r + lines.overshoot;
		const R = lines.small - 700;
		const out = snapTangentEnd([300, 700], 90, { x: 300 + 2 * R + 8, y: 690 }, context());
		expect(out.snap).toMatchObject({ on: 'small', touches: true });
		expect(arcExtreme([300, 700], [out.end.x, out.end.y], out.bulge, 'top').y).toBeCloseTo(target, 6);
		expect(arcDirs([300, 700], [out.end.x, out.end.y], out.bulge).start).toBeCloseTo(90, 6);
	});

	it('nothing near: the end as given', () => {
		const out = snapTangentEnd([300, 300], 90, { x: 500, y: 300 }, context());
		expect(out.snap).toBe(null);
		expect(out.end).toEqual({ x: 500, y: 300 });
	});
});
