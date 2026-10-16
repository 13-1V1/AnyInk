// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK crash recovery (Milestone 6, D-012 / D-018 / D-026, RESEARCH 2.5).
	Replaces upstream's localStorage auto-saves with rolling snapshots in the
	idb-keyval 'recovery' store (storage/kv.js).

	Sessions. A session is one project loaded into one live editor in this tab
	(one ProjectEditor + its History instance + a project id). Loading anything
	into an editor (a file, a sample, a restore, the same file again) ends that
	editor's session and starts a new one; undo / redo keep it. Upstream's
	two-project mode has two live sessions at once, even for two copies of one
	font (same project id). Each session:
	  - writes its own record under 'session:<projectId>:<sessionId>' (snapshot.js)
	    and never touches another session's record
	  - holds a Web Lock named after that key (session_lock.sessionLockName) while
	    its editor holds the project in this tab; switching the current editor never
	    releases it, ending the session (project replaced, editor gone, stopRecovery)
	    does, and a dirty record left behind is then offered for recovery
	  - deletes its own record when it becomes clean (markClean after a save, or a
	    clean pagehide) instead of leaving a stub
	Records from older builds ('session:<projectId>', lock 'anyink-project-<id>')
	stay listable and restorable.

	Bounded: at most MAX_DEAD_SNAPSHOTS_PER_PROJECT dead records (dirty, lock free,
	not live in this tab) are kept per project id, newest first. Older ones are
	deleted when a session of that project writes its first snapshot and whenever
	the recoverable list is read. Without the Web Locks API nothing is pruned
	(another tab could own any record).

	Write triggers, all only while dirty:
	  - a trailing debounce SNAPSHOT_DELAY_MS after the last markDirty()
	  - a max-wait SNAPSHOT_MAX_WAIT_MS after the first unsnapshotted edit, so a
	    continuous editing streak (arrow-key nudging, drag after drag) never waits
	    longer than that
	  - the 'whichGlyphIsSelected' topic (glyph switch)
	  - document visibilitychange -> hidden
	  - beforeunload (also starts the work file's write: autosaveNow)
	  - pagehide
	The last three are the page's last moments (B16: closing Chrome right after a stroke lost
	it). Their write (writeSessionNow) is made inside the handler: the record and every copy it
	names that isn't stored yet go in ONE IndexedDB transaction (kv.js recSetMany), the record
	first, committed at once, never behind a write already running and with no turns given.
	beforeunload comes before Chrome's "Leave site?" box, so that write is in the database
	while the box is up. A queued write that finishes after it never puts its older record
	over it (session.newest).
	Writes are skipped while History.isRestoring (an undo / redo is mid-flight) and
	rescheduled. The record carries the serialized undo queue beside the project, so
	a restore adopts exactly the queue that describes the restored project.
	A failed write shows a toast at most once per FAILURE_TOAST_INTERVAL_MS and is
	kept in getRecoveryStatus().lastError.

	The Undo list's saved copies (B10 + B11 integration, D-042: D-026's revisit). Each step's
	saved copy of a letter or of the whole font, and the font as it was opened, is a record of
	its own ('state:<projectId>:<sessionId>:<n>', step_states.js), written the first time a
	write names it and deleted when the list no longer holds it. A write sends the font, the
	list's titles and only the new copies: on a 58-letter traced font with the list at its
	fullest the whole record was 39 MB and about 1.1 s in Chrome; now a write after a step is
	the font and one or two copies. Deleting a session's record deletes its copies; a copy whose
	session record is gone (a crash between the two writes) is swept when the list of backups
	is read, unless its session is live here or in another tab. Restore puts the copies back
	into the list before History adopts it; a copy that is missing restores the font without
	its Undo list.

	Toasts (B4) go through the one toast voice (src/anyink/toast/toast.js) by words key:
	deps.toast(key, vars, options), as toast() takes them. "Couldn't save a backup copy. Press
	Save to keep your work. [Save]" and "Opened the backup copy of <font> from <when>" say the
	house words in both modes (UX-BEGINNER 7.7, 2.4 G); "Open the Recover tab" is All tools
	only (key null), removed in Simple, where B13's start screen offers backup copies.

	Public API:
	  initRecovery()                 once after the app starts (main.js); safe in jsdom
	  markDirty(source)              History (source = the History), on every edit, undo
	                                 and redo; no source = the current editor
	  markClean(editor)              files track, after a successful save; deletes that
	                                 session's record -> Promise<Boolean>
	  getDirtyGeneration()           counts edits across editors for safe PWA updates
	  snapshotNow(reason, source)    write right now -> Promise<Boolean> (true when written)
	  stopRecovery()                 end every session (locks released), drop listeners
	  listRecoverableSessions()      dirty snapshots whose lock is not held and that are not
	                                 live in this tab, newest first; 'id' is the store key
	  restoreSession(id)             load a snapshot into the current editor as a new
	                                 session; the old record goes once the new session's
	                                 first snapshot is written. Rejects with a "gone" error
	                                 (isRecoveryGoneError) when the record is missing, clean
	                                 or live elsewhere.
	  discardSession(id)             delete one snapshot (not one that is live) -> Promise<Boolean>
	  forgetAllSnapshots()           delete every snapshot (Settings > App). Rejects when
	                                 the store cannot be cleared; live dirty sessions keep
	                                 their snapshot timers either way.
	  resyncRecovery()               re-read the editors (after a load outside navigate)
	  getRecoveryStatus()            read-only state for the test page
	  setRecoveryDeps(overrides)     test seam: getEditor / getEditors / locks /
	                                 importProject / toast / now / makeSessionId;
	                                 returns a function that restores the defaults
	Window event RECOVERY_CHANGE_EVENT ('anyink-recovery-change') fires after restore,
	discard, forget-all, and whenever a recoverable record appears or goes (a dirty
	session ends, a restored session supersedes its source), so every recover area
	on screen re-lists (recovery_ui.js).

	Imports from app/main.js, app/open_project.js and controls/dialogs are only
	called inside functions (history.js imports this module, so the graph is
	cyclic; every default is a lazy arrow). Nothing throws at import time.
