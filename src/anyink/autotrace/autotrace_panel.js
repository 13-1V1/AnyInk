// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: the Auto-trace card in the Trace panel (Milestone 8).
	Owner: TRACK C (session, panel card, css).

	Hook: src/anyink/trace/trace_panel.js build() appends makeAutoTraceCard({ editor, item,
	startSlot }) after the Size and position card whenever it returns an element, and passes
	the Trace image card's button row as startSlot. The Trace panel rebuilds its cards when
	the item, the image, or the trace's presence changes (and upstream refreshes the whole
	panel on every glyph or shape selection), so the card keeps no state of its own: it
	draws whatever autotrace_session.js says, through onSessionChange, and a rebuilt card
	comes back exactly as it was.

	- makeAutoTraceCard({ editor, item, startSlot }) -> HTMLElement | null (null when the
	  item has no trace).
	  Collapsed (no session for this item): 'Auto-trace', 'Turn this image into outlines you
	  can edit.', and 'Start auto-trace' (disabled, with the reason, when the browser cannot
	  run the worker or the picture is missing).
	  startSlot (optional, fix): the card also puts a 'Start auto-trace' button first in that
	  element (the Trace image card, which is in view right after an image is added, while
	  this card sits below the fold). It hides while the preview is open and while
	  auto-trace cannot start (this card says why).
	  Starting (either button) scrolls the panel so the open card shows (revealInPanel).
	  Open: Mode (Scan / Photo); Threshold (0 to 100 %, 'less ink' / 'more ink' under the
	  bar ends, shows the value the image picked while on Auto, and switches to a hand-set
	  value on drag; 'Auto' goes back; its reset button is hidden and a double-click on its
	  readout means Auto too); Smoothing and Detail (0 to 100 %, reset to the defaults);
	  'Remove specks', 'Light ink on dark paper', 'Only inside the glyph box'; one readout
	  line ('3 shapes, 412 points, traced in 180 ms', 'Tracing...', or 'Auto-trace failed:
	  <reason>'); one advice line (photoAdvice): above MANY_POINTS points 'Many points: ...'
	  (in Scan mode it names Photo first), and in Scan mode, when a traced shape runs into
	  the edge of the traced area (a shadow or dim paper from a phone photo merged with the
	  letter), EDGE_PHOTO_TEXT; in Scan mode the line has a 'Try Photo' button. Then
	  'Replace outlines', 'Add to outlines', 'Cancel'. Every control calls updateOptions at
	  once (the session debounces the re-trace); nothing enters history until Replace or Add.
	  Finalize, 09/24/2026:
	  - A preview the facade refused ('too-many', 'shapes-outside-box') shows its message as
	    advice (no 'Auto-trace failed:'), and Replace and Add stay off until a control
	    changes (the session refuses them too).
	  - dropped > 0 in the result: 'N shapes outside the glyph box are left out.'
	  - The session's notice (Replace gave up: the image kept moving) stays on its own line
	    while the preview traces again.
	  - The advice reads the traced area from the result (result.area, with the sides the
	    glyph box rule cut) and the paper evenness (result.paperSpread): a shape cut by the
	    box margin gets BOX_EDGE_TEXT; ink at the image's own edge suggests Photo only when
	    the paper is uneven (a clean scan cut tight does not); in Scan the many-points line
	    names Photo only then too; in Photo with a hand-set Threshold it names Auto first.
	  - Switching the mode (the buttons or Try Photo) sets Threshold back to Auto: a
	    hand-set cutoff means another thing in the other mode (80 % in Photo flooded).
	  - The Replace / Add / Cancel row sticks to the bottom of the panel while the card
	    runs past it (an advice line appearing after Start pushed it out of view).
	- Keyboard: Escape ends the session from anywhere, unless a text field has the focus, a
	  dialog is open, or something else used the key first (a trace image drag). Enter on a
	  slider or on the card itself means Replace outlines (its tooltip says so); Enter on a
	  checkbox or a button does not (fix: a slip while tuning replaced the outlines).
	  Starting or canceling from the keyboard moves the focus to the next sensible control.
	- The one pub/sub subscriber, PANEL_OUTLINES_ID ('anyink.autotrace.panel.outlines'),
	  keeps the Replace button's tooltip counting the glyph's shapes. panels.js removes it
	  when another panel opens; a rebuilt card takes it over (same id).
	Colors come from autotrace.css, tokens only.
*/
import { makeElement } from '../../common/dom.js';
import { deepActiveElement } from '../controls/focus_release.js';
import { makeSliderRow, makeSliderTable } from '../controls/slider_row.js';
import { getTrace } from '../trace/trace_model.js';
import {
	APPLY_BLOCKING_CODES,
	applySession,
	cancelSession,
	getSession,
	onSessionChange,
	startSession,
	updateOptions,
} from './autotrace_session.js';
import { AUTOTRACE_DEFAULTS } from './params.js';
import { isAutoTraceAvailable } from './potrace_client.js';
import './autotrace.css';

// --------------------------------------------------------------
// Words the user sees
// --------------------------------------------------------------

export const CARD_TITLE = 'Auto-trace';
export const INTRO_TEXT = 'Turn this image into outlines you can edit.';
export const START_LABEL = 'Start auto-trace';
export const UNAVAILABLE_TEXT = 'This browser cannot run auto-trace. Use Chrome or Edge.';
export const MISSING_TEXT = 'The trace picture is missing, so there is nothing to trace.';
export const TRACING_TEXT = 'Tracing...';
export const APPLYING_TEXT = 'Tracing at full size...';
export const NO_SHAPES_TEXT = 'No ink found. Move Threshold, or turn on Light ink on dark paper.';
export const MANY_POINTS = 1000;
/** Photo mode: Photo is already on, so only the sliders are left to try. */
export const MANY_POINTS_TEXT = 'Many points: raise Smoothing or lower Detail.';
/** Scan mode: uneven light is the usual cause, and no slider fixes that (fix). */
export const MANY_POINTS_SCAN_TEXT =
	'Many points: for a phone photo with uneven light, try Photo. Otherwise raise Smoothing or lower Detail.';
/** Scan mode: a traced shape runs into the edge of the traced area (fix). */
export const EDGE_PHOTO_TEXT =
	'The ink runs into the edge of the traced area. If that is a shadow or dim paper from a photo, try Photo.';
/** Photo mode with a hand-set Threshold (finalize): Auto is the first thing to try. */
export const MANY_POINTS_HAND_TEXT =
	'Many points: press Auto for Threshold, or raise Smoothing or lower Detail.';
/** A shape runs into a side the glyph box rule cut (finalize): Photo cannot fix a cut. */
export const BOX_EDGE_TEXT =
	'The letter runs past the area traced around the glyph box and is cut off there. Make the image smaller over the glyph, or turn off "Only inside the glyph box".';
/** Paper brighter in one place than another by this many gray levels is uneven (a photo). */
export const UNEVEN_PAPER_SPREAD = 24;
export const BUTTON_LABELS = Object.freeze({
	scan: 'Scan',
	photo: 'Photo',
	auto: 'Auto',
	tryPhoto: 'Try Photo',
	replace: 'Replace outlines',
	add: 'Add to outlines',
	cancel: 'Cancel',
});
/** Words under the Threshold bar's two ends (fix: the direction was unclear). */
export const THRESHOLD_ENDS = Object.freeze(['less ink', 'more ink']);

/** Room left between an opened card and the panel's edge when it scrolls into view, px. */
export const REVEAL_MARGIN = 8;

/** A traced shape this close to the traced area's edge touches it, in traced pixels. */
const EDGE_TOLERANCE_PX = 2;

export const TOGGLE_LABELS = Object.freeze({
	despeckle: 'Remove specks',
	invert: 'Light ink on dark paper',
	insideBoxOnly: 'Only inside the glyph box',
});

/** The panel's one subscriber id (panels.js removes 'anyink.autotrace.panel*'). */
export const PANEL_OUTLINES_ID = 'anyink.autotrace.panel.outlines';

/**
 * '3 shapes, 412 points, traced in 180 ms'
 * @param {{shapes?: Array, points?: Number, ms?: Number}} result
 * @returns {String}
 */
export function readoutText(result) {
	const shapes = Array.isArray(result?.shapes) ? result.shapes.length : 0;
	const points = Math.max(0, Math.round(Number(result?.points) || 0));
	const ms = Math.max(0, Math.round(Number(result?.ms) || 0)).toLocaleString('en-US');
	return `${count(shapes, 'shape')}, ${count(points, 'point')}, traced in ${ms} ms`;
}

/**
 * The advice line under the readout, or null for none.
 * @param {{mode: 'scan' | 'photo', points: Number, touchesEdge?: Boolean,
 *   edge?: 'image' | 'box' | null, paperSpread?: Number, handSet?: Boolean}} args -
 *   edge: which kind of side of the traced area a shape runs into ('box': one the glyph
 *   box rule cut; touchesEdge true means 'image'); paperSpread: result.paperSpread (unknown
 *   counts as uneven); handSet: Threshold is set by hand
 * @returns {{text: String, tryPhoto: Boolean} | null} tryPhoto: offer the 'Try Photo' button
 */
export function photoAdvice({
	mode,
	points,
	touchesEdge = false,
	edge = null,
	paperSpread,
	handSet = false,
} = {}) {
	const scan = mode !== 'photo';
	const side = edge || (touchesEdge ? 'image' : null);
	const uneven = !Number.isFinite(paperSpread) || paperSpread >= UNEVEN_PAPER_SPREAD;
	if (side === 'box') return { text: BOX_EDGE_TEXT, tryPhoto: false };
	if (scan && side === 'image' && uneven) return { text: EDGE_PHOTO_TEXT, tryPhoto: true };
	if (Number(points) > MANY_POINTS) {
		if (scan) {
			return uneven
				? { text: MANY_POINTS_SCAN_TEXT, tryPhoto: true }
				: { text: MANY_POINTS_TEXT, tryPhoto: false };
		}
		return { text: handSet ? MANY_POINTS_HAND_TEXT : MANY_POINTS_TEXT, tryPhoto: false };
	}
	return null;
}

/**
 * @param {Number} n - shapes the glyph box rule left out
 * @returns {String} '1 shape outside the glyph box is left out.'
 */
export function droppedText(n) {
	return `${count(n, 'shape')} outside the glyph box ${n === 1 ? 'is' : 'are'} left out.`;
}

/**
 * @param {String} reason
 * @returns {String} 'Auto-trace failed: <reason>'
 */
export function failedText(reason) {
	return `Auto-trace failed: ${String(reason || 'something went wrong.')}`;
}

/** 0..255 cutoff -> 0..100 % on the slider. */
export function thresholdToPercent(threshold) {
	return Math.round((clampNumber(threshold, 0, 255) / 255) * 100);
}

/** 0..100 % on the slider -> 0..255 cutoff. */
export function percentToThreshold(percent) {
	return Math.round((clampNumber(percent, 0, 100) / 100) * 255);
}

const MODE_TITLES = {
	scan: 'A scan or a drawing on even white paper: one cutoff for the whole image. Switching sets Threshold back to Auto',
	photo:
		'A phone photo with uneven light: the cutoff follows the light across the page. Switching sets Threshold back to Auto',
};
const TOGGLE_TITLES = {
	despeckle: 'Clean up dust and tiny holes before tracing',
	invert:
		'Trace the light parts instead of the dark ones (chalk on a board, white on black). The Invert colors toggle above only changes how the image looks, not what is traced',
	insideBoxOnly:
		'Keep only the shapes whose middle is inside the glyph box (0 to the advance width, descender line to ascender line). A letter that reaches a little past the box is kept whole',
};
const SLIDER_TITLES = {
	// Ink is what is darker than the cutoff (lighter with Light ink on dark paper), so a
	// higher value takes in more of the image, in Scan and in Photo (fix: it read backwards)
	threshold:
		'Higher counts more of the image as ink: strokes get bolder. Lower keeps only the strongest ink',
	smoothing: 'Low keeps sharp corners; high rounds them off',
	detail: 'High keeps small bits and follows the edge closely, with more points',
};

/** Tags that keep typing keys (Escape and Enter stay theirs). */
const TYPING_TAGS = ['textarea', 'input-number', 'option-chooser'];
const TYPING_INPUT_TYPES = ['text', 'number', 'search', 'email', 'url', 'tel', 'password'];

/** The card on screen now; a new card replaces it. */
let activeView = null;
let keysInstalled = false;

// --------------------------------------------------------------
// The card
// --------------------------------------------------------------

/**
 * @param {{editor: Object, item: Object, startSlot?: HTMLElement}} args - startSlot: where
 *   to put a second Start button (the Trace image card's button row)
 * @returns {HTMLElement | null}
 */
export function makeAutoTraceCard({ editor, item, startSlot } = {}) {
	if (!editor || !item || !getTrace(item)) return null;

	const card = makeElement({
		tag: 'div',
		className: 'panel__card anyink-trace-panel__card anyink-autotrace-card',
		attributes: { tabindex: '-1', role: 'group', 'aria-label': CARD_TITLE },
	});
	card.appendChild(makeElement({ tag: 'h3', content: CARD_TITLE }));

	const view = {
		editor,
		item,
		itemId: item.id || editor.selectedItemID,
		card,
		collapsed: null,
		open: null,
		controls: null,
		quickStart: null,
		edge: null,
		lastAutoPercent: null,
		wasConnected: false,
		disposed: false,
		unlisten: null,
	};
	view.collapsed = makeCollapsedSection(view);
	card.appendChild(view.collapsed.element);
	card.addEventListener('keydown', (event) => handleCardKeyDown(view, event));
	if (startSlot && typeof startSlot.prepend === 'function') {
		view.quickStart = makeButton(START_LABEL, {
			primary: true,
			className: 'anyink-autotrace-quick-start',
			title:
				'Turn this image into outlines you can edit. Opens the Auto-trace preview below; nothing changes until you press Replace or Add.',
			onClick: (event) => startFromCard(view, event),
		});
		startSlot.prepend(view.quickStart);
	}

	if (activeView) disposeView(activeView);
	activeView = view;
	view.unlisten = onSessionChange(() => render(view));
	editor.subscribe({
		topic: 'currentItem',
		subscriberID: PANEL_OUTLINES_ID,
		callback: () => {
			if (activeView === view && view.controls) updateShapeCount(view);
		},
	});
	installKeys();
	render(view);
	return card;
}

function makeCollapsedSection(view) {
	const element = makeElement({ tag: 'div', className: 'anyink-autotrace-card__section' });
	element.appendChild(makeText(INTRO_TEXT, 'anyink-autotrace-card__text'));

	const buttons = makeElement({ tag: 'div', className: 'anyink-autotrace-card__buttons' });
	const start = makeButton(START_LABEL, {
		primary: true,
		title:
			'Preview the traced outlines over the image. Nothing changes until you press Replace or Add.',
		onClick: (event) => startFromCard(view, event),
	});
	buttons.appendChild(start);
	element.appendChild(buttons);

	const note = makeText('', 'anyink-autotrace-card__note');
	element.appendChild(note);
	return { element, start, note };
}

function makeOpenSection(view) {
	const controls = {};
	const element = makeElement({ tag: 'div', className: 'anyink-autotrace-card__section' });

	// Mode
	const modeRow = makeElement({ tag: 'div', className: 'anyink-autotrace-card__mode-row' });
	modeRow.appendChild(makeText('Mode', 'anyink-autotrace-card__label'));
	const mode = makeElement({
		tag: 'div',
		className: 'anyink-autotrace-mode',
		attributes: { role: 'group', 'aria-label': 'Mode' },
	});
	controls.mode = {};
	for (const value of ['scan', 'photo']) {
		const button = makeButton(BUTTON_LABELS[value], {
			className: 'anyink-autotrace-mode__button',
			title: MODE_TITLES[value],
			onClick: () => switchMode(value),
		});
		button.setAttribute('aria-pressed', 'false');
		button.dataset.mode = value;
		controls.mode[value] = button;
		mode.appendChild(button);
	}
	modeRow.appendChild(mode);
	element.appendChild(modeRow);

	// Sliders
	controls.threshold = makeSliderRow({
		id: 'anyink-autotrace-threshold',
		label: 'Threshold',
		value: 50,
		neutral: 50,
		min: 0,
		max: 100,
		step: 1,
		unit: '%',
		onInput: (percent) => updateOptions({ threshold: percentToThreshold(percent) }),
	});
	controls.threshold.element.classList.add('anyink-autotrace-card__threshold');
	controls.threshold.element.setAttribute('title', SLIDER_TITLES.threshold);
	// Which end is which, under the bar
	const ends = makeElement({
		tag: 'div',
		className: 'anyink-autotrace-card__ends',
		attributes: { 'aria-hidden': 'true' },
	});
	for (const word of THRESHOLD_ENDS) ends.appendChild(makeText(word, 'anyink-autotrace-card__end'));
	// Its reset would mean a fixed number; Auto is its reset (the button, or a double-click
	// on the readout, caught before the row's own handler)
	controls.threshold.resetButton.setAttribute('tabindex', '-1');
	controls.threshold.resetButton.setAttribute('aria-hidden', 'true');
	controls.threshold.readout.setAttribute('title', 'Double-click for Auto');
	controls.threshold.element.addEventListener(
		'dblclick',
		(event) => {
			if (event.target !== controls.threshold.readout) return;
			event.stopPropagation();
			if (!controls.threshold.bar.disabled) updateOptions({ threshold: 'auto' });
		},
		true
	);

	controls.auto = makeButton(BUTTON_LABELS.auto, {
		className: 'anyink-autotrace-card__auto',
		title: 'Let the image pick the cutoff',
		onClick: () => updateOptions({ threshold: 'auto' }),
	});
	controls.auto.setAttribute('aria-pressed', 'false');
	controls.autoNote = makeText('', 'anyink-autotrace-card__auto-note');
	const autoLine = makeElement({ tag: 'div', className: 'anyink-autotrace-card__auto-line' });
	autoLine.appendChild(controls.auto);
	autoLine.appendChild(controls.autoNote);

	controls.smoothing = makeSliderRow({
		id: 'anyink-autotrace-smoothing',
		label: 'Smoothing',
		value: toPercent(AUTOTRACE_DEFAULTS.smoothing),
		neutral: toPercent(AUTOTRACE_DEFAULTS.smoothing),
		min: 0,
		max: 100,
		step: 1,
		unit: '%',
		onInput: (percent) => updateOptions({ smoothing: percent / 100 }),
	});
	controls.smoothing.element.setAttribute('title', SLIDER_TITLES.smoothing);

	controls.detail = makeSliderRow({
		id: 'anyink-autotrace-detail',
		label: 'Detail',
		value: toPercent(AUTOTRACE_DEFAULTS.detail),
		neutral: toPercent(AUTOTRACE_DEFAULTS.detail),
		min: 0,
		max: 100,
		step: 1,
		unit: '%',
		onInput: (percent) => updateOptions({ detail: percent / 100 }),
	});
	controls.detail.element.setAttribute('title', SLIDER_TITLES.detail);

	const table = makeSliderTable([controls.threshold]);
	table.appendChild(ends);
	table.appendChild(autoLine);
	table.appendChild(controls.smoothing.element);
	table.appendChild(controls.detail.element);
	element.appendChild(table);

	// Toggles
	controls.toggles = {};
	for (const key of ['despeckle', 'invert', 'insideBoxOnly']) {
		const toggle = makeToggle(TOGGLE_LABELS[key], {
			title: TOGGLE_TITLES[key],
			onChange: (on) => updateOptions({ [key]: on }),
		});
		controls.toggles[key] = toggle.input;
		element.appendChild(toggle.label);
	}

	// Readout
	controls.readout = makeText('', 'anyink-autotrace-card__readout');
	controls.readout.setAttribute('role', 'status');
	controls.readout.setAttribute('aria-live', 'polite');
	element.appendChild(controls.readout);
	controls.dropped = makeText('', 'anyink-autotrace-card__dropped');
	controls.dropped.hidden = true;
	element.appendChild(controls.dropped);
	controls.notice = makeText('', 'anyink-autotrace-card__notice');
	controls.notice.setAttribute('role', 'status');
	controls.notice.hidden = true;
	element.appendChild(controls.notice);
	controls.warning = makeElement({ tag: 'div', className: 'anyink-autotrace-card__warning' });
	controls.warningText = makeText('', 'anyink-autotrace-card__warning-text');
	controls.tryPhoto = makeButton(BUTTON_LABELS.tryPhoto, {
		className: 'anyink-autotrace-card__try-photo',
		title: MODE_TITLES.photo,
		onClick: () => switchMode('photo'),
	});
	controls.warning.appendChild(controls.warningText);
	controls.warning.appendChild(controls.tryPhoto);
	controls.warning.hidden = true;
	element.appendChild(controls.warning);

	// Buttons: a row that stays at the bottom of the panel while the card runs past it
	const buttons = makeElement({
		tag: 'div',
		className: 'anyink-autotrace-card__buttons anyink-autotrace-card__actions',
	});
	controls.replace = makeButton(BUTTON_LABELS.replace, {
		primary: true,
		onClick: () => applyFromCard(view, 'replace'),
	});
	controls.add = makeButton(BUTTON_LABELS.add, {
		title: 'Keep the shapes this glyph has and add the traced ones (one Undo step)',
		onClick: () => applyFromCard(view, 'add'),
	});
	controls.cancel = makeButton(BUTTON_LABELS.cancel, {
		title: 'Close the preview without changing the glyph (Esc)',
		onClick: (event) => cancelFromCard(view, event),
	});
	buttons.appendChild(controls.replace);
	buttons.appendChild(controls.add);
	buttons.appendChild(controls.cancel);
	element.appendChild(buttons);

	return { element, controls };
}

// --------------------------------------------------------------
// Drawing the session
// --------------------------------------------------------------

/** The session when it is about this card's item, else null. */
function sessionFor(view) {
	const session = getSession();
	if (!session || session.editor !== view.editor || session.itemId !== view.itemId) return null;
	return session;
}

function render(view) {
	if (view.disposed) return;
	if (view.card.isConnected) view.wasConnected = true;
	else if (view.wasConnected) {
		// The panel dropped this card without a new one (another panel opened)
		disposeView(view);
		return;
	}
	const session = sessionFor(view);
	if (session) renderOpen(view, session);
	else renderCollapsed(view);
}

function renderCollapsed(view) {
	const { collapsed } = view;
	view.card.classList.remove('anyink-autotrace-card--open');
	collapsed.element.hidden = false;
	if (view.open) view.open.element.hidden = true;

	let reason = '';
	if (!isAutoTraceAvailable()) reason = UNAVAILABLE_TEXT;
	else if (!imageBlob(view)) reason = MISSING_TEXT;
	collapsed.start.disabled = !!reason;
	collapsed.note.textContent = reason;
	collapsed.note.hidden = !reason;
	// The image card's Start: only when it can start (this card says why not)
	if (view.quickStart) {
		view.quickStart.hidden = !!reason;
		view.quickStart.disabled = !!reason;
	}
}

function renderOpen(view, session) {
	if (!view.open) {
		view.open = makeOpenSection(view);
		view.controls = view.open.controls;
		view.card.appendChild(view.open.element);
		updateShapeCount(view);
	}
	const { controls } = view;
	view.card.classList.add('anyink-autotrace-card--open');
	view.collapsed.element.hidden = true;
	view.open.element.hidden = false;
	if (view.quickStart) view.quickStart.hidden = true;

	const { options, result, status } = session;
	const applying = !!session.applying;
	// The facade refused this preview (too many shapes, all outside the box): advice, and
	// nothing to put in
	const refused = status === 'error' && APPLY_BLOCKING_CODES.includes(session.errorCode);

	// Mode
	for (const [value, button] of Object.entries(controls.mode)) {
		button.setAttribute('aria-pressed', options.mode === value ? 'true' : 'false');
		button.disabled = applying;
	}

	// Threshold: the value the image picked while on Auto, else the hand-set one
	const auto = options.threshold === 'auto';
	const picked = Number.isFinite(result?.autoThreshold) ? result.autoThreshold : result?.threshold;
	if (auto && Number.isFinite(picked)) view.lastAutoPercent = thresholdToPercent(picked);
	const thresholdPercent = auto ? view.lastAutoPercent : thresholdToPercent(options.threshold);
	if (thresholdPercent !== null && controls.threshold.value !== thresholdPercent) {
		controls.threshold.value = thresholdPercent;
	}
	controls.threshold.element.classList.toggle('anyink-autotrace-card__threshold--auto', auto);
	controls.auto.setAttribute('aria-pressed', auto ? 'true' : 'false');
	controls.autoNote.textContent = auto ? 'Picked from the image' : 'Set by hand';

	setSlider(controls.smoothing, toPercent(options.smoothing));
	setSlider(controls.detail, toPercent(options.detail));
	for (const row of [controls.threshold, controls.smoothing, controls.detail]) {
		row.setDisabled(applying);
	}
	// The threshold row's reset stays out of reach (Auto is its reset)
	controls.threshold.resetButton.disabled = true;
	controls.auto.disabled = applying;

	for (const [key, input] of Object.entries(controls.toggles)) {
		input.checked = !!options[key];
		input.disabled = applying;
	}

	// Readout
	const shapes = Array.isArray(result?.shapes) ? result.shapes.length : 0;
	const points = Number(result?.points) || 0;
	let text;
	let kind = '';
	if (applying) {
		text = APPLYING_TEXT;
		kind = 'busy';
	} else if (refused) {
		text = String(session.error || '');
		kind = 'empty';
	} else if (status === 'error') {
		text = failedText(session.error);
		kind = 'error';
	} else if (!result) {
		text = TRACING_TEXT;
		kind = 'busy';
	} else if (!shapes) {
		text = NO_SHAPES_TEXT;
		kind = status === 'tracing' ? 'busy' : 'empty';
	} else {
		text = readoutText(result);
		kind = status === 'tracing' ? 'busy' : '';
	}
	if (controls.readout.textContent !== text) controls.readout.textContent = text;
	controls.readout.className = `anyink-autotrace-card__readout${
		kind ? ` anyink-autotrace-card__readout--${kind}` : ''
	}`;
	view.card.setAttribute('aria-busy', kind === 'busy' ? 'true' : 'false');
	const dropped = status !== 'error' ? Math.max(0, Math.round(Number(result?.dropped) || 0)) : 0;
	controls.dropped.hidden = !dropped;
	if (dropped) setText(controls.dropped, droppedText(dropped));
	controls.notice.hidden = !session.notice;
	if (session.notice) setText(controls.notice, failedText(session.notice));

	let advice = null;
	if (result && status !== 'error') {
		advice = photoAdvice({
			mode: options.mode,
			points,
			edge: tracedEdge(view, result),
			paperSpread: result.paperSpread,
			handSet: options.threshold !== 'auto',
		});
	}
	controls.warning.hidden = !advice;
	if (advice) {
		if (controls.warningText.textContent !== advice.text) {
			controls.warningText.textContent = advice.text;
		}
		controls.tryPhoto.hidden = !advice.tryPhoto;
		controls.tryPhoto.disabled = applying;
	}

	// Buttons: nothing to put in when the preview found no ink or was refused
	const nothing = (!!result && !shapes && status === 'ready') || refused;
	controls.replace.disabled = applying || nothing;
	controls.add.disabled = applying || nothing;
	controls.cancel.disabled = false;
}

function setSlider(row, value) {
	if (row.value !== value) row.value = value;
}

function setText(element, value) {
	if (element.textContent !== value) element.textContent = value;
}

/** Scan or Photo; a change of mode sets Threshold back to Auto (see the header). */
function switchMode(mode) {
	const session = getSession();
	if (!session) return;
	if (session.options.mode === mode) return;
	updateOptions({ mode, threshold: 'auto' });
}

function updateShapeCount(view) {
	const button = view.controls?.replace;
	if (!button) return;
	const n = liveItem(view)?.shapes?.length || 0;
	const shapes = count(n, 'shape');
	button.setAttribute(
		'title',
		n
			? `Take out this glyph's ${shapes} and put the traced ones in, one Undo step (Enter)`
			: 'This glyph has no shapes yet: put the traced ones in, one Undo step (Enter)'
	);
}

// --------------------------------------------------------------
// Does the trace run off the traced area? (Photo advice)
// --------------------------------------------------------------

/**
 * Which kind of side of the traced area a shape of the result runs into: 'box' when one of
 * them is a side the glyph box rule cut the image at (the letter is bigger than the box
 * plus its margin), else 'image' when one is the image's own edge (a shadow, dim paper or
 * the page edge that Scan took for ink, or a tight crop), else null. The facade gives the
 * area (result.area, font units, with `pixel` = font units per traced pixel and `cut`);
 * without it there is no hint. Worked out once per result.
 * @param {Object} view
 * @param {Object} result
 * @returns {'box' | 'image' | null}
 */
function tracedEdge(view, result) {
	if (view.edge?.result === result) return view.edge.value;
	let value = null;
	try {
		value = edgeOf(result);
	} catch (error) {
		console.warn('ANY-INK auto-trace: could not check the traced edges', error);
	}
	view.edge = { result, value };
	return value;
}

function edgeOf(result) {
	const area = result?.area;
	const shapes = Array.isArray(result?.shapes) ? result.shapes : [];
	if (!area || !shapes.length) return null;
	const { xMin, xMax, yMin, yMax } = area;
	if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return null;
	const pixel = Number(area.pixel) > 0 ? Number(area.pixel) : 0;
	const tolerance = EDGE_TOLERANCE_PX * pixel;
	const cut = area.cut || {};
	let image = false;
	for (const shape of shapes) {
		const b = boundsOf(shape);
		if (!b) continue;
		const touched = {
			left: b.xMin <= xMin + tolerance,
			right: b.xMax >= xMax - tolerance,
			bottom: b.yMin <= yMin + tolerance,
			top: b.yMax >= yMax - tolerance,
		};
		for (const [side, touches] of Object.entries(touched)) {
			if (!touches) continue;
			if (cut[side]) return 'box';
			image = true;
		}
	}
	return image ? 'image' : null;
}

/** A shape's bounding box in font units (Path.maxes, else its points), or null. */
function boundsOf(shape) {
	const m = shape?.maxes;
	if (m && [m.xMin, m.xMax, m.yMin, m.yMax].every(Number.isFinite)) return m;
	const points = Array.isArray(shape?.pathPoints) ? shape.pathPoints : [];
	const xs = points.map((pp) => Number(pp?.p?.x)).filter(Number.isFinite);
	const ys = points.map((pp) => Number(pp?.p?.y)).filter(Number.isFinite);
	if (!xs.length || !ys.length) return null;
	return {
		xMin: Math.min(...xs),
		xMax: Math.max(...xs),
		yMin: Math.min(...ys),
		yMax: Math.max(...ys),
	};
}

function disposeView(view) {
	if (view.disposed) return;
	view.disposed = true;
	if (view.unlisten) view.unlisten();
	view.unlisten = null;
	// The editor subscription is left alone: a new card has taken its id over, or
	// panels.js removes it with the rest of the panel
	if (activeView === view) activeView = null;
}

// --------------------------------------------------------------
// Actions
// --------------------------------------------------------------

function startFromCard(view, event) {
	const session = startSession({ editor: view.editor, item: liveItem(view) });
	if (!session) return;
	// The card may be below the fold (the image card's Start is at the top of the panel)
	revealInPanel(view.card);
	// Keyboard (Enter / Space on the button): carry the focus into the open card
	if (event?.detail === 0) {
		view.controls?.mode?.[session.options.mode]?.focus({ preventScroll: true });
	}
}

/**
 * Scrolls the nearest scrolling ancestor (the panel area) just enough that element shows:
 * its bottom comes up to the panel's bottom, but its top never goes above the panel's top
 * (a card taller than the panel shows its top). REVEAL_MARGIN px of room on either side.
 * @param {HTMLElement} element
 * @returns {Boolean} true when it scrolled
 */
export function revealInPanel(element) {
	const scroller = scrollParentOf(element);
	if (!scroller) return false;
	const view = scroller.getBoundingClientRect();
	const box = element.getBoundingClientRect();
	if (!(view.bottom > view.top)) return false;
	let delta = 0;
	if (box.bottom > view.bottom - REVEAL_MARGIN) delta = box.bottom - (view.bottom - REVEAL_MARGIN);
	if (box.top - delta < view.top + REVEAL_MARGIN) delta = box.top - (view.top + REVEAL_MARGIN);
	if (!delta) return false;
	const top = scroller.scrollTop + delta;
	if (typeof scroller.scrollTo === 'function') {
		const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
		scroller.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
	} else {
		scroller.scrollTop = top;
	}
	return true;
}

function scrollParentOf(element) {
	const view = element?.ownerDocument?.defaultView;
	if (!view) return null;
	for (let node = element.parentElement; node; node = node.parentElement) {
		const overflow = view.getComputedStyle(node).overflowY;
		if (overflow === 'auto' || overflow === 'scroll') return node;
	}
	return null;
}

function applyFromCard(view, mode) {
	if (!sessionFor(view)) return;
	const hadFocus = view.card.contains(deepActiveElement(view.card.ownerDocument));
	Promise.resolve(applySession(mode))
		.then((applied) => {
			if (applied && hadFocus && view.card.isConnected) view.card.focus();
		})
		.catch((error) => console.warn('ANY-INK auto-trace: apply failed', error));
}

function cancelFromCard(view, event) {
	cancelSession();
	if (event?.detail === 0 && !view.collapsed.start.disabled) view.collapsed.start.focus();
}

/** The item as the project has it now (undo swaps glyph objects). */
function liveItem(view) {
	return view.editor.project?.getItem(view.itemId) || view.item;
}

function imageBlob(view) {
	const trace = getTrace(liveItem(view));
	return trace ? view.editor.assets?.get(trace.asset)?.blob || null : null;
}

// --------------------------------------------------------------
// Keyboard
// --------------------------------------------------------------

function handleCardKeyDown(view, event) {
	if (event.key !== 'Enter' || event.defaultPrevented || event.repeat) return;
	if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
	// Only a slider or the card itself: a button does its own thing on Enter, and Enter on a
	// checkbox is an easy slip while tuning with the keyboard (fix)
	const target = event.target;
	const slider =
		String(target?.tagName).toLowerCase() === 'input' &&
		String(target.type).toLowerCase() === 'range';
	if (target !== view.card && !slider) return;
	const session = sessionFor(view);
	if (!session || session.applying) return;
	event.preventDefault();
	applyFromCard(view, 'replace');
}

/**
 * Escape ends the session (see the header).
 * @param {KeyboardEvent} event
 * @returns {Boolean} true when it ended one
 */
export function handleAutoTraceEscape(event) {
	if (event?.key !== 'Escape' || event.defaultPrevented) return false;
	if (!getSession()) return false;
	const doc = event.target?.ownerDocument || globalThis.document;
	if (isTypingField(deepActiveElement(doc))) return false;
	if (doc?.querySelector?.('dialog')) return false;
	cancelSession();
	event.preventDefault();
	return true;
}

function installKeys() {
	if (keysInstalled || typeof document === 'undefined') return;
	keysInstalled = true;
	// Bubble phase: the trace layer's capture handler cancels an image drag first and
	// stops the event, and the preview strip keeps its own keys
	document.addEventListener('keydown', handleAutoTraceEscape);
}

function isTypingField(element) {
	if (!element || typeof element.tagName !== 'string') return false;
	const tag = element.tagName.toLowerCase();
	if (TYPING_TAGS.includes(tag) || element.isContentEditable) return true;
	return tag === 'input' && TYPING_INPUT_TYPES.includes(String(element.type).toLowerCase());
}

// --------------------------------------------------------------
// Small builders
// --------------------------------------------------------------

function makeText(text, className) {
	const p = makeElement({ tag: 'p', className });
	p.textContent = text;
	return p;
}

function makeButton(text, { title = '', primary = false, className = '', onClick } = {}) {
	const classes = [primary ? 'button__call-to-action' : '', className].filter(Boolean).join(' ');
	const button = makeElement({
		tag: 'button',
		className: classes,
		attributes: { type: 'button' },
	});
	button.textContent = text;
	if (title) button.setAttribute('title', title);
	if (onClick) button.addEventListener('click', onClick);
	return button;
}

function makeToggle(text, { title = '', onChange } = {}) {
	const label = makeElement({ tag: 'label', className: 'anyink-autotrace-card__toggle' });
	const input = makeElement({ tag: 'input', attributes: { type: 'checkbox' } });
	label.appendChild(input);
	label.appendChild(document.createTextNode(text));
	if (title) label.setAttribute('title', title);
	if (onChange) input.addEventListener('change', () => onChange(input.checked));
	return { label, input };
}

function toPercent(fraction) {
	return Math.round(clampNumber(fraction, 0, 1) * 100);
}

function clampNumber(value, min, max) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.min(max, Math.max(min, n));
}

function count(n, word) {
	return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}
