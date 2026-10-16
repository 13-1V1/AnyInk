// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md sections 3, 5 and 7 "Card sections"): the letter card's parts for a
	sketched letter, in Simple with the 'sketch' flag on. letter/letter_card.js puts them in.

	  Top ('sketch')   while a sketch tool is picked or the letter has a sketch, right under the
	                   header: Thickness "thin --o-- thick" (only when the letter has Centerline
	                   ink) and its readout beside it, never typed, "0.07 in wide on 1 in
	                   capitals" (hint: how wide the stroke is when the capitals are 1 inch
	                   tall). Dragging it shows the real ink at the new thickness and records ONE
	                   step on release (thickness_drag.js); Esc puts it back, and the slider then
	                   stays put until the next press, so dragging on records nothing. By keyboard
	                   (Chrome fires a change per arrow press) a burst of keys is ONE step, once
	                   the keys pause KEY_PAUSE ms or he leaves the slider or presses another key;
	                   a burst left waiting never lands on another letter. A sketch from a newer
	                   ANY-INK shows its quiet line instead; a set-aside sketch its quiet line and
	                   [Use the sketch again] (use_again.js, one step; S3 finalize).
	  Fine-tune > Sketch   the letter's way in a quiet line (Centerline or Outline), Ends: Round /
	                   Flat for the letter (open Centerline pieces only; one step, "made the ends
	                   round on small n"), and [Use this thickness on all letters] while another
	                   sketched letter is at a different thickness (thickness_all.js, one whole-font
	                   step).

	  KEY_PAUSE        ms a keyboard burst waits before its step
	Pure:
	  sketchCardState(editor, { isOn, simple })   null, or { itemId, way, pieces (an active
	                         sketch with pieces), centerline, openEnds, thickness, min, max,
	                         readout, ends, newer, others (sketched letters at another
	                         thickness), tool }; a set-aside sketch: { itemId, setAside: true,
	                         tool }
	  showsSketchSection(state)   the top section shows
	DOM:
	  makeSketchSection(state, editor)    the top section
	  makeSketchFineTune(state, editor)   Fine-tune's Sketch part
	  setLetterEnds(editor, ends)         Round / Flat for the letter: one step; false when it is
	                         already so
	Words: sketch.thickness.*, sketch.ends.*, sketch.card.* (words/sets/sketch.js). Look:
	sketch_card.css, tokens only.
*/
import { makeElement } from '../../common/dom.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';
import { isNewerSketch, isSketchActive, sketchOf, sketchWay, thicknessRange } from './model.js';
import { isSketchTool } from './tools/tool_names.js';
import {
	hasCenterline,
	hasOpenCenterline,
	letterThickness,
	lettersAtOtherThickness,
	thicknessReadout,
} from './thickness.js';
import { isRebuildingAll, useThicknessOnAll } from './thickness_all.js';
import { startThicknessDrag } from './thickness_drag.js';
import { canUseAgain, useSketchAgain } from './use_again.js';
import { SLIDER_KEYS } from '../controls/slider_keys.js';
import './sketch_card.css';

/** A keyboard burst on the Thickness slider is recorded once it pauses this long (ms) */
export const KEY_PAUSE = 600;

/** A recorded key burst rebuilds the card: the new slider takes the focus back within this (ms) */
const REFOCUS_WITHIN = 1000;
/** When the slider that had the keyboard was let go of by a recorded burst (0: none) */
let refocusAt = 0;

// --------------------------------------------------------------
// What it shows (pure)
// --------------------------------------------------------------

/**
 * @param {Object} editor - ProjectEditor
 * @param {{isOn?: (flag: String) => Boolean, simple?: Boolean}} [options]
 * @returns {Object | null}
 */
export function sketchCardState(editor, { isOn = isFeatureOn, simple = isSimpleMode() } = {}) {
	if (!simple || !isOn('sketch')) return null;
	const item = openItem(editor);
	const project = editor?.project;
	if (!item || !project) return null;
	const sketch = sketchOf(item);
	const tool = editor?.selectedTool || '';
	const pieces = Array.isArray(sketch?.pieces) && sketch.pieces.length > 0;
	if (!pieces && !isSketchTool(tool) && !isNewerSketch(sketch)) return null;
	// S3 finalize: a set-aside sketch shows its quiet line and the way back, nothing else
	if (sketch?.setAside === true) {
		return canUseAgain(item)
			? { itemId: editor.selectedItemID || null, setAside: true, tool }
			: null;
	}
	const active = isSketchActive(sketch);
	const thickness = letterThickness(item, project);
	const { min, max } = thicknessRange(project);
	return {
		itemId: editor.selectedItemID || null,
		way: sketchWay(sketch),
		pieces: active && pieces,
		centerline: active && hasCenterline(sketch),
		openEnds: active && hasOpenCenterline(sketch),
		thickness,
		min,
		max,
		readout: thicknessReadout(project, thickness),
		ends: sketch?.ends === 'flat' ? 'flat' : 'round',
		newer: isNewerSketch(sketch),
		others:
			active && hasCenterline(sketch)
				? lettersAtOtherThickness(project, thickness, { except: editor.selectedItemID }).length
				: 0,
		tool,
	};
}

/**
 * @param {Object | null} state
 * @returns {Boolean}
 */
export function showsSketchSection(state) {
	return !!state && (state.centerline || state.newer || state.setAside === true);
}

// --------------------------------------------------------------
// The top section
// --------------------------------------------------------------

/**
 * @param {Object} state - sketchCardState
 * @param {Object} editor
 * @returns {HTMLElement | null}
 */
export function makeSketchSection(state, editor) {
	if (!showsSketchSection(state)) return null;
	const section = makeElement({ tag: 'div', className: 'anyink-sketch-card' });
	if (state.newer) {
		const line = makeElement({ tag: 'p', className: 'anyink-sketch-card__quiet' });
		line.textContent = word('sketch.card.newer');
		section.appendChild(line);
		return section;
	}
	if (state.setAside) {
		const line = makeElement({ tag: 'p', className: 'anyink-sketch-card__quiet' });
		line.textContent = word('sketch.card.setAside');
		const button = makeElement({
			tag: 'button',
			className: 'anyink-letter-card__button anyink-sketch-card__again',
			attributes: {
				type: 'button',
				'data-anyink-sketch': 'useAgain',
				title: hintOf('sketch.card.useAgain'),
			},
		});
		button.textContent = word('sketch.card.useAgain');
		button.addEventListener('click', () => useSketchAgain(editor));
		section.append(line, button);
		return section;
	}
	section.appendChild(makeThickness(state, editor));
	return section;
}

function makeThickness(state, editor) {
	const control = makeElement({
		tag: 'div',
		className: 'anyink-sketch-thickness',
		attributes: { 'data-anyink-sketch': 'thickness', title: hintOf('sketch.thickness.label') },
	});
	const label = makeElement({ tag: 'span', className: 'anyink-sketch-thickness__label' });
	label.textContent = word('sketch.thickness.label');
	const thin = makeElement({ tag: 'span', className: 'anyink-sketch-thickness__end' });
	thin.textContent = word('sketch.thickness.thin');
	const thick = makeElement({ tag: 'span', className: 'anyink-sketch-thickness__end' });
	thick.textContent = word('sketch.thickness.thick');
	const slider = makeElement({
		tag: 'input',
		className: 'anyink-sketch-thickness__slider',
		attributes: {
			type: 'range',
			min: String(state.min),
			max: String(state.max),
			step: '1',
			'aria-label': word('sketch.thickness.slider'),
		},
	});
	slider.value = String(state.thickness);
	const readout = makeElement({
		tag: 'p',
		className: 'anyink-sketch-thickness__readout',
		attributes: {
			'data-anyink-sketch': 'readout',
			'aria-live': 'polite',
			title: hintOf('sketch.thickness.readout'),
		},
	});
	readout.textContent = state.readout;

	let drag = null;
	// a press of the mouse (or pen) on the slider: its release is the step
	let viaPointer = false;
	// Esc took this drag back: the slider stays put until the next press or key
	let cancelled = false;
	let pause = 0;
	const itemId = editor.selectedItemID;
	const show = (value) => {
		readout.textContent = thicknessReadout(editor.project, value);
	};
	const putBack = () => {
		slider.value = String(state.thickness);
		show(state.thickness);
	};
	const stopPause = () => {
		if (pause) clearTimeout(pause);
		pause = 0;
	};
	/** The drag's one step, never on another letter than the one it started on */
	const setDrag = (value) => {
		drag = value;
		// a focused slider being dragged keeps Esc from the sketch tools (controls/slider_keys.js)
		if (drag) slider.dataset.anyinkDragging = 'true';
		else delete slider.dataset.anyinkDragging;
	};
	const finish = () => {
		stopPause();
		const ending = drag;
		setDrag(null);
		if (!ending) return;
		if (globalThis.document?.activeElement === slider) refocusAt = Date.now();
		if (editor.selectedItemID !== itemId) ending.cancel();
		else ending.end(Number(slider.value));
	};
	slider.addEventListener('pointerdown', () => {
		viaPointer = true;
		cancelled = false;
	});
	slider.addEventListener('input', () => {
		if (cancelled) return putBack();
		if (!drag) setDrag(startThicknessDrag(editor));
		drag?.move(Number(slider.value));
		show(Number(slider.value));
	});
	slider.addEventListener('change', () => {
		if (cancelled) return putBack();
		if (viaPointer) {
			viaPointer = false;
			return finish();
		}
		// keys: Chrome fires a change for every arrow press; the burst is ONE step, after a pause
		stopPause();
		pause = setTimeout(finish, KEY_PAUSE);
	});
	slider.addEventListener('blur', () => {
		if (pause) finish();
	});
	slider.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') {
			cancelled = false;
			viaPointer = false;
			// the slider's own keys are its: the app's key map (a nudge) never takes them
			if (SLIDER_KEYS.has(event.key)) event.stopPropagation();
			// any other key (Ctrl+Z, Tab...) finds the burst already recorded
			else if (pause) finish();
			return;
		}
		if (!drag) return;
		event.preventDefault();
		event.stopPropagation();
		stopPause();
		drag.cancel();
		setDrag(null);
		cancelled = true;
		putBack();
	});
	const row = makeElement({ tag: 'div', className: 'anyink-sketch-thickness__row' });
	row.append(label, thin, slider, thick);
	control.append(row, readout);
	// the card is drawn again after a key burst is recorded: the keyboard stays on the slider
	if (refocusAt && Date.now() - refocusAt <= REFOCUS_WITHIN) {
		refocusAt = 0;
		const focusBack = () => {
			if (slider.isConnected && globalThis.document?.activeElement === globalThis.document?.body)
				slider.focus();
		};
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusBack);
		else setTimeout(focusBack, 0);
	} else refocusAt = 0;
	return control;
}

