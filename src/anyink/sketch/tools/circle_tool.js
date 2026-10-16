// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md sections 2, 6 and 8): the Circle tool (C; O and Q too in Simple).

	  - Click the center and drag the size; or click the center, move, and click the size. The
	    center snaps like any point and to the half-way lines too (snap.js halfway). The size
	    follows the pointer unsnapped. Shift makes an oval (its width and height from the
	    pointer).
	  - Click on one writing line, then on another: a circle that fills the space between them,
	    centered on the first click: on a Centerline its ink edges touch both lines (the edge
	    rule, its top and bottom points pinned with inset 'edge'), on an Outline its points sit
	    on the lines; round tops and bottoms add the overshoot (edge_rule.js edgeY).
	  - Stored as a live circle: a closed piece { circle: { cx, cy, rx, ry }, parts: [one spline
	    through four smooth points: right, top, left, bottom] }, the sides locked plumb and the
	    top and bottom level (so a circle let go later stays an oval, curves.js ellipseRing).
	  - Smaller than the snap radius: a 1-point piece (a dot on a Centerline, nothing on an
	    Outline).
	  - A half-made circle (its center placed) is open for the Undo gate: an Undo, Backspace or
	    Esc lets go of it; nothing is stored. Switching tools or letters drops it too.
	A circle never chains: a piece the Line, Arc or Spline tool held open is finished when the
	Circle tool is picked (line.js toolOff). One step: "sketched a circle on small n".

	  makeCircleTool(ctx?)   a Circle tool (ctx as line.js makeLineTool)
	  CircleTool
	  TwoPressTool           the two-press base the Rectangle tool shares (first press open for the
	                         Undo gate; Undo, Backspace, Enter or Esc let go of it)
	  circleSize(center, pointer, { shift })   { rx, ry }: whole font units
*/
import { guideLines } from '../../placement/classes.js';
import { circleCubics } from '../curves.js';
import { edgeY, LINE_NAMES, placeEdgePoints } from '../edge_rule.js';
import { addPiece, addPoint, isNewerSketch, newSketch } from '../model.js';
import { pinFields, relationsFor, tagText } from './snap.js';
import { SketchTool, STEP_KEYS } from './line.js';
import { clearOpenPiece, pieceChanged, runUndo, setOpenPiece } from './undo_gate.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * @param {{x, y}} center
 * @param {{x, y}} pointer
 * @param {{shift?: Boolean}} [options]
 * @returns {{rx: Number, ry: Number}}
 */
export function circleSize(center, pointer, { shift = false } = {}) {
	const dx = Math.abs(Number(pointer.x) - Number(center.x));
	const dy = Math.abs(Number(pointer.y) - Number(center.y));
	if (shift) return { rx: Math.round(dx), ry: Math.round(dy) };
	const r = Math.round(Math.hypot(dx, dy));
	return { rx: r, ry: r };
}

/**
 * A tool whose shape is made by two presses (a press and a drag, or two clicks): the Circle and
 * Rectangle tools. The first press is open for the Undo gate; an Undo, Backspace, Enter or Esc
 * lets go of it, and switching tools drops it. Nothing chains from it.
 */
export class TwoPressTool extends SketchTool {
	clearExtra() {
		this.center = null;
		this.size = null;
	}

	isOpen() {
		return !!this.center;
	}

	pointCount() {
		return this.center ? 1 : 0;
	}

	takeBack() {
		if (!this.center) return null;
		this.cancel();
		return 'cancelled';
	}

	/** A half-made shape is let go of, never stored half-made */
	finish() {
		if (this.center) this.cancel();
		return null;
	}

	key(press) {
		if (press?.type !== 'down' || !this.center) return false;
		const key = String(press.key || '').toLowerCase();
		if (key === 'enter' || key === 'escape') {
			this.cancel();
			return true;
		}
		if (key === 'backspace') {
			if (!runUndo('undo')) this.takeBack();
			return true;
		}
		return false;
	}

	doubleClick() {}

	toolOff() {
		this.pressed = null;
		this.hit = null;
		if (this.center) this.cancel();
	}

	toolOn() {}

	/** The first press is placed: open for the Undo gate */
	openCenter(hit) {
		this.center = hit;
		this.use = this.newUse(this.storedSketch());
		const handle = {
			itemID: this.editor?.selectedItemID ?? this.item?.id ?? null,
			pointCount: () => this.pointCount(),
			removeLastPoint: () => this.takeBack(),
			cancel: () => this.cancel(),
			finish: () => this.finish(),
		};
		this.gate = handle;
		setOpenPiece(handle);
		pieceChanged();
	}

	cancel() {
		const gate = this.gate;
		this.clear();
		if (gate) clearOpenPiece(gate);
	}

	/** @returns {Object} the letter's sketch to add to (a copy), or a new one */
	baseSketch(use) {
		const stored = this.storedSketch();
		const sketch = stored ? clone(stored) : newSketch({ thickness: this.newThickness() });
		if (!stored) sketch.way = use;
		if (!(Number(sketch.thickness) > 0)) sketch.thickness = this.newThickness();
		return sketch;
	}

	/** The hover dot, its tag and hints */
	hoverState() {
		const state = {};
		const hit = this.hit;
		if (!hit) return state;
		state.points = [{ x: hit.x, y: hit.y, stuck: !!hit.snapped, hot: true }];
		const text = hit.snapped ? tagText(hit.tag) : '';
		if (text) state.snap = { x: hit.x, y: hit.y, text };
		state.hints = (hit.hints || []).map((hint) => ({ ...hint, kind: hint.type }));
		return state;
	}

