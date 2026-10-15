// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow (photo_flow.js; UX-BEGINNER.md 4.4, 4.5, 7.3, 7.7, section 10 B9) on a real
// ProjectEditor in Simple with the real registry, parts finder, paper detector, placement,
// spacing hook and history. jsdom can't decode a JPEG or run the potrace worker, so the fixture
// photos are decoded with sharp and the tracer is flow_fakes.js fakeTrace (the real binarize,
// one box per ink piece, placed by the facade's own mapping).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { regionForPart } from '../../autotrace/trace_region.js';
import { hasInk } from '../../board/letter_set.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLines } from '../../placement/classes.js';
import { inkBounds } from '../../spacing/measure.js';
import { toastLog } from '../../toast/toast.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { word } from '../../words/words.js';
import { loadPhotoFixture } from './fixture_image.js';
import { box, fakeDecoder, fakeTrace } from './flow_fakes.js';
import {
	USED_OPACITY,
	adjustPart,
	addPhotoFile,
	cancelPart,
	flowError,
	getFlow,
	photoPreviewShapes,
	resetPhotoFlowForTests,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import { isAsTraced } from '../photo_flow_fit.js';
import { addDrawnPart, getPhoto, guessPart, photosOf } from '../photo_registry.js';

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
let tight;

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
const steps = () => editor.history.queue.map((entry) => entry.title);
const coords = (item) =>
	item.shapes.flatMap((shape) => shape.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y]));

function file(name, bytes, type = 'image/jpeg') {
	const f = new File([bytes], name, { type });
	return f;
}

beforeEach(async () => {
	loose ||= await loadPhotoFixture('brenna-loose-phone');
	tight ||= await loadPhotoFixture('brenna-tight-phone');
	document.body.innerHTML = '';
	setModeForTests('simple');
	resetPhotoFlowForTests();
	fakeTrace.calls.length = 0;
	setDecoderForTests(
		fakeDecoder({ 'brenna-loose.jpg': loose.image, 'brenna-tight.jpg': tight.image })
	);
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x61';
});

afterEach(() => {
	setDecoderForTests(null);
	resetPhotoFlowForTests();
});

/** Adds the loose B r e n a H d photo; its record. */
async function addLoose() {
	const added = await addPhotoFile(file('brenna-loose.jpg', loose.bytes), { editor });
	expect(added.ok).toBe(true);
	return added;
}

/** Names the guessed part for char and waits for its trace. */
async function traceNext(asset, char) {
	const record = getPhoto(editor.project, asset);
	const partId = guessPart(record);
	await startPart({ editor, asset, partId, char });
	return whenFlowSettled(editor);
}

