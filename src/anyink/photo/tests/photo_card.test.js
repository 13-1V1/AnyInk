// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-ui: the photo card in the letter card, steps A and C (docs/UX-BEGINNER.md 4.4 "Step A,
// pick" and "Step C, result", 4.0 rules 2 and 3, 7.7 "No ink in the picked part"). One green
// button at a time: [Choose a photo...] at A, [Use it] at C, [Draw a box] when no ink was found.
// Written before photo_card.js existed (failed on the missing module).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { getCoach } from '../../coach/coach_state.js';
import { probeScreen } from '../../coach/dom_probe.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import {
	FIT_MARGIN_PX,
	PHOTO_CARD_EVENT,
	ZOOM_BAR_PX,
	closePhotoCard,
	isPhotoCardOpen,
	makePhotoCard,
	openPhotoCard,
	photoCardElement,
	photoCardState,
	resetPhotoCardForTests,
	resultView,
	updatePhotoCard,
} from '../photo_card.js';
import { resetPhotoFlowForTests, stateOf } from '../photo_flow_state.js';
import { SMOOTH_DETAIL_DEFAULT } from '../smooth_detail.js';
import { box } from './flow_fakes.js';
import { greens, photoOn, shown } from './photo_dialog_fixture.js';

const handlers = () => ({
	onChoose: vi.fn(),
	onPickPhoto: vi.fn(),
	onHow: vi.fn(),
	onCancel: vi.fn(),
	onUseIt: vi.fn(),
	onAddInstead: vi.fn(),
	onDrawBox: vi.fn(),
	onAdjust: vi.fn(),
});
const thumb = (asset) => {
	const image = document.createElement('canvas');
	image.width = 300;
	image.height = 200;
	return { asset, image };
};
const q = (selector) => document.querySelector(`.anyink-photo-card ${selector}`);
const action = (name) => q(`[data-anyink-photo-card-action="${name}"]`);
const text = (selector) => q(selector)?.textContent ?? null;

/** The Adjust settings the way the photo flow reads them (photo_flow.js getFlow options). */
const flowOptions = (extra = {}) => ({
	threshold: 'auto',
	autoThreshold: 140,
	smoothDetail: SMOOTH_DETAIL_DEFAULT,
	despeckle: true,
	lightInk: false,
	paper: 'photo',
	paperPicked: true,
	...extra,
});

/** Step C, the way the photo flow gives it (getFlow, plus the step) after the first trace. */
const resultState = (extra = {}) => ({
	step: 'result',
	char: 'r',
	status: 'ready',
	error: null,
	replaces: 0,
	options: flowOptions(),
	...extra,
});

/** Builds a card into the page; returns its view and handlers. */
function card(state, extraHandlers = {}) {
	const spies = { ...handlers(), ...extraHandlers };
	const view = makePhotoCard(state, spies);
	document.body.appendChild(view.element);
	return { view, ...spies };
}

const openAdjust = () => {
	if (action('adjust').getAttribute('aria-expanded') !== 'true') action('adjust').click();
};

beforeEach(() => {
	photoOn();
	resetPhotoCardForTests();
});
afterEach(() => {
	closePhotoCard();
	resetPhotoFlowForTests();
	document.body.innerHTML = '';
});

