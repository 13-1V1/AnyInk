// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: the live preview session (Milestone 8).
	Owner: TRACK C (session, panel card, css).

	One preview session at a time (there is one editor at a time). Nothing here touches the
	glyph or the history until applySession: the preview lives only in this module and is
	drawn by preview_draw.js.

	- startSession({ editor, item, options }): starts previewing the item's trace and traces
	  once right away. The item must be the item on the canvas, with a trace, while the
	  Trace panel is open. The options start from the ones used last in this app session
	  (the defaults in params.js the first time), so a whole alphabet from one scan keeps
	  its settings; `options` (optional) overrides some of them. Starting again for the
	  same item keeps the running session.
	- updateOptions(partial): merges option changes (normalizeOptions) and re-traces after
	  SESSION_DEBOUNCE_MS; latest wins. A stale client rejection is ignored. While a
	  re-trace waits or runs, status is 'tracing' and `result` keeps the previous trace, so
	  the preview never blinks during a slider drag. A long drag still re-traces at least
	  every SESSION_MAX_WAIT_MS (fix: the preview froze until the hand stopped), but never
	  replaces a mid-drag trace that is still running: the next one starts when it lands,
	  so a slow image still shows every result it can. The max wait is for option changes
	  only: moving the image re-traces SESSION_DEBOUNCE_MS after it stops (finalize: a
	  canvas drag ran a main-thread trace every 150 ms under the pointer).
	- getSession() -> { editor, item, itemId, options, status: 'idle' | 'tracing' | 'ready'
	  | 'error', result: { shapes, points, ms, threshold, ... } | null, error: String | null,
	  errorCode: String | null (the facade's code: 'too-many', 'shapes-outside-box', ...),
	  notice: String | null (why the last Replace / Add gave up, kept until the next change
	  or press), applying: null | 'replace' | 'add' }, or null when no session runs (or the
	  one that runs is about to end: another item, panel, or page). The object is frozen and replaced
	  on every change.
	- onSessionChange(fn) -> unsubscribe. fn(session or null) after every change.
	- applySession(mode: 'replace' | 'add') -> Promise<Boolean>: re-traces at full
	  resolution (autoTraceTrace preview false), then applyAutoTrace (apply.js: one history
	  entry), then ends the session. On failure the session stays open with status
	  'error' and nothing changes. Never rejects. If the image or the glyph box moved while
	  the full-size trace ran (a nudge, a drag, a metric-line drag, an undo), it traces
	  again, up to MAX_MOVED_RETRIES times, then gives up with movedReason(mode): outlines
	  traced for the old position never go in. Giving up keeps the reason as `notice` and
	  traces the preview again where the image is now (finalize: the preview stayed blank).
	  Refused (resolves false, nothing traced) while the preview's error is one of
	  APPLY_BLOCKING_CODES: a preview refused as too many shapes, or with every shape
	  outside the glyph box, would apply outlines the user never saw (finalize).
	- cancelSession(): ends the session; nothing enters history.
	The session ends by itself when the selected item changes, the panel or page changes
	away (editor.navigate() dispatches the window event 'anyink-page-change'; a tool can
	also set editor.nav.panel without navigating, so every watched topic checks it too),
	the project closes, the app switches to the other open project (M8 integration), or the
	trace is removed. Every end lets the facade's kept preview pixels go at once
	(clearAutoTraceCache; finalize: a cancel held them for a minute). A hidden or locked
	trace can still be auto-traced: the image is the input, and Show / Lock only govern
	drawing and dragging it (D-029). Moving, resizing or
	replacing the trace image, or changing the glyph box while 'Only inside the glyph box'
	is on, re-traces.
	Every change publishes 'autoTrace' on the editor (the edit canvas redraws the preview
	through its '*' subscription). The one subscriber id is SESSION_WATCH_ID, which starts
	with 'anyink.autotrace.session' (never 'anyink.autotrace.panel': panels.js removes those
	when another panel opens).
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { getTrace } from '../trace/trace_model.js';
import { applyAutoTrace } from './apply.js';
import { autoTraceTrace, clearAutoTraceCache } from './autotrace.js';
import { AUTOTRACE_DEFAULTS, normalizeOptions } from './params.js';

/** Wait after the last option change before re-tracing, in ms. */
export const SESSION_DEBOUNCE_MS = 120;

/** Longest wait for a re-trace while option changes keep coming (a slider drag), in ms. */
export const SESSION_MAX_WAIT_MS = 150;

/** Preview error codes that keep Replace and Add from running (see applySession). */
export const APPLY_BLOCKING_CODES = Object.freeze(['too-many', 'shapes-outside-box']);

/** The session's one pub/sub subscriber id. */
export const SESSION_WATCH_ID = 'anyink.autotrace.session.watch';

/** The pub/sub topic every session change publishes (src/project_editor/pub_sub.js). */
export const AUTOTRACE_TOPIC = 'autoTrace';

/** The reason applySession gives when the full-size trace found nothing to put in. */
export const NO_INK_REASON =
	'no ink found in the image. Move Threshold, or turn on Light ink on dark paper.';

/** The reason applySession gives when apply.js puts nothing in. */
export const NOT_APPLIED_REASON = 'the traced outlines could not be added to this glyph.';

/**
 * The reason applySession gives when the image or the glyph box kept moving while it traced.
 * @param {'replace' | 'add'} mode
 * @returns {String}
 */
export function movedReason(mode) {
	const button = mode === 'add' ? 'Add to outlines' : 'Replace outlines';
	return `the image moved while tracing. Press ${button} again.`;
}

/** Pages that have an edit canvas and the Trace panel. */
const EDIT_PAGES = ['Characters', 'Ligatures', 'Components'];

/** Topics after which the session checks it still applies (and whether to re-trace). */
const WATCH_TOPICS = [
	'whichGlyphIsSelected',
	'whichLigatureIsSelected',
	'whichComponentIsSelected',
	'whichShapeIsSelected',
	'whichPathPointIsSelected',
	'currentItem',
	'traceLayer',
	'fontMetrics',
];

const PAGE_CHANGE_EVENT = 'anyink-page-change';

/** How often a trace that another caller made stale is sent again before giving up. */
const MAX_STALE_RETRIES = 3;

/** How often Replace / Add traces again because the image or box moved meanwhile. */
const MAX_MOVED_RETRIES = 2;

/** The running session (internal, mutable), or null. */
let live = null;
/** What getSession() hands out for `live` (frozen), or null. */
let snapshot = null;
/** Options of the last session, the start of the next one. */
let lastOptions = null;
const listeners = new Set();

// --------------------------------------------------------------
// Public API
// --------------------------------------------------------------

/**
 * @param {{editor: Object, item: Object, options?: Object}} args
 * @returns {Object | null} the session (as getSession returns it), or null when none can
 *   start: no editor or project, the item is not the one on the canvas, it has no trace,
 *   or the Trace panel is not open
 */
export function startSession({ editor, item, options } = {}) {
	if (!editor?.project || !item) return null;
	const itemId = item.id || editor.selectedItemID;
	if (!itemId || editor.selectedItemID !== itemId) return null;
	if (editor.nav?.panel !== 'Trace' || !EDIT_PAGES.includes(editor.nav?.page)) return null;
	const current = editor.project.getItem(itemId) || item;
	if (!getTrace(current)) return null;

	if (live && live.editor === editor && live.itemId === itemId) {
		if (options && typeof options === 'object') updateOptions(options);
		return snapshot;
	}
	if (live) endSession(live, 'replaced');

	const s = {
		editor,
		item: current,
		itemId,
		page: editor.nav.page,
		options: normalizeOptions({
			...(lastOptions || AUTOTRACE_DEFAULTS),
			...(options && typeof options === 'object' ? options : {}),
		}),
		status: 'tracing',
		result: null,
		error: null,
		errorCode: null,
		notice: null,
		applying: null,
		applyPromise: null,
		run: 0,
		timer: null,
		// Max wait during a drag: the timer that traces even while changes keep coming
		maxTimer: null,
		// The preview trace running now (its run number), and whether the max wait ran out
		// while it ran (then the next trace starts as soon as it lands)
		inFlight: 0,
		afterFlight: false,
		staleRetries: 0,
		placement: '',
		unhook: null,
		// Ending the session drops its trace from the worker's queue (latest wins anyway)
		abort: typeof AbortController === 'function' ? new AbortController() : null,
	};
	s.placement = placementKey(s);
	lastOptions = s.options;
	live = s;
	watch(s);
	runTrace(s);
	return snapshot;
}

/**
 * Merges option changes and re-traces after SESSION_DEBOUNCE_MS (latest wins).
 * Ignored while no session runs or while it is applying.
 * @param {Object} partial - any subset of the auto-trace options
 */
export function updateOptions(partial) {
	const s = live;
	if (!s || s.applying || !partial || typeof partial !== 'object') return;
	const next = normalizeOptions({ ...s.options, ...partial });
	if (sameOptions(next, s.options)) return;
	s.options = next;
	lastOptions = next;
	s.placement = placementKey(s);
	s.notice = null;
	queueTrace(s, { maxWait: true });
	emit(s);
}

/**
 * @returns {Object | null} the running session (frozen; see the header), or null
 */
export function getSession() {
	if (!live) return null;
	if (quickEndReason(live)) {
		// Another item, panel or page already: say so now, end it right after
		const s = live;
		queueMicrotask(() => checkSession(s));
		return null;
	}
	return snapshot;
}

/**
 * @param {Function} fn - called with the session (or null) after every change
 * @returns {Function} unsubscribe
 */
export function onSessionChange(fn) {
	if (typeof fn !== 'function') return () => {};
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/**
 * Traces at full resolution, puts the shapes in (one history entry), ends the session.
 * @param {'replace' | 'add'} mode - 'replace' takes the item's shapes out first
 * @returns {Promise<Boolean>} true when shapes went in; never rejects
 */
export function applySession(mode = 'replace') {
	const s = live;
	if (!s) return Promise.resolve(false);
	if (s.applying) return s.applyPromise;
	if (s.status === 'error' && APPLY_BLOCKING_CODES.includes(s.errorCode)) {
		return Promise.resolve(false);
	}
	s.applying = mode === 'add' ? 'add' : 'replace';
	clearTimers(s);
	s.afterFlight = false;
	s.status = 'tracing';
	s.error = null;
	s.errorCode = null;
	s.notice = null;
	emit(s);
	s.applyPromise = runApply(s);
	return s.applyPromise;
}

/** Ends the session without changing the glyph. */
export function cancelSession() {
	if (live) endSession(live, 'canceled');
}

/** Tests: end any session, forget the remembered options, drop every listener. */
export function resetAutoTraceSessionForTests() {
	if (live) endSession(live, 'reset');
	lastOptions = null;
	listeners.clear();
}

// --------------------------------------------------------------
// Tracing
// --------------------------------------------------------------

/**
 * Re-trace after the debounce; the previous result stays until the new one arrives. With
 * maxWait (option changes), while changes keep coming a trace still starts every
 * SESSION_MAX_WAIT_MS (maxWaitRanOut); image moves wait for the hand to stop.
 */
function queueTrace(s, { maxWait = false } = {}) {
	if (live !== s || s.applying) return;
	clearTimeout(s.timer);
	s.status = 'tracing';
	s.error = null;
	s.errorCode = null;
	s.timer = setTimeout(() => runTrace(s), SESSION_DEBOUNCE_MS);
	if (!maxWait) {
		// A placement change also cancels an earlier slider's max-wait deadline.
		clearTimeout(s.maxTimer);
		s.maxTimer = null;
		s.afterFlight = false;
	} else if (!s.maxTimer) {
		s.maxTimer = setTimeout(() => maxWaitRanOut(s), SESSION_MAX_WAIT_MS);
	}
}

/** A drag went on for SESSION_MAX_WAIT_MS: trace now, or as soon as the running one lands. */
function maxWaitRanOut(s) {
	s.maxTimer = null;
	if (live !== s || s.applying) return;
	if (s.inFlight) s.afterFlight = true;
	else runTrace(s);
}

function clearTimers(s) {
	clearTimeout(s.timer);
	clearTimeout(s.maxTimer);
	s.timer = null;
	s.maxTimer = null;
}

/** True while a re-trace is waiting to start. */
function waiting(s) {
	return !!(s.timer || s.maxTimer || s.afterFlight);
}

function runTrace(s) {
	clearTimers(s);
	s.afterFlight = false;
	if (live !== s || s.applying) return;
	const run = ++s.run;
	s.inFlight = run;
	s.status = 'tracing';
	s.error = null;
	s.errorCode = null;
	emit(s);
	callFacade(s, true).then(
		(result) => {
			if (live !== s || run !== s.run || s.applying) return;
			s.inFlight = 0;
			s.result = result || null;
			s.staleRetries = 0;
			// The max wait ran out while this one ran: show it and trace the newer options now
			if (s.afterFlight) {
				runTrace(s);
				return;
			}
			// An older trace landing while a newer one waits: show it, keep 'tracing'
			s.status = waiting(s) ? 'tracing' : 'ready';
			emit(s);
		},
		(error) => {
			if (live !== s || run !== s.run || s.applying) return;
			s.inFlight = 0;
			if (s.afterFlight) {
				// Newer options are waiting: their trace replaces this failure
				runTrace(s);
				return;
			}
			if (error?.stale) {
				// Another caller (not this session) took the worker: ask again, a few times
				if (s.staleRetries++ < MAX_STALE_RETRIES) queueTrace(s);
				return;
			}
			s.status = 'error';
			s.error = reasonOf(error);
			s.errorCode = codeOf(error);
			emit(s);
		}
	);
}

async function runApply(s) {
	const run = ++s.run;
	s.inFlight = 0;
	let result = null;
	for (let moves = 0; ; moves++) {
		// What the pixels and their placement depend on, as this trace reads them
		const key = placementKey(s);
		const traced = await traceFullSize(s, run);
		if (live !== s || run !== s.run) return false;
		if (typeof traced.error === 'string') return failApply(s, traced.error, traced.code);
		result = traced.result;
		// The glyph may have been switched, swapped by undo, or its trace removed meanwhile
		checkSession(s);
		if (live !== s) return false;
		// The image or the glyph box moved while the worker ran: these outlines would land
		// where the image used to be, so trace again where it is now
		if (placementKey(s) === key) break;
		if (moves >= MAX_MOVED_RETRIES) return giveUpMoved(s);
	}
	if (!result?.shapes?.length) return failApply(s, NO_INK_REASON);

	let applied = false;
	try {
		applied = applyAutoTrace({
			editor: s.editor,
			item: s.item,
			shapes: result.shapes,
			mode: s.applying,
		});
	} catch (error) {
		return failApply(s, reasonOf(error));
	}
	if (!applied) return failApply(s, NOT_APPLIED_REASON);
	endSession(s, 'applied');
	return true;
}

/**
 * One full-size trace, sent again when another caller made it stale.
 * @returns {Promise<{result: Object | null, error?: String, code?: String}>} error: the
 *   plain reason; code: the facade's error code, if any
 */
async function traceFullSize(s, run) {
	for (let attempt = 0; ; attempt++) {
		try {
			return { result: await callFacade(s, false) };
		} catch (error) {
			if (live !== s || run !== s.run) return { result: null };
			if (error?.stale && attempt < MAX_STALE_RETRIES) continue;
			return { result: null, error: reasonOf(error), code: codeOf(error) };
		}
	}
}

function failApply(s, reason, code = null) {
	if (live !== s) return false;
	s.applying = null;
	s.applyPromise = null;
	s.status = 'error';
	s.error = reason;
	s.errorCode = code || null;
	emit(s);
	return false;
}

/**
 * Replace / Add gave up because the image kept moving: say why (notice, which a re-trace
 * does not clear) and trace the preview where the image is now.
 */
function giveUpMoved(s) {
	if (live !== s) return false;
	const reason = movedReason(s.applying);
	s.applying = null;
	s.applyPromise = null;
	s.notice = reason;
	s.placement = placementKey(s);
	queueTrace(s);
	emit(s);
	return false;
}

/** The facade, with a thrown error turned into a rejection. */
function callFacade(s, preview) {
	return new Promise((resolve) => {
		resolve(
			autoTraceTrace({
				editor: s.editor,
				item: s.item,
				options: s.options,
				preview,
				signal: s.abort?.signal,
			})
		);
	});
}

// --------------------------------------------------------------
// Staying valid
// --------------------------------------------------------------

function watch(s) {
	const { editor } = s;
	editor.subscribe({
		topic: WATCH_TOPICS,
		subscriberID: SESSION_WATCH_ID,
		callback: () => checkSession(s),
	});
	const onPageChange = (event) => {
		if (event?.detail?.appLevel) endSession(s, 'page');
		else checkSession(s);
	};
	if (typeof window !== 'undefined') window.addEventListener(PAGE_CHANGE_EVENT, onPageChange);
	s.unhook = () => {
		editor.unsubscribe({ idToRemove: SESSION_WATCH_ID });
		if (typeof window !== 'undefined') {
			window.removeEventListener(PAGE_CHANGE_EVENT, onPageChange);
		}
	};
}

/** Ends the session when it no longer applies; re-traces when the image or box moved. */
function checkSession(s) {
	if (live !== s) return;
	const reason = quickEndReason(s) || traceEndReason(s);
	if (reason) {
		endSession(s, reason);
		return;
	}
	let changed = false;
	// Undo swaps the glyph object for a copy: follow it (the preview matches by object)
	const item = s.editor.project.getItem(s.itemId);
	if (item && item !== s.item) {
		s.item = item;
		changed = true;
	}
	const placement = placementKey(s);
	if (placement !== s.placement) {
		s.placement = placement;
		if (!s.applying) {
			s.notice = null;
			// Image drags change the crop: wait until the hand stops before rereading it.
			queueTrace(s);
			changed = true;
		}
	}
	if (changed) emit(s);
}

/** Cheap checks (no item lookup): safe on every canvas redraw. */
function quickEndReason(s) {
	const { editor } = s;
	if (!editor?.project) return 'project';
	// Switched to the other open project (D-021): that editor has its own canvas and panel
	if (currentEditor(editor) !== editor) return 'project';
	if (editor.nav?.panel !== 'Trace') return 'panel';
	if (editor.nav?.page !== s.page) return 'page';
	if (editor.selectedItemID !== s.itemId) return 'item';
	return '';
}

/** The app's current editor; the session's own when there is no app (never throws). */
function currentEditor(fallback) {
	try {
		return getCurrentProjectEditor() || fallback;
	} catch {
		return fallback;
	}
}

function traceEndReason(s) {
	const item = s.editor.project.getItem(s.itemId);
	if (!item) return 'item';
	if (!getTrace(item)) return 'trace';
	return '';
}

/** What the traced pixels and their placement depend on, besides the options. */
function placementKey(s) {
	const trace = getTrace(s.editor.project?.getItem(s.itemId) || s.item);
	if (!trace) return '';
	const parts = [trace.asset, trace.width, trace.height, trace.x, trace.y, trace.scale];
	if (s.options?.insideBoxOnly) {
		const font = s.editor.project?.settings?.font || {};
		const item = s.editor.project?.getItem(s.itemId) || s.item;
		parts.push(item?.advanceWidth, font.ascent, font.descent);
	}
	return parts.join('|');
}

function endSession(s, reason) {
	if (live !== s) return;
	clearTimers(s);
	s.afterFlight = false;
	s.inFlight = 0;
	s.run++;
	// The kept preview pixels are this session's: let them go now, not in a minute
	try {
		clearAutoTraceCache();
	} catch (error) {
		console.warn('ANY-INK auto-trace: could not let the preview pixels go', error);
	}
	if (s.unhook) s.unhook();
	s.unhook = null;
	try {
		s.abort?.abort();
	} catch {
		// Nothing was waiting
	}
	s.status = 'idle';
	s.ended = reason;
	lastOptions = s.options;
	live = null;
	snapshot = null;
	notify(s.editor, null);
}

// --------------------------------------------------------------
// Telling everyone
// --------------------------------------------------------------

function emit(s) {
	if (live !== s) return;
	snapshot = Object.freeze({
		editor: s.editor,
		item: s.item,
		itemId: s.itemId,
		options: s.options,
		status: s.status,
		result: s.result,
		error: s.error,
		errorCode: s.errorCode,
		notice: s.notice,
		applying: s.applying,
	});
	notify(s.editor, snapshot);
}

function notify(editor, value) {
	for (const fn of [...listeners]) {
		try {
			fn(value);
		} catch (error) {
			console.warn('ANY-INK auto-trace: a session listener failed', error);
		}
	}
	try {
		if (typeof editor?.publish === 'function') editor.publish(AUTOTRACE_TOPIC, value);
	} catch (error) {
		console.warn("ANY-INK auto-trace: publishing 'autoTrace' failed", error);
	}
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function sameOptions(a, b) {
	const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
	for (const key of keys) if (a?.[key] !== b?.[key]) return false;
	return true;
}

/** The facade's error code, or null. */
function codeOf(error) {
	return typeof error?.code === 'string' && error.code ? error.code : null;
}

/** The plain words of an error (the card shows 'Auto-trace failed: <reason>'). */
function reasonOf(error) {
	const text = String(error?.message || error || '').trim();
	return text || 'something went wrong.';
}
