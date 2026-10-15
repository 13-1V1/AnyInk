// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3: the spacing hook (UX-BEGINNER 7.2). History calls it before a step is captured, the same
	choke point that tells crash recovery the font changed (D-018), so whatever it does is part of
	that one Undo step, never a step of its own and never one per drag tick.

	  beforeItemStep(history, editor, { itemWasDeleted })   History.addState, after its "Navigated
	    to" check (looking around is never refit) and before the entry is made
	  beforeWholeProjectPost(history, editor)               History.addWholeProjectChangePostState,
	    before the after-copy is made
	  settingsBeforeGapChange(history, editor)              History.addSettingsState, before the
	    settings entry is made

	Simple: the open letter is refit when its spacing is automatic (glyph.anyink.spacing 'auto').
	  A letter with no owner yet that gets its first ink in this step starts automatic (ink is
	  what the spacing measures, inkBounds: a part made from a letter with no ink is none). The ink
	  stays where it is on screen: the view moves by what the refit moved (as a left-edge drag
	  does), and the photo moves with the shapes (the fitter's trace follow). An edge drag or side
	  nudge marks the letter "set by you" before its step (guides_layer.js), so it never snaps back.
	  After a refit that changed the letter, 'currentItem' is published (not every caller publishes
	  after its step), so panels and the preview show the fitted letter.
	  Automatic letters made from the open one (a component of it, directly or through other
	  letters) moved with it; the ones no longer at their fit are refit too, and beforeItemStep
	  returns { alsoChanged }: every other letter the refit changed. The step stays an item step
	  (7.3): History records an item entry for each of them under the open letter's entry, sharing
	  one step key, and one press undoes them all. No whole-font copies (B3 fix, 10/14/2026).
	  The slant (B3 fix, slant.js): when the step's ink leans the font more than 1.5 degrees off
	  the slant its automatic letters were fitted with (the first letter with stems, or a hand
	  that turned steeper), every automatic letter is fitted again with the new slant, and the
	  ones that changed join alsoChanged the same way: one press puts the whole font back.
	  A whole-font step ends with every automatic letter at its fit, in that same step: the open
	  letter starts automatic on its first ink as above, then fitAllAutomatic. So an action that
	  takes the whole-font path (Use it on a letter that holds a component, a cross-project copy,
	  moving a guide line, the letter-spacing slider) never leaves an automatic letter off its fit.
	  A settings step that moves the gaps (the small-letter line or the grid size: G is 8 % of
	  the line, D-017) while automatic letters are on the page is turned by History into one
	  whole-font step about no letter, so that refit happens inside it (7.3 "Move a guide line").
	All tools: never refits. A step that changed an automatic letter's left space or width marks it
	  "set by you": Attributes fields, auto-fit, moved shapes, Transforms, side edges, Global
	  actions, cross-letter actions. Letters with no owner are left exactly as they are (no owner
	  already means "set by you"), so fonts made in All tools never change. A letter whose left
	  space and width are exactly where the fitter puts them stays automatic ([Fix it] fits an
	  automatic letter, preview/fix_it.js). A letter's earlier state is measured with the font's
	  letters, so ink that comes only from another letter (a component) is seen.

	The earlier state a step is compared with is the newest one the Undo list holds for that
	letter (or the undo floor), the same state an Undo would go back to.
	A hook that fails never costs the step: it warns and History carries on. Steps recorded during
	an undo or redo, or for the other open font (upstream records those from the current one's
	letters), are left alone.
*/
import { Glyph } from '../../project_data/glyph.js';
import { indexOfNextItemEntry } from '../history/history_helpers.js';
import { itemIn } from '../history/item_state.js';
import { findPreviousSettingsSnapshot } from '../history/settings_snapshot.js';
import { isSimpleMode } from '../mode/mode.js';
import {
	dependentsOffFit,
	fitAllAutomatic,
	fitDependents,
	fitSpacing,
	followSlant,
	sitsAtFit,
} from './auto_space.js';
import { inkBounds } from './measure.js';
import { nextSlant } from './slant.js';
import {
	hasSpacingOwner,
	isAutomatic,
	markAuto,
	markManual,
	spacingChanged,
	spacingOf,
} from './owner.js';

/** Item types that have spacing (letters and joined letters; not components or gaps) */
const SPACED_TYPES = ['Glyph', 'Ligature'];
const SPACED_COLLECTIONS = ['glyphs', 'ligatures'];

const WARNING = 'ANY-INK spacing: the step was kept without its spacing check';

// --------------------------------------------------------------
// Hooks
// --------------------------------------------------------------

/**
 * Before an item step is captured (History.addState).
 * @param {Object} history - History
 * @param {Object} editor - ProjectEditor
 * @param {{itemWasDeleted?: Boolean}} [options] - a deletion step is recorded before the
 *   letter goes, so there is nothing to space
 * @returns {{alsoChanged: Array<Object>} | null} Simple, when other automatic letters were refit
 *   with the open one (letters made from it, or every letter when its ink moved the font's
 *   slant): the other letters this step changed (live letters; History records an item entry
 *   for each, under the open letter's). null: an item step as usual.
 */
export function beforeItemStep(history, editor, { itemWasDeleted = false } = {}) {
	if (!isOwnStep(history, editor) || itemWasDeleted) return null;
	try {
		const item = editor.selectedItem;
		if (!isSpaced(item)) return null;
		if (!isSimpleMode()) {
			markSetByHandIfMoved(history, item, editor.project);
			return null;
		}
		refitIfAutomatic(history, editor, item);
		const alsoChanged = refitLettersMadeFrom(item, editor.project);
		refitForNewSlant(editor, item, alsoChanged);
		return alsoChanged.length ? { alsoChanged } : null;
	} catch (error) {
		console.warn(WARNING, error);
		return null;
	}
}

/**
 * Before the after-copy of a whole-font step is captured (History.addWholeProjectChangePostState).
 * Simple: every automatic letter ends at its fit (the open one starts automatic on its first
 * ink). All tools: every automatic letter whose left space or width the step changed becomes
 * "set by you".
 * @param {Object} history - History
 * @param {Object} editor - ProjectEditor
 */
export function beforeWholeProjectPost(history, editor) {
	if (!isOwnStep(history, editor)) return;
	try {
		if (isSimpleMode()) {
			refitAfterWholeFontStep(history, editor);
			return;
		}
		spacedLetters(editor.project).forEach((item) =>
			markSetByHandIfMoved(history, item, editor.project)
		);
	} catch (error) {
		console.warn(WARNING, error);
	}
}

/**
 * Before a settings step is captured (History.addSettingsState), after the change. Simple only:
 * when the change moved the gaps (the small-letter line, the grid size, the letter-spacing
 * extra) and an automatic letter is off its fit now, History records a whole-font step instead,
 * whose before-copy takes these settings and whose after-copy comes after the refit
 * (beforeWholeProjectPost).
 * @param {Object} history - History
 * @param {Object} editor - ProjectEditor
 * @returns {Object | null} the settings snapshot from before the change, or null: a settings step
 *   as usual
 */
export function settingsBeforeGapChange(history, editor) {
	if (!isOwnStep(history, editor) || !isSimpleMode()) return null;
	try {
		const project = editor.project;
		const before = findPreviousSettingsSnapshot(history.queue, 0, history.undoBase);
		if (!before || !gapInputsChanged(before, project.settings)) return null;
		const offFit = spacedLetters(project).some(
			(item) => isAutomatic(item) && !!inkBounds(item) && !sitsAtFit(item, project)
		);
		return offFit ? before : null;
	} catch (error) {
		console.warn(WARNING, error);
		return null;
	}
}

// --------------------------------------------------------------
// Simple
// --------------------------------------------------------------

/**
 * @param {Object} history
 * @param {Object} editor
 * @param {Object} item - the letter the step is about (the open one)
 */
function refitIfAutomatic(history, editor, item) {
	startAutomaticOnFirstInk(history, item, editor.project);
	if (!isAutomatic(item)) return;
	const { changed, dx } = fitSpacing(item, editor.project);
	if (dx) keepInkStillOnScreen(editor, item, dx);
	// Not every caller publishes after its step (the rectangle tool only redraws the canvas),
	// so panels and the preview hear about the refit here
	if (changed) editor.publish?.('currentItem', item);
}

/**
 * A letter with no owner that gets its first ink in this step starts automatic (D-034). Ink is
 * what the spacing measures (inkBounds): a part made from a letter with no ink is none.
 * B6 + B7 finalize (D-037): its first shape does too, ink or not yet (a Point pen click), so
 * every step of the shape holds the flag: the card never says "Set by you" on a letter he has
 * only just started, an Undo mid-shape keeps it, and a Fix it on a letter with no ink yet keeps
 * it. A letter that had a shape and no owner (an old or imported one) is never touched.
 * @param {Object} history
 * @param {Object} item
 * @param {Object} project - the live font (resolves letters a recorded copy is made from)
 */
function startAutomaticOnFirstInk(history, item, project) {
	if (hasSpacingOwner(item)) return;
	if (!hasAnyShape(item) && !hasInk(item, project)) return;
	const before = recordedState(history, item.id);
	if (!hasAnyShape(before) && !hasInk(before, project)) markAuto(item);
}

/**
 * @returns {Boolean} the letter has a drawn shape (a path with a point), ink or not; a part made
 *   from another letter only counts once it brings ink (D-034)
 */
function hasAnyShape(item) {
	return (item?.shapes || []).some(
		(shape) => shape?.objType === 'Path' && (shape.pathPoints?.length || 0) > 0
	);
}

/**
 * Automatic letters made from the open one that its change (or its refit) moved off their fit
 * are refit. The fitter also keeps the photos of letters made from those under their ink, so
 * every letter that holds a part (a component) is compared before and after.
 * @param {Object} item - the open letter
 * @param {Object} project
 * @returns {Array<Object>} the other letters the refit changed
 */
function refitLettersMadeFrom(item, project) {
	if (!dependentsOffFit(item, project).length) return [];
	const watched = spacedLetters(project).filter((other) => other !== item && holdsParts(other));
	const before = new Map(watched.map((other) => [other, dataOf(other)]));
	fitDependents(item, project);
	return watched.filter((other) => dataOf(other) !== before.get(other));
}

/**
 * The step's ink moved the font's slant (slant.js nextSlant): every automatic letter is fitted
 * again with the new one, so letters traced before it are measured the same way as the rest.
 * The other letters that changed join the step's parts; the open letter's view keeps still.
 * @param {Object} editor
 * @param {Object} item - the open letter
 * @param {Array<Object>} alsoChanged - the step's other letters so far; added to in place
 */
function refitForNewSlant(editor, item, alsoChanged) {
	const project = editor.project;
	if (nextSlant(project) === null) return;
	const others = spacedLetters(project).filter(
		(other) => other !== item && !alsoChanged.includes(other)
	);
	const before = new Map(others.map((other) => [other, dataOf(other)]));
	const own = followSlant(project).find((entry) => entry.id === item.id);
	if (own?.dx) keepInkStillOnScreen(editor, item, own.dx);
	if (own) editor.publish?.('currentItem', item);
	others.forEach((other) => {
		if (dataOf(other) !== before.get(other)) alsoChanged.push(other);
	});
}

/**
 * The end of a whole-font step in Simple: every automatic letter at its fit.
 * @param {Object} history
 * @param {Object} editor
 */
function refitAfterWholeFontStep(history, editor) {
	// Opening a letter (All tools' creation-only pair) changed nothing
	if (history.queue[0]?.creationOnly) return;
	const project = editor.project;
	// Not editor.selectedItem: its getter makes a missing letter
	const open = project.getItem?.(editor.selectedItemID) || null;
	if (isSpaced(open)) startAutomaticOnFirstInk(history, open, project);
	const moved = fitAllAutomatic(project);
	const own = open ? moved.find((entry) => entry.id === open.id) : null;
	if (!own) return;
	if (own.dx) keepInkStillOnScreen(editor, open, own.dx);
	editor.publish?.('currentItem', open);
}

/**
 * The refit moved the shapes sideways; move the view the other way so the ink (and the photo,
 * which moved with it) stays where he drew it, and the edges come to the ink.
 * @param {Object} editor
 * @param {Object} item
 * @param {Number} moved - font units the shapes moved
 */
function keepInkStillOnScreen(editor, item, moved) {
	if (!editor.nav?.isOnEditCanvasPage || editor.selectedItem !== item) return;
	const view = editor.view;
	if (!Number.isFinite(view?.dx) || !Number.isFinite(view?.dz)) return;
	editor.view = { dx: view.dx - moved * view.dz };
}

/**
 * @param {Object} before - settings snapshot
 * @param {Object} settings - project.settings now
 * @returns {Boolean} true when something the gap rule reads changed
 */
function gapInputsChanged(before, settings) {
	const was = before?.font || {};
	const now = settings?.font || {};
	if (Number(was.xHeight) !== Number(now.xHeight)) return true;
	if (Number(was.upm) !== Number(now.upm)) return true;
	return extraIn(before?.anyink) !== extraIn(settings?.anyink);
}

/** @returns {Number} the letter-spacing extra a settings.anyink block holds (0 when none) */
function extraIn(anyink) {
	return Number(anyink?.spacing?.extra) || 0;
}

// --------------------------------------------------------------
// All tools
// --------------------------------------------------------------

/**
 * @param {Object} history
 * @param {Object} item - a letter that may have changed since its newest recorded state
 * @param {Object} project - the live font (resolves letters a recorded copy is made from)
 */
function markSetByHandIfMoved(history, item, project) {
	if (!isAutomatic(item)) return;
	const before = recordedSpacing(recordedState(history, item.id), project);
	if (!spacingChanged(before, spacingOf(item))) return;
	// Where the fitter puts it is still ANY-INK's spacing ([Fix it] fits automatic letters)
	if (sitsAtFit(item, project)) return;
	markManual(item);
}

/**
 * spacingOf a recorded state. An item step holds a copy that belongs to no font, so letters it
 * is made from (components) can't be read through it: those are read from a copy that belongs
 * to the live font.
 * @param {Object | null} state - recordedState
 * @param {Object} project
 * @returns {{left: Number, width: Number}}
 */
function recordedSpacing(state, project) {
	return spacingOf(inFont(state, project));
}

/**
 * A recorded copy that letters it is made from can be read through. An item step holds a copy
 * that belongs to no font; one that holds parts (components) is copied into the live font.
 * @param {Object | null} state - a letter, or a recordedState
 * @param {Object} project
 * @returns {Object | null}
 */
function inFont(state, project) {
	const detached = !state?.parent && !!project && typeof state?.save === 'function';
	if (!detached || !holdsParts(state)) return state;
	const copy = new Glyph(state.save());
	copy.parent = project;
	return copy;
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/**
 * The newest state of an item the Undo list holds, which is what an Undo of the step about to
 * be recorded goes back to: its newest item step (a step that refit it with another letter
 * records an item entry for it too), a whole-font copy that holds it, or the undo floor under
 * the list.
 * @param {Object} history - History (queue newest first, undoBase)
 * @param {String} id
 * @returns {Object | null} an item, or null when it didn't exist then
 */
export function recordedState(history, id) {
	const queue = history?.queue || [];
	for (let i = indexOfNextItemEntry(queue, 0); i > -1; i = indexOfNextItemEntry(queue, i + 1)) {
		const entry = queue[i];
		if (entry.wholeProjectSave) return itemIn(entry.itemState, id);
		// A deletion step holds the item from before it was deleted: after it, it was gone
		if (entry.itemID === id) return entry.itemWasDeleted ? null : entry.itemState;
	}
	return itemIn(history?.undoBase, id);
}

/**
 * A step recorded for the open font, outside an undo or redo. (Upstream records a step for the
 * other open font from the current one's letters, so that case is left alone.)
 */
function isOwnStep(history, editor) {
	return !!history && !!editor?.project && editor.history === history && !history.isRestoring;
}

/** @returns {Array<Object>} the font's letters and joined letters */
function spacedLetters(project) {
	const letters = [];
	SPACED_COLLECTIONS.forEach((collection) => {
		Object.values(project?.[collection] || {}).forEach((item) => {
			if (isSpaced(item)) letters.push(item);
		});
	});
	return letters;
}

function isSpaced(item) {
	return !!item && SPACED_TYPES.includes(item.objType) && typeof item.id === 'string';
}

/**
 * @param {Object | null} item - a letter, or a recordedState
 * @param {Object} project
 * @returns {Boolean} true when the letter has ink the spacing measures
 */
function hasInk(item, project) {
	if (!Array.isArray(item?.shapes) || !item.shapes.length) return false;
	return !!inkBounds(inFont(item, project));
}

/** @returns {Boolean} true when some of the letter's ink comes from another letter (a component) */
function holdsParts(item) {
	return (item?.shapes || []).some((shape) => shape?.objType === 'ComponentInstance');
}

/** @returns {String} the letter's saved data, to tell whether a refit changed it */
function dataOf(item) {
	return JSON.stringify(item.save());
}