describe('step A, pick', () => {
	it('names the letter, holds the one green button, and has no photo list on a new font', () => {
		card({ step: 'pick', char: 'r', photos: [] });
		expect(text('.anyink-photo-card__title')).toBe(
			word('photo.card.pickTitle', { letter: 'small r' })
		);
		expect(greens()).toEqual([action('choose')]);
		expect(action('choose').textContent).toBe(word('photo.card.choose'));
		expect(q('[data-anyink-photo-card-thumbs]')).toBe(null);
		expect(action('how').textContent).toContain(word('photo.card.how'));
		expect(action('cancel').classList).toContain('anyink-outlined');
	});

	it('lists the photos in this font, newest first as given, at most 6; a click uses one', () => {
		const photos = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map(thumb);
		const { onPickPhoto } = card({ step: 'pick', char: 'B', photos });
		const thumbs = [...document.querySelectorAll('[data-anyink-photo-card-action="photo"]')];
		expect(thumbs.map((b) => b.getAttribute('data-anyink-asset'))).toEqual([
			'a1',
			'a2',
			'a3',
			'a4',
			'a5',
			'a6',
		]);
		expect(text('[data-anyink-photo-card-thumbs-label]')).toBe(word('photo.card.inFont'));
		expect(thumbs[0].title).toBe(word('photo.card.usePhoto'));
		expect(thumbs[0].querySelector('canvas')).not.toBe(null);
		thumbs[2].click();
		expect(onPickPhoto).toHaveBeenCalledWith('a3');
		expect(greens()).toEqual([action('choose')]);
	});

	it('Choose a photo... runs inside the press (the picker needs the click); How and Cancel', () => {
		const { onChoose, onHow, onCancel } = card({ step: 'pick', char: 'r', photos: [] });
		let inPress = false;
		action('choose').addEventListener('click', () => (inPress = onChoose.mock.calls.length > 0));
		action('choose').click();
		expect(inPress).toBe(true);
		action('how').click();
		expect(onHow).toHaveBeenCalledTimes(1);
		action('cancel').click();
		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});

describe('step C, result', () => {
	it('Look right? [Use it] is the green button; Cancel and Draw a box are outlined', () => {
		const { onUseIt, onCancel, onDrawBox } = card(resultState());
		expect(text('.anyink-photo-card__title')).toBe(word('photo.card.lookRight'));
		expect(greens()).toEqual([action('useIt')]);
		expect(action('useIt').textContent).toBe(word('action.useIt'));
		expect(text('[data-anyink-photo-card-wrong]')).toContain(word('photo.card.wrongPart'));
		expect(action('drawBox').classList).toContain('anyink-outlined');
		action('useIt').click();
		action('cancel').click();
		action('drawBox').click();
		expect(onUseIt).toHaveBeenCalledTimes(1);
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onDrawBox).toHaveBeenCalledTimes(1);
	});

	it('an empty letter: no "replaces" note and no "Add to my shapes instead"', () => {
		card(resultState({ replaces: 0 }));
		expect(shown(q('[data-anyink-photo-card-replaces]'))).toBe(false);
		expect(shown(action('addInstead'))).toBe(false);
	});

	it('a letter with shapes: says what Use it replaces, and offers adding instead', () => {
		const { onAddInstead, view } = card(resultState({ replaces: 2 }));
		expect(text('[data-anyink-photo-card-replaces]')).toBe(
			'This replaces your 2 shapes. Undo brings them back.'
		);
		action('addInstead').click();
		expect(onAddInstead).toHaveBeenCalledTimes(1);
		view.update(resultState({ replaces: 1 }));
		expect(text('[data-anyink-photo-card-replaces]')).toBe(
			'This replaces your shape. Undo brings it back.'
		);
	});

	it('while tracing it says so; Use it stays (it traces at full size first)', () => {
		card(resultState({ status: 'tracing' }));
		expect(text('[data-anyink-photo-card-status]')).toBe(word('photo.card.tracing'));
		expect(greens()).toEqual([action('useIt')]);
	});

	it('no ink found: says what to try, Use it goes, Draw a box is the green button', () => {
		const error = { code: 'no-ink', key: 'photoFlow.noInk', button: 'photoFlow.button.drawBox' };
		const { view } = card(resultState({ status: 'no-ink', error }));
		expect(text('[data-anyink-photo-card-status]')).toBe(word('photoFlow.noInk'));
		expect(shown(action('useIt'))).toBe(false);
		expect(greens()).toEqual([action('drawBox')]);
		view.update(resultState({ status: 'ready' }));
		expect(greens()).toEqual([action('useIt')]);
		expect(text('[data-anyink-photo-card-status]')).toBe('');
	});

	it("a trace that failed says the flow's words; Cancel is the way out", () => {
		card(
			resultState({
				status: 'error',
				error: { code: 'no-decoder', key: 'toast.photoNoDecoder', button: null },
			})
		);
		expect(text('[data-anyink-photo-card-status]')).toBe(word('toast.photoNoDecoder'));
		expect(greens()).toEqual([action('cancel')]);
		expect(shown(action('fix'))).toBe(false);
	});

	it('a failure with its own fix button: that button is the green one (principle 6)', () => {
		const onFix = vi.fn();
		const message = { code: 'notApplied', key: 'photoFlow.noInk', button: 'photo.card.auto' };
		card(resultState({ status: 'error', error: message }), { onFix });
		expect(greens()).toEqual([action('fix')]);
		expect(action('fix').textContent).toBe(word('photo.card.auto'));
		action('fix').click();
		expect(onFix).toHaveBeenCalledWith(message);
	});

	it('a failure whose fix is Draw a box makes the Draw a box already there green', () => {
		const message = {
			code: 'trace-failed',
			key: 'photoFlow.noInk',
			button: 'photoFlow.button.drawBox',
		};
		const { onDrawBox } = card(resultState({ status: 'error', error: message }));
		expect(greens()).toEqual([action('drawBox')]);
		expect(shown(action('fix'))).toBe(false);
		action('drawBox').click();
		expect(onDrawBox).toHaveBeenCalledTimes(1);
	});
});

// First-timer finding 3: "No ink found in that part. Try More ink, or draw the box again." named a
// control inside the closed Adjust section, under a "Look right?" heading with nothing to look
// at. Written before the fix (failed: the heading showed and Adjust stayed closed).
describe('nothing traced: no "Look right?", and Adjust open where the fix is (finding 3)', () => {
	const noInk = { code: 'no-ink', key: 'photoFlow.noInk', button: 'photoFlow.button.drawBox' };
	const specks = { code: 'too-many', key: 'photoFlow.tooManySpecks', button: null };
	const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

	it('no ink found: no heading, the sentence first, and Adjust open on the ink cutoff', () => {
		card(resultState({ status: 'no-ink', error: noInk }));
		expect(shown(q('.anyink-photo-card__title'))).toBe(false);
		expect(text('[data-anyink-photo-card-status]')).toBe(word('photoFlow.noInk'));
		expect(before(q('[data-anyink-photo-card-status]'), action('cancel'))).toBe(true);
		expect(action('adjust').getAttribute('aria-expanded')).toBe('true');
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(true);
		expect(shown(q('[data-anyink-photo-card-input="inkCutoff"]'))).toBe(true);
		expect(text('[data-anyink-photo-card-ends="inkCutoff"]')).toContain(word('photo.card.moreInk'));
		expect(greens()).toEqual([action('drawBox')]);
	});

	it('too many specks: Adjust opens too (its fix is the ink cutoff or Remove specks)', () => {
		card(resultState({ status: 'error', error: specks }));
		expect(shown(q('.anyink-photo-card__title'))).toBe(false);
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(true);
		expect(shown(q('[data-anyink-photo-card-input="specks"]'))).toBe(true);
	});

	it('a failure Adjust cannot fix: no heading, and Adjust stays as he left it', () => {
		card(
			resultState({
				status: 'error',
				error: { code: 'no-decoder', key: 'toast.photoNoDecoder', button: null },
			})
		);
		expect(shown(q('.anyink-photo-card__title'))).toBe(false);
		expect(action('adjust').getAttribute('aria-expanded')).toBe('false');
	});

	it('ink found again: "Look right?" is back, and Adjust stays open while he uses it', () => {
		const { view } = card(resultState({ status: 'no-ink', error: noInk }));
		view.update(resultState({ status: 'tracing' }));
		expect(shown(q('.anyink-photo-card__title'))).toBe(true);
		view.update(resultState({ status: 'ready' }));
		expect(text('.anyink-photo-card__title')).toBe(word('photo.card.lookRight'));
		expect(shown(q('.anyink-photo-card__title'))).toBe(true);
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(true);
	});

	it('opened for him, it is not his choice for the session; one press closes it, and it stays', () => {
		const { view } = card(resultState({ status: 'no-ink', error: noInk }));
		action('adjust').click();
		expect(action('adjust').getAttribute('aria-expanded')).toBe('false');
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(false);
		view.update(resultState({ status: 'no-ink', error: noInk, options: flowOptions({ threshold: 90 }) }));
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(false);
		document.body.innerHTML = '';
		card(resultState({ char: 'e' }));
		expect(action('adjust').getAttribute('aria-expanded')).toBe('false');
	});
});

describe('Adjust', () => {
	it('is closed at first and stays as he left it for the session', () => {
		card(resultState());
		expect(action('adjust').getAttribute('aria-expanded')).toBe('false');
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(false);
		action('adjust').click();
		expect(shown(q('[data-anyink-photo-card-adjust-body]'))).toBe(true);
		document.body.innerHTML = '';
		card(resultState({ char: 'e' }));
		expect(action('adjust').getAttribute('aria-expanded')).toBe('true');
	});

	it('Ink cutoff: on Auto the slider shows what the photo picked; a drag sets it by hand', () => {
		const { onAdjust, view } = card(resultState());
		openAdjust();
		const slider = q('[data-anyink-photo-card-input="inkCutoff"]');
		expect(slider.type).toBe('range');
		expect(Number(slider.value)).toBe(140);
		expect(action('auto').getAttribute('aria-pressed')).toBe('true');
		expect(text('[data-anyink-photo-card-ends="inkCutoff"]')).toBe(
			`${word('photo.card.lessInk')}${word('photo.card.moreInk')}`
		);
		slider.value = '170';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onAdjust).toHaveBeenLastCalledWith({ threshold: 170 }, 'inkCutoff');
		view.update(resultState({ options: flowOptions({ threshold: 170 }) }));
		expect(action('auto').getAttribute('aria-pressed')).toBe('false');
		action('auto').click();
		expect(onAdjust).toHaveBeenLastCalledWith({ threshold: 'auto' }, 'inkCutoff');
	});

	it('Smooth --o-- Detailed is one slider (smooth_detail.js moves both settings)', () => {
		const { onAdjust } = card(resultState({ options: flowOptions({ smoothDetail: 0.25 }) }));
		openAdjust();
		const slider = q('[data-anyink-photo-card-input="smoothDetail"]');
		expect(Number(slider.value)).toBeCloseTo(0.25, 5);
		expect(text('[data-anyink-photo-card-ends="smoothDetail"]')).toBe(
			`${word('photo.card.smooth')}${word('photo.card.detailed')}`
		);
		slider.value = '1';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onAdjust).toHaveBeenLastCalledWith({ smoothDetail: 1 }, 'smoothDetail');
	});

	it('Remove specks and Light ink on dark paper are switches', () => {
		const { onAdjust } = card(resultState());
		openAdjust();
		const specks = q('[data-anyink-photo-card-input="specks"]');
		const light = q('[data-anyink-photo-card-input="lightInk"]');
		expect(specks.checked).toBe(true);
		expect(light.checked).toBe(false);
		specks.click();
		expect(onAdjust).toHaveBeenLastCalledWith({ despeckle: false }, 'specks');
		light.click();
		expect(onAdjust).toHaveBeenLastCalledWith({ lightInk: true }, 'lightInk');
	});

	it('Paper: picked for you until he picks; a pick starts the ink cutoff on Auto again', () => {
		const { onAdjust } = card(resultState());
		openAdjust();
		const scan = action('paperScan');
		const phone = action('paperPhoto');
		expect(phone.getAttribute('aria-pressed')).toBe('true');
		expect(scan.getAttribute('aria-pressed')).toBe('false');
		expect(shown(q('[data-anyink-photo-card-picked]'))).toBe(true);
		expect(text('[data-anyink-photo-card-picked]')).toBe(word('photo.card.paperPicked'));
		scan.click();
		expect(onAdjust).toHaveBeenLastCalledWith({ paper: 'scan', threshold: 'auto' }, 'paper');
		expect(shown(q('[data-anyink-photo-card-picked]'))).toBe(false);
		expect(scan.getAttribute('aria-pressed')).toBe('true');
	});

	it('an update while he drags a slider never rebuilds the card under the pointer', () => {
		const { view } = card(resultState());
		openAdjust();
		const slider = q('[data-anyink-photo-card-input="smoothDetail"]');
		slider.focus();
		slider.value = '0.8';
		view.update(resultState({ status: 'tracing' }));
		expect(q('[data-anyink-photo-card-input="smoothDetail"]')).toBe(slider);
		expect(slider.value).toBe('0.8');
	});
});

