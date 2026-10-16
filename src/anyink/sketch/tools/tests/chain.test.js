// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 chain.js (docs/SKETCH.md section 2, "Chaining, the SolidWorks way"): the angle rule
	(within 20 degrees of the end's direction, judged at 1.5x the snap radius: tangent; else a
	corner), the Line's pull-back arc, give-way (the earlier part bends to meet a following Line,
	a Line's click never moves), Enter / double-click / Esc finishing a piece and the second Esc
	going back to Select, degenerate pieces, taking back a click. Written to fail first (chain.js
	did not exist: every test failed).
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { endDirection, pieceSkeleton, startDirection } from '../../curves.js';
import { newSketch } from '../../model.js';
import {
	DECIDE_SHARE,
	TANGENT_DEGREES,
	appendPart,
	createChain,
	createLeave,
	finishPiece,
	judgeLeave,
	keyAction,
	leaveDirection,
	sameSpot,
	startPiece,
	takeBackClick,
} from '../chain.js';

const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
const lines = guideLines({});

/** A sketch and an open piece started at (x, y) */
function begin(x, y, kind = 'corner') {
	const sketch = newSketch({ thickness: 100 });
	sketch.points.p1 = { x, y, kind };
	return { sketch, piece: startPiece('p1', { use: 'center' }) };
}

/** Adds a point and a part; returns the new state */
function add(state, tool, x, y, options = {}) {
	const id = `p${Object.keys(state.sketch.points).length + 1}`;
	const sketch = {
		...state.sketch,
		points: {
			...state.sketch.points,
			[id]: { x, y, kind: options.kind || (tool === 'spline' ? 'smooth' : 'corner') },
		},
	};
	return appendPart(sketch, state.piece, {
		tool,
		to: id,
		mode: options.mode || 'corner',
		bulge: options.bulge,
		arc: options.arc,
	});
}

/** The join between cubic a's end and cubic b's start: degrees turned */
const turnAt = (cubics, i) => apart(endDirection(cubics[i]), startDirection(cubics[i + 1]));

describe('the angle rule', () => {
	const end = { x: 0, y: 0 };
	const radius = 10;

	it('is 20 degrees, judged at 1.5x the snap radius', () => {
		expect(TANGENT_DEGREES).toBe(20);
		expect(DECIDE_SHARE).toBe(1.5);
	});

	it('waits until the pointer is 1.5x the snap radius away', () => {
		expect(judgeLeave({ end, dir: 0, pointer: { x: 14.9, y: 0 }, radius })).toBe('pending');
		expect(judgeLeave({ end, dir: 0, pointer: { x: 15.1, y: 0 }, radius })).toBe('tangent');
	});

	it('within 20 degrees of the way the curve arrives: tangent; past it: a corner', () => {
		const at = (deg) => ({
			x: 30 * Math.cos((deg * Math.PI) / 180),
			y: 30 * Math.sin((deg * Math.PI) / 180),
		});
		expect(judgeLeave({ end, dir: 0, pointer: at(19.5), radius })).toBe('tangent');
		expect(judgeLeave({ end, dir: 0, pointer: at(-19.5), radius })).toBe('tangent');
		expect(judgeLeave({ end, dir: 0, pointer: at(20.5), radius })).toBe('corner');
		expect(judgeLeave({ end, dir: 0, pointer: at(90), radius })).toBe('corner');
		expect(judgeLeave({ end, dir: 0, pointer: at(180), radius })).toBe('corner');
		// a direction that wraps round
		expect(judgeLeave({ end, dir: 350, pointer: at(5), radius })).toBe('tangent');
	});

	it('an end with no direction yet (the first point) is never tangent', () => {
		expect(judgeLeave({ end, dir: null, pointer: { x: 30, y: 0 }, radius })).toBe('corner');
	});

	it('the way out is decided once, on the way out, and shows a tangent hint', () => {
		const leave = createLeave({ end, dir: 0, radius });
		expect(leave.move({ x: 5, y: 0 }).mode).toBe('pending');
		const out = leave.move({ x: 20, y: 0 });
		expect(out.mode).toBe('tangent');
		expect(out.hint).toEqual({ type: 'tangent', from: end, dir: 0 });
		// swinging round afterwards keeps it tangent: the next part bends to it
		expect(leave.move({ x: 20, y: 30 }).mode).toBe('tangent');
		// back over the end it waits again
		expect(leave.move({ x: 2, y: 1 }).mode).toBe('pending');
		const corner = leave.move({ x: 0, y: -25 });
		expect(corner.hint).toBe(null);
	});

	it('Line: pulling back over the last end and away again makes a tangent arc; again, a line', () => {
		const leave = createLeave({ end, dir: 0, radius, tool: 'line' });
		expect(leave.move({ x: 0, y: 25 })).toMatchObject({ mode: 'corner', arc: false });
		leave.move({ x: 1, y: 1 });
		expect(leave.move({ x: 0, y: 25 })).toMatchObject({ mode: 'tangent', arc: true });
		leave.move({ x: 1, y: 1 });
		expect(leave.move({ x: 0, y: 25 })).toMatchObject({ mode: 'corner', arc: false });
	});

	it('no pull-back arc without a direction, nor for the other tools', () => {
		const first = createLeave({ end, dir: null, radius, tool: 'line' });
		first.move({ x: 30, y: 0 });
		first.move({ x: 0, y: 0 });
		expect(first.move({ x: 30, y: 0 }).arc).toBe(false);
		const spline = createLeave({ end, dir: 0, radius, tool: 'spline' });
		spline.move({ x: 30, y: 0 });
		spline.move({ x: 0, y: 0 });
		expect(spline.move({ x: 30, y: 2 })).toMatchObject({ mode: 'tangent', arc: false });
	});

	it("the open piece's own direction at its last end", () => {
		let state = begin(100, 0);
		expect(leaveDirection(state.piece, state.sketch)).toBe(null);
		state = add(state, 'line', 100, 800);
		expect(leaveDirection(state.piece, state.sketch)).toBeCloseTo(90, 6);
		state = add(state, 'arc', 500, 800, { mode: 'tangent' });
		// a tangent half circle up and over arrives going down
		expect(leaveDirection(state.piece, state.sketch)).toBeCloseTo(-90, 3);
	});
});

