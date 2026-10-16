// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 (docs/SKETCH.md 2): puts the five sketch tools behind their names in tool_route.js, once per
	page. events.js initEventHandlers calls it with every edit canvas; tests/sketch_draw.html too.
	Each tool reads the editor and the letter from the event it is handed (tools/line.js
	SketchTool.see), so one set serves every canvas. Harmless with the 'sketch' flag off: nothing
	is routed to them then. S2 integration: each tool gets the letter's snap context
	(snap_context.js: its edges and middle while spacing is his, the ink's middle otherwise).

	  installSketchTools()      registers them (a second call does nothing); returns the handlers
	  uninstallSketchToolsForTests()
*/
import { makeArcTool } from './arc_tool.js';
import { makeCircleTool } from './circle_tool.js';
import { makeLineTool } from './line.js';
import { makeRectTool } from './rect_tool.js';
import { makeSplineTool } from './spline_tool.js';
import { snapContextOf } from './snap_context.js';
import { registerSketchTool } from './tool_route.js';

/** tool_route.js name -> the tool's maker */
const MAKERS = Object.freeze({
	sketchLine: makeLineTool,
	sketchArc: makeArcTool,
	sketchSpline: makeSplineTool,
	sketchCircle: makeCircleTool,
	sketchRectangle: makeRectTool,
});

/** @type {{handlers: Object, undo: Array<Function>} | null} */
let installed = null;

/**
 * @returns {Object<String, Object>} tool name -> handler
 */
export function installSketchTools() {
	if (installed) return installed.handlers;
	const handlers = {};
	const undo = [];
	Object.entries(MAKERS).forEach(([tool, make]) => {
		handlers[tool] = make({ snapContext: snapContextOf });
		undo.push(registerSketchTool(tool, handlers[tool]));
	});
	installed = { handlers, undo };
	return handlers;
}

/** Tests: take them off again */
export function uninstallSketchToolsForTests() {
	installed?.undo.forEach((forget) => forget());
	installed = null;
}
