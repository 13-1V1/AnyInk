// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter view, the canvas side: the guide letter (UX-BEGINNER.md 4.3 Canvas, 7.1 #3). A faint
	outlined system-font letter (Segoe UI, a light fill under a faint outline) sized to the right
	lines: its ink runs from its class's top to its class's bottom (placement/classes.js
	lineTargets: B on the capitals line, b on the top line, g's tail to 90 % of the tail line), at
	one scale both ways. It is never part of the letter or the font: it is drawn on the canvas only.

	When it shows (Simple with the letter view on):
	- on an empty letter, always (the Guide letter switch lives in Fine-tune, which needs ink);
	- on a letter with ink, as the switch says (view_switches.js isGuideLetterOn, the letter-card
	  track's session state): on for a letter that was empty when he opened it, so it stays while
	  he draws until he leaves the letter, or as he switched it for this visit.
	Leaving the letter page (the board, Help) ends the visit, so coming back to a letter he has
	drawn shows no guide letter (view_switches.js noteLetterOpened(null) on 'anyink-page-change';
	a page drawn again on the letter page keeps it).

	Where it sits: its ink's left side at the left space automatic spacing gives the letter
	(spacing/gap_rule.js: a stem's 1 G, a bowl's 0.6 G, an open side's 0.4 G, punctuation 0.6 G),
	so ink drawn over it needs no refit. It then stays still on screen like the ink (4.3 "The
	drawing never jumps"): when a step moves the shapes sideways and the view by the same amount
	(a refit in History.addState, a left-edge drag), it moves with them. That is told apart from
	looking around by both changing together: a pan moves only the view, a zoom changes the scale,
	a drag of a shape moves only the shapes.

	  guideLetterChar(item)            the character to draw: a letter, number or mark; '' for the
	                                   space, joined letters, parts and anything else
	  leftSpaceFor(char, font)         where the guide's ink starts, font units
	  guideLetterLayout(char, font, metrics, view, left)
	                                   pure: { scale, x, y, ink: { left, right, top, bottom } } in
	                                   canvas px for a letter measured at REF_SIZE px (metrics:
	                                   { ascent, descent, left, right }, measureText's
	                                   actualBoundingBox*); null when it has no height
	  letterVisit(item, project)       this visit to the letter: { number, shift } (shift: how far
	                                   steps moved the shapes, font units)
	  followRefits(item, view, project)   call on every draw: follows a step that moved the shapes
	                                   and the view together
	  guideLetterShown(item, project)
	  drawGuideLetter(ctx, view, item, project)   true when drawn
	  resetGuideLetterForTests()
*/
import { isGuideLetterOn, noteLetterOpened } from './view_switches.js';
import { letterCanvasOn } from './guide_lines.js';
import { lineTargets } from '../placement/classes.js';
import { sideGap } from '../spacing/gap_rule.js';
import { baseLetter, isPunctuation, tableSides } from '../spacing/letter_classes.js';
import { token, withAlpha } from '../theme/theme.js';

/** The letter is measured at this size, then scaled to the lines */
export const REF_SIZE = 200;
export const GUIDE_FONT = '"Segoe UI", system-ui, sans-serif';
/** About 15 % ink (4.3): a light fill under a slightly stronger outline */
const FILL_ALPHA = 0.1;
const OUTLINE_ALPHA = 0.3;
const OUTLINE_PX = 1.5;
/** Stand-in metrics (shares of REF_SIZE) where the canvas can't measure (no real canvas) */
const FALLBACK = Object.freeze({ ascent: 0.7, descent: 0, left: 0, right: 0.6 });
const PAGE_EVENT = 'anyink-page-change';
const LETTER_PAGE = 'Characters';

/** @type {{project: Object, id: String, number: Number, shift: Number, last: Object} | null} */
let visit = null;
let visits = 0;
let listening = false;

// --------------------------------------------------------------
// Which letter, where
// --------------------------------------------------------------

/**
 * @param {Object | false} item - the open item
 * @returns {String} one visible character, or ''
 */
export function guideLetterChar(item) {
	if (!item || item.objType !== 'Glyph') return '';
	const char = String(item.char || '');
	if ([...char].length !== 1) return '';
	if (!/\S/u.test(char) || /\p{C}|\p{Z}/u.test(char)) return '';
	return char;
}

/**
 * Where automatic spacing puts a letter's left side (B3's gap rule), so ink drawn over the
 * guide is already where the fitter wants it.
 * @param {String} char
 * @param {Object} font - project.settings.font
 * @returns {Number} font units
 */
export function leftSpaceFor(char, font) {
	if (isPunctuation(char)) return sideGap('S', font, { punctuation: true });
	const sides = tableSides(char);
	return sideGap(sides ? sides.left : 'S', font);
}

/**
 * Sizes a measured letter to its lines.
 * @param {String} char - the character drawn (an accented letter is placed by its base letter,
 *   which the metrics are for)
 * @param {Object} font - project.settings.font
 * @param {{ascent: Number, descent: Number, left: Number, right: Number}} metrics - the base
 *   letter's ink at REF_SIZE px: above and below the text baseline, left of and right of the
 *   text's start (actualBoundingBox*)
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Number} left - where the ink's left side goes, font units
 * @returns {{scale: Number, x: Number, y: Number, ink: Object} | null} draw the text at REF_SIZE
 *   with its baseline start at (x, y), scaled by scale
 */
export function guideLetterLayout(char, font, metrics, view, left) {
	const ascent = Number(metrics?.ascent) || 0;
	const descent = Number(metrics?.descent) || 0;
	const inkLeft = Number(metrics?.left) || 0;
	const inkRight = Number(metrics?.right) || 0;
	const sx = (x) => view.dx + x * view.dz;
	const sy = (y) => view.dy - y * view.dz;
	const target = lineTargets(baseLetter(char) || char, font);

	let scale;
	let y;
	if (target.top === null) {
		// the hyphen: sized by its width, centered on its line
		const wide = inkLeft + inkRight;
		if (!(wide > 0) || !(target.width > 0)) return null;
		scale = (target.width * view.dz) / wide;
		y = sy(target.center) + ((ascent - descent) / 2) * scale;
	} else {
		const tall = ascent + descent;
		const bottom = target.tailBottom ?? target.bottom;
		if (!(tall > 0) || !(target.top > bottom)) return null;
		scale = ((target.top - bottom) * view.dz) / tall;
		y = sy(target.top) + ascent * scale;
	}
	const x = sx(left) + inkLeft * scale;
	return {
		scale,
		x,
		y,
		ink: {
			left: x - inkLeft * scale,
			right: x + inkRight * scale,
			top: y - ascent * scale,
			bottom: y + descent * scale,
		},
	};
}

// --------------------------------------------------------------
// The visit
// --------------------------------------------------------------

/**
 * This visit to the letter. A new letter, or another font, starts a new one.
 * @param {Object} item
 * @param {Object} project
 * @returns {{number: Number, shift: Number}}
 */
export function letterVisit(item, project) {
	listen();
	const id = item?.id ?? null;
	if (!visit || visit.project !== project || visit.id !== id) {
		visits += 1;
		visit = { project, id, number: visits, shift: 0, last: null };
	}
	return visit;
}

/**
 * Follows a step that moved the shapes and the view together (a refit, a left-edge drag), so
 * the guide letter stays still on screen with the ink. Call it on every draw.
 * @param {Object} item - the open letter
 * @param {{dx: Number, dz: Number}} view
 * @param {Object} project
 */
export function followRefits(item, view, project) {
	if (!item) return;
	const current = letterVisit(item, project);
	const now = { dx: Number(view?.dx), dz: Number(view?.dz), shapes: shapesAt(item) };
	const last = current.last;
	if (
		last &&
		now.dz === last.dz &&
		now.dz > 0 &&
		now.dx !== last.dx &&
		now.shapes !== last.shapes &&
		Number.isFinite(now.dx) &&
		Number.isFinite(last.dx)
	) {
		// the view moved the other way by what the shapes moved (history_hook.js
		// keepInkStillOnScreen, guides_layer.js sideBearingTick)
		current.shift += (last.dx - now.dx) / now.dz;
	}
	current.last = now;
}

/**
 * @param {Object} item
 * @returns {String} where every shape is, to tell when the shapes moved
 */
function shapesAt(item) {
	return (item.shapes || [])
		.map((shape) => {
			try {
				const m = shape.maxes;
				return [m.xMin, m.xMax, m.yMin, m.yMax].map((n) => Math.round(Number(n) * 100)).join(',');
			} catch {
				return '?';
			}
		})
		.join(';');
}

/** Leaving the letter page ends the visit (the guide letter's, and the switch's). */
function listen() {
	if (listening || typeof globalThis.addEventListener !== 'function') return;
	listening = true;
	globalThis.addEventListener(PAGE_EVENT, (event) => {
		const detail = event?.detail || {};
		if (!detail.appLevel && detail.page === LETTER_PAGE) return;
		visit = null;
		noteLetterOpened(null);
	});
}

// --------------------------------------------------------------
// Showing and drawing
// --------------------------------------------------------------

/**
 * @param {Object | false} item - the open letter
 * @param {Object} project
 * @returns {Boolean}
 */
export function guideLetterShown(item, project) {
	if (!letterCanvasOn() || !guideLetterChar(item)) return false;
	letterVisit(item, project);
	// Asked every time, empty or not, so the switch's visit starts while the letter is empty
	const switchedOn = isGuideLetterOn(item);
	return !item.shapes?.length || switchedOn;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object | false} item - the open letter
 * @param {Object} project
 * @returns {Boolean} true when drawn
 */
export function drawGuideLetter(ctx, view, item, project) {
	if (!letterCanvasOn() || !item || !(Number(view?.dz) > 0)) return false;
	followRefits(item, view, project);
	if (!guideLetterShown(item, project)) return false;
	const char = guideLetterChar(item);
	const font = project.settings.font;

	ctx.save();
	ctx.font = `${REF_SIZE}px ${GUIDE_FONT}`;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	const metrics = measured(ctx, baseLetter(char) || char);
	const left = leftSpaceFor(char, font) + letterVisit(item, project).shift;
	const layout = guideLetterLayout(char, font, metrics, view, left);
	if (!layout) {
		ctx.restore();
		return false;
	}
	const ink = token('--canvas-ink');
	ctx.translate(layout.x, layout.y);
	ctx.scale(layout.scale, layout.scale);
	ctx.fillStyle = withAlpha(ink, FILL_ALPHA);
	ctx.fillText(char, 0, 0);
	ctx.lineWidth = OUTLINE_PX / layout.scale;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = withAlpha(ink, OUTLINE_ALPHA);
	ctx.strokeText(char, 0, 0);
	ctx.restore();
	return true;
}

/**
 * @param {CanvasRenderingContext2D} ctx - font already set to REF_SIZE
 * @param {String} char
 * @returns {{ascent: Number, descent: Number, left: Number, right: Number}}
 */
function measured(ctx, char) {
	const m = ctx.measureText(char) || {};
	const ascent = Number(m.actualBoundingBoxAscent) || 0;
	const descent = Number(m.actualBoundingBoxDescent) || 0;
	if (ascent + descent > 0) {
		return {
			ascent,
			descent,
			left: Number(m.actualBoundingBoxLeft) || 0,
			right: Number(m.actualBoundingBoxRight) || 0,
		};
	}
	return {
		ascent: FALLBACK.ascent * REF_SIZE,
		descent: FALLBACK.descent * REF_SIZE,
		left: FALLBACK.left * REF_SIZE,
		right: FALLBACK.right * REF_SIZE,
	};
}

export function resetGuideLetterForTests() {
	visit = null;
}