// First-timer finding 5: at step C a Capital H written tall had the tops of both stems cut off by
// the canvas top, so he couldn't judge the whole letter before Use it. Written before the fit
// existed (failed on the missing export, then on the view left as it was).
describe('step C shows the whole result and the guide lines (finding 5)', () => {
	const font = { ascent: 1550, descent: -440, capHeight: 1480, xHeight: 1100 };
	const rect = { width: 1000, height: 650 };
	/** The letter box as the letter opened: top line and tail line on screen, 0.25 px a unit. */
	const opened = { dx: 300, dy: 450, dz: 0.25 };
	const sx = (view, x) => view.dx + x * view.dz;
	const sy = (view, y) => view.dy - y * view.dz;
	const onScreen = (view, ink) =>
		sy(view, Math.max(ink.yMax, font.ascent)) >= FIT_MARGIN_PX - 0.01 &&
		sy(view, Math.min(ink.yMin, font.descent)) <= rect.height - ZOOM_BAR_PX + 0.01 &&
		sx(view, Math.min(ink.xMin, 0)) >= FIT_MARGIN_PX - 0.01 &&
		sx(view, Math.max(ink.xMax, 0)) <= rect.width - FIT_MARGIN_PX + 0.01;

	it('a result taller than the view: the view takes in the result and every guide line', () => {
		const tallH = { xMin: 40, xMax: 1300, yMin: -10, yMax: 2400 };
		expect(onScreen(opened, tallH)).toBe(false);
		const next = resultView({ ink: tallH, font, rect, view: opened });
		expect(onScreen(next, tallH)).toBe(true);
		// it fills the room it has: no smaller than it must be
		const fills =
			Math.abs(sy(next, 2400) - FIT_MARGIN_PX) < 1 ||
			Math.abs(sx(next, 1300) - (rect.width - FIT_MARGIN_PX)) < 1;
		expect(fills).toBe(true);
	});

	it('a result that already shows with the guide lines leaves the view as he has it', () => {
		const small = { xMin: 60, xMax: 900, yMin: 0, yMax: 1100 };
		expect(onScreen(opened, small)).toBe(true);
		expect(resultView({ ink: small, font, rect, view: opened })).toBe(null);
	});

	it('the app card fits the canvas once per part, when its result is ready', () => {
		const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x48';
		editor.getEditCanvasWrapperBounds = () => ({ ...rect, left: 0, top: 0 });
		editor.view = { ...opened };
		const told = vi.spyOn(editor, 'publish');
		const flow = stateOf(editor);
		flow.flow = {
			itemId: 'glyph-0x48',
			project: editor.project,
			status: 'ready',
			result: { shapes: [box(40, -10, 300, 2400), box(1000, -10, 1300, 2400)] },
		};
		const tallH = { xMin: 40, xMax: 1300, yMin: -10, yMax: 2400 };
		const stepC = (extra) =>
			resultState({ char: 'H', itemId: 'glyph-0x48', asset: 'img-1', partId: 'p6', ...extra });
		openPhotoCard(stepC({ status: 'tracing' }), handlers());
		expect(editor.view).toMatchObject(opened);
		updatePhotoCard(stepC({ status: 'ready' }));
		const view = { ...editor.view };
		expect(onScreen(view, tallH)).toBe(true);
		expect(told).toHaveBeenCalledWith('editCanvasView', editor.view);
		// Adjust re-traces the same part: he may have zoomed in since; his view stays
		editor.view = { ...opened };
		updatePhotoCard(stepC({ status: 'tracing' }));
		updatePhotoCard(stepC({ status: 'ready' }));
		expect(editor.view).toMatchObject(opened);
		// Draw a box: another part, fitted again
		updatePhotoCard(stepC({ status: 'ready', partId: 'b1' }));
		expect(onScreen(editor.view, tallH)).toBe(true);
		// Cancel, then the same part again: a new step C, fitted again
		closePhotoCard();
		editor.view = { ...opened };
		openPhotoCard(stepC({ status: 'ready', partId: 'b1' }), handlers());
		expect(onScreen(editor.view, tallH)).toBe(true);
		// looking around is never an Undo step
		expect(editor.history.queue).toEqual([]);
	});
});

