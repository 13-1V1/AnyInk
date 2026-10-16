// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: automatic spacing (UX-BEGINNER 10, B3; 4.6; 7.2). Pure functions on a project:
	no editor, no Undo step, no topics. The hooks track wires them into History (the refit
	hook), the letter card ([Back to automatic]) and Try it (the letter-spacing slider).

	  sideKinds(item, font, slant) each side's kind: the table (by the letter, or its base
	                               letter), else measured from the ink; and whether the letter is
	                               punctuation
	  spacingBounds(item, project, slant)
	                               where the letter's sides are (sides.js): its body, with the
	                               slant taken out (the font's, or the letter's own lean when it
	                               leans its own way, slant.js measureSlant). Dots, accents and
	                               tails don't set a side but may hang into the space beside it,
	                               never out of the letter's width; a slanted hand is spaced
	                               like the same hand upright
	  fitSpacing(item, project)    puts the letter's left space and width where the gap rule
	                               says, the extra included: rounds the letter's points to whole
	                               units, moves the shapes and the photo together, sets a whole
	                               width (above 0: it has ink). Fits any letter it is given; the
	                               owner flag is the caller's business. A letter with no ink is
	                               left alone.
	  fitAllAutomatic(project)     fitSpacing on every automatic letter (glyphs and ligatures),
	                               letters made from other letters after those letters; first
	                               the font takes the slant its stems say (slant.js nextSlant)
	  followSlant(project)         only when the stems say the font's slant moved: every
	                               automatic letter fitted again with the new slant
	  sitsAtFit(item, project)     true when fitSpacing would not move the letter's ink or change
	                               its width (read only)
	  fitDependents(item, project) after a letter changed: fitSpacing on every automatic letter
	                               made from it (directly or through other letters), deepest
	                               last; dependentsOffFit(item, project) lists the ones that
	                               need it, without changing anything
	  setExtra(project, value)     the letter-spacing slider: stores the extra (whole, -G..+G)
	                               and moves every letter with ink, automatic or set by him. A
	                               side never goes below zero space unless it already was. Safe
	                               to call on every tick of a drag: each call works from each
	                               letter's own spacing, so many small steps end where one does
	Each returns what moved ({ id, dx }), so the caller can move the view with the open letter
	("the drawing never jumps") and name the letters it changed.
	The slant: a fit measures with the font's slant (slant.js fontSlant, the one its automatic
	letters were fitted with), or with the letter's own lean when it leans more than 2 degrees
	off it (measureSlant), and records the font's on the letter (anyink.spacingSlant), so it
	rides along in Undo steps; only fitAllAutomatic and followSlant move it.
*/
import { appliedExtra, getExtra, recordApplied, storeExtra } from './extra.js';
import { clampExtra, sideGap, withExtra } from './gap_rule.js';
import { tableSides } from './letter_classes.js';
import { inkBounds, isPunctuationItem, measuredSides } from './measure.js';
import { isAutomatic } from './owner.js';
import { roundItemPoints, whole } from './round.js';
import { sideBounds } from './sides.js';
import { fontSlant, measureSlant, nextSlant, recordSlant } from './slant.js';
import { followPhoto, moveSideways } from './trace_follow.js';

/** The project collections that hold letters (components are parts, not letters). */
const LETTER_COLLECTIONS = ['glyphs', 'ligatures'];
/** Their item types */
const LETTER_TYPES = ['Glyph', 'Ligature'];

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {Number} [slant] - the font's slant, degrees (a measured letter is measured upright)
 * @returns {{left: String, right: String, source: 'table' | 'measured', punctuation: Boolean}
 *   | null} null when the table doesn't know the letter and it has no ink to measure
 */
export function sideKinds(item, font, slant = 0) {
	const chars = [...(typeof item?.chars === 'string' ? item.chars : '')];
	let left = chars.length ? tableSides(chars[0])?.left : undefined;
	let right = chars.length ? tableSides(chars[chars.length - 1])?.right : undefined;
	let source = 'table';
	if (!left || !right) {
		const measured = measuredSides(item, font, slant);
		if (!measured) return null;
		left = left || measured.left;
		right = right || measured.right;
		source = 'measured';
	}
	return { left, right, source, punctuation: isPunctuationItem(item) };
}

/**
 * Where a letter's sides are for spacing: its body, the slant taken out, marks and tails hanging
 * into the space beside it no further than its width allows (sides.js).
 * @param {Object} item - Glyph
 * @param {Object} project - GlyphrStudioProject
 * @param {Number} [slant] - the font's slant, degrees; the one its letters are fitted with when
 *   left out
 * @returns {{xMin: Number, xMax: Number} | null} null with no ink
 */
