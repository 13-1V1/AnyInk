// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-core: the photo registry, settings.anyink.photos (docs/UX-BEGINNER.md 4.4, section 10
	B9). One record per photo, keyed by its image's asset id (editor.assets), holding its parts,
	which letter used which part, its one scale, and whether he is done with it. Pure: plain data
	on the project's settings; no DOM, no history, no toasts. The photo flow decides when a change
	is an Undo step (UX-BEGINNER 7.3: picking or cancelling a photo is none; Use it is "traced r").

	A record (plain JSON, saved in the work file; B3 made unknown settings.anyink keys survive a
	load and every whole-font Undo copy):
	  { asset,                       the image's asset id, the same as its key
	    width, height,               pixel size of the stored (capped) image the parts are measured in
	    paper, lightInk,             the photo's paper: 'scan' | 'photo' and light ink on dark
	                                 paper (paper_kind.js, or his picks in Adjust); the next letter
	                                 traced from this photo starts with them
	    find: { paper, lightInk },   how the parts were found (ink_parts.js photoInk options), fixed
	                                 when the photo came in: photoInk with these again before
	                                 attachMasks, whatever Adjust says now
	    fingerprint,                 photoFingerprint of the file he picked ('' when unknown)
	    added,                       1, 2, 3 ... in the order photos came into the font
	    pen,                         the photo's pen stroke in pixels when its parts were found
	                                 (ink_parts.js findInk; 0 when not known: a record from
	                                 before the B8 + B9 finalize)
	    parts: [{ id, left, top, right, bottom, row, drawn? }],   ink_parts.js storedPart: found
	                                 parts p1, p2 ... and boxes he drew b1, b2 ... (drawn: true);
	                                 never their masks (attachMasks finds them again)
	    used: { [partId]: { char, itemId, seq, tail? } },  the letter named for the part, the
	                                 letter's record id, the naming order, [It has a tail] / [No tail]
	    skipped: [partId],           "Skip this part"
	    done,                        "Done with this photo"
	    scale }                      the photo's scale (B3 photo_scale.js), or null before any letter
	The coach's own reader (coach/font_facts.js photoRecords: parts minus used) reads this shape;
	photoSummaries also leaves out skipped parts, parts under a box he drew and leftovers.

	Rules:
	- One image id per photo (the B3 stand-in added the same photo twice and got two): addPhoto
	  with a fingerprint already in the font, or an asset id already there, gives back that record
	  and changes nothing; the flow asks findPhotoByFingerprint before it adds an image at all.
	- A letter holds one part of a photo (its trace is one image at one place): naming a part for
	  a letter lets go of any other part that letter had in this photo; releaseItem lets go of its
	  parts in other photos, and releaseStaleUses of every part whose letter no longer holds the
	  photo (an Undo of Use it, a photo removed or replaced).
	- Reading order: rows top to bottom, then left to right (the parts' row numbers, ink_parts.js).
	- Free parts (what rule 12 counts and the guess picks from): found parts not used, not
	  skipped, not covered (COVER_SHARE of the box inside the boxes he drew and used, together:
	  he drew round a letter the finder split in two, or round each of two letters the finder
	  joined; finalize: the "na" part came back after n and a were each boxed), and not a
	  leftover: a part touching the photo's edge
	  while the photo has a part that doesn't (a scrap of shadow or table the parts finder
	  let through; a lone letter cut by the edge is still his letter). Fix after the first-timer
	  walk: the guess sat on such a scrap, and Trace it found no ink.
	- The guess (the green dashed box), letter unknown: the first free part in reading order.
	  Letter known (fix after the first-timer walk: the first free part was a punch hole):
	  1. never a part far smaller than the photo's others (its longer side under TINY_SHARE of the
	     middle of theirs), nor one under LETTER_PENS pens long (a dot of the pen: finalize, a
	     photo whose g the edge cut had only a dot left), for a letter; such a part first for
	     . , ' and -;
	  2. when the letter before it in a to z, A to Z or 0 to 9 was named from this photo, the
	     free part right after that one in reading order; when the letter after it was, the one
	     right before it (a written-out alphabet);
	  3. with the photo's scale known (a letter traced from it), the first part whose height is
	     within FIT_SHARE of the letter's on the new-font lines (placement/classes.js
	     lineTargets), else the one nearest; without it, the first part.
	- The alphabet prefill: when the last two letters named from this photo (in naming order)
	  are next to each other in a to z, A to Z or 0 to 9, the next one, unless it was named from
	  this photo already, and only on the part right after the last one named in reading order
	  (skipped parts passed over; a row's last part is followed by the next row's first). Fix
	  after the first-timer walk: on rows the finder had mixed it put e on the n, and Enter took
	  it. Never on a part that may hold two touching letters (mayBeTwoLetters), nor on the part
	  after one named from such a part (finalize: after j and k it put l on "lm", then m on the
	  n and n on the o), nor on a skipped part or one far smaller than a letter.
	- Undo: the list is state outside Undo, like the images in editor.assets. A whole-font Undo
	  or Redo swaps in a copy of the font from before or after its step; carryPhotos puts the
	  live list on it (photos added, parts skipped or drawn, Done, the scale), and the photo
	  flow's reconcilePhotoUses then lets the uses follow the letters the step put back. Fix
	  after the hostile pass: the list of the older copy came back, so a photo added since was
	  forgotten while its letters still showed it, and choosing it again stored a second image.

	  photosOf(project)                   the records map, or null (nothing made)
	  getPhoto(project, asset)            the live record, repaired in place if damaged; null
	  addPhoto(project, { asset, width, height, parts, paper, lightInk, fingerprint, pen })
	                                      the record (paper and lightInk also become find)
	  findPhotoByFingerprint(project, fp) the record holding that photo, or null
	  removePhoto(project, asset)         true when one was removed
	  listPhotos(project, { limit })      newest first, at most MAX_LISTED_PHOTOS
	  photoFingerprint(bytes)             'fnv:<byte count>:<16 hex digits>' (two FNV-1a passes)
	  usePart(record, partId, { char, itemId })   the use, or null (unknown part, not one letter)
	  usedChar(record, partId)            the letter named for a part, or ''
	  releaseItem(project, itemId, { except })    uses let go
	  releaseStaleUses(project, getItem)  uses let go; getItem(itemId, partId) -> the letter
	  skipPart(record, partId) / markDone(record, done = true)
	  setScale(record, scale) / setTail(record, partId, tail | null)
	  setPaper(record, paper) / setLightInk(record, lightInk)   his picks; find stays
	  addDrawnPart(record, box)           a box he drew (the tight box ink_parts.js partFromBox
	                                      gives): { id: 'b1', ..., row, drawn: true }, or null
	  unusedParts(record)                 the free parts, in reading order
	  guessPart(record, { char })         the part the green dashed box starts on, or null
	  onlyPart(record, { char })          the one part the letter can be (step B skipped), or null
	  mayBeTwoLetters(record, partId)     true when a part may hold two letters that touch (at
	                                      least TWO_WIDE_SHARE times the middle width of the
	                                      photo's other parts and TWO_WIDE_ASPECT times as wide as
	                                      it is tall; photo_flow_notes.js and the dialog say so)
	  prefillChar(record, boxed)          boxed: the part the green box is on (an id, a stored part,
	                                      or a box he is drawing { left, top, right, bottom })
	  photoSummaries(project)             [{ id, unused, done }] for the coach's rule 12
	  carryPhotos(fromProject, toProject) the live list onto the font a whole-font Undo or Redo
	                                      swapped in (a copy); true when done
	  placementPhoto(record, partsWithMasks?)     { asset, parts, uses } as placement reads a
	                                      photo (placement/photo_scale.js): skipped parts, parts
	                                      under a used box, unused boxes and leftovers he didn't
	                                      name left out; masks taken from partsWithMasks by id
	  normalizePhotoRecord(raw, asset)    a clean record from whatever a file held
