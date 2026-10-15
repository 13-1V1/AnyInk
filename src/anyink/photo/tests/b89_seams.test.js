// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: the seams between the brush, photo-core, photo-ui and photo-flow tracks and
	the B6 Next line and B7 letter view, each checked on one Simple letter screen as the app draws
	it (the real Navigator), with the flags as the app has them ('coach', 'letterView', 'brush',
	'photo'):
	  the opening Brush   an empty letter opens with the Brush picked, yet the overlay stays with
	                [Use a photo] green and the Next line offers the photo (rule 8); his own pick of
	                the Brush puts the overlay away, the line says what a drag does, the card shows
	                the Brush's size, and its tip shows then (not before)
	  the overlay   [Use the same photo] with its thumbnail and [Choose another photo...] once a
	                photo of the font has parts not used yet; it hides while the photo card runs
	  the card      the photo card in the letter card's Photo card section, its main buttons hidden;
	                [Trace again] and [Draw over it] on a ready letter with a photo
	  one green     exactly one shown green button in every state (principle 1)
	  rule 3        step C with nothing to use names the card's green button
	  Merge         brush strokes stay their own shapes
	  words         every new state says no banned word (2.3), strict
	  All tools     the same letter has no overlay, no card, no opening Brush
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { CoachElement } from '../../coach/coach_element.js';
import { resetCoachForTests } from '../../coach/coach_state.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { letterCardState, shapeOptions } from '../../letter/letter_card.js';
import { isFeatureOn } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { isOpeningBrush } from '../../nib/default_tool.js';
import { tagStroke } from '../../nib/stroke_record.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { setTrace } from '../../trace/trace_model.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { initPhotos, resetPhotoAppForTests } from '../photo_app.js';
import { closePhotoCard, openPhotoCard, resetPhotoCardForTests } from '../photo_card.js';
import { openPhotoDoor } from '../photo_doors.js';
import { addPhoto } from '../photo_registry.js';
import { ROW } from './photo_dialog_fixture.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');

const SMALL_A = 'glyph-0x61';
const CAPITAL_A = 'glyph-0x41';

/** The stylesheets that decide what shows (vitest skips CSS imports). */
function addStyles() {
	[
		'project_editor/nav.css',
		'anyink/mode/hide.css',
		'anyink/mode/simple_labels.css',
		'anyink/letter/letter.css',
		'anyink/topbar/simple_top_bar.css',
		'anyink/coach/coach.css',
	].forEach((path) => {
		const style = document.createElement('style');
		style.dataset.scan = path;
		style.textContent = css(path);
		document.head.appendChild(style);
	});
}

/** A square path from (x0, y0), size font units */
function square(x0, y0, size) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name: 'Square',
		pathPoints: [
			corner(x0, y0),
			corner(x0 + size, y0),
			corner(x0 + size, y0 + size),
			corner(x0, y0 + size),
		],
	});
}

/** The letter page on one letter, drawn by the real Navigator (small a: empty in the sample) */
function letterPage({ mode = 'simple', id = SMALL_A } = {}) {
	setModeForTests(mode);
	addStyles();
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = id;
	editor.selectedGlyph;
	editor.selectedTool = 'resize';
	editor.navigate();
	// jsdom has no <edit-canvas>: the page and the Point pen's state stand in
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	if (!editor.eventHandlers.tool_addPath) editor.eventHandlers.tool_addPath = {};
	initPhotos({ getEditor: () => editor });
	return editor;
}

/** A photo of the font with seven parts, none used yet, its image in the font */
function photoInFont(editor) {
	const blob = new Blob([new Uint8Array(16)], { type: 'image/webp' });
	const asset = editor.assets.add(blob, { type: 'image/webp' });
	addPhoto(editor.project, {
		asset,
		width: 1500,
		height: 520,
		parts: ROW,
		paper: 'photo',
		lightInk: false,
		fingerprint: 'fnv:16:0000000000000001',
	});
	return asset;
}

/** Lets the Next line draw (the coach batches its changes to the next frame) */
async function settle() {
	for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0));
	document.querySelector('anyink-coach')?.render?.();
	document.querySelector('anyink-coach')?.checkScreen?.();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

const q = (selector) => document.querySelector(selector);
const shownEl = (element) => {
	for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
		if (el.hidden || el.hasAttribute('data-anyink-hidden')) return false;
		if (getComputedStyle(el).display === 'none') return false;
	}
	return !!element;
};
const greens = () => [...document.querySelectorAll('.anyink-primary')].filter(shownEl);
const greenWords = () => greens().map((el) => el.textContent.trim());
const nextLine = () => q('anyink-coach');
const nextSentence = () => nextLine()?.querySelector('.anyink-coach__sentence')?.textContent || '';
const nextTip = () => {
	const tip = nextLine()?.querySelector('.anyink-coach__tip');
	return shownEl(tip) ? tip.querySelector('.anyink-coach__tip-text').textContent : '';
};
const nextButton = () => {
	const button = nextLine()?.querySelector('.anyink-coach__button');
	return shownEl(button) ? button : null;
};
const overlayShown = () => shownEl(q('[data-anyink-overlay]'));
const overlayActions = () =>
	[...document.querySelectorAll('[data-anyink-overlay-action]')].map(
		(el) => el.dataset.anyinkOverlayAction
	);
