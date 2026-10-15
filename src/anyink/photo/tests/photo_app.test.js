// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: the photo screens wired to the photo flow (photo_app.js; UX-BEGINNER.md 4.4,
	4.5, 4.0 rules 11 and 12, 7.7), on a real ProjectEditor in Simple with the flags as the app has
	them. Every way in: rule 11's [How] and the How card's [I have my photo] (the picker in the
	press, in Downloads), the dialog's Trace it, step C in the photo card with Use it and Cancel,
	rule 12's [Do the next one], [Trace again], the empty letter's doors, a photo dropped on a
	letter, and the HEIC message with its fix. jsdom can't decode a JPEG or run the potrace worker,
	so as in photo_flow.test.js the fixture photo is decoded with sharp and the tracer is
	flow_fakes.js.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { hasInk } from '../../board/letter_set.js';
import { runCoachAction } from '../../coach/actions.js';
import { getCoach } from '../../coach/coach_state.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { getSaveStatus } from '../../files/save_status.js';
import { fakeApi } from '../../files/tests/fakes.js';
import { TRACE_AGAIN_EVENT } from '../../letter/letter_card.js';
import { setModeForTests } from '../../mode/mode.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { importTraceImage } from '../../trace/trace_import.js';
import { getTrace } from '../../trace/trace_model.js';
import { word } from '../../words/words.js';
import { closeHowCard } from '../how_card.js';
import { PHOTO_PICKER_ID, initPhotos, photoSources, resetPhotoAppForTests } from '../photo_app.js';
import { closePhotoCard, photoCardElement, photoCardState, resetPhotoCardForTests } from '../photo_card.js';
import { closePhotoDialog } from '../photo_dialog.js';
import { openPhotoDoor } from '../photo_doors.js';
import { getFlow, resetPhotoFlowForTests, whenFlowSettled } from '../photo_flow.js';
import { getPhoto, guessPart, photosOf, skipPart, usedChar } from '../photo_registry.js';
import { loadPhotoFixture } from './fixture_image.js';
import { fakeDecoder } from './flow_fakes.js';

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
let single;
let api;
let nextFile;

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
const steps = () => editor.history.queue.map((entry) => entry.title);
const dialog = () => document.querySelector('[data-anyink-dialog="photoDialog"]');
const howCard = () => document.querySelector('[data-anyink-dialog="howCard"]');
const inDialog = (selector) => dialog()?.querySelector(selector) || null;
const dialogAction = (name) => inDialog(`[data-anyink-photo-action="${name}"]`);
const cardAction = (name) =>
	photoCardElement()?.querySelector(`[data-anyink-photo-card-action="${name}"]`) || null;
const pickedPart = () =>
	inDialog('[data-anyink-picked]')?.getAttribute('data-anyink-part') || null;

const ftyp = () => Uint8Array.from('\0\0\0\x18ftypheic\0\0\0\0mif1heic', (c) => c.charCodeAt(0));
const looseFile = () => new File([loose.bytes], 'brenna-loose.jpg', { type: 'image/jpeg' });
const singleFile = () => new File([single.bytes], 'single-j.jpg', { type: 'image/jpeg' });

/** He types a letter in the dialog's field. */
function type(char) {
	const field = inDialog('[data-anyink-photo-field]');
	field.value = char;
	field.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }));
}

/** Waits for step C to have a result to use. */
async function stepC() {
	await vi.waitFor(() => expect(getFlow(editor)).not.toBe(null));
	return whenFlowSettled(editor);
}

beforeAll(async () => {
	loose = await loadPhotoFixture('brenna-loose-phone');
	single = await loadPhotoFixture('single-j-phone');
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});

beforeEach(() => {
	document.body.innerHTML = '';
	setModeForTests('simple');
	resetPhotoFlowForTests();
	resetPhotoCardForTests();
	setDecoderForTests(
		fakeDecoder({
			'brenna-loose.jpg': loose.image,
			'single-j.jpg': single.image,
		})
	);
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x61';
	nextFile = looseFile;
	api = fakeApi({ open: () => [{ getFile: async () => nextFile() }] });
	setFileApi(api);
	initPhotos({ getEditor: () => editor });
});

afterEach(() => {
	closePhotoDialog();
	closeHowCard();
	closePhotoCard();
	resetPhotoAppForTests();
	resetFileApi();
	setDecoderForTests(null);
	resetPhotoFlowForTests();
	document.body.innerHTML = '';
});

