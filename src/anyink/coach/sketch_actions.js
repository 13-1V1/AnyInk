// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3: what the Next line's sketch buttons do (rules.js rules 19, 24 and 25), and the Next line
	read again whenever a piece opens, gets a point or ends (sketch/tools/undo_gate.js
	SKETCH_PIECE_EVENT): a click on the paper changes no font topic, so rule 19 would wait for one.
	Installed once by the letter view (letter/open_tool.js watchOpenTool, which the Characters page
	calls), only with the 'sketch' flag on.

	  sketchFinishPiece      [Done] (rule 19): Enter to the picked sketch tool (a dot on one point,
	                         as Enter makes it); with no tool to take it, the open piece is ended
	                         (undo_gate.js endOpenPiece)
	  sketchThicknessOk      [Looks good] (rule 24): the letter's thickness becomes the font's
	                         (settings.anyink.sketchThickness, what new sketched letters start at).
	                         Nothing he sees changes, so it is no Undo step; the work file is
	                         marked behind (recovery.js markDirty) so the value is saved
	  sketchUseOnAll         [Use on all] (rule 25): sketch/thickness_all.js useThicknessOnAll at
	                         the line's thickness, ONE whole-font step (S3 integration)
	  sketchJustThisOne      [Just this one] (rule 25): the offer goes (thickness_all.js
	                         justThisOne) and the line's own skip ("Something else")
	  ('closeOutline' is S7's)

	  installSketchCoach({ isOn })   registers them and the piece listener (a second call does
	                                 nothing); true when installed
	  SKETCH_COACH_ACTIONS
	  resetSketchCoachForTests()
*/
import { isFeatureOn } from '../mode/features.js';
import { markDirty } from '../recovery/recovery.js';
import { justThisOne as dropThicknessOffer, useThicknessOnAll } from '../sketch/thickness_all.js';
import { setSketchThickness, sketchOf } from '../sketch/model.js';
import { sketchToolHandler } from '../sketch/tools/tool_route.js';
import { endOpenPiece, isPieceOpen, SKETCH_PIECE_EVENT } from '../sketch/tools/undo_gate.js';
import { setCoachAction } from './actions.js';
import { getCoach } from './coach_state.js';

export const SKETCH_COACH_ACTIONS = Object.freeze([
	'sketchFinishPiece',
	'sketchThicknessOk',
	'sketchJustThisOne',
	'sketchUseOnAll',
]);

/**
 * [Done]: the picked tool hears Enter, as if he pressed it.
 * @param {Object} _args
 * @param {{editor?: Object}} context
 * @returns {Boolean} true when no piece is open any more
 */
export function finishPiece(_args, { editor } = {}) {
	if (!isPieceOpen()) return true;
	const tool = editor?.selectedTool;
	const handler = sketchToolHandler(tool);
	if (typeof handler?.key === 'function') {
		try {
			handler.key({
				type: 'down',
				key: 'enter',
				name: 'Enter',
				shift: false,
				ctrl: false,
				alt: false,
				repeat: false,
				tool,
				editor,
			});
		} catch (error) {
			console.warn('ANY-INK coach: the sketch tool could not finish the piece', error);
		}
	}
	if (isPieceOpen()) endOpenPiece();
	return !isPieceOpen();
}

/**
 * [Looks good]: the open letter's thickness becomes the font's.
 * @param {{thickness?: Number}} args
 * @param {{editor?: Object}} context
 * @returns {Number | null} what was stored
 */
export function keepThickness(args, { editor } = {}) {
	const project = editor?.project;
	if (!project) return null;
	const id = editor.selectedItemID;
	const item = id && typeof project.getItem === 'function' ? project.getItem(id) : null;
	const value = Number(args?.thickness) > 0 ? Number(args.thickness) : sketchOf(item)?.thickness;
	const before = project.settings?.anyink?.sketchThickness ?? null;
	const stored = setSketchThickness(project, value);
	// S3 integration: no step, but the font changed, so the work file is behind until saved
	if (stored !== before) markDirty(editor);
	getCoach().refresh();
	return stored;
}

/**
 * [Use on all]: every sketched letter at the line's thickness, one whole-font step.
 * @param {{thickness?: Number}} args
 * @param {{editor?: Object}} context
 * @returns {Promise<Boolean>}
 */
export async function useOnAll(args, { editor } = {}) {
	const value = Number(args?.thickness) > 0 ? Number(args.thickness) : undefined;
	const done = await useThicknessOnAll(editor, { value });
	getCoach().refresh();
	return done;
}

/** [Just this one]: the offer goes, and the line is skipped as "Something else" does */
export function justThisOne() {
	dropThicknessOffer();
	return getCoach().skip();
}

const HANDLERS = Object.freeze({
	sketchFinishPiece: finishPiece,
	sketchThicknessOk: keepThickness,
	sketchJustThisOne: justThisOne,
	sketchUseOnAll: useOnAll,
});

/** @type {Function | null} */
let onPiece = null;

/**
 * @param {{isOn?: (flag: String) => Boolean}} [options]
 * @returns {Boolean}
 */
export function installSketchCoach({ isOn = isFeatureOn } = {}) {
	if (!isOn('sketch')) return false;
	if (onPiece) return true;
	Object.entries(HANDLERS).forEach(([name, handler]) => setCoachAction(name, handler));
	onPiece = () => getCoach().refresh();
	globalThis.addEventListener?.(SKETCH_PIECE_EVENT, onPiece);
	return true;
}

export function resetSketchCoachForTests() {
	if (onPiece) globalThis.removeEventListener?.(SKETCH_PIECE_EVENT, onPiece);
	onPiece = null;
	SKETCH_COACH_ACTIONS.forEach((name) => setCoachAction(name, null));
}
