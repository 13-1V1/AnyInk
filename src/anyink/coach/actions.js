// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: what the Next line's button does (UX-BEGINNER.md 4.0). rules.js names an action and its
	args; this runs it. The actions that exist today are here; each later B registers its own
	when its flag turns on (the rule that offers it is skipped until then, principle 8):
	  save              Save (rule 10): the work file, or the save dialog the first time
	  fixSave           Fix (rule 10 after a failed save): the status pill's own Fix box,
	                    "Couldn't save to <file>. A backup copy is kept." [Try again] [Save
	                    somewhere else] (topbar/status_pill.js showFix; B6 + B7 fix pass)
	  goToLetter        { char }: opens that letter (rule 15), as Show me does
	  fixFontProblem    { itemId, problem }: B1's Fix it, then the font check again (rule 6)
	  showFontProblem   { itemId }: opens what the font check names (rule 6)
	  how, nextPart     B9: the How card; the photo dialog on the photo's next part
	  tryIt             B12: opens Try it
	  useInWord         B14: the Use in Word dialog
	  fixLetter, showNeedsLook   B11: a letter's fix; the board's "Needs a look" filter
	  addNumbers        B10: "+ Numbers & symbols"
	Every press is also announced on window as 'anyink-coach-action' { action, args }, so a
	later B can listen without importing this.

	  ACTION_EVENT
	  setCoachAction(name, handler)   handler(args, { editor }); returns the one it replaced;
	                                  null removes it
	  hasCoachAction(name)
	  runCoachAction(name, args, { editor })   true when a handler ran
	  resetCoachActionsForTests()
*/
import { runFileCommand } from '../files/run_command.js';
import { runFontCheckNow } from '../fontcheck/font_check.js';
import { fixProblem } from '../preview/fix_it.js';
import { showItem } from '../preview/show_item.js';
import { showFix } from '../topbar/status_pill.js';
import { charToHex } from '../../common/character_ids.js';

export const ACTION_EVENT = 'anyink-coach-action';

/** @type {Readonly<Object<String, Function>>} */
const BUILT_IN = Object.freeze({
	save: (_args, { editor }) => {
		if (typeof editor?.saveProjectFile !== 'function') return false;
		runFileCommand(() => editor.saveProjectFile());
		return true;
	},
	fixSave: (_args, { editor }) => {
		if (!editor) return false;
		showFix(editor);
		return true;
	},
	goToLetter: (args, { editor }) => {
		const hex = charToHex(args?.char);
		return !!hex && showItem(editor, `glyph-${hex}`);
	},
	fixFontProblem: (args, { editor }) => {
		if (!editor) return false;
		const fixed = fixProblem(editor, args);
		runFontCheckNow(editor);
		return fixed;
	},
	showFontProblem: (args, { editor }) => showItem(editor, args?.itemId),
});

/** @type {Map<String, Function>} */
let handlers = new Map(Object.entries(BUILT_IN));

/**
 * @param {String} name
 * @param {Function | null} handler - (args, { editor }) => any
 * @returns {Function | null} the handler it replaced
 */
export function setCoachAction(name, handler) {
	const previous = handlers.get(name) || null;
	if (typeof handler === 'function') handlers.set(name, handler);
	else handlers.delete(name);
	return previous;
}

/**
 * @param {String} name
 * @returns {Boolean}
 */
export function hasCoachAction(name) {
	return handlers.has(name);
}

/**
 * Runs the button's action in the press itself, so a picker it opens keeps the click.
 * @param {String} name
 * @param {Object | null} args
 * @param {{editor?: Object}} [context]
 * @returns {Boolean} true when a handler ran
 */
export function runCoachAction(name, args, { editor = null } = {}) {
	globalThis.dispatchEvent?.(
		new CustomEvent(ACTION_EVENT, { detail: { action: name, args: args ?? null } })
	);
	const handler = handlers.get(name);
	if (!handler) {
		console.warn(`ANY-INK coach: nothing does "${name}" yet`);
		return false;
	}
	try {
		handler(args ?? null, { editor });
	} catch (error) {
		console.warn(`ANY-INK coach: "${name}" failed`, error);
	}
	return true;
}

/** Back to the built-in actions only. */
export function resetCoachActionsForTests() {
	handlers = new Map(Object.entries(BUILT_IN));
}
