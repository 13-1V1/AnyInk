// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-ui: the photo dialog, step B (docs/UX-BEGINNER.md 4.4 "Step B, the photo dialog", 4.5,
// section 10 B9: "the parts view, click to pick, drag a box with a crosshair, the letter field with
// its guess and the alphabet prefill, Skip this part, Done with this photo"; "the box is drawn in
// the photo dialog, not on the edit canvas"). Written before photo_dialog.js existed (failed on the
// missing module).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDialogName, probeScreen } from '../../coach/dom_probe.js';
import { getCoach } from '../../coach/coach_state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import {
	FALLBACK_VIEW,
	PHOTO_DIALOG_NAME,
	READABLE_LETTER_PX,
	TARGET_LETTER_PX,
	ZOOM_STEP,
	autoZoom,
	closePhotoDialog,
	isPhotoDialogOpen,
	openPhotoDialog,
	tagSpot,
	typedChar,
} from '../photo_dialog.js';
import { usePart } from '../photo_registry.js';
import {
	PAGE,
	PAGE_H,
	PAGE_W,
	ROW,
	clickAt,
	dragBox,
	greens,
	key,
	pageParts,
	photoFont,
	photoOn,
	press,
	shown,
	stageAt1to1,
} from './photo_dialog_fixture.js';

const dialog = () => document.querySelector('[data-anyink-dialog="photoDialog"]');
const q = (selector) => dialog()?.querySelector(selector) || null;
const action = (name) => q(`[data-anyink-photo-action="${name}"]`);
const field = () => q('[data-anyink-photo-field]');
const thats = () => q('[data-anyink-photo-thats]').textContent;
const message = () => q('[data-anyink-photo-message]').textContent;
const pickedId = () => q('[data-anyink-picked]')?.getAttribute('data-anyink-part') || null;
const partEl = (id) => q(`[data-anyink-part="${id}"]`);
/** He types text; the field then holds value (the text alone when the field was selected). */
const type = (text, value = text) => {
	const input = field();
	input.value = value;
	input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
};

/** Opens the dialog on a fresh photo; returns the record and the spies. */
function open(options = {}, font = {}) {
	const { record, mask, image } = photoFont(font);
	const spies = { onTrace: vi.fn(), onCancel: vi.fn(), onDone: vi.fn(), onChange: vi.fn() };
	const view = openPhotoDialog({ record, mask, image, ...spies, ...options });
	return { record, mask, view, ...spies };
}

beforeEach(() => photoOn());
afterEach(() => {
	closePhotoDialog();
	document.body.innerHTML = '';
});

describe('only where it belongs (principle 8)', () => {
	it('opens nothing in All tools or while the photo flag is off', () => {
		setModeForTests('all');
		expect(open().view).toBe(null);
		expect(dialog()).toBe(null);
		setModeForTests('simple');
		setFeaturesForTests({ photo: false });
		expect(open().view).toBe(null);
		expect(dialog()).toBe(null);
	});

	it('is an ANY-INK dialog the Next line steps aside for (rule 1), and only while open', () => {
		open();
		expect(isPhotoDialogOpen()).toBe(true);
		expect(openDialogName(document)).toBe(PHOTO_DIALOG_NAME);
		expect(getCoach().facts().dialog).toBe(PHOTO_DIALOG_NAME);
		closePhotoDialog();
		expect(isPhotoDialogOpen()).toBe(false);
		expect(openDialogName(document)).toBe('');
		expect(getCoach().facts().dialog).toBe(null);
	});
});

