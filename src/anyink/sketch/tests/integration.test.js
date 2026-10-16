// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 integration (docs/SKETCH.md section 11): the S1 pieces agree with each other on five stored
	sketches (n, o, s, A, a circle; fixtures/stored_sketches.js), with no stand-ins:
	  - model.js validates them; edge_rule.js finds them already placed
	  - curves.js builds every piece through every one of its points; extremes.js's lock rule
	    agrees with the locks stored on them, and curves.js meets each lock's direction
	  - curves.js -> nib/sweep.js: ink edges on their lines within 1 unit (round tops and bottoms
	    one overshoot past), the edge rule's promise
	  - curves.js -> bumpy.js: none of them is bumpy; a shaky Spline is
	  - model + sketch_record + history_hook through real History steps, with the 'sketch' flag
	    off and on: the same steps give the same letters either way, a letter with no sketch is
	    never touched, the real swept ink is never set aside by a step that did not change it
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { B, R, square, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests, isFeatureOn } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { inkSkeleton } from '../../nib/ink.js';
import { strokePaths } from '../../nib/stroke_shapes.js';
import { sweepRoundNib } from '../../nib/sweep.js';
import { guideLines } from '../../placement/classes.js';
import { showItem } from '../../preview/show_item.js';
import { bumpyPieces } from '../bumpy.js';
import { endDirection, pieceSkeleton, startDirection } from '../curves.js';
import { placeEdgePoints } from '../edge_rule.js';
import { lockFor } from '../extremes.js';
import { piecePointIds, setSketch, sketchOf, validateSketch } from '../model.js';
import { builtMatches, isBuiltShape, markBuilt, tagBuilt } from '../sketch_record.js';
import {
	STORED_FONT,
	STORED_NAMES,
	storedSketch,
	storedSketches,
} from './fixtures/stored_sketches.js';

const LINES = guideLines(STORED_FONT);
const O = LINES.overshoot;
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** smallest angle between two directions, degrees */
const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

function inkOf(sketch, filter = () => true) {
	return sketch.pieces
		.filter(filter)
		.flatMap((piece) => sweepRoundNib(pieceSkeleton(piece, sketch), sketch.thickness))
		.flat();
}

function inkExtreme(ink, x, reach, which) {
	const ys = ink.filter(([px]) => Math.abs(px - x) <= reach).map(([, y]) => y);
	return which === 'top' ? Math.max(...ys) : Math.min(...ys);
}

describe('the stored sketches, through model.js and edge_rule.js', () => {
	for (const name of STORED_NAMES) {
		it(`${name} is a valid v1 sketch, already placed by the edge rule`, () => {
			const sketch = storedSketch(name);
			expect(validateSketch(sketch)).toEqual({ ok: true, problems: [], newer: false });
			const placed = placeEdgePoints(sketch, STORED_FONT);
			for (const id of Object.keys(sketch.points)) {
				expect(placed.points[id], `${name} ${id}`).toBe(sketch.points[id]);
			}
		});
	}
});

