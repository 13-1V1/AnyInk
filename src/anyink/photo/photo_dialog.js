// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-ui: the photo dialog, step B (docs/UX-BEGINNER.md 4.4 "Step B, the photo dialog", 4.5).
	Which part of the photo is which letter. The whole photo fills the dialog; each part has a thin
	purple outline, parts already used carry their letter ("B"), and one part has the green dashed
	box: the guess, the first unused part in reading order (photo_registry.js guessPart).
	- Close up (fix pass, first-timer finding 2: a whole-alphabet page showed letters about 30 px
	  tall at 1600 x 900 and 20 px at 1280 x 720, the i 5 px wide, too small to click or box): the
	  whole photo shows when its typical letter is at least READABLE_LETTER_PX tall there; else the
	  view comes closer (autoZoom), filling the view's width when that makes the letters readable
	  (a portrait page then only scrolls up and down, like a document), else to about
	  TARGET_LETTER_PX, never past MAX_PIXEL_SCALE screen pixels per photo pixel. The view
	  scrolls; the green box starts in its middle and comes back into view whenever it moves
	  (arrow keys, Skip, a box drawn). [-] [+] under the photo (Zoom out, Zoom in: the canvas zoom
	  bar's words) step by ZOOM_STEP, keeping the green box where it is, and never take the focus
	  from the field; Ctrl + the wheel (a touchpad pinch) zooms where the pointer is; the wheel
	  alone scrolls. Zoom out is offered only while there is something smaller to show. Looking
	  closer changes nothing (no record change, no step).
	- Name tags never cover another letter (finding 2): each used part's tag goes above it, else
	  below, left or right, wherever it covers no other part at the size the photo shows now
	  (tagSpot), else inside its own box. Nor another tag (finalize, second hostile pass: on the
	  whole photo a "below" tag sat on the next row's "above" one): tags are placed in reading
	  order, each one placed blocking the rest (placeTags).
	- A window resized while it is open keeps the letters the size they were (finalize: the view's
	  height settles over a few frames, and each resize gave another zoom, sideways scrolling
	  and the green box out of view): the screen pixels per photo pixel stay, the view (a
	  ResizeObserver on it, else the window's resize) only changes how much shows, and the green
	  box comes back into view. A zoom button that hides while it has the focus hands it on (the
	  other zoom button, else the field or the photo), so the dialog's keys keep working.
	- On a part that may hold two letters written touching (photo_registry.js mayBeTwoLetters),
	  the sentence under the photo says so: "Two letters touch here. Drag a box around each one."
	  (finalize: the merged "VW", "lm" and "na" said nothing).
	- Picking: a click picks the part under it (a few screen pixels round it count too). A drag
	  anywhere draws a new box, with a crosshair cursor: the tight box round the ink inside it
	  (ink_parts.js partFromBox) becomes the pick; a box round no ink says so and keeps the pick.
	  Arrow keys (on the photo, or in the one-letter field) move the green box through the parts
	  in reading order. The photo is never on the edit canvas here, so a drag can never move it
	  (section 10 B9).
	- Letter known (opened from a letter: [Use a photo], Trace again, "Wrong part? Draw a box"):
	  "Which part is your small r?" [Trace it] (green) [Cancel]. The green box starts on the part
	  this letter used (Trace again), else on the guess, unless the opener names one (pick).
	- Letter unknown (a photo from the How card, dropped on the board, rule 12's [Do the next
	  one]): "Which letter is in the green box? [ r ] That's: small r", [Trace it] (green), Skip
	  this part, Done with this photo. The field takes one character and says what it understood
	  ("That's: small l" vs "That's: Capital I"); it starts with the alphabet prefill
	  (prefillChar), or a used part's own letter when he picks one; what he typed stays when he
	  picks another part. Enter is Trace it. His next step is always typing the letter, so after
	  a pick by mouse or Skip the field takes the focus, and a letter key pressed anywhere in the
	  dialog lands in it. With every part named (or none found) there is nothing to trace: Done
	  with this photo is the green button, and a sentence says why.
	- One green button (principle 1): Trace it, or Done when there is nothing to trace. The Next
	  line steps aside while it is open (coach rule 1: data-anyink-dialog, and the coach's
	  'dialog' fact). Editor keys are blocked while it is open, in the capture phase (4.5, 7.6),
	  so typing B in the field never picks the Brush.
	- What it writes in the photo's record (photo_registry.js; none of it is an Undo step, 7.3):
	  Skip this part (skipPart), Done with this photo (markDone), and a box he drew, only when he
	  presses Trace it with it (addDrawnPart). Naming a part is the flow's, at Use it (usePart).
	  Cancel, the x and Escape change nothing; all three are the shell's one cancel path. Fix pass
	  (first-timer finding 1): with a mouse the x never closed it, because upstream's
	  button:hover resets (0,1,1) took its margin-left: auto and it jumped out from under the
	  pointer; photo_dialog.css scopes every shell button rule by .anyink-modal
	  (tests/modal_css.test.js reads the cascade, tests/photo_ui.verify.mjs clicks it in Chrome).

	  openPhotoDialog(options)   the dialog, or null (not Simple, the 'photo' flag off, no record)
	    record       the photo's live record (photo_registry.js getPhoto)
	    image        what to draw: an ImageBitmap, <img>, <canvas>, ImageData or Blob (or a
	                 Promise of one); the photo as stored, the size the parts are measured in
	    mask         the photo's ink (ink_parts.js photoInk(...).mask), for a box he drags;
	                 without it the box he drags is taken as it is
	    ink          all the ink binarize found (photoInk(...).ink): a box round a letter the
	                 mask lacks (lighter, another pen) reads it (ink_parts.js boxInk)
	    width, height   the photo's size (default: the record's)
	    char         the letter when opened from a letter ('' or none: unknown)
	    itemId       that letter's id: the green box starts on the part it used
	    pick         a part id to start on
	    onTrace({ partId, char, part, drawn })   Trace it, after the dialog closed. part is the
	                 stored part ({ id, left, top, right, bottom, row, drawn? }); a box he drew
	                 also brings its mask (only its own ink)
	    onCancel()   Cancel, the x or Escape, after it closed
	    onDone(record)   Done with this photo, after it closed (record.done is true)
	    onChange({ what: 'skip', partId })   Skip this part changed the record
	  closePhotoDialog()         closes it as Cancel does, without calling onCancel
	  isPhotoDialogOpen()
	  PHOTO_DIALOG_NAME          'photoDialog' (data-anyink-dialog)
	Pure:
	  startPart(record, { itemId, pick, char })   where the green box starts (a part id or null):
	                                         his pick, the part this letter used, else the guess
	                                         (for the letter, when known)
	  typedChar(previous, value, data)      the one character the field keeps
	  partsInOrder(parts)                    reading order: rows top to bottom, then left to right
	  fitSize(boxW, boxH, w, h)              the photo's size inside the view, aspect kept
	  autoZoom({ parts, width, height, viewWidth, viewHeight })   how close the view opens (1:
	                                         the whole photo; 2: twice that size)
	  tagSpot(part, parts, { scale, tag, bounds, placed })   'above' | 'below' | 'left' |
	                                         'right' | 'inside': where a part's name tag covers no
	                                         other part, nor a tag already placed (scale: screen
	                                         pixels per photo pixel; tag, bounds and placed in
	                                         screen pixels)
	  placeTags(parts, { scale, tag, bounds, named })   Map(id -> { spot, rect }): the tags of
	                                         the named parts (default all), placed in reading
	                                         order, each one blocking the rest
	Shared by the How card (one ANY-INK dialog at a time):
	  openModal({ name, className, labelledBy, onCancel, onKey })   { dialog, show(focus),
	                 close({ silent }), cancel(), closed }: a <dialog> shown modal (or open in a
	                 browser without showModal), the coach told ('dialog' fact), the editor's
	                 keys and clipboard events (a paste would put a photo on the letter behind)
	                 blocked in the capture phase, a file dropped on it kept from opening in
	                 the tab; opening one closes the one open, silently, and closing gives the
	                 focus back
	  openModalName()             the open one's name, or ''
	  paintPhoto(canvas, image, { fit })     draws a photo into a canvas ('fill' or 'contain');
	                 resolves true when drawn
	Words: photo.dialog.* (words/sets/photo.js). Look: photo_dialog.css, tokens only.
*/
import { setCoachFact } from '../coach/coach_state.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';
import { partAt, partFromBox } from './ink_parts.js';
import { mayBeTwoLetters } from './photo_registry.js';
import { fitSize, paintPhoto } from './paint_photo.js';
import {
	addDrawnPart,
	guessPart,
	markDone,
	prefillChar,
	skipPart,
	usedChar,
} from './photo_registry.js';
import './photo_dialog.css';

export const PHOTO_DIALOG_NAME = 'photoDialog';

export { fitSize, paintPhoto };

/** A press that moves this many screen pixels is a drag (a box), not a click. */
export const DRAG_START_PX = 4;

/** A click this many screen pixels outside a part still picks it. */
export const CLICK_REACH_PX = 6;

/** The view's size when the page can't say (no layout): about 1000 x 600, as 4.4 says. */
export const FALLBACK_VIEW = Object.freeze({ width: 1000, height: 600 });

/** A letter this tall on screen is easy to read, click and box: the whole photo shows then. */
export const READABLE_LETTER_PX = 56;

/** How tall a letter shows when the view has to come closer than filling its width. */
export const TARGET_LETTER_PX = 80;

/** A photo pixel never shows wider than this many screen pixels (closer only blurs). */
export const MAX_PIXEL_SCALE = 3;

/** Never closer than this many times the whole photo. */
export const MAX_ZOOM = 8;

/** Zoom in and Zoom out: one press. */
export const ZOOM_STEP = 1.5;

/** Ctrl + the wheel: zoom per wheel pixel (one notch, 100, is about 1.22 times). */
const WHEEL_RATE = 0.002;

/** Closer than the whole photo by less than this counts as the whole photo. */
const WHOLE_SNAP = 1.02;

/** The green box, brought into view, keeps this much room round it. */
const REVEAL_MARGIN_PX = 24;

/** A name tag on screen (one letter in 11 px text, its padding) and its gap from other parts. */
export const TAG_SIZE = Object.freeze({ width: 14, height: 15 });
const TAG_CLEAR_PX = 2;

/** The id the box he drew carries until Trace it stores it. */
const DRAWN_ID = 'drawn';

// --------------------------------------------------------------
// The modal shell (the photo dialog and the How card)
// --------------------------------------------------------------

/** @type {Object | null} the ANY-INK dialog that is open */
let openView = null;

/**
 * @param {{name: String, className?: String, labelledBy?: String, onCancel?: Function,
 *   onKey?: (event: KeyboardEvent) => Boolean}} options
 * @returns {{dialog: HTMLDialogElement, show: Function, close: Function, cancel: Function,
 *   closed: Boolean, name: String}}
 */
export function openModal({ name, className = '', labelledBy = '', onCancel, onKey } = {}) {
	const doc = globalThis.document;
	const before = openView ? openView.before : doc.activeElement;
	if (openView) openView.close({ silent: true });
	const dialog = doc.createElement('dialog');
	dialog.className = `anyink-modal ${className}`.trim();
	dialog.setAttribute('data-anyink-dialog', name);
	dialog.setAttribute('aria-modal', 'true');
	if (labelledBy) dialog.setAttribute('aria-labelledby', labelledBy);
	const view = { name, dialog, before, closed: false, cleanups: [] };
	const keys = (event) => blockKeys(view, event, onKey);
	view.show = (focus) => {
		doc.body.appendChild(dialog);
		try {
			if (typeof dialog.showModal === 'function') dialog.showModal();
			else dialog.setAttribute('open', '');
		} catch {
			dialog.setAttribute('open', '');
		}
		const clips = (event) => blockClipboard(view, event);
		globalThis.addEventListener('keydown', keys, true);
		globalThis.addEventListener('keyup', keys, true);
		CLIPBOARD_EVENTS.forEach((type) => globalThis.addEventListener(type, clips, true));
		view.cleanups.push(() => {
			globalThis.removeEventListener('keydown', keys, true);
			globalThis.removeEventListener('keyup', keys, true);
			CLIPBOARD_EVENTS.forEach((type) => globalThis.removeEventListener(type, clips, true));
		});
		setCoachFact('dialog', name);
		focus?.focus?.();
	};
	view.close = ({ silent = false } = {}) => {
		if (view.closed) return;
		view.closed = true;
		view.cleanups.forEach((undo) => undo());
		try {
			if (dialog.open && typeof dialog.close === 'function') dialog.close();
		} catch {
			// a dialog that was never shown modal closes by leaving the page
		}
		dialog.remove();
		if (openView === view) openView = null;
		if (silent) return;
		setCoachFact('dialog', null);
		if (view.before?.isConnected && typeof view.before.focus === 'function') view.before.focus();
	};
	view.cancel = () => {
		if (view.closed) return;
		view.close();
		tell('onCancel', onCancel);
	};
	// Chrome's own Escape on a modal dialog
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		view.cancel();
	});
	// a file dropped on it never opens in the tab
	['dragover', 'drop'].forEach((type) =>
		dialog.addEventListener(type, (event) => event.preventDefault())
	);
	openView = view;
	return view;
}

