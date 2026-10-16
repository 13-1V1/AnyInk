// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 3, rule 25 in section 7): one thickness for the whole font.

	After the slider moves on one letter, the other sketched letters may be at another thickness.
	The Next line then asks "Use this thickness on all 5 sketched letters?" [Use on all] (green)
	[Just this one]; Fine-tune's [Use this thickness on all letters] does the same any time.
	[Use on all] re-inks every sketched letter at a different thickness, a few letters per
	animation frame behind a "Rebuilding letters..." pill so the page never freezes, all as ONE
	whole-font step ("set the thickness for every sketched letter"). Every letter's edge points
	and arc tops are placed again for the new thickness (thickness.js withThickness).

	Each letter's ink is built again by build.js rebuildItem (its tagged shapes from its sketch,
	their hash stored), inside the step.

	S3 fix (critic interleave probe): the frames come BEFORE the step. First every letter's new ink
	is built (build.js buildSketch, pure: nothing in the font changes, its results kept in the
	build's cache), a few letters a frame; then, in one task, the pre-state, every letter swapped
	in (cache hits), the post-state. So no step he makes meanwhile (a point moved, a Brush stroke,
	Delete) can land inside the whole-font step: it is simply an earlier step, and Undo takes back
	the thickness step first, then his. An Undo while it runs stops it (nothing is recorded), as
	does another font opened. A letter whose ink was changed behind its sketch's back is
	left at its old thickness (rebuildItem never builds over it; the next step on it sets it aside).

	  noteThicknessOffer(editor)   after the slider's step: remembers the offer when other
	                               sketched letters differ (the Next line asks while that step is
	                               the newest one)
	  thicknessOffer(editor)       { count, thickness, itemId } while the offer stands, else null
	  justThisOne()                [Just this one]: the offer goes
	  useThicknessOnAll(editor, { value, rebuild, chunk, frame, pill })   Promise<Boolean>: true
	                               when the step was recorded; value: default the open letter's
	                               thickness; rebuild: (item, project) => { mismatch } (default
	                               build.js rebuildItem); chunk: letters per frame (CHUNK);
	                               false when nothing changed, an Undo came while it ran, or
	                               another font was opened
	  isRebuildingAll()            true while it runs (a second press does nothing)
	  resetThicknessAllForTests()
*/
import { word } from '../words/words.js';
import { buildSketch, rebuildItem } from './build.js';
import { isSketchActive, setSketchThickness, sketchOf, sketchThickness } from './model.js';
import { builtMatches } from './sketch_record.js';
import {
	clampThickness,
	hasCenterline,
	lettersAtOtherThickness,
	letterThickness,
	withThickness,
} from './thickness.js';

/** Letters re-inked per animation frame */
export const CHUNK = 3;

let offer = null;
let running = false;

/** The build: a letter's ink from its sketch, inside the step */
const rebuildFromSketch = (item, project) => rebuildItem(item, { project });

export function resetThicknessAllForTests() {
	offer = null;
	running = false;
}

/** @returns {Boolean} */
export function isRebuildingAll() {
	return running;
}

// --------------------------------------------------------------
// The offer (rule 25)
// --------------------------------------------------------------

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true when the offer stands now
 */
export function noteThicknessOffer(editor) {
	const item = editor?.selectedItem;
	const sketch = sketchOf(item);
	if (!editor?.project || !isSketchActive(sketch) || !hasCenterline(sketch)) {
		offer = null;
		return false;
	}
	offer = {
		project: editor.project,
		itemId: editor.selectedItemID,
		thickness: letterThickness(item, editor.project),
		top: editor.history?.queue?.[0] ?? null,
	};
	if (thicknessOffer(editor)) return true;
	offer = null;
	return false;
}

/**
 * @param {Object} editor
 * @returns {{count: Number, thickness: Number, itemId: String} | null}
 */
export function thicknessOffer(editor) {
	if (!offer || running) return null;
	if (editor?.project !== offer.project) return null;
	// only while the slider's step is the newest change (an Undo or any later step ends it)
	if ((editor.history?.queue?.[0] ?? null) !== offer.top) return null;
	const others = lettersAtOtherThickness(editor.project, offer.thickness, { except: offer.itemId });
	if (!others.length) return null;
	// "on all 5 sketched letters": the letter he changed and the ones that differ
	return { count: others.length + 1, thickness: offer.thickness, itemId: offer.itemId };
}

export function justThisOne() {
	offer = null;
}

// --------------------------------------------------------------
// Use on all
// --------------------------------------------------------------

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} [options]
 * @param {Number} [options.value] - font units; default the open letter's (else the font's)
 * @param {Function} [options.rebuild] - (item, project); default build.js rebuildItem
 * @param {Number} [options.chunk]
 * @param {Function} [options.frame] - requestAnimationFrame (tests pass their own)
 * @param {Boolean} [options.pill] - show "Rebuilding letters..." (default: when it takes frames)
 * @returns {Promise<Boolean>}
 */
