// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md sections 2 and 8): the Arc tool (A). An arc is stored as its two
	ends plus a bulge (arc.js: tan(sweep / 4), 0 straight, 1 a half circle, the sign its side).

	  - Fresh: click the start, click the end, then move to set the bend and click. The bulge
	    is the one whose middle is as far off the chord as the pointer (arc.js bulgeFromMiddle);
	    near a writing line the arc's top (or bottom) goes where the edge rule puts a round top
	    and the line's name shows at it (arc_snap.js snapBulge; Ctrl turns it off). The bend
	    click ENDS a fresh 3-point Arc, as in SolidWorks: the next click away from it starts a
	    new arc, its own piece and step. Only a move over its end and out again goes on from it
	    (or a click on its first point, closing the loop).
	  - From an open end (the piece goes on after an arc, or was handed over from the Line or
	    Spline tool, or starts on another piece's open end): how the pointer leaves the end
	    decides (chain.js createLeave, 20 degrees at 1.5x the snap radius). Along the curve: one
	    click sets the end and the arc leaves tangent (chain.js works its bulge out from the
	    end's direction; tangent: true); near a writing line the end moves so the arc's top
	    lands on it (line.js arcTopHit). At an angle: a corner, then the end and bend clicks.
	  - After the end click the bend shows at once (straight until the pointer moves), with the
	    words "click to set how far it bends" beside the pointer when the words have them
	    (sketch.tag.bend).
	  - The end click before its bend is half a click: an Undo, Backspace or the take-back takes
	    it away first. Finishing (Enter, Esc, a double-click) or switching tools keeps it with
	    the bend last shown; none moved, a straight line.
	Enter, a double-click or Esc finish (Esc on the first point alone lets go of it); one step per
	piece ("sketched an arc on small n" when the Arc tool started it, "sketched a line" when it
	holds no arc). Everything shared lives in line.js SketchTool.

	  makeArcTool(ctx?)    an Arc tool (ctx as line.js makeLineTool)
	  ArcTool
*/
import { hasWord } from '../../words/words.js';
import { getPoint } from '../model.js';
import { snapBulge } from './arc_snap.js';
import { appendPart } from './chain.js';
import { SketchTool, rubberPart } from './line.js';
import { tagText } from './snap.js';
import { pieceChanged } from './undo_gate.js';

/**
 * S3: the line an arc's top snapped to (only a snap that touches), stored on the part as
 * top: { on } so build.js placeArcTops keeps it there through thickness and line changes.
 * @param {Object | null} snap - arc_snap.js's snap
 * @returns {String | null}
 */
export function topOn(snap) {
	return snap?.touches && typeof snap.on === 'string' ? snap.on : null;
}

/** The words beside the pointer while the bend is set */
const BEND_KEY = 'sketch.tag.bend';

/** A bend smaller than this is kept as a straight line */
const STRAIGHT = 1e-3;

/**
 * The Arc tool (A).
 */
export class ArcTool extends SketchTool {
	constructor(ctx) {
		super(ctx, 'arc');
	}

	clearExtra() {
		this.pendingEnd = null;
		this.bulgeAt = null;
		this.bend = null;
		this.threePoint = false;
		this.loose = false;
	}

	saveExtra() {
		return { pendingEnd: this.pendingEnd, threePoint: this.threePoint, loose: this.loose };
	}

	restoreExtra(extra) {
		this.pendingEnd = extra?.pendingEnd ?? null;
		this.threePoint = !!extra?.threePoint;
		this.loose = !!extra?.loose;
		this.bulgeAt = null;
		this.bend = null;
	}

	pendingCount() {
		return this.pendingEnd && !this.piecePoint(this.pendingEnd) ? 1 : 0;
	}

	/** @returns {Boolean} the id is already a point of the open piece */
	piecePoint(id) {
		return (this.piece?.parts || []).some((part) =>
			part.type === 'spline' ? part.points.includes(id) : part.from === id || part.to === id
		);
	}

	canClose() {
		return !!this.piece && !this.isStart();
	}

	/** The end clicked but its bend not set: kept with the bend last shown */
	beforeFinish() {
		this.settlePending();
	}

	beforeHandOver() {
		this.settlePending();
		this.loose = false;
	}

	/** The pending end as a part: an arc with the bend shown, or a straight line */
	settlePending() {
		if (!this.pendingEnd) return;
		const to = this.pendingEnd;
		const bulge = Number(this.bend?.bulge) || 0;
		const straight = Math.abs(bulge) < STRAIGHT;
		const out = appendPart(this.sketch, this.piece, {
			tool: straight ? 'line' : 'arc',
			to,
			mode: 'corner',
			bulge: straight ? undefined : bulge,
			top: straight ? null : topOn(this.bend?.snap),
		});
		this.pendingEnd = null;
		this.bend = null;
		this.bulgeAt = null;
		this.threePoint = false;
		if (!out.added) {
			this.pop();
			return;
		}
		this.sketch = out.sketch;
		this.piece = out.piece;
	}

	/**
	 * The bend for a pointer: snapBulge from the open end to the pending end.
	 * @returns {{bulge: Number, snap: Object | null}}
	 */
	bendAt(at, ev) {
		const end = getPoint(this.sketch, this.lastId());
		const target = getPoint(this.sketch, this.pendingEnd);
		if (!end || !target) return { bulge: 0, snap: null };
		return snapBulge([Number(end.x), Number(end.y)], [Number(target.x), Number(target.y)], at, {
			font: this.font(),
			thickness: this.sketch?.thickness,
			use: this.use,
			radius: this.radius(ev),
			ctrl: !!(ev?.snapsOff ?? ev?.ctrl),
		});
	}

	down(ev) {
		this.see(ev);
		if (this.isDouble(ev)) {
			this.finish();
			return;
		}
		if (this.isStray(ev)) return;
		if (this.pendingEnd) {
			this.placeBulge(ev);
			return;
		}
		let hit = this.snapAt(ev);
		this.hit = hit;
		if (!this.piece) {
			this.begin(hit);
			return;
		}
		if (this.loose && !(hit.join && hit.join === this.firstId && this.canClose())) {
			// a 3-point Arc is done at its bend click: this click starts the next arc
			this.finish();
			this.see(ev);
			hit = this.snapAt(ev);
			this.hit = hit;
			this.begin(hit);
			return;
		}
		this.track(hit);
		if (hit.join && hit.join === this.lastId()) return;
		const closing = hit.join && hit.join === this.firstId;
		if (closing && !this.canClose()) return;
		if (this.leaveMode() === 'tangent' && this.dir !== null) {
			hit = this.arcTopHit(hit, ev);
			const to = this.addClick(hit, {
				tool: 'arc',
				mode: 'tangent',
				bulge: this.startBulge(hit),
				top: hit.arcTop || null,
			});
			if (to) this.loose = false;
			if (to && closing) this.finish();
			return;
		}
		// a corner: the end now, the bend on the next click
		const fresh = this.isStart() && this.dir === null;
		this.push();
		this.pendingEnd = this.placePoint(hit);
		this.threePoint = fresh;
		this.loose = false;
		this.bulgeAt = { x: hit.x, y: hit.y };
		this.bend = this.bendAt(this.bulgeAt, ev);
		pieceChanged();
	}

	/** The bend click: the arc from the open end to the pending end */
	placeBulge(ev) {
		const to = this.pendingEnd;
		const { bulge, snap } = this.bendAt({ x: ev.x, y: ev.y }, ev);
		const out = appendPart(this.sketch, this.piece, {
			tool: 'arc',
			to,
			mode: 'corner',
			bulge,
			top: topOn(snap),
		});
		const threePoint = this.threePoint;
		this.pendingEnd = null;
		this.bend = null;
		this.bulgeAt = null;
		this.threePoint = false;
		if (!out.added) {
			this.pop();
			return;
		}
		this.sketch = out.sketch;
		this.piece = out.piece;
		this.newLeave();
		pieceChanged();
		if (to === this.firstId) this.finish();
		else this.loose = threePoint;
	}

	move(ev) {
		this.see(ev);
		if (this.pendingEnd) {
			this.hit = null;
			this.bulgeAt = { x: ev.x, y: ev.y };
			this.bend = this.bendAt(this.bulgeAt, ev);
			return;
		}
		const hit = this.snapAt(ev);
		this.hit = hit;
		if (!this.piece) return;
		this.track(hit);
		if (this.loose) {
			const end = getPoint(this.sketch, this.lastId());
			const over =
				(hit.join && hit.join === this.lastId()) ||
				(end && Math.hypot(ev.x - end.x, ev.y - end.y) <= this.radius(ev));
			// over its end: going on from the 3-point Arc is meant
			if (over) this.loose = false;
		}
		if (!this.loose && this.leaveMode() === 'tangent' && this.dir !== null) {
			this.hit = this.arcTopHit(hit, ev);
		}
	}

	up(ev) {
		this.see(ev);
	}

	rubber() {
		if (!this.piece) return null;
		if (this.pendingEnd) {
			const target = getPoint(this.sketch, this.pendingEnd);
			if (!target) return null;
			const bulge = Number(this.bend?.bulge) || 0;
			return rubberPart(
				this,
				{ x: target.x, y: target.y, join: this.pendingEnd },
				{ tool: 'arc', mode: 'corner', bulge }
			);
		}
		// a finished 3-point Arc: nothing follows the pointer from it
		if (this.loose) return null;
		if (!this.hit || (this.hit.join && this.hit.join === this.lastId())) return null;
		if (this.leaveMode() === 'tangent' && this.dir !== null) {
			return rubberPart(this, this.hit, {
				tool: 'arc',
				mode: 'tangent',
				bulge: this.startBulge(this.hit),
			});
		}
		// a corner arc's chord until its end is clicked
		return rubberPart(this, this.hit, { tool: 'line', mode: 'corner' });
	}

	drawState() {
		const state = super.drawState();
		const snap = this.pendingEnd ? this.bend?.snap : null;
		if (snap) {
			const text = tagText(snap.tag);
			if (text) state.snap = { x: snap.x, y: snap.y, text };
			state.hints = [
				...(state.hints || []),
				...snap.hints.map((hint) => ({ ...hint, kind: hint.type })),
			];
		}
		return state;
	}

	/** While the bend is set: what the next click does, beside the pointer */
	readout() {
		if (!this.pendingEnd || !this.bulgeAt || this.bend?.snap?.touches) return null;
		if (!hasWord(BEND_KEY)) return null;
		return { x: this.bulgeAt.x, y: this.bulgeAt.y, key: BEND_KEY };
	}

	view() {
		return { ...super.view(), pending: !!this.pendingEnd, done: this.loose };
	}
}

/**
 * @param {Object} [ctx] - see line.js makeLineTool
 * @returns {ArcTool}
 */
export function makeArcTool(ctx) {
	return new ArcTool(ctx);
}
