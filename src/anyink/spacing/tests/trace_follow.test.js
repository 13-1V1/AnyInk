// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 (UX-BEGINNER 7.2 "The photo moves with the letter"): whenever spacing moves the shapes
// sideways, the letter's photo (item.anyink.trace.x) moves by the same amount, so the faint
// photo stays under the ink and Trace again traces the right spot.
import { describe, expect, it } from 'vitest';
import { ComponentInstance } from '../../../project_data/component_instance.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { followLeftEdge, followShapes, moveSideways } from '../trace_follow.js';
import { letter, photoUnder, rect, spacingProject } from './fixtures.js';

/** How far the photo's left edge is from the ink's: stays the same while they move together */
const gapOf = (item) => item.maxes.xMin - getTrace(item).x;

function withPhoto(char = 'n') {
	const project = spacingProject(2048, { [char]: {} });
	const item = letter(project, char);
	setTrace(item, photoUnder(item, 30));
	return { project, item };
}

describe('moveSideways', () => {
	it('moves the shapes and the photo by the same amount, the photo locked or not', () => {
		const { item } = withPhoto();
		const x = item.maxes.xMin;
		const y = getTrace(item).y;
		expect(moveSideways(item, -12)).toBe(true);
		expect(item.maxes.xMin).toBe(x - 12);
		expect(gapOf(item)).toBe(30);
		expect(getTrace(item).y).toBe(y);
		expect(getTrace(item).locked).toBe(true);
	});

	it('moves only the shapes when there is no photo', () => {
		const project = spacingProject(2048, { n: {} });
		const item = letter(project, 'n');
		expect(moveSideways(item, 40)).toBe(true);
		expect(item.maxes.xMin).toBe(140);
		expect(item.anyink.trace).toBeUndefined();
	});

	it('does nothing for no move, or a move that is not a number', () => {
		const { item } = withPhoto();
		const before = JSON.stringify(item.save());
		expect(moveSideways(item, 0)).toBe(false);
		expect(moveSideways(item, NaN)).toBe(false);
		expect(moveSideways(null, 10)).toBe(false);
		expect(JSON.stringify(item.save())).toBe(before);
	});

	it('moves a letter made from another letter by its placement, not the other letter', () => {
		const project = spacingProject(2048, { n: {}, m: { shapes: [] } });
		const n = letter(project, 'n');
		const m = letter(project, 'm');
		m.shapes.push(new ComponentInstance({ link: n.id, parent: m }));
		const nBefore = n.maxes.xMin;
		const mBefore = m.maxes.xMin;
		moveSideways(m, 25);
		expect(m.maxes.xMin).toBe(mBefore + 25);
		expect(n.maxes.xMin).toBe(nBefore);
	});
});

describe('followShapes and followLeftEdge', () => {
	it('followShapes moves only the photo', () => {
		const { item } = withPhoto();
		const x = getTrace(item).x;
		expect(followShapes(item, 7)).toBe(true);
		expect(getTrace(item).x).toBe(x + 7);
		expect(followShapes(item, 0)).toBe(false);
	});

	it('leaves a damaged photo record alone', () => {
		const project = spacingProject(2048, { n: {} });
		const item = letter(project, 'n');
		item.anyink.trace = { asset: '', x: 5 };
		expect(followShapes(item, 10)).toBe(false);
		expect(item.anyink.trace).toEqual({ asset: '', x: 5 });
	});

	it('followLeftEdge catches the photo up after the left space was set some other way', () => {
		const { item } = withPhoto();
		const before = item.maxes.xMin;
		// The upstream setter moves the shapes (an edge drag, the Attributes field)
		item.leftSideBearing = before + 64;
		expect(followLeftEdge(item, before)).toBe(64);
		expect(gapOf(item)).toBe(30);
		expect(followLeftEdge(item, item.maxes.xMin)).toBe(0);
	});

	it('followLeftEdge on a letter with no ink moves nothing', () => {
		const project = spacingProject(2048, { n: { shapes: [rect(0, 0, 0, 0)] } });
		const item = letter(project, 'n');
		item.shapes = [];
		expect(followLeftEdge(item, 100)).toBe(0);
	});
});
