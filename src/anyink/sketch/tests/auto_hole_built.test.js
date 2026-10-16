// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 4 step 5): B7's auto-hole never touches a shape a sketch built. The
	sketch's own build decides its holes (one shape per loop, tagged), so auto-hole never turns
	one round, joins it with others or gives it a role, even when a new shape is drawn over it.
	Checked to fail: with auto_hole.js asking only isBrushStroke, the first test fails (the built
	hole of o could be turned solid); the second passes either way (a guard for later changes).
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { autoHole, canBeHole, isKeptInk, setShapeRole, shapeRole } from '../../letter/auto_hole.js';
import { rebuildItem } from '../build.js';
import { builtMatches, isBuiltShape } from '../sketch_record.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function builtO() {
	const editor = openSketchFont({ o: storedSketch('o') });
	const o = editor.project.getItem(glyphIdOf('o'));
	rebuildItem(o, { project: editor.project });
	return o;
}

const box = (x0, y0, size) =>
	new Path({
		name: 'Box',
		pathPoints: [
			{ p: { coord: { x: x0, y: y0 } } },
			{ p: { coord: { x: x0 + size, y: y0 } } },
			{ p: { coord: { x: x0 + size, y: y0 + size } } },
			{ p: { coord: { x: x0, y: y0 + size } } },
		],
	});

describe('auto-hole and built shapes', () => {
	it('built shapes are kept ink: never a role, never turned', () => {
		const o = builtO();
		const [outer, hole] = o.shapes;
		expect(o.shapes.every(isBuiltShape)).toBe(true);
		expect(isKeptInk(outer)).toBe(true);
		expect(shapeRole(o, hole)).toBe('hole');
		expect(canBeHole(o, hole)).toBe(false);
		expect(setShapeRole(o, hole, 'solid')).toBe(false);
		expect(shapeRole(o, hole)).toBe('hole');
		expect(autoHole(o, outer)).toBeNull();
		expect(builtMatches(o)).toBe(true);
	});

	it('a shape drawn over built ink gets its role; the built shapes are left exactly as built', () => {
		const o = builtO();
		const before = JSON.stringify(o.shapes.map((shape) => shape.save()));
		// a box on the ring's left side: on ink, so a hole, but nothing built is joined or turned
		const added = o.addOneShape(box(40, 500, 60));
		const result = autoHole(o, added);
		expect(result).not.toBeNull();
		expect(JSON.stringify(o.shapes.filter(isBuiltShape).map((shape) => shape.save()))).toBe(before);
		expect(builtMatches(o)).toBe(true);
	});
});
