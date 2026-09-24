// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: the Trace panel (Milestone 7).
	Owner: TRACK C (import + panel).

	Hook: src/panels/panels.js calls makePanel_Trace when editor.nav.panel === 'Trace'
	(listed in src/project_editor/navigator.js for Characters, Ligatures, and Components,
	right after Layers). Subscriber ids made here start with 'anyink.trace.panel':
	panels.js removes every id containing that text when another panel opens.

	For the item on the canvas:
	- no trace: one card that says how to add an image, a 'Choose an image...' button, and
	  a note that the image is reference only and never exported;
	- a trace: a thumbnail (one object URL per image Blob, reused when the panel is rebuilt
	  for the same image, revoked a moment after the image changes),
	  'Replace image...' and 'Remove image'; an opacity slider (5 to 100 %, live redraw per
	  tick, one history entry on release); Show / Invert colors / Draw glyph as outline
	  toggles; Lock, 'Fit to em', 'Fit to cap height', and a position readout that follows
	  canvas drags. Every trace change is one history entry. 'Draw glyph as outline' is
	  upstream's canvas display mode (a view setting, no history entry): tracing under a
	  filled glyph hides the image.

	The panel never keeps a reference to the item: undo replaces the glyph object, so every
	action looks the item up again. One host element (display: contents) holds the cards;
	it is rebuilt only when the item, the trace's image, or the trace's presence changes,
	and updated in place otherwise, so a canvas drag or an undo never rebuilds the slider
	under the pointer.

	Keyboard (fix): a checkbox, the slider, or a button clicked with the mouse keeps the
	keyboard focus, and clicking the canvas never takes it back (upstream cancels mousedown
	there), so undo, save, nudges, tool keys, and paste stopped working and Space flipped
	the checkbox. After a mouse or pen press in the panel ends, whatever it focused lets go
	(handKeysBackAfterPointer). Keyboard users who Tab in keep their focus.

	Drops (fix): the panel host takes file drops (trace_drop.js) and hands them to the
	canvas's own drop handler, so a photo dropped on the card is traced exactly as on the
	canvas, and the cards light up while a file is over them.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { showToast } from '../../controls/dialogs/dialogs.js';
import { handleDropSVGonEditCanvas } from '../../edit_canvas/events_drag_drop_paste.js';
import { makeSliderRow } from '../controls/slider_row.js';
import { isTraceableItem } from './paste_drop.js';
import { makeFileDropTarget } from './trace_drop.js';
import { fitBands, fitTraceToBand, isUsableBand, placementSummary } from './trace_fit.js';
import { pickTraceImage, removeTrace } from './trace_import.js';
import { OPACITY_MIN, TRACE_DEFAULTS, getTrace, setTrace } from './trace_model.js';
import './trace.css';

// --------------------------------------------------------------
// Words the user sees
// --------------------------------------------------------------

export const EMPTY_TEXT =
	'Drop a photo or scan of your lettering on the canvas or here, or choose one.';
export const REFERENCE_NOTE =
	'PNG, JPEG, or WebP. The image is for reference only: it is saved with the project but never exported in the font.';
export const MISSING_TEXT =
	'The picture for this trace is missing from the project file. Replace it or remove it.';
export const DRAG_HINT =
	'With the Resize tool (the arrow), drag an empty part of the image to move it, or a corner to resize it. Press a shape to select it. Hold Shift to resize from the center. The drawing tools always draw over the image.';
export const LOCKED_HINT = 'Locked: the image stays put. Unlock it to move or resize it.';

/** History titles. */
export const historyTitles = Object.freeze({
	opacity: (percent) => `Set trace opacity to ${percent}%`,
	show: (on) => (on ? 'Showed the trace image' : 'Hid the trace image'),
	lock: (on) => (on ? 'Locked the trace image' : 'Unlocked the trace image'),
	invert: (on) => (on ? 'Inverted the trace image colors' : 'Restored the trace image colors'),
	fitEm: 'Fit the trace image to the em',
	fitCap: 'Fit the trace image to the cap height',
});

// --------------------------------------------------------------
// Pub/sub
// --------------------------------------------------------------

/** Follows canvas drags, undo / redo, and item switches. */
export const PANEL_SYNC_ID = 'anyink.trace.panel.sync';
/** Keeps 'Draw glyph as outline' in step with the canvas toolbar's fill / outline button. */
export const PANEL_VIEW_ID = 'anyink.trace.panel.displayMode';

/** Class on the panel host while a dragged file is over it. */
export const DROP_HOVER_CLASS = 'anyink-trace-panel--drop';

