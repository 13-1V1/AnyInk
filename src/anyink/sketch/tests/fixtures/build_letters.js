// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 build fixtures: sketches the build tests ink, on STORED_FONT (stored_sketches.js: writing
	line 0, small-letter line 1100, capitals line 1480, upm 2048), thickness 99 unless said.
	Points pinned to a line are stored at any y: the build places them (edge_rule.js). Each call
	returns a fresh copy.

	  sketchOfPieces(key, points, pieces, { thickness, ends, relations, way })
	  vCenter()            v: two Lines meeting at a corner on the writing line
	  bCenter()            Capital B as a Centerline: a stem and two bowls (Line, Arc, Line) that
	                       leave the stem's top, middle and foot
	  oOutline()           o as two Outline Circles (the inner one a hole by nesting)
	  bOutline()           Capital B as an Outline: an outer loop and two inside loops
	  islandOutline()      three nested Outline loops: solid, hole, solid again
	  crossingOutline()    two Outline Circles that overlap, and a third loop poking out of one
	  figureEight()        one Outline loop that crosses itself
	  flatStem({ ends, slant })   one Line from the writing line to the small-letter line
*/

const AT = 1760659200000;

const pin = (x, y, on, extra = {}) => ({ x, y, kind: 'corner', on, inset: 'edge', ...extra });
const corner = (x, y, extra = {}) => ({ x, y, kind: 'corner', ...extra });
const smooth = (x, y, extra = {}) => ({ x, y, kind: 'smooth', ...extra });
export const line = (from, to) => ({ type: 'line', from, to });
export const spline = (...points) => ({ type: 'spline', points });
export const arc = (from, to, bulge) => ({ type: 'arc', from, to, bulge });

/**
 * @returns {Object} a v1 sketch
 */
export function sketchOfPieces(
	key,
	points,
	pieces,
	{ thickness = 99, ends = 'round', relations = [], way = 'center' } = {}
) {
	return {
		v: 1,
		build: 1,
		key,
		way,
		thickness,
		ends,
		mirror: null,
		builtHash: null,
		points,
		pieces: pieces.map((piece, i) => ({ id: i + 1, key: `pc_${key}_${i + 1}`, ...piece })),
		relations,
		setAside: false,
		at: AT,
	};
}

export function vCenter() {
	return sketchOfPieces(
		'sk_b_v',
		{
			left: pin(60, 1051, 'small'),
			bottom: pin(330, 50, 'writing'),
			right: pin(600, 1051, 'small'),
		},
		[{ use: 'center', closed: false, parts: [line('left', 'bottom'), line('bottom', 'right')] }]
	);
}

export function bCenter() {
	return sketchOfPieces(
		'sk_b_B',
		{
			foot: pin(150, 50, 'writing'),
			top: pin(150, 1431, 'capitals'),
			upperEnd: corner(480, 1431, { on: 'capitals', inset: 'edge' }),
			upperTurn: corner(480, 760),
			mid: corner(150, 760),
			lowerStart: corner(520, 760),
			lowerEnd: corner(520, 50, { on: 'writing', inset: 'edge' }),
		},
		[
			{ use: 'center', closed: false, parts: [line('foot', 'top')] },
			{
				use: 'center',
				closed: false,
				parts: [
					line('top', 'upperEnd'),
					arc('upperEnd', 'upperTurn', -1),
					line('upperTurn', 'mid'),
				],
			},
			{
				use: 'center',
				closed: false,
				parts: [
					line('mid', 'lowerStart'),
					arc('lowerStart', 'lowerEnd', -1),
					line('lowerEnd', 'foot'),
				],
			},
		],
		{ relations: [{ type: 'onPiece', point: 'mid', piece: 1, t: 0.5 }] }
	);
}

/** A circle loop's four points and its piece (use 'outline' by default) */
function circleLoop(prefix, cx, cy, r, use = 'outline') {
	const ids = ['t', 'l', 'b', 'r'].map((side) => `${prefix}${side}`);
	const points = {
		[ids[0]]: smooth(cx, cy + r, { lock: 'level' }),
		[ids[1]]: smooth(cx - r, cy, { lock: 'plumb' }),
		[ids[2]]: smooth(cx, cy - r, { lock: 'level' }),
		[ids[3]]: smooth(cx + r, cy, { lock: 'plumb' }),
	};
	const piece = {
		use,
		closed: true,
		circle: { cx, cy, rx: r, ry: r },
		parts: [spline(...ids)],
	};
	return { points, piece };
}

/** A rectangle loop of four Lines */
function boxLoop(prefix, x0, y0, x1, y1, use = 'outline') {
	const ids = ['a', 'b', 'c', 'd'].map((n) => `${prefix}${n}`);
	const points = {
		[ids[0]]: corner(x0, y0),
		[ids[1]]: corner(x1, y0),
		[ids[2]]: corner(x1, y1),
		[ids[3]]: corner(x0, y1),
	};
	const piece = {
		use,
		closed: true,
		parts: [line(ids[0], ids[1]), line(ids[1], ids[2]), line(ids[2], ids[3]), line(ids[3], ids[0])],
	};
	return { points, piece };
}

function loopsSketch(key, loops) {
	return sketchOfPieces(
		key,
		Object.assign({}, ...loops.map((loop) => loop.points)),
		loops.map((loop) => loop.piece),
		{ way: 'outline' }
	);
}

export function oOutline() {
	return loopsSketch('sk_b_oo', [circleLoop('o', 550, 550, 550), circleLoop('i', 550, 550, 420)]);
}

export function bOutline() {
	return loopsSketch('sk_b_Bo', [
		boxLoop('o', 100, 0, 700, 1480),
		boxLoop('u', 250, 820, 550, 1330),
		boxLoop('l', 250, 150, 550, 660),
	]);
}

export function islandOutline() {
	return loopsSketch('sk_b_is', [
		circleLoop('a', 600, 600, 500),
		circleLoop('b', 600, 600, 350),
		circleLoop('c', 600, 600, 150),
	]);
}

export function crossingOutline() {
	return loopsSketch('sk_b_cr', [
		circleLoop('a', 400, 500, 300),
		circleLoop('b', 750, 500, 300),
		// a "hole" that pokes out of the first circle's left side
		boxLoop('h', 0, 400, 250, 600),
	]);
}

export function figureEight() {
	const points = {
		a: corner(100, 100),
		b: corner(500, 500),
		c: corner(500, 100),
		d: corner(100, 500),
	};
	return sketchOfPieces(
		'sk_b_8',
		points,
		[
			{
				use: 'outline',
				closed: true,
				parts: [line('a', 'b'), line('b', 'c'), line('c', 'd'), line('d', 'a')],
			},
		],
		{ way: 'outline' }
	);
}

/**
 * @param {{ends?: String, slant?: Number, start?: String, end?: String}} [options] - slant: how
 *   far right the top sits from the foot; start / end: each end's own 'round' | 'flat'
 */
export function flatStem({ ends = 'flat', slant = 0, start = null, end = null } = {}) {
	return sketchOfPieces(
		'sk_b_stem',
		{
			foot: pin(300, 50, 'writing', start ? { end: start } : {}),
			top: pin(300 + slant, 1051, 'small', end ? { end } : {}),
		},
		[{ use: 'center', closed: false, parts: [line('foot', 'top')] }],
		{ ends }
	);
}
