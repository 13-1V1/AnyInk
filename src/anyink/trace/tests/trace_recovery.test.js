// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 integration: the trace image across the seams no single track owned.
// Import -> remove -> crash snapshot -> restore -> undo brings the image back, because
// crash snapshots keep every asset while the .gs2 keeps only the ones a trace uses.
// Runs the real import (fake decoder), the real snapshot record, the real History
// serialization, and the real save text builder.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { makeSessionRecord } from '../../recovery/snapshot.js';
import { setDecoderForTests } from '../bitmap_cache.js';
import { importTraceImage, removeTrace } from '../trace_import.js';
import { getTrace } from '../trace_model.js';

const GLYPH = 'glyph-0x41';

function fakeDecoder() {
	return {
		decode: vi.fn(async () => ({ width: 300, height: 600, close() {} })),
		encode: vi.fn(async (_bitmap, o) => new Blob([`${o.width}x${o.height}`], { type: 'image/webp' })),
	};
}

function openEditor(project) {
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = GLYPH;
	return editor;
}

/** True when a Blob or ImageBitmap hides anywhere inside a value. */
function holdsBinary(value, seen = new Set()) {
	if (!value || typeof value !== 'object') return false;
	if (value instanceof Blob) return true;
	if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) return true;
	if (seen.has(value)) return false;
	seen.add(value);
	return Object.values(value).some((v) => holdsBinary(v, seen));
}

let editor;

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="editor-page__panel"></div>';
	setDecoderForTests(fakeDecoder());
	editor = openEditor(new GlyphrStudioProject(structuredClone(simpleExampleProject)));
});

afterEach(() => {
	setDecoderForTests(null);
	vi.restoreAllMocks();
});

describe('trace across save, crash snapshot, and restore', () => {
	it('a crash snapshot keeps the removed image, and undo after a restore brings it back', async () => {
		const file = new File([new Uint8Array(32)], 'lettering.jpg', { type: 'image/jpeg' });
		expect(await importTraceImage(file, { editor })).toBe(true);
		const added = getTrace(editor.project.getItem(GLYPH));
		expect(editor.assets.has(added.asset)).toBe(true);
		expect(removeTrace({ editor })).toBe(true);

		// The .gs2 leaves the unused image out
		const saved = JSON.parse(await editor.makeProjectFileText());
		expect(saved.assets).toBeUndefined();

		// The crash snapshot keeps it (undo may need it); the project and the undo queue
		// carry only the id string
		const record = makeSessionRecord(editor, { dirty: true, time: 1 });
		expect(Object.keys(record.assets)).toEqual([added.asset]);
		expect(record.assets[added.asset].blob).toBeInstanceOf(Blob);
		expect(holdsBinary(record.project)).toBe(false);
		expect(holdsBinary(record.history)).toBe(false);
		expect(JSON.stringify(record.history)).toContain(added.asset);

		// Restore the way recovery.js restoreSession does, into a fresh editor
		setCurrentProjectEditor(new ProjectEditor());
		const restored = openEditor(importGlyphrProjectFromText(structuredClone(record.project)));
		expect(restored.history.adoptSnapshot(record.history)).toBe(true);
		restored.assets.loadBlobMap(record.assets);
		expect(getTrace(restored.project.getItem(GLYPH))).toBe(null);

		restored.history.restoreState(); // undo 'Removed the trace image'
		const back = getTrace(restored.project.getItem(GLYPH));
		expect(back).toEqual(added);
		expect(restored.assets.has(back.asset)).toBe(true);

		// ...and the next save carries the image again
		const resaved = JSON.parse(await restored.makeProjectFileText());
		expect(Object.keys(resaved.assets)).toEqual([back.asset]);

		restored.history.restoreState(); // undo 'Added a trace image'
		expect(getTrace(restored.project.getItem(GLYPH))).toBe(null);
		restored.history.redoState();
		expect(getTrace(restored.project.getItem(GLYPH))).toEqual(added);
	});

	it('a saved project reopens with the trace and its image, ready to draw', async () => {
		const file = new File([new Uint8Array(32)], 'scan.png', { type: 'image/png' });
		expect(await importTraceImage(file, { editor })).toBe(true);
		const added = getTrace(editor.project.getItem(GLYPH));
		const text = await editor.makeProjectFileText();

		// As open_project.js does: the editor is current first, so the import hands the
		// images to its AssetStore (and the project lets go of the file's base64)
		const reopened = openEditor(new GlyphrStudioProject());
		reopened.project = importGlyphrProjectFromText(text);
		expect(reopened.project.assetsSaveObject).toBe(false);
		await vi.waitFor(() => expect(reopened.assets.has(added.asset)).toBe(true));
		expect(getTrace(reopened.project.getItem(GLYPH))).toEqual(added);
		const blob = reopened.assets.get(added.asset)?.blob;
		expect(blob).toBeInstanceOf(Blob);
		// The fake encoder wrote '300x600' as a WebP; base64 in the file brought it back
		expect(blob.size).toBe('300x600'.length);
		expect(blob.type).toBe('image/webp');
	});
});
