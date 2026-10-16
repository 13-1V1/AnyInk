// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 thickness (docs/SKETCH.md section 3 "Thickness", section 6 "The edge rule"): the readout in
	inches on 1 in capitals, the range, a sketch at another thickness (edge points and arc tops
	placed again, the stored sketch untouched), the real-sweep preview, and the slider's step on
	release (one item step, the font's thickness set, the ink rebuilt inside it, Undo puts it back).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLines } from '../../placement/classes.js';
import { arcDirs } from '../arc.js';
import { pieceSkeleton, startDirection } from '../curves.js';
import { edgeThickness } from '../edge_rule.js';
import { newSketch, sketchOf, thicknessRange } from '../model.js';
import { builtMatches } from '../sketch_record.js';
import { arcExtreme } from '../tools/arc_snap.js';
import {
	clampThickness,
	commitThickness,
	hasCenterline,
	hasOpenCenterline,
	letterThickness,
	lettersAtOtherThickness,
	previewOutlines,
	sketchedLetters,
	slideTangentTops,
	thicknessInches,
	thicknessReadout,
	withThickness,
} from '../thickness.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';
import { N_ID, R_ID, S_ID, sketchedEditor, stemBox, stemWidth } from './thickness_fixture.js';

const LINES = guideLines(STORED_FONT);
const project = (font = STORED_FONT, anyink = {}) => ({ settings: { font, anyink } });

beforeEach(() => {
	setModeForTests('simple');
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('the readout: inches on 1 in capitals, never typed', () => {
	it('99 units with the capitals line at 1,400 reads 0.07 in (SKETCH.md section 3)', () => {
		const font = { ...STORED_FONT, capHeight: 1400 };
		expect(thicknessInches(project(font), 99)).toBe('0.07');
		expect(thicknessReadout(project(font), 99)).toBe('0.07 in wide on 1 in capitals');
	});

	it('reads the ink the build really makes: never wider than the small-letter height', () => {
		const font = { ...STORED_FONT, xHeight: 300, capHeight: 1500 };
		// edgeThickness caps 400 at the slider's thick end (24 % of 300 = 72)
		expect(edgeThickness(font, 400)).toBe(72);
		expect(thicknessInches(project(font), 400)).toBe((72 / 1500).toFixed(2));
	});

	it('a font with no capitals line reads 0.00, never NaN', () => {
		expect(thicknessInches(project({ ...STORED_FONT, capHeight: 0 }), 99)).toBe('0.00');
	});
});

describe("the range and the letter's thickness", () => {
	it('clamps to the Brush range, whole units (MIN_SHARE 3 % to MAX_SHARE 24 % of x height)', () => {
		const p = project();
		const { min, max } = thicknessRange(p);
		expect(min).toBe(Math.round(0.03 * 1100));
		expect(max).toBe(Math.round(0.24 * 1100));
		expect(clampThickness(p, 5)).toBe(min);
		expect(clampThickness(p, 9999)).toBe(max);
		expect(clampThickness(p, 120.4)).toBe(120);
		expect(clampThickness(p, NaN)).toBe(min);
	});

	it("a letter keeps its own; one with none reads the font's", () => {
		const p = project(STORED_FONT, { sketchThickness: 140 });
		const item = { anyink: { sketch: { ...storedSketch('n'), thickness: 99 } } };
		expect(letterThickness(item, p)).toBe(99);
		expect(letterThickness({ anyink: { sketch: newSketch() } }, p)).toBe(140);
	});

	it('Centerline ink: helpers, hidden and Outline pieces do not count', () => {
		const n = storedSketch('n');
		expect(hasCenterline(n)).toBe(true);
		expect(hasOpenCenterline(n)).toBe(true);
		expect(hasOpenCenterline(storedSketch('o'))).toBe(false);
		const helper = { ...n, pieces: n.pieces.map((piece) => ({ ...piece, use: 'helper' })) };
		expect(hasCenterline(helper)).toBe(false);
		const outline = { ...n, pieces: n.pieces.map((piece) => ({ ...piece, use: 'outline' })) };
		expect(hasCenterline(outline)).toBe(false);
		const hidden = { ...n, pieces: n.pieces.map((piece) => ({ ...piece, hidden: true })) };
		expect(hasCenterline(hidden)).toBe(false);
	});
});

describe('a sketch at another thickness: the ink edge stays on its line', () => {
	it('every edge point moves by half the change; the stored sketch is left as it was', () => {
		const n = storedSketch('n');
		const before = JSON.stringify(n);
		const thick = withThickness(n, project(), 200);
		expect(JSON.stringify(n)).toBe(before);
		expect(thick.thickness).toBe(200);
		// feet: the writing line + r
		expect(thick.points.foot.y).toBe(LINES.writing + 100);
		expect(thick.points.rightFoot.y).toBe(LINES.writing + 100);
		// the stem's top: the small-letter line - r
		expect(thick.points.stemTop.y).toBe(LINES.small - 100);
		// the round arch top: the small-letter line - r + overshoot
		expect(thick.points.archTop.y).toBe(Math.round(LINES.small - 100 + LINES.overshoot));
		// points that are not pinned stay where they are
		expect(thick.points.shoulder).toEqual(n.points.shoulder);
		expect(thick.points.join).toEqual(n.points.join);
	});

	it('a 3-point Arc whose top was put on the small-letter line keeps it there (build.js)', () => {
		const sketch = arcSketch({ tangent: false });
		const at99 = topOf(sketch);
		expect(at99).toBeCloseTo(LINES.small - 49.5 + LINES.overshoot, 0);
		const thick = withThickness(sketch, project(), 200);
		const part = thick.pieces[0].parts[0];
		// the ends never move; the bend does
		expect(thick.points.a).toEqual(sketch.points.a);
		expect(thick.points.b).toEqual(sketch.points.b);
		expect(part.bulge).not.toBe(sketch.pieces[0].parts[0].bulge);
		expect(topOf(thick)).toBeCloseTo(LINES.small - 100 + LINES.overshoot, 1);
	});

	it('a tangent Arc keeps its way in and slides its end round its circle to the line', () => {
		const sketch = tangentSketch();
		const thick = withThickness(sketch, project(), 200);
		const arc = thick.pieces[0].parts[1];
		const p0 = [thick.points.b.x, thick.points.b.y];
		const p1 = [thick.points.c.x, thick.points.c.y];
		// the end moved; the stem it leaves did not
		expect(thick.points.c).not.toEqual(sketch.points.c);
		expect(thick.points.b).toEqual(sketch.points.b);
		const extreme = arcExtreme(p0, p1, arc.bulge, 'top');
		expect(extreme.y).toBeCloseTo(LINES.small - 100 + LINES.overshoot, 0);
		// it still leaves the stem straight up (tangent)
		expect(arcDirs(p0, p1, arc.bulge).start).toBeCloseTo(90, 0);
		const cubics = pieceSkeleton(thick.pieces[0], thick);
		expect(startDirection(cubics[1])).toBeCloseTo(90, 0);
	});

	it('a tangent Arc whose end another piece shares never moves that end', () => {
		const sketch = tangentSketch();
		sketch.pieces.push({
			id: 2,
			key: 'pc_leg',
			use: 'center',
			closed: false,
			parts: [{ type: 'line', from: 'c', to: 'd' }],
		});
		sketch.points.d = { x: 700, y: 50, kind: 'corner', on: 'writing', inset: 'edge' };
		const slid = slideTangentTops({ ...sketch, thickness: 200 }, STORED_FONT);
		expect(slid.points.c).toEqual(sketch.points.c);
	});
});

describe('the preview: the real sweep at the new thickness, no refit', () => {
	it('the n at 200: the stem is 200 wide and its ink still stands on the writing line', () => {
		const n = storedSketch('n');
		const outlines = previewOutlines(n, project(), 200);
		expect(outlines.length).toBeGreaterThan(0);
		const stem = outlines.flat().filter(([x, y]) => Math.abs(x - 120) < 150 && y < 400);
		const xs = stem.map(([x]) => x);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(195);
		expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(205);
		const ys = outlines.flat().map(([, y]) => y);
		expect(Math.min(...ys)).toBeGreaterThan(LINES.writing - 1.5);
		expect(Math.min(...ys)).toBeLessThan(LINES.writing + 1.5);
	});

	it('an Outline-only sketch has nothing to preview', () => {
		const o = storedSketch('o');
		o.pieces = o.pieces.map((piece) => ({ ...piece, use: 'outline' }));
		expect(previewOutlines(o, project(), 150)).toEqual([]);
	});
});

describe("the font's sketched letters", () => {
	it('lists letters with Centerline ink and the ones at another thickness', () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99, [R_ID]: 140, [S_ID]: 99 } });
		expect(sketchedLetters(editor.project).map(({ id }) => id)).toEqual([N_ID, R_ID, S_ID]);
		expect(lettersAtOtherThickness(editor.project, 99).map(({ id }) => id)).toEqual([R_ID]);
		expect(
			lettersAtOtherThickness(editor.project, 140, { except: R_ID }).map(({ id }) => id)
		).toEqual([N_ID, S_ID]);
		sketchOf(editor.project.getItem(S_ID)).setAside = true;
		expect(lettersAtOtherThickness(editor.project, 140).map(({ id }) => id)).toEqual([N_ID]);
	});
});