export function spacingBounds(item, project, slant) {
	const fit = fittedSides(item, project, slant);
	return fit ? sidesOf(item, project, fit) : null;
}

/**
 * @param {Object} item
 * @param {Object} project
 * @param {Object} fit - fittedSides
 * @returns {{xMin: Number, xMax: Number} | null}
 */
function sidesOf(item, project, fit) {
	return sideBounds(item, project?.settings?.font, fit.angle, fit.target, fit.fontAngle);
}

/**
 * What the gap rule asks of a letter, without changing it.
 * @param {Object} item - Glyph
 * @param {Object} project - GlyphrStudioProject
 * @param {Number} [slant] - the font's slant, degrees; the one its letters are fitted with when
 *   left out
 * @returns {{kinds: Object, base: {left: Number, right: Number},
 *   target: {left: Number, right: Number}, extra: Number, angle: Number, fontAngle: Number} |
 *   null} base is the gap without the extra, target with it (whole font units); angle: the
 *   slant this letter is measured with (measureSlant); fontAngle: the font's; null with no ink
 */
export function fittedSides(item, project, slant) {
	const font = project?.settings?.font;
	if (!inkBounds(item)) return null;
	const fontAngle = slant ?? fontSlant(project);
	const angle = measureSlant(item, font, fontAngle);
	const kinds = sideKinds(item, font, angle);
	if (!kinds) return null;
	const options = { punctuation: kinds.punctuation };
	const base = {
		left: sideGap(kinds.left, font, options),
		right: sideGap(kinds.right, font, options),
	};
	const extra = getExtra(project);
	const target = { left: withExtra(base.left, extra), right: withExtra(base.right, extra) };
	return { kinds, base, target, extra, angle, fontAngle };
}

/**
 * @param {Object} item - Glyph
 * @param {Object} project - GlyphrStudioProject
 * @returns {{changed: Boolean, dx: Number, left: Number | null, right: Number | null,
 *   width: Number, kinds: Object | null}}
 */
export function fitSpacing(item, project) {
	return fitOne(item, project, null, fontSlant(project));
}

/**
 * fitSpacing, with the project's component links and the slant read once per batch.
 * @param {Object} item
 * @param {Object} project
 * @param {Map | null} links - linkIndex(project), or null to read it when needed
 * @param {Number} slant - degrees: what the letter is measured with, and keeps
 */
function fitOne(item, project, links, slant) {
	if (!item || !inkBounds(item)) {
		return {
			changed: false,
			dx: 0,
			left: null,
			right: null,
			width: item?.advanceWidth ?? 0,
			kinds: null,
		};
	}
	const rounded = roundItemPoints(item) > 0;
	const fit = fittedSides(item, project, slant);
	const placed = placeInk(item, sidesOf(item, project, fit), fit.target);
	if (rounded || placed.dx) refreshDependents(item, links || linkIndex(project));
	let changed = placed.changed || rounded;
	changed = recordSlant(item, slant) || changed;
	const applied = {
		left: fit.target.left - fit.base.left,
		right: fit.target.right - fit.base.right,
	};
	changed = recordApplied(item, applied, fit.extra) || changed;
	return {
		changed,
		dx: placed.dx,
		left: fit.target.left,
		right: fit.target.right,
		width: item.advanceWidth,
		kinds: fit.kinds,
	};
}

/**
 * True when the letter's left space and width are where fitSpacing puts them (points not
 * counted). Changes nothing.
 * @param {Object} item - Glyph
 * @param {Object} project - GlyphrStudioProject
 * @param {Number} [slant] - degrees; the font's slant when left out
 * @returns {Boolean} false for a letter with no ink
 */
export function sitsAtFit(item, project, slant) {
	if (!inkBounds(item)) return false;
	const fit = fittedSides(item, project, slant ?? fontSlant(project));
	if (!fit) return false;
	const plan = planInk(sidesOf(item, project, fit), fit.target);
	return plan.dx === 0 && plan.width === Number(item.advanceWidth);
}

/**
 * The automatic letters made from this one (directly, or through components and other
 * letters) whose spacing no longer sits at its fit: the item's ink moved or changed, so theirs
 * did too. Changes nothing but the cached outlines of the letters made from it.
 * @param {Object} item - the letter that changed
 * @param {Object} project - GlyphrStudioProject
 * @returns {Array<Object>} letters (glyphs and ligatures)
 */
export function dependentsOffFit(item, project) {
	if (!item?.id) return [];
	const links = linkIndex(project);
	if (!links.has(item.id)) return [];
	refreshDependents(item, links);
	const slant = fontSlant(project);
	return dependentLetters(item, links).filter(
		(other) => isAutomatic(other) && !!inkBounds(other) && !sitsAtFit(other, project, slant)
	);
}