describe('a photo comes in (4.4 step A, 4.5)', () => {
	it('finds one part per letter, picks the paper, and is no Undo step', async () => {
		const added = await addLoose();
		expect(added.added).toBe(true);
		const record = getPhoto(editor.project, added.asset);
		expect(record.parts).toHaveLength(7);
		expect(record.paper).toBe('photo');
		expect(editor.assets.has(added.asset)).toBe(true);
		expect(steps()).toEqual([]);
	});

	it('the same photo twice keeps one image id and one record', async () => {
		const first = await addLoose();
		const again = await addPhotoFile(file('brenna-loose.jpg', loose.bytes), { editor });
		expect(again).toMatchObject({ ok: true, added: false, asset: first.asset });
		expect(Object.keys(photosOf(editor.project))).toEqual([first.asset]);
		expect(editor.assets.ids()).toEqual([first.asset]);
	});

	it('an iPhone HEIC photo says so in plain words, by its name or by its bytes', async () => {
		const ftyp = Uint8Array.from('\0\0\0\x18ftypheic\0\0\0\0mif1heic', (c) => c.charCodeAt(0));
		const named = await addPhotoFile(file('IMG_4410.HEIC', ftyp, ''), { editor });
		const renamed = await addPhotoFile(file('IMG_4410.jpg', ftyp), { editor });
		for (const result of [named, renamed]) {
			expect(result).toMatchObject({ ok: false, code: 'heic', key: 'toast.photoHeic' });
			expect(result.button).toBe('photoFlow.button.chooseAnother');
		}
		expect(word(named.key)).toMatch(/HEIC photo, which Chrome can't open/);
		expect(photosOf(editor.project)).toBeNull();
		expect(editor.assets.ids()).toEqual([]);
	});

	it('a file that is no photo says which kinds work', async () => {
		const gif = await addPhotoFile(file('scan.gif', Uint8Array.of(71, 73, 70, 56), 'image/gif'), {
			editor,
		});
		expect(gif).toMatchObject({ ok: false, code: 'wrong-type', key: 'toast.photoWrongType' });
	});
});

describe('step C: the part is placed, then traced (4.4)', () => {
	it('opens the letter with no Undo step and places the photo so the part sits on its lines', async () => {
		const { asset } = await addLoose();
		const flow = await traceNext(asset, 'B');
		expect(editor.selectedGlyphID).toBe(ID('B'));
		expect(steps()).toEqual([]);
		expect(flow.status).toBe('ready');
		const trace = getTrace(editor.project.getItem(ID('B')));
		expect(trace).toMatchObject({ asset, x: flow.placed.x, y: flow.placed.y, locked: true });
		expect(trace.scale).toBeCloseTo(flow.placed.scale, 9);
		// The traced outline sits on the writing line, capital-sized (the preview, not the font)
		const shapes = photoPreviewShapes(editor.project.getItem(ID('B')), editor);
		const bottom = Math.min(...shapes.flatMap((s) => s.pathPoints.map((pp) => pp.p.y)));
		const top = Math.max(...shapes.flatMap((s) => s.pathPoints.map((pp) => pp.p.y)));
		const lines = guideLines(editor.project.settings.font);
		expect(Math.abs(bottom)).toBeLessThanOrEqual(0.02 * lines.box);
		expect(Math.abs(top - lines.capitals)).toBeLessThanOrEqual(0.06 * lines.box);
		// Nothing went into the letter yet
		expect(editor.project.getItem(ID('B')).shapes).toHaveLength(0);
	});

	it("traces the part's rectangle (not the letter's box), with the neighbors painted out", async () => {
		const added = await addPhotoFile(file('brenna-tight.jpg', tight.bytes), { editor });
		const record = getPhoto(editor.project, added.asset);
		const partId = guessPart(record);
		const part = record.parts.find((p) => p.id === partId);
		await startPart({ editor, asset: added.asset, partId, char: 'B' });
		await whenFlowSettled(editor);
		const call = fakeTrace.calls.at(-1);
		const rect = regionForPart(part, record);
		expect([call.placement.offsetX, call.placement.offsetY]).toEqual([rect.x, rect.y]);
		expect([call.imageData.width, call.imageData.height]).toEqual([rect.width, rect.height]);
		// Every traced piece lies inside the part's box: the r beside it is not in the trace
		const flow = getFlow(editor);
		const trace = getTrace(editor.selectedItem);
		const shapes = photoPreviewShapes(editor.selectedItem, editor);
		const xs = shapes.flatMap((s) => s.pathPoints.map((pp) => pp.p.x));
		expect(Math.max(...xs)).toBeLessThanOrEqual(trace.x + part.right * trace.scale + 1e-6);
		expect(flow.shapes).toBe(shapes.length);
	});

	it('a box he drew on bare paper: "No ink found", and Use it changes nothing', async () => {
		const { asset } = await addLoose();
		const record = getPhoto(editor.project, asset);
		// Bare paper under the row of letters (the table shows round the page's edge)
		const blank = addDrawnPart(record, { left: 600, top: 800, right: 680, bottom: 860 });
		await startPart({ editor, asset, partId: blank.id, char: 'x' });
		const flow = await whenFlowSettled(editor);
		expect(flow.status).toBe('no-ink');
		expect(flow.error).toEqual(flowError('no-ink'));
		expect(word(flow.error.key)).toBe(
			'No ink found in that part. Drag Ink cutoff toward more ink, or draw the box again.'
		);
		expect(flow.error.button).toBe('photoFlow.button.drawBox');
		expect((await useIt(editor)).ok).toBe(false);
		expect(editor.project.getItem(ID('x')).shapes).toHaveLength(0);
		expect(steps()).toEqual([]);
	});

	it('Adjust re-traces with his settings and keeps his paper and light-ink picks with the photo', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		const calls = fakeTrace.calls.length;
		adjustPart(editor, { threshold: 60, smoothDetail: 1, paper: 'scan', lightInk: false });
		const flow = await whenFlowSettled(editor);
		expect(fakeTrace.calls.length).toBe(calls + 1);
		const used = fakeTrace.calls.at(-1).options;
		expect(used).toMatchObject({ threshold: 60, mode: 'scan', smoothing: 0.45, detail: 0.88 });
		expect(flow.options).toMatchObject({ threshold: 60, paper: 'scan', paperPicked: false });
		expect(getPhoto(editor.project, asset)).toMatchObject({ paper: 'scan', lightInk: false });
		expect(getPhoto(editor.project, asset).find.paper).toBe('photo');
	});
});

