// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2: the Undo gate for an open piece (docs/SKETCH.md section 7, "Undo while a piece is open").
	One gate in front of every Undo / Redo entry: Ctrl+Z / Ctrl+Y and the top bar's buttons
	(through History's restoreState / redoState, which Simple hands to simple_undo.js, whose
	undoNewest / redoNewest ask here first), the named Undo toast's [Redo] and a destructive
	toast's [Undo] (history/undo_toast.js), and Backspace (the sketch tool asks here itself).
	While a piece is open:
	  - Undo takes back the last click; with only the first point left it cancels the piece. The
	    history is never touched, so no "Undid:" toast is said.
	  - Redo is off (tooltip "Finish the line first").
	  - A press for an older step (a destructive toast's [Undo]: "Deleted a piece of small n.
	    [Undo]") runs with the piece held aside (no piece open while it runs), then the piece is
	    finished as its own step: the older step is undone and the clicks are kept.
	  - A whole-font Undo or a crash-copy restore calls endOpenPiece() first.
	The tool keeps its own copy of the point it started from; keepStartPoint puts it back when an
	Undo took it away.
	With the 'sketch' flag off nothing is ever open, so every press goes on as before.

	The piece a sketch tool holds open (the tool owns its points; the gate never reads them):
	  { itemID?, pointCount(), removeLastPoint(), cancel(), finish() }
	  removeLastPoint() takes back one click; cancel() drops the piece, nothing stored;
	  finish() stores it as one step (addState), the tool's normal finish. cancel and finish
	  should call clearOpenPiece(piece); the gate clears it after either anyway.

	  SKETCH_PIECE_EVENT            'anyink-sketch-piece', sent on globalThis at every change
	  setOpenPiece(piece)           a tool's piece is open (its first point placed)
	  clearOpenPiece(piece?)        that piece ended (left out: whichever is open)
	  pieceChanged()                the tool placed a point: listeners hear it (tooltips)
	  openPiece()                   the open piece, or null (flag off, none, no points, held aside)
	  isPieceOpen()
	  runUndo(kind)                 null when no piece is open (the press goes on); else the
	                                press's result: { done: false, gated: true, kind, tookBack,
	                                cancelled, refused, title: '', itemID: false, page: false,
	                                moved: false, showMe: null }
	  underOpenPiece(fn)            fn with the piece held aside, then the piece finished
	  endOpenPiece()                finishes it now; true when one was open
	  gateTip(kind)                 the words key of the top bar's tooltip while open, or null
	  keepStartPoint(sketch, copy)  the start point's id: the stored one, or a new point at copy
	  subscribePiece(fn)            -> unsubscribe
	  resetUndoGateForTests()
*/
import { isFeatureOn } from '../../mode/features.js';
import { addPoint, getPoint } from '../model.js';

export const SKETCH_PIECE_EVENT = 'anyink-sketch-piece';

/** @type {Object | null} the piece a sketch tool holds open */
let piece = null;
/** True while an older step runs under the piece (underOpenPiece) */
let held = false;
const listeners = new Set();

function notify() {
	listeners.forEach((fn) => {
		try {
			fn();
		} catch (error) {
			console.warn('undo_gate: a listener failed', error);
		}
	});
	if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
		globalThis.dispatchEvent(new CustomEvent(SKETCH_PIECE_EVENT));
	}
}

/** @param {Object} next - the tool's open piece (see the header) */
export function setOpenPiece(next) {
	piece = next || null;
	notify();
}

/** @param {Object} [which] - only this piece; left out: whichever is open */
export function clearOpenPiece(which) {
	if (!piece || (which && which !== piece)) return;
	piece = null;
	notify();
}

/** The tool placed (or moved) a point of the open piece. */
export function pieceChanged() {
	notify();
}

/** @returns {Number} the piece's placed points (0 for a broken one) */
function countOf(open) {
	try {
		const count = Number(open?.pointCount?.());
		return Number.isFinite(count) ? count : 0;
	} catch {
		return 0;
	}
}

/** @returns {Object | null} */
export function openPiece() {
	if (!piece || held || !isFeatureOn('sketch')) return null;
	return countOf(piece) > 0 ? piece : null;
}

/** @returns {Boolean} */
export function isPieceOpen() {
	return !!openPiece();
}

/**
 * @param {'undo' | 'redo'} kind
 * @param {Object} flags
 * @returns {Object} a press's result that changed no history
 */
function gated(kind, { tookBack = false, cancelled = false, refused = false } = {}) {
	return {
		done: false,
		title: '',
		itemID: false,
		page: false,
		moved: false,
		showMe: null,
		gated: true,
		kind,
		tookBack,
		cancelled,
		refused,
	};
}

/**
 * The gate: every Undo / Redo entry asks here first.
 * @param {'undo' | 'redo'} kind
 * @returns {Object | null} null: no piece is open, the press goes on
 */
export function runUndo(kind) {
	const open = openPiece();
	if (!open) return null;
	if (kind === 'redo') return gated('redo', { refused: true });
	if (countOf(open) <= 1) {
		open.cancel();
		if (piece === open) piece = null;
		notify();
		return gated('undo', { tookBack: true, cancelled: true });
	}
	open.removeLastPoint();
	notify();
	return gated('undo', { tookBack: true });
}

/**
 * Runs a press for an older step under the open piece: the piece is held aside (nothing is
 * open while fn runs, so its Undo goes through), then finished as its own step.
 * @param {Function} fn
 * @returns {*} fn's result
 */
export function underOpenPiece(fn) {
	const open = openPiece();
	if (!open) return fn();
	held = true;
	try {
		return fn();
	} finally {
		held = false;
		if (piece === open) finishPiece(open);
	}
}

/** @param {Object} open */
function finishPiece(open) {
	try {
		open.finish();
	} finally {
		if (piece === open) piece = null;
		notify();
	}
}

/**
 * Finishes the open piece now, as its own step.
 * @returns {Boolean} true when one was open
 */
export function endOpenPiece() {
	const open = openPiece();
	if (!open) return false;
	finishPiece(open);
	return true;
}

/**
 * @param {'undo' | 'redo'} kind
 * @returns {String | null} the words key of the button's tooltip while a piece is open
 */
export function gateTip(kind) {
	if (!isPieceOpen()) return null;
	return kind === 'redo' ? 'sketch.undo.finishFirst' : 'sketch.undo.takeBack';
}

/**
 * The point a piece started from, as the tool copied it ({ id, x, y, ...the point's fields }).
 * When an Undo under the piece took it away, a new point is made at the copy (with its id,
 * when that is free).
 * @param {Object} sketch
 * @param {Object | null} copy
 * @returns {String | null} the point's id
 */
export function keepStartPoint(sketch, copy) {
	if (!copy || !sketch) return null;
	if (copy.id && getPoint(sketch, copy.id)) return copy.id;
	const { id, ...fields } = copy;
	return id ? addPoint(sketch, fields, id) : addPoint(sketch, fields);
}

/**
 * @param {Function} fn
 * @returns {Function} unsubscribe
 */
export function subscribePiece(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function resetUndoGateForTests() {
	piece = null;
	held = false;
	listeners.clear();
}