describe('the parts view', () => {
	it('outlines every part, tags the used ones with their letter, and boxes the guess', () => {
		open({}, { used: { p1: 'B', p2: 'r' } });
		const parts = [...dialog().querySelectorAll('[data-anyink-part]')];
		expect(parts.map((p) => p.getAttribute('data-anyink-part'))).toEqual(ROW.map((p) => p.id));
		expect(partEl('p1').textContent).toBe('B');
		expect(partEl('p2').textContent).toBe('r');
		expect(partEl('p3').textContent).toBe('');
		expect(partEl('p1').title).toBe(word('photo.dialog.usedFor', { name: 'Capital B' }));
		// the guess: the first part not used yet, in reading order
		expect(pickedId()).toBe('p3');
		// placed in the photo's own pixels, so it fits any size the view is drawn at
		expect(partEl('p3').style.left).toBe(`${(480 / 1500) * 100}%`);
		expect(partEl('p3').style.width).toBe(`${(100 / 1500) * 100}%`);
	});

	it('draws the photo itself in the view', () => {
		open();
		const canvas = q('[data-anyink-photo-stage] canvas');
		expect(canvas.width).toBe(1500);
		expect(canvas.height).toBe(520);
	});

	it('the view takes a drag with a crosshair: a box is drawn here, never on the edit canvas', () => {
		open();
		expect(q('[data-anyink-photo-stage]').classList).toContain('anyink-photo-dialog__stage');
		expect(q('[data-anyink-photo-stage]').getAttribute('aria-label')).toBe(
			word('photo.dialog.view')
		);
	});
});

describe('letter unknown (a photo from the How card, the board, rule 12)', () => {
	it('asks which letter is in the green box; the field has the focus; one green button', () => {
		open();
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('unknown');
		expect(q('h2').textContent).toBe(word('photo.dialog.titleUnknown'));
		expect(document.activeElement).toBe(field());
		expect(greens()).toEqual([action('trace')]);
		expect(shown(action('skip'))).toBe(true);
		expect(shown(action('done'))).toBe(true);
		expect(action('cancel')).toBe(null);
		expect(q('[data-anyink-photo-hint]').textContent).toBe(word('photo.dialog.hint'));
	});

	it('says what it understood: small l and Capital I are told apart', () => {
		open();
		type('l');
		expect(thats()).toBe(word('photo.dialog.thats', { name: 'small l' }));
		type('I');
		expect(thats()).toBe(word('photo.dialog.thats', { name: 'Capital I' }));
		type('.');
		expect(thats()).toBe(word('photo.dialog.thats', { name: 'period' }));
	});

	it('takes one character: a second one takes the place of the first', () => {
		expect(typedChar('a', 'ab', 'b')).toBe('b');
		expect(typedChar('a', 'ba', 'b')).toBe('b');
		expect(typedChar('', 'xyz', null)).toBe('x');
		expect(typedChar('a', ' ', ' ')).toBe('');
		expect(typedChar('', '😀', '😀')).toBe('😀');
		open();
		type('a');
		type('b', 'ab');
		expect(field().value).toBe('b');
		expect(thats()).toBe(word('photo.dialog.thats', { name: 'small b' }));
	});

	it('Trace it hands over the part and the letter, then closes; nothing is named until then', () => {
		const { record, onTrace } = open();
		type('B');
		expect(record.used).toEqual({});
		action('trace').click();
		expect(onTrace).toHaveBeenCalledTimes(1);
		const [arg] = onTrace.mock.calls[0];
		expect(arg.partId).toBe('p1');
		expect(arg.char).toBe('B');
		expect(arg.drawn).toBe(false);
		expect(arg.part).toMatchObject({ id: 'p1', left: 100, top: 100, right: 200, bottom: 260 });
		expect(dialog()).toBe(null);
		// the flow names the part when he presses Use it, not the dialog
		expect(record.used).toEqual({});
	});

	it('Enter in the field is Trace it', () => {
		const { onTrace } = open();
		type('r');
		key(field(), 'Enter');
		expect(onTrace).toHaveBeenCalledTimes(1);
		expect(onTrace.mock.calls[0][0].char).toBe('r');
	});

	it('Trace it with an empty field says what to do and keeps the dialog open', () => {
		const { onTrace } = open();
		action('trace').click();
		expect(onTrace).not.toHaveBeenCalled();
		expect(message()).toBe(word('photo.dialog.typeFirst'));
		expect(document.activeElement).toBe(field());
		type(' ');
		key(field(), 'Enter');
		expect(onTrace).not.toHaveBeenCalled();
	});

	it('the alphabet prefill: after a and b, the field starts with c', () => {
		const font = { used: { p1: 'a', p2: 'b' } };
		open({}, font);
		expect(pickedId()).toBe('p3');
		expect(field().value).toBe('c');
		expect(thats()).toBe(word('photo.dialog.thats', { name: 'small c' }));
	});

	it('Skip this part: the green box moves on and the part is not guessed again', () => {
		const { record, onChange } = open();
		type('x');
		action('skip').click();
		expect(record.skipped).toEqual(['p1']);
		expect(pickedId()).toBe('p2');
		expect(field().value).toBe('');
		expect(onChange).toHaveBeenCalledWith({ what: 'skip', partId: 'p1' });
		expect(dialog()).not.toBe(null);
	});

	it('Done with this photo: marks it done and closes', () => {
		const { record, onDone, onCancel } = open();
		action('done').click();
		expect(record.done).toBe(true);
		expect(onDone).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
		expect(dialog()).toBe(null);
	});

	it('every part named: no guess, and Done with this photo is the green button', () => {
		const used = Object.fromEntries(ROW.map((p, i) => [p.id, 'Brenahd'[i]]));
		open({}, { used });
		expect(pickedId()).toBe(null);
		expect(message()).toBe(word('photo.dialog.allNamed'));
		expect(shown(action('trace'))).toBe(false);
		expect(greens()).toEqual([action('done')]);
		// clicking a named part picks it again, with its letter in the field
		clickAt(dialog(), 150, 180);
		expect(pickedId()).toBe('p1');
		expect(field().value).toBe('B');
		expect(greens()).toEqual([action('trace')]);
	});

	it('a photo with no parts found: drag a box, or Done', () => {
		open({}, { parts: [] });
		expect(message()).toBe(word('photo.dialog.noneFound'));
		expect(greens()).toEqual([action('done')]);
	});
});

