// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S2 (docs/SKETCH.md section 6, D-047, D-048): where a click of a sketch tool lands.
	Pure: no DOM, no editor. Font units, y up. The tools call snapPoint on every move and click,
	store pinFields / relationsFor with the point, and give the hints to the draw layer.

	What a pointer snaps to, first that applies (within the snap radius, the same number of screen
	pixels at every zoom: metrics/hit_test.js hitZoneEm(view, HIT_ZONE_PX)):
	  1. a point of the sketch: the click joins it (shared id), "joins"; the open piece's first
	     point closes the loop (closes)
	  2. the middle of a Line piece: stored as onPiece t = 0.5, "middle"
	  3. a piece: onPiece with its share t of the piece's length, "on the stem" / "on the bar"
	     (a straight piece steeper or flatter than 30 degrees) / "on the curve"; when another
	     point is also level / plumb within the radius, the point goes where that level / plumb
	     line crosses the piece (within 2 radii of the pointer) and stores both (A's bar end:
	     on the leg and level with the bar's start)
	  4. otherwise each axis on its own:
	     y: the five writing lines (top, capitals, small-letter, writing, tail); the half-way lines
	        (writing to small-letter, writing to capitals) only for a center (halfway: true)
	     x: the letter's left and right edges and its middle only while spacing is set by him
	        (manual: true); while it is automatic the ink's own middle (inkMiddle) pulls x but is
	        never pinned; the Mirror line
	     then, on an axis still free, level / plumb with another point of the sketch: a dotted
	     hint line from that point and a pair the tool stores as a level / plumb relation.
	  5. after 3 and 4 the place is checked against the sketch's points again: within the radius
	     of one it joins it (and closes on the open piece's first point), so a click on the line
	     where the loop started closes it instead of making a second point there.
	The edge rule (edge_rule.js): a Centerline point (use 'center' or 'helper') pinned to a
	writing line goes where the ink's EDGE touches the line, its center half the thickness
	inside (inkLines, edgeThickness keeps it in range); the pointer snaps only when near the real
	line: the faint ink line is where the dot lands, never a second target (two targets made the
	band around a line up to 17 px tall). It is stored on: <line>, inset: 'edge'; placeEdgePoints later moves a
	point the stroke crosses its line at onto the line itself, and adds the overshoot of round
	tops (D-048: the rule decides from the geometry, so the tool always stores 'edge'). An
	Outline point sits on the line itself.
	Shift (with from, the open end) puts the pointer on the nearest of level, plumb or 45 degrees
	from it first; a piece the ray crosses within the radius of that place catches it (onPiece,
	then checked against the points as in 5); else on a level or plumb ray only the free axis
	snaps (datums and hints), on a 45 degree ray nothing more. Ctrl turns snapping off for that click: the pointer, whole, Shift
	still applied.

	  SNAP_PX                         HIT_ZONE_PX, the snap radius in screen pixels
	  LINE_WORDS                      { top: 'line.ascent', ... } the words key of each line
	  snapRadius(view)                font units
	  snapPoint(pointer, context)     the result below
	    context: { sketch, font, view, thickness, use ('center' | 'outline' | 'helper'),
	               exclude: [point ids], first: the open piece's first point id,
	               excludePieces: [piece ids], halfway, manual, edges: { left, right },
	               inkMiddle, ctrl, shift, from: { x, y } }
	    result:  { x, y (whole), raw: pointer, snapped, on, inset, join, closes, onPiece:
	               { piece, t, middle? }, pair: { type: 'level' | 'plumb', with } (pairs: both,
	               when level and plumb were both used), tag: { key, vars? } | null, hints }
	    hints (data for the draw layer, all font units):
	               { type: 'line', on, y }            a writing line it sits on
	               { type: 'halfway', on, y }         a half-way line, shown dotted while used
	               { type: 'edge', on, x }            a letter edge, its middle or the Mirror line
	               { type: 'middle', x }              the ink's own middle (automatic spacing)
	               { type: 'level' | 'plumb', pointId, from, to }   the dotted inference line
	  pinFields(result)               { on, inset? } to store on the point ({} when not pinned)
	  relationsFor(result, pointId)   [{ type: 'onPiece', point, piece, t }] and / or
	                                  [{ type: 'level' | 'plumb', a, b }], or []
	  tagText(tag)                    the words at the cursor ('' for none)
	  forDrawLayer(result, { font, span, tangent })   the draw layer's drawState fields
	                                  (draw_layer.js): { snap: { x, y, text }, hints: [{ kind,
	                                  from, to }] }; a half-way line runs span.left to span.right
	                                  (default 600 units each side of the point), the ink's middle
	                                  and an edge from the tail line to the top line; tangent (a
	                                  chain.js hint) adds a line TANGENT_REACH units long
	  inkLineHints(font, thickness, use)   [{ type: 'inkLine', on, y }]: the faint lines a
	                                  Centerline point snaps its center to ([] for an Outline)
	  settleLocks(sketch, piece)      a new sketch whose points of the piece carry the level / plumb
	                                  lock extremes.js gives them; a lock the rule no longer gives
	                                  is cleared on a point no other piece uses
*/
import { HIT_ZONE_PX, hitZoneEm } from '../../metrics/hit_test.js';
import { guideLines } from '../../placement/classes.js';
import { word } from '../../words/words.js';
import { pieceSkeleton } from '../curves.js';
import { inkLines, LINE_NAMES } from '../edge_rule.js';
import { lockFor } from '../extremes.js';
import { piecesAt, piecePointIds } from '../model.js';

export const SNAP_PX = HIT_ZONE_PX;

export const LINE_WORDS = Object.freeze({
	top: 'line.ascent',
	capitals: 'line.capHeight',
	small: 'line.xHeight',
	writing: 'line.baseline',
	tail: 'line.descent',
});

const PLACE_WORDS = Object.freeze({
	halfSmall: 'sketch.tag.halfway',
	halfCapitals: 'sketch.tag.halfway',
	left: 'canvas.leftEdge',
	right: 'canvas.rightEdge',
	middle: 'sketch.tag.middle',
	mirror: 'sketch.tag.mirror',
});

/** A straight piece within this many degrees of level is a bar, else a stem */
const BAR_DEGREES = 30;
/** Samples per cubic when finding the nearest place on a piece */
const SAMPLES = 32;

/**
 * @param {Object} view - { dz }
 * @returns {Number} font units
 */
export function snapRadius(view) {
	return hitZoneEm(view, SNAP_PX);
}

/** @returns {Number} whole, never -0 */
function whole(value) {
	const rounded = Math.round(Number(value));
	return rounded === 0 ? 0 : rounded;
}

const isCenterUse = (use) => use !== 'outline';

/**
 * @param {{x: Number, y: Number}} pointer
 * @param {Object} context
 * @returns {Object}
 */
export function snapPoint(pointer, context = {}) {
	const raw = { x: Number(pointer?.x) || 0, y: Number(pointer?.y) || 0 };
	const result = {
		x: raw.x,
		y: raw.y,
		raw,
		snapped: false,
		on: null,
		inset: null,
		join: null,
		closes: false,
		onPiece: null,
		pair: null,
		tag: null,
		hints: [],
	};
	const radius = snapRadius(context.view);
	const ray = context.shift && context.from ? shiftRay(raw, context.from) : null;
	if (ray) {
		result.x = ray.x;
		result.y = ray.y;
	}
	if (context.ctrl) return finish(result);
	const sketch = context.sketch && typeof context.sketch === 'object' ? context.sketch : null;
	const points = sketch?.points && typeof sketch.points === 'object' ? sketch.points : {};
	const exclude = new Set(context.exclude || []);

	if (!ray) {
		const join = nearestPoint(raw, points, exclude, radius);
		if (join) return joinResult(result, join, points, context);
		const onPiece = nearestOnPiece(raw, sketch, context, radius);
		if (onPiece) {
			const crossed = onPiece.middle
				? null
				: inferOnPiece(raw, onPiece, sketch, points, exclude, radius);
			const place = crossed || onPiece;
			result.x = place.x;
			result.y = place.y;
			result.onPiece = onPiece.middle
				? { piece: onPiece.piece, t: 0.5, middle: true }
				: { piece: onPiece.piece, t: place.t };
			result.tag = onPieceTag(place.part, onPiece.middle);
			result.snapped = true;
			finish(result);
			if (!crossed) return result;
			const { type, with: id } = crossed.pair;
			result.pair = crossed.pair;
			result.hints.push({
				type,
				pointId: id,
				from: { x: Number(points[id].x), y: Number(points[id].y) },
				to: { x: result.x, y: result.y },
			});
			return rejoin(result, points, exclude, radius, context);
		}
	} else {
		const crossed = rayOnPiece(ray, context.from, sketch, context, radius);
		if (crossed) {
			result.x = crossed.x;
			result.y = crossed.y;
			result.onPiece = { piece: crossed.piece, t: crossed.t };
			result.tag = onPieceTag(crossed.part, false);
			result.snapped = true;
			return rejoin(finish(result), points, exclude, radius, context);
		}
	}

	const freeY = !ray || ray.axis === 'plumb';
	const freeX = !ray || ray.axis === 'level';
	let fixedY = !freeY;
	let fixedX = !freeX;
	const at = ray ? { x: ray.x, y: ray.y } : raw;

	if (freeY) {
		const line = nearestLevelDatum(at.y, context, radius);
		if (line) {
			result.y = line.at;
			result.on = line.on;
			result.inset = line.inset;
			result.hints.push(line.hint);
			result.tag = { key: line.wordKey };
			result.snapped = true;
			fixedY = true;
		}
	}
	if (freeX) {
		const edge = nearestPlumbDatum(at.x, sketch, context, radius);
		if (edge) {
			result.x = edge.at;
			if (edge.on) {
				// a point pinned to both a writing line and an edge keeps the writing line
				if (!result.on) result.on = edge.on;
				result.hints.push({ type: 'edge', on: edge.on, x: edge.at });
			} else {
				result.hints.push({ type: 'middle', x: edge.at });
			}
			if (!result.tag) result.tag = { key: edge.wordKey };
			result.snapped = true;
			fixedX = true;
		}
	}
	const pairs = [];
	if (!fixedY) {
		const level = nearestAlong('y', at, points, exclude, radius);
		if (level) {
			result.y = Number(points[level].y);
			pairs.push({ type: 'level', with: level });
			if (!result.tag) result.tag = { key: 'sketch.tag.level' };
			result.snapped = true;
		}
	}
	if (!fixedX) {
		const plumb = nearestAlong('x', at, points, exclude, radius);
		if (plumb) {
			result.x = Number(points[plumb].x);
			pairs.push({ type: 'plumb', with: plumb });
			if (!result.tag) result.tag = { key: 'sketch.tag.plumb' };
			result.snapped = true;
		}
	}
	finish(result);
	result.pair = pairs[0] || null;
	if (pairs.length > 1) result.pairs = pairs;
	// the dotted inference lines run from the other point to where the click lands
	for (const { type, with: id } of pairs) {
		const from = { x: Number(points[id].x), y: Number(points[id].y) };
		result.hints.push({ type, pointId: id, from, to: { x: result.x, y: result.y } });
	}
	return rejoin(result, points, exclude, radius, context);
}

/** The result as a join of point `id` (closing the loop on the open piece's first point) */
function joinResult(result, id, points, context) {
	result.x = Number(points[id].x);
	result.y = Number(points[id].y);
	result.join = id;
	result.closes = context.first !== undefined && context.first === id;
	result.on = null;
	result.inset = null;
	result.onPiece = null;
	result.pair = null;
	delete result.pairs;
	result.hints = [];
	result.tag = { key: 'sketch.tag.joins' };
	result.snapped = true;
	return finish(result);
}

/**
 * A snapped place checked against the sketch's points again: a line, an edge or an inference may
 * have put it on (or within the radius of) a point the pointer itself was not near.
 * @returns {Object} the result, or the join of that point
 */
function rejoin(result, points, exclude, radius, context) {
	if (!result.snapped) return result;
	const join = nearestPoint(result, points, exclude, radius);
	return join ? joinResult(result, join, points, context) : result;
}

/** @returns {{key: String, vars?: Object}} the words for a place on a piece */
function onPieceTag(part, middle) {
	if (middle) return { key: 'sketch.tag.middle' };
	return part
		? { key: 'sketch.tag.onPiece', vars: { part: { key: `sketch.part.${part}` } } }
		: { key: 'sketch.tag.onCurve' };
}

/** Whole numbers, and the result as given */
function finish(result) {
	result.x = whole(result.x);
	result.y = whole(result.y);
	return result;
}

/**
 * @returns {{x: Number, y: Number, axis: 'level'|'plumb'|'diagonal'}} the pointer put on the
 *   nearest of level, plumb or 45 degrees from `from`
 */
function shiftRay(raw, from) {
	const fx = Number(from.x);
	const fy = Number(from.y);
	const dx = raw.x - fx;
	const dy = raw.y - fy;
	const angle = Math.atan2(dy, dx);
	const step = Math.round(angle / (Math.PI / 4));
	const snapped = (step * Math.PI) / 4;
	const ux = Math.cos(snapped);
	const uy = Math.sin(snapped);
	const along = dx * ux + dy * uy;
	const turn = ((step % 4) + 4) % 4;
	const axis = turn === 0 ? 'level' : turn === 2 ? 'plumb' : 'diagonal';
	if (axis === 'level') return { x: raw.x, y: fy, axis };
	if (axis === 'plumb') return { x: fx, y: raw.y, axis };
	return { x: fx + along * ux, y: fy + along * uy, axis };
}

/** @returns {String|null} the nearest point within the radius */
function nearestPoint(raw, points, exclude, radius) {
	let best = null;
	let bestDistance = Infinity;
	for (const [id, point] of Object.entries(points)) {
		if (exclude.has(id) || !point) continue;
		const distance = Math.hypot(Number(point.x) - raw.x, Number(point.y) - raw.y);
		if (distance <= radius && distance < bestDistance) {
			best = id;
			bestDistance = distance;
		}
	}
	return best;
}

/**
 * The nearest point of the sketch on one axis (y: level, x: plumb), nearest by that axis, then by
 * the other one.
 * @returns {String|null}
 */
function nearestAlong(key, at, points, exclude, radius) {
	const other = key === 'x' ? 'y' : 'x';
	let best = null;
	let bestScore = [Infinity, Infinity];
	for (const [id, point] of Object.entries(points)) {
		if (exclude.has(id) || !point) continue;
		const off = Math.abs(Number(point[key]) - at[key]);
		if (!(off <= radius)) continue;
		const far = Math.abs(Number(point[other]) - at[other]);
		if (off < bestScore[0] || (off === bestScore[0] && far < bestScore[1])) {
			best = id;
			bestScore = [off, far];
		}
	}
	return best;
}

/**
 * @returns {{on: String, at: Number, inset: String|null, wordKey: String, hint: Object}|null}
 */
function nearestLevelDatum(y, context, radius) {
	const font = context.font || {};
	const lines = guideLines(font);
	const center = isCenterUse(context.use);
	const ink = center ? inkLines(font, context.thickness) : null;
	const choices = [];
	for (const name of LINE_NAMES) {
		const at = center ? ink[name] : lines[name];
		// only the real line pulls; the ink line is where the dot lands
		const distance = Math.abs(y - lines[name]);
		choices.push({
			on: name,
			distance,
			at: whole(at),
			inset: center ? 'edge' : null,
			wordKey: LINE_WORDS[name],
			hint: { type: 'line', on: name, y: lines[name] },
		});
	}
	if (context.halfway) {
		for (const [name, top] of [
			['halfSmall', lines.small],
			['halfCapitals', lines.capitals],
		]) {
			const at = (lines.writing + top) / 2;
			choices.push({
				on: name,
				distance: Math.abs(y - at),
				at: whole(at),
				inset: null,
				wordKey: PLACE_WORDS[name],
				hint: { type: 'halfway', on: name, y: at },
			});
		}
	}
	return pickNearest(choices, radius);
}

/**
 * @returns {{on: String|null, at: Number, wordKey: String}|null}
 */
function nearestPlumbDatum(x, sketch, context, radius) {
	const choices = [];
	const add = (on, at) => {
		if (!Number.isFinite(at)) return;
		choices.push({ on, at, distance: Math.abs(x - at), wordKey: PLACE_WORDS[on || 'middle'] });
	};
	const left = Number(context.edges?.left ?? 0);
	const right = Number(context.edges?.right);
	if (context.manual && Number.isFinite(right)) {
		add('left', left);
		add('right', right);
		add('middle', whole((left + right) / 2));
	} else if (Number.isFinite(Number(context.inkMiddle)) && context.inkMiddle !== null) {
		add(null, whole(Number(context.inkMiddle)));
	}
	if (sketch?.mirror && Number.isFinite(Number(sketch.mirror.x)))
		add('mirror', Number(sketch.mirror.x));
	return pickNearest(choices, radius);
}

/** @returns {Object|null} the nearest choice within the radius */
function pickNearest(choices, radius) {
	let best = null;
	for (const choice of choices) {
		if (choice.distance > radius) continue;
		if (!best || choice.distance < best.distance) best = choice;
	}
	return best;
}

/** @returns {Array|null} the piece's built centerline cubics, or null when it can't be built */
function cubicsOf(piece, sketch) {
	try {
		return pieceSkeleton(piece, sketch);
	} catch {
		return null;
	}
}

/**
 * The places a straight line (through origin, along dir) crosses a run of cubics.
 * @returns {Array<{x: Number, y: Number}>}
 */
function crossings(cubics, origin, dir) {
	const out = [];
	const side = (p) => dir.x * (p[1] - origin.y) - dir.y * (p[0] - origin.x);
	const samples = sampleCubics(cubics);
	for (let i = 0; i + 1 < samples.length; i++) {
		const a = samples[i].p;
		const b = samples[i + 1].p;
		const sa = side(a);
		const sb = side(b);
		if ((sa > 0 && sb > 0) || (sa < 0 && sb < 0)) continue;
		if (sa === sb) {
			// along the line: both ends are on it
			out.push({ x: a[0], y: a[1] }, { x: b[0], y: b[1] });
			continue;
		}
		const share = sa / (sa - sb);
		out.push({ x: a[0] + share * (b[0] - a[0]), y: a[1] + share * (b[1] - a[1]) });
	}
	return out;
}

/**
 * The pointer is on a piece and another point is level or plumb with it: where that level /
 * plumb line crosses the piece, nearest the pointer and within 2 radii of it.
 * @returns {{x, y, t, part, pair: {type, with}}|null}
 */
function inferOnPiece(raw, onPiece, sketch, points, exclude, radius) {
	const piece = (sketch?.pieces || []).find((other) => other?.id === onPiece.piece);
	const cubics = piece ? cubicsOf(piece, sketch) : null;
	if (!cubics?.length) return null;
	let best = null;
	for (const [key, type, dir] of [
		['y', 'level', { x: 1, y: 0 }],
		['x', 'plumb', { x: 0, y: 1 }],
	]) {
		const id = nearestAlong(key, raw, points, exclude, radius);
		if (!id) continue;
		const origin = { x: Number(points[id].x), y: Number(points[id].y) };
		for (const place of crossings(cubics, origin, dir)) {
			// the piece passing through the other point itself is that point, not an inference
			if (Math.hypot(place.x - origin.x, place.y - origin.y) <= 1) continue;
			const distance = Math.hypot(place.x - raw.x, place.y - raw.y);
			if (distance > 2 * radius || (best && distance >= best.distance)) continue;
			best = { ...place, distance, pair: { type, with: id } };
		}
	}
	if (!best) return null;
	const near = nearestOnCubics(best, cubics);
	return {
		x: best.x,
		y: best.y,
		t: near ? near.t : onPiece.t,
		part: partName(piece, sketch) ?? straightName(near?.cubic ?? null),
		pair: best.pair,
	};
}

/**
 * Shift's ray from the open end: where the ray crosses a piece, nearest the ray's place and
 * within the radius of it.
 * @returns {{piece, x, y, t, part}|null}
 */
function rayOnPiece(ray, from, sketch, context, radius) {
	if (!sketch || !Array.isArray(sketch.pieces)) return null;
	const origin = { x: Number(from.x), y: Number(from.y) };
	const length = Math.hypot(ray.x - origin.x, ray.y - origin.y);
	if (!(length > 0)) return null;
	const dir = { x: (ray.x - origin.x) / length, y: (ray.y - origin.y) / length };
	const skip = new Set(context.excludePieces || []);
	let best = null;
	for (const piece of sketch.pieces) {
		if (!piece || skip.has(piece.id)) continue;
		const cubics = cubicsOf(piece, sketch);
		if (!cubics?.length) continue;
		for (const place of crossings(cubics, origin, dir)) {
			const distance = Math.hypot(place.x - ray.x, place.y - ray.y);
			if (distance > radius || (best && distance >= best.distance)) continue;
			best = { ...place, distance, piece, cubics };
		}
	}
	if (!best) return null;
	const near = nearestOnCubics(best, best.cubics);
	return {
		piece: best.piece.id,
		x: best.x,
		y: best.y,
		t: near ? near.t : 0,
		part: partName(best.piece, sketch) ?? straightName(near?.cubic ?? null),
	};
}

/**
 * The nearest place on a piece of the sketch, or the middle of a Line piece.
 * @returns {{piece: Number, x: Number, y: Number, t: Number, middle: Boolean, part: String|null}|null}
 */
function nearestOnPiece(raw, sketch, context, radius) {
	if (!sketch || !Array.isArray(sketch.pieces)) return null;
	const skip = new Set(context.excludePieces || []);
	let middle = null;
	let best = null;
	for (const piece of sketch.pieces) {
		if (!piece || skip.has(piece.id)) continue;
		const straight = lonePart(piece);
		if (straight) {
			const a = sketch.points?.[straight.from];
			const b = sketch.points?.[straight.to];
			if (a && b) {
				const mx = (Number(a.x) + Number(b.x)) / 2;
				const my = (Number(a.y) + Number(b.y)) / 2;
				const distance = Math.hypot(mx - raw.x, my - raw.y);
				if (distance <= radius && (!middle || distance < middle.distance)) {
					middle = { piece: piece.id, x: mx, y: my, t: 0.5, middle: true, part: null, distance };
				}
			}
		}
		const cubics = cubicsOf(piece, sketch);
		if (!cubics) continue;
		const near = nearestOnCubics(raw, cubics);
		if (near && near.distance <= radius && (!best || near.distance < best.distance)) {
			const { cubic, ...at } = near;
			best = {
				piece: piece.id,
				...at,
				middle: false,
				part: partName(piece, sketch) ?? straightName(cubic),
			};
		}
	}
	return middle || best;
}

/** @returns {Object|null} the piece's only part when it is a Line */
function lonePart(piece) {
	const parts = Array.isArray(piece.parts) ? piece.parts : [];
	return parts.length === 1 && parts[0]?.type === 'line' ? parts[0] : null;
}

/** @returns {'stem'|'bar'|null} what to call a straight piece; null for a curve */
function partName(piece, sketch) {
	const line = lonePart(piece);
	if (!line) return null;
	const a = sketch.points?.[line.from];
	const b = sketch.points?.[line.to];
	if (!a || !b) return null;
	const deg = Math.abs(
		(Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180) / Math.PI
	);
	const offLevel = Math.min(deg, 180 - deg);
	return offLevel <= BAR_DEGREES ? 'bar' : 'stem';
}

/**
 * S2 integration: a piece of several parts (A's two legs, n's stem and arch) is named by the
 * part under the pointer: a straight one is a stem or a bar, as a lone Line is.
 * @param {Array<[Number, Number]> | null} cubic
 * @returns {'stem'|'bar'|null}
 */
function straightName(cubic) {
	if (!cubic) return null;
	const [p0, p1, p2, p3] = cubic;
	const dx = p3[0] - p0[0];
	const dy = p3[1] - p0[1];
	const length = Math.hypot(dx, dy);
	if (!(length > 0)) return null;
	const off = (p) => Math.abs((p[0] - p0[0]) * dy - (p[1] - p0[1]) * dx) / length;
	if (off(p1) > 0.5 || off(p2) > 0.5) return null;
	const deg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
	const offLevel = Math.min(deg, 180 - deg);
	return offLevel <= BAR_DEGREES ? 'bar' : 'stem';
}

/** @returns {[Number, Number]} */
function cubicAt([p0, p1, p2, p3], t) {
	const u = 1 - t;
	const a = u * u * u;
	const b = 3 * u * u * t;
	const c = 3 * u * t * t;
	const d = t * t * t;
	return [
		a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
		a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
	];
}

/** @returns {Array<{p, run, cubic, t}>} a polyline of samples with the length run so far */
function sampleCubics(cubics) {
	const samples = [];
	let run = 0;
	cubics.forEach((cubic, c) => {
		for (let i = c === 0 ? 0 : 1; i <= SAMPLES; i++) {
			const p = cubicAt(cubic, i / SAMPLES);
			const last = samples.at(-1);
			if (last) run += Math.hypot(p[0] - last.p[0], p[1] - last.p[1]);
			samples.push({ p, run, cubic: c, t: i / SAMPLES });
		}
	});
	return samples;
}

/**
 * The nearest place on a run of cubics, and its share of their whole length.
 * @returns {{x: Number, y: Number, t: Number, distance: Number}|null}
 */
function nearestOnCubics(raw, cubics) {
	if (!cubics.length) return null;
	const samples = sampleCubics(cubics);
	const total = samples.at(-1)?.run ?? 0;
	let best = null;
	for (let i = 0; i + 1 < samples.length; i++) {
		const a = samples[i];
		const b = samples[i + 1];
		const dx = b.p[0] - a.p[0];
		const dy = b.p[1] - a.p[1];
		const length2 = dx * dx + dy * dy;
		const share =
			length2 > 0
				? Math.max(0, Math.min(1, ((raw.x - a.p[0]) * dx + (raw.y - a.p[1]) * dy) / length2))
				: 0;
		const x = a.p[0] + share * dx;
		const y = a.p[1] + share * dy;
		const distance = Math.hypot(x - raw.x, y - raw.y);
		if (!best || distance < best.distance) {
			best = {
				x,
				y,
				distance,
				t: total > 0 ? (a.run + share * (b.run - a.run)) / total : 0,
				cubic: cubics[b.cubic] || null,
			};
		}
	}
	return best;
}

/**
 * @param {Object} result - from snapPoint
 * @returns {{on?: String, inset?: String}}
 */
export function pinFields(result) {
	if (!result?.on) return {};
	return result.inset ? { on: result.on, inset: result.inset } : { on: result.on };
}

/**
 * @param {Object} result - from snapPoint
 * @param {String} pointId - the id the tool stored the point under
 * @returns {Array<Object>}
 */
export function relationsFor(result, pointId) {
	const out = result?.onPiece
		? [{ type: 'onPiece', point: pointId, piece: result.onPiece.piece, t: result.onPiece.t }]
		: [];
	const pairs = result?.pairs || (result?.pair ? [result.pair] : []);
	for (const pair of pairs) {
		if (pair.with !== pointId) out.push({ type: pair.type, a: pair.with, b: pointId });
	}
	return out;
}

/** How far a half-way line reaches each side of the point, font units, when no span is given */
const HALF_REACH = 600;
/** The tangent hint's length, font units */
export const TANGENT_REACH = 400;

/**
 * @param {Object} result - from snapPoint (null for none)
 * @param {{font?: Object, span?: {left: Number, right: Number}, tangent?: Object}} [options]
 * @returns {{snap: {x: Number, y: Number, text: String}|null, hints: Array<Object>}}
 */
export function forDrawLayer(result, { font, span, tangent } = {}) {
	const hints = [];
	const lines = guideLines(font || {});
	for (const hint of result?.hints || []) {
		if (hint.type === 'level' || hint.type === 'plumb') {
			hints.push({ kind: hint.type, from: { ...hint.from }, to: { ...hint.to } });
		} else if (hint.type === 'halfway') {
			const left = Number.isFinite(span?.left) ? span.left : result.x - HALF_REACH;
			const right = Number.isFinite(span?.right) ? span.right : result.x + HALF_REACH;
			hints.push({ kind: 'halfway', from: { x: left, y: hint.y }, to: { x: right, y: hint.y } });
		} else if (hint.type === 'middle' || hint.type === 'edge') {
			hints.push({
				kind: 'middle',
				from: { x: hint.x, y: lines.tail },
				to: { x: hint.x, y: lines.top },
			});
		}
	}
	if (tangent?.from && Number.isFinite(Number(tangent.dir))) {
		const a = (Number(tangent.dir) * Math.PI) / 180;
		const from = { x: Number(tangent.from.x), y: Number(tangent.from.y) };
		hints.push({
			kind: 'tangent',
			from,
			to: { x: from.x + TANGENT_REACH * Math.cos(a), y: from.y + TANGENT_REACH * Math.sin(a) },
		});
	}
	const snap = result ? { x: result.x, y: result.y, text: tagText(result.tag) } : null;
	return { snap, hints };
}

/**
 * @param {Object} font - project.settings.font
 * @param {Number} thickness - font units
 * @param {String} [use] - the piece's use
 * @returns {Array<{type: 'inkLine', on: String, y: Number}>}
 */
export function inkLineHints(font, thickness, use = 'center') {
	if (!isCenterUse(use) || !(Number(thickness) > 0)) return [];
	const ink = inkLines(font || {}, thickness);
	return LINE_NAMES.map((on) => ({ type: 'inkLine', on, y: whole(ink[on]) }));
}

/**
 * @param {{key: String, vars?: Object}|null} tag
 * @returns {String}
 */
export function tagText(tag) {
	if (!tag?.key) return '';
	const vars = {};
	for (const [name, value] of Object.entries(tag.vars || {})) {
		vars[name] = value && typeof value === 'object' && value.key ? word(value.key) : value;
	}
	return word(tag.key, vars);
}

/**
 * @param {Object} sketch - containing the piece's points (the piece need not be stored yet)
 * @param {Object} piece
 * @returns {Object} a new sketch; the input is never changed
 */
export function settleLocks(sketch, piece) {
	if (!sketch?.points || !piece) return sketch;
	const others = (Array.isArray(sketch.pieces) ? sketch.pieces : []).filter(
		(other) => other !== piece && !(piece.id !== undefined && other?.id === piece.id)
	);
	const points = { ...sketch.points };
	let changed = false;
	for (const id of piecePointIds(piece)) {
		const point = points[id];
		if (!point) continue;
		const lock = lockFor(id, piece, sketch);
		const shared = piecesAt({ pieces: others }, id).length > 0;
		if (lock) {
			if (point.lock !== lock) {
				points[id] = { ...point, lock };
				changed = true;
			}
		} else if (!shared && point.lock) {
			points[id] = { ...point, lock: null };
			changed = true;
		}
	}
	return changed ? { ...sketch, points } : { ...sketch };
}
