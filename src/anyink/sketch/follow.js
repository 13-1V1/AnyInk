// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7 "Moves made by other features", D-047 point 9): when another
	feature moves a sketched letter's ink, the sketch moves with it inside the same step, so the
	next step's hash check (history_hook.js) still finds the ink the sketch built, never "changed
	behind its back".

	followShapes(item, plan, { font, project })
	  Called by the feature right after it moved the letter's own shapes: spacing
	  (spacing/trace_follow.js, which this module hands the follow to when it loads), line shifts (metrics/font_metrics.js shiftItemPaths and so
	  moveBaseline), Sit on the line, Match size, Shrink to fit and the refit fix
	  (checks/fix_shapes.js applyPlan), Flip (letter/flip_letter.js). plan = { matrix, grow }
	  (follow_matrix.js; grow: Match size's push, follow_sketch.js says who takes it).
	  - an active sketch (not set aside, not from a newer app) moves through the plan
	    (follow_sketch.js followSketch);
	  - a plan that is more than a whole-unit move rebuilds the letter from the moved sketch, when
	    the build has been handed in (setSketchRebuild): the ink is then exactly what the sketch
	    builds, not the feature's scaled or flipped copy of it;
	  - the hash is stored again (sketch_record.js markBuilt), so the moved ink is the sketch's;
	  - the Brush strokes take the same plan (nib/stroke_record.js followStrokes), with the
	    'sketch' flag on only: with it off a Brush letter's record is never rewritten, so the
	    work file is byte for byte what it was before S3 (nothing reads the skeleton until S6).
	  It is meant for ink that was the sketch's when the feature started (every step checks it
	  first, so between steps it always is, or the sketch is set aside already). A sketch set
	  aside or from a newer app is never moved and its hash never stored. Never throws: a sketch
	  it can't move is left as it was (a warning), so the feature's step still happens.
	  -> { moved, rebuilt }

	followLines(project, { font })
	  B15: every active sketch of the font with a point pinned to a writing line or a half-way
	  line put back on where the lines are now (follow_sketch.js placePins: Centerline points at
	  the ink edge, Outline points on the line, overshoot kept), the letters that changed rebuilt
	  and hashed again. spacing/history_hook.js runs it before every whole-font step closes (B15's
	  Move the guide lines and B11's Move the line are whole-font steps), so a moved line, its
	  letters and their ink are one Undo step. Points not pinned stay. -> the letters it changed
	followLine(project, line, from, to)
	  the same, for one line that moved from `from` to `to` (the font holds `to` already)

	setSketchRebuild(fn)      the build hands in (item, { font, project }) => Boolean: rebuild the
	                          letter's ink from its sketch now. null takes it away. Until it is
	                          handed in, the ink a follow moved stays as the feature made it, and
	                          a moved line's letters keep their ink until their next step
	sketchRebuild()           the one handed in, or null
*/
import { isFeatureOn } from '../mode/features.js';
import { followStrokes } from '../nib/stroke_record.js';
import { setShapesFollower } from '../spacing/trace_follow.js';
import { followSketch, placePins } from './follow_sketch.js';
import { isTranslation, matrixOf, translate } from './follow_matrix.js';
import { isSketchActive, setSketch, sketchOf } from './model.js';
import { markBuilt } from './sketch_record.js';
// the centerline vote on the font's slant, on however the app loads (not only with the card)
import './slant_vote.js';

const COLLECTIONS = Object.freeze(['glyphs', 'ligatures', 'components']);

/** @type {Function | null} */
let rebuild = null;

/** @param {Function | null} fn */
export function setSketchRebuild(fn) {
	rebuild = typeof fn === 'function' ? fn : null;
}

/** @returns {Function | null} */
export function sketchRebuild() {
	return rebuild;
}

/**
 * @param {Object} item - Glyph (or ligature / component)
 * @param {{matrix: Array<Number>, grow?: Number}} plan
 * @param {{font?: Object, project?: Object}} [options]
 * @returns {{moved: Boolean, rebuilt: Boolean}}
 */
export function followShapes(item, plan, { font, project } = {}) {
	const result = { moved: false, rebuilt: false };
	const m = matrixOf(plan?.matrix);
	if (!item || !m) return result;
	try {
		// the Brush record follows only with the sketch flag on (S6 reads it): with it off a fix
		// or a Flip leaves a Brush letter's stored record exactly as before S3
		if (isFeatureOn('sketch')) followStrokes(item, plan);
	} catch (error) {
		console.warn('ANY-INK sketch: the brush strokes could not follow the move', error);
	}
	let sketch = null;
	try {
		sketch = sketchOf(item);
	} catch {
		return result;
	}
	if (!sketch || !isSketchActive(sketch)) return result;
	const owner = project || projectOf(item);
	const lines = font || owner?.settings?.font;
	try {
		const next = followSketch(sketch, { ...plan, matrix: m }, lines);
		if (next !== sketch) {
			setSketch(item, next);
			result.moved = true;
		}
		if (!wholeMove(m) && rebuild) {
			result.rebuilt = !!rebuild(item, { font: lines, project: owner });
		}
		markBuilt(item);
	} catch (error) {
		console.warn('ANY-INK sketch: the sketch could not follow the move', error);
	}
	return result;
}

/**
 * @param {Object} project
 * @param {{font?: Object}} [options]
 * @returns {Array<Object>} the letters whose sketch moved
 */
export function followLines(project, { font = project?.settings?.font } = {}) {
	const changed = [];
	COLLECTIONS.forEach((collection) => {
		Object.values(project?.[collection] || {}).forEach((item) => {
			if (!item?.anyink?.sketch) return;
			try {
				const sketch = sketchOf(item);
				if (!sketch || !isSketchActive(sketch)) return;
				const next = placePins(sketch, font);
				if (next === sketch) return;
				setSketch(item, next);
				if (rebuild) rebuild(item, { font, project });
				markBuilt(item);
				changed.push(item);
			} catch (error) {
				console.warn('ANY-INK sketch: a letter could not follow the moved line', error);
			}
		});
	});
	return changed;
}

/**
 * @param {Object} project
 * @param {String} line - 'top' | 'capitals' | 'small' | 'writing' | 'tail'
 * @param {Number} from
 * @param {Number} to
 * @returns {Array<Object>}
 */
export function followLine(project, line, from, to) {
	if (from === to) return [];
	return followLines(project);
}

// spacing's moves (spacing/trace_follow.js moveSideways, followShapes) reach the sketch through
// this: the spacing engine imports nothing outside its folder
setShapesFollower((item, dx) => followShapes(item, { matrix: translate(dx, 0) }));

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** A move by whole units: the ink moved exactly as the sketch's build would */
function wholeMove(m) {
	return isTranslation(m) && Number.isInteger(m[4]) && Number.isInteger(m[5]);
}

/** A letter's font: Glyphs keep their project as parent */
function projectOf(item) {
	const parent = item?.parent;
	return parent?.settings?.font ? parent : null;
}
