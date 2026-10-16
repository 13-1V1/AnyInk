// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration (the board-tiles track's need 3; D-026's revisit, D-042): the backup copy
// keeps each Undo step's saved copy as a record of its own, written once. A write after a step
// sends the font, the list's titles and only the new copies; copies that left the list are
// deleted; a clean save deletes them all; a restore puts them back, so the restored font undoes
// as it did; a missing copy restores the font without its Undo list.
// Written to fail first: every write copied the whole list into the session's record (the store
// held the one record; nothing was a 'state:' key).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { recDel, recEntries, recGet, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import {
	initRecovery,
	markClean,
	restoreSession,
	setRecoveryDeps,
	snapshotNow,
	stopRecovery,
} from '../recovery.js';
import { isSessionKey } from '../snapshot.js';
import {
	inlineStates,
	isStateKey,
	makeStateBook,
	ownerOfState,
	stateKeyPrefix,
} from '../step_states.js';

const A = 'glyph-0x41';

function fontEditor(id = 'backup-font') {
	const editor = new ProjectEditor({
		project: new GlyphrStudioProject({
			settings: { project: { id, name: 'Backup Font' } },
			glyphs: {
				[A]: { id: A, advanceWidth: 600 },
				'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 600 },
			},
		}),
	});
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = A;
	editor.editCanvas = { redraw() {} };
	return editor;
}

/** One item step on small A: its width goes up by one */
function widen(editor, title = 'widened A') {
	editor.project.glyphs[A].advanceWidth++;
	editor.history.addState(title);
}

let driver;
let resetStorage;
let resetDeps;
let current;
let quiet;
beforeEach(() => {
	quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
	driver = fakeDriver();
	resetStorage = setStorageDriver(driver);
	current = fontEditor();
	setCurrentProjectEditor(current);
	resetDeps = setRecoveryDeps({
		getEditor: () => current,
		getEditors: () => [current],
		locks: () => undefined,
		toast: () => {},
		importProject: (data) => {
			current.project = new GlyphrStudioProject(data);
		},
	});
	initRecovery();
});
afterEach(async () => {
	stopRecovery();
	resetDeps();
	resetStorage();
	quiet.mockRestore();
});

const stateKeys = async () => (await recEntries()).map(([key]) => key).filter(isStateKey);
const sessionKeys = async () => (await recEntries()).map(([key]) => key).filter(isSessionKey);

describe('the book of saved copies', () => {
	it('names a copy once for the session, writes it once, and lets go of it when unnamed', () => {
		const book = makeStateBook('session:p1:s1');
		const one = { save: () => ({ one: 1 }) };
		const two = { save: () => ({ two: 2 }) };
		book.beginWrite();
		const a = book.refFor(one);
		const b = book.refFor(two);
		expect(a).toBe('state:p1:s1:0');
		expect(book.refFor(one)).toBe(a);
		expect(book.toWrite()).toEqual([
			[a, { anyinkState: 1, data: { one: 1 } }],
			[b, { anyinkState: 1, data: { two: 2 } }],
		]);
		book.written(a);
		book.written(b);
		book.beginWrite();
		book.refFor(two);
		expect(book.toWrite()).toEqual([]);
		expect(book.unnamed()).toEqual([a]);
		book.forget(a);
		expect(book.size()).toBe(1);
		book.lostAll();
		book.beginWrite();
		expect(book.refFor(two)).toBe(b);
		expect(book.toWrite()).toEqual([[b, { anyinkState: 1, data: { two: 2 } }]]);
	});

	// B10 + B11 finalize (verifier: "make toWrite lazy and yielding"). Written to fail first:
	// toWrite() ran every copy's save() before the first was written (a 555 ms long task after a
	// save, 2.8 s after a restore)
	it('pending() saves each copy only as the write takes it', () => {
		const book = makeStateBook('session:p1:s1');
		let saves = 0;
		const copy = (n) => ({ save: () => (saves++, { n }) });
		book.beginWrite();
		[copy(1), copy(2), copy(3)].forEach((c) => book.refFor(c));
		const each = book.pending()[Symbol.iterator]();
		expect(saves).toBe(0);
		expect(each.next().value[1]).toEqual({ anyinkState: 1, data: { n: 1 } });
		expect(saves).toBe(1);
		expect([...each]).toHaveLength(2);
		expect(saves).toBe(3);
	});

	it("keys say whose they are, and never look like a session's", () => {
		expect(stateKeyPrefix('session:p1:s1')).toBe('state:p1:s1:');
		expect(ownerOfState('state:p1:s1:12')).toBe('session:p1:s1');
		expect(ownerOfState('session:p1:s1')).toBe('');
		expect(isSessionKey('state:p1:s1:0')).toBe(false);
	});
});

