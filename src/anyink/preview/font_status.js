// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 items 6 and 7: the plain words the preview uses to say the font has a problem.
	- buildFailureText: the real-font preview couldn't build the font ("Can't show your font
	  yet: small a needs fixing."), said instead of quietly showing a system font.
	- firstCheckProblem: the one line taken from the font check's 'fontCheck' topic,
	  { problems: [{ itemId, problem, message }] }, whose message is already plain words, with
	  how many other letters, and gaps between letters, have problems too (moreText says it:
	  "2 more letters and 1 gap need fixing too."), so three broken letters never read as one.
	- hintFor: when [Fix it] can't fix it, one sentence saying what to do instead.
	The letter's name comes from item_label.js.
	B4: every word here is a words key (src/anyink/words, check.*), the same words B1 showed.
*/
import { PROBLEM } from '../fontcheck/validate.js';
import { word } from '../words/words.js';

export const SHOW_ME = word('check.showMe');
export const FIX_IT = word('check.fixIt');

/**
 * @param {{name: String, plural?: Boolean}|null} label - from itemLabel (item_label.js)
 * @returns {String} one sentence
 */
export function buildFailureText(label) {
	if (!label?.name) return word('check.cantShowUnknown');
	return word('check.cantShow', { list: label.name, count: label.plural ? 2 : 1 });
}

/**
 * @param {String|null|undefined} itemId
 * @returns {Boolean} true for a gap between two letters ('kern-0')
 */
export function isGapId(itemId) {
	return typeof itemId === 'string' && itemId.startsWith('kern-');
}

/**
 * The first problem in a 'fontCheck' payload that has words to show.
 * @param {{problems?: Array<{itemId?: String, problem?: String, message?: String}>}} payload
 * @returns {{itemId: String|null, problem: String|null, text: String, more: Number,
 *   moreGaps: Number}|null} more: how many other letters have a problem, moreGaps: how many
 *   other gaps (each counted once)
 */
export function firstCheckProblem(payload) {
	const problems = Array.isArray(payload?.problems) ? payload.problems : [];
	const shown = problems.filter((p) => typeof p?.message === 'string' && p.message.trim() !== '');
	const first = shown[0];
	if (!first) return null;
	const itemId = typeof first.itemId === 'string' ? first.itemId : null;
	const keyOf = (p) => (typeof p.itemId === 'string' ? p.itemId : p.message);
	const others = new Map();
	shown.forEach((p) => {
		if (keyOf(p) !== keyOf(first)) others.set(keyOf(p), isGapId(p.itemId));
	});
	const moreGaps = [...others.values()].filter(Boolean).length;
	return {
		itemId,
		problem: typeof first.problem === 'string' ? first.problem : null,
		text: first.message,
		more: others.size - moreGaps,
		moreGaps,
	};
}

/**
 * @param {Number} more - how many other letters have a problem
 * @param {Number} [moreGaps] - how many other gaps between letters have a problem
 * @param {Boolean} [firstIsGap] - the line itself names a gap, so "more" goes with the gaps
 * @returns {String} '' for none, '1 more letter needs fixing too.',
 *   '2 more letters and 1 gap need fixing too.'
 */
export function moreText(more, moreGaps = 0, firstIsGap = false) {
	const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0);
	const letters = count(more);
	const gaps = count(moreGaps);
	if (!letters && !gaps) return '';
	// "more" goes with the letters, or with the gaps when the line itself names a gap
	const parts = [];
	if (letters)
		parts.push(word(firstIsGap ? 'check.letters' : 'check.moreLetters', { count: letters }));
	if (gaps) parts.push(word(firstIsGap ? 'check.moreGaps' : 'check.gaps', { count: gaps }));
	const list =
		parts.length === 2 ? word('check.andList', { names: parts[0], last: parts[1] }) : parts[0];
	return word('check.needFixingToo', { list, count: letters + gaps });
}

const HINTS = {
	[PROBLEM.point]: 'check.hintPoint',
	[PROBLEM.kern]: 'check.hintGap',
	// Fix it removes stray shapes from the letter itself; these sit in a letter it is made from
	[PROBLEM.shape]: 'check.hintShape',
};

/**
 * What to do when [Fix it] can't fix the problem (fix_it.js canFixProblem).
 * @param {String|null} problem - the font check's problem kind (validate.js PROBLEM)
 * @param {Boolean} fixable - Fix it is offered
 * @returns {String} one sentence, or ''
 */
export function hintFor(problem, fixable) {
	if (fixable || typeof problem !== 'string') return '';
	return Object.hasOwn(HINTS, problem) ? word(HINTS[problem]) : '';
}
