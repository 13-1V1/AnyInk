// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: the data model (Milestone 7). Pure: no DOM, no editor.
	Owner: TRACK A (model + draw + bitmap cache).

	Data, stored at item.anyink.trace on a Glyph (ligatures and components are Glyph
	objects too). No Blob or ImageBitmap ever goes inside the glyph or the project, so
	history snapshots (which clone the whole glyph) make trace edits undoable for free.
	  { asset: 'img-xxxxxxxx',            id in editor.assets
	    width, height,                    pixel size of the stored (capped) image
	    x, y,                             font units of the image's TOP-LEFT corner (y-up: y is the top edge)
	    scale,                            font units per image pixel (uniform; aspect ratio always kept)
	    opacity,                          OPACITY_MIN to 1, default 0.4
	    visible, locked, invert }         defaults true, false, false
	Default placement when an image is added: image height = ascent - descent of
	settings.font, top edge at ascent, left edge at 0.

	Rules every function here keeps:
	- Nothing mutates its input. moveTrace / scaleTraceFromCorner return new objects.
	- getTrace returns a normalized COPY (defaults filled, opacity clamped). Change a
	  trace with setTrace, never by writing to the copy.
	- setTrace stores only the known fields (normalizeTrace picks them), so nothing
	  else, and never a Blob, can ride along into the glyph and its undo snapshots.
	- Corners are named by compass on screen: 'nw' is the top-left corner, which in
	  y-up font units is (xMin, yMax).
*/

/** Defaults for the fields that have a fixed default (placement is computed by makeTrace). */
export const TRACE_DEFAULTS = Object.freeze({
	opacity: 0.4,
	visible: true,
	locked: false,
	invert: false,
});

/** Lowest opacity a trace can have, so it never disappears by accident. */
export const OPACITY_MIN = 0.05;

/** Smallest size, in font units, of a trace image's short side while scaling. */
export const MIN_SIZE_FU = 20;

/**
 * True once collectReferencedAssetIds is real. While false, the .gs2 save keeps
 * writing every asset (project_editor.js makeProjectFileText).
 */
export const ASSET_PRUNING_READY = true;

/** The four corner names, clockwise from the top-left. */
export const TRACE_CORNERS = Object.freeze(['nw', 'ne', 'se', 'sw']);

/**
 * Project collections whose items can carry a trace. 'alternates' does not exist
 * until Milestone 11; listing it now means pruning can never drop an image an
 * alternate still uses.
 */
const TRACE_COLLECTIONS = ['glyphs', 'ligatures', 'components', 'alternates'];

// Fallbacks when settings.font is missing or broken (upstream's new-project values).
const FALLBACK_UPM = 1000;
const FALLBACK_ASCENT_SHARE = 0.7;

// --------------------------------------------------------------
// Reading and writing a trace on an item
// --------------------------------------------------------------

/**
 * @param {Object} item - Glyph (glyph, ligature, or component)
 * @returns {Object | null} a normalized copy of the item's trace, or null when it has
 *   none (or what it has cannot be used: no asset, no size, no scale)
 */
export function getTrace(item) {
	if (!isPlainObjectLike(item)) return null;
	const anyink = item.anyink;
	if (!isPlainObjectLike(anyink) || anyink.trace === undefined || anyink.trace === null) {
		return null;
	}
	return normalizeTrace(anyink.trace);
}

/**
 * Stores a trace on an item; null (or undefined) deletes item.anyink.trace.
 * The stored object is a normalized copy, so later edits to `trace` do not leak in.
 * @param {Object} item - Glyph
 * @param {Object | null} trace
 * @returns {Boolean} true when the item changed; false when there is no item or the
 *   trace cannot be used (the item is then left exactly as it was)
 */
