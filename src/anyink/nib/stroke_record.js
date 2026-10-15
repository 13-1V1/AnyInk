// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: what a letter keeps about its brush strokes (UX-BEGINNER.md 10 B8, D-031). Each
	stroke is its own shape (two or more for a stroke with a hole: its ink and each hole), tagged
	with the stroke's id (shape.anyink.strokeId, which B7's auto-hole and the letter card read), and
	its skeleton is kept in glyph.anyink.nib.strokes, so M10 can ink it again with another nib
	without touching traced shapes. Strokes are never merged into other shapes.

	  glyph.anyink.nib = { strokes: [{ id, key, parts, nib, size, skeleton, at }] }
	    id        a whole number, one more than the highest the letter has used (in its records
	              or on any of its shapes)
	    key       the stroke's own name, never used by another stroke anywhere (B8 + B9 fix)
	    parts     how many shapes the stroke was drawn as (its ink and each hole)
	    nib       'round' (M10 adds 'flat' and 'pointed')
	    size      the nib's width, whole font units
	    skeleton  the center line: [[start, handle, handle, end], ...], whole font units
	    at        [x, y]: the lower left of the stroke's ink when it was drawn, whole units; the
	              ink may move later (automatic spacing slides the letter), and the skeleton
	              moves with it by however far the ink's lower left has moved
	  shape.anyink = { strokeId, strokeKey, strokePart }: the stroke's id and key, and which of
	    its shapes this is (0 first)
	The glyph keeps its anyink data in every Undo step and in the work file, and so does each
	shape (project_data/path.js, B8 + B9 integration). Every stroke shape is also named for its
	stroke ("Brush stroke 3", brush.shapeName), which puts the tags back on a letter from a work
	file written before shapes kept them.

	B8 + B9 fix (hostile finding "a pasted brush shape shares its id with another stroke"): since
	shapes keep their tags, a copy of a stroke's shapes (Copy and Paste, in this letter or into
	another; upstream's copy of another letter's shapes) arrives tagged as that stroke.
	reconcileStrokes sorts that out every time the letter changes, and before anything reads
	the strokes:
	  - in its own letter the shapes that were there first are the stroke; a later full copy of
	    it (every part once) becomes a stroke of its own: a new id and key, and a copy of the
	    record (its skeleton follows the copy's own ink, as `at` does for any stroke). "There
	    first" is known by the shape objects themselves: the ones the letter held when its
	    strokes were last sorted out are the stroke, whatever it has lost since, and only shapes
	    that came in after are copies (finalize, second hostile pass: with the o's hole deleted,
	    a pasted o's hole went to the original stroke and the copy's ink was left ordinary).
	    With no such memory (a letter just loaded, or brought back by Undo), the first shape of
	    each part in the letter's order is the stroke, as before
	  - History sorts the open letter out at the top of every item step (nib/history_hook.js),
	    so the step holds the sorted-out ids and keys, and Undo and Redo bring the same ones back
	    (finalize: the paste's step held them from before, and every Undo or Redo across it gave
	    the pasted stroke a new key)
	  - a copy from another letter does the same with that letter's record, found by its key
	  - a copy of only some of a stroke's shapes, or of a stroke whose record is gone, is no
	    stroke: its tags go and it is an ordinary shape (auto-hole and Merge treat it as one)
	  - a shape gets a stroke's tag by its name only when that stroke has no tagged shape at all
	    (a shape renamed "Brush stroke 1" in All tools stays ordinary while stroke 1 has shapes)

	  strokeName(id)                  "Brush stroke 3"
	  strokeRecords(item)             the letter's records ([] when none)
	  nextStrokeId(item)              one more than any id in the records or on the shapes
	  newStrokeKey()                  a key no other stroke has
	  addStrokeRecord(item, { id, key, size, skeleton, shapes })   stores one; parts and at from
	                                  the shapes
	  tagStroke(shape, id, { key, part })   tags one shape
	  strokeIdOf(shape)               its stroke's id, or null for a shape that isn't a stroke
	  strokeKeyOf(shape), strokePartOf(shape)
	  strokeRecordFinder(project)     key => the record with that key in any letter, or null
	  reconcileStrokes(item, { findRecord })   the rules above; findRecord (strokeRecordFinder)
	                                  lets copies from other letters be sorted out (without it
	                                  they are left as they are, and belong to no stroke here);
	                                  returns how many shapes it changed
	  retagStrokes(item)              the name rule alone; returns how many shapes it tagged
	  strokeShapes(item, id)          the shapes of one stroke
	  strokeSkeleton(item, id)        the stroke's skeleton where its ink is now (null when the
	                                  stroke has no shapes left)
*/
import { word } from '../words/words.js';

export const NIB_KIND = 'round';

let keyCount = 0;

/** @returns {String} */
export function strokeName(id) {
	return word('brush.shapeName', { number: id });
}

/**
 * @param {Object} item - Glyph
 * @returns {Array<Object>}
 */
export function strokeRecords(item) {
	const strokes = item?.anyink?.nib?.strokes;
	return Array.isArray(strokes) ? strokes : [];
}

