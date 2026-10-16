// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5, "Select (V) on a sketched letter"): Select on a sketch. In Simple
	with the 'sketch' flag on, Select (V, E) on a letter whose sketch is live picks and drags the
	sketch itself; the built ink is never touched (it is rebuilt from the sketch inside each step),
	so the sketch is never set aside. tools/tool_route.js routes the presses and keys here
	(sketchSelectPointer, activeSketchTool); the draw layer paints drawState.

	Picking (pick.js): a click picks a point or a piece; Ctrl+click adds or takes out; a window
	from empty canvas picks what is fully inside (left to right) or everything it touches (right
	to left); a click on empty canvas or Esc clears.

	Dragging, ONE history step on release (the ink is rebuilt inside it by the History hook),
	'sketchEdit' published per tick ({ itemId, kind, dragging: true }) and once on release
	({ dragging: false }); while dragging the draw layer shows the sketch moved and its real swept
	ink (cheap: no refit), so nothing in the font changes until the release:
	  a point            moves (snapped to the writing lines and level / plumb hints unless Ctrl;
	                     Shift: level, plumb or 45 degrees from where it was); "moved a sketch
	                     point on small n"
	  a picked group     (2 or more points, or any picked piece) moves whole; Shift locks it level
	                     or plumb; "moved part of small n"
	  a corner handle    of the group's box scales it about the opposite corner, keeping its
	                     proportions (Shift: freely); thickness never scales; "resized part of
	                     small n"
	  an unpicked piece  Bend (bend.js): an Arc keeps its ends and its bulge changes, a curve or
	                     Spline bows toward the pointer, a Line moves whole; "bent a curve on
	                     small n" / "moved a line on small n"
	  a Circle's edge    resizes it about its center (Shift: an oval); "resized a circle on small n"
	  a grip             (grips.js) on the one picked point: direction, pull or both; "aimed a
	                     curve on small n"
	Every move goes through the drag rules (rules.js) in their fixed order; when two disagree,
	"Can't keep both: a point of small n let go of the writing line." with [Undo].

	Double-click: a point toggles Smooth / Corner, a piece gets a point there, a grip lets the
	curve flow. Keys: Delete / Backspace delete the pick (the toast names it, with [Undo]); the
	arrows nudge it 1 unit (Shift 10), one step per run of presses; Esc lets go of a drag, then
	of the pick. Any other key goes on to the key map.

	  makeSelectTool()           the handler
	  installSketchSelect()      registers it once (tool_route.js); returns the handler
	  sketchPickOf(editor)       { itemId, points, pieces } picked on the open letter, pruned to
	                             what its sketch still has; null while Select is not on a sketch
	  runSketchEdit(editor, op, ...)   the card's buttons: 'smooth', 'corner', 'delete', 'flow',
	                             'endRound', 'endFlat', 'helper'; true when a step was recorded
	  commitSketch(editor, item, sketch, key, vars)   one named step (as the tools commit)
	  EDIT_TOPIC                 'sketchEdit'
	  PICK_TOPIC                 'sketchPick': the pick changed ({ itemId, points, pieces })
	  DRAG_PX                    screen pixels a press moves before it is a drag
*/
import { isFeatureOn } from '../mode/features.js';
import { sayDeleted } from '../letter/delete_toast.js';
import { undoOffer } from '../history/undo_toast.js';
import { isSimpleMode } from '../mode/mode.js';
import { toast } from '../toast/toast.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { bendPart } from './bend.js';
import {
	addPointOnPiece,
	deletePick,
	movePoints,
	resizeCircle,
	scalePoints,
	setPointEnd,
	setPointKind,
	toggleHelper,
	togglePointKind,
} from './edit_ops.js';
import { dragGrip, gripsFor, hitGrip, letItFlow } from './grips.js';
import { getPiece, isDot, isSketchActive, piecePointIds, setSketch, sketchOf } from './model.js';
import {
	emptyPick,
	hitTest,
	isEmptyPick,
	pickBox,
	pickedPointIds,
	pickHas,
	pickOnly,
	prunePick,
	samePick,
	togglePick,
	windowPick,
} from './pick.js';
import { applyDrag } from './rules.js';
import { isBuiltShape, markBuilt, sketchIdOf, sketchKeyOf } from './sketch_record.js';
import { letterThickness, previewOutlines } from './thickness.js';
import { isGoneFromFont, onItsLetter } from './tools/on_its_letter.js';
import { LINE_WORDS, snapPoint, snapRadius } from './tools/snap.js';
import { letterSnapContext } from './tools/snap_context.js';
import { registerSketchSelect } from './tools/tool_route.js';

