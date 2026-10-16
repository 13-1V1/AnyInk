// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 stand-ins (UX-BEGINNER.md 4.0 Rendered letters, 4.6 Stand-ins): on the preview sheet, a
	letter not made yet shows as a faint outlined letter (about 15% ink, no box), as wide as a
	letter, so a word with a missing letter still reads as a word; a small legend, "gray = not made
	yet", stays until 5 letters are ready. Simple only, with the 'tryIt' flag; All tools draws the
	sheet as before.

	A letter is made when it has ink (board/letter_set.js hasInk, the one ink rule: the shape the
	Point pen is still drawing is no ink). The sheet is laid out on a read-only view of the font
	(makeLayoutProject): a made letter is itself; an empty letter (often width 0) and a letter with
	no record at all come back as stand-ins with a measured width. The font is never changed.

	  STAND_IN_ALPHA, CAP_RATIO, SIDE_RATIO, LEGEND_UNTIL_READY
	  standInsWanted({ simple, isOn })      Simple with 'tryIt' on
	  standInType(font)                     the stand-in's type size in font units
	  standInWidth(char, font, measure, fallback)   whole font units
	  makeMeasure(doc)                      char -> its width per px of type size (system sans)
	  makeLayoutProject(project, { open, measure })   the view the sheet is laid out on
	  isStandIn(item)
	  standInsOnSheet(textBlock)            the placed stand-ins (charData), spaces left out
	  drawStandIns(ctx, textBlock, { color, font })   -> how many it drew
	  legendShows({ drawn, ready })
*/
import { hasInk } from '../board/letter_set.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';

/** 4.0: "about 15% ink" */
export const STAND_IN_ALPHA = 0.15;
/** a sans-serif capital stands about 0.7 of its type size tall */
export const CAP_RATIO = 0.7;
/** room each side of a stand-in, as a share of its type size */
export const SIDE_RATIO = 0.06;
/** 4.0: the legend shows "until 5 letters are ready" */
export const LEGEND_UNTIL_READY = 5;
export const STAND_IN_FAMILY = 'sans-serif';

/** @type {WeakSet<Object>} */
const standIns = new WeakSet();

/**
 * @param {{simple?: Boolean, isOn?: (name: String) => Boolean}} [options]
 * @returns {Boolean}
 */
export function standInsWanted({ simple = isSimpleMode(), isOn = isFeatureOn } = {}) {
	return !!simple && isOn('tryIt') === true;
}

/**
 * @param {{upm?: Number, capHeight?: Number}} font - project.settings.font
 * @returns {Number} type size in font units that puts a capital at the capitals line
 */
export function standInType(font) {
	const cap = Number(font?.capHeight);
	if (Number.isFinite(cap) && cap > 0) return Math.round(cap / CAP_RATIO);
	const upm = Number(font?.upm);
	return Number.isFinite(upm) && upm > 0 ? upm : 1000;
}

/**
 * @param {String} char
 * @param {Object} font - project.settings.font
 * @param {(char: String) => Number} measure - width per px of type size
 * @param {Number} [fallback] - the font's default width
 * @returns {Number} whole font units
 */
export function standInWidth(char, font, measure, fallback = 600) {
	const type = standInType(font);
	const per = Number(measure?.(char));
	if (!Number.isFinite(per) || per <= 0) return Math.round(Number(fallback) || 0);
	return Math.round(per * type + 2 * SIDE_RATIO * type);
}

/**
 * @param {Document} [doc]
 * @returns {(char: String) => Number} width per px of type size, in the system sans-serif
 */
export function makeMeasure(doc = globalThis.document) {
	const cache = new Map();
	let ctx = null;
	return (char) => {
		if (cache.has(char)) return cache.get(char);
		if (!ctx) ctx = doc?.createElement?.('canvas')?.getContext?.('2d') || null;
		let per = NaN;
		if (ctx && typeof ctx.measureText === 'function') {
			ctx.font = `100px ${STAND_IN_FAMILY}`;
			per = Number(ctx.measureText(char)?.width) / 100;
		}
		cache.set(char, per);
		return per;
	};
}

