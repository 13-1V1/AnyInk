// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15: Move the guide lines (UX-BEGINNER.md 4.8, 7.3, 7.6, section 10 B15). From Font details or
	Menu > Move the guide lines...: the letter view opens (the letter open now, or small n from
	the board or Try it), a purple banner says "Guide lines unlocked. Drag a line to move it for
	every letter. Letters keep their size, and they'll be checked again. Undo puts it back.
	[Done]", and the top, capitals, small-letter and tail lines become draggable with their
	readouts (the guides layer's own drag, mode/locks.js setGuideLinesMoving). The writing line
	stays locked (D-009). [Done], leaving the letter view, or All tools locks them again.

	Releasing a line is ONE whole-font Undo step about no letter that also refits every automatic
	letter (their gaps hang on the small-letter line): B11's moveLine (checks/fit_lines_to_writing
	.js) records it, with the line's place before the drag, so one Undo puts the line and the
	letters back. The checks run again after the step (checks_app.js), and a toast says how many
	letters changed: moveLine's "Moving the line made 3 letters need a look. [Show me]", or, when
	none did, "Moving the line made 2 letters look right." Arrow-key presses on a hovered line
	keep B3's bursts (quick presses on one line are one step), so a held key never fills the Undo
	list with whole-font copies; in Simple a small-letter press refits inside its step already.

	How the release reaches moveLine: the guides layer records a line's release (and an arrow
	press) as a settings step (metrics/font_metrics.js commitSettingsHistory ->
	History.addSettingsState). While the lines are unlocked, this module stands in front of that
	one method on the open font's History (an own property, taken off at Done): a settings step
	in which a line moved goes to commitDraggedLine; any other settings step is recorded as it
	always was. Where each line was before a drag or a press is read at the press (window
	pointerdown / mousedown / keydown, capture phase, before the canvas sees it).

	  startMovingLines({ editor, doc })   true when the lines are unlocked (Simple, 'fontDetails'
	                                      on, a font open)
	  stopMovingLines()                   locks them again; true when they were unlocked
	  isMovingLines()
	  commitDraggedLine(editor, moved, { needsALook })   the release: moveLine's step, the toast;
	                                      -> moveLine's result
	  movedLines(font, from)              { line, value, from } for the line that moved since
	                                      `from` ('top' | 'capitals' | 'small' | 'tail'), or null
	  linesOf(font)                       { ascent, capHeight, xHeight, descent }, whole units
	  installMoveLines({ getEditor })     answers the Menu's door (topbar/doors.js
	                                      MOVE_GUIDE_LINES_EVENT); returns the uninstall
	  BANNER_NAME                         'moveLines' (data-anyink-banner)
	  DEFAULT_LETTER                      'glyph-0x6E' (small n)
	Fix (first-timer H1): while the lines are unlocked the small-letter line keeps a clear distance
	below the capitals line (line_gap.js, through the metrics writer's setMetricLimit), and the
	readout (metrics/overlay.js setReadoutWords) names the line he holds with no unit number, or
	says why it stopped: "small-letter line stops here, so small letters stay shorter than
	capitals".

	Finalize (10/16/2026): unlocking the lines picks Select on the open letter (letter/open_tool.js
	applyOpenTool, which opens every letter on Select while they are unlocked): the Brush an empty
	letter opened with drew a stroke where he meant to drag a line.

	Words: fontinfo.banner.*, fontinfo.toast.lineCleared, fontinfo.readout.* (words/sets/
	fontinfo.js). Look: move_lines.css, tokens only.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { LINE_KEYS, lineName, moveLine } from '../checks/fit_lines_to_writing.js';
import { flippedSince, needsALookNow, sayFlipped } from '../checks/fix_step.js';
import { setMetricLimit } from '../metrics/font_metrics.js';
import { LIVE_LABELS, METRIC_LABELS, metricValue } from '../metrics/metrics_math.js';
import { setReadoutWords } from '../metrics/overlay.js';
import { guidesLayerState } from '../metrics/state.js';
import { isFeatureOn } from '../mode/features.js';
import { applyOpenTool } from '../letter/open_tool.js';
import { setGuideLinesMoving } from '../mode/locks.js';
import { isSimpleMode, MODE_EVENT } from '../mode/mode.js';
import { showItem } from '../preview/show_item.js';
import { whole } from '../spacing/round.js';
import { toast } from '../toast/toast.js';
import { MOVE_GUIDE_LINES_EVENT } from '../topbar/doors.js';
import { word, wordEntry } from '../words/words.js';
import { keepClear } from './line_gap.js';
import './move_lines.css';

export const BANNER_NAME = 'moveLines';
export const DEFAULT_LETTER = 'glyph-0x6E';

/** The four lines that move, as settings.font keys */
const FONT_KEYS = Object.freeze(['ascent', 'capHeight', 'xHeight', 'descent']);
const PAGE_EVENT = 'anyink-page-change';
const PRESS_EVENTS = Object.freeze(['pointerdown', 'mousedown', 'keydown']);
/** The readout's words when the gap stops a line */
const STOPS_WORDS = Object.freeze({
	xHeight: 'fontinfo.readout.smallStops',
	capHeight: 'fontinfo.readout.capitalsStops',
});

/**
 * While the lines are unlocked: the font, where its lines were at the last press, the banner,
 * the line the gap stopped last (cleared at the next press or a move it let through), and what
 * to undo at Done.
 * @type {{editor: Object, doc: Document, from: Object, banner: HTMLElement | null,
 *   stopped: String | null, cleanups: Array<Function>} | null}
 */
let active = null;

// --------------------------------------------------------------
// Pure
// --------------------------------------------------------------

/**
 * @param {Object} font - settings.font
 * @returns {{ascent: Number, capHeight: Number, xHeight: Number, descent: Number}}
 */
export function linesOf(font) {
	const lines = {};
	FONT_KEYS.forEach((key) => (lines[key] = whole(font?.[key])));
	return lines;
}

/**
 * @param {Object} font - settings.font now
 * @param {Object} from - linesOf the font before
 * @returns {{line: String, value: Number, from: Object} | null}
 */
export function movedLines(font, from) {
	if (!font || !from) return null;
	const now = linesOf(font);
	const key = FONT_KEYS.find((fontKey) => now[fontKey] !== whole(from[fontKey]));
	if (!key) return null;
	return { line: lineName(key), value: now[key], from: linesOf(from) };
}

// --------------------------------------------------------------
// Unlocking
// --------------------------------------------------------------

/** @returns {Boolean} */
export function isMovingLines() {
	return !!active;
}

/**
 * @param {{editor?: Object, doc?: Document}} [options]
 * @returns {Boolean} true when the lines are unlocked
 */
export function startMovingLines({ editor = getCurrentProjectEditor(), doc = globalThis.document } = {}) {
	if (!isSimpleMode() || !isFeatureOn('fontDetails') || !editor?.project?.settings?.font) {
		return false;
	}
	if (active && active.editor !== editor) stopMovingLines();
	openLetter(editor);
	if (active) {
		showBanner();
		return true;
	}
	const from = linesOf(editor.project.settings.font);
	active = { editor, doc, from, banner: null, stopped: null, cleanups: [] };
	setGuideLinesMoving(true);
	active.cleanups.push(standInFront(editor), listen(), () => setGuideLinesMoving(false));
	active.cleanups.push(keepLinesClear(editor), wordReadouts());
	// B14 + B15 finalize: an empty letter opened with the Brush; on Select a drag moves the line
	applyOpenTool(editor);
	showBanner();
	redraw(editor);
	return true;
}

/** @returns {Boolean} true when they were unlocked */
export function stopMovingLines() {
	if (!active) return false;
	const { editor, cleanups, banner } = active;
	active = null;
	cleanups.reverse().forEach((cleanup) => {
		try {
			cleanup();
		} catch (error) {
			console.warn('ANY-INK move lines: could not lock the lines again', error);
		}
	});
	banner?.remove();
	redraw(editor);
	return true;
}

/**
 * @param {{getEditor?: Function}} [options]
 * @returns {Function} the uninstall
 */
export function installMoveLines({ getEditor = getCurrentProjectEditor } = {}) {
	const onDoor = () => startMovingLines({ editor: getEditor() });
	globalThis.addEventListener?.(MOVE_GUIDE_LINES_EVENT, onDoor);
	return () => globalThis.removeEventListener?.(MOVE_GUIDE_LINES_EVENT, onDoor);
}

// --------------------------------------------------------------
// The release
// --------------------------------------------------------------

/**
 * One whole-font step for a line he dragged (it is at its new place already): B11's moveLine,
 * then a toast for the letters that look right again when moveLine said none need a look now.
 * @param {Object} editor
 * @param {{line: String, value: Number, from: Object}} moved - movedLines
 * @param {{needsALook?: Function | null}} [options]
 * @returns {{done: Boolean, line: String | null, value: Number | null, title: String,
 *   flipped: Array<String>}}
 */
export function commitDraggedLine(editor, moved, { needsALook } = {}) {
	const font = editor.project.settings.font;
	const before = withLines(font, moved.from, () => needsALookNow(editor, needsALook));
	const result = moveLine(editor, moved.line, moved.value, { from: moved.from, needsALook });
	if (result.done && !result.flipped.length) sayCleared(editor, before, needsALook);
	return result;
}

/**
 * An arrow press on a hovered line: recorded as it always was (B3's bursts; in Simple a
 * small-letter press is a whole-font step refit inside it), with the line's plain title, and
 * the same toast as a drag.
 */
function recordPress(editor, moved, options, record) {
	const font = editor.project.settings.font;
	const before = withLines(font, moved.from, () => needsALookNow(editor));
	record(word('fixes.step.movedLine', { line: word(`line.${LINE_KEYS[moved.line]}`) }), options);
	const flipped = flippedSince(before, editor);
	if (!sayFlipped(editor, flipped, { by: 'line' })) sayCleared(editor, before);
}

/** "Moving the line made 2 letters look right." */
function sayCleared(editor, before, needsALook) {
	if (!before || !isSimpleMode()) return;
	const after = needsALookNow(editor, needsALook);
	if (!after) return;
	const count = [...before].filter((id) => !after.has(id)).length;
	if (count) toast('fontinfo.toast.lineCleared', { count }, { kind: 'automatic' });
}

/**
 * Stands in front of History.addSettingsState on this font while the lines are unlocked.
 * @returns {Function} takes it away again
 */
function standInFront(editor) {
	const history = editor.history;
	if (!history || typeof history.addSettingsState !== 'function') return () => {};
	const own = Object.hasOwn(history, 'addSettingsState');
	const original = history.addSettingsState;
	const standIn = function addSettingsStateWhileMovingLines(title, options = {}) {
		const record = (t, o) => original.call(this, t, o);
		if (active?.editor !== editor || !isSimpleMode()) return record(title, options);
		return settingsStep(editor, title, options || {}, record);
	};
	history.addSettingsState = standIn;
	return () => {
		if (history.addSettingsState !== standIn) return;
		if (own) history.addSettingsState = original;
		else delete history.addSettingsState;
	};
}

/**
 * The small-letter and capitals lines keep their gap (line_gap.js) while unlocked.
 * @returns {Function} takes the limit away again
 */
function keepLinesClear(editor) {
	const limit = (font, key, value, current) => {
		if (active?.editor !== editor || !isSimpleMode()) return value;
		const kept = keepClear(font, key, value, current);
		if (kept.stopped) active.stopped = key;
		else if (active.stopped === key) active.stopped = null;
		return kept.value;
	};
	setMetricLimit(limit);
	return () => setMetricLimit(null);
}

/**
 * The readout names the line, no unit number; when the gap stopped it, says why.
 * @returns {Function} gives the readout its usual words back
 */
function wordReadouts() {
	setReadoutWords((line) => {
		if (!active || !isSimpleMode() || line?.kind !== 'metric') return null;
		const name = LIVE_LABELS[line.key];
		if (!name) return null;
		if (active.stopped === line.key && STOPS_WORDS[line.key]) {
			return word(STOPS_WORDS[line.key], { line: name });
		}
		return name;
	});
	return () => setReadoutWords(null);
}

/** A settings step while the lines are unlocked */
function settingsStep(editor, title, options, record) {
	const font = editor.project.settings.font;
	const moved = movedLines(font, active.from);
	if (!moved) {
		// a drag that came back to where it started: nothing moved, nothing to undo
		if (!options.burst && isLineRelease(font, title)) return undefined;
		return record(title, options);
	}
	try {
		if (options.burst) recordPress(editor, moved, options, record);
		else commitDraggedLine(editor, moved);
	} finally {
		if (active) active.from = linesOf(font);
	}
	return undefined;
}

/** The guides layer's release title for the line it holds ("Moved Small-letter line to 500") */
function isLineRelease(font, title) {
	const line = guidesLayerState.line;
	if (line?.kind !== 'metric' || !FONT_KEYS.includes(line.key)) return false;
	return title === `Moved ${METRIC_LABELS[line.key]} to ${metricValue(font, line.key)}`;
}

/** Runs fn with the lines put at `lines` for its length, then back where they were */
function withLines(font, lines, fn) {
	const now = linesOf(font);
	Object.assign(font, linesOf(lines));
	try {
		return fn();
	} finally {
		Object.assign(font, now);
	}
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/** The letter open now stays; from anywhere else, small n opens */
function openLetter(editor) {
	const id = String(editor.selectedItemID || '');
	if (editor.nav?.page === 'Characters' && id.startsWith('glyph-')) return;
	try {
		showItem(editor, DEFAULT_LETTER);
	} catch (error) {
		console.warn('ANY-INK move lines: could not open small n', error);
	}
}

/** Where each line was, read at every press; leaving the letter view or Simple locks them */
function listen() {
	const onPress = () => {
		if (!active || guidesLayerState.dragging) return;
		active.from = linesOf(active.editor.project?.settings?.font);
		active.stopped = null;
	};
	const onPage = (event) => {
		if (!active) return;
		const page = event?.detail?.page;
		if (event?.detail?.appLevel || (page && page !== 'Characters')) stopMovingLines();
		else showBanner();
	};
	const onMode = () => {
		if (!isSimpleMode()) stopMovingLines();
	};
	PRESS_EVENTS.forEach((type) => globalThis.addEventListener?.(type, onPress, true));
	globalThis.addEventListener?.(PAGE_EVENT, onPage);
	globalThis.addEventListener?.(MODE_EVENT, onMode);
	return () => {
		PRESS_EVENTS.forEach((type) => globalThis.removeEventListener?.(type, onPress, true));
		globalThis.removeEventListener?.(PAGE_EVENT, onPage);
		globalThis.removeEventListener?.(MODE_EVENT, onMode);
	};
}

/** The banner under the top bar (the navigator redraws the wrapper: put back on each page) */
function showBanner() {
	const doc = active?.doc;
	if (!doc?.createElement) return;
	if (!active.banner) active.banner = makeBanner(doc);
	const banner = active.banner;
	const wrapper = doc.querySelector('#app__wrapper');
	const bar = wrapper?.querySelector(':scope > #app__top-bar');
	if (bar) {
		if (bar.nextSibling !== banner) bar.after(banner);
	} else if (wrapper) {
		if (!wrapper.contains(banner)) wrapper.prepend(banner);
	} else if (!banner.isConnected) {
		doc.body?.prepend(banner);
	}
}

/** @returns {HTMLElement} */
function makeBanner(doc) {
	const banner = doc.createElement('div');
	banner.className = 'anyink-move-lines';
	banner.setAttribute('data-anyink-banner', BANNER_NAME);
	banner.setAttribute('role', 'status');
	const text = doc.createElement('span');
	text.className = 'anyink-move-lines__text';
	text.textContent = word('fontinfo.banner.text');
	const done = doc.createElement('button');
	done.type = 'button';
	done.className = 'anyink-move-lines__done';
	done.setAttribute('data-anyink-move-lines-action', 'done');
	done.textContent = word('fontinfo.banner.done');
	const hint = wordEntry('fontinfo.banner.done')?.hint;
	if (hint) done.title = hint;
	done.addEventListener('click', () => stopMovingLines());
	banner.append(text, done);
	return banner;
}

/** The canvas draws the lines' hover and cursor again */
function redraw(editor) {
	try {
		editor?.publish?.('editCanvasView', editor.view);
	} catch {
		// no canvas here (tests, the board): nothing to draw
	}
}
