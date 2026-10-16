// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 undo-tips: the Undo gate itself (docs/SKETCH.md section 7, "Undo while a piece is open"),
	pure: no editor, a fake open piece. While a piece is open an Undo takes back its last click (the
	first point alone: the piece is cancelled), a Redo is refused, the history is never touched;
	with no piece open, or the 'sketch' flag off, the gate lets every press through (null). An
	older step's Undo runs with the piece held aside, then the piece is finished as its own step.
	The tool's own copy of its start point is put back when an Undo took it away.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../../mode/features.js';
import { word } from '../../../words/words.js';
import { addPoint, getPoint, newSketch } from '../../model.js';
import {
	SKETCH_PIECE_EVENT,
	clearOpenPiece,
	endOpenPiece,
	gateTip,
	isPieceOpen,
	keepStartPoint,
	openPiece,
	pieceChanged,
	resetUndoGateForTests,
	runUndo,
	setOpenPiece,
	subscribePiece,
	underOpenPiece,
} from '../undo_gate.js';

/** A tool's open piece: n placed points, and what was done to it */
function fakePiece(n = 3) {
	const piece = {
		points: Array.from({ length: n }, (_, i) => ({ x: i * 100, y: 0 })),
		cancelled: 0,
		finished: 0,
		pointCount() {
			return this.points.length;
		},
		removeLastPoint() {
			this.points.pop();
		},
		cancel() {
			this.cancelled++;
			this.points = [];
			clearOpenPiece(this);
		},
		finish() {
			this.finished++;
			clearOpenPiece(this);
		},
	};
	setOpenPiece(piece);
	return piece;
}

