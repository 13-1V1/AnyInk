// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
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

	S2 (docs/SKETCH.md section 2 Tips): the sketch tools' first-pick tips, shipped with the
	'sketch' flag (sketchLine, sketchArc, sketchSpline, sketchCircle, sketchRectangle, by the tool's
	internal name, and sketchDots, which S4's first pick on a sketch shows). A drawing tool's tip
	(whileDrawing) stays through his clicks while a sketch piece is open, as the Point pen's does
	(makeTips's drawing(): default, the Undo gate's isPieceOpen). The Line tip comes back when Arc
	is picked right after a Line end: show(name, { again: true }) for a tip made to (again), still
	inside the session's 3, never added to the seen list twice.
	S2 finalize: Arc after a Line end shows the Arc tip first while it is unseen (its end click
	waits for a bend click after a corner), then the Line tip again. The sketch tips have their
	own 3 a session, apart from the other tips' 3, so neither family starves the other.
	  toolTipFor(toolName, { afterLineEnd, seen })   { name, again } of the tip a pick shows, or
	                                                null
*/
import { isFeatureOn } from '../mode/features.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { isPieceOpen } from '../sketch/tools/undo_gate.js';
import { word } from '../words/words.js';

export const MAX_TIPS_PER_SESSION = 3;
export const TIPS_PREF = 'tipsSeen';

/**
 * whileDrawing: stays through his clicks while a sketch piece is open; again: may come back
 * (show(name, { again: true }))
 * @type {Readonly<Object<String, Readonly<{key: String, feature: String, whileDrawing?: Boolean,
 *   again?: Boolean}>>>}
 */
export const TIPS = Object.freeze({
	photoStays: Object.freeze({ key: 'coach.tip.photoStays', feature: 'photo' }),
	brush: Object.freeze({ key: 'coach.tip.brush', feature: 'brush' }),
	editPoints: Object.freeze({ key: 'coach.tip.editPoints', feature: 'coach' }),
	pointPen: Object.freeze({ key: 'coach.tip.pointPen', feature: 'coach' }),
	shapes: Object.freeze({ key: 'coach.tip.shapes', feature: 'letterView' }),
	// S2: the sketch tools
	sketchLine: Object.freeze({
		key: 'sketch.tip.line',
		feature: 'sketch',
		whileDrawing: true,
		again: true,
	}),
	sketchArc: Object.freeze({ key: 'sketch.tip.arc', feature: 'sketch', whileDrawing: true }),
	sketchSpline: Object.freeze({ key: 'sketch.tip.spline', feature: 'sketch', whileDrawing: true }),
	sketchCircle: Object.freeze({ key: 'sketch.tip.circle', feature: 'sketch', whileDrawing: true }),
	sketchRectangle: Object.freeze({
		key: 'sketch.tip.rectangle',
		feature: 'sketch',
		whileDrawing: true,
	}),
	sketchDots: Object.freeze({ key: 'sketch.tip.dots', feature: 'sketch' }),
});

/** The drawing tools' tips (4.3 Tools), by the tool's internal name (D-001) */
export const TOOL_TIPS = Object.freeze({
	nib: 'brush',
	pathEdit: 'editPoints',
	newPath: 'pointPen',
	newRectangle: 'shapes',
	newOval: 'shapes',
	sketchLine: 'sketchLine',
	sketchArc: 'sketchArc',
	sketchSpline: 'sketchSpline',
	sketchCircle: 'sketchCircle',
	sketchRectangle: 'sketchRectangle',
});

/**
 * The tip a tool's pick shows. Arc picked right after a Line end shows the Arc tip while it is
 * unseen, then the Line tip again (the pull-back, SKETCH.md section 2 Tips).
 * @param {String} toolName - the tool's internal name
 * @param {{afterLineEnd?: Boolean, seen?: Array<String>}} [options] - seen: the tips seen so far
 *   (default: prefs)
 * @returns {{name: String, again: Boolean} | null}
 */
export function toolTipFor(toolName, { afterLineEnd = false, seen = readSeen() } = {}) {
	if (!Object.hasOwn(TOOL_TIPS, toolName)) return null;
	// S2 finalize: Arc after a Line end is where the Arc's end click waits for its bend click, so
	// the Arc tip shows there first; once seen, the Line tip comes back
	if (toolName === 'sketchArc' && afterLineEnd) {
		if (!seen.includes('sketchArc')) return { name: 'sketchArc', again: false };
		return { name: 'sketchLine', again: true };
	}
	return { name: TOOL_TIPS[toolName], again: false };
}

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
 * @param {() => Boolean} [options.drawing] - a sketch piece is open: a drawing tool's tip stays
 *   (default: the Undo gate's isPieceOpen)
 */
export function makeTips({
	isOn = isFeatureOn,
	getSentence = () => '',
	defer = (fn) => setTimeout(fn, 0),
	keeps = () => false,
	drawing = isPieceOpen,
} = {}) {
	let shown = 0;
	// S2 finalize: the sketch tips have their own 3 a session (MAX_TIPS_PER_SESSION each)
	let sketchShown = 0;
	/** @type {{name: String, key: String, text: String} | null} */
	let tip = null;
	let fresh = false;
	const listeners = new Set();
	const notify = () => listeners.forEach((fn) => fn());

	return {
		show(name, { again = false } = {}) {
			const spec = Object.hasOwn(TIPS, name) ? TIPS[name] : null;
			if (!spec || !isOn(spec.feature)) return false;
			const isSketch = spec.feature === 'sketch';
			if ((isSketch ? sketchShown : shown) >= MAX_TIPS_PER_SESSION) return false;
			const seen = readSeen();
			const comesBack = again && spec.again === true;
			if (seen.includes(name) && !comesBack) return false;
			// a tip only shows beside a sentence: never while the line is hidden or empty
			const sentence = getSentence();
			if (typeof sentence !== 'string' || !sentence.trim()) return false;
			const text = word(spec.key);
			if (repeatsSentence(text, sentence)) return false;
			if (!seen.includes(name)) setPref(TIPS_PREF, [...seen, name]);
			if (isSketch) sketchShown++;
			else shown++;
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
			if (TIPS[tip.name]?.whileDrawing && drawing()) return;
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
			sketchShown = 0;
			if (tip) {
				tip = null;
				notify();
			}
		},
		shownCount() {
			return shown + sketchShown;
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	};
}