describe('the card in the app', () => {
	it('tells the Next line its step (rules 2 and 3) and the page it changed', () => {
		const heard = vi.fn();
		window.addEventListener(PHOTO_CARD_EVENT, heard);
		const view = openPhotoCard({ step: 'pick', char: 'r', photos: [] }, handlers());
		expect(view).not.toBe(null);
		expect(isPhotoCardOpen()).toBe(true);
		// B8 + B9 integration: with step C's status and the card's green button, so the Next line
		// names the button that shows (rule 3)
		const pick = { step: 'pick', char: 'r', status: '', green: 'photo.card.choose' };
		expect(photoCardState()).toEqual(pick);
		expect(getCoach().facts().photoCard).toEqual(pick);
		expect(heard.mock.calls.at(-1)[0].detail).toEqual(pick);
		updatePhotoCard(resultState());
		expect(getCoach().facts().photoCard).toEqual({
			step: 'result',
			char: 'r',
			status: 'ready',
			green: 'action.useIt',
		});
		// no ink: [Use it] goes, [Draw a box] is the green one, and the Next line hears it
		updatePhotoCard(
			resultState({
				status: 'no-ink',
				error: { code: 'no-ink', key: 'photoFlow.noInk', button: 'photoFlow.button.drawBox' },
			})
		);
		expect(getCoach().facts().photoCard).toMatchObject({
			status: 'no-ink',
			green: 'photo.card.drawBox',
		});
		expect(photoCardElement().getAttribute('data-anyink-photo-card')).toBe('result');
		closePhotoCard();
		expect(isPhotoCardOpen()).toBe(false);
		expect(photoCardElement()).toBe(null);
		expect(getCoach().facts().photoCard).toBe(null);
		expect(heard.mock.calls.at(-1)[0].detail).toBe(null);
		window.removeEventListener(PHOTO_CARD_EVENT, heard);
	});

	it('one card at a time: opening again updates the same element', () => {
		const first = openPhotoCard({ step: 'pick', char: 'r', photos: [] }, handlers());
		document.body.appendChild(photoCardElement());
		const second = openPhotoCard(resultState(), handlers());
		expect(second.element).toBe(first.element);
		expect(document.querySelectorAll('.anyink-photo-card')).toHaveLength(1);
	});

	// B8 + B9 integration (found in Chrome): the photo dialog over step A or C, or the error box a
	// HEIC photo brings, holds the screen's one green button; the card's waits outlined
	it('gives its green button up while a dialog is open over it, and takes it back after', async () => {
		openPhotoCard({ step: 'pick', char: 'r', photos: [] }, handlers());
		document.body.appendChild(photoCardElement());
		const choose = () => photoCardElement().querySelector('[data-anyink-photo-card-action="choose"]');
		expect(choose().classList.contains('anyink-primary')).toBe(true);
		const box = document.createElement('div');
		box.id = 'error';
		document.body.appendChild(box);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(choose().classList.contains('anyink-primary')).toBe(false);
		expect(choose().classList.contains('anyink-outlined')).toBe(true);
		expect(greens()).toEqual([]);
		box.remove();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(choose().classList.contains('anyink-primary')).toBe(true);
		// step C, drawn while a dialog is open, starts outlined too
		const dialog = document.createElement('div');
		dialog.setAttribute('data-anyink-dialog', 'photoDialog');
		document.body.appendChild(dialog);
		updatePhotoCard(resultState());
		const useIt = photoCardElement().querySelector('[data-anyink-photo-card-action="useIt"]');
		expect(useIt.classList.contains('anyink-primary')).toBe(false);
		dialog.remove();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(useIt.classList.contains('anyink-primary')).toBe(true);
	});

	it("with its green button showing, the Next line's button is outlined (principle 1)", () => {
		openPhotoCard(resultState(), handlers());
		document.body.appendChild(photoCardElement());
		expect(probeScreen(document).otherPrimary).toBe(true);
	});

	it('opens nothing in All tools or while the photo flag is off', () => {
		setModeForTests('all');
		expect(openPhotoCard({ step: 'pick', char: 'r' }, handlers())).toBe(null);
		setModeForTests('simple');
		setFeaturesForTests({ photo: false });
		expect(openPhotoCard({ step: 'pick', char: 'r' }, handlers())).toBe(null);
		expect(getCoach().facts().photoCard).toBe(null);
	});
});

describe('plain words (2.3)', () => {
	scanSimpleScreen('photo card, step A with photos', () => {
		card({ step: 'pick', char: 'r', photos: ['a1', 'a2'].map(thumb) });
		return document.querySelector('.anyink-photo-card');
	});
	scanSimpleScreen('photo card, step C with shapes, Adjust open', () => {
		card(resultState({ replaces: 2 }));
		openAdjust();
		return document.querySelector('.anyink-photo-card');
	});
	scanSimpleScreen('photo card, step C tracing', () => {
		card(resultState({ status: 'tracing', replaces: 1 }));
		return document.querySelector('.anyink-photo-card');
	});
	scanSimpleScreen('photo card, step C no ink', () => {
		card(resultState({ status: 'no-ink', error: { code: 'no-ink', key: 'photoFlow.noInk' } }));
		openAdjust();
		return document.querySelector('.anyink-photo-card');
	});
});