export const EDIT_TOPIC = 'sketchEdit';
export const PICK_TOPIC = 'sketchPick';
export const DRAG_PX = 3;

/** Words for the places a point can let go of */
const PLACE_WORDS = Object.freeze({
	...LINE_WORDS,
	halfSmall: 'sketch.tag.halfway',
	halfCapitals: 'sketch.tag.halfway',
	left: 'canvas.leftEdge',
	right: 'canvas.rightEdge',
	middle: 'sketch.tag.middle',
	mirror: 'sketch.tag.mirror',
});

/** The step each drag records */
const DRAG_STEPS = Object.freeze({
	point: 'sketch.step.pointMoved',
	move: 'sketch.step.partMoved',
	scale: 'sketch.step.partResized',
	circle: 'sketch.step.circleResized',
	bent: 'sketch.step.bent',
	lineMoved: 'sketch.step.lineMoved',
	grip: 'sketch.step.aimed',
});

const ARROWS = Object.freeze({
	arrowleft: [-1, 0],
	arrowright: [1, 0],
	arrowup: [0, 1],
	arrowdown: [0, -1],
});

/** The one handler, for the card (sketchPickOf, runSketchEdit) */
let current = null;

// --------------------------------------------------------------
// Words and steps
// --------------------------------------------------------------

/** @returns {String} 'small n', or 'this letter' */
function letterOf(item) {
	return letterPhrase(item?.chars ?? '') || word('history.thisLetter');
}

/** @returns {String} a place's words: 'writing line' */
export function placeWords(on) {
	const key = PLACE_WORDS[on];
	return key ? word(key).replace(/^the /i, '') : '';
}

/**
 * One named step: the sketch stored on its letter, History's step (the ink rebuilt inside it).
 * @param {Object} editor
 * @param {Object} item
 * @param {Object} sketch
 * @param {String} key - a sketch.step.* words key
 * @returns {Boolean}
 */
export function commitSketch(editor, item, sketch, key) {
	if (!item || !sketch) return false;
	if (isGoneFromFont(editor, item)) return false;
	sketch.at = Date.now();
	const gone = dropGoneInk(item, sketch);
	setSketch(item, sketch);
	// the ink of a piece that went is taken out here, with the sketch's say-so: the hash agrees
	if (gone) markBuilt(item);
	const letter = letterOf(item);
	onItsLetter(editor, item, () => editor?.history?.addState?.(word(key, { letter })));
	editor?.publish?.('currentItem', editor.selectedItem || item);
	return true;
}

/**
 * The built shapes of pieces the new sketch no longer has, out of the letter (a deleted piece's
 * ink goes with it; left behind, the next step would find untagged ink and set the sketch aside).
 * @returns {Number} how many shapes went
 */
function dropGoneInk(item, sketch) {
	const before = sketchOf(item);
	if (!before?.key || before.key !== sketch.key || !Array.isArray(item.shapes)) return 0;
	const kept = new Set((sketch.pieces || []).map((piece) => piece.id));
	let gone = 0;
	for (let i = item.shapes.length - 1; i >= 0; i--) {
		const shape = item.shapes[i];
		if (!isBuiltShape(shape) || sketchKeyOf(shape) !== before.key) continue;
		if (kept.has(sketchIdOf(shape))) continue;
		item.shapes.splice(i, 1);
		gone += 1;
	}
	if (gone) item.changed?.();
	return gone;
}

/** "Can't keep both" once the step is the newest one */
function sayConflicts(editor, item, conflicts) {
	if (!conflicts?.length || !isSimpleMode()) return;
	const first = conflicts[0];
	const letter = letterOf(item);
	try {
		if (first.on) {
			toast(
				'sketch.toast.cantKeepBoth',
				{ letter, line: placeWords(first.on) },
				{ kind: 'destructive', ...undoOffer(editor) }
			);
		} else {
			toast(
				'sketch.toast.cantKeepPiece',
				{ letter },
				{ kind: 'destructive', ...undoOffer(editor) }
			);
		}
	} catch (error) {
		console.warn('ANY-INK sketch: the "can\'t keep both" toast was not shown', error);
	}
}

// --------------------------------------------------------------
// The handler
// --------------------------------------------------------------

