// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: one toast voice (UX-BEGINNER.md 2.2 "Toasts, one voice", 4.0 Toasts, 2.4 G). Every toast
	goes through here, with a words.js key: ANY-INK code calls toast(key); upstream's showToast
	(controls/dialogs/dialogs.js) is routed into upstreamToast(message), which upstream_map.js
	turns into a key.

	All tools (More tools) shows each toast as it always has (toast_view.js showClassic): the
	message as it came, except a toast both modes share, which says the house words (2.2).
	Simple runs the one queue (queue.js): one toast at a time, bottom right above the strip, 6 s
	(hover pauses it), undo/redo over destructive over automatic over info, a toast with a
	button never replaced by an info toast, info toasts waiting their turn. In Simple an upstream
	message with no words key is not shown: it is recorded (droppedToasts) and written to a
	hidden element the banned-word scan's toast recorder reads, so the scripted Simple flows
	(words/tests/banned_words.test.js) fail on it.

	  toast(key, vars, options)    a toast in house words; never throws (a missing key warns)
	    options.kind     'undo' | 'destructive' | 'automatic' | 'info' (default)
	    options.action   { key | label, run } one outlined button ("Redo", "Save")
	    options.dismiss  { key | label, run } a plain second button after it ("Not now"); it
	                     closes the toast like the first (B12 + B13 integration)
	    options.group    toasts of one group replace each other instead of queueing (info
	                     toasts of different groups wait their turn, queue.js)
	    options.tone     'warning': the amber edge
	    options.ms       how long it shows (Simple default TOAST_MS; All tools default 3 s)
	    options.quotes   names of vars shown as quotes (.anyink-quote): file and folder names
	    options.allTools what All tools shows instead (HTML: its own words, where they differ
	                     from Simple's); false: nothing in All tools. key null: nothing in
	                     Simple (a toast only All tools shows, like "Saved Brennan Hand.gs2",
	                     which Simple's status pill says)
	    options.stillGood () => Boolean: an offer that acts on one font says whose it is; once it
	                     says no (another font opened), the offer goes at the next clear, never
	                     shows when its turn comes, and its button does nothing (B4 + B5
	                     finalize)
	  upstreamToast(message, { duration, fancy, context })   showToast's way in
	  dropStaleToasts()   the toast showing goes when it is over (stillGood says no), and the next
	                      one in line shows (B6 + B7 finalize: undo_toast.js, at every step)
	  clearToasts()       closeAllToasts (a click on the canvas, Esc, every page change): the
	                      toasts go, except, in Simple, an offer (an info toast with a button,
	                      "Couldn't save a backup copy [Save]"), which stays showing or waiting
	                      until it is pressed or its time is up (queue.js)
	  toastLog()          the last LOG_SIZE toasts asked for, newest last:
	                      { source: 'key' | 'upstream', mode, key, text, message, shown, reason,
	                        context }
	  droppedToasts()     Simple: upstream messages dropped for having no words key
	  wordParts(key, vars, quotes)   the words in pieces, quotes marked (for the views)
	  resetToastsForTests()
	The same words again in one stream (queue.js: one group, like the font file's progress once
	per letter, or the same words with no group and no button) keep the toast showing and give it
	its time again, rather than drawing a new one each time; a toast with a button or a stillGood
	is drawn anew, so its button speaks for the newest press (B6 + B7 finalize).
*/
import './toast.css';
import { getMode } from '../mode/mode.js';
import { word } from '../words/words.js';
import { createQueue, isSameStream } from './queue.js';
import { hideSimple, renderSimple, showClassic, writeDropLog } from './toast_view.js';
import { mapUpstreamToast, toastText } from './upstream_map.js';

/** How long a Simple toast shows (4.0), in ms. */
export const TOAST_MS = 6000;
/** Upstream's default toast time, kept in All tools. */
const CLASSIC_MS = 3000;
/** Toasts remembered by toastLog(). */
const LOG_SIZE = 50;
/** Said before a dropped message in the hidden record: "upstream" is a banned word (2.3), so
 * the scan reports every dropped message. */
export const DROPPED_LABEL = 'Dropped an upstream message with no words key:';

/** A toast whose stillGood says no is over (B4 + B5 finalize). */
const isLive = (entry) => typeof entry?.stillGood !== 'function' || entry.stillGood() !== false;

let queue = createQueue({ isLive });
let log = [];
let dropped = [];

function remember(record) {
	log.push(record);
	if (log.length > LOG_SIZE) log = log.slice(-LOG_SIZE);
}

function escapeHTML(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** Stands in for a quoted value while the words are filled; never in words. */
const MARK = '\u0000';

/**
 * The words of a key in pieces, so file and folder names can show as quotes (.anyink-quote).
 * @param {String} key
 * @param {Object} vars
 * @param {Array<String>} [quotes] - names of vars shown as quotes
 * @returns {Array<{text: String, quote?: Boolean}>}
 */
export function wordParts(key, vars = {}, quotes = []) {
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
			index % 2 ? { text: values[Number(piece)], quote: true } : { text: piece }
		)
		.filter((part) => part.text !== '');
}

/**
 * @param {Array<{text: String, quote?: Boolean}>} parts
 * @returns {String} HTML: text escaped, quotes in .anyink-quote
 */
function partsHTML(parts) {
	return parts
		.map(({ text, quote }) =>
			quote ? `<span class="anyink-quote">${escapeHTML(text)}</span>` : escapeHTML(text)
		)
		.join('');
}

/**
 * @param {Object} [action] - { key | label, run }
 * @param {Function} [stillGood] - () => Boolean; the button does nothing once it says no
 * @returns {{label: String, run: Function} | null}
 */
function buttonFor(action, stillGood) {
	if (!action) return null;
	const label = action.label ?? (action.key ? word(action.key) : '');
	if (!label) throw new Error('toast: a button needs a key or a label');
	if (typeof stillGood !== 'function') return { label, run: action.run };
	return {
		label,
		run: (...args) => {
			if (stillGood() === false) return undefined;
			return action.run?.(...args);
		},
	};
}

// --------------------------------------------------------------
// Simple: the queue on the page
// --------------------------------------------------------------

function onDone(entry) {
	hideSimple(entry);
	const { show } = queue.done(entry);
	if (show) draw(show);
}

function draw(entry) {
	renderSimple(entry, { onDone });
}

/**
 * @param {Object} entry - { parts | html, text, kind, group, tone, ms, action }
 */
function enqueue(entry) {
	// A toast someone else took off the page is over; the next in line takes its place
	const showing = queue.current;
	if (showing?.element && !showing.element.isConnected) {
		hideSimple(showing);
		const { show: next } = queue.done(showing);
		if (next) draw(next);
	}
	// The same words again in one stream (the font file's progress, once per letter; "That
	// shape was too small" twice): the toast showing stays and gets its time again, instead of
	// a new toast each time
	// B6 + B7 finalize: not for a toast with a button or a stillGood: the newer press's button
	// and its stillGood speak for the newest change (two Undo presses that read the same, "Undid:
	// added a rectangle", each take back another step), so the new toast is drawn in its place
	const current = queue.current;
	const ownsButton = !!entry.action || !!entry.dismiss || typeof entry.stillGood === 'function';
	if (current && !ownsButton && isSameStream(current, entry) && current.text === entry.text) {
		if (current.html === entry.html && current.refresh) {
			current.refresh(entry.ms);
			return;
		}
	}
	const { show, hide, dropped: gone } = queue.add(entry);
	gone.forEach(hideSimple);
	if (hide) hideSimple(hide);
	if (show) draw(show);
}

// --------------------------------------------------------------
// The two ways in
// --------------------------------------------------------------

/**
 * A toast in house words.
 * @param {String | null} key - a words.js key ('toast.merged'); null: All tools only
 * @param {Object} [vars] - the key's {placeholders}
 * @param {Object} [options] - kind, action, group, tone, ms, allTools (see the top)
 */
export function toast(key, vars = {}, options = {}) {
	const mode = getMode();
	const { kind = 'info', group = '', tone = '', ms, allTools, quotes = [], stillGood } = options;
	const record = { source: 'key', mode, key, text: '', message: '', shown: false, reason: '' };
	try {
		const parts = key ? wordParts(key, vars || {}, quotes) : [];
		const text = key ? word(key, vars || {}) : '';
		const action = buttonFor(options.action, stillGood);
		const dismiss = buttonFor(options.dismiss, stillGood);
		record.text = text;
		if (mode === 'simple') {
			if (!key) {
				record.reason = 'all-tools only';
			} else {
				enqueue({
					parts,
					text,
					kind,
					group,
					tone,
					action,
					dismiss,
					stillGood,
					ms: ms ?? TOAST_MS,
				});
				Object.assign(record, { shown: true, reason: 'key' });
			}
		} else if (allTools === false || (!key && typeof allTools !== 'string')) {
			record.reason = 'simple only';
		} else {
			const html = typeof allTools === 'string' ? allTools : partsHTML(parts);
			showClassic(html, { duration: ms ?? CLASSIC_MS, action, dismiss });
			Object.assign(record, {
				shown: true,
				message: typeof allTools === 'string' ? allTools : '',
				reason: typeof allTools === 'string' ? 'all-tools' : 'shared',
			});
		}
	} catch (error) {
		console.warn('ANY-INK toast: not shown', key, error);
		record.reason = 'error';
	}
	remember(record);
}

/**
 * Upstream's showToast, routed here (controls/dialogs/dialogs.js).
 * @param {String} message - HTML, as upstream writes it
 * @param {{duration?: Number, fancy?: Boolean, context?: Object}} [options]
 *   context: what the caller knows for the words (history.js: { chars } of the letter)
 */
export function upstreamToast(
	message,
	{ duration = CLASSIC_MS, fancy = false, context = null } = {}
) {
	const mode = getMode();
	const record = {
		source: 'upstream',
		mode,
		key: null,
		text: '',
		message,
		shown: false,
		reason: '',
	};
	if (context) record.context = context;
	try {
		const decision = mapUpstreamToast(message, { mode, context });
		Object.assign(record, {
			key: decision.key,
			reason: decision.reason,
			text: decision.text ?? '',
		});
		const parts = () => wordParts(decision.key, decision.vars, decision.quotes);
		if (mode !== 'simple') {
			const html = decision.text === undefined ? decision.html : partsHTML(parts());
			showClassic(html, { duration, fancy });
			record.shown = true;
		} else if (decision.show) {
			const ms = Math.max(TOAST_MS, Number(duration) || 0);
			const words =
				decision.text === undefined
					? { html: decision.html, text: toastText(decision.html) }
					: { parts: parts(), text: decision.text };
			enqueue({ ...words, kind: decision.kind, group: decision.group, ms });
			record.shown = true;
		} else if (decision.reason === 'unmapped') {
			const text = toastText(message);
			dropped.push(text);
			writeDropLog(`${DROPPED_LABEL} "${text}"`);
		}
	} catch (error) {
		console.warn('ANY-INK toast: not shown', message, error);
		record.reason = 'error';
	}
	remember(record);
}

/**
 * closeAllToasts: the toasts go. In Simple an offer (an info toast with a button) stays,
 * showing or waiting: its button is good until it is pressed or its time is up, and a click
 * on the canvas, Esc or a page change must not take it (queue.js).
 * @param {{all?: Boolean}} [options] - all: offers go too (tests, the queue's reset)
 */
export function clearToasts({ all = false } = {}) {
	const keepOffers = !all && getMode() === 'simple';
	const { hide, show, dropped: gone } = queue.clear({ keepOffers });
	gone.forEach(hideSimple);
	if (hide) hideSimple(hide);
	if (show) draw(show);
}

/**
 * B6 + B7 finalize: the toast showing goes now when it is over (its stillGood says no: a new
 * change left an undo toast's [Redo] with nothing to do, or another font opened), and the next
 * toast in line that is still good shows. history/undo_toast.js calls it at every step (the
 * save status event), so a dead button never stays on screen for the rest of its 6 s.
 */
export function dropStaleToasts() {
	const { hide, show } = queue.sweep();
	if (hide) hideSimple(hide);
	if (show) draw(show);
}

// --------------------------------------------------------------
// For tests and the test page
// --------------------------------------------------------------

/** @returns {Array<Object>} the last toasts asked for, newest last */
export function toastLog() {
	return log.map((record) => ({ ...record }));
}

/** @returns {Array<String>} the upstream messages Simple dropped, as text */
export function droppedToasts() {
	return [...dropped];
}

/** Forgets the line, the log and the dropped messages, and stops their timers. */
export function resetToastsForTests() {
	clearToasts({ all: true });
	queue = createQueue({ isLive });
	log = [];
	dropped = [];
}
