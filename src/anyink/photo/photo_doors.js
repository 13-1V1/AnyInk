// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: doors from the letter view to the photo screens, the way topbar/doors.js
	does it for the top bar. The empty-letter overlay (letter/empty_overlay.js) opens a photo
	screen with a window event that photo_app.js answers, so the letter view never imports the
	photo screens' hub (and, through it, the Next line's actions: an import loop the letter view
	must stay out of). The event is sent and answered in the same press, so a picker it opens keeps
	the click.

	  PHOTO_DOOR_EVENT             'anyink-photo-door', detail { door, char, itemId }
	  openPhotoDoor(door, detail)  door: 'samePhoto' (the dialog on the newest photo with parts
	                               not used yet, this letter known), 'pick' (the photo card's
	                               step A), 'how' (the How card); true when the event went out
	  samePhoto(editor)            the newest photo of the font with parts not used yet, whose
	                               image is here, or null (the overlay's [Use the same photo] and
	                               its thumbnail; photo_app.js answers the door with it). A photo
	                               he is not done with comes before one he is (B8 + B9 finalize:
	                               the overlay then keeps [Use the same photo] outlined)
*/
import { listPhotos, unusedParts } from './photo_registry.js';

export const PHOTO_DOOR_EVENT = 'anyink-photo-door';

/**
 * @param {'samePhoto' | 'pick' | 'how'} door
 * @param {{char?: String, itemId?: String}} [detail]
 * @returns {Boolean}
 */
export function openPhotoDoor(door, detail = {}) {
	if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') {
		return false;
	}
	globalThis.dispatchEvent(new CustomEvent(PHOTO_DOOR_EVENT, { detail: { ...detail, door } }));
	return true;
}

/**
 * @param {Object} editor
 * @returns {Object | null} its record
 */
export function samePhoto(editor) {
	if (!editor?.project) return null;
	const usable = listPhotos(editor.project, { limit: Infinity }).filter(
		(record) => unusedParts(record).length > 0 && editor.assets?.has?.(record.asset)
	);
	return usable.find((record) => !record.done) || usable[0] || null;
}