*/
import { verticalClass, lineTargets, DEFAULT_LINES } from '../placement/classes.js';
import { storedPart, rowForBox } from './ink_parts.js';

/** The photo card shows at most this many photos of the font. */
export const MAX_LISTED_PHOTOS = 6;

/** A part with this share of its box inside a box he drew and used is covered by it. */
export const COVER_SHARE = 0.6;

/** A part whose longer side is under this share of the photo's usual part is mark-sized. */
export const TINY_SHARE = 0.4;

/** A letter's part is at least this many of the photo's pen strokes long (a dot is one or two). */
export const LETTER_PENS = 2.5;

/** A part this many times the middle width of the photo's other parts... */
export const TWO_WIDE_SHARE = 1.6;

/** ...and this many times as wide as it is tall may hold two letters that touch. */
export const TWO_WIDE_ASPECT = 1.25;

/** With the photo's scale known, a part within this factor of a letter's height fits it. */
export const FIT_SHARE = 1.3;

/** A hyphen's height on the new-font lines, as a share of the small-letter height. */
const HYPHEN_HEIGHT_SHARE = 0.1;

/** Marks written small: their guess is a mark-sized part. */
const SMALL_MARKS = new Set(['period', 'comma', 'apostrophe', 'hyphen']);

/** The paper kinds, as auto-trace names its modes. */
export const PHOTO_PAPERS = Object.freeze(['scan', 'photo']);

const RUNS = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789'];

// --------------------------------------------------------------
// The records
// --------------------------------------------------------------

/**
 * @param {Object} project
 * @returns {Object | null} settings.anyink.photos when it is a map
 */
export function photosOf(project) {
	const photos = project?.settings?.anyink?.photos;
	return isMap(photos) ? photos : null;
}

