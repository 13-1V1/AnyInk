// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3: what the Next line's sketch rules (docs/SKETCH.md section 7, rules 19, 20, 24 and 25) read
	about the open letter's sketch. Reading never changes the font. font_facts.js deriveEditorState
	puts the result on the state as `sketch`, only while the 'sketch' flag is on and the letter view
	shows a letter; rules.js reads nothing else of the sketch.

	  sketchFacts(item, project, { pieceOpen, actions })
	      -> { pieceOpen, gap, centerInk, thickness, fontThickness, differ, sketched, canUseOnAll,
	           canClose }
	      pieceOpen    a sketch tool holds a piece open (sketch/tools/undo_gate.js), handed in
	      gap          a piece in Outline use was finished open (2 points or more: not a dot)
	      centerInk    the sketch is active, has a Centerline piece and built shapes of one
	      thickness    the letter's sketch thickness (font units), 0 for none
	      fontThickness  settings.anyink.sketchThickness, or null while never set
	      differ       other letters (glyphs, joined letters, parts) with active Centerline
	                   sketches whose thickness is not this letter's
	      sketched     every letter with an active Centerline sketch, this one counted
	      offer        S3 integration: the thickness track's Use on all offer for this letter
	                   (sketch/thickness_all.js thicknessOffer: { count, thickness, itemId }, only
	                   while the slider's step is the newest change), handed in; else null
	      canUseOnAll / canClose   a Next line action does it (coach/actions.js
	                   'sketchUseOnAll' from the thickness track, 'closeOutline' from S7):
	                   the rules never show a button nothing answers
	  hasCenterPiece(sketch)
	  USE_ON_ALL_ACTION, CLOSE_OUTLINE_ACTION
*/
import { getPiece, isSketchActive, piecePointIds, sketchOf } from '../sketch/model.js';
import { builtShapes, sketchIdOf } from '../sketch/sketch_record.js';

export const USE_ON_ALL_ACTION = 'sketchUseOnAll';
export const CLOSE_OUTLINE_ACTION = 'closeOutline';

/** The project's collections a sketch can live in */
const COLLECTIONS = Object.freeze(['glyphs', 'ligatures', 'components']);

/**
 * @param {Object | null} sketch
 * @returns {Boolean}
 */
export function hasCenterPiece(sketch) {
	return Array.isArray(sketch?.pieces) && sketch.pieces.some((piece) => piece?.use === 'center');
}

/**
 * @param {Object | null} item - the open letter
 * @param {Object | null} project
 * @param {Object} [options]
 * @param {Boolean} [options.pieceOpen]
 * @param {(name: String) => Boolean} [options.actions] - a coach action of that name exists
 * @param {Object | null} [options.offer] - thickness_all.js thicknessOffer(editor)
 * @returns {Object}
 */
export function sketchFacts(
	item,
	project,
	{ pieceOpen = false, actions = () => false, offer = null } = {}
) {
	const sketch = sketchOf(item);
	const active = isSketchActive(sketch);
	const thickness = active && Number(sketch.thickness) > 0 ? Math.round(sketch.thickness) : 0;
	const stored = project?.settings?.anyink?.sketchThickness;
	const fontThickness =
		typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? Math.round(stored) : null;
	return {
		pieceOpen: !!pieceOpen,
		gap: active && hasGap(sketch),
		centerInk: active && hasCenterInk(item, sketch),
		thickness,
		fontThickness,
		...countSketched(project, item, thickness, active && hasCenterPiece(sketch)),
		canUseOnAll: !!actions(USE_ON_ALL_ACTION),
		canClose: !!actions(CLOSE_OUTLINE_ACTION),
		offer: offerFor(offer, item),
	};
}

/** The offer, only when it is about this letter */
function offerFor(offer, item) {
	if (!offer || !(Number(offer.count) > 1)) return null;
	if (item?.id && offer.itemId && offer.itemId !== item.id) return null;
	return { count: Math.round(offer.count), thickness: Number(offer.thickness) || 0 };
}

/** An Outline piece finished open (a 1-point piece is a dot, never a gap) */
function hasGap(sketch) {
	return (sketch.pieces || []).some(
		(piece) => piece?.use === 'outline' && !piece.closed && piecePointIds(piece).length >= 2
	);
}

/** Built shapes of a Centerline piece are on the letter */
function hasCenterInk(item, sketch) {
	if (!hasCenterPiece(sketch)) return false;
	return builtShapes(item, sketch.key).some(
		(shape) => getPiece(sketch, sketchIdOf(shape))?.use === 'center'
	);
}

/**
 * @param {Object | null} project
 * @param {Object} item - the open letter
 * @param {Number} thickness - its thickness (0: none)
 * @param {Boolean} mine - the open letter has an active Centerline sketch
 * @returns {{differ: Number, sketched: Number}}
 */
function countSketched(project, item, thickness, mine) {
	let differ = 0;
	let sketched = mine ? 1 : 0;
	COLLECTIONS.forEach((name) => {
		const items = project?.[name];
		if (!items || typeof items !== 'object') return;
		Object.values(items).forEach((other) => {
			if (!other || other === item || (item?.id && other.id === item.id)) return;
			const sketch = other.anyink?.sketch ? sketchOf(other) : null;
			if (!isSketchActive(sketch) || !hasCenterPiece(sketch)) return;
			sketched += 1;
			if (thickness && Math.round(Number(sketch.thickness) || 0) !== thickness) differ += 1;
		});
	});
	return { differ, sketched };
}