describe('picking', () => {
	it('a click picks the part under it, a few pixels around it count too', () => {
		open();
		clickAt(dialog(), 340, 200);
		expect(pickedId()).toBe('p2');
		clickAt(dialog(), 1240, 98);
		expect(pickedId()).toBe('p7');
	});

	it('a click on bare paper keeps the pick', () => {
		open();
		clickAt(dialog(), 340, 200);
		clickAt(dialog(), 700, 450);
		expect(pickedId()).toBe('p2');
	});

	it('after a pick by mouse, or Skip, his next key goes in the field (letter unknown)', () => {
		open();
		action('skip').focus();
		action('skip').click();
		expect(document.activeElement).toBe(field());
		clickAt(dialog(), 520, 150);
		expect(document.activeElement).toBe(field());
		dragBox(dialog(), [270, 80], [420, 300]);
		expect(document.activeElement).toBe(field());
		// a letter key wherever the focus is lands in the field
		stageAt1to1(dialog()).focus();
		const event = key(stageAt1to1(dialog()), 'e');
		expect(event.defaultPrevented).toBe(true);
		expect(field().value).toBe('e');
		expect(thats()).toBe(word('photo.dialog.thats', { name: 'small e' }));
		expect(document.activeElement).toBe(field());
		// keys with Ctrl are no letters
		key(stageAt1to1(dialog()), 'a', { ctrlKey: true });
		expect(field().value).toBe('e');
	});

	it('picking another part keeps what he typed', () => {
		open();
		type('e');
		clickAt(dialog(), 520, 150);
		expect(pickedId()).toBe('p3');
		expect(field().value).toBe('e');
	});

	it('arrow keys on the view move the green box in reading order', () => {
		open();
		const stage = stageAt1to1(dialog());
		key(stage, 'ArrowRight');
		expect(pickedId()).toBe('p2');
		key(stage, 'ArrowRight');
		key(stage, 'ArrowLeft');
		expect(pickedId()).toBe('p2');
		key(stage, 'ArrowLeft');
		key(stage, 'ArrowLeft');
		expect(pickedId()).toBe('p1');
		// and from the field, where the focus mostly is
		key(field(), 'ArrowDown');
		expect(pickedId()).toBe('p2');
		expect(document.activeElement).toBe(field());
	});

	it('a drag draws a box: the tight box round its ink becomes the pick', () => {
		const { record, onTrace } = open();
		const before = record.parts.length;
		dragBox(dialog(), [270, 80], [420, 300]);
		const box = q('[data-anyink-part="drawn"]');
		expect(box).not.toBe(null);
		expect(pickedId()).toBe('drawn');
		// tight to the ink inside it: p2's box (290..390, 100..260)
		expect(box.style.left).toBe(`${(290 / 1500) * 100}%`);
		expect(box.style.top).toBe(`${(100 / 520) * 100}%`);
		// not stored until Trace it
		expect(record.parts.length).toBe(before);
		type('r');
		action('trace').click();
		const [arg] = onTrace.mock.calls[0];
		expect(arg.drawn).toBe(true);
		expect(arg.partId).toBe('b1');
		expect(record.parts.find((p) => p.id === 'b1')).toMatchObject({
			left: 290,
			top: 100,
			right: 390,
			bottom: 260,
			drawn: true,
		});
		expect(arg.part.mask).toBeInstanceOf(Uint8Array);
		expect(arg.part.mask.length).toBe(100 * 160);
	});

	it('while dragging, the box shows; a box round no ink says so and keeps the pick', () => {
		const { record } = open();
		const stage = stageAt1to1(dialog());
		press(stage, 'mousedown', 600, 300);
		press(window, 'mousemove', 700, 400);
		const live = q('[data-anyink-photo-drag]');
		expect(shown(live)).toBe(true);
		press(window, 'mouseup', 700, 400);
		expect(shown(q('[data-anyink-photo-drag]'))).toBe(false);
		expect(message()).toBe(word('photo.dialog.noInkBox'));
		expect(pickedId()).toBe('p1');
		expect(record.parts.some((p) => p.drawn)).toBe(false);
	});

	it('a press that barely moves is a click, not a box', () => {
		open();
		const stage = stageAt1to1(dialog());
		press(stage, 'mousedown', 340, 200);
		press(window, 'mousemove', 342, 201);
		press(window, 'mouseup', 342, 201);
		expect(pickedId()).toBe('p2');
		expect(q('[data-anyink-part="drawn"]')).toBe(null);
	});
});

