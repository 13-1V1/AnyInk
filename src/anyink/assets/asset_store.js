// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK AssetStore (Milestone 6, D-011 / D-012 / D-023).
	Owner: ASSETS track.

	What it holds: binary images (trace images, later sheet scans) as Blobs, each
	under an id 'img-<8 random a-z0-9>'. A glyph points at an asset by id
	(glyph.anyink.trace.asset); the bytes live here.

	Where it lives, and why NOT inside the project or any history snapshot:
	  - It is editor.assets, built in the ProjectEditor constructor. It is not a
	    field of GlyphrStudioProject and not a member of any Glyph.
	  - History.addState() snapshots the whole project with project.save(), and
	    upstream persists that undo queue to IndexedDB by project id. A 2 MB photo
	    inside the project would be copied on every edit and written to IndexedDB
	    dozens of times a minute: the documented upstream failure (quota blown,
	    tab frozen) that D-012 exists to prevent. Kept beside the project, undo and
	    redo only ever carry the id string.
	  - The same reason keeps assets out of Glyph.save(): the .gs2 gets them once,
	    at save time, under one top-level 'assets' object (toSaveObject), never per
	    glyph and never per history entry.

	Formats: PNG, JPEG, WebP only (D-023: Chrome cannot decode HEIC, and a clear
	message beats a silent failure). add() throws a TypeError for anything else.

	Two serializations:
	  - toSaveObject / loadSaveObject: base64 text for the .gs2 file (Files track
	    calls these when writing and reading a project).
	  - toBlobMap / loadBlobMap: raw Blobs, structured-cloneable, for crash
	    snapshots in IndexedDB (Recovery track). No encoding cost.
	Both loads are lenient: an entry that cannot be decoded is skipped and listed
	in the returned array, so one bad image never stops a font from opening.
	Nothing here throws at import time; everything works in jsdom (unit tests).
*/

import { base64ToBlob, blobToBase64 } from './base64.js';

const ID_PREFIX = 'img-';
const ID_LENGTH = 8;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** MIME types the store accepts (after normalizeType). */
export const IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);

/** @returns {String} 'img-' followed by 8 random [a-z0-9] characters */
export function makeAssetID() {
	let out = ID_PREFIX;
	const rand = globalThis.crypto?.getRandomValues
		? globalThis.crypto.getRandomValues(new Uint8Array(ID_LENGTH))
		: Array.from({ length: ID_LENGTH }, () => Math.floor(Math.random() * 256));
	for (const byte of rand) out += ID_ALPHABET[byte % ID_ALPHABET.length];
	return out;
}

/**
 * Trims parameters and case from a MIME type and folds the common JPEG aliases.
 * 'image/JPG; q=1' -> 'image/jpeg'. Unknown types come back lowercased.
 * @param {String} type
 * @returns {String}
 */
export function normalizeType(type) {
	const mime = String(type || '')
		.split(';')[0]
		.trim()
		.toLowerCase();
	if (mime === 'image/jpg' || mime === 'image/pjpeg') return 'image/jpeg';
	return mime;
}

/** @param {String} type @returns {Boolean} true for PNG, JPEG, and WebP */
export function isImageType(type) {
	return IMAGE_TYPES.includes(normalizeType(type));
}

/**
 * Total bytes held by a store (sum of every Blob's size).
 * @param {AssetStore} store
 * @returns {Number}
 */
export function assetsSizeBytes(store) {
	let total = 0;
	if (!store) return total;
	for (const id of store.ids()) total += store.get(id).blob.size;
	return total;
}

function isBlobLike(value) {
	return (
		!!value &&
		typeof value === 'object' &&
		typeof value.size === 'number' &&
		typeof value.slice === 'function'
	);
}

/** Throws a plain TypeError unless the type is one we can decode. Returns the normalized type. */
function checkType(type) {
	const mime = normalizeType(type);
	if (!IMAGE_TYPES.includes(mime)) {
		const what = mime ? `this file is "${mime}"` : 'this file has no type';
		throw new TypeError(`Only PNG, JPEG, or WebP images can be added (${what}).`);
	}
	return mime;
}

/** Validates a Blob and its type; returns the { type, blob } part of an item. */
function checkedItem(blob, type) {
	if (!isBlobLike(blob)) throw new TypeError('Only image files can be added; this is not a file.');
	return { type: checkType(type || blob.type), blob };
}

export class AssetStore {
	constructor() {
		/** @type {Map<String, {id: String, type: String, blob: Blob}>} */
		this.items = new Map();
	}