const cardSectionsShown = () =>
	[...document.querySelectorAll('.anyink-letter-card > [data-anyink-card]')].map(
		(el) => el.dataset.anyinkCard
	);

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	if (!customElements.get('anyink-coach')) customElements.define('anyink-coach', CoachElement);
	if (!customElements.get('anyink-save-status')) {
		customElements.define('anyink-save-status', SaveStatusElement);
	}
});
beforeEach(() => {
	localStorage.clear();
	resetToastsForTests();
	resetPhotoCardForTests();
	vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 0));
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	];
});
afterEach(() => {
	closePhotoCard();
	resetPhotoAppForTests();
	quiet.forEach((spy) => spy.mockRestore());
	vi.unstubAllGlobals();
	resetCoachForTests();
	resetToastsForTests();
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

describe('the flags as the app has them', () => {
	it('B6, B7, B8 and B9 are on', () => {
		['coach', 'letterView', 'brush', 'photo'].forEach((flag) => {
			expect(isFeatureOn(flag), flag).toBe(true);
		});
	});
});

describe('an empty letter opens with the Brush, and still offers the photo (4.3)', () => {
	it('the Brush is picked, the overlay stays with [Use a photo] green, rule 8 names both ways', async () => {
		const editor = letterPage();
		await settle();
		expect(editor.selectedTool).toBe('nib');
		expect(isOpeningBrush(editor)).toBe(true);
		expect(overlayShown()).toBe(true);
		expect(overlayActions()).toEqual(['usePhoto', 'drawBrush']);
		expect(greenWords()).toEqual([word('letter.overlay.usePhoto')]);
		expect(q('[data-anyink-overlay]').textContent).toContain(word('letter.overlay.dropHere'));
		expect(q('[data-anyink-overlay-link="how"]').textContent).toBe(word('letter.overlay.how'));
		expect(nextSentence()).toBe(word('coach.rule.emptyPhotoBrush', { letter: 'small a' }));
		expect(nextButton()).toBeNull();
		// the Brush's tip waits for his own pick of it
		expect(nextTip()).toBe('');
	});

	it('[Draw with the brush]: the overlay goes, the line says what a drag does, the Brush size shows', async () => {
		const editor = letterPage();
		await settle();
		q('[data-anyink-overlay-action="drawBrush"]').click();
		await settle();
		expect(editor.selectedTool).toBe('nib');
		expect(isOpeningBrush(editor)).toBe(false);
		expect(overlayShown()).toBe(false);
		expect(nextSentence()).toBe(word('brush.next.drag'));
		expect(nextButton()).toBeNull();
		expect(nextTip()).toContain(word('coach.tip.brush'));
		// D-037: a drawing tool picked on an empty letter, before its first mark: no green button
		expect(greens()).toEqual([]);
		expect(cardSectionsShown()).toEqual(['header', 'brush']);
		expect(q('[data-anyink-brush="size"] input[type="range"]')).not.toBeNull();
	});

	it('a letter with ink opens with Select; going back to the empty one opens the Brush again', async () => {
		const editor = letterPage();
		await settle();
		editor.selectedGlyphID = CAPITAL_A;
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.selectedGlyphID = SMALL_A;
		await settle();
		editor.selectedGlyphID = CAPITAL_A;
		await settle();
		expect(editor.selectedTool).toBe('resize');
		editor.selectedGlyphID = SMALL_A;
		await settle();
		expect(editor.selectedTool).toBe('nib');
		expect(overlayShown()).toBe(true);
	});
});

describe('the overlay and the photo card (4.3, 4.4)', () => {
	it('a photo with parts not used yet: [Use the same photo] green with its thumbnail, then [Choose another photo...]', async () => {
		const editor = letterPage();
		photoInFont(editor);
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		expect(overlayActions()).toEqual(['useSamePhoto', 'chooseAnother', 'drawBrush']);
		expect(greenWords()).toEqual([word('letter.overlay.useSamePhoto')]);
		expect(q('.anyink-empty-overlay__same canvas.anyink-empty-overlay__thumb')).not.toBeNull();
	});

	it('step A: the overlay hides, the card sits in the letter card, one green, rule 2 with no button', async () => {
		const editor = letterPage();
		await settle();
		openPhotoDoor('pick', { char: 'a', itemId: SMALL_A });
		await settle();
		expect(overlayShown()).toBe(false);
		// the photo card is the one thing to do: the opening Brush's size waits
		expect(cardSectionsShown()).toEqual(['header', 'photo']);
		expect(q('.anyink-letter-card [data-anyink-photo-card="pick"]')).not.toBeNull();
		expect(greenWords()).toEqual([word('photo.card.choose')]);
		expect(nextSentence()).toBe(word('coach.rule.photoPick', { letter: 'small a' }));
		expect(nextButton()).toBeNull();
		expect(editor.selectedGlyphID).toBe(SMALL_A);
	});

	it('step C with nothing to use: rule 3 names the green [Draw a box] (the card hides [Use it])', async () => {
		letterPage();
		await settle();
		openPhotoCard(
			{
				step: 'result',
				char: 'a',
				status: 'no-ink',
				error: { code: 'no-ink', key: 'photoFlow.noInk', button: 'photoFlow.button.drawBox' },
				replaces: 0,
				options: {},
			},
			{}
		);
		await settle();
		expect(greenWords()).toEqual([word('photo.card.drawBox')]);
		expect(nextSentence()).toBe(
			word('coach.rule.photoStuck', { button: word('photo.card.drawBox') })
		);
		expect(nextButton()).toBeNull();
	});

	it('a ready letter with a photo: [Trace again] and [Draw over it]; Draw over it picks the Brush', async () => {
		const editor = letterPage({ id: CAPITAL_A });
		const asset = photoInFont(editor);
		setTrace(editor.selectedItem, { asset, width: 1500, height: 520, x: 0, y: 700, scale: 1 });
		editor.history.addState('set up');
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		expect(editor.selectedTool).toBe('resize');
		expect(cardSectionsShown()).toEqual(['header', 'main', 'fineTune']);
		const buttons = [...document.querySelectorAll('[data-anyink-card="main"] button')];
		expect(buttons.map((el) => el.dataset.anyinkAction)).toEqual(['traceAgain', 'drawOver']);
		expect(buttons.every((el) => !el.classList.contains('anyink-primary'))).toBe(true);
		expect(greens()).toHaveLength(1);
		q('[data-anyink-action="drawOver"]').click();
		await settle();
		expect(editor.selectedTool).toBe('nib');
		expect(cardSectionsShown()).toEqual(['header', 'main', 'brush', 'fineTune']);
		// with the Brush picked, [Draw over it] has nothing left to do and goes
		expect(q('[data-anyink-action="drawOver"]')).toBeNull();
		expect(q('[data-anyink-action="traceAgain"]')).not.toBeNull();
	});
});

describe('brush strokes stay their own shapes (D-031, M10)', () => {
	it('Merge works on the drawn shapes only: two strokes and a square have nothing to merge', () => {
		const editor = letterPage({ id: CAPITAL_A });
		const item = editor.selectedItem;
		item.shapes = [];
		const one = item.addOneShape(square(0, 0, 300));
		const two = item.addOneShape(square(100, 100, 300));
		tagStroke(one, 1);
		tagStroke(two, 2);
		item.addOneShape(square(500, 0, 200));
		const state = letterCardState(editor);
		expect(state.mergeable).toBe(1);
		expect(shapeOptions(state)).not.toContain('merge');
		item.addOneShape(square(550, 50, 200));
		expect(letterCardState(editor).mergeable).toBe(2);
	});
});

describe('All tools keeps its own letter page', () => {
	it('no overlay, no letter card, and the tool he had', async () => {
		const editor = letterPage({ mode: 'all' });
		await settle();
		expect(q('[data-anyink-overlay]')).toBeNull();
		expect(q('.anyink-letter-card')).toBeNull();
		expect(editor.selectedTool).toBe('resize');
		expect(isOpeningBrush(editor)).toBe(false);
	});
});

describe('every new state says no banned word (2.3, strict)', () => {
	scanSimpleScreen(
		'an empty letter with the photo and brush buttons',
		async () => {
			const editor = letterPage();
			photoInFont(editor);
			editor.publish('currentItem', editor.selectedItem);
			await settle();
			return q('#app__wrapper');
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'the Brush picked: the Next line, its tip and the Brush section',
		async () => {
			letterPage();
			await settle();
			q('[data-anyink-overlay-action="drawBrush"]').click();
			await settle();
			return q('#app__wrapper');
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'step A in the letter card',
		async () => {
			letterPage();
			await settle();
			openPhotoDoor('pick', { char: 'a', itemId: SMALL_A });
			await settle();
			return q('#app__wrapper');
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'a ready letter with a photo: Trace again, Draw over it',
		async () => {
			const editor = letterPage({ id: CAPITAL_A });
			const asset = photoInFont(editor);
			setTrace(editor.selectedItem, { asset, width: 1500, height: 520, x: 0, y: 700, scale: 1 });
			editor.publish('currentItem', editor.selectedItem);
			await settle();
			return q('#app__wrapper');
		},
		{ strict: true }
	);
});
