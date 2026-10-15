// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for the B9 photo screens (photo-ui track): a font with one photo record the way
	photo-core's registry makes it, the photo's ink mask, a stand-in image, and mouse presses on
	the photo dialog's view measured in the photo's own pixels.

	  PHOTO_W, PHOTO_H, ROW        a 1500 x 520 photo with seven parts in one row ("B r e n a H d")
	  PAGE_W, PAGE_H, PAGE         a portrait 1500 x 2000 page with 8 rows of 7 letters 100 pixels
	                               tall (a whole alphabet, the shape of the first-timer's photo)
	  pageParts({ rowGap, colGap })   that page with rows and letters that far apart
	  photoFont({ parts, used, width, height })   { project, record, mask, image }: used is
	                               { p1: 'B', ... }
	  pageFont({ parts, used })    photoFont at the page's size
	  inkMask(parts, w, h)         a mask with every part's box full of ink
	  stageAt1to1(dialog)          the view's photo measured 1 screen pixel = 1 photo pixel
	  press(target, type, x, y, extra)   a mouse event at photo pixel (x, y)
	  dragBox(dialog, from, to)    a drag on the view from one photo pixel to another
	  clickAt(dialog, x, y)        a press and release on the spot
	  key(target, key, extra)      a keydown that bubbles
	  shown(el), greens(), photoOn()   what shows; the one green button; Simple + 'photo' on
*/
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { addPhoto, getPhoto, usePart } from '../photo_registry.js';

export const PHOTO_W = 1500;
export const PHOTO_H = 520;

/** Seven parts in one row, like "B r e n a H d" on the How card's first try. */
export const ROW = Object.freeze(
	Array.from({ length: 7 }, (_, i) =>
		Object.freeze({
			id: `p${i + 1}`,
			left: 100 + i * 190,
			top: 100,
			right: 200 + i * 190,
			bottom: 260,
			row: 0,
		})
	)
);

export const PAGE_W = 1500;
export const PAGE_H = 2000;

/**
 * A whole-alphabet page: 8 rows of 7 letters, 70 x 100 photo pixels each.
 * @param {{rowGap?: Number, colGap?: Number}} [options] - photo pixels between rows, letters
 * @returns {Array<Object>}
 */
export function pageParts({ rowGap = 130, colGap = 90 } = {}) {
	const parts = [];
	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 7; col++) {
			const left = 200 + col * (70 + colGap);
			const top = 150 + row * (100 + rowGap);
			parts.push(
				Object.freeze({
					id: `p${row * 7 + col + 1}`,
					left,
					top,
					right: left + 70,
					bottom: top + 100,
					row,
				})
			);
		}
	}
	return Object.freeze(parts);
}

export const PAGE = pageParts();

/**
 * @param {Array<Object>} parts
 * @param {Number} [width]
 * @param {Number} [height]
 * @returns {Uint8Array}
 */
export function inkMask(parts, width = PHOTO_W, height = PHOTO_H) {
	const mask = new Uint8Array(width * height);
	for (const part of parts) {
		for (let y = part.top; y < part.bottom; y++) {
			for (let x = part.left; x < part.right; x++) mask[y * width + x] = 1;
		}
	}
	return mask;
}

/**
 * @param {{parts?: Array<Object>, used?: Object<String, String>, asset?: String, width?: Number,
 *   height?: Number}} [options]
 * @returns {{project: Object, record: Object, mask: Uint8Array, image: HTMLCanvasElement}}
 */
export function photoFont({
	parts = ROW,
	used = {},
	asset = 'img-photo0001',
	width = PHOTO_W,
	height = PHOTO_H,
} = {}) {
	const project = new GlyphrStudioProject();
	addPhoto(project, { asset, width, height, parts, paper: 'photo' });
	const record = getPhoto(project, asset);
	Object.entries(used).forEach(([partId, char], i) =>
		usePart(record, partId, { char, itemId: `glyph-used-${i}` })
	);
	const image = document.createElement('canvas');
	image.width = width;
	image.height = height;
	return { project, record, mask: inkMask(parts, width, height), image };
}

/** The whole-alphabet page: photoFont with PAGE's size. */
export function pageFont({ parts = PAGE, used = {} } = {}) {
	return photoFont({ parts, used, width: PAGE_W, height: PAGE_H });
}

/** Simple mode, with the photo screens' flag on. */
export function photoOn() {
	setModeForTests('simple');
	setFeaturesForTests({ photo: true });
}

/**
 * Measures the dialog's photo 1:1 (jsdom lays nothing out).
 * @param {HTMLElement} [root]
 */
export function stageAt1to1(root = document) {
	const stage = root.querySelector('[data-anyink-photo-stage]');
	stage.getBoundingClientRect = () => ({
		left: 0,
		top: 0,
		right: PHOTO_W,
		bottom: PHOTO_H,
		width: PHOTO_W,
		height: PHOTO_H,
		x: 0,
		y: 0,
	});
	return stage;
}

/**
 * @param {EventTarget} target
 * @param {String} type - 'mousedown', 'mousemove', 'mouseup'
 * @param {Number} x - photo pixels (the view is measured 1:1)
 * @param {Number} y
 * @param {Object} [extra]
 */
export function press(target, type, x, y, extra = {}) {
	target.dispatchEvent(
		new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
			button: 0,
			...extra,
		})
	);
}

/**
 * @param {HTMLElement} [root]
 * @param {[Number, Number]} from
 * @param {[Number, Number]} to
 */
export function dragBox(root, from, to) {
	const stage = stageAt1to1(root);
	press(stage, 'mousedown', from[0], from[1]);
	press(window, 'mousemove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
	press(window, 'mousemove', to[0], to[1]);
	press(window, 'mouseup', to[0], to[1]);
}

/**
 * @param {HTMLElement} [root]
 * @param {Number} x
 * @param {Number} y
 */
export function clickAt(root, x, y) {
	const stage = stageAt1to1(root);
	press(stage, 'mousedown', x, y);
	press(window, 'mouseup', x, y);
}

/**
 * @param {EventTarget} target
 * @param {String} key
 * @param {Object} [extra]
 * @returns {KeyboardEvent}
 */
export function key(target, key, extra = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
	target.dispatchEvent(event);
	return event;
}

/**
 * @param {Element | null} element
 * @returns {Boolean} on the page and not hidden by it or a parent
 */
export function shown(element) {
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hidden || node.hasAttribute('hidden')) return false;
	}
	return !!element?.isConnected;
}

/** @returns {Array<HTMLElement>} the green buttons that show */
export function greens() {
	return [...document.querySelectorAll('.anyink-primary')].filter(shown);
}
