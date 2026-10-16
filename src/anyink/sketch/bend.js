// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5, "Drag an unpicked curve"): Bend. The curve bows toward the
	pointer and the app sets the directions (Figma's Bend). Pure: the sketch passed in is never
	changed. Font units, y up.

	  Arc     stays an arc, as in SolidWorks: its ends stay put and its bulge changes. An arc whose
	          top was snapped to a writing line (part.top) keeps that line while its new top is
	          within LET_GO snap radii of where the line puts it (the build puts it back on), and
	          lets go of it past that. A tangent Arc after another part has no bulge of its own (it
	          leaves along the part before it): it becomes a curve tangent at both ends and bends
	          like one, so the join never kinks.
	  Curve   (tangent at both ends: n's arch between its stems) and Spline stretches: the
	          stretch's two points are aimed along the circle through them and the place the
	          pointer pulls, and the pull (tension, 0.75 to 4, hobby.js) is the one that brings the
	          curve nearest that place. A direction a Line beside the point gives never turns (a
	          Line never moves, nor turns), so the arch keeps both joins smooth whatever the stems
	          do; only how full it is changes.
	  Line    moves whole; joined ends follow (rules.js applyDrag: pinned ends slide along their
	          lines, onPiece points keep their share).

	The pointer pulls the place that was pressed: the stretch's middle moves by the drag times
	1 / (4 t (1 - t)) (t the pressed share, held to 3x), so a press at the middle follows the
	pointer and a press near an end bends no harder than one at the middle.

	  bendPart(sketch, hit, pointer, { radius, font, thickness, grab })
	      hit: pick.js hitTest's piece hit ({ id, part, a, b, t, x, y }); pointer and grab
	      (where the press was, default hit's x / y): { x, y }
	      returns { sketch, kind: 'bent' | 'lineMoved', letGo, conflicts } or null when the
	      part can't be bent (a dot, a circle: Select resizes or moves those)
	  TENSIONS      the pulls tried, 0.75 to 4
*/
import { arcDirs, arcPoint, bulgeFromMiddle } from './arc.js';
import { piecePartCubics } from './curves.js';
import { MAX_TENSION, MIN_TENSION } from './hobby.js';
import { getPiece } from './model.js';
import { nearestOnCubics, pointOnCubics } from './pick.js';
import { LET_GO, applyDrag } from './rules.js';
import { arcExtreme, extremeTargets } from './tools/arc_snap.js';

/** The pulls tried for a curve (geometric steps from MIN_TENSION to MAX_TENSION) */
export const TENSIONS = Object.freeze(
	Array.from({ length: 17 }, (_, i) => MIN_TENSION * (MAX_TENSION / MIN_TENSION) ** (i / 16))
);

/** The most the middle moves for a press near an end, as a share of the drag */
const MOST_PULL = 3;
/** A bulge this far is 300 degrees of turn: no further */
const MOST_BULGE = Math.tan((300 * Math.PI) / 180 / 4);

const clone = (value) => JSON.parse(JSON.stringify(value));
const xy = (p) => [Number(p.x), Number(p.y)];

/**
 * @param {Object} sketch
 * @param {Object} hit
 * @param {{x: Number, y: Number}} pointer
 * @param {Object} [options]
 * @returns {Object | null}
 */
export function bendPart(sketch, hit, pointer, options = {}) {
	const piece = getPiece(sketch, hit?.id);
	if (!piece || piece.circle) return null;
	const part = piece.parts?.[hit.part];
	if (!part || !hit.a || !hit.b) return null;
	const grab = options.grab || { x: hit.x, y: hit.y };
	const delta = { x: pointer.x - grab.x, y: pointer.y - grab.y };
	const radius = Number(options.radius) > 0 ? Number(options.radius) : 10;

	if (part.type === 'line') {
		const targets = {};
		[part.from, part.to].forEach((id) => {
			const p = sketch.points[id];
			const at = { x: Number(p.x) + delta.x, y: Number(p.y) + delta.y };
			targets[id] = { ...at, raw: at };
		});
		const moved = applyDrag(sketch, targets, { radius });
		return { ...moved, kind: 'lineMoved' };
	}

	const share = Math.min(Math.max(Number(hit.t) || 0.5, 0.02), 0.98);
	const pull = Math.min(MOST_PULL, 1 / (4 * share * (1 - share)));
	const p0 = sketch.points[hit.a];
	const p1 = sketch.points[hit.b];
	if (!p0 || !p1) return null;

	const before = beforePart(piece, hit.part);
	if (part.type === 'arc' && !(part.tangent && before)) {
		const middle = arcPoint(xy(p0), xy(p1), Number(part.bulge) || 0, 0.5);
		const want = [middle[0] + delta.x * pull, middle[1] + delta.y * pull];
		let bulge = bulgeFromMiddle(xy(p0), xy(p1), want);
		bulge = Math.max(-MOST_BULGE, Math.min(MOST_BULGE, bulge));
		const next = clone(sketch);
		const stored = getPiece(next, piece.id).parts[hit.part];
		stored.bulge = Math.round(bulge * 1e6) / 1e6;
		const letGo = [];
		if (stored.top?.on && !keepsTop(stored, xy(p0), xy(p1), options, piece.use, radius)) {
			letGo.push({ point: null, on: stored.top.on });
			delete stored.top;
		}
		return { sketch: next, kind: 'bent', letGo, conflicts: [] };
	}

	// a Spline stretch, a curve, or a tangent Arc that bends as a curve
	const next = clone(sketch);
	const stored = getPiece(next, piece.id);
	if (part.type === 'arc') {
		stored.parts[hit.part] = { type: 'curve', from: part.from, to: part.to };
	}
	const stretch = stretchOf(stored, next, hit);
	if (!stretch) return null;
	const middle = pointOnCubics(stretch, 0.5);
	const want = { x: middle.x + delta.x * pull, y: middle.y + delta.y * pull };
	const { start, end } = arcDirs(xy(p0), xy(p1), bulgeFromMiddle(xy(p0), xy(p1), [want.x, want.y]));
	const a = next.points[hit.a];
	const b = next.points[hit.b];
	const aimA = { dir: round(start), tin: a.aim?.tin ?? 1, tout: 1 };
	const aimB = { dir: round(end), tin: 1, tout: b.aim?.tout ?? 1 };
	let best = null;
	for (const t of TENSIONS) {
		a.aim = { ...aimA, tout: round(t) };
		b.aim = { ...aimB, tin: round(t) };
		const cubics = stretchOf(stored, next, hit);
		const near = cubics ? nearestOnCubics(want, cubics) : null;
		if (near && (!best || near.distance < best.distance - 1e-9))
			best = { t, distance: near.distance };
	}
	if (!best) return null;
	a.aim = { ...aimA, tout: round(best.t) };
	b.aim = { ...aimB, tin: round(best.t) };
	return { sketch: next, kind: 'bent', letGo: [], conflicts: [] };
}

/** @returns {Boolean} a part comes before this one in the piece (or the loop closes into it) */
function beforePart(piece, index) {
	if (index > 0) return true;
	return !!piece.closed && (piece.parts?.length || 0) > 1;
}

/** The cubics of the stretch a to b of the piece, as it builds now */
function stretchOf(piece, sketch, hit) {
	let entries = [];
	try {
		entries = piecePartCubics(piece, sketch);
	} catch {
		return null;
	}
	const entry = entries.find((e) => e.a === hit.a && e.b === hit.b && e.part === hit.part);
	return entry?.cubics?.length ? entry.cubics : null;
}

/** Does an arc top tagged to a line stay within LET_GO radii of where the line puts it */
function keepsTop(part, p0, p1, options, use, radius) {
	const target = extremeTargets(options.font || {}, options.thickness || 0, use).find(
		(each) => each.on === part.top.on
	);
	if (!target) return false;
	const top = arcExtreme(p0, p1, Number(part.bulge) || 0, target.side);
	if (!top) return false;
	return Math.abs(top.y - target.y) <= LET_GO * radius;
}

const round = (value) => Math.round(Number(value) * 1e4) / 1e4;