/**
 * @returns {Object}
 */
export function makeSelectTool() {
	const tool = {
		editor: null,
		itemId: null,
		pick: emptyPick(),
		hover: null,
		press: null,
		working: null,
		result: null,
		nudge: null,
		pointer: null,
		previewKey: null,
		preview: null,

		/** Resets the pick when the letter changed */
		sync(editor) {
			if (editor) this.editor = editor;
			const id = editor?.selectedItemID ?? null;
			if (id !== this.itemId) {
				this.itemId = id;
				this.pick = emptyPick();
				this.hover = null;
				this.press = null;
				this.working = null;
				this.nudge = null;
			}
		},

		/** The open letter's live sketch, or null */
		stored(editor) {
			let item = null;
			try {
				item = editor?.selectedItem;
			} catch {
				return { item: null, sketch: null };
			}
			const sketch = sketchOf(item);
			return { item, sketch: isSketchActive(sketch) ? sketch : null };
		},

		livePick(sketch) {
			return sketch ? prunePick(sketch, this.pick) : emptyPick();
		},

		setPick(editor, pick) {
			const { sketch } = this.stored(editor);
			const next = sketch ? prunePick(sketch, pick) : emptyPick();
			if (samePick(next, this.pick)) return;
			this.pick = next;
			editor?.publish?.(PICK_TOPIC, { itemId: this.itemId, ...next });
			// the first pick on a sketch: "Filled dot: stuck to a line or another piece..."
			if (!isEmptyPick(next)) showDotsTip();
		},

		/** Grips of the one picked point, or null */
		grips(sketch) {
			const pick = this.livePick(sketch);
			if (pick.points.length !== 1 || pick.pieces.length) return null;
			return gripsFor(sketch, pick.points[0]);
		},

		/**
		 * The group's box corners (2 or more points move together), or null. Each handle sits a
		 * little outside its corner (`margin` font units, the snap radius on screen), so it never
		 * covers a point at that corner.
		 */
		handles(sketch, margin = 0) {
			const pick = this.livePick(sketch);
			if (!isGroup(sketch, pick)) return null;
			const box = pickBox(sketch, pick);
			// a plumb stem or a level bar has a box with no width or height: still resized by length
			if (!box || (box.xMax - box.xMin < 1 && box.yMax - box.yMin < 1)) return null;
			const m = Math.max(0, Number(margin) || 0);
			return [
				{ corner: 'bl', x: box.xMin - m, y: box.yMin - m },
				{ corner: 'br', x: box.xMax + m, y: box.yMin - m },
				{ corner: 'tl', x: box.xMin - m, y: box.yMax + m },
				{ corner: 'tr', x: box.xMax + m, y: box.yMax + m },
			];
		},

		/** What is under the pointer, Select's order: grips, box handles, points, pieces */
		hitAt(sketch, ev) {
			if (!sketch) return null;
			const radius = snapRadius(ev.view);
			const grips = this.grips(sketch);
			const which = hitGrip(grips, ev, radius);
			if (which) return { type: 'grip', which, grips };
			const handle = (this.handles(sketch, radius) || []).find(
				(h) => Math.hypot(h.x - ev.x, h.y - ev.y) <= radius / 2
			);
			if (handle) return { type: 'handle', ...handle };
			return hitTest(sketch, ev, radius);
		},

		hits(ev) {
			this.sync(ev.editor);
			return !!this.hitAt(this.stored(ev.editor).sketch, ev);
		},

		busy() {
			return !!this.press;
		},

		cursor() {
			if (this.press?.started) return this.press.kind === 'window' ? 'crosshair' : 'move';
			if (this.hover?.type === 'point' || this.hover?.type === 'grip') return 'move';
			if (this.hover?.type === 'handle') return 'crosshair';
			if (this.hover?.type === 'piece') return 'pointer';
			return 'arrow';
		},

		down(ev) {
			this.sync(ev.editor);
			this.finishNudge(ev.editor);
			if (ev.detail >= 2) return;
			const { sketch } = this.stored(ev.editor);
			if (!sketch) return;
			this.press = {
				at: { x: ev.x, y: ev.y },
				cx: ev.cx,
				cy: ev.cy,
				hit: this.hitAt(sketch, ev),
				ctrl: !!ev.ctrl,
				sketch: JSON.parse(JSON.stringify(sketch)),
				started: false,
				kind: null,
			};
		},

		move(ev) {
			this.sync(ev.editor);
			this.pointer = { x: ev.x, y: ev.y };
			const press = this.press;
			if (!press) {
				this.hover = this.hitAt(this.stored(ev.editor).sketch, ev);
				return;
			}
			if (!press.started) {
				if (Math.hypot(ev.cx - press.cx, ev.cy - press.cy) < DRAG_PX) return;
				this.start(ev);
			}
			this.update(ev);
		},

		up(ev) {
			const press = this.press;
			if (!press) return;
			if (press.started) {
				this.update(ev);
				this.finish(ev);
			} else {
				this.click(ev, press);
			}
			this.press = null;
		},

		start(ev) {
			const press = this.press;
			press.started = true;
			const sketch = press.sketch;
			const hit = press.hit;
			const pick = this.livePick(sketch);
			const group = isGroup(sketch, pick);
			if (!hit) {
				press.kind = 'window';
			} else if (hit.type === 'grip') {
				press.kind = 'grip';
			} else if (hit.type === 'handle') {
				press.kind = 'scale';
				press.ids = pickedPointIds(sketch, pick);
				const box = pickBox(sketch, pick);
				const left = hit.corner[1] === 'l';
				const bottom = hit.corner[0] === 'b';
				press.box = box;
				press.corner = { x: left ? box.xMin : box.xMax, y: bottom ? box.yMin : box.yMax };
				press.anchor = { x: left ? box.xMax : box.xMin, y: bottom ? box.yMax : box.yMin };
			} else if (pickHas(pick, hit) && group) {
				press.kind = 'move';
				press.ids = pickedPointIds(sketch, pick);
			} else if (hit.type === 'point') {
				press.kind = 'point';
				press.id = hit.id;
				if (!press.ctrl) this.setPick(ev.editor, pickOnly(hit));
			} else {
				const piece = getPiece(sketch, hit.id);
				if (piece?.circle) press.kind = 'circle';
				else if (isDot(piece)) {
					press.kind = 'point';
					press.id = piecePointIds(piece)[0];
				} else press.kind = 'bend';
			}
		},

		update(ev) {
			const press = this.press;
			if (!press?.started) return;
			const editor = ev.editor;
			const project = editor?.project;
			const font = project?.settings?.font || {};
			const radius = snapRadius(ev.view);
			const sketch = press.sketch;
			let dx = ev.x - press.at.x;
			let dy = ev.y - press.at.y;
			let result = null;
			press.letGoTag = null;
			if (press.kind === 'window') {
				press.box = { x0: press.at.x, y0: press.at.y, x1: ev.x, y1: ev.y };
				press.crossing = ev.x < press.at.x;
				this.working = null;
				return;
			}
			if (press.kind === 'point') {
				result = this.dragPoint(sketch, press.id, ev, { font, radius, project, item: ev.item });
			} else if (press.kind === 'move') {
				if (ev.shift) {
					if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
					else dx = 0;
				}
				result = movePoints(
					sketch,
					press.ids,
					{ x: Math.round(dx), y: Math.round(dy) },
					{ radius }
				);
			} else if (press.kind === 'scale') {
				result = scalePoints(sketch, press.ids, this.scaleOf(press, ev), { radius });
			} else if (press.kind === 'circle') {
				result = resizeCircle(sketch, press.hit.id, ev, { shift: !!ev.shift, radius });
			} else if (press.kind === 'bend') {
				result = bendPart(sketch, press.hit, ev, {
					radius,
					font,
					thickness: letterThickness(ev.item, project),
					grab: press.at,
				});
			} else if (press.kind === 'grip') {
				const next = dragGrip(sketch, press.hit.grips, press.hit.which, ev);
				result = next ? { sketch: next, letGo: [], conflicts: [] } : null;
			}
			this.result = result;
			this.working = result?.sketch || null;
			const letGo = result?.letGo?.find((each) => each.on);
			if (letGo) press.letGoTag = placeWords(letGo.on);
			editor?.publish?.(EDIT_TOPIC, { itemId: this.itemId, kind: press.kind, dragging: true });
		},

		/** A point dragged: snapped to the lines and level / plumb hints, then the rules */
		dragPoint(sketch, id, ev, { font, radius, item }) {
			const point = sketch.points[id];
			if (!point) return null;
			const piece = sketch.pieces.find((p) => piecePointIds(p).includes(id));
			const snap = snapPoint(
				{ x: ev.x, y: ev.y },
				{
					...letterSnapContext(item),
					inkMiddle: null,
					sketch,
					font,
					view: ev.view,
					thickness: letterThickness(item, ev.editor?.project),
					use: piece?.use || sketch.way,
					exclude: [id],
					excludePieces: sketch.pieces.map((p) => p.id),
					ctrl: !!ev.ctrl,
					shift: !!ev.shift,
					from: { x: Number(point.x), y: Number(point.y) },
				}
			);
			// a dragged point never joins another (that is a new piece's job): a join is the raw place
			const joined = !!snap.join;
			const target = joined
				? { x: ev.x, y: ev.y }
				: { x: snap.x, y: snap.y, ...(snap.on ? { pin: pinOf(snap) } : {}) };
			this.press.hints = joined ? [] : snap.hints || [];
			this.press.snapTag = joined ? null : snap.tag;
			return applyDrag(sketch, { [id]: { ...target, raw: { x: ev.x, y: ev.y } } }, { radius });
		},

		scaleOf(press, ev) {
			const { anchor, corner } = press;
			const wide = corner.x - anchor.x;
			const tall = corner.y - anchor.y;
			let sx = Math.abs(wide) >= 1 ? (ev.x - anchor.x) / wide : null;
			let sy = Math.abs(tall) >= 1 ? (ev.y - anchor.y) / tall : null;
			if (!ev.shift || sx === null || sy === null) {
				// keeping proportions: the way the box has room to grow leads
				const s = sx === null ? sy : sy === null ? sx : Math.max(sx, sy);
				sx = s;
				sy = s;
			}
			sx = Math.max(0.05, sx);
			sy = Math.max(0.05, sy);
			return { anchor, sx, sy };
		},

		finish(ev) {
			const press = this.press;
			const editor = ev.editor;
			if (press.kind === 'window') {
				const { sketch } = this.stored(editor);
				if (sketch && press.box) {
					const got = windowPick(sketch, press.box, { crossing: press.crossing });
					const base = press.ctrl ? this.livePick(sketch) : emptyPick();
					this.setPick(editor, {
						points: [...new Set([...base.points, ...got.points])],
						pieces: [...new Set([...base.pieces, ...got.pieces])],
					});
				}
				press.box = null;
				return;
			}
			const working = this.working;
			const result = this.result;
			this.working = null;
			this.result = null;
			editor?.publish?.(EDIT_TOPIC, { itemId: this.itemId, kind: press.kind, dragging: false });
			const { item, sketch } = this.stored(editor);
			if (!working || !item || !sketch) return;
			if (JSON.stringify(working) === JSON.stringify(sketch)) return;
			const key =
				press.kind === 'bend'
					? DRAG_STEPS[result?.kind] || DRAG_STEPS.bent
					: DRAG_STEPS[press.kind];
			if (commitSketch(editor, item, working, key)) sayConflicts(editor, item, result?.conflicts);
		},

		click(ev, press) {
			const editor = ev.editor;
			const hit = press.hit;
			if (hit?.type === 'point' || hit?.type === 'piece') {
				this.setPick(editor, press.ctrl ? togglePick(this.pick, hit) : pickOnly(hit));
			} else if (!hit && !press.ctrl) {
				this.setPick(editor, emptyPick());
			}
		},

		doubleClick(ev) {
			this.sync(ev.editor);
			const editor = ev.editor;
			const { item, sketch } = this.stored(editor);
			if (!sketch) return;
			const hit = this.hitAt(sketch, ev);
			if (!hit) return;
			if (hit.type === 'grip') {
				const next = letItFlow(sketch, hit.grips.id);
				if (next) commitSketch(editor, item, next, 'sketch.step.flow');
				return;
			}
			if (hit.type === 'point') {
				const next = togglePointKind(sketch, hit.id);
				if (!next) return;
				const kind = next.points[hit.id].kind;
				commitSketch(
					editor,
					item,
					next,
					kind === 'smooth' ? 'sketch.step.smooth' : 'sketch.step.corner'
				);
				this.setPick(editor, pickOnly(hit));
				return;
			}
			if (hit.type === 'piece') {
				const added = addPointOnPiece(sketch, hit);
				if (!added) return;
				commitSketch(editor, item, added.sketch, 'sketch.step.pointAdded');
				this.setPick(editor, { points: [added.id], pieces: [] });
			}
		},

		key(press) {
			const editor = press.editor;
			this.sync(editor);
			const arrow = ARROWS[press.key];
			if (press.type === 'up') {
				if (arrow && this.nudge) {
					this.finishNudge(editor);
					return true;
				}
				return false;
			}
			if (!arrow) this.finishNudge(editor);
			const { sketch } = this.stored(editor);
			const pick = this.livePick(sketch);
			if (press.key === 'escape' && !press.ctrl) {
				if (this.press) {
					this.press = null;
					this.working = null;
					this.result = null;
					editor?.publish?.(EDIT_TOPIC, { itemId: this.itemId, dragging: false });
					return true;
				}
				if (!isEmptyPick(pick)) {
					this.setPick(editor, emptyPick());
					return true;
				}
				return false;
			}
			if ((press.key === 'delete' || press.key === 'backspace') && !press.ctrl && !press.alt) {
				if (isEmptyPick(pick) || this.press) return false;
				return this.deleteNow(editor);
			}
			if (arrow && !press.ctrl && !press.alt && !isEmptyPick(pick) && !this.press) {
				const step = press.shift ? 10 : 1;
				if (!this.nudge) this.nudge = { sketch: JSON.parse(JSON.stringify(sketch)), dx: 0, dy: 0 };
				this.nudge.dx += arrow[0] * step;
				this.nudge.dy += arrow[1] * step;
				const ids = pickedPointIds(this.nudge.sketch, pick);
				const moved = movePoints(this.nudge.sketch, ids, { x: this.nudge.dx, y: this.nudge.dy });
				this.working = moved?.sketch || null;
				this.result = moved;
				editor?.publish?.(EDIT_TOPIC, { itemId: this.itemId, kind: 'nudge', dragging: true });
				return true;
			}
			return false;
		},

		finishNudge(editor) {
			const nudge = this.nudge;
			if (!nudge) return false;
			this.nudge = null;
			const working = this.working;
			const result = this.result;
			this.working = null;
			this.result = null;
			editor?.publish?.(EDIT_TOPIC, { itemId: this.itemId, kind: 'nudge', dragging: false });
			const { item, sketch } = this.stored(editor);
			if (!working || !sketch || JSON.stringify(working) === JSON.stringify(sketch)) return false;
			const done = commitSketch(editor, item, working, 'sketch.step.nudged');
			if (done) sayConflicts(editor, item, result?.conflicts);
			return done;
		},

		deleteNow(editor) {
			const { item, sketch } = this.stored(editor);
			const pick = this.livePick(sketch);
			const gone = sketch ? deletePick(sketch, pick) : null;
			if (!gone) return false;
			const key = gone.pieces ? 'sketch.step.pieceDeleted' : 'sketch.step.pointDeleted';
			this.pick = emptyPick();
			editor?.publish?.(PICK_TOPIC, { itemId: this.itemId, ...this.pick });
			if (!commitSketch(editor, item, gone.sketch, key)) return false;
			sayDeleted(editor, {
				what: gone.pieces ? 'sketchPiece' : 'sketchPoint',
				count: gone.pieces || gone.points,
			});
			return true;
		},

		toolOn() {
			this.hover = null;
		},

		toolOff() {
			this.press = null;
			this.working = null;
			this.nudge = null;
			this.hover = null;
			this.pick = emptyPick();
		},

		pointerOut() {
			this.hover = null;
			this.pointer = null;
		},

		/** The ink at the working sketch, swept for real, and the ink it covers (drawn once a frame) */
		inkPreview(editor, sketch) {
			const working = this.working;
			if (!working || !editor?.project) return null;
			if (this.previewKey === working) return this.preview;
			const item = editor.selectedItem;
			const thickness = letterThickness(item, editor.project);
			try {
				this.preview = {
					cover: previewOutlines(sketch, editor.project, thickness),
					ink: previewOutlines(working, editor.project, thickness),
				};
			} catch {
				this.preview = null;
			}
			this.previewKey = working;
			return this.preview;
		},

		drawState(item) {
			const editor = this.editor;
			const sketch = sketchOf(item);
			if (!isSketchActive(sketch)) return null;
			const shown = this.working || sketch;
			const pick = this.livePick(sketch);
			const hot = { points: [...pick.points], pieces: [...pick.pieces] };
			const hover = this.press ? null : this.hover;
			if (hover?.type === 'point' && !hot.points.includes(hover.id)) hot.points.push(hover.id);
			if (hover?.type === 'piece' && !hot.pieces.includes(hover.id)) hot.pieces.push(hover.id);
			if (this.press?.kind === 'bend' || this.press?.kind === 'circle') {
				if (!hot.pieces.includes(this.press.hit.id)) hot.pieces.push(this.press.hit.id);
			}
			const state = {
				sketch: shown,
				hot,
				inkLines: false,
				box:
					this.press?.kind === 'window' && this.press.box
						? { ...this.press.box, crossing: !!this.press.crossing }
						: null,
				handles: editor?.view ? this.handles(shown, snapRadius(editor.view)) : this.handles(shown),
				grips: this.grips(shown),
				inkPreview: editor ? this.inkPreview(editor, sketch) : null,
				hints: this.press?.kind === 'point' ? this.press.hints || [] : [],
			};
			if (this.press?.started && this.pointer) {
				if (this.press.letGoTag) {
					state.snap = {
						...this.pointer,
						tag: { key: 'sketch.tag.letGo', vars: { line: this.press.letGoTag } },
					};
				} else if (this.press.kind === 'point' && this.press.snapTag) {
					const at = shown.points[this.press.id];
					if (at) state.snap = { x: at.x, y: at.y, tag: this.press.snapTag };
				}
			}
			return state;
		},
	};
	return tool;
}

