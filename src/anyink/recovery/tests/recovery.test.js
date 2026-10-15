// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publish, subscribe, unsubscribe } from '../../../project_editor/pub_sub.js';
import { AssetStore } from '../../assets/asset_store.js';
import {
	recClear,
	recEntries,
	recGet,
	recKeys,
	recSet,
	setStorageDriver,
} from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import {
	FAILURE_TOAST_INTERVAL_MS,
	MAX_DEAD_SNAPSHOTS_PER_PROJECT,
	RECOVERY_CHANGE_EVENT,
	SNAPSHOT_DELAY_MS,
	SNAPSHOT_MAX_WAIT_MS,
	SUBSCRIBER_ID,
	discardSession,
	forgetAllSnapshots,
	getDirtyGeneration,
	getRecoveryStatus,
	initRecovery,
	isRecoveryGoneError,
	listRecoverableSessions,
	markClean,
	markDirty,
	restoreSession,
	setRecoveryDeps,
	snapshotNow,
	stopRecovery,
} from '../recovery.js';
import { fakeLocks } from './fake_locks.js';

// jsdom: no indexedDB (kv.js runs in memory), no navigator.locks, no navigator.storage.

function fakeProject(id, name = 'Test Font', advanceWidth = 600) {
	const glyphs = { 'glyph-0x41': { advanceWidth } };
	return {
		settings: { project: { id, name } },
		glyphs,
		save() {
			return { settings: { project: { id, name } }, glyphs: structuredClone(glyphs) };
		},
	};
}

/** Stand-in for History: serializeForStorage mirrors the live width so tests can match them. */
function fakeHistory(editorRef) {
	return {
		isRestoring: false,
		serializeForStorage: vi.fn(() => ({
			version: 3,
			queue: [{ title: `A width ${editorRef.project?.glyphs?.['glyph-0x41']?.advanceWidth}` }],
			redoQueue: [],
		})),
		adoptSnapshot: vi.fn(() => true),
	};
}

/** The smallest editor upstream's pub/sub and the recovery module can run against. */
function fakeEditor(project = fakeProject('p1')) {
	const editor = {
		subscribers: {},
		project,
		assets: new AssetStore(),
		loadedFileHandle: false,
		setProjectAsUnsaved: vi.fn(),
		selectedItem: undefined,
		multiSelect: {
			shapes: { clear() {}, length: 0, singleton: false },
			points: { clear() {}, singleton: false },
		},
	};
	editor.history = fakeHistory(editor);
	editor.publish = publish;
	editor.subscribe = subscribe;
	editor.unsubscribe = unsubscribe;
	return editor;
}

/** What `editor.project = x` does to a real ProjectEditor: new project, new History. */
function loadInto(editor, project) {
	editor.project = project;
	editor.history = fakeHistory(editor);
}

async function flush(times = 30) {
	for (let i = 0; i < times; i++) await Promise.resolve();
}

async function recordFor(projectId) {
	return (await recEntries()).filter(([, record]) => record?.id === projectId);
}

let editor;
let editors;
let current;
let locks;
let toast;
let restoreDeps;
let now;
let idCounter;

function useDeps(overrides = {}) {
	restoreDeps = setRecoveryDeps({
		getEditor: () => current,
		getEditors: () => editors,
		locks: () => locks,
		toast,
		now: () => now,
		importProject: vi.fn(),
		makeSessionId: () => `s${++idCounter}`,
		...overrides,
	});
}

beforeEach(async () => {
	vi.useFakeTimers();
	await recClear();
	editor = fakeEditor();
	editors = [editor];
	current = editor;
	locks = fakeLocks();
	toast = vi.fn();
	now = 1_000_000;
	idCounter = 0;
	useDeps();
});

afterEach(() => {
	stopRecovery();
	restoreDeps();
	vi.useRealTimers();
});

