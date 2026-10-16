// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 fix track: a damaged or unreadable sketch on a letter (a hand-edited work file, a crash
	copy) never stops History from recording a step, never loses his built shapes' tags, and is
	cleaned up once when it is a v1 sketch with wrong fields. All written to fail first against
	the S1 build (the critic's probe s1/critic/p5.mjs).
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { B, square, twoLetterEditor } from '../../history/tests/two_letters.js';
import { showItem } from '../../preview/show_item.js';
import { beforeSketchStep } from '../history_hook.js';
import {
	getPiece,
	isJoined,
	isNewerSketch,
	migrateSketch,
	newSketch,
	nextPieceId,
	piecesAt,
	sketchOf,
	validateSketch,
} from '../model.js';
import { isBuiltShape, reconcile, tagBuilt } from '../sketch_record.js';
import { DAMAGED_KEY, badShapeSketches, unreadableVSketches } from './fixtures/damaged_sketches.js';
import { fullSketch } from './fixtures/full_sketch.js';

let editor;

/** Capital B holds `sketch` raw and one shape tagged with its key, piece 1 */
function letterWith(sketch) {
	const item = editor.project.glyphs[B];
	item.anyink = { ...(item.anyink || {}), sketch };
	const shape = item.addOneShape(square(100, 200));
	tagBuilt(shape, { id: 1, key: DAMAGED_KEY });
	return item;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	editor = twoLetterEditor();
	showItem(editor, B);
});

describe('a v1 sketch with points or pieces of the wrong kind', () => {
	it.each(badShapeSketches())('%s: beforeSketchStep does not throw', (name, sketch) => {
		letterWith(sketch);
		expect(() => beforeSketchStep(editor)).not.toThrow();
	});

	it.each(badShapeSketches())('%s: History still records the step', (name, sketch) => {
		const item = letterWith(sketch);
		const before = editor.history.queue.length;
		item.addOneShape(square(500, 500));
		expect(() => editor.history.addState('Drew a shape')).not.toThrow();
		expect(editor.history.queue.length).toBe(before + 1);
	});

	it.each(badShapeSketches())('%s: sketchOf cleans it up to a valid v1 sketch, once', (name, sketch) => {
		const item = letterWith(sketch);
		const read = sketchOf(item);
		expect(Array.isArray(read.pieces)).toBe(true);
		expect(read.points && typeof read.points === 'object' && !Array.isArray(read.points)).toBe(true);
		expect(read.key).toBe(DAMAGED_KEY);
		expect(validateSketch(read).ok).toBe(true);
		expect(sketchOf(item)).toBe(read);
	});

	it('a healthy v1 sketch is returned as stored (no copy)', () => {
		const sketch = fullSketch();
		const item = letterWith(sketch);
		expect(sketchOf(item)).toBe(sketch);
	});

	it('the piece helpers take pieces that are no list', () => {
		for (const pieces of [{}, 'oops', null, 7]) {
			const sketch = { points: 'x', pieces, relations: 'y' };
			expect(getPiece(sketch, 1)).toBe(null);
			expect(nextPieceId(sketch)).toBe(1);
			expect(piecesAt(sketch, 'p1')).toEqual([]);
			expect(isJoined(sketch, 'p1')).toBe(false);
		}
	});

	it('beforeSketchStep returns nothing done when the step itself throws', () => {
		const item = letterWith(fullSketch());
		Object.defineProperty(item.anyink.sketch, 'pieces', {
			get() {
				throw new Error('damaged');
			},
		});
		expect(beforeSketchStep(editor)).toEqual({ untagged: 0, setAside: false });
	});
});

describe('thickness is a whole number, never below 0', () => {
	it('migrateSketch(v1) clamps a negative thickness', () => {
		const raw = { ...fullSketch(), thickness: -5 };
		expect(migrateSketch(raw).thickness).toBe(0);
	});

	it('migrateSketch(v1) makes a thickness whole', () => {
		expect(migrateSketch({ ...fullSketch(), thickness: 98.6 }).thickness).toBe(99);
		expect(migrateSketch({ ...fullSketch(), thickness: 'thick' }).thickness).toBe(0);
	});

	it('sketchOf cleans up a stored negative thickness', () => {
		const item = letterWith({ ...fullSketch(), key: DAMAGED_KEY, thickness: -5 });
		expect(sketchOf(item).thickness).toBe(0);
	});

	it('newSketch never makes one below 0', () => {
		expect(newSketch({ thickness: -40 }).thickness).toBe(0);
	});
});

describe('a sketch whose v this app cannot read', () => {
	it.each(unreadableVSketches())('%s: counts as one it cannot read (like a newer one)', (name, sketch) => {
		expect(isNewerSketch(sketch)).toBe(true);
		expect(validateSketch(sketch).newer).toBe(true);
	});

	it.each(unreadableVSketches())('%s: the sketch and its built shapes keep their tags', (name, sketch) => {
		const item = letterWith(sketch);
		const stored = JSON.stringify(sketch);
		expect(beforeSketchStep(editor)).toEqual({ untagged: 0, setAside: false });
		expect(isBuiltShape(item.shapes.at(-1))).toBe(true);
		expect(item.shapes.at(-1).anyink.sketchKey).toBe(DAMAGED_KEY);
		expect(JSON.stringify(item.anyink.sketch)).toBe(stored);
	});

	it('a stored sketch that is no sketch at all (a list) leaves the tags alone', () => {
		const item = letterWith([1, 2, 3]);
		expect(reconcile(item)).toBe(0);
		expect(isBuiltShape(item.shapes.at(-1))).toBe(true);
	});

	it('a newer sketch with no key leaves every tag alone', () => {
		const item = letterWith({ v: 7 });
		expect(reconcile(item)).toBe(0);
		expect(isBuiltShape(item.shapes.at(-1))).toBe(true);
	});

	it('v 0, v absent, v 1 and v "1" are still read', () => {
		expect(isNewerSketch({ v: 0 })).toBe(false);
		expect(isNewerSketch({})).toBe(false);
		expect(isNewerSketch({ v: 1 })).toBe(false);
		expect(isNewerSketch({ v: '1' })).toBe(false);
		expect(isNewerSketch({ v: 2 })).toBe(true);
		expect(isNewerSketch(null)).toBe(false);
	});

	it('a shape tagged for another sketch is still stripped when there is no sketch at all', () => {
		const item = editor.project.glyphs[B];
		const shape = item.addOneShape(square());
		tagBuilt(shape, { id: 1, key: 'sk_elsewhere' });
		expect(reconcile(item)).toBe(1);
	});
});
