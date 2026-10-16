// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 follow plans (docs/SKETCH.md section 7, D-047 point 9): every feature that moves a sketched
	letter's ink moves the sketch with it, so the sketch builds the ink the feature made (within
	1 unit) and the next step never sets it aside. The features run for real: spacing's
	moveSideways, metrics' shiftItemPaths, B11's applyPlan with Sit on the line, Match size and
	Shrink to fit plans, the card's Flip; the ink they make is compared with what the moved sketch
	builds (follow.js's own rebuild taken away for the comparison, so the ink is the feature's).
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { penAllowance } from '../../checks/body_bottom.js';
import { CHECK, findChecks, measureLetter } from '../../checks/checks.js';
import { pathContour } from '../../spacing/outline.js';
import { applyPlan, seatPlan, shrinkPlan, sizePlan } from '../../checks/fix_shapes.js';
import { sketchStroke } from '../../checks/keep_weight.js';
import { matchSize } from '../../checks/fixes.js';
import { flipLetter } from '../../letter/flip_letter.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { shiftItemPaths } from '../../metrics/font_metrics.js';
import { moveSideways } from '../../spacing/trace_follow.js';
import { guideLines } from '../../placement/classes.js';
import { followLine, followShapes } from '../follow.js';
import { translate } from '../follow_matrix.js';
import { sketchOf } from '../model.js';
import { builtMatches, builtShapes, untagBuilt } from '../sketch_record.js';
import { bCenter, bOutline, oOutline, vCenter } from './fixtures/build_letters.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';
import {
	FOLLOW_IDS,
	builtLetter,
	followEditor,
	freshInk,
	outlinesApart,
	withoutRebuild,
} from './follow_helpers.js';

const LETTERS = Object.freeze([
	['n', () => storedSketch('n')],
	['o', () => storedSketch('o')],
	['s', () => storedSketch('s')],
	['A', () => storedSketch('A')],
	['O', () => storedSketch('circle')],
	['B', () => bCenter()],
	['v', () => vCenter()],
]);