describe('markDirty and the snapshot timers', () => {
	it('writes within 3 s of the first edit, with project, assets and undo history', async () => {
		const blob = new Blob(['img'], { type: 'image/png' });
		editor.assets.add(blob, { id: 'img-a' });
		editor.loadedFileHandle = { kind: 'file', name: 'font.gs2' };
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(1000);
		markDirty(editor.history); // resets the trailing timer
		await vi.advanceTimersByTimeAsync(SNAPSHOT_MAX_WAIT_MS - 1100);
		expect(await recKeys()).toEqual([]);

		await vi.advanceTimersByTimeAsync(100);
		const record = await recGet('session:p1:s1');
		expect(record).toMatchObject({
			id: 'p1',
			key: 'session:p1:s1',
			sessionId: 's1',
			lock: 'anyink-session:p1:s1',
			name: 'Test Font',
			time: now,
			dirty: true,
			hasFile: true,
			fileHandle: editor.loadedFileHandle,
		});
		expect(record.project.glyphs['glyph-0x41'].advanceWidth).toBe(600);
		expect(record.assets['img-a']).toEqual({ type: 'image/png', blob });
		// the undo queue travels in the same record as the project it describes
		expect(record.history).toEqual({
			version: 3,
			queue: [{ title: 'A width 600' }],
			redoQueue: [],
		});
		expect(getRecoveryStatus().writes).toBe(1);
		expect(getRecoveryStatus().lastWrite.reason).toBe('maxWait');
	});

	it('does nothing before a project is loaded', async () => {
		editor.project = null;
		initRecovery();
		markDirty();
		expect(getRecoveryStatus().session).toBeNull();
		expect(getRecoveryStatus().timerPending).toBe(false);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(await recKeys()).toEqual([]);
	});

	it('only counts the generation before initRecovery', async () => {
		const before = getDirtyGeneration();
		markDirty();
		expect(getDirtyGeneration()).toBe(before + 1);
		expect(getRecoveryStatus().sessions).toEqual([]);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_MAX_WAIT_MS);
		expect(await recKeys()).toEqual([]);
	});

	// Finding 3: the trailing debounce never fired while edits kept coming.
	it('snapshots every edit within 3 s during continuous editing (max-wait)', async () => {
		expect(SNAPSHOT_MAX_WAIT_MS).toBe(3000);
		useDeps({ now: () => Date.now() }); // fake timers move Date too
		const start = Date.now();
		initRecovery();
		const edits = [];
		const writes = [];
		for (let t = 0; t < 60000; t += 2000) {
			editor.project.glyphs['glyph-0x41'].advanceWidth = 600 + t / 1000;
			markDirty(editor.history);
			edits.push(Date.now() - start);
			const before = getRecoveryStatus().writes;
			await vi.advanceTimersByTimeAsync(2000);
			if (getRecoveryStatus().writes > before)
				writes.push(getRecoveryStatus().lastWrite.time - start);
		}
		expect(writes.length).toBeGreaterThanOrEqual(3);
		expect(writes[0]).toBeLessThanOrEqual(SNAPSHOT_MAX_WAIT_MS);
		expect(getRecoveryStatus().lastWrite.reason).toBe('maxWait');
		for (const edit of edits.filter((time) => time < writes.at(-1))) {
			const next = writes.find((time) => time >= edit);
			expect(next - edit).toBeLessThanOrEqual(SNAPSHOT_MAX_WAIT_MS);
		}
		// the streak ends: the trailing debounce writes the last state
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(['timer', 'maxWait']).toContain(getRecoveryStatus().lastWrite.reason);
		const [[, record]] = await recordFor('p1');
		expect(record.project.glyphs['glyph-0x41'].advanceWidth).toBe(658);
	});
});