// --------------------------------------------------------------
// First-timer finding 2: a whole-page photo was too small in the dialog to click or box letters
// (portrait alphabet page at 1600 x 900: letters about 30 px, the i 5 px wide; at 1280 x 720 about
// 20 px, and the name tags covered the next letters). Written before the zoom and the tag
// placement existed (failed on the missing exports).
// --------------------------------------------------------------

/** The whole-alphabet page, as the dialog's font. */
const PAGE_FONT = { parts: PAGE, width: PAGE_W, height: PAGE_H };
const view = () => q('[data-anyink-photo-view]');
const stageSize = () => {
	const stage = q('[data-anyink-photo-stage]');
	return { width: parseFloat(stage.style.width), height: parseFloat(stage.style.height) };
};
/** Where the photo's top-left corner is in the view (jsdom: the view is FALLBACK_VIEW). */
const origin = () => {
	const { width, height } = stageSize();
	return {
		x: Math.max(0, (FALLBACK_VIEW.width - width) / 2) - view().scrollLeft,
		y: Math.max(0, (FALLBACK_VIEW.height - height) / 2) - view().scrollTop,
	};
};
/** A box in photo pixels, on screen (the view's own coordinates). */
const onScreen = (box, photoW = PAGE_W) => {
	const k = stageSize().width / photoW;
	const o = origin();
	return {
		left: o.x + box.left * k,
		top: o.y + box.top * k,
		right: o.x + box.right * k,
		bottom: o.y + box.bottom * k,
	};
};
const inView = (box) =>
	box.left >= 0 &&
	box.top >= 0 &&
	box.right <= FALLBACK_VIEW.width &&
	box.bottom <= FALLBACK_VIEW.height;