/** Tags that keep the focus after a mouse press: fields the user types into. */
const TYPING_TAGS = ['textarea', 'input-number'];
const TYPING_INPUT_TYPES = ['text', 'number', 'search', 'email', 'url', 'tel', 'password'];

const SYNC_TOPICS = [
	'traceLayer',
	'currentItem',
	'whichGlyphIsSelected',
	'whichLigatureIsSelected',
	'whichComponentIsSelected',
];

// One live thumbnail URL for the whole app, for one Blob. Integration fix: undo, redo and
// page changes rebuild the panel several times a second, and a fresh URL per rebuild
// revoked the one a just-detached <img> was still about to fetch ("Failed to load
// resource" in the console). Now a rebuild for the same Blob reuses its URL, and a
// replaced URL is revoked only after THUMBNAIL_REVOKE_DELAY_MS.
export const THUMBNAIL_REVOKE_DELAY_MS = 1000;
let thumbnail = { blob: null, url: null };
const pendingRevokes = new Map(); // url -> timer

// --------------------------------------------------------------
// Panel
// --------------------------------------------------------------

/**
 * @returns {HTMLElement[]} the panel cards, inside one host element (display: contents)
 */
export function makePanel_Trace() {
	const editor = getCurrentProjectEditor();
	const panel = {
		editor,
		host: makeElement({ tag: 'div', className: 'anyink-trace-panel' }),
		key: '',
		controls: null,
		opacityStart: null,
		publishing: false,
		shown: '',
	};
	build(panel);
	handKeysBackAfterPointer(panel.host);
	makeFileDropTarget(panel.host, {
		hoverClass: DROP_HOVER_CLASS,
		// The canvas's own handler: an image becomes the trace, an SVG file imports its shapes
		onDrop: (event) => handleDropSVGonEditCanvas(event),
	});

	editor.subscribe({
		topic: SYNC_TOPICS,
		subscriberID: PANEL_SYNC_ID,
		callback: () => sync(panel),
	});
	editor.subscribe({
		topic: 'editCanvasView',
		subscriberID: PANEL_VIEW_ID,
		callback: () => syncDisplayMode(panel),
	});

	return [panel.host];
}

/**
 * The item the panel is about: the item on the canvas, looked up without creating it.
 * @param {Object} editor
 * @returns {Object | null} a Glyph (glyph, ligature, or component), or null
 */
function currentItem(editor) {
	const id = editor?.selectedItemID;
	if (!id || !editor.project) return null;
	const item = editor.project.getItem(id);
	return isTraceableItem(item) ? item : null;
}

function structureKey(editor, item, trace) {
	const id = editor.selectedItemID || '';
	if (!trace) return `${editor.nav.page}|${id}|none`;
	return `${editor.nav.page}|${id}|${trace.asset}|${editor.assets?.has(trace.asset) ? 1 : 0}`;
}

function sync(panel) {
	if (panel.publishing) return;
	const { editor } = panel;
	const item = currentItem(editor);
	const trace = getTrace(item);
	if (structureKey(editor, item, trace) !== panel.key) build(panel);
	else updateValues(panel);
}

function build(panel) {
	const { editor, host } = panel;
	host.innerHTML = '';
	panel.controls = null;
	panel.opacityStart = null;
	panel.shown = '';

	const item = currentItem(editor);
	const trace = getTrace(item);
	panel.key = structureKey(editor, item, trace);

	if (!trace) {
		releaseThumbnail();
		host.appendChild(makeEmptyCard(panel));
		return;
	}

	panel.controls = {};
	host.appendChild(makeImageCard(panel, trace));
	host.appendChild(makeLookCard(panel, trace));
	host.appendChild(makePositionCard(panel));
	updateValues(panel);
}

// --------------------------------------------------------------
// Cards
// --------------------------------------------------------------

function makeCard(title) {
	const card = makeElement({ tag: 'div', className: 'panel__card anyink-trace-panel__card' });
	card.appendChild(makeElement({ tag: 'h3', content: title }));
	return card;
}

function makeText(text, className = 'anyink-trace-panel__text') {
	const p = makeElement({ tag: 'p', className });
	p.textContent = text;
	return p;
}

function makeButton(text, { title = '', primary = false, onClick } = {}) {
	const button = makeElement({
		tag: 'button',
		className: primary ? 'button__call-to-action' : '',
		attributes: { type: 'button' },
	});
	button.textContent = text;
	if (title) button.setAttribute('title', title);
	if (onClick) button.addEventListener('click', onClick);
	return button;
}

