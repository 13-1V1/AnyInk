// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (docs/SKETCH.md sections 7 and 8, D-047 point 1): the shapes a sketch builds, and how the
	letter knows they are still the ones it built. Pure; nib/stroke_record.js is the pattern.

	Each built shape is an ordinary letter shape tagged
	  shape.anyink = { sketchId, sketchKey, sketchPart }
	    sketchId    the piece's id in the sketch
	    sketchKey   the sketch's key (glyph.anyink.sketch.key)
	    sketchPart  which of the piece's shapes this is (0 first)
	project_data/path.js keeps shape.anyink, so the tags ride through Undo and the work file.

	Paste (reconcile, run by history_hook.js beforeSketchStep inside every item step): a tagged
	shape whose sketchKey is not this letter's sketch key (a copy from another letter, or a letter
	with no sketch), whose piece the sketch doesn't have, or that repeats a { piece, part } already
	matched (a copy pasted into its own letter), loses its tags and is an ordinary shape. Of two
	shapes with the same tags, the one the letter held when it was last reconciled stays built;
	with no such memory (a letter just loaded, or brought back by Undo), the first in the letter's
	order. A sketch from a newer app, or with a v this app can't read, keeps its tags as they are
	(only foreign keys go); a stored sketch that can't be read at all, or such a sketch with no key,
	keeps every tag.

	The hash: "c<count>:<8 hex>", the number of this sketch's built shapes and a 32-bit FNV-1a of
	their tags and rounded points (each point, then its two handles), ordered by piece and part
	so a change of shape order alone never counts. A sketch step stores it in sketch.builtHash
	(markBuilt); anything that changes the built shapes without the sketch then shows as a
	mismatch (builtMatches false).

	  isBuiltShape(shape)            tagged by a sketch (any sketch)
	  tagBuilt(shape, { id, key, part })
	  untagBuilt(shape)              the tags go; anyink goes too when nothing else is in it
	  sketchIdOf(shape), sketchKeyOf(shape), sketchPartOf(shape)
	  builtShapes(item)              the shapes tagged with this letter's sketch key, in order
	  reconcile(item)                the rules above; returns how many shapes lost their tags
	  hashBuilt(item, key?)          the hash of the letter's built shapes for that key (the
	                                 letter's sketch key by default)
	  builtMatches(item)             the hash agrees with sketch.builtHash (a sketch with no hash
	                                 yet agrees only while it has no built shapes); true with no
	                                 sketch
	  markBuilt(item)                stores the hash now; returns it
*/
import { getPiece, isNewerSketch, sketchOf } from './model.js';

const TAGS = ['sketchId', 'sketchKey', 'sketchPart'];

/** @returns {Boolean} */
export function isBuiltShape(shape) {
	return sketchKeyOf(shape) !== null && sketchIdOf(shape) !== null;
}

/**
 * @param {Object} shape - Path
 * @param {{id: Number, key: String, part?: Number}} tags
 */
export function tagBuilt(shape, { id, key, part = 0 }) {
	if (!shape) return;
	shape.anyink = {
		...(shape.anyink && typeof shape.anyink === 'object' ? shape.anyink : {}),
		sketchId: id,
		sketchKey: key,
		sketchPart: Number.isInteger(part) ? part : 0,
	};
}

/** @param {Object} shape */
export function untagBuilt(shape) {
	if (!shape?.anyink || typeof shape.anyink !== 'object') return;
	const rest = { ...shape.anyink };
	TAGS.forEach((name) => delete rest[name]);
	if (Object.keys(rest).length) shape.anyink = rest;
	else delete shape.anyink;
}

/** @returns {Number | null} */
export function sketchIdOf(shape) {
	const id = shape?.anyink?.sketchId;
	return id === undefined || id === null || id === '' || id === false ? null : id;
}

/** @returns {String | null} */
export function sketchKeyOf(shape) {
	const key = shape?.anyink?.sketchKey;
	return typeof key === 'string' && key ? key : null;
}

/** @returns {Number} 0 when the tag is missing */
export function sketchPartOf(shape) {
	const part = shape?.anyink?.sketchPart;
	return Number.isInteger(part) ? part : 0;
}

/**
 * @param {Object} item - Glyph
 * @param {String} [key]
 * @returns {Array<Object>}
 */
export function builtShapes(item, key = sketchOf(item)?.key) {
	if (!key || !Array.isArray(item?.shapes)) return [];
	return item.shapes.filter((shape) => isBuiltShape(shape) && sketchKeyOf(shape) === key);
}