/** settings.anyink.photos, made (or remade over something broken) when missing. */
function ensurePhotos(project) {
	const settings = project?.settings;
	if (!settings || typeof settings !== 'object') return null;
	if (!isMap(settings.anyink)) settings.anyink = {};
	if (!isMap(settings.anyink.photos)) settings.anyink.photos = {};
	return settings.anyink.photos;
}

/**
 * @param {Object} project
 * @param {String} asset
 * @returns {Object | null} the live record
 */
export function getPhoto(project, asset) {
	const photos = photosOf(project);
	if (!photos || typeof asset !== 'string' || !Object.hasOwn(photos, asset)) return null;
	const record = photos[asset];
	if (!isMap(record)) return null;
	if (!wellFormed(record, asset)) photos[asset] = normalizePhotoRecord(record, asset);
	return photos[asset];
}

/**
 * @param {Object} project
 * @param {{asset: String, width?: Number, height?: Number, parts?: Array<Object>,
 *   paper?: String, lightInk?: Boolean, fingerprint?: String}} photo
 * @returns {Object | null} the record (an existing one for the same photo)
 */
export function addPhoto(
	project,
	{ asset, width, height, parts, paper, lightInk, fingerprint, pen } = {}
) {
	if (typeof asset !== 'string' || !asset) return null;
	const photos = ensurePhotos(project);
	if (!photos) return null;
	const same =
		typeof fingerprint === 'string' && fingerprint && findPhotoByFingerprint(project, fingerprint);
	if (same) return same;
	const existing = getPhoto(project, asset);
	if (existing) return existing;
	const added = Math.max(0, ...Object.values(photos).map((r) => finiteOr(r?.added, 0))) + 1;
	photos[asset] = normalizePhotoRecord(
		{
			width,
			height,
			paper,
			lightInk,
			find: { paper, lightInk },
			fingerprint,
			added,
			pen,
			parts: (Array.isArray(parts) ? parts : []).map((part) => (part ? storedPart(part) : part)),
		},
		asset
	);
	return photos[asset];
}

/**
 * @param {Object} project
 * @param {String} fingerprint
 * @returns {Object | null}
 */
export function findPhotoByFingerprint(project, fingerprint) {
	const photos = photosOf(project);
	if (!photos || typeof fingerprint !== 'string' || !fingerprint) return null;
	for (const asset of Object.keys(photos)) {
		if (photos[asset]?.fingerprint === fingerprint) return getPhoto(project, asset);
	}
	return null;
}

/**
 * @param {Object} project
 * @param {String} asset
 * @returns {Boolean}
 */
export function removePhoto(project, asset) {
	const photos = photosOf(project);
	if (!photos || typeof asset !== 'string' || !Object.hasOwn(photos, asset)) return false;
	delete photos[asset];
	return true;
}

/**
 * @param {Object} project
 * @param {{limit?: Number}} [options]
 * @returns {Array<Object>} live records, newest first
 */
export function listPhotos(project, { limit = MAX_LISTED_PHOTOS } = {}) {
	const photos = photosOf(project);
	if (!photos) return [];
	const records = Object.keys(photos)
		.map((asset, order) => ({ record: getPhoto(project, asset), order }))
		.filter(({ record }) => record)
		.sort((a, b) => b.record.added - a.record.added || b.order - a.order)
		.map(({ record }) => record);
	return records.slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
}

/**
 * @param {Uint8Array | ArrayBuffer} bytes - the photo file
 * @returns {String} 'fnv:<byte count>:<16 hex digits>'
 */
export function photoFingerprint(bytes) {
	const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
	let a = 0x811c9dc5;
	let b = 0x9747b28c;
	for (let i = 0; i < u8.length; i++) {
		a = Math.imul(a ^ u8[i], 0x01000193) >>> 0;
		b = Math.imul(b ^ u8[u8.length - 1 - i] ^ (i & 0xff), 0x01000193) >>> 0;
	}
	const hex = (v) => v.toString(16).padStart(8, '0');
	return `fnv:${u8.length}:${hex(a)}${hex(b)}`;
}

// --------------------------------------------------------------
// Which letter used which part
// --------------------------------------------------------------

/**
 * @param {Object} record
 * @param {String} partId
 * @param {{char: String, itemId?: String}} use
 * @returns {Object | null} the stored use
 */
export function usePart(record, partId, { char, itemId } = {}) {
	if (!partOf(record, partId) || !isOneChar(char)) return null;
	for (const [id, use] of Object.entries(record.used)) {
		if (id !== partId && typeof itemId === 'string' && use?.itemId === itemId)
			delete record.used[id];
	}
	record.skipped = record.skipped.filter((id) => id !== partId);
	const seq = Math.max(0, ...Object.values(record.used).map((use) => finiteOr(use?.seq, 0))) + 1;
	const before = record.used[partId];
	const use = { char, seq };
	if (typeof itemId === 'string' && itemId) use.itemId = itemId;
	if (before?.char === char && typeof before.tail === 'boolean') use.tail = before.tail;
	record.used[partId] = use;
	return use;
}