describe('markClean', () => {
	it('deletes the session record (no clean stubs) and cancels the pending timer', async () => {
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect((await recGet('session:p1:s1')).dirty).toBe(true);

		markDirty(editor.history);
		expect(getRecoveryStatus().timerPending).toBe(true);
		expect(await markClean(editor)).toBe(true);
		expect(getRecoveryStatus().timerPending).toBe(false);
		expect(getRecoveryStatus().dirty).toBe(false);
		expect(await recKeys()).toEqual([]);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_MAX_WAIT_MS);
		expect(await recKeys()).toEqual([]);
		expect(getRecoveryStatus().writes).toBe(1);
	});

	it('a clean pagehide deletes a leftover record of its own session', async () => {
		initRecovery();
		await snapshotNow('manual');
		expect(await recKeys()).toEqual(['session:p1:s1']);
		window.dispatchEvent(new Event('pagehide'));
		await flush();
		expect(await recKeys()).toEqual([]);
	});

	// Finding 2: opening the saved file of a project with an unlocked dirty snapshot, then a
	// habitual Ctrl+S (or one edit), used to overwrite that snapshot.
	it("never writes to, overwrites or deletes an earlier session's snapshot of the same project", async () => {
		const orphan = {
			id: 'p1',
			name: 'Test Font',
			time: now - 60000,
			dirty: true,
			hasFile: true,
			project: fakeProject('p1', 'Test Font', 999).save(),
		};
		await recSet('session:p1', orphan);
		initRecovery();
		await flush();
		expect(toast).toHaveBeenCalledTimes(1);
		// B4: All tools only (key null), removed in Simple (UX-BEGINNER 2.4 G)
		expect(toast).toHaveBeenCalledWith(
			null,
			{},
			{
				allTools:
					'Unsaved work from an earlier session exists for Test Font. Open the Recover tab to restore it.',
			}
		);

		await markClean(editor); // Ctrl+S with zero edits
		expect(await recGet('session:p1')).toEqual(orphan);

		editor.project.glyphs['glyph-0x41'].advanceWidth = 610;
		markDirty(editor.history); // one edit, then the timer
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(await recGet('session:p1')).toEqual(orphan);
		expect((await recGet('session:p1:s1')).project.glyphs['glyph-0x41'].advanceWidth).toBe(610);

		await markClean(editor);
		stopRecovery();
		await flush();
		const listed = await listRecoverableSessions();
		expect(listed.map((session) => session.id)).toEqual(['session:p1']);
		expect(toast).toHaveBeenCalledTimes(1);
	});
});

