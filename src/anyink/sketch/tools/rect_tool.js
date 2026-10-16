// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md section 2): the Rectangle tool (R in Simple with the sketch on).
	Click one corner, click the other (or press one and drag to the other): a closed loop of four
	Lines with corners (SolidWorks' corner rectangle), built through chain.js (startPiece,
	appendPart, finishPiece) so it is stored like any loop the Line tool closes.

	  - Each clicked corner snaps like any point (snap.js): onto an existing point (it joins), a
	    piece, a writing line (the edge rule on a Centerline), level / plumb with other points.
	  - The two corners made for it take their pins from the clicked ones: the corner beside a
	    clicked corner on a level line (a writing or half-way line) sits on that line too; else
	    the other clicked corner's plumb line (a letter edge, its middle, the Mirror line).
	  - Narrower or shorter than the snap radius makes nothing.
	  - The first corner is open for the Undo gate: an Undo, Backspace, Enter or Esc lets go of it
	    (circle_tool.js TwoPressTool). One step: "sketched a rectangle on small n".

	  makeRectTool(ctx?)    a Rectangle tool (ctx as line.js makeLineTool)
	  RectTool
	  rectCorners(a, b)     the four corners in order, { x, y, on } each (on: the pin, or null)
*/
import { LINES, isNewerSketch, addPoint } from '../model.js';
import { appendPart, finishPiece, startPiece } from './chain.js';
import { STEP_KEYS } from './line.js';
import { pinFields, relationsFor } from './snap.js';
import { TwoPressTool } from './circle_tool.js';

const LEVEL_PLACES = Object.freeze([...LINES, 'halfSmall', 'halfCapitals']);
const PLUMB_PLACES = Object.freeze(['left', 'right', 'middle', 'mirror']);

const levelOf = (hit) => (LEVEL_PLACES.includes(hit?.on) ? hit.on : null);
const plumbOf = (hit) => (PLUMB_PLACES.includes(hit?.on) ? hit.on : null);

/**
 * @param {Object} a - the first clicked corner (snap.js result)
 * @param {Object} b - the second
 * @returns {Array<{x: Number, y: Number, on: String | null}>} a, beside a, b, beside b
 */
export function rectCorners(a, b) {
	return [
		{ x: Math.round(a.x), y: Math.round(a.y), on: a.on || null },
		{ x: Math.round(b.x), y: Math.round(a.y), on: levelOf(a) ?? plumbOf(b) },
		{ x: Math.round(b.x), y: Math.round(b.y), on: b.on || null },
		{ x: Math.round(a.x), y: Math.round(b.y), on: levelOf(b) ?? plumbOf(a) },
	];
}

/**
 * The Rectangle tool (R).
 */
export class RectTool extends TwoPressTool {
	constructor(ctx) {
		super(ctx, 'rectangle');
	}

	down(ev) {
		this.see(ev);
		const hit = this.snapAt(ev);
		this.hit = hit;
		if (!this.center) {
			const stored = this.storedSketch();
			if (stored && isNewerSketch(stored)) return;
			this.openCenter(hit);
			this.pressed = { x: ev.x, y: ev.y, dragging: false };
			return;
		}
		this.make(hit);
	}

	move(ev) {
		this.see(ev);
		if (this.pressed && !this.pressed.dragging && Math.hypot(ev.x - this.pressed.x, ev.y - this.pressed.y) > this.radius(ev)) {
			this.pressed.dragging = true;
		}
		this.hit = this.snapAt(ev);
		if (this.center) this.size = this.hit;
	}

	up(ev) {
		this.see(ev);
		const pressed = this.pressed;
		this.pressed = null;
		if (pressed?.dragging && this.center) this.make(this.snapAt(ev));
	}

	/** @returns {Boolean} the two corners are far enough apart both ways */
	bigEnough(b) {
		const r = this.radius();
		return Math.abs(b.x - this.center.x) >= r && Math.abs(b.y - this.center.y) >= r;
	}

	/**
	 * Stores the loop as one step.
	 * @param {Object} b - the second corner (snap.js result)
	 * @returns {Object | null} the result, or null when nothing was made
	 */
	make(b) {
		const a = this.center;
		const use = this.use;
		const editor = this.editor;
		const item = this.item;
		if (!this.bigEnough(b)) {
			this.cancel();
			return null;
		}
		let sketch = this.baseSketch(use);
		this.cancel();
		const pin = (on) => {
			if (!on) return {};
			return LINES.includes(on) && use !== 'outline' ? { on, inset: 'edge' } : { on };
		};
		const corners = rectCorners(a, b);
		const ids = corners.map((corner, i) => {
			const hit = i === 0 ? a : i === 2 ? b : null;
			if (hit?.join && sketch.points[hit.join]) return hit.join;
			const fields = hit ? pinFields(hit) : pin(corner.on);
			const id = addPoint(sketch, { x: corner.x, y: corner.y, kind: 'corner', ...fields });
			if (hit) sketch.relations = [...(sketch.relations || []), ...relationsFor(hit, id)];
			return id;
		});
		let piece = startPiece(ids[0], { use });
		for (const to of [ids[1], ids[2], ids[3], ids[0]]) {
			const out = appendPart(sketch, piece, { tool: 'line', to, mode: 'corner' });
			sketch = out.sketch;
			piece = out.piece;
		}
		const done = finishPiece(sketch, piece, { use, font: this.font() });
		if (!done.piece) return null;
		const result = { sketch: done.sketch, piece: done.piece, stepKey: STEP_KEYS.rectangle, item };
		this.store(result, editor, item);
		return result;
	}

	drawState() {
		const state = this.hoverState();
		if (this.center) {
			state.points = [...(state.points || []), { x: this.center.x, y: this.center.y, stuck: !!this.center.snapped }];
			if (this.size) {
				const c = rectCorners(this.center, this.size).map((corner) => [corner.x, corner.y]);
				state.open = {
					cubics: c.map((p, i) => {
						const q = c[(i + 1) % 4];
						return [p, [...p], [...q], q];
					}),
				};
				state.inkLines = this.use !== 'outline';
			}
		}
		return state;
	}
}

/**
 * @param {Object} [ctx] - see line.js makeLineTool
 * @returns {RectTool}
 */
export function makeRectTool(ctx) {
	return new RectTool(ctx);
}