*/

import { getCurrentProjectEditor, getGlyphrStudioApp } from '../../app/main.js';
import { autosaveNow, scheduleAutosave, cancelAutosave, stopAutosave } from '../files/autosave.js';
import { getSaveStatus, setSaveStatus, markSaveDirty } from '../files/save_status.js';
import { adoptFileVersion } from '../files/save_queue.js';
import { isProjectFileHandle } from '../files/write_file.js';
import { importProjectDataAndNavigate } from '../../app/open_project.js';
import { runFileCommand } from '../files/run_command.js';
import { toast } from '../toast/toast.js';
import { endOpenPiece } from '../sketch/tools/undo_gate.js';
import {
	recClear,
	recDel,
	recEntries,
	recGet,
	recKeys,
	recSet,
	recSetMany,
} from '../storage/kv.js';
import { acquireLock, heldLockNames, lockName, sessionLockName } from './session_lock.js';
import {
	describeSession,
	formatAgo,
	isSessionKey,
	makeSessionRecord,
	peekProject,
	sessionKey,
} from './snapshot.js';
import { inlineStates, isStateKey, makeStateBook, ownerOfState } from './step_states.js';

/** Trailing debounce after the last edit before a snapshot is written. */
export const SNAPSHOT_DELAY_MS = 3000;
/** Longest an edit waits for a snapshot while edits keep coming. */
export const SNAPSHOT_MAX_WAIT_MS = 3000;
/** B10 + B11 finalize: a backup write gives the page a turn after this long of work */
export const WRITE_SLICE_MS = 12;
/** A failed snapshot write toasts at most this often. */
export const FAILURE_TOAST_INTERVAL_MS = 60000;
/** Dead snapshots kept per project id (newest first); older ones are deleted. */
export const MAX_DEAD_SNAPSHOTS_PER_PROJECT = 3;
/** Window event: the set of recoverable snapshots may have changed. */
export const RECOVERY_CHANGE_EVENT = 'anyink-recovery-change';
/** Pub/sub id: never a substring of another anyink.* id (upstream matches substrings). */
export const SUBSCRIBER_ID = 'anyink.recovery.glyphSwitch';
const PAGE_CHANGE_EVENT = 'anyink-page-change';
const GONE_CODE = 'ANYINK_RECOVERY_GONE';

const defaults = {
	getEditor: () => getCurrentProjectEditor(),
	getEditors: () => getGlyphrStudioApp().projectEditors,
	locks: () => globalThis.navigator?.locks,
	importProject: (saveObject) => importProjectDataAndNavigate(saveObject),
	toast: (key, vars, options) => toast(key, vars, options),
	now: () => Date.now(),
	makeSessionId: () => newSessionId(),
	autosave: (editor) => autosaveNow(editor),
};
let deps = { ...defaults };

const state = {
	started: false,
	sessions: new Map(), // editor -> session (see startSession)
	writing: Promise.resolve(false),
	writes: 0,
	lastWrite: null, // { key, id, time, reason }
	lastError: null, // { message, time } of the last failed snapshot write
	lastFailureToast: -Infinity,
	restoring: false, // syncSessions() called from restoreSession: no orphan toast
	// Counts edits across the tab so PWA checkpoints can detect intervening edits.
	// File saves use each editor’s own revision instead.
	generation: 0,
};

/**
 * Test seam. Pass only the pieces to replace.
 * @param {Object} overrides - { getEditor, getEditors, locks, importProject, toast, now, makeSessionId }
 * @returns {Function} restores the defaults
 */
export function setRecoveryDeps(overrides = {}) {
	deps = { ...defaults, ...overrides };
	return () => {
		deps = { ...defaults };
	};
}

// --------------------------------------------------------------
// Lifecycle
// --------------------------------------------------------------

/** Boot hook: start watching the live editors. Safe to call in jsdom, idempotent. */
export function initRecovery() {
	if (state.started) return;
	state.started = true;
	requestPersistentStorage();
	if (typeof globalThis.addEventListener === 'function') {
		globalThis.addEventListener(PAGE_CHANGE_EVENT, onPageChange);
		globalThis.addEventListener('pagehide', onPageHide);
		globalThis.addEventListener('beforeunload', onBeforeUnload);
	}
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange);
	}
	syncSessions();
}