describe('two live copies of one project (same project id)', () => {
	// Finding 1, one tab: upstream's two-project mode with v1 and v2 of the same font.
	it('keeps one snapshot per editor; saving one editor never wipes the other', async () => {
		const editorA = editor;
		const editorB = fakeEditor(fakeProject('p1', 'Test Font v2', 800));
		editors = [editorA, editorB];
		initRecovery();

		editorA.project.glyphs['glyph-0x41'].advanceWidth = 700;
		markDirty(editorA.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);

		current = editorB;
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		markDirty(editorB.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect((await recordFor('p1')).length).toBe(2);

		await markClean(editorB); // Ctrl+S in B
		const left = await recordFor('p1');
		expect(left).toHaveLength(1);
		expect(left[0][1].dirty).toBe(true);
		expect(left[0][1].project.glyphs['glyph-0x41'].advanceWidth).toBe(700);
		expect(left[0][1].history.queue[0].title).toBe('A width 700');

		stopRecovery(); // the tab crashes
		await flush();
		const listed = await listRecoverableSessions();
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({ projectId: 'p1', dirty: true });
	});

	// Finding 1, two tabs: tab one holds its session lock; this tab opens the same id.
	it("lists another tab's snapshot once that tab dies, even while this tab has the same project open", async () => {
		const otherKey = 'session:p1:tabOne';
		const otherLock = 'anyink-session:p1:tabOne';
		const tabOneCrashes = locks.hold(otherLock);
		await recSet(otherKey, {
			id: 'p1',
			key: otherKey,
			lock: otherLock,
			name: 'Test Font',
			time: now - 1000,
			dirty: true,
			project: fakeProject('p1', 'Test Font', 777).save(),
		});
		initRecovery();
		await flush();
		expect(toast).not.toHaveBeenCalled(); // tab one is alive: not an orphan
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		await markClean(editor); // this tab saves

		expect((await recGet(otherKey)).project.glyphs['glyph-0x41'].advanceWidth).toBe(777);
		expect(await listRecoverableSessions()).toEqual([]);

		tabOneCrashes();
		await flush();
		const listed = await listRecoverableSessions();
		expect(listed.map((session) => session.id)).toEqual([otherKey]);
	});
});

describe('other write triggers', () => {
	it('snapshots on a glyph switch only while dirty', async () => {
		initRecovery();
		editor.publish('whichGlyphIsSelected', 'glyph-0x42');
		await flush();
		expect(await recKeys()).toEqual([]);

		markDirty(editor.history);
		editor.publish('whichGlyphIsSelected', 'glyph-0x43');
		await flush();
		expect((await recGet('session:p1:s1')).dirty).toBe(true);
		expect(getRecoveryStatus().lastWrite.reason).toBe('glyphSwitch');
		expect(Object.keys(editor.subscribers.whichGlyphIsSelected)).toEqual([SUBSCRIBER_ID]);
	});

	it('snapshots when the tab is hidden and on pagehide while dirty', async () => {
		initRecovery();
		markDirty(editor.history);
		Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
		await flush();
		expect(getRecoveryStatus().lastWrite.reason).toBe('hidden');
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

		window.dispatchEvent(new Event('pagehide'));
		await flush();
		expect(getRecoveryStatus().lastWrite.reason).toBe('pagehide');
		expect(getRecoveryStatus().writes).toBe(2);
	});

	it('skips writes while History.isRestoring and retries on the next tick', async () => {
		initRecovery();
		markDirty(editor.history);
		editor.history.isRestoring = true;
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(await recKeys()).toEqual([]);
		expect(getRecoveryStatus().timerPending).toBe(true);

		editor.history.isRestoring = false;
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect((await recGet('session:p1:s1')).dirty).toBe(true);
	});

	it('manual snapshots write even when clean and keep dirty:false', async () => {
		initRecovery();
		expect(await snapshotNow('manual')).toBe(true);
		const record = await recGet('session:p1:s1');
		expect(record.dirty).toBe(false);
		expect(record.project).toBeDefined();
		expect(await snapshotNow('timer')).toBe(false);
	});
});

// Finding 4 (recovery side): a failed write used to vanish into console.warn.
describe('snapshot write failures', () => {
	let driver;
	let restoreDriver;
	let warn;
	beforeEach(() => {
		driver = fakeDriver();
		restoreDriver = setStorageDriver(driver);
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => {
		restoreDriver();
		warn.mockRestore();
	});

	it('toasts at most once a minute and exposes lastError', async () => {
		driver.failWhen((op) => op === 'set');
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(toast).toHaveBeenCalledTimes(1);
		// B4: UX-BEGINNER 7.7's words and [Save] button; the reason stays in lastError
		expect(toast).toHaveBeenCalledWith(
			'toast.backupFailed',
			{},
			{
				tone: 'warning',
				action: { key: 'term.save', run: expect.any(Function) },
				// B4 + B5 finalize: [Save] belongs to the font open when it failed
				stillGood: expect.any(Function),
			}
		);
		expect(getRecoveryStatus().lastError).toMatchObject({
			message: 'the quota has been exceeded',
			time: now,
		});
		expect(getRecoveryStatus().writes).toBe(0);

		now += 30000;
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(toast).toHaveBeenCalledTimes(1);

		now += FAILURE_TOAST_INTERVAL_MS;
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(toast).toHaveBeenCalledTimes(2);

		driver.failWhen(() => false);
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(getRecoveryStatus().writes).toBe(1);
		expect(driver.data.get('recovery').has('session:p1:s1')).toBe(true);
	});

	it('a failed Forget rejects, and a dirty live project keeps its snapshot timer', async () => {
		initRecovery();
		markDirty(editor.history);
		expect(getRecoveryStatus().timerPending).toBe(true);
		driver.failWhen((op) => op === 'clear');
		await expect(forgetAllSnapshots()).rejects.toThrow(/quota/);
		expect(getRecoveryStatus().dirty).toBe(true);
		expect(getRecoveryStatus().timerPending).toBe(true);
		driver.failWhen(() => false);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(driver.data.get('recovery').has('session:p1:s1')).toBe(true);
	});
});

// Verification of finding 1's fix: per-session records must stay bounded (D-026).
describe('dead snapshots of one font are capped', () => {
	const deadRecord = (id, time, lock) => ({
		id,
		name: id,
		time,
		dirty: true,
		lock,
		project: fakeProject(id).save(),
	});

	it(`keeps the newest ${MAX_DEAD_SNAPSHOTS_PER_PROJECT} per font when sessions keep ending dirty`, async () => {
		initRecovery();
		for (let i = 1; i <= 5; i++) {
			editor.project.glyphs['glyph-0x41'].advanceWidth = 600 + i;
			markDirty(editor.history);
			now += 1000;
			await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
			loadInto(editor, fakeProject('p1')); // reopen the same file ("revert")
			window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
			await flush();
		}
		const listed = await listRecoverableSessions();
		expect(listed.map((session) => session.id)).toEqual([
			'session:p1:s5',
			'session:p1:s4',
			'session:p1:s3',
		]);
		expect((await recordFor('p1')).map(([key]) => key).sort()).toEqual([
			'session:p1:s3',
			'session:p1:s4',
			'session:p1:s5',
		]);
	});

	it('never counts or deletes a live record or another font', async () => {
		for (let t = 1; t <= 4; t++)
			await recSet(`session:p7:t${t}`, deadRecord('p7', t, `anyink-session:p7:t${t}`));
		await recSet('session:p7:live', deadRecord('p7', 9, 'anyink-session:p7:live'));
		await recSet('session:p8:x', deadRecord('p8', 1, 'anyink-session:p8:x'));
		locks.hold('anyink-session:p7:live'); // another tab is editing it
		const ids = (await listRecoverableSessions()).map((session) => session.id);
		expect(ids).toEqual(['session:p7:t4', 'session:p7:t3', 'session:p7:t2', 'session:p8:x']);
		expect((await recKeys()).sort()).toEqual([
			'session:p7:live',
			'session:p7:t2',
			'session:p7:t3',
			'session:p7:t4',
			'session:p8:x',
		]);
	});

	it('deletes nothing without the Web Locks API (another tab could own any record)', async () => {
		useDeps({ locks: () => undefined });
		for (let t = 1; t <= 5; t++)
			await recSet(`session:p7:t${t}`, deadRecord('p7', t, `anyink-session:p7:t${t}`));
		expect(await listRecoverableSessions()).toHaveLength(5);
		expect(await recKeys()).toHaveLength(5);
	});
});

describe('Web Lock per live editor', () => {
	it('takes an exclusive lock named after the session key', async () => {
		initRecovery();
		expect(locks.requests).toEqual([{ name: 'anyink-session:p1:s1', mode: 'exclusive' }]);
		expect(locks.held.has('anyink-session:p1:s1')).toBe(true);
		expect(getRecoveryStatus().lockName).toBe('anyink-session:p1:s1');
	});

	// Finding 6: switching the current editor released the other editor's lock.
	it('switching the current editor in two-project mode keeps both locks', async () => {
		const editorB = fakeEditor(fakeProject('p2', 'Second'));
		editors = [editor, editorB];
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);

		current = editorB;
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		await flush();
		expect(locks.held.has('anyink-session:p1:s1')).toBe(true);
		expect(locks.held.has('anyink-session:p2:s2')).toBe(true);
		expect(getRecoveryStatus().session).toMatchObject({ id: 'p2', name: 'Second' });
		expect(await listRecoverableSessions()).toEqual([]);
	});

	it("replacing an editor's project ends that session: its lock goes, a new session starts clean", async () => {
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		markDirty(editor.history);
		loadInto(editor, fakeProject('p2', 'Second'));
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		await flush();
		expect(locks.held.has('anyink-session:p1:s1')).toBe(false);
		expect(locks.held.has('anyink-session:p2:s2')).toBe(true);
		expect(getRecoveryStatus().session).toMatchObject({
			key: 'session:p2:s2',
			id: 'p2',
			dirty: false,
		});
		expect(getRecoveryStatus().timerPending).toBe(false);
		// the dropped project's unsaved work is now recoverable
		expect((await listRecoverableSessions()).map((session) => session.id)).toEqual([
			'session:p1:s1',
		]);
	});

	it('reopening the same project id in the same editor starts a new session', async () => {
		initRecovery();
		loadInto(editor, fakeProject('p1', 'Test Font v2'));
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		await flush();
		expect(getRecoveryStatus().session.key).toBe('session:p1:s2');
		expect(locks.held.has('anyink-session:p1:s1')).toBe(false);
	});

	it('drops the session of an editor that is gone, and releases every lock on stopRecovery', async () => {
		const editorB = fakeEditor(fakeProject('p2', 'Second'));
		editors = [editor, editorB];
		initRecovery();
		expect(locks.held.size).toBe(2);
		editors = [editor];
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		await flush();
		expect([...locks.held.keys()]).toEqual(['anyink-session:p1:s1']);
		stopRecovery();
		await flush();
		expect(locks.held.size).toBe(0);
		expect(getRecoveryStatus().started).toBe(false);
	});
});

describe('listRecoverableSessions', () => {
	async function seed() {
		await recSet('session:held', {
			id: 'held',
			name: 'Open elsewhere',
			time: 3,
			dirty: true,
			project: {},
		});
		await recSet('session:crashed', {
			id: 'crashed',
			name: 'Crashed',
			time: 2,
			dirty: true,
			hasFile: true,
			project: {},
		});
		await recSet('session:older', {
			id: 'older',
			name: 'Older',
			time: 1,
			dirty: true,
			project: {},
		});
		await recSet('session:clean', { id: 'clean', name: 'Saved', time: 9, dirty: false });
		await recSet('handle:stray', { kind: 'file' });
	}

	it('excludes sessions whose lock is held and clean or foreign records, newest first', async () => {
		await seed();
		locks.hold('anyink-project-held'); // an older build's tab
		const sessions = await listRecoverableSessions();
		expect(sessions).toEqual([
			{
				id: 'session:crashed',
				projectId: 'crashed',
				name: 'Crashed',
				time: 2,
				dirty: true,
				hasFile: true,
			},
			{
				id: 'session:older',
				projectId: 'older',
				name: 'Older',
				time: 1,
				dirty: true,
				hasFile: false,
			},
		]);
	});

	it('uses the lock name stored in a record', async () => {
		await recSet('session:p9:x', {
			id: 'p9',
			lock: 'anyink-session:p9:x',
			time: 1,
			dirty: true,
			project: {},
		});
		const release = locks.hold('anyink-session:p9:x');
		expect(await listRecoverableSessions()).toEqual([]);
		release();
		await flush();
		expect((await listRecoverableSessions()).map((session) => session.id)).toEqual([
			'session:p9:x',
		]);
	});

	it('treats every dirty snapshot as recoverable without a locks API', async () => {
		await seed();
		useDeps({ locks: () => undefined });
		const ids = (await listRecoverableSessions()).map((session) => session.id);
		expect(ids).toEqual(['session:held', 'session:crashed', 'session:older']);
	});

	it("hides this tab's own live sessions, even without a locks API", async () => {
		useDeps({ locks: () => undefined });
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(await listRecoverableSessions()).toEqual([]);
		stopRecovery();
		await flush();
		expect((await listRecoverableSessions()).map((session) => session.id)).toEqual([
			'session:p1:s1',
		]);
	});
});

describe('restoreSession', () => {
	async function seedCrashed() {
		const blob = new Blob(['img'], { type: 'image/png' });
		const handle = { kind: 'file', name: 'font.gs2' };
		const save = fakeProject('crashed', 'Crashed Font').save();
		const history = { version: 3, queue: [{ title: 'from the crashed tab' }], redoQueue: [] };
		const record = {
			id: 'crashed',
			key: 'session:crashed:old',
			lock: 'anyink-session:crashed:old',
			name: 'Crashed Font',
			time: now - 7 * 60000,
			dirty: true,
			hasFile: true,
			fileHandle: handle,
			project: save,
			assets: { 'img-a': { type: 'image/png', blob } },
			history,
		};
		await recSet('session:crashed:old', record);
		return { blob, handle, save, history, record };
	}

	function restoreTarget() {
		const target = fakeEditor(fakeProject('scratch'));
		const importProject = vi.fn((data) => {
			loadInto(target, fakeProject(data.settings.project.id, data.settings.project.name));
		});
		editors = [target];
		current = target;
		useDeps({ importProject });
		return { target, importProject };
	}

	it('imports the project, adopts the recorded undo history, loads assets, restores the handle', async () => {
		const { blob, handle, save, history } = await seedCrashed();
		const { target, importProject } = restoreTarget();
		initRecovery();
		const projectFile = vi.fn();
		target.subscribe({
			topic: 'projectFile',
			subscriberID: 'anyink.test.file',
			callback: projectFile,
		});
		const changed = vi.fn();
		window.addEventListener(RECOVERY_CHANGE_EVENT, changed);

		const result = await restoreSession('session:crashed:old');

		expect(importProject).toHaveBeenCalledWith(save);
		// Finding 5: the queue stored next to the project, never the shared store by id
		expect(target.history.adoptSnapshot).toHaveBeenCalledWith(history);
		expect(target.assets.get('img-a')).toEqual({ id: 'img-a', type: 'image/png', blob });
		expect(target.loadedFileHandle).toBe(handle);
		expect(target.setProjectAsUnsaved).toHaveBeenCalledTimes(1);
		expect(projectFile).toHaveBeenCalledWith({ handle, saved: false, reason: 'recovered' });
		expect(toast).toHaveBeenCalledWith('toast.backupOpened', {
			name: 'Crashed Font',
			ago: '7 minutes ago',
		}); // B4: "Opened the backup copy of Crashed Font from 7 minutes ago"
		expect(result).toEqual({
			id: 'session:crashed:old',
			projectId: 'crashed',
			name: 'Crashed Font',
			time: now - 7 * 60000,
			dirty: true,
			hasFile: true,
		});
		// a new session for the restored editor, unsaved, holding its own lock
		expect(getRecoveryStatus().session).toMatchObject({ key: 'session:crashed:s2', dirty: true });
		await flush();
		expect(locks.held.has('anyink-session:crashed:s2')).toBe(true);
		expect(locks.held.has('anyink-session:scratch:s1')).toBe(false);
		// the old record goes only after the new session's first snapshot landed
		expect(await recKeys()).toEqual(['session:crashed:s2']);
		expect((await recGet('session:crashed:s2')).project).toEqual(save);
		expect(changed).toHaveBeenCalled();
		window.removeEventListener(RECOVERY_CHANGE_EVENT, changed);
	});

	it("keeps the old record when the restored session's first snapshot fails", async () => {
		const driver = fakeDriver();
		const restoreDriver = setStorageDriver(driver);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			await seedCrashed();
			restoreTarget();
			initRecovery();
			driver.failWhen((op) => op === 'set');
			await restoreSession('session:crashed:old');
			await flush();
			expect([...driver.data.get('recovery').keys()]).toEqual(['session:crashed:old']);
			// once a later snapshot lands, the old record goes
			driver.failWhen(() => false);
			markDirty(current.history);
			await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
			expect([...driver.data.get('recovery').keys()]).toEqual(['session:crashed:s2']);
		} finally {
			restoreDriver();
			warn.mockRestore();
		}
	});

	it('falls back to no handle and passes the name as it is (the toast shows words as text)', async () => {
		await recSet('session:x', {
			id: 'x',
			name: '<b>Bold</b>',
			time: now,
			dirty: true,
			project: {},
		});
		await restoreSession('session:x');
		expect(editor.loadedFileHandle).toBe(false);
		// B4: a keyed toast is drawn as text, never HTML (src/anyink/toast/tests/toast.test.js)
		expect(toast).toHaveBeenCalledWith('toast.backupOpened', {
			name: '<b>Bold</b>',
			ago: 'less than a minute ago',
		});
	});

	it('rejects with a "gone" error when the record is missing, clean, or live in another tab', async () => {
		await recSet('session:clean', { id: 'clean', dirty: false });
		await recSet('session:live:t', {
			id: 'live',
			lock: 'anyink-session:live:t',
			dirty: true,
			project: {},
		});
		locks.hold('anyink-session:live:t');
		const changed = vi.fn();
		window.addEventListener(RECOVERY_CHANGE_EVENT, changed);
		for (const key of ['session:missing', 'session:clean', 'session:live:t']) {
			const error = await restoreSession(key).catch((e) => e);
			expect(isRecoveryGoneError(error)).toBe(true);
			expect(error.message).toMatch(/Nothing to recover/);
		}
		expect(changed).toHaveBeenCalledTimes(3);
		window.removeEventListener(RECOVERY_CHANGE_EVENT, changed);
	});
});

