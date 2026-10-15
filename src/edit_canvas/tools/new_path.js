// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { autoHoleNewShape, sayMadeHole } from '../../anyink/letter/auto_hole.js';
import { shapeAtPlace, shapePlace } from '../../anyink/letter/pen_follow.js';
import { isSimpleMode } from '../../anyink/mode/mode.js';
import { isStrayPath } from '../../anyink/spacing/outline.js';
import { toast } from '../../anyink/toast/toast.js';
import { letterPhrase } from '../../anyink/words/letter_name.js';
import { word, wordEntry } from '../../anyink/words/words.js';
import { getCurrentProjectEditor } from '../../app/main.js';
import { insertAfter, makeElement } from '../../common/dom.js';
import { Path } from '../../project_data/path.js';
import { PathPoint } from '../../project_data/path_point.js';
import { setCursor } from '../cursors.js';
import { isOverFirstPoint } from '../detect_edit_affordances.js';
import { canvasUIPointSize } from '../draw_edit_affordances.js';
import { cXsX, cYsY, sXcX, sYcY } from '../edit_canvas.js';
import { eventHandlerData } from '../events.js';
import { checkForFirstShapeAutoRSB, selectTool } from './tools.js';

/**
	// ----------------------------------------------------------------
	// New Path - adds many points to a new path (Pen Plus)
	// ----------------------------------------------------------------
 */
export class Tool_NewPath {
	constructor() {
		this.dragging = false;
		this.firstPoint = true;
		this.currentPoint = {};
		/** @type {Path | false} */
		this.newPath = false;
		/** ANY-INK (B6 + B7 fix): the open shape an Undo took away, for Redo (followLetter) */
		this.undone = null;
	}
	mousedown() {
		// log('Tool_NewPath.mousedown', 'start');
		const editor = getCurrentProjectEditor();
		// ANY-INK (B6 + B7 fix): the shape held is the one the letter shows (Simple's Undo and
		// Redo replace it); followLetter runs on every Undo and Redo too, this is a safety net
		followLetter(editor);
		// ANY-INK (B6 + B7 finalize): with no shape held, a press starts one (an Undo during the
		// last press could leave the pen with neither, so no click placed anything)
		if (isSimpleMode() && !this.newPath) this.firstPoint = true;
		const ehd = eventHandlerData;
		const msShapes = editor.multiSelect.shapes;
		const msPoints = editor.multiSelect.points;

		// New point
		// log(`editor.project.settings.font.upm: ${editor.project.settings.font.upm}`);
		let newPoint = new PathPoint({ projectUPM: editor.project.settings.font.upm });
		newPoint.p.x = cXsX(ehd.mousePosition.x);
		newPoint.p.y = cYsY(ehd.mousePosition.y);

		if (eventHandlerData.isShiftDown) newPoint.roundAll(0);

		// Ensure selection
		if (this.newPath) {
			if (!msShapes.isSelected(this.newPath)) {
				msShapes.select(this.newPath);
			}
		}

		// log(`this.firstPoint: ${this.firstPoint}`);
		// log(`this.newPath: ${this.newPath}`);

		if (this.firstPoint) {
			// make a new path with the new PathPoint
			// ANY-INK (B7, UX-BEGINNER 10 B7): upstream compared the page with 'components', an id
			// no page has ('Components'), so its branch (the font's component count) never ran. On
			// the Components page the open item is the part itself, so its own shapes are the
			// count on every page, and the names stay what they have always been.
			let count = editor.selectedItem.shapes.length;

			count += 1;

			this.newPath = editor.selectedItem.addOneShape(new Path({ name: 'Path ' + count }));
			// ANY-INK (B6 + B7 fix): a new shape: Redo can no longer bring the last one back, and
			// in Simple the pen follows the letter through Undo and Redo while this one is open
			this.undone = null;
			if (isSimpleMode()) followUndoAndRedo(editor);
			// log(`\n⮟this.newPath⮟`);
			// log(this.newPath);
			if (this.newPath) {
				this.currentPoint = this.newPath.addPathPoint(newPoint);
				msShapes.select(this.newPath);
				msPoints.select(this.currentPoint);
				editor.publish('whichPathPointIsSelected', this.currentPoint);
				this.showDoneCreatingPathButton();
			}
		} else if (this.newPath) {
			if (isOverFirstPoint(this.newPath, cXsX(ehd.mousePosition.x), cYsY(ehd.mousePosition.y))) {
				// clicked on an existing control point in this path
				// if first point - close the path
				ehd.toolHandoff = true;
				editor.eventHandlers.tool_pathEdit.dragging = true;
				ehd.lastX = ehd.mousePosition.x;
				ehd.lastY = ehd.mousePosition.y;
				msPoints.select(this.newPath.pathPoints[0]);
				editor.selectedTool = 'pathEdit';
				editor.publish('whichToolIsSelected', editor.selectedTool);
				// ANY-INK (B7): the shape is finished: a hole if it was drawn on ink (Simple)
				const finished = this.newPath;
				const kept = finishNewPath(finished);
				// ANY-INK (B6 + B7 fix): drawn across a hole, it was merged into that hole: there is
				// no point of it left for Edit points to bend, so the press bends nothing and the
				// merged hole is the one picked
				if (kept !== finished) {
					ehd.toolHandoff = false;
					editor.eventHandlers.tool_pathEdit.dragging = false;
					msPoints.clear();
					msShapes.select(kept);
				}
				// ANY-INK (B6 + B7 integration): in Simple closing it finishes it, as the button
				// does: the letter gets its first width and "Finish the shape" goes (upstream left
				// the button on screen after the shape was closed). Edit points has the press.
				if (isSimpleMode()) {
					checkForFirstShapeAutoRSB();
					document.querySelector('#done-creating-path-button')?.remove();
				}

				this.dragging = false;
				this.firstPoint = true;
				this.currentPoint = {};
				this.newPath = false;

				return;
			}

			this.currentPoint = this.newPath.addPathPoint(newPoint);
			msPoints.select(this.currentPoint);
		}

		// log(`\n⮟this.currentPoint⮟`);
		// log(this.currentPoint);
		// ANY-INK (B6 + B7 integration, UX-BEGINNER 7.3): in Simple every point placed is its own
		// Undo step, a plain click too. Upstream records a point only when the pointer moves while
		// pressed, so a shape placed by clicks left no step: nothing marked the work file changed,
		// spacing never ran, and Undo couldn't take the shape back. All tools keeps upstream's way.
		if (isSimpleMode()) ehd.undoQueueHasChanged = true;
		this.firstPoint = false;
		this.dragging = true;
		ehd.lastX = ehd.mousePosition.x;
		ehd.lastY = ehd.mousePosition.y;

		// log('Tool_NewPath.mousedown', 'end');
	}

