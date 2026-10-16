// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 build.js (docs/SKETCH.md sections 6, 8 and 11 S3): rebuildItem puts a sketch's ink in its
	letter, tagged and hashed; the same sketch builds the same shapes (a step that changed nothing
	changes nothing); the placed points are written back; a letter changed behind the sketch is
	never rebuilt over; arcs snapped to a line keep their top on it when the thickness changes.
	B11 (section 6 "Checks agree"): o, n, v and A built from their sketches sit on the line and are
	the right size by measureLetter / checkLetter, so Sit on the line and Match size are never
	offered on a freshly sketched letter.
	Checked to fail: with the edge rule left out of the build (pinned points used as stored, 37 to
	41 units off their lines) the o, n, v and A checks and the write-back test fail; with
	placeArcTops a no-op the four arc-top tests fail.
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLetter, measureLetter } from '../../checks/checks.js';
import { guideLines } from '../../placement/classes.js';
import { buildSketch, clearBuildCache, placeArcTops, rebuildItem } from '../build.js';
import { sketchRebuild } from '../follow.js';
import { flattenCubics } from '../outline_order.js';
import { sketchOf } from '../model.js';
import { builtMatches, builtShapes, isBuiltShape, sketchIdOf } from '../sketch_record.js';
import { arc, line, sketchOfPieces, vCenter } from './fixtures/build_letters.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';

const LINES = guideLines(STORED_FONT);

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	clearBuildCache();
});

/** stored sketches with their pinned points moved off their lines: the build places them */
function unplaced(sketch) {
	Object.values(sketch.points).forEach((point) => {
		if (point.inset === 'edge') point.y += point.on === 'writing' ? 37 : -41;
	});
	return sketch;
}

const LETTERS = () => ({
	o: unplaced(storedSketch('o')),
	n: unplaced(storedSketch('n')),
	v: unplaced(vCenter()),
	A: unplaced(storedSketch('A')),
});

describe('rebuildItem', () => {
	it('puts the ink in the letter, tagged and hashed, and writes the placed points back', () => {
		const editor = openSketchFont(LETTERS());
		const n = editor.project.getItem(glyphIdOf('n'));
		expect(n.shapes).toHaveLength(0);
		const result = rebuildItem(n, { project: editor.project });
		expect(result.changed).toBe(true);
		expect(n.shapes.length).toBeGreaterThanOrEqual(2);
		expect(n.shapes.every(isBuiltShape)).toBe(true);
		expect(new Set(n.shapes.map(sketchIdOf))).toEqual(new Set([1, 2]));
		expect(builtMatches(n)).toBe(true);
		const sketch = sketchOf(n);
		expect(sketch.points.foot.y).toBe(50);
		expect(sketch.points.stemTop.y).toBe(1051);
		expect(sketch.build).toBe(1);
		// every number whole
		const numbers = n.shapes.flatMap((shape) =>
			shape.pathPoints.flatMap((p) => [p.p.x, p.p.y, p.h1.x, p.h1.y, p.h2.x, p.h2.y])
		);
		expect(numbers.every(Number.isInteger)).toBe(true);
	});

	it('the same sketch again changes nothing; a changed sketch replaces only built shapes', () => {
		const editor = openSketchFont(LETTERS());
		const n = editor.project.getItem(glyphIdOf('n'));
		const plain = n.addOneShape({
			name: 'Mine',
			pathPoints: [
				{ p: { coord: { x: 900, y: 0 } } },
				{ p: { coord: { x: 1000, y: 0 } } },
				{ p: { coord: { x: 1000, y: 100 } } },
			],
		});
		rebuildItem(n, { project: editor.project });
		const first = [...n.shapes];
		expect(rebuildItem(n, { project: editor.project }).changed).toBe(false);
		expect(n.shapes).toEqual(first);
		expect(n.shapes.every((shape, i) => shape === first[i])).toBe(true);
		// the plain shape stays first, untouched; the built ones follow it
		expect(n.shapes[0]).toBe(plain);
		sketchOf(n).points.rightFoot.x += 60;
		expect(rebuildItem(n, { project: editor.project }).changed).toBe(true);
		expect(n.shapes[0]).toBe(plain);
		expect(n.shapes.slice(1).every(isBuiltShape)).toBe(true);
		expect(n.shapes.filter((shape) => !isBuiltShape(shape))).toEqual([plain]);
	});

	it('built shapes changed behind the sketch are never rebuilt over (unless a follow forces it)', () => {
		const editor = openSketchFont(LETTERS());
		const n = editor.project.getItem(glyphIdOf('n'));
		rebuildItem(n, { project: editor.project });
		n.shapes[0].pathPoints[0].p.x += 30;
		const before = JSON.stringify(n.save());
		const result = rebuildItem(n, { project: editor.project });
		expect(result).toMatchObject({ changed: false, mismatch: true });
		expect(JSON.stringify(n.save())).toBe(before);
		// the follow plans' rebuild is handed in by the build, and skips the check
		expect(typeof sketchRebuild()).toBe('function');
		expect(sketchRebuild()(n, { project: editor.project })).toBe(true);
		expect(builtMatches(n)).toBe(true);
	});

	it('a letter set aside, or with no sketch, is never built', () => {
		const editor = openSketchFont(LETTERS());
		const o = editor.project.getItem(glyphIdOf('o'));
		sketchOf(o).setAside = true;
		expect(rebuildItem(o, { project: editor.project }).changed).toBe(false);
		expect(o.shapes).toHaveLength(0);
		expect(rebuildItem({ shapes: [] }, { project: editor.project }).changed).toBe(false);
	});

	it('helper pieces make no ink; a sketch with only a helper makes none', () => {
		const sketch = vCenter();
		sketch.pieces[0].use = 'helper';
		expect(buildSketch(sketch, { font: STORED_FONT }).shapes).toEqual([]);
	});
});

