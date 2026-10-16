// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize: a traced letter a little off the line (the critic's traced h, placed by
// the app and then called "floats") settles on it, with its photo, before Use it's step.
// Written to fail first (photo_flow_settle.js did not exist; Use it kept placement's seat).
import { describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { CHECK, findChecks, measureLetter } from '../../checks/checks.js';
import { FONT, moved, shapesFor } from '../../checks/tests/letters.js';
import { SETTLE_SHARE, settleOnLine } from '../photo_flow_settle.js';

const paths = (shapes) => shapes.map((shape) => new Path(shape));
const offLine = (char, shapes) => {
	const probe = { id: '', chars: char, shapes, advanceWidth: 1 };
	return findChecks(probe, measureLetter(probe, FONT), { font: FONT }).find(
		(check) => check.id === CHECK.offLine
	);
};
const trace = { asset: 'img', x: 10, y: 900, scale: 2 };

describe('settleOnLine', () => {
	it("an h traced 55 units up (past the checks' 41): moved down onto the line, photo too", () => {
		const shapes = paths(moved(shapesFor('h'), 0, 55));
		expect(offLine('h', shapes)).toBeTruthy();
		const settled = settleOnLine('h', shapes, trace, FONT);
		expect(settled.dy).toBe(-55);
		expect(settled.trace).toMatchObject({ x: 10, y: 845, scale: 2 });
		expect(offLine('h', shapes)).toBeUndefined();
		const ys = shapes.flatMap((shape) => shape.pathPoints.map((point) => point.p.coord.y));
		expect(ys.every(Number.isInteger)).toBe(true);
	});

	it('a letter on the line, or one far off (more than the settle reach), is left alone', () => {
		const on = paths(shapesFor('h'));
		expect(settleOnLine('h', on, trace, FONT)).toEqual({ dy: 0, trace });
		const far = paths(moved(shapesFor('h'), 0, Math.ceil(SETTLE_SHARE * FONT.upm) + 20));
		expect(settleOnLine('h', far, trace, FONT).dy).toBe(0);
	});

	it('a sunk n comes up; a g within its bowl slack is already on the line', () => {
		expect(settleOnLine('g', paths(moved(shapesFor('g'), 0, 70)), trace, FONT).dy).toBe(0);
		const n = paths(moved(shapesFor('n'), 0, -60));
		expect(settleOnLine('n', n, trace, FONT).dy).toBe(60);
	});
});