	mousemove() {
		const ehd = eventHandlerData;
		const editor = getCurrentProjectEditor();

		if (this.dragging) {

					// log(`\n⮟this.currentPoint⮟`);
					// log(this.currentPoint);
			// avoid really small handles
			if (
				Math.abs(sXcX(this.currentPoint.p.x) - ehd.mousePosition.x) > canvasUIPointSize ||
				Math.abs(sYcY(this.currentPoint.p.y) - ehd.mousePosition.y) > canvasUIPointSize
			) {
				this.currentPoint.h1.use = true;
				this.currentPoint.h2.use = true;
				this.currentPoint.h2.x = cXsX(ehd.mousePosition.x);
				this.currentPoint.h2.y = cYsY(ehd.mousePosition.y);
				this.currentPoint.makeSymmetric('h2');
			}

			if (eventHandlerData.isShiftDown) this.currentPoint.roundAll(0);

			setCursor('penCircle');
			ehd.lastX = ehd.mousePosition.x;
			ehd.lastY = ehd.mousePosition.y;
			ehd.undoQueueHasChanged = true;

			editor.publish('currentPathPoint', this.currentPoint);
		} else if (
			this.newPath &&
			isOverFirstPoint(this.newPath, cXsX(ehd.mousePosition.x), cYsY(ehd.mousePosition.y))
		) {
			setCursor('penSquare');
		} else {
			setCursor('penPlus');
		}
	}

