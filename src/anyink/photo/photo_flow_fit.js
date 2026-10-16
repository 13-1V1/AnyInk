// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: which letters are still exactly as traced from their photo, and keeping the
	photo registry honest through Undo and Redo (docs/UX-BEGINNER.md 4.4 "One size for the whole
	photo", 7.3). No DOM, no history.

	item.anyink.photoFit (set by Use it, inside its Undo step, so Undo and Redo carry it):
	  { asset,   the photo's image id
	    part,    the part of it this letter holds (photo_registry.js part id)
	    ink }    a print of the letter's ink as Use it left it (inkPrint), '' when Use it added the
	             traced shapes to shapes he had (then the letter holds the part but was never
	             "as traced")
	4.4 says the flag is cleared by any change he makes to the letter. Rather than every tool
	clearing it, the print says it: a letter is as traced while its ink still prints the same
	(isAsTraced). The print is taken with the ink slid to its left edge, so automatic spacing (a
	refit, the letter-spacing slider), which only slides a letter sideways, never spoils it; a
	moved point, a new stroke or a deleted shape does. placement/photo_scale.js isUntouched reads
	only the flag; the photo flow hands followPlan only letters isAsTraced says yes to.

	Undo and Redo put letters back but not settings.anyink (an item step holds one letter), so
	after either the registry may say a letter uses a part it no longer shows (Undo of Use it), or
	not say it of a letter that shows it again (Redo). reconcilePhotoUses fixes both: it lets go of
	uses whose letter no longer shows the photo (photo_registry.js releaseStaleUses) and takes a
	part back for a letter whose photoFit names it while it shows that photo, unless another
	letter holds the part now.

	  inkPrint(shapes)                       a short string; equal for the same ink slid sideways
	  tracedCopies(shapes)                   whole-unit Path copies, exactly as Use it puts them in
	                                         (apply.js copies with save() and rounds, round.js)
	  setPhotoFit(item, { asset, part, shapes })   shapes: the ink as traced (null: holds only)
	  isAsTraced(item, asset)                true while the ink prints as Use it left it
	  photoHeld(item)                        { asset, part } while the letter shows that photo
	  reconcilePhotoUses(project, { skip })  { released, restored }; skip: a letter id to leave out
	                                         (the one the photo card is tracing now)
*/
import { Path } from '../../project_data/path.js';
import { roundItemPoints } from '../spacing/round.js';
import { getTrace } from '../trace/trace_model.js';
import { getPhoto, photosOf, releaseStaleUses, usePart } from './photo_registry.js';

/** Item collections a photo can be traced into. */
const COLLECTIONS = ['glyphs', 'ligatures'];

/**
 * @param {Array<Object>} shapes - Paths (anything else counts by its kind only)
 * @returns {String}
 */
export function inkPrint(shapes) {
	const list = Array.isArray(shapes) ? shapes : [];
	const points = [];
	let left = Infinity;
	for (const shape of list) {
		for (const pp of shape?.pathPoints || []) {
			const x = Number(pp?.p?.x);
			if (Number.isFinite(x) && x < left) left = x;
		}
	}
	if (!Number.isFinite(left)) left = 0;
	const at = (value) => Math.round((Number(value) || 0) * 100) / 100;
	for (const shape of list) {
		if (shape?.objType !== 'Path' || !Array.isArray(shape.pathPoints)) {
			points.push(`[${shape?.objType || '?'}]`);
			continue;
		}
		points.push('|');
		for (const pp of shape.pathPoints) {
			points.push(at(pp.p.x - left), at(pp.p.y));
			for (const handle of [pp.h1, pp.h2]) {
				if (handle?.use) points.push(at(handle.x - left), at(handle.y));
				else points.push('-');
			}
		}
	}
	return `ink:${list.length}:${fnv(points.join(','))}`;
}

/** Two FNV-1a passes over a string: 16 hex digits. */
function fnv(textToHash) {
	let a = 0x811c9dc5;
	let b = 0x9747b28c;
	for (let i = 0; i < textToHash.length; i++) {
		const c = textToHash.charCodeAt(i);
		a = Math.imul(a ^ c, 0x01000193) >>> 0;
		b =
			Math.imul(b ^ textToHash.charCodeAt(textToHash.length - 1 - i) ^ (i & 0xff), 0x01000193) >>>
			0;
	}
	return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/**
 * @param {Array<Object>} shapes - traced Paths
 * @returns {Array<Object>} new Paths, every point and handle in use on a whole unit
 */
export function tracedCopies(shapes) {
	const copies = (Array.isArray(shapes) ? shapes : [])
		.filter((shape) => shape?.objType === 'Path' && typeof shape.save === 'function')
		.map((shape) => new Path(shape.save()));
	roundItemPoints({ shapes: copies });
	return copies;
}

/**
 * @param {Object} item - Glyph
 * @param {{asset: String, part: String, shapes?: Array<Object> | null}} fit
 * @returns {Boolean}
 */
export function setPhotoFit(item, { asset, part, shapes = null } = {}) {
	if (!item || typeof asset !== 'string' || typeof part !== 'string') return false;
	if (!item.anyink || typeof item.anyink !== 'object') item.anyink = {};
	item.anyink.photoFit = { asset, part, ink: Array.isArray(shapes) ? inkPrint(shapes) : '' };
	return true;
}

/**
 * @param {Object} item - Glyph
 * @param {String} [asset] - the photo it must be traced from
 * @returns {Boolean}
 */
export function isAsTraced(item, asset) {
	const fit = item?.anyink?.photoFit;
	if (!fit || typeof fit !== 'object' || !fit.ink) return false;
	if (asset && fit.asset !== asset) return false;
	return fit.ink === inkPrint(item.shapes);
}

/**
 * @param {Object} item - Glyph
 * @returns {{asset: String, part: String} | null}
 */
export function photoHeld(item) {
	const fit = item?.anyink?.photoFit;
	if (!fit || typeof fit.asset !== 'string' || typeof fit.part !== 'string') return null;
	if (getTrace(item)?.asset !== fit.asset) return null;
	return { asset: fit.asset, part: fit.part };
}

/**
 * @param {Object} project
 * @param {{skip?: String}} [options]
 * @returns {{released: Number, restored: Number}}
 */
export function reconcilePhotoUses(project, { skip } = {}) {
	const out = { released: 0, restored: 0 };
	if (!photosOf(project)) return out;
	const lookup = (id) => {
		if (typeof project.getItem === 'function') return project.getItem(id) || null;
		for (const name of COLLECTIONS) if (project[name]?.[id]) return project[name][id];
		return null;
	};
	out.released = releaseStaleUses(project, (itemId, partId) => {
		if (itemId !== skip) {
			// B16: an empty letter holds no part, even while it shows the photo (an Undo of Use it
			// on an empty letter keeps the photo: T2), so the part is offered again
			const item = lookup(itemId);
			const empty = !item?.shapes?.length && !item?.components?.length;
			if (item && empty && photoHeld(item)?.part !== partId) return null;
			return item;
		}
		// The letter being traced keeps its uses as they are: answer with the photo they name
		const record = recordOfUse(project, itemId, partId);
		return record ? { anyink: { trace: { asset: record.asset } } } : lookup(itemId);
	});

	for (const name of COLLECTIONS) {
		for (const [id, item] of Object.entries(project[name] || {})) {
			if (id === skip) continue;
			const held = photoHeld(item);
			if (!held) continue;
			const record = getPhoto(project, held.asset);
			if (!record || !record.parts.some((part) => part.id === held.part)) continue;
			const use = record.used[held.part];
			if (use?.itemId === id) continue;
			if (use) continue; // another letter holds it now
			const char = String(item.chars || item.char || '');
			if (usePart(record, held.part, { char, itemId: id })) out.restored++;
		}
	}
	return out;
}

/** The record in which this letter uses this part, or null. */
function recordOfUse(project, itemId, partId) {
	const photos = photosOf(project) || {};
	for (const asset of Object.keys(photos)) {
		const record = getPhoto(project, asset);
		if (record?.used?.[partId]?.itemId === itemId) return record;
	}
	return null;
}