describe('discardSession, forgetAllSnapshots and the change event', () => {
	it('discard removes one record and tells every recover area', async () => {
		await recSet('session:a', { id: 'a', dirty: true, project: {} });
		await recSet('session:b', { id: 'b', dirty: true, project: {} });
		const changed = vi.fn();
		window.addEventListener(RECOVERY_CHANGE_EVENT, changed);
		expect(await discardSession('session:a')).toBe(true);
		expect((await recKeys()).sort()).toEqual(['session:b']);
		expect(changed).toHaveBeenCalledTimes(1);
		window.removeEventListener(RECOVERY_CHANGE_EVENT, changed);
	});

	it('discard leaves a record alone when its tab is alive', async () => {
		await recSet('session:a:t', { id: 'a', lock: 'anyink-session:a:t', dirty: true, project: {} });
		locks.hold('anyink-session:a:t');
		expect(await discardSession('session:a:t')).toBe(false);
		expect(await recKeys()).toEqual(['session:a:t']);
	});

	it('forget clears every record and re-arms the timer for a dirty live project', async () => {
		await recSet('session:old', { id: 'old', dirty: true, project: {} });
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect((await recKeys()).length).toBe(2);

		const changed = vi.fn();
		window.addEventListener(RECOVERY_CHANGE_EVENT, changed);
		await forgetAllSnapshots();
		expect(await recKeys()).toEqual([]);
		expect(changed).toHaveBeenCalledTimes(1);
		expect(getRecoveryStatus().timerPending).toBe(true);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		expect(await recKeys()).toEqual(['session:p1:s1']);
		window.removeEventListener(RECOVERY_CHANGE_EVENT, changed);
	});

	it('announces a dirty session that ends in this tab once its lock is gone', async () => {
		initRecovery();
		markDirty(editor.history);
		await vi.advanceTimersByTimeAsync(SNAPSHOT_DELAY_MS);
		const seen = [];
		const changed = async () => seen.push(await listRecoverableSessions());
		window.addEventListener(RECOVERY_CHANGE_EVENT, changed);
		loadInto(editor, fakeProject('p2', 'Second'));
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		await flush();
		expect(seen).toHaveLength(1);
		expect(seen[0].map((session) => session.id)).toEqual(['session:p1:s1']);
		window.removeEventListener(RECOVERY_CHANGE_EVENT, changed);
	});
});
