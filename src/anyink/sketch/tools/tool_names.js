// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 (docs/SKETCH.md section 2): the five sketch tools' names, as the edit canvas, the key map
	and the tool column know them. Pure: no editor, no DOM.

	The names are editor.selectedTool values, beside upstream's ('resize', 'newPath') and the
	Brush's ('nib'). Their words are the S1 set's sketch.tool.* entries (words/sets/sketch.js),
	never a 'tool.<name>' entry, so toolWordKey says which entry to read.

	  SKETCH_TOOLS            the five, in the order the tool column lists them
	  isSketchTool(tool)      true for one of them
	  toolWordKey(tool)       the words key of a tool's name: 'sketch.tool.line' for a sketch
	                          tool, 'tool.<name>' for any other
*/

/** In the column's order (SKETCH.md section 2: Line, Arc, Spline, Circle; Rectangle by its key) */
export const SKETCH_TOOLS = Object.freeze([
	'sketchLine',
	'sketchArc',
	'sketchSpline',
	'sketchCircle',
	'sketchRectangle',
]);

/** Each tool's words key (words/sets/sketch.js) */
const WORD_KEYS = Object.freeze({
	sketchLine: 'sketch.tool.line',
	sketchArc: 'sketch.tool.arc',
	sketchSpline: 'sketch.tool.spline',
	sketchCircle: 'sketch.tool.circle',
	sketchRectangle: 'sketch.tool.rectangle',
});

/**
 * @param {String} tool - editor.selectedTool
 * @returns {Boolean}
 */
export function isSketchTool(tool) {
	return typeof tool === 'string' && SKETCH_TOOLS.includes(tool);
}

/**
 * @param {String} tool
 * @returns {String} the words key of the tool's name
 */
export function toolWordKey(tool) {
	return WORD_KEYS[tool] || `tool.${tool}`;
}