/** The shapes each letter held when it was last reconciled */
const knownShapes = new WeakMap();

/**
 * @param {Object} item - Glyph
 * @returns {Number} shapes that lost their tags
 */
export function reconcile(item) {
	if (!Array.isArray(item?.shapes)) return 0;
	const sketch = sketchOf(item);
	const stored = item.anyink?.sketch;
	// a sketch is stored but can't be read (no sketch at all, or one this app can't read that has
	// no key): its built shapes can't be told from foreign ones, so every tag stays
	if (stored !== undefined && stored !== null && (!sketch || typeof sketch.key !== 'string')) {
		return 0;
	}
	const key = sketch?.key || null;
	const newer = isNewerSketch(sketch);
	const known = knownShapes.get(item);
	let changed = 0;
	const strip = (shape) => {
		untagBuilt(shape);
		changed += 1;
	};
	/** `${id}#${part}` => the shapes with those tags */
	const groups = new Map();
	item.shapes.forEach((shape) => {
		if (!isBuiltShape(shape)) return;
		if (!key || sketchKeyOf(shape) !== key) return strip(shape);
		if (newer) return;
		if (!getPiece(sketch, sketchIdOf(shape))) return strip(shape);
		const tag = `${sketchIdOf(shape)}#${sketchPartOf(shape)}`;
		if (!groups.has(tag)) groups.set(tag, []);
		groups.get(tag).push(shape);
	});
	groups.forEach((shapes) => {
		if (shapes.length < 2) return;
		const keep = (known && shapes.find((shape) => known.has(shape))) || shapes[0];
		shapes.forEach((shape) => {
			if (shape !== keep) strip(shape);
		});
	});
	knownShapes.set(item, new WeakSet(item.shapes));
	return changed;
}

/**
 * @param {Object} item - Glyph
 * @param {String} [key]
 * @returns {String} 'c<count>:<8 hex>'
 */
export function hashBuilt(item, key = sketchOf(item)?.key) {
	const shapes = builtShapes(item, key)
		.map((shape, index) => ({ shape, index }))
		.sort(
			(a, b) =>
				compare(sketchIdOf(a.shape), sketchIdOf(b.shape)) ||
				sketchPartOf(a.shape) - sketchPartOf(b.shape) ||
				a.index - b.index
		);
	let hash = FNV_OFFSET;
	shapes.forEach(({ shape }) => {
		hash = fnv(hash, `|${sketchIdOf(shape)}.${sketchPartOf(shape)}:`);
		(shape.pathPoints || []).forEach((point) => {
			hash = fnv(hash, pointText(point));
		});
	});
	return `c${shapes.length}:${hash.toString(16).padStart(8, '0')}`;
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean}
 */
export function builtMatches(item) {
	const sketch = sketchOf(item);
	if (!sketch) return true;
	const now = hashBuilt(item, sketch.key);
	if (typeof sketch.builtHash !== 'string' || !sketch.builtHash) return now.startsWith('c0:');
	return now === sketch.builtHash;
}

/**
 * @param {Object} item - Glyph
 * @returns {String | null} the stored hash (null with no sketch)
 */
export function markBuilt(item) {
	const sketch = sketchOf(item);
	if (!sketch) return null;
	sketch.builtHash = hashBuilt(item, sketch.key);
	return sketch.builtHash;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

const FNV_OFFSET = 0x811c9dc5;

/** 32-bit FNV-1a over a string's UTF-16 code units */
function fnv(hash, text) {
	let h = hash;
	for (let i = 0; i < text.length; i += 1) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
}

/** A path point as rounded text: the point, then each handle where it is (the point when off) */
function pointText(point) {
	const p = coordOf(point?.p);
	const h1 = handleOf(point?.h1, p);
	const h2 = handleOf(point?.h2, p);
	return `${p.join(',')};${h1.join(',')};${h2.join(',')}/`;
}

function coordOf(control) {
	const x = control?.x ?? control?.coord?.x;
	const y = control?.y ?? control?.coord?.y;
	return [Math.round(Number(x) || 0), Math.round(Number(y) || 0)];
}

/** A handle's place: a ControlPoint's x / y already fall back to its point when unused; saved
 * data says so with use: false */
function handleOf(handle, p) {
	if (!handle || handle.use === false) return p;
	return coordOf(handle);
}

function compare(a, b) {
	if (a === b) return 0;
	return String(a).localeCompare(String(b), 'en', { numeric: true });
}
