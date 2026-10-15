// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 finalize (UX-BEGINNER.md principle 7, "Always a way home"): the Help and About pages
	Simple shows until B6's rail and B15's Help give them a top bar of their own get a [Back to my
	letters] button, so neither is a dead end even with the page chooser closed and nothing in
	the strip to double-click. It opens Simple's home (visibility.js simpleHome: the letter view
	until B10's board) and records no Undo step (looking around never is one, 7.3).
	B6 + B7 finalize: once the Simple top bar is on ('coach'), its rail "1 Letters" sits on the same
	page, so the button goes where the rail goes (topbar/letters_page.js goToLetters): two doors
	to "my letters" on one screen never lead to two places.

	  makeBackToLettersButton({ editor })   a green fancy-button, data-anyink-choice
	                                         "backToLetters"
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { escapeWordHTML } from '../words/word_html.js';
import { word } from '../words/words.js';
import { goToLetters } from '../topbar/letters_page.js';
import { isFeatureOn } from './features.js';
import { simpleHome } from './visibility.js';

/**
 * @param {{editor?: Object}} [options] - default: the current project editor (read on click)
 * @returns {HTMLElement}
 */
export function makeBackToLettersButton({ editor } = {}) {
	const button = makeElement({
		tag: 'fancy-button',
		className: 'anyink-back-to-letters',
		content: escapeWordHTML(word('mode.band.backToLetters')),
		attributes: { 'data-anyink-choice': 'backToLetters' },
	});
	button.addEventListener('click', () => {
		const target = editor || getCurrentProjectEditor();
		if (!target?.nav) return;
		if (isFeatureOn('coach')) {
			goToLetters(target);
			return;
		}
		target.nav.page = simpleHome();
		target.navigate();
	});
	return button;
}
