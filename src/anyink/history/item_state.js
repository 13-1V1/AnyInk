// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B2: one item's state read from, or written into, a project without touching what the editor
	has selected. Simple undo changes letters that aren't open (simple_undo.js), and the undo cap
	writes dropped steps into History's undo floor (undo_cap.js).
	Every write builds a fresh item from save() data, so the project and the Undo list never
	share objects (the aliasing D-018 fixed for whole projects).
*/
import { Glyph } from '../../project_data/glyph.js';
import { KernGroup } from '../../project_data/kern_group.js';
import { collectionNameFromID, objTypeFromID } from './history_helpers.js';

/**
 * @param {Object} project - GlyphrStudioProject (or a plain project-shaped object)
 * @param {String} id - 'glyph-0x41', 'liga-f-f', 'comp-0', 'kern-0'
 * @returns {Object | null} the item, or null when the project has none with that id
 */
export function itemIn(project, id) {
	const collection = collectionNameFromID(id);
	return (collection && project?.[collection]?.[id]) || null;
}

/**
 * Writes an item's state into a project. No state means "it didn't exist": a letter keeps an
 * empty record (opening a letter makes one, and the font file leaves empty letters out), any
 * other item is removed.
 * @param {Object} project - GlyphrStudioProject (mutated)
 * @param {String} id
 * @param {Object | null} state - an item, or its save() data
 * @returns {Object | null} the item now in the project
 */
export function writeItemState(project, id, state) {
	const objType = objTypeFromID(id);
	const collection = collectionNameFromID(id);
	if (!objType || !project?.[collection]) return null;
	if (!state && objType !== 'Glyph') {
		removeItem(project, id);
		return null;
	}
	const data = state ? plainState(state) : {};
	const item = objType === 'KernGroup' ? new KernGroup(data) : new Glyph({ ...data, id, objType });
	if (project[collection][id] || typeof project.addItemByType !== 'function') {
		item.id = id;
		item.objType = objType;
		item.parent = project;
		project[collection][id] = item;
	} else {
		// New to this project: added the way the project adds any item (letter range counts)
		project.addItemByType(item, objType, id);
	}
	return item;
}

/**
 * @param {Object} project - GlyphrStudioProject (mutated)
 * @param {String} id
 * @returns {Boolean} true when there was one to remove
 */
export function removeItem(project, id) {
	const collection = collectionNameFromID(id);
	if (!collection || !project?.[collection]?.[id]) return false;
	delete project[collection][id];
	return true;
}

/**
 * @param {Object} state - an item or plain data
 * @returns {Object} plain data nobody else holds
 */
function plainState(state) {
	if (typeof state.save === 'function') return state.save();
	return structuredClone(state);
}