describe('rule 11 [How] -> the How card -> [I have my photo] -> the dialog (section 3, 0:01-0:03)', () => {
	it('opens the picker in the press, in Downloads; the How card closes; the dialog asks which letter', async () => {
		expect(runCoachAction('how', null, { editor })).toBe(true);
		expect(howCard()).not.toBe(null);
		howCard().querySelector('[data-anyink-how-action="havePhoto"]').click();
		// in the same press, before anything is awaited (the browser needs the click)
		expect(api.calls.open).toHaveLength(1);
		expect(api.calls.open[0]).toMatchObject({ id: PHOTO_PICKER_ID, startIn: 'downloads' });
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(howCard()).toBe(null);
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('unknown');
		const record = getPhoto(editor.project, Object.keys(photosOf(editor.project))[0]);
		expect(record.parts).toHaveLength(7);
		expect(pickedPart()).toBe(guessPart(record));
		// picking a photo is no Undo step (7.3)
		expect(steps()).toEqual([]);
	});

	it('a cancelled picker keeps the How card open and adds nothing', async () => {
		api = fakeApi({ open: () => Object.assign(new Error('cancelled'), { name: 'AbortError' }) });
		setFileApi(api);
		runCoachAction('how', null, { editor });
		howCard().querySelector('[data-anyink-how-action="havePhoto"]').click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(howCard()).not.toBe(null);
		expect(photosOf(editor.project)).toBe(null);
	});
});

describe('the dialog -> step C in the photo card -> Use it (section 3, 0:03-0:04)', () => {
	it('Trace it opens the letter at step C; Use it puts it in as one step "traced Capital B"', async () => {
		runCoachAction('how', null, { editor });
		howCard().querySelector('[data-anyink-how-action="havePhoto"]').click();
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		type('B');
		dialogAction('trace').click();
		const flow = await stepC();
		expect(flow).toMatchObject({ char: 'B', status: 'ready' });
		expect(editor.selectedGlyphID).toBe(ID('B'));
		// the photo card shows step C and tells the Next line (rule 3)
		expect(photoCardState()).toMatchObject({ step: 'result', char: 'B', green: 'action.useIt' });
		expect(getCoach().facts().photoCard).toMatchObject({ step: 'result' });
		cardAction('useIt').click();
		await vi.waitFor(() => expect(getFlow(editor)).toBe(null));
		expect(photoCardState()).toBe(null);
		const b = editor.project.getItem(ID('B'));
		expect(hasInk(b)).toBe(true);
		expect(getTrace(b)).toMatchObject({ locked: true, opacity: 0.25 });
		expect(steps()).toEqual([word('history.traced', { letter: 'Capital B' })]);
	});

	it("step C's Cancel ends it: the card closes, the photo the screens added goes, no step", async () => {
		await importTraceImage(looseFile(), { editor });
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		dialogAction('trace').click();
		await stepC();
		cardAction('cancel').click();
		await vi.waitFor(() => expect(photoCardState()).toBe(null));
		await vi.waitFor(() => expect(Object.keys(photosOf(editor.project) || {})).toEqual([]));
		expect(steps()).toEqual([]);
	});

	it('"Wrong part? Draw a box", then Cancel in the dialog: step C stays as it was', async () => {
		await importTraceImage(looseFile(), { editor });
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		dialogAction('trace').click();
		const before = await stepC();
		cardAction('drawBox').click();
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('known');
		expect(pickedPart()).toBe(before.partId);
		dialogAction('cancel').click();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(getFlow(editor)).toMatchObject({ partId: before.partId, status: 'ready' });
		expect(photoCardState()).toMatchObject({ step: 'result' });
	});

	it('Cancel in a dialog with nothing behind it takes out the photo it added', async () => {
		runCoachAction('how', null, { editor });
		howCard().querySelector('[data-anyink-how-action="havePhoto"]').click();
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		// the letter unknown has no Cancel of its own: the x (or Escape) cancels it
		dialogAction('close').click();
		await vi.waitFor(() => expect(Object.keys(photosOf(editor.project) || {})).toEqual([]));
		expect(editor.assets.ids()).toEqual([]);
	});
});

describe('a photo dropped or pasted on a letter (4.3, 4.5)', () => {
	it('becomes this letter photo: the dialog asks which part is the open letter', async () => {
		editor.selectedGlyphID = ID('e');
		expect(await importTraceImage(looseFile(), { editor })).toBe(true);
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('known');
		expect(dialog().textContent).toContain(word('photo.dialog.titleKnown', { letter: 'small e' }));
		// never the Trace panel's way: no trace image step, no panel
		expect(steps()).toEqual([]);
		expect(editor.nav.panel).not.toBe('Trace');
	});

	it('a photo with one part, dropped on a letter, goes straight to step C (4.4 step B)', async () => {
		editor.selectedGlyphID = ID('j');
		await importTraceImage(singleFile(), { editor });
		const flow = await stepC();
		expect(dialog()).toBe(null);
		expect(flow).toMatchObject({ char: 'j' });
		expect(photoCardState()).toMatchObject({ step: 'result', char: 'j' });
	});
});

