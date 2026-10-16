// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix (docs/SKETCH.md section 3 "Thickness"): a sketched letter's vote on the font's slant
	(spacing/slant.js letterSlant) comes from its centerline, not its swept ink. The swept ink of a
	thick leaning leg next to a plumb stem read as a slanted stem: probe run3b, an n slid to the
	thick end (264) turned the whole font to -24 degrees and n's sides to 285 / -61. The centerline
	is the line he drew, so one letter's thickness never moves the font's slant.

	The centerline is read with the points whose ink edge is pinned to a line put on the line
	itself, so a thicker setting (which moves them half the thickness inside) never shortens a
	stem below what counts as one.
	A Centerline piece's line is walked there and back (an open piece) so each stem gives two runs,
	as its ink's two edges do; a closed piece is walked twice for the same weight. Shapes that are
	not built from this sketch's Centerline pieces (Outline pieces, Brush strokes, his own shapes)
	vote with their ink, as before. A letter whose ink no longer matches its sketch (changed behind
	its back) votes with its ink: undefined hands it back to slant.js.

	  centerlineRuns(item, font, minHeight)   [{ slope, height }] or undefined (no active sketch
	                         with Centerline ink, or its ink is not the sketch's)
	Loaded by follow.js (every feature that moves shapes, and spacing's step) and thickness.js;
	it hands centerlineRuns to slant.js (setSlantVoter).
*/
import { guideLines } from '../placement/classes.js';
import { inkPaths, pathContour } from '../spacing/outline.js';
import { setSlantVoter, stemRuns } from '../spacing/slant.js';
import { pieceSkeleton } from './curves.js';
import { isSketchActive, sketchOf } from './model.js';
import { builtMatches, sketchIdOf, sketchKeyOf } from './sketch_record.js';

/** Samples per cubic of the centerline */
const STEPS = 16;

function inksCenter(piece) {
	return (
		!!piece &&
		piece.use === 'center' &&
		!piece.hidden &&
		Array.isArray(piece.parts) &&
		piece.parts.length > 0
	);
}

/** @returns {Array<[Number, Number]>} points along the cubics */
function sample(cubics) {
	const out = [];
	cubics.forEach((cubic, index) => {
		const [p0, p1, p2, p3] = cubic;
		for (let i = index === 0 ? 0 : 1; i <= STEPS; i++) {
			const t = i / STEPS;
			const u = 1 - t;
			const a = u * u * u;
			const b = 3 * u * u * t;
			const c = 3 * u * t * t;
			const d = t * t * t;
			out.push([
				a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
				a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
			]);
		}
	});
	return out;
}

/**
 * The sketch with every point whose ink edge is pinned to a line put on the line itself: the
 * line he drew, the same at every thickness (a thick setting shortens the stems between the ink
 * lines, and a short leaning leg would stop counting as a stem)
 */
function pinsOnLines(sketch, font) {
	const lines = guideLines(font);
	let points = null;
	for (const [id, point] of Object.entries(sketch.points || {})) {
		if (point?.inset !== 'edge' || !Number.isFinite(lines[point.on])) continue;
		if (point.y === lines[point.on]) continue;
		points ??= { ...sketch.points };
		points[id] = { ...point, y: lines[point.on] };
	}
	return points ? { ...sketch, points } : sketch;
}

/** The stem runs of one Centerline piece, counted twice (its ink has two edges) */
function pieceRuns(piece, sketch, minHeight) {
	const line = sample(pieceSkeleton(piece, sketch));
	if (line.length < 2) return [];
	if (piece.closed) {
		const runs = stemRuns(line, minHeight);
		return [...runs, ...runs];
	}
	return stemRuns([...line, ...line.slice(1, -1).reverse()], minHeight);
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {Number} minHeight - font units (slant.js STEM_SHARE of the small-letter height)
 * @returns {Array<{slope: Number, height: Number}> | undefined}
 */
export function centerlineRuns(item, font, minHeight) {
	const sketch = sketchOf(item);
	if (!isSketchActive(sketch) || !Array.isArray(sketch.pieces)) return undefined;
	const center = sketch.pieces.filter(inksCenter);
	if (!center.length) return undefined;
	try {
		if (!builtMatches(item)) return undefined;
		const ids = new Set(center.map((piece) => piece.id));
		const onLines = pinsOnLines(sketch, font);
		const runs = center.flatMap((piece) => pieceRuns(piece, onLines, minHeight));
		const rest = (item.shapes || []).filter(
			(shape) =>
				shape?.objType === 'Path' &&
				!(sketchKeyOf(shape) === sketch.key && ids.has(sketchIdOf(shape)))
		);
		const ink = inkPaths({ id: item.id, shapes: rest })
			.map(pathContour)
			.filter(Boolean)
			.flatMap((contour) => stemRuns(contour.points, minHeight));
		return [...runs, ...ink];
	} catch (error) {
		console.warn('ANY-INK sketch: the slant vote fell back to the ink', error);
		return undefined;
	}
}

setSlantVoter(centerlineRuns);
