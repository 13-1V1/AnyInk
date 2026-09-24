// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: the facade (Milestone 8). Also the API milestone 9's handwriting sheet
	calls, so keep these two signatures stable.
	Owner: TRACK A (params, binarize, worker, client, facade).

	- autoTraceImageData(imageData, options, placement, { signal } = {})
	    -> Promise<{ shapes, points, ms, threshold, autoThreshold, width, height, timings }>
	  normalizeOptions -> traceRawImageData -> binarize + maskToImageData + potrace
	  (module worker) -> svgShapeStats (the guard below) -> potraceSvgToShapes.
	  placement = { x, y, scale, offsetX = 0, offsetY = 0, upm = 1000, previewScale = scale }
	  (svg_to_shapes.js): image pixel (px, py), y-down, lands at font units
	  (x + (px + offsetX) * scale, y - (py + offsetY) * scale); upm only sizes the Detail
	  speck filter (params.js); previewScale = font units per pixel of the preview of this
	  image, for a full-size pass (see "matched to the preview"). An image with no ink after
	  binarizing resolves with no shapes and skips WASM tracing in the worker.
	  threshold = the gray level used; autoThreshold = Otsu's, which the Threshold slider
	  shows while it is on Auto. ms = the whole call; timings = { binarize, trace, shapes }.
	  Latest wins (potrace_client.js): a newer call makes an older one reject with
	  .stale === true, and so does an AbortSignal that fires; callers ignore stale
	  rejections. Callers tracing many images (the sheet) must await each call in turn.
	- autoTraceTrace({ editor, item, options, preview = false, signal })
	    -> the same result plus dropped (shapes the glyph box rule left out), ms now counting
	  the pixel read too.
	  Reads the item's trace Blob (editor.assets) through the bitmap cache (trace_pixels.js),
	  when insideBoxOnly only the glyph box plus BOX_MARGIN_EM on every side (regionForGlyph,
	  trace_region.js) and then keeps the whole shapes whose middle is in the box, with
	  accents and dots over them (keepShapesInGlyphBox, given the traced area), else the
	  whole image; previews are downscaled to a long side of PREVIEW_MAX_SIDE (apply traces
	  full resolution), and the placement carries the crop offset and the downscale factor.
	  The prepared preview pixels are kept for the next call (one entry), so dragging a
	  slider does not re-read the image.
	  A full-size trace (preview false) first waits for one painted frame (at most 50 ms), so
	  the card's progress line shows before the main-thread pixel read.
	  Failures reject with a plain-words message and a code: 'no-trace', 'missing-image',
	  'outside-box', 'read-failed' (trace_pixels.js), 'empty-image', 'too-many',
	  'shapes-outside-box'.
	- clearAutoTraceCache(): drops the kept preview pixels.

	Fixes, 09/24/2026:
	- Too many shapes: a trace with more than MAX_TRACE_SHAPES shapes or MAX_TRACE_POINTS
	  points rejects ('too-many', naming the counts and the sliders that help) before its
	  SVG is converted. A noisy photo at Detail 100 % with Remove specks off applied 44,000
	  shapes and froze the app for 18 to 29 s (6 s converting, 12 s in the box rule).
	- Matched to the preview: full-size Apply uses binarizeFollowingPreview in the worker.
	  The preview mask decides which thin strokes, holes, and specks survive (including
	  the preview's potrace turdsize); full-size pixels refine larger edges. The preview's
	  threshold stays the value shown on the slider. Cached preview pixels are copied to
	  the worker, or recreated there with the same downscale rule when the cache is absent.
	  Direct autoTraceImageData callers without preview pixels keep the previewScale rule.
	- The glyph box rule: the result says how many shapes it dropped (dropped), and when it
	  drops every shape the call rejects ('shapes-outside-box': '2 shapes lie outside the
	  glyph box...'), instead of an empty result the card read as "No ink found".
	- The kept preview pixels (up to 4 MB, plus the image Blob) go after a full-size trace
	  (the session ends with it) and after KEPT_IDLE_MS unused.
*/
import { downscaleImageData } from './binarize.js';
import { normalizeOptions, toPotraceOptions } from './params.js';
import { traceRawImageData, ABORTED_MESSAGE } from './potrace_client.js';
import { countPoints, potraceSvgToShapes, svgShapeStats } from './svg_to_shapes.js';
import { readTracePixels } from './trace_pixels.js';
import {
	ACCENT_MARGIN_EM,
	BOX_MARGIN_EM,
	keepShapesInGlyphBox,
	regionForGlyph,
} from './trace_region.js';
import { getTrace } from '../trace/trace_model.js';

/** Long side of the image a preview traces, in pixels (apply traces full resolution). */
export const PREVIEW_MAX_SIDE = 1000;

/** More shapes than this is refused, not converted (a speck explosion). */
export const MAX_TRACE_SHAPES = 500;

/**
 * More points than this is refused, not converted: about half a second of converting
 * (26,910 points took 561 ms). Finalize: 5,000 refused grainy or dry-brush letters whose
 * preview had passed, with no slider left that could get under it.
 */
export const MAX_TRACE_POINTS = 30000;

/**
 * The full-size pass of autoTraceTrace (Replace / Add) runs after a preview that passed
 * the caps above, and follows that preview's pieces, so its own caps only guard against a
 * freeze: at most about a second and a half of converting.
 */
export const APPLY_MAX_SHAPES = 2000;
export const APPLY_MAX_POINTS = 60000;

/** The kept preview pixels go after this long unused, in ms. */
export const KEPT_IDLE_MS = 60000;

/**
 * A shape this close to the edge of the traced area (in traced pixels) may be cut by it,
 * so the box rule never keeps it as an accent.
 */
const CROP_EDGE_PX = 2;

/** Plain-words messages, keyed by the error code they carry. */
export const AUTOTRACE_MESSAGES = Object.freeze({
	'no-trace': 'This glyph has no trace image. Add one in the Trace panel first.',
	'missing-image': 'The trace image is missing. Add the image again in the Trace panel.',
	'outside-box':
		'The trace image does not reach into the glyph box. Move the image over the glyph, ' +
		'or turn off "Only inside the glyph box".',
	'empty-image': 'The image to trace is empty.',
});

/**
 * @param {{shapes: Number, points: Number}} stats - what potrace made
 * @param {Object} options - normalized auto-trace options
 * @returns {String} 'This trace has 44,514 shapes and 172,451 points, too many to edit.
 *   Lower Detail, raise Smoothing, or turn on Remove specks.'
 */
export function tooManyMessage(stats, options, { maxPoints = MAX_TRACE_POINTS } = {}) {
	// Only the sliders that can still move (finalize: at Detail 0 and Smoothing 100 % the
	// message still said to lower Detail and raise Smoothing)
	const opts = normalizeOptions(options);
	const remedies = [];
	if (opts.detail > 0) remedies.push('lower Detail');
	if (stats.points > maxPoints && opts.smoothing < 1) remedies.push('raise Smoothing');
	if (!opts.despeckle) remedies.push('turn on Remove specks');
	if (!remedies.length) remedies.push('use a cleaner image, or crop it closer');
	remedies[0] = remedies[0][0].toUpperCase() + remedies[0].slice(1);
	const last = remedies.pop();
	const advice = remedies.length
		? `${remedies.join(', ')}${remedies.length > 1 ? ',' : ''} or ${last}`
		: last;
	return (
		`This trace has ${countOf(stats.shapes, 'shape')} and ${countOf(stats.points, 'point')}, ` +
		`too many to edit. ${advice}.`
	);
}

/**
 * @param {Number} count - shapes the glyph box rule dropped
 * @returns {String} '2 shapes lie outside the glyph box. Move the image over the glyph, or
 *   turn off "Only inside the glyph box".'
 */
export function outsideBoxMessage(count) {
	const lie = count === 1 ? 'lies' : 'lie';
	return (
		`${countOf(count, 'shape')} ${lie} outside the glyph box. Move the image over the ` +
		'glyph, or turn off "Only inside the glyph box".'
	);
}

/** The one kept preview: { blob, key, prepared }. */
let kept = null;
let keptTimer = null;

/**
 * Traces pixels into outlines.
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {Object} options - auto-trace options (params.js)
 * @param {{x: Number, y: Number, scale: Number, offsetX?: Number, offsetY?: Number,
 *   upm?: Number, previewScale?: Number}} placement
 * @param {{signal?: AbortSignal}} [control]
 * @returns {Promise<{shapes: Array, points: Number, ms: Number, threshold: Number,
 *   autoThreshold: Number, width: Number, height: Number,
 *   timings: {binarize: Number, trace: Number, shapes: Number}}>}
 */
export function autoTraceImageData(imageData, options, placement, { signal } = {}) {
	return traceImage(imageData, normalizeOptions(options), normalizePlacement(placement), {
		signal,
	});
}

/**
 * Traces an item's trace image into outlines placed over the glyph.
 * @param {{editor: Object, item: Object, options: Object, preview?: Boolean,
 *   signal?: AbortSignal}} args
 * @returns {Promise<Object>} as autoTraceImageData plus dropped, ms including the read
 */
export async function autoTraceTrace({ editor, item, options, preview = false, signal } = {}) {
	if (preview) return traceTrace({ editor, item, options, preview, signal });
	try {
		return await traceTrace({ editor, item, options, preview, signal });
	} finally {
		// Apply ends the session: nothing will drag a slider over these pixels again
		clearAutoTraceCache();
	}
}

/** Drops the kept preview pixels. */
export function clearAutoTraceCache() {
	kept = null;
	if (keptTimer !== null) clearTimeout(keptTimer);
	keptTimer = null;
}

// --------------------------------------------------------------
// Internals
// --------------------------------------------------------------

/** autoTraceImageData with its options and placement already normalized. */
async function traceImage(
	imageData,
	opts,
	place,
	{ signal, followPreview, maxShapes = MAX_TRACE_SHAPES, maxPoints = MAX_TRACE_POINTS } = {}
) {
	const started = now();
	throwIfAborted(signal);
	const width = Math.round(Number(imageData?.width));
	const height = Math.round(Number(imageData?.height));
	if (!(width > 0) || !(height > 0) || !(imageData.data?.length >= width * height * 4)) {
		throw codedError('empty-image');
	}

	const previewPixel = place.previewScale / place.scale;
	const potraceOptions = toPotraceOptions(opts, {
		scale: place.scale,
		upm: place.upm,
		previewScale: place.previewScale,
	});
	const reply = await traceRawImageData(
		imageData,
		potraceOptions,
		{
			options: opts,
			control: { previewPixel, measurePaper: previewPixel === 1 },
			followPreview,
		},
		{ signal }
	);
	const afterTrace = now();
	throwIfAborted(signal);
	const { svg } = reply;
	let shapes = [];
	if (svg) {
		const stats = svgShapeStats(svg);
		if (stats.shapes > maxShapes || stats.points > maxPoints) {
			throw Object.assign(new Error(tooManyMessage(stats, opts, { maxPoints })), {
				code: 'too-many',
				shapes: stats.shapes,
				points: stats.points,
			});
		}
		shapes = potraceSvgToShapes(svg, place) || [];
	}
	const done = now();
	return {
		shapes,
		points: countPoints(shapes),
		ms: done - started,
		threshold: reply.threshold,
		autoThreshold: reply.autoThreshold,
		paperSpread: reply.paperSpread,
		width,
		height,
		timings: {
			binarize: reply.binarizeMs,
			trace: Math.max(0, afterTrace - started - reply.binarizeMs),
			shapes: done - afterTrace,
		},
	};
}

async function traceTrace({ editor, item, options, preview, signal }) {
	const started = now();
	throwIfAborted(signal);
	// A full-size trace reads up to 2000 px on the main thread: let the card's
	// 'Tracing at full size...' paint first (M8 integration)
	if (!preview) await yieldToPaint();
	throwIfAborted(signal);
	const opts = normalizeOptions(options);
	const trace = getTrace(item);
	if (!trace) throw codedError('no-trace');
	const blob = editor?.assets?.get?.(trace.asset)?.blob;
	if (!blob) throw codedError('missing-image');

	const font = editor?.project?.settings?.font || {};
	const upm = Number(font.upm) > 0 ? Number(font.upm) : undefined;
	const whole = { x: 0, y: 0, width: trace.width, height: trace.height };
	let region = whole;
	if (opts.insideBoxOnly) {
		// The box must reach the image; then trace it with a margin and keep whole shapes
		// whose middle is in the box, so a leg or a tail past the box edge is not cut off
		const box = regionForGlyph(trace, item, font);
		if (!box || !(box.width > 0) || !(box.height > 0)) throw codedError('outside-box');
		// Half an em over the ascent, where accents live (finalize: an accent reaching 0.27 em
		// over a capital was cut by the crop and dropped)
		const em = upm || 1000;
		region =
			regionForGlyph(trace, item, font, {
				margin: BOX_MARGIN_EM * em,
				marginTop: ACCENT_MARGIN_EM * em,
			}) || box;
	}
	if (!(region.width > 0) || !(region.height > 0)) throw codedError('outside-box');

	const prepared = await preparePixels(blob, region, trace, preview ? PREVIEW_MAX_SIDE : 0);
	throwIfAborted(signal);

	const { factor, ratio, rect } = prepared;
	// Font units per pixel of the decoded bitmap, of what this pass traces, and of the
	// preview of the same crop (the same as this pass for a preview)
	const bitmapScale = trace.scale / ratio;
	const previewFactor = preview ? factor : previewFactorFor(rect);
	const placement = {
		x: trace.x,
		y: trace.y,
		scale: bitmapScale / factor,
		previewScale: bitmapScale / previewFactor,
		offsetX: rect.x * factor,
		offsetY: rect.y * factor,
		upm,
	};
	// Apply follows the preview's actual mask, including its Detail speck filter.
	const followPreview =
		!preview && previewFactor < 1
			? {
					factor: previewFactor,
					maxSide: PREVIEW_MAX_SIDE,
					imageData: cachedPreview(blob, region, trace),
					speckArea: toPotraceOptions(opts, { scale: placement.previewScale, upm }).turdsize,
			  }
			: undefined;
	// The full-size pass follows a preview that already passed the caps: its own only guard
	// against a freeze
	const limits = preview ? {} : { maxShapes: APPLY_MAX_SHAPES, maxPoints: APPLY_MAX_POINTS };
	const result = await traceImage(prepared.imageData, opts, placement, {
		signal,
		followPreview,
		...limits,
	});
	// Keep the actual read area's bounds, not the accent filter's inset bounds. The panel
	// distinguishes a glyph-box cut from the original image edge using these flags.
	const area = {
		xMin: trace.x + rect.x * bitmapScale,
		xMax: trace.x + (rect.x + rect.width) * bitmapScale,
		yMin: trace.y - (rect.y + rect.height) * bitmapScale,
		yMax: trace.y - rect.y * bitmapScale,
		pixel: placement.scale,
		cut: {
			left: region.x > 0,
			right: region.x + region.width < trace.width,
			top: region.y > 0,
			bottom: region.y + region.height < trace.height,
		},
	};
	if (!opts.insideBoxOnly) return { ...result, area, dropped: 0, ms: now() - started };

	// The traced area in font units, less a little at the edges: a shape there may be cut
	const edge = CROP_EDGE_PX * placement.scale;
	const crop = {
		xMin: trace.x + rect.x * bitmapScale + edge,
		xMax: trace.x + (rect.x + rect.width) * bitmapScale - edge,
		yMin: trace.y - (rect.y + rect.height) * bitmapScale + edge,
		yMax: trace.y - rect.y * bitmapScale - edge,
	};
	const shapes = keepShapesInGlyphBox(result.shapes, item, font, { crop });
	const dropped = result.shapes.length - shapes.length;
	if (!shapes.length && dropped > 0) {
		throw Object.assign(new Error(outsideBoxMessage(dropped)), {
			code: 'shapes-outside-box',
			dropped,
		});
	}
	return { ...result, area, shapes, points: countPoints(shapes), dropped, ms: now() - started };
}

/**
 * The pixels to trace: the region at bitmap resolution, downscaled when maxSide > 0.
 * Previews reuse the last prepared pixels while the image and region are unchanged.
 */
async function preparePixels(blob, region, trace, maxSide) {
	const key = keyFor(region, trace, maxSide);
	if (maxSide && kept && kept.blob === blob && kept.key === key) {
		armKeptTimer();
		return kept.prepared;
	}

	const read = await readTracePixels(blob, region, trace);
	const { imageData, factor } = maxSide
		? downscaleImageData(read.imageData, maxSide)
		: { imageData: read.imageData, factor: 1 };
	const prepared = { imageData, factor, ratio: read.ratio, rect: read.rect };
	if (maxSide) {
		kept = { blob, key, prepared };
		armKeptTimer();
	}
	return prepared;
}

/** Cached preview pixels for this crop, otherwise the worker recreates them from full size. */
function cachedPreview(blob, region, trace) {
	const key = keyFor(region, trace, PREVIEW_MAX_SIDE);
	return kept && kept.blob === blob && kept.key === key ? kept.prepared.imageData : undefined;
}

/** The downscale factor a preview of this bitmap rect gets (binarize.js rule). */
function previewFactorFor(rect) {
	const long = Math.max(rect.width, rect.height);
	return long > PREVIEW_MAX_SIDE ? PREVIEW_MAX_SIDE / long : 1;
}

function keyFor(region, trace, maxSide) {
	return [region.x, region.y, region.width, region.height, trace.width, trace.height, maxSide].join(
		'|'
	);
}

function armKeptTimer() {
	if (keptTimer !== null) clearTimeout(keptTimer);
	keptTimer = setTimeout(clearAutoTraceCache, KEPT_IDLE_MS);
	// Node (tests): an idle timer never holds the process open
	keptTimer?.unref?.();
}

function normalizePlacement(placement) {
	const p = placement || {};
	const n = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
	const raw = n(p.scale, 1);
	const scale = raw > 0 ? raw : 1;
	// The preview is never finer than the image traced; missing means this is the preview
	const previewScale = Math.max(scale, n(p.previewScale, scale));
	return {
		x: n(p.x, 0),
		y: n(p.y, 0),
		scale,
		previewScale,
		offsetX: n(p.offsetX, 0),
		offsetY: n(p.offsetY, 0),
		upm: n(p.upm, 0) > 0 ? n(p.upm, 0) : undefined,
	};
}

/** Longest wait for a painted frame (a hidden tab runs no animation frames). */
const PAINT_WAIT_MS = 50;

/** Resolves after the next frame has painted, or after PAINT_WAIT_MS, whichever is first. */
function yieldToPaint() {
	return new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			resolve();
		};
		if (typeof globalThis.requestAnimationFrame === 'function') {
			globalThis.requestAnimationFrame(() => setTimeout(finish, 0));
		}
		setTimeout(finish, PAINT_WAIT_MS);
	});
}

function throwIfAborted(signal) {
	if (!signal?.aborted) return;
	throw Object.assign(new Error(ABORTED_MESSAGE), {
		name: 'AbortError',
		stale: true,
		aborted: true,
	});
}

function codedError(code) {
	const error = new Error(AUTOTRACE_MESSAGES[code]);
	error.code = code;
	return error;
}

function countOf(value, word) {
	const n = Math.max(0, Math.round(Number(value) || 0));
	return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

function now() {
	return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}