/**
 * @param {Object} record
 * @param {String} partId
 * @returns {String} the letter named for the part, or ''
 */
export function usedChar(record, partId) {
	const char = record?.used?.[partId]?.char;
	return typeof char === 'string' ? char : '';
}

/**
 * Lets go of every part a letter used in the photos other than `except`.
 * @param {Object} project
 * @param {String} itemId
 * @param {{except?: String}} [options] - an asset id to leave alone
 * @returns {Number} uses let go
 */
export function releaseItem(project, itemId, { except } = {}) {
	let count = 0;
	forEachRecord(project, (record) => {
		if (record.asset === except) return;
		for (const [id, use] of Object.entries(record.used)) {
			if (use?.itemId === itemId) {
				delete record.used[id];
				count++;
			}
		}
	});
	return count;
}

/**
 * Lets go of every part whose letter no longer holds the photo (its trace is gone or shows
 * another image). Uses with no letter id are kept.
 * @param {Object} project
 * @param {(itemId: String, partId: String) => Object | null} getItem
 * @returns {Number} uses let go
 */
export function releaseStaleUses(project, getItem) {
	if (typeof getItem !== 'function') return 0;
	let count = 0;
	forEachRecord(project, (record) => {
		for (const [id, use] of Object.entries(record.used)) {
			if (typeof use?.itemId !== 'string') continue;
			const item = getItem(use.itemId, id);
			if (item?.anyink?.trace?.asset === record.asset) continue;
			delete record.used[id];
			count++;
		}
	});
	return count;
}

/**
 * "Skip this part": not guessed again, not counted. A used part can't be skipped.
 * @param {Object} record
 * @param {String} partId
 * @returns {Boolean}
 */
export function skipPart(record, partId) {
	if (!partOf(record, partId) || record.used[partId]) return false;
	if (!record.skipped.includes(partId)) record.skipped.push(partId);
	return true;
}

/**
 * "Done with this photo" (rule 12 stops for it; its unused parts stay usable).
 * @param {Object} record
 * @param {Boolean} [done]
 */
export function markDone(record, done = true) {
	if (isMap(record)) record.done = !!done;
}

/**
 * @param {Object} record
 * @param {Number | null} scale - font units per image pixel; null clears it
 * @returns {Boolean} true when stored
 */
export function setScale(record, scale) {
	if (!isMap(record)) return false;
	if (scale === null) {
		record.scale = null;
		return true;
	}
	if (!(typeof scale === 'number' && Number.isFinite(scale) && scale > 0)) return false;
	record.scale = scale;
	return true;
}

/**
 * [It has a tail] (true) / [No tail] (false) / not known (null).
 * @param {Object} record
 * @param {String} partId
 * @param {Boolean | null} tail
 * @returns {Boolean} true when stored
 */
export function setTail(record, partId, tail) {
	const use = record?.used?.[partId];
	if (!isMap(use)) return false;
	if (typeof tail === 'boolean') use.tail = tail;
	else delete use.tail;
	return true;
}

/**
 * @param {Object} record
 * @param {String} paper - 'scan' | 'photo'
 * @returns {Boolean} true when stored
 */
export function setPaper(record, paper) {
	if (!isMap(record) || !PHOTO_PAPERS.includes(paper)) return false;
	record.paper = paper;
	return true;
}

/**
 * [ ] Light ink on dark paper, as he set it.
 * @param {Object} record
 * @param {Boolean} lightInk
 * @returns {Boolean} true when stored
 */
export function setLightInk(record, lightInk) {
	if (!isMap(record) || typeof lightInk !== 'boolean') return false;
	record.lightInk = lightInk;
	return true;
}

/**
 * A box he drew in the photo dialog, as a part of its own.
 * @param {Object} record
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} box - image pixels
 * @returns {Object | null} the stored part
 */
export function addDrawnPart(record, box) {
	if (!isMap(record) || !box) return null;
	const left = Math.floor(Number(box.left));
	const top = Math.floor(Number(box.top));
	const right = Math.ceil(Number(box.right));
	const bottom = Math.ceil(Number(box.bottom));
	if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
		return null;
	}
	const number = Math.max(
		0,
		...record.parts.map((p) => (/^b\d+$/.test(p.id) ? Number(p.id.slice(1)) : 0))
	);
	const found = record.parts.filter((p) => !p.drawn);
	const part = {
		id: `b${number + 1}`,
		left,
		top,
		right,
		bottom,
		row: rowForBox(found, { left, top, right, bottom }),
		drawn: true,
	};
	record.parts.push(part);
	return part;
}

// --------------------------------------------------------------
// The guess, the prefill, what the coach reads
// --------------------------------------------------------------

/**
 * @param {Object} record
 * @returns {Array<String>} the free parts (found, not used, skipped, covered or a leftover), in
 *   reading order
 */