/** Shutdown hook: end every session (timers cleared, locks released), drop listeners. */
export function stopRecovery() {
	[...state.sessions.values()].forEach(endSession);
	if (typeof globalThis.removeEventListener === 'function') {
		globalThis.removeEventListener(PAGE_CHANGE_EVENT, onPageChange);
		globalThis.removeEventListener('pagehide', onPageHide);
		globalThis.removeEventListener('beforeunload', onBeforeUnload);
	}
	if (typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', onVisibilityChange);
	}
	state.started = false;
	state.writes = 0;
	state.lastWrite = null;
	state.lastError = null;
	state.lastFailureToast = -Infinity;
}

/** Re-reads the live editors (call after a load that did not navigate). */
export function resyncRecovery() {
	syncSessions();
}

/** @returns {Object} read-only copy of the module state (test page, debugging) */
export function getRecoveryStatus() {
	const current = state.sessions.get(safeGetEditor()) || null;
	return {
		started: state.started,
		generation: state.generation,
		dirty: !!current?.dirty,
		session: current ? viewOf(current) : null,
		lockName: current?.lockName || null,
		lockSupported: !!current?.lock?.supported,
		timerPending: !!current && hasTimer(current),
		sessions: [...state.sessions.values()].map(viewOf),
		writes: state.writes,
		lastWrite: state.lastWrite ? { ...state.lastWrite } : null,
		lastError: state.lastError ? { ...state.lastError } : null,
	};
}

// --------------------------------------------------------------
// Edit / save hooks
// --------------------------------------------------------------

/**
 * Increments on every markDirty(), whatever project is live. Read it before a save
 * serializes the project and again after the write; equal means no edit landed mid-save.
 * @returns {Number}
 */
export function getDirtyGeneration() {
	return state.generation;
}

/**
 * Edit hook: something changed since the last save (History calls it for every new
 * entry, every undo and every redo).
 * @param {Object} [source] - the History (or ProjectEditor) that changed; default: the
 *   current editor
 */
export function markDirty(source) {
	state.generation++;
	const changedEditor = source
		? liveEditors().find((editor) => editor === source || editor.history === source)
		: safeGetEditor();
	if (changedEditor) markSaveDirty(changedEditor);
	// B4 + B5 finalize (D-030: file autosave and recovery are independent): the work file's
	// write is queued whether or not crash recovery started (storage may be unavailable)
	if (!state.started) {
		if (isProjectFileHandle(changedEditor?.loadedFileHandle)) scheduleAutosave(changedEditor);
		return;
	}
	syncSessions();
	const session = findSession(source);
	if (!session) return;
	session.dirty = true;
	if (session.editor !== changedEditor) markSaveDirty(session.editor);
	scheduleTimers(session);
	scheduleAutosave(session.editor);
}

/**
 * Save hook (files track): the file on disk matches this editor's project, so its
 * session's record is deleted. Never touches another session's record.
 * @param {Object} [editor] - the editor that saved; default: the current editor
 * @returns {Promise<Boolean>} true when the record is gone
 */
export function markClean(editor) {
	if (!state.started) return Promise.resolve(false);
	syncSessions();
	const session = findSession(editor);
	if (!session) return Promise.resolve(false);
	session.dirty = false;
	cancelAutosave(session.editor);
	clearTimers(session);
	return enqueue(() => deleteOwnRecords(session));
}

/**
 * Writes a snapshot immediately. Automatic reasons only write while dirty;
 * 'manual' always writes (test page, debugging).
 * @param {String} reason - 'timer' | 'maxWait' | 'glyphSwitch' | 'hidden' | 'pagehide' | 'manual'
 * @param {Object} [source] - History or ProjectEditor; default: the current editor
 * @returns {Promise<Boolean>} true when a snapshot was written
 */
export function snapshotNow(reason = 'manual', source) {
	if (!state.started) return Promise.resolve(false);
	syncSessions();
	const session = findSession(source);
	if (!session) return Promise.resolve(false);
	return snapshotSession(session, reason);
}

// --------------------------------------------------------------
// Recovery list / restore / discard
// --------------------------------------------------------------

/**
 * Dirty snapshots that belong to no live session: their lock is not held by any tab
 * and they are not live in this tab. Newest first. Without the Web Locks API every
 * dirty snapshot not live in this tab counts as recoverable. Records past
 * MAX_DEAD_SNAPSHOTS_PER_PROJECT for one project are deleted here (with Web Locks).
 * @returns {Promise<Array<{id: String, projectId: String, name: String, time: Number,
 *   dirty: Boolean, hasFile: Boolean}>>} id is the store key
 */
export async function listRecoverableSessions() {
	const entries = await recEntries();
	const held = await heldLockNames(deps.locks());
	const { kept, extra } = splitRecoverable(entries, held, liveKeys());
	if (extra.length) await deleteRecords(extra);
	await sweepOrphanStates(entries, held);
	return kept.map(([key, record]) => describeSession(record, key));
}

/**
 * Loads a snapshot into the current editor as a new, unsaved session. The record it
 * came from is deleted only after that session's first snapshot is written, so a
 * crash right after a restore still leaves the work recoverable.
 * @param {String} id - store key from listRecoverableSessions (a bare project id is
 *   read as an older per-project key)
 * @returns {Promise<{id: String, projectId: String, name: String, time: Number, dirty: Boolean,
 *   hasFile: Boolean}>}
 */
