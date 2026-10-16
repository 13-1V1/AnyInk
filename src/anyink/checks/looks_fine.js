// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11: "Looks fine to me" (UX-BEGINNER.md 4.2 "Ready": stored per letter and per check in
	glyph.anyink.checksOk, and cleared only when the letter's shapes change). Pure data: no
	editor, no Undo step (the press is one item step, made by whoever shows the button, titled
	word('checks.step.looksFine', { letter })).

	The record: glyph.anyink.checksOk = { print, ids }
	  ids     the checks he said look fine ('offLine', 'size', ...: checks.js CHECK)
	  print   the letter's shapes when he said so (shapePrint)
	A record whose print no longer matches the shapes counts as no record at all, so nothing has
	to remember to clear it (D-039's ink print, the same idea): any change to a point, a curve
	handle, a shape added or taken away clears it. Moving the whole drawing does not: the print
	is taken from the shapes' own corner (the lowest point and the leftmost point), so automatic
	spacing, the letter-spacing slider, an edge drag, Sit on the line or a re-seated tail never
	bring back a problem he already looked at. Undo brings the record back with the shapes it
	was made for. The record rides along in Undo steps, crash copies and the work file (Glyph
	save() keeps glyph.anyink).

	  CHECKS_OK                     'checksOk', the field in glyph.anyink
	  shapePrint(item)              a short text that changes when the shapes change
	  looksFineIds(item)            the ids he said look fine, while the shapes are as they were
	  isLooksFine(item, id)         true when he said that check looks fine
	  setLooksFine(item, id)        writes the record (a new print starts a new list); true when
	                                it changed
	  clearLooksFine(item)          takes the record away; true when there was one
	  isStaleLooksFine(item)        true when a record is there but the shapes changed since
	  pruneLooksFine(item)          takes a stale record away; true when it did
	  openChecks(item, checks)      the checks he hasn't said look fine ({ id } objects)
*/

export const CHECKS_OK = 'checksOk';

/**
 * A print of the letter's shapes: every point and curve handle (whole units, measured from the
 * leftmost and the lowest point), each shape's point count and kind. The same drawing moved
 * anywhere gives the same print.
 * @param {Object} item - Glyph
 * @returns {String} 16 hex digits; '' for a letter with no shapes
 */
export function shapePrint(item) {
	const shapes = Array.isArray(item?.shapes) ? item.shapes.filter(Boolean) : [];
	if (!shapes.length) return '';
	let minX = Infinity;
	let minY = Infinity;
	shapes.forEach((shape) => {
		(shape.pathPoints || []).forEach((point) => {
			const x = Number(point?.p?.x);
			const y = Number(point?.p?.y);
			if (Number.isFinite(x) && x < minX) minX = x;
			if (Number.isFinite(y) && y < minY) minY = y;
		});
	});
	if (!Number.isFinite(minX)) minX = 0;
	if (!Number.isFinite(minY)) minY = 0;
	const rx = (value) => whole(Number(value) - minX);
	const ry = (value) => whole(Number(value) - minY);
	const parts = [String(shapes.length)];
	shapes.forEach((shape) => {
		if (shape.objType === 'ComponentInstance') {
			parts.push(`c:${shape.link}:${componentStamp(shape)}`);
			return;
		}
		const points = shape.pathPoints || [];
		parts.push(`p${points.length}`);
		points.forEach((point) => {
			parts.push(
				`${rx(point?.p?.x)},${ry(point?.p?.y)},${rx(point?.h1?.x)},${ry(point?.h1?.y)},` +
					`${rx(point?.h2?.x)},${ry(point?.h2?.y)}`
			);
		});
	});
	return hashText(parts.join('|'));
}

/**
 * @param {Object} item - Glyph
 * @returns {Array<String>} check ids; [] when there is no record or the shapes changed since
 */
export function looksFineIds(item) {
	const record = recordOf(item);
	if (!record) return [];
	if (record.print !== shapePrint(item)) return [];
	return [...record.ids];
}

/**
 * @param {Object} item - Glyph
 * @param {String} id - a check id
 * @returns {Boolean}
 */
export function isLooksFine(item, id) {
	return looksFineIds(item).includes(id);
}

/**
 * He pressed "Looks fine to me" on one check of this letter.
 * @param {Object} item - Glyph (mutated: item.anyink.checksOk)
 * @param {String} id - a check id
 * @returns {Boolean} true when the record changed
 */
export function setLooksFine(item, id) {
	if (!item || typeof id !== 'string' || !id) return false;
	const print = shapePrint(item);
	if (!print) return false;
	const ids = looksFineIds(item);
	if (ids.includes(id)) return false;
	if (!item.anyink || typeof item.anyink !== 'object') item.anyink = {};
	item.anyink[CHECKS_OK] = { print, ids: [...ids, id] };
	return true;
}

/**
 * @param {Object} item - Glyph (mutated)
 * @returns {Boolean} true when a record was taken away
 */
export function clearLooksFine(item) {
	if (!item?.anyink || !Object.hasOwn(item.anyink, CHECKS_OK)) return false;
	delete item.anyink[CHECKS_OK];
	return true;
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean} true when a record is there but no longer counts
 */
export function isStaleLooksFine(item) {
	const record = recordOf(item);
	return !!record && record.print !== shapePrint(item);
}

/**
 * @param {Object} item - Glyph (mutated)
 * @returns {Boolean} true when a stale record was taken away
 */
export function pruneLooksFine(item) {
	return isStaleLooksFine(item) ? clearLooksFine(item) : false;
}

/**
 * @param {Object} item - Glyph
 * @param {Array<{id: String}>} checks
 * @returns {Array<Object>} the checks he hasn't said look fine, in their order
 */
export function openChecks(item, checks) {
	const fine = looksFineIds(item);
	return (checks || []).filter((check) => check && !fine.includes(check.id));
}

/** @returns {{print: String, ids: Array<String>} | null} a well-formed record, or null */
function recordOf(item) {
	const record = item?.anyink?.[CHECKS_OK];
	if (!record || typeof record !== 'object' || typeof record.print !== 'string') return null;
	const ids = Array.isArray(record.ids) ? record.ids.filter((id) => typeof id === 'string') : [];
	return { print: record.print, ids };
}

/** A component's place and size, whatever it holds */
function componentStamp(shape) {
	return [
		'translateX',
		'translateY',
		'resizeWidth',
		'resizeHeight',
		'rotation',
		'isFlippedEW',
		'isFlippedNS',
	]
		.map((key) => String(shape[key] ?? ''))
		.join(',');
}

/** @returns {Number | String} a whole number, or '' for anything that isn't a number */
function whole(value) {
	return Number.isFinite(value) ? Math.round(value) : '';
}

/**
 * Two FNV-1a passes with different seeds, so two drawings share a print about once in 2^64.
 * @param {String} text
 * @returns {String} 16 hex digits
 */
function hashText(text) {
	let a = 0x811c9dc5;
	let b = 0x01000193 ^ text.length;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		a = Math.imul(a ^ code, 0x01000193);
		b = Math.imul(b ^ code, 0x5bd1e995);
		b ^= b >>> 15;
	}
	const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
	return `${hex(a)}${hex(b)}`;
}
