// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 finalize: the second hostile pass on the photo screens and flow, each case as it
	happened in Chrome, on a real ProjectEditor in Simple with the photo hub started (as the app
	has it) and the tracer standing in (flow_fakes.js: the real binarize, one box per ink piece).
	- Following "Try More ink" on a part with no letter in it left Ink cutoff at 255, and every
	  later letter traced as a filled box; the card opened Adjust for a part no setting can fix.
	- A photo whose letter the edge cut, leaving one pen dot, went straight to step C and offered
	  the dot as the letter.
	- A box drawn round a letter in another pen said "No ink found" (the pen's mask lacked it).
	- Cancel after the photo's record had been saved left the status "Saved".
	- Step C's notes (two letters touching, a letter far past the lines) never showed.
	- A bold period was skipped as junk and could not be traced.
	Written to fail on the code before the finalize pass.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { getSaveStatus } from '../../files/save_status.js';
import { setModeForTests } from '../../mode/mode.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { word } from '../../words/words.js';
import { partFromBox } from '../ink_parts.js';
import { choosePart, initPhotos, resetPhotoAppForTests } from '../photo_app.js';
import { closePhotoCard, makePhotoCard, resetPhotoCardForTests } from '../photo_card.js';
import { closePhotoDialog } from '../photo_dialog.js';
import {
	addPhotoFile,
	adjustPart,
	cancelPart,
	getFlow,
	photoPixels,
	resetPhotoFlowForTests,
	startPart,
	whenFlowSettled,
} from '../photo_flow.js';
import { addDrawnPart, getPhoto, skipPart, unusedParts } from '../photo_registry.js';
import { fakeDecoder, fakeTrace } from './flow_fakes.js';
import { makePage } from './synthetic_page.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

const BLUE = [40, 70, 170];
// A punch hole as black as the pen, then three letters (a stem, an o, a stem)
const JUNK = makePage(800, 400)
	.disk(40, 160, 22)
	.bar(100, 100, 112, 220)
	.ring(250, 175, 45, 12)
	.bar(520, 130, 532, 220);
// One pen dot: the letter the photo's edge cut is gone
const DOT = makePage(600, 500).disk(300, 200, 15);
// Black letters, and one o in a blue pen
const TWO_PENS = makePage(900, 400)
	.bar(100, 100, 112, 220)
	.bar(200, 130, 212, 220)
	.bar(250, 130, 262, 220)
	.bar(200, 130, 262, 142)
	.ring(420, 180, 40, 12, BLUE)
	.bar(560, 100, 572, 220);
// Letters with a 14 px pen, then a period pressed hard (39 px)
const BOLD = makePage(800, 400)
	.bar(100, 100, 114, 240)
	.bar(180, 160, 194, 240)
	.bar(230, 160, 244, 240)
	.bar(180, 160, 244, 174)
	.ring(340, 200, 40, 14)
	.disk(440, 220, 19.5);

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
const dialog = () => document.querySelector('[data-anyink-dialog="photoDialog"]');
let editor;

beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});

beforeEach(() => {
	document.body.innerHTML = '';
	setModeForTests('simple');
	resetPhotoFlowForTests();
	resetPhotoCardForTests();
	setDecoderForTests(
		fakeDecoder({ 'junk.png': JUNK, 'dot.png': DOT, 'two.png': TWO_PENS, 'bold.png': BOLD })
	);
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = ID('a');
	initPhotos({ getEditor: () => editor });
});

afterEach(() => {
	closePhotoDialog();
	closePhotoCard();
	resetPhotoAppForTests();
	setDecoderForTests(null);
	resetPhotoFlowForTests();
	document.body.innerHTML = '';
});

async function add(page, name) {
	const added = await addPhotoFile(page.file(name), { editor });
	expect(added.ok).toBe(true);
	return added;
}

function partAtPx(asset, x, y) {
	const record = getPhoto(editor.project, asset);
	return record.parts.find(
		(p) => !p.drawn && x >= p.left && x < p.right && y >= p.top && y < p.bottom
	);
}

async function trace(asset, partId, char) {
	await startPart({ editor, asset, partId, char });
	return whenFlowSettled(editor);
}

