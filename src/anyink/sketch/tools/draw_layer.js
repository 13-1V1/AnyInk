// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 (docs/SKETCH.md section 2 "What it draws" and section 6 "Hints while drawing"): the sketch
	drawn over the letter. edit_canvas.js redrawGlyphEdit makes one call, drawSketchLayer; nothing
	is drawn while the 'sketch' flag is off, so both modes look exactly as before. While a sketch
	tool is picked it draws everything below; while any other tool is picked (Select, the Brush,
	Pan, the letter opened again) a letter's stored pieces still show, read-only: their purple
	centerlines and labels, no dots, hints or readout (S2 fix track: until S3 builds ink the
	sketch is all he has made, and it must not seem to vanish).

	What it paints, every color a theme token (green = what you are touching, purple = structure):
	  - the "ink lines" (each writing line moved half the thickness to its ink side, edge_rule.js
	    inkLines) faintly, while a Centerline piece is open
	  - every piece's built centerline (curves.js pieceSkeleton), structure purple, 1.5 px; a
	    helper piece dashed; a picked or pointed-at piece green
	  - the open piece the tool is drawing, purple, and the live part under the pointer, green
	  - points as 7 px dots: filled = stuck (on a line, joined to another piece, on a piece, a
	    mirror twin), hollow = free to move; picked or pointed-at points green; a level or plumb
	    lock a small purple tick through the point; the first point's green ring when a click
	    there would close the loop
	  - hints: dotted purple lines (level / plumb with another point; a half-way line, a letter
	    edge or the ink's middle across the canvas), a faint solid purple tangent line
	  - the snap: a green ring where the point will land, and its tag at the cursor ("writing
	    line"), purple
	  - the readout beside the cursor, small and gray, never typed: a Line's "0.62 in, 90°"
	    (the tool's own), a Circle's "0.40 in across" (an oval's "0.50 x 0.75 in"), an Arc's (and
	    Line's pull-back arc's) "R 0.40 in", a Rectangle's "0.50 x 0.75 in" (sizeReadout, read
	    from the part being drawn when the tool gives no readout of its own; S2 finalize: beside
	    the tool's own words when they carry no number, "R 0.40 in, click to set how far it
	    bends")
	  - canvas labels on pieces that make no ink ("helper line", "gap: not filled yet")

	The picture is built first (sketchPicture: no canvas), then painted (paintPicture), so tests
	read the picture and the paint calls apart.

	The tool says what it is doing through its handler's drawState(item), or else its view()
	(tool_route.js; the tools' own view, tools/line.js), every field optional; font units, y up;
	a point is { x, y }, [x, y] or a point id of the working sketch:
	  sketch       the working sketch (stored pieces plus whatever the tool has added) drawn in
	               place of the stored one
	  open         { piece, sketch? } or { cubics }: the piece being drawn (draft: the same)
	  use          'center' | 'outline' | 'helper': the open piece's use when it has no piece yet
	  preview      cubics, or { cubics }, or { piece, sketch? }: the live part under the pointer
	  hot          { points: [ids], pieces: [ids or keys] }: what the pointer is on (green)
	  points       extra dots: [{ x, y, stuck?, hot? }] or ids
	  ring         { x, y }: the first point's green ring (overFirst: true rings points[0], or
	               the open piece's first point)
	  hints        snap.js's and chain.js's hints by `type` (or `kind`): 'level' / 'plumb'
	               { from, to } dotted; 'halfway' { y } dotted across; 'edge' / 'middle' { x }
	               dotted up and down; 'inkLine' { y } a faint ink line; 'tangent' { from, to }
	               or { from, dir } faint and solid; 'line' (a writing line it sits on, already
	               drawn) adds nothing. snap.hints are read too.
	  tangent      { x, y, dir }: the chain's tangent, the same as a 'tangent' hint
	  snap         { x, y, tag } (tag: words, or { key, vars }; or tagKey / tagVars): where the
	               point lands and the words at the cursor
	  readout      { x, y, text }, { x, y, key, vars } or { x, y, length, angle } (font units,
	               degrees, in inches as if the capitals were 1 in tall); with no x / y it sits
	               at the pointer (pointer: { x, y })
	  tool         the picked tool's name (drawSketchLayer adds it), for sizeReadout
	  inkLines     true / false: force the ink lines on or off (default: on while a Centerline
	               piece is open, or when the hints carry them)
	  thickness    the thickness the ink lines use (default the sketch's, then the font's)
	S4, Select on a sketch (select_tool.js drawState; tool_route.js sketchSelectApplies):
	  box          { x0, y0, x1, y1, crossing }: the window being dragged (crossing: dashed)
	  handles      [{ x, y }]: the picked group's box corners, small purple squares
	  grips        grips.js gripsFor: the picked point's handles, circle / diamond / arrow, green
	  inkPreview   { cover, ink }: outlines (font units) while a drag is under way: the ink as it
	               is, painted with the paper, then the ink as the drag makes it

	  sketchLayerShows(editor, { isOn })            true while a sketch tool draws the full layer
	  storedSketchShows(editor, item, { isOn })     true while another tool shows the stored
	                                                pieces read-only
	  sketchPicture(item, project, state)           the picture: { inkLines, pieces, open, preview,
	                                                points, ring, hints, snap, readout }
	  paintPicture(ctx, view, picture, { width, height })   paints it; returns how many marks
	  drawSketchLayer(ctx, view, item, editor, { isOn, state, pointer, tool })   both, for
	                                                redrawGlyphEdit (pointer: canvas pixels, where
	                                                the readout sits; tool: the tool to draw for,
	                                                default the picked one, the tool under a
	                                                Space-pan); the picture, or null when nothing
	                                                was drawn
	  readoutText({ length, angle }, font)          "0.62 in, 90°"
	  sizeReadout(tool, state, font)                "0.40 in across", "R 0.40 in",
	                                                "0.50 x 0.75 in", or ''
	  isStuck(sketch, id)                           a filled dot
	  STYLE                                         sizes in screen pixels
*/
import { isFeatureOn } from '../../mode/features.js';
import { guideLines } from '../../placement/classes.js';
import { token, withAlpha } from '../../theme/theme.js';
import { hasWord, word } from '../../words/words.js';
import { pieceSkeleton } from '../curves.js';
import { inkLines } from '../edge_rule.js';
import { drawPreview } from '../../nib/preview.js';
import { isJoined, piecePointIds, sketchOf, sketchThickness } from '../model.js';
import { sketchSelectApplies, sketchSelectHandler, sketchToolHandler } from './tool_route.js';
import { isSketchTool } from './tool_names.js';

/** Screen pixels */
export const STYLE = Object.freeze({
	line: 1.5,
	dot: 7,
	ring: 7,
	snap: 5,
	tick: 6,
	tangent: 60,
	hint: 1,
	inkLine: 1,
	dash: Object.freeze([6, 4]),
	dots: Object.freeze([2, 3]),
	readout: Object.freeze({ x: 14, y: 22 }),
	handle: 7,
	grip: 9,
	tag: Object.freeze({ x: 14, y: -10 }),
	font: '11px "Segoe UI", Tahoma, Verdana, sans-serif',
});

/** The writing lines the ink lines follow, top to bottom */
const INK_LINE_NAMES = Object.freeze(['top', 'capitals', 'small', 'writing', 'tail']);

// --------------------------------------------------------------
// When it draws
// --------------------------------------------------------------

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} [options]
 * @param {(name: String) => Boolean} [options.isOn]
 * @returns {Boolean}
 */
export function sketchLayerShows(editor, { isOn = isFeatureOn, tool = editor?.selectedTool } = {}) {
	return isOn('sketch') && isSketchTool(tool);
}

/** The pages with a letter's canvas (never Kerning's) */
const LETTER_PAGES = Object.freeze(['Characters', 'Ligatures', 'Components']);

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} item - the letter on the canvas
 * @param {Object} [options]
 * @param {(name: String) => Boolean} [options.isOn]
 * @param {String} [options.tool] - the tool to draw for (default the picked one)
 * @returns {Boolean} another tool is picked and the letter has stored pieces to show read-only
 */
export function storedSketchShows(
	editor,
	item,
	{ isOn = isFeatureOn, tool = editor?.selectedTool } = {}
) {
	if (!isOn('sketch') || isSketchTool(tool)) return false;
	const page = editor?.nav?.page;
	if (page !== undefined && !LETTER_PAGES.includes(page)) return false;
	const stored = sketchOf(item);
	// S3 finalize: a set-aside sketch is no longer the letter's: never drawn as if it were
	if (stored?.setAside === true) return false;
	const pieces = stored?.pieces;
	return Array.isArray(pieces) && pieces.some((piece) => piece && !piece.hidden);
}

// --------------------------------------------------------------
// The picture
// --------------------------------------------------------------

/**
 * @param {Object | Array | String} p - { x, y }, [x, y], or a point id
 * @param {Object} [points] - id -> point, for an id
 * @returns {[Number, Number] | null}
 */
function xy(p, points) {
	if (typeof p === 'string') return xy(points?.[p]);
	if (Array.isArray(p)) return Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : null;
	if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return [p.x, p.y];
	return null;
}

/**
 * @param {Object} piece
 * @param {Object} sketch
 * @returns {Array} cubics, [] when the piece can't be built
 */
function cubicsOf(piece, sketch) {
	try {
		const cubics = pieceSkeleton(piece, sketch);
		return Array.isArray(cubics) ? cubics : [];
	} catch {
		return [];
	}
}

/**
 * @param {Object | Array | undefined} part - cubics, { cubics }, or { piece, sketch }
 * @param {Object} sketch - fallback points
 * @returns {Array} cubics
 */
function partCubics(part, sketch) {
	if (!part) return [];
	if (Array.isArray(part)) return part;
	if (Array.isArray(part.cubics)) return part.cubics;
	if (part.piece) return cubicsOf(part.piece, part.sketch || sketch);
	return [];
}

/**
 * @param {Object} sketch
 * @param {String} id - a point id
 * @returns {Boolean} a filled dot: on a line, joined to another piece, on a piece, a mirror twin
 */
export function isStuck(sketch, id) {
	const point = sketch?.points?.[id];
	if (!point) return false;
	if (point.on || point.mirrorOf) return true;
	return isJoined(sketch, id);
}

/**
 * @param {Array} cubics
 * @returns {[Number, Number] | null} the middle of the run (half-way along its cubics)
 */
function middleOf(cubics) {
	if (!cubics.length) return null;
	const cubic = cubics[Math.floor((cubics.length - 1) / 2)];
	const t = cubics.length % 2 ? 0.5 : 1;
	const [p0, p1, p2, p3] = cubic;
	const u = 1 - t;
	return [
		u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
		u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
	];
}

/**
 * @param {String} key
 * @param {Object} [vars]
 * @returns {String} the words, '' for a key words.js doesn't know
 */
function wordsOf(key, vars) {
	return key && hasWord(key) ? word(key, vars || {}) : '';
}

/**
 * @param {Object} snap - the snap the tool reports
 * @returns {String} the tag's words, '' for none
 */
function snapText(snap) {
	if (!snap) return '';
	if (typeof snap.text === 'string') return snap.text;
	if (typeof snap.tag === 'string') return snap.tag;
	if (snap.tag?.key) return wordsOf(snap.tag.key, snap.tag.vars);
	return wordsOf(snap.tagKey, snap.tagVars);
}

/**
 * @param {{length: Number, angle: Number}} readout - font units, degrees
 * @param {Object} font - project.settings.font
 * @returns {String} "0.62 in, 90°", the length as if the capitals were 1 in tall
 */
export function readoutText({ length, angle }, font) {
	const capitals = guideLines(font).capitals;
	const inches = capitals > 0 ? Number(length) / capitals : 0;
	const degrees = ((Math.round(Number(angle) || 0) % 360) + 360) % 360;
	return word('sketch.readout.line', {
		length: (Number.isFinite(inches) ? inches : 0).toFixed(2),
		angle: String(degrees),
	});
}

/**
 * @param {Number} units - font units
 * @param {Object} font
 * @returns {String} inches on 1 in capitals, two places ("0.40")
 */
function inchText(units, font) {
	const capitals = guideLines(font).capitals;
	const inches = capitals > 0 ? Number(units) / capitals : 0;
	return (Number.isFinite(inches) ? inches : 0).toFixed(2);
}

/**
 * @param {Array} cubics
 * @returns {{width: Number, height: Number} | null} the ends' box (a circle's and a rectangle's
 *   parts end on their extremes)
 */
function endsBox(cubics) {
	const ends = cubics.flatMap((cubic) => [xy(cubic?.[0]), xy(cubic?.[3])]).filter(Boolean);
	if (!ends.length) return null;
	const xs = ends.map((p) => p[0]);
	const ys = ends.map((p) => p[1]);
	return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/**
 * @param {Array} cubics - one arc's cubics
 * @returns {Number | null} the radius of the circle through its two ends and its middle, null
 *   for a straight part
 */
function arcRadius(cubics) {
	if (!cubics.length) return null;
	const a = xy(cubics[0]?.[0]);
	const b = middleOf(cubics);
	const c = xy(cubics[cubics.length - 1]?.[3]);
	if (!a || !b || !c) return null;
	const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
	const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
	const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
	// straight, or nearly: the middle less than 0.5% of the chord off it
	if (!(ca > 0) || Math.abs(cross) / ca < ca * 0.005) return null;
	return (ab * bc * ca) / (2 * Math.abs(cross));
}

/**
 * The size of the part being drawn, for the tools that give no readout of their own.
 * @param {String} tool - the picked tool
 * @param {Object} state - the tool's drawState
 * @param {Object} font
 * @returns {String} the words, '' for none
 */
export function sizeReadout(tool, state, font) {
	if (tool === 'sketchCircle' || tool === 'sketchRectangle') {
		const cubics = partCubics(state?.open || state?.draft, null);
		const box = cubics.length ? endsBox(cubics) : null;
		if (!box || !(box.width > 0) || !(box.height > 0)) return '';
		const width = inchText(box.width, font);
		const height = inchText(box.height, font);
		if (tool === 'sketchCircle' && width === height) {
			return word('sketch.readout.across', { size: width });
		}
		return word('sketch.readout.size', { width, height });
	}
	if (tool === 'sketchArc' || tool === 'sketchLine') {
		const radius = arcRadius(partCubics(state?.preview, null));
		return radius ? word('sketch.readout.radius', { radius: inchText(radius, font) }) : '';
	}
	return '';
}

/**
 * @param {Object} readout
 * @param {Object} font
 * @returns {String}
 */
function readoutWords(readout, font) {
	if (!readout) return '';
	if (typeof readout.text === 'string') return readout.text;
	if (readout.key) return wordsOf(readout.key, readout.vars);
	if (Number.isFinite(readout.length)) return readoutText(readout, font);
	return '';
}

/**
 * The tools' hints (snap.js, chain.js) as the picture draws them.
 * @param {Array} raw
 * @param {Object} points - id -> point
 * @returns {{hints: Array, inkLines: Array}}
 */
function readHints(raw, points) {
	const hints = [];
	const lines = [];
	raw.forEach((hint) => {
		const kind = hint?.type || hint?.kind || 'level';
		if (kind === 'line') return;
		if (kind === 'inkLine') {
			if (Number.isFinite(hint.y)) lines.push({ name: hint.on || '', y: hint.y });
			return;
		}
		const from = xy(hint?.from, points);
		const to = xy(hint?.to, points);
		if (from && to) hints.push({ kind, from, to });
		else if (kind === 'tangent' && from && Number.isFinite(hint.dir)) {
			hints.push({ kind, from, dir: hint.dir });
		} else if (Number.isFinite(hint?.y) && !Number.isFinite(hint?.x)) hints.push({ kind, y: hint.y });
		else if (Number.isFinite(hint?.x) && !Number.isFinite(hint?.y)) hints.push({ kind, x: hint.x });
	});
	return { hints, inkLines: lines };
}

/**
 * @param {Object} item - the letter
 * @param {Object} project - GlyphrStudioProject
 * @param {Object} [state] - the tool's drawState() or view()
 * @returns {Object} the picture (see the header)
 */
export function sketchPicture(item, project, state = {}) {
	const font = project?.settings?.font || {};
	const openState = state.open || state.draft || null;
	const stored = sketchOf(item);
	const sketch = state.sketch || (stored?.setAside === true ? null : stored) || null;
	const openSketch = openState?.sketch || sketch;
	const openPiece = openState?.piece || null;
	const hotPoints = new Set(state.hot?.points || []);
	const hotPieces = new Set(state.hot?.pieces || []);

	// Pieces (the open one is drawn as the open piece, never twice)
	const pieces = [];
	const pointIds = new Set();
	(Array.isArray(sketch?.pieces) ? sketch.pieces : []).forEach((piece) => {
		if (!piece || piece.hidden) return;
		if (openPiece && (piece === openPiece || (piece.id && piece.id === openPiece.id))) return;
		const cubics = cubicsOf(piece, sketch);
		piecePointIds(piece).forEach((id) => pointIds.add(id));
		let label = '';
		if (piece.use === 'helper') label = word('sketch.label.helper');
		else if (piece.use === 'outline' && !piece.closed) label = word('sketch.label.gap');
		pieces.push({
			id: piece.id,
			key: piece.key || null,
			cubics,
			dashed: piece.use === 'helper',
			hot: hotPieces.has(piece.id) || (piece.key ? hotPieces.has(piece.key) : false),
			label,
			labelAt: label ? middleOf(cubics) : null,
		});
	});

	const open = openState ? { cubics: partCubics(openState, openSketch) } : null;
	if (openPiece) piecePointIds(openPiece).forEach((id) => pointIds.add(id));
	const preview = state.preview ? { cubics: partCubics(state.preview, openSketch) } : null;

	// Points: the stored ones, then the open piece's own (its working sketch may hold new ones)
	const points = [];
	pointIds.forEach((id) => {
		const owner = openSketch?.points?.[id] ? openSketch : sketch;
		const point = owner?.points?.[id];
		const at = xy(point);
		if (!at) return;
		points.push({
			id,
			x: at[0],
			y: at[1],
			stuck: isStuck(owner, id),
			hot: hotPoints.has(id),
			lock: point.lock === 'level' || point.lock === 'plumb' ? point.lock : null,
		});
	});
	(Array.isArray(state.points) ? state.points : []).forEach((extra) => {
		const id = typeof extra === 'string' ? extra : null;
		if (id && pointIds.has(id)) return;
		const at = xy(extra, openSketch?.points);
		if (!at) return;
		points.push({
			id,
			x: at[0],
			y: at[1],
			stuck: id ? isStuck(openSketch, id) : !!extra.stuck,
			hot: id ? hotPoints.has(id) : !!extra.hot,
			lock: null,
		});
	});

	// Hints: the tools' own, the snap's and the chain's tangent
	const rawHints = [...(Array.isArray(state.hints) ? state.hints : [])];
	if (Array.isArray(state.snap?.hints)) rawHints.push(...state.snap.hints);
	if (state.tangent) rawHints.push({ type: 'tangent', from: state.tangent, dir: state.tangent.dir });
	const read = readHints(rawHints, openSketch?.points);

	// The ink lines: the tool's, else the edge rule's while a Centerline piece is open
	const way = openPiece?.use || state.use || sketch?.way || 'center';
	const thickness = Number(state.thickness) || Number(sketch?.thickness) || sketchThickness(project);
	let lines = [];
	if (state.inkLines !== false && read.inkLines.length) lines = read.inkLines;
	else if (state.inkLines === true || (state.inkLines !== false && openState && way !== 'outline')) {
		if (thickness > 0) {
			const at = inkLines(font, thickness);
			lines = INK_LINE_NAMES.filter((name) => Number.isFinite(at[name])).map((name) => ({
				name,
				y: at[name],
			}));
		}
	}

	const snapAt = xy(state.snap);
	// with no pointer, the readout sits at the end of the part being drawn
	const lastEnd = (part) => {
		const cubics = partCubics(part, openSketch);
		return cubics.length ? xy(cubics[cubics.length - 1]?.[3]) : null;
	};
	const readoutAt =
		xy(state.readout) || xy(state.pointer) || lastEnd(state.preview) || lastEnd(openState);
	let ringAt = xy(state.ring);
	if (!ringAt && state.overFirst) {
		const listed = Array.isArray(state.points) ? state.points[0] : null;
		const firstId = openPiece ? piecePointIds(openPiece)[0] : null;
		ringAt = xy(listed, openSketch?.points) || xy(firstId, openSketch?.points);
	}
	const size = sizeReadout(state.tool, state, font);
	let readoutWordsNow = state.readout ? readoutWords(state.readout, font) : size;
	// S2 finalize: words from the tool that carry no number (the Arc's "click to set how far it
	// bends") keep the size beside them
	if (state.readout?.key && size && readoutWordsNow) readoutWordsNow = `${size}, ${readoutWordsNow}`;
	return {
		box: state.box || null,
		handles: Array.isArray(state.handles) ? state.handles : null,
		grips: state.grips || null,
		ink: state.inkPreview || null,
		inkLines: lines,
		pieces,
		open,
		preview,
		points,
		ring: ringAt ? { x: ringAt[0], y: ringAt[1] } : null,
		hints: read.hints,
		snap: snapAt ? { x: snapAt[0], y: snapAt[1], text: snapText(state.snap) } : null,
		readout:
			readoutAt && readoutWordsNow ? { x: readoutAt[0], y: readoutAt[1], text: readoutWordsNow } : null,
	};
}

// --------------------------------------------------------------
// Painting
// --------------------------------------------------------------

/** The theme's colors, read once per paint */
function colors() {
	const structure = token('--canvas-guide');
	const touch = token('--canvas-point-selected');
	return {
		structure,
		structureFaint: withAlpha(structure, 0.35),
		structureSoft: withAlpha(structure, 0.6),
		touch,
		hollow: token('--canvas-point-fill'),
		label: token('--canvas-guide-label'),
		halo: token('--canvas-label-halo'),
		gray: withAlpha(token('--canvas-ink-outline'), 0.75),
	};
}

/**
 * @param {Object} view - { dx, dy, dz }
 * @returns {(p: [Number, Number]) => [Number, Number]} font units to canvas pixels
 */
function toCanvas(view) {
	return ([x, y]) => [view.dx + x * view.dz, view.dy - y * view.dz];
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} cubics
 * @param {Function} at - font units to canvas
 * @returns {Boolean} a path was traced
 */
function traceCubics(ctx, cubics, at) {
	let traced = false;
	let last = null;
	cubics.forEach((cubic) => {
		if (!Array.isArray(cubic) || cubic.length < 4) return;
		const [p0, p1, p2, p3] = cubic.map(at);
		if (!last || last[0] !== p0[0] || last[1] !== p0[1]) ctx.moveTo(p0[0], p0[1]);
		ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
		last = p3;
		traced = true;
	});
	return traced;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {String} text
 * @param {Number} x
 * @param {Number} y
 * @param {String} color
 * @param {String} halo
 */
function label(ctx, text, x, y, color, halo) {
	ctx.font = STYLE.font;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = halo;
	ctx.strokeText(text, x, y);
	ctx.fillStyle = color;
	ctx.fillText(text, x, y);
}

/**
 * A hint's two ends on the canvas, or null.
 * @param {Object} hint
 * @param {Object} view
 * @param {Function} at
 * @param {Number} width
 * @param {Number} height
 * @returns {Array<Number> | null} [x0, y0, x1, y1]
 */
function hintEnds(hint, view, at, width, height) {
	if (hint.from && hint.to) return [...at(hint.from), ...at(hint.to)];
	if (hint.from && Number.isFinite(hint.dir)) {
		const [x0, y0] = at(hint.from);
		const radians = (hint.dir * Math.PI) / 180;
		return [x0, y0, x0 + Math.cos(radians) * STYLE.tangent, y0 - Math.sin(radians) * STYLE.tangent];
	}
	if (Number.isFinite(hint.y)) {
		const y = view.dy - hint.y * view.dz;
		return [0, y, width, y];
	}
	if (Number.isFinite(hint.x)) {
		const x = view.dx + hint.x * view.dz;
		return [x, 0, x, height];
	}
	return null;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} view - { dx, dy, dz }
 * @param {Object} picture - sketchPicture's answer
 * @param {Object} [options]
 * @param {Number} [options.width] - canvas width (default ctx.canvas.width)
 * @param {Number} [options.height] - canvas height (default ctx.canvas.height)
 * @returns {Number} how many marks were painted
 */
export function paintPicture(
	ctx,
	view,
	picture,
	{ width = ctx?.canvas?.width || 0, height = ctx?.canvas?.height || 0 } = {}
) {
	if (!ctx || !(Number(view?.dz) > 0) || !picture) return 0;
	const at = toCanvas(view);
	const c = colors();
	let marks = 0;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// S4: the ink while a drag is under way (the old ink covered with the paper first)
	if (picture.ink) {
		drawPreview(ctx, picture.ink.cover || [], view, token('--canvas-bg'));
		drawPreview(ctx, picture.ink.ink || [], view, token('--canvas-ink'));
		marks += 1;
	}

	// Ink lines: faint, dashed, the full width
	picture.inkLines.forEach((line) => {
		const y = view.dy - line.y * view.dz;
		ctx.beginPath();
		ctx.setLineDash([...STYLE.dash]);
		ctx.lineWidth = STYLE.inkLine;
		ctx.strokeStyle = c.structureFaint;
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
		marks += 1;
	});
	ctx.setLineDash([]);

	// Hints: dotted purple; the tangent faint and solid
	picture.hints.forEach((hint) => {
		const ends = hintEnds(hint, view, at, width, height);
		if (!ends) return;
		ctx.beginPath();
		ctx.setLineDash(hint.kind === 'tangent' ? [] : [...STYLE.dots]);
		ctx.lineWidth = STYLE.hint;
		ctx.strokeStyle = hint.kind === 'tangent' ? c.structureFaint : c.structureSoft;
		ctx.moveTo(ends[0], ends[1]);
		ctx.lineTo(ends[2], ends[3]);
		ctx.stroke();
		marks += 1;
	});
	ctx.setLineDash([]);

	// Pieces
	picture.pieces.forEach((piece) => {
		ctx.beginPath();
		if (!traceCubics(ctx, piece.cubics, at)) return;
		ctx.setLineDash(piece.dashed ? [...STYLE.dash] : []);
		ctx.lineWidth = STYLE.line;
		ctx.strokeStyle = piece.hot ? c.touch : c.structure;
		ctx.stroke();
		marks += 1;
	});
	ctx.setLineDash([]);

	// The open piece, then the live part under the pointer
	[
		[picture.open, c.structure],
		[picture.preview, c.touch],
	].forEach(([part, color]) => {
		if (!part) return;
		ctx.beginPath();
		if (!traceCubics(ctx, part.cubics, at)) return;
		ctx.lineWidth = STYLE.line;
		ctx.strokeStyle = color;
		ctx.stroke();
		marks += 1;
	});

	// Points: filled = stuck, hollow = free, green = touched; lock ticks
	const r = STYLE.dot / 2;
	picture.points.forEach((point) => {
		const [x, y] = at([point.x, point.y]);
		const color = point.hot ? c.touch : c.structure;
		if (point.lock) {
			const half = STYLE.tick + r;
			ctx.beginPath();
			ctx.lineWidth = 1;
			ctx.strokeStyle = c.structure;
			if (point.lock === 'level') {
				ctx.moveTo(x - half, y);
				ctx.lineTo(x + half, y);
			} else {
				ctx.moveTo(x, y - half);
				ctx.lineTo(x, y + half);
			}
			ctx.stroke();
			marks += 1;
		}
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fillStyle = point.stuck ? color : c.hollow;
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = color;
		ctx.stroke();
		marks += 1;
	});

	// The first point's ring: a click here closes the loop
	if (picture.ring) {
		const [x, y] = at([picture.ring.x, picture.ring.y]);
		ctx.beginPath();
		ctx.arc(x, y, r + STYLE.ring / 2 + 1, 0, Math.PI * 2);
		ctx.lineWidth = 2;
		ctx.strokeStyle = c.touch;
		ctx.stroke();
		marks += 1;
	}

	// The snap: a green ring where the point lands, its tag at the cursor
	if (picture.snap) {
		const [x, y] = at([picture.snap.x, picture.snap.y]);
		ctx.beginPath();
		ctx.arc(x, y, STYLE.snap, 0, Math.PI * 2);
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = c.touch;
		ctx.stroke();
		marks += 1;
		if (picture.snap.text) {
			label(ctx, picture.snap.text, x + STYLE.tag.x, y + STYLE.tag.y, c.label, c.halo);
			marks += 1;
		}
	}

	// Labels on pieces that make no ink
	picture.pieces.forEach((piece) => {
		if (!piece.label || !piece.labelAt) return;
		const [x, y] = at(piece.labelAt);
		label(ctx, piece.label, x + 6, y - 6, c.label, c.halo);
		marks += 1;
	});

	// The readout beside the cursor: small and gray
	if (picture.readout?.text) {
		const [x, y] = at([picture.readout.x, picture.readout.y]);
		label(ctx, picture.readout.text, x + STYLE.readout.x, y + STYLE.readout.y, c.gray, c.halo);
		marks += 1;
	}

	marks += paintSelect(ctx, picture, at, c);
	ctx.restore();
	return marks;
}

/**
 * S4: Select's window, the group's corner handles and the picked point's grips.
 * @returns {Number} marks
 */
function paintSelect(ctx, picture, at, c) {
	let marks = 0;
	if (picture.box) {
		const [x0, y0] = at([picture.box.x0, picture.box.y0]);
		const [x1, y1] = at([picture.box.x1, picture.box.y1]);
		ctx.beginPath();
		ctx.setLineDash(picture.box.crossing ? [...STYLE.dash] : []);
		ctx.lineWidth = 1;
		ctx.fillStyle = withAlpha(c.structure, 0.08);
		ctx.strokeStyle = c.structure;
		ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
		ctx.fill();
		ctx.stroke();
		ctx.setLineDash([]);
		marks += 1;
	}
	(picture.handles || []).forEach((handle) => {
		const [x, y] = at([handle.x, handle.y]);
		const half = STYLE.handle / 2;
		ctx.beginPath();
		ctx.rect(x - half, y - half, STYLE.handle, STYLE.handle);
		ctx.fillStyle = c.structure;
		ctx.fill();
		marks += 1;
	});
	const grips = picture.grips;
	if (grips?.at) {
		const [px, py] = at([grips.at.x, grips.at.y]);
		ctx.lineWidth = 1;
		ctx.strokeStyle = c.touch;
		[grips.out, grips.back].forEach((end) => {
			if (!end) return;
			const [x, y] = at([end.x, end.y]);
			ctx.beginPath();
			ctx.moveTo(px, py);
			ctx.lineTo(x, y);
			ctx.stroke();
			marks += 1;
		});
		const r = STYLE.grip / 2;
		if (grips.out) {
			const [x, y] = at([grips.out.x, grips.out.y]);
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fillStyle = c.hollow;
			ctx.fill();
			ctx.lineWidth = 1.5;
			ctx.stroke();
			marks += 1;
		}
		if (grips.diamond) {
			const [x, y] = at([grips.diamond.x, grips.diamond.y]);
			ctx.beginPath();
			ctx.moveTo(x, y - r);
			ctx.lineTo(x + r, y);
			ctx.lineTo(x, y + r);
			ctx.lineTo(x - r, y);
			ctx.closePath();
			ctx.fillStyle = c.touch;
			ctx.fill();
			marks += 1;
		}
		if (grips.back) {
			const [x, y] = at([grips.back.x, grips.back.y]);
			const angle = Math.atan2(y - py, x - px);
			ctx.beginPath();
			ctx.moveTo(x + Math.cos(angle) * r * 1.4, y + Math.sin(angle) * r * 1.4);
			ctx.lineTo(x + Math.cos(angle + 2.4) * r, y + Math.sin(angle + 2.4) * r);
			ctx.lineTo(x + Math.cos(angle - 2.4) * r, y + Math.sin(angle - 2.4) * r);
			ctx.closePath();
			ctx.fillStyle = c.touch;
			ctx.fill();
			marks += 1;
		}
	}
	return marks;
}

/**
 * The picked tool's state: drawState(item), else view()
 * @param {Object} handler
 * @param {Object} item
 * @returns {Object | null}
 */
function toolState(handler, item) {
	try {
		if (typeof handler?.drawState === 'function') return handler.drawState(item) || null;
		if (typeof handler?.view === 'function') return handler.view() || null;
	} catch (error) {
		console.warn('sketch draw layer: the tool could not say what to draw', error);
	}
	return null;
}

/**
 * redrawGlyphEdit's one call.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} view - { dx, dy, dz }
 * @param {Object} item - the letter on the canvas
 * @param {Object} editor - ProjectEditor
 * @param {Object} [options]
 * @param {(name: String) => Boolean} [options.isOn]
 * @param {Object} [options.state] - the tool's state (default: ask the picked tool)
 * @param {{x: Number, y: Number}} [options.pointer] - canvas pixels: where the readout sits
 * @param {String} [options.tool] - the tool to draw for (default the picked one; the tool a
 *   Space-pan will give back while it pans)
 * @returns {Object | null} the picture painted, or null when the layer is off
 */
export function drawSketchLayer(
	ctx,
	view,
	item,
	editor,
	{ isOn = isFeatureOn, state, pointer, tool = editor?.selectedTool } = {}
) {
	if (!item) return null;
	// S4: Select on a sketch draws everything it picks and drags
	if (state === undefined && tool === editor?.selectedTool && sketchSelectApplies(editor, { isOn })) {
		const drawn = toolState(sketchSelectHandler(), item);
		if (drawn) {
			const picture = sketchPicture(item, editor.project, { ...drawn, tool });
			paintPicture(ctx, view, picture);
			return picture;
		}
	}
	if (storedSketchShows(editor, item, { isOn, tool })) {
		// another tool: the stored pieces, read-only (no dots, hints or readout)
		const picture = { ...sketchPicture(item, editor.project, {}), points: [] };
		paintPicture(ctx, view, picture);
		return picture;
	}
	if (!sketchLayerShows(editor, { isOn, tool })) return null;
	const drawn = state === undefined ? toolState(sketchToolHandler(tool), item) : state;
	const at =
		Number(view?.dz) > 0 && Number.isFinite(pointer?.x) && Number.isFinite(pointer?.y)
			? { x: (pointer.x - view.dx) / view.dz, y: (view.dy - pointer.y) / view.dz }
			: null;
	const picture = sketchPicture(item, editor.project, {
		...(drawn || {}),
		tool: drawn?.tool || tool,
		...(at && !drawn?.pointer ? { pointer: at } : {}),
	});
	paintPicture(ctx, view, picture);
	return picture;
}
