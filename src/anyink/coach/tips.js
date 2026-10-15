// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: tips (UX-BEGINNER.md 4.0 "Tips"). A first-use tip is a quiet "Tip:" in the Next line, never
	a floating callout (B6 + B7 fix pass: beside the sentence, in the same row; it was a line of
	its own under it). At most 3 tips in a session, never one that repeats the sentence, and each
	one goes after his next action. Seen tips are kept in prefs (tipsSeen), so a tip shows once,
	ever; Menu > Help > "Show tips again" resets them. There is no tour.

	Each tip names its words key and the feature flag that ships it (principle 8). The tips of
	the drawing tools show when the tool is picked (TOOL_TIPS, by the tool's internal name);
	others are shown by the code that owns the moment (B9's Use it: show('photoStays')).

	  TIPS                       { name: { key, feature } }
	  TOOL_TIPS                  { toolName: tipName }
	  MAX_TIPS_PER_SESSION       3
	  TIPS_PREF                  'tipsSeen' (app prefs, an array of tip names)
	  makeTips({ isOn, getSentence, defer, keeps })   the tip line's memory; keeps(name): true
	                  while the tip must outlast his presses (B6 + B7 finalize: the Point pen's,
	                  while its shape is still being drawn; its clicks are one action):
	    show(name)      true when the tip now shows (known, flag on, unseen, under 3 this
	                    session, a sentence on the line to sit beside, not a repeat of it); it
	                    is marked seen at once. B6 + B7 fix pass: with the line hidden ('x') or
	                    empty (a dialog's rule 1), getSentence gives '' (or null) and no tip
	                    shows, so none is used up unseen
	    current()       { name, key, text } or null
	    noteAction()    his next action: the tip goes (not the action that showed it, nor while
	                    keeps(name) says so)
	    clear()         the tip goes now (a new font, a page change)
	    reset()         "Show tips again": nothing seen, the session count back to 0
	    shownCount(), subscribe(fn) -> unsubscribe
	  repeatsSentence(tip, sentence)
*/
import { isFeatureOn } from '../mode/features.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { word } from '../words/words.js';

export const MAX_TIPS_PER_SESSION = 3;
export const TIPS_PREF = 'tipsSeen';

/** @type {Readonly<Object<String, Readonly<{key: String, feature: String}>>>} */
export const TIPS = Object.freeze({
	photoStays: Object.freeze({ key: 'coach.tip.photoStays', feature: 'photo' }),
	brush: Object.freeze({ key: 'coach.tip.brush', feature: 'brush' }),
	editPoints: Object.freeze({ key: 'coach.tip.editPoints', feature: 'coach' }),
	pointPen: Object.freeze({ key: 'coach.tip.pointPen', feature: 'coach' }),
	shapes: Object.freeze({ key: 'coach.tip.shapes', feature: 'letterView' }),
});

/** The drawing tools' tips (4.3 Tools), by the tool's internal name (D-001) */
export const TOOL_TIPS = Object.freeze({
	nib: 'brush',
	pathEdit: 'editPoints',
	newPath: 'pointPen',
	newRectangle: 'shapes',
	newOval: 'shapes',
});

/** @param {String} text @returns {String} letters and digits only, lower case */
const plain = (text) =>
	String(text ?? '')
		.toLowerCase()
		.replace(/[^\p{L}\p{Nd}]+/gu, ' ')
		.trim();

/**
 * @param {String} tip
 * @param {String} sentence
 * @returns {Boolean} true when one says the other (4.0: never a tip that repeats the sentence)
 */
export function repeatsSentence(tip, sentence) {
	const a = plain(tip);
	const b = plain(sentence);
	return !!a && !!b && (a.includes(b) || b.includes(a));
}

/** @returns {Array<String>} the tip names seen so far (a broken pref reads as none) */
function readSeen() {
	const seen = getPref(TIPS_PREF, []);
	return Array.isArray(seen) ? seen.filter((name) => typeof name === 'string') : [];
}

/**
 * @param {Object} [options]
 * @param {(flag: String) => Boolean} [options.isOn] - default: features.js
 * @param {() => String | null} [options.getSentence] - the Next line's sentence right now; ''
 *   or null while there is no line to show a tip on (hidden, or empty); default: none
 * @param {(fn: Function) => void} [options.defer] - runs fn after the action that showed a
 *   tip has finished (default: a 0 ms timer)
 * @param {(name: String) => Boolean} [options.keeps] - true while that tip stays through his
 *   presses (default: never)
 */
export function makeTips({
	isOn = isFeatureOn,
	getSentence = () => '',
	defer = (fn) => setTimeout(fn, 0),
	keeps = () => false,
} = {}) {
	let shown = 0;
	/** @type {{name: String, key: String, text: String} | null} */
	let tip = null;
	let fresh = false;
	const listeners = new Set();
	const notify = () => listeners.forEach((fn) => fn());

	return {
		show(name) {
			const spec = Object.hasOwn(TIPS, name) ? TIPS[name] : null;
			if (!spec || !isOn(spec.feature)) return false;
			if (shown >= MAX_TIPS_PER_SESSION) return false;
			const seen = readSeen();
			if (seen.includes(name)) return false;
			// a tip only shows beside a sentence: never while the line is hidden or empty
			const sentence = getSentence();
			if (typeof sentence !== 'string' || !sentence.trim()) return false;
			const text = word(spec.key);
			if (repeatsSentence(text, sentence)) return false;
			setPref(TIPS_PREF, [...seen, name]);
			shown++;
			tip = { name, key: spec.key, text };
			fresh = true;
			const mine = tip;
			defer(() => {
				if (tip === mine) fresh = false;
			});
			notify();
			return true;
		},
		current() {
			return tip ? { ...tip } : null;
		},
		noteAction() {
			if (!tip || fresh) return;
			if (keeps(tip.name)) return;
			tip = null;
			notify();
		},
		clear() {
			if (!tip) return;
			tip = null;
			notify();
		},
		reset() {
			setPref(TIPS_PREF, []);
			shown = 0;
			if (tip) {
				tip = null;
				notify();
			}
		},
		shownCount() {
			return shown;
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	};
}
