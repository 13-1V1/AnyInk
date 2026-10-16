// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 fix: the slant of his handwriting (UX-BEGINNER 10, B3; 7.2). Pure.

	One slant for the whole font, read from the stems, so neighbors are always measured the same
	way (sides.js takes it out before measuring a side). The shapes never change.
	  stemRuns(points, minHeight)  the straight, steep runs along one outline (a stem's edges): at
	                               least minHeight tall, leaning less than SLANT_LIMIT (50) degrees
	                               from upright, and straight (no point further from the line
	                               between the run's ends than 4% of its height: a bowl's side is
	                               not a stem). B3 finalize: 35 left a hand leaning 38 degrees
	                               with no slant at all (ll 1,387 units against 176)
	  letterSlant(item, font)      one letter's vote, tan of its lean: the middle of its stem runs,
	                               weighted by height. Only letters with a straight side in the
	                               side table vote (H n l d t ..., never o, v or punctuation), and
	                               only with their own shapes (a letter made from other letters
	                               votes through those letters)
	  estimateSlant(project)       the middle vote over every letter, degrees; null with no votes
	  measureSlant(item, font, slant)
	                               the slant one letter's sides are measured with: the font's,
	                               or the letter's own lean when its stems lean more than
	                               OWN_LEAN_STEP degrees off it (B3 finalize: one slant for every
	                               letter pushed a tall l that leaned 5 degrees more than the
	                               rest 158 units further from its neighbors)
	Keeping it: each automatic letter keeps the font's slant it was fitted with in
	glyph.anyink.spacingSlant (whole degrees, -50 to 50, absent when 0), so it rides along in the
	letter's Undo steps and in the work file, like spacingExtra. A letter's own lean needs no
	record: it is read from its own shapes, which only a step on that letter changes.
	  fittedSlant(item)            the record, 0 with none
	  recordSlant(item, degrees)   true when the record changed
	  fontSlant(project)           the slant the automatic letters with ink were fitted with (the
	                               middle of their records; a letter with none was fitted upright
	                               or not yet), 0 with none
	  nextSlant(project)           the slant the font moves to, or null: only when the stems say
	                               it leans more than SLANT_STEP degrees off fontSlant, so an
	                               upright hand never gets one and a new letter rarely moves it
	S3 (docs/SKETCH.md section 3): a sketched Centerline letter votes with its centerline, never
	its swept ink, so its thickness can never move the font's slant (probe run3b: an n with a
	leaning leg slid to the thick end turned the font to -24 degrees and its sides to 285 / -61).
	The engine stays pure: sketch/slant_vote.js hands its runs in when it loads.
	  setSlantVoter(fn)            (item, font, minHeight) => runs, or undefined to read the ink;
	                               null takes it away
	  slantVoter()                 the one handed in, or null
*/
import { isPunctuation, tableSides } from './letter_classes.js';
import { inkBounds, median } from './measure.js';
import { inkPaths, pathContour } from './outline.js';
import { isAutomatic } from './owner.js';
import { whole } from './round.js';

/** The font's slant moves only when the stems say it is more than this many degrees off. */
export const SLANT_STEP = 1.5;
/** Leaning further than this many degrees is not a stem (a z's diagonal), nor a slant. */
export const SLANT_LIMIT = 50;
/** A letter whose stems lean more than this many degrees off the font's is measured by its own. */
export const OWN_LEAN_STEP = 2;
/** A stem run is at least this share of the small-letter height. */
export const STEM_SHARE = 0.4;
/** A run is straight when no point is further than this share of its height off its line. */
export const STRAIGHT_SHARE = 0.04;

const STEEP = Math.tan((SLANT_LIMIT * Math.PI) / 180);

/** @type {Function | null} the sketch's vote (sketch/slant_vote.js) */
let voter = null;

/** @param {Function | null} fn - (item, font, minHeight) => Array<{slope, height}> | undefined */
export function setSlantVoter(fn) {
	voter = typeof fn === 'function' ? fn : null;
}

/** @returns {Function | null} */
export function slantVoter() {
	return voter;
}
const LETTER_COLLECTIONS = ['glyphs', 'ligatures'];

