// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track C: adding, replacing, and removing a trace image
// (src/anyink/trace/trace_import.js) against a real ProjectEditor, the real trace model and
// the real decodeImageFile. jsdom has no createImageBitmap or showOpenFilePicker, so the
// decoder goes through bitmap_cache's setDecoderForTests and the picker through
// file_api.js's setFileApi. Toasts are read from the #toast element.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { setDecoderForTests } from '../bitmap_cache.js';
import { NOT_TRACEABLE_HINT } from '../paste_drop.js';
import {
	ADDED_MESSAGE,
	BIG_IMAGE_BYTES,
	DECODE_FAILED_MESSAGE,
	HEIC_MESSAGE,
	HISTORY_ADDED,
	HISTORY_REMOVED,
	HISTORY_REPLACED,
	LOADING_MESSAGE,
	PICK_AGAIN_MESSAGE,
	REMOVED_MESSAGE,
	REPLACED_MESSAGE,
	SWITCHED_MESSAGE,
	TRACE_PICKER_ID,
	WRONG_TYPE_MESSAGE,
	importTraceImage,
	isTraceImageFile,
	pickTraceImage,
	removeTrace,
	traceFileKind,
} from '../trace_import.js';
import { getTrace, setTrace } from '../trace_model.js';

// --------------------------------------------------------------
// Fakes
// --------------------------------------------------------------

/**
 * A decoder for setDecoderForTests: decode gives a bitmap-like of the given size (or
 * waits for `gate`), encode gives a WebP Blob of the size it was asked for.
 */
function fakeDecoder({ width = 400, height = 800, fail = false, gate = null } = {}) {
	return {
		decode: vi.fn(async () => {
			if (gate) await gate;
			if (fail) throw new Error('corrupt');
			return { width, height, close: vi.fn() };
		}),
		encode: vi.fn(async (_bitmap, options) => {
			return new Blob([`${options.width}x${options.height}`], { type: 'image/webp' });
		}),
	};
}

const jpeg = (name = 'lettering.jpg', type = 'image/jpeg', size = 16) =>
	new File([new Uint8Array(size)], name, { type });

function toastText() {
	return document.querySelector('#toast')?.textContent || '';
}

function deferred() {
	let resolve;
	const promise = new Promise((r) => (resolve = r));
	return { promise, resolve };
}

let editor;
let decoder;

function glyphA() {
	return editor.project.getItem('glyph-0x41');
}

beforeEach(() => {
	// jsdom has no Element.animate; showToast's removal timer calls it
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="editor-page__panel"></div>';
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = 'glyph-0x41';
	decoder = fakeDecoder();
	setDecoderForTests(decoder);
});

afterEach(() => {
	setDecoderForTests(null);
	resetFileApi();
	vi.restoreAllMocks();
});

// --------------------------------------------------------------
// What counts as a trace image
// --------------------------------------------------------------

