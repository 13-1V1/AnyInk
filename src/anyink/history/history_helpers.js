// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
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

// --------------------------------------------------------------
// B2: steps that only looked around, and where an item lives
// --------------------------------------------------------------

/**
 * History's saved marker for "the work file holds the state with nothing in the Undo list"
 * (history.js re-exports it; undo_cap.js moves the marker when steps drop off).
 */
export const SAVED_AT_EMPTY = 'empty';

/** Title of the second entry of a whole-project pair (upstream's marker) */
export const WHOLE_PROJECT_POST_TITLE = '_whole_project_change_post_state_';

const NAVIGATION_TITLE = /^Navigated to ./;
/** Title of the step the Delete buttons record for the item they open next (panels/actions.js) */
const AUTO_NAVIGATION_TITLE = /^Automatically navigated to ./;

/**
 * Upstream's navigators all record their step as "Navigated to <item name>" (overview.js,
 * navigator.js, card_glyph.js, kerning.js, events_keyboard.js, and B1's show_item.js).
 * @param {String} title
 * @returns {Boolean}
 */
export function isNavigationTitle(title) {
	return typeof title === 'string' && NAVIGATION_TITLE.test(title);
}

/**
 * The step upstream's Delete buttons record right after a deletion, for the item they open
 * next. It changes nothing: All tools' undo takes it and the deletion under it in one press.
 * @param {String} title
 * @returns {Boolean}
 */
export function isAutoNavigationTitle(title) {
	return typeof title === 'string' && AUTO_NAVIGATION_TITLE.test(title);
}

/**
 * A step that changed nothing anyone sees: a navigation step, the "Automatically navigated to"
 * step after a deletion, or the pre / post pair that records an empty letter being made on
 * demand (ProjectEditor.selectedGlyph in All tools).
 * @param {Object} entry - a queue entry
 * @returns {Boolean}
 */
export function isLookingAroundEntry(entry) {
	if (!entry || entry.settingsSave) return false;
	if (entry.creationOnly) return true;
	if (isNavigationEntry(entry)) return true;
	return !entry.wholeProjectSave && !entry.itemWasDeleted && isAutoNavigationTitle(entry.title);
}

/**
 * A "Navigated to" step (All tools records them; an older crash snapshot may say so only by
 * its title).
 * @param {Object} entry - a queue entry
 * @returns {Boolean}
 */
export function isNavigationEntry(entry) {
	if (!entry || entry.settingsSave || entry.wholeProjectSave || entry.itemWasDeleted) return false;
	return entry.navigation === true || isNavigationTitle(entry.title);
}

/** @returns {Boolean} true for the second entry of a whole-project pair */
export function isWholeProjectPost(entry) {
	return !!entry?.wholeProjectSave && entry.title === WHOLE_PROJECT_POST_TITLE;
}

/**
 * Index of the pre entry that a whole-project post entry closes: the next entry below it
 * that is not a settings entry, when that one is a whole-project pre.
 * @param {Array} queue - History.queue
 * @param {Number} postIndex
 * @returns {Number} index, or -1 (a lone entry)
 */
export function indexOfPairedPre(queue = [], postIndex = 0) {
	if (!isWholeProjectPost(queue[postIndex])) return -1;
	const index = indexOfNextItemEntry(queue, postIndex + 1);
	if (index < 0) return -1;
	const entry = queue[index];
	return entry.wholeProjectSave && !isWholeProjectPost(entry) ? index : -1;
}

/** The edit page each kind of item opens on */
const PAGE_BY_TYPE = {
	Glyph: 'Characters',
	Ligature: 'Ligatures',
	Component: 'Components',
	KernGroup: 'Kerning',
};

/**
 * @param {String} id - 'glyph-0x41', 'liga-f-f', 'comp-0', 'kern-0'
 * @returns {String | false} the page that edits it
 */
export function pageFromItemID(id) {
	return PAGE_BY_TYPE[objTypeFromID(id)] || false;
}

/**
 * @param {String} page - editor.nav.page
 * @returns {Boolean} true on a page that shows one item to edit (a letter view)
 */
export function isItemPage(page) {
	return Object.values(PAGE_BY_TYPE).includes(page);
}