// --------------------------------------------------------------
// Fine-tune > Sketch
// --------------------------------------------------------------

/**
 * @param {Object} state - sketchCardState
 * @param {Object} editor
 * @returns {HTMLElement}
 */
export function makeSketchFineTune(state, editor) {
	const part = makeElement({ tag: 'div', className: 'anyink-letter-card__part' });
	const title = makeElement({ tag: 'h4', className: 'anyink-letter-card__part-title' });
	title.textContent = word('sketch.card.heading');
	part.appendChild(title);

	const way = makeElement({
		tag: 'p',
		className: 'anyink-sketch-card__quiet',
		attributes: { 'data-anyink-sketch': 'way' },
	});
	way.textContent = word(
		state.way === 'outline' ? 'sketch.card.wayOutline' : 'sketch.card.wayCenter'
	);
	part.appendChild(way);

	if (state.openEnds) part.appendChild(makeEnds(state, editor));
	if (state.centerline && state.others > 0) {
		const button = makeElement({
			tag: 'button',
			className: 'anyink-letter-card__button',
			attributes: { type: 'button', 'data-anyink-action': 'thicknessOnAll' },
		});
		button.textContent = word('sketch.thickness.useOnAllLetters');
		button.addEventListener('click', () => {
			if (isRebuildingAll()) return;
			useThicknessOnAll(editor);
		});
		part.appendChild(button);
	}
	return part;
}