describe('isTraceImageFile', () => {
	it('says yes to PNG, JPEG, and WebP by type, and to a typed Blob with no name', () => {
		expect(isTraceImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true);
		expect(isTraceImageFile(jpeg())).toBe(true);
		expect(isTraceImageFile(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe(true);
		expect(isTraceImageFile(new Blob(['x'], { type: 'image/png' }))).toBe(true);
	});

	it('says yes to an untyped file with an image name', () => {
		expect(isTraceImageFile(new File(['x'], 'scan.JPG'))).toBe(true);
		expect(
			isTraceImageFile(new File(['x'], 'scan.webp', { type: 'application/octet-stream' }))
		).toBe(true);
	});

	it('says yes to HEIC and other raster images, so the import can explain what to do', () => {
		expect(isTraceImageFile(new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }))).toBe(true);
		expect(isTraceImageFile(new File(['x'], 'IMG_0001.heic'))).toBe(true);
		expect(isTraceImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe(true);
	});

	it('says no to SVG, text, and things that are not files', () => {
		expect(isTraceImageFile(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).toBe(false);
		expect(isTraceImageFile(new File(['<svg/>'], 'a.svg'))).toBe(false);
		expect(isTraceImageFile(new File(['hi'], 'a.txt', { type: 'text/plain' }))).toBe(false);
		expect(isTraceImageFile(new File(['hi'], 'notes'))).toBe(false);
		expect(isTraceImageFile(null)).toBe(false);
		expect(isTraceImageFile('a.png')).toBe(false);
	});
});

describe('traceFileKind', () => {
	it('sorts files into image, heic, and other, and types untyped images by name', () => {
		expect(traceFileKind(jpeg())).toEqual({ kind: 'image', type: 'image/jpeg' });
		expect(traceFileKind(new File(['x'], 'a.jpg', { type: 'image/JPG' }))).toEqual({
			kind: 'image',
			type: 'image/jpeg',
		});
		expect(traceFileKind(new File(['x'], 'a.jfif'))).toEqual({ kind: 'image', type: 'image/jpeg' });
		expect(traceFileKind(new File(['x'], 'a.heif')).kind).toBe('heic');
		expect(traceFileKind(new File(['x'], 'a.gif', { type: 'image/gif' })).kind).toBe('other');
		expect(traceFileKind(new File(['x'], 'a.bmp')).kind).toBe('other');
	});
});

// --------------------------------------------------------------
// Import
// --------------------------------------------------------------

describe('importTraceImage', () => {
	it('adds one asset and one default-placed trace, with one history entry', async () => {
		let traceTicks = 0;
		let itemTicks = 0;
		editor.subscribe({
			topic: 'traceLayer',
			subscriberID: 'anyink.test.importTrace',
			callback: () => traceTicks++,
		});
		editor.subscribe({
			topic: 'currentItem',
			subscriberID: 'anyink.test.importItem',
			callback: () => itemTicks++,
		});
		const before = editor.history.queue.length;

		const added = await importTraceImage(jpeg(), { editor, item: glyphA() });

		expect(added).toBe(true);
		expect(editor.assets.ids()).toHaveLength(1);
		const id = editor.assets.ids()[0];
		expect(editor.assets.get(id).type).toBe('image/webp');

		const trace = getTrace(glyphA());
		// Default placement: image height = ascent - descent (1000), top at ascent, left at 0
		expect(trace).toMatchObject({ asset: id, width: 400, height: 800, x: 0, y: 800 });
		expect(trace.height * trace.scale).toBeCloseTo(1000, 9);
		expect(trace).toMatchObject({ opacity: 0.4, visible: true, locked: false, invert: false });

		expect(editor.history.queue.length).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe(HISTORY_ADDED);
		expect(traceTicks).toBe(1);
		expect(itemTicks).toBeGreaterThanOrEqual(1);
		expect(toastText()).toBe(ADDED_MESSAGE);
	});

	it('stores the capped, upright image (long side 2000 px) and never a Blob in the glyph', async () => {
		setDecoderForTests((decoder = fakeDecoder({ width: 3000, height: 1500 })));
		expect(await importTraceImage(jpeg(), { editor })).toBe(true);

		expect(decoder.decode.mock.calls[0][1]).toEqual({ imageOrientation: 'from-image' });
		expect(decoder.encode.mock.calls[0][1]).toMatchObject({ width: 2000, height: 1000 });
		const trace = getTrace(glyphA());
		expect(trace).toMatchObject({ width: 2000, height: 1000 });
		// Plain JSON only: the saved glyph round-trips through JSON unchanged
		const saved = glyphA().save();
		expect(JSON.parse(JSON.stringify(saved.anyink))).toEqual(saved.anyink);
		expect(saved.anyink.trace.asset).toBe(editor.assets.ids()[0]);
	});

	it('opens the Trace panel so the controls are in view', async () => {
		expect(editor.nav.panel).toBe('Attributes');
		await importTraceImage(jpeg(), { editor });
		expect(editor.nav.panel).toBe('Trace');
		expect(document.querySelector('#editor-page__panel .anyink-trace-panel')).not.toBeNull();
	});

	it('a new image: the toast points at Start auto-trace and the panel shows its top card (fix)', async () => {
		const area = document.querySelector('#editor-page__panel');
		area.scrollTop = 300;
		await importTraceImage(jpeg(), { editor });
		expect(ADDED_MESSAGE).toContain('Press Start auto-trace to turn it into outlines.');
		expect(toastText()).toBe(ADDED_MESSAGE);
		// The Trace image card, where Start auto-trace sits, is the panel's first card
		expect(area.scrollTop).toBe(0);
		expect(area.querySelector('.panel__card h3').textContent).toBe('Trace image');
	});

	it('a replaced image leaves the panel where the user had it', async () => {
		await importTraceImage(jpeg(), { editor });
		const area = document.querySelector('#editor-page__panel');
		area.scrollTop = 300;
		expect(await importTraceImage(jpeg('better.png', 'image/png'), { editor })).toBe(true);
		expect(area.scrollTop).toBe(300);
	});

	it('undo removes the trace but keeps the Blob; redo brings the trace back', async () => {
		await importTraceImage(jpeg(), { editor });
		const id = editor.assets.ids()[0];

		editor.history.restoreState();
		expect(getTrace(glyphA())).toBeNull();
		expect(editor.assets.has(id)).toBe(true);

		editor.history.redoState();
		expect(getTrace(glyphA()).asset).toBe(id);
	});

	it('replacing keeps the placement, opacity, lock, and invert', async () => {
		await importTraceImage(jpeg(), { editor });
		const first = getTrace(glyphA());
		setTrace(glyphA(), {
			...first,
			x: 50,
			y: 700,
			scale: 2,
			opacity: 0.8,
			locked: true,
			invert: true,
			visible: false,
		});

		setDecoderForTests((decoder = fakeDecoder({ width: 200, height: 400 })));
		expect(await importTraceImage(jpeg('better scan.png', 'image/png'), { editor })).toBe(true);

		const next = getTrace(glyphA());
		expect(next.asset).not.toBe(first.asset);
		expect(next).toMatchObject({
			width: 200,
			height: 400,
			x: 50,
			y: 700,
			opacity: 0.8,
			locked: true,
			invert: true,
			visible: true,
		});
		expect(next.height * next.scale).toBeCloseTo(800 * 2, 9);
		expect(editor.history.queue[0].title).toBe(HISTORY_REPLACED);
		expect(editor.assets.ids()).toHaveLength(2);
		expect(toastText()).toBe(REPLACED_MESSAGE);

		// Undo goes back to the first image, which is still in the store
		editor.history.restoreState();
		expect(getTrace(glyphA()).asset).toBe(first.asset);
		expect(editor.assets.has(first.asset)).toBe(true);
	});

	it('decodes an untyped file as its name says', async () => {
		expect(await importTraceImage(new File([new Uint8Array(8)], 'scan.jpeg'), { editor })).toBe(
			true
		);
		expect(decoder.decode.mock.calls[0][0].type).toBe('image/jpeg');
	});

	it('says why a HEIC photo cannot be used, and adds nothing', async () => {
		const before = editor.history.queue.length;
		expect(
			await importTraceImage(new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }), { editor })
		).toBe(false);
		expect(toastText()).toBe(HEIC_MESSAGE);
		expect(await importTraceImage(new File(['x'], 'IMG_0002.heic'), { editor })).toBe(false);
		expect(toastText()).toBe(HEIC_MESSAGE);
		expect(decoder.decode).not.toHaveBeenCalled();
		expect(editor.assets.ids()).toHaveLength(0);
		expect(getTrace(glyphA())).toBeNull();
		expect(editor.history.queue.length).toBe(before);
	});

	it('says which types work for anything else', async () => {
		const before = editor.history.queue.length;
		expect(
			await importTraceImage(new File(['x'], 'a.gif', { type: 'image/gif' }), { editor })
		).toBe(false);
		expect(toastText()).toBe(WRONG_TYPE_MESSAGE);
		expect(
			await importTraceImage(new File(['x'], 'notes.txt', { type: 'text/plain' }), { editor })
		).toBe(false);
		expect(toastText()).toBe(WRONG_TYPE_MESSAGE);
		expect(await importTraceImage(null, { editor })).toBe(false);
		expect(decoder.decode).not.toHaveBeenCalled();
		expect(editor.assets.ids()).toHaveLength(0);
		expect(editor.history.queue.length).toBe(before);
	});

	it('says in house words when a file cannot be decoded (B4: the decoder’s code picks the key)', async () => {
		setDecoderForTests((decoder = fakeDecoder({ fail: true })));
		expect(await importTraceImage(jpeg(), { editor })).toBe(false);
		expect(toastText()).toBe(DECODE_FAILED_MESSAGE);
		expect(editor.assets.ids()).toHaveLength(0);
		expect(getTrace(glyphA())).toBeNull();
	});

	it('shows a loading toast while a big photo decodes', async () => {
		const gate = deferred();
		setDecoderForTests((decoder = fakeDecoder({ gate: gate.promise })));
		const big = jpeg('phone photo.jpg', 'image/jpeg', BIG_IMAGE_BYTES + 1);

		const pending = importTraceImage(big, { editor });
		await Promise.resolve();
		expect(toastText()).toBe(LOADING_MESSAGE);

		gate.resolve();
		expect(await pending).toBe(true);
		expect(toastText()).toBe(ADDED_MESSAGE);
	});

	it('shows no loading toast for a small image', async () => {
		document.querySelector('#toast')?.remove();
		const gate = deferred();
		setDecoderForTests((decoder = fakeDecoder({ gate: gate.promise })));
		const pending = importTraceImage(jpeg(), { editor });
		await Promise.resolve();
		expect(toastText()).toBe('');
		gate.resolve();
		await pending;
	});

	it('adds nothing when the user opens another glyph while the image decodes', async () => {
		const gate = deferred();
		setDecoderForTests((decoder = fakeDecoder({ gate: gate.promise })));
		const pending = importTraceImage(jpeg(), { editor });
		editor.selectedGlyphID = 'glyph-0x42';
		gate.resolve();

		expect(await pending).toBe(false);
		expect(toastText()).toBe(SWITCHED_MESSAGE);
		expect(getTrace(glyphA())).toBeNull();
		expect(getTrace(editor.project.getItem('glyph-0x42'))).toBeNull();
		expect(editor.assets.ids()).toHaveLength(0);
	});

	it('works for ligatures and components (they are glyphs too)', async () => {
		const id = Object.keys(editor.project.ligatures)[0];
		expect(id).toBeTruthy();
		editor.nav.page = 'Ligatures';
		editor.selectedLigatureID = id;
		expect(await importTraceImage(jpeg(), { editor })).toBe(true);
		expect(getTrace(editor.project.getItem(id))).not.toBeNull();
		expect(editor.history.queue[0].itemID).toBe(id);
	});

	it('refuses the Kerning page, and an item that is not the one on the canvas', async () => {
		const other = editor.project.getItem('glyph-0x42');
		expect(await importTraceImage(jpeg(), { editor, item: other })).toBe(false);
		expect(toastText()).toBe(NOT_TRACEABLE_HINT);

		editor.nav.page = 'Kerning';
		expect(await importTraceImage(jpeg(), { editor })).toBe(false);
		expect(toastText()).toBe(NOT_TRACEABLE_HINT);
		expect(decoder.decode).not.toHaveBeenCalled();
	});
});

