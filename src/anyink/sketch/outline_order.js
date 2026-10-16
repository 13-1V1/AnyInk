// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (docs/SKETCH.md section 4, steps 1 and 2): which Outline loops of a sketch are solid and
	which are holes, and which way each must run. Pure; no clipper (crossing loops are resolved in
	S3's build_outline.js).

	A loop's depth is how many of the OTHER sketch loops it sits inside (photo, Brush and other
	shapes are never looked at): depth 0 solid, 1 hole, 2 solid again (an island in a hole), and so
	on. The font fills by the nonzero rule, so a solid runs +1 and a hole -1; +1 is counterclockwise
	in font units (y up), the way the OTF (CFF) outlines run, so a positive signed area.

	"Inside" is decided by the loop's own corners: most of those not lying on the other loop's line
	must be inside it, and the other loop must be the larger. So two loops that only touch, or a
	loop that crosses another, don't count as nested by a stray point.

	  flattenCubics(cubics, steps)   [[p0, h1, h2, p3], ...] to a point list (each point [x, y])
	  signedArea(points)             > 0 counterclockwise (y up)
	  windingOf(points)              +1, -1 or 0 (no area)
	  pointInLoop([x, y], points)    'inside' | 'outside' | 'on'
	  loopInside(inner, outer)       true when inner sits inside outer
	  roleForDepth(depth)            'solid' (even) | 'hole' (odd)
	  directionForDepth(depth)       +1 (even) | -1 (odd)
	  outlineOrder(loops)            loops: [{ id, points } | { id, cubics }]; returns, in the same
	                                 order, [{ id, depth, role, direction, winding, reverse,
	                                 inside: [ids, innermost first] }]; reverse = the loop runs the
	                                 wrong way for its role
	  orientLoop(points, depth)      the points, turned round when they run the wrong way (a copy)
*/

/** Points per cubic when flattening */
export const FLATTEN_STEPS = 16;
/** Distance under which a point counts as on a loop's line, font units */
const ON_LINE = 0.5;

/**
 * @param {Array<Array<[Number, Number]>>} cubics
 * @param {Number} [steps]
 * @returns {Array<[Number, Number]>} the start of each cubic and its samples; the last end is
 *   left out when it closes the loop
 */
export function flattenCubics(cubics, steps = FLATTEN_STEPS) {
	const points = [];
	(cubics || []).forEach(([p0, h1, h2, p3]) => {
		for (let k = 0; k < steps; k += 1) {
			const t = k / steps;
			const u = 1 - t;
			const a = u * u * u;
			const b = 3 * u * u * t;
			const c = 3 * u * t * t;
			const d = t * t * t;
			points.push([
				a * p0[0] + b * h1[0] + c * h2[0] + d * p3[0],
				a * p0[1] + b * h1[1] + c * h2[1] + d * p3[1],
			]);
		}
	});
	const last = cubics?.at?.(-1)?.[3];
	if (last && points.length && !samePoint(last, points[0])) points.push([last[0], last[1]]);
	return points;
}

/**
 * @param {Array<[Number, Number]>} points
 * @returns {Number}
 */
export function signedArea(points) {
	let sum = 0;
	const count = points?.length || 0;
	for (let i = 0; i < count; i += 1) {
		const [x0, y0] = points[i];
		const [x1, y1] = points[(i + 1) % count];
		sum += x0 * y1 - x1 * y0;
	}
	return sum / 2;
}

/** @returns {1 | -1 | 0} */
export function windingOf(points) {
	const area = signedArea(points);
	if (Math.abs(area) < 1e-9) return 0;
	return area > 0 ? 1 : -1;
}

/**
 * @param {[Number, Number]} point
 * @param {Array<[Number, Number]>} loop
 * @returns {'inside' | 'outside' | 'on'}
 */
export function pointInLoop([x, y], loop) {
	const count = loop?.length || 0;
	if (count < 3) return 'outside';
	let inside = false;
	for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
		const [xi, yi] = loop[i];
		const [xj, yj] = loop[j];
		if (distanceToSegment([x, y], [xj, yj], [xi, yi]) <= ON_LINE) return 'on';
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside ? 'inside' : 'outside';
}

/**
 * @param {Array<[Number, Number]>} inner
 * @param {Array<[Number, Number]>} outer
 * @returns {Boolean}
 */
export function loopInside(inner, outer) {
	if (!inner?.length || !outer?.length || inner === outer) return false;
	if (Math.abs(signedArea(outer)) <= Math.abs(signedArea(inner))) return false;
	let inCount = 0;
	let outCount = 0;
	inner.forEach((point) => {
		const where = pointInLoop(point, outer);
		if (where === 'inside') inCount += 1;
		else if (where === 'outside') outCount += 1;
	});
	return inCount > outCount;
}

/** @returns {'solid' | 'hole'} */
export function roleForDepth(depth) {
	return depth % 2 === 0 ? 'solid' : 'hole';
}

/** @returns {1 | -1} */
export function directionForDepth(depth) {
	return depth % 2 === 0 ? 1 : -1;
}

/**
 * @param {Array<{id: *, points?: Array, cubics?: Array}>} loops
 * @returns {Array<Object>}
 */
export function outlineOrder(loops) {
	const flat = (loops || []).map((loop) => ({
		id: loop.id,
		points: Array.isArray(loop.points) ? loop.points : flattenCubics(loop.cubics || []),
	}));
	return flat.map((loop) => {
		const around = flat.filter((other) => other !== loop && loopInside(loop.points, other.points));
		// innermost first: the smaller the loop around, the closer it is
		around.sort((a, b) => Math.abs(signedArea(a.points)) - Math.abs(signedArea(b.points)));
		const depth = around.length;
		const direction = directionForDepth(depth);
		const winding = windingOf(loop.points);
		return {
			id: loop.id,
			depth,
			role: roleForDepth(depth),
			direction,
			winding,
			reverse: winding !== 0 && winding !== direction,
			inside: around.map((other) => other.id),
		};
	});
}

/**
 * @param {Array<[Number, Number]>} points
 * @param {Number} depth
 * @returns {Array<[Number, Number]>} a copy, running the way its depth needs
 */
export function orientLoop(points, depth) {
	const copy = (points || []).map(([x, y]) => [x, y]);
	const winding = windingOf(copy);
	return winding !== 0 && winding !== directionForDepth(depth) ? copy.reverse() : copy;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

function samePoint(a, b) {
	return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
	const dx = bx - ax;
	const dy = by - ay;
	const length = dx * dx + dy * dy;
	const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