describe('curves.js builds every piece; extremes.js agrees with the stored locks', () => {
	for (const name of STORED_NAMES) {
		it(`${name}: every cubic joins the next, and the curve passes through every point`, () => {
			const sketch = storedSketch(name);
			for (const piece of sketch.pieces) {
				const cubics = pieceSkeleton(piece, sketch);
				expect(cubics.length).toBeGreaterThan(0);
				for (let i = 1; i < cubics.length; i++) {
					expect(near(cubics[i - 1][3], cubics[i][0])).toBeLessThan(1e-9);
				}
				if (piece.closed) expect(near(cubics.at(-1)[3], cubics[0][0])).toBeLessThan(1e-9);
				const ends = cubics.flatMap((c) => [c[0], c[3]]);
				for (const id of piecePointIds(piece)) {
					const p = [sketch.points[id].x, sketch.points[id].y];
					const miss = Math.min(...ends.map((e) => near(e, p)));
					expect(miss, `${name} ${id}`).toBeLessThan(1e-6);
				}
			}
		});

		it(`${name}: each stored lock is the one the rule gives, and the curve meets it`, () => {
			const sketch = storedSketch(name);
			for (const piece of sketch.pieces) {
				const cubics = pieceSkeleton(piece, sketch);
				for (const id of piecePointIds(piece)) {
					const point = sketch.points[id];
					if (!point.lock) continue;
					expect(lockFor(id, piece, sketch), `${name} ${id}`).toBe(point.lock);
					const p = [point.x, point.y];
					const want = point.lock === 'level' ? 0 : 90;
					const leaving = cubics.find((c) => near(c[0], p) < 1e-6);
					const arriving = cubics.find((c) => near(c[3], p) < 1e-6);
					for (const dir of [
						leaving && startDirection(leaving),
						arriving && endDirection(arriving),
					]) {
						if (dir === undefined) continue;
						// level: 0 or 180; plumb: 90 or 270; within 0.1 degree
						expect(
							Math.min(apart(dir, want), apart(dir, want + 180)),
							`${name} ${id}`
						).toBeLessThan(0.1);
					}
				}
			}
		});
	}
});

describe('curves.js -> the round nib: the ink edge sits on the line', () => {
	it('n: feet on the writing line, the stem top on the small-letter line, the arch overshoots', () => {
		const n = storedSketch('n');
		const r = n.thickness / 2;
		const stem = inkOf(n, (piece) => piece.id === 1);
		const arch = inkOf(n, (piece) => piece.id === 2);
		expect(Math.abs(inkExtreme(stem, 120, r, 'bottom'))).toBeLessThanOrEqual(1);
		expect(Math.abs(inkExtreme(stem, 120, r, 'top') - LINES.small)).toBeLessThanOrEqual(1);
		expect(Math.abs(inkExtreme(arch, 560, r, 'bottom'))).toBeLessThanOrEqual(1);
		expect(Math.abs(inkExtreme(arch, 340, 2 * r, 'top') - (LINES.small + O))).toBeLessThanOrEqual(
			1
		);
		// the arch's highest ink is at its round top, nowhere higher
		expect(Math.max(...arch.map(([, y]) => y))).toBeLessThanOrEqual(LINES.small + O + 1);
	});

	it('o and s: round tops and bottoms one overshoot past the lines', () => {
		for (const name of ['o', 's']) {
			const ink = inkOf(storedSketch(name));
			const ys = ink.map(([, y]) => y);
			expect(Math.abs(Math.max(...ys) - (LINES.small + O)), name).toBeLessThanOrEqual(1);
			expect(Math.abs(Math.min(...ys) - (LINES.writing - O)), name).toBeLessThanOrEqual(1);
		}
	});

	it('A: the apex on the capitals line, the feet on the writing line, no overshoot', () => {
		const a = storedSketch('A');
		const ink = inkOf(a);
		const r = a.thickness / 2;
		expect(Math.abs(Math.max(...ink.map(([, y]) => y)) - LINES.capitals)).toBeLessThanOrEqual(1);
		expect(Math.abs(inkExtreme(ink, 60, 2 * r, 'bottom'))).toBeLessThanOrEqual(1);
		expect(Math.abs(inkExtreme(ink, 980, 2 * r, 'bottom'))).toBeLessThanOrEqual(1);
	});

	it('the circle is round: every ink point within the nib of the circle', () => {
		const c = storedSketch('circle');
		const { cx, cy, rx } = c.pieces[0].circle;
		const r = c.thickness / 2;
		for (const [x, y] of inkOf(c)) {
			const off = Math.abs(Math.hypot(x - cx, y - cy) - rx);
			expect(Math.abs(off - r)).toBeLessThan(1.5);
		}
	});
});

