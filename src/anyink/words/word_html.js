// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	A words key as HTML, for the places that take markup (the error box, upstream's innerHTML
	controls): the text escaped, and the values named in quotes (file and folder names, exact
	Windows labels) wrapped in .anyink-quote, the banned-word scan's one exemption for them (2.3).
	B4 + B5 fix pass.

	  wordHTML(key, vars, quotes)   'Couldn&#39;t save to <span class="anyink-quote">a.gs2</span>.'
	  escapeWordHTML(text)          the escaping on its own
*/
import { QUOTE_CLASS } from './banned.js';
import { word } from './words.js';

/** Stands in for a quoted value while the words are filled; never in words. */
const MARK = '\u0000';

/**
 * @param {String} key - a words key
 * @param {Object} [vars] - values for its placeholders
 * @param {Array<String>} [quotes] - names of vars shown as quotes
 * @returns {String} HTML
 */
export function wordHTML(key, vars = {}, quotes = []) {
	const filled = { ...vars };
	const values = [];
	quotes.forEach((name) => {
		if (vars[name] === undefined || vars[name] === null) return;
		filled[name] = `${MARK}${values.length}${MARK}`;
		values.push(String(vars[name]));
	});
	return word(key, filled)
		.split(new RegExp(`${MARK}(\\d+)${MARK}`))
		.map((piece, index) =>
			index % 2
				? `<span class="${QUOTE_CLASS}">${escapeWordHTML(values[Number(piece)])}</span>`
				: escapeWordHTML(piece)
		)
		.join('');
}

/**
 * @param {*} text
 * @returns {String} safe inside an element and inside a quoted attribute
 */
export function escapeWordHTML(text) {
	return String(text ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