describe('Use it (4.4, 7.3)', () => {
	it('is one Undo step "traced Capital B": whole units, automatic spacing, the photo faded and locked', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		const result = await useIt(editor);
		expect(result).toMatchObject({ ok: true, title: 'traced Capital B', resized: [], moved: [] });
		expect(steps()).toEqual(['traced Capital B']);
		const b = editor.project.getItem(ID('B'));
		expect(hasInk(b)).toBe(true);
		expect(coords(b).every(Number.isInteger)).toBe(true);
		expect(Number.isInteger(b.advanceWidth) && b.advanceWidth > 0).toBe(true);
		expect(b.anyink.spacing).toBe('auto');
		expect(getTrace(b)).toMatchObject({ asset, opacity: USED_OPACITY, locked: true });
		expect(isAsTraced(b, asset)).toBe(true);
		const record = getPhoto(editor.project, asset);
		expect(Object.values(record.used)).toEqual([
			expect.objectContaining({ char: 'B', itemId: ID('B') }),
		]);
		expect(record.scale).toBeGreaterThan(0);
		expect(getFlow(editor)).toBeNull();
		expect(photoPreviewShapes(b, editor)).toBeNull();
	});

	it('Undo brings back the earlier shapes and photo in one press; the registry lets go of the part', async () => {
		const { asset } = await addLoose();
		editor.selectedGlyphID = ID('B');
		const b = editor.selectedItem;
		b.addOneShape(box(100, 0, 500, 700, 'his own'));
		b.addOneShape(box(600, 0, 700, 100, 'his dot'));
		const oldPhoto = { asset: 'img-old00001', width: 100, height: 100, x: 5, y: 900, scale: 3 };
		setTrace(b, oldPhoto);
		editor.history.addState('drew two boxes');
		// (Simple fitted the new ink, and the photo moved with it: B3)
		const before = JSON.stringify(b.shapes.map((s) => s.save()));
		const photoBefore = getTrace(b);
		expect(photoBefore.asset).toBe(oldPhoto.asset);

		await traceNext(asset, 'B');
		expect(getFlow(editor).replaces).toBe(2);
		await useIt(editor);
		expect(steps()).toEqual(['traced Capital B', 'drew two boxes']);

		editor.history.restoreState();
		await Promise.resolve();
		const back = editor.project.getItem(ID('B'));
		expect(JSON.stringify(back.shapes.map((s) => s.save()))).toBe(before);
		expect(getTrace(back)).toEqual(photoBefore);
		expect(steps()).toEqual(['drew two boxes']);
		expect(getPhoto(editor.project, asset).used).toEqual({});

		// Redo puts it back, and the part with it
		editor.history.redoState();
		await Promise.resolve();
		expect(getTrace(editor.project.getItem(ID('B'))).asset).toBe(asset);
		expect(Object.values(getPhoto(editor.project, asset).used)[0]).toMatchObject({ char: 'B' });
	});

	it('a letter he spaced himself goes back to automatic spacing (4.4: Use it fits it)', async () => {
		const { asset } = await addLoose();
		editor.selectedGlyphID = ID('B');
		const b = editor.selectedItem;
		b.addOneShape(box(300, 0, 700, 700, 'his own'));
		b.advanceWidth = 1500;
		b.anyink.spacing = 'manual';
		editor.history.addState('drew a box');
		await traceNext(asset, 'B');
		await useIt(editor);
		expect(b.anyink.spacing).toBe('auto');
		expect(b.advanceWidth).toBeLessThan(1500);
		expect(Math.round(inkBounds(b).xMin)).toBeGreaterThan(0);
	});

	it('Add to my shapes keeps the shapes the letter had', async () => {
		const { asset } = await addLoose();
		editor.selectedGlyphID = ID('B');
		editor.selectedItem.addOneShape(box(0, 0, 50, 50, 'his own'));
		editor.history.addState('drew a box');
		const flow = await traceNext(asset, 'B');
		await useIt(editor, { mode: 'add' });
		const b = editor.project.getItem(ID('B'));
		expect(b.shapes).toHaveLength(1 + flow.shapes);
		expect(b.shapes.some((s) => s.name === 'his own')).toBe(true);
		expect(steps()[0]).toBe('traced Capital B');
		// He drew part of it, so the letter is no longer "as traced" (never resized by the photo)
		expect(isAsTraced(b, asset)).toBe(false);
	});

	it('earlier untouched letters follow the new size in the same step, and the toast says which', async () => {
		const { asset } = await addLoose();
		// B alone sets the photo's size; naming r as well moves it about 10 %
		await traceNext(asset, 'B');
		await useIt(editor);
		const bScale = getTrace(editor.project.getItem(ID('B'))).scale;
		await traceNext(asset, 'r');
		const result = await useIt(editor);
		const newScale = getPhoto(editor.project, asset).scale;
		expect(Math.abs(newScale / bScale - 1)).toBeGreaterThan(0.03);
		expect(result.resized).toEqual(['B']);
		const b = editor.project.getItem(ID('B'));
		expect(getTrace(b).scale).toBeCloseTo(newScale, 6);
		expect(coords(b).every(Number.isInteger)).toBe(true);
		expect(isAsTraced(b, asset)).toBe(true);
		const said = toastLog().at(-1);
		expect(said.key).toBe('photoFlow.tracedResized');
		expect(said.text).toBe('Traced small r. Also resized Capital B to match the photo.');
		// One step (a whole-font one) for both letters; one press undoes both
		expect(steps().filter((t) => t === 'traced small r')).toHaveLength(1);
		editor.history.restoreState();
		await Promise.resolve();
		expect(getTrace(editor.project.getItem(ID('B'))).scale).toBeCloseTo(bScale, 9);
		expect(editor.project.getItem(ID('r')).shapes).toHaveLength(0);
		expect(getTrace(editor.project.getItem(ID('r')))).toBeNull();
		expect(Object.values(getPhoto(editor.project, asset).used).map((u) => u.char)).toEqual(['B']);
	});

	it('a letter he changed after tracing is never resized by a later letter', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		await useIt(editor);
		const b = editor.project.getItem(ID('B'));
		b.shapes[0].pathPoints[0].p.y -= 40;
		editor.history.addState('moved a point');
		const scale = getTrace(b).scale;
		await traceNext(asset, 'r');
		const result = await useIt(editor);
		expect(result.resized).toEqual([]);
		expect(getTrace(editor.project.getItem(ID('B'))).scale).toBe(scale);
	});

	it('the whole walk: seven Ready letters on the writing line, whole numbers, one step each', async () => {
		const { asset } = await addLoose();
		const chars = loose.key.letters.map((l) => l.char);
		for (const char of chars) {
			await traceNext(asset, char);
			expect((await useIt(editor)).ok).toBe(true);
		}
		const lines = guideLines(editor.project.settings.font);
		for (const char of chars) {
			const item = editor.project.getItem(ID(char));
			expect(hasInk(item), char).toBe(true);
			expect(coords(item).every(Number.isInteger), char).toBe(true);
			expect(item.advanceWidth, char).toBeGreaterThan(0);
			expect(Math.abs(inkBounds(item).yMin), `${char} on the writing line`).toBeLessThanOrEqual(
				0.02 * lines.box
			);
		}
		expect(guessPart(getPhoto(editor.project, asset))).toBeNull();
		expect(steps().filter((t) => t.startsWith('traced'))).toHaveLength(7);
	});
});

