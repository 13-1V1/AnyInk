// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 Try it, the strip side (UX-BEGINNER.md 4.6): the preview strip grows to fill the page area
	under the top bar; the top bar and its Next line stay. The strip element, its sheet and the
	renderer in it are never rebuilt: Try it is a class on the strip and a few elements of its own
	that show only while it is open. Simple only, with the 'tryIt' flag.

	  +----------------------------------------------------------------------+
	  | Try it                                                       [Done]  |  head
	  | +------------------------------------------------------------------+ |
	  | |   Brennan Hand    (his letters, 72 pt; stand-ins for the rest)   | |  the strip's sheet
	  | +------------------------------------------------------------------+ |
	  | Gap between two letters looks off? Point between them and drag ...   |  hint
	  | (slot 'note': the Word note, word_note.js)                           |
	  | [ text ] [Samples v]  72 pt --o--  Guide lines (o)                   |  the strip's controls
	  | (slot 'spacing': Move all letters closer or further apart)           |
	  | (slot 'gaps': Gaps you fixed)                                        |
	  | Your font builds OK.                                                 |  font_check_line.js
	  +----------------------------------------------------------------------+

	Ways in: the rail's step 2 (topbar/doors.js 'anyink-open-try-it'), the Next line's [Try it]
	(coach action 'tryIt', { open: 'letterSpacing' } from the board's Letter spacing...), the
	strip's [Big preview]. Ways out: [Done], Esc, any page change (step 1, the logo, a
	double-clicked letter, Show me), a switch to All tools.
	While it is open the letter under it hears no plain keys (tool keys, Delete, arrows): only the
	keys the strip's controls use (preview/strip_keys.js stripOwnsKey: its text field and sheet,
	a slider's arrows, Enter / Space on a button) and Ctrl / Alt combinations (Undo, Redo, Save)
	get through. A press from a summary, button or switch in the strip is no exception: Delete or
	an arrow there still never reaches the letter.
	The hint line under the sheet carries the stand-ins' legend while it applies (legendLine,
	shown by the strip).
	[Done] is green while the Next line holds no button (rule 5); with rule 4's [Use in Word] it
	is outlined, so the screen has one green button (principle 1). B16: it is outlined too while
	any dialog is open over Try it (Use in Word, Font details, an upstream box): the dialog has its
	own green button. A dialog coming or going on the page redraws it (a watch on the body's
	children, beside the coach's word).
	The coach hears 'tryItOpen' and reads the strip's text as the Try-it text.

	Slots for the gap-fix track (src/anyink/tryit letter_spacing.js, gap_handle.js, gap_list.js,
	word_note.js): getTryItSlot('note' | 'spacing' | 'gaps' | 'sheet'); 'sheet' lies over the
	letters (pointer-events: none; a child turns them on for itself). The strip says
	'anyink-try-it-change' { open, section, cause } on window, and 'anyink-strip-redraw' on the
	strip after every redraw of its letters (preview_strip.js STRIP_REDRAW_EVENT). install() puts
	those four pieces in their slots (each install*(controller) of theirs) and uninstall() takes
	them out again.

	  TRY_IT_CHANGE_EVENT, TRY_IT_PT_PREF, TRY_IT_DEFAULT_PT, TRY_IT_SLOTS
	  canOpenTryIt({ simple, isOn })
	  makeTryIt(strip, { doc })        -> the controller; the strip calls it once in build()
	    { elements, slots, isOpen, open({ section, cause }), close({ cause }), install(),
	      uninstall(), updateDone(), measureTop() }
	  getTryIt()                       the controller of the strip on the page (the newest)
	  isTryItOpen(), openTryIt(args), closeTryIt(args), getTryItSlot(name)
*/
import { getCoach, setCoachFact, setCoachSource } from '../coach/coach_state.js';
import { setCoachAction } from '../coach/actions.js';
import { DIALOG_SELECTOR, openDialogName } from '../coach/dom_probe.js';
import { defaultTryItText } from '../coach/font_facts.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode, MODE_EVENT } from '../mode/mode.js';
import { TRY_IT_EVENT } from '../topbar/doors.js';
import { word } from '../words/words.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import { stripOwnsKey } from '../preview/strip_keys.js';
import style from './tryit.css?inline';
import { installGapHandle } from './gap_handle.js';
import { installGapList } from './gap_list.js';
import { installLetterSpacing } from './letter_spacing.js';
import { installWordNote } from './word_note.js';

/** B12 integration: the gap-fix pieces that live in Try it's slots, installed with it. */
const SLOT_PIECES = [installGapHandle, installLetterSpacing, installGapList, installWordNote];

export const TRY_IT_CHANGE_EVENT = 'anyink-try-it-change';
export const TRY_IT_PT_PREF = 'tryItPt';
/** 4.6: "his letters, 72 pt" */
export const TRY_IT_DEFAULT_PT = 72;
export const TRY_IT_SLOTS = Object.freeze(['note', 'spacing', 'gaps', 'sheet']);
export const OPEN_CLASS = 'is-try-it';
export const TOP_VAR = '--anyink-tryit-top';
const STYLE_ID = 'anyink-tryit-style';
const PAGE_CHANGE_EVENT = 'anyink-page-change';
const CONTEXT_MENU = '#context-menu';

/** @type {Object | null} */
let current = null;

/**
 * @param {{simple?: Boolean, isOn?: (name: String) => Boolean}} [options]
 * @returns {Boolean}
 */
export function canOpenTryIt({ simple = isSimpleMode(), isOn = isFeatureOn } = {}) {
	return !!simple && isOn('tryIt') === true;
}

/**
 * @param {HTMLElement & Object} strip - the <preview-strip>; it calls back:
 *   strip.onTryItChange(open) to swap its size and redraw, strip.canvasWrapper (the sheet),
 *   strip.options.text, strip.editor
 * @param {{doc?: Document}} [options]
 */
export function makeTryIt(strip, { doc = strip?.ownerDocument || document } = {}) {
	injectStyleOnce(STYLE_ID, style, doc);
	const make = (tag, className, attributes = {}) => {
		const element = doc.createElement(tag);
		element.className = className;
		Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
		return element;
	};

	const head = make('div', 'anyink-tryit__head');
	const title = make('h2', 'anyink-tryit__title');
	title.textContent = word('tryit.title');
	const done = make('button', 'anyink-tryit__done anyink-primary', {
		type: 'button',
		title: word('tryit.doneTip'),
	});
	done.textContent = word('tryit.done');
	done.addEventListener('click', () => controller.close({ cause: 'done' }));
	head.append(title, done);

	// the hint line under the sheet: the gap tip, then the stand-ins' legend while it applies
	const hint = make('p', 'anyink-tryit__hint');
	const hintText = make('span', 'anyink-tryit__hint-text');
	hintText.textContent = word('tryit.hint');
	const legendLine = make('span', 'anyink-tryit__legend-line');
	legendLine.textContent = word('tryit.legendLine');
	legendLine.hidden = true;
	hint.append(hintText, legendLine);

	/** @type {Object<String, HTMLElement>} */
	const slots = {};
	TRY_IT_SLOTS.forEach((name) => {
		slots[name] = make('div', `anyink-tryit__slot anyink-tryit__slot--${name}`, {
			'data-anyink-tryit-slot': name,
		});
	});

	const bigPreview = make('button', 'preview-strip__big anyink-tryit__big', {
		type: 'button',
		title: word('tryit.bigPreviewTip'),
		'data-anyink-strip': 'bigPreview',
	});
	bigPreview.innerHTML = `<span class="anyink-tryit__big-icon" aria-hidden="true"></span>`;
	bigPreview.appendChild(doc.createTextNode(word('tryit.bigPreview')));
	bigPreview.addEventListener('click', () => controller.open({ cause: 'bigPreview' }));

	let open = false;
	let unsubscribeCoach = null;
	const listeners = [];
	const listen = (target, type, fn, options) => {
		target?.addEventListener?.(type, fn, options);
		listeners.push(() => target?.removeEventListener?.(type, fn, options));
	};

	const announce = (detail) => {
		globalThis.dispatchEvent?.(new CustomEvent(TRY_IT_CHANGE_EVENT, { detail }));
	};

	const anyDialogOpen = () =>
		!!doc.querySelector(CONTEXT_MENU) ||
		[...doc.querySelectorAll(DIALOG_SELECTOR)].some((element) => !element.hidden);

	/** @param {EventTarget} target @returns {Boolean} the strip's text field or its sheet */
	const isTextTarget = (target) =>
		!!target && (target === strip.textInput || target === strip.renderer);

	/** @param {KeyboardEvent} event */
	const onKeyDown = (event) => {
		if (!open) return;
		const target = /** @type {Node} */ (event.target);
		const inStrip = !!target && strip.contains?.(target);
		if (event.key === 'Escape') {
			if (anyDialogOpen()) return;
			event.preventDefault();
			event.stopPropagation();
			controller.close({ cause: 'escape' });
			return;
		}
		// the strip's own keys: its text field and sheet, a slider's arrows, Enter / Space on a button
		if (inStrip && stripOwnsKey(event, { isTextTarget })) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return; // Undo, Redo, Save
		if (event.key === 'Tab') return;
		const inDialog = target instanceof Element && !!target.closest?.(DIALOG_SELECTOR);
		if (inDialog || anyDialogOpen()) return;
		// tool keys, Delete and arrows never reach the letter under Try it
		event.stopPropagation();
	};

	const controller = {
		strip,
		elements: { head, title, done, hint, legendLine, bigPreview },
		slots,
		get isOpen() {
			return open;
		},

		/**
		 * @param {{section?: String, cause?: String}} [args] - section: a closed section to open
		 *   ('letterSpacing'), told to its owner in the change event
		 * @returns {Boolean} true when Try it is open after the call
		 */
		open({ section = '', cause = '' } = {}) {
			if (!canOpenTryIt()) return false;
			if (open) {
				if (section) announce({ open: true, section, cause });
				return true;
			}
			open = true;
			controller.measureTop();
			strip.classList.add(OPEN_CLASS);
			strip.setAttribute('aria-label', word('tryit.title'));
			strip.onTryItChange?.(true);
			setFact(true);
			controller.updateDone();
			announce({ open: true, section, cause });
			return true;
		},

		/**
		 * @param {{cause?: String}} [args]
		 * @returns {Boolean} true when it was open
		 */
		close({ cause = '' } = {}) {
			if (!open) return false;
			open = false;
			strip.classList.remove(OPEN_CLASS);
			strip.removeAttribute('aria-label');
			strip.onTryItChange?.(false);
			setFact(false);
			announce({ open: false, section: '', cause });
			return true;
		},

		/** The strip's top: the bottom of the top bar and its Next line. */
		measureTop() {
			const bar = doc.querySelector('#app__top-bar');
			const bottom = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
			strip.style.setProperty(TOP_VAR, `${bottom}px`);
			return bottom;
		},

		/** [Done] is green unless the Next line holds a button of its own (rule 4). */
		updateDone() {
			const green = doneIsGreen(doc);
			done.classList.toggle('anyink-primary', green);
			done.classList.toggle('anyink-outlined', !green);
			return green;
		},

		/** Doors in, Esc, the key guard, the coach. Called by the strip when it connects. */
		install() {
			controller.uninstall();
			current = controller;
			const win = doc.defaultView || globalThis;
			listen(win, TRY_IT_EVENT, (event) =>
				controller.open({ cause: event?.detail?.cause || 'rail' })
			);
			listen(win, PAGE_CHANGE_EVENT, () => controller.close({ cause: 'page' }));
			listen(win, MODE_EVENT, () => {
				if (!canOpenTryIt()) controller.close({ cause: 'mode' });
			});
			listen(win, 'resize', () => {
				if (open) controller.measureTop();
			});
			listen(win, 'keydown', onKeyDown, true);
			setCoachAction('tryIt', (args) =>
				controller.open({ section: args?.open || '', cause: 'coach' })
			);
			setCoachSource('tryItText', (editor) =>
				strip.editor && editor === strip.editor
					? String(strip.options?.text ?? '')
					: defaultTryItText(editor?.project)
			);
			// the purple gap handle, Letter spacing, "Gaps you fixed" and the Word note
			SLOT_PIECES.forEach((installPiece) => listeners.push(installPiece(controller, { win })));
			// B16: a dialog put on the page or taken off it (upstream's boxes never tell the coach)
			const Observer = win.MutationObserver;
			if (Observer && doc.body) {
				const watch = new Observer(() => {
					if (open) controller.updateDone();
				});
				watch.observe(doc.body, { childList: true });
				listeners.push(() => watch.disconnect());
			}
			try {
				unsubscribeCoach = getCoach().subscribe(() => controller.updateDone());
			} catch {
				unsubscribeCoach = null;
			}
		},

		uninstall() {
			listeners.splice(0).forEach((off) => off());
			if (unsubscribeCoach) unsubscribeCoach();
			unsubscribeCoach = null;
			if (current === controller) {
				current = null;
				setCoachAction('tryIt', null);
				setCoachSource('tryItText', null);
			}
		},
	};
	return controller;
}

/** @param {Boolean} value */
function setFact(value) {
	try {
		setCoachFact('tryItOpen', value);
	} catch {
		// no coach on a bare test page
	}
}

/**
 * @param {Document} doc
 * @returns {Boolean} no dialog is open and the Next line holds no button of its own
 */
function doneIsGreen(doc) {
	if (openDialogName(doc)) return false;
	try {
		const coach = getCoach();
		if (coach.isHidden?.()) return true;
		return !coach.line()?.button;
	} catch {
		return true;
	}
}

/** @returns {Object | null} the controller of the strip on the page */
export function getTryIt() {
	return current;
}

/** @returns {Boolean} */
export function isTryItOpen() {
	return !!current?.isOpen;
}

/**
 * @param {{section?: String, cause?: String}} [args]
 * @returns {Boolean}
 */
export function openTryIt(args = {}) {
	return !!current?.open(args);
}

/**
 * @param {{cause?: String}} [args]
 * @returns {Boolean}
 */
export function closeTryIt(args = {}) {
	return !!current?.close(args);
}

/**
 * @param {String} name - 'note' | 'spacing' | 'gaps' | 'sheet'
 * @returns {HTMLElement | null}
 */
export function getTryItSlot(name) {
	return current?.slots?.[name] || null;
}