describe('curves.js -> bumpy.js', () => {
	it('none of the stored sketches is bumpy', () => {
		for (const [name, sketch] of Object.entries(storedSketches())) {
			expect(bumpyPieces(sketch, pieceSkeleton), name).toEqual([]);
		}
	});

	it('a Spline through a shaky hand (40 units up and down) is bumpy, its smooth twin is not', () => {
		const make = (shake) => {
			const points = {};
			const ids = [];
			for (let i = 0; i <= 30; i++) {
				const id = `w${i}`;
				points[id] = { x: 60 * i, y: 500 + (i % 2 ? shake : -shake), kind: 'smooth' };
				ids.push(id);
			}
			return {
				...storedSketch('s'),
				points,
				pieces: [
					{
						id: 1,
						key: 'pc_w',
						use: 'center',
						closed: false,
						parts: [{ type: 'spline', points: ids }],
					},
				],
			};
		};
		const shaky = make(20);
		expect(validateSketch(shaky).ok).toBe(true);
		const found = bumpyPieces(shaky, pieceSkeleton);
		expect(found).toHaveLength(1);
		expect(found[0].bumps).toBeGreaterThanOrEqual(3);
		expect(found[0].perThousand).toBeGreaterThan(4);
		expect(bumpyPieces(make(0), pieceSkeleton)).toEqual([]);
	});
});

// ---- model + record + hook through real History steps ----

/** The n sketch built for real: curves -> the Brush's ink -> tagged shapes, hashed */
function buildN(item) {
	const sketch = storedSketch('n');
	setSketch(item, sketch);
	for (const piece of sketch.pieces) {
		const skeleton = pieceSkeleton(piece, sketch).map((c) =>
			c.map(([x, y]) => [Math.round(x), Math.round(y)])
		);
		const ink = inkSkeleton(skeleton, sketch.thickness);
		strokePaths(ink.contours, { name: `Sketch ${piece.id}` }).forEach((path, part) => {
			tagBuilt(item.addOneShape(path), { id: piece.id, key: sketch.key, part });
		});
	}
	markBuilt(item);
	return item;
}

/** The same steps, start to end; returns what the letters held after each */
function runSteps() {
	const editor = twoLetterEditor();
	const seen = [];
	const look = (label) => {
		const b = editor.project.glyphs[B];
		seen.push({
			label,
			setAside: sketchOf(b)?.setAside ?? null,
			matches: builtMatches(b),
			built: b.shapes.map(isBuiltShape),
			b: JSON.stringify(b.save()),
			r: JSON.stringify(editor.project.glyphs[R].save()),
		});
	};
	showItem(editor, R);
	editor.selectedItem.addOneShape(square());
	editor.history.addState('Drew on r');
	look('plain r');
	showItem(editor, B);
	buildN(editor.selectedItem);
	editor.history.addState('Sketched');
	look('sketched');
	editor.history.addState('Nothing changed');
	look('a step that changed nothing');
	const item = editor.selectedItem;
	item.addOneShape(item.shapes[0].save());
	editor.history.addState('Pasted shapes');
	look('pasted');
	item.shapes[1].pathPoints[0].p.x += 40;
	editor.history.addState('Moved a point');
	look('edited behind its back');
	editor.history.restoreState();
	look('undo');
	editor.history.redoState();
	look('redo');
	return { editor, seen };
}