export function unusedParts(record) {
	if (!isMap(record) || !Array.isArray(record.parts)) return [];
	const covers = usedBoxes(record);
	const skipped = new Set(Array.isArray(record.skipped) ? record.skipped : []);
	const leftovers = leftoverParts(record);
	return readingOrder(record.parts)
		.filter(
			(p) =>
				!p.drawn &&
				!record.used?.[p.id] &&
				!skipped.has(p.id) &&
				!leftovers.has(p.id) &&
				!isCovered(p, covers)
		)
		.map((p) => p.id);
}

/**
 * @param {Object} record
 * @param {{char?: String}} [options] - the letter, when known
 * @returns {String | null} the part the green dashed box starts on
 */
export function guessPart(record, { char } = {}) {
	const free = unusedParts(record);
	if (!free.length) return null;
	if (!isOneChar(char)) return free[0];
	const byId = new Map(record.parts.map((p) => [p.id, p]));
	const usual = usualSize(record);
	const small = SMALL_MARKS.has(verticalClass(char));
	const sized = free.filter((id) => {
		const part = byId.get(id);
		return small ? isMarkSized(part, usual) : !isMarkSized(part, usual) && isLetterSized(part, record);
	});
	const pool = sized.length || !small ? sized : free;
	if (!pool.length) return null;
	const near = runNeighbor(record, char, pool);
	if (near) return near;
	const want = expectedHeight(char, record.scale);
	if (!want) return pool[0];
	const misfit = (id) => Math.abs(Math.log(boxHeight(byId.get(id)) / want));
	const fits = pool.find((id) => misfit(id) <= Math.log(FIT_SHARE));
	if (fits) return fits;
	return pool.reduce((best, id) => (misfit(id) < misfit(best) ? id : best));
}

/**
 * The one part a letter can be on this photo (4.4 step B: such a photo opened from a letter
 * goes straight to the result): the found parts, used or not, less leftovers and, for a letter,
 * mark-sized ones.
 * @param {Object} record
 * @param {{char?: String}} [options]
 * @returns {String | null}
 */
export function onlyPart(record, { char } = {}) {
	if (!isMap(record) || !Array.isArray(record.parts)) return null;
	const leftovers = leftoverParts(record);
	const usual = usualSize(record);
	const letter = !(isOneChar(char) && SMALL_MARKS.has(verticalClass(char)));
	const found = record.parts.filter(
		(p) => isMap(p) && !p.drawn && !leftovers.has(p.id) && (!letter || !isMarkSized(p, usual))
	);
	if (found.length !== 1) return null;
	// a letter's one part is letter-sized, never a lone dot of the pen (finalize)
	return !letter || isLetterSized(found[0], record) ? found[0].id : null;
}

/**
 * A part that may hold two letters written touching (photo_flow_notes.js says so at step C, the
 * photo dialog when the green box is on it, and the alphabet prefill never fills one in).
 * @param {Object} record
 * @param {String | Object} part - its id, or the part
 * @returns {Boolean}
 */
export function mayBeTwoLetters(record, part) {
	const parts = Array.isArray(record?.parts) ? record.parts : [];
	const box = typeof part === 'string' ? parts.find((p) => p?.id === part) : part;
	if (!isMap(box)) return false;
	const width = box.right - box.left;
	const height = box.bottom - box.top;
	if (!(width > 0) || !(height > 0) || width < TWO_WIDE_ASPECT * height) return false;
	const skipped = new Set(Array.isArray(record.skipped) ? record.skipped : []);
	const others = parts
		.filter((p) => isMap(p) && p.id !== box.id && !p.drawn && !skipped.has(p.id))
		.map((p) => p.right - p.left)
		.filter((w) => w > 0)
		.sort((a, b) => a - b);
	if (!others.length) return false;
	return width >= TWO_WIDE_SHARE * others[(others.length - 1) >> 1];
}

/**
 * @param {Object} record
 * @param {String | Object} [boxed] - the part the green box is on: its id, the part, or a box
 *   he is drawing ({ left, top, right, bottom }, image pixels)
 * @returns {String} the letter the field starts with, or ''
 */
export function prefillChar(record, boxed) {
	const uses = Object.entries(record?.used || {})
		.filter(([, use]) => isOneChar(use?.char))
		.sort(([, a], [, b]) => finiteOr(a.seq, 0) - finiteOr(b.seq, 0));
	if (uses.length < 2) return '';
	const before = uses[uses.length - 2][1].char;
	const [lastId, { char: last }] = uses[uses.length - 1];
	let next = '';
	for (const run of RUNS) {
		const i = run.indexOf(before);
		if (i < 0 || run[i + 1] !== last || i + 2 >= run.length) continue;
		next = run[i + 2];
		break;
	}
	if (!next || uses.some(([, use]) => use.char === next)) return '';
	// Not on a part that may be two letters, nor after one (the run is off by one there), nor on
	// a skipped part or one far smaller than a letter (finalize)
	if (mayBeTwoLetters(record, lastId)) return '';
	const target = boxedPart(record, boxed);
	if (target) {
		if (record.skipped?.includes?.(target.id) || mayBeTwoLetters(record, target)) return '';
		if (isMarkSized(target, usualSize(record)) || !isLetterSized(target, record)) return '';
	}
	return comesNext(record, lastId, boxed) ? next : '';
}