	mouseup() {
		// log('Tool_NewPath.mouseup', 'start');
		const editor = getCurrentProjectEditor();
		setCursor('penPlus');

		if (eventHandlerData.undoQueueHasChanged) {
			// For new path tools, mouse up always adds to the undo-queue
			editor.history.addState(`New path: added point ${this.currentPoint.pointNumber}`);
			eventHandlerData.undoQueueHasChanged = false;
		}

		if (eventHandlerData.isShiftDown) {
			this.currentPoint.roundAll(0);
			editor.publish('currentPathPoint', this.currentPoint);
		}

		this.dragging = false;
		// ANY-INK (B6 + B7 finalize): in Simple the next press starts a shape when none is held
		this.firstPoint = isSimpleMode() ? !this.newPath : false;
		this.currentPoint = {};
		eventHandlerData.lastX = -100;
		eventHandlerData.lastY = -100;
		// log('Tool_NewPath.mouseup', 'end');
	}

	/**
	 * ANY-INK (B6 + B7 finalize): the letter view is left, or another letter opened, while a
	 * shape is open (Simple): the shape ends on the letter it was in, before the view moves:
	 * finished from 3 points, taken away below (endOpenShape). The tool stays the Point pen.
	 * The Navigator and ProjectEditor's selectedGlyphID call it; nothing happens in All tools,
	 * during an Undo or Redo (the pen follows those itself), or with no shape open.
	 * @param {Object} [editor] - ProjectEditor
	 * @returns {Boolean} true when a shape was ended
	 */
	leaveLetter(editor = getCurrentProjectEditor()) {
		if (!isSimpleMode() || !this.newPath || editor?.history?.isRestoring) return false;
		// The page may already name where he is going (the rail sets it, then navigates): the
		// step is the letter view's, recorded on its letter, as Undo will show it
		const nav = editor?.nav;
		const page = nav?.page;
		const away = !!nav && page !== 'Characters';
		if (away) nav.page = 'Characters';
		try {
			endOpenShape(editor, { leaving: true });
		} finally {
			if (away) nav.page = page;
		}
		return true;
	}

	showDoneCreatingPathButton() {
		// ANY-INK (B7, UX-BEGINNER 2.3): Simple says it in house words ("path" is banned there)
		const simple = isSimpleMode();
		// ANY-INK (B6 + B7 integration, principle 1): in Simple it is the screen's one green button
		// while a shape is open, so the Next line's button is outlined (coach/dom_probe.js)
		let finishPath = makeElement({
			tag: 'button',
			className: simple ? 'editor-page__tool-selected anyink-primary' : 'editor-page__tool-selected',
			id: 'done-creating-path-button',
			title: simple ? wordEntry('letterTools.finishShape').hint : 'Done creating path',
			content: simple ? word('letterTools.finishShape') : 'Done creating path',
		});
		finishPath.addEventListener('click', removeStopCreatingNewPathButton);

		insertAfter(document.querySelector('#editor-page__edit-canvas'), finishPath);
		// document.body.appendChild(finishPath);
	}
}

/**
 * Removes (hides) the "Stop creating new path" button.
 * Also calls `stopCreatingNewPath` for instances where
 * the path creation ends, but not because of this button.
 */
export function removeStopCreatingNewPathButton() {
	// ANY-INK (B1): only finishing a path gives the letter its first width. The pages also run
	// this each time a letter is opened, and opening a letter must never change it (no Undo step).
	if (document.querySelector('#done-creating-path-button')) {
		// ANY-INK (B6 + B7 finalize): in Simple a shape of 1 or 2 clicked points can't hold ink:
		// it is taken away (one step, a toast says why) and the Point pen stays picked
		if (isSimpleMode() && endStrayShape(getCurrentProjectEditor())) return;
		checkForFirstShapeAutoRSB();
		stopCreatingNewPath();
		selectTool('pathEdit');
	}
}

/**
 * ANY-INK (B7, UX-BEGINNER 7.1 #5): a Point pen shape is judged once it is finished, never while
 * its points are still being placed (turning it round then would put the next point in the wrong
 * place). In Simple, drawn on ink it becomes a hole, on paper it stays solid, and shapes it was
 * drawn around get their role again, as its own Undo step when anything changed (each point was
 * already a step), with the toast "Made shape 2 a hole [Make it solid]". Nothing happens in All
 * tools, or for a shape in a letter that is no longer open (auto_hole.js).
 * @param {Path} path - the shape the Point pen was drawing
 * @returns {Path} the shape that holds it now: itself, or the hole it was merged into
 */
