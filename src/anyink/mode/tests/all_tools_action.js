// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5 test helper: an icon's action as All tools draws it, for tests that press a button Simple
	doesn't draw (getActionData filters by mode since B5) to check what its code does in Simple,
	e.g. B2's Delete and Undo, B4's Merge toast. The mode is put back afterwards
	(setModeForTests, so the session starts over: no visit, hasUsedSimple only for Simple).

	  actionInAllTools(group, iconName)   the getActionData entry, or undefined
*/
import { getActionData } from '../../../panels/actions.js';
import { getMode, setModeForTests } from '../mode.js';

/**
 * @param {String} group - a getActionData name ('glyphActions')
 * @param {String} iconName - 'deleteGlyph'
 * @returns {Object | undefined}
 */
export function actionInAllTools(group, iconName) {
	const mode = getMode();
	setModeForTests('all');
	try {
		return getActionData(group).find((data) => data.iconName === iconName);
	} finally {
		setModeForTests(mode);
	}
}