/**
 * @param {String} id
 * @returns {String} the character of a 'glyph-0x61' id, '' when it isn't one
 */
function charOfId(id) {
	if (typeof id !== 'string' || !id.startsWith('glyph-')) return '';
	const code = parseInt(id.slice('glyph-'.length), 16);
	if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
	return String.fromCodePoint(code);
}

/**
 * The read-only view of the font the sheet is laid out on.
 * @param {Object} project - GlyphrStudioProject
 * @param {{open?: Object | null, measure?: (char: String) => Number}} [options]
 * @returns {Object} the project, except getItem: a letter without ink comes back as a stand-in
 */
export function makeLayoutProject(project, { open = null, measure = makeMeasure() } = {}) {
	const made = new Map();
	const font = project?.settings?.font;
	const fallback = Number(project?.defaultAdvanceWidth) || 600;
	const standIn = (id, item) => {
		if (made.has(id)) return made.get(id);
		const char = charOfId(id);
		const width = standInWidth(char, font, measure, fallback);
		const result = item
			? new Proxy(item, {
					get: (target, key) =>
						key === 'advanceWidth' ? width : Reflect.get(target, key, target),
			  })
			: { id, char, shapes: [], advanceWidth: width, standIn: true };
		standIns.add(result);
		made.set(id, result);
		return result;
	};
	return new Proxy(project, {
		get(target, key) {
			if (key !== 'getItem') return Reflect.get(target, key, target);
			return (id, forceCreate = false, ...rest) => {
				const item = target.getItem(id, forceCreate, ...rest);
				if (forceCreate || typeof id !== 'string' || !id.startsWith('glyph-')) return item;
				if (item && hasInk(item, { open })) return item;
				if (!charOfId(id).trim()) return item;
				return standIn(id, item || null);
			};
		},
	});
}

/**
 * @param {*} item
 * @returns {Boolean}
 */
export function isStandIn(item) {
	return !!item && typeof item === 'object' && standIns.has(item);
}

/**
 * @param {{data?: Array<Array<Object>>}} textBlock
 * @returns {Array<Object>} charData of the stand-ins the layout placed on the sheet
 */
export function standInsOnSheet(textBlock) {
	const blocks = Array.isArray(textBlock?.data) ? textBlock.data : [];
	const found = [];
	blocks.forEach((block) => {
		if (!Array.isArray(block)) return;
		block.forEach((charData) => {
			if (!charData?.isVisible || !charData.view) return;
			if (!isStandIn(charData.item)) return;
			if (!String(charData.char || '').trim()) return;
			found.push(charData);
		});
	});
	return found;
}

/**
 * @param {CanvasRenderingContext2D} ctx - CSS px (the DisplayCanvas's own transform)
 * @param {Object} textBlock
 * @param {{color: String, font: Object}} options
 * @returns {Number} how many stand-ins it drew
 */
export function drawStandIns(ctx, textBlock, { color, font }) {
	const placed = standInsOnSheet(textBlock);
	if (!ctx || !placed.length) return 0;
	const type = standInType(font);
	ctx.save();
	placed.forEach((charData) => {
		const { dx, dy, dz } = charData.view;
		const size = Math.max(1, type * dz);
		const width = (Number(charData.widths?.advance) || 0) * dz;
		ctx.globalAlpha = STAND_IN_ALPHA;
		ctx.strokeStyle = color;
		ctx.lineWidth = Math.max(1, size / 60);
		ctx.font = `${size}px ${STAND_IN_FAMILY}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		ctx.strokeText(charData.char, dx + width / 2, dy);
	});
	ctx.restore();
	return placed.length;
}

/**
 * @param {{drawn: Number, ready: Number}} counts
 * @returns {Boolean}
 */
export function legendShows({ drawn, ready }) {
	return Number(drawn) > 0 && Number(ready) < LEGEND_UNTIL_READY;
}