describe("what can't be used says so in plain words, with its fix (7.7)", () => {
	it("an iPhone HEIC photo: the error box's words, and [Choose another photo] opens the picker again", async () => {
		nextFile = () => new File([ftyp()], 'IMG_4410.HEIC', { type: '' });
		runCoachAction('how', null, { editor });
		howCard().querySelector('[data-anyink-how-action="havePhoto"]').click();
		await vi.waitFor(() => expect(document.querySelector('#error')).not.toBe(null));
		const box = document.querySelector('#error');
		expect(box.textContent).toContain(word('toast.photoHeic'));
		const fix = box.querySelector('[data-anyink-choice="photoFlow.button.chooseAnother"]');
		expect(fix).not.toBe(null);
		expect(fix.classList.contains('anyink-primary')).toBe(true);
		nextFile = looseFile;
		fix.click();
		expect(api.calls.open).toHaveLength(2);
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(photosOf(editor.project)).not.toBe(null);
	});
});

describe('rule 12, [Trace again] and the empty letter doors', () => {
	async function oneLetterUsed() {
		await importTraceImage(looseFile(), { editor });
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		dialogAction('trace').click();
		await stepC();
		cardAction('useIt').click();
		await vi.waitFor(() => expect(getFlow(editor)).toBe(null));
		return getPhoto(editor.project, Object.keys(photosOf(editor.project))[0]);
	}

	it("rule 12's [Do the next one]: the dialog on that photo, the green box on its next part", async () => {
		const record = await oneLetterUsed();
		expect(photoSources(editor)).toEqual([{ id: record.asset, unused: 6, done: false }]);
		expect(runCoachAction('nextPart', { photoId: record.asset }, { editor })).toBe(true);
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('unknown');
		expect(pickedPart()).toBe(guessPart(record));
	});

	it('Skip in the dialog marks the work file behind, with no Undo step, and rule 12 counts one fewer', async () => {
		const record = await oneLetterUsed();
		const revision = getSaveStatus(editor).revision;
		const stepCount = editor.history.queue.length;
		runCoachAction('nextPart', { photoId: record.asset }, { editor });
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		dialogAction('skip').click();
		expect(getSaveStatus(editor).revision).toBeGreaterThan(revision);
		expect(editor.history.queue.length).toBe(stepCount);
		expect(photoSources(editor)[0].unused).toBe(5);
	});

	it('[Trace again] opens the dialog with the letter known, on the part it used', async () => {
		const record = await oneLetterUsed();
		const used = Object.keys(record.used)[0];
		globalThis.dispatchEvent(new CustomEvent(TRACE_AGAIN_EVENT, { detail: { itemId: ID('a') } }));
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('known');
		expect(pickedPart()).toBe(used);
		expect(usedChar(record, used)).toBe('a');
	});

	it("the empty letter's doors: [Use the same photo], [Use a photo] (step A) and How", async () => {
		const record = await oneLetterUsed();
		editor.selectedGlyphID = ID('r');
		openPhotoDoor('samePhoto', { char: 'r', itemId: ID('r') });
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('known');
		// the guess for the letter it opened for (photo_registry.js guessPart with its char)
		expect(pickedPart()).toBe(guessPart(record, { char: 'r' }));
		closePhotoDialog();
		openPhotoDoor('pick', { char: 'r', itemId: ID('r') });
		expect(photoCardState()).toMatchObject({ step: 'pick', char: 'r' });
		expect(
			photoCardElement().querySelectorAll('[data-anyink-photo-card-action="photo"]')
		).toHaveLength(1);
		// step A belongs to its letter: another letter closes it as Cancel does
		editor.selectedGlyphID = ID('e');
		expect(photoCardState()).toBe(null);
		openPhotoDoor('how', { char: 'e', itemId: ID('e') });
		expect(howCard()).not.toBe(null);
	});

	it('rule 12 counts only photos whose image is in the font, and never a skipped part', async () => {
		const record = await oneLetterUsed();
		skipPart(record, guessPart(record));
		expect(photoSources(editor)).toEqual([{ id: record.asset, unused: 5, done: false }]);
		editor.assets.delete(record.asset);
		expect(photoSources(editor)).toEqual([]);
	});
});