/**
 * fitSpacing on every automatic letter made from this one, letters made from other letters
 * after those letters. The caller makes the Undo step (it changes letters that aren't open).
 * @param {Object} item - the letter that changed
 * @param {Object} project - GlyphrStudioProject
 * @returns {Array<{id: String, dx: Number}>} the letters that changed
 */
export function fitDependents(item, project) {
	if (!item?.id) return [];
	const links = linkIndex(project);
	if (!links.has(item.id)) return [];
	refreshDependents(item, links);
	const targets = new Set(dependentLetters(item, links).filter((other) => isAutomatic(other)));
	if (!targets.size) return [];
	const slant = fontSlant(project);
	return runBatch(project, (other, batchLinks) =>
		targets.has(other) ? fitOne(other, project, batchLinks, slant) : null
	);
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Array<{id: String, dx: Number}>} the letters that changed
 */
export function fitAllAutomatic(project) {
	return fitAllWith(project, nextSlant(project) ?? fontSlant(project));
}

/**
 * When the stems say the font leans more than 1.5 degrees off the slant its automatic letters
 * were fitted with: every automatic letter fitted again with the new one. The caller makes the
 * Undo step (it changes letters that aren't open). Nothing changes otherwise.
 * @param {Object} project - GlyphrStudioProject
 * @returns {Array<{id: String, dx: Number}>} the letters that changed
 */
export function followSlant(project) {
	const slant = nextSlant(project);
	return slant === null ? [] : fitAllWith(project, slant);
}

/**
 * @param {Object} project
 * @param {Number} slant - degrees
 * @returns {Array<{id: String, dx: Number}>}
 */
function fitAllWith(project, slant) {
	return runBatch(project, (item, links) =>
		isAutomatic(item) ? fitOne(item, project, links, slant) : null
	);
}

/**
 * The letter-spacing slider.
 * @param {Object} project - GlyphrStudioProject
 * @param {Number} value - requested extra, font units
 * @returns {{extra: Number, moved: Array<{id: String, dx: Number}>}}
 */
export function setExtra(project, value) {
	const font = project?.settings?.font;
	const extra = clampExtra(value, font);
	const before = getExtra(project);
	const slant = fontSlant(project);
	// Every letter's own spacing, read before anything moves: a letter made from another
	// letter moves with it, so its own spacing can't be read part way through
	const own = new Map();
	lettersInOrder(project).forEach((item) => {
		const ink = inkBounds(item);
		if (!ink || isAutomatic(item)) return;
		const applied = appliedExtra(item, before);
		own.set(item, {
			left: ink.xMin - applied.left,
			right: Number(item.advanceWidth) - ink.xMax - applied.right,
		});
	});
	storeExtra(project, extra);
	const moved = runBatch(project, (item, links) => {
		if (isAutomatic(item)) return fitOne(item, project, links, slant);
		const base = own.get(item);
		if (!base) return null;
		const target = { left: withExtra(base.left, extra), right: withExtra(base.right, extra) };
		// His letter may keep a width of 0 if he left it so (the font check names it): the
		// slider never fixes it behind his back, it only never makes a width below 0
		const placed = placeInk(item, inkBounds(item), target, 0);
		if (placed.dx) refreshDependents(item, links);
		const ink = inkBounds(item);
		const applied = {
			left: ink.xMin - base.left,
			right: item.advanceWidth - ink.xMax - base.right,
		};
		const recorded = recordApplied(item, applied, extra);
		return { changed: placed.changed || recorded, dx: placed.dx };
	});
	return { extra, moved };
}

/**
 * Moves a letter's ink so the space left of its sides is `target.left` and sets its width so
 * the space right of them is `target.right`, in whole units. A side meant to be 0 or more
 * never ends up below 0 by rounding. The photo moves with the shapes.
 * @param {Object} item - Glyph with ink
 * @param {{xMin: Number, xMax: Number}} sides - spacingBounds for a fitted letter, inkBounds
 *   for one set by him
 * @param {{left: Number, right: Number}} target
 * @param {Number} [minWidth] - the least width it may get: 1 for a fitted letter (it has
 *   ink, so the next letter must never sit on top of it)
 * @returns {{changed: Boolean, dx: Number}}
 */
function placeInk(item, sides, target, minWidth = 1) {
	const { dx, width } = planInk(sides, target, minWidth);
	const moved = moveSideways(item, dx);
	const widthChanged = width !== item.advanceWidth;
	if (widthChanged) item.advanceWidth = width;
	return { changed: moved || widthChanged, dx: moved ? dx : 0 };
}

/**
 * Where placeInk puts a letter's ink and width (placeInk without the move).
 * @param {{xMin: Number, xMax: Number}} ink - the sides placeInk was given
 * @param {{left: Number, right: Number}} target
 * @param {Number} [minWidth]
 * @returns {{dx: Number, width: Number}} whole font units
 */
