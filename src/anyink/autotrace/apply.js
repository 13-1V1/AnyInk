// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: putting traced shapes into the glyph (Milestone 8).
	Owner: TRACK B (svg_to_shapes, trace_region, apply, preview_draw).

	Contract:
	- applyAutoTrace({ editor, item, shapes, mode: 'replace' | 'add' }, options?) -> Boolean.
	  'replace' removes the item's existing shapes first. One history entry:
	  'Auto-traced N shapes (P points)'. Publishes 'currentItem'. Never touches
	  item.anyink.trace itself (in Simple, the spacing refit inside that same history
	  entry moves the photo with the shapes: src/anyink/spacing/history_hook.js).
	- options (B3, UX-BEGINNER 4.4 "Use it"; none given = More tools' auto-trace as before):
	    round: true   every point and handle of the shapes it adds lands on a whole font unit
	                  (the shapes already in the letter are left as they are)
	    title         the history entry's title instead of the counting one ("traced r")
	  Placement never runs in here: Simple's photo flow places the photo before tracing.
	- autoTraceHistoryTitle(shapeCount, pointCount) -> that title, with '1 shape' and
	  '1 point' in the singular and thousands separated ('1,204 points').

	Rules:
	- The item must be the selected item: history records the selected item (upstream
	  addState), so anything else would put the wrong glyph into the undo entry.
	- Nothing to add (no shapes, or none with at least two points) changes nothing and
	  returns false, so a blank image never wipes a glyph.
	- The item gets copies (Path.save()), the same data a saved project reloads, so the
	  preview's shapes stay the preview's and the glyph never shares objects with them.
	- The point and shape selection is cleared first: 'replace' removes shapes that may be
	  selected, and a selection pointing at a removed shape breaks the tools.
	- When 'replace' removes component instances, the linked components' "used in" lists
	  change too, so the entry is a whole-project one (upstream's pre / post pair, one step
	  in the History panel); undo then brings those lists back as well. Each list is replaced
	  with a new array rather than edited in place: upstream's Glyph.save() hands out the
	  live usedIn array, so the pre-state snapshot shares it, and an in-place splice (what
	  removeLinkFromUsedIn does) would change the snapshot too and undo could not restore it.
*/
import { roundItemPoints } from '../spacing/round.js';
import { countPoints } from './svg_to_shapes.js';

/**
 * @param {Number} shapeCount
 * @param {Number} pointCount
 * @returns {String} 'Auto-traced 3 shapes (412 points)'
 */
export function autoTraceHistoryTitle(shapeCount, pointCount) {
	return `Auto-traced ${countOf(shapeCount, 'shape')} (${countOf(pointCount, 'point')})`;
}

/**
 * @param {{editor: Object, item: Object, shapes: Array, mode: 'replace' | 'add'}} args
 * @param {{round?: Boolean, title?: String}} [options] - B3: whole-unit points; the step title
 * @returns {Boolean} true when shapes went in
 */
export function applyAutoTrace({ editor, item, shapes, mode } = {}, { round = false, title } = {}) {
	if (mode !== 'replace' && mode !== 'add') return false;
	if (!editor?.project || !editor.history || !item || !Array.isArray(item.shapes)) return false;
	if (editor.selectedItem !== item) return false;

	const paths = (Array.isArray(shapes) ? shapes : []).filter(
		(shape) =>
			shape?.objType === 'Path' &&
			Array.isArray(shape.pathPoints) &&
			shape.pathPoints.length >= 2 &&
			typeof shape.save === 'function'
	);
	if (!paths.length) return false;

	const stepTitle =
		typeof title === 'string' && title.trim()
			? title.trim()
			: autoTraceHistoryTitle(paths.length, countPoints(paths));
	const instances =
		mode === 'replace' ? item.shapes.filter((shape) => shape?.objType === 'ComponentInstance') : [];
	const wholeProject = instances.length > 0;

	editor.multiSelect?.points?.clear?.();
	editor.multiSelect?.shapes?.clear?.();

	if (wholeProject) editor.history.addWholeProjectChangePreState(stepTitle);

	if (mode === 'replace') {
		for (const instance of instances) {
			const component = editor.project.getItem(instance.link);
			if (Array.isArray(component?.usedIn)) {
				component.usedIn = withoutOne(component.usedIn, String(item.id));
			}
		}
		item.shapes = [];
	}
	const added = paths.map((path) => item.addOneShape(path.save())).filter(Boolean);
	// B3: only the shapes it adds; the ones already in the letter stay exactly as they were
	if (round) roundItemPoints({ shapes: added });

	if (wholeProject) editor.history.addWholeProjectChangePostState();
	else editor.history.addState(stepTitle);

	editor.publish('currentItem', item);
	return true;
}

/** A new array without the first occurrence of id (one per removed instance). */
function withoutOne(list, id) {
	const index = list.indexOf(id);
	if (index < 0) return list;
	return [...list.slice(0, index), ...list.slice(index + 1)];
}

function countOf(value, word) {
	const n = Math.max(0, Math.round(Number(value) || 0));
	return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}