describe('the backup write', () => {
	it('writes each saved copy once; a write after one more step sends one copy and the record', async () => {
		widen(current);
		widen(current);
		widen(current);
		expect(await snapshotNow('manual')).toBe(true);
		const first = await stateKeys();
		// the font as opened, and the three steps' copies of A
		expect(first).toHaveLength(4);
		expect(await sessionKeys()).toHaveLength(1);
		const record = await recGet((await sessionKeys())[0]);
		expect(record.history.queue.every((entry) => entry.itemState === false)).toBe(true);
		expect(record.history.queue.every((entry) => isStateKey(entry.itemStateRef))).toBe(true);
		expect(record.history.initialProject).toBeNull();
		expect(isStateKey(record.history.initialProjectRef)).toBe(true);

		const mark = driver.calls.length;
		widen(current);
		expect(await snapshotNow('manual')).toBe(true);
		const written = driver.calls.slice(mark).filter((call) => call === 'set');
		// one new copy, then the session's record
		expect(written).toHaveLength(2);
		expect(await stateKeys()).toHaveLength(5);
	});

	it('a copy that left the Undo list is deleted at the next write', async () => {
		widen(current, 'one');
		widen(current, 'two');
		await snapshotNow('manual');
		expect(await stateKeys()).toHaveLength(3);
		// Undo keeps "two" for Redo; a new step drops it
		current.history.restoreState();
		await snapshotNow('manual');
		expect(await stateKeys()).toHaveLength(3);
		widen(current, 'three');
		await snapshotNow('manual');
		const keys = await stateKeys();
		expect(keys).toHaveLength(3);
		const record = await recGet((await sessionKeys())[0]);
		const named = new Set([
			record.history.initialProjectRef,
			...record.history.queue.map((entry) => entry.itemStateRef),
			...record.history.redoQueue.flat().map((entry) => entry.itemStateRef),
		]);
		expect(new Set(keys)).toEqual(named);
	});

	// B10 + B11 finalize (critic: "after every Save, the next backup write re-sends the whole
	// Undo list: about 0.85 s, with a 0.4 s freeze"). Written to fail first: markClean deleted
	// the live session's copies too, so the write after a save sent every one again
	it("a clean save deletes the record and keeps the live list's copies; the next write sends one", async () => {
		widen(current);
		widen(current);
		await snapshotNow('manual');
		const before = await stateKeys();
		expect(before).toHaveLength(3);
		await markClean(current);
		expect(await sessionKeys()).toEqual([]);
		expect(await stateKeys()).toEqual(before);
		// dirty again: the next write sends the one new copy and the record
		widen(current);
		const mark = driver.calls.length;
		await snapshotNow('manual');
		const written = driver.calls.slice(mark).filter((call) => call === 'set');
		expect(written).toHaveLength(2);
		expect(await stateKeys()).toHaveLength(4);
		expect(await sessionKeys()).toHaveLength(1);
	});
});

describe('restoring a backup copy', () => {
	it('puts the copies back: the restored font undoes step by step as it did', async () => {
		widen(current, 'one');
		widen(current, 'two');
		await snapshotNow('manual');
		const key = (await sessionKeys())[0];
		stopRecovery();
		current = fontEditor();
		setCurrentProjectEditor(current);
		initRecovery();
		await restoreSession(key);
		expect(current.project.glyphs[A].advanceWidth).toBe(602);
		expect(current.history.queue.map((entry) => entry.title)).toEqual(['two', 'one']);
		current.history.restoreState();
		expect(current.project.glyphs[A].advanceWidth).toBe(601);
		current.history.restoreState();
		expect(current.project.glyphs[A].advanceWidth).toBe(600);
	});

	it('a missing copy restores the font without its Undo list', async () => {
		widen(current, 'one');
		await snapshotNow('manual');
		const key = (await sessionKeys())[0];
		const record = await recGet(key);
		await recDel(record.history.queue[0].itemStateRef);
		expect(await inlineStates(record.history, recGet)).toBeNull();
		stopRecovery();
		current = fontEditor();
		setCurrentProjectEditor(current);
		initRecovery();
		await restoreSession(key);
		expect(current.project.glyphs[A].advanceWidth).toBe(601);
		expect(current.history.queue).toEqual([]);
	});
});