describe("the slider's step on release (commitThickness)", () => {
	it('one item step names the letter, sets the font thickness and rebuilds the ink in it', () => {
		const editor = sketchedEditor();
		const item = editor.project.getItem(N_ID);
		// the refit's whole-number curves stay within a few units of the nib (2 %)
		expect(stemWidth(item)).toBeGreaterThan(97);
		expect(stemWidth(item)).toBeLessThan(103);
		const steps = editor.history.queue.length;
		expect(commitThickness(editor, 200)).toBe(true);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('changed the thickness of small n');
		expect(editor.project.settings.anyink.sketchThickness).toBe(200);
		expect(sketchOf(item).thickness).toBe(200);
		// the ink, rebuilt inside the step by History's sketch hook, is the new width ...
		expect(stemWidth(item)).toBeGreaterThan(197);
		expect(stemWidth(item)).toBeLessThan(205);
		// ... and its edge is still on the writing line and under the small-letter line
		expect(stemBox(item).yMin).toBeCloseTo(LINES.writing, -0.5);
		expect(stemBox(item).yMax).toBeCloseTo(LINES.small, -0.5);
		expect(builtMatches(item)).toBe(true);
		expect(sketchOf(item).setAside).toBe(false);
	});

	it('Undo puts the letter back as it was', () => {
		const editor = sketchedEditor();
		const item = () => editor.project.getItem(N_ID);
		const before = JSON.stringify(item().save());
		commitThickness(editor, 160);
		editor.history.restoreState();
		expect(JSON.stringify(item().save())).toBe(before);
		expect(sketchOf(item()).thickness).toBe(99);
	});

	it('the same thickness records nothing; a letter with no Centerline ink is no step', () => {
		const editor = sketchedEditor();
		const steps = editor.history.queue.length;
		expect(commitThickness(editor, 99)).toBe(false);
		expect(editor.history.queue.length).toBe(steps);
		const o = sketchOf(editor.project.getItem(N_ID));
		o.pieces = o.pieces.map((piece) => ({ ...piece, use: 'helper' }));
		expect(commitThickness(editor, 150)).toBe(false);
		expect(editor.history.queue.length).toBe(steps);
	});

	it("the font's thickness carries to the next new sketched letter", () => {
		const editor = sketchedEditor();
		commitThickness(editor, 180);
		expect(letterThickness(editor.project.getItem(R_ID), editor.project)).toBe(180);
	});
});

