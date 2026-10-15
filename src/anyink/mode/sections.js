// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: one list filter for the screens that mix controls with headings and separators: the page
	chooser (pages under subtitles), the top bar menus (rows, headings, rules) and the settings
	tabs (rows under h2 / h3, <br> spacers). Pure; it never builds anything (UX-BEGINNER.md 6.3:
	filter where screens are drawn, so the caller passes what it would draw).

	An entry: { kind: 'item', id, value } | { kind: 'heading', level, value } | { kind: 'rule', value }
	  item      kept when shown(id)
	  heading   kept when a kept item follows it before the next heading of its level or higher
	            (a lower number: an h2 holds the h3 sections under it)
	  rule      a separator (an <hr>, a <br>): goes with the heading of the section it sits in,
	            and is dropped at either end and next to another rule
	When every item is kept the list comes back as it was, so All tools looks exactly as today.

	  keepShown(entries, shown)   the entries kept, in order
	  item(id, value), heading(value, level), rule(value)   entry makers
*/

/**
 * @param {String} id
 * @param {*} value
 * @returns {{kind: 'item', id: String, value: *}}
 */
export const item = (id, value) => ({ kind: 'item', id, value });

/**
 * @param {*} value
 * @param {Number} [level] - 1 is the highest (h1); default 2
 * @returns {{kind: 'heading', level: Number, value: *}}
 */
export const heading = (value, level = 2) => ({ kind: 'heading', level, value });

/**
 * @param {*} value
 * @returns {{kind: 'rule', value: *}}
 */
export const rule = (value) => ({ kind: 'rule', value });

/**
 * @param {Array<Object>} entries
 * @param {(id: String) => Boolean} shown
 * @returns {Array<Object>} the entries to draw
 */
export function keepShown(entries, shown) {
	const keptItems = new Set(entries.filter((e) => e.kind === 'item' && shown(e.id)));
	const itemCount = entries.filter((e) => e.kind === 'item').length;
	if (keptItems.size === itemCount) return [...entries];

	// a rule belongs to the section it sits in: it goes with that section's heading
	let sectionKept = true;
	const kept = entries.filter((entry, index) => {
		if (entry.kind === 'item') return keptItems.has(entry);
		if (entry.kind === 'heading') {
			sectionKept = headsSomething(entries, index, keptItems);
			return sectionKept;
		}
		return sectionKept;
	});
	return tidyRules(kept);
}

/**
 * @param {Array<Object>} entries
 * @param {Number} index - a heading's place
 * @param {Set<Object>} keptItems
 * @returns {Boolean} true when a kept item sits in its section
 */
function headsSomething(entries, index, keptItems) {
	const level = entries[index].level;
	for (let next = index + 1; next < entries.length; next++) {
		const entry = entries[next];
		if (entry.kind === 'heading' && entry.level <= level) return false;
		if (keptItems.has(entry)) return true;
	}
	return false;
}

/**
 * @param {Array<Object>} list
 * @returns {Array<Object>} without rules at either end or next to another rule
 */
function tidyRules(list) {
	const result = [];
	list.forEach((entry) => {
		if (entry.kind !== 'rule') return result.push(entry);
		if (!result.length || result.at(-1).kind === 'rule') return;
		result.push(entry);
	});
	while (result.length && result.at(-1).kind === 'rule') result.pop();
	return result;
}
