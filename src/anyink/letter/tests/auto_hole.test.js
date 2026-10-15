// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 auto-hole (UX-BEGINNER.md 7.1 #5, section 10 B7 "Unit tests"): in Simple, a shape inside
// another becomes a hole, a dot inside that hole stays solid, a bullseye alternates, overlapping
// shapes stay solid, brush strokes never change. Ink is read the way the canvas and the font file
// fill (nonzero): windingAt() 0 is paper, anything else is ink.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { showItem } from '../../preview/show_item.js';
import {
	autoHole,
	autoHoleNewShape,
	canBeHole,
	containersOf,
	isBrushStroke,
	nestingDepth,
	roleForDepth,
	sayMadeHole,
	setShapeRole,
	shapeRole,
} from '../auto_hole.js';
import { box, letterWith, polygon, saved, stroke, windingAt } from './auto_hole_shapes.js';

describe('nesting depth decides the role', () => {
	it('odd depth is a hole, even depth is solid', () => {
		expect([0, 1, 2, 3, 4].map(roleForDepth)).toEqual(['solid', 'hole', 'solid', 'hole', 'solid']);
	});

	it('a shape inside another becomes a hole: the middle shows paper, the ring stays ink', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(150, 150, 450, 550));
		const [outer, inner] = shapes;
		expect(windingAt(glyph, 300, 350)).not.toBe(0); // both clockwise: no hole yet
		expect(nestingDepth(glyph, inner)).toBe(1);
		expect(containersOf(glyph, inner).map((entry) => entry.path)).toEqual([outer]);

		const result = autoHole(glyph, inner);

		expect(result).toMatchObject({ role: 'hole', depth: 1, changed: true, number: 2, also: [] });
		expect(windingAt(glyph, 300, 350)).toBe(0);
		expect(windingAt(glyph, 50, 350)).not.toBe(0);
		expect(shapeRole(glyph, inner)).toBe('hole');
		expect(shapeRole(glyph, outer)).toBe('solid');
	});

	it('a hole drawn the other way round already is left as it was drawn', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(150, 150, 450, 550, 'ccw'));
		const before = saved(shapes[1]);
		expect(autoHole(glyph, shapes[1])).toMatchObject({ role: 'hole', changed: false });
		expect(saved(shapes[1])).toBe(before);
	});

	it('a dot inside that hole stays solid, whichever way it was drawn', () => {
		['cw', 'ccw'].forEach((way) => {
			const { glyph, shapes } = letterWith(
				box(0, 0, 600, 700),
				box(150, 150, 450, 550, 'ccw'),
				box(250, 300, 350, 400, way)
			);
			const result = autoHole(glyph, shapes[2]);
			expect(result).toMatchObject({ role: 'solid', depth: 2, number: 3 });
			expect(windingAt(glyph, 300, 350)).not.toBe(0); // the dot is ink
			expect(windingAt(glyph, 200, 350)).toBe(0); // the hole around it is still paper
		});
	});

	it('a bullseye alternates: each ring drawn inside the last is hole, solid, hole', () => {
		const rings = [
			box(0, 0, 800, 800),
			box(100, 100, 700, 700),
			box(200, 200, 600, 600),
			box(300, 300, 500, 500),
		];
		const { glyph } = letterWith(rings[0]);
		const roles = [];
		rings.slice(1).forEach((ring) => {
			const added = glyph.addOneShape(ring);
			roles.push(autoHole(glyph, added).role);
		});
		expect(roles).toEqual(['hole', 'solid', 'hole']);
		// ink, paper, ink, paper from the outside in
		const ink = [50, 150, 250, 400].map((x) => windingAt(glyph, x, 400) !== 0);
		expect(ink).toEqual([true, false, true, false]);
	});

	it('overlapping shapes stay solid: a shape drawn the other way round takes the direction of the one it crosses', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 400, 400), box(300, 100, 700, 300, 'ccw'));
		expect(windingAt(glyph, 350, 200)).toBe(0); // as drawn, the overlap would show paper
		const result = autoHole(glyph, shapes[1]);
		expect(result).toMatchObject({ role: 'solid', depth: 0, changed: true, number: 2 });
		expect(windingAt(glyph, 350, 200)).not.toBe(0);
		expect(windingAt(glyph, 600, 200)).not.toBe(0);
		expect(shapeRole(glyph, shapes[1])).toBe('solid');
	});

	it('overlapping shapes already running the same way are left as drawn', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 400, 400), box(300, 100, 700, 300));
		const before = saved(shapes[1]);
		expect(autoHole(glyph, shapes[1])).toMatchObject({ role: 'solid', changed: false });
		expect(saved(shapes[1])).toBe(before);
	});

	it('a shape on its own is left as drawn, either way round', () => {
		['cw', 'ccw'].forEach((way) => {
			const { glyph, shapes } = letterWith(box(0, 0, 400, 400, way));
			const before = saved(shapes[0]);
			expect(autoHole(glyph, shapes[0])).toMatchObject({
				role: 'solid',
				depth: 0,
				changed: false,
				number: 1,
				merged: null,
				blocked: false,
				also: [],
			});
			expect(saved(shapes[0])).toBe(before);
		});
	});

	it('a shape that only pokes out of another is not inside it', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(400, 300, 800, 400));
		expect(nestingDepth(glyph, shapes[1])).toBe(0);
		expect(autoHole(glyph, shapes[1]).role).toBe('solid');
	});

	it('a triangle drawn with the Point pen inside a box becomes a hole too', () => {
		const { glyph, shapes } = letterWith(
			box(0, 0, 600, 600),
			polygon([
				[200, 200],
				[300, 400],
				[400, 200],
			])
		);
		expect(autoHole(glyph, shapes[1])).toMatchObject({ role: 'hole', depth: 1 });
		expect(windingAt(glyph, 300, 260)).toBe(0);
	});

	it('the shapes already in the letter are left as they are when the new one needs nothing of them', () => {
		const { glyph, shapes } = letterWith(
			box(0, 0, 800, 800),
			box(100, 100, 700, 700, 'ccw'), // a hole
			box(900, 0, 1000, 800) // beside them
		);
		const before = glyph.shapes.map(saved);
		const dot = glyph.addOneShape(box(300, 300, 500, 500));
		expect(autoHole(glyph, dot)).toMatchObject({ role: 'solid', merged: null, also: [] });
		expect(glyph.shapes.slice(0, 3).map(saved)).toEqual(before);
		expect(glyph.shapes.slice(0, 3)).toEqual(shapes);
	});
});