/** @returns {Number} */
export function nextStrokeId(item) {
	const top = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
	let highest = 0;
	strokeRecords(item).forEach((record) => (highest = Math.max(highest, top(record.id))));
	(item?.shapes || []).forEach((shape) => {
		const id = strokeIdOf(shape);
		if (id !== null) highest = Math.max(highest, top(id));
	});
	return highest + 1;
}

/** @returns {String} */
export function newStrokeKey() {
	keyCount += 1;
	const random =
		globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12) ||
		Math.random().toString(36).slice(2, 14);
	return `${Date.now().toString(36)}-${keyCount.toString(36)}-${random}`;
}

/**
 * @param {Object} item - Glyph (its anyink object is written)
 * @param {{id: Number, key?: String, size: Number, skeleton: Array, shapes: Array<Object>}} stroke
 * @returns {Object} the record
 */
export function addStrokeRecord(item, { id, key, size, skeleton, shapes }) {
	return addRecord(item, {
		id,
		...(key ? { key } : {}),
		parts: shapes.length,
		nib: NIB_KIND,
		size,
		skeleton: skeleton.map((curve) => curve.map(([x, y]) => [x, y])),
		at: lowerLeft(shapes),
	});
}

/**
 * @param {Object} shape - Path
 * @param {Number} id
 * @param {{key?: String, part?: Number}} [options]
 */
export function tagStroke(shape, id, { key, part } = {}) {
	if (!shape) return;
	shape.anyink = {
		...(shape.anyink && typeof shape.anyink === 'object' ? shape.anyink : {}),
		strokeId: id,
		...(key ? { strokeKey: key } : {}),
		...(Number.isInteger(part) ? { strokePart: part } : {}),
	};
}

/**
 * @param {Object} shape
 * @returns {Number | null}
 */
export function strokeIdOf(shape) {
	const id = shape?.anyink?.strokeId;
	return id === undefined || id === null || id === '' || id === false ? null : id;
}

/** @returns {String | null} */
export const strokeKeyOf = (shape) => shape?.anyink?.strokeKey || null;