const pagePart = (id) => PAGE.find((p) => p.id === id);
/** The stage measured where it is now (jsdom lays nothing out). */
const measureStage = () => {
	const stage = q('[data-anyink-photo-stage]');
	stage.getBoundingClientRect = () => {
		const { width, height } = stageSize();
		const o = origin();
		return { left: o.x, top: o.y, width, height, right: o.x + width, bottom: o.y + height };
	};
	return stage;
};
const wheel = (extra) =>
	new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true, ...extra });

describe('a whole page of small letters: the view comes close (finding 2)', () => {
	it('picks a zoom: whole when the letters show big enough, else filling the width or closer', () => {
		const at = (parts, width, height, viewWidth = 1000, viewHeight = 600) =>
			autoZoom({ parts, width, height, viewWidth, viewHeight });
		// the B r e n a H d row: 107 px letters on the whole photo
		expect(at(ROW, 1500, 520)).toBe(1);
		// the portrait page: 30 px letters on the whole photo; the width filled shows 67 px
		expect(at(PAGE, PAGE_W, PAGE_H)).toBeCloseTo(1000 / 450, 5);
		expect(100 * 0.3 * at(PAGE, PAGE_W, PAGE_H)).toBeGreaterThanOrEqual(READABLE_LETTER_PX);
		// 1280 x 720: a view about 1000 x 440, 22 px letters; the width filled shows 67 px
		const small = at(PAGE, PAGE_W, PAGE_H, 1000, 440);
		expect(100 * (440 / PAGE_H) * small).toBeGreaterThanOrEqual(READABLE_LETTER_PX);
		// tiny letters on a wide photo: closer than the width, to about TARGET_LETTER_PX
		const tiny = PAGE.map((p) => ({ ...p, bottom: p.top + 30 }));
		expect(30 * (1 / 3) * at(tiny, 3000, 1500)).toBeCloseTo(TARGET_LETTER_PX, 0);
		// nothing found: the whole photo
		expect(at([], PAGE_W, PAGE_H)).toBe(1);
	});

	it('opens the page close up: letters readable, no scrolling sideways, the green box in view', () => {
		open({}, PAGE_FONT);
		const size = stageSize();
		expect((size.height * 100) / PAGE_H).toBeGreaterThanOrEqual(READABLE_LETTER_PX);
		expect(size.width).toBeLessThanOrEqual(FALLBACK_VIEW.width);
		expect(pickedId()).toBe('p1');
		expect(inView(onScreen(pagePart('p1')))).toBe(true);
	});

	it('a photo whose letters already show big opens whole, with nothing smaller to offer', () => {
		open();
		expect(stageSize()).toEqual({ width: 1000, height: 347 });
		expect(shown(action('zoomOut'))).toBe(false);
		expect(shown(action('zoomIn'))).toBe(true);
	});

	it('Zoom out goes back to the whole photo; Zoom in comes closer a step at a time', () => {
		open({}, PAGE_FONT);
		expect(action('zoomIn').getAttribute('aria-label')).toBe(word('view.zoomIn'));
		expect(action('zoomOut').getAttribute('aria-label')).toBe(word('view.zoomOut'));
		expect(shown(action('zoomOut'))).toBe(true);
		action('zoomOut').click();
		action('zoomOut').click();
		expect(stageSize()).toEqual({ width: 450, height: 600 });
		expect(shown(action('zoomOut'))).toBe(false);
		action('zoomIn').click();
		expect(stageSize().width).toBeCloseTo(450 * ZOOM_STEP, 0);
		expect(shown(action('zoomOut'))).toBe(true);
		// the green box stays in view
		expect(inView(onScreen(pagePart('p1')))).toBe(true);
		// the field keeps the focus: his next step is still typing the letter
		expect(document.activeElement).toBe(field());
	});

	it('Ctrl and the mouse wheel zoom where the pointer is; the wheel alone scrolls', () => {
		open({}, PAGE_FONT);
		const before = stageSize().width;
		const plain = wheel();
		view().dispatchEvent(plain);
		expect(plain.defaultPrevented).toBe(false);
		expect(stageSize().width).toBe(before);
		// the photo pixel under the pointer stays under it
		const pointer = { x: 500, y: 300 };
		const k0 = before / PAGE_W;
		const o0 = origin();
		const spot = { x: (pointer.x - o0.x) / k0, y: (pointer.y - o0.y) / k0 };
		const closer = wheel({ deltaY: -100, ctrlKey: true, clientX: pointer.x, clientY: pointer.y });
		view().dispatchEvent(closer);
		expect(closer.defaultPrevented).toBe(true);
		expect(stageSize().width).toBeGreaterThan(before);
		const k1 = stageSize().width / PAGE_W;
		const o1 = origin();
		expect(Math.abs(o1.x + spot.x * k1 - pointer.x)).toBeLessThan(1.5);
		expect(Math.abs(o1.y + spot.y * k1 - pointer.y)).toBeLessThan(1.5);
		view().dispatchEvent(wheel({ ctrlKey: true, clientX: pointer.x, clientY: pointer.y }));
		expect(Math.abs(stageSize().width - before)).toBeLessThan(1.5);
	});

	it('the green box comes into view wherever it moves (arrow keys, Skip)', () => {
		open({}, PAGE_FONT);
		for (let i = 0; i < 35; i++) key(field(), 'ArrowRight');
		expect(pickedId()).toBe('p36');
		expect(inView(onScreen(pagePart('p36')))).toBe(true);
		action('skip').click();
		expect(pickedId()).toBe('p1');
		expect(inView(onScreen(pagePart('p1')))).toBe(true);
	});

	it('opened on a part (Trace again, Draw a box), that part is in view', () => {
		open({ char: 'z', pick: 'p53' }, PAGE_FONT);
		expect(pickedId()).toBe('p53');
		expect(inView(onScreen(pagePart('p53')))).toBe(true);
	});

	it('close up, a click picks the letter under the pointer and a drag boxes it', () => {
		const { onTrace } = open({}, PAGE_FONT);
		const stage = measureStage();
		const p2 = onScreen(pagePart('p2'));
		press(stage, 'mousedown', (p2.left + p2.right) / 2, (p2.top + p2.bottom) / 2);
		press(window, 'mouseup', (p2.left + p2.right) / 2, (p2.top + p2.bottom) / 2);
		expect(pickedId()).toBe('p2');
		const p3 = onScreen(pagePart('p3'));
		press(stage, 'mousedown', p3.left - 10, p3.top - 10);
		press(window, 'mousemove', p3.right + 10, p3.bottom + 10);
		press(window, 'mouseup', p3.right + 10, p3.bottom + 10);
		expect(pickedId()).toBe('drawn');
		type('c');
		action('trace').click();
		expect(onTrace.mock.calls[0][0].part).toMatchObject({
			left: pagePart('p3').left,
			top: pagePart('p3').top,
			right: pagePart('p3').right,
			bottom: pagePart('p3').bottom,
		});
	});
});