	view() {
		return { open: this.isOpen(), center: this.center ? { x: this.center.x, y: this.center.y } : null, hit: this.hit };
	}
}

/**
 * The Circle tool (C).
 */
export class CircleTool extends TwoPressTool {
	constructor(ctx) {
		super(ctx, 'circle');
	}

	down(ev) {
		this.see(ev);
		if (!this.center) {
			const hit = this.snapAt(ev, { halfway: true });
			this.hit = hit;
			if (this.storedSketch() && isNewerSketch(this.storedSketch())) return;
			this.openCenter(hit);
			this.pressed = { x: ev.x, y: ev.y, dragging: false };
			return;
		}
		const hit = this.snapAt(ev);
		this.hit = hit;
		this.make(ev, hit);
	}

	move(ev) {
		this.see(ev);
		if (this.pressed && !this.pressed.dragging && Math.hypot(ev.x - this.pressed.x, ev.y - this.pressed.y) > this.radius(ev)) {
			this.pressed.dragging = true;
		}
		this.hit = this.snapAt(ev, this.center ? {} : { halfway: true });
		if (this.center) this.size = { x: ev.x, y: ev.y, shift: !!ev.shift };
	}

	up(ev) {
		this.see(ev);
		const pressed = this.pressed;
		this.pressed = null;
		if (pressed?.dragging && this.center) this.make(ev, null);
	}

	/** @returns {[String, String] | null} the two writing lines a between-lines circle fills */
	betweenLines(hit) {
		const first = this.center?.on;
		const second = hit?.on;
		if (!LINE_NAMES.includes(first) || !LINE_NAMES.includes(second) || first === second) return null;
		const lines = guideLines(this.font());
		return lines[first] > lines[second] ? [first, second] : [second, first];
	}

	/**
	 * The circle the press makes, as data (nothing stored).
	 * @returns {{circle?: Object, top?: Object, bottom?: Object, dot?: Boolean}}
	 */
	shapeFor(ev, hit) {
		const center = this.center;
		const between = this.betweenLines(hit);
		const sketch = this.storedSketch();
		const thickness = Number(sketch?.thickness) > 0 ? sketch.thickness : this.newThickness();
		if (between) {
			const font = this.font();
			const pin = (on) => ({
				on,
				...(this.use === 'outline' ? {} : { inset: 'edge' }),
				kind: 'smooth',
				lock: 'level',
			});
			const top = pin(between[0]);
			const bottom = pin(between[1]);
			const topY = edgeY(top, font, thickness);
			const bottomY = edgeY(bottom, font, thickness);
			const ry = (topY - bottomY) / 2;
			if (ry > 0) {
				return { circle: { cx: Math.round(center.x), cy: (topY + bottomY) / 2, rx: ry, ry }, top, bottom, topY, bottomY };
			}
		}
		const { rx, ry } = circleSize(center, ev, { shift: !!ev.shift });
		if (Math.hypot(ev.x - center.x, ev.y - center.y) < this.radius(ev) || !(rx > 0) || !(ry > 0)) return { dot: true };
		return { circle: { cx: Math.round(center.x), cy: Math.round(center.y), rx, ry } };
	}

	/** Stores the circle (or the dot) as one step */
	make(ev, hit) {
		const shape = this.shapeFor(ev, hit);
		const center = this.center;
		const use = this.use;
		const editor = this.editor;
		const item = this.item;
		if (shape.dot && use === 'outline') {
			this.cancel();
			return null;
		}
		const sketch = this.baseSketch(use);
		this.cancel();
		let piece;
		if (shape.dot) {
			const id = addPoint(sketch, { x: center.x, y: center.y, kind: 'corner', ...pinFields(center) });
			sketch.relations = [...(sketch.relations || []), ...relationsFor(center, id)];
			piece = addPiece(sketch, { use, parts: [{ type: 'spline', points: [id] }] });
		} else {
			const { cx, cy, rx, ry } = shape.circle;
			const right = addPoint(sketch, { x: cx + rx, y: cy, kind: 'smooth', lock: 'plumb' });
			const top = addPoint(sketch, { x: cx, y: shape.topY ?? cy + ry, ...(shape.top || { kind: 'smooth', lock: 'level' }) });
			const left = addPoint(sketch, { x: cx - rx, y: cy, kind: 'smooth', lock: 'plumb' });
			const bottom = addPoint(sketch, { x: cx, y: shape.bottomY ?? cy - ry, ...(shape.bottom || { kind: 'smooth', lock: 'level' }) });
			piece = addPiece(sketch, {
				use,
				closed: true,
				circle: { cx, cy, rx, ry },
				parts: [{ type: 'spline', points: [right, top, left, bottom] }],
			});
		}
		const placed = placeEdgePoints(sketch, this.font());
		const result = {
			sketch: placed,
			piece: placed.pieces.find((one) => one.id === piece.id),
			stepKey: STEP_KEYS.circle,
			item,
		};
		this.store(result, editor, item);
		return result;
	}

	drawState() {
		const state = this.hoverState();
		if (this.center) {
			state.points = [...(state.points || []), { x: this.center.x, y: this.center.y, stuck: !!this.center.snapped }];
			if (this.size) {
				const shape = this.shapeFor(this.size, this.hit);
				if (shape.circle) {
					state.open = { cubics: circleCubics(shape.circle) };
					state.inkLines = this.use !== 'outline';
				}
			}
		}
		return state;
	}
}

/**
 * @param {Object} [ctx] - see line.js makeLineTool
 * @returns {CircleTool}
 */
export function makeCircleTool(ctx) {
	return new CircleTool(ctx);
}