export async function useThicknessOnAll(editor, options = {}) {
	const project = editor?.project;
	const rebuild = options.rebuild || rebuildFromSketch;
	if (!project || running) return false;
	const open = editor.selectedItem;
	const value = clampThickness(
		project,
		options.value ?? (isSketchActive(sketchOf(open)) ? letterThickness(open, project) : NaN)
	);
	const letters = lettersAtOtherThickness(project, value);
	offer = null;
	if (!letters.length) {
		setSketchThickness(project, value);
		return false;
	}
	running = true;
	const chunk = Math.max(1, Math.round(options.chunk || CHUNK));
	const frame = options.frame || globalThis.requestAnimationFrame?.bind(globalThis);
	const showPill = options.pill ?? letters.length > chunk;
	const pill = showPill ? makePill() : null;
	const history = editor.history;
	const top = history?.queue?.[0];
	try {
		// 1. the new ink built ahead, a few letters a frame; the font itself is not touched
		for (let i = 0; i < letters.length; i += chunk) {
			if (i > 0) await nextFrame(frame);
			if (editor.project !== project) return false;
			letters.slice(i, i + chunk).forEach(({ item }) => warm(item, project, value));
		}
		if (editor.project !== project || undoneSince(history, top)) return false;
		// 2. the step, in one task: nothing can come between its pre-state and its post-state
		const now = lettersAtOtherThickness(project, value);
		if (!now.length) {
			setSketchThickness(project, value);
			return false;
		}
		history.addWholeProjectChangePreState(word('sketch.step.thicknessAll'), { itemID: null });
		setSketchThickness(project, value);
		now.forEach(({ item }) => reink(item, project, value, rebuild));
		history.addWholeProjectChangePostState();
		editor.publish?.('currentItem', editor.selectedItem);
		return true;
	} finally {
		running = false;
		pill?.remove();
	}
}

/**
 * @returns {Boolean} an Undo (or Undo then another step) took away the step that was newest when
 *   it started: he meant to take something back, so the run stops
 */
function undoneSince(history, top) {
	const queue = history?.queue;
	if (!Array.isArray(queue)) return false;
	return top === undefined ? false : !queue.includes(top);
}

/** A letter's new ink built (and kept by the build) without touching the letter */
function warm(item, project, value) {
	const sketch = sketchOf(item);
	if (!isSketchActive(sketch) || !builtMatches(item)) return;
	try {
		buildSketch(withThickness(sketch, project, value), {
			font: project?.settings?.font || {},
			thickness: sketchThickness(project),
		});
	} catch (error) {
		console.warn('ANY-INK sketch: a letter could not be built ahead', error);
	}
}

/** One letter at the thickness, its ink built again; one whose ink is not its sketch's stays */
function reink(item, project, value, rebuild) {
	const sketch = sketchOf(item);
	if (!isSketchActive(sketch) || !builtMatches(item)) return;
	const before = { thickness: sketch.thickness, points: sketch.points, pieces: sketch.pieces };
	const next = withThickness(sketch, project, value);
	Object.assign(sketch, { thickness: next.thickness, points: next.points, pieces: next.pieces });
	try {
		const result = rebuild(item, project);
		if (result?.mismatch) Object.assign(sketch, before);
	} catch (error) {
		Object.assign(sketch, before);
		console.warn('ANY-INK sketch: a letter could not be re-inked', error);
	}
}

function nextFrame(frame) {
	return new Promise((resolve) => {
		if (typeof frame === 'function') frame(() => resolve());
		else setTimeout(resolve, 0);
	});
}

/** "Rebuilding letters..." while it runs (sketch_card.css) */
function makePill() {
	const doc = globalThis.document;
	if (!doc?.body) return null;
	const pill = doc.createElement('div');
	pill.className = 'anyink-sketch-rebuilding';
	pill.setAttribute('role', 'status');
	pill.setAttribute('data-anyink-pill', 'rebuilding');
	pill.textContent = word('sketch.thickness.rebuilding');
	doc.body.appendChild(pill);
	return pill;
}
