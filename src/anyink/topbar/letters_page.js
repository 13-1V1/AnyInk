// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 fix: where the top bar's logo and its rail step "1 Letters" go (UX-BEGINNER.md 4.0 Top bar:
	"goes to the letters"), and the letter view's own "<- All letters" (letter/letter_header.js):
	one place for all three, whatever the flags say. It is the Overview page, which shows all his
	letters in every mode and with every flag (mode/visibility.js keeps it in Simple), where B10
	mounts the board. Never Simple home (visibility.js simpleHome), which is the letter view until
	B10: from the letter view that is the page he is already on, so the press did nothing, without
	a word (principles 6 and 7).
	Going there is looking around: one navigate, never an Undo step (7.3).

	  LETTERS_PAGE            'Overview': the page that shows all the letters
	  lettersPage()           the page the logo, "1 Letters" and "<- All letters" go to
	  goToLetters(editor)     goes there (nothing without an editor that can navigate)
*/

/** The page that shows all the letters; B10's board lives here. */
export const LETTERS_PAGE = 'Overview';

/**
 * @returns {String} a page name
 */
export function lettersPage() {
	return LETTERS_PAGE;
}

/**
 * @param {Object} editor - ProjectEditor (nav, navigate)
 */
export function goToLetters(editor) {
	if (!editor?.nav || typeof editor.navigate !== 'function') return;
	editor.nav.page = lettersPage();
	editor.navigate();
}
