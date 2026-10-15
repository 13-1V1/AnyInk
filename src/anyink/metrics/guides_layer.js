// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK guides layer (Milestone 5, D-008 / D-009).
	An always-active layer that gets first look at pointer events on the edit canvas,
	so metric lines (ascent, cap height, x-height, baseline, descent), custom guides,
	and side bearings can be dragged with any tool active, on the glyph and kern canvases.

	Contract used by the hooks in src/edit_canvas/events_mouse.js and edit_canvas.js:
	- handleGuidesLayerEvent(event): called for left-button mousedown / mousemove / mouseup
	  BEFORE the active tool sees the event. Return true to swallow the event.
	- drawGuidesLayerOverlay(ctx, view, item): called after the guides are drawn, on both the
	  glyph and kern canvases; draws hover / drag highlights and live value labels (overlay.js).
	- guidesLayerState: { hover, dragging, ... } read by the drawing code (state.js).

	Rules (DESIGN_DOC 6): one narrow topic per drag tick, one history entry on release,
	Shift snaps to 10, arrow keys nudge the hovered line by 1 (Shift 10).
	Pointer priority: with the pen or add-point tool active, a point or handle under the
	pointer wins over a line that happens to run through it. With the Trace panel open, a
	trace image's corner handle wins the same way (Milestone 7, D-028).
	B3 (UX-BEGINNER 7.2): a side edge drag or an arrow-key side nudge is spacing set by hand.
	An automatic letter is marked 'manual' before the step is recorded, so the refit hook at the
	top of History.addState (src/anyink/spacing/history_hook.js) leaves it where it was put. In
	Simple the photo moves with the shapes while the left edge moves them; All tools leaves the
	photo where it is, as before.
	B5 (UX-BEGINNER 7.6): in Simple the horizontal lines ('metric' and 'baseline') are locked at
	both gates (mode/locks.js): handleGuidesLayerEvent never finds one (findLineAt leaves them
	out, so the press goes to the tool and an edge crossing one wins), and onKeyDown never nudges
	one. The side edges and guides added in More tools stay draggable. All tools locks nothing.
	Fix track: in Simple the side edges of a letter with no shapes lock too (a press there goes to
	the tool or the photo's corner); in both modes an edge drag or an arrow nudge stops at width 0
	(UX-BEGINNER 7.2: the font file can't hold a width below zero), and a press that moves nothing
	records nothing.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { setCursor } from '../../edit_canvas/cursors.js';
import { isOverControlPoint } from '../../edit_canvas/detect_edit_affordances.js';
import { cXsX, cYsY } from '../../edit_canvas/edit_canvas.js';
import {
	commitSettingsHistory,
	moveBaseline,
	setCustomGuideLocation,
	setFontMetric,
} from './font_metrics.js';
import { collectGuideLines, HIT_ZONE_PX, hitTestLines } from './hit_test.js';
import { clampBaselineDelta, METRIC_LABELS, metricValue, snapToTen } from './metrics_math.js';
import { guidesLayerState, resetGuidesLayerState } from './state.js';
import { isGuideLineLocked } from '../mode/locks.js';
import { isSimpleMode } from '../mode/mode.js';
import { markManual } from '../spacing/owner.js';
import { followShapes } from '../spacing/trace_follow.js';
import { traceHandleHasPriority } from '../trace/trace_layer.js';

export { drawGuidesLayerOverlay } from './overlay.js';
export { guidesLayerState } from './state.js';

const PEN_TOOLS = ['pathEdit', 'pathAddPoint'];
const INPUT_TAGS = ['input', 'input-number', 'option-chooser', 'option-toggle', 'textarea'];

let listenersInstalled = false;
const watchedCanvases = new WeakSet();

// --------------------------------------------------------------
// Pointer events
// --------------------------------------------------------------

/**
 * @param {MouseEvent} event - left-button mousedown / mousemove / mouseup from the canvas
 * @returns {Boolean} true when the layer consumed the event
 */
export function handleGuidesLayerEvent(event) {
	if (!event) return false;
	installListeners();
	watchCanvas(event.currentTarget || event.target);

	const editor = getCurrentProjectEditor();
	if (!editor?.nav?.isOnEditCanvasPage) return false;

	const pos = pointerPosition(event);
	guidesLayerState.pointer = pos;

	switch (event.type) {
		case 'mousedown':
			return onMouseDown(editor, event, pos);
		case 'mousemove':
			return onMouseMove(editor, event, pos);
		case 'mouseup':
			return onMouseUp(editor, event, pos);
		default:
			return false;
	}
}

function onMouseDown(editor, event, pos) {
	const state = guidesLayerState;
	if (state.dragging) return true;

	const line = findLineAt(editor, pos);
	if (!line) {
		if (state.hover) clearHover(editor);
		return false;
	}

	state.dragging = line.id;
	state.hover = line.id;
	state.line = line;
	state.changed = false;
	state.baselineDelta = 0;
	state.anchorX = pos.x;
	setCursor(cursorFor(line));
	window.addEventListener('mouseup', onWindowMouseUp, { once: true });
	editor.publish('editCanvasView', editor.view);
	return true;
}

function onMouseMove(editor, event, pos) {
	const state = guidesLayerState;

	if (state.dragging) {
		dragTick(editor, event, pos);
		return true;
	}

	// Left button held and we are not dragging: a tool owns this drag.
	if (event.buttons & 1) {
		if (state.hover) clearHover(editor);
		return false;
	}

	const line = findLineAt(editor, pos);
	const hoverID = line ? line.id : false;
	if (hoverID !== state.hover) {
		state.hover = hoverID;
		state.line = line;
		editor.publish('editCanvasView', editor.view);
	} else if (line) {
		state.line = line;
	}

	if (line) {
		setCursor(cursorFor(line));
		return true;
	}
	return false;
}

function onMouseUp(editor, event, pos) {
	const state = guidesLayerState;
	if (!state.dragging) return false;

	finishDrag(editor);

	// Whatever is under the pointer now is hovered
	const line = findLineAt(editor, pos);
	state.hover = line ? line.id : false;
	state.line = line;
	if (line) setCursor(cursorFor(line));
	editor.publish('editCanvasView', editor.view);
	return true;
}

/** A release outside the canvas still ends the drag. */
function onWindowMouseUp() {
	const state = guidesLayerState;
	if (!state.dragging) return;
	const editor = getCurrentProjectEditor();
	finishDrag(editor);
	state.hover = false;
	state.line = false;
	editor.publish('editCanvasView', editor.view);
}

// --------------------------------------------------------------
// Drag
// --------------------------------------------------------------

function dragTick(editor, event, pos) {
	const state = guidesLayerState;
	const line = state.line;
	if (!line) return;
	const shift = !!event.shiftKey;
	const font = editor.project.settings.font;

	switch (line.kind) {
		case 'metric': {
			const before = metricValue(font, line.key);
			const target = snapToTen(cYsY(pos.y), shift);
			const applied = setFontMetric(line.key, target, { history: false });
			if (applied !== before) state.changed = true;
			line.value = applied;
			break;
		}
		case 'baseline': {
			const target = clampBaselineDelta(font, snapToTen(cYsY(pos.y), shift));
			if (target !== state.baselineDelta) {
				state.baselineDelta = target;
				state.changed = target !== 0;
				editor.publish('editCanvasView', editor.view);
			}
			break;
		}
		case 'guide': {
			const raw = line.orientation === 'h' ? cYsY(pos.y) : cXsX(pos.x);
			const target = snapToTen(raw, shift);
			const applied = setCustomGuideLocation(line.index, target, { history: false });
			if (applied !== false && applied !== line.value) state.changed = true;
			if (applied !== false) line.value = applied;
			break;
		}
		case 'sideBearing':
			sideBearingTick(editor, line, pos, shift);
			break;
	}
}

/**
 * Side bearing drag, the way upstream Tool_Resize did it: the delta is measured from an
 * anchor, the LSB write shifts view.dx so the glyph stays put on screen, and the anchor
 * only advances when a whole unit (or ten, with Shift) was applied.
 */
function sideBearingTick(editor, line, pos, shift) {
	const state = guidesLayerState;
	const item = editor.selectedItem;
	if (!item || item.objType === 'KernGroup') return;
	const view = editor.view;
	const dxEm = (pos.x - state.anchorX) / view.dz;

	if (line.side === 'lsb') {
		const current = item.leftSideBearing;
		const target = keepWidth(item, current, snapToTen(current - dxEm, shift));
		if (target === current) return;
		item.leftSideBearing = target;
		const applied = item.leftSideBearing;
		followShapesInSimple(item, applied - current);
		editor.view = { dx: view.dx + (current - applied) * view.dz };
	} else {
		const current = item.rightSideBearing;
		const target = keepWidth(item, current, snapToTen(current + dxEm, shift));
		if (target === current) return;
		item.rightSideBearing = target;
		line.value = item.advanceWidth;
	}

	state.anchorX = pos.x;
	state.changed = true;
	editor.publish('editCanvasView', editor.view);
}

function finishDrag(editor) {
	const state = guidesLayerState;
	const line = state.line;
	const changed = state.changed;
	const baselineDelta = state.baselineDelta;
	state.dragging = false;
	state.changed = false;
	state.baselineDelta = 0;
	window.removeEventListener('mouseup', onWindowMouseUp);
	if (!line) return;

	const font = editor.project.settings.font;
	switch (line.kind) {
		case 'metric':
			if (changed) {
				const value = metricValue(font, line.key);
				commitSettingsHistory(`Moved ${METRIC_LABELS[line.key]} to ${value}`);
			}
			break;
		case 'guide':
			if (changed) {
				const guide = editor.project.settings.app.guides?.custom?.[line.index];
				if (guide) commitSettingsHistory(`Moved ${guide.name} to ${guide.location}`);
			}
			break;
		case 'baseline':
			if (baselineDelta) moveBaseline(baselineDelta);
			break;
		case 'sideBearing':
			if (changed) {
				const side = line.side === 'lsb' ? 'left' : 'right';
				// B3: set by hand, before the step, so the refit hook never snaps it back
				markManual(editor.selectedItem);
				editor.history.addState(`Updated ${side} side bearing.`);
				editor.publish('currentItem', editor.selectedItem);
			}
			break;
	}
}

// --------------------------------------------------------------
// Keyboard nudge
// --------------------------------------------------------------

function onKeyDown(event) {
	const state = guidesLayerState;
	if (state.dragging || !state.hover || !state.line) return;
	if (event.ctrlKey || event.metaKey || event.altKey) return;
	if (isFocusedOnInput()) return;

	const line = state.line;
	// B5: a line Simple locks never moves, even one hovered before Simple came on
	if (isGuideLineLocked(line, { item: getCurrentProjectEditor()?.selectedItem })) return;
	let step = 0;
	if (line.orientation === 'h') {
		if (event.key === 'ArrowUp') step = 1;
		else if (event.key === 'ArrowDown') step = -1;
	} else {
		if (event.key === 'ArrowRight') step = 1;
		else if (event.key === 'ArrowLeft') step = -1;
	}
	if (!step) return;

	event.preventDefault();
	event.stopPropagation();
	if (event.shiftKey) step *= 10;
	nudgeLine(getCurrentProjectEditor(), line, step, !!event.repeat);
}

/**
 * Moves the hovered line by step Em units with the same history entry a drag makes.
 * B3 fix: in Simple, quick presses on one line are one Undo step (History BURST_MS).
 * @param {Object} editor - ProjectEditor
 * @param {Object} line - descriptor
 * @param {Number} step - Em units (sign follows the arrow direction on screen)
 * @param {Boolean} isRepeat - held key; baseline nudges ignore repeats
 */
export function nudgeLine(editor, line, step, isRepeat = false) {
	const state = guidesLayerState;
	const font = editor.project.settings.font;
	switch (line.kind) {
		case 'metric': {
			const next = metricValue(font, line.key) + step;
			const applied = setFontMetric(line.key, next, { verb: 'Moved', burst: `metric ${line.key}` });
			line.value = applied;
			break;
		}
		case 'guide': {
			const guide = editor.project.settings.app.guides?.custom?.[line.index];
			if (!guide) return;
			const applied = setCustomGuideLocation(line.index, Number(guide.location) + step, {
				burst: `guide ${line.index}`,
			});
			if (applied !== false) line.value = applied;
			break;
		}
		case 'baseline':
			if (!isRepeat) moveBaseline(step, { burst: 'baseline' });
			break;
		case 'sideBearing': {
			const item = editor.selectedItem;
			if (!item || item.objType === 'KernGroup') return;
			const left = line.side === 'lsb';
			const current = left ? item.leftSideBearing : item.rightSideBearing;
			// Moving the left line right makes the LSB smaller; never below width 0 (fix track)
			const asked = Math.round(left ? current - step : current + step);
			const target = keepWidth(item, current, asked);
			// fix track: a press that moves nothing (the width already 0) is no step
			if (target === current) return;
			// B3: set by hand, before the step, so the refit hook never snaps it back
			markManual(item);
			if (left) {
				// the view shifts so the glyph stays put
				const view = editor.view;
				item.leftSideBearing = target;
				followShapesInSimple(item, item.leftSideBearing - current);
				editor.view = { dx: view.dx + (current - item.leftSideBearing) * view.dz };
				editor.history.addState('Updated left side bearing.');
			} else {
				item.rightSideBearing = target;
				line.value = item.advanceWidth;
				editor.history.addState('Updated right side bearing.');
			}
			editor.publish('currentItem', item);
			break;
		}
	}
	state.line = line;
	editor.publish('editCanvasView', editor.view);
}

// --------------------------------------------------------------
// Hit testing against the live editor
// --------------------------------------------------------------

/**
 * The draggable line under a canvas pixel, or false. Honors visibility flags and gives
 * the pen tools priority over a line running through a point or handle. B5: a line the mode
 * locks (Simple's horizontal lines) is not draggable, so it is never found.
 * @param {Object} editor - ProjectEditor
 * @param {{x: Number, y: Number}} pos - canvas pixels
 * @returns {Object | false}
 */
export function findLineAt(editor, pos) {
	const item = editor.selectedItem;
	if (!item) return false;
	if (penHasPriority(editor, pos)) return false;
	// M7: a trace image's corner handle wins over a line running through it. The default
	// placement puts every corner on a line (ascent, descent, left side), so without this a
	// new trace could never be resized. Edges and the body still let the line win.
	if (traceHandleHasPriority(editor, pos)) return false;
	// B5: the lines Simple locks are never found, so they can't be hovered, dragged or nudged
	// (fix track: nor the edges of a letter with no shapes, so its photo's corner gets the press)
	const lines = collectGuideLines({
		font: editor.project.settings.font,
		systemGuides: editor.systemGuides,
		guides: editor.project.settings.app.guides,
		item,
	}).filter((line) => !isGuideLineLocked(line, { item }));
	return hitTestLines(lines, pos.x, pos.y, editor.view, HIT_ZONE_PX);
}

function penHasPriority(editor, pos) {
	if (!PEN_TOOLS.includes(editor.selectedTool)) return false;
	const item = editor.selectedItem;
	if (!item?.shapes?.length) return false;
	const x = cXsX(pos.x);
	const y = cYsY(pos.y);

	// On-curve points of every path
	for (const shape of item.shapes) {
		if (shape.objType !== 'Path' || !shape.pathPoints) continue;
		for (const pathPoint of shape.pathPoints) {
			if (isOverControlPoint(pathPoint, x, y, true)) return true;
		}
	}
	// Handles of the selected shapes' points (the ones drawn on screen)
	const selectedPoints = editor.multiSelect?.shapes?.allPathPoints || [];
	if (selectedPoints.length && isOverControlPoint(selectedPoints, x, y)) return true;
	return false;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * Fix track (UX-BEGINNER 7.2): a side space the edges may set without taking the letter's width
 * below 0. Moving either edge by (target - current) changes the width by the same amount (the
 * left edge's sign is folded into its side bearing), so the side bearing may fall only to
 * current - width. A width already below 0 (an older file) can grow back but never shrink.
 * @param {Object} item - Glyph, Ligature or Component
 * @param {Number} current - the side bearing now (left or right)
 * @param {Number} target - the side bearing asked for
 * @returns {Number} target, or the nearest side bearing that keeps the width at 0 or more
 */
export function keepWidth(item, current, target) {
	const width = Number(item?.advanceWidth) || 0;
	return Math.max(target, current - Math.max(0, width));
}

/**
 * B3: in Simple the faint photo moves with the shapes when the left edge moves them (7.2).
 * @param {Object} item - Glyph
 * @param {Number} moved - font units the shapes moved
 */
function followShapesInSimple(item, moved) {
	if (isSimpleMode()) followShapes(item, moved);
}

function cursorFor(line) {
	return line.orientation === 'h' ? 'ns-resize' : 'ew-resize';
}

function clearHover(editor) {
	guidesLayerState.hover = false;
	guidesLayerState.line = false;
	editor.publish('editCanvasView', editor.view);
}

function pointerPosition(event) {
	if (event.offsetX || event.offsetY) return { x: event.offsetX, y: event.offsetY };
	if (event.layerX || event.layerY) return { x: event.layerX, y: event.layerY };
	return { x: event.offsetX || 0, y: event.offsetY || 0 };
}

function isFocusedOnInput() {
	const active = document.activeElement;
	if (!active || !active.tagName) return false;
	return INPUT_TAGS.includes(active.tagName.toLowerCase());
}

/** Document / window listeners, installed once no matter how many canvases come and go. */
function installListeners() {
	if (listenersInstalled) return;
	listenersInstalled = true;
	// Capture phase runs before upstream's bubble-phase key handler, so a hovered line
	// takes the arrow keys and the selection is not nudged as well.
	document.addEventListener('keydown', onKeyDown, true);
	window.addEventListener('anyink-page-change', () => {
		resetGuidesLayerState();
	});
}

/** Leaving the canvas clears the hover so the highlight does not stick. */
function watchCanvas(canvas) {
	if (!canvas || typeof canvas.addEventListener !== 'function') return;
	if (watchedCanvases.has(canvas)) return;
	watchedCanvases.add(canvas);
	canvas.addEventListener('mouseleave', () => {
		const state = guidesLayerState;
		if (state.dragging || !state.hover) return;
		clearHover(getCurrentProjectEditor());
	});
}
