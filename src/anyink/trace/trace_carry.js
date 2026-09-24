// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: carrying a trace image from one open project to another
	(Milestone 7 fix; D-021 keeps upstream's two-project editing).

	The cross-project actions copy an item with upstream's makeGlyphWithResolvedLinks,
	which runs `new Glyph(source)` and so copies item.anyink.trace, image id included. The
	image itself is a Blob in the SOURCE editor's asset store (D-012), so without this step
	the destination saves a trace whose image is gone for good.

	carryTraceAsset(sourceEditor, destinationEditor, item, { replacing }) runs on the new
	item before it is added to the destination (and before the history post-state):
	- the item's trace image is copied into destinationEditor.assets. It keeps its id when
	  the destination does not use that id; a destination that already holds this very
	  Blob reuses that entry (one image shared by several copied glyphs is stored once);
	  otherwise the image gets a new id and the item's trace points at it;
	- a trace whose image the source does not have is dropped, instead of saving a trace
	  the Trace panel would call "missing from the project file";
	- when the copied item brings no usable trace and it overwrites a destination item
	  that has one (`replacing`), that trace stays: a copy never throws away the user's own
	  reference image. A trace the copied item brings wins (that is what overwrite means);
	  the destination's old image stays in its store, so undo of the overwrite brings it back.
	Only the id string goes in the item: no Blob ever enters a glyph or the project.

	Callers: action_overwrite_items.js and action_add_components.js (after
	makeGlyphWithResolvedLinks and any rescale, before addItemByType), and later M12's
	"whole font to a new project".

	resizeWithTrace(item, emRatio, resize) (finalize): "Scale items to match destination Em
	size" rescales the outline with upstream's updateGlyphSize, which never saw the trace,
	so the copied trace no longer lined up with the glyph it was traced for. The wrapper
	measures the outline before and after the rescale and gives the trace the same uniform
	scale and the same fixed point (upstream keeps the outline's left edge and scales about
	the baseline). An item with no outline yet scales its trace by emRatio from the left
	side on the baseline. It runs before carryTraceAsset, so a destination trace that
	carryTraceAsset keeps (already in the destination's units) is never rescaled.
*/
import { getTrace, setTrace } from './trace_model.js';

/**
 * Runs an item's cross-project rescale and keeps its trace on the outline.
 * @param {Object} item - the new Glyph for the destination
 * @param {Number} emRatio - destination units per em / source units per em
 * @param {Function} resize - runs the outline's rescale (upstream's updateGlyphSize call)
 * @returns {Boolean} true when the item's trace was moved and scaled
 */
export function resizeWithTrace(item, emRatio, resize) {
	const before = outlineBox(item);
	resize();
	const trace = getTrace(item);
	if (!trace) return false;
	const map = followOutline(before, outlineBox(item)) || followEm(emRatio);
	if (!map) return false;
	return setTrace(item, {
		...trace,
		x: map.toX + (trace.x - map.fromX) * map.ratio,
		y: map.toY + (trace.y - map.fromY) * map.ratio,
		scale: trace.scale * map.ratio,
	});
}

/**
 * @param {Object} item - Glyph
 * @returns {{xMin: Number, yMin: Number, width: Number, height: Number} | null} a plain
 *   copy of the outline's box, or null when the item has no outline
 */
function outlineBox(item) {
	if (!item?.shapes?.length) return null;
	const maxes = item.maxes;
	const out = {
		xMin: Number(maxes?.xMin),
		yMin: Number(maxes?.yMin),
		width: Number(maxes?.xMax) - Number(maxes?.xMin),
		height: Number(maxes?.yMax) - Number(maxes?.yMin),
	};
	return Object.values(out).every(Number.isFinite) ? out : null;
}

/** The map that took the outline's box `from` to `to`, or null when it cannot tell. */
function followOutline(from, to) {
	if (!from || !to) return null;
	let ratio = NaN;
	if (from.width > 0) ratio = to.width / from.width;
	else if (from.height > 0) ratio = to.height / from.height;
	if (!Number.isFinite(ratio) || ratio <= 0) return null;
	return { ratio, fromX: from.xMin, fromY: from.yMin, toX: to.xMin, toY: to.yMin };
}

/** Scale by the em ratio from the left side on the baseline (0, 0). */
function followEm(emRatio) {
	const ratio = Number(emRatio);
	if (!Number.isFinite(ratio) || ratio <= 0) return null;
	return { ratio, fromX: 0, fromY: 0, toX: 0, toY: 0 };
}

/**
 * @param {Object} sourceEditor - ProjectEditor the item came from (its assets hold the image)
 * @param {Object} destinationEditor - ProjectEditor the item is going to
 * @param {Object} item - the new Glyph for the destination, not yet added to it
 * @param {{replacing?: Object | null}} [options] - the destination item this one
 *   overwrites, if any
 * @returns {String | null} the asset id the item's trace now uses in the destination, or
 *   null when the item ends up with no trace
 */
export function carryTraceAsset(sourceEditor, destinationEditor, item, { replacing = null } = {}) {
	const trace = getTrace(item);
	const store = destinationEditor?.assets;
	const sameStore = !!store && sourceEditor?.assets === store;
	if (trace && sameStore) return trace.asset;

	const entry = trace ? sourceEditor?.assets?.get(trace.asset) : null;
	const asset = entry?.blob && store ? adopt(store, trace.asset, entry) : '';
	if (asset) {
		if (asset !== trace.asset) setTrace(item, { ...trace, asset });
		return asset;
	}
	return keepOwnTrace(item, getTrace(replacing));
}

/**
 * The destination id for a source image: the same id when it is free or already holds
 * this Blob, an id that already holds this Blob, else a new id.
 * @param {Object} store - destination AssetStore
 * @param {String} id - the source id
 * @param {{type: String, blob: Blob}} entry - the source asset
 * @returns {String} '' when the store refused the image
 */
function adopt(store, id, entry) {
	if (store.get(id)?.blob === entry.blob) return id;
	const existing = typeof store.idOf === 'function' ? store.idOf(entry.blob) : '';
	if (existing) return existing;
	try {
		return store.add(entry.blob, { type: entry.type, id: store.has(id) ? undefined : id });
	} catch (error) {
		console.warn('ANY-INK trace: the image could not be copied to the other project', error);
		return '';
	}
}

/**
 * The copied item brings no usable trace: it gets the destination item's own trace, or none.
 * @param {Object} item
 * @param {Object | null} own - normalized trace of the item being overwritten
 * @returns {String | null}
 */
function keepOwnTrace(item, own) {
	if (own && setTrace(item, own)) return own.asset;
	setTrace(item, null);
	return null;
}
