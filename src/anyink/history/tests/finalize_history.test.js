// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 finalize: what History itself must do (upstream project_editor/history.js; the
	second hostile pass, real keys in Chrome).
	- Undo or Redo of a whole-font step put back the photo list of the font copy it brought back:
	  a photo added since was forgotten while its letters still showed it, and picking that photo
	  again stored a second copy of the image. swapProject now carries the live list over
	  (photo_registry.js carryPhotos), on every Undo and Redo, in both modes.
	- A whole-font step told the save status only at its start, so the top bar showed the font as
	  it was before the step until the next change.
	Written to fail on history.js before the pass (both press Undo and Redo with no hand-carried
	list).
*/
import { afterEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { Path } from '../../../project_data/path.js';
import { getSaveStatus } from '../../files/save_status.js';
import { MAX_UNDO_POINTS, capUndoQueue, entryPoints } from '../undo_cap.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	addPhoto,
	getPhoto,
	markDone,
	photoFingerprint,
	skipPart,
} from '../../photo/photo_registry.js';

const ROW = Array.from({ length: 4 }, (_, i) => ({
	id: `p${i + 1}`,
	left: 100 + i * 150,
	top: 100,
	right: 200 + i * 150,
	bottom: 260,
	row: 0,
}));

function editorFor(mode) {
	setModeForTests(mode);
	const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x42';
	return editor;
}

afterEach(() => setModeForTests(null));

describe('the photo list stays through a whole-font Undo and Redo', () => {
	for (const mode of ['simple', 'all']) {
		it(`${mode}: a photo added after a whole-font step is still the font's after Undo and Redo`, () => {
			const editor = editorFor(mode);
			const { history } = editor;
			history.addWholeProjectChangePreState('moved the letter spacing');
			editor.project.settings.font.descent = -460;
			history.addWholeProjectChangePostState();
			const fingerprint = photoFingerprint(new Uint8Array([1, 2, 3, 4]));
			const record = addPhoto(editor.project, {
				asset: 'img-late0001',
				width: 900,
				height: 400,
				parts: ROW,
				fingerprint,
			});
			skipPart(record, 'p4');
			markDone(record);
			history.restoreState();
			expect(editor.project.settings.font.descent).not.toBe(-460);
			const kept = getPhoto(editor.project, 'img-late0001');
			expect(kept).toMatchObject({ fingerprint, skipped: ['p4'], done: true });
			history.redoState();
			expect(editor.project.settings.font.descent).toBe(-460);
			expect(getPhoto(editor.project, 'img-late0001')).toMatchObject({ done: true });
		});
	}
});

describe('a whole-font step tells the save status when it ends', () => {
	it("the status changes at the step's end, not only at its start", () => {
		const editor = editorFor('simple');
		const { history } = editor;
		history.addWholeProjectChangePreState('moved the letter spacing');
		const atStart = getSaveStatus(editor).revision;
		editor.project.settings.font.descent = -460;
		history.addWholeProjectChangePostState();
		expect(getSaveStatus(editor).revision).toBeGreaterThan(atStart);
	});
});

// B8 + B9 finalize (second hostile pass: 500 brush strokes on one letter made a crash copy of
// 191.6 MB, since each of the 200 Undo steps holds the whole letter): the Undo list also keeps
// at most MAX_UNDO_POINTS points of shapes, the oldest steps leaving first (into the undo floor,
// as the 200-step limit does), never the newest step
describe('the Undo list stays under a size the crash copy can hold', () => {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	const ring = (n) =>
		Array.from({ length: n }, (_, k) =>
			corner(Math.round(500 + 400 * Math.cos(k / 10)), Math.round(500 + 400 * Math.sin(k / 10)))
		);

	it('steps on a letter with very many points: the oldest leave, the newest stays, undo still works', () => {
		const editor = editorFor('simple');
		const { history } = editor;
		const item = editor.selectedItem;
		for (let i = 0; i < 10; i++) {
			item.addOneShape(new Path({ name: `big ${i}`, pathPoints: ring(1000) }));
			history.addState(`drew ${i}`);
		}
		const total = () => history.queue.reduce((sum, entry) => sum + entryPoints(entry), 0);
		expect(total()).toBeGreaterThan(20000);
		capUndoQueue(history, { maxPoints: 20000 });
		expect(total()).toBeLessThanOrEqual(20000);
		expect(history.queue.length).toBeGreaterThan(0);
		expect(history.queue[0].title).toBe('drew 9');
		history.restoreState();
		expect(editor.selectedItem.shapes.map((shape) => shape.name)).toEqual(
			Array.from({ length: 9 }, (_, i) => `big ${i}`)
		);
		// never the newest step, however big
		capUndoQueue(history, { maxPoints: 1 });
		expect(history.queue.length).toBeGreaterThan(0);
	});

	it('the list as History keeps it: MAX_UNDO_POINTS (a 58-letter traced font keeps all 200 steps)', () => {
		expect(MAX_UNDO_POINTS).toBeGreaterThanOrEqual(400000);
		const editor = editorFor('simple');
		const item = editor.selectedItem;
		item.addOneShape(new Path({ name: 'one', pathPoints: ring(100) }));
		editor.history.addState('drew one');
		expect(entryPoints(editor.history.queue[0])).toBe(100);
	});
});