describe('chaining parts', () => {
	it('leaving at an angle makes a corner: an n stem then its arch', () => {
		let state = begin(150, 50);
		state = add(state, 'line', 150, 1050);
		state = add(state, 'spline', 400, 1050, { mode: 'corner' });
		state = add(state, 'spline', 650, 700, { mode: 'tangent' });
		state = add(state, 'spline', 650, 50, { mode: 'tangent' });
		expect(state.sketch.points.p2.kind).toBe('corner');
		const cubics = pieceSkeleton(state.piece, state.sketch);
		// the stem's top: the arch does not leave straight up
		expect(turnAt(cubics, 0)).toBeGreaterThan(20);
		expect(state.piece.parts.map((part) => part.type)).toEqual(['line', 'spline']);
		expect(state.piece.parts[1].points).toEqual(['p2', 'p3', 'p4', 'p5']);
	});

	it('leaving along the curve makes a tangent join', () => {
		let state = begin(150, 50);
		state = add(state, 'line', 150, 800);
		state = add(state, 'arc', 450, 800, { mode: 'tangent' });
		expect(state.sketch.points.p2.kind).toBe('smooth');
		expect(state.piece.parts[1]).toMatchObject({
			type: 'arc',
			from: 'p2',
			to: 'p3',
			tangent: true,
		});
		const cubics = pieceSkeleton(state.piece, state.sketch);
		expect(turnAt(cubics, 0)).toBeLessThan(0.1);
	});

	it('a corner Arc keeps its own bulge; a tangent one has it worked out', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		state = add(state, 'arc', 400, 500, { mode: 'corner', bulge: -0.5 });
		expect(state.piece.parts[1]).toEqual({ type: 'arc', from: 'p2', to: 'p3', bulge: -0.5 });
		expect(state.sketch.points.p2.kind).toBe('corner');
	});

	it('a Spline after a Spline along the curve is one run; after a Line, a new part', () => {
		let state = begin(0, 0);
		state = add(state, 'spline', 200, 300);
		state = add(state, 'spline', 400, 0, { mode: 'tangent' });
		expect(state.piece.parts).toEqual([{ type: 'spline', points: ['p1', 'p2', 'p3'] }]);
		state = add(state, 'line', 400, -300, { mode: 'corner' });
		state = add(state, 'spline', 600, -500, { mode: 'tangent' });
		expect(state.piece.parts.map((part) => part.type)).toEqual(['spline', 'line', 'spline']);
		expect(state.sketch.points.p4.kind).toBe('smooth');
	});

	it('the second click of a double-click adds nothing', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		const again = add(state, 'line', 0, 500);
		expect(again.added).toBe(false);
		expect(again.piece.parts).toHaveLength(1);
		expect(sameSpot({ x: 0, y: 500 }, { x: 3, y: 502 }, 6)).toBe(true);
		expect(sameSpot({ x: 0, y: 500 }, { x: 9, y: 500 }, 6)).toBe(false);
	});

	it('never changes what it is given', () => {
		const state = begin(0, 0);
		const before = JSON.stringify(state);
		add(add(state, 'line', 0, 500), 'spline', 300, 700, { mode: 'tangent' });
		expect(JSON.stringify(state)).toBe(before);
	});

	it('switching tools mid-piece follows the same rule (a tracked leave, then Spline)', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		const end = state.sketch.points.p2;
		const dir = leaveDirection(state.piece, state.sketch);
		const leave = createLeave({ end, dir, radius: 10, tool: 'spline' });
		const { mode } = leave.move({ x: 5, y: 560 });
		expect(mode).toBe('tangent');
		state = add(state, 'spline', 200, 900, { mode });
		state = add(state, 'spline', 500, 900, { mode: 'tangent' });
		const cubics = pieceSkeleton(state.piece, state.sketch);
		expect(turnAt(cubics, 0)).toBeLessThan(0.1);
		const leave2 = createLeave({ end, dir, radius: 10, tool: 'arc' });
		expect(leave2.move({ x: 60, y: 520 }).mode).toBe('corner');
	});

	it("a Line's pull-back arc leaves tangent", () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		state = add(state, 'line', 400, 500, { mode: 'tangent', arc: true });
		expect(state.piece.parts[1]).toMatchObject({ type: 'arc', tangent: true });
		expect(turnAt(pieceSkeleton(state.piece, state.sketch), 0)).toBeLessThan(0.1);
	});
});

