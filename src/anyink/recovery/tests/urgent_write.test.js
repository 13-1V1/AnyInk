// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (files-recovery): closing Chrome within about 3 s of a change lost it. The page's last
// moments (beforeunload, hidden, pagehide) must hand IndexedDB the whole backup copy at once,
// in the handler itself: one transaction, the session record first, no waits between copies,
// and never behind a write already running. beforeunload also starts the work file's write.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetStore } from '../../assets/asset_store.js';
import { publish, subscribe, unsubscribe } from '../../../project_editor/pub_sub.js';
import { recGet, recKeys, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import {
	getRecoveryStatus,
	initRecovery,
	markDirty,
	setRecoveryDeps,
	snapshotNow,
	stopRecovery,
} from '../recovery.js';
import { fakeLocks } from './fake_locks.js';

function fakeProject(id = 'p1') {
	return {
		settings: { project: { id, name: 'Test Font' } },
		glyphs: { 'glyph-0x41': { advanceWidth: 600 } },
		save() {
			return { settings: { project: { id, name: 'Test Font' } }, glyphs: {} };
		},
	};
}

/** A History whose Undo list names `copies` saved copies (each a record of its own). */
function fakeHistory(copies) {
	return {
		isRestoring: false,
		serializeForStorage: (options) => ({
			version: 3,
			queue: copies.map((copy, n) => ({
				title: `step ${n}`,
				state: options?.stateRef ? options.stateRef(copy) : copy.save(),
			})),
			redoQueue: [],
		}),
		adoptSnapshot: () => true,
	};
}

function fakeEditor(copyCount = 0) {
	const copies = Array.from({ length: copyCount }, (unused, n) => ({ save: () => ({ n }) }));
	const editor = {
		subscribers: {},
		project: fakeProject(),
		assets: new AssetStore(),
		loadedFileHandle: false,
		setProjectAsUnsaved: () => {},
		multiSelect: {
			shapes: { clear() {}, length: 0, singleton: false },
			points: { clear() {}, singleton: false },
		},
	};
	editor.history = fakeHistory(copies);
	editor.publish = publish;
	editor.subscribe = subscribe;
	editor.unsubscribe = unsubscribe;
	editor.copies = copies;
	return editor;
}

const workFile = () => ({ kind: 'file', name: 'My Font.gs2', getFile() {}, createWritable() {} });

let driver;
let restoreDriver;
let restoreDeps;
let editor;
let autosave;
let now;

function useEditor(next) {
	editor = next;
	restoreDeps?.();
	restoreDeps = setRecoveryDeps({
		getEditor: () => editor,
		getEditors: () => [editor],
		locks: () => fakeLocks(),
		toast: vi.fn(),
		now: () => (now += 5), // every look at the clock is 5 ms on: the old write yields
		importProject: vi.fn(),
		makeSessionId: () => 's1',
		autosave,
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	driver = fakeDriver();
	restoreDriver = setStorageDriver(driver);
	autosave = vi.fn(() => Promise.resolve(true));
	now = 1_000_000;
	useEditor(fakeEditor(3));
});

afterEach(() => {
	stopRecovery();
	restoreDeps();
	restoreDeps = null;
	restoreDriver();
	vi.useRealTimers();
});

const opsSince = (start) => driver.calls.slice(start).filter((op) => op !== 'get');

describe('the last write before the page goes', () => {
	for (const [name, fire] of [
		['pagehide', () => window.dispatchEvent(new Event('pagehide'))],
		['beforeunload', () => window.dispatchEvent(new Event('beforeunload'))],
		[
			'hidden',
			() => {
				Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
				document.dispatchEvent(new Event('visibilitychange'));
				Object.defineProperty(document, 'visibilityState', {
					value: 'visible',
					configurable: true,
				});
			},
		],
	]) {
		it(`${name}: the record and every new copy go in one call, inside the handler`, async () => {
			initRecovery();
			await vi.advanceTimersByTimeAsync(0);
			markDirty(editor.history);
			const start = driver.calls.length;
			fire();
			// nothing awaited: the store already holds the record and its copies
			expect(opsSince(start)).toEqual(['setMany']);
			const store = driver.data.get('recovery');
			const keys = [...store.keys()];
			expect(keys[0]).toBe('session:p1:s1');
			expect(keys.filter((key) => key.startsWith('state:'))).toHaveLength(3);
			expect(store.get('session:p1:s1').dirty).toBe(true);
			await vi.advanceTimersByTimeAsync(0);
			expect(getRecoveryStatus().lastWrite.states).toBe(3);
		});
	}

	it('pagehide never waits behind a write that is still running', async () => {
		useEditor(fakeEditor(40));
		initRecovery();
		await vi.advanceTimersByTimeAsync(0);
		markDirty(editor.history);
		void snapshotNow('timer'); // a slow write: 40 copies, a turn given every few
		await Promise.resolve();
		await Promise.resolve();
		expect(await recGet('session:p1:s1')).toBeUndefined(); // still on its copies
		window.dispatchEvent(new Event('pagehide'));
		expect(driver.data.get('recovery').get('session:p1:s1')?.dirty).toBe(true);
		await vi.runAllTimersAsync();
		// the older write, finishing later, never puts an older record over it
		expect(getRecoveryStatus().lastWrite.reason).toBe('pagehide');
		expect((await recKeys()).filter((key) => key.startsWith('state:'))).toHaveLength(40);
	});

	it('a later write sends only the copies the last one did not', async () => {
		initRecovery();
		await vi.advanceTimersByTimeAsync(0);
		markDirty(editor.history);
		window.dispatchEvent(new Event('pagehide'));
		await vi.advanceTimersByTimeAsync(0);
		const start = driver.calls.length;
		await snapshotNow('manual');
		expect(opsSince(start)).toEqual(['set']); // the record alone
		expect(getRecoveryStatus().lastWrite.states).toBe(3);
	});

	it('a failed last write marks its copies as not stored, so the next one sends them again', async () => {
		initRecovery();
		await vi.advanceTimersByTimeAsync(0);
		markDirty(editor.history);
		driver.failNext(2);
		window.dispatchEvent(new Event('pagehide'));
		await vi.advanceTimersByTimeAsync(0);
		expect(await recGet('session:p1:s1')).toBeUndefined();
		markDirty(editor.history);
		const written = snapshotNow('timer');
		await vi.runAllTimersAsync();
		expect(await written).toBe(true);
		expect((await recKeys()).filter((key) => key.startsWith('state:'))).toHaveLength(3);
	});

	it('a clean font writes nothing on beforeunload and starts no work-file write', async () => {
		editor.loadedFileHandle = workFile();
		initRecovery();
		await vi.advanceTimersByTimeAsync(0);
		const start = driver.calls.length;
		window.dispatchEvent(new Event('beforeunload'));
		expect(opsSince(start)).toEqual([]);
		expect(autosave).not.toHaveBeenCalled();
	});

	it('beforeunload starts the work file write at once for a font with unsaved changes', async () => {
		editor.loadedFileHandle = workFile();
		initRecovery();
		await vi.advanceTimersByTimeAsync(0);
		markDirty(editor.history);
		window.dispatchEvent(new Event('beforeunload'));
		expect(autosave).toHaveBeenCalledWith(editor);
	});

	it('beforeunload starts no work-file write for a font with no work file', async () => {
		initRecovery();
		await vi.advanceTimersByTimeAsync(0);
		markDirty(editor.history);
		window.dispatchEvent(new Event('beforeunload'));
		expect(autosave).not.toHaveBeenCalled();
	});
});
