// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the Next line's state (UX-BEGINNER.md 4.0 "Next line"). It lives here, not in the element,
	so a top bar rebuilt on every navigate draws the line again at once, with no flicker.

	What it follows:
	  - the editor, through makeEditorTracker: whichGlyphIsSelected, currentItem, traceLayer,
	    autoTrace, projectFile, kernPairs, fontMetrics, fontCheck (the spec's list), and
	    whichToolIsSelected for the drawing tools' tips; one subscriber id,
	    'anyink.coach.editor', on each topic;
	  - the window: the save status, page changes ('anyink-page-change'), the mode;
	  - his presses (pointerup, keydown) for the tip line, which goes after his next action.
	What it remembers this session, per font (never in the font):
	  - each letter's fingerprint when the last font file was made and when Try it was last
	    open, compared with the letters now whenever the save status counts a new change (every
	    Undo step, undo and redo included, D-018), so looking around is never a change and an
	    Undo back to how a letter was takes it off the list again; a gap fix or a moved guide
	    line puts the font file behind too, until it is undone (font_facts.js fontFingerprint);
	  - rule 15's Try-it letter turns: a Try-it letter the coach suggested loses its turn when he
	    opens or changes a letter other than it and the one he was on when it was suggested, or
	    presses Something else on it;
	  - Something else (skips.js); a skip ends once the state behind it changes (rules.js
	    liveSkips, pruned each time the line is worked out).
	  Per font: the memory follows the editor's History, which a font loaded into the same editor
	  (Ctrl+O, Menu > Open, a backup copy) replaces, as save_status.js does; that font starts
	  with fresh memory. The hidden line ("x") is for the session.
	What other screens tell it (each a later B; until then nothing is set):
	  setFact('dialog', name | null)          B9, B14, B15: an ANY-INK dialog is open (rule 1;
	                                          the screen is also read for one, dom_probe.js)
	  setFact('photoCard', { step, char } | null)   B9: step 'pick' (A) or 'result' (C)
	  setFact('tryItOpen', Boolean)           B12: Try it is open (rules 4, 5; opening it is
	                                          what rules 13 and 14 count)
	  setFact('otherPrimary', Boolean)        a green button the screen probe can't see
	  setSource('checks', (item, { char, editor }) => needsLook | null)   B11
	  setSource('photos', (editor) => [{ id, unused, done }])             B9
	  setSource('tryItText', (editor) => String)                         B12
	  note('fontFileMade')                    B14: a font file was made
	  note('tryItOpened')                     the same as opening Try it, for a one-shot
	  note('letterChanged', { char, ink })    a change on a font with no editor (test pages)
	  note('letterOpened', char)              the same, for opening a letter

	  COACH_TOPICS, COACH_SUBSCRIBER_ID, COACH_FACTS, COACH_SOURCES
	  makeEditorTracker(onTopic)   { sync(editor), detach(), current() }
	  makeCoach(options)           one coach: { start, stop, isStarted, editor, state, line,
	                               subscribe, refresh, flush, setFact, facts, setSource, note,
	                               skip, forgetLookSkips, hide, show, isHidden, tips }
	    options: getEditor, isOn, deriveState(editor, { isOn, sources, appLevel }), probe(),
	    schedule(fn), listen (window and document listeners; default true)
	  getCoach()                   the app's coach (made on first use, started by the element)
	  setCoachFact, setCoachSource, noteCoach, showTip, resetTips   the app coach's own
	  resetCoachForTests()
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { getSaveStatus, SAVE_STATUS_EVENT } from '../files/save_status.js';
import { FEATURE_NAMES, isFeatureOn } from '../mode/features.js';
import { isSimpleMode, MODE_EVENT } from '../mode/mode.js';
import { probeScreen } from './dom_probe.js';
import {
	charOfItem,
	deriveEditorState,
	fontFingerprint,
	hasInk,
	letterFingerprint,
	letterItem,
} from './font_facts.js';
import { lettersInSet } from './letter_order.js';
import { isOpeningBrush } from '../nib/default_tool.js';
import { openPathOf } from './open_shape.js';
import { liveSkips, pickLine } from './rules.js';
import { makeSkips } from './skips.js';
import { makeTips, TOOL_TIPS, toolTipFor } from './tips.js';

/** 4.0's list, then the tool topic the tips need */
export const COACH_TOPICS = Object.freeze([
	'whichGlyphIsSelected',
	'currentItem',
	'traceLayer',
	'autoTrace',
	'projectFile',
	'kernPairs',
	'fontMetrics',
	'fontCheck',
	'whichToolIsSelected',
]);

/** Never a substring of another subscriber id (upstream unsubscribes by substring, D-024) */
export const COACH_SUBSCRIBER_ID = 'anyink.coach.editor';

export const COACH_FACTS = Object.freeze(['dialog', 'photoCard', 'tryItOpen', 'otherPrimary']);
export const COACH_SOURCES = Object.freeze(['checks', 'photos', 'tryItText']);

const PAGE_EVENT = 'anyink-page-change';
/** Topics that change the font file without changing a letter */
const FONT_TOPICS = Object.freeze(['kernPairs', 'fontMetrics']);
/** Keys that are no action of their own */
const MODIFIER_KEYS = Object.freeze(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);
/** The memory of a coach with no editor (a test page's fake font) */
const NO_EDITOR = Object.freeze({});

/**
 * Keeps the coach subscribed to whichever editor is current.
 * @param {(topic: String, data: *) => void} onTopic
 * @returns {{sync: (editor: Object) => Boolean, detach: () => void, current: () => Object}}
 */
export function makeEditorTracker(onTopic) {
	let editor = null;
	const detach = () => {
		if (typeof editor?.unsubscribe === 'function') {
			editor.unsubscribe({ idToRemove: COACH_SUBSCRIBER_ID });
		}
		editor = null;
	};
	return {
		sync(next) {
			if (!next || next === editor || typeof next.subscribe !== 'function') return false;
			detach();
			editor = next;
			COACH_TOPICS.forEach((topic) =>
				editor.subscribe({
					topic,
					subscriberID: COACH_SUBSCRIBER_ID,
					callback: (data) => onTopic(topic, data),
				})
			);
			return true;
		},
		detach,
		current() {
			return editor;
		},
	};
}

/** @returns {Object | null} the app's current editor, or null before there is one */
function currentEditor() {
	try {
		return getCurrentProjectEditor() || null;
	} catch {
		return null;
	}
}

/** One frame from now; a timer where there are no frames */
function nextFrame(fn) {
	if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(fn);
	else setTimeout(fn, 16);
}

/**
 * @param {Object} options
 * @returns {Object} the coach
 */
export function makeCoach({
	getEditor = currentEditor,
	isOn = isFeatureOn,
	deriveState = deriveEditorState,
	probe = () => probeScreen(),
	schedule = nextFrame,
	listen = true,
} = {}) {
	/** @type {{dialog: *, photoCard: *, tryItOpen: *, otherPrimary: *}} */
	const facts = { dialog: null, photoCard: null, tryItOpen: undefined, otherPrimary: false };
	/** @type {Object<String, Function | null>} */
	const sources = { checks: null, photos: null, tryItText: null };
	const memories = new WeakMap();
	const listeners = new Set();
	let hidden = false;
	let started = false;
	let appLevel = false;
	let dirty = true;
	let cachedState = null;
	let cachedLine = null;
	let pendingNotify = 0;
	let notifyToken = 0;
	/** S2 integration: the tool picked before this one (Arc after the Line shows the Line tip) */
	let lastTool = null;

	const tracker = makeEditorTracker(onTopic);
	const tips = makeTips({
		isOn,
		getSentence: () => (hidden ? '' : lineNow().sentence),
		// B6 + B7 finalize: the Point pen's tip stays while its shape is being drawn
		keeps: (name) => name === 'pointPen' && !!openPathOf(getEditor()),
	});
	tips.subscribe(() => notifySoon());

	// --------------------------------------------------------------
	// Memory: what happened this session, per font
	// --------------------------------------------------------------

	/** @returns {Object} the memory of a font the coach sees for the first time */
	function freshMemory(editor) {
		const prints = fingerprints(editor);
		const font = fontPrintOf(editor);
		return {
			// the font's History: a font loaded into the same editor brings a new one
			history: editor?.history ?? null,
			revision: getSaveStatus(editor?.project ? editor : null).revision,
			pendingDiff: false,
			// each letter's fingerprint: now (as of the last counted change), at the last font
			// file, and when Try it was last open
			baseline: prints,
			atFontFile: prints,
			atTryIt: prints,
			sinceFontFile: new Set(),
			sinceTryIt: false,
			// the gap fixes and guide lines: now, and at the last font file (null: no font to read)
			fontNow: font,
			fontAtFile: font,
			fontStale: false,
			// what a font with no editor reports itself (note(): a test page's fake font)
			notedSinceFontFile: new Set(),
			notedSinceTryIt: false,
			otherChanged: false,
			// rule 15: the Try-it letter suggested and the letter open when it was
			turnsUsed: new Set(),
			pendingTurn: null,
			pendingTurnFrom: null,
			skips: makeSkips(),
		};
	}

	/**
	 * The memory of the font in this editor. B6 + B7 fix pass: per font, not per editor: a font
	 * loaded into this editor (Ctrl+O, Menu > Open: open_font.js loadInto) brings its own
	 * History, so it starts with none of the last font's skips, turns or changes.
	 */
	function memoryFor(editor) {
		const key = editor && typeof editor === 'object' ? editor : NO_EDITOR;
		let memory = memories.get(key);
		const loaded = !!memory && !!editor?.history && memory.history !== editor.history;
		if (!memory || loaded) {
			memory = freshMemory(editor);
			memories.set(key, memory);
			// a tip was about the last font
			if (loaded) tips.clear();
		}
		return memory;
	}

	/** @returns {Map<String, {print: Number, ink: Boolean}>} each letter of the set, now */
	function fingerprints(editor) {
		const project = editor?.project;
		const prints = new Map();
		if (!project?.settings) return prints;
		lettersInSet(project.settings.anyink?.letterSet).forEach((char) => {
			const item = letterItem(project, char);
			prints.set(char, { print: letterFingerprint(item), ink: hasInk(item) });
		});
		return prints;
	}

	/** @returns {Number | null} the gap fixes and guide lines now; null for no font */
	function fontPrintOf(editor) {
		return editor?.project ? fontFingerprint(editor.project) : null;
	}

	/**
	 * @param {Map} before
	 * @param {Map} after
	 * @returns {Set<String>} the letters whose fingerprint differs; a record that appeared or
	 *   changed with no ink either side (opening a letter, the letter set growing) is no change
	 */
	function changedBetween(before, after) {
		const changed = new Set();
		after.forEach((now, char) => {
			const then = before.get(char);
			if (then?.print === now.print) return;
			if (!then?.ink && !now.ink) return;
			changed.add(char);
		});
		return changed;
	}

	/** Follows the editor; its memory starts the first time it is seen, before any change. */
	function follow(editor) {
		tracker.sync(editor);
		if (editor) memoryFor(editor);
	}

	/**
	 * He opened or changed a letter: the Try-it letter suggested loses its one turn, unless it is
	 * that letter (he followed it) or the letter he was on when it was suggested (B6 + B7 fix
	 * pass: finishing that one, point by point or flip by flip, is not "something else").
	 */
	function useTurn(memory, char) {
		const pending = memory.pendingTurn;
		if (!pending || char === pending || char === memory.pendingTurnFrom) return;
		memory.turnsUsed.add(pending);
		memory.pendingTurn = null;
		memory.pendingTurnFrom = null;
	}

	function letterChanged(memory, char) {
		if (memory.pendingTurn === char) {
			// he followed the suggestion: it keeps its turn
			memory.pendingTurn = null;
			memory.pendingTurnFrom = null;
		} else useTurn(memory, char);
	}

	/** Since the font file and since Try it, from the fingerprints kept for each. */
	function measure(editor, memory) {
		memory.sinceFontFile = changedBetween(memory.atFontFile, memory.baseline);
		memory.sinceTryIt = changedBetween(memory.atTryIt, memory.baseline).size > 0;
		memory.fontNow = fontPrintOf(editor);
		memory.fontStale = false;
	}

	/** Compares every letter with its last fingerprint, once the save status counted a change. */
	function runDiff(editor, memory) {
		if (!memory.pendingDiff) return;
		memory.pendingDiff = false;
		const before = memory.baseline;
		memory.baseline = fingerprints(editor);
		changedBetween(before, memory.baseline).forEach((char) => letterChanged(memory, char));
		measure(editor, memory);
	}

	/** Try it shows the letters as they are now */
	function seeTryIt(memory) {
		memory.atTryIt = memory.baseline;
		memory.sinceTryIt = false;
		memory.notedSinceTryIt = false;
	}

	/** A font file holds the letters, gap fixes and guide lines as they are now */
	function madeFontFile(editor, memory) {
		memory.atFontFile = memory.baseline;
		memory.sinceFontFile = new Set();
		memory.fontNow = fontPrintOf(editor);
		memory.fontAtFile = memory.fontNow;
		memory.fontStale = false;
		memory.notedSinceFontFile.clear();
		memory.otherChanged = false;
	}

	/** @returns {Set<String>} the letters changed since the last font file */
	function lettersSinceFontFile(memory) {
		return new Set([...memory.sinceFontFile, ...memory.notedSinceFontFile]);
	}

	/** @returns {Boolean} a gap fix or a guide line differs from the last font file */
	function fontBehind(memory) {
		if (memory.otherChanged) return true;
		return memory.fontNow !== null && memory.fontNow !== memory.fontAtFile;
	}

	// --------------------------------------------------------------
	// Events
	// --------------------------------------------------------------

	function onTopic(topic, data) {
		const editor = tracker.current();
		const memory = memoryFor(editor);
		if (topic === 'whichGlyphIsSelected') {
			const char = charOfItem({ id: data });
			if (char) useTurn(memory, char);
		} else if (FONT_TOPICS.includes(topic)) {
			// read the gap fixes and guide lines again; a font with none to read just says so
			if (memory.fontNow === null) memory.otherChanged = true;
			else memory.fontStale = true;
		}
		markDirty();
		// after markDirty: a tool's tip is checked against the line as it is now, with the
		// tool's own sentence (rule 8)
		if (topic === 'whichToolIsSelected' && isSimpleMode() && Object.hasOwn(TOOL_TIPS, data)) {
			// B8 + B9 integration: the Brush an empty letter opens with is no pick of his; its tip
			// waits for the Brush he picks himself. S2 integration: Arc picked right after the
			// Line brings the Line tip back (the pull-back arc, SKETCH.md 2 Tips)
			const pick = toolTipFor(data, { afterLineEnd: lastTool === 'sketchLine' });
			if (pick && !(data === 'nib' && isOpeningBrush(getEditor()))) {
				tips.show(pick.name, { again: pick.again });
			}
		}
		if (topic === 'whichToolIsSelected' && data !== 'pan') lastTool = data;
	}

	function onSaveStatus(event) {
		const editor = getEditor();
		const changed = event?.detail?.editor;
		if (changed && changed !== editor) return;
		const memory = memoryFor(editor);
		const revision = getSaveStatus(editor).revision;
		if (revision !== memory.revision) {
			memory.revision = revision;
			memory.pendingDiff = true;
		}
		markDirty();
	}

	function onPageChange(event) {
		appLevel = !!event?.detail?.appLevel;
		follow(getEditor());
		markDirty();
	}

	function onPress(event) {
		if (event?.type === 'keydown' && MODIFIER_KEYS.includes(event.key)) return;
		tips.noteAction();
	}

	const onMode = () => markDirty();
	const windowEvents = [
		[SAVE_STATUS_EVENT, onSaveStatus],
		[PAGE_EVENT, onPageChange],
		[MODE_EVENT, onMode],
	];

	// --------------------------------------------------------------
	// The state and the line
	// --------------------------------------------------------------

	function flagObject() {
		return Object.fromEntries(FEATURE_NAMES.map((name) => [name, isOn(name) === true]));
	}

	function compute() {
		const editor = getEditor();
		if (started) follow(editor);
		const memory = memoryFor(editor);
		runDiff(editor, memory);
		if (memory.fontStale) memory.fontNow = fontPrintOf(editor);
		memory.fontStale = false;
		if (facts.tryItOpen) seeTryIt(memory);
		let base = {};
		try {
			base = deriveState(editor, { isOn, sources, appLevel }) || {};
		} catch (error) {
			console.warn('ANY-INK coach: could not read the font', error);
			base = { letters: [] };
		}
		let screen = { dialog: '', otherPrimary: false };
		try {
			screen = probe() || screen;
		} catch {
			// no screen to read (a worker, a test): nothing open
		}
		const changed = lettersSinceFontFile(memory);
		const state = {
			flags: flagObject(),
			changedSinceTryIt: memory.sinceTryIt || memory.notedSinceTryIt,
			fontFileBehind: changed.size > 0 || fontBehind(memory),
			lettersChangedSinceFontFile: changed.size,
			...base,
			dialog: facts.dialog || screen.dialog || base.dialog || null,
			photoCard: facts.photoCard ?? base.photoCard ?? null,
			tryItOpen: !!(facts.tryItOpen ?? base.tryItOpen),
			otherPrimary: !!(facts.otherPrimary || screen.otherPrimary || base.otherPrimary),
			turnsUsed: [...new Set([...(base.turnsUsed || []), ...memory.turnsUsed])],
		};
		// a skip lasts until the state behind it changes (4.0): end those whose state did
		if (state.page !== 'start') memory.skips.prune(liveSkips(state));
		state.skips = { ...(base.skips || {}), ...memory.skips.toObject() };
		const line = pickLine(state);
		// a Try-it letter's one turn starts when the line suggests it to him (not while hidden),
		// remembering the letter he was on then: changes to that one still use no turn
		if (!hidden && line.rule === 15 && line.fromTryIt && line.letter !== memory.pendingTurn) {
			memory.pendingTurn = line.letter;
			memory.pendingTurnFrom = state.page === 'letter' ? state.letter?.char ?? null : null;
		}
		cachedState = state;
		cachedLine = line;
		dirty = false;
	}

	function lineNow() {
		if (dirty || !cachedLine) compute();
		return cachedLine;
	}

	function stateNow() {
		if (dirty || !cachedState) compute();
		return cachedState;
	}

	// --------------------------------------------------------------
	// Telling the element
	// --------------------------------------------------------------

	function notifyNow() {
		pendingNotify = 0;
		notifyToken++;
		[...listeners].forEach((fn) => {
			try {
				fn();
			} catch (error) {
				console.warn('ANY-INK coach: a listener failed', error);
			}
		});
	}

	function notifySoon() {
		if (pendingNotify) return;
		pendingNotify = ++notifyToken;
		const mine = pendingNotify;
		schedule(() => {
			if (pendingNotify === mine) notifyNow();
		});
	}

	function markDirty() {
		dirty = true;
		notifySoon();
	}

	const coach = {
		start() {
			if (started) return coach;
			started = true;
			follow(getEditor());
			if (listen) {
				windowEvents.forEach(([name, fn]) => globalThis.addEventListener?.(name, fn));
				globalThis.document?.addEventListener('pointerup', onPress, true);
				globalThis.document?.addEventListener('keydown', onPress, true);
			}
			markDirty();
			return coach;
		},
		stop() {
			if (!started) return;
			started = false;
			tracker.detach();
			if (listen) {
				windowEvents.forEach(([name, fn]) => globalThis.removeEventListener?.(name, fn));
				globalThis.document?.removeEventListener('pointerup', onPress, true);
				globalThis.document?.removeEventListener('keydown', onPress, true);
			}
			pendingNotify = 0;
		},
		isStarted: () => started,
		/** @returns {Object | null} the editor the coach reads */
		editor: () => getEditor(),
		/** @returns {Object} the rules' state now */
		state: () => stateNow(),
		/** @returns {Object} the line now (rules.js pickLine) */
		line: () => lineNow(),
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		/** Something on screen may have changed (a card's green button came or went). */
		refresh: () => markDirty(),
		/** Tells the listeners now instead of at the next frame. */
		flush() {
			if (pendingNotify) notifyNow();
		},
		setFact(name, value) {
			if (!COACH_FACTS.includes(name)) throw new Error(`coach: "${name}" is not a fact`);
			if (name === 'tryItOpen' && value && !facts.tryItOpen) {
				const editor = getEditor();
				const memory = memoryFor(editor);
				runDiff(editor, memory);
				seeTryIt(memory);
			}
			facts[name] = value ?? (name === 'tryItOpen' ? undefined : null);
			markDirty();
		},
		facts: () => ({ ...facts }),
		setSource(name, fn) {
			if (!COACH_SOURCES.includes(name)) throw new Error(`coach: "${name}" is not a source`);
			sources[name] = typeof fn === 'function' ? fn : null;
			markDirty();
		},
		note(event, detail) {
			const editor = getEditor();
			const memory = memoryFor(editor);
			runDiff(editor, memory);
			if (event === 'fontFileMade') {
				madeFontFile(editor, memory);
			} else if (event === 'tryItOpened') {
				seeTryIt(memory);
			} else if (event === 'letterChanged') {
				if (detail?.char) {
					memory.notedSinceFontFile.add(detail.char);
					memory.notedSinceTryIt = true;
					letterChanged(memory, detail.char);
				}
			} else if (event === 'letterOpened') {
				if (typeof detail === 'string') useTurn(memory, detail);
			} else if (event === 'fontChanged') {
				memory.otherChanged = true;
			} else if (event === 'action') {
				tips.noteAction();
			}
			markDirty();
		},
		/** "Something else": skip the suggestion showing now. */
		skip() {
			const line = lineNow();
			if (!line.skipKey || !line.sentence) return false;
			const memory = memoryFor(getEditor());
			memory.skips.skip(line.skipKey, line.stamp);
			if (line.rule === 15 && line.fromTryIt && line.letter) {
				memory.turnsUsed.add(line.letter);
				memory.pendingTurn = null;
				memory.pendingTurnFrom = null;
			}
			dirty = true;
			notifyNow();
			return true;
		},
		/**
		 * B10 + B11 finalize: ends the "Something else" skips of a letter's look (rules 7 and 9:
		 * 'needsLook:<char>:<check>'), or of every letter and rule 9's count with no char. The
		 * board calls it when he opens an amber tile and on [Show me]: asking to see it again.
		 * @param {String} [char]
		 */
		forgetLookSkips(char) {
			const memory = memoryFor(getEditor());
			const prefix = typeof char === 'string' && char ? `needsLook:${char}:` : 'needsLook:';
			let forgot = false;
			Object.keys(memory.skips.toObject()).forEach((key) => {
				if (!key.startsWith(prefix) && !(prefix === 'needsLook:' && key === 'needsLook')) return;
				memory.skips.forget(key);
				forgot = true;
			});
			if (!forgot) return;
			dirty = true;
			notifyNow();
		},
		/** "x": hidden for this session */
		hide() {
			if (hidden) return;
			hidden = true;
			notifyNow();
		},
		show() {
			if (!hidden) return;
			hidden = false;
			notifyNow();
		},
		isHidden: () => hidden,
		tips,
	};
	return coach;
}

// --------------------------------------------------------------
// The app's coach
// --------------------------------------------------------------

/** @type {Object | null} */
let appCoach = null;

/** @returns {Object} the app's coach (made on first use; the element starts it) */
export function getCoach() {
	if (!appCoach) appCoach = makeCoach();
	return appCoach;
}

/** @param {String} name @param {*} value */
export function setCoachFact(name, value) {
	getCoach().setFact(name, value);
}

/** @param {String} name @param {Function | null} fn */
export function setCoachSource(name, fn) {
	getCoach().setSource(name, fn);
}

/** @param {String} event @param {*} [detail] */
export function noteCoach(event, detail) {
	getCoach().note(event, detail);
}

/**
 * @param {String} name - a tips.js TIPS name ('photoStays')
 * @returns {Boolean} true when it shows
 */
export function showTip(name) {
	return getCoach().tips.show(name);
}

/** Menu > Help > "Show tips again" (4.9) */
export function resetTips() {
	getCoach().tips.reset();
}

export function resetCoachForTests() {
	appCoach?.stop();
	appCoach = null;
}