/**
 * Calls an opener's handler; one that throws never breaks the press or leaves a dialog half
 * open (it has already closed).
 * @param {String} name
 * @param {Function | undefined} handler
 * @param {...*} args
 */
function tell(name, handler, ...args) {
	if (typeof handler !== 'function') return;
	try {
		handler(...args);
	} catch (error) {
		console.warn(`ANY-INK photo: ${name} failed`, error);
	}
}

/** Clipboard events the editor listens for (a pasted photo, Ctrl+C of shapes). */
const CLIPBOARD_EVENTS = Object.freeze(['paste', 'copy', 'cut']);

/**
 * While a dialog is open the editor never hears a paste, copy or cut (a photo pasted behind it
 * would land on the letter). Inside one of the dialog's own fields the browser still does it.
 */
function blockClipboard(view, event) {
	if (view.closed) return;
	event.stopImmediatePropagation();
	const target = event.target;
	const typing =
		view.dialog.contains(target) && target?.tagName === 'INPUT' && target.type === 'text';
	if (!typing) event.preventDefault();
}

/** @returns {String} the open ANY-INK dialog's name, or '' */
export function openModalName() {
	return openView ? openView.name : '';
}

/**
 * Keys while a dialog is open: Escape cancels it; the dialog's own keys go to onKey; nothing
 * reaches the editor (its document listeners, upstream's shortcuts, the guide and photo
 * nudges). Typing in a field, Tab and a focused button's Enter or Space still work: only the
 * event's travel is stopped, not what the browser does with the key.
 */
