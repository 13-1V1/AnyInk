// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S1 (docs/SKETCH.md section 7 "Tags" / "Paste" / the hash, S1 step 10): built-shape tags,
// reconcile (foreign, stale and repeated tags go) and the built-shape hash.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { square } from '../../history/tests/two_letters.js';
import { isBrushStroke } from '../../letter/auto_hole.js';
import { newSketch } from '../model.js';
import {
	builtMatches,
	builtShapes,
	hashBuilt,
	isBuiltShape,
	markBuilt,
	reconcile,
	sketchIdOf,
	sketchKeyOf,
	sketchPartOf,
	tagBuilt,
	untagBuilt,
} from '../sketch_record.js';
import { fullSketch, FULL_KEY } from './fixtures/full_sketch.js';

/** A letter with the full sketch and three built shapes: piece 1, piece 3 (ink and hole) */
function sketchedLetter() {
	const item = new Glyph({ id: 'glyph-0x6E', anyink: { sketch: fullSketch() } });
	const shapes = [square(100, 300), square(500, 200), square(550, 100)];
	shapes.forEach((shape) => item.addOneShape(shape));
	tagBuilt(item.shapes[0], { id: 1, key: FULL_KEY, part: 0 });
	tagBuilt(item.shapes[1], { id: 3, key: FULL_KEY, part: 0 });
	tagBuilt(item.shapes[2], { id: 3, key: FULL_KEY, part: 1 });
	return item;
}

/** A copy of a shape as paste makes one: its own Path with the same saved data */
function pasted(item, shape) {
	return item.addOneShape(shape.save());
}

const tags = (item) => item.shapes.map((shape) => (isBuiltShape(shape) ? `${sketchIdOf(shape)}.${sketchPartOf(shape)}` : '-'));

describe('tags', () => {
	it('mark a built shape and come off again, leaving other anyink data', () => {
		const shape = square();
		expect(isBuiltShape(shape)).toBe(false);
		tagBuilt(shape, { id: 2, key: 'sk_x', part: 1 });
		expect(shape.anyink).toEqual({ sketchId: 2, sketchKey: 'sk_x', sketchPart: 1 });
		expect([isBuiltShape(shape), sketchIdOf(shape), sketchKeyOf(shape), sketchPartOf(shape)]).toEqual([
			true,
			2,
			'sk_x',
			1,
		]);
		shape.anyink.note = 'kept';
		untagBuilt(shape);
		expect(shape.anyink).toEqual({ note: 'kept' });
		untagBuilt(shape);
		delete shape.anyink.note;
		tagBuilt(shape, { id: 4, key: 'sk_x' });
		expect(sketchPartOf(shape)).toBe(0);
		untagBuilt(shape);
		expect(shape.anyink).toBeUndefined();
	});

	it('are not Brush tags (a built shape is no Brush stroke, and the other way round)', () => {
		const shape = square();
		tagBuilt(shape, { id: 1, key: 'sk_x' });
		expect(isBrushStroke(shape)).toBe(false);
		expect(isBuiltShape({ anyink: { strokeId: 1, strokeKey: 'k' } })).toBe(false);
		expect(isBuiltShape({ anyink: { sketchId: 1 } })).toBe(false);
	});

	it("builtShapes lists only this letter's sketch's shapes", () => {
		const item = sketchedLetter();
		item.addOneShape(square(900, 0));
		const other = item.addOneShape(square(900, 300));
		tagBuilt(other, { id: 1, key: 'sk_other' });
		expect(builtShapes(item)).toEqual(item.shapes.slice(0, 3));
		expect(builtShapes({ shapes: item.shapes })).toEqual([]);
	});
});

