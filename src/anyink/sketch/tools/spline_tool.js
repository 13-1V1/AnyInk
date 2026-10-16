// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md sections 2, 6 and 9): the Spline tool (S; P in Simple). Click
	points; one smooth curve runs through them (curves.js builds it with Hobby's method, hobby.js).
	"Fewer points, smoother curve."

	  - Every point the Spline places is smooth. Clicks after the first go on the same spline
	    part (chain.js appendPart with mode 'tangent' extends it).
	  - Click-and-drag on a point aims its direction (point.aim = { dir, tin: 1, tout: 1 },
	    degrees, the way the pointer was dragged): MetaPost's z{dir}. The curve passes through
	    the point that way.
	  - After another part (a piece handed over from the Line or Arc tool): how the pointer leaves
	    the open end decides (chain.js createLeave): along the curve, the join is smooth (the
	    Spline starts in the Line's direction, give-way); at an angle, a corner.
	  - Enter, a double-click or Esc finish (Esc on the first point alone lets go of it); clicking the first point (3 points or more) closes
	    the loop: one spline alone is then a loop through its points. A 2-point Spline is stored
	    as a Line (chain.js finishPiece). Level / plumb locks are settled at finish (a point on a
	    level line where the curve touches it, a bowl's top and sides), then the edge rule places
	    pinned points (inset and the overshoot of round tops).
	Everything shared lives in line.js SketchTool.

	  makeSplineTool(ctx?)   a Spline tool (ctx as line.js makeLineTool)
	  SplineTool
	  aimDirection(from, to) degrees 0 to 360, two decimals
*/
import { piecePointIds } from '../model.js';
import { SketchTool, rubberPart } from './line.js';
import { pieceChanged } from './undo_gate.js';

/**
 * @param {{x, y}} from
 * @param {{x, y}} to
 * @returns {Number} degrees, 0 = right, 90 = up
 */
export function aimDirection(from, to) {
	const raw = (Math.atan2(Number(to.y) - Number(from.y), Number(to.x) - Number(from.x)) * 180) / Math.PI;
	const dir = Math.round((((raw % 360) + 360) % 360) * 100) / 100;
	return dir === 360 ? 0 : dir;
}

/**
 * The Spline tool (S).
 */
export class SplineTool extends SketchTool {
	constructor(ctx) {
		super(ctx, 'spline');
	}

	canClose() {
		return !!this.piece && piecePointIds(this.piece).length >= 3;
	}

	/** @returns {'tangent' | 'corner'} how the next spline point joins the open end */
	joinMode() {
		const last = (this.piece?.parts || []).at(-1);
		if (!this.isStart() && last?.type === 'spline') return 'tangent';
		return this.leaveMode();
	}

	down(ev) {
		this.see(ev);
		if (this.isDouble(ev)) {
			this.finish();
			return;
		}
		if (this.isStray(ev)) return;
		const hit = this.snapAt(ev);
		this.hit = hit;
		if (!this.piece) {
			if (this.begin(hit, { kind: 'smooth' })) this.pressed = { x: ev.x, y: ev.y, id: this.firstId, aiming: false };
			return;
		}
		this.track(hit);
		if (hit.join && hit.join === this.lastId()) return;
		const closing = hit.join && hit.join === this.firstId;
		if (closing && !this.canClose()) return;
		const to = this.addClick(hit, { tool: 'spline', mode: this.joinMode() }, { kind: 'smooth' });
		if (!to) return;
		if (closing) {
			this.finish();
			return;
		}
		this.pressed = { x: ev.x, y: ev.y, id: to, aiming: false };
	}

	move(ev) {
		this.see(ev);
		const pressed = this.pressed;
		if (pressed && this.piece) {
			if (!pressed.aiming && Math.hypot(ev.x - pressed.x, ev.y - pressed.y) > this.radius(ev)) {
				pressed.aiming = true;
			}
			if (pressed.aiming) {
				this.aim(pressed.id, ev);
				this.hit = null;
				return;
			}
		}
		const hit = this.snapAt(ev);
		this.hit = hit;
		if (this.piece) this.track(hit);
	}

	up(ev) {
		this.see(ev);
		const pressed = this.pressed;
		this.pressed = null;
		if (pressed?.aiming && this.piece) {
			this.aim(pressed.id, ev);
			this.newLeave();
		}
	}

	/** Aims a point the tool placed at the pointer */
	aim(id, ev) {
		const point = this.sketch?.points?.[id];
		if (!point || !this.made.has(id)) return;
		const dir = aimDirection(point, ev);
		this.sketch = {
			...this.sketch,
			points: { ...this.sketch.points, [id]: { ...point, kind: 'smooth', aim: { dir, tin: 1, tout: 1 } } },
		};
		pieceChanged();
	}

	rubber() {
		if (!this.piece || !this.hit || (this.hit.join && this.hit.join === this.lastId())) return null;
		return rubberPart(this, this.hit, { tool: 'spline', mode: this.joinMode(), kind: 'smooth' });
	}
}

/**
 * @param {Object} [ctx] - see line.js makeLineTool
 * @returns {SplineTool}
 */
export function makeSplineTool(ctx) {
	return new SplineTool(ctx);
}