/** The dots tip (coach/tips.js sketchDots), loaded when first wanted */
function showDotsTip() {
	import('../coach/coach_state.js')
		.then((coach) => coach.showTip('sketchDots'))
		.catch(() => {});
}

/** A pick that moves as a group: 2 or more points, or a picked piece */
function isGroup(sketch, pick) {
	return pick.pieces.length > 0 || pickedPointIds(sketch, pick).length > 1;
}

function pinOf(snap) {
	return snap.inset ? { on: snap.on, inset: snap.inset } : { on: snap.on };
}

// --------------------------------------------------------------
// Install, and what the card reads
// --------------------------------------------------------------

/**
 * @returns {Object} the handler
 */
export function installSketchSelect() {
	if (current) return current.handler;
	const handler = makeSelectTool();
	const undo = registerSketchSelect(handler);
	current = { handler, undo };
	return handler;
}

/** Tests */
export function uninstallSketchSelectForTests() {
	current?.undo?.();
	current = null;
}

/**
 * @param {Object} editor
 * @returns {{itemId: String, points: Array, pieces: Array} | null}
 */
export function sketchPickOf(editor) {
	const handler = current?.handler;
	if (!handler || !isFeatureOn('sketch') || !isSimpleMode()) return null;
	if (editor?.selectedTool !== 'resize') return null;
	handler.sync(editor);
	const { sketch } = handler.stored(editor);
	if (!sketch) return null;
	const pick = handler.livePick(sketch);
	if (isEmptyPick(pick)) return null;
	return { itemId: handler.itemId, ...pick };
}

