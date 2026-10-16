// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 (UX-BEGINNER.md 7.3 "B10 and B12 measure the backup write time on a 58-letter traced font
	with the list at its fullest against D-026's 100 ms point"; section 10 B12 "the backup write
	time with a dozen gap fixes"). Every gap fix is a whole-font step (two whole-font copies), so a
	dozen of them are 12 of the 30 whole-font steps the list keeps. The font: B10's traced font
	(board/tests/traced_font.js: 58 letters, about 5,000 points, one 650 KB photo); the list: 200
	steps with 30 whole-font, the newest 12 of them gap fixes made through gap_handle.js.
	Measured as board_backup.test.js does: (1) the write when the list is new to the store (after
	a restore: the record and every saved copy), building and copying its payload, a loose bound
	(numbers print); (2) through the real backup (recovery.js on a test store): after a save, the
	write after one more gap fix sends the font, the titles and that step's copies, under 100 ms.
	Written to fail first: gap_handle.js did not exist.
*/
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { buildTracedFont, fillUndoList, undoListSize } from '../../board/tests/traced_font.js';
import { onePairFixes } from '../../kerning/kern_lookup.js';
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
import { beginGapDrag } from '../gap_handle.js';

/** D-026's revisit point */
const BACKUP_MS = 100;
/** A dozen pairs from the Quick set */
const PAIRS = ['en', 'ra', 'nd', 'Ha', 'an', 'ke', 'Te', 'Wa', 'yo', 'ov', 'fo', 'rt'];

let restore = [];
afterEach(() => {
	stopRecovery();
	restore.splice(0).forEach((undo) => undo());
	setModeForTests('all');
});

function tracedEditorWithGapFixes() {
	setModeForTests('simple');
	const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	buildTracedFont(editor);
	fillUndoList(editor, { steps: 200, wholeFont: 30 });
	PAIRS.forEach(([left, right], i) => {
		const drag = beginGapDrag(editor, left, right);
		drag.set(-20 - i);
		expect(drag.finish()).toBeTruthy();
	});
	return editor;
}

function measure(editor) {
	const runs = [];
	let record = null;
	let copies = [];
	for (let i = 0; i < 3; i++) {
		const book = makeStateBook('session:gaps:measure');
		const t0 = performance.now();
		book.beginWrite();
		record = makeSessionRecord(editor, {
			dirty: true,
			time: Date.now(),
			key: 'session:gaps:measure',
			sessionId: 'measure',
			lock: 'anyink-session:gaps:measure',
			stateRef: book.refFor,
		});
		copies = book.toWrite();
		const t1 = performance.now();
		structuredClone({ project: record.project, history: record.history, copies });
		const t2 = performance.now();
		runs.push({ build: t1 - t0, copy: t2 - t1, total: t2 - t0 });
	}
	const chars = JSON.stringify({ project: record.project, history: record.history, copies }).length;
	const best = runs.reduce((a, b) => (b.total < a.total ? b : a));
	return { record, best, mb: chars / 1e6 };
}

describe('the backup write with a dozen gap fixes', () => {
	it('the list at its fullest, 12 of its whole-font steps gap fixes: the record holds them all', () => {
		const editor = tracedEditorWithGapFixes();
		expect(onePairFixes(editor.project)).toHaveLength(12);
		const size = undoListSize(editor.history);
		expect(size.wholeFont).toBe(30); // the cap: the gap fixes pushed older whole-font steps out
		expect(size.steps).toBeLessThanOrEqual(200);
		const { record, best, mb } = measure(editor);
		expect(Object.keys(record.project.kerning)).toHaveLength(12);
		expect(record.history.queue).toHaveLength(editor.history.queue.length);
		console.log(
			`B12 backup with 12 gap fixes (jsdom, Simple): build ${best.build.toFixed(
				1
			)} ms + copy ${best.copy.toFixed(1)} ms = ${best.total.toFixed(1)} ms for ${mb.toFixed(
				2
			)} MB (D-026 point: ${BACKUP_MS} ms)`
		);
		expect(best.total).toBeLessThan(BACKUP_MS * 60);
	}, 120000);

	it('after a save, the write after one more gap fix sends its own copies only, under 100 ms', async () => {
		const editor = tracedEditorWithGapFixes();
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
		expect(await snapshotNow('manual')).toBe(true);
		expect(await markClean(editor)).toBe(true);

		const drag = beginGapDrag(editor, 'o', 'n');
		drag.set(-33);
		expect(drag.finish()).toBeTruthy();
		const mark = driver.calls.length;
		const t0 = performance.now();
		expect(await snapshotNow('manual')).toBe(true);
		const took = performance.now() - t0;
		const sets = driver.calls.slice(mark).filter((call) => call === 'set').length;
		console.log(
			`B12 backup after one more gap fix (jsdom, Simple, after a save): ${took.toFixed(
				1
			)} ms, ${sets} records written (D-026 point: ${BACKUP_MS} ms)`
		);
		// the record, and the gap fix's two whole-font copies
		expect(sets).toBeLessThanOrEqual(4);
		expect(took).toBeLessThan(BACKUP_MS);
	}, 120000);
});