describe('name tags sit beside their letter, never on another (finding 2)', () => {
	const tag = { width: 14, height: 15 };
	const bounds = { width: 1000, height: 1000 };
	const a = { left: 100, top: 100, right: 170, bottom: 200 };
	const overA = { left: 90, top: 60, right: 160, bottom: 95 };
	const underA = { left: 90, top: 205, right: 160, bottom: 260 };
	const leftOfA = { left: 60, top: 100, right: 95, bottom: 200 };
	const rightOfA = { left: 175, top: 100, right: 230, bottom: 200 };
	const spot = (part, parts, scale = 1, box = bounds) =>
		tagSpot(part, parts, { scale, tag, bounds: box });

	it('above when there is room, else below, left or right, else inside its own box', () => {
		expect(spot(a, [a])).toBe('above');
		expect(spot(a, [a, overA])).toBe('below');
		expect(spot(a, [a, overA, underA])).toBe('left');
		expect(spot(a, [a, overA, underA, leftOfA])).toBe('right');
		expect(spot(a, [a, overA, underA, leftOfA, rightOfA])).toBe('inside');
		// at the photo's top edge there is no room above
		const top = { left: 100, top: 5, right: 170, bottom: 100 };
		expect(spot(top, [top])).toBe('below');
		// close up, the same gap in the photo is wide enough on screen
		const near = { left: 90, top: 80, right: 160, bottom: 92 };
		expect(spot(a, [a, near])).toBe('below');
		expect(spot(a, [a, near], 3, { width: 3000, height: 3000 })).toBe('above');
	});

	it('on tight rows a used letter carries its tag where it covers no other letter', () => {
		const tight = pageParts({ rowGap: 6 });
		open({}, { parts: tight, width: PAGE_W, height: PAGE_H, used: { p1: 'A', p9: 'b' } });
		const tagOf = (id) => partEl(id).querySelector('.anyink-photo-dialog__tag');
		expect(tagOf('p1').textContent).toBe('A');
		expect(tagOf('p1').classList).toContain('anyink-photo-dialog__tag--above');
		expect(tagOf('p9').textContent).toBe('b');
		expect(tagOf('p9').classList).toContain('anyink-photo-dialog__tag--left');
	});
});