function planInk(ink, target, minWidth = 1) {
	let dx = whole(target.left - ink.xMin);
	if (target.left >= 0 && ink.xMin + dx < 0) dx = Math.ceil(-ink.xMin);
	const xMax = ink.xMax + dx;
	let width = whole(xMax + target.right);
	if (target.right >= 0 && width < xMax) width = Math.ceil(xMax);
	if (width < minWidth) width = minWidth;
	return { dx, width };
}

/**
 * Runs one change over every letter, letters made from other letters after those letters,
 * and keeps photos under the ink of letters made from others (their ink also moves when the
 * letters they are made from move).
 * @param {Object} project
 * @param {Function} change - (item, links) => {changed, dx} | null
 * @returns {Array<{id: String, dx: Number}>}
 */
function runBatch(project, change) {
	const letters = lettersInOrder(project);
	const links = linkIndex(project);
	const start = new Map();
	letters.forEach((item) => {
		if (hasComponents(item)) start.set(item, inkBounds(item)?.xMin);
	});
	const moved = [];
	const ownMove = new Map();
	letters.forEach((item) => {
		const result = change(item, links);
		if (!result?.changed) return;
		moved.push({ id: item.id, dx: result.dx || 0 });
		ownMove.set(item, result.dx || 0);
	});
	start.forEach((xMin, item) => {
		const now = inkBounds(item)?.xMin;
		if (!Number.isFinite(xMin) || !Number.isFinite(now)) return;
		const drift = now - xMin - (ownMove.get(item) || 0);
		if (drift) followPhoto(item, drift);
	});
	return moved;
}

/**
 * Glyphs and ligatures, each after every letter it is made from.
 * @param {Object} project
 * @returns {Array<Object>}
 */
function lettersInOrder(project) {
	const letters = [];
	LETTER_COLLECTIONS.forEach((key) => {
		Object.values(project?.[key] || {}).forEach((item) => {
			if (item) letters.push(item);
		});
	});
	const depth = new Map();
	const depthOf = (item, seen = new Set()) => {
		if (depth.has(item)) return depth.get(item);
		if (seen.has(item)) return 0;
		seen.add(item);
		let deepest = 0;
		(item.shapes || []).forEach((shape) => {
			if (shape?.objType !== 'ComponentInstance') return;
			const part = project.getItem?.(shape.link);
			if (part && part !== item) deepest = Math.max(deepest, depthOf(part, seen) + 1);
		});
		depth.set(item, deepest);
		return deepest;
	};
	letters.forEach((item) => depthOf(item));
	return letters
		.map((item, index) => ({ item, index }))
		.sort((a, b) => depth.get(a.item) - depth.get(b.item) || a.index - b.index)
		.map(({ item }) => item);
}

/**
 * Who is made from whom: for each letter id, the shapes elsewhere that show it.
 * @param {Object} project
 * @returns {Map<String, Array<{owner: Object, shape: Object}>>}
 */
function linkIndex(project) {
	const index = new Map();
	[...LETTER_COLLECTIONS, 'components'].forEach((key) => {
		Object.values(project?.[key] || {}).forEach((owner) => {
			(owner?.shapes || []).forEach((shape) => {
				if (shape?.objType !== 'ComponentInstance' || !shape.link) return;
				if (!index.has(shape.link)) index.set(shape.link, []);
				index.get(shape.link).push({ owner, shape });
			});
		});
	});
	return index;
}

/**
 * A letter's shapes moved: every letter made from it (and from those) measures again.
 * Upstream's glyphChanged does this for the open font only; spacing works on any project.
 * @param {Object} item - the letter that moved
 * @param {Map} links - linkIndex
 * @param {Set} [seen]
 */
function refreshDependents(item, links, seen = new Set()) {
	(links?.get(item.id) || []).forEach(({ owner, shape }) => {
		shape.cache = {};
		owner.cache = {};
		if (seen.has(owner)) return;
		seen.add(owner);
		refreshDependents(owner, links, seen);
	});
}

/**
 * The letters (glyphs and ligatures) made from this one, directly or through components and
 * other letters.
 * @param {Object} item
 * @param {Map} links - linkIndex
 * @returns {Array<Object>}
 */
function dependentLetters(item, links) {
	const found = new Set();
	const walk = (from) => {
		(links.get(from.id) || []).forEach(({ owner }) => {
			if (!owner || owner === item || found.has(owner)) return;
			found.add(owner);
			walk(owner);
		});
	};
	walk(item);
	return [...found].filter((owner) => LETTER_TYPES.includes(owner.objType));
}

function hasComponents(item) {
	return (item.shapes || []).some((shape) => shape?.objType === 'ComponentInstance');
}
