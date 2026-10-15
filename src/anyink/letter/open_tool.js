// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: the tool a letter opens with in the Simple letter view (UX-BEGINNER.md 4.3
	Tools): the Brush on an empty letter, Select on a letter with ink (nib/default_tool.js
	toolForOpenedLetter decides; nothing changes while 'brush' is off, and All tools keeps the tool
	he had). The Brush picked this way is remembered as the opening Brush (default_tool.js
	isOpeningBrush): the empty-letter box stays with [Use a photo] green, a drag on the paper draws
	at once, and his own pick of the Brush puts the box away.
	While the photo flow's step C runs on the letter (photo_flow.js startPart opens the letter for
	the part it traces) the letter opens with Select, so a drag never draws on the letter behind
	the result he is looking at; and when step C starts on the letter already open (Use the same
	photo, Trace again, a photo dropped on it) with a drawing tool picked, Select is picked then
	(found in Chrome: the opening Brush stayed through step C and after Use it).
	The pick waits for the press that opened the letter to finish (a microtask): Undo moving to
	another letter has undone by then, and startPart has started its flow. A tool picked in
	between (by him, or by the code that opened the letter) wins, and a shape the Point pen is
	still drawing is never cut short: no tool is picked then.

	  applyOpenTool(editor)    picks the tool for the open letter now; returns it, or null when
	                           nothing was picked (not the Simple letter view, 'brush' off)
	  watchOpenTool(editor)    picks it now and whenever another letter opens, and Select when
	                           step C starts on the open letter (subscribers
	                           'anyink.letter.openTool', 'anyink.letter.stepCTool')
	  OPEN_TOOL_SUBSCRIBER
*/
import { selectTool } from '../../edit_canvas/tools/tools.js';
import { openPathOf } from '../coach/open_shape.js';
import { isOpeningBrush, pickOpeningTool, toolForOpenedLetter } from '../nib/default_tool.js';
import { getFlow } from '../photo/photo_flow_state.js';
import { isLetterViewOn } from './view_switches.js';

export const OPEN_TOOL_SUBSCRIBER = 'anyink.letter.openTool';
export const STEP_C_TOOL_SUBSCRIBER = 'anyink.letter.stepCTool';

/** The drawing tools step C puts down */
const DRAWING_TOOLS = Object.freeze(['nib', 'newPath', 'newRectangle', 'newOval']);

/**
 * @param {Object} editor - ProjectEditor
 * @returns {String | null} the tool picked
 */
export function applyOpenTool(editor) {
	if (!isLetterViewOn() || editor?.nav?.page !== 'Characters') return null;
	const id = editor.selectedGlyphID;
	if (!id || typeof editor.project?.getItem !== 'function') return null;
	const item = editor.project.getItem(id) || null;
	const open = openPathOf(editor);
	if (open) return null;
	let tool = toolForOpenedLetter(item, { open });
	if (!tool) return null;
	const flow = getFlow(editor);
	if (flow && flow.itemId === id) tool = 'resize';
	// nothing to tell: the tool is already the one, and an opening Brush already this letter's
	if (editor.selectedTool === tool && (tool !== 'nib' || isOpeningBrush(editor))) return tool;
	try {
		pickOpeningTool(editor, tool, (name) => selectTool(name));
	} catch (error) {
		// a pick that fails leaves the tool he had; the letter still opens
		console.warn('ANY-INK letter: the tool for the opened letter could not be picked', error);
		return null;
	}
	return tool;
}

/**
 * @param {Object} editor - ProjectEditor
 */
export function watchOpenTool(editor) {
	if (typeof editor?.subscribe !== 'function') return;
	const later = () => {
		const before = editor.selectedTool;
		queueMicrotask(() => {
			if (editor.selectedTool === before) applyOpenTool(editor);
		});
	};
	later();
	editor.subscribe({
		topic: 'whichGlyphIsSelected',
		subscriberID: OPEN_TOOL_SUBSCRIBER,
		callback: later,
	});
	// the photo flow says every change of step C on 'autoTrace'; only its start picks Select
	let running = '';
	editor.subscribe({
		topic: 'autoTrace',
		subscriberID: STEP_C_TOOL_SUBSCRIBER,
		callback: () => {
			const flow = getFlow(editor);
			const now = flow ? `${flow.itemId}|${flow.asset}|${flow.partId}` : '';
			if (now === running) return;
			running = now;
			if (now) selectForStepC(editor, flow);
		},
	});
}

/**
 * Step C started on the open letter with a drawing tool picked: Select, as the letter would
 * open with during step C.
 * @param {Object} editor
 * @param {Object} flow - getFlow
 * @returns {Boolean} true when Select was picked
 */
export function selectForStepC(editor, flow) {
	if (!isLetterViewOn() || editor?.nav?.page !== 'Characters') return false;
	if (flow?.itemId !== editor.selectedGlyphID || openPathOf(editor)) return false;
	if (!DRAWING_TOOLS.includes(editor.selectedTool)) return false;
	try {
		pickOpeningTool(editor, 'resize', (name) => selectTool(name));
	} catch (error) {
		console.warn('ANY-INK letter: Select could not be picked for step C', error);
		return false;
	}
	return true;
}