describe('give way: the earlier part bends to meet a following Line', () => {
	it("a Spline's end turns to a tangent Line; the Line's clicks never move", () => {
		let state = begin(0, 0);
		state = add(state, 'spline', 300, 400);
		state = add(state, 'spline', 600, 300, { mode: 'tangent' });
		const free = leaveDirection(state.piece, state.sketch);
		state = add(state, 'line', 900, 700, { mode: 'tangent' });
		const cubics = pieceSkeleton(state.piece, state.sketch);
		const line = cubics.at(-1);
		expect(line[0]).toEqual([600, 300]);
		expect(line[3]).toEqual([900, 700]);
		const lineDir = (Math.atan2(400, 300) * 180) / Math.PI;
		expect(apart(endDirection(cubics.at(-2)), lineDir)).toBeLessThan(0.1);
		expect(apart(free, lineDir)).toBeGreaterThan(20);
	});

	it('a Spline before a corner Line keeps its own end direction', () => {
		let state = begin(0, 0);
		state = add(state, 'spline', 300, 400);
		state = add(state, 'spline', 600, 300, { mode: 'tangent' });
		const free = leaveDirection(state.piece, state.sketch);
		state = add(state, 'line', 900, 900, { mode: 'corner' });
		const cubics = pieceSkeleton(state.piece, state.sketch);
		expect(apart(endDirection(cubics.at(-2)), free)).toBeLessThan(0.1);
	});

	it('a tangent Arc between two tangent Lines becomes a curve, smooth at both ends', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		state = add(state, 'arc', 400, 500, { mode: 'tangent' });
		state = add(state, 'line', 300, 0, { mode: 'tangent' });
		expect(state.piece.parts[1]).toEqual({ type: 'curve', from: 'p2', to: 'p3' });
		const cubics = pieceSkeleton(state.piece, state.sketch);
		for (let i = 0; i < cubics.length - 1; i++) expect(turnAt(cubics, i)).toBeLessThan(0.1);
		expect(cubics.at(-1)[3]).toEqual([300, 0]);
		expect(cubics[0][0]).toEqual([0, 0]);
	});

	it('an Arc from a corner keeps its corner; it still meets a tangent Line smoothly', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		state = add(state, 'arc', 400, 500, { mode: 'corner', bulge: 0.6 });
		state = add(state, 'line', 300, 0, { mode: 'tangent' });
		expect(state.piece.parts[1].type).toBe('arc');
		const cubics = pieceSkeleton(state.piece, state.sketch);
		expect(turnAt(cubics, 0)).toBeGreaterThan(5);
		expect(turnAt(cubics, cubics.length - 2)).toBeLessThan(0.1);
	});
});