function makeEnds(state, editor) {
	const row = makeElement({
		tag: 'div',
		className: 'anyink-sketch-card__ends',
		attributes: { title: hintOf('sketch.ends.label') },
	});
	const label = makeElement({ tag: 'span', className: 'anyink-sketch-card__label' });
	label.textContent = word('sketch.ends.label');
	const group = makeElement({
		tag: 'div',
		className: 'anyink-segmented',
		attributes: { role: 'group', 'aria-label': word('sketch.ends.label') },
	});
	['round', 'flat'].forEach((ends) => {
		const button = makeElement({
			tag: 'button',
			className: 'anyink-segmented__option',
			attributes: {
				type: 'button',
				'data-anyink-ends': ends,
				'aria-pressed': String(state.ends === ends),
			},
		});
		button.textContent = word(`sketch.ends.${ends}`);
		button.addEventListener('click', () => setLetterEnds(editor, ends));
		group.appendChild(button);
	});
	row.append(label, group);
	return row;
}

/**
 * Round or Flat for every open end of the letter (an end's own choice, S4's "This end", stays).
 * One step; the sketch hook rebuilds the ink inside it.
 * @param {Object} editor
 * @param {'round' | 'flat'} ends
 * @returns {Boolean}
 */
export function setLetterEnds(editor, ends) {
	const item = openItem(editor);
	const sketch = sketchOf(item);
	if (!isSketchActive(sketch) || (ends !== 'round' && ends !== 'flat')) return false;
	if ((sketch.ends === 'flat' ? 'flat' : 'round') === ends) return false;
	sketch.ends = ends;
	sketch.at = Date.now();
	const key = ends === 'flat' ? 'sketch.step.endsFlat' : 'sketch.step.endsRound';
	editor.history.addState(word(key, { letter: nameOf(item, editor) }));
	editor.publish?.('currentItem', item);
	return true;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** The open letter, looked up without making one (as letter_card.js does) */
function openItem(editor) {
	const id = editor?.selectedItemID;
	if (!id || typeof editor?.project?.getItem !== 'function') return null;
	try {
		return editor.project.getItem(id) || null;
	} catch {
		return null;
	}
}

function nameOf(item, editor) {
	const char =
		item?.char ||
		(() => {
			const code = parseInt(String(editor?.selectedItemID || '').replace(/^glyph-/, ''), 16);
			return Number.isFinite(code) ? String.fromCodePoint(code) : '';
		})();
	return letterName(char) || word('check.aLetter');
}

function hintOf(key) {
	return wordEntry(key)?.hint || '';
}