	/**
	 * Adds an image Blob. Re-using an existing id replaces that asset.
	 * @param {Blob} blob - PNG, JPEG, or WebP
	 * @param {Object} [options]
	 * @param {String} [options.id] - keep a known id (loading a file); default: a new id
	 * @param {String} [options.type] - MIME type when blob.type is empty or wrong; default: blob.type
	 * @returns {String} the asset id
	 * @throws {TypeError} when blob is not a Blob or not a PNG / JPEG / WebP
	 */
	add(blob, { id, type } = {}) {
		const item = checkedItem(blob, type);
		const assetID = id || this.newID();
		this.items.set(assetID, { id: assetID, ...item });
		return assetID;
	}

	/** @returns {String} a fresh id that is not already in the store */
	newID() {
		let id = makeAssetID();
		while (this.items.has(id)) id = makeAssetID();
		return id;
	}

	/** @param {String} id @returns {{id: String, type: String, blob: Blob} | undefined} */
	get(id) {
		return this.items.get(id);
	}

	/** @param {String} id @returns {Boolean} */
	has(id) {
		return this.items.has(id);
	}

	/** @param {String} id @returns {Boolean} true when something was removed */
	delete(id) {
		return this.items.delete(id);
	}

	/**
	 * Milestone 7: the id that holds this exact Blob object, so an image copied in from
	 * another open project (src/anyink/trace/trace_carry.js) is stored once.
	 * @param {Blob} blob
	 * @returns {String} the id, or '' when no entry holds this Blob
	 */
	idOf(blob) {
		if (!blob) return '';
		for (const [id, item] of this.items) if (item.blob === blob) return id;
		return '';
	}

	/** @returns {String[]} every asset id, insertion order */
	ids() {
		return [...this.items.keys()];
	}

	/** Removes every asset (new project, project closed). */
	clear() {
		this.items.clear();
	}

	/**
	 * Serializes for the .gs2 file: { [id]: { type, data } } with base64 data.
	 * An empty store gives {}.
	 * Milestone 7: `ids` limits the output to those assets (the ones some trace still
	 * uses), in store order; ids the store does not hold are ignored. No argument, or
	 * ids left out, writes every asset (unchanged). Crash snapshots use toBlobMap, which
	 * always keeps every asset because undo may bring a removed trace back.
	 * @param {Object} [options]
	 * @param {Iterable<String>} [options.ids] - a Set or Array of asset ids to write
	 * @returns {Promise<Object>}
	 */
	async toSaveObject({ ids } = {}) {
		const keep = ids === undefined || ids === null ? null : new Set(ids);
		const out = {};
		for (const [id, item] of this.items) {
			if (keep && !keep.has(id)) continue;
			out[id] = { type: item.type, data: await blobToBase64(item.blob) };
		}
		return out;
	}

	/**
	 * Loads the .gs2 'assets' object written by toSaveObject, replacing the store's
	 * content. A missing or empty object empties the store. Entries that cannot be
	 * decoded (no data, unsupported type, broken base64) are skipped, not fatal.
	 * @param {Object} obj - { [id]: { type, data } }
	 * @returns {Promise<Array<{id: String, reason: String}>>} the skipped entries, [] when all loaded
	 */
	async loadSaveObject(obj) {
		const next = new Map();
		const skipped = [];
		for (const [id, entry] of Object.entries(obj || {})) {
			try {
				if (typeof entry?.data !== 'string') throw new TypeError('The image data is missing.');
				const type = checkType(entry.type);
				next.set(id, { id, type, blob: base64ToBlob(entry.data, type) });
			} catch (e) {
				skipped.push({ id, reason: e.message });
			}
		}
		this.items = next;
		return skipped;
	}

	/**
	 * Snapshot for crash recovery: Blobs, no encoding. Safe to structured-clone
	 * into IndexedDB.
	 * @returns {Object} { [id]: { type, blob } }
	 */
	toBlobMap() {
		const out = {};
		for (const [id, item] of this.items) out[id] = { type: item.type, blob: item.blob };
		return out;
	}

	/**
	 * Replaces the store's content from a toBlobMap() object. A missing map
	 * empties the store. Entries without a usable Blob or type are skipped.
	 * @param {Object} map - { [id]: { type, blob } }
	 * @returns {Array<{id: String, reason: String}>} the skipped entries, [] when all loaded
	 */
	loadBlobMap(map) {
		const next = new Map();
		const skipped = [];
		for (const [id, entry] of Object.entries(map || {})) {
			try {
				next.set(id, { id, ...checkedItem(entry?.blob, entry?.type) });
			} catch (e) {
				skipped.push({ id, reason: e.message });
			}
		}
		this.items = next;
		return skipped;
	}
}