function makeToggle(text, { title = '', onChange } = {}) {
	const label = makeElement({ tag: 'label', className: 'anyink-trace-panel__toggle' });
	const input = makeElement({ tag: 'input', attributes: { type: 'checkbox' } });
	label.appendChild(input);
	label.appendChild(document.createTextNode(text));
	if (title) label.setAttribute('title', title);
	if (onChange) input.addEventListener('change', () => onChange(input.checked));
	return { label, input };
}

function makeEmptyCard(panel) {
	const card = makeCard('Trace image');
	card.appendChild(makeText(EMPTY_TEXT));
	const buttons = makeElement({ tag: 'div', className: 'anyink-trace-panel__buttons' });
	buttons.appendChild(
		makeButton('Choose an image...', {
			primary: true,
			title: 'Pick a PNG, JPEG, or WebP photo or scan to draw over',
			// The picker opens inside this click (transient activation), before anything async
			onClick: () => pickTraceImage({ editor: panel.editor }),
		})
	);
	card.appendChild(buttons);
	card.appendChild(makeText(REFERENCE_NOTE, 'anyink-trace-panel__note'));
	return card;
}

function makeImageCard(panel, trace) {
	const { editor, controls } = panel;
	const card = makeCard('Trace image');

	const row = makeElement({ tag: 'div', className: 'anyink-trace-panel__image' });
	const frame = makeElement({ tag: 'div', className: 'anyink-trace-panel__thumb-frame' });
	const blob = editor.assets?.get(trace.asset)?.blob;
	if (!blob) releaseThumbnail();
	const url = blob ? thumbnailURLFor(blob) : null;
	if (url) {
		const img = makeElement({
			tag: 'img',
			className: 'anyink-trace-panel__thumb',
			attributes: { alt: 'The trace image', draggable: 'false' },
		});
		img.setAttribute('src', url);
		frame.appendChild(img);
		controls.thumb = img;
	} else {
		frame.classList.add('anyink-trace-panel__thumb-frame--empty');
		frame.textContent = blob ? 'Trace image' : 'Missing';
	}
	row.appendChild(frame);

	const about = makeElement({ tag: 'div', className: 'anyink-trace-panel__about' });
	if (blob) {
		about.appendChild(
			makeText(`${trace.width} × ${trace.height} pixels`, 'anyink-trace-panel__size')
		);
		about.appendChild(
			makeText('Reference only. Never exported in the font.', 'anyink-trace-panel__note')
		);
	} else {
		about.appendChild(makeText(MISSING_TEXT, 'anyink-trace-panel__missing'));
	}
	row.appendChild(about);
	card.appendChild(row);

	const buttons = makeElement({ tag: 'div', className: 'anyink-trace-panel__buttons' });
	buttons.appendChild(
		makeButton('Replace image...', {
			title: 'Pick another image; it keeps this position and height',
			onClick: () => pickTraceImage({ editor }),
		})
	);
	buttons.appendChild(
		makeButton('Remove image', {
			title: 'Take the trace image off this glyph (undo brings it back)',
			onClick: () => removeTrace({ editor }),
		})
	);
	card.appendChild(buttons);
	return card;
}

function makeLookCard(panel, trace) {
	const { editor, controls } = panel;
	const card = makeCard('Appearance');

	const opacity = makeSliderRow({
		id: 'anyink-trace-opacity',
		label: 'Opacity',
		value: toPercent(trace.opacity),
		neutral: toPercent(TRACE_DEFAULTS.opacity),
		min: Math.round(OPACITY_MIN * 100),
		max: 100,
		step: 1,
		unit: '%',
		onInput: (percent) => previewOpacity(panel, percent),
		onChange: (percent) => commitOpacity(panel, percent),
	});
	controls.opacity = opacity;
	card.appendChild(opacity.element);

	const show = makeToggle('Show', {
		title: 'Show or hide the trace image on the canvas',
		onChange: (on) => changeFlag(panel, 'visible', on, historyTitles.show(on)),
	});
	controls.show = show.input;
	card.appendChild(show.label);

	const invert = makeToggle('Invert colors', {
		title: 'Draw the image as a negative: dark ink shows up on the slate canvas',
		onChange: (on) => changeFlag(panel, 'invert', on, historyTitles.invert(on)),
	});
	controls.invert = invert.input;
	card.appendChild(invert.label);

	const outline = makeToggle('Draw glyph as outline', {
		title:
			'A filled glyph hides the image under it. This is the same as the fill / outline button on the canvas.',
		onChange: (on) => {
			editor.project.settings.app.canvasDisplayModeFilled = !on;
			editor.publish('editCanvasView', editor.view);
		},
	});
	controls.outline = outline.input;
	card.appendChild(outline.label);
	return card;
}