describe('letter known (opened from a letter: [Use a photo], Trace again, Draw a box)', () => {
	it('asks which part is the letter; Trace it and Cancel, no field', () => {
		open({ char: 'r' });
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('known');
		expect(q('h2').textContent).toBe(word('photo.dialog.titleKnown', { letter: 'small r' }));
		expect(field()).toBe(null);
		expect(action('skip')).toBe(null);
		expect(action('done')).toBe(null);
		expect(greens()).toEqual([action('trace')]);
		expect(shown(action('cancel'))).toBe(true);
		expect(document.activeElement).toBe(action('trace'));
	});

	it('Trace it hands over the letter it was opened for', () => {
		const { onTrace } = open({ char: 'r' });
		clickAt(dialog(), 340, 200);
		action('trace').click();
		expect(onTrace.mock.calls[0][0]).toMatchObject({ partId: 'p2', char: 'r', drawn: false });
	});

	it('starts on the part this letter used (Trace again), else on the guess', () => {
		const { record } = photoFont();
		usePart(record, 'p4', { char: 'n', itemId: 'glyph-0x6e' });
		openPhotoDialog({ record, char: 'n', itemId: 'glyph-0x6e' });
		expect(pickedId()).toBe('p4');
		closePhotoDialog();
		openPhotoDialog({ record, char: 'a', itemId: 'glyph-0x61' });
		expect(pickedId()).toBe('p1');
		closePhotoDialog();
		openPhotoDialog({ record, char: 'a', pick: 'p6' });
		expect(pickedId()).toBe('p6');
	});

	it('with nothing picked, Trace it says to pick first', () => {
		const used = Object.fromEntries(ROW.map((p, i) => [p.id, 'Brenahd'[i]]));
		const { onTrace } = open({ char: 'x' }, { used });
		expect(greens()).toEqual([action('trace')]);
		action('trace').click();
		expect(onTrace).not.toHaveBeenCalled();
		expect(message()).toBe(word('photo.dialog.pickFirst'));
	});
});

