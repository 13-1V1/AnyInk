// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: one photo makes many letters (docs/UX-BEGINNER.md 4.4, 4.5, 7.3, 7.7, section
	10 B9). The engine the photo screens drive (photo_card.js, photo_dialog.js, how_card.js): a
	photo comes in, a part of it is named for a letter, the photo is placed so that part sits on
	the letter's lines (B3 placement), the part is traced (auto-trace on the part's own pixels),
	and Use it puts the traced shapes in as one Undo step. Simple only: everything here is for
	the Simple screens; More tools keeps its Trace panel and Auto-trace card exactly as they were.

	1. A photo comes in: addPhotoFile(file, { editor }) -> Promise<{ ok, asset, record, added,
	   parts } | { ok: false, code, key, button }>
	   - HEIC by its type, name or first bytes (photo_flow_pixels.js) -> 'heic'; anything Chrome
	     can't decode -> 'wrong-type' / 'damaged' / 'too-big' / 'no-decoder' (bitmap_cache.js).
	   - One image id per photo: the same file again (its byte fingerprint) gives back its record
	     (added: false) and adds nothing.
	   - Otherwise: decoded once (EXIF upright, long side 2000 px, D-023) into editor.assets; its
	     paper picked from the file's own EXIF and its pixels (paper_kind.js: the stored copy has
	     no EXIF); its parts found (ink_parts.js); its record added (photo_registry.js). No Undo
	     step (7.3: picking a photo is none). The photo screens' Cancel takes a photo added here
	     back out again while no letter uses it (cancelPart).
	2. A part for a letter (step B -> C): startPart({ editor, asset, partId, char }) -> Promise<
	   the flow (getFlow)>. Opens the letter (Characters page; in Simple no Undo step), places the
	   photo record on it with no Undo step (placement/fit_lines.js placePart; the part's left ink
	   edge where the letter's ink starts, 0 on an empty letter; the photo locked meanwhile, so no
	   drag can move it), and traces the part. The traced area is the part's rectangle with paper
	   round it (autotrace/trace_region.js regionFor: Simple takes the part, not the glyph box), on
	   the photo's pixels with every other letter's ink painted out (photo_flow_pixels.js
	   partPixels), with autotrace.js autoTraceImageData; the result keeps only the part's whole
	   shapes (trace_region.js keepShapesFor). A new part for the same letter ("Wrong part? Draw a
	   box") keeps what the letter had before the first one, so Cancel still puts that back.
	   Status: 'tracing', then 'ready' (shapes to put in), 'no-ink' or 'error'. 'no-ink' has two
	   codes: 'no-ink' (the trace found nothing at this ink cutoff: "No ink found in that part.
	   Drag Ink cutoff toward more ink, or draw the box again." [Draw a box]) and, finalize after
	   the second hostile pass, 'no-letter' (the part holds no letter's ink at all, or only specks
	   and ruled-line bits: more ink can't help, so "No letter found in that part. Draw the box
	   again around the letter." [Draw a box], and the card leaves Adjust shut).
	3. Adjust: adjustPart(editor, { threshold: 'auto' | 0..255, smoothDetail: 0..1, despeckle,
	   lightInk, paper: 'scan' | 'photo' }) re-traces ADJUST_DEBOUNCE_MS after the last change,
	   latest wins. smoothDetail is the one Smooth --o-- Detailed slider (smooth_detail.js); his
	   paper and light-ink picks are kept with the photo for its next letter (registry setPaper,
	   setLightInk), and the rest for the next letter of the same photo in this session. An ink
	   cutoff he set by hand is kept for the next part only once a trace at it gave a letter
	   (finalize: dragged to "more ink" on a part with nothing to find, it stayed at 255 and the
	   next letters traced as filled boxes); otherwise the next part starts on Auto again.
	4. Use it: useIt(editor, { mode: 'replace' | 'add' }) -> Promise<{ ok, title, resized, moved }
	   | { ok: false, code, key, button }>. One Undo step titled "traced small r" (history.traced):
	   the shapes go in through autotrace/apply.js applyAutoTrace with { round: true, title },
	   spacing is set to automatic and fitted in the same step (B3's hook), the photo is faded to
	   USED_OPACITY and locked, item.anyink.photoFit marks the letter as traced from its part
	   (photo_flow_fit.js), and the registry records the use and the photo's scale. Earlier letters
	   of the same photo that are still as traced and are now more than 3 % off the photo's size
	   (or would sit off their line) follow it (placement followPlan / applyFollow) inside the
	   same step, which is then a whole-font step (4.4); the toast names them ("Traced small r.
	   Also resized Capital B to match the photo."). Undo brings back the letter's earlier shapes
	   and photo in one press. 'add' keeps the shapes the letter had ("Add to my shapes instead");
	   such a letter holds its part but is never "as traced", so a later letter never resizes it.
	   The first Use it shows the tip "The faint photo stays under the letter..." (coach tips).
	5. Cancel: cancelPart(editor) puts the letter's earlier photo and its place back (no Undo
	   step; its shapes never changed) and takes out every photo addPhotoFile added since the last
	   Use it that no letter uses (4.4 "Cancel at step A, B or C"); taking a photo's record out
	   marks the work file behind (recovery.js markDirty, finalize: a backup or file save after a
	   Skip had already written it, and the status stayed "Saved"). keepAddedPhoto(editor, asset)
	   keeps one ("Done with this photo" on a photo he named nothing from). Opening another
	   letter, another page, More tools or another font during step C puts the letter back the
	   same way; an Undo that changes the letter's photo during step C just ends it.
	6. Reading: getFlow(editor) -> a frozen copy or null: { itemId, char, asset, partId, status,
	   error: { code, key, button } | null, shapes, points, replaces (the letter's shapes now: "This
	   replaces your 2 shapes"), options: { threshold, autoThreshold, smoothDetail, despeckle,
	   lightInk, paper, paperPicked (true while the paper is the one picked for him) }, placed: {
	   x, y, scale }, notes: [{ key, vars }] (step C's quiet notes, photo_flow_notes.js) };
	   onFlowChange(fn) -> unsubscribe; whenFlowSettled(editor) -> Promise of
	   the flow once it isn't tracing; photoPreviewShapes(item, editor) -> the traced shapes to
	   draw over the photo on the canvas (the green dashed outline of step C), or null.
	   Every change publishes 'autoTrace' on the editor (the edit canvas redraws on it; the coach
	   reads it again).
	7. The registry through Undo and Redo: watchPhotos(editor) (also started by every call
	   above) re-reads it after every change on the editor (photo_flow_fit.js reconcilePhotoUses),
	   so a part an Undo took back out is offered again and a Redo takes it back.
	   flowError(code) -> { code, key, button } for a screen: FLOW_ERRORS.

	Fix pass, 10/15/2026 (the B8 + B9 first-timer and engineer critics):
	- Junk: a new photo's parts that hold no pen's ink (bits of ruled and margin lines, punch
	  holes, a crossed-out letter, a hand's shadow: photo_flow_ink.js isJunkPart, against the
	  photo's pen) are skipped as it comes in (photo_registry.js markJunk), so the green box, the
	  alphabet prefill's turn, rule 12's count and [Use the same photo] never land on them; he can
	  still click one and name it. A part is traced from its letter's ink only
	  (photo_flow_data.js), and a part with none left, or whose trace is nothing but specks or
	  ruled-line bits (trace_region.js keepPenShapes), is "No ink found": nothing to use, the
	  letter unchanged. With Remove specks on, a speck or bit beside the letter's ink is left out.
	- Notes: step C's quiet notes (photo_flow_notes.js: two letters touching, ink far past the top
	  or tail line) are in the flow's state as notes: [{ key, vars }].
	- Saving: while step C runs, every saved copy of the letter holds the photo it had before
	  (photo_flow_hold.js), so a save or crash snapshot never keeps step C's placement.
	- One image id per photo, also when the same photo comes in twice at once (two quick drops):
	  the second waits for the first and gets its record (added: false); an image that turns out
	  to be another record's is taken back out, and the record's own image id is what comes back.

	The flow's subscriber id is FLOW_WATCH_ID ('anyink.photo.flow.watch', a substring of no other).

	One way in: the screens import this module only. It holds items 1, 2, 3, 5 and 7; Use it
	(item 4) is photo_flow_use.js, the state and its readers (item 6) photo_flow_state.js, the
	photos' kept pixels and the photo as placement reads it photo_flow_data.js, all re-exported
	here; the pixel helpers are photo_flow_pixels.js and "as traced" photo_flow_fit.js.
*/
import { charToHex } from '../../common/character_ids.js';
import { autoTraceImageData } from '../autotrace/autotrace.js';
import { normalizeOptions } from '../autotrace/params.js';
import { countPoints } from '../autotrace/svg_to_shapes.js';
import { keepShapesFor, regionFor } from '../autotrace/trace_region.js';
import { MODE_EVENT, isSimpleMode } from '../mode/mode.js';
import { markDirty } from '../recovery/recovery.js';
import { placePart } from '../placement/fit_lines.js';
import { inkBounds } from '../spacing/measure.js';
import { TRACE_MAX_SIDE, decodeImageFile } from '../trace/bitmap_cache.js';
import {
	TRACE_DEFAULTS,
	collectReferencedAssetIds,
	getTrace,
	setTrace,
} from '../trace/trace_model.js';
import { findInk, photoInk } from './ink_parts.js';
import { paperKind } from './paper_kind.js';
import { keepPixels, photoData, placementFor } from './photo_flow_data.js';
import { reconcilePhotoUses } from './photo_flow_fit.js';
import { holdSavedTrace, releaseSavedTrace } from './photo_flow_hold.js';
import { hasInk, isJunkPart } from './photo_flow_ink.js';
import { stepNotes } from './photo_flow_notes.js';
import { isHeicBytes, isHeicFile, partPixels, readPhotoPixels } from './photo_flow_pixels.js';
import {
	addUnhook,
	coded,
	currentEditor,
	emit,
	failure,
	flowError,
	snapshotOf,
	stateOf,
} from './photo_flow_state.js';
import {
	PHOTO_PAPERS,
	addPhoto,
	findPhotoByFingerprint,
	getPhoto,
	photoFingerprint,
	removePhoto,
	setLightInk,
	setPaper,
	markJunk,
} from './photo_registry.js';
import { SMOOTH_DETAIL_DEFAULT, optionsForSlider } from './smooth_detail.js';

export { KEPT_PHOTOS } from './photo_flow_data.js';
export {
	FLOW_ERRORS,
	FLOW_TOPIC,
	flowError,
	getFlow,
	onFlowChange,
	photoPreviewShapes,
	resetPhotoFlowForTests,
	whenFlowSettled,
} from './photo_flow_state.js';
export { USED_OPACITY, useIt } from './photo_flow_use.js';
// B8 + B9 integration: Fine-tune > Tail re-seats a traced letter (photo_flow_tail.js)
export { setLetterTail } from './photo_flow_tail.js';

/** Adjust re-traces this long after the last change, in ms (as the More tools card does). */
export const ADJUST_DEBOUNCE_MS = 120;

/** The flow's one subscriber id per editor. */
export const FLOW_WATCH_ID = 'anyink.photo.flow.watch';

/** A trace another caller made stale is asked again this many times. */
const MAX_STALE_RETRIES = 3;

/** The window event navigate() dispatches on a page change. */
const PAGE_CHANGE_EVENT = 'anyink-page-change';

/** bitmap_cache.js decode codes, as the flow's codes. */
const DECODE_CODES = Object.freeze({
	heic: 'heic',
	unsupported: 'wrong-type',
	'not-a-file': 'wrong-type',
	'no-decoder': 'no-decoder',
	'decode-failed': 'damaged',
	'encode-failed': 'too-big',
});

// --------------------------------------------------------------
// 1. A photo comes in
// --------------------------------------------------------------

/**
 * @param {File | Blob} file - the photo he picked or dropped
 * @param {{editor?: Object}} [options]
 * @returns {Promise<Object>} see the header
 */
export async function addPhotoFile(file, { editor = currentEditor() } = {}) {
	const project = editor?.project;
	if (!project || !editor.assets) return failure('damaged');
	if (!file || typeof file.size !== 'number') return failure('wrong-type');
	const s = stateOf(editor);
	watchPhotos(editor);

	let bytes;
	try {
		bytes = await readBytes(file);
	} catch {
		return failure('damaged');
	}
	if (isHeicFile(file) || isHeicBytes(bytes)) return failure('heic');

	const fingerprint = photoFingerprint(bytes);
	// The same photo while its first copy is still coming in: that copy's record
	const coming = s.adding.get(fingerprint);
	if (coming) return asSame(await coming);
	const same = findPhotoByFingerprint(project, fingerprint);
	if (same && editor.assets.has(same.asset)) return asSame({ ok: true, record: same });

	const adding = addDecoded(editor, { file, bytes, fingerprint, same });
	s.adding.set(fingerprint, adding);
	try {
		return await adding;
	} finally {
		if (s.adding.get(fingerprint) === adding) s.adding.delete(fingerprint);
	}
}

/** A photo already in the font: its record, added: false (a failure as it is). */
function asSame(result) {
	if (!result?.ok || !result.record) return result;
	const { record } = result;
	return { ok: true, asset: record.asset, record, added: false, parts: record.parts.length };
}

/** Decodes and adds a photo not in the font yet (or whose record lost its image). */
async function addDecoded(editor, { file, bytes, fingerprint, same }) {
	const project = editor.project;
	const s = stateOf(editor);
	let decoded;
	try {
		decoded = await decodeImageFile(file, { maxSide: TRACE_MAX_SIDE });
	} catch (error) {
		return failure(DECODE_CODES[error?.code] || 'damaged');
	}
	if (editor.project !== project) return failure('read-failed');
	// It may have come in by another way while this one decoded
	const now = same ? null : findPhotoByFingerprint(project, fingerprint);
	if (now && editor.assets.has(now.asset)) return asSame({ ok: true, record: now });

	let asset;
	try {
		// A record whose image went missing takes its image back under its own id
		asset = editor.assets.add(decoded.blob, {
			id: same ? same.asset : undefined,
			type: decoded.type || decoded.blob.type,
		});
	} catch {
		return failure('wrong-type');
	}
	let image;
	try {
		image = await readPhotoPixels(decoded.blob, decoded);
	} catch {
		if (!same) editor.assets.delete(asset);
		return failure('read-failed');
	}

	const paper = paperKind({ bytes, imageData: image });
	const find = { paper: paper.kind, lightInk: paper.lightInk };
	const { mask, ink } = photoInk(image, find);
	const found = findInk(mask, image.width, image.height);
	const record =
		same ||
		addPhoto(project, {
			asset,
			width: decoded.width,
			height: decoded.height,
			parts: found.parts,
			paper: paper.kind,
			lightInk: paper.lightInk,
			fingerprint,
			pen: found.stroke,
		});
	if (!record) {
		editor.assets.delete(asset);
		return failure('damaged');
	}
	if (record.asset !== asset) {
		// Another copy of this photo is the font's: its image id, and this image back out
		if (!collectReferencedAssetIds(project).has(asset)) editor.assets.delete(asset);
		return asSame({ ok: true, record });
	}
	const fresh = !same;
	if (fresh) {
		// Parts no pen wrote (ruled lines, punch holes, a shadow) are never guessed or counted
		for (const part of found.parts) {
			if (isJunkPart(part, found.stroke)) markJunk(record, part.id);
		}
	}
	keepPixels(s, record, {
		blob: decoded.blob,
		image,
		mask,
		ink,
		parts: fresh ? found.parts : null,
		stroke: found.stroke,
	});
	if (fresh) s.added.add(asset);
	return { ok: true, asset, record, added: fresh, parts: record.parts.length };
}

/** The file's bytes (File.arrayBuffer, or FileReader where a Blob lacks it). */
async function readBytes(file) {
	if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(new Uint8Array(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

// --------------------------------------------------------------
// 2. A part for a letter
// --------------------------------------------------------------

/**
 * @param {{editor?: Object, asset: String, partId: String, char: String}} args
 * @returns {Promise<Object | null>} the flow (getFlow), or null when the photo, the part or the
 *   letter is unknown, or a newer startPart took over
 */
export async function startPart({ editor = currentEditor(), asset, partId, char } = {}) {
	const project = editor?.project;
	const record = getPhoto(project, asset);
	if (!record?.parts.some((part) => part.id === partId) || !isOneChar(char)) return null;
	const s = stateOf(editor);
	watchPhotos(editor);
	const ticket = ++s.ticket;

	let data;
	try {
		data = await photoData(s, editor, record);
	} catch {
		if (ticket !== s.ticket) return null;
		return Object.freeze({ status: 'error', error: flowError('read-failed') });
	}
	if (ticket !== s.ticket || editor.project !== project) return null;

	const itemId = `glyph-${charToHex(char)}`;
	const previous = s.flow;
	if (previous && previous.itemId !== itemId) endFlow(previous, { putBack: true });
	openLetter(editor, itemId);
	const item = editor.selectedItem;
	if (!item || item.id !== itemId) return null;

	const same = s.flow && s.flow.itemId === itemId ? s.flow : null;
	const before = same ? same.before : { trace: getTrace(item) };
	if (same) {
		same.run++;
		clearTimeout(same.timer);
	}
	const part = data.masked.get(partId);
	const font = project.settings.font;
	const ink = item.shapes.length ? inkBounds(item) : null;
	const left = ink && Number.isFinite(ink.xMin) ? Math.round(ink.xMin) : 0;
	const placed = placePart(placementFor(record, data, { partId, char, itemId }), partId, font, {
		left,
	});

	const flow = {
		editor,
		project,
		itemId,
		char,
		asset,
		partId,
		part,
		before,
		placed: placed ? { x: placed.x, y: placed.y, scale: placed.scale } : null,
		trace: null,
		options: optionsFor(s, record),
		autoThreshold: null,
		paperByHand: s.paperByHand.has(asset),
		status: 'tracing',
		error: null,
		result: null,
		run: 0,
		timer: null,
		retries: 0,
		applying: false,
		notes: null,
	};
	s.flow = flow;
	if (!placed) {
		// The letter shows what it had before, not the part tried before this one
		if (same) putPhotoBack(same);
		releaseHold(flow);
		settle(flow, 'no-ink');
		return snapshotOf(flow);
	}
	setTrace(item, {
		asset,
		width: record.width,
		height: record.height,
		x: placed.x,
		y: placed.y,
		scale: placed.scale,
		opacity: before.trace?.opacity ?? TRACE_DEFAULTS.opacity,
		visible: true,
		locked: true,
		invert: before.trace?.invert ?? false,
	});
	flow.trace = getTrace(item);
	// Step C's placement is a look: every saved copy keeps the photo the letter had before
	holdSavedTrace(item, {
		before: before.trace,
		isLive: () =>
			s.flow === flow &&
			!flow.applying &&
			editor.project === project &&
			project.getItem(itemId) === item,
	});
	editor.publish('traceLayer', item);
	await runTrace(flow);
	return s.flow === flow ? snapshotOf(flow) : null;
}

/** Opens a letter on the Characters page (in Simple, no Undo step: 7.3). */
function openLetter(editor, itemId) {
	if (editor.selectedGlyphID !== itemId || !editor.project.glyphs[itemId]) {
		editor.selectedGlyphID = itemId;
	}
	if (editor.nav.page === 'Characters') return;
	editor.nav.page = 'Characters';
	if (typeof document !== 'undefined' && document.querySelector('#app__wrapper')) {
		editor.navigate();
	}
}

// --------------------------------------------------------------
// Tracing the part
// --------------------------------------------------------------

async function runTrace(flow) {
	clearTimeout(flow.timer);
	flow.timer = null;
	const run = ++flow.run;
	flow.status = 'tracing';
	flow.error = null;
	emit(flow);
	try {
		const s = stateOf(flow.editor);
		const record = getPhoto(flow.project, flow.asset);
		if (!record) throw coded('read-failed');
		const data = await photoData(s, flow.editor, record);
		if (!isLive(flow, run)) return;
		const item = flow.project.getItem(flow.itemId);
		const font = flow.project.settings.font;
		const part = data.masked.get(flow.partId) || flow.part;
		const region = regionFor(flow.trace, item, font, { part });
		// A part with no letter ink left (ruled-line bits, a punch hole) has nothing to trace
		const empty = part?.mask instanceof Uint8Array && !hasInk(part.mask);
		const pixels = region && !empty && partPixels(data.image, region, { inkMask: data.ink, part });
		if (!pixels) {
			flow.result = null;
			flow.notes = null;
			// ink binarize found in the part, none of it a letter's: more ink can't help
			settle(flow, empty && inkInBox(data, part) ? 'no-letter' : 'no-ink');
			return;
		}
		const traced = await autoTraceImageData(pixels, traceOptions(flow.options), {
			x: flow.trace.x,
			y: flow.trace.y,
			scale: flow.trace.scale,
			offsetX: pixels.x,
			offsetY: pixels.y,
			upm: Number(font?.upm) > 0 ? Number(font.upm) : undefined,
		});
		if (!isLive(flow, run)) return;
		// Specks and ruled-line bits alone are no letter; with Remove specks on, none go in
		const shapes = keepShapesFor(traced?.shapes || [], item, font, {
			part,
			trace: flow.trace,
			pen: data.stroke,
			specks: flow.options.despeckle,
		});
		flow.retries = 0;
		flow.autoThreshold = Number.isFinite(traced?.autoThreshold) ? traced.autoThreshold : null;
		flow.result = shapes.length ? { shapes, points: countPoints(shapes) } : null;
		flow.notes = shapes.length
			? stepNotes({ record, partId: flow.partId, shapes, font, char: flow.char })
			: null;
		// specks or ruled-line bits alone: no letter there, whatever the cutoff
		const found = traced?.shapes?.length ? 'no-letter' : 'no-ink';
		if (shapes.length && flow.options.threshold !== 'auto') keepCutoff(flow);
		settle(flow, shapes.length ? null : found);
	} catch (error) {
		if (!isLive(flow, run)) return;
		if (error?.stale && flow.retries++ < MAX_STALE_RETRIES) {
			queueTrace(flow, 0);
			return;
		}
		flow.result = null;
		flow.notes = null;
		settle(flow, codeOfTraceError(error));
	}
}

/** 'ready' with no error code; 'no-ink' (codes 'no-ink', 'no-letter') or 'error' with one. */
function settle(flow, code) {
	flow.error = code;
	flow.status = !code ? 'ready' : code === 'no-ink' || code === 'no-letter' ? 'no-ink' : 'error';
	emit(flow);
}

/** True when the photo's ink (everything binarize marked) has a pixel inside the part's box. */
function inkInBox(data, part) {
	const ink = data?.ink;
	const width = data?.image?.width;
	if (!(ink instanceof Uint8Array) || !(width > 0) || !part) return false;
	const height = ink.length / width;
	const top = Math.max(0, Math.floor(part.top));
	const bottom = Math.min(height, Math.ceil(part.bottom));
	const left = Math.max(0, Math.floor(part.left));
	const right = Math.min(width, Math.ceil(part.right));
	for (let y = top; y < bottom; y++) {
		for (let x = left; x < right; x++) if (ink[y * width + x]) return true;
	}
	return false;
}

/** A cutoff he set by hand gave a letter: the photo's next part starts with it too. */
function keepCutoff(flow) {
	const s = stateOf(flow.editor);
	const kept = s.memory.get(flow.asset);
	if (kept && kept.threshold === flow.options.threshold) kept.cutoffWorked = true;
}

function codeOfTraceError(error) {
	if (error?.code === 'too-many') return 'too-many';
	if (['read-failed', 'missing-image', 'empty-image'].includes(error?.code)) return 'read-failed';
	return 'trace-failed';
}

function queueTrace(flow, ms) {
	clearTimeout(flow.timer);
	flow.status = 'tracing';
	flow.error = null;
	flow.timer = setTimeout(() => {
		flow.timer = null;
		if (isLive(flow, flow.run)) runTrace(flow);
	}, ms);
	emit(flow);
}

function isLive(flow, run) {
	return stateOf(flow.editor).flow === flow && flow.run === run && !flow.applying;
}

/** The auto-trace options for the flow's settings (params.js). */
function traceOptions(o) {
	return normalizeOptions({
		mode: o.paper === 'photo' ? 'photo' : 'scan',
		threshold: o.threshold,
		...optionsForSlider(o.smoothDetail),
		despeckle: o.despeckle,
		invert: o.lightInk,
		insideBoxOnly: false,
	});
}

/** Where the settings start for a part of this photo. */
function optionsFor(s, record) {
	const kept = s.memory.get(record.asset) || {};
	return {
		// a cutoff he set that never gave a letter starts on Auto again
		threshold: kept.cutoffWorked ? (kept.threshold ?? 'auto') : 'auto',
		smoothDetail: kept.smoothDetail ?? SMOOTH_DETAIL_DEFAULT,
		despeckle: kept.despeckle ?? true,
		lightInk: record.lightInk,
		paper: record.paper,
	};
}

// --------------------------------------------------------------
// 3. Adjust
// --------------------------------------------------------------

/**
 * @param {Object} [editor]
 * @param {{threshold?: 'auto' | Number, smoothDetail?: Number, despeckle?: Boolean,
 *   lightInk?: Boolean, paper?: 'scan' | 'photo'}} changes
 * @returns {Object | null} the flow
 */
export function adjustPart(editor = currentEditor(), changes = {}) {
	const s = stateOf(editor);
	const flow = s.flow;
	if (!flow || flow.applying || !changes || typeof changes !== 'object') return null;
	const record = getPhoto(flow.project, flow.asset);
	const o = { ...flow.options };
	if ('threshold' in changes) {
		const t = Number(changes.threshold);
		o.threshold =
			changes.threshold === 'auto' || !Number.isFinite(t)
				? 'auto'
				: Math.round(Math.min(255, Math.max(0, t)));
	}
	if (Number.isFinite(Number(changes.smoothDetail))) {
		o.smoothDetail = Math.min(1, Math.max(0, Number(changes.smoothDetail)));
	}
	if (typeof changes.despeckle === 'boolean') o.despeckle = changes.despeckle;
	if (typeof changes.lightInk === 'boolean') {
		o.lightInk = changes.lightInk;
		if (record) setLightInk(record, o.lightInk);
	}
	if (PHOTO_PAPERS.includes(changes.paper)) {
		o.paper = changes.paper;
		if (record) setPaper(record, o.paper);
		s.paperByHand.add(flow.asset);
		flow.paperByHand = true;
	}
	flow.options = o;
	const before = s.memory.get(flow.asset);
	s.memory.set(flow.asset, {
		threshold: o.threshold,
		smoothDetail: o.smoothDetail,
		despeckle: o.despeckle,
		cutoffWorked: !!before?.cutoffWorked && before.threshold === o.threshold,
	});
	if (flow.trace) queueTrace(flow, ADJUST_DEBOUNCE_MS);
	return snapshotOf(flow);
}

// --------------------------------------------------------------
// 4. Use it: photo_flow_use.js
// 5. Cancel
// --------------------------------------------------------------

/**
 * @param {Object} [editor]
 * @returns {Boolean} true when something was put back or taken out
 */
export function cancelPart(editor = currentEditor()) {
	if (!editor?.project) return false;
	const s = stateOf(editor);
	let changed = false;
	if (s.flow) {
		endFlow(s.flow, { putBack: true });
		changed = true;
	}
	let forgot = false;
	for (const asset of [...s.added]) {
		const record = getPhoto(editor.project, asset);
		if (record && Object.keys(record.used).length) continue;
		if (forgetPhoto(editor, asset)) forgot = true;
	}
	s.added.clear();
	// a save since the photo came in (after a Skip, say) holds its record: the file is behind
	if (forgot) {
		try {
			markDirty(editor);
		} catch (error) {
			console.warn('ANY-INK photo: the change could not be marked', error);
		}
	}
	return changed || forgot;
}

/**
 * Keeps a photo addPhotoFile added when the photo card is cancelled ("Done with this photo").
 * @param {Object} editor
 * @param {String} asset
 */
export function keepAddedPhoto(editor, asset) {
	if (editor) stateOf(editor).added.delete(asset);
}

/** Takes a photo out of the font: its record, and its image when no letter shows it. */
function forgetPhoto(editor, asset) {
	const s = stateOf(editor);
	const removed = removePhoto(editor.project, asset);
	if (!collectReferencedAssetIds(editor.project).has(asset)) editor.assets?.delete?.(asset);
	s.photos.delete(asset);
	s.memory.delete(asset);
	s.paperByHand.delete(asset);
	return removed;
}

/**
 * Ends the flow. putBack: the letter's earlier photo and its place come back (Cancel, or he
 * went somewhere else); otherwise the letter is left as it is (an Undo already changed it).
 */
function endFlow(flow, { putBack }) {
	const s = stateOf(flow.editor);
	if (s.flow !== flow) return;
	clearTimeout(flow.timer);
	flow.timer = null;
	flow.run++;
	s.flow = null;
	releaseHold(flow);
	if (putBack) putPhotoBack(flow);
	emit(null, flow.editor);
}

/** The letter's earlier photo and its place, only while it still shows what the flow put there. */
function putPhotoBack(flow) {
	if (!flow.trace) return;
	const item = flow.project.getItem(flow.itemId);
	const now = getTrace(item);
	if (item && now && now.asset === flow.asset && now.x === flow.trace.x && now.y === flow.trace.y) {
		setTrace(item, flow.before.trace);
		flow.editor.publish('traceLayer', item);
	}
}

/** Takes step C's save hold off the letter (photo_flow_hold.js). */
export function releaseHold(flow) {
	const item = flow?.project?.getItem?.(flow.itemId);
	if (item) releaseSavedTrace(item);
}

// --------------------------------------------------------------
// 6. Reading: photo_flow_state.js
// 7. Watching the editor
// --------------------------------------------------------------

/**
 * Starts watching an editor once: step C ends when he goes elsewhere, and the registry is read
 * again after every change (Undo and Redo).
 * @param {Object} [editor]
 */
export function watchPhotos(editor = currentEditor()) {
	if (!editor?.subscribe) return;
	const s = stateOf(editor);
	if (s.watching) return;
	s.watching = true;
	editor.subscribe({
		topic: [
			'whichGlyphIsSelected',
			'whichLigatureIsSelected',
			'whichComponentIsSelected',
			'currentItem',
			'traceLayer',
		],
		subscriberID: FLOW_WATCH_ID,
		callback: () => checkEditor(editor),
	});
	if (typeof window !== 'undefined') {
		const recheck = () => checkEditor(editor);
		window.addEventListener(PAGE_CHANGE_EVENT, recheck);
		window.addEventListener(MODE_EVENT, recheck);
		addUnhook(() => {
			window.removeEventListener(PAGE_CHANGE_EVENT, recheck);
			window.removeEventListener(MODE_EVENT, recheck);
			editor.unsubscribe?.({ idToRemove: FLOW_WATCH_ID });
		});
	}
}

/**
 * B8 + B9 integration: a photo as the photo dialog draws it, read once and kept with the flow's
 * own pixels (photo_flow_data.js): its stored image's pixels and its ink mask, found as when its
 * parts were (record.find), so a box he drags tightens to the ink inside it.
 * @param {Object} [editor]
 * @param {String} asset
 * @returns {Promise<{record: Object, image: ImageData, mask: Uint8Array, blob: Blob} | null>}
 *   null when the photo or its image is gone
 */
export async function photoPixels(editor = currentEditor(), asset) {
	// ink: all the ink binarize found, for a box round a letter the pen's mask lacks
	const record = getPhoto(editor?.project, asset);
	if (!record || !editor.assets?.has?.(asset)) return null;
	try {
		const data = await photoData(stateOf(editor), editor, record);
		return { record, image: data.image, mask: data.mask, ink: data.ink, blob: data.blob };
	} catch {
		return null;
	}
}

/**
 * @param {Object} [editor]
 * @returns {{released: Number, restored: Number}}
 */
export function reconcilePhotos(editor = currentEditor()) {
	if (!editor?.project) return { released: 0, restored: 0 };
	const flow = stateOf(editor).flow;
	return reconcilePhotoUses(editor.project, { skip: flow?.itemId });
}

function checkEditor(editor) {
	const s = stateOf(editor);
	const flow = s.flow;
	if (flow && !flow.applying) {
		const away =
			!isSimpleMode() ||
			editor.project !== flow.project ||
			editor.nav?.page !== 'Characters' ||
			editor.selectedGlyphID !== flow.itemId;
		if (away) {
			endFlow(flow, { putBack: editor.project === flow.project });
		} else if (flow.trace) {
			const now = getTrace(flow.project.getItem(flow.itemId));
			const same =
				now &&
				now.asset === flow.asset &&
				now.x === flow.trace.x &&
				now.y === flow.trace.y &&
				now.scale === flow.trace.scale;
			if (!same) endFlow(flow, { putBack: false });
		}
	}
	if (s.reconciling) return;
	s.reconciling = true;
	queueMicrotask(() => {
		s.reconciling = false;
		try {
			reconcilePhotos(editor);
		} catch (error) {
			console.warn('ANY-INK photo: the photo records could not be checked', error);
		}
	});
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** One character, as he types it in the letter field. */
function isOneChar(char) {
	return typeof char === 'string' && [...char].length === 1 && char.trim() === char;
}