describe('finishing a piece', () => {
	it('an open piece is stored in the sketch with an id and key, the edge rule applied', () => {
		let state = begin(150, 50);
		state.sketch.points.p1 = { ...state.sketch.points.p1, on: 'writing', inset: 'edge' };
		state = add(state, 'line', 150, 1000);
		state.sketch.points.p2 = { ...state.sketch.points.p2, on: 'small', inset: 'edge', y: 1050 };
		const done = finishPiece(state.sketch, state.piece, { font: {} });
		expect(done.piece).toMatchObject({ id: 1, use: 'center', closed: false });
		expect(done.piece.key).toMatch(/^pc_/);
		expect(done.sketch.pieces).toEqual([done.piece]);
		expect(done.sketch.points.p1.y).toBe(50);
		expect(done.sketch.points.p2.y).toBe(lines.small - 50);
	});

	it('ending on the first point closes the loop', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		state = add(state, 'line', 500, 500);
		state = appendPart(state.sketch, state.piece, { tool: 'line', to: 'p1', mode: 'corner' });
		const done = finishPiece(state.sketch, state.piece, {});
		expect(done.piece.closed).toBe(true);
		expect(done.piece.parts.at(-1)).toEqual({ type: 'line', from: 'p3', to: 'p1' });
	});

	it('a Spline that ends on its first point is a loop through its points', () => {
		let state = begin(500, 0, 'smooth');
		state = add(state, 'spline', 900, 500);
		state = add(state, 'spline', 500, 1000, { mode: 'tangent' });
		state = add(state, 'spline', 100, 500, { mode: 'tangent' });
		state = appendPart(state.sketch, state.piece, { tool: 'spline', to: 'p1', mode: 'tangent' });
		const done = finishPiece(state.sketch, state.piece, {});
		expect(done.piece.closed).toBe(true);
		expect(done.piece.parts).toEqual([{ type: 'spline', points: ['p1', 'p2', 'p3', 'p4'] }]);
	});

	it('a 2-point Spline is stored as a Line', () => {
		let state = begin(0, 0);
		state = add(state, 'spline', 300, 600);
		const done = finishPiece(state.sketch, state.piece, {});
		expect(done.piece.parts).toEqual([{ type: 'line', from: 'p1', to: 'p2' }]);
	});

	it('one point: a dot on a Centerline piece, removed on an Outline piece', () => {
		const state = begin(300, 1300);
		const dot = finishPiece(state.sketch, state.piece, { use: 'center' });
		expect(dot.piece.parts).toEqual([{ type: 'spline', points: ['p1'] }]);
		const gone = finishPiece(state.sketch, startPiece('p1', { use: 'outline' }), {});
		expect(gone.piece).toBe(null);
		expect(gone.sketch.pieces).toEqual([]);
		expect(gone.sketch.points.p1).toBeUndefined();
	});

	it('settles the level / plumb locks of the new piece', () => {
		let state = begin(500, 1050, 'smooth');
		state = add(state, 'spline', 150, 550);
		state = add(state, 'spline', 500, 50, { mode: 'tangent' });
		state = add(state, 'spline', 850, 550, { mode: 'tangent' });
		state = appendPart(state.sketch, state.piece, { tool: 'spline', to: 'p1', mode: 'tangent' });
		const done = finishPiece(state.sketch, state.piece, {});
		expect(done.sketch.points.p1.lock).toBe('level');
		expect(done.sketch.points.p2.lock).toBe('plumb');
	});
});