/** @returns {Number | null} */
export function strokePartOf(shape) {
	const part = shape?.anyink?.strokePart;
	return Number.isInteger(part) ? part : null;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {(key: String) => Object | null}
 */
export function strokeRecordFinder(project) {
	return (key) => {
		if (!key) return null;
		for (const group of [project?.glyphs, project?.ligatures, project?.components]) {
			for (const item of Object.values(group || {})) {
				const record = strokeRecords(item).find((entry) => entry.key === key);
				if (record) return record;
			}
		}
		return null;
	};
}

/**
 * @param {Object} item - Glyph
 * @param {{findRecord?: Function}} [options]
 * @returns {Number} shapes changed
 */
export function reconcileStrokes(item, { findRecord = null } = {}) {
	if (!Array.isArray(item?.shapes)) return 0;
	let changed = retagStrokes(item);
	const owners = recordIndex(strokeRecords(item));
	const known = knownShapes.get(item);
	// each stroke with a shape held when the letter was last sorted out: those are the stroke
	const held = new Set();
	if (known) {
		item.shapes.forEach((shape) => {
			if (known.has(shape) && strokeIdOf(shape) !== null) held.add(signature(shape));
		});
	}
	/** copy sets: key `${source}#${k}` => { source, shapes } */
	const sets = new Map();
	const seen = new Map();
	item.shapes.forEach((shape) => {
		if (shape?.objType !== 'Path' || strokeIdOf(shape) === null) return;
		const own = owners.get(signature(shape));
		const part = strokePartOf(shape);
		if (own) {
			// a stroke kept before parts were counted: every shape of it is the stroke
			if (!Number.isInteger(own.parts) || part === null) return;
			if (held.has(signature(shape))) {
				// the stroke is the shapes it held; a shape that came in since is a copy
				if (known.has(shape)) return;
				const k = countSeen(seen, `new ${signature(shape)} ${part}`);
				addToSet(sets, `own ${signature(shape)}#new${k}`, own, shape);
				return;
			}
			const k = countSeen(seen, `own ${signature(shape)} ${part}`);
			if (k > 0) addToSet(sets, `own ${signature(shape)}#${k}`, own, shape);
			return;
		}
		// no record here: a copy from another letter, sorted out by its key; one with no key
		// (or with no way to look) is left as it is
		const key = strokeKeyOf(shape);
		if (!key || !findRecord) return;
		const k = countSeen(seen, `from ${key} ${part}`);
		addToSet(sets, `from ${key}#${k}`, findRecord(key), shape);
	});
	sets.forEach(({ source, shapes }) => {
		if (isWhole(source, shapes)) {
			const id = nextStrokeId(item);
			const key = newStrokeKey();
			shapes.forEach((shape) => tagStroke(shape, id, { key, part: strokePartOf(shape) }));
			addRecord(item, { ...cloneRecord(source), id, key });
		} else {
			shapes.forEach(untag);
		}
		changed += shapes.length;
	});
	knownShapes.set(item, new WeakSet(item.shapes));
	return changed;
}

/** The shapes each letter held when its strokes were last sorted out (see the header). */
const knownShapes = new WeakMap();

/**
 * @param {Object} item - Glyph
 * @returns {Number}
 */
export function retagStrokes(item) {
	const records = strokeRecords(item);
	if (!records.length || !Array.isArray(item?.shapes)) return 0;
	const tagged = new Set();
	const untagged = new Map();
	item.shapes.forEach((shape) => {
		if (shape?.objType !== 'Path') return;
		if (strokeIdOf(shape) !== null) tagged.add(signature(shape));
		else if (!untagged.has(shape.name)) untagged.set(shape.name, [shape]);
		else untagged.get(shape.name).push(shape);
	});
	let count = 0;
	records.forEach((record) => {
		if (tagged.has(signatureOf(record.id, record.key))) return;
		const parts = Number.isInteger(record.parts) ? record.parts : Infinity;
		const named = untagged.get(strokeName(record.id)) || [];
		named.splice(0, parts).forEach((shape, part) => {
			tagStroke(shape, record.id, {
				key: record.key,
				part: Number.isFinite(parts) ? part : undefined,
			});
			count += 1;
		});
		tagged.add(signatureOf(record.id, record.key));
	});
	return count;
}

/**
 * @param {Object} item - Glyph
 * @param {Number} id
 * @returns {Array<Object>}
 */
export function strokeShapes(item, id) {
	reconcileStrokes(item);
	const record = strokeRecords(item).find((entry) => entry.id === id);
	if (!record) return [];
	return (item?.shapes || []).filter((shape) => belongsTo(shape, record));
}

/**
 * @param {Object} item - Glyph
 * @param {Number} id
 * @returns {Array<Array<[Number, Number]>> | null}
 */
export function strokeSkeleton(item, id) {
	const record = strokeRecords(item).find((entry) => entry.id === id);
	const shapes = strokeShapes(item, id);
	if (!record || !shapes.length) return null;
	const [x, y] = lowerLeft(shapes);
	const [ax, ay] = record.at || [x, y];
	const dx = x - ax;
	const dy = y - ay;
	return record.skeleton.map((curve) => curve.map(([px, py]) => [px + dx, py + dy]));
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** A shape is one of a record's when its id matches, and its key (a record kept without one
 * takes shapes without one) */
function belongsTo(shape, record) {
	if (shape?.objType !== 'Path' || strokeIdOf(shape) === null) return false;
	return signature(shape) === signatureOf(record.id, record.key);
}

/** What ties a shape to its record: the id and the key */
const signatureOf = (id, key) => `${id}|${key || ''}`;
const signature = (shape) => signatureOf(strokeIdOf(shape), strokeKeyOf(shape));

/** The records by signature (the first wins, as it always has) */
function recordIndex(records) {
	const index = new Map();
	records.forEach((record) => {
		const key = signatureOf(record.id, record.key);
		if (!index.has(key)) index.set(key, record);
	});
	return index;
}

/** A copy set is a whole stroke: its record is known and every part is there once */
function isWhole(source, shapes) {
	if (!source || !Array.isArray(source.skeleton)) return false;
	if (!Number.isInteger(source.parts)) return true;
	const parts = shapes.map(strokePartOf);
	return (
		parts.length === source.parts &&
		new Set(parts).size === parts.length &&
		parts.every((part) => Number.isInteger(part) && part >= 0 && part < source.parts)
	);
}

function countSeen(seen, key) {
	const k = seen.get(key) || 0;
	seen.set(key, k + 1);
	return k;
}

function addToSet(sets, key, source, shape) {
	if (!sets.has(key)) sets.set(key, { source, shapes: [] });
	sets.get(key).shapes.push(shape);
}

/** The shape's stroke tags go; anyink goes too when nothing else is in it */
function untag(shape) {
	if (!shape?.anyink || typeof shape.anyink !== 'object') return;
	const rest = { ...shape.anyink };
	['strokeId', 'strokeKey', 'strokePart'].forEach((name) => delete rest[name]);
	if (Object.keys(rest).length) shape.anyink = rest;
	else delete shape.anyink;
}

function cloneRecord(record) {
	return JSON.parse(JSON.stringify(record));
}

function addRecord(item, record) {
	if (!item.anyink || typeof item.anyink !== 'object') item.anyink = {};
	const nib = item.anyink.nib && typeof item.anyink.nib === 'object' ? item.anyink.nib : {};
	item.anyink.nib = { ...nib, strokes: [...strokeRecords(item), record] };
	return record;
}

/** The lower left of some shapes' ink, whole units */
function lowerLeft(shapes) {
	let xMin = Infinity;
	let yMin = Infinity;
	shapes.forEach((shape) => {
		const maxes = shape?.maxes;
		if (!maxes) return;
		xMin = Math.min(xMin, maxes.xMin);
		yMin = Math.min(yMin, maxes.yMin);
	});
	if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return [0, 0];
	return [Math.round(xMin) || 0, Math.round(yMin) || 0];
}