export async function restoreSession(id) {
	const key = normalizeKey(id);
	const record = await recGet(key);
	if (!isRecoverableRecord(record) || liveKeys().has(key) || (await isLockHeld(record))) {
		notifyChange(); // any list still showing it is stale
		throw goneError(key);
	}
	// B10 + B11 integration (D-042): the steps' saved copies are records of their own; read
	// them before the font goes in, so the adopt below still runs right after it
	const history = await inlineStates(record.history, recGet);

	// S2 (docs/SKETCH.md 7): a sketch piece still open is finished as its own step first
	endOpenPiece();
	deps.importProject(record.project);
	const editor = safeGetEditor();
	// The queue recorded with this project describes exactly this project. Must run
	// synchronously after 'editor.project = x' (ProjectEditor made a fresh History).
	if (typeof editor?.history?.adoptSnapshot === 'function') editor.history.adoptSnapshot(history);
	if (typeof editor?.assets?.loadBlobMap === 'function') editor.assets.loadBlobMap(record.assets);
	if (editor) editor.loadedFileHandle = record.fileHandle || false;
	if (editor) {
		adoptFileVersion(editor, editor.loadedFileHandle, record.fileVersion ?? null);
		markSaveDirty(editor);
	}
	editor?.setProjectAsUnsaved?.();

	const session = startRestoredSession(editor, key, record);
	if (session) snapshotSession(session, 'restore');
	if (editor) scheduleAutosave(editor);

	if (typeof editor?.publish === 'function') {
		editor.publish('projectFile', {
			handle: editor.loadedFileHandle,
			saved: false,
			reason: 'recovered',
		});
	}
	deps.toast('toast.backupOpened', {
		name: record.name || 'Untitled',
		ago: formatAgo(record.time, deps.now()),
	});
	notifyChange();
	return describeSession(record, key);
}

/**
 * @param {Error} error
 * @returns {Boolean} true when restoreSession failed because the snapshot is no longer
 *   recoverable (deleted, saved, or live in another tab): re-list, do not show an error
 */
export function isRecoveryGoneError(error) {
	return error?.code === GONE_CODE;
}

/**
 * Deletes one snapshot. A snapshot that is live (this tab or another) is left alone.
 * @param {String} id - store key from listRecoverableSessions
 * @returns {Promise<Boolean>} true when deleted
 */
export async function discardSession(id) {
	const key = normalizeKey(id);
	const record = await recGet(key);
	if (record && (liveKeys().has(key) || (await isLockHeld(record)))) {
		notifyChange();
		return false;
	}
	await recDel(key);
	await deleteStatesOf([key]);
	notifyChange();
	return true;
}

/**
 * Deletes every snapshot in this browser. Live dirty projects are snapshotted
 * again after the usual delay so current work stays covered, also when the clear
 * fails (the promise then rejects with the storage error).
 * @returns {Promise<void>}
 */
export async function forgetAllSnapshots() {
	const sessions = [...state.sessions.values()];
	sessions.forEach(clearTimers);
	try {
		await state.writing;
		await recClear();
		sessions.forEach((session) => {
			session.states?.lostAll();
			session.recorded = false;
			session.supersedes = null;
			releaseSupersededLock(session);
		});
		notifyChange();
	} finally {
		sessions.forEach((session) => {
			if (session.dirty && !session.ended) scheduleTimers(session);
		});
	}
}

// --------------------------------------------------------------
// Sessions
// --------------------------------------------------------------

function safeGetEditor() {
	try {
		return deps.getEditor() || null;
	} catch {
		return null;
	}
}

/** @returns {Array} every live editor (the app's list plus the current one) */
function liveEditors() {
	const list = [];
	const add = (editor) => {
		if (editor && !list.includes(editor)) list.push(editor);
	};
	try {
		(deps.getEditors() || []).forEach(add);
	} catch {
		// no app yet: the current editor is enough
	}
	add(safeGetEditor());
	return list;
}

/**
 * Brings the session map in line with the live editors: an editor that is gone,
 * or whose project was replaced (new History or new project id), ends its session;
 * an editor holding a project without a session starts one. Nothing else changes,
 * so switching the current editor keeps every session and every lock.
 */
function syncSessions() {
	if (!state.started) return;
	const editors = liveEditors();
	[...state.sessions.entries()].forEach(([editor, session]) => {
		if (!editors.includes(editor)) endSession(session);
	});
	editors.forEach((editor) => {
		const meta = peekProject(editor)?.settings?.project;
		const existing = state.sessions.get(editor);
		if (existing && meta?.id === existing.projectId && editor.history === existing.history) {
			existing.name = meta.name || 'Untitled';
			return;
		}
		if (existing) endSession(existing);
		if (meta?.id) startSession(editor, meta);
	});
}

function startSession(editor, meta) {
	const sessionId = String(deps.makeSessionId());
	const key = sessionKey(meta.id, sessionId);
	const name = sessionLockName(key);
	const session = {
		editor,
		history: editor.history,
		projectId: meta.id,
		sessionId,
		key,
		lockName: name,
		name: meta.name || 'Untitled',
		lock: acquireLock(name, deps.locks()),
		dirty: false,
		trailingTimer: null,
		maxTimer: null,
		recorded: false, // this session's record exists in the store
		supersedes: null, // restored from this key; deleted after the first write
		supersededLock: null, // holds the source record's lock until then
		ended: false,
		captures: 0, // counts the records made for writes, oldest first
		newest: 0, // the newest capture handed to the store (a write's record never goes over it)
		// B10 + B11 integration (D-042): the Undo list's saved copies, a record each
		states: makeStateBook(key),
	};
	state.sessions.set(editor, session);
	subscribeEditor(editor);
	if (!state.restoring) warnAboutOrphans(session);
	return session;
}

