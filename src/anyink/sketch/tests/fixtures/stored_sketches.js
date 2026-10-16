// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 integration fixtures (docs/SKETCH.md section 11, S1 step 14): five stored v1 sketches as a
	letter would keep them, at thickness 99 on STORED_FONT. Edge points are stored where the edge
	rule puts them (section 8: x / y of an `inset: 'edge'` point are the built position), so
	placeEdgePoints leaves every one where it is. Used by tests/integration.test.js and by the test
	page tests/sketch.html. Each call returns a fresh copy.

	  n        stem (Line) + arch (Spline leaving the stem by an aim, giving way to a Line into
	           the right foot)
	  o        one closed Spline: level top and bottom on the lines (overshoot), plumb sides
	  s        one open Spline through seven points
	  A        two legs as Lines meeting at a corner on the capitals line, a crossbar
	  circle   a live circle (piece.circle) through four points

	  STORED_FONT                   project.settings.font for these coordinates
	  STORED_NAMES                  ['n', 'o', 's', 'A', 'circle']
	  storedSketch(name)            the sketch
	  storedSketches()              { name: sketch }
*/

export const STORED_FONT = Object.freeze({
	upm: 2048,
	ascent: 1550,
	capHeight: 1480,
	xHeight: 1100,
	descent: -440,
});

export const STORED_NAMES = Object.freeze(['n', 'o', 's', 'A', 'circle']);

const AT = 1760659200000;

/** a corner pinned with its ink edge on a line */
const pin = (x, y, on) => ({ x, y, kind: 'corner', on, inset: 'edge' });
/** a round top or bottom: smooth, level, ink edge on the line plus the overshoot */
const round = (x, y, on) => ({ x, y, kind: 'smooth', on, inset: 'edge', lock: 'level' });
const smooth = (x, y, lock = null) => ({ x, y, kind: 'smooth', ...(lock ? { lock } : {}) });
const corner = (x, y) => ({ x, y, kind: 'corner' });
const line = (from, to) => ({ type: 'line', from, to });
const spline = (...points) => ({ type: 'spline', points });

function sketch(key, points, pieces, relations = []) {
	return {
		v: 1,
		build: 1,
		key,
		way: 'center',
		thickness: 99,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points,
		pieces,
		relations,
		setAside: false,
		at: AT,
	};
}

const MAKERS = {
	n: () =>
		sketch(
			'sk_store_n',
			{
				foot: pin(120, 50, 'writing'),
				stemTop: pin(120, 1051, 'small'),
				join: { ...corner(120, 820), aim: { dir: 70, tin: 1, tout: 1 } },
				archTop: round(340, 1081, 'small'),
				shoulder: smooth(560, 760, 'plumb'),
				rightFoot: pin(560, 50, 'writing'),
			},
			[
				{ id: 1, key: 'pc_stem', use: 'center', closed: false, parts: [line('foot', 'stemTop')] },
				{
					id: 2,
					key: 'pc_arch',
					use: 'center',
					closed: false,
					parts: [spline('join', 'archTop', 'shoulder'), line('shoulder', 'rightFoot')],
				},
			],
			[{ type: 'onPiece', point: 'join', piece: 1, t: 0.77 }]
		),
	o: () =>
		sketch(
			'sk_store_o',
			{
				top: round(330, 1081, 'small'),
				left: smooth(80, 550, 'plumb'),
				bottom: round(330, 19, 'writing'),
				right: smooth(580, 550, 'plumb'),
			},
			[
				{
					id: 1,
					key: 'pc_ring',
					use: 'center',
					closed: true,
					parts: [spline('top', 'left', 'bottom', 'right')],
				},
			]
		),
	s: () =>
		sketch(
			'sk_store_s',
			{
				start: smooth(500, 930),
				top: round(300, 1081, 'small'),
				upperLeft: smooth(90, 830, 'plumb'),
				middle: smooth(300, 560),
				lowerRight: smooth(520, 280, 'plumb'),
				bottom: round(290, 19, 'writing'),
				end: smooth(70, 160),
			},
			[
				{
					id: 1,
					key: 'pc_spine',
					use: 'center',
					closed: false,
					parts: [spline('start', 'top', 'upperLeft', 'middle', 'lowerRight', 'bottom', 'end')],
				},
			]
		),
	A: () =>
		sketch(
			'sk_store_A',
			{
				leftFoot: pin(60, 50, 'writing'),
				apex: pin(520, 1431, 'capitals'),
				rightFoot: pin(980, 50, 'writing'),
				barLeft: corner(203, 480),
				barRight: corner(837, 480),
			},
			[
				{
					id: 1,
					key: 'pc_legs',
					use: 'center',
					closed: false,
					parts: [line('leftFoot', 'apex'), line('apex', 'rightFoot')],
				},
				{
					id: 2,
					key: 'pc_bar',
					use: 'center',
					closed: false,
					parts: [line('barLeft', 'barRight')],
				},
			]
		),
	circle: () =>
		sketch(
			'sk_store_circle',
			{
				c1: smooth(300, 850, 'level'),
				c2: smooth(150, 700, 'plumb'),
				c3: smooth(300, 550, 'level'),
				c4: smooth(450, 700, 'plumb'),
			},
			[
				{
					id: 1,
					key: 'pc_circle',
					use: 'center',
					closed: true,
					circle: { cx: 300, cy: 700, rx: 150, ry: 150 },
					parts: [spline('c1', 'c2', 'c3', 'c4')],
				},
			]
		),
};

/**
 * @param {String} name - one of STORED_NAMES
 * @returns {Object} a fresh v1 sketch
 */
export function storedSketch(name) {
	const make = MAKERS[name];
	if (!make) throw new Error(`no stored sketch "${name}"`);
	return make();
}

/** @returns {Object} name -> sketch */
export function storedSketches() {
	return Object.fromEntries(STORED_NAMES.map((name) => [name, storedSketch(name)]));
}