export function setTrace(item, trace) {
	if (!isPlainObjectLike(item)) return false;
	if (trace === null || trace === undefined) {
		if (isPlainObjectLike(item.anyink) && 'trace' in item.anyink) delete item.anyink.trace;
		return true;
	}
	const clean = normalizeTrace(trace);
	if (!clean) return false;
	if (!isPlainObjectLike(item.anyink)) item.anyink = {};
	item.anyink.trace = clean;
	return true;
}

/**
 * A new trace with the default placement for a font: the image is as tall as
 * ascent - descent, its top edge sits on the ascent line, its left edge on x = 0.
 * @param {{asset: String, width: Number, height: Number}} image - the decoded, capped image
 * @param {Object} font - project.settings.font (ascent, descent, upm)
 * @returns {Object | null} null when the image has no asset id or no size
 */
export function makeTrace(image, font) {
	if (!isPlainObjectLike(image)) return null;
	const width = toNumber(image.width);
	const height = toNumber(image.height);
	if (!(width > 0) || !(height > 0)) return null;

	const { ascent, span } = fontSpan(font);
	return normalizeTrace({
		asset: image.asset,
		width,
		height,
		x: 0,
		y: ascent,
		scale: span / height,
		...TRACE_DEFAULTS,
	});
}

/**
 * Fills defaults, clamps opacity, and rejects anything that cannot be drawn.
 * Only the known fields are copied, so the result is plain JSON.
 * @param {Object} raw - whatever a project file (or a caller) held
 * @returns {Object | null} a new trace, or null for a missing asset id, a width,
 *   height, or scale that is not a positive number, or a raw value that is not an object
 */
export function normalizeTrace(raw) {
	if (!isPlainObjectLike(raw)) return null;

	const asset = typeof raw.asset === 'string' ? raw.asset.trim() : '';
	if (!asset) return null;

	const width = toNumber(raw.width);
	const height = toNumber(raw.height);
	const scale = toNumber(raw.scale);
	if (!(width > 0) || !(height > 0) || !(scale > 0)) return null;
	if (!Number.isFinite(width * scale) || !Number.isFinite(height * scale)) return null;

	const x = toNumber(raw.x);
	const y = toNumber(raw.y);

	return {
		asset,
		width,
		height,
		x: Number.isFinite(x) ? x : 0,
		y: Number.isFinite(y) ? y : 0,
		scale,
		opacity: clampOpacity(raw.opacity),
		visible: typeof raw.visible === 'boolean' ? raw.visible : TRACE_DEFAULTS.visible,
		locked: typeof raw.locked === 'boolean' ? raw.locked : TRACE_DEFAULTS.locked,
		invert: typeof raw.invert === 'boolean' ? raw.invert : TRACE_DEFAULTS.invert,
	};
}

/**
 * @param {*} value - requested opacity
 * @returns {Number} OPACITY_MIN to 1; anything that is not a number gives the default
 */
export function clampOpacity(value) {
	const n = toNumber(value);
	if (!Number.isFinite(n)) return TRACE_DEFAULTS.opacity;
	return Math.min(1, Math.max(OPACITY_MIN, n));
}

// --------------------------------------------------------------
// Geometry (font units, y-up)
// --------------------------------------------------------------

/**
 * @param {Object} trace
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number} | null} font units
 */
export function traceBounds(trace) {
	if (!isPlainObjectLike(trace)) return null;
	const x = Number(trace.x) || 0;
	const y = Number(trace.y) || 0;
	const w = (Number(trace.width) || 0) * (Number(trace.scale) || 0);
	const h = (Number(trace.height) || 0) * (Number(trace.scale) || 0);
	return { xMin: x, xMax: x + w, yMin: y - h, yMax: y };
}

/**
 * Where a corner of the trace is, in font units.
 * @param {Object} trace
 * @param {'nw' | 'ne' | 'sw' | 'se' | 'center'} corner
 * @returns {{x: Number, y: Number} | null}
 */