describe('no ink on a part with no letter: the box is the fix, and the cutoff starts on Auto again', () => {
	it('"No letter found", Adjust stays shut, and a cutoff that found nothing is not kept', async () => {
		const { asset } = await add(JUNK, 'junk.png');
		const hole = partAtPx(asset, 40, 160);
		let flow = await trace(asset, hole.id, 'o');
		expect(flow.status).toBe('no-ink');
		expect(flow.error.code).toBe('no-letter');
		expect(word(flow.error.key)).toBe(
			'No letter found in that part. Draw the box again around the letter.'
		);
		// He drags Ink cutoff to the "more ink" end anyway: still nothing
		adjustPart(editor, { threshold: 255 });
		flow = await whenFlowSettled(editor);
		expect(flow.status).toBe('no-ink');
		// The next part (a real letter) starts on Auto, not at 255
		const o = partAtPx(asset, 250, 140);
		flow = await trace(asset, o.id, 'o');
		expect(flow.options.threshold).toBe('auto');
		expect(flow.status).toBe('ready');
		expect(flow.shapes).toBe(1);
		cancelPart(editor);
	});

	it('a cutoff he set that gave a letter is kept for the next part', async () => {
		const { asset } = await add(JUNK, 'junk.png');
		await trace(asset, partAtPx(asset, 105, 150).id, 'l');
		adjustPart(editor, { threshold: 140 });
		expect((await whenFlowSettled(editor)).status).toBe('ready');
		const flow = await trace(asset, partAtPx(asset, 250, 140).id, 'o');
		expect(flow.options.threshold).toBe(140);
		cancelPart(editor);
	});

	it('the card: no letter keeps Adjust shut with [Draw a box] green; no ink opens it', () => {
		const state = (code) => ({
			step: 'result',
			char: 'o',
			status: 'no-ink',
			error: { code, key: code === 'no-letter' ? 'photoFlow.noLetter' : 'photoFlow.noInk' },
		});
		const body = (card) => card.element.querySelector('[data-anyink-photo-card-adjust-body]');
		const green = (card) =>
			card.element
				.querySelector('.anyink-primary:not([hidden])')
				?.getAttribute('data-anyink-photo-card-action');
		const none = makePhotoCard(state('no-letter'));
		expect(body(none).hidden).toBe(true);
		expect(green(none)).toBe('drawBox');
		const dark = makePhotoCard(state('no-ink'));
		expect(body(dark).hidden).toBe(false);
	});
});

describe("step C's notes show on the card", () => {
	it('two letters touching and a letter far above the top line: a quiet line each', () => {
		const card = makePhotoCard({
			step: 'result',
			char: 'f',
			status: 'ready',
			notes: [
				{ key: 'photoFlow.note.twoLetters', vars: {} },
				{ key: 'photoFlow.note.reachesAbove', vars: { letter: 'small f' } },
			],
		});
		const lines = [...card.element.querySelectorAll('[data-anyink-photo-card-note]')].map(
			(line) => line.textContent
		);
		expect(lines).toEqual([
			word('photoFlow.note.twoLetters'),
			'small f reaches far above the top line, so lines of text in your font will sit further apart.',
		]);
		card.update({ step: 'result', char: 'f', status: 'tracing', notes: [] });
		expect(card.element.querySelector('[data-anyink-photo-card-notes]').hidden).toBe(true);
	});
});

describe('a photo that is only a dot opens the dialog, never step C', () => {
	it('dropped on small y: "Which part is your small y?" with no green box on the dot', async () => {
		const { asset } = await add(DOT, 'dot.png');
		editor.selectedGlyphID = ID('y');
		expect(await choosePart(editor, asset, { char: 'y', itemId: ID('y') })).toBe(true);
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(getFlow(editor)).toBe(null);
		expect(dialog().querySelector('[data-anyink-picked]')).toBe(null);
	});
});

describe('Draw a box always reaches what he sees (a letter in another pen)', () => {
	it("a box round the blue o tightens to it and traces it, though the pen's mask lacks it", async () => {
		const { asset } = await add(TWO_PENS, 'two.png');
		const pixels = await photoPixels(editor, asset);
		const record = getPhoto(editor.project, asset);
		const box = { left: 370, top: 130, right: 470, bottom: 230 };
		// the pen's ink leaves the blue o out (one letter of another color)
		expect(partFromBox(pixels.mask, record.width, record.height, box)).toBe(null);
		const tight = partFromBox(pixels.mask, record.width, record.height, box, {
			ink: pixels.ink,
		});
		expect(tight.fullInk).toBe(true);
		expect(
			[tight.left, tight.top, tight.right, tight.bottom].map((v) => Math.round(v / 10))
		).toEqual([38, 14, 46, 22]);
		const drawn = addDrawnPart(record, tight);
		const flow = await trace(asset, drawn.id, 'o');
		expect(flow.status).toBe('ready');
		expect(flow.shapes).toBe(1);
		cancelPart(editor);
	});
});

describe('Cancel after the photo was saved tells the file', () => {
	it('a photo taken back out marks the work file behind', async () => {
		const { asset } = await add(JUNK, 'junk.png');
		skipPart(getPhoto(editor.project, asset), partAtPx(asset, 105, 150).id);
		const revision = getSaveStatus(editor).revision || 0;
		expect(cancelPart(editor)).toBe(true);
		expect(getPhoto(editor.project, asset)).toBe(null);
		expect(getSaveStatus(editor).revision).toBeGreaterThan(revision);
	});
});

describe('a period pressed hard is a letter part', () => {
	it('not skipped as the photo comes in, and traced as one shape', async () => {
		const { asset } = await add(BOLD, 'bold.png');
		const record = getPhoto(editor.project, asset);
		const period = partAtPx(asset, 440, 220);
		expect(period).toBeTruthy();
		expect(record.skipped).not.toContain(period.id);
		expect(unusedParts(record)).toContain(period.id);
		const flow = await trace(asset, period.id, '.');
		expect(flow.status).toBe('ready');
		expect(flow.shapes).toBe(1);
		cancelPart(editor);
	});
});