function makePositionCard(panel) {
	const { controls } = panel;
	const card = makeCard('Size and position');

	const lock = makeToggle('Lock', {
		title: 'Keep the image from moving while you draw over it',
		onChange: (on) => changeFlag(panel, 'locked', on, historyTitles.lock(on)),
	});
	controls.lock = lock.input;
	card.appendChild(lock.label);

	const buttons = makeElement({ tag: 'div', className: 'anyink-trace-panel__buttons' });
	controls.fitEm = makeButton('Fit to em', {
		title: 'Scale the image so its height runs from the ascent line down to the descent line',
		onClick: () => fitTo(panel, 'em'),
	});
	controls.fitCap = makeButton('Fit to cap height', {
		title: 'Scale the image so its height runs from the cap height line down to the baseline',
		onClick: () => fitTo(panel, 'cap'),
	});
	buttons.appendChild(controls.fitEm);
	buttons.appendChild(controls.fitCap);
	card.appendChild(buttons);

	controls.readout = makeText('', 'anyink-trace-panel__readout');
	card.appendChild(controls.readout);
	controls.hint = makeText(DRAG_HINT, 'anyink-trace-panel__note anyink-trace-panel__hint');
	card.appendChild(controls.hint);
	return card;
}

// --------------------------------------------------------------
// Keeping the controls in step with the data
// --------------------------------------------------------------

function updateValues(panel) {
	const { editor, controls } = panel;
	if (!controls) return;
	const trace = getTrace(currentItem(editor));
	if (!trace) return;

	// 'currentItem' fires on every point-drag tick while the user draws over the image:
	// touch the DOM only when something the panel shows has changed
	const font = editor.project.settings.font;
	const shown = [
		trace.x,
		trace.y,
		trace.scale,
		trace.opacity,
		trace.visible,
		trace.locked,
		trace.invert,
		font.ascent,
		font.descent,
		font.capHeight,
		panel.opacityStart,
	].join('|');
	if (shown === panel.shown) return;
	panel.shown = shown;

	if (panel.opacityStart === null) controls.opacity.value = toPercent(trace.opacity);
	controls.show.checked = trace.visible !== false;
	controls.invert.checked = !!trace.invert;
	controls.lock.checked = !!trace.locked;
	syncDisplayMode(panel);

	const bands = fitBands(font);
	controls.fitEm.disabled = !!trace.locked || !isUsableBand(bands.em);
	controls.fitCap.disabled = !!trace.locked || !isUsableBand(bands.cap);

	const place = placementSummary(trace);
	controls.readout.textContent = `Top left: ${place.x}, ${place.y} · Size: ${place.width} × ${place.height} font units`;
	controls.hint.textContent = trace.locked ? LOCKED_HINT : DRAG_HINT;

	if (controls.thumb) {
		controls.thumb.classList.toggle('anyink-trace-panel__thumb--inverted', !!trace.invert);
		controls.thumb.classList.toggle('anyink-trace-panel__thumb--hidden', trace.visible === false);
	}
}

function syncDisplayMode(panel) {
	const outline = panel.controls?.outline;
	if (!outline) return;
	outline.checked = !panel.editor.project?.settings?.app?.canvasDisplayModeFilled;
}

// --------------------------------------------------------------
// Actions (each one looks the item up again: undo replaces glyph objects)
// --------------------------------------------------------------

function toPercent(opacity) {
	const value = Number.isFinite(Number(opacity)) ? Number(opacity) : TRACE_DEFAULTS.opacity;
	return Math.round(Math.min(1, Math.max(OPACITY_MIN, value)) * 100);
}

/** Publishes 'traceLayer' (the canvas redraws) without the panel reacting to itself. */
function publishTraceLayer(panel, item) {
	panel.publishing = true;
	try {
		panel.editor.publish('traceLayer', item);
	} finally {
		panel.publishing = false;
		// The panel changed the trace itself, so what it last showed is stale: the next
		// sync (an undo back to the old value, say) must repaint
		panel.shown = '';
	}
}

function previewOpacity(panel, percent) {
	const item = currentItem(panel.editor);
	const trace = getTrace(item);
	if (!trace) return;
	if (panel.opacityStart === null) panel.opacityStart = toPercent(trace.opacity);
	setTrace(item, { ...trace, opacity: percent / 100 });
	publishTraceLayer(panel, item);
}