describe('model + sketch_record + history_hook through History, flag off and on', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('the flag is on as shipped (S4), and the same steps give the same letters off and on', () => {
		expect(isFeatureOn('sketch')).toBe(true);
		setFeaturesForTests({ sketch: false });
		expect(isFeatureOn('sketch')).toBe(false);
		const off = runSteps().seen;
		setFeaturesForTests({ sketch: true });
		expect(isFeatureOn('sketch')).toBe(true);
		const on = runSteps().seen;
		// stamps (sketch.at is fixed; shapes carry no time) make the saves comparable
		expect(on).toEqual(off);
	});

	it('what each step did to the real swept ink of a stored n', () => {
		const { editor, seen } = runSteps();
		const at = Object.fromEntries(seen.map((s) => [s.label, s]));
		// small r has no sketch and was never touched
		expect(editor.project.glyphs[R].anyink?.sketch).toBeUndefined();
		expect(at['plain r'].r).not.toMatch(/sketch/);
		// the built ink matches its hash and stays matched through a step that changed nothing
		expect(at.sketched.built.length).toBeGreaterThanOrEqual(2);
		expect(at.sketched.built.every(Boolean)).toBe(true);
		expect(at.sketched).toMatchObject({ setAside: false, matches: true });
		expect(at['a step that changed nothing']).toMatchObject({ setAside: false, matches: true });
		// a pasted copy is plain ink inside its own step
		expect(at.pasted.built.at(-1)).toBe(false);
		expect(at.pasted.built.slice(0, -1).every(Boolean)).toBe(true);
		expect(at.pasted.setAside).toBe(false);
		// a built shape changed behind the sketch's back sets it aside; Undo and Redo agree
		expect(at['edited behind its back'].setAside).toBe(true);
		expect(at.undo).toMatchObject({ setAside: false, matches: true });
		expect(at.redo.setAside).toBe(true);
	});

	// Probed 10/16/2026 (S1): in Simple the first step refits spacing after the hook (x 100 -> 40
	// on a built square), so the next step set the sketch aside. S3's follow plan fixes it.
	it("S3: in Simple, spacing's refit inside a step moves the sketch with its ink and re-marks the hash", () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		Object.assign(editor.project.settings.font, STORED_FONT);
		showItem(editor, B);
		const item = editor.selectedItem;
		buildN(item);
		const pinsBefore = JSON.stringify(
			Object.values(sketchOf(item).points).map((point) => [point.on, point.inset, point.y])
		);
		const stemBefore = sketchOf(item).points.foot.x;
		const inkBefore = item.shapes[0].pathPoints[0].p.x;
		editor.history.addState('Sketched');
		// the refit moved the ink sideways inside the step, and the sketch with it
		const moved = item.shapes[0].pathPoints[0].p.x - inkBefore;
		expect(moved).not.toBe(0);
		expect(sketchOf(item).points.foot.x - stemBefore).toBe(moved);
		expect(builtMatches(item)).toBe(true);
		// a move sideways keeps every pin and every height
		expect(
			JSON.stringify(
				Object.values(sketchOf(item).points).map((point) => [point.on, point.inset, point.y])
			)
		).toBe(pinsBefore);
		// the next step finds the ink the sketch built: never set aside
		editor.history.addState('Nothing changed');
		expect(sketchOf(item).setAside).toBe(false);
		expect(builtMatches(item)).toBe(true);
		// the moved sketch builds the moved ink (within 1 unit)
		const rebuilt = editor.project.glyphs[R];
		buildN(rebuilt);
		const now = sketchOf(item);
		setSketch(rebuilt, now);
		const ink = item.shapes.flatMap((shape) => shape.pathPoints.map((p) => [p.p.x, p.p.y]));
		rebuilt.shapes = [];
		for (const piece of now.pieces) {
			const skeleton = pieceSkeleton(piece, now).map((c) =>
				c.map(([x, y]) => [Math.round(x), Math.round(y)])
			);
			strokePaths(inkSkeleton(skeleton, now.thickness).contours, {}).forEach((path) =>
				rebuilt.addOneShape(path)
			);
		}
		const fresh = rebuilt.shapes.flatMap((shape) => shape.pathPoints.map((p) => [p.p.x, p.p.y]));
		expect(fresh.length).toBe(ink.length);
		fresh.forEach((point, i) => expect(near(point, ink[i])).toBeLessThanOrEqual(1));
		setModeForTests('all');
	});

	it('the hook leaves a font with no sketch byte-for-byte as the step made it', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		editor.selectedItem.addOneShape(square());
		const before = JSON.stringify(editor.selectedItem.save());
		editor.history.addState('Drew');
		expect(JSON.stringify(editor.selectedItem.save())).toBe(before);
	});
});
