// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 build_outline.js and the hole counts (docs/SKETCH.md sections 4 and 11 S3): Outline loops
	are solid or hole by nesting, kept exactly (whole numbers) where nothing crosses, and resolved
	with clipper only where loops cross. The hole counts are read the way a font file holds them:
	the letter's built shapes merged as an export merges them (install/merge_overlaps.js), then
	the outlines that run clockwise counted. o has 1 hole and B 2, sketched either way.
	Checked to fail: with the nesting turned off (every loop built as drawn, counterclockwise) the
	o, B and island counts fail; with the crossing step taken out, the crossing tests fail.
*/
import { describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { mergedContours } from '../../install/merge_overlaps.js';
import { buildSketch, builtPaths, clearBuildCache } from '../build.js';
import { crossesItself, loopsCross, outlineContours } from '../build_outline.js';
import { placeEdgePoints } from '../edge_rule.js';
import { flattenCubics, signedArea } from '../outline_order.js';
import {
	bCenter,
	bOutline,
	crossingOutline,
	figureEight,
	islandOutline,
	oOutline,
} from './fixtures/build_letters.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';

const FONT = STORED_FONT;

/** FontFlux contour commands to a closed line of points */
function commandPoints(contour) {
	const points = [];
	let at = null;
	contour.forEach((cmd) => {
		if (cmd.type === 'M' || cmd.type === 'L') {
			at = [cmd.x, cmd.y];
			points.push(at);
		} else if (cmd.type === 'C') {
			const cubic = [at, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y]];
			points.push(...flattenCubics([cubic]).slice(1));
			at = [cmd.x, cmd.y];
		}
	});
	return points;
}

/** The letter's ink as a font file would hold it: the built shapes, overlaps merged */
function fileOutlines(sketch) {
	clearBuildCache();
	const { shapes } = buildSketch(sketch, { font: FONT });
	const paths = builtPaths(sketch, shapes).map((path) => new Path(path));
	const keep = (path) => {
		const pts = path.pathPoints;
		const cmds = [{ type: 'M', x: pts[0].p.x, y: pts[0].p.y }];
		pts.forEach((point, i) => {
			const next = pts[(i + 1) % pts.length];
			cmds.push({
				type: 'C',
				x1: point.h2.x,
				y1: point.h2.y,
				x2: next.h1.x,
				y2: next.h1.y,
				x: next.p.x,
				y: next.p.y,
			});
		});
		return cmds;
	};
	const contours = mergedContours(paths, keep) || paths.map(keep);
	return contours.map(commandPoints);
}

const holes = (outlines) => outlines.filter((points) => signedArea(points) < 0).length;
const solids = (outlines) => outlines.filter((points) => signedArea(points) > 0).length;

describe('hole counts, as the font file holds them', () => {
	it('o: 1 hole, sketched as an Outline (two circles) or a Centerline ring', () => {
		expect(holes(fileOutlines(oOutline()))).toBe(1);
		expect(solids(fileOutlines(oOutline()))).toBe(1);
		expect(holes(fileOutlines(storedSketch('o')))).toBe(1);
	});

	it('B: 2 holes, sketched as an Outline (an outer loop and two inside) or a Centerline', () => {
		expect(holes(fileOutlines(bOutline()))).toBe(2);
		expect(solids(fileOutlines(bOutline()))).toBe(1);
		const center = fileOutlines(placeEdgePoints(bCenter(), FONT));
		expect(holes(center)).toBe(2);
		expect(solids(center)).toBe(1);
	});

	it('an island in a hole is solid again', () => {
		const outlines = fileOutlines(islandOutline());
		expect(solids(outlines)).toBe(2);
		expect(holes(outlines)).toBe(1);
	});
});

describe('the Outline build', () => {
	it('loops that cross nothing keep their built curves exactly, one shape per loop, whole', () => {
		const contours = outlineContours(placeEdgePoints(bOutline(), FONT));
		expect(contours.map((contour) => contour.pieceId)).toEqual([1, 2, 3]);
		expect(contours.map((contour) => contour.hole)).toEqual([false, true, true]);
		for (const contour of contours) {
			expect(contour.curves).toHaveLength(4);
			expect(contour.curves.flat(2).every(Number.isInteger)).toBe(true);
		}
		const outer = contours[0].curves.map((curve) => curve[0]);
		expect(outer).toEqual(
			expect.arrayContaining([
				[100, 0],
				[700, 0],
				[700, 1480],
				[100, 1480],
			])
		);
	});

	it('two solid circles that overlap join; a hole poking past its loop makes no ink outside', () => {
		const sketch = crossingOutline();
		const contours = outlineContours(sketch);
		const outlines = contours.map((contour) => flattenCubics(contour.curves));
		expect(solids(outlines)).toBe(1);
		expect(holes(outlines)).toBe(0);
		const xs = outlines.flat().map(([x]) => x);
		// the poking box's left part (x 0 to 100) made no ink; the circles reach 100 to 1050
		expect(Math.min(...xs)).toBeGreaterThan(95);
		expect(Math.max(...xs)).toBeLessThan(1056);
		// the box's inside part is a notch in the ink: a point inside both is paper
		expect(contours.every((contour) => contour.pieceId === 1)).toBe(true);
	});

	it('a loop that crosses itself keeps both lobes as ink', () => {
		const contours = outlineContours(figureEight());
		const outlines = contours.map((contour) => flattenCubics(contour.curves));
		expect(solids(outlines)).toBe(2);
		expect(holes(outlines)).toBe(0);
	});

	it('open, helper and hidden pieces make no ink', () => {
		const sketch = oOutline();
		sketch.pieces[0].closed = false;
		sketch.pieces[1].use = 'helper';
		expect(outlineContours(sketch)).toEqual([]);
		const hidden = oOutline();
		hidden.pieces.forEach((piece) => (piece.hidden = true));
		expect(outlineContours(hidden)).toEqual([]);
	});

	it('loopsCross and crossesItself: crossings and touches count, apart loops do not', () => {
		const a = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		];
		const b = a.map(([x, y]) => [x + 5, y + 5]);
		const apart = a.map(([x, y]) => [x + 50, y]);
		const touching = a.map(([x, y]) => [x + 10, y]);
		expect(loopsCross(a, b)).toBe(true);
		expect(loopsCross(a, apart)).toBe(false);
		// touching goes through clipper too (right either way)
		expect(loopsCross(a, touching)).toBe(true);
		expect(crossesItself(a)).toBe(false);
		expect(
			crossesItself([
				[0, 0],
				[10, 10],
				[10, 0],
				[0, 10],
			])
		).toBe(true);
	});
});
