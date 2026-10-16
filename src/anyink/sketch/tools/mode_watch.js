// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 integration (docs/SKETCH.md 2: the sketch tools are Simple's; All tools keeps its keys and
	its column): when the mode changes (More tools, ?ui=, the switch), a sketch piece still open is
	finished as its own step, and a sketch tool the new mode does not show gives way to Select, so
	All tools never sits on a tool it has no button for. Listens once a page.

	  watchSketchMode({ editorOf, pick })   starts listening (a second call does nothing); returns
	                                        the stop function
	  afterModeChange({ editorOf, pick })   what a mode change does (tests call it directly):
	                                        'select' when Select was picked, else null
*/
import { MODE_EVENT } from '../../mode/mode.js';
import { isShown } from '../../mode/visibility.js';
import { isSketchTool } from './tool_names.js';
import { endOpenPiece } from './undo_gate.js';

/** @type {Function | null} */
let stop = null;

/**
 * @param {Object} options
 * @param {() => Object} options.editorOf - the current ProjectEditor
 * @param {(tool: String) => void} options.pick - tools.js selectTool
 * @returns {'select' | null}
 */
export function afterModeChange({ editorOf, pick }) {
	endOpenPiece();
	const editor = editorOf?.();
	const tool = editor?.selectedTool;
	if (!isSketchTool(tool) || isShown('tool', tool)) return null;
	pick?.('resize');
	return 'select';
}

/**
 * @param {Object} options - as afterModeChange
 * @returns {Function} stop listening
 */
export function watchSketchMode(options) {
	if (stop || typeof globalThis.addEventListener !== 'function') return stop || (() => {});
	const listener = () => {
		try {
			afterModeChange(options);
		} catch (error) {
			console.warn('ANY-INK sketch: the mode change could not put the sketch tool down', error);
		}
	};
	globalThis.addEventListener(MODE_EVENT, listener);
	stop = () => {
		globalThis.removeEventListener(MODE_EVENT, listener);
		stop = null;
	};
	return stop;
}