describe('brush strokes never change', () => {
	it('a brush stroke is never turned into a hole, even inside another shape', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(150, 150, 450, 550));
		stroke(shapes[1]);
		const before = saved(shapes[1]);
		expect(isBrushStroke(shapes[1])).toBe(true);
		expect(autoHole(glyph, shapes[1])).toBeNull();
		expect(setShapeRole(glyph, shapes[1], 'hole')).toBe(false);
		expect(canBeHole(glyph, shapes[1])).toBe(false);
		expect(saved(shapes[1])).toBe(before);
	});

	it('a rectangle drawn inside a brush stroke is a hole in it; the stroke itself is untouched', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(150, 150, 450, 550));
		stroke(shapes[0]);
		const strokeBefore = saved(shapes[0]);
		expect(autoHole(glyph, shapes[1])).toMatchObject({ role: 'hole', changed: true });
		expect(saved(shapes[0])).toBe(strokeBefore);
	});

	it('only shapes with an outline are acted on', () => {
		const { glyph } = letterWith(box(0, 0, 100, 100));
		expect(autoHole(glyph, null)).toBeNull();
		expect(autoHole(glyph, { objType: 'ComponentInstance' })).toBeNull();
		const line = glyph.addOneShape(
			polygon([
				[0, 0],
				[50, 50],
			])
		);
		expect(autoHole(glyph, line)).toBeNull();
		expect(isBrushStroke({})).toBe(false);
	});
});

describe('the Solid / Hole switch', () => {
	it('setShapeRole flips a hole back to solid and back again; each change reports true once', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(150, 150, 450, 550));
		autoHole(glyph, shapes[1]);
		expect(setShapeRole(glyph, shapes[1], 'hole')).toBe(false); // already a hole
		expect(setShapeRole(glyph, shapes[1], 'solid')).toBe(true);
		expect(windingAt(glyph, 300, 350)).not.toBe(0);
		expect(setShapeRole(glyph, shapes[1], 'hole')).toBe(true);
		expect(windingAt(glyph, 300, 350)).toBe(0);
	});

	it('a shape on its own can only be solid', () => {
		const { glyph, shapes } = letterWith(box(0, 0, 600, 700), box(700, 0, 900, 700));
		expect(canBeHole(glyph, shapes[1])).toBe(false);
		const before = saved(shapes[1]);
		expect(setShapeRole(glyph, shapes[1], 'hole')).toBe(false);
		expect(saved(shapes[1])).toBe(before);
		expect(canBeHole(glyph, letterWith(box(0, 0, 600, 700), box(100, 100, 200, 200)).shapes[1])).toBe(
			true
		);
	});
});

