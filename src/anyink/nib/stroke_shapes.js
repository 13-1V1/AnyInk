// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: a stroke's outlines (ink.js contours: closed chains of whole-number curves) as
	upstream Paths, the shapes a letter holds. Each curve [start, handle, handle, end] becomes the
	start's outgoing handle (h2) and the end's incoming handle (h1) (RESEARCH 2.3). A handle on its
	own point is off. A point whose two handles sit exactly in one line through it is smooth
	('flat'); any other is a 'corner', because upstream re-lines a smooth point's handles when a
	letter is loaded or undone, and that would leave fractions in a stroke (7.2: whole numbers).
	The outline's direction is kept as it is (ink counterclockwise, holes clockwise; D-024).

	  strokePaths(contours, { name })   [Path, ...], one per outline
*/
import { Path } from '../../project_data/path.js';
import { PathPoint } from '../../project_data/path_point.js';

/**
 * @param {Array<{curves: Array}>} contours
 * @param {{name: String}} options
 * @returns {Array<Path>}
 */
export function strokePaths(contours, { name }) {
	return contours
		.filter((contour) => contour.curves?.length)
		.map((contour) => new Path({ name, pathPoints: pointsOf(contour.curves) }));
}

/** @returns {Array<PathPoint>} */
function pointsOf(curves) {
	return curves.map((curve, i) => {
		const before = curves[(i - 1 + curves.length) % curves.length];
		const [p, h2] = curve;
		const h1 = before[2];
		const handle = ([x, y]) => ({
			coord: { x, y },
			use: !(x === p[0] && y === p[1]),
		});
		return new PathPoint({
			p: { coord: { x: p[0], y: p[1] } },
			h1: handle(h1),
			h2: handle(h2),
			type: inOneLine(h1, p, h2) ? 'flat' : 'corner',
		});
	});
}

/** Both handles off the point, exactly in one line through it, on opposite sides */
function inOneLine([ax, ay], [px, py], [bx, by]) {
	const u = [ax - px, ay - py];
	const v = [bx - px, by - py];
	const off = (w) => w[0] !== 0 || w[1] !== 0;
	if (!off(u) || !off(v)) return false;
	return u[0] * v[1] - u[1] * v[0] === 0 && u[0] * v[0] + u[1] * v[1] < 0;
}
