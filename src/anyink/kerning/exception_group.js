// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kern exception groups (Milestone 5, D-010).
	Alt-drag on a class group kerns one specific pair instead of the whole class. That pair
	gets its own one-by-one KernGroup (an "exception"), which the lookup ranks above any
	class group. If an exception for the pair already exists it is reused, never duplicated.

	Creation is a whole-project history change (pre / post state) so one undo removes it.
	The current view is copied onto the new group so the canvas does not jump mid-drag.
*/
import { hexesToChars } from '../../common/character_ids.js';
import { makeKernGroupID } from '../../pages/kerning.js';
import { KernGroup } from '../../project_data/kern_group.js';
import { isOneByOne, lookupKernPair, notifyKernPairsChanged } from './kern_lookup.js';
import { kernPairState } from './pair_state.js';

/**
 * Find an existing one-by-one group for a pair.
 * @param {Object} project
 * @param {String} leftHex
 * @param {String} rightHex
 * @returns {Object | false} KernGroup
 */
export function findExceptionGroup(project, leftHex, rightHex) {
	const entry = lookupKernPair(project, leftHex, rightHex);
	if (!entry) return false;
	const group = project.kerning[entry.groupID];
	return group && isOneByOne(group) ? group : false;
}

/**
 * Get or create the exception group for a pair, select it, and keep the current view.
 * @param {Object} editor - ProjectEditor
 * @param {Object} sourceGroup - the class KernGroup being viewed
 * @param {{left: String, right: String}} reps - representative hex ids
 * @returns {Object | false} the selected exception KernGroup
 */
export function selectOrCreateExceptionGroup(editor, sourceGroup, reps) {
	if (!editor || !sourceGroup || !reps?.left || !reps?.right) return false;
	const project = editor.project;
	const view = { dx: editor.view.dx, dy: editor.view.dy, dz: editor.view.dz };

	let group = findExceptionGroup(project, reps.left, reps.right);
	if (!group) {
		const pairName = `${hexesToChars(reps.left) || reps.left}${hexesToChars(reps.right) || reps.right}`;
		editor.history.addWholeProjectChangePreState(`Kern exception for pair ${pairName}`);
		const newID = makeKernGroupID(project.kerning);
		group = project.addItemByType(
			new KernGroup({
				leftGroup: [reps.left],
				rightGroup: [reps.right],
				value: sourceGroup.value,
			}),
			'KernGroup',
			newID
		);
		editor.history.addWholeProjectChangePostState();
		notifyKernPairsChanged(editor, { groupID: newID, value: group.value, created: true });
	}

	kernPairState.representative[group.id] = { left: reps.left, right: reps.right };
	editor.selectedKernGroupID = group.id;
	editor.view = view;
	return group;
}
