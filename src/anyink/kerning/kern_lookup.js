// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kern lookup (Milestone 5, D-010).
	One deterministic answer to "what is the kern between these two characters?".

	- buildKernLookup(project) walks every KernGroup once and returns a Map keyed
	  'leftHex|rightHex' (hex strings exactly as stored, e.g. '0x41|0x56') -> { value, groupID }.
	  Priority: a one-by-one group (one member on each side) beats a class group; among
	  groups of the same kind the lowest kern-N id wins. The renderer, the pair view, and the
	  preview strip all read through this map, so they can never disagree.
	- getKernLookup(project) caches the map on the project object under a non-enumerable
	  property (never saved, never cloned by history). The cache is dropped when
	  invalidateKernLookup() bumps the version, when the number of groups changes, or when
	  any group or member array was replaced (undo swaps in new KernGroup objects).
	- kernOffsetFor(project, c1, c2) is what text_block.js calculateKernOffset() uses.
	  It returns a number, 0 when there is no pair. The value is read live from the group so a
	  drag tick or a typed value shows up without an invalidation.
	- notifyKernPairsChanged(editor, detail) is the one call every kern edit makes:
	  invalidate, then publish the 'kernPairs' topic.

	Pure data in, pure data out; no DOM, no editor access except in notifyKernPairsChanged.
*/
import { parseCharsInputAsHex } from '../../common/character_ids.js';

const CACHE_KEY = '__anyinkKernLookup';
let version = 1;

/** Bump the cache version. Every cached lookup is rebuilt on its next use. */
export function invalidateKernLookup() {
	version++;
	return version;
}

/** @returns {Number} current cache version (tests and the 'kernPairs' payload use it) */
export function getKernLookupVersion() {
	return version;
}

/**
 * True when a group kerns exactly one glyph against exactly one glyph.
 * @param {Object} kernGroup - KernGroup
 * @returns {Boolean}
 */
export function isOneByOne(kernGroup) {
	return kernGroup?.leftGroup?.length === 1 && kernGroup?.rightGroup?.length === 1;
}

/**
 * Sort key for kern group ids: 'kern-7' < 'kern-12', non-standard ids sort last.
 * @param {String} id
 * @returns {Number}
 */
export function kernGroupSortKey(id) {
	const match = /^kern-(\d+)$/.exec(String(id));
	return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Kern group ids in deterministic priority order (lowest kern-N first).
 * @param {Object} kerning - project.kerning
 * @returns {Array<String>}
 */
export function sortedKernGroupIDs(kerning = {}) {
	return Object.keys(kerning).sort((a, b) => {
		const diff = kernGroupSortKey(a) - kernGroupSortKey(b);
		return diff !== 0 ? diff : a < b ? -1 : a > b ? 1 : 0;
	});
}

/**
 * Build the pair map for a project.
 * @param {Object} project - GlyphrStudioProject (anything with a .kerning collection)
 * @returns {Map<String, {value: Number, groupID: String}>}
 */
export function buildKernLookup(project) {
	const map = new Map();
	const kerning = project?.kerning || {};
	sortedKernGroupIDs(kerning).forEach((groupID) => {
		const group = kerning[groupID];
		if (!group) return;
		const exception = isOneByOne(group);
		group.leftGroup.forEach((left) => {
			group.rightGroup.forEach((right) => {
				const key = `${left}|${right}`;
				const existing = map.get(key);
				// First (lowest id) wins, unless an exception arrives to beat a class group
				if (existing && !(exception && !existing.exception)) return;
				map.set(key, { value: group.value, groupID, exception });
			});
		});
	});
	return map;
}

/**
 * Snapshot of the identities the cache depends on, so undo / redo (which swap in new
 * KernGroup objects) and member edits (which replace the member arrays) are noticed.
 * @param {Object} kerning
 * @returns {Array}
 */
function takeIdentities(kerning = {}) {
	const ids = Object.keys(kerning);
	const list = new Array(ids.length);
	for (let i = 0; i < ids.length; i++) {
		const group = kerning[ids[i]];
		list[i] = [ids[i], group, group?._leftGroup, group?._rightGroup];
	}
	return list;
}

function identitiesMatch(cached, kerning = {}) {
	const ids = Object.keys(kerning);
	if (ids.length !== cached.length) return false;
	for (let i = 0; i < ids.length; i++) {
		const entry = cached[i];
		const group = kerning[ids[i]];
		if (entry[0] !== ids[i] || entry[1] !== group) return false;
		if (entry[2] !== group?._leftGroup || entry[3] !== group?._rightGroup) return false;
	}
	return true;
}

/**
 * Cached pair map for a project.
 * @param {Object} project
 * @returns {Map<String, {value: Number, groupID: String}>}
 */
export function getKernLookup(project) {
	if (!project) return new Map();
	const cached = project[CACHE_KEY];
	if (cached && cached.version === version && identitiesMatch(cached.identities, project.kerning)) {
		return cached.map;
	}
	const entry = {
		version,
		identities: takeIdentities(project.kerning),
		map: buildKernLookup(project),
	};
	Object.defineProperty(project, CACHE_KEY, {
		value: entry,
		enumerable: false,
		configurable: true,
		writable: true,
	});
	return entry.map;
}

/**
 * Normalize a character, a hex id, or a Unicode id to the hex form stored in KernGroups.
 * A multi-character string (ligature text) becomes a joined key that matches nothing,
 * which is upstream's behavior too.
 * @param {String} input
 * @returns {String}
 */
export function toKernHex(input) {
	if (!input) return '';
	return parseCharsInputAsHex(String(input)).join('');
}

/**
 * Find the entry that applies to a pair.
 * @param {Object} project
 * @param {String} c1 - left character (char or hex)
 * @param {String} c2 - right character (char or hex)
 * @returns {{value: Number, groupID: String, exception: Boolean} | null}
 */
export function lookupKernPair(project, c1, c2) {
	if (!c1 || !c2 || !project) return null;
	const map = getKernLookup(project);
	if (map.size === 0) return null;
	const entry = map.get(`${toKernHex(c1)}|${toKernHex(c2)}`);
	return entry || null;
}

/**
 * Kern value for a pair, read live from the winning group.
 * @param {Object} project
 * @param {String} c1
 * @param {String} c2
 * @returns {Number} - em units, 0 when the pair is not kerned
 */
export function kernOffsetFor(project, c1, c2) {
	const entry = lookupKernPair(project, c1, c2);
	if (!entry) return 0;
	const group = project.kerning?.[entry.groupID];
	const value = group ? group.value : entry.value;
	return Number(value) || 0;
}

/**
 * Every kern edit funnels through here: drop the cache and tell subscribers.
 * @param {Object} editor - ProjectEditor (anything with .publish)
 * @param {Object} [detail] - { groupID, value, dragging } merged into the payload
 */
export function notifyKernPairsChanged(editor, detail = {}) {
	const v = invalidateKernLookup();
	if (editor && typeof editor.publish === 'function') {
		editor.publish('kernPairs', { version: v, dragging: false, ...detail });
	}
}