describe('Cancel and looking away (4.4, 7.3)', () => {
	it('Cancel puts back the old photo and its place, removes the photo it added, no Undo step', async () => {
		editor.selectedGlyphID = ID('B');
		const oldPhoto = { asset: 'img-old00002', width: 100, height: 100, x: 7, y: 800, scale: 2 };
		setTrace(editor.selectedItem, oldPhoto);
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		expect(getTrace(editor.project.getItem(ID('B'))).asset).toBe(asset);
		expect(cancelPart(editor)).toBe(true);
		expect(getTrace(editor.project.getItem(ID('B')))).toMatchObject(oldPhoto);
		expect(getFlow(editor)).toBeNull();
		expect(getPhoto(editor.project, asset)).toBeNull();
		expect(editor.assets.has(asset)).toBe(false);
		expect(steps()).toEqual([]);
	});

	it('Cancel keeps a photo that letters already use', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		await useIt(editor);
		await traceNext(asset, 'r');
		cancelPart(editor);
		expect(getPhoto(editor.project, asset)).not.toBeNull();
		expect(editor.assets.has(asset)).toBe(true);
		expect(getTrace(editor.project.getItem(ID('r')))).toBeNull();
	});

	it('opening another letter during step C puts this one back as it was', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		editor.selectedGlyphID = ID('c');
		expect(getFlow(editor)).toBeNull();
		expect(getTrace(editor.project.getItem(ID('B')))).toBeNull();
	});

	it('the flow is Simple only: leaving Simple ends it and puts the letter back', async () => {
		const { asset } = await addLoose();
		await traceNext(asset, 'B');
		setModeForTests('all');
		editor.publish('currentItem', editor.selectedItem);
		expect(getFlow(editor)).toBeNull();
		expect(getTrace(editor.project.getItem(ID('B')))).toBeNull();
	});
});