/**
 * Ends a session: timers cleared, glyph-switch listener dropped, lock released. A
 * dirty record it leaves behind becomes recoverable once the lock is really gone.
 */
function endSession(session) {
	if (session.ended) return;
	session.ended = true;
	stopAutosave(session.editor);
	clearTimers(session);
	if (state.sessions.get(session.editor) === session) {
		state.sessions.delete(session.editor);
		unsubscribeEditor(session.editor);
	}
	session.lock.release();
	releaseSupersededLock(session);
	// B10 + B11 finalize: a clean session's copies (kept through its saves) are no one's now
	if (!session.dirty && !session.recorded) enqueue(() => deleteStatesOf([session.key]));
	if (session.dirty || session.recorded) {
		const pendingWrites = state.writing;
		Promise.all([session.lock.released, pendingWrites]).then(notifyChange, notifyChange);
	}
}

/** The session a markDirty / markClean / snapshotNow source points at. */
function findSession(source) {
	if (!source) return state.sessions.get(safeGetEditor()) || null;
	if (state.sessions.has(source)) return state.sessions.get(source);
	for (const session of state.sessions.values()) {
		if (session.history === source && session.editor.history === source) return session;
	}
	return null;
}

/** A restore made a new session for `editor`: it now stands in for the source record. */
function startRestoredSession(editor, sourceKey, record) {
	if (!state.started || !editor) return null;
	state.restoring = true;
	try {
		syncSessions();
	} finally {
		state.restoring = false;
	}
	const session = state.sessions.get(editor);
	if (!session) return null;
	session.dirty = true; // recovered work is unsaved until the user saves it
	session.supersedes = sourceKey;
	session.supersededLock = acquireLock(recordLockName(record), deps.locks());
	return session;
}

function releaseSupersededLock(session) {
	if (session.supersededLock) session.supersededLock.release();
	session.supersededLock = null;
}

/** @returns {Set<String>} store keys owned by this tab's live sessions */
function liveKeys() {
	const keys = new Set();
	state.sessions.forEach((session) => {
		keys.add(session.key);
		if (session.supersedes) keys.add(session.supersedes);
	});
	return keys;
}

function viewOf(session) {
	return {
		key: session.key,
		id: session.projectId,
		sessionId: session.sessionId,
		name: session.name,
		dirty: session.dirty,
		lockName: session.lockName,
		timerPending: hasTimer(session),
		recorded: session.recorded,
	};
}

/**
 * Tells the user once, when a project is opened, that an unsaved snapshot of the
 * same project from a dead session is waiting in the Recover tab.
 */
async function warnAboutOrphans(session) {
	let entries;
	let held;
	try {
		entries = await recEntries();
		held = await heldLockNames(deps.locks());
	} catch {
		return;
	}
	if (session.ended || session.supersedes || !state.started) return;
	const live = liveKeys();
	const orphan = entries.some(
		([key, record]) =>
			isSessionKey(key) &&
			isRecoverableRecord(record) &&
			record.id === session.projectId &&
			!live.has(key) &&
			!(held && held.has(recordLockName(record)))
	);
	if (orphan) {
		// All tools only: removed in Simple (UX-BEGINNER 2.4 G), whose start screen (B13)
		// offers backup copies
		deps.toast(
			null,
			{},
			{
				allTools: `Unsaved work from an earlier session exists for ${escapeHTML(
					session.name
				)}. Open the Recover tab to restore it.`,
			}
		);
	}
}

// --------------------------------------------------------------
// Editor listeners
// --------------------------------------------------------------

function subscribeEditor(editor) {
	if (typeof editor?.subscribe !== 'function') return;
	editor.subscribe({
		topic: 'whichGlyphIsSelected',
		subscriberID: SUBSCRIBER_ID,
		callback: () => {
			const session = state.sessions.get(editor);
			if (session?.dirty && editor.history === session.history) {
				snapshotSession(session, 'glyphSwitch');
				void autosaveNow(editor);
			}
		},
	});
}

function unsubscribeEditor(editor) {
	if (typeof editor?.unsubscribe === 'function') editor.unsubscribe({ idToRemove: SUBSCRIBER_ID });
}

function onPageChange() {
	syncSessions();
}

function onVisibilityChange() {
	if (document.visibilityState !== 'hidden') return;
	state.sessions.forEach((session) => {
		if (session.dirty) writeSessionNow(session, 'hidden');
	});
}

/**
 * B16: before Chrome's "Leave site?" box (or a close without one), the backup copy goes in now
 * and the work file's write starts, so both can finish while the box is up.
 */
