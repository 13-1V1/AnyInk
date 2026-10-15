// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: the settings rows each mode shows (UX-BEGINNER.md 6.2 "Settings": Simple keeps only font
	name, your name, copyright and Numbers & symbols; 6.3: filter where the rows are drawn). The
	ids are visibility.js's 'setting' area: 'tab.property' ('font.capHeight').

	A row maker asks settingShown first and draws nothing ([]) for a hidden row, so a hidden row
	is never built (no inputs, no subscriptions). pages/settings.js makeOneSettingsRow does this
	for every standard row; a tab's own rows (PANOSE, Forget backups, the letter sets) go through
	settingRow. Each tab then passes its list through settingsSections, which drops the h2 / h3
	headings and the <br> spacers left with no row under them. All tools gets its list back as it
	was.

	  settingShown(tab, property, { mode, isOn })   Boolean
	  settingRow(tab, property, make, options)      make() when shown, else []
	  settingsSections(list)                        the nodes to draw, flattened: a row is an
	                                                array of nodes, an h1-h6 is a heading, any
	                                                other single node a spacer
*/
import { heading, item, keepShown, rule } from './sections.js';
import { isShown } from './visibility.js';

/**
 * @param {String} tab - 'project', 'font', 'app'
 * @param {String} property
 * @param {Object} [options] - { mode, isOn }, as visibility.js isShown
 * @returns {Boolean}
 */
export function settingShown(tab, property, options = {}) {
	return isShown('setting', `${tab}.${property}`, options);
}

/**
 * @param {String} tab
 * @param {String} property
 * @param {() => Array<Node> | Node} make
 * @param {Object} [options] - { mode, isOn }
 * @returns {Array<Node> | Node} what make() drew, or [] for a row the mode hides
 */
export function settingRow(tab, property, make, options = {}) {
	return settingShown(tab, property, options) ? make() : [];
}

const HEADING = /^H([1-6])$/;

/**
 * @param {Array<Array<Node> | Node>} list - rows (arrays), headings and spacers, in order
 * @returns {Array<Node>}
 */
export function settingsSections(list) {
	const entries = list.map((value, index) => {
		if (Array.isArray(value)) return item(String(index), value);
		const level = HEADING.exec(value?.tagName || '');
		if (level) return heading(value, Number(level[1]));
		return rule(value);
	});
	const shown = (id) => entries[Number(id)].value.length > 0;
	return keepShown(entries, shown).flatMap((entry) => entry.value);
}
