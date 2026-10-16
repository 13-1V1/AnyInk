// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12: "Move all letters closer or further apart" in Try it (UX-BEGINNER.md 4.6; 7.2; 7.3). A
	closed section with a slider, "closer --o-- further apart", and [Reset]. Live while dragging
	(spacing/auto_space.js setExtra on every tick, the 'letterSpacing' topic with dragging true);
	on release ONE whole-font Undo step about no letter, "moved all letters closer". The extra goes
	on both sides of every letter, automatic or set by him, apart from each letter's own spacing
	(settings.anyink.spacing.extra); a side never goes below zero unless it already was, so the far
	left end means letters touch, never overlap; photos move with the shapes (all setExtra's).
	The open letter stays still on screen while it moves (the drawing never jumps).
	B12 fix pass: Undo and Redo wait while the slider is held (undo_hold.js); a drag whose font
	was swapped under it anyway (a whole-font Undo) starts its step from the new font's spacing,
	never from the old font's.

	  LETTER_SPACING_TOPIC                 'letterSpacing' ({ extra, dragging })
	  previewExtra(editor, value)          one live tick; returns the extra it took
	  commitExtra(editor, from, to, { reset })
	                                       the release: the step from where the drag began to
	                                       where it ended; false (no step) when they are the same
	  makeLetterSpacingSection({ getEditor })
	                                       { element (<details>), open(), refresh(), detach() };
	                                       the Try it shell mounts it (open() for the board's
	                                       "Letter spacing...", { open: 'letterSpacing' })
	  installLetterSpacing(controller)     puts it in Try it's 'spacing' slot (expand.js) and opens
	                                       it when Try it opens with section 'letterSpacing';
	                                       returns an uninstall function
*/
import { getExtra, extraRange } from '../spacing/extra.js';
import { setExtra } from '../spacing/auto_space.js';
import { clampExtra } from '../spacing/gap_rule.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import { word, wordEntry } from '../words/words.js';
import { holdUndoKeys } from './undo_hold.js';

export const LETTER_SPACING_TOPIC = 'letterSpacing';
/** expand.js TRY_IT_CHANGE_EVENT (not imported: expand.js may import this file) */
const TRY_IT_CHANGE = 'anyink-try-it-change';
const SYNC_ID = 'anyink.letterSpacing.sync';
const STYLE_ID = 'anyink-letter-spacing-style';
const STYLE = `
.anyink-tryit-spacing__row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 0 2px 18px;
	flex-wrap: wrap;
}
.anyink-tryit-spacing__row input[type='range'] { flex: 1 1 160px; min-width: 120px; accent-color: var(--structure-deep); }
.anyink-tryit-spacing summary { cursor: pointer; }
`;

/** Keeps the open letter where it was on screen after its shapes moved by dx. */
function keepOpenLetterStill(editor, moved) {
	try {
		const id = editor?._selectedItemID ?? editor?.selectedItemID;
		const entry = Array.isArray(moved) ? moved.find((m) => m.id === id) : null;
		if (!entry?.dx) return;
		const view = editor.view;
		if (!view || !Number.isFinite(view.dx) || !Number.isFinite(view.dz)) return;
		editor.view = { dx: view.dx - entry.dx * view.dz };
	} catch {
		// no letter open: nothing to keep still
	}
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Number} value - requested extra, font units
 * @returns {Number} the extra it took (whole, -G..+G)
 */
export function previewExtra(editor, value) {
	const { extra, moved } = setExtra(editor.project, value);
	keepOpenLetterStill(editor, moved);
	editor.publish?.(LETTER_SPACING_TOPIC, { extra, dragging: true });
	return extra;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Number} from - the extra when the drag began
 * @param {Number} to - the extra on release
 * @param {{reset?: Boolean}} [options] - [Reset]: its own Undo words
 * @returns {Boolean} true when a step was recorded
 */
export function commitExtra(editor, from, to, { reset = false } = {}) {
	const project = editor.project;
	const font = project?.settings?.font;
	const start = clampExtra(from, font);
	const end = clampExtra(to, font);
	if (start === end) {
		keepOpenLetterStill(editor, setExtra(project, end).moved);
		editor.publish?.(LETTER_SPACING_TOPIC, { extra: end, dragging: false });
		return false;
	}
	let key = end < start ? 'tryitGaps.step.closer' : 'tryitGaps.step.apart';
	if (reset) key = 'tryitGaps.step.reset';
	// The step's before-copy is the font as it was when the drag began
	keepOpenLetterStill(editor, setExtra(project, start).moved);
	editor.history.addWholeProjectChangePreState(word(key), { itemID: null });
	keepOpenLetterStill(editor, setExtra(project, end).moved);
	editor.history.addWholeProjectChangePostState();
	editor.publish?.(LETTER_SPACING_TOPIC, { extra: end, dragging: false });
	return true;
}

/**
 * @param {{getEditor: () => Object}} options
 * @returns {{element: HTMLDetailsElement, open: Function, refresh: Function, detach: Function}}
 */
export function makeLetterSpacingSection({ getEditor }) {
	injectStyleOnce(STYLE_ID, STYLE);
	const details = document.createElement('details');
	details.className = 'anyink-tryit-spacing';
	const summary = document.createElement('summary');
	summary.textContent = word('tryitGaps.spacing.title');
	details.appendChild(summary);

	const row = document.createElement('div');
	row.className = 'anyink-tryit-spacing__row';
	const closer = document.createElement('span');
	closer.textContent = word('tryitGaps.spacing.closer');
	const slider = document.createElement('input');
	slider.type = 'range';
	slider.step = '1';
	slider.setAttribute('aria-label', word('tryitGaps.spacing.slider'));
	const further = document.createElement('span');
	further.textContent = word('tryitGaps.spacing.further');
	const reset = document.createElement('button');
	reset.type = 'button';
	reset.className = 'anyink-tryit-spacing__reset';
	reset.textContent = word('tryitGaps.spacing.reset');
	reset.title = wordEntry('tryitGaps.spacing.reset')?.hint || '';
	row.append(closer, slider, further, reset);
	details.appendChild(row);

	let from = null; // the extra when the drag began
	let fromProject = null; // the font it began on
	let attached = null;
	let release = null; // Undo keys held while the slider is pressed
	const win = () => details.ownerDocument?.defaultView || globalThis;
	const letGo = () => {
		release?.();
		release = null;
		win().removeEventListener?.('pointerup', letGo, true);
		win().removeEventListener?.('pointercancel', letGo, true);
	};
	/** The extra the drag began from, on the font the editor has now. */
	const startOf = (project) => {
		if (from === null || fromProject !== project) {
			from = getExtra(project);
			fromProject = project;
		}
		return from;
	};

	const refresh = () => {
		const editor = getEditor();
		attach(editor);
		const project = editor?.project;
		if (!project) return;
		const { min, max } = extraRange(project);
		slider.min = String(min);
		slider.max = String(max);
		if (from === null) slider.value = String(getExtra(project));
		reset.hidden = getExtra(project) === 0;
	};
	function attach(editor) {
		if (!editor || editor === attached || typeof editor.subscribe !== 'function') return;
		detachFrom();
		attached = editor;
		editor.subscribe({
			topic: [LETTER_SPACING_TOPIC, 'kernPairs'],
			subscriberID: SYNC_ID,
			callback: () => {
				if (from === null) refresh();
			},
		});
	}
	function detachFrom() {
		attached?.unsubscribe?.({ idToRemove: SYNC_ID });
		attached = null;
	}

	slider.addEventListener('pointerdown', (event) => {
		if ((event.button ?? 0) !== 0 || release) return;
		release = holdUndoKeys({ win: win() });
		// the press may end anywhere: the window hears it
		win().addEventListener?.('pointerup', letGo, true);
		win().addEventListener?.('pointercancel', letGo, true);
	});
	slider.addEventListener('pointerup', letGo);
	slider.addEventListener('input', () => {
		const editor = getEditor();
		if (!editor?.project) return;
		startOf(editor.project);
		previewExtra(editor, Number(slider.value));
		reset.hidden = getExtra(editor.project) === 0;
	});
	slider.addEventListener('change', () => {
		const editor = getEditor();
		if (!editor?.project) return;
		const start = startOf(editor.project);
		from = null;
		fromProject = null;
		commitExtra(editor, start, Number(slider.value));
		refresh();
	});
	reset.addEventListener('click', () => {
		const editor = getEditor();
		if (!editor?.project) return;
		from = null;
		fromProject = null;
		commitExtra(editor, getExtra(editor.project), 0, { reset: true });
		refresh();
	});
	details.addEventListener('toggle', refresh);
	refresh();

	return {
		element: details,
		open() {
			details.open = true;
			refresh();
		},
		refresh,
		detach() {
			letGo();
			detachFrom();
		},
	};
}

/**
 * @param {{slots: Object<String, HTMLElement>, strip?: Object}} controller - expand.js makeTryIt
 * @param {{win?: Window}} [options]
 * @returns {Function} uninstall
 */
export function installLetterSpacing(controller, { win = globalThis } = {}) {
	const slot = controller?.slots?.spacing;
	if (!slot) return () => {};
	const section = makeLetterSpacingSection({ getEditor: () => controller.strip?.editor });
	slot.replaceChildren(section.element);
	const onChange = (event) => {
		const detail = event?.detail || {};
		if (!detail.open) {
			section.detach();
			return;
		}
		if (detail.section === 'letterSpacing') section.open();
		else section.refresh();
	};
	win.addEventListener?.(TRY_IT_CHANGE, onChange);
	return () => {
		win.removeEventListener?.(TRY_IT_CHANGE, onChange);
		section.detach();
		section.element.remove();
	};
}
