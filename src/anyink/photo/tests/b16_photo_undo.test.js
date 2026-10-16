// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 acceptance T2 (docs/UX-BEGINNER.md 9.2): "one Undo brings back the empty B (no shapes,
// photo kept)". tests/beginner.verify.mjs found one Undo after Use it left {shapes: 0, photo:
// false}: the photo goes on the letter at step C with no step of its own, so the step's
// earlier state was the letter before the photo. An empty letter now keeps the photo it was
// traced from (in an item step and in a whole-font one); a letter that had shapes still gets
// back its earlier shapes with its earlier photo. Written to fail on the code before the fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { deserializeHistoryEntry, serializeHistoryEntry } from '../../../project_editor/history.js';
import { setModeForTests } from '../../mode/mode.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { Glyph } from '../../../project_data/glyph.js';
import { markStepBefore } from '../../history/simple_undo.js';
import { getTrace } from '../../trace/trace_model.js';
import { loadPhotoFixture } from './fixture_image.js';
import { box, fakeDecoder, fakeTrace } from './flow_fakes.js';
import {
	addPhotoFile,
	resetPhotoFlowForTests,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import { getPhoto, guessPart } from '../photo_registry.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

let editor;
let loose;
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

async function addLoose() {
	const f = new File([loose.bytes], 'brenna-loose.jpg', { type: 'image/jpeg' });
	const added = await addPhotoFile(f, { editor });
	expect(added.ok).toBe(true);
	return added;
}

async function traceNext(asset, char) {
	const record = getPhoto(editor.project, asset);
	await startPart({ editor, asset, partId: guessPart(record), char });
	return whenFlowSettled(editor);
}

function allModes(mode) {
	beforeEach(async () => {
		loose ||= await loadPhotoFixture('brenna-loose-phone');
		document.body.innerHTML = '';
		setModeForTests(mode);
		resetPhotoFlowForTests();
		fakeTrace.calls.length = 0;
		setDecoderForTests(fakeDecoder({ 'brenna-loose.jpg': loose.image }));
		editor = new ProjectEditor({ project: new GlyphrStudioProject() });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x61';
	});
}

afterEach(() => {
	setDecoderForTests(null);
	resetPhotoFlowForTests();
	setModeForTests();
});

describe('T2: one Undo after Use it on an empty letter keeps its photo (Simple)', () => {
	allModes('simple');

	it('the first letter (an item step): no shapes, the photo kept, the part free; Redo puts it back', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		await useIt(editor);
		const traced = editor.project.getItem(ID('B'));
		expect(traced.shapes.length).toBeGreaterThan(0);

		editor.history.restoreState();
		await Promise.resolve();
		const back = editor.project.getItem(ID('B'));
		expect(back.shapes).toHaveLength(0);
		expect(getTrace(back)?.asset).toBe(asset);
		expect(getPhoto(editor.project, asset).used).toEqual({});

		editor.history.redoState();
		await Promise.resolve();
		const again = editor.project.getItem(ID('B'));
		expect(again.shapes.length).toBeGreaterThan(0);
		expect(getTrace(again)?.asset).toBe(asset);
		expect(Object.values(getPhoto(editor.project, asset).used)[0]).toMatchObject({ char: 'B' });
	});

	it('a later letter (a whole-font step, B resized): r empty with its photo, B back at its size', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		await useIt(editor);
		const bScale = getTrace(editor.project.getItem(ID('B'))).scale;
		await traceNext(asset, 'r');
		const result = await useIt(editor);
		expect(result.resized).toEqual(['B']);

		editor.history.restoreState();
		await Promise.resolve();
		const r = editor.project.getItem(ID('r'));
		expect(r.shapes).toHaveLength(0);
		expect(getTrace(r)?.asset).toBe(asset);
		expect(getTrace(editor.project.getItem(ID('B'))).scale).toBeCloseTo(bScale, 9);
		expect(Object.values(getPhoto(editor.project, asset).used).map((u) => u.char)).toEqual(['B']);
	});

	it('the empty letter can be traced again from the photo it kept', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		await useIt(editor);
		editor.history.restoreState();
		await Promise.resolve();
		const flow = await traceNext(asset, 'B');
		expect(flow.status).toBe('ready');
		const result = await useIt(editor);
		expect(result.ok).toBe(true);
		expect(editor.project.getItem(ID('B')).shapes.length).toBeGreaterThan(0);
	});
});

describe('All tools undoes a step that carries its own earlier state the same way', () => {
	allModes('all');

	it('markStepBefore: one Undo writes that state back, Redo the step', () => {
		editor.selectedGlyphID = ID('B');
		const b = editor.selectedItem;
		const prior = b.save();
		prior.anyink = {
			trace: { asset: 'img-kept0001', x: 0, y: 0, scale: 1, width: 10, height: 10 },
		};
		b.addOneShape(box(0, 0, 100, 100, 'ink'));
		editor.history.addState('traced Capital B');
		expect(markStepBefore(editor.history, ID('B'), prior, (data) => new Glyph(data))).toBe(true);
		editor.history.restoreState();
		const back = editor.project.getItem(ID('B'));
		expect(back.shapes).toHaveLength(0);
		expect(getTrace(back)?.asset).toBe('img-kept0001');
		editor.history.redoState();
		expect(editor.project.getItem(ID('B')).shapes).toHaveLength(1);
	});
});

describe('the earlier state a step carries survives a crash copy of the Undo list', () => {
	allModes('simple');

	it('serialize / deserialize keeps it', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		await useIt(editor);
		const top = editor.history.queue[0];
		expect(top.before).toBeTruthy();
		const back = deserializeHistoryEntry(JSON.parse(JSON.stringify(serializeHistoryEntry(top))));
		expect(back.before.shapes).toHaveLength(0);
		expect(back.before.anyink?.trace?.asset).toBe(asset);
	});
});