function blockKeys(view, event, onKey) {
	if (view.closed) return;
	const inside = view.dialog.contains(event.target);
	event.stopImmediatePropagation();
	if (event.type !== 'keydown') {
		if (!inside && event.key !== 'Tab') event.preventDefault();
		return;
	}
	if (event.key === 'Escape') {
		event.preventDefault();
		view.cancel();
		return;
	}
	if (inside) {
		if (onKey?.(event)) event.preventDefault();
		return;
	}
	if (event.key !== 'Tab') event.preventDefault();
}

// --------------------------------------------------------------
// Drawing a photo: paint_photo.js (B8 + B9 integration: the empty-letter overlay's thumbnail
// shares it without importing this dialog), re-exported here
// --------------------------------------------------------------

// --------------------------------------------------------------
// Pure
// --------------------------------------------------------------

/**
 * @param {Array<Object>} parts
 * @returns {Array<Object>} rows top to bottom, then left to right
 */
export function partsInOrder(parts) {
	return [...(parts || [])]
		.filter(Boolean)
		.sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || a.left - b.left || a.top - b.top);
}

/**
 * @param {Object} record
 * @param {{itemId?: String, pick?: String, char?: String}} [options] - char: the letter, when
 *   known: the guess is then the registry's guess for that letter (photo_registry.js guessPart),
 *   so the green box, and the close-up view, start where his letter most likely is
 * @returns {String | null} the part the green box starts on
 */
export function startPart(record, { itemId, pick, char } = {}) {
	const parts = Array.isArray(record?.parts) ? record.parts : [];
	if (pick && parts.some((p) => p.id === pick)) return pick;
	if (itemId) {
		const used = Object.entries(record.used || {}).find(([, use]) => use?.itemId === itemId);
		if (used && parts.some((p) => p.id === used[0])) return used[0];
	}
	return isOneChar(char) ? guessPart(record, { char }) : guessPart(record);
}

/**
 * The one character the letter field keeps: the first visible one he just typed, else the one
 * the field now holds that isn't the one it had.
 * @param {String} previous - what the field had
 * @param {String} value - what the field holds now
 * @param {String | null} data - what the input event says was typed
 * @returns {String} one character, or ''
 */
export function typedChar(previous, value, data) {
	const visible = (text) => Array.from(String(text ?? '')).filter((char) => char.trim() !== '');
	const typed = visible(data);
	if (typed.length) return typed[0];
	const chars = visible(value);
	if (chars.length <= 1) return chars[0] || '';
	const at = chars.indexOf(previous);
	if (at >= 0) chars.splice(at, 1);
	return chars[0];
}

/**
 * How close the view opens: the whole photo (1) when its typical letter shows at least
 * READABLE_LETTER_PX tall there; else the view's width filled, when that is enough; else about
 * TARGET_LETTER_PX, never past MAX_PIXEL_SCALE or MAX_ZOOM.
 * @param {{parts: Array<Object>, width: Number, height: Number, viewWidth: Number,
 *   viewHeight: Number}} options - the photo's parts and size, the view's size
 * @returns {Number} times the whole photo's size, at least 1
 */
export function autoZoom({ parts, width, height, viewWidth, viewHeight }) {
	const whole = fitSize(viewWidth, viewHeight, width, height);
	if (!whole.width) return 1;
	const heights = (Array.isArray(parts) ? parts : [])
		.map((part) => part.bottom - part.top)
		.filter((h) => h > 0)
		.sort((a, b) => a - b);
	if (!heights.length) return 1;
	const shown = heights[Math.floor(heights.length / 2)] * (whole.width / width);
	if (shown >= READABLE_LETTER_PX) return 1;
	const wanted = Math.min(mostZoom(width, whole.width), TARGET_LETTER_PX / shown);
	const filled = viewWidth / whole.width;
	if (filled > 1 && filled < wanted && shown * filled >= READABLE_LETTER_PX) return filled;
	return Math.max(1, wanted);
}

/** @returns {Number} the closest the view comes to a photo this wide shown this wide whole */
function mostZoom(width, wholeWidth) {
	return Math.max(1, Math.min(MAX_ZOOM, (MAX_PIXEL_SCALE * width) / Math.max(1, wholeWidth)));
}

