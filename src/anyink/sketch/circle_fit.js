// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix (docs/SKETCH.md sections 3 and 6): a live circle stays a circle when the edge rule moves
	its top or bottom. The edge rule (edge_rule.js placeEdgePoints) moves only the points pinned
	to a writing line, so a Circle drawn between two lines had its top and bottom moved by a
	thickness change while its plumb sides and its stored { rx, ry } stayed: probe run3, an o
	drawn at 264 and slid to 33 came out 932 wide by 1161 tall. Pure; the sketch passed in is
	never changed.

	For each live circle (a closed piece with `circle` and one spline through right, top, left and
	bottom: plumb sides, level top and bottom, as circle_tool.js stores it):
	  - top and bottom both pinned to writing lines: solved again between them, the center's x
	    kept: cy halfway, ry the half gap; rx = ry for a circle, an oval grows by the same amount
	  - one of them pinned: the whole circle moves up or down with it, its size kept
	  - neither: left as it is
	The side points go to cx +- rx at cy, the top and bottom to cx, and piece.circle follows.

	  fitCircles(sketch)   the sketch, or a copy with its circles solved again
*/
import { LINE_NAMES } from './edge_rule.js';

const NEAR = 1e-6;

/** @returns {Boolean} a point the edge rule places */
function pinned(point) {
	return !!point && LINE_NAMES.includes(point.on);
}

/** The ring's four ids by role, or null when it is not a circle as the Circle tool stores it */
function roles(piece, points) {
	const part = piece.parts?.[0];
	if (!piece.closed || piece.parts.length !== 1 || part?.type !== 'spline') return null;
	const ids = [...(part.points || [])];
	if (ids.length === 5 && ids[0] === ids[4]) ids.pop();
	if (ids.length !== 4 || new Set(ids).size !== 4) return null;
	const at = ids.map((id) => points?.[id]);
	if (at.some((point) => !point)) return null;
	const level = ids.filter((id) => points[id].lock === 'level');
	const plumb = ids.filter((id) => points[id].lock === 'plumb');
	if (level.length !== 2 || plumb.length !== 2) return null;
	const [top, bottom] = [...level].sort((a, b) => points[b].y - points[a].y);
	const [right, left] = [...plumb].sort((a, b) => points[b].x - points[a].x);
	return { top, bottom, right, left };
}

/**
 * @param {Object} piece
 * @param {Object} points
 * @returns {{circle: Object, places: Object} | null} the circle solved again, or null when it
 *   already agrees with its points (or is not one this rule knows)
 */
function solve(piece, points) {
	const c = piece.circle;
	const cx = Number(c?.cx);
	const cy = Number(c?.cy);
	const rx = Math.abs(Number(c?.rx));
	const ry = Math.abs(Number(c?.ry)) || rx;
	if (![cx, cy, rx, ry].every(Number.isFinite) || !(rx > 0)) return null;
	const ids = roles(piece, points);
	if (!ids) return null;
	const top = points[ids.top];
	const bottom = points[ids.bottom];
	let next;
	if (pinned(top) && pinned(bottom)) {
		const half = (Number(top.y) - Number(bottom.y)) / 2;
		if (!(half > 0)) return null;
		const round = Math.abs(rx - ry) < NEAR;
		next = {
			cx,
			cy: (Number(top.y) + Number(bottom.y)) / 2,
			rx: round ? half : Math.max(1, rx + (half - ry)),
			ry: half,
		};
	} else if (pinned(top) || pinned(bottom)) {
		const shift = pinned(top) ? Number(top.y) - (cy + ry) : Number(bottom.y) - (cy - ry);
		next = { cx, cy: cy + shift, rx, ry };
	} else {
		return null;
	}
	const places = {
		[ids.right]: { x: next.cx + next.rx, y: next.cy },
		[ids.left]: { x: next.cx - next.rx, y: next.cy },
		[ids.top]: { x: next.cx, y: next.cy + next.ry },
		[ids.bottom]: { x: next.cx, y: next.cy - next.ry },
	};
	const same =
		Math.abs(next.cy - cy) < NEAR &&
		Math.abs(next.rx - rx) < NEAR &&
		Math.abs(next.ry - ry) < NEAR &&
		Object.entries(places).every(
			([id, { x, y }]) =>
				Math.abs(Number(points[id].x) - x) < NEAR && Math.abs(Number(points[id].y) - y) < NEAR
		);
	return same ? null : { circle: { ...c, ...next }, places };
}

/**
 * @param {Object} sketch
 * @returns {Object} the sketch, or a copy with every live circle solved again
 */
export function fitCircles(sketch) {
	if (!sketch?.points || !Array.isArray(sketch.pieces)) return sketch;
	let points = sketch.points;
	let changed = false;
	const pieces = sketch.pieces.map((piece) => {
		if (!piece?.circle || !Array.isArray(piece.parts)) return piece;
		const found = solve(piece, points);
		if (!found) return piece;
		points = { ...points };
		for (const [id, place] of Object.entries(found.places)) {
			points[id] = { ...points[id], ...place };
		}
		changed = true;
		return { ...piece, circle: found.circle };
	});
	return changed ? { ...sketch, points, pieces } : sketch;
}