/** The letter's sketch builds the ink it holds, within 1 unit, and the hash agrees */
function expectInSync(item, project, label) {
	const apart = outlinesApart(builtShapes(item), freshInk(item, project));
	expect(apart, label).toBeLessThanOrEqual(1);
	expect(builtMatches(item), label).toBe(true);
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** Each side of the box around some shapes */
function boxOf(shapes) {
	const all = shapes.map((shape) => shape.maxes);
	return {
		xMin: Math.min(...all.map((m) => m.xMin)),
		xMax: Math.max(...all.map((m) => m.xMax)),
		yMin: Math.min(...all.map((m) => m.yMin)),
		yMax: Math.max(...all.map((m) => m.yMax)),
	};
}

/**
 * How close the sketch's ink lands to the ink the feature made: a whole-unit move is exact (the
 * same ink, never rebuilt); a Flip is rebuilt from the flipped sketch (two fits of the same
 * sweep: within 1.5, every side within 1); a scale is rebuilt with the thickness kept (every
 * side within 1.5; inside the box the feature's own copy is off at sharp inside corners, where
 * keep_weight's push is mitered, and the rebuild is the true one)
 */
const KINDS = Object.freeze({
	move: { apart: 1, side: 1 },
	flip: { apart: 1.5, side: 1 },
	scale: { apart: null, side: 1.5 },
});

describe('every follow: the sketch builds the ink, where the feature put it', () => {
	const features = [
		['spacing slides it 37 units', 'move', (item) => moveSideways(item, 37)],
		['spacing slides it back 120 units', 'move', (item) => moveSideways(item, -120)],
		[
			'a line shift moves it 25 units up',
			'move',
			(item, project) => shiftItemPaths(item, 25, { font: project.settings.font }),
		],
		[
			'Sit on the line moves it 13 units down',
			'move',
			(item) => applyPlan(item, { k: 1, dy: -13 }),
		],
		['Flip left-right', 'flip', (item, project) => flipLetter(item, 'leftRight', { project })],
		['Flip upside-down', 'flip', (item, project) => flipLetter(item, 'upsideDown', { project })],
		[
			'a Match size plan (bigger, the thickness kept)',
			'scale',
			(item, project) => {
				const t = sketchStroke(item, project.settings.font);
				const k = 1.15;
				const grow = ((1 - k) * t) / 2;
				const ox = item.maxes.xMin;
				return applyPlan(item, { k, ox, oy: 0, dx: grow, dy: grow, grow });
			},
		],
		[
			'a Shrink to fit plan (smaller, from the ink line)',
			'scale',
			(item, project) => {
				const r = sketchStroke(item, project.settings.font) / 2;
				const k = 0.85;
				const grow = (1 - k) * r;
				return applyPlan(item, { k, ox: item.maxes.xMin, oy: r, dx: grow, dy: 0, grow });
			},
		],
	];
	for (const [name, make] of LETTERS) {
		for (const [what, kind, run] of features) {
			it(`${name}: ${what}`, () => {
				// the feature's own ink (no rebuild)
				const plain = followEditor();
				const theirs = builtLetter(plain, FOLLOW_IDS[name], make());
				const before = JSON.stringify(builtShapes(theirs).map((shape) => shape.save()));
				withoutRebuild(() => run(theirs, plain.project));
				const featureInk = builtShapes(theirs);
				// the feature moved the ink (a v flipped left-right is itself again)
				if (kind !== 'flip') {
					expect(JSON.stringify(featureInk.map((shape) => shape.save()))).not.toBe(before);
				}
				// the app: the sketch follows and its ink is rebuilt where needed
				const editor = followEditor();
				const item = builtLetter(editor, FOLLOW_IDS[name], make());
				run(item, editor.project);
				expectInSync(item, editor.project, what);
				const ink = builtShapes(item);
				const limits = KINDS[kind];
				if (limits.apart !== null) {
					expect(outlinesApart(ink, featureInk), 'apart').toBeLessThanOrEqual(limits.apart);
				}
				const a = boxOf(ink);
				const b = boxOf(featureInk);
				for (const side of ['xMin', 'xMax', 'yMin', 'yMax']) {
					expect(Math.abs(a[side] - b[side]), side).toBeLessThanOrEqual(limits.side);
				}
			}, 20000);
		}
	}
});

describe('the follow inside real steps', () => {
	it('a step after a follow never sets the sketch aside; the rebuild keeps the ink', () => {
		const editor = followEditor();
		const item = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		editor.selectedItemID = FOLLOW_IDS.n;
		editor.history.addState('Sketched');
		flipLetter(item, 'leftRight', { project: editor.project });
		editor.history.addState('Flipped');
		expect(sketchOf(item).setAside).toBe(false);
		expectInSync(item, editor.project, 'after the flip step');
		editor.history.restoreState();
		const back = editor.project.glyphs[FOLLOW_IDS.n];
		expect(sketchOf(back).points.join.aim.dir).toBe(70);
	});

	it('Simple: [Match size] on a small sketched o is one step; the refit follows; never set aside', () => {
		setModeForTests('simple');
		try {
			const editor = followEditor();
			const font = editor.project.settings.font;
			const small = storedSketch('o');
			for (const point of Object.values(small.points)) {
				point.x = Math.round(point.x * 0.8);
				point.y = Math.round(point.y * 0.8);
				delete point.on;
				delete point.inset;
			}
			const o = builtLetter(editor, FOLLOW_IDS.o, small);
			showItem(editor, FOLLOW_IDS.o);
			editor.history.addState('Sketched');
			const steps = editor.history.queue.length;
			const result = matchSize(editor, FOLLOW_IDS.o, { needsALook: null });
			expect(result.done).toBe(true);
			expect(editor.history.queue.length).toBe(steps + 1);
			const item = editor.project.glyphs[FOLLOW_IDS.o];
			expect(item).toBe(o);
			expect(sketchOf(item).setAside).toBe(false);
			expectInSync(item, editor.project, 'after the fix step');
			expect(
				Math.abs(item.maxes.yMax - (guideLines(font).small + guideLines(font).overshoot))
			).toBeLessThanOrEqual(1.5);
			editor.history.addState('Nothing changed');
			expect(sketchOf(item).setAside).toBe(false);
		} finally {
			setModeForTests('all');
		}
	});

	it('a sketch set aside is never moved and its hash never stored', () => {
		const editor = followEditor();
		const item = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		const sketch = sketchOf(item);
		sketch.setAside = true;
		sketch.builtHash = 'c0:00000000';
		const result = followShapes(item, { matrix: translate(40, 0) });
		expect(result).toEqual({ moved: false, rebuilt: false });
		expect(sketchOf(item).points.foot.x).toBe(120);
		expect(sketchOf(item).builtHash).toBe('c0:00000000');
	});

	it('a plan that is no matrix changes nothing and never throws', () => {
		const editor = followEditor();
		const item = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		const before = JSON.stringify(sketchOf(item));
		expect(followShapes(item, { matrix: 'up' })).toEqual({ moved: false, rebuilt: false });
		expect(followShapes(item, null)).toEqual({ moved: false, rebuilt: false });
		expect(JSON.stringify(sketchOf(item))).toBe(before);
	});
});

describe('Flip turns the aims and swaps the sides (SKETCH.md section 8)', () => {
	it('left-right: aim.dir 70 becomes 110, the arc bends the other way; upside-down: 290', () => {
		const editor = followEditor();
		const n = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		flipLetter(n, 'leftRight', { project: editor.project });
		expect(sketchOf(n).points.join.aim.dir).toBeCloseTo(110, 9);
		flipLetter(n, 'leftRight', { project: editor.project });
		expect(sketchOf(n).points.join.aim.dir).toBeCloseTo(70, 9);
		flipLetter(n, 'upsideDown', { project: editor.project });
		expect(sketchOf(n).points.join.aim.dir).toBeCloseTo(290, 9);
		const b = builtLetter(editor, FOLLOW_IDS.B, bCenter());
		const bulges = () =>
			sketchOf(b)
				.pieces.flatMap((piece) => piece.parts)
				.filter((part) => part.type === 'arc')
				.map((part) => part.bulge);
		const was = bulges();
		expect(was.length).toBeGreaterThan(0);
		flipLetter(b, 'leftRight', { project: editor.project });
		expect(bulges()).toEqual(was.map((bulge) => -bulge));
	});

	it('left-right keeps the writing-line pins (feet still on the line)', () => {
		const editor = followEditor();
		const n = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		flipLetter(n, 'leftRight', { project: editor.project });
		const { foot, rightFoot, stemTop } = sketchOf(n).points;
		expect([foot.on, rightFoot.on, stemTop.on]).toEqual(['writing', 'writing', 'small']);
		expect(Math.round(n.maxes.yMin)).toBe(0);
	});
});

describe('Match size keeps the thickness (keep_weight.js sketchStroke)', () => {
	/** a sketch drawn too small: every point at 0.8 from the writing line, pins taken off */
	function shrunk(sketch) {
		const points = {};
		for (const [id, point] of Object.entries(sketch.points)) {
			const next = { ...point, x: Math.round(point.x * 0.8), y: Math.round(point.y * 0.8) };
			delete next.on;
			delete next.inset;
			delete next.lock;
			points[id] = next;
		}
		const pieces = sketch.pieces.map((piece) =>
			piece.circle
				? {
						...piece,
						circle: {
							cx: piece.circle.cx * 0.8,
							cy: piece.circle.cy * 0.8,
							rx: piece.circle.rx * 0.8,
							ry: piece.circle.ry * 0.8,
						},
				  }
				: piece
		);
		return { ...sketch, points, pieces };
	}

	it('Centerline o: Match size brings it to its line with the same thickness', () => {
		const editor = followEditor();
		const font = editor.project.settings.font;
		const o = builtLetter(editor, FOLLOW_IDS.o, shrunk(storedSketch('o')));
		expect(sketchStroke(o, font)).toBe(99);
		const plan = sizePlan(o, font);
		expect(plan).not.toBeNull();
		applyPlan(o, plan);
		expectInSync(o, editor.project, 'after Match size');
		const lines = guideLines(font);
		const { body } = measureLetter(o, font);
		expect(Math.abs(body.top - (lines.small + lines.overshoot))).toBeLessThanOrEqual(1.5);
		expect(Math.abs(body.bottom - (lines.writing - lines.overshoot))).toBeLessThanOrEqual(1.5);
		// the thickness never scaled: the ring is still 99 wide at its side
		expect(sketchOf(o).thickness).toBe(99);
		const [outer, inner] = builtShapes(o)
			.map((shape) => shape.maxes)
			.sort((a, b) => b.xMax - b.xMin - (a.xMax - a.xMin));
		expect(Math.abs(inner.xMin - outer.xMin - 99)).toBeLessThanOrEqual(1);
		expect(Math.abs(outer.xMax - inner.xMax - 99)).toBeLessThanOrEqual(1);
	});

	it('Outline o: Match size keeps both stroke widths within 1 unit', () => {
		const editor = followEditor();
		const font = editor.project.settings.font;
		const o = builtLetter(editor, FOLLOW_IDS.o, shrunk(oOutline()));
		expect(sketchStroke(o, font)).toBeNull();
		const walls = () => {
			const [outer, inner] = builtShapes(o)
				.map((shape) => shape.maxes)
				.sort((a, b) => b.xMax - b.xMin - (a.xMax - a.xMin));
			return {
				left: inner.xMin - outer.xMin,
				right: outer.xMax - inner.xMax,
				bottom: inner.yMin - outer.yMin,
				top: outer.yMax - inner.yMax,
			};
		};
		const was = walls();
		const plan = sizePlan(o, font);
		expect(plan).not.toBeNull();
		expect(plan.grow).not.toBe(0);
		applyPlan(o, plan);
		expectInSync(o, editor.project, 'after Match size');
		const now = walls();
		for (const side of ['left', 'right', 'bottom', 'top']) {
			expect(Math.abs(now[side] - was[side]), side).toBeLessThanOrEqual(1);
		}
		// it grew to its line
		const lines = guideLines(font);
		expect(Math.abs(o.maxes.yMax - (lines.small + lines.overshoot))).toBeLessThanOrEqual(2);
	});

	it('Outline B: a grow pushes the outer loop out and the inside loops in', () => {
		const editor = followEditor();
		const b = builtLetter(editor, FOLLOW_IDS.B, bOutline());
		const boxes = () =>
			builtShapes(b).map(({ maxes }) => ({
				xMin: maxes.xMin,
				xMax: maxes.xMax,
				yMin: maxes.yMin,
				yMax: maxes.yMax,
			}));
		const before = boxes();
		applyPlan(b, { k: 1, ox: 0, oy: 0, dx: 0, dy: 0, grow: 10 });
		expectInSync(b, editor.project, 'after the grow');
		const after = boxes();
		const width = (m) => m.xMax - m.xMin;
		const order = (list) => [...list].sort((p, q) => width(q) - width(p));
		const [outerB, ...innerB] = order(before);
		const [outerA, ...innerA] = order(after);
		expect(width(outerA) - width(outerB)).toBeCloseTo(20, 0);
		innerA.forEach((m, i) => expect(width(m) - width(innerB[i])).toBeCloseTo(-20, 0));
	});
});

describe('Shrink to fit on a Centerline letter keeps its thickness and its feet', () => {
	it('a sketched l that pokes past the top line comes back under it, feet on the line', () => {
		const editor = followEditor();
		const font = editor.project.settings.font;
		const lines = guideLines(font);
		const tall = {
			...storedSketch('n'),
			key: 'sk_follow_tall',
			points: {
				foot: { x: 120, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
				top: { x: 120, y: lines.top + 150, kind: 'corner' },
			},
			pieces: [
				{
					id: 1,
					key: 'pc_tall',
					use: 'center',
					closed: false,
					parts: [{ type: 'line', from: 'foot', to: 'top' }],
				},
			],
			relations: [],
		};
		const item = builtLetter(editor, FOLLOW_IDS.n, tall);
		const plan = shrinkPlan(item, font);
		expect(plan).not.toBeNull();
		applyPlan(item, plan);
		expectInSync(item, editor.project, 'after Shrink to fit');
		expect(item.maxes.yMax).toBeLessThanOrEqual(lines.top + 1);
		expect(Math.abs(item.maxes.yMin)).toBeLessThanOrEqual(1);
		expect(sketchOf(item).points.foot.on).toBe('writing');
	});
});

describe('B15: a moved line carries the points pinned to it', () => {
	it('the small-letter line 50 up: the n stem top and arch top go with it; the feet stay', () => {
		const editor = followEditor();
		const font = editor.project.settings.font;
		const n = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		const was = sketchOf(n).points;
		const inkTop = n.maxes.yMax;
		font.xHeight = STORED_FONT.xHeight + 50;
		const changed = followLine(editor.project, 'small', STORED_FONT.xHeight, font.xHeight);
		expect(changed).toEqual([n]);
		const now = sketchOf(n).points;
		expect(now.stemTop.y - was.stemTop.y).toBe(50);
		expect(now.archTop.y - was.archTop.y).toBe(50);
		expect(now.foot.y).toBe(was.foot.y);
		expect(now.shoulder.y).toBe(was.shoulder.y);
		expect(Math.abs(n.maxes.yMax - (inkTop + 50))).toBeLessThanOrEqual(1);
		expectInSync(n, editor.project, 'after the line moved');
	});

	it('inside a whole-font step: one Undo puts the line, the sketch and the ink back', () => {
		const editor = followEditor();
		const font = editor.project.settings.font;
		const n = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		const before = JSON.stringify(n.save());
		editor.history.addWholeProjectChangePreState('Moved the small-letter line', { itemID: null });
		font.xHeight = STORED_FONT.xHeight + 40;
		editor.history.addWholeProjectChangePostState();
		const moved = editor.project.glyphs[FOLLOW_IDS.n];
		expect(sketchOf(moved).points.stemTop.y).toBe(storedSketch('n').points.stemTop.y + 40);
		expectInSync(moved, editor.project, 'in the step');
		editor.history.restoreState();
		expect(editor.project.settings.font.xHeight).toBe(STORED_FONT.xHeight);
		expect(JSON.stringify(editor.project.glyphs[FOLLOW_IDS.n].save())).toBe(before);
	});

	it('a line that did not move changes no letter', () => {
		const editor = followEditor();
		builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		expect(followLine(editor.project, 'small', 1100, 1100)).toEqual([]);
		expect(followLine(editor.project, 'capitals', 1480, 1490)).toEqual([]);
	});
});

describe('freshly sketched letters need no fix (penAllowance 0, SKETCH.md section 6)', () => {
	for (const [name, make] of [
		['o', () => storedSketch('o')],
		['n', () => storedSketch('n')],
		['v', () => vCenter()],
		['A', () => storedSketch('A')],
	]) {
		it(`${name}: on the line and the right size: no Sit on the line, no Match size`, () => {
			const editor = followEditor();
			const font = editor.project.settings.font;
			const item = builtLetter(editor, FOLLOW_IDS[name], make());
			const measures = measureLetter(item, font);
			const found = findChecks(item, measures, { font }).map((check) => check.id);
			expect(found).not.toContain(CHECK.offLine);
			expect(found).not.toContain(CHECK.size);
			expect(seatPlan(item, font)).toBeNull();
			// the body bottom is where its class sits, to the unit
			const lines = guideLines(font);
			const round = name === 'o';
			expect(Math.abs(measures.lineAt - (round ? -lines.overshoot : 0))).toBeLessThanOrEqual(1);
		});
	}

	it('a shape a sketch built gets no half-nib allowance, even with a stroke tag', () => {
		const editor = followEditor();
		const item = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		item.anyink.nib = {
			strokes: [{ id: 1, key: 'k1', parts: 1, nib: 'round', size: 99, skeleton: [], at: [0, 0] }],
		};
		const shape = builtShapes(item)[0];
		shape.anyink = { ...shape.anyink, strokeId: 1, strokeKey: 'k1', strokePart: 0 };
		const allowance = penAllowance(item);
		const contour = pathContour(shape);
		expect(allowance({ contours: [contour], yMin: 0, yMax: 1000 })).toBe(0);
		// the same shape as plain Brush ink gets its half nib
		untagBuilt(shape);
		expect(penAllowance(item)({ contours: [contour], yMin: 0, yMax: 1000 })).toBe(49.5);
	});
});