function commitOpacity(panel, percent) {
	const { editor } = panel;
	const item = currentItem(editor);
	const trace = getTrace(item);
	const start = panel.opacityStart;
	panel.opacityStart = null;
	if (!trace) return;
	const before = start === null ? toPercent(trace.opacity) : start;
	if (toPercent(trace.opacity) !== percent) setTrace(item, { ...trace, opacity: percent / 100 });
	if (percent !== before) editor.history.addState(historyTitles.opacity(percent));
	publishTraceLayer(panel, item);
}

function changeFlag(panel, key, on, title) {
	const { editor } = panel;
	const item = currentItem(editor);
	const trace = getTrace(item);
	if (!trace) return;
	if (!!trace[key] !== !!on) {
		setTrace(item, { ...trace, [key]: !!on });
		editor.history.addState(title);
		publishTraceLayer(panel, item);
	}
	updateValues(panel);
}

function fitTo(panel, which) {
	const { editor } = panel;
	const item = currentItem(editor);
	const trace = getTrace(item);
	if (!trace || trace.locked) return;
	const band = fitBands(editor.project.settings.font)[which];
	const next = fitTraceToBand(trace, band.top, band.bottom);
	if (!next) return;
	const same = ['x', 'y', 'scale'].every((k) => Math.abs(next[k] - trace[k]) < 1e-9);
	if (same) {
		showToast(
			which === 'em' ? 'The image already fits the em.' : 'The image already fits the cap height.'
		);
		return;
	}
	setTrace(item, next);
	editor.history.addState(which === 'em' ? historyTitles.fitEm : historyTitles.fitCap);
	publishTraceLayer(panel, item);
	updateValues(panel);
}

// --------------------------------------------------------------
// Keyboard focus
// --------------------------------------------------------------

/**
 * After a mouse or pen press inside root ends, the control it focused lets go of the
 * keyboard, so shortcuts reach the canvas again. Runs a moment after the release: Chrome
 * focuses a checkbox during the click that follows pointerup when its label is clicked,
 * and a slider fires its change (the history entry) on release first.
 * @param {HTMLElement} root - the panel host
 */
export function handKeysBackAfterPointer(root) {
	root.addEventListener('pointerdown', () => {
		const view = root.ownerDocument?.defaultView;
		if (!view) return;
		const release = () => {
			view.removeEventListener('pointerup', release, true);
			view.removeEventListener('pointercancel', release, true);
			view.setTimeout(() => letGoOfKeys(root), 0);
		};
		view.addEventListener('pointerup', release, true);
		view.addEventListener('pointercancel', release, true);
	});
}

function letGoOfKeys(root) {
	const active = root.ownerDocument?.activeElement;
	if (!active || active === root.ownerDocument.body || !root.contains(active)) return;
	if (isTypingField(active)) return;
	if (typeof active.blur === 'function') active.blur();
}

function isTypingField(element) {
	const tag = String(element.tagName || '').toLowerCase();
	if (TYPING_TAGS.includes(tag) || element.isContentEditable) return true;
	return tag === 'input' && TYPING_INPUT_TYPES.includes(String(element.type).toLowerCase());
}

// --------------------------------------------------------------
// Thumbnail URL
// --------------------------------------------------------------

/**
 * The thumbnail URL for an image Blob: the live one when it is the same Blob, else a new
 * one (the previous URL is released).
 * @param {Blob} blob
 * @returns {String | null}
 */
function thumbnailURLFor(blob) {
	if (thumbnail.blob === blob && thumbnail.url) return thumbnail.url;
	releaseThumbnail();
	if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
	try {
		thumbnail = { blob, url: URL.createObjectURL(blob) };
	} catch {
		thumbnail = { blob: null, url: null };
	}
	return thumbnail.url;
}

/** Forgets the live thumbnail URL and revokes it after THUMBNAIL_REVOKE_DELAY_MS. */
function releaseThumbnail() {
	const { url } = thumbnail;
	thumbnail = { blob: null, url: null };
	if (!url || pendingRevokes.has(url)) return;
	pendingRevokes.set(
		url,
		setTimeout(() => revokeNow(url), THUMBNAIL_REVOKE_DELAY_MS)
	);
}

function revokeNow(url) {
	clearTimeout(pendingRevokes.get(url));
	pendingRevokes.delete(url);
	if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
		URL.revokeObjectURL(url);
	}
}

/** Tests: revoke every released thumbnail URL now instead of after the delay. */
export function flushThumbnailRevokes() {
	for (const url of [...pendingRevokes.keys()]) revokeNow(url);
}