function finishNewPath(path) {
	const editor = getCurrentProjectEditor();
	const hole = autoHoleNewShape(editor, path, { record: true });
	sayMadeHole(editor, path, hole);
	return hole?.shape || path;
}

/**
 * Event handler for the "Stop creating new path" button.
 */
export function stopCreatingNewPath() {
	let editor = getCurrentProjectEditor();
	let newPathTool = editor.eventHandlers.tool_addPath;
	// ANY-INK (B6 + B7 finalize): in Simple a stray shape (1 or 2 clicked points) is taken away,
	// whatever ends it (another tool, Done)
	if (isSimpleMode() && endStrayShape(editor)) return;
	// ANY-INK (B7): Done, another tool or another letter finishes the shape being drawn
	if (newPathTool?.newPath) {
		const finished = newPathTool.newPath;
		const kept = finishNewPath(finished);
		// ANY-INK (B6 + B7 finalize): merged into a hole it crosses, the pen's shape is no longer
		// in the letter: the merged hole is the one picked, never the shape that is gone
		if (kept !== finished) pickInstead(editor, kept);
	}
	newPathTool.newPath = false;
	newPathTool.firstPoint = true;
	// ANY-INK (B6 + B7 fix): the pen is put down; Redo no longer opens an undone shape again
	newPathTool.undone = null;
	let doneButton = document.querySelector('#done-creating-path-button');
	if (doneButton) doneButton.remove();
}

/**
 * ANY-INK (B6 + B7 finalize): the shape that holds the drawing now is picked in place of one that
 * left the letter (merged into the hole it crossed).
 * @param {Object} editor - ProjectEditor
 * @param {Object} shape - Path, now in the letter
 */
function pickInstead(editor, shape) {
	editor.multiSelect?.points?.clear?.();
	editor.multiSelect?.shapes?.clear?.();
	editor.multiSelect?.shapes?.select?.(shape);
}

/**
 * ANY-INK (B6 + B7 finalize): the open shape, when it is one the font file can't hold, is taken
 * away (endOpenShape).
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true when it was
 */
function endStrayShape(editor) {
	const path = editor?.eventHandlers?.tool_addPath?.newPath;
	if (!path || !isStrayPath(path)) return false;
	return endOpenShape(editor) === 'dropped';
}

/**
 * ANY-INK (B6 + B7 finalize, UX-BEGINNER 7.2 "results that can't come out broken", principle 6):
 * the open shape ends on the letter it is in (Simple). A shape the font file can't hold, 1 or 2
 * clicked points with no curve (spacing/outline.js isStrayPath, the font check's rule), is taken
 * away as one Undo step ("removed a stray shape from small a"), and a toast says why: in the
 * letter "A shape needs at least 3 points, so that one was taken away.", leaving it "... so the
 * one on small a was taken away." Any other shape is finished, as "Finish the shape" finishes
 * it. Either way the button goes and the pen lets go.
 * @param {Object} editor - ProjectEditor
 * @param {{leaving?: Boolean}} [options] - leaving: he is going to another letter or page
 * @returns {String} 'dropped', 'finished', or '' with no shape open
 */
export function endOpenShape(editor = getCurrentProjectEditor(), { leaving = false } = {}) {
	const pen = editor?.eventHandlers?.tool_addPath;
	const path = pen?.newPath;
	if (!path) return '';
	if (!isStrayPath(path)) {
		if (leaving) checkForFirstShapeAutoRSB();
		const kept = finishNewPath(path);
		if (kept !== path) pickInstead(editor, kept);
		letGo(pen);
		return 'finished';
	}
	const item = path.parent;
	letGo(pen);
	const list = item?.shapes;
	const at = Array.isArray(list) ? list.indexOf(path) : -1;
	if (at < 0) return 'dropped';
	list.splice(at, 1);
	item.changed?.();
	editor.multiSelect?.points?.clear?.();
	editor.multiSelect?.shapes?.clear?.();
	const letter = letterPhrase(item.chars || '') || word('history.thisLetter');
	if (editor.selectedItem === item) {
		editor.history.addState(word('history.removedStray', { count: 1, letter }));
		editor.publish('currentItem', item);
	}
	const key = leaving ? 'letterTools.droppedShapeOn' : 'letterTools.droppedShape';
	toast(key, { letter }, { kind: 'automatic', group: 'anyinkPointPen' });
	return 'dropped';
}