function onBeforeUnload() {
	state.sessions.forEach((session) => {
		if (!session.dirty) return;
		writeSessionNow(session, 'beforeunload');
		const editor = session.editor;
		if (isProjectFileHandle(editor?.loadedFileHandle) && getSaveStatus(editor).file !== 'saved') {
			try {
				void Promise.resolve(deps.autosave(editor)).catch(() => undefined);
			} catch (error) {
				console.warn('ANY-INK recovery: could not start the work file write', error);
			}
		}
	});
}

function onPageHide() {
	state.sessions.forEach((session) => {
		if (session.dirty) writeSessionNow(session, 'pagehide');
		else {
			if (session.recorded || session.supersedes) enqueue(() => deleteOwnRecords(session));
			// B10 + B11 finalize: the copies a clean session kept through its saves (best effort;
			// the orphan sweep takes any left at the next start)
			enqueue(async () => {
				if (session.dirty) return;
				await deleteStatesOf([session.key]);
				session.states?.lostAll();
			});
		}
	});
}

// --------------------------------------------------------------
// Timers and writes
// --------------------------------------------------------------

/** Trailing debounce on every edit; the max-wait timer runs from the first unsnapshotted edit. */
function scheduleTimers(session) {
	if (session.trailingTimer !== null) globalThis.clearTimeout(session.trailingTimer);
	session.trailingTimer = globalThis.setTimeout(() => {
		session.trailingTimer = null;
		if (session.dirty) snapshotSession(session, 'timer');
	}, SNAPSHOT_DELAY_MS);
	armMaxWait(session);
}

function armMaxWait(session) {
	if (session.maxTimer !== null) return;
	session.maxTimer = globalThis.setTimeout(() => {
		session.maxTimer = null;
		if (session.dirty) snapshotSession(session, 'maxWait');
	}, SNAPSHOT_MAX_WAIT_MS);
}

function clearTimers(session) {
	if (session.trailingTimer !== null) globalThis.clearTimeout(session.trailingTimer);
	if (session.maxTimer !== null) globalThis.clearTimeout(session.maxTimer);
	session.trailingTimer = null;
	session.maxTimer = null;
}

function hasTimer(session) {
	return session.trailingTimer !== null || session.maxTimer !== null;
}

/**
 * A write captures every edit made before it runs, so pending timers are dropped;
 * the next markDirty() arms them again.
 */
function snapshotSession(session, reason) {
	clearTimers(session);
	return enqueue(() => writeSession(session, reason));
}

/** Serializes writes so a slow IndexedDB transaction never races a newer one. */
function enqueue(job) {
	const next = state.writing.then(job, job).catch((error) => {
		console.warn('ANY-INK recovery: snapshot job failed', error);
		return false;
	});
	state.writing = next;
	return next;
}

/**
 * @param {Object} session
 * @param {String} reason
 * @returns {Promise<Boolean>} true when written
 */
async function writeSession(session, reason) {
	if (session.ended) return false;
	if (reason !== 'manual' && !session.dirty) return false;
	const editor = session.editor;
	const revision = getSaveStatus(editor).revision;
	if (editor.history?.isRestoring) {
		if (session.dirty) scheduleTimers(session);
		return false;
	}
	if (editor.history !== session.history) return false; // replaced: syncSessions ends it
	const book = session.states;
	book.beginWrite();
	const capture = ++session.captures;
	const record = makeSessionRecord(editor, {
		dirty: reason === 'manual' ? session.dirty : true,
		time: deps.now(),
		key: session.key,
		sessionId: session.sessionId,
		lock: session.lockName,
		stateRef: book.refFor,
	});
	if (!record || record.id !== session.projectId) return false;
	try {
		// the copies the list names that aren't stored yet, then the record that names them.
		// B10 + B11 finalize: each copy is saved as it is written, and the page gets a turn
		// every WRITE_SLICE_MS, so a long list (after a restore) never freezes it
		let slice = deps.now();
		for (const [stateKey, value] of book.pending()) {
			await recSet(stateKey, value);
			book.written(stateKey);
			if (deps.now() - slice >= WRITE_SLICE_MS) {
				await new Promise((resolve) => setTimeout(resolve, 0));
				slice = deps.now();
			}
		}
		// B16: a last-moment write (writeSessionNow) made since this one began holds newer work
		if (session.newest > capture) return false;
		session.newest = capture;
		await recSet(session.key, record);
	} catch (error) {
		reportWriteFailure(error);
		if (!session.ended) setSaveStatus(editor, { recovery: 'failed' });
		if (session.dirty && !session.ended) armMaxWait(session); // try again later
		return false;
	}
	return afterWrite(session, record, reason, revision);
}

/**
 * B16: the page's last moments (beforeunload, hidden, pagehide). The record and every copy it
 * names that isn't stored yet go to the store inside this call, in one transaction with the
 * record first, never behind a queued write; the rest (status, old copies, pruning) is queued.
 * @param {Object} session
 * @param {String} reason - 'beforeunload' | 'hidden' | 'pagehide'
 * @returns {Promise<Boolean>} true when written
 */