describe('in the app: Simple only, once the letter view has landed', () => {
	let editor;
	let warn;
	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
		resetToastsForTests();
		document.querySelectorAll('#toast').forEach((element) => element.remove());
		editor = twoLetterEditor();
		showItem(editor, B);
	});
	afterEach(() => {
		warn.mockRestore();
		resetToastsForTests();
		setModeForTests('all');
	});

	/** An outer box, then a box inside it, both as the Rectangle tool draws them */
	function boxInBox() {
		const item = editor.selectedItem;
		item.addOneShape(box(0, 0, 600, 700));
		return item.addOneShape(box(150, 150, 450, 550));
	}

	it('All tools: nothing changes and nothing is said', () => {
		const inner = boxInBox();
		const before = saved(inner);
		expect(autoHoleNewShape(editor, inner)).toBeNull();
		expect(sayMadeHole(editor, inner, { role: 'hole', number: 2 })).toBe(false);
		expect(saved(inner)).toBe(before);
		expect(toastLog()).toEqual([]);
	});

	it('Simple before the letter view lands: nothing changes', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false }); // on in the app since B7
		const inner = boxInBox();
		const before = saved(inner);
		expect(autoHoleNewShape(editor, inner)).toBeNull();
		expect(saved(inner)).toBe(before);
	});

	it('Simple: the new shape becomes a hole, and the toast says so with [Make it solid]', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		const inner = boxInBox();
		const steps = editor.history.queue.length;
		const result = autoHoleNewShape(editor, inner);
		expect(result).toMatchObject({ role: 'hole', changed: true, number: 2 });
		expect(editor.history.queue.length).toBe(steps); // the tool's own step holds it
		expect(sayMadeHole(editor, inner, result)).toBe(true);
		const shown = toastLog().at(-1);
		expect(shown).toMatchObject({ key: 'letterTools.madeHole', text: 'Made shape 2 a hole', shown: true });
		const button = document.querySelector('[data-anyink-toast] .anyink-toast__action');
		expect(button?.textContent).toBe('Make it solid');
	});

	it('[Make it solid] makes it solid as one Undo step, and Undo makes it a hole again', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		const inner = boxInBox();
		editor.history.addState('Added path: Rectangle 2');
		const result = autoHoleNewShape(editor, inner);
		// the tool writes its step after the hole is made: it holds the hole
		editor.history.addState('Added path: Rectangle 2');
		sayMadeHole(editor, inner, result);
		const steps = editor.history.queue.length;
		document.querySelector('[data-anyink-toast] .anyink-toast__action').click();
		expect(shapeRole(editor.selectedItem, inner)).toBe('solid');
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('made shape 2 solid');
		editor.history.restoreState();
		const item = editor.selectedItem;
		expect(shapeRole(item, item.shapes[1])).toBe('hole');
	});

	it('the Point pen records its own step when the shape changed (record: true)', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		const inner = boxInBox();
		const steps = editor.history.queue.length;
		autoHoleNewShape(editor, inner, { record: true });
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(editor.history.queue[0].title).toBe('made shape 2 a hole');
		// nothing to record when the shape was already right
		const steps2 = editor.history.queue.length;
		autoHoleNewShape(editor, inner, { record: true });
		expect(editor.history.queue.length).toBe(steps2);
	});

	it('a solid result says nothing, and a shape outside the open letter is left alone', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		const item = editor.selectedItem;
		const lone = item.addOneShape(box(0, 0, 300, 300));
		expect(sayMadeHole(editor, lone, autoHoleNewShape(editor, lone))).toBe(false);
		const elsewhere = box(0, 0, 10, 10);
		expect(autoHoleNewShape(editor, elsewhere)).toBeNull();
		expect(toastLog()).toEqual([]);
	});
});
