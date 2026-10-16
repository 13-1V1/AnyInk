// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-tiles: the backup write on a 58-letter traced font with the Undo list at its fullest
	(UX-BEGINNER.md 7.3 "B10 and B12 measure the backup write time on a 58-letter traced font with
	the list at its fullest against D-026's 100 ms point"; section 10 B10). D-026: write a diff or a
	per-item record if a real font's snapshot write measures above about 100 ms; D-033: lower the
	limits then.
	The font: every board letter traced (two closed curves, 86 points, about 5,000 in all), its
	photo under it and in the photo list. The list: 200 steps with 30 whole-font steps (Simple), and
	All tools' 30 "Navigated to" entries on top.
	What jsdom can measure is the record the backup writes (recovery/snapshot.js makeSessionRecord:
	the font, the photo's Blob and the Undo list) and its structured copy, the work IndexedDB's put
	does before it hands the bytes to the disk (jsdom has no IndexedDB). The real write, in Chrome's
	own IndexedDB through recovery.js snapshotNow, is tests/board_tiles.verify.mjs's (part E); its
	numbers are what the report gives. Here: the list really is at its fullest, the record holds
	all of it, and building and copying it stays far from a hang (a loose bound, so a slow machine
	never fails it; the numbers print). Measured 10/15/2026 in jsdom: 1.46 s for 38.9 MB, the 60
	whole-font copies (each about 0.6 MB) nearly all of it: far past D-026's 100 ms.
	Written before traced_font.js existed.
	B10 + B11 integration (D-042): the backup keeps each step's saved copy as a record of its own,
	written once (recovery/step_states.js). The third test measures what a write after one more
	step sends then: the font, the list's titles and the one new copy, against D-026's 100 ms.
	Written to fail first: before step_states.js the record carried every copy (38.9 MB).
	B10 + B11 finalize (verifier: "cases 1 and 2 time makeSessionRecord without stateRef, and case
	3 never runs markClean"): the first two time the write the app makes when the list is new to
	the store (after a restore: the record and every copy, once); the third runs the real backup
	(recovery.js with the test store) through a save, and times the write after one more step.
*/
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	initRecovery,
	markClean,
	setRecoveryDeps,
	snapshotNow,
	stopRecovery,
} from '../../recovery/recovery.js';
import { makeSessionRecord } from '../../recovery/snapshot.js';
import { makeStateBook } from '../../recovery/step_states.js';
import { setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import { buildTracedFont, fillUndoList, undoListSize } from './traced_font.js';

/** D-026's revisit point */
const BACKUP_MS = 100;

function editorWith(mode) {
	setModeForTests(mode);
	const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	return editor;
}

/**
 * Times the write the app makes when none of the list is in the store yet (recovery.js
 * writeSession: the record with each copy named by its key, then every copy once), building
 * and copying its payload, best of a few runs.
 */
function measure(editor) {
	const runs = [];
	let record = null;
	let copies = [];
	for (let i = 0; i < 3; i++) {
		const book = makeStateBook('session:board:measure');
		const t0 = performance.now();
		book.beginWrite();
		record = makeSessionRecord(editor, {
			dirty: true,
			time: Date.now(),
			key: 'session:board:measure',
			sessionId: 'measure',
			lock: 'anyink-session:board:measure',
			stateRef: book.refFor,
		});
		copies = book.toWrite();
		const t1 = performance.now();
		// the payload IndexedDB copies (the Blob goes by reference: jsdom's can't be cloned by Node)
		structuredClone({ project: record.project, history: record.history, copies });
		const t2 = performance.now();
		runs.push({ build: t1 - t0, copy: t2 - t1, total: t2 - t0 });
	}
	const chars = JSON.stringify({ project: record.project, history: record.history, copies }).length;
	const best = runs.reduce((a, b) => (b.total < a.total ? b : a));
	return { record, copies, best, mb: chars / 1e6 };
}

let restore = [];
afterEach(() => {
	stopRecovery();
	restore.splice(0).forEach((undo) => undo());
});

describe('the backup write on a 58-letter traced font, the Undo list at its fullest', () => {
	it('Simple: 200 steps, 30 of them whole-font; the record holds the font, the photo and the list', () => {
		const editor = editorWith('simple');
		const { asset, points } = buildTracedFont(editor);
		expect(points).toBeGreaterThanOrEqual(4900);
		fillUndoList(editor, { steps: 200, wholeFont: 30 });
		expect(undoListSize(editor.history)).toMatchObject({ steps: 200, wholeFont: 30 });
		expect(editor.history.undoFloor).toBeFalsy(); // nothing dropped off the old end

		const { record, copies, best, mb } = measure(editor);
		expect(Object.keys(record.project.glyphs)).toHaveLength(58);
		expect(record.assets[asset].blob).toBeInstanceOf(Blob);
		expect(record.history.queue).toHaveLength(editor.history.queue.length);
		// every step names its copy, and each copy goes once
		expect(record.history.queue.every((entry) => !!entry.itemStateRef)).toBe(true);
		expect(copies.length).toBeGreaterThan(200);
		console.log(
			`B10 backup (jsdom, Simple): build ${best.build.toFixed(1)} ms + copy ${best.copy.toFixed(
				1
			)} ms = ${best.total.toFixed(1)} ms for ${mb.toFixed(2)} MB (D-026 point: ${BACKUP_MS} ms)`
		);
		expect(best.total).toBeLessThan(BACKUP_MS * 60);
	}, 120000);

	it('All tools: the same, plus 30 "Navigated to" entries', () => {
		const editor = editorWith('all');
		buildTracedFont(editor);
		fillUndoList(editor, { steps: 200, wholeFont: 30, navigation: 30 });
		const size = undoListSize(editor.history);
		expect(size).toMatchObject({ steps: 200, wholeFont: 30 });
		expect(size.navigation).toBe(30);
		const { best, mb } = measure(editor);
		console.log(
			`B10 backup (jsdom, All tools): build ${best.build.toFixed(1)} ms + copy ${best.copy.toFixed(
				1
			)} ms = ${best.total.toFixed(1)} ms for ${mb.toFixed(2)} MB (${
				size.navigation
			} "Navigated to")`
		);
		expect(best.total).toBeLessThan(BACKUP_MS * 60);
	}, 120000);

	it('B10 + B11 integration + finalize: after a save, a write after one more step sends one copy, under 100 ms', async () => {
		const editor = editorWith('simple');
		buildTracedFont(editor);
		fillUndoList(editor, { steps: 200, wholeFont: 30 });
		const driver = fakeDriver();
		restore.push(setStorageDriver(driver));
		restore.push(
			setRecoveryDeps({
				getEditor: () => editor,
				getEditors: () => [editor],
				locks: () => undefined,
				toast: () => {},
			})
		);
		const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
		restore.push(() => quiet.mockRestore());
		initRecovery();
		// the first write stores every copy the list names
		expect(await snapshotNow('manual')).toBe(true);
		const firstSets = driver.calls.filter((call) => call === 'set').length;
		expect(firstSets).toBeGreaterThan(200);
		// Ctrl+S: the record goes, the copies stay (the critic: every copy was sent again)
		expect(await markClean(editor)).toBe(true);

		// one more step on a letter: the next write sends the font, the titles and one copy
		fillUndoList(editor, { steps: 1, wholeFont: 0 });
		const mark = driver.calls.length;
		const t0 = performance.now();
		expect(await snapshotNow('manual')).toBe(true);
		const took = performance.now() - t0;
		const sets = driver.calls.slice(mark).filter((call) => call === 'set').length;
		console.log(
			`B10 + B11 backup (jsdom, Simple, after a save): ${took.toFixed(
				1
			)} ms, ${sets} records written (D-026 point: ${BACKUP_MS} ms)`
		);
		expect(sets).toBeLessThanOrEqual(3);
		expect(took).toBeLessThan(BACKUP_MS);
	}, 120000);
});
