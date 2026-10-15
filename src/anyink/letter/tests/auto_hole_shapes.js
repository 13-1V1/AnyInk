// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Shapes for the auto-hole and point-kind tests (B7 letter-tools track), built from plain
	numbers so a test can say exactly which way each one runs.

	  box(x1, y1, x2, y2, way)   a rectangle; way 'cw' (the Rectangle tool's own order: top
	                             left, top right, bottom right, bottom left) or 'ccw'
	  letterWith(...paths)       a Glyph holding them; returns { glyph, shapes } (the glyph's
	                             own copies, in order)
	  windingAt(glyph, x, y)     the nonzero count at a spot: 0 shows paper, anything else ink
	  stroke(path, id)           tags a shape the way B8 tags a brush stroke (anyink.strokeId)
*/
import { ControlPoint } from '../../../project_data/control_point.js';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { PathPoint } from '../../../project_data/path_point.js';
import { pathContour, pointInContour } from '../../spacing/outline.js';

/**
 * @param {Array<Array<Number>>} corners - [[x, y], ...]
 * @param {String} [name]
 * @returns {Path}
 */
export function polygon(corners, name = 'Shape') {
	const pathPoints = corners.map(
		([x, y]) => new PathPoint({ p: new ControlPoint({ coord: { x, y } }) })
	);
	return new Path({ name, pathPoints });
}

/**
 * @param {Number} x1 - left
 * @param {Number} y1 - bottom
 * @param {Number} x2 - right
 * @param {Number} y2 - top
 * @param {'cw' | 'ccw'} [way]
 * @returns {Path}
 */
export function box(x1, y1, x2, y2, way = 'cw') {
	const cw = [
		[x1, y2],
		[x2, y2],
		[x2, y1],
		[x1, y1],
	];
	return polygon(way === 'cw' ? cw : [...cw].reverse(), `Rectangle ${way}`);
}

/**
 * @param {...Path} paths
 * @returns {{glyph: Glyph, shapes: Array<Path>}}
 */
export function letterWith(...paths) {
	const glyph = new Glyph({ id: 'glyph-0x6F', shapes: paths, advanceWidth: 1000 });
	return { glyph, shapes: [...glyph.shapes] };
}

/**
 * @param {Glyph} glyph
 * @param {Number} x
 * @param {Number} y
 * @returns {Number}
 */
export function windingAt(glyph, x, y) {
	return glyph.shapes
		.map((shape) => pathContour(shape))
		.filter((contour) => contour && pointInContour([x, y], contour))
		.reduce((sum, contour) => sum + Math.sign(contour.area), 0);
}

/**
 * @param {Path} path
 * @param {String} id
 * @returns {Path}
 */
export function stroke(path, id = 'stroke-1') {
	path.anyink = { strokeId: id };
	return path;
}

/**
 * @param {Path} path
 * @returns {String} the path as saved, to compare before and after
 */
export function saved(path) {
	return JSON.stringify(path.save());
}