describe('reconcile', () => {
	it('leaves a clean letter alone', () => {
		const item = sketchedLetter();
		expect(reconcile(item)).toBe(0);
		expect(tags(item)).toEqual(['1.0', '3.0', '3.1']);
	});

	it('a pasted copy in its own letter becomes plain ink; the shapes there first stay built', () => {
		const item = sketchedLetter();
		reconcile(item);
		// pasted before the original in the list: the original is still the built one
		const copy = pasted(item, item.shapes[0]);
		item.shapes.splice(item.shapes.indexOf(copy), 1);
		item.shapes.unshift(copy);
		expect(reconcile(item)).toBe(1);
		expect(isBuiltShape(copy)).toBe(false);
		expect(tags(item)).toEqual(['-', '1.0', '3.0', '3.1']);
	});

	it('with no memory of the letter, the first of two alike stays built', () => {
		const item = sketchedLetter();
		pasted(item, item.shapes[2]);
		expect(reconcile(item)).toBe(1);
		expect(tags(item)).toEqual(['1.0', '3.0', '3.1', '-']);
	});

	it('a copy from another sketch, a stale piece and a letter with no sketch lose their tags', () => {
		const item = sketchedLetter();
		const foreign = item.addOneShape(square(0, 0));
		tagBuilt(foreign, { id: 1, key: 'sk_elsewhere' });
		const stale = item.addOneShape(square(0, 0));
		tagBuilt(stale, { id: 42, key: FULL_KEY });
		expect(reconcile(item)).toBe(2);
		expect(tags(item)).toEqual(['1.0', '3.0', '3.1', '-', '-']);

		const plain = new Glyph({ id: 'glyph-0x72' });
		const brought = plain.addOneShape(sketchedLetter().shapes[0].save());
		brought.anyink.strokeId = 5;
		expect(reconcile(plain)).toBe(1);
		expect(brought.anyink).toEqual({ strokeId: 5 });
	});

	it("a newer app's sketch keeps its tags (only foreign keys go)", () => {
		const item = sketchedLetter();
		item.anyink.sketch = { v: 9, key: FULL_KEY };
		const foreign = item.addOneShape(square());
		tagBuilt(foreign, { id: 1, key: 'sk_elsewhere' });
		pasted(item, item.shapes[0]);
		expect(reconcile(item)).toBe(1);
		expect(tags(item)).toEqual(['1.0', '3.0', '3.1', '-', '1.0']);
	});
});

describe('the built-shape hash', () => {
	it('is the count and 8 hex digits, the same for the same shapes', () => {
		const a = sketchedLetter();
		const b = sketchedLetter();
		expect(hashBuilt(a)).toMatch(/^c3:[0-9a-f]{8}$/);
		expect(hashBuilt(a)).toBe(hashBuilt(b));
		expect(hashBuilt({ shapes: [] }, 'sk_none')).toMatch(/^c0:/);
	});

	it('ignores shape order, plain shapes and other sketches', () => {
		const item = sketchedLetter();
		const before = hashBuilt(item);
		item.shapes.reverse();
		expect(hashBuilt(item)).toBe(before);
		item.addOneShape(square(800, 0));
		const other = item.addOneShape(square(800, 300));
		tagBuilt(other, { id: 1, key: 'sk_other' });
		expect(hashBuilt(item)).toBe(before);
	});

	it('changes when a built point moves a unit, a handle moves, a tag changes or a shape goes', () => {
		const base = hashBuilt(sketchedLetter());
		const moved = sketchedLetter();
		moved.shapes[1].pathPoints[2].p.x += 1;
		expect(hashBuilt(moved)).not.toBe(base);
		const handle = sketchedLetter();
		handle.shapes[1].pathPoints[2].h1.use = true;
		handle.shapes[1].pathPoints[2].h1.x += 30;
		expect(hashBuilt(handle)).not.toBe(base);
		const retagged = sketchedLetter();
		tagBuilt(retagged.shapes[2], { id: 3, key: FULL_KEY, part: 2 });
		expect(hashBuilt(retagged)).not.toBe(base);
		const fewer = sketchedLetter();
		fewer.shapes.splice(2, 1);
		expect(hashBuilt(fewer)).toMatch(/^c2:/);
		// a move under half a unit rounds away
		const tiny = sketchedLetter();
		tiny.shapes[0].pathPoints[0].p.x += 0.2;
		expect(hashBuilt(tiny)).toBe(base);
	});

	it('reads saved shapes (plain data) the same as live ones', () => {
		const item = sketchedLetter();
		const saved = { anyink: item.anyink, shapes: item.shapes.map((shape) => shape.save()) };
		expect(hashBuilt(saved)).toBe(hashBuilt(item));
	});

	it('markBuilt stores it; builtMatches tells when the shapes changed behind the sketch', () => {
		const item = sketchedLetter();
		expect(builtMatches(item)).toBe(false); // no hash yet, but built shapes
		expect(markBuilt(item)).toBe(item.anyink.sketch.builtHash);
		expect(builtMatches(item)).toBe(true);
		item.shapes[0].pathPoints[0].p.y -= 40;
		expect(builtMatches(item)).toBe(false);
		markBuilt(item);
		expect(builtMatches(item)).toBe(true);
		expect(builtMatches({ anyink: { sketch: newSketch() }, shapes: [] })).toBe(true);
		expect(builtMatches(new Glyph({ id: 'glyph-0x41' }))).toBe(true);
		expect(markBuilt(new Glyph({ id: 'glyph-0x41' }))).toBe(null);
	});
});
