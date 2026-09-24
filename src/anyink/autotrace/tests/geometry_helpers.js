// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helpers for track B (Milestone 8): outlines to polygons, and which points are ink.

	The fill rule is the one upstream and the font use:
	- the edit canvas: drawGlyph (src/display_canvas/draw_paths.js) builds one canvas path
	  from every shape and calls ctx.fill('nonzero');
	- the exported OTF: CFF charstrings are filled with the nonzero winding rule (Adobe
	  Type 2 Charstring Format; OpenType's CFF table), and the export (font_export.js
	  glyphToContours) writes each Path as one contour, in point order, with no direction fix.
	So "the hole stays a hole" means: nonzero winding number 0 inside the hole.
*/

const STEPS = 24;

/**
 * An upstream Path (font units) as a closed polygon, curves sampled.
 * @param {Object} path - Path with pathPoints
 * @returns {Array<{x: Number, y: Number}>}
 */
export function flattenPath(path, steps = STEPS) {
	const points = path.pathPoints;
	const out = [];
	for (let i = 0; i < points.length; i++) {
		const pp = points[i];
		const np = points[(i + 1) % points.length];
		const a = { x: pp.p.x, y: pp.p.y };
		const d = { x: np.p.x, y: np.p.y };
		out.push(a);
		if (!pp.h2.use && !np.h1.use) continue;
		const b = { x: pp.h2.x, y: pp.h2.y };
		const c = { x: np.h1.x, y: np.h1.y };
		for (let s = 1; s < steps; s++) out.push(cubicAt(a, b, c, d, s / steps));
	}
	return out;
}

/**
 * A FontFlux contour as a closed polygon: CFF commands ({type: 'M' | 'L' | 'C' | 'Q' | 'Z'})
 * or TrueType points ({x, y, onCurve}).
 * @param {Array} contour
 * @returns {Array<{x: Number, y: Number}>}
 */
export function flattenContour(contour, steps = STEPS) {
	if (contour.length && contour[0].type === undefined) return flattenTrueType(contour, steps);
	const out = [];
	let current = null;
	for (const command of contour) {
		const end = { x: command.x, y: command.y };
		switch (command.type) {
			case 'M':
			case 'L':
				out.push(end);
				current = end;
				break;
			case 'C':
				for (let s = 1; s <= steps; s++) {
					out.push(
						cubicAt(
							current,
							{ x: command.x1, y: command.y1 },
							{ x: command.x2, y: command.y2 },
							end,
							s / steps
						)
					);
				}
				current = end;
				break;
			case 'Q':
				for (let s = 1; s <= steps; s++) {
					out.push(quadAt(current, { x: command.x1, y: command.y1 }, end, s / steps));
				}
				current = end;
				break;
			default:
				break;
		}
	}
	// A closing point equal to the start adds nothing
	if (out.length > 1 && samePoint(out[0], out.at(-1))) out.pop();
	return out;
}

/**
 * Signed area (shoelace), y-up: positive = counterclockwise.
 * @param {Array<{x: Number, y: Number}>} polygon
 * @returns {Number}
 */
export function signedArea(polygon) {
	let sum = 0;
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		sum += a.x * b.y - b.x * a.y;
	}
	return sum / 2;
}

/**
 * Winding number of a point against every polygon together (Sunday's algorithm).
 * @param {Array<Array<{x: Number, y: Number}>>} polygons
 * @param {{x: Number, y: Number}} point
 * @returns {Number}
 */
export function windingNumber(polygons, point) {
	let total = 0;
	for (const polygon of polygons) total += windingOf(polygon, point);
	return total;
}

/** Filled under the nonzero rule (canvas fill('nonzero'), CFF). */
export function nonzeroInk(polygons, point) {
	return windingNumber(polygons, point) !== 0;
}

/** Filled under the even-odd rule: the geometry potrace meant, whatever the directions. */
export function evenOddInk(polygons, point) {
	let inside = 0;
	for (const polygon of polygons) if (windingOf(polygon, point) !== 0) inside++;
	return inside % 2 === 1;
}

/**
 * Sample points on a grid over a box (cell centers), for comparing fills everywhere.
 * @returns {Array<{x: Number, y: Number}>}
 */
export function gridPoints({ xMin, xMax, yMin, yMax }, cells = 60) {
	const out = [];
	for (let i = 0; i < cells; i++) {
		for (let j = 0; j < cells; j++) {
			out.push({
				x: xMin + ((i + 0.5) / cells) * (xMax - xMin),
				y: yMin + ((j + 0.5) / cells) * (yMax - yMin),
			});
		}
	}
	return out;
}

// --------------------------------------------------------------

function windingOf(polygon, p) {
	let wn = 0;
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		const left = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
		if (a.y <= p.y) {
			if (b.y > p.y && left > 0) wn++;
		} else if (b.y <= p.y && left < 0) {
			wn--;
		}
	}
	return wn;
}

function cubicAt(a, b, c, d, t) {
	const u = 1 - t;
	return {
		x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
		y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
	};
}

function quadAt(a, b, c, t) {
	const u = 1 - t;
	return {
		x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
		y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
	};
}

function samePoint(a, b) {
	return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

function flattenTrueType(points, steps) {
	// Expand implied on-curve points between two off-curve points, then walk the quads
	const expanded = [];
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const n = points[(i + 1) % points.length];
		expanded.push(p);
		if (!p.onCurve && !n.onCurve) {
			expanded.push({ x: (p.x + n.x) / 2, y: (p.y + n.y) / 2, onCurve: true });
		}
	}
	let start = expanded.findIndex((p) => p.onCurve);
	if (start < 0) start = 0;
	const ring = [...expanded.slice(start), ...expanded.slice(0, start)];
	const out = [];
	for (let i = 0; i < ring.length; i++) {
		const p = ring[i];
		if (!p.onCurve) continue;
		out.push({ x: p.x, y: p.y });
		const n = ring[(i + 1) % ring.length];
		if (!n.onCurve) {
			const end = ring[(i + 2) % ring.length];
			for (let s = 1; s < steps; s++) out.push(quadAt(p, n, end, s / steps));
		}
	}
	return out;
}