/**
 * @param {Array<Array<Number>>} outline - one closed outline, [x, y] pairs
 * @param {Number} minHeight - font units
 * @returns {Array<{slope: Number, height: Number}>} slope: x per unit of y (tan of the lean)
 */
export function stemRuns(outline, minHeight) {
	// A point repeated in place is no side at all: it must not cut a run in two
	const points = (outline || []).filter((point, index, list) => {
		const before = list[(index + list.length - 1) % list.length];
		return list.length < 2 || point[0] !== before[0] || point[1] !== before[1];
	});
	const count = points.length;
	if (count < 2) return [];
	const steep = (index) => {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % count];
		const dy = y2 - y1;
		if (dy === 0) return 0;
		return Math.abs(x2 - x1) <= STEEP * Math.abs(dy) ? Math.sign(dy) : 0;
	};
	const ways = points.map((_, index) => steep(index));
	// Start right after a side that isn't steep (or the way changes), so no run wraps round
	let start = ways.findIndex((way, index) => way !== ways[(index + count - 1) % count]);
	if (start < 0) start = 0;
	const runs = [];
	let chain = null;
	for (let step = 0; step <= count; step++) {
		const index = (start + step) % count;
		const way = step < count ? ways[index] : 0;
		if (chain && way !== chain.way) {
			chain.points.push(points[index]);
			runs.push(...straightRuns(chain.points, minHeight));
			chain = null;
		}
		if (way && !chain) chain = { way, points: [points[index]] };
		else if (way) chain.points.push(points[index]);
	}
	return runs;
}

/**
 * A chain of steep sides cut where it bends, into straight runs tall enough to be stems.
 * @param {Array<Array<Number>>} chain - points along the outline
 * @param {Number} minHeight
 * @returns {Array<{slope: Number, height: Number}>}
 */
