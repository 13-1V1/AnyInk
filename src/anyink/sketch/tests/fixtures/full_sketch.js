// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 test fixtures: a v1 sketch that uses every field of docs/SKETCH.md section 8 once (every
	part type, a live circle, a linked inside loop, a hidden helper piece, a dot, every relation
	kind, a mirror line, a lock, an aim, a flat end and a mirrored point), and a hand-made format-0
	sketch for migration (model.js header). Each call returns a fresh copy.

	  fullSketch()     valid (validateSketch ok)
	  v0Sketch()       the draft format: points as a list, width, smooth, line, mirrorX
	  FULL_KEY
*/

export const FULL_KEY = 'sk_fixture01';

/** @returns {Object} */
export function fullSketch() {
	return {
		v: 1,
		build: 1,
		key: FULL_KEY,
		way: 'center',
		thickness: 99,
		ends: 'round',
		mirror: { x: 540 },
		builtHash: null,
		points: {
			p1: { x: 120, y: 50, kind: 'corner', on: 'writing', inset: 'edge', end: null },
			p2: { x: 120, y: 450, kind: 'corner', on: 'small', inset: 'edge' },
			p3: { x: 300, y: 450, kind: 'smooth', on: 'small', inset: 'edge', lock: 'level', aim: null },
			p4: { x: 480, y: 50, kind: 'corner', on: 'writing', inset: 'edge', end: 'flat', mirrorOf: 'p1' },
			p5: { x: 120, y: 250, kind: 'corner' },
			p6: { x: 200, y: 250, kind: 'smooth' },
			p7: { x: 300, y: 350, kind: 'smooth' },
			p8: { x: 400, y: 300, kind: 'smooth' },
			p9: { x: 450, y: 150, kind: 'smooth', aim: { dir: 270, tin: 1, tout: 1.3 } },
			p10: { x: 300, y: 650, kind: 'corner' },
			c1: { x: 300, y: 100, kind: 'smooth', lock: 'level' },
			c2: { x: 450, y: 250, kind: 'smooth', lock: 'plumb' },
			c3: { x: 300, y: 400, kind: 'smooth', lock: 'level' },
			c4: { x: 150, y: 250, kind: 'smooth', lock: 'plumb' },
			o1: { x: 0, y: 0, kind: 'corner' },
			o2: { x: 600, y: 0, kind: 'corner' },
			o3: { x: 600, y: 500, kind: 'corner' },
			o4: { x: 0, y: 500, kind: 'corner' },
		},
		pieces: [
			{ id: 1, key: 'pc_1', use: 'center', closed: false, parts: [{ type: 'line', from: 'p1', to: 'p2' }] },
			{
				id: 2,
				key: 'pc_2',
				use: 'center',
				closed: false,
				parts: [
					{ type: 'line', from: 'p5', to: 'p6' },
					{ type: 'arc', from: 'p6', to: 'p7', bulge: 0.41, tangent: true },
					{ type: 'curve', from: 'p7', to: 'p8' },
					{ type: 'spline', points: ['p8', 'p9', 'p4'] },
				],
			},
			{
				id: 3,
				key: 'pc_3',
				use: 'center',
				closed: true,
				circle: { cx: 300, cy: 250, rx: 150, ry: 150 },
				parts: [{ type: 'spline', points: ['c1', 'c2', 'c3', 'c4'] }],
			},
			{ id: 4, key: 'pc_4', use: 'outline', closed: true, insideOf: 5, wall: 99, parts: [] },
			{
				id: 5,
				key: 'pc_5',
				use: 'outline',
				closed: true,
				parts: [
					{ type: 'line', from: 'o1', to: 'o2' },
					{ type: 'line', from: 'o2', to: 'o3' },
					{ type: 'arc', from: 'o3', to: 'o4', bulge: -0.2 },
					{ type: 'line', from: 'o4', to: 'o1' },
				],
			},
			{
				id: 6,
				key: 'pc_6',
				use: 'helper',
				hidden: true,
				was: 'center',
				closed: false,
				parts: [{ type: 'line', from: 'p3', to: 'p2' }],
			},
			{ id: 7, key: 'pc_7', use: 'center', closed: false, parts: [{ type: 'spline', points: ['p10'] }] },
		],
		relations: [
			{ type: 'plumb', a: 'p1', b: 'p2' },
			{ type: 'onPiece', point: 'p5', piece: 1, t: 0.5 },
			{ type: 'level', a: 'p3', b: 'c3' },
		],
		setAside: false,
		at: 1760659200000,
	};
}

/** @returns {Object} format 0 */
export function v0Sketch() {
	return {
		way: 'center',
		width: 88.6,
		mirrorX: 400.2,
		points: [
			{ id: 1, x: 100.4, y: 0, smooth: false, line: 'writing' },
			{ id: 2, x: 100, y: 500, smooth: false, line: 'small' },
			{ id: 3, x: 300, y: 520.6, smooth: true },
			{ id: 4, x: 500, y: 0, smooth: false, line: 'writing' },
		],
		pieces: [
			{ id: 1, parts: [{ type: 'line', from: 1, to: 2 }] },
			{ id: 2, use: 'center', parts: [{ type: 'spline', points: [2, 3, 4] }] },
		],
	};
}