/**
 * The card's buttons.
 * @param {Object} editor
 * @param {String} op
 * @returns {Boolean}
 */
export function runSketchEdit(editor, op) {
	const handler = current?.handler;
	const picked = sketchPickOf(editor);
	if (!handler || !picked) return false;
	const { item, sketch } = handler.stored(editor);
	if (op === 'delete') return handler.deleteNow(editor);
	const id = picked.points.length === 1 && !picked.pieces.length ? picked.points[0] : null;
	const pieceId = picked.pieces.length === 1 && !picked.points.length ? picked.pieces[0] : null;
	let next = null;
	let key = '';
	if ((op === 'smooth' || op === 'corner') && id) {
		next = setPointKind(sketch, id, op);
		key = op === 'smooth' ? 'sketch.step.smooth' : 'sketch.step.corner';
	} else if (op === 'flow' && id) {
		next = letItFlow(sketch, id);
		key = 'sketch.step.flow';
	} else if ((op === 'endRound' || op === 'endFlat') && id) {
		next = setPointEnd(sketch, id, op === 'endRound' ? 'round' : 'flat');
		key = op === 'endRound' ? 'sketch.step.endRound' : 'sketch.step.endFlat';
	} else if (op === 'helper' && pieceId !== null) {
		const toggled = toggleHelper(sketch, pieceId);
		next = toggled?.sketch || null;
		key = toggled?.helper ? 'sketch.step.helperMade' : 'sketch.step.helperInked';
	}
	if (!next) return false;
	return commitSketch(editor, item, next, key);
}