/** The part a prefill is asked for: a found part by id or as itself, or a box being drawn. */
function boxedPart(record, boxed) {
	if (typeof boxed === 'string') return partOf(record, boxed);
	if (!isMap(boxed)) return null;
	if (typeof boxed.id === 'string' && partOf(record, boxed.id)) return partOf(record, boxed.id);
	const box = ['left', 'top', 'right', 'bottom'].map((key) => Number(boxed[key]));
	if (!box.every(Number.isFinite) || box[2] <= box[0] || box[3] <= box[1]) return null;
	return { left: box[0], top: box[1], right: box[2], bottom: box[3] };
}

/**
 * Rule 12's reading of every photo: how many letters it still has, and whether he is done.
 * @param {Object} project
 * @returns {Array<{id: String, unused: Number, done: Boolean}>}
 */
export function photoSummaries(project) {
	const out = [];
	forEachRecord(project, (record, asset) =>
		out.push({ id: asset, unused: unusedParts(record).length, done: !!record.done })
	);
	return out;
}

/**
 * The live photo list onto a font a whole-font Undo or Redo swapped in (see the header): a
 * copy of every record, or no list when the live font has none.
 * @param {Object} fromProject - the font as it was before the swap
 * @param {Object} toProject - the font swapped in
 * @returns {Boolean} true when the list was carried
 */
export function carryPhotos(fromProject, toProject) {
	const settings = toProject?.settings;
	if (!isMap(fromProject) || !isMap(settings)) return false;
	const live = photosOf(fromProject);
	if (!live) {
		if (isMap(settings.anyink)) delete settings.anyink.photos;
		return true;
	}
	const copy = {};
	const swapped = photosOf(toProject);
	for (const asset of Object.keys(live)) {
		const record = getPhoto(fromProject, asset);
		if (!record) continue;
		copy[asset] = normalizePhotoRecord(JSON.parse(JSON.stringify(record)), asset);
		// [It has a tail] / [No tail] is a step of its own (photo_flow_tail.js): the pick follows
		// the font the step brought back, where that font has the use (B8 + B9 finalize)
		for (const [partId, use] of Object.entries(copy[asset].used)) {
			const then = isMap(swapped?.[asset]?.used) ? swapped[asset].used[partId] : null;
			if (!isMap(then) || then.char !== use.char) continue;
			if (typeof then.tail === 'boolean') use.tail = then.tail;
			else delete use.tail;
		}
	}
	if (!isMap(settings.anyink)) settings.anyink = {};
	settings.anyink.photos = copy;
	return true;
}

/**
 * @param {Object} record
 * @param {Array<Object>} [partsWithMasks] - the parts with masks (ink_parts.js attachMasks)
 * @returns {{asset: String, parts: Array<Object>, uses: Object}}
 */
export function placementPhoto(record, partsWithMasks) {
	const masked = new Map((partsWithMasks || []).filter(Boolean).map((p) => [p.id, p]));
	const covers = usedBoxes(record);
	const skipped = new Set(record?.skipped || []);
	const leftovers = leftoverParts(record);
	// Not his letters: skipped parts, parts under a used box, boxes not used, and leftovers he
	// didn't name (a scrap at the edge would pull a row's writing line off)
	const parts = readingOrder(record?.parts || [])
		.filter(
			(p) =>
				!skipped.has(p.id) &&
				!isCovered(p, covers) &&
				(!p.drawn || record.used?.[p.id]) &&
				(!leftovers.has(p.id) || record.used?.[p.id])
		)
		.map((p) => masked.get(p.id) || p);
	const uses = {};
	for (const part of parts) {
		const use = record.used?.[part.id];
		if (!use) continue;
		uses[part.id] = { char: use.char };
		if (typeof use.itemId === 'string') uses[part.id].itemId = use.itemId;
		if (typeof use.tail === 'boolean') uses[part.id].tail = use.tail;
	}
	return { asset: record?.asset, parts, uses };
}

// --------------------------------------------------------------
// Cleaning a record
// --------------------------------------------------------------

/**
 * @param {Object} raw - whatever the work file held
 * @param {String} asset - its key
 * @returns {Object} a clean record
 */
