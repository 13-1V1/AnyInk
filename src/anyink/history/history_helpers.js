// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Small pure helpers for walking the undo queue now that it can hold three
	kinds of entry: single item, whole project, and settings (D-018).
**/

/**
 * Maps a project item id to the objType used by project.addItemByType.
 * @param {String} id - 'glyph-0x41', 'liga-f-f', 'comp-0', 'kern-0'
 * @returns {String | false}
 */
export function objTypeFromID(id) {
	if (typeof id !== 'string') return false;
	if (id.startsWith('glyph-')) return 'Glyph';
	if (id.startsWith('liga-')) return 'Ligature';
	if (id.startsWith('comp-')) return 'Component';
	if (id.startsWith('kern-')) return 'KernGroup';
	return false;
}

/**
 * Name of the project collection that holds an item id.
 * @param {String} id
 * @returns {String | false} 'glyphs' | 'ligatures' | 'components' | 'kerning'
 */
export function collectionNameFromID(id) {
	const objType = objTypeFromID(id);
	if (objType === 'Glyph') return 'glyphs';
	if (objType === 'Ligature') return 'ligatures';
	if (objType === 'Component') return 'components';
	if (objType === 'KernGroup') return 'kerning';
	return false;
}

/**
 * Index of the next entry (at or after fromIndex) that holds item or
 * whole-project state, skipping settings entries.
 * @param {Array} queue - History.queue
 * @param {Number} fromIndex
 * @returns {Number} index, or -1 when none is left
 */
export function indexOfNextItemEntry(queue = [], fromIndex = 1) {
	for (let i = fromIndex; i < queue.length; i++) {
		if (queue[i] && !queue[i].settingsSave) return i;
	}
	return -1;
}

/**
 * Index of the newest settings entry strictly between two queue positions.
 * Used after a whole-project restore to re-apply settings that were changed
 * after that project snapshot was taken.
 * @param {Array} queue
 * @param {Number} afterIndex - exclusive
 * @param {Number} beforeIndex - exclusive
 * @returns {Number} index, or -1
 */
export function indexOfSettingsEntryBetween(queue = [], afterIndex = 0, beforeIndex = 0) {
	for (let i = afterIndex + 1; i < beforeIndex && i < queue.length; i++) {
		if (queue[i]?.settingsSave) return i;
	}
	return -1;
}

/**
 * Upstream records a "Navigated to X" entry when the user moves between
 * items. Undo treats the top entry as one of those (and just navigates back
 * without undoing anything) when it and the next item entry belong to two
 * different, known items.
 * @param {Object} top - queue[0]
 * @param {Object} next - the next item entry below it
 * @returns {Boolean}
 */
export function isNavigationBetween(top, next) {
	if (!top || !next) return false;
	if (top.settingsSave || next.settingsSave) return false;
	if (!top.itemID || !next.itemID) return false;
	return top.itemID !== next.itemID;
}
