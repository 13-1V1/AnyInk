// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: a point's kind, smooth or corner (UX-BEGINNER.md 4.3 Fine-tune "This point", 2.1
	"smooth / corner", 2.4 C). The letter card shows [Smooth] [Corner] while Edit points has one
	point picked; these do the work.

	  smooth   the curve flows through the point: its two curve handles sit in one line through
	           it. Glyphr Studio's 'flat' ('symmetric', "smooth (even)", counts as smooth too, but
	           is a More tools word and never made here).
	  corner   the edge turns sharply: no curve handles (upstream's 'corner' with both handles
	           off). Pressing Corner always shows a change, so it is never a silent button
	           (principle 6); Undo brings the curve back.

	Making a point smooth keeps any curve handle it already has (its length; the two are lined
	up along the middle of their directions); a missing handle gets a third of the way to that
	side's neighbor, along the line from the point before to the point after. Every number it
	writes is whole (principle 5).

	  POINT_KINDS                    ['smooth', 'corner']
	  pointKind(point)               'smooth' | 'corner'
	  makePointSmooth(point)         true on a change
	  makePointCorner(point)         true on a change
	  setPointKind(point, kind)      either one by name; false for anything else
	  pointKindWords(kind)           { text, hint } for the card's button (words.js)
	  pickedPoint(editor)            the one picked point, or null (none, or more than one)
	  setPickedPointKind(editor, kind)   the card's button: one Undo step in plain words
	                                 ("made a point smooth", "made a point a corner"); false and
	                                 no step when nothing changed
*/
import { word, wordEntry } from '../words/words.js';

export const POINT_KINDS = Object.freeze(['smooth', 'corner']);

/** Below this a curve handle sits on its point and counts as none */
const NO_LENGTH = 0.5;

/**
 * @param {Object} point - PathPoint
 * @returns {'smooth' | 'corner'}
 */
export function pointKind(point) {
	return point?.type === 'symmetric' || point?.type === 'flat' ? 'smooth' : 'corner';
}

/**
 * @param {Object} point - PathPoint
 * @param {'h1' | 'h2'} name
 * @returns {Number} how far the handle reaches from its point (0 when it is off)
 */
function handleLength(point, name) {
	if (!point[name].use) return 0;
	return Math.hypot(point[name].x - point.p.x, point[name].y - point.p.y);
}

const unit = (x, y) => {
	const length = Math.hypot(x, y);
	return length > 0 ? { x: x / length, y: y / length } : null;
};

/**
 * @param {Object} point - PathPoint
 * @returns {{previous: Object | null, next: Object | null}} its neighbors on a closed shape
 */
function neighborsOf(point) {
	const points = point?.parent?.pathPoints;
	const index = Array.isArray(points) ? points.indexOf(point) : -1;
	if (index < 0 || points.length < 2) return { previous: null, next: null };
	const count = points.length;
	return { previous: points[(index - 1 + count) % count], next: points[(index + 1) % count] };
}

/**
 * The line a smooth point's handles lie along: out towards h2.
 * @returns {{x: Number, y: Number}}
 */
function smoothDirection(point, previous, next) {
	const p = point.p;
	const out = handleLength(point, 'h2') > NO_LENGTH ? unit(point.h2.x - p.x, point.h2.y - p.y) : null;
	const back = handleLength(point, 'h1') > NO_LENGTH ? unit(p.x - point.h1.x, p.y - point.h1.y) : null;
	if (out && back) return unit(out.x + back.x, out.y + back.y) || out;
	if (out || back) return out || back;
	if (previous && next) {
		const along = unit(next.p.x - previous.p.x, next.p.y - previous.p.y);
		if (along) return along;
	}
	return { x: 1, y: 0 };
}

/**
 * @param {Object} point - PathPoint
 * @param {Object | null} neighbor
 * @param {Number} fallback - length when there is no neighbor
 * @returns {Number} a third of the way to the neighbor
 */
function thirdOfTheWay(point, neighbor, fallback) {
	if (!neighbor) return fallback;
	const length = Math.hypot(neighbor.p.x - point.p.x, neighbor.p.y - point.p.y) / 3;
	return length > NO_LENGTH ? length : fallback;
}

/**
 * @param {Object} point - PathPoint
 * @returns {Boolean} true on a change
 */
export function makePointSmooth(point) {
	if (!point?.p || pointKind(point) === 'smooth') return false;
	const { previous, next } = neighborsOf(point);
	const direction = smoothDirection(point, previous, next);
	const fallback = Math.max(handleLength(point, 'h1'), handleLength(point, 'h2'), 100);
	const backLength =
		handleLength(point, 'h1') > NO_LENGTH
			? handleLength(point, 'h1')
			: thirdOfTheWay(point, previous, fallback);
	const outLength =
		handleLength(point, 'h2') > NO_LENGTH
			? handleLength(point, 'h2')
			: thirdOfTheWay(point, next, fallback);
	const { x, y } = point.p;
	point.h1.coord = {
		x: Math.round(x - direction.x * backLength),
		y: Math.round(y - direction.y * backLength),
	};
	point.h2.coord = {
		x: Math.round(x + direction.x * outLength),
		y: Math.round(y + direction.y * outLength),
	};
	point.h1.use = true;
	point.h2.use = true;
	// 'flat' keeps the two in line from now on; it moves h2 only if rounding left it off the line
	point.makeFlat('h1');
	point.h2.coord = { x: Math.round(point.h2.x), y: Math.round(point.h2.y) };
	point.h2.use = true;
	point.parent?.changed?.();
	return true;
}

/**
 * @param {Object} point - PathPoint
 * @returns {Boolean} true on a change
 */
export function makePointCorner(point) {
	if (!point?.p) return false;
	if (pointKind(point) === 'corner' && !point.h1.use && !point.h2.use) return false;
	point.type = 'corner';
	point.h1.use = false;
	point.h2.use = false;
	point.parent?.changed?.();
	return true;
}

/**
 * @param {Object} point - PathPoint
 * @param {String} kind - 'smooth' | 'corner'
 * @returns {Boolean} true on a change
 */
export function setPointKind(point, kind) {
	if (kind === 'smooth') return makePointSmooth(point);
	if (kind === 'corner') return makePointCorner(point);
	return false;
}

/**
 * @param {'smooth' | 'corner'} kind
 * @returns {{text: String, hint: String}}
 */
export function pointKindWords(kind) {
	const key = `letterTools.point.${kind}`;
	return { text: word(key), hint: wordEntry(key)?.hint || '' };
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Object | null} the picked point, when exactly one is picked
 */
export function pickedPoint(editor) {
	const picked = editor?.multiSelect?.points;
	if (!picked || picked.count !== 1) return null;
	const point = picked.singleton;
	return point?.objType === 'PathPoint' && point.parent ? point : null;
}

/** The Undo titles, in plain words (2.2: they pass through historyText as they are) */
const STEP_KEYS = Object.freeze({ smooth: 'history.pointSmooth', corner: 'history.pointCorner' });

/**
 * The card's [Smooth] / [Corner] button.
 * @param {Object} editor - ProjectEditor
 * @param {'smooth' | 'corner'} kind
 * @returns {Boolean} true when the point changed (one Undo step)
 */
export function setPickedPointKind(editor, kind) {
	const point = pickedPoint(editor);
	if (!point || !STEP_KEYS[kind]) return false;
	if (!setPointKind(point, kind)) return false;
	editor.history.addState(word(STEP_KEYS[kind]));
	editor.publish?.('currentPathPoint', point);
	editor.editCanvas?.redraw?.('anyink.pointKind');
	return true;
}