describe('B11 agrees: freshly sketched o, n, v and A sit on the line at the right size', () => {
	for (const char of ['o', 'n', 'v', 'A']) {
		it(`${char}`, () => {
			const editor = openSketchFont(LETTERS());
			const item = editor.project.getItem(glyphIdOf(char));
			rebuildItem(item, { project: editor.project });
			const font = editor.project.settings.font;
			const measures = measureLetter(item, font);
			expect(measures).not.toBeNull();
			// the body's bottom on the writing line within the checks' own 2 % (round letters
			// dip their overshoot)
			const allowed = 0.02 * LINES.box + (char === 'o' ? LINES.overshoot : 0);
			expect(Math.abs(measures.body.bottom - LINES.writing)).toBeLessThanOrEqual(allowed);
			const ids = checkLetter(item, { font }).map((check) => check.id);
			expect(ids).not.toContain('offLine');
			expect(ids).not.toContain('size');
			// the ink's top on its line: small-letter or capitals (plus the round overshoot)
			const top = char === 'A' ? LINES.capitals : LINES.small;
			const over = char === 'o' || char === 'n' ? LINES.overshoot : 0;
			expect(Math.abs(measures.ink.yMax - (top + over))).toBeLessThanOrEqual(1);
		});
	}
});

describe('arc tops snapped to a line (part.top)', () => {
	/** an n-like arch: up a stem, an Arc over the top, down to the writing line */
	function arch(thickness) {
		return sketchOfPieces(
			'sk_t_arch',
			{
				foot: { x: 100, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
				left: { x: 100, y: 700, kind: 'corner' },
				right: { x: 600, y: 700, kind: 'corner' },
				rightFoot: { x: 600, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			},
			[
				{
					use: 'center',
					closed: false,
					parts: [
						line('foot', 'left'),
						{ ...arc('left', 'right', -0.9), top: { on: 'small' } },
						line('right', 'rightFoot'),
					],
				},
			],
			{ thickness }
		);
	}

	for (const thickness of [60, 99, 200]) {
		it(`the ink's top sits on the small-letter line plus the overshoot at thickness ${thickness}`, () => {
			const { shapes } = buildSketch(arch(thickness), { font: STORED_FONT });
			const ys = shapes.flatMap((shape) => flattenCubics(shape.curves)).map(([, y]) => y);
			expect(Math.abs(Math.max(...ys) - (LINES.small + LINES.overshoot))).toBeLessThanOrEqual(1);
		});
	}

	it('placeArcTops changes only topped arcs, and leaves a sketch with none as it is', () => {
		const plain = storedSketch('n');
		expect(placeArcTops(plain, STORED_FONT)).toBe(plain);
		const topped = arch(99);
		const placed = placeArcTops(topped, STORED_FONT);
		expect(placed).not.toBe(topped);
		expect(placed.pieces[0].parts[1].bulge).not.toBe(-0.9);
		expect(placed.pieces[0].parts[0]).toBe(topped.pieces[0].parts[0]);
	});
});

describe('the build is kept by what it was made from', () => {
	it('the second build of the same sketch is the same list, not built again', () => {
		const a = buildSketch(storedSketch('A'), { font: STORED_FONT });
		const b = buildSketch(storedSketch('A'), { font: STORED_FONT });
		expect(b.shapes).toBe(a.shapes);
		clearBuildCache();
		const c = buildSketch(storedSketch('A'), { font: STORED_FONT });
		expect(c.shapes).not.toBe(a.shapes);
		expect(c.shapes).toEqual(a.shapes);
	});

	it('builtShapes finds what rebuildItem put in', () => {
		const editor = openSketchFont(LETTERS());
		const v = editor.project.getItem(glyphIdOf('v'));
		const { shapes } = rebuildItem(v, { project: editor.project });
		expect(builtShapes(v)).toEqual(shapes);
	});
});