// --------------------------------------------------------------
// Remove
// --------------------------------------------------------------

describe('removeTrace', () => {
	it('removes the trace with one history entry; undo brings it back; the Blob stays', async () => {
		await importTraceImage(jpeg(), { editor });
		const trace = getTrace(glyphA());
		const before = editor.history.queue.length;

		expect(removeTrace({ editor })).toBe(true);
		expect(getTrace(glyphA())).toBeNull();
		expect(editor.history.queue.length).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe(HISTORY_REMOVED);
		expect(editor.assets.has(trace.asset)).toBe(true);
		expect(toastText()).toBe(REMOVED_MESSAGE);

		editor.history.restoreState();
		expect(getTrace(glyphA())).toEqual(trace);
	});

	it('does nothing (and records nothing) when there is no trace', () => {
		const before = editor.history.queue.length;
		expect(removeTrace({ editor })).toBe(false);
		expect(editor.history.queue.length).toBe(before);
	});
});

// --------------------------------------------------------------
// Picker
// --------------------------------------------------------------

describe('pickTraceImage', () => {
	it('asks for the picker inside the click, before anything is awaited, then imports', async () => {
		const handle = {
			kind: 'file',
			name: 'scan.png',
			getFile: vi.fn(async () => jpeg('scan.png', 'image/png')),
		};
		const showOpenFilePicker = vi.fn(async () => [handle]);
		setFileApi({ showOpenFilePicker });

		const result = pickTraceImage({ editor });
		expect(showOpenFilePicker).toHaveBeenCalledTimes(1); // synchronously
		const options = showOpenFilePicker.mock.calls[0][0];
		expect(options.id).toBe(TRACE_PICKER_ID);
		expect(options.multiple).toBe(false);
		expect(Object.keys(options.types[0].accept)).toEqual(['image/png', 'image/jpeg', 'image/webp']);

		expect(await result).toBe(true);
		expect(getTrace(glyphA())).not.toBeNull();
	});

	it('does nothing when the picker is closed, and asks for another click when activation ran out', async () => {
		const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
		setFileApi({ showOpenFilePicker: vi.fn(async () => Promise.reject(abort)) });
		document.querySelector('#toast')?.remove();
		expect(await pickTraceImage({ editor })).toBe(false);
		expect(toastText()).toBe('');

		const security = Object.assign(new Error('no activation'), { name: 'SecurityError' });
		setFileApi({ showOpenFilePicker: vi.fn(async () => Promise.reject(security)) });
		expect(await pickTraceImage({ editor })).toBe(false);
		expect(toastText()).toBe(PICK_AGAIN_MESSAGE);
		expect(getTrace(glyphA())).toBeNull();
	});

	it('falls back to a hidden file input when there is no picker', async () => {
		setFileApi({});
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

		const result = pickTraceImage({ editor });
		const input = document.getElementById('anyink-trace-file-input');
		expect(click).toHaveBeenCalledTimes(1);
		expect(input.type).toBe('file');
		expect(input.accept).toContain('image/png');

		Object.defineProperty(input, 'files', { value: [jpeg()] });
		input.dispatchEvent(new Event('change'));
		expect(await result).toBe(true);
		expect(getTrace(glyphA())).not.toBeNull();
		expect(document.getElementById('anyink-trace-file-input')).toBeNull();
	});
});