describe('taking back the last click', () => {
	it('removes the last part, then the start, then cancels the piece', () => {
		let state = begin(0, 0);
		state = add(state, 'line', 0, 500);
		state = add(state, 'spline', 300, 700, { mode: 'tangent' });
		state = add(state, 'spline', 600, 600, { mode: 'tangent' });
		let back = takeBackClick(state.piece);
		expect(back.dropped).toBe('p4');
		expect(back.piece.parts.at(-1)).toEqual({ type: 'spline', points: ['p2', 'p3'] });
		back = takeBackClick(back.piece);
		expect(back.dropped).toBe('p3');
		expect(back.piece.parts).toEqual([{ type: 'line', from: 'p1', to: 'p2' }]);
		back = takeBackClick(back.piece);
		expect(back.piece.parts).toEqual([{ type: 'spline', points: ['p1'] }]);
		back = takeBackClick(back.piece);
		expect(back.piece).toBe(null);
		expect(back.dropped).toBe('p1');
	});
});

describe('Enter, double-click and Escape', () => {
	it('Esc finishes the open piece; a second Esc goes back to Select', () => {
		const chain = createChain();
		expect(chain.open).toBe(false);
		chain.begin();
		expect(chain.open).toBe(true);
		expect(chain.escape()).toBe('finish');
		expect(chain.open).toBe(false);
		expect(chain.escape()).toBe('select');
		expect(chain.escape()).toBe('select');
	});

	it('Enter and double-click finish; with nothing open they do nothing', () => {
		const chain = createChain();
		expect(chain.enter()).toBe(null);
		expect(chain.doubleClick()).toBe(null);
		chain.begin();
		expect(chain.enter()).toBe('finish');
		chain.begin();
		expect(chain.doubleClick()).toBe('finish');
		// after Enter, one Esc is enough for Select
		expect(chain.escape()).toBe('select');
	});

	it('the same rule as a pure function', () => {
		expect(keyAction({ open: true }, 'Escape')).toBe('finish');
		expect(keyAction({ open: false }, 'Escape')).toBe('select');
		expect(keyAction({ open: true }, 'Enter')).toBe('finish');
		expect(keyAction({ open: false }, 'Enter')).toBe(null);
		expect(keyAction({ open: true }, 'a')).toBe(null);
	});
});

describe('S2 integration: join kinds and the pull-back', () => {
	it('a Line after a Line is a corner even when it left along (both clicked ends stay put)', () => {
		let state = begin(100, 0);
		state = add(state, 'line', 100, 800);
		state = add(state, 'line', 110, 1000, { mode: 'tangent' });
		expect(state.sketch.points.p2.kind).toBe('corner');
	});

	it('a Spline or an Arc leaving a Line along it still makes the join smooth', () => {
		let state = begin(100, 0);
		state = add(state, 'line', 100, 800);
		state = add(state, 'spline', 300, 1000, { mode: 'tangent' });
		expect(state.sketch.points.p2.kind).toBe('smooth');
		let arc = begin(100, 0);
		arc = add(arc, 'line', 100, 800);
		arc = add(arc, 'arc', 500, 800, { mode: 'tangent' });
		expect(arc.sketch.points.p2.kind).toBe('smooth');
	});

	it('a tracker started with the pointer far away: its first way back over the end and out is no pull-back', () => {
		const end = { x: 0, y: 0 };
		const leave = createLeave({ end, dir: 0, radius: 10, tool: 'line', from: { x: 400, y: 300 } });
		leave.move({ x: 200, y: 150 });
		leave.move({ x: 2, y: 1 });
		expect(leave.move({ x: 40, y: 2 })).toMatchObject({ mode: 'tangent', arc: false });
		leave.move({ x: 1, y: 1 });
		expect(leave.move({ x: 40, y: 2 })).toMatchObject({ mode: 'tangent', arc: true });
	});

	it('a tracker started on the end (after a click) counts its first leave, as before', () => {
		const end = { x: 0, y: 0 };
		const leave = createLeave({ end, dir: 0, radius: 10, tool: 'line', from: { x: 0, y: 0 } });
		leave.move({ x: 40, y: 2 });
		leave.move({ x: 1, y: 1 });
		expect(leave.move({ x: 40, y: 2 }).arc).toBe(true);
	});
});