/**
 * Where a used part's name tag goes: above it, else below, left or right, the first spot that
 * stays on the photo and covers no other part (with TAG_CLEAR_PX round it), else inside its own
 * box, where it covers only its own letter's corner.
 * @param {Object} part - { left, top, right, bottom } in photo pixels
 * @param {Array<Object>} parts - every part on the photo (part among them)
 * @param {{scale?: Number, tag?: {width: Number, height: Number}, bounds?: {width: Number,
 *   height: Number}}} [options] - screen pixels per photo pixel; the tag's and the photo's size
 *   on screen
 * @returns {'above' | 'below' | 'left' | 'right' | 'inside'}
 */
export function tagSpot(part, parts, { scale = 1, tag = TAG_SIZE, bounds, placed = [] } = {}) {
	const onScreen = (box) => ({
		left: box.left * scale,
		top: box.top * scale,
		right: box.right * scale,
		bottom: box.bottom * scale,
	});
	const p = onScreen(part);
	const blocks = (parts || [])
		.filter((other) => other && other !== part && !(part.id && other.id === part.id))
		.map(onScreen)
		.map((box) => ({
			left: box.left - TAG_CLEAR_PX,
			top: box.top - TAG_CLEAR_PX,
			right: box.right + TAG_CLEAR_PX,
			bottom: box.bottom + TAG_CLEAR_PX,
		}));
	// tags placed already block too (finalize)
	for (const r of placed || []) {
		blocks.push({
			left: r.left - TAG_CLEAR_PX,
			top: r.top - TAG_CLEAR_PX,
			right: r.right + TAG_CLEAR_PX,
			bottom: r.bottom + TAG_CLEAR_PX,
		});
	}
	const maxX = bounds?.width ?? Infinity;
	const maxY = bounds?.height ?? Infinity;
	for (const name of TAG_SPOTS) {
		const r = tagRect(p, name, tag);
		if (r.left < 0 || r.top < 0 || r.right > maxX || r.bottom > maxY) continue;
		const covers = blocks.some(
			(b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top
		);
		if (!covers) return name;
	}
	return 'inside';
}

/** Where a tag may go, in the order tried (the same side first for every tag). */
const TAG_SPOTS = Object.freeze(['above', 'below', 'left', 'right']);

/**
 * A tag's box on screen at a spot (as photo_dialog.css draws each: 1 px off the outline, 2 px
 * beside it; inside: its own box's top-left corner).
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} p - the part on screen
 * @param {String} spot
 * @param {{width: Number, height: Number}} tag
 * @returns {{left: Number, top: Number, right: Number, bottom: Number}}
 */
function tagRect(p, spot, { width: w, height: h }) {
	if (spot === 'above')
		return { left: p.left - 1, top: p.top - 1 - h, right: p.left - 1 + w, bottom: p.top - 1 };
	if (spot === 'below') {
		return { left: p.left - 1, top: p.bottom + 1, right: p.left - 1 + w, bottom: p.bottom + 1 + h };
	}
	if (spot === 'left')
		return { left: p.left - 2 - w, top: p.top - 1, right: p.left - 2, bottom: p.top - 1 + h };
	if (spot === 'right')
		return { left: p.right + 2, top: p.top - 1, right: p.right + 2 + w, bottom: p.top - 1 + h };
	return { left: p.left, top: p.top, right: p.left + w, bottom: p.top + h };
}

/**
 * Every named part's tag, placed in reading order, each one blocking the ones after it.
 * @param {Array<Object>} parts - every part on the photo
 * @param {{scale?: Number, tag?: {width: Number, height: Number}, bounds?: Object,
 *   named?: Set<String>}} [options]
 * @returns {Map<String, {spot: String, rect: Object}>}
 */
export function placeTags(parts, { scale = 1, tag = TAG_SIZE, bounds, named } = {}) {
	const list = partsInOrder(parts);
	const placed = [];
	const out = new Map();
	for (const part of list) {
		if (named && !named.has(part.id)) continue;
		const spot = tagSpot(part, list, { scale, tag, bounds, placed });
		const onScreen = {
			left: part.left * scale,
			top: part.top * scale,
			right: part.right * scale,
			bottom: part.bottom * scale,
		};
		const rect = tagRect(onScreen, spot, tag);
		if (spot !== 'inside') placed.push(rect);
		out.set(part.id, { spot, rect });
	}
	return out;
}

// --------------------------------------------------------------
// The dialog
// --------------------------------------------------------------

/** @type {Object | null} the open photo dialog */
let current = null;

/** @returns {Boolean} the photo screens show: Simple mode with 'photo' on */
function screensOn() {
	return isSimpleMode() && isFeatureOn('photo');
}

/**
 * @param {Object} options - see the header
 * @returns {Object | null} { element, close, picked, char }
 */
export function openPhotoDialog(options = {}) {
	const { record } = options;
	if (!screensOn() || !record || !Array.isArray(record.parts)) return null;
	closePhotoDialog();
	const known = isOneChar(options.char) ? options.char : '';
	const state = {
		record,
		mask: options.mask instanceof Uint8Array ? options.mask : null,
		ink: options.ink instanceof Uint8Array ? options.ink : null,
		width: Math.max(1, Math.round(Number(options.width || record.width) || 1)),
		height: Math.max(1, Math.round(Number(options.height || record.height) || 1)),
		known,
		char: '',
		source: '',
		picked: null,
		drawn: null,
		message: '',
		drag: null,
		/** times the whole photo's size; sized: the stage has its size (after it showed) */
		zoom: 1,
		sized: false,
		stage: { width: 0, height: 0 },
		handlers: {
			onTrace: options.onTrace,
			onCancel: options.onCancel,
			onDone: options.onDone,
			onChange: options.onChange,
		},
	};
	const titleId = 'anyink-photo-dialog-title';
	const modal = openModal({
		name: PHOTO_DIALOG_NAME,
		className: 'anyink-photo-dialog',
		labelledBy: titleId,
		onCancel: () => state.handlers.onCancel?.(),
		onKey: (event) => onDialogKey(state, event),
	});
	state.modal = modal;
	build(state, titleId);
	const start = startPart(record, { itemId: options.itemId, pick: options.pick, char: known });
	pick(state, start ? partById(state, start) : null);
	const view = {
		element: modal.dialog,
		close: () => modal.close(),
		picked: () => state.picked?.id ?? null,
		char: () => (state.known ? state.known : state.char),
	};
	current = { state, view };
	modal.cleanups.push(() => {
		if (current?.state === state) current = null;
		endDrag(state);
	});
	modal.show(state.known ? state.els.trace : state.els.field);
	state.els.field?.select?.();
	// close up when the letters would show too small to click or box (finding 2)
	const { width: viewWidth, height: viewHeight } = viewSize(state);
	state.zoom = autoZoom({
		parts: record.parts,
		width: state.width,
		height: state.height,
		viewWidth,
		viewHeight,
	});
	sizeStage(state);
	state.sized = true;
	render(state);
	reveal(state, state.picked, { center: true });
	// the letters keep their size when the view changes size (finalize): only how much shows
	const refit = () => {
		if (modal.closed) return;
		const k = state.stage.width / state.width;
		const { width: w, height: h } = viewSize(state);
		const whole = fitSize(w, h, state.width, state.height);
		if (k > 0 && whole.width > 0) state.zoom = (k * state.width) / whole.width;
		sizeStage(state);
		render(state);
		reveal(state, state.picked);
	};
	globalThis.addEventListener('resize', refit);
	modal.cleanups.push(() => globalThis.removeEventListener('resize', refit));
	if (typeof ResizeObserver === 'function') {
		const watch = new ResizeObserver(refit);
		watch.observe(state.els.view);
		modal.cleanups.push(() => watch.disconnect());
	}
	state.els.loading.hidden = false;
	paintPhoto(state.els.canvas, options.image).then((drawn) => {
		if (!modal.closed) state.els.loading.hidden = drawn;
	});
	return view;
}

/** Closes the open photo dialog as Cancel does, without telling its opener. */
export function closePhotoDialog() {
	current?.state.modal.close();
}

/** @returns {Boolean} */
export function isPhotoDialogOpen() {
	return !!current && !current.state.modal.closed;
}

// --------------------------------------------------------------
// Building
// --------------------------------------------------------------

function el(tag, className, attributes = {}, text = '') {
	const element = globalThis.document.createElement(tag);
	if (className) element.className = className;
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	if (text) element.textContent = text;
	return element;
}

function button(name, key, kind) {
	const element = el('button', `anyink-modal__button anyink-${kind}`, {
		type: 'button',
		'data-anyink-photo-action': name,
	});
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	return element;
}

function build(state, titleId) {
	const { dialog } = state.modal;
	dialog.setAttribute('data-anyink-photo-dialog', state.known ? 'known' : 'unknown');
	const els = {};
	state.els = els;

	// The question, the field (letter unknown) and the x
	const head = el('div', 'anyink-modal__head');
	const title = el('h2', 'anyink-modal__title', { id: titleId });
	title.textContent = state.known
		? word('photo.dialog.titleKnown', { letter: letterName(state.known) })
		: word('photo.dialog.titleUnknown');
	head.appendChild(title);
	if (!state.known) {
		const ask = el('div', 'anyink-photo-dialog__ask');
		els.field = el('input', 'anyink-photo-dialog__field', {
			type: 'text',
			autocomplete: 'off',
			spellcheck: 'false',
			'aria-labelledby': titleId,
			'aria-describedby': 'anyink-photo-dialog-thats',
			'data-anyink-photo-field': '',
		});
		els.field.addEventListener('input', (event) => onType(state, event));
		els.field.addEventListener('focus', () => els.field.select?.());
		els.thats = el('span', 'anyink-photo-dialog__thats', {
			id: 'anyink-photo-dialog-thats',
			'aria-live': 'polite',
			'data-anyink-photo-thats': '',
		});
		ask.append(els.field, els.thats);
		head.appendChild(ask);
	}
	const close = el('button', 'anyink-modal__close', {
		type: 'button',
		'aria-label': word('photo.dialog.close'),
		title: wordEntry('photo.dialog.close')?.hint || '',
		'data-anyink-photo-action': 'close',
	});
	close.textContent = '×';
	close.addEventListener('click', () => state.modal.cancel());
	head.appendChild(close);

	// The photo and its parts, in a view that scrolls when it is shown close up
	const frame = el('div', 'anyink-photo-dialog__frame');
	const viewBox = el('div', 'anyink-photo-dialog__view', { 'data-anyink-photo-view': '' });
	els.view = viewBox;
	const stage = el('div', 'anyink-photo-dialog__stage', {
		tabindex: '0',
		role: 'group',
		'aria-label': word('photo.dialog.view'),
		'data-anyink-photo-stage': '',
	});
	els.stage = stage;
	els.canvas = el('canvas', 'anyink-photo-dialog__photo', { 'aria-hidden': 'true' });
	els.canvas.width = state.width;
	els.canvas.height = state.height;
	els.parts = el('div', 'anyink-photo-dialog__parts');
	els.dragBox = el('div', 'anyink-photo-dialog__drag', { 'data-anyink-photo-drag': '' });
	els.dragBox.hidden = true;
	els.loading = el('p', 'anyink-photo-dialog__loading', {}, word('photo.dialog.loading'));
	stage.append(els.canvas, els.parts, els.dragBox);
	// its arrow keys come through the shell's key handler (onDialogKey)
	stage.addEventListener('mousedown', (event) => onPress(state, event));
	viewBox.appendChild(stage);
	// Ctrl + the wheel (a touchpad pinch) zooms where the pointer is; the wheel alone scrolls
	viewBox.addEventListener('wheel', (event) => onWheel(state, event), { passive: false });
	// "Loading the photo..." over the view, wherever it is scrolled
	frame.append(viewBox, els.loading);

	// The hint and the zoom buttons, the message, the buttons
	const under = el('div', 'anyink-photo-dialog__under');
	const hint = el('p', 'anyink-photo-dialog__hint', { 'data-anyink-photo-hint': '' });
	hint.textContent = word('photo.dialog.hint');
	const zoom = el('div', 'anyink-photo-dialog__zoom', { role: 'group' });
	els.zoomOut = zoomButton('zoomOut', 'view.zoomOut', '−');
	els.zoomOut.addEventListener('click', () => zoomBy(state, 1 / ZOOM_STEP));
	els.zoomIn = zoomButton('zoomIn', 'view.zoomIn', '+');
	els.zoomIn.addEventListener('click', () => zoomBy(state, ZOOM_STEP));
	zoom.append(els.zoomOut, els.zoomIn);
	under.append(hint, zoom);
	els.message = el('p', 'anyink-photo-dialog__message', {
		'aria-live': 'polite',
		'data-anyink-photo-message': '',
	});
	const row = el('div', 'anyink-modal__buttons');
	els.trace = button('trace', 'photo.dialog.traceIt', 'primary');
	els.trace.addEventListener('click', () => traceIt(state));
	row.appendChild(els.trace);
	if (state.known) {
		els.cancel = button('cancel', 'photo.dialog.cancel', 'outlined');
		els.cancel.classList.add('anyink-modal__button--end');
		els.cancel.addEventListener('click', () => state.modal.cancel());
		row.appendChild(els.cancel);
	} else {
		els.skip = button('skip', 'photo.dialog.skip', 'outlined');
		els.skip.classList.add('anyink-modal__button--quiet');
		els.skip.addEventListener('click', () => skip(state));
		els.done = button('done', 'photo.dialog.done', 'outlined');
		els.done.classList.add('anyink-modal__button--quiet');
		els.done.addEventListener('click', () => done(state));
		row.append(els.skip, els.done);
	}
	dialog.append(head, frame, under, els.message, row);
}

/** [-] or [+]: the canvas zoom bar's words; a press never takes the focus from the field. */
function zoomButton(name, key, symbol) {
	const element = el('button', 'anyink-modal__button anyink-photo-dialog__zoom-button', {
		type: 'button',
		'aria-label': word(key),
		title: word(key),
		'data-anyink-photo-action': name,
	});
	element.textContent = symbol;
	element.addEventListener('mousedown', (event) => event.preventDefault());
	return element;
}

// --------------------------------------------------------------
// Close up (finding 2)
// --------------------------------------------------------------

/** @returns {{width: Number, height: Number}} the view's inside (FALLBACK_VIEW with no layout) */
function viewSize(state) {
	const { view } = state.els;
	return {
		width: view.clientWidth || FALLBACK_VIEW.width,
		height: view.clientHeight || FALLBACK_VIEW.height,
	};
}

/** Sizes the photo: the whole photo fitted to the view, aspect kept, times the zoom. */
function sizeStage(state) {
	const { width, height } = viewSize(state);
	const whole = fitSize(width, height, state.width, state.height);
	state.zoom = Math.min(mostZoom(state.width, whole.width), Math.max(1, state.zoom));
	if (state.zoom < WHOLE_SNAP) state.zoom = 1;
	state.stage = {
		width: Math.round(whole.width * state.zoom),
		height: Math.round(whole.height * state.zoom),
	};
	const { stage, zoomOut, zoomIn } = state.els;
	stage.style.width = `${state.stage.width}px`;
	stage.style.height = `${state.stage.height}px`;
	// offered only while there is something smaller, or closer, to show
	const had = globalThis.document?.activeElement;
	zoomOut.hidden = state.zoom <= 1;
	zoomIn.hidden = state.zoom >= mostZoom(state.width, whole.width);
	// a zoom button that hides with the focus hands it on (finalize: the keys stopped working)
	if ((had === zoomOut && zoomOut.hidden) || (had === zoomIn && zoomIn.hidden)) {
		const other = had === zoomOut ? zoomIn : zoomOut;
		const next = !other.hidden ? other : state.els.field || state.els.stage;
		next?.focus?.({ preventScroll: true });
	}
}

/**
 * The stage in the view: screen pixels per photo pixel, and where its top-left corner sits in
 * the view's scrolled content (centered while it is smaller than the view).
 */
function stageMetrics(state) {
	const view = viewSize(state);
	return {
		k: state.stage.width / state.width,
		offX: Math.max(0, (view.width - state.stage.width) / 2),
		offY: Math.max(0, (view.height - state.stage.height) / 2),
		view,
	};
}

function scrollView(state, left, top) {
	const { view } = state.els;
	const m = stageMetrics(state);
	const clamp = (value, most) => Math.round(Math.min(Math.max(0, most), Math.max(0, value)));
	view.scrollLeft = clamp(left, state.stage.width - m.view.width);
	view.scrollTop = clamp(top, state.stage.height - m.view.height);
}

/**
 * Brings a part into view: into the middle when asked or when it isn't wholly in view now; a
 * part already in view stays where it is.
 * @param {Object} state
 * @param {Object | null} part
 * @param {{center?: Boolean}} [options]
 */
function reveal(state, part, { center = false } = {}) {
	if (!part || !state.sized) return;
	const { view } = state.els;
	const m = stageMetrics(state);
	const box = {
		left: part.left * m.k + m.offX,
		top: part.top * m.k + m.offY,
		right: part.right * m.k + m.offX,
		bottom: part.bottom * m.k + m.offY,
	};
	const room = REVEAL_MARGIN_PX;
	const inView =
		box.left - room >= view.scrollLeft &&
		box.top - room >= view.scrollTop &&
		box.right + room <= view.scrollLeft + m.view.width &&
		box.bottom + room <= view.scrollTop + m.view.height;
	if (inView && !center) return;
	scrollView(
		state,
		(box.left + box.right) / 2 - m.view.width / 2,
		(box.top + box.bottom) / 2 - m.view.height / 2
	);
}

/**
 * Zooms by a factor, keeping one spot of the photo where it is on screen: the pointer's, else
 * the green box's while it is in view, else the view's middle.
 * @param {Object} state
 * @param {Number} factor
 * @param {{x: Number, y: Number}} [pointer] - in the view, from its top-left corner
 */
function zoomBy(state, factor, pointer) {
	if (!state.sized || state.modal.closed) return;
	const { view } = state.els;
	const m = stageMetrics(state);
	let spot = pointer;
	if (!spot && state.picked) {
		const cx = ((state.picked.left + state.picked.right) / 2) * m.k + m.offX - view.scrollLeft;
		const cy = ((state.picked.top + state.picked.bottom) / 2) * m.k + m.offY - view.scrollTop;
		if (cx >= 0 && cy >= 0 && cx <= m.view.width && cy <= m.view.height) spot = { x: cx, y: cy };
	}
	spot ||= { x: m.view.width / 2, y: m.view.height / 2 };
	const photoX = (spot.x + view.scrollLeft - m.offX) / m.k;
	const photoY = (spot.y + view.scrollTop - m.offY) / m.k;
	state.zoom *= factor;
	sizeStage(state);
	render(state);
	const after = stageMetrics(state);
	scrollView(state, photoX * after.k + after.offX - spot.x, photoY * after.k + after.offY - spot.y);
}

/** Ctrl + the wheel zooms where the pointer is; the wheel alone scrolls, as anywhere. */
function onWheel(state, event) {
	if (!event.ctrlKey) return;
	event.preventDefault();
	const rect = state.els.view.getBoundingClientRect();
	zoomBy(state, Math.exp(-event.deltaY * WHEEL_RATE), {
		x: event.clientX - (rect.left || 0),
		y: event.clientY - (rect.top || 0),
	});
}

// --------------------------------------------------------------
// Drawing the state
// --------------------------------------------------------------

/** Every part, the box he drew, the field, the message and the buttons, as the state says. */
function render(state) {
	const { record, els } = state;
	els.parts.replaceChildren();
	const list = partsInOrder(record.parts);
	if (state.drawn) list.push(state.drawn);
	const skipped = new Set(record.skipped || []);
	// name tags go where they cover no other letter at the size the photo shows now
	const tagRoom = state.sized
		? { scale: state.stage.width / state.width, tag: TAG_SIZE, bounds: state.stage }
		: null;
	const named = new Set(
		list.filter((part) => part.id !== DRAWN_ID && usedChar(record, part.id)).map((p) => p.id)
	);
	const tags = tagRoom ? placeTags(list, { ...tagRoom, named }) : null;
	for (const part of list) {
		const box = el('div', 'anyink-photo-dialog__part', { 'data-anyink-part': part.id });
		place(state, box, part);
		const char = part.id === DRAWN_ID ? '' : usedChar(record, part.id);
		if (char) {
			box.classList.add('anyink-photo-dialog__part--used');
			box.title = word('photo.dialog.usedFor', { name: letterName(char) });
			const spot = tags?.get(part.id)?.spot || 'above';
			box.appendChild(
				el('span', `anyink-photo-dialog__tag anyink-photo-dialog__tag--${spot}`, {}, char)
			);
		}
		if (skipped.has(part.id)) box.classList.add('anyink-photo-dialog__part--skipped');
		if (part.drawn) box.classList.add('anyink-photo-dialog__part--drawn');
		if (state.picked && state.picked.id === part.id) {
			box.classList.add('anyink-photo-dialog__part--picked');
			box.setAttribute('data-anyink-picked', '');
		}
		els.parts.appendChild(box);
	}
	if (els.thats) {
		els.thats.textContent = state.char
			? word('photo.dialog.thats', { name: letterName(state.char) })
			: '';
	}
	els.message.textContent = messageText(state);
	// One green button: Trace it, or Done when there is nothing to trace (letter unknown)
	const nothing = !state.known && !state.picked;
	els.trace.hidden = nothing;
	if (els.done) {
		els.done.classList.toggle('anyink-primary', nothing);
		els.done.classList.toggle('anyink-outlined', !nothing);
		els.done.classList.toggle('anyink-modal__button--quiet', !nothing);
	}
	if (els.skip) els.skip.hidden = nothing;
}

/** @returns {String} the sentence under the photo */
function messageText(state) {
	if (state.message) return word(state.message);
	// a part that may hold two touching letters: box each one (finalize)
	if (state.picked && !state.picked.drawn && mayBeTwoLetters(state.record, state.picked.id)) {
		return word('photo.dialog.twoLetters');
	}
	if (state.picked) return '';
	const none = !state.record.parts.length;
	if (state.known) return none ? word('photo.dialog.noneFoundKnown') : '';
	return word(none ? 'photo.dialog.noneFound' : 'photo.dialog.allNamed');
}

/** Places an element over a box in photo pixels, as shares of the photo, so any size fits. */
function place(state, element, box) {
	const pct = (value, of) => `${(value / of) * 100}%`;
	element.style.left = pct(box.left, state.width);
	element.style.top = pct(box.top, state.height);
	element.style.width = pct(box.right - box.left, state.width);
	element.style.height = pct(box.bottom - box.top, state.height);
}

// --------------------------------------------------------------
// Picking
// --------------------------------------------------------------

function partById(state, id) {
	if (id === DRAWN_ID) return state.drawn;
	return state.record.parts.find((part) => part.id === id) || null;
}

/**
 * Picks a part (or nothing). Letter unknown: the field follows, unless he typed in it.
 * @param {Object} state
 * @param {Object | null} part
 */
function pick(state, part) {
	state.picked = part;
	if (part?.id !== DRAWN_ID) state.drawn = null;
	if (state.message !== 'photo.dialog.typeFirst') state.message = '';
	if (!state.known && !(state.source === 'typed' && state.char)) {
		const used = part && part.id !== DRAWN_ID ? usedChar(state.record, part.id) : '';
		if (used) setField(state, used, 'used');
		else setField(state, part ? prefillChar(state.record, boxedFor(part)) : '', 'prefill');
	}
	render(state);
	// close up, the green box comes into view wherever it moved (finding 2)
	reveal(state, part);
}

/**
 * What photo_registry.js prefillChar reads as the green box (it prefills only the part right
 * after the last one named): a found part by its id, a box he drew by its edges.
 * @param {Object} part
 * @returns {String | {left: Number, top: Number, right: Number, bottom: Number}}
 */
function boxedFor(part) {
	if (part.id !== DRAWN_ID) return part.id;
	return { left: part.left, top: part.top, right: part.right, bottom: part.bottom };
}

function setField(state, char, source) {
	state.char = char;
	state.source = char ? source : '';
	if (state.els.field) state.els.field.value = char;
}

/** @returns {{x: Number, y: Number, perPx: Number}} the event's spot in photo pixels */
function photoPoint(state, event) {
	const rect = state.els.stage.getBoundingClientRect();
	const width = rect.width > 0 ? rect.width : state.width;
	const height = rect.height > 0 ? rect.height : state.height;
	const perPx = state.width / width;
	return {
		x: (event.clientX - (rect.left || 0)) * perPx,
		y: (event.clientY - (rect.top || 0)) * (state.height / height),
		perPx,
	};
}

function onPress(state, event) {
	if (event.button !== 0) return;
	// no text selection, and the focus stays where it is (the field, letter unknown)
	event.preventDefault();
	const start = photoPoint(state, event);
	const drag = { start, startX: event.clientX, startY: event.clientY, moved: false, end: start };
	const move = (e) => {
		if (!drag.moved) {
			const far = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
			if (far < DRAG_START_PX) return;
			drag.moved = true;
		}
		drag.end = photoPoint(state, e);
		showDragBox(state, drag);
	};
	const up = (e) => {
		endDrag(state);
		if (drag.moved) {
			drag.end = photoPoint(state, e);
			finishBox(state, drag);
		} else {
			clickAt(state, start);
		}
	};
	endDrag(state);
	globalThis.addEventListener('mousemove', move);
	globalThis.addEventListener('mouseup', up);
	state.drag = () => {
		globalThis.removeEventListener('mousemove', move);
		globalThis.removeEventListener('mouseup', up);
	};
}

function endDrag(state) {
	state.drag?.();
	state.drag = null;
	if (state.els?.dragBox) state.els.dragBox.hidden = true;
	state.els?.stage?.classList.remove('anyink-photo-dialog__stage--dragging');
}

function boxOf(state, drag) {
	const clampX = (v) => Math.min(state.width, Math.max(0, v));
	const clampY = (v) => Math.min(state.height, Math.max(0, v));
	return {
		left: clampX(Math.min(drag.start.x, drag.end.x)),
		top: clampY(Math.min(drag.start.y, drag.end.y)),
		right: clampX(Math.max(drag.start.x, drag.end.x)),
		bottom: clampY(Math.max(drag.start.y, drag.end.y)),
	};
}

function showDragBox(state, drag) {
	const box = state.els.dragBox;
	place(state, box, boxOf(state, drag));
	box.hidden = false;
	// one green box at a time: the one being drawn
	state.els.stage.classList.add('anyink-photo-dialog__stage--dragging');
}

/** A box he dragged: the tight box round its ink becomes the pick (stored at Trace it). */
function finishBox(state, drag) {
	const box = boxOf(state, drag);
	let tight = null;
	if (state.mask) {
		tight = partFromBox(state.mask, state.width, state.height, box, { ink: state.ink });
	} else if (box.right - box.left >= 1 && box.bottom - box.top >= 1) {
		tight = {
			left: Math.floor(box.left),
			top: Math.floor(box.top),
			right: Math.ceil(box.right),
			bottom: Math.ceil(box.bottom),
		};
	}
	if (!tight) {
		state.message = 'photo.dialog.noInkBox';
		render(state);
		return;
	}
	state.drawn = { ...tight, id: DRAWN_ID, drawn: true };
	pick(state, state.drawn);
	focusField(state);
}

/** A click: the part under it (its box grown by a few screen pixels), else the pick stays. */
function clickAt(state, point) {
	const reach = CLICK_REACH_PX * point.perPx;
	const drawn = state.drawn && partAt([state.drawn], point.x, point.y, { reach });
	const part = drawn || partAt(state.record.parts, point.x, point.y, { reach });
	if (part) pick(state, part);
	focusField(state);
}

/** Letter unknown: his next step is typing the letter, so the field takes the focus. */
function focusField(state) {
	const { field } = state.els;
	if (!field || state.modal.closed) return;
	field.focus({ preventScroll: true });
	field.select?.();
}

/** Arrow keys on the photo: the next or previous part in reading order. */
function moveByKey(state, key) {
	const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[key];
	if (!step) return false;
	const order = partsInOrder(state.record.parts);
	if (!order.length) return true;
	const at = state.picked ? order.findIndex((p) => p.id === state.picked.id) : -1;
	const next = at < 0 ? (step > 0 ? 0 : order.length - 1) : at + step;
	pick(state, order[Math.min(order.length - 1, Math.max(0, next))]);
	return true;
}

// --------------------------------------------------------------
// The field and the buttons
// --------------------------------------------------------------

function onType(state, event) {
	const char = typedChar(state.char, state.els.field.value, event.data);
	setField(state, char, 'typed');
	if (char) state.els.field.select?.();
	if (state.message === 'photo.dialog.typeFirst' && char) state.message = '';
	render(state);
}

/** The dialog's own keys (the shell blocks the rest from the editor). */
function onDialogKey(state, event) {
	if (event.key === 'Enter' && state.els.field && event.target === state.els.field) {
		traceIt(state);
		return true;
	}
	// arrow keys move the green box, from the photo or from the one-letter field
	const arrowsFrom = [state.els.stage, state.els.field].filter(Boolean);
	if (arrowsFrom.includes(event.target) && moveByKey(state, event.key)) return true;
	// letter unknown: a letter key wherever the focus is lands in the field
	const { field } = state.els;
	if (field && event.target !== field && isLetterKey(event)) {
		setField(state, event.key, 'typed');
		if (state.message === 'photo.dialog.typeFirst') state.message = '';
		render(state);
		focusField(state);
		return true;
	}
	return false;
}

/** A key that types one visible character (no Ctrl, Alt or Meta; not Space). */
function isLetterKey(event) {
	if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return false;
	return isOneChar(event.key);
}

function traceIt(state) {
	const { record } = state;
	const char = state.known || state.char;
	if (!state.picked) {
		state.message = 'photo.dialog.pickFirst';
		render(state);
		return;
	}
	if (!char) {
		state.message = 'photo.dialog.typeFirst';
		render(state);
		state.els.field?.focus();
		return;
	}
	let { picked } = state;
	let mask = null;
	const drawn = picked.id === DRAWN_ID;
	if (drawn) {
		mask = picked.mask || null;
		const stored = addDrawnPart(record, picked);
		if (!stored) {
			state.message = 'photo.dialog.noInkBox';
			render(state);
			return;
		}
		picked = stored;
	}
	const part = { ...storedCopy(picked) };
	if (mask) part.mask = mask;
	const { onTrace } = state.handlers;
	state.modal.close();
	tell('onTrace', onTrace, { partId: part.id, char, part, drawn });
}

/** A part's plain fields, as the work file stores them. */
function storedCopy(part) {
	const out = {
		id: part.id,
		left: part.left,
		top: part.top,
		right: part.right,
		bottom: part.bottom,
		row: Number.isInteger(part.row) ? part.row : 0,
	};
	if (part.drawn) out.drawn = true;
	return out;
}

function skip(state) {
	const { picked } = state;
	if (picked && picked.id !== DRAWN_ID && skipPart(state.record, picked.id)) {
		tell('onChange', state.handlers.onChange, { what: 'skip', partId: picked.id });
	}
	state.drawn = null;
	setField(state, '', '');
	// (Skip shows only while the letter is unknown; a known letter would guide the guess)
	const next = guessPart(state.record, state.known ? { char: state.known } : {});
	pick(state, next ? partById(state, next) : null);
	focusField(state);
}

function done(state) {
	markDone(state.record, true);
	const { onDone } = state.handlers;
	state.modal.close();
	tell('onDone', onDone, state.record);
}

/** @returns {Boolean} one visible character */
function isOneChar(value) {
	return typeof value === 'string' && Array.from(value).length === 1 && value.trim() !== '';
}
