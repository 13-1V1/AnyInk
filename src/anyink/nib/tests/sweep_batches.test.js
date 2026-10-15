// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 fix (hostile finding "brush cost grows with stroke length"): a long stroke froze the page
	on release (1.6 s for 15 slow loops, 390 ms in Chrome for a 35 s stroke), almost all of it one
	clipper2 union of every nib piece at once. The pieces are now united a few neighbours at a time
	and the results pairwise, so no union ever sees the whole stroke's pieces, and the outline is
	the same. Each step's piece is now read straight off the nib (stepHull) instead of sorting both
	places' corners (convexHull), the same polygon.
*/
import { FillRule, unionD } from 'clipper2-ts';
import { describe, expect, it } from 'vitest';
import { convexHull, dedupe, flattenCurves, signedArea } from '../geometry.js';
import { outlineGap } from '../match.js';
import { makeSkeleton } from '../skeleton.js';
import { UNION_BATCH, roundNib, stepHull, sweepPieces, sweepRoundNib } from '../sweep.js';
import { arc } from './strokes.js';

/** clipper2's union, counting the paths each call gets */
const calls = [];
const counting = (paths, ...rest) => {
	calls.push(paths.length);
	return unionD(paths, ...rest);
};

const SIZE = 99;

/** Loops in a row, like a run of cursive l's */
function loops(count, r = 150) {
	const points = [];
	for (let i = 0; i < count; i++) {
		points.push(...arc(i * r * 1.2, 300, r, -90, 270, 3).slice(i ? 1 : 0));
	}
	return points;
}

describe('a long stroke is united a few pieces at a time', () => {
	it('no union gets the whole stroke; the biggest gets a handful of paths', () => {
		const skeleton = makeSkeleton(loops(5), { size: SIZE });
		const line = dedupe(flattenCurves(skeleton, 0.1), 1e-3);
		const pieces = sweepPieces(line, roundNib(SIZE));
		expect(pieces.length).toBeGreaterThan(400);
		calls.length = 0;
		sweepRoundNib(skeleton, SIZE, { union: counting });
		expect(calls.length).toBeGreaterThan(1);
		expect(Math.max(...calls)).toBeLessThanOrEqual(4 * UNION_BATCH);
	});

	it('the outline is the one a single union of every piece gives', () => {
		const skeleton = makeSkeleton(loops(5), { size: SIZE });
		const line = dedupe(flattenCurves(skeleton, 0.1), 1e-3);
		const pieces = sweepPieces(line, roundNib(SIZE));
		const once = unionD(
			pieces.map((piece) => piece.map(([x, y]) => ({ x, y }))),
			FillRule.NonZero,
			3
		)
			.map((path) => path.map(({ x, y }) => [x, y]))
			.filter((outline) => Math.abs(signedArea(outline)) >= 4);
		const batched = sweepRoundNib(skeleton, SIZE);
		expect(batched).toHaveLength(once.length);
		expect(outlineGap(batched, once)).toBeLessThan(0.05);
	});
});

describe("a step's piece", () => {
	it('is the hull of the nib at both ends, every way round, at every size', () => {
		let state = 9;
		const random = () => {
			state = (state * 16807) % 2147483647;
			return state / 2147483647;
		};
		const steps = [
			[
				[0, 0],
				[10, 0],
			],
			[
				[0, 0],
				[0, -7],
			],
			[
				[5, 5],
				[5.0001, 30],
			],
			[
				[0, 0],
				[1e-4, 0],
			],
			...Array.from({ length: 300 }, () => [
				[random() * 400, random() * 400],
				[random() * 400, random() * 400],
			]),
		];
		steps.forEach(([a, b], i) => {
			const nib = roundNib(4 + (i % 7) * 30);
			const fast = stepHull(nib, a, b);
			const sorted = convexHull([
				...nib.map(([x, y]) => [x + a[0], y + a[1]]),
				...nib.map(([x, y]) => [x + b[0], y + b[1]]),
			]);
			expect(signedArea(fast)).toBeGreaterThan(0);
			expect(Math.abs(signedArea(fast) - signedArea(sorted))).toBeLessThanOrEqual(
				1e-9 * signedArea(sorted) + 1e-9
			);
			sorted.forEach((corner) =>
				expect(
					fast.some((point) => Math.hypot(point[0] - corner[0], point[1] - corner[1]) < 1e-9)
				).toBe(true)
			);
		});
	});

	it('a step of no length is the nib where it is', () => {
		const nib = roundNib(20);
		expect(stepHull(nib, [3, 4], [3, 4])).toEqual(nib.map(([x, y]) => [x + 3, y + 4]));
	});
});
