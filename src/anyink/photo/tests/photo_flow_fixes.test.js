// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow fix pass: the B8 + B9 critics' findings, each as it happened, on a real
// ProjectEditor in Simple with the real registry, parts finder, placement, spacing hook and
// history (the tracer is flow_fakes.js fakeTrace: the real binarize, one box per ink piece).
// - a part of nothing but specks replaced a good letter, and junk parts got the green box
// - a box round one of two touching letters took in the other's cut leg
// - a letter written far too big went in with nothing said
// - a save during step C kept its placement, and Cancel never told the file
// - the same photo added twice at once got two image ids
// - after a Use it that resized earlier letters, the rail counted one letter too few
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { autoTraceImageData } from '../../autotrace/autotrace.js';
import { setModeForTests } from '../../mode/mode.js';
import { makeSimpleTopBar } from '../../topbar/simple_top_bar.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { word } from '../../words/words.js';
import { loadPhotoFixture } from './fixture_image.js';
import { box, fakeDecoder, fakeTrace } from './flow_fakes.js';
import { makePage } from './synthetic_page.js';
import { partFromBox } from '../ink_parts.js';
import { samePhoto } from '../photo_doors.js';
import {
	adjustPart,
	addPhotoFile,
	cancelPart,
	getFlow,
	photoPixels,
	photoPreviewShapes,
	resetPhotoFlowForTests,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import {
	addDrawnPart,
	getPhoto,
	guessPart,
	photoSummaries,
	photosOf,
	unusedParts,
} from '../photo_registry.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
const steps = () => editor.history.queue.map((entry) => entry.title);
const shapesOf = (char) => editor.project.getItem(ID(char))?.shapes || [];
const print = (shapes) => JSON.stringify(shapes.map((s) => s.save()));

let editor;
let loose;

// A page with a punch hole (as black as the pen), a stem, an o, a short dark bit of a ruled
// line and another stem: only the three letters are letters
const JUNK = makePage(800, 400)
	.disk(40, 160, 22)
	.bar(100, 100, 112, 220)
	.ring(250, 175, 45, 12)
	.bar(400, 210, 416, 213)
	.bar(520, 130, 532, 220);
// An l, then an n and an a written touching (one part), then an o
const TOUCHING = makePage(700, 400)
	.bar(120, 150, 132, 270)
	.bar(300, 180, 312, 270)
	.bar(350, 180, 362, 270)
	.bar(300, 180, 362, 192)
	.ring(396, 230, 36, 12)
	.ring(560, 230, 36, 12);
// Two small letters, a stem the size of the tall letters, and an f written half again as tall
const BIG = makePage(900, 700)
	.bar(600, 278, 612, 440)
	.ring(150, 400, 40, 12)
	.ring(300, 400, 40, 12)
	.bar(440, 332, 452, 440);

beforeEach(async () => {
	loose ||= await loadPhotoFixture('brenna-loose-phone');
	document.body.innerHTML = '';
	setModeForTests('simple');
	resetPhotoFlowForTests();
	fakeTrace.calls.length = 0;
	vi.mocked(autoTraceImageData).mockReset();
	vi.mocked(autoTraceImageData).mockImplementation(fakeTrace);
	setDecoderForTests(
		fakeDecoder({
			'brenna-loose.jpg': loose.image,
			'junk.png': JUNK,
			'touching.png': TOUCHING,
			'big.png': BIG,
		})
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

async function addLoose() {
	const added = await addPhotoFile(
		new File([loose.bytes], 'brenna-loose.jpg', { type: 'image/jpeg' }),
		{
			editor,
		}
	);
	expect(added.ok).toBe(true);
	return added;
}

async function addPage(page, name) {
	const added = await addPhotoFile(page.file(name), { editor });
	expect(added.ok).toBe(true);
	return added;
}

async function trace(asset, partId, char) {
	await startPart({ editor, asset, partId, char });
	return whenFlowSettled(editor);
}

/** The part of the photo whose box holds pixel (x, y). */
function partAtPx(asset, x, y) {
	const record = getPhoto(editor.project, asset);
	return record.parts.find(
		(p) => !p.drawn && x >= p.left && x < p.right && y >= p.top && y < p.bottom
	);
}

describe('a part of nothing but specks never replaces a letter (first-timer: H became 4 dots)', () => {
	it('step C says "No ink found", Use it changes nothing, and the letter keeps its shapes', async () => {
		const { asset } = await addLoose();
		const partId = guessPart(getPhoto(editor.project, asset));
		await trace(asset, partId, 'B');
		expect((await useIt(editor)).ok).toBe(true);
		const before = print(shapesOf('B'));
		const stepsBefore = steps();

		// The same letter again, from a part whose trace is four tiny dashes of a ruled line,
		// inside the part's box (photo pixels: font units through the placement)
		const part = getPhoto(editor.project, asset).parts.find((p) => p.id === partId);
		vi.mocked(autoTraceImageData).mockImplementationOnce(async (imageData, options, placement) => {
			const { x, y, scale } = placement;
			const at = (px, py) => [x + px * scale, y - py * scale];
			const shapes = [0, 1, 2, 3].map((i) => {
				const [x0, y0] = at(part.left + 4 + i * 9, part.bottom - 6);
				const [x1, y1] = at(part.left + 8 + i * 9, part.bottom - 4);
				return box(x0, y0, x1, y1, `dash ${i}`);
			});
			return { shapes, points: 16, autoThreshold: 128, threshold: 128 };
		});
		const flow = await trace(asset, partId, 'B');
		expect(flow.status).toBe('no-ink');
		// (finalize: specks alone are no letter, whatever the cutoff: the box is the fix)
		expect(flow.error.code).toBe('no-letter');
		expect(flow.shapes).toBe(0);
		expect((await useIt(editor)).ok).toBe(false);
		expect(print(shapesOf('B'))).toBe(before);
		expect(steps()).toEqual(stepsBefore);
	});

	it('a punch hole and a short dark ruled-line bit never get the green box or count as letters', async () => {
		const { asset } = await addPage(JUNK, 'junk.png');
		const record = getPhoto(editor.project, asset);
		const hole = partAtPx(asset, 40, 160);
		const bit = partAtPx(asset, 405, 211);
		const letters = [
			partAtPx(asset, 105, 150),
			partAtPx(asset, 250, 140),
			partAtPx(asset, 525, 150),
		];
		expect(hole && bit && letters.every(Boolean)).toBe(true);
		// The guess starts on the first letter, not on the hole left of it
		expect(guessPart(record)).toBe(letters[0].id);
		expect(unusedParts(record)).toEqual(letters.map((p) => p.id));
		expect(photoSummaries(editor.project)).toEqual([{ id: asset, unused: 3, done: false }]);
		// Named on purpose, the hole still traces to nothing: "No ink found"
		const flow = await trace(asset, hole.id, 'o');
		expect(flow.status).toBe('no-ink');
		cancelPart(editor);
	});

	it('once every letter is named, [Use the same photo] has no photo to offer', async () => {
		const { asset } = await addPage(JUNK, 'junk.png');
		const named = ['l', 'o', 'i'];
		for (const char of named) {
			const partId = guessPart(getPhoto(editor.project, asset));
			expect(partId, char).toBeTruthy();
			await trace(asset, partId, char);
			expect((await useIt(editor)).ok, char).toBe(true);
		}
		expect(guessPart(getPhoto(editor.project, asset))).toBeNull();
		expect(samePhoto(editor)).toBeNull();
	});

	it('a bit of ruled line traced in the corner of the F stays out while Remove specks is on', async () => {
		const { asset } = await addLoose();
		const record = getPhoto(editor.project, asset);
		const partId = guessPart(record);
		const part = record.parts.find((p) => p.id === partId);
		// The tracer gives an F filling the part's box, and 12 x 2 pixels of blue rule in the
		// empty corner of that box, at its lower right (C-04-Shiftx43F.png)
		const fAndRule = async (imageData, options, placement) => {
			const { x, y, scale } = placement;
			const at = ([px, py]) => ({ p: { coord: { x: x + px * scale, y: y - py * scale } } });
			const { left: l, top: t, right: r, bottom: b } = part;
			const w = Math.max(4, Math.round((r - l) / 5));
			const f = new Path({
				name: 'F',
				pathPoints: [
					[l, b],
					[l + w, b],
					[l + w, t + 2 * w],
					[r - w, t + 2 * w],
					[r - w, t + 3 * w],
					[l + w, t + 3 * w],
					[l + w, t + w],
					[r, t + w],
					[r, t],
					[l, t],
				].map(at),
			});
			const [x0, y0] = [x + (r - 14) * scale, y - (b - 2) * scale];
			const [x1, y1] = [x + (r - 2) * scale, y - (b - 4) * scale];
			const rule = box(x0, y0, x1, y1, 'rule');
			return { shapes: [f, rule], points: 14, autoThreshold: 128, threshold: 128 };
		};
		vi.mocked(autoTraceImageData).mockImplementation(fAndRule);
		const seen = await trace(asset, partId, 'F');
		expect(seen.status).toBe('ready');
		expect(seen.shapes).toBe(1);
		// Remove specks off: he asked for everything, so the bit comes in
		adjustPart(editor, { despeckle: false });
		expect((await whenFlowSettled(editor)).shapes).toBe(2);
		adjustPart(editor, { despeckle: true });
		await whenFlowSettled(editor);
		expect((await useIt(editor)).ok).toBe(true);
		expect(shapesOf('F').map((shape) => shape.name)).toEqual(['F']);
	});
});

describe('two letters written touching (first-timer: "na", V and W)', () => {
	it('naming the touching part says two letters may touch, and how to fix it', async () => {
		const { asset } = await addPage(TOUCHING, 'touching.png');
		const na = partAtPx(asset, 330, 200);
		expect(na.right - na.left).toBeGreaterThan(120);
		const flow = await trace(asset, na.id, 'n');
		expect(flow.status).toBe('ready');
		expect(flow.notes.map((note) => note.key)).toContain('photoFlow.note.twoLetters');
		expect(word(flow.notes[0].key, flow.notes[0].vars)).toBe(
			'This part may be two letters that touch. If so, press Draw a box and drag a box around each one.'
		);
		// A letter alone has no such note (naming another letter ends this step C)
		const o = partAtPx(asset, 560, 200);
		expect((await trace(asset, o.id, 'o')).notes).toEqual([]);
		cancelPart(editor);
	});

	it("a box round the a traces the a without the n's cut leg (the a read 'la')", async () => {
		const { asset } = await addPage(TOUCHING, 'touching.png');
		const pixels = await photoPixels(editor, asset);
		const record = getPhoto(editor.project, asset);
		// He drags from just inside the n's right leg (x 350..362) round the a (x 360..432)
		const tight = partFromBox(pixels.mask, record.width, record.height, {
			left: 354,
			top: 175,
			right: 440,
			bottom: 275,
		});
		expect(tight.left).toBe(354);
		const drawn = addDrawnPart(record, tight);
		const flow = await trace(asset, drawn.id, 'a');
		expect(flow.status).toBe('ready');
		const item = editor.project.getItem(ID('a'));
		const t = getTrace(item);
		const shapes = photoPreviewShapes(item, editor);
		const xs = shapes.flatMap((s) => s.pathPoints.map((pp) => (pp.p.x - t.x) / t.scale));
		// The a's own ink starts at x 360; the leg's sliver at 354 is gone
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(359);
		expect(Math.max(...xs)).toBeLessThanOrEqual(433);
		cancelPart(editor);
	});
});

describe('a letter written far too big says so (first-timer: the f reached 2378 units)', () => {
	it('step C notes that it reaches far above the top line; letters that fit have no note', async () => {
		const { asset } = await addPage(BIG, 'big.png');
		const named = [
			[partAtPx(asset, 150, 380), 'o'],
			[partAtPx(asset, 300, 380), 'c'],
			[partAtPx(asset, 445, 380), 'l'],
		];
		for (const [part, char] of named) {
			const flow = await trace(asset, part.id, char);
			expect(flow.notes, char).toEqual([]);
			expect((await useIt(editor)).ok, char).toBe(true);
		}
		const flow = await trace(asset, partAtPx(asset, 605, 300).id, 'f');
		expect(flow.status).toBe('ready');
		expect(flow.notes).toEqual([
			{ key: 'photoFlow.note.reachesAbove', vars: { letter: 'small f' } },
		]);
		expect(word(flow.notes[0].key, flow.notes[0].vars)).toBe(
			'small f reaches far above the top line, so lines of text in your font will sit further apart.'
		);
		cancelPart(editor);
	});
});

describe('step C is never saved (a save during it kept its placement; Cancel never told the file)', () => {
	it('every saved copy holds the earlier photo during step C, and Cancel leaves the file as it was', async () => {
		editor.selectedGlyphID = ID('B');
		const oldPhoto = { asset: 'img-old00003', width: 100, height: 100, x: 5, y: 900, scale: 3 };
		setTrace(editor.selectedItem, oldPhoto);
		const { asset } = await addLoose();
		await trace(asset, guessPart(getPhoto(editor.project, asset)), 'B');
		const item = editor.project.getItem(ID('B'));
		// What he sees is step C's placement...
		expect(getTrace(item).asset).toBe(asset);
		// ...but the work file, a crash snapshot and the leave warning (project.save()) and an
		// Undo step (the letter's own save()) hold the photo it had
		expect(editor.project.save().glyphs[ID('B')].anyink.trace).toMatchObject(oldPhoto);
		expect(item.save().anyink.trace).toMatchObject(oldPhoto);
		expect(getTrace(item).asset).toBe(asset);

		cancelPart(editor);
		expect(getTrace(item)).toMatchObject(oldPhoto);
		expect(editor.project.save().glyphs[ID('B')].anyink.trace).toMatchObject(oldPhoto);
		expect(Object.hasOwn(item, 'save')).toBe(false);
	});

	it('after Use it the letter saves with its new photo, in the step and in the file', async () => {
		const { asset } = await addLoose();
		await trace(asset, guessPart(getPhoto(editor.project, asset)), 'B');
		expect((await useIt(editor)).ok).toBe(true);
		const item = editor.project.getItem(ID('B'));
		const saved = editor.project.save().glyphs[ID('B')].anyink.trace;
		expect(saved).toMatchObject({ asset, opacity: 0.25, locked: true });
		expect(Object.hasOwn(item, 'save')).toBe(false);
		// The Undo step holds it too: Undo, then Redo, brings it back
		editor.history.restoreState();
		await Promise.resolve();
		editor.history.redoState();
		await Promise.resolve();
		expect(getTrace(editor.project.getItem(ID('B')))).toMatchObject({ asset, opacity: 0.25 });
	});

	it('a letter with no photo before saves with none during step C', async () => {
		const { asset } = await addLoose();
		await trace(asset, guessPart(getPhoto(editor.project, asset)), 'r');
		expect(getTrace(editor.project.getItem(ID('r'))).asset).toBe(asset);
		expect(editor.project.save().glyphs[ID('r')]?.anyink?.trace).toBeUndefined();
		cancelPart(editor);
	});
});

describe("the rail's ready count after Use it (first-timer: 4/58 with five letters ready)", () => {
	it('counts the new letter at once, also when earlier letters followed its size', async () => {
		const bar = makeSimpleTopBar(editor);
		document.body.append(bar);
		const count = () => bar.querySelector('[data-anyink-step="letters"]').textContent;
		const { asset } = await addLoose();
		const seen = [];
		for (const char of ['B', 'r', 'e']) {
			await trace(asset, guessPart(getPhoto(editor.project, asset)), char);
			const result = await useIt(editor);
			seen.push({ char, followed: result.resized.length + result.moved.length, count: count() });
		}
		// r and e each resized the letters before them: whole-font steps
		expect(seen.map((s) => s.followed > 0)).toEqual([false, true, true]);
		expect(seen.map((s) => s.count.match(/\d+\/\d+/)[0])).toEqual(['1/58', '2/58', '3/58']);
	});
});

describe('one image id per photo, also when it comes in twice at once', () => {
	it('two quick drops of one photo: one image, one record, and both open it', async () => {
		const slow = fakeDecoder({ 'brenna-loose.jpg': loose.image });
		setDecoderForTests({
			decode: (file, options) =>
				new Promise((resolve) => setTimeout(() => resolve(slow.decode(file, options)), 50)),
			encode: slow.encode,
		});
		const file = () => new File([loose.bytes], 'brenna-loose.jpg', { type: 'image/jpeg' });
		const [a, b] = await Promise.all([
			addPhotoFile(file(), { editor }),
			addPhotoFile(file(), { editor }),
		]);
		expect(a).toMatchObject({ ok: true, added: true });
		expect(b).toMatchObject({ ok: true, added: false, asset: a.asset });
		expect(editor.assets.ids()).toEqual([a.asset]);
		expect(Object.keys(photosOf(editor.project))).toEqual([a.asset]);
		expect(getPhoto(editor.project, b.asset)).not.toBeNull();
		// The second one's screen opens on the photo
		const flow = await trace(b.asset, guessPart(getPhoto(editor.project, b.asset)), 'B');
		expect(flow.status).toBe('ready');
		cancelPart(editor);
		expect(getFlow(editor)).toBeNull();
	});
});