// ---- helpers ----

/** One open piece: a 3-point Arc from (100, 600) to (500, 600), its top on the small-letter line */
function arcSketch() {
	const sketch = newSketch({ thickness: 99, key: 'sk_arc' });
	sketch.points = {
		a: { x: 100, y: 600, kind: 'corner' },
		b: { x: 500, y: 600, kind: 'corner' },
	};
	const target = LINES.small - 49.5 + LINES.overshoot;
	sketch.pieces = [
		{
			id: 1,
			key: 'pc_a',
			use: 'center',
			closed: false,
			parts: [
				{
					type: 'arc',
					from: 'a',
					to: 'b',
					bulge: bulgeFor([100, 600], [500, 600], target),
					top: { on: 'small' },
				},
			],
		},
	];
	return sketch;
}

/** A plumb stem (a Line up) and a tangent Arc leaving its top, the arc's top on the line */
function tangentSketch() {
	const sketch = newSketch({ thickness: 99, key: 'sk_tan' });
	const r = 49.5;
	// a half circle of radius 200 leaving (300, 700) straight up, centered at (500, 700): its top
	// at 900; put the small-letter line target there by choosing the stem height
	const top = LINES.small - r + LINES.overshoot;
	const radius = 220;
	const y0 = top - radius;
	sketch.points = {
		a: { x: 300, y: 300, kind: 'corner' },
		b: { x: 300, y: Math.round(y0), kind: 'smooth' },
		c: { x: 300 + 2 * radius - 40, y: Math.round(y0 + 120), kind: 'corner' },
	};
	sketch.pieces = [
		{
			id: 1,
			key: 'pc_t',
			use: 'center',
			closed: false,
			parts: [
				{ type: 'line', from: 'a', to: 'b' },
				{ type: 'arc', from: 'b', to: 'c', bulge: -0.5, tangent: true, top: { on: 'small' } },
			],
		},
	];
	return sketch;
}

/** The arc's top y */
function topOf(sketch) {
	const part = sketch.pieces[0].parts[0];
	const p0 = [sketch.points[part.from].x, sketch.points[part.from].y];
	const p1 = [sketch.points[part.to].x, sketch.points[part.to].y];
	return arcExtreme(p0, p1, part.bulge, 'top').y;
}

/** The bulge of the arc over the chord (on the side its top is on) whose top is at y */
function bulgeFor(p0, p1, y) {
	const sign = arcExtreme(p0, p1, 0.5, 'top') ? 1 : -1;
	const bulgeOf = (sweep) => sign * Math.tan((sweep * Math.PI) / 180 / 4);
	let lo = 0;
	let hi = 358;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		const top = arcExtreme(p0, p1, bulgeOf(mid), 'top')?.y ?? Math.max(p0[1], p1[1]);
		if (top < y) lo = mid;
		else hi = mid;
	}
	return bulgeOf((lo + hi) / 2);
}