export function normalizePhotoRecord(raw, asset) {
	const source = isMap(raw) ? raw : {};
	const parts = [];
	const ids = new Set();
	for (const part of Array.isArray(source.parts) ? source.parts : []) {
		if (!isMap(part) || typeof part.id !== 'string' || !part.id || ids.has(part.id)) continue;
		const box = ['left', 'top', 'right', 'bottom'].map((key) => part[key]);
		if (!box.every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
		if (box[2] <= box[0] || box[3] <= box[1]) continue;
		ids.add(part.id);
		const clean = {
			id: part.id,
			left: box[0],
			top: box[1],
			right: box[2],
			bottom: box[3],
			row: Number.isInteger(part.row) && part.row >= 0 ? part.row : 0,
		};
		if (part.drawn === true) clean.drawn = true;
		parts.push(clean);
	}
	const used = {};
	if (isMap(source.used)) {
		for (const [id, use] of Object.entries(source.used)) {
			if (!ids.has(id) || !isMap(use) || !isOneChar(use.char)) continue;
			const clean = { char: use.char, seq: finiteOr(use.seq, 0) };
			if (typeof use.itemId === 'string' && use.itemId) clean.itemId = use.itemId;
			if (typeof use.tail === 'boolean') clean.tail = use.tail;
			used[id] = clean;
		}
	}
	const skipped = [];
	for (const id of Array.isArray(source.skipped) ? source.skipped : []) {
		if (typeof id === 'string' && ids.has(id) && !used[id] && !skipped.includes(id))
			skipped.push(id);
	}
	const scale = source.scale;
	const paper = PHOTO_PAPERS.includes(source.paper) ? source.paper : 'scan';
	const lightInk = source.lightInk === true;
	const find = isMap(source.find) ? source.find : {};
	return {
		asset,
		width: nonNegative(source.width),
		height: nonNegative(source.height),
		paper,
		lightInk,
		find: {
			paper: PHOTO_PAPERS.includes(find.paper) ? find.paper : paper,
			lightInk: typeof find.lightInk === 'boolean' ? find.lightInk : lightInk,
		},
		fingerprint: typeof source.fingerprint === 'string' ? source.fingerprint : '',
		added: finiteOr(source.added, 0),
		pen: nonNegative(source.pen),
		parts,
		used,
		skipped,
		done: source.done === true,
		scale: typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : null,
	};
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function isMap(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** The shape every function here relies on (contents are checked where they are read). */
function wellFormed(record, asset) {
	return (
		record.asset === asset &&
		Array.isArray(record.parts) &&
		isMap(record.used) &&
		Array.isArray(record.skipped) &&
		typeof record.added === 'number' &&
		isMap(record.find)
	);
}

function forEachRecord(project, visit) {
	const photos = photosOf(project);
	if (!photos) return;
	for (const asset of Object.keys(photos)) {
		const record = getPhoto(project, asset);
		if (record) visit(record, asset);
	}
}

function partOf(record, partId) {
	if (!isMap(record) || !Array.isArray(record.parts)) return null;
	return record.parts.find((p) => p?.id === partId) || null;
}

/** One character, as he types it in the letter field (one code point, not a space). */
function isOneChar(char) {
	return typeof char === 'string' && [...char].length === 1 && char.trim() === char;
}

function readingOrder(parts) {
	return parts
		.filter((p) => isMap(p))
		.sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || a.left - b.left || a.top - b.top);
}

/** The boxes he drew and used. */
function usedBoxes(record) {
	return (record?.parts || []).filter((p) => p?.drawn && record.used?.[p.id]);
}

function isCovered(part, covers) {
	if (part.drawn || !covers.length) return false;
	const area = (part.right - part.left) * (part.bottom - part.top);
	if (!(area > 0)) return false;
	// the boxes' parts inside this one, together (two boxes round two touching letters)
	const inside = covers
		.map((box) => ({
			left: Math.max(part.left, box.left),
			top: Math.max(part.top, box.top),
			right: Math.min(part.right, box.right),
			bottom: Math.min(part.bottom, box.bottom),
		}))
		.filter((box) => box.right > box.left && box.bottom > box.top);
	return unionArea(inside) >= COVER_SHARE * area;
}

/** The area a few rectangles cover together (each counted once where they overlap). */
function unionArea(boxes) {
	if (!boxes.length) return 0;
	const xs = [...new Set(boxes.flatMap((b) => [b.left, b.right]))].sort((a, b) => a - b);
	let total = 0;
	for (let i = 0; i + 1 < xs.length; i++) {
		const [x0, x1] = [xs[i], xs[i + 1]];
		const spans = boxes
			.filter((b) => b.left <= x0 && b.right >= x1)
			.map((b) => [b.top, b.bottom])
			.sort((a, b) => a[0] - b[0]);
		let covered = 0;
		let end = -Infinity;
		for (const [top, bottom] of spans) {
			if (bottom <= end) continue;
			covered += bottom - Math.max(top, end);
			end = bottom;
		}
		total += covered * (x1 - x0);
	}
	return total;
}

/**
 * Found parts touching the photo's edge, when the photo has a found part that doesn't (a lone
 * letter cut by the edge is still his letter).
 */
function leftoverParts(record) {
	const width = Number(record?.width);
	const height = Number(record?.height);
	const out = new Set();
	if (!(width > 0) || !(height > 0)) return out;
	const found = (record.parts || []).filter((p) => isMap(p) && !p.drawn);
	const touches = (p) => p.left <= 0 || p.top <= 0 || p.right >= width || p.bottom >= height;
	if (!found.some((p) => !touches(p))) return out;
	for (const p of found) if (touches(p)) out.add(p.id);
	return out;
}

/** The middle of the found parts' longer sides (0 with none). */
function usualSize(record) {
	const sides = (record?.parts || [])
		.filter((p) => isMap(p) && !p.drawn)
		.map(longSide)
		.sort((a, b) => a - b);
	if (!sides.length) return 0;
	const mid = sides.length >> 1;
	return sides.length % 2 ? sides[mid] : (sides[mid - 1] + sides[mid]) / 2;
}

const longSide = (p) => Math.max(p.right - p.left, p.bottom - p.top);
const boxHeight = (p) => Math.max(1, p.bottom - p.top);

function isMarkSized(part, usual) {
	return !!part && usual > 0 && longSide(part) < TINY_SHARE * usual;
}

/** At least LETTER_PENS of the photo's pen strokes long (always, when the pen isn't known). */
function isLetterSized(part, record) {
	const pen = Number(record?.pen);
	return !!part && (!(pen > 0) || longSide(part) >= LETTER_PENS * pen);
}

/**
 * A letter's ink height in image pixels on the new-font lines, for the photo's scale (font units
 * per pixel); 0 when the scale isn't known.
 */
function expectedHeight(char, scale) {
	if (!(typeof scale === 'number' && scale > 0)) return 0;
	const lines = lineTargets(char, DEFAULT_LINES);
	const units =
		lines.top === null
			? HYPHEN_HEIGHT_SHARE * DEFAULT_LINES.xHeight
			: lines.top - (lines.tailBottom ?? lines.bottom);
	return units > 0 ? units / scale : 0;
}

/**
 * The free part next to a part named for the letter before (or after) this one in its run, in
 * reading order; null when neither was named from this photo or that neighbor isn't free.
 */
function runNeighbor(record, char, pool) {
	const order = readingList(record);
	const at = (id) => order.findIndex((p) => p.id === id);
	for (const run of RUNS) {
		const i = run.indexOf(char);
		if (i < 0) continue;
		const sides = [
			[run[i - 1], 1],
			[run[i + 1], -1],
		];
		for (const [other, step] of sides) {
			if (!other) continue;
			const named = Object.entries(record.used || {}).find(([, use]) => use?.char === other);
			if (!named) continue;
			const k = at(named[0]);
			const neighbor = k < 0 ? null : order[k + step];
			if (neighbor && pool.includes(neighbor.id)) return neighbor.id;
		}
	}
	return null;
}

/**
 * The parts in the order he reads them: found parts not skipped, covered or leftovers, and the
 * boxes he drew and used; `extra` (a box he is drawing) put in its place, taking the place of
 * the parts it covers.
 */
function readingList(record, extra = null) {
	const covers = usedBoxes(record);
	const skipped = new Set(Array.isArray(record?.skipped) ? record.skipped : []);
	const leftovers = leftoverParts(record);
	const extraCovers = extra ? [extra] : [];
	const parts = (record?.parts || []).filter(
		(p) =>
			isMap(p) &&
			(p.drawn
				? !!record.used?.[p.id]
				: !skipped.has(p.id) &&
				  !leftovers.has(p.id) &&
				  !isCovered(p, covers) &&
				  !isCovered(p, extraCovers))
	);
	return readingOrder(extra ? [...parts, extra] : parts);
}

/** True when the boxed part comes right after the part `fromId` in reading order. */
function comesNext(record, fromId, boxed) {
	let target = null;
	let extra = null;
	if (typeof boxed === 'string') target = partOf(record, boxed);
	else if (isMap(boxed)) {
		target = typeof boxed.id === 'string' ? partOf(record, boxed.id) : null;
		if (!target) {
			const box = ['left', 'top', 'right', 'bottom'].map((key) => Number(boxed[key]));
			if (!box.every(Number.isFinite) || box[2] <= box[0] || box[3] <= box[1]) return false;
			const [left, top, right, bottom] = box;
			const found = record.parts.filter((p) => isMap(p) && !p.drawn);
			extra = { id: '\u0000boxed', left, top, right, bottom, drawn: true };
			extra.row = rowForBox(found, extra);
			target = extra;
		}
	}
	if (!target) return false;
	const order = readingList(record, extra);
	const from = order.findIndex((p) => p.id === fromId);
	return from >= 0 && order[from + 1]?.id === target.id;
}

function finiteOr(value, fallback) {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegative(value) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
