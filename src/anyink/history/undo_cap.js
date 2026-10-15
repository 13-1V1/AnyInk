// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B2: the size limit on the Undo list (UX-BEGINNER 7.3), in both modes. The list keeps the newest
	200 steps and at most 30 whole-project steps; older steps drop off the old end. A step is one
	item entry, one settings entry, or one whole-project pre / post pair (which leaves together,
	with anything recorded between its two halves).

	Looking around is never a step (7.3), so it never counts toward either limit and never pushes
	a real change out of Undo: "Navigated to" entries and the creation-only pairs All tools
	records when a letter is opened (Simple records neither). Old ones still leave with the steps
	under them. Creation-only pairs are few (one per letter at most). "Navigated to" entries are
	not, and each holds a copy of its letter, so past 30 of them (MAX_NAVIGATION_ENTRIES) the
	oldest ones that sit right under another "Navigated to" entry leave. All tools' undo reads
	such an entry only to know where the entry above it sends the view, so taking it out loses
	no change: the press above it now sends the view one letter further down. It is taken out
	only when that letter differs from the one above it: "Navigated to B" right over B's own step
	would be a press that does nothing. In a look back and forth (B, C, B, C ...) every entry has
	the same letter above and below, so two neighbors leave together. A "Navigated to" entry
	right under a real step holds that letter's earlier state for All tools' undo, so it always
	stays. So a long look around never grows the list or the crash-recovery copy without end.

	What a dropped step did stays in the font, so undo must never fall back past it to the font as
	it was loaded. Each dropped step is written into History's undo floor (history.undoFloor, the
	state undo falls back to when nothing older is left), oldest first. History.initialProject,
	the font as it was loaded, is never changed: the leave-site check (app.js) compares with it.

	The saved marker (which undo state the work file holds) follows: if the file holds the state
	the newest dropped step left, an empty list is now that state (SAVED_AT_EMPTY); if it holds an
	older one, no undo can reach it any more (null).

	B8 + B9 finalize (second hostile pass: 500 brush strokes on one letter made a crash copy of
	191.6 MB, each of the 200 steps holding the whole letter): the list also keeps at most
	MAX_UNDO_POINTS points of shapes in its entries (entryPoints), the oldest steps leaving first
	the same way, never the newest step. A 58-letter traced font holds about 5,000 points, so its
	30 whole-font steps and 200 steps stay well under it.

	  capUndoQueue(history, limits?)  drop from the old end until every limit holds, then thin out
	                                  "Navigated to" entries past their limit; returns the entries
	                                  dropped from the old end, oldest first
	  countSteps(queue)               { steps, wholeProject }: looking around left out
	  entryPoints(entry)              the points of shapes an entry holds (its letter's, or the
	                                  whole font's for a whole-font entry; worked out once)
*/
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import {
	SAVED_AT_EMPTY,
	indexOfNextItemEntry,
	indexOfPairedPre,
	isLookingAroundEntry,
	isNavigationEntry,
	isWholeProjectPost,
} from './history_helpers.js';
import { removeItem, writeItemState } from './item_state.js';
import { applySettingsSnapshot } from './settings_snapshot.js';

export const MAX_UNDO_STEPS = 200;
export const MAX_WHOLE_PROJECT_STEPS = 30;
/**
 * "Navigated to" entries kept before the redundant ones are thinned out (they are not steps).
 * Each holds a copy of one letter, and upstream's undo reads them only to move the view.
 */
export const MAX_NAVIGATION_ENTRIES = 30;
/** The most points of shapes the list's entries hold together (B8 + B9 finalize) */
export const MAX_UNDO_POINTS = 400000;

/**
 * @param {Array} queue - History.queue
 * @returns {{steps: Number, wholeProject: Number}} changes to the font the list holds, and how
 *   many of them are whole-project steps (a pre / post pair counts once, by its pre). Steps
 *   that only looked around (isLookingAroundEntry) are not counted.
 */
export function countSteps(queue = []) {
	let steps = 0;
	let wholeProject = 0;
	queue.forEach((entry) => {
		if (!entry || isWholeProjectPost(entry) || isLookingAroundEntry(entry)) return;
		steps++;
		if (entry.wholeProjectSave) wholeProject++;
	});
	return { steps, wholeProject };
}

/**
 * @param {Object} history - History (queue, savedMarker, initialProject, undoFloor)
 * @param {Object} [limits]
 * @param {Number} [limits.maxSteps]
 * @param {Number} [limits.maxWholeProject]
 * @param {Number} [limits.maxNavigation]
 * @returns {Array} the entries dropped from the old end, oldest first
 */
export function capUndoQueue(
	history,
	{
		maxSteps = MAX_UNDO_STEPS,
		maxWholeProject = MAX_WHOLE_PROJECT_STEPS,
		maxNavigation = MAX_NAVIGATION_ENTRIES,
		maxPoints = Infinity,
	} = {}
) {
	const queue = history?.queue;
	if (!Array.isArray(queue)) return [];
	const dropped = [];
	let count = countSteps(queue);
	let points = Number.isFinite(maxPoints) ? queuePoints(queue) : 0;
	const tooBig = () => points > maxPoints && count.steps > 1;
	while (
		queue.length &&
		(count.steps > maxSteps || count.wholeProject > maxWholeProject || tooBig())
	) {
		const step = takeOldestStep(queue);
		step.forEach((entry) => foldIntoFloor(history, entry));
		dropped.push(...step);
		count = countSteps(queue);
		if (Number.isFinite(maxPoints)) points = queuePoints(queue);
	}
	if (dropped.length) moveSavedMarker(history, dropped);
	thinNavigation(history, maxNavigation);
	return dropped;
}

/** Points of shapes kept per entry, worked out once (an entry's copy never changes) */
const pointsOf = new WeakMap();

/**
 * @param {Object} entry - a History entry
 * @returns {Number} the points of shapes its copy holds (0 for a settings entry)
 */
export function entryPoints(entry) {
	if (!entry || typeof entry !== 'object') return 0;
	if (pointsOf.has(entry)) return pointsOf.get(entry);
	const state = entry.itemState;
	let points = 0;
	if (state && typeof state === 'object') {
		const items = state.glyphs
			? [state.glyphs, state.ligatures, state.components].flatMap((group) =>
					Object.values(group || {})
			  )
			: [state];
		items.forEach((item) =>
			(item?.shapes || []).forEach((shape) => {
				points += Array.isArray(shape?.pathPoints) ? shape.pathPoints.length : 1;
			})
		);
	}
	pointsOf.set(entry, points);
	return points;
}

/** @returns {Number} the points every entry of the list holds */
function queuePoints(queue) {
	return queue.reduce((sum, entry) => sum + entryPoints(entry), 0);
}

/**
 * Past the limit, takes out the oldest "Navigated to" entries that sit right under another one.
 * Such an entry is only ever read by the entry right above it, which is a "Navigated to" entry
 * too: undoing that one moves the view to the next item down and changes no letter. It leaves
 * only when the letter the view would then move to (the next item entry below it) differs from
 * the one above it; otherwise the entry above leaves with it when the one above that names
 * another letter. The font is the same at all of them, so a saved marker on one that leaves
 * moves up onto the entry that now does its job.
 * @param {Object} history - History (queue, savedMarker)
 * @param {Number} max
 */
function thinNavigation(history, max) {
	const queue = history.queue;
	let count = queue.filter(isNavigationEntry).length;
	let i = queue.length - 1;
	while (i > 0 && count > max) {
		if (!isNavigationEntry(queue[i]) || !isNavigationEntry(queue[i - 1])) {
			i--;
			continue;
		}
		const below = itemIDBelow(queue, i);
		if (queue[i - 1].itemID !== below) {
			takeOut(history, i, 1);
			count--;
			i--;
		} else if (i > 1 && isNavigationEntry(queue[i - 2]) && queue[i - 2].itemID !== below) {
			takeOut(history, i - 1, 2);
			count -= 2;
			i -= 2;
		} else {
			i--;
		}
	}
}

/**
 * @param {Array} queue
 * @param {Number} index
 * @returns {String | false | undefined} the item the next item entry under index is about
 *   (undefined when none is left: undo then falls back to the undo floor)
 */
function itemIDBelow(queue, index) {
	const below = indexOfNextItemEntry(queue, index + 1);
	return below > -1 ? queue[below].itemID : undefined;
}

/**
 * Takes entries out of the middle of the list; a saved marker on one of them moves onto the
 * entry right above them (the same font).
 * @param {Object} history
 * @param {Number} start - index of the newest entry to take
 * @param {Number} count
 */
function takeOut(history, start, count) {
	const gone = history.queue.splice(start, count);
	if (gone.includes(history.savedMarker)) history.savedMarker = history.queue[start - 1];
}

/**
 * Removes the oldest step from the old end of the queue.
 * @param {Array} queue
 * @returns {Array} its entries, oldest first
 */
function takeOldestStep(queue) {
	const last = queue.length - 1;
	const oldest = queue[last];
	if (oldest?.wholeProjectSave && !isWholeProjectPost(oldest)) {
		// The post that closes this pre is the nearest newer entry that is not a settings entry
		for (let i = last - 1; i >= 0; i--) {
			if (queue[i]?.settingsSave) continue;
			if (isWholeProjectPost(queue[i]) && indexOfPairedPre(queue, i) === last) {
				return queue.splice(i).reverse();
			}
			break;
		}
	}
	return [queue.pop()];
}

/**
 * Writes what one dropped entry left behind into the undo floor.
 * @param {Object} history
 * @param {Object} entry
 */
function foldIntoFloor(history, entry) {
	if (!entry) return;
	if (entry.wholeProjectSave) {
		// The whole font after this entry. The entry has left the list, so its copy is the
		// floor's alone; undo always restores from a fresh copy of it (history.js swapProject).
		if (typeof entry.itemState?.save === 'function') history.undoFloor = entry.itemState;
		return;
	}
	const floor = ensureFloor(history);
	if (!floor) return;
	if (entry.settingsSave) {
		if (entry.settingsState) applySettingsSnapshot(floor.settings, entry.settingsState);
		return;
	}
	if (!entry.itemID || !entry.itemState) return;
	// A deletion step holds the item as it was before it was deleted
	if (entry.itemWasDeleted) removeItem(floor, entry.itemID);
	else writeItemState(floor, entry.itemID, entry.itemState);
}

/**
 * @param {Object} history
 * @returns {Object | null} the undo floor, made from the loaded font the first time
 */
function ensureFloor(history) {
	if (history.undoFloor) return history.undoFloor;
	const loaded = history.initialProject;
	if (typeof loaded?.save !== 'function') return null;
	history.undoFloor = new GlyphrStudioProject(loaded.save());
	return history.undoFloor;
}

/**
 * @param {Object} history
 * @param {Array} dropped - oldest first
 */
function moveSavedMarker(history, dropped) {
	const marker = history.savedMarker;
	if (marker === null || marker === undefined) return;
	if (marker === dropped[dropped.length - 1]) history.savedMarker = SAVED_AT_EMPTY;
	else if (marker === SAVED_AT_EMPTY || dropped.includes(marker)) history.savedMarker = null;
}