/** The pen holds no shape; the button goes. */
function letGo(pen) {
	pen.newPath = false;
	pen.firstPoint = true;
	pen.currentPoint = {};
	pen.dragging = false;
	pen.undone = null;
	document.querySelector('#done-creating-path-button')?.remove();
}

// --------------------------------------------------------------
// ANY-INK (B6 + B7 fix): the Point pen through Undo and Redo
// --------------------------------------------------------------
/*
	In Simple every point is an Undo step, so Ctrl+Z mid-shape is the natural move, and Simple's
	Undo and Redo write the letter back as new objects. The pen used to keep the old shape, which
	the letter no longer had: later clicks went into it (nothing showed, yet each was an Undo step
	that changed nothing), "Finish the shape" stayed green and the closing click finished the
	hidden shape. Now, after every Undo and Redo (History publishes 'currentItem'):
	  - the shape is still in the letter: nothing to do
	  - the letter has the same shape, a point shorter or longer (letter/pen_follow.js): the pen
	    draws that one, picked as a click leaves it
	  - it is gone (the first point undone, or the view moved to another letter): the shape is
	    over, unjudged (it is no longer there to judge): the button goes and the font check stops
	    waiting; the pen remembers it, and a Redo that brings that very shape back opens it again
	All tools keeps upstream's Point pen as it is.
*/

/** Subscriber id: the pen follows the letter through Undo and Redo (Simple) */
const FOLLOW_ID = 'anyink.pointPen.followUndo';

/** @param {Object} editor - ProjectEditor */
function followUndoAndRedo(editor) {
	editor.subscribe?.({
		topic: 'currentItem',
		subscriberID: FOLLOW_ID,
		callback: () => followLetter(editor),
	});
}

/**
 * Keeps the Point pen on the shape the open letter shows (Simple only).
 * @param {Object} [editor] - ProjectEditor
 */
export function followLetter(editor = getCurrentProjectEditor()) {
	const pen = editor?.eventHandlers?.tool_addPath;
	if (!pen || !isSimpleMode()) return;
	const item = editor.selectedItem;
	if (pen.newPath) {
		if (Array.isArray(item?.shapes) && item.shapes.includes(pen.newPath)) return;
		// ANY-INK (B6 + B7 finalize): an Undo while a press is still placing a point: that point
		// is in no step yet, so the shape is matched without it, and the press ends here (its
		// release records nothing: there is nothing new to record)
		const pressing = !!pen.dragging;
		const place = shapePlace(pen.newPath, { pressing });
		const same = shapeAtPlace(item, place);
		if (same) {
			holdShape(editor, pen, same);
		} else {
			putShapeDown(pen);
			pen.undone = place;
		}
		if (pressing) {
			pen.dragging = false;
			eventHandlerData.undoQueueHasChanged = false;
		}
		return;
	}
	if (!pen.undone || editor.selectedTool !== 'newPath') return;
	const back = shapeAtPlace(item, pen.undone, { exact: true });
	if (!back) return;
	pen.undone = null;
	holdShape(editor, pen, back);
	if (!document.querySelector('#done-creating-path-button')) pen.showDoneCreatingPathButton();
}

/** The pen draws this shape of the letter, picked as a click leaves it. */
function holdShape(editor, pen, path) {
	pen.newPath = path;
	pen.firstPoint = false;
	pen.currentPoint = {};
	const picked = editor.multiSelect;
	if (picked?.shapes && !picked.shapes.isSelected(path)) picked.shapes.select(path);
	const last = path.pathPoints.at(-1);
	if (last && picked?.points) picked.points.select(last);
}

/** The shape is over without being finished: it is no longer in the letter. */
function putShapeDown(pen) {
	pen.newPath = false;
	pen.firstPoint = true;
	pen.currentPoint = {};
	pen.dragging = false;
	document.querySelector('#done-creating-path-button')?.remove();
}
