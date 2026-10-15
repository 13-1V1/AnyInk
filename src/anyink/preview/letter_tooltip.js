// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The tooltip on a letter in the preview strip (UX-BEGINNER.md 4.0: "Double-click a letter: open
	it. Tooltip 'Double-click to work on d'"), so the way back to a letter is on screen on every
	page the strip shows (B4 + B5 fix pass). House words in both modes (the strip is a shared
	display point). In Simple a joined letter opens in More tools (6.3), and the tooltip says so.

	  stripLetterTooltip(charData, { simple, editor })  -> 'Double-click to work on small d', or
	                                               '' when a double-click there opens nothing: not
	                                               a letter, or (B4 + B5 finalize) the letter
	                                               already open in editor
*/
import { isSimpleMode } from '../mode/mode.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { navigationTargetForChar } from './hit_test.js';
import { isItemOpen } from './show_item.js';

/**
 * @param {Object | false} charData - TextBlock charData under the pointer (hit_test.js)
 * @param {{simple?: Boolean, editor?: Object}} [options] - editor: the strip's editor; the letter
 *   it has open says nothing (the strip's double-click leaves it as it is)
 * @returns {String}
 */
export function stripLetterTooltip(charData, { simple = isSimpleMode(), editor = null } = {}) {
	const target = navigationTargetForChar(charData);
	if (!target) return '';
	if (editor && isItemOpen(editor, target.id)) return '';
	const letter = letterPhrase(charData.item?.chars || charData.char || '');
	if (!letter) return '';
	const inMoreTools = simple && target.page !== 'Characters';
	return word(inMoreTools ? 'strip.openInMoreTools' : 'strip.openHint', { letter });
}
