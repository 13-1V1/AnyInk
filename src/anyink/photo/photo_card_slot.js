// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: where the app's one photo card is (photo_card.js makes it), read by the
	letter view without importing the card: the letter card puts its element in its Photo card
	section and hides its main buttons while it shows, and the empty-letter overlay steps aside.
	No imports, so the letter view's modules stay out of the card's import loop (the card tells
	the Next line through coach_state.js, which reaches the font check).

	  PHOTO_CARD_EVENT     'anyink-photo-card' on window (photo_card.js sends it)
	  setPhotoCardSlot(view | null)   photo_card.js: the card made or closed; view is
	                       { element, state() }
	  isPhotoCardOpen()    true while the card shows (step A or C)
	  photoCardElement()   its element, or null
	  photoCardState()     { step, char, status, green }, or null
*/

export const PHOTO_CARD_EVENT = 'anyink-photo-card';

/** @type {{element: HTMLElement, state: () => Object} | null} */
let slot = null;

/** @param {{element: HTMLElement, state: () => Object} | null} view */
export function setPhotoCardSlot(view) {
	slot = view && view.element ? view : null;
}

/** @returns {Boolean} */
export function isPhotoCardOpen() {
	return !!slot;
}

/** @returns {HTMLElement | null} */
export function photoCardElement() {
	return slot ? slot.element : null;
}

/** @returns {Object | null} */
export function photoCardState() {
	return slot ? slot.state() : null;
}