function straightRuns(chain, minHeight) {
	const [x1, y1] = chain[0];
	const [x2, y2] = chain[chain.length - 1];
	const height = Math.abs(y2 - y1);
	if (!(height >= minHeight) || height === 0) return [];
	const lean = (x2 - x1) / (y2 - y1);
	let worst = 0;
	let at = -1;
	for (let i = 1; i < chain.length - 1; i++) {
		const [x, y] = chain[i];
		const off = Math.abs(x - (x1 + (y - y1) * lean));
		if (off > worst) {
			worst = off;
			at = i;
		}
	}
	if (worst <= STRAIGHT_SHARE * height) return [{ slope: lean, height }];
	return [
		...straightRuns(chain.slice(0, at + 1), minHeight),
		...straightRuns(chain.slice(at), minHeight),
	];
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {Number | null} tan of the letter's lean; null when it has no vote
 */
export function letterSlant(item, font) {
	if (!votes(item)) return null;
	const xHeight = Number(font?.xHeight) > 0 ? Number(font.xHeight) : smallLetterStandIn(font);
	const minHeight = STEM_SHARE * xHeight;
	const sketched = voter?.(item, font, minHeight);
	const runs = Array.isArray(sketched) ? sketched : inkRuns(item, minHeight);
	return runs.length ? weightedMiddle(runs) : null;
}

/** @returns {Array<{slope: Number, height: Number}>} the stem runs of the letter's own ink */
function inkRuns(item, minHeight) {
	const own = { id: item.id, shapes: (item.shapes || []).filter(isPath) };
	return inkPaths(own)
		.map(pathContour)
		.filter(Boolean)
		.flatMap((contour) => stemRuns(contour.points, minHeight));
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number | null} degrees, positive leaning right; null when no letter has stems
 */
export function estimateSlant(project) {
	const font = project?.settings?.font;
	const votesInDegrees = letters(project)
		.map((item) => letterSlant(item, font))
		.filter((lean) => lean !== null)
		.map((lean) => (Math.atan(lean) * 180) / Math.PI);
	return median(votesInDegrees);
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {Number} [slant] - the font's slant, degrees
 * @returns {Number} degrees: the font's slant, or the letter's own lean when it leans more than
 *   OWN_LEAN_STEP degrees off it
 */
export function measureSlant(item, font, slant = 0) {
	const font0 = Number.isFinite(Number(slant)) ? Number(slant) : 0;
	const lean = letterSlant(item, font);
	if (lean === null) return font0;
	const own = (Math.atan(lean) * 180) / Math.PI;
	return Math.abs(own - font0) > OWN_LEAN_STEP ? own : font0;
}

/**
 * @param {Object} item - Glyph
 * @returns {Number} whole degrees (0 with no record, or one that isn't a number)
 */
export function fittedSlant(item) {
	const value = Number(item?.anyink?.spacingSlant);
	return Number.isFinite(value) ? held(value) : 0;
}

/**
 * @param {Object} item - Glyph
 * @param {Number} degrees - the slant it was fitted with
 * @returns {Boolean} true when the record changed
 */
export function recordSlant(item, degrees) {
	if (!item || typeof item !== 'object') return false;
	const value = Number.isFinite(Number(degrees)) ? held(Number(degrees)) : 0;
	const anyink = item.anyink && typeof item.anyink === 'object' ? item.anyink : null;
	if (value === 0) {
		if (!anyink || !('spacingSlant' in anyink)) return false;
		delete anyink.spacingSlant;
		return true;
	}
	if (anyink?.spacingSlant === value) return false;
	if (!anyink) item.anyink = {};
	item.anyink.spacingSlant = value;
	return true;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number} whole degrees
 */
export function fontSlant(project) {
	// A letter with no record was fitted upright, or not fitted yet (a letter just inked): only
	// the records say which slant the font was fitted with
	const records = letters(project)
		.filter((item) => isAutomatic(item) && hasRecord(item) && !!inkBounds(item))
		.map(fittedSlant);
	const middle = median(records);
	return middle === null ? 0 : held(middle);
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number | null} whole degrees, or null: the font keeps its slant
 */
export function nextSlant(project) {
	const estimate = estimateSlant(project);
	if (estimate === null) return null;
	const current = fontSlant(project);
	if (Math.abs(estimate - current) <= SLANT_STEP) return null;
	const next = held(estimate);
	return next === current ? null : next;
}

/** @returns {Boolean} true when the letter keeps a slant it was fitted with */
function hasRecord(item) {
	return fittedSlant(item) !== 0;
}

/** @returns {Number} whole degrees from -SLANT_LIMIT to SLANT_LIMIT */
function held(degrees) {
	return Math.max(-SLANT_LIMIT, Math.min(SLANT_LIMIT, whole(degrees)));
}

/** @returns {Boolean} true for a letter with a straight side in the side table */
function votes(item) {
	const chars = [...(typeof item?.chars === 'string' ? item.chars : '')];
	if (!chars.length || chars.every(isPunctuation)) return false;
	const left = tableSides(chars[0])?.left;
	const right = tableSides(chars[chars.length - 1])?.right;
	return left === 'S' || right === 'S';
}

/** @returns {Number} the middle slope, each run counted by its height */
function weightedMiddle(runs) {
	const sorted = [...runs].sort((a, b) => a.slope - b.slope);
	const total = sorted.reduce((sum, run) => sum + run.height, 0);
	let seen = 0;
	for (let i = 0; i < sorted.length; i++) {
		seen += sorted[i].height;
		if (seen * 2 > total) return sorted[i].slope;
		if (seen * 2 === total && i + 1 < sorted.length) {
			return (sorted[i].slope + sorted[i + 1].slope) / 2;
		}
	}
	return sorted[sorted.length - 1].slope;
}

/** @returns {Number} half the letter box: the gap rule's stand-in for a missing line */
function smallLetterStandIn(font) {
	return (Number(font?.upm) > 0 ? Number(font.upm) : 1000) / 2;
}

/** @returns {Array<Object>} the font's glyphs and ligatures */
function letters(project) {
	const list = [];
	LETTER_COLLECTIONS.forEach((key) => {
		Object.values(project?.[key] || {}).forEach((item) => {
			if (item) list.push(item);
		});
	});
	return list;
}

function isPath(shape) {
	return shape?.objType === 'Path';
}
