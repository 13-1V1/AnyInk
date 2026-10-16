// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md sections 2, 6 and 7): the Line tool (L), and the open-piece machinery
	the Arc and Spline tools share with it (SketchTool). Each tool is a pointer-driven state
	machine and a tool_route.js handler: down / move / up / doubleClick(ev), key(press), toolOn /
	toolOff, pointerOut and drawState(item) for the draw layer. ev is tool_route.js's event in font
	units, y up ({ x, y, shift, ctrl, snapsOff, detail, buttons, view, editor, item }).

	Who answers what:
	  snap.js snapPoint      where every press lands (points, pieces, writing lines through the
	                         edge rule, level / plumb hints, Shift's rays, Ctrl's no-snap); the
	                         tool stores pinFields and relationsFor with each new point
	  chain.js               the open piece: startPiece, appendPart (corner / tangent joins,
	                         give-way, the second click of a double-click adding nothing),
	                         createLeave (the 20 degree rule at 1.5x the snap radius, the Line's
	                         pull-back arc), leaveDirection, finishPiece (closing, degenerate
	                         pieces, locks, the edge rule)
	  undo_gate.js           the open piece is registered there (setOpenPiece) so every Undo
	                         entry takes back the last click while it is open
	  the tool               the working sketch, a snapshot per click (so a take-back restores
	                         kinds and give-way exactly), the press / drag / double-click reading,
	                         and the one commit per finished piece

	Line: click, click, click; Enter, a double-click (its second press adds nothing), Esc, or a
	click on the first point (a closed loop) finishes. Esc with only the first point placed lets
	go of it (nothing stored); a dot is deliberate: Enter on one point, or a double-click in place
	("put a dot on" when the words have sketch.step.dot). A press with detail 2 or more and no
	piece open (a triple-click's third press) adds nothing (isStray, all three tools). A tangent
	arc's end (the pull-back arc, the Arc's one-click arc) moves so the arc's top lands on a
	writing line when near one (arcTopHit, arc_snap.js). A click-drag from a fresh start draws one
	line and finishes. Pulling back over the last end and away again makes the next part a tangent
	arc (chain.js createLeave); doing it again goes back to a line; after an arc is placed the
	next part is a line again. While a Line part is drawn, its length and angle show at the cursor
	(drawState readout: font units and degrees, read in inches at 1 in capitals by the draw layer;
	lineReadout gives the same numbers).

	Finishing merges the piece onto the letter's sketch as it is NOW (an older Undo may have run
	under the open piece, undo_gate.js underOpenPiece): its new points get fresh ids, a joined
	point that is gone comes back at the tool's copy (undo_gate.js keepStartPoint). Then
	chain.js finishPiece stores it, and the tool commits ONE step: ctx.commit(result) when given,
	else commitToEditor (setSketch, History addState with the step's words, 'currentItem').
	result = { sketch, piece, stepKey, item }; stepKey names the tool that started the piece.

	Switching tools mid-piece (L, A, S): toolOff hands the open piece to the next chaining tool,
	whose toolOn picks it up, so the piece goes on with the same rule. Any other tool change
	finishes it (end(): S2 finalize, a stray first click alone is let go of there, and when the
	Undo gate ends the piece: another letter, a save, an older Undo). Esc with nothing open is left to tool_route.js (back to Select).

	  makeLineTool(ctx?)       a Line tool; ctx (all optional, for tests and callers):
	                           { getSketch(), font, view, thickness, use, commit(result),
	                             snapContext(ev) (extra snap context: edges, manual, inkMiddle) }
	                           Left out, each comes from the event's editor and letter.
	  SketchTool               the shared base class (arc_tool.js, spline_tool.js extend it)
	  lineReadout(from, to, font)   { length, angle, inches }: font units, 0-359 degrees, inches
	                           at 1 in capitals (two decimals)
	  commitToEditor(editor, item, result)   the default commit
	  STEP_KEYS                { line, arc, spline, circle, rectangle, dot }: the Undo titles' words
	  stepKeyFor(opener, piece)   the finished piece's title key (a dot, an Arc piece kept straight)
	  CHAIN_TOOLS              the tools an open piece passes between
	  takePassing()            tests: the piece in hand between toolOff and toolOn
*/
import {
	addPoint,
	getPoint,
	isDot,
	isNewerSketch,
	newSketch,
	nextPointId,
	piecePointIds,
	setSketch,
	sketchOf,
	sketchThickness,
} from '../model.js';
import { guideLines } from '../../placement/classes.js';
import { letterPhrase } from '../../words/letter_name.js';
import { hasWord, word } from '../../words/words.js';
import { tangentBulge } from '../arc.js';
import { endDirection, pieceSkeleton, startDirection } from '../curves.js';
import { snapTangentEnd } from './arc_snap.js';
import { appendPart, createLeave, finishPiece, leaveDirection, startPiece } from './chain.js';
import { pinFields, relationsFor, snapPoint, snapRadius, tagText } from './snap.js';
import { isGoneFromFont, liveItemOf, onItsLetter } from './on_its_letter.js';
import {
	clearOpenPiece,
	keepStartPoint,
	pieceChanged,
	runUndo,
	setOpenPiece,
} from './undo_gate.js';

export const STEP_KEYS = Object.freeze({
	line: 'sketch.step.line',
	arc: 'sketch.step.arc',
	spline: 'sketch.step.spline',
	circle: 'sketch.step.circle',
	rectangle: 'sketch.step.rectangle',
	dot: 'sketch.step.dot',
});

/**
 * The Undo title of a finished piece: a dot is named a dot (when the words have it), an Arc
 * piece with no arc in it (its end kept straight) a line, else the tool that started it.
 * @param {String} opener - the tool that started the piece
 * @param {Object} piece - the finished piece
 * @returns {String} a words key
 */
export function stepKeyFor(opener, piece) {
	if (isDot(piece) && hasWord(STEP_KEYS.dot)) return STEP_KEYS.dot;
	const curved = (piece?.parts || []).some((part) => part.type !== 'line');
	if (opener === 'arc' && !curved) return STEP_KEYS.line;
	return STEP_KEYS[opener] || STEP_KEYS.line;
}

/** tool_route.js names of the tools an open piece passes between */
export const CHAIN_TOOLS = Object.freeze(['sketchLine', 'sketchArc', 'sketchSpline']);

/** The tangent hint's line, in snap radii */
const HINT_REACH = 4;

/** The open piece between one tool's toolOff and the next tool's toolOn */
let passing = null;

/** The pointer as the sketch tools last saw it (font units), whichever tool saw it */
let pointerNow = null;

/** @returns {Object | null} tests: the piece in hand, taken */
export function takePassing() {
	const held = passing;
	passing = null;
	return held;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const dist = (a, b) => Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
const at = (point) => (point ? { x: Number(point.x), y: Number(point.y) } : null);

/**
 * @param {{x, y}} from
 * @param {{x, y}} to
 * @param {Object} font - project.settings.font
 * @returns {{length: Number, angle: Number, inches: Number}}
 */
export function lineReadout(from, to, font) {
	const dx = Number(to.x) - Number(from.x);
	const dy = Number(to.y) - Number(from.y);
	const length = Math.hypot(dx, dy);
	const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
	const angle = ((Math.round(raw) % 360) + 360) % 360;
	const capitals = guideLines(font).capitals;
	const inches = capitals > 0 ? Math.round((length / capitals) * 100) / 100 : 0;
	return { length, angle, inches };
}

/**
 * The default commit: the sketch stored on its letter, one History step named in house words.
 * @param {Object} editor - ProjectEditor
 * @param {Object} item - the letter the piece was drawn on
 * @param {{sketch: Object, stepKey: String}} result
 * @returns {Boolean}
 */
export function commitToEditor(editor, item, result) {
	if (!item || !result?.sketch) return false;
	// S2 integration: a font replaced under the piece (another font opened, a backup restored)
	// no longer holds its letter: nothing is stored anywhere
	if (isGoneFromFont(editor, item)) return false;
	setSketch(item, result.sketch);
	const letter = letterPhrase(item.chars ?? '') || word('history.thisLetter');
	// the step is the piece's own letter's, even when the view has moved on (on_its_letter.js)
	onItsLetter(editor, item, () => editor?.history?.addState?.(word(result.stepKey, { letter })));
	editor?.publish?.('currentItem', editor.selectedItem || item);
	return true;
}

/**
 * The open-piece machinery shared by the Line, Arc and Spline tools.
 */
export class SketchTool {
	/**
	 * @param {Object} ctx - see the header
	 * @param {String} name - 'line' | 'arc' | 'spline' (chain.js's tool names)
	 */
	constructor(ctx = {}, name) {
		this.ctx = ctx || {};
		this.name = name;
		this.hit = null;
		this.leaveState = null;
		this.pressed = null;
		this.clear();
	}

	// ----------------------------------------------------------
	// Where things come from
	// ----------------------------------------------------------

	/**
	 * @returns {Object | null} the letter's sketch as stored now; a set-aside one is null (S3
	 * finalize): a piece drawn on that letter starts a new sketch, and the old one's shapes, his
	 * own now, lose its tags at the step (sketch_record.js reconcile) and stay as plain ink
	 */
	storedSketch() {
		const stored =
			typeof this.ctx.getSketch === 'function'
				? this.ctx.getSketch() || null
				: sketchOf(this.item ? this.liveItem() : this.editor?.selectedItem) || null;
		return stored?.setAside === true ? null : stored;
	}

	/**
	 * S2 integration: the piece's letter as the font holds it now (an Undo under the open piece
	 * writes a new object for it); null when it is gone or the font was swapped.
	 * @returns {Object | null}
	 */
	liveItem() {
		return liveItemOf(this.editor, this.item, this.project);
	}

	/** @returns {Object} project.settings.font */
	font() {
		return this.ctx.font || this.editor?.project?.settings?.font || {};
	}

	/** @returns {Object} the view the snap radius is read from */
	viewOf(ev) {
		return this.ctx.view || ev?.view || this.editor?.view || { dx: 0, dy: 0, dz: 1 };
	}

	/** @returns {Number} the snap radius in font units */
	radius(ev) {
		return snapRadius(this.viewOf(ev ?? this.lastEv));
	}

	/** @returns {Number} the thickness a new sketch starts at */
	newThickness() {
		if (Number(this.ctx.thickness) > 0) return Math.round(this.ctx.thickness);
		const project = this.editor?.project;
		return project ? sketchThickness(project) : 0;
	}

	/** @returns {'center' | 'outline'} the use of a piece started now */
	newUse(stored) {
		if (this.ctx.use === 'center' || this.ctx.use === 'outline') return this.ctx.use;
		return stored?.way === 'outline' ? 'outline' : 'center';
	}

	/** Remembers the editor and letter an event came from */
	see(ev) {
		this.lastEv = ev;
		if (Number.isFinite(ev?.x) && Number.isFinite(ev?.y)) pointerNow = { x: ev.x, y: ev.y };
		if (!this.piece) {
			this.editor = ev?.editor ?? this.ctx.editor ?? this.editor ?? null;
			this.item = ev?.item ?? this.editor?.selectedItem ?? this.item ?? null;
			this.project = this.editor?.project ?? null;
		}
	}

	/**
	 * @param {Object} ev
	 * @param {Object} [extra] - more snap context (halfway, from)
	 * @returns {Object} snap.js's result
	 */
	snapAt(ev, extra = {}) {
		const sketch = this.sketch || this.storedSketch();
		const last = this.piece ? at(getPoint(this.sketch, this.lastId())) : null;
		const context = {
			sketch,
			font: this.font(),
			view: this.viewOf(ev),
			thickness: Number(sketch?.thickness) > 0 ? sketch.thickness : this.newThickness(),
			use: this.piece ? this.use : this.newUse(this.storedSketch()),
			first: this.piece && this.firstId ? this.firstId : undefined,
			from: last || undefined,
			shift: !!ev?.shift,
			ctrl: !!(ev?.snapsOff ?? ev?.ctrl),
			...(typeof this.ctx.snapContext === 'function' ? this.ctx.snapContext(ev) : {}),
			...extra,
		};
		return snapPoint({ x: ev.x, y: ev.y }, context);
	}

	// ----------------------------------------------------------
	// The open piece
	// ----------------------------------------------------------

	/** No piece open */
	clear() {
		this.sketch = null;
		this.piece = null;
		this.firstId = null;
		this.made = new Set();
		this.copies = {};
		this.stack = [];
		this.leave = null;
		this.leaveState = null;
		this.dir = null;
		this.opener = null;
		this.use = 'center';
		this.gate = null;
		this.clearExtra();
	}

	/** Subclasses: forget their own per-piece state */
	clearExtra() {}

	/** Subclasses: their own per-click state, kept in each snapshot */
	saveExtra() {
		return null;
	}

	/** Subclasses: put it back */
	restoreExtra() {}

	/** @returns {Boolean} */
	isOpen() {
		return !!this.piece;
	}

	/** @returns {String | null} the open end's point id */
	lastId() {
		const parts = this.piece?.parts || [];
		const last = parts.at(-1);
		if (!last) return null;
		return last.type === 'spline' ? last.points.at(-1) : last.to;
	}

	/** @returns {Boolean} the piece is still its first point alone */
	isStart() {
		const parts = this.piece?.parts || [];
		return parts.length === 1 && parts[0].type === 'spline' && parts[0].points.length === 1;
	}

	/** @returns {Number} the points placed so far */
	pointCount() {
		return this.piece ? piecePointIds(this.piece).length : 0;
	}

	/**
	 * Starts a piece at a snapped press.
	 * @param {Object} hit - snap.js's result
	 * @param {Object} [point] - fields for a new first point (kind)
	 * @returns {Boolean} false when this letter's sketch can't be drawn on
	 */
	begin(hit, point = {}) {
		const stored = this.storedSketch();
		if (stored && isNewerSketch(stored)) return false;
		const sketch = stored ? clone(stored) : newSketch({ thickness: this.newThickness() });
		if (!stored) sketch.way = this.newUse(null);
		if (!(Number(sketch.thickness) > 0)) sketch.thickness = this.newThickness();
		this.sketch = sketch;
		this.use = this.newUse(stored);
		this.opener = this.name;
		const id = this.placePoint(hit, point);
		this.firstId = id;
		this.piece = startPiece(id, { use: this.use });
		this.openGate();
		this.newLeave();
		pieceChanged();
		return true;
	}

	/**
	 * A point for a press: the point it joins, or a new one with its pins and relations.
	 * @returns {String} the point's id
	 */
	placePoint(hit, fields = {}) {
		const points = this.sketch.points;
		if (hit.join && points[hit.join]) {
			if (!this.made.has(hit.join) && !this.copies[hit.join]) {
				this.copies[hit.join] = { id: hit.join, ...points[hit.join] };
			}
			return hit.join;
		}
		const id = nextPointId(this.sketch);
		const point = {
			x: Math.round(hit.x),
			y: Math.round(hit.y),
			kind: 'corner',
			...pinFields(hit),
			...fields,
		};
		this.sketch = {
			...this.sketch,
			points: { ...points, [id]: point },
			relations: [...(this.sketch.relations || []), ...relationsFor(hit, id)],
		};
		this.made.add(id);
		return id;
	}

	/** One snapshot per click */
	push() {
		this.stack.push({
			sketch: this.sketch,
			piece: this.piece,
			made: [...this.made],
			copies: { ...this.copies },
			extra: this.saveExtra(),
		});
	}

	/** Back to the last snapshot */
	pop() {
		const top = this.stack.pop();
		if (!top) return false;
		this.sketch = top.sketch;
		this.piece = top.piece;
		this.made = new Set(top.made);
		this.copies = top.copies;
		this.restoreExtra(top.extra);
		this.newLeave();
		return true;
	}

	/**
	 * A click that adds a part from the open end to the press.
	 * @param {Object} hit
	 * @param {{tool: String, mode?: String, bulge?: Number, arc?: Boolean}} how
	 * @param {Object} [fields] - for a new point
	 * @returns {String | null} the new end's id, or null when nothing was added
	 */
	addClick(hit, how, fields = {}) {
		this.push();
		const to = this.placePoint(hit, fields);
		const out = appendPart(this.sketch, this.piece, { ...how, to });
		if (!out.added) {
			this.pop();
			return null;
		}
		this.sketch = out.sketch;
		this.piece = out.piece;
		this.newLeave();
		pieceChanged();
		return to;
	}

	/** A fresh leave tracker at the open end */
	newLeave() {
		if (!this.piece) return;
		const end = at(getPoint(this.sketch, this.lastId()));
		this.dir = leaveDirection(this.piece, this.sketch);
		if (this.dir === null && this.isStart()) this.dir = this.joinedDirection();
		this.leave = end
			? createLeave({
					end,
					dir: this.dir,
					radius: this.radius(),
					tool: this.name,
					from: pointerNow,
			  })
			: null;
		this.leaveState = { mode: 'pending', arc: false, hint: null };
	}

	/**
	 * A piece that starts on an open end of a stored piece leaves from that end's direction.
	 * @returns {Number | null} degrees
	 */
	joinedDirection() {
		const id = this.firstId;
		for (const other of this.sketch?.pieces || []) {
			if (!other || other.closed || !Array.isArray(other.parts) || !other.parts.length) continue;
			const ids = piecePointIds(other);
			if (ids.length < 2) continue;
			let cubics;
			try {
				cubics = pieceSkeleton(other, this.sketch);
			} catch {
				continue;
			}
			if (!cubics.length) continue;
			if (ids.at(-1) === id) return endDirection(cubics.at(-1));
			if (ids[0] === id) return (startDirection(cubics[0]) + 180) % 360;
		}
		return null;
	}

	/** @returns {'tangent' | 'corner'} how the next part leaves the open end */
	leaveMode() {
		return this.leaveState?.mode === 'tangent' ? 'tangent' : 'corner';
	}

	/** Follows the pointer for the leave rule */
	track(hit) {
		if (!this.leave || !hit) return;
		this.leaveState = this.leave.move({ x: hit.x, y: hit.y });
	}

	/**
	 * A tangent arc's bulge from the end's direction when chain.js has none (the first part of a
	 * piece that starts on another piece's end).
	 * @returns {Number | undefined}
	 */
	startBulge(target) {
		if (!this.isStart() || this.dir === null) return undefined;
		const end = getPoint(this.sketch, this.lastId());
		const bulge = tangentBulge([end.x, end.y], [target.x, target.y], this.dir);
		return bulge === null ? undefined : bulge;
	}

	/** Registers the open piece with the Undo gate */
	openGate() {
		const handle = {
			itemID: this.editor?.selectedItemID ?? this.item?.id ?? null,
			pointCount: () => this.pointCount() + this.pendingCount(),
			removeLastPoint: () => this.takeBack(),
			cancel: () => this.cancel(),
			finish: () => this.end(),
		};
		this.gate = handle;
		setOpenPiece(handle);
	}

	/** Subclasses: points placed that are not in a part yet */
	pendingCount() {
		return 0;
	}

	/**
	 * Takes back the last click; with only the first point left, cancels the piece.
	 * @returns {'taken' | 'cancelled' | null}
	 */
	takeBack() {
		if (!this.piece) return null;
		if (!this.stack.length) {
			this.cancel();
			return 'cancelled';
		}
		this.pop();
		pieceChanged();
		return 'taken';
	}

	/** Drops the open piece: nothing stored */
	cancel() {
		const gate = this.gate;
		this.clear();
		if (gate) clearOpenPiece(gate);
	}

	/**
	 * The piece merged onto the letter's sketch as it is now.
	 * @returns {{sketch: Object, piece: Object}}
	 */
	merged() {
		const stored = this.storedSketch();
		const usable = stored && !isNewerSketch(stored);
		const now = usable
			? clone(stored)
			: clone({ ...this.sketch, pieces: [], points: {}, relations: [] });
		if (!(Number(now.thickness) > 0)) now.thickness = this.sketch.thickness;
		const map = {};
		const ids = piecePointIds(this.piece);
		for (const id of ids) {
			if (this.made.has(id)) {
				map[id] = addPoint(now, { ...this.sketch.points[id] });
			} else if (now.points[id]) {
				map[id] = id;
				const kind = this.sketch.points[id]?.kind;
				if (kind && now.points[id].kind !== kind) now.points[id] = { ...now.points[id], kind };
			} else {
				map[id] = keepStartPoint(now, this.copies[id] || { id, ...this.sketch.points[id] });
			}
		}
		const remap = (id) => map[id] ?? id;
		const pieceIds = new Set((now.pieces || []).map((piece) => piece?.id));
		for (const relation of this.sketch.relations || []) {
			const mine = [relation.point, relation.a, relation.b].some(
				(id) => this.made.has(id) && ids.includes(id)
			);
			if (!mine) continue;
			const next = { ...relation };
			for (const key of ['point', 'a', 'b'])
				if (next[key] !== undefined) next[key] = remap(next[key]);
			const pointsThere = ['point', 'a', 'b'].every(
				(key) => next[key] === undefined || now.points[next[key]]
			);
			if (!pointsThere || (next.type === 'onPiece' && !pieceIds.has(next.piece))) continue;
			now.relations = [...(now.relations || []), next];
		}
		const piece = {
			...this.piece,
			parts: this.piece.parts.map((part) =>
				part.type === 'spline'
					? { ...part, points: part.points.map(remap) }
					: { ...part, from: remap(part.from), to: remap(part.to) }
			),
		};
		return { sketch: now, piece };
	}

	/**
	 * Stores the open piece as one step.
	 * @returns {Object | null} { sketch, piece, stepKey, item }, or null when nothing was stored
	 */
	finish() {
		if (!this.piece) return null;
		this.beforeFinish();
		const gate = this.gate;
		const opener = this.opener || this.name;
		const item = this.item ? this.liveItem() : null;
		const editor = this.editor;
		let result = null;
		if (this.item && !item) {
			// the letter or its font is gone: nothing to store it on
			this.clear();
			if (gate) clearOpenPiece(gate);
			return null;
		}
		try {
			const { sketch, piece } = this.merged();
			const out = finishPiece(sketch, piece, { use: this.use, font: this.font() });
			if (out.piece)
				result = { sketch: out.sketch, piece: out.piece, stepKey: stepKeyFor(opener, out.piece), item };
		} finally {
			this.clear();
			if (gate) clearOpenPiece(gate);
		}
		if (result) this.store(result, editor, item);
		return result;
	}

	/**
	 * S2 finalize: the piece ends because he left it (another tool, another letter, a save, an
	 * older Undo): a stray first click alone is let go of, as Esc does; a dot is deliberate
	 * (Enter on one point, or a double-click in place). Anything more is stored as one step.
	 * @returns {Object | null} finish()'s result, or null when nothing was stored
	 */
	end() {
		if (!this.piece) return null;
		if (this.isStart() && !this.pendingCount()) {
			this.cancel();
			return null;
		}
		return this.finish();
	}

	/** Subclasses: settle anything half-placed before the piece is stored */
	beforeFinish() {}

	/** Commits one finished piece */
	store(result, editor, item) {
		if (typeof this.ctx.commit === 'function') this.ctx.commit(result);
		else commitToEditor(editor, item, result);
	}

	// ----------------------------------------------------------
	// Handing the piece to another tool
	// ----------------------------------------------------------

	/** @returns {Object | null} the open piece, taken from this tool (not finished) */
	handOver() {
		if (!this.piece) return null;
		this.beforeHandOver();
		const state = {
			sketch: this.sketch,
			piece: this.piece,
			firstId: this.firstId,
			made: [...this.made],
			copies: { ...this.copies },
			stack: this.stack.map((entry) => ({ ...entry, extra: null })),
			use: this.use,
			opener: this.opener,
			item: this.item,
			editor: this.editor,
			project: this.project,
			gate: this.gate,
		};
		this.clear();
		return state;
	}

	/** Subclasses: drop a half-placed click before the piece moves on */
	beforeHandOver() {}

	/** Takes over a piece another tool was drawing */
	adopt(state) {
		if (!state?.piece) return false;
		this.clear();
		this.sketch = state.sketch;
		this.piece = state.piece;
		this.firstId = state.firstId;
		this.made = new Set(state.made);
		this.copies = { ...state.copies };
		this.stack = state.stack.slice();
		this.use = state.use;
		this.opener = state.opener;
		this.item = state.item;
		this.editor = state.editor;
		this.project = state.project ?? this.editor?.project ?? null;
		if (state.gate) clearOpenPiece(state.gate);
		this.openGate();
		this.newLeave();
		pieceChanged();
		return true;
	}

	/** tool_route.js: this tool was left */
	toolOff({ to } = {}) {
		this.pressed = null;
		this.hit = null;
		if (!this.piece) return;
		if (CHAIN_TOOLS.includes(to)) passing = this.handOver();
		else this.end();
	}

	/** tool_route.js: this tool was picked */
	toolOn() {
		const held = takePassing();
		if (held) this.adopt(held);
	}

	/** tool_route.js: the pointer left the canvas */
	pointerOut() {
		this.hit = null;
	}

	// ----------------------------------------------------------
	// Keys
	// ----------------------------------------------------------

	/**
	 * @param {{type: String, key: String}} press - tool_route.js's key press
	 * @returns {Boolean} true when the tool used it
	 */
	key(press) {
		if (press?.type !== 'down') return false;
		const key = String(press.key || '').toLowerCase();
		if (!this.piece) return false;
		if (key === 'escape' && this.isStart() && !this.pendingCount()) {
			// fix track tools: Esc after one stray click lets go of it (nothing stored); a dot is
			// Enter on one point, or a double-click in place
			this.cancel();
			return true;
		}
		if (key === 'enter' || key === 'escape') {
			this.finish();
			return true;
		}
		if (key === 'backspace') {
			if (!runUndo('undo')) this.takeBack();
			return true;
		}
		return false;
	}

	/**
	 * fix track tools: a press that is part of a multi-click (detail 2 or more) with no piece
	 * open, the third press of a triple-click after the double-click finished: adds nothing.
	 * @returns {Boolean}
	 */
	isStray(ev) {
		return !this.piece && Number(ev?.detail) >= 2;
	}

	/**
	 * A tangent arc's end, moved so the arc's top (or bottom) lands on a writing line when it
	 * comes near one (arc_snap.js snapTangentEnd). A click on a point or a piece keeps its join.
	 * @param {Object} hit - snap.js's result for the end
	 * @param {Object} ev
	 * @returns {Object} the hit, or a new one at the moved end with the line's tag at the top
	 */
	arcTopHit(hit, ev) {
		if (!this.piece || !hit || hit.join || hit.onPiece || this.dir === null) return hit;
		const end = getPoint(this.sketch, this.lastId());
		if (!end) return hit;
		const out = snapTangentEnd([Number(end.x), Number(end.y)], this.dir, hit, {
			font: this.font(),
			thickness: this.sketch?.thickness,
			use: this.use,
			radius: this.radius(ev),
			ctrl: !!(ev?.snapsOff ?? ev?.ctrl),
		});
		if (!out.snap) return hit;
		const tagAt = { x: out.snap.x, y: out.snap.y };
		const hints = [...(hit.hints || []), ...out.snap.hints];
		if (!out.snap.touches) return { ...hit, tag: hit.tag || out.snap.tag, tagAt, hints };
		return {
			x: out.end.x,
			y: out.end.y,
			raw: hit.raw,
			snapped: true,
			on: null,
			inset: null,
			join: null,
			closes: false,
			onPiece: null,
			pair: null,
			tag: out.snap.tag,
			tagAt,
			hints,
			// S3: the arc's part stores the line (part.top = { on }), chain.js appendPart
			arcTop: out.snap.on,
		};
	}

	/** tool_route.js: a double-click finishes the piece */
	doubleClick() {
		if (this.piece) this.finish();
	}

	/** @returns {Boolean} the press is a double-click's second press on an open piece */
	isDouble(ev) {
		return !!this.piece && Number(ev?.detail) >= 2;
	}

	// ----------------------------------------------------------
	// What the draw layer paints
	// ----------------------------------------------------------

	/**
	 * Subclasses: the open piece with the part under the pointer, or null.
	 * @returns {{sketch: Object, piece: Object} | null}
	 */
	rubber() {
		return null;
	}

	/**
	 * @returns {Object} drawState for draw_layer.js
	 */
	drawState() {
		const hit = this.hit;
		const state = {};
		if (this.sketch) state.sketch = this.sketch;
		if (this.piece) {
			const live = this.rubber();
			const sketch = live?.sketch || this.sketch;
			const piece = live?.piece || this.piece;
			state.open = { piece, sketch };
			const last = at(getPoint(this.sketch, this.lastId()));
			if (live && last) {
				let cubics = [];
				try {
					cubics = pieceSkeleton(piece, sketch);
				} catch {
					cubics = [];
				}
				let from = -1;
				cubics.forEach((cubic, i) => {
					if (cubic[0][0] === last.x && cubic[0][1] === last.y) from = i;
				});
				if (from >= 0) state.preview = { cubics: cubics.slice(from) };
			}
		}
		if (hit) {
			state.points = [{ x: hit.x, y: hit.y, stuck: !!hit.snapped, hot: true }];
			if (hit.join) state.hot = { points: [hit.join], pieces: [] };
			const text = tagText(hit.tag);
			const tagAt = hit.tagAt || hit;
			if (text) state.snap = { x: tagAt.x, y: tagAt.y, text };
			state.hints = (hit.hints || []).map((hint) => ({ ...hint, kind: hint.type }));
			if (this.piece && hit.closes && this.canClose())
				state.ring = at(getPoint(this.sketch, this.firstId));
		}
		const tangent = this.tangentHint();
		if (tangent) state.hints = [...(state.hints || []), tangent];
		const readout = this.readout();
		if (readout) state.readout = readout;
		return state;
	}

	/** @returns {Object | null} the faint tangent line at the open end */
	tangentHint() {
		const hint = this.leaveState?.hint;
		if (!this.piece || !hint) return null;
		const reach = HINT_REACH * this.radius();
		const a = (hint.dir * Math.PI) / 180;
		return {
			type: 'tangent',
			kind: 'tangent',
			from: { x: hint.from.x, y: hint.from.y },
			to: { x: hint.from.x + reach * Math.cos(a), y: hint.from.y + reach * Math.sin(a) },
			dir: hint.dir,
		};
	}

	/** Subclasses: the readout at the cursor, or null */
	readout() {
		return null;
	}

	/** Subclasses: a click on the first point may close the loop now */
	canClose() {
		return false;
	}

	/**
	 * A short summary for tests and the test page.
	 * @returns {Object}
	 */
	view() {
		const tangent = this.tangentHint();
		return {
			open: this.isOpen(),
			points: this.piece ? piecePointIds(this.piece) : [],
			leave: this.leaveState?.mode ?? null,
			mode: this.leaveState?.arc ? 'arc' : 'line',
			tangent: tangent ? { x: tangent.from.x, y: tangent.from.y, dir: tangent.dir } : null,
			overFirst: !!(this.piece && this.hit?.closes && this.canClose()),
			readout: this.readout(),
			hit: this.hit,
		};
	}
}

/**
 * The Line tool (L).
 */
export class LineTool extends SketchTool {
	constructor(ctx) {
		super(ctx, 'line');
	}

	canClose() {
		return (this.piece?.parts || []).length >= 2 && !this.isStart();
	}

	down(ev) {
		this.see(ev);
		if (this.isDouble(ev)) {
			this.finish();
			return;
		}
		if (this.isStray(ev)) return;
		let hit = this.snapAt(ev);
		this.hit = hit;
		if (!this.piece) {
			if (this.begin(hit)) this.pressed = { x: ev.x, y: ev.y, fresh: true, dragging: false };
			return;
		}
		this.track(hit);
		this.pressed = { x: ev.x, y: ev.y, fresh: false, dragging: false };
		if (hit.join && hit.join === this.lastId()) return;
		const closing = hit.join && hit.join === this.firstId;
		if (closing && !this.canClose()) return;
		const arc = !!this.leaveState?.arc;
		if (arc) hit = this.arcTopHit(hit, ev);
		const to = this.addClick(hit, {
			tool: 'line',
			mode: arc ? 'tangent' : this.leaveMode(),
			arc,
			bulge: arc ? this.startBulge(hit) : undefined,
			top: arc ? hit.arcTop || null : null,
		});
		if (to && closing) this.finish();
	}

	move(ev) {
		this.see(ev);
		if (this.pressed?.fresh && !this.pressed.dragging && dist(ev, this.pressed) > this.radius(ev)) {
			this.pressed.dragging = true;
		}
		const hit = this.snapAt(ev);
		this.hit = hit;
		if (this.piece && !this.pressed?.dragging) this.track(hit);
		if (this.piece && this.leaveState?.arc) this.hit = this.arcTopHit(hit, ev);
	}

	up(ev) {
		this.see(ev);
		const pressed = this.pressed;
		this.pressed = null;
		if (!pressed?.fresh || !pressed.dragging || !this.piece) return;
		const hit = this.snapAt(ev);
		this.hit = hit;
		if (this.addClick(hit, { tool: 'line', mode: 'corner' })) this.finish();
	}

	rubber() {
		if (!this.piece || !this.hit || this.isDoubleSpot()) return null;
		const arc = !!this.leaveState?.arc;
		return rubberPart(this, this.hit, {
			tool: 'line',
			mode: arc ? 'tangent' : this.leaveMode(),
			arc,
			bulge: arc ? this.startBulge(this.hit) : undefined,
		});
	}

	/** @returns {Boolean} the pointer is on the open end itself */
	isDoubleSpot() {
		const last = getPoint(this.sketch, this.lastId());
		return (
			!last || (this.hit.join && this.hit.join === this.lastId()) || dist(this.hit, last) < 0.5
		);
	}

	readout() {
		if (!this.piece || !this.hit || this.leaveState?.arc) return null;
		const last = getPoint(this.sketch, this.lastId());
		// S2 integration: nothing to read while the pointer sits on the open end ("0.00 in, 0°")
		if (!last || dist(this.hit, last) < 0.5) return null;
		const { length, angle } = lineReadout(last, this.hit, this.font());
		return { x: this.hit.x, y: this.hit.y, length, angle };
	}
}

/**
 * The open piece with a part to the pointer, for the picture (nothing is changed).
 * @param {SketchTool} tool
 * @param {Object} hit - where the pointer snaps
 * @param {Object} how - appendPart's options
 * @returns {{sketch: Object, piece: Object} | null}
 */
export function rubberPart(tool, hit, how) {
	const sketch = tool.sketch;
	let to = hit.join && sketch.points[hit.join] ? hit.join : null;
	let working = sketch;
	if (!to) {
		to = '~pointer';
		working = {
			...sketch,
			points: { ...sketch.points, [to]: { x: hit.x, y: hit.y, kind: how.kind || 'corner' } },
		};
	}
	try {
		const out = appendPart(working, tool.piece, { ...how, to });
		return out.added ? { sketch: out.sketch, piece: out.piece } : null;
	} catch {
		return null;
	}
}

/**
 * @param {Object} [ctx] - see the header
 * @returns {LineTool}
 */
export function makeLineTool(ctx) {
	return new LineTool(ctx);
}
