// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 paste reconcile (docs/SKETCH.md section 7 "Paste"): a copy of built shapes pasted into its
	own letter, anywhere in the shape list, is plain ink after the next step and the shapes the
	build made stay built (the build notes them as the letter's own, sketch_record.js noteKnown);
	a copy pasted into another sketched letter is plain there; neither sets a sketch aside.
	Checked to fail: without noteKnown after a rebuild, a copy pasted in front of the built shapes
	kept the tags and the shape the build made lost them.
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showItem } from '../../preview/show_item.js';
import { sketchOf } from '../model.js';
import { builtMatches, isBuiltShape, reconcile } from '../sketch_record.js';
import { rebuildItem } from '../build.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('paste reconcile after a rebuild', () => {
	it('a copy pasted in front of the built shapes is the plain one', () => {
		const editor = openSketchFont({ n: storedSketch('n') });
		const n = editor.project.getItem(glyphIdOf('n'));
		rebuildItem(n, { project: editor.project });
		const built = [...n.shapes];
		const copy = n.addOneShape(n.shapes[0].save());
		n.shapes.splice(n.shapes.indexOf(copy), 1);
		n.shapes.unshift(copy);
		expect(reconcile(n)).toBe(1);
		expect(isBuiltShape(copy)).toBe(false);
		expect(built.every(isBuiltShape)).toBe(true);
		expect(builtMatches(n)).toBe(true);
	});

	it('through History: the paste step keeps the sketch and its ink; the copy is plain', () => {
		const editor = openSketchFont({ n: storedSketch('n'), o: storedSketch('o') });
		showItem(editor, glyphIdOf('n'));
		editor.history.addState('sketched a line on small n');
		const n = editor.selectedItem;
		const saved = n.shapes.map((shape) => shape.save());
		n.addOneShape(saved[0]);
		editor.history.addState('Pasted shapes');
		expect(sketchOf(editor.selectedItem).setAside).toBe(false);
		expect(editor.selectedItem.shapes.at(-1).anyink).toBeUndefined();
		// into another sketched letter
		showItem(editor, glyphIdOf('o'));
		editor.history.addState('sketched a circle on small o');
		const o = editor.selectedItem;
		saved.forEach((shape) => o.addOneShape(shape));
		editor.history.addState('Pasted shapes');
		const now = editor.selectedItem;
		expect(sketchOf(now).setAside).toBe(false);
		expect(now.shapes.slice(-saved.length).some(isBuiltShape)).toBe(false);
		expect(builtMatches(now)).toBe(true);
	});
});