describe('leaving', () => {
	it('Cancel, the x and Escape close it, call onCancel and change nothing', () => {
		for (const how of ['cancel', 'close', 'escape']) {
			const { record, onCancel, onTrace } = open({ char: 'r' });
			const before = JSON.stringify(record);
			if (how === 'escape') key(document.activeElement, 'Escape');
			else action(how).click();
			expect(onCancel).toHaveBeenCalledTimes(1);
			expect(onTrace).not.toHaveBeenCalled();
			expect(dialog()).toBe(null);
			expect(JSON.stringify(record)).toBe(before);
		}
	});

	it('a box he drew and cancelled is not kept', () => {
		const { record } = open();
		dragBox(dialog(), [270, 80], [420, 300]);
		action('close').click();
		expect(record.parts.some((p) => p.drawn)).toBe(false);
	});

	it('a handler that throws never leaves the dialog half open or breaks the press', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const boom = () => {
			throw new Error('flow broke');
		};
		open({ char: 'r', onTrace: boom });
		expect(() => action('trace').click()).not.toThrow();
		expect(dialog()).toBe(null);
		open({ onCancel: boom, onDone: boom, onChange: boom });
		expect(() => action('skip').click()).not.toThrow();
		expect(() => action('done').click()).not.toThrow();
		expect(dialog()).toBe(null);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('gives the focus back to what had it', () => {
		const button = document.createElement('button');
		document.body.appendChild(button);
		button.focus();
		open();
		closePhotoDialog();
		expect(document.activeElement).toBe(button);
	});
});

describe('editor keys are blocked while it is open (4.5, 7.6)', () => {
	it('typing B in the field never reaches the editor (no Brush), and neither does Ctrl+Z', () => {
		const heard = vi.fn();
		document.addEventListener('keydown', heard);
		document.addEventListener('keydown', heard, true);
		open();
		key(field(), 'b');
		key(field(), 'z', { ctrlKey: true });
		key(document.body, 'v');
		expect(heard).not.toHaveBeenCalled();
		closePhotoDialog();
		key(document.body, 'v');
		expect(heard).toHaveBeenCalled();
		document.removeEventListener('keydown', heard);
		document.removeEventListener('keydown', heard, true);
	});
});

describe('nothing else reaches the editor or the browser while it is open', () => {
	it('a paste never reaches the editor (no photo pasted behind it); the field still takes one', () => {
		const heard = vi.fn();
		document.addEventListener('paste', heard);
		open();
		const onButton = new Event('paste', { bubbles: true, cancelable: true });
		action('skip').dispatchEvent(onButton);
		expect(heard).not.toHaveBeenCalled();
		expect(onButton.defaultPrevented).toBe(true);
		const inField = new Event('paste', { bubbles: true, cancelable: true });
		field().dispatchEvent(inField);
		expect(heard).not.toHaveBeenCalled();
		expect(inField.defaultPrevented).toBe(false);
		closePhotoDialog();
		document.body.dispatchEvent(new Event('paste', { bubbles: true }));
		expect(heard).toHaveBeenCalledTimes(1);
		document.removeEventListener('paste', heard);
	});

	it('a file dropped on it never opens in the tab', () => {
		open();
		const over = new Event('dragover', { bubbles: true, cancelable: true });
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		dialog().dispatchEvent(over);
		q('[data-anyink-photo-stage]').dispatchEvent(drop);
		expect(over.defaultPrevented).toBe(true);
		expect(drop.defaultPrevented).toBe(true);
	});
});

describe('one green button (principle 1)', () => {
	it('the Next line gives way: the probe sees the dialog and its green button', () => {
		open();
		expect(probeScreen(document)).toEqual({ dialog: PHOTO_DIALOG_NAME, otherPrimary: true });
	});
});

describe('plain words (2.3)', () => {
	scanSimpleScreen('photo dialog, letter unknown, a used part and a typed letter', () => {
		open({}, { used: { p1: 'B' } });
		type('r');
		return dialog();
	});
	scanSimpleScreen('photo dialog, Trace it with an empty field', () => {
		open();
		action('trace').click();
		return dialog();
	});
	scanSimpleScreen('photo dialog, a box round no ink', () => {
		open();
		dragBox(dialog(), [600, 300], [700, 400]);
		return dialog();
	});
	scanSimpleScreen('photo dialog, every part named', () => {
		open({}, { used: Object.fromEntries(ROW.map((p, i) => [p.id, 'Brenahd'[i]])) });
		return dialog();
	});
	scanSimpleScreen('photo dialog, no parts found', () => {
		open({}, { parts: [] });
		return dialog();
	});
	scanSimpleScreen('photo dialog, letter known, nothing picked', () => {
		open({ char: '?' }, { used: Object.fromEntries(ROW.map((p, i) => [p.id, 'Brenahd'[i]])) });
		action('trace').click();
		return dialog();
	});
});
