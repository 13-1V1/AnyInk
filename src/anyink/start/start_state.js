// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: what the start screen shows (UX-BEGINNER.md 4.1), as pure functions. No DOM, no storage.

	  chooseCard({ recents, sessions })   which card sits on top: there is never a second card
	      { kind: 'crashWithFile', session }  a backup copy newer than its work file (a dirty
	                                          backup of a font that has a work file)
	      { kind: 'crashNoFile', session }    a backup copy of a font that has no work file
	      { kind: 'continue', recent }        the newest recent work file, no backup newer
	      { kind: 'none' }                    nothing to continue: Create is the one green
	      sessions are listRecoverableSessions()'s rows with card_facts.js's facts; the newest
	      one that counts decides. One that doesn't count (7.5: the card "appears only when one
	      is newer than its file"): a Replace it copy (replaced: the old file kept, not a crash;
	      it shows only in Other ways to start... > Recover), or one with a work file whose
	      fileTime (the work file's last open, save or change) is as new as it or newer
	  otherFonts(recents, card, max = 3)  the recent fonts under the card, newest first, leaving
	      out the one the Continue card already shows
	  defaultFontName(taken, words)        "My Font", or "My Font 2", "My Font 3"... when a recent
	      font (or a backup copy) already has that name; any case, spaces trimmed
	  whenParts(time, now, locale)         { key, vars } for a backup copy's day and time:
	      today / yesterday / a weekday (this week) / a date, each with "3:40 PM"
	  countLetters(content)                letters with ink in a work file's data: glyphs (and
	      ligatures) holding at least one shape; a file that can't be read counts 0
	  suggestedFileName(name)              '<name>.gs2' with what Windows forbids in a file name
	      replaced
*/

/**
 * @param {Object} lists
 * @param {Array<{handle: Object, name: String, time: Number}>} [lists.recents]
 * @param {Array<{id: String, name: String, time: Number, hasFile: Boolean, replaced?: Boolean,
 *   fileTime?: Number | null}>} [lists.sessions]
 * @returns {{kind: String, recent?: Object, session?: Object}}
 */
export function chooseCard({ recents = [], sessions = [] } = {}) {
	const newest = (sessions || [])
		.filter(isCrash)
		.sort((a, b) => (b?.time || 0) - (a?.time || 0))[0];
	if (newest) return { kind: newest.hasFile ? 'crashWithFile' : 'crashNoFile', session: newest };
	const recent = (recents || [])[0];
	if (recent) return { kind: 'continue', recent };
	return { kind: 'none' };
}

/**
 * @param {{time: Number, hasFile: Boolean, replaced?: Boolean, fileTime?: Number | null}} session
 * @returns {Boolean} true when this backup copy holds work its work file doesn't
 */
function isCrash(session) {
	if (!session || session.replaced) return false;
	if (!session.hasFile || typeof session.fileTime !== 'number') return true;
	return (session.time || 0) > session.fileTime;
}

/**
 * @param {Array<Object>} recents - newest first
 * @param {{kind: String, recent?: Object}} card - chooseCard's answer
 * @param {Number} [max]
 * @returns {Array<Object>}
 */
export function otherFonts(recents = [], card = { kind: 'none' }, max = 3) {
	return (recents || []).filter((entry) => entry !== card?.recent).slice(0, max);
}

/**
 * @param {Iterable<String>} taken - names already in use
 * @param {{base: String, numbered: (n: Number) => String}} words
 * @returns {String}
 */
export function defaultFontName(taken, { base, numbered }) {
	const used = new Set(
		[...(taken || [])].map((name) =>
			String(name || '')
				.trim()
				.toLowerCase()
		)
	);
	if (!used.has(base.toLowerCase())) return base;
	for (let number = 2; number < 10000; number++) {
		const name = numbered(number);
		if (!used.has(name.toLowerCase())) return name;
	}
	return base;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Number} time - epoch ms
 * @param {Number} [now] - epoch ms
 * @param {String} [locale]
 * @returns {{key: String, vars: Object}} a startScreen.when.* key and its vars
 */
export function whenParts(time, now = Date.now(), locale = 'en-US') {
	const then = new Date(time);
	const clock = then.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	const startOfThen = new Date(time);
	startOfThen.setHours(0, 0, 0, 0);
	const days = Math.round((startOfToday.getTime() - startOfThen.getTime()) / DAY_MS);
	if (days <= 0) return { key: 'startScreen.when.today', vars: { time: clock } };
	if (days === 1) return { key: 'startScreen.when.yesterday', vars: { time: clock } };
	const day =
		days < 7
			? then.toLocaleDateString(locale, { weekday: 'long' })
			: then.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
	return { key: 'startScreen.when.day', vars: { day, time: clock } };
}

/**
 * @param {Object} content - parsed work file data
 * @returns {Number}
 */
export function countLetters(content) {
	if (!content || typeof content !== 'object') return 0;
	let count = 0;
	['glyphs', 'ligatures'].forEach((group) => {
		const items = content[group];
		if (!items || typeof items !== 'object') return;
		Object.values(items).forEach((item) => {
			if (Array.isArray(item?.shapes) && item.shapes.length > 0) count++;
		});
	});
	return count;
}

/**
 * @param {String} name - the font name
 * @returns {String} '<name>.gs2'
 */
export function suggestedFileName(name) {
	const safe = String(name || '')
		.replace(/[<>:"/\\|?*]/g, '-')
		.replace(/\p{Cc}/gu, '-')
		.trim();
	return `${safe || 'My Font'}.gs2`;
}
