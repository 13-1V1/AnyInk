// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The font check's rules (B1, UX-BEGINNER 7.2). Each letter is judged the way the
	exporter writes it: widths rounded like font_export.js sanitizeInt, points rounded
	like its round(), letters made from other letters flattened first.
	  1. width           a whole number from 0 to 65,535 after rounding
	  2. ink-no-width    a width above 0 (after rounding) when the letter has ink
	  3. space-no-width  the space (and the no-break space), with no ink, needs a width above
	                     0 too: a space 0 wide makes every word typed with the font run together
	  4. point           every point and curve handle from -32,768 to 32,767 after rounding,
	                     and every step from one to the next as the font file stores them:
	                     both file kinds store a step, not the point itself (CFF charstrings
	                     in an .otf, the glyf table in a .ttf), and a longer step wraps
	                     around. Steps go in the exporter's order (font_export.js
	                     pathToContour): a shape's first point, then per side its curve
	                     handles (when it curves) and its end point, the last side ending on
	                     the first point; then on to the next shape's first point.
	  5. shape           every shape has at least 3 points. Two exceptions, both because the
	                     font file holds them fine: an empty shape is never written, and a
	                     1- or 2-point shape with a curve makes ink (Oblegg's ff joins)
	  6. kern-range      after the letters, every kern pair the font file will hold
	                     (validate_kerning.js)
	At most one problem per rule per letter, in that order.

	  validateItem(item)              -> [{ itemId, problem, message }]
	  validateFont(project, options)  -> the same, for every letter in the exporter's list
	                                     (export_list.js getExportList; options are its
	                                     omitEmptyLetters / addSpaceIfMissing), then kerning
	  checkedItems(project, options)  -> the letters validateFont looks at
	  isStrayShape(shape)             -> rule 5 for one shape (fix_it.js uses it too)
	Messages are one plain sentence that starts with the letter's name ("small a has ...").
	The check never changes the project.
*/
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { getExportList } from './export_list.js';
import { KERN_PROBLEM, validateKerning } from './validate_kerning.js';

export const PROBLEM = {
	width: 'width-range',
	inkNoWidth: 'ink-no-width',
	spaceNoWidth: 'space-no-width',
	point: 'point-range',
	shape: 'shape-points',
	kern: KERN_PROBLEM,
};

export const MAX_WIDTH = 65535;
/** A font file holds a point, and a step between two points, as a 16-bit whole number. */
export const MIN_COORD = -32768;
export const MAX_COORD = 32767;
export const MIN_SHAPE_POINTS = 3;
/** The space and the no-break space (Word types the second after some punctuation). */
const SPACES = [' ', String.fromCharCode(0xa0)];

/**
 * The letters the font file will hold, in the exporter's order.
 * @param {Object} project
 * @param {Object} [options] - getExportList options (never forExport: a check is read-only)
 * @returns {Array<Object>} items (glyphs, then ligatures)
 */
export function checkedItems(
	project,
	{ omitEmptyLetters = false, addSpaceIfMissing = false } = {}
) {
	const list = getExportList(project, { omitEmptyLetters, addSpaceIfMissing });
	return [...list.glyphs, ...list.ligatures].map((entry) => entry.xg);
}

/**
 * Checks every letter the font file will hold, then its kerning.
 * @param {Object} project
 * @param {Object} [options] - see checkedItems
 * @returns {Array<{itemId: String, problem: String, message: String}>}
 */
export function validateFont(
	project,
	{ omitEmptyLetters = false, addSpaceIfMissing = false } = {}
) {
	const list = getExportList(project, { omitEmptyLetters, addSpaceIfMissing });
	const items = [...list.glyphs, ...list.ligatures].map((entry) => entry.xg);
	const letters = list.glyphs.map(({ xc }) => xc);
	return [...items.flatMap((item) => validateItem(item)), ...validateKerning(project, letters)];
}

/**
 * Checks one letter.
 * @param {Object} item - Glyph (a letter or a ligature)
 * @returns {Array<{itemId: String, problem: String, message: String}>}
 */
export function validateItem(item) {
	if (!item) return [];
	const words = wordsFor(item);
	const problems = [];
	const add = (problem, message) => problems.push({ itemId: item.id, problem, message });

	const paths = flatPaths(item);
	const hasInk = paths.some((path) => path.pathPoints.length > 0);

	const width = Number(item.advanceWidth);
	if (!Number.isFinite(width)) {
		add(PROBLEM.width, `${words.Name} ${words.has} a width the font file can't hold.`);
	} else if (Math.round(width) > MAX_WIDTH) {
		add(PROBLEM.width, `${words.Name} ${words.is} wider than the font file allows.`);
	} else if (Math.round(width) < 0) {
		add(
			PROBLEM.width,
			`${words.Name} ${words.has} a width below zero, which the font file can't hold.`
		);
	} else if (Math.round(width) === 0 && hasInk) {
		add(
			PROBLEM.inkNoWidth,
			`${words.Name} ${words.has} ink but no width, so the next letter would sit on top of ${words.it}.`
		);
	} else if (Math.round(width) === 0 && SPACES.includes(item.chars)) {
		add(
			PROBLEM.spaceNoWidth,
			`${words.Name} ${words.has} no width, so your words would run together.`
		);
	}

	const coords = paths.flatMap(pathCoordinates);
	if (coords.some((value) => !Number.isFinite(value))) {
		add(PROBLEM.point, `${words.Name} ${words.has} a point the font file can't hold.`);
	} else if (coords.some((value) => !fitsInFile(Math.round(value))) || hasLongStep(paths)) {
		add(PROBLEM.point, `${words.Name} ${words.has} a point too far out for the font file to hold.`);
	}

	const short = paths.filter(isStrayShape);
	if (short.length === 1) {
		const count = short[0].pathPoints.length;
		add(
			PROBLEM.shape,
			`${words.Name} ${words.has} a shape with only ${count} ${
				count === 1 ? 'point' : 'points'
			}. A shape needs at least ${MIN_SHAPE_POINTS}.`
		);
	} else if (short.length > 1) {
		add(
			PROBLEM.shape,
			`${words.Name} ${words.has} ${short.length} shapes with fewer than ${MIN_SHAPE_POINTS} points. A shape needs at least ${MIN_SHAPE_POINTS}.`
		);
	}

	return problems;
}

/**
 * Rule 5 for one shape: true for a shape the font file can't hold, with 1 or 2 points and no
 * curve (it holds no ink). An empty shape is never written, so it isn't stray. Only a path
 * counts; a letter made from another letter is checked through that letter's paths.
 * Shared with the preview's [Fix it] (fix_it.js), so the two never disagree.
 * @param {Object} shape - Path or ComponentInstance
 * @returns {Boolean}
 */
export function isStrayShape(shape) {
	if (shape?.objType !== 'Path' || !Array.isArray(shape.pathPoints)) return false;
	const count = shape.pathPoints.length;
	return count > 0 && count < MIN_SHAPE_POINTS && !hasCurve(shape);
}

/**
 * The letter's name and the verbs that agree with it.
 * @param {Object} item
 * @returns {{Name: String, has: String, is: String, it: String}}
 */
function wordsFor(item) {
	const chars = typeof item.chars === 'string' ? item.chars : '';
	const plural = [...chars].length > 1;
	const phrase = letterPhrase(chars);
	return {
		Name: phrase ? sentenceStart(phrase) : 'A letter',
		has: plural ? 'have' : 'has',
		is: plural ? 'are' : 'is',
		it: plural ? 'them' : 'it',
	};
}

/**
 * The letter's paths as the font file holds them: its own, plus the flattened paths of
 * every letter it is made from. Reads each component instance's cached transformed
 * copy, so a check doesn't rebuild (or re-parent) anything the canvas already built.
 * @param {Object} item
 * @returns {Array<Object>} Path objects
 */
function flatPaths(item) {
	const result = [];
	(item.shapes || []).forEach((shape) => {
		if (shape?.objType === 'Path') {
			result.push(shape);
		} else if (shape?.objType === 'ComponentInstance' && shape.link !== item.id) {
			const transformed = shape.transformedGlyph;
			(transformed?.shapes || []).forEach((part) => {
				if (part?.objType === 'Path') result.push(part);
			});
		}
	});
	return result.filter((path) => Array.isArray(path.pathPoints));
}

/**
 * True when some side of the path is a curve (sideCurves).
 * @param {Object} path
 * @returns {Boolean}
 */
function hasCurve(path) {
	const points = path.pathPoints;
	return points.some((point, index) => sideCurves(point, points[(index + 1) % points.length]));
}

/**
 * The exporter's own test (font_export.js pathToContour): the side from point to next is a
 * straight line when, after rounding, its two handles sit on their points.
 * @param {Object} point - PathPoint
 * @param {Object} next - the PathPoint the side ends on
 * @returns {Boolean}
 */
function sideCurves(point, next) {
	const same = (a, b) => Math.round(a) === Math.round(b);
	return !(
		same(point.h2.x, point.p.x) &&
		same(point.h2.y, point.p.y) &&
		same(next.h1.x, next.p.x) &&
		same(next.h1.y, next.p.y)
	);
}

/**
 * @param {Number} value - a whole number
 * @returns {Boolean} true when the font file holds it (a point, or a step between two)
 */
function fitsInFile(value) {
	return value >= MIN_COORD && value <= MAX_COORD;
}

/**
 * Every point the font file stores for one path, in the exporter's order and rounding
 * (font_export.js pathToContour): the first point, then per side its two curve handles
 * (only when it curves) and its end point; the last side ends on the first point.
 * @param {Object} path - a Path with at least one point
 * @returns {Array<Array<Number>>} [x, y] pairs
 */
function storedPoints(path) {
	const points = path.pathPoints;
	const at = (coord) => [Math.round(coord.x), Math.round(coord.y)];
	const stored = [at(points[0].p)];
	points.forEach((point, index) => {
		const next = points[(index + 1) % points.length];
		if (sideCurves(point, next)) stored.push(at(point.h2), at(next.h1));
		stored.push(at(next.p));
	});
	return stored;
}

/**
 * True when a step between two stored points is too long for the font file. Both file kinds
 * end each shape on its first point (its last side closes there) and move on to the next
 * shape from that point, so the step into a shape is measured from the first point of the
 * shape before it (checked by round trips through .otf and .ttf in point_steps.test.js).
 * @param {Array<Object>} paths - the letter's paths, flattened, in the exporter's order
 * @returns {Boolean}
 */
function hasLongStep(paths) {
	const tooLong = (from, to) => !fitsInFile(to[0] - from[0]) || !fitsInFile(to[1] - from[1]);
	let ended = null;
	return paths.some((path) => {
		if (path.pathPoints.length === 0) return false;
		const stored = storedPoints(path);
		if (ended && tooLong(ended, stored[0])) return true;
		if (stored.some((point, index) => index > 0 && tooLong(stored[index - 1], point))) {
			return true;
		}
		ended = stored[stored.length - 1];
		return false;
	});
}

/**
 * Every number the exporter writes for one path: each point and both of its handles.
 * @param {Object} path
 * @returns {Array<Number>}
 */
function pathCoordinates(path) {
	return path.pathPoints.flatMap((point) => [
		point.p.x,
		point.p.y,
		point.h1.x,
		point.h1.y,
		point.h2.x,
		point.h2.y,
	]);
}
