// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: what the Simple letter view shows (UX-BEGINNER.md 4.3): whether "Fine-tune this letter" is
	open, and the four view switches inside it, "Dark paper", "Outline only", "Neighbors" and
	"Guide letter". The state lives for the session, in memory only: none of it is a change to
	the font, so none of it is an Undo step or marks the work file changed (7.3, looking around).
	Dark paper is the app's paper / slate pref (theme.js); Outline only flips the view setting the
	upstream outline button flips (settings.app.canvasDisplayModeFilled), with no step either.

	Fine-tune is closed by default and stays as he left it for the session. While it is closed,
	the canvas shows no edges or neighbors and the tool rail no extra tools (Edit points, Point
	pen, Rectangle, Oval). A tool key for a tool inside Fine-tune opens it (7.6, mode/doors.js).
	All tools, and Simple before 'letterView' lands, hide nothing: every query says "show".

	State (one per session, every font):
	  isLetterViewOn()            Simple with the 'letterView' flag on
	  isFineTuneOpen() / setFineTuneOpen(open, editor)   setFineTuneOpen tells the editor once,
	                              as 'editCanvasView' (the canvas redraws, the card and the tool
	                              rail follow); true when it changed
	  fineTuneShows(part, item)   part: 'edges' | 'neighbors' | 'tools' | 'switches' (FINE_TUNE_PARTS);
	                              false only in the letter view while Fine-tune hides it.
	                              'neighbors' also needs the Neighbors switch on. The edges, the
	                              neighbors and the switches need ink too (the card's Fine-tune
	                              section shows only on a letter with shapes); the tools don't,
	                              since they put the ink there (a tool picked from the empty
	                              letter's overlay opens Fine-tune). item: default the current
	                              editor's open letter. The canvas (edges.js, neighbors.js) and
	                              the tool rail (tools.js) ask this
	  isNeighborsOn() / setNeighbors(on, editor)       the switch (on by default; neighbors.js
	                              also needs his n or H to be ready)
	  noteLetterOpened(item)      a letter was opened: a new visit for the guide letter
	  isGuideLetterOn(item)       the guide letter shows: on a letter that was empty when he
	                              opened it (it stays while he draws, until he leaves the letter),
	                              or as he switched it for this visit; never outside the letter view
	  setGuideLetter(on, editor)  the switch, for this visit
	  isDarkPaper() / isOutlineOnly(project)          what the other two switches show
	  switchStates(editor)        { darkPaper, outlineOnly, neighbors, guideLetter }
	  resetLetterViewForTests()
	DOM:
	  makeViewSwitches(editor)    the four switches (role="switch" buttons), for the zoom area
	                              under the canvas, hidden while Fine-tune hides them; each
	                              press updates them all in place, and so does a theme change
	                              from anywhere (fix pass: the Menu's Dark paper calls theme.js,
	                              and the switch said off on dark paper). A group dropped with
	                              its page is let go when the next one is made
	  refreshViewSwitches(group)  shows them as they are now (another letter, a view change)
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { FINE_TUNE_EVENT } from '../mode/doors.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { getCanvasTheme, onThemeChange, toggleCanvasTheme } from '../theme/theme.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';
import { neighborChar, neighborsAvailable } from './neighbor_pick.js';

/** What Fine-tune hides while it is closed */
export const FINE_TUNE_PARTS = Object.freeze(['edges', 'neighbors', 'tools', 'switches']);

/** The switches, in the order 4.3 draws them */
export const SWITCHES = Object.freeze(['darkPaper', 'outlineOnly', 'neighbors', 'guideLetter']);

const fresh = () => ({
	fineTuneOpen: false,
	neighbors: true,
	visit: { itemId: null, openedEmpty: false, guideLetter: null },
});
let state = fresh();

/** @returns {Boolean} Simple, with B7's flag on */
export function isLetterViewOn() {
	return isSimpleMode() && isFeatureOn('letterView');
}

/** @returns {Boolean} */
export function isFineTuneOpen() {
	return state.fineTuneOpen;
}

/**
 * @param {Boolean} open
 * @param {Object} [editor] - default: the current project editor
 * @returns {Boolean} true when it changed
 */
export function setFineTuneOpen(open, editor = currentEditor()) {
	const next = !!open;
	if (state.fineTuneOpen === next) return false;
	state.fineTuneOpen = next;
	tell(editor);
	return true;
}

/**
 * @param {'edges' | 'neighbors' | 'tools' | 'switches'} part
 * @param {Object} [item] - the open letter (default: the current editor's, when it has one)
 * @returns {Boolean} false only while the letter view's Fine-tune hides it
 */
export function fineTuneShows(part, item = openLetter(currentEditor())) {
	if (!FINE_TUNE_PARTS.includes(part)) {
		throw new Error(`fineTuneShows: "${part}" is not one of ${FINE_TUNE_PARTS.join(', ')}`);
	}
	if (!isLetterViewOn()) return true;
	if (!state.fineTuneOpen) return false;
	// The card's Fine-tune section is there only on a letter with ink (4.3), so its edges,
	// neighbors and switches are too. Its tools are how ink gets there: they stay.
	if (part !== 'tools' && item && !item.shapes?.length) return false;
	if (part === 'neighbors') return state.neighbors;
	return true;
}

/** @returns {Boolean} the Neighbors switch */
export function isNeighborsOn() {
	return state.neighbors;
}

/**
 * @param {Boolean} on
 * @param {Object} [editor]
 * @returns {Boolean} true when it changed
 */
export function setNeighbors(on, editor = currentEditor()) {
	const next = !!on;
	if (state.neighbors === next) return false;
	state.neighbors = next;
	tell(editor);
	return true;
}

/**
 * A letter was opened (or the page drawn on one): a visit of its own for the guide letter.
 * The same letter again keeps its visit.
 * @param {Object} item - Glyph ({ id, shapes })
 */
export function noteLetterOpened(item) {
	const itemId = item?.id ?? null;
	if (itemId === state.visit.itemId) return;
	state.visit = { itemId, openedEmpty: !item?.shapes?.length, guideLetter: null };
}

/**
 * @param {Object} item - the open letter
 * @returns {Boolean} true while the guide letter shows on it
 */
export function isGuideLetterOn(item) {
	if (!isLetterViewOn() || !item) return false;
	noteLetterOpened(item);
	const chosen = state.visit.guideLetter;
	return chosen === null ? state.visit.openedEmpty : chosen;
}

/**
 * @param {Boolean} on
 * @param {Object} [editor]
 */
export function setGuideLetter(on, editor = currentEditor()) {
	state.visit.guideLetter = !!on;
	tell(editor);
}

/** @returns {Boolean} */
export function isDarkPaper() {
	return getCanvasTheme() === 'dark';
}

/**
 * @param {Object} project
 * @returns {Boolean}
 */
export function isOutlineOnly(project) {
	return project?.settings?.app?.canvasDisplayModeFilled === false;
}

/**
 * @param {Object} [editor]
 * @returns {{darkPaper: Boolean, outlineOnly: Boolean, neighbors: Boolean, guideLetter: Boolean}}
 */
export function switchStates(editor = currentEditor()) {
	const item = openLetter(editor);
	return {
		darkPaper: isDarkPaper(),
		outlineOnly: isOutlineOnly(editor?.project),
		neighbors: state.neighbors,
		guideLetter: item ? isGuideLetterOn(item) : !!state.visit.guideLetter,
	};
}

export function resetLetterViewForTests() {
	state = fresh();
}

// --------------------------------------------------------------
// Tool keys (7.6): a tool inside Fine-tune opens Fine-tune
// --------------------------------------------------------------

globalThis.addEventListener?.(FINE_TUNE_EVENT, () => {
	if (isLetterViewOn()) setFineTuneOpen(true);
});

// --------------------------------------------------------------
// The switches
// --------------------------------------------------------------

/** What each switch says, and its tooltip */
const LABELS = Object.freeze({
	darkPaper: { key: 'view.canvasTheme', tip: () => hintOf('view.canvasTheme') },
	outlineOnly: { key: 'view.displayMode', tip: () => hintOf('view.displayMode') },
	neighbors: {
		key: 'letter.switch.neighbors',
		tip: (editor) => word('letter.switch.neighborsTip', { letter: neighborFor(editor) }),
	},
	guideLetter: { key: 'letter.switch.guideLetter', tip: () => word('letter.switch.guideLetterTip') },
});

/** What each switch does when pressed */
const FLIP = Object.freeze({
	darkPaper: () => toggleCanvasTheme(),
	outlineOnly: (editor) => {
		const app = editor?.project?.settings?.app;
		if (app) app.canvasDisplayModeFilled = !app.canvasDisplayModeFilled;
	},
	neighbors: (editor) => setNeighbors(!state.neighbors, editor),
	guideLetter: (editor) => setGuideLetter(!switchStates(editor).guideLetter, editor),
});

/** Each switch group's own redraw */
const updaters = new WeakMap();

/**
 * The four switches under the canvas, inside Fine-tune: hidden while Fine-tune hides them.
 * @param {Object} [editor]
 * @returns {HTMLElement}
 */
export function makeViewSwitches(editor = currentEditor()) {
	const group = makeElement({
		tag: 'div',
		className: 'anyink-letter-switches',
		attributes: { role: 'group', 'aria-label': word('letter.switch.group') },
	});
	const buttons = SWITCHES.map((name) => {
		const button = makeElement({
			tag: 'button',
			className: 'anyink-letter-switch',
			attributes: { type: 'button', role: 'switch', 'data-anyink-switch': name },
		});
		button.appendChild(makeElement({ tag: 'span', className: 'anyink-letter-switch__track' }));
		const label = makeElement({ tag: 'span', className: 'anyink-letter-switch__label' });
		label.textContent = word(LABELS[name].key);
		button.appendChild(label);
		button.addEventListener('click', () => {
			FLIP[name](editor);
			// Dark paper and Outline only are view changes the canvas and its buttons follow
			if (name === 'darkPaper' || name === 'outlineOnly') tell(editor);
			update();
		});
		return button;
	});
	const update = () => {
		const states = switchStates(editor);
		group.hidden = !fineTuneShows('switches', openLetter(editor));
		buttons.forEach((button) => {
			const name = button.dataset.anyinkSwitch;
			button.setAttribute('aria-checked', String(!!states[name]));
			button.title = LABELS[name].tip(editor);
			// B6 + B7 integration: with no ready n or H there is nothing for Neighbors to show
			if (name === 'neighbors') {
				button.hidden = !neighborsAvailable(openLetter(editor), editor?.project);
			}
		});
	};
	buttons.forEach((button) => group.appendChild(button));
	updaters.set(group, update);
	update();
	followTheme(group);
	return group;
}

/** Switch groups that may be on screen: a theme change updates the ones that are */
const groups = new Set();
let followingTheme = false;

/**
 * The Dark paper switch says what the paper is, whoever changed it: the Menu's Dark paper row
 * calls theme.js and never this switch. One theme listener for the app. The page that holds a
 * group is drawn before the old page goes, so a group not on screen when the next one is made
 * has been dropped: it is let go then.
 * @param {HTMLElement} group
 */
function followTheme(group) {
	groups.forEach((old) => {
		if (!old.isConnected) groups.delete(old);
	});
	groups.add(group);
	if (followingTheme) return;
	followingTheme = true;
	onThemeChange(() => {
		groups.forEach((each) => {
			if (each.isConnected) updaters.get(each)?.();
		});
	});
}

/**
 * Shows the switches as they are now (on, off, hidden), for another letter or a view change.
 * @param {HTMLElement} group - from makeViewSwitches
 */
export function refreshViewSwitches(group) {
	updaters.get(group)?.();
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** Tells the editor the view changed: the canvas redraws, the card and the rail follow. */
function tell(editor) {
	if (typeof editor?.publish === 'function') editor.publish('editCanvasView', editor.view);
}

function currentEditor() {
	try {
		return getCurrentProjectEditor() || null;
	} catch {
		return null;
	}
}

/** The open letter, looked up without making one. */
function openLetter(editor) {
	const id = editor?.selectedGlyphID;
	if (!id || typeof editor?.project?.getItem !== 'function') return null;
	return editor.project.getItem(id) || null;
}

/**
 * 4.3 Neighbors: the neighbor the canvas draws (neighbor_pick.js: his n beside a small letter,
 * his H beside a capital or a number), in words: "small n", "Capital H" (2.2).
 * @param {Object} editor
 * @returns {String}
 */
function neighborFor(editor) {
	return letterName(neighborChar(openLetter(editor)?.char || ''));
}

/**
 * @param {String} key
 * @returns {String} the words' hint (what the switch does), else its words
 */
function hintOf(key) {
	return wordEntry(key)?.hint || word(key);
}