function writeSessionNow(session, reason) {
	clearTimers(session);
	const editor = session.editor;
	if (session.ended || !session.dirty || editor.history !== session.history) {
		return Promise.resolve(false);
	}
	if (editor.history?.isRestoring) {
		scheduleTimers(session);
		return Promise.resolve(false);
	}
	const revision = getSaveStatus(editor).revision;
	const book = session.states;
	let pairs;
	let record;
	let capture;
	try {
		book.beginWrite();
		capture = ++session.captures;
		record = makeSessionRecord(editor, {
			dirty: true,
			time: deps.now(),
			key: session.key,
			sessionId: session.sessionId,
			lock: session.lockName,
			stateRef: book.refFor,
		});
		if (!record || record.id !== session.projectId) return Promise.resolve(false);
		pairs = [[session.key, record], ...book.pending()];
	} catch (error) {
		console.warn('ANY-INK recovery: could not make the last backup copy', error);
		return Promise.resolve(false);
	}
	session.newest = capture;
	// the copies count as stored from now on, so a queued write never sends them again; if this
	// write fails, every copy is written again at the next one (lostAll)
	pairs.slice(1).forEach(([key]) => book.written(key));
	let put;
	try {
		put = recSetMany(pairs);
	} catch (error) {
		put = Promise.reject(error);
	}
	const settled = put.then(
		() => true,
		(error) => {
			book.lostAll();
			reportWriteFailure(error);
			if (!session.ended) setSaveStatus(editor, { recovery: 'failed' });
			if (session.dirty && !session.ended) armMaxWait(session);
			return false;
		}
	);
	return enqueue(async () =>
		(await settled) ? afterWrite(session, record, reason, revision) : false
	);
}

/**
 * What follows a written record: the status, the copies the list no longer names, the restored
 * record it stood in for, the old records of its font.
 * @returns {Promise<Boolean>} true
 */
async function afterWrite(session, record, reason, revision) {
	const editor = session.editor;
	const book = session.states;
	state.writes++;
	if (
		!session.ended &&
		editor.history === session.history &&
		getSaveStatus(editor).revision === revision
	) {
		setSaveStatus(editor, { recovery: 'saved' });
	}
	state.lastWrite = {
		key: session.key,
		id: record.id,
		time: record.time,
		reason,
		states: book.size(),
	};
	await deleteUnnamedStates(session);
	const firstWrite = !session.recorded;
	session.recorded = true;
	if (session.supersedes) await deleteSupersededRecord(session);
	if (firstWrite) await pruneDeadRecords(session.projectId);
	return true;
}

/**
 * Keeps the dead records of one project to MAX_DEAD_SNAPSHOTS_PER_PROJECT (a new
 * session of it just wrote its first snapshot). Best effort.
 * @param {String} projectId
 */
async function pruneDeadRecords(projectId) {
	try {
		const entries = (await recEntries()).filter(([, record]) => record?.id === projectId);
		const held = await heldLockNames(deps.locks());
		const { extra } = splitRecoverable(entries, held, liveKeys());
		if (!extra.length) return;
		await deleteRecords(extra);
		notifyChange();
	} catch (error) {
		console.warn('ANY-INK recovery: could not prune old snapshots', error);
	}
}

/**
 * Recoverable records, newest first, split at MAX_DEAD_SNAPSHOTS_PER_PROJECT per
 * project id. Without the Web Locks API (held === null) nothing is past the cap: any
 * record could belong to another open tab.
 * @param {Array<[String, Object]>} entries - store entries
 * @param {Set<String> | null} held - lock names held anywhere, or null
 * @param {Set<String>} live - keys owned by this tab's live sessions
 * @returns {{kept: Array<[String, Object]>, extra: Array<[String, Object]>}}
 */
function splitRecoverable(entries, held, live) {
	const recoverable = entries.filter(
		([key, record]) =>
			isSessionKey(key) &&
			isRecoverableRecord(record) &&
			!live.has(key) &&
			!(held && held.has(recordLockName(record)))
	);
	recoverable.sort(([, a], [, b]) => (b.time || 0) - (a.time || 0));
	if (!held) return { kept: recoverable, extra: [] };
	const perProject = new Map();
	const kept = [];
	const extra = [];
	recoverable.forEach((pair) => {
		const count = perProject.get(pair[1].id) || 0;
		perProject.set(pair[1].id, count + 1);
		(count < MAX_DEAD_SNAPSHOTS_PER_PROJECT ? kept : extra).push(pair);
	});
	return { kept, extra };
}

/** Deletes records by key, one at a time; a failure is logged and skipped. */
async function deleteRecords(pairs) {
	for (const [key] of pairs) {
		try {
			await recDel(key);
		} catch (error) {
			console.warn(`ANY-INK recovery: could not delete the old snapshot ${key}`, error);
		}
	}
	await deleteStatesOf(pairs.map(([key]) => key));
}

/**
 * B10 + B11 integration (D-042): the saved copies a write no longer names (steps that left the
 * Undo list) go. Best effort: one that stays is deleted with its session.
 * @param {Object} session
 */
async function deleteUnnamedStates(session) {
	for (const key of session.states.unnamed()) {
		try {
			await recDel(key);
			session.states.forget(key);
		} catch (error) {
			console.warn('ANY-INK recovery: could not delete an old backup step', error);
			return;
		}
	}
}

/**
 * Deletes every saved copy of these sessions (their records are gone or going). Best effort.
 * @param {Array<String>} sessionKeys
 */
