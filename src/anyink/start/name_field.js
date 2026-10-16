// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16: the start screen's name field (UX-BEGINNER.md 4.1, acceptance T1). The field holds a
	suggested name ("My Font", "My Font 2"). A first-timer clicks in and types his own; without
	help that gives "My FontBrennan Hand". So the suggested name is picked whole on every click and
	focus while it is still the suggestion, and typing replaces it. A name he typed is never picked:
	a click there places the caret as usual.

	  wireNameField(input, { suggested })   suggested() -> the name the field suggests right now
	  focusNameField(input)                  gives the field the keyboard (the suggestion picked)
	                                         when nothing else has it; true when it did
*/

/**
 * @param {HTMLInputElement} input
 * @param {Object} options
 * @param {() => String} options.suggested - the suggested name right now
 * @returns {HTMLInputElement} the same field
 */
export function wireNameField(input, { suggested }) {
	const pickSuggestion = () => {
		if (input.value && input.value === suggested()) input.select();
	};
	input.addEventListener('focus', pickSuggestion);
	// A press on the suggestion: the browser would put the caret where the mouse landed, after
	// the click (the B16 verify run, on a field that already had the keyboard: "My FontBrennan
	// Hand"). So the press places no caret: the field takes the keyboard and the name is picked.
	input.addEventListener('mousedown', (event) => {
		if (event.button !== 0 || !input.value || input.value !== suggested()) return;
		event.preventDefault();
		if (input.ownerDocument.activeElement !== input) input.focus();
		input.select();
	});
	// a click's mouseup can drop the pick the focus made; picked again after it
	input.addEventListener('click', pickSuggestion);
	return input;
}

/**
 * @param {HTMLInputElement} input
 * @returns {Boolean} true when the field took the keyboard
 */
export function focusNameField(input) {
	if (!input?.isConnected) return false;
	const doc = input.ownerDocument;
	const active = doc.activeElement;
	if (active && active !== doc.body && active !== doc.documentElement && active !== input) {
		return false;
	}
	input.focus({ preventScroll: true });
	return doc.activeElement === input;
}