export function traceCorner(trace, corner) {
	const b = traceBounds(trace);
	if (!b) return null;
	switch (corner) {
		case 'nw':
			return { x: b.xMin, y: b.yMax };
		case 'ne':
			return { x: b.xMax, y: b.yMax };
		case 'sw':
			return { x: b.xMin, y: b.yMin };
		case 'se':
			return { x: b.xMax, y: b.yMin };
		case 'center':
			return { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
		default:
			return null;
	}
}

/**
 * What part of the trace is under a point. Corners win over the body.
 * A corner's hit zone is a square reaching handleRadiusFU from the corner in x and y
 * (the drawn handle is a square), half of it outside the image. When the image is so
 * small that two zones overlap, the nearest corner wins.
 * @param {Object} trace
 * @param {{x: Number, y: Number}} point - font units
 * @param {Number} handleRadiusFU - corner hit radius in font units (pixels / zoom)
 * @returns {'nw' | 'ne' | 'sw' | 'se' | 'move' | false}
 */
export function hitTestTrace(trace, point, handleRadiusFU) {
	const b = traceBounds(trace);
	if (!b || !isPlainObjectLike(point)) return false;
	const px = Number(point.x);
	const py = Number(point.y);
	if (!Number.isFinite(px) || !Number.isFinite(py)) return false;

	const radius = Math.max(0, Number(handleRadiusFU) || 0);
	let best = false;
	let bestDistance = Infinity;
	for (const corner of TRACE_CORNERS) {
		const c = traceCorner(trace, corner);
		const dx = Math.abs(px - c.x);
		const dy = Math.abs(py - c.y);
		if (dx > radius || dy > radius) continue;
		const distance = Math.hypot(dx, dy);
		if (distance < bestDistance) {
			best = corner;
			bestDistance = distance;
		}
	}
	if (best) return best;

	if (px >= b.xMin && px <= b.xMax && py >= b.yMin && py <= b.yMax) return 'move';
	return false;
}

/**
 * @param {Object} trace
 * @param {Number} dx - font units
 * @param {Number} dy - font units (y-up: positive moves the image up)
 * @returns {Object | null} a new trace
 */
export function moveTrace(trace, dx, dy) {
	if (!isPlainObjectLike(trace)) return null;
	const mx = Number.isFinite(Number(dx)) ? Number(dx) : 0;
	const my = Number.isFinite(Number(dy)) ? Number(dy) : 0;
	return { ...trace, x: (Number(trace.x) || 0) + mx, y: (Number(trace.y) || 0) + my };
}

/**
 * Scales from a corner, aspect kept, the opposite corner fixed (or the center).
 * The new size puts the dragged corner at the point on the image's diagonal nearest
 * the pointer, so the corner tracks the pointer smoothly in any direction. Dragging
 * past the fixed corner never flips the image: it stops at MIN_SIZE_FU on its short side.
 * @param {Object} trace
 * @param {'nw' | 'ne' | 'sw' | 'se'} corner - the corner being dragged
 * @param {{x: Number, y: Number}} point - font units, where the pointer is now
 * @param {{fromCenter?: Boolean}} [options] - fromCenter: the center stays put (Shift)
 * @returns {Object | null} a new trace (an unchanged copy for an unknown corner or point)
 */
export function scaleTraceFromCorner(trace, corner, point, { fromCenter = false } = {}) {
	if (!isPlainObjectLike(trace)) return null;
	const width = Number(trace.width);
	const height = Number(trace.height);
	const px = Number(point?.x);
	const py = Number(point?.y);
	if (
		!TRACE_CORNERS.includes(corner) ||
		!(width > 0) ||
		!(height > 0) ||
		!Number.isFinite(px) ||
		!Number.isFinite(py)
	) {
		return { ...trace };
	}

	// +1 when the dragged corner is on the right / top of the fixed point
	const east = corner === 'ne' || corner === 'se' ? 1 : -1;
	const north = corner === 'nw' || corner === 'ne' ? 1 : -1;
	const anchor = traceCorner(trace, fromCenter ? 'center' : oppositeCorner(corner));

	// How far the pointer is from the fixed point, measured outward (growing = positive)
	const reachX = (px - anchor.x) * east;
	const reachY = (py - anchor.y) * north;

	// Project onto the diagonal (width, height). From the center the corner is half a
	// diagonal away, so the reach covers half the size.
	const factor = fromCenter ? 2 : 1;
	let scale = (factor * (reachX * width + reachY * height)) / (width * width + height * height);
	const minScale = MIN_SIZE_FU / Math.min(width, height);
	if (!(scale >= minScale)) scale = minScale;

	const w = width * scale;
	const h = height * scale;
	let x;
	let y;
	if (fromCenter) {
		x = anchor.x - w / 2;
		y = anchor.y + h / 2;
	} else {
		x = east === 1 ? anchor.x : anchor.x - w;
		y = north === 1 ? anchor.y + h : anchor.y;
	}
	return { ...trace, x, y, scale };
}

// --------------------------------------------------------------
// Project-wide
// --------------------------------------------------------------

/**
 * Every asset id used by a trace on any glyph, ligature, or component (and, from
 * Milestone 11, alternate). Reads raw item.anyink.trace.asset, not normalized
 * traces, so an image stays in the saved file even when its trace is damaged.
 * B8 + B9 integration: and every photo in the font's photo list (settings.anyink.photos, B9's
 * registry, read as plain data), so a photo whose letters aren't all named yet keeps its image
 * in the work file ("Use the same photo" and rule 12 come back to it tomorrow).
 * @param {Object} project - GlyphrStudioProject (or its save() object)
 * @returns {Set<String>}
 */
export function collectReferencedAssetIds(project) {
	const ids = new Set();
	if (!isPlainObjectLike(project)) return ids;
	for (const key of TRACE_COLLECTIONS) {
		const collection = project[key];
		if (!isPlainObjectLike(collection)) continue;
		for (const item of Object.values(collection)) {
			const asset = item?.anyink?.trace?.asset;
			if (typeof asset === 'string' && asset.trim()) ids.add(asset.trim());
		}
	}
	const photos = project.settings?.anyink?.photos;
	if (isPlainObjectLike(photos)) {
		for (const [key, record] of Object.entries(photos)) {
			const asset = typeof record?.asset === 'string' ? record.asset : key;
			if (typeof asset === 'string' && asset.trim()) ids.add(asset.trim());
		}
	}
	return ids;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** @param {'nw' | 'ne' | 'sw' | 'se'} corner @returns {'nw' | 'ne' | 'sw' | 'se'} */
export function oppositeCorner(corner) {
	return { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }[corner];
}

/**
 * The font's top line and full height (ascent - descent), with safe fallbacks.
 * @param {Object} font - settings.font
 * @returns {{ascent: Number, span: Number}}
 */
function fontSpan(font) {
	const upmRaw = toNumber(font?.upm);
	const upm = upmRaw > 0 ? upmRaw : FALLBACK_UPM;
	const ascentRaw = toNumber(font?.ascent);
	const ascent = Number.isFinite(ascentRaw) ? ascentRaw : upm * FALLBACK_ASCENT_SHARE;
	const descentRaw = toNumber(font?.descent);
	const descent = Number.isFinite(descentRaw) ? descentRaw : ascent - upm;
	const span = ascent - descent;
	return { ascent, span: span > 0 ? span : upm };
}

/**
 * Numbers and numeric strings become numbers; everything else (null, booleans,
 * empty strings, objects) becomes NaN.
 * @param {*} value
 * @returns {Number}
 */
function toNumber(value) {
	if (typeof value === 'number') return value;
	if (typeof value === 'string' && value.trim() !== '') return Number(value);
	return NaN;
}

function isPlainObjectLike(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