async function deleteStatesOf(sessionKeys) {
	const owners = new Set(sessionKeys.filter(Boolean));
	if (!owners.size) return;
	let keys = [];
	try {
		keys = await recKeys();
	} catch (error) {
		console.warn('ANY-INK recovery: could not list the backup steps', error);
		return;
	}
	for (const key of keys || []) {
		if (!owners.has(ownerOfState(key))) continue;
		try {
			await recDel(key);
		} catch (error) {
			console.warn(`ANY-INK recovery: could not delete the backup step ${key}`, error);
		}
	}
}

/**
 * Saved copies whose session record is gone (a crash between writing the copies and the record)
 * go, unless that session is live in this tab or holds its lock in another. Without the Web
 * Locks API nothing is swept (another tab could be writing its first record).
 * @param {Array<[String, Object]>} entries - the whole store
 * @param {Set<String> | null} held
 */
async function sweepOrphanStates(entries, held) {
	if (!held) return;
	const sessions = new Set(entries.map(([key]) => key).filter(isSessionKey));
	const live = liveKeys();
	const orphans = entries
		.map(([key]) => key)
		.filter((key) => isStateKey(key))
		.filter((key) => {
			const owner = ownerOfState(key);
			return !sessions.has(owner) && !live.has(owner) && !held.has(sessionLockName(owner));
		});
	for (const key of orphans) {
		try {
			await recDel(key);
		} catch (error) {
			console.warn(`ANY-INK recovery: could not delete the backup step ${key}`, error);
		}
	}
}

/** After a restored session's first write, the record it came from can go. */
async function deleteSupersededRecord(session) {
	const oldKey = session.supersedes;
	try {
		await recDel(oldKey);
	} catch (error) {
		console.warn('ANY-INK recovery: could not delete the restored snapshot', error);
		return;
	}
	await deleteStatesOf([oldKey]);
	if (session.supersedes === oldKey) session.supersedes = null;
	releaseSupersededLock(session);
	notifyChange();
}

/** A clean session's own record (and a restored source it still stands in for) go. */
async function deleteOwnRecords(session) {
	const keys = [session.key, session.supersedes].filter(Boolean);
	try {
		for (const key of keys) await recDel(key);
	} catch (error) {
		console.warn('ANY-INK recovery: could not delete a clean snapshot', error);
		return false;
	}
	// B10 + B11 integration (D-042): the restored source's saved copies go with it. B10 + B11
	// finalize (the critic: the write after every Save re-sent the whole list, 0.85 s with a
	// 0.4 s freeze): this live session keeps its own, so the next write sends only what is new.
	// With no session record they are no backup on their own (nothing names them); the orphan
	// sweep takes them once this session is gone (its lock let go: sweepOrphanStates)
	if (session.supersedes) await deleteStatesOf([session.supersedes]);
	const hadRecords = session.recorded || !!session.supersedes;
	session.recorded = false;
	session.supersedes = null;
	releaseSupersededLock(session);
	if (hadRecords) notifyChange();
	return true;
}

function reportWriteFailure(error) {
	const message = error?.message || error?.name || String(error);
	const time = deps.now();
	state.lastError = { message, time };
	console.warn('ANY-INK recovery: snapshot failed', error);
	if (time - state.lastFailureToast < FAILURE_TOAST_INTERVAL_MS) return;
	state.lastFailureToast = time;
	// UX-BEGINNER 7.7 "Backup write failed", in both modes; the reason stays in lastError.
	// B4 + B5 finalize: [Save] belongs to the font open now; once another one opens, it goes
	const editor = deps.getEditor();
	const project = editor?.project;
	deps.toast(
		'toast.backupFailed',
		{},
		{
			tone: 'warning',
			action: { key: 'term.save', run: () => saveFromToast(editor) },
			stillGood: () => deps.getEditor() === editor && editor?.project === project,
		}
	);
}

/**
 * The backup toast's [Save]: that font's Save (Ctrl+S), inside the click.
 * @param {Object} [editor] - the editor open when the toast was raised
 */
function saveFromToast(editor = deps.getEditor()) {
	if (typeof editor?.saveProjectFile === 'function') runFileCommand(() => editor.saveProjectFile());
}

// --------------------------------------------------------------
// Records
// --------------------------------------------------------------

function isRecoverableRecord(record) {
	return !!record && record.dirty === true && !!record.project;
}

/** Records from older builds carry no lock name: they held one per project id. */
function recordLockName(record) {
	return record.lock || lockName(record.id);
}

async function isLockHeld(record) {
	const held = await heldLockNames(deps.locks());
	return !!held && held.has(recordLockName(record));
}

function normalizeKey(id) {
	return isSessionKey(id) ? id : sessionKey(id);
}

function goneError(key) {
	const error = new Error(`Nothing to recover for ${key}`);
	error.code = GONE_CODE;
	return error;
}

function notifyChange() {
	if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
	globalThis.dispatchEvent(new CustomEvent(RECOVERY_CHANGE_EVENT));
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function newSessionId() {
	try {
		const uuid = globalThis.crypto?.randomUUID?.();
		if (uuid) return uuid;
	} catch {
		// insecure context: fall through
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function requestPersistentStorage() {
	try {
		const result = globalThis.navigator?.storage?.persist?.();
		if (result && typeof result.catch === 'function') result.catch(() => undefined);
	} catch {
		// not available (jsdom, insecure context): snapshots are still best-effort
	}
}

function escapeHTML(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
