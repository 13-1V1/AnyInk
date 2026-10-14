// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: one line that says, in plain words, what is wrong with the font, with a [Show me] button
	that opens the letter, a [Fix it] button when the problem has a safe fix (fix_it.js, the
	strip only), and how many more letters need fixing. Used by the preview strip (the font
	check's first problem) and by <font-preview> (the font couldn't be built). Styles:
	preview-notice.css (tokens only); both buttons are outlined, never the green one. The
	sentence shortens with "..." on a narrow sheet; the count and the buttons never do. Hidden
	until show() is called.
	makeNoticeStyle puts those styles in a shadow root as text: upstream's makeElement parses
	innerHTML as markup, which would turn a tag named in a CSS comment into a live element.
*/
import { FIX_IT, SHOW_ME } from './font_status.js';

/**
 * @param {Document} doc
 * @param {String} css - preview-notice.css
 * @returns {HTMLStyleElement}
 */
export function makeNoticeStyle(doc, css) {
	const style = doc.createElement('style');
	style.textContent = String(css ?? '');
	return style;
}

/**
 * @param {Object} o
 * @param {Function} o.onShowMe - (itemId) called when [Show me] is pressed
 * @param {Function} [o.onFixIt] - ({itemId, problem}) called when [Fix it] is pressed; without
 *   it the line never offers Fix it
 * @param {Document} [o.doc]
 * @returns {{element: HTMLElement, show: Function, hide: Function, visible: Boolean, itemId: String|null}}
 */
export function makeNoticeLine({ onShowMe, onFixIt, doc = document }) {
	const element = doc.createElement('div');
	element.className = 'anyink-notice';
	element.setAttribute('role', 'status');
	element.hidden = true;

	const text = doc.createElement('span');
	text.className = 'anyink-notice__text';
	element.appendChild(text);

	const more = doc.createElement('span');
	more.className = 'anyink-notice__more';
	more.hidden = true;
	element.appendChild(more);

	const makeButton = (label) => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'anyink-notice__button';
		button.textContent = label;
		element.appendChild(button);
		return button;
	};
	const button = makeButton(SHOW_ME);
	const fixButton = makeButton(FIX_IT);
	fixButton.hidden = true;

	let itemId = null;
	let problem = null;

	button.addEventListener('click', () => {
		if (itemId && typeof onShowMe === 'function') onShowMe(itemId);
	});
	fixButton.addEventListener('click', () => {
		if (itemId && typeof onFixIt === 'function') onFixIt({ itemId, problem });
	});
	// The line sits on the preview sheet: presses on it are not presses on the letters below.
	['click', 'dblclick', 'mousedown', 'pointerdown', 'mousemove'].forEach((type) =>
		element.addEventListener(type, (event) => event.stopPropagation())
	);

	return {
		element,
		/**
		 * @param {{text: String, itemId?: String|null, problem?: String|null, more?: String,
		 *   hint?: String, fixable?: Boolean}} notice - more: moreText(); hint: hintFor(), what
		 *   to do when there is no Fix it, said after the sentence; fixable: fix_it.js
		 *   canFixProblem()
		 */
		show(notice) {
			itemId = typeof notice?.itemId === 'string' ? notice.itemId : null;
			problem = typeof notice?.problem === 'string' ? notice.problem : null;
			text.textContent = [notice?.text, notice?.hint]
				.map((part) => String(part ?? '').trim())
				.filter(Boolean)
				.join(' ');
			more.textContent = String(notice?.more ?? '');
			more.hidden = !more.textContent;
			element.title = [text.textContent, more.textContent].filter(Boolean).join(' ');
			button.hidden = !itemId;
			fixButton.hidden = !(itemId && notice?.fixable && typeof onFixIt === 'function');
			element.hidden = false;
		},
		hide() {
			itemId = null;
			problem = null;
			element.hidden = true;
		},
		get visible() {
			return !element.hidden;
		},
		get itemId() {
			return itemId;
		},
	};
}