beforeEach(() => {
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

describe('no piece open: every press goes on as before', () => {
	it('runUndo is null for Undo and Redo; no tooltip of its own', () => {
		expect(isPieceOpen()).toBe(false);
		expect(openPiece()).toBeNull();
		expect(runUndo('undo')).toBeNull();
		expect(runUndo('redo')).toBeNull();
		expect(gateTip('undo')).toBeNull();
		expect(gateTip('redo')).toBeNull();
	});

	it("with the 'sketch' flag off a registered piece changes nothing", () => {
		setFeaturesForTests({ sketch: false });
		const piece = fakePiece(3);
		expect(isPieceOpen()).toBe(false);
		expect(runUndo('undo')).toBeNull();
		expect(piece.points).toHaveLength(3);
	});

	it('a piece with no points yet is not open', () => {
		fakePiece(0);
		expect(isPieceOpen()).toBe(false);
		expect(runUndo('undo')).toBeNull();
	});
});

describe('a piece open', () => {
	it('Undo takes back the last click, one per press, and says it was gated', () => {
		const piece = fakePiece(3);
		const result = runUndo('undo');
		expect(result).toMatchObject({ done: false, gated: true, kind: 'undo', tookBack: true });
		expect(result.cancelled).toBe(false);
		expect(piece.points).toHaveLength(2);
		runUndo('undo');
		expect(piece.points).toHaveLength(1);
		expect(isPieceOpen()).toBe(true);
	});

	it('with only the first point left, Undo cancels the piece; the next press goes on', () => {
		const piece = fakePiece(1);
		const result = runUndo('undo');
		expect(result).toMatchObject({ gated: true, tookBack: true, cancelled: true });
		expect(piece.cancelled).toBe(1);
		expect(piece.finished).toBe(0);
		expect(isPieceOpen()).toBe(false);
		expect(runUndo('undo')).toBeNull();
	});

	it('a tool that forgets to clear its cancelled piece is cleared by the gate', () => {
		const piece = fakePiece(1);
		piece.cancel = function () {
			this.cancelled++;
			this.points = [];
		};
		runUndo('undo');
		expect(openPiece()).toBeNull();
	});

	it('Redo is refused: nothing changes', () => {
		const piece = fakePiece(2);
		expect(runUndo('redo')).toMatchObject({ done: false, gated: true, refused: true });
		expect(piece.points).toHaveLength(2);
		expect(piece.finished).toBe(0);
	});

	it('the tooltips: "Take back the last point" / "Finish the line first"', () => {
		fakePiece(2);
		expect(gateTip('undo')).toBe('sketch.undo.takeBack');
		expect(gateTip('redo')).toBe('sketch.undo.finishFirst');
		expect(word(gateTip('undo'))).toBe('Take back the last point');
		expect(word(gateTip('redo'))).toBe('Finish the line first');
	});

	it('listeners and the page hear every change: a point placed, taken back, the piece gone', () => {
		const heard = vi.fn();
		const events = vi.fn();
		const stop = subscribePiece(heard);
		globalThis.addEventListener(SKETCH_PIECE_EVENT, events);
		const piece = fakePiece(2);
		expect(heard).toHaveBeenCalledTimes(1);
		piece.points.push({ x: 0, y: 0 });
		pieceChanged();
		runUndo('undo');
		runUndo('undo');
		runUndo('undo');
		expect(isPieceOpen()).toBe(false);
		expect(heard.mock.calls.length).toBeGreaterThanOrEqual(5);
		expect(events.mock.calls.length).toBe(heard.mock.calls.length);
		stop();
		globalThis.removeEventListener(SKETCH_PIECE_EVENT, events);
	});

	it('clearOpenPiece(other) leaves the piece that is open alone', () => {
		const piece = fakePiece(2);
		clearOpenPiece({});
		expect(openPiece()).toBe(piece);
		clearOpenPiece(piece);
		expect(openPiece()).toBeNull();
	});
});

describe('older steps: the piece held aside, then finished as its own step', () => {
	it('underOpenPiece: inside, no piece is open (the press goes through); after, it is finished', () => {
		const piece = fakePiece(3);
		const seen = [];
		const out = underOpenPiece(() => {
			seen.push(isPieceOpen(), runUndo('undo'));
			return 'ran';
		});
		expect(out).toBe('ran');
		expect(seen).toEqual([false, null]);
		expect(piece.points).toHaveLength(3);
		expect(piece.finished).toBe(1);
		expect(isPieceOpen()).toBe(false);
	});

	it('underOpenPiece with no piece open just runs', () => {
		expect(underOpenPiece(() => 7)).toBe(7);
	});

	it('the piece is finished even when the older step throws', () => {
		const piece = fakePiece(2);
		expect(() =>
			underOpenPiece(() => {
				throw new Error('boom');
			})
		).toThrow('boom');
		expect(piece.finished).toBe(1);
	});

	it('endOpenPiece finishes it now (whole-font Undo, a crash-copy restore)', () => {
		const piece = fakePiece(2);
		expect(endOpenPiece()).toBe(true);
		expect(piece.finished).toBe(1);
		expect(endOpenPiece()).toBe(false);
	});
});

describe("the tool's own copy of its start point", () => {
	it('the stored point is used while it is there', () => {
		const sketch = newSketch({ thickness: 80 });
		const id = addPoint(sketch, { x: 10, y: 20, kind: 'corner' });
		expect(keepStartPoint(sketch, { id, x: 10, y: 20, kind: 'corner' })).toBe(id);
		expect(Object.keys(sketch.points)).toHaveLength(1);
	});

	it('an Undo took it away: a new point at the copy', () => {
		const sketch = newSketch({ thickness: 80 });
		const id = keepStartPoint(sketch, { id: 'p9', x: 10, y: 20, kind: 'smooth', on: 'writing' });
		expect(getPoint(sketch, id)).toMatchObject({ x: 10, y: 20, kind: 'smooth', on: 'writing' });
	});

	it('no copy (a fresh piece): null', () => {
		expect(keepStartPoint(newSketch({ thickness: 80 }), null)).toBeNull();
	});
});
