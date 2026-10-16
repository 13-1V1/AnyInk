// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (docs/SKETCH.md section 8, D-047): the sketch a letter is built from, as plain data on the
	letter beside its brush strokes. Pure: no app state, no screen. The letter's anyink object is
	cloned into every Undo step, the work file and crash copies (project_data/glyph.js), so the
	sketch rides along with no plumbing of its own.

	  glyph.anyink.sketch = {
	    v          SKETCH_V, the format version (migrateSketch upgrades older ones)
	    build      BUILD_V, the build engine that made the current ink
	    key        'sk_...', the sketch's own name; its built shapes carry it (sketch_record.js)
	    way        'center' | 'outline', chosen at the door
	    thickness  font units, whole
	    ends       'round' | 'flat', the letter's default end
	    mirror     null | { x } (whole)
	    builtHash  null | 'c<count>:<8 hex>' (sketch_record.js hashBuilt) after the last sketch step
	    points     { id: { x, y, kind, on?, inset?, end?, lock?, aim?, mirrorOf? } }
	    pieces     [{ id, key, use, closed, parts, circle?, insideOf?, wall?, hidden?, was? }]
	    relations  [{ type, ... }]
	    setAside   true once the built shapes were changed behind the sketch's back
	    at         ms when it was made
	  }
	  part: { type: 'line' | 'arc' | 'curve', from, to, bulge?, tangent? } or
	        { type: 'spline', points: [ids] }. A spline of one point, alone in an open piece, is a
	        dot (the nib alone, for i and j). A closed piece whose one part is a spline is a loop
	        through its points (its first point is not repeated).

	  settings.anyink.sketchThickness   the font's thickness, font units, or null until first set
	                                    (then nib/brush_size.js brushSize is used)

	Format 0 (the draft before `v` was written, kept only so migration has a test):
	  { v: 0 or absent, way?, width, ends?, mirrorX?, points: [{ id, x, y, smooth, line? }],
	    pieces: [{ id, use?, closed?, parts }] }

	  SKETCH_V, BUILD_V, WAYS, USES, KINDS, LINES, ON_PLACES, ENDS, LOCKS, PART_TYPES,
	  RELATION_TYPES
	  newSketch({ way, thickness, ends, key, at })    an empty sketch
	  newSketchKey(), newPieceKey()
	  sketchOf(item)              the letter's sketch, or null. An older format is upgraded in place;
	                              a v1 sketch with a field missing or of the wrong kind (a hand-edited
	                              work file, a damaged crash copy) is put right once, in place, with
	                              every good field kept; a sound one is returned as stored
	  setSketch(item, sketch)     stores it on the letter (null removes it)
	  migrateSketch(raw)          a v1 sketch, or raw itself untouched when this app can't read its
	                              v, or null for something that is no sketch
	  isNewerSketch(sketch)       a v this app can't read: a newer whole number, or anything that is
	                              not 0, 1 or absent ('abc', 0.5, -1, true). Such a sketch, and the
	                              tags of its built shapes, are left exactly as they are
	  isSketchActive(sketch)      active = not set aside and not newer
	  validateSketch(sketch, { project })   { ok, problems: [String], newer }; with the project,
	                              a thickness above 0 outside thicknessRange is a problem too
	  sketchWay(sketch)           'center' | 'outline'
	  point and piece helpers     getPoint, addPoint, nextPointId, getPiece, addPiece, nextPieceId,
	                              partEnds, pieceEnds, piecePointIds, piecesAt, isJoined, isDot,
	                              isCyclicSpline
	  thicknessRange(project)     { min, max } font units: the Brush's MIN_SHARE / MAX_SHARE of the
	                              small-letter height
	  sketchThickness(project)    the font's thickness, else brushSize(project)
	  setSketchThickness(project, value)   whole, kept inside the range; null clears it
*/
import { MAX_SHARE, MIN_SHARE, brushSize } from '../nib/brush_size.js';

export const SKETCH_V = 1;
export const BUILD_V = 1;
export const WAYS = Object.freeze(['center', 'outline']);
export const USES = Object.freeze(['center', 'outline', 'helper']);
export const KINDS = Object.freeze(['corner', 'smooth']);
export const LINES = Object.freeze(['top', 'capitals', 'small', 'writing', 'tail']);
/**
 * Every place a point can be pinned (`on`): the five writing lines (only these take
 * `inset: 'edge'`), the half-way lines (writing to small-letter, writing to capitals: a Bar, a
 * Circle's center), the letter's left and right edges and its middle (only while spacing is set
 * by him), and the Mirror line. D-048.
 */
export const ON_PLACES = Object.freeze([
	...LINES,
	'halfSmall',
	'halfCapitals',
	'left',
	'right',
	'middle',
	'mirror',
]);
export const ENDS = Object.freeze(['round', 'flat']);
export const LOCKS = Object.freeze(['level', 'plumb']);
export const PART_TYPES = Object.freeze(['line', 'arc', 'curve', 'spline']);
export const RELATION_TYPES = Object.freeze(['level', 'plumb', 'onPiece']);

let keyCount = 0;

/** @returns {String} */
function randomPart() {
	return (
		globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 8) ||
		Math.random().toString(36).slice(2, 10)
	);
}

/** @returns {String} a key no other sketch has */
export function newSketchKey() {
	keyCount += 1;
	return `sk_${Date.now().toString(36)}${keyCount.toString(36)}${randomPart()}`;
}

/** @returns {String} */
export function newPieceKey() {
	keyCount += 1;
	return `pc_${keyCount.toString(36)}${randomPart()}`;
}

/**
 * @param {Object} [options]
 * @returns {Object} an empty v1 sketch
 */
export function newSketch({
	way = 'center',
	thickness = 0,
	ends = 'round',
	key = newSketchKey(),
	at = Date.now(),
} = {}) {
	return {
		v: SKETCH_V,
		build: BUILD_V,
		key,
		way: WAYS.includes(way) ? way : 'center',
		thickness: Math.max(0, wholeOr(thickness, 0)),
		ends: ENDS.includes(ends) ? ends : 'round',
		mirror: null,
		builtHash: null,
		points: {},
		pieces: [],
		relations: [],
		setAside: false,
		at,
	};
}

/**
 * @param {Object} item - Glyph (or ligature / component)
 * @returns {Object | null}
 */
export function sketchOf(item) {
	const raw = item?.anyink?.sketch;
	if (!raw || typeof raw !== 'object') return null;
	if (isNewerSketch(raw)) return raw;
	if (readV(raw) === SKETCH_V) {
		if (isSound(raw)) return raw;
		const mended = withDefaults(raw);
		item.anyink.sketch = mended;
		return mended;
	}
	const upgraded = migrateSketch(raw);
	if (upgraded) item.anyink.sketch = upgraded;
	return upgraded;
}

/**
 * @param {Object} item - Glyph
 * @param {Object | null} sketch
 */
export function setSketch(item, sketch) {
	if (!item) return;
	if (!item.anyink || typeof item.anyink !== 'object') item.anyink = {};
	if (sketch) item.anyink.sketch = sketch;
	else delete item.anyink.sketch;
}

/** @returns {Boolean} a sketch whose v this app can't read (see the header) */
export function isNewerSketch(sketch) {
	if (!sketch || typeof sketch !== 'object') return false;
	const v = readV(sketch);
	return v !== 0 && v !== SKETCH_V;
}

/** @returns {Number} the sketch's v as a number: 0 when absent, NaN when it is no number */
function readV(sketch) {
	const v = sketch?.v;
	if (v === undefined || v === null) return 0;
	if (typeof v === 'number') return v;
	if (typeof v === 'string' && v.trim() !== '') return Number(v);
	return NaN;
}

/** @returns {Boolean} a v1 sketch with every field there and of the right kind (what
 * withDefaults makes), so sketchOf can hand it back as stored */
function isSound(sketch) {
	const mirror = sketch.mirror;
	return (
		typeof sketch.key === 'string' &&
		sketch.key !== '' &&
		WAYS.includes(sketch.way) &&
		ENDS.includes(sketch.ends) &&
		isWhole(sketch.thickness) &&
		sketch.thickness >= 0 &&
		(mirror === null || (isPlainObject(mirror) && isWhole(mirror.x))) &&
		isPlainObject(sketch.points) &&
		Array.isArray(sketch.pieces) &&
		Array.isArray(sketch.relations) &&
		Number.isFinite(sketch.build) &&
		typeof sketch.setAside === 'boolean' &&
		(sketch.builtHash === null || typeof sketch.builtHash === 'string') &&
		Number.isFinite(sketch.at)
	);
}

/** @returns {Boolean} a sketch that may be built from: not set aside, not from a newer app */
export function isSketchActive(sketch) {
	return !!sketch && sketch.setAside !== true && !isNewerSketch(sketch);
}

/** @returns {'center' | 'outline'} */
export function sketchWay(sketch) {
	return sketch?.way === 'outline' ? 'outline' : 'center';
}

// --------------------------------------------------------------
// Migration
// --------------------------------------------------------------

/**
 * @param {Object} raw - a stored sketch of any version
 * @returns {Object | null}
 */
export function migrateSketch(raw) {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	if (isNewerSketch(raw)) return raw;
	const v = readV(raw);
	if (v === SKETCH_V) return withDefaults(raw);
	if (v === 0) return fromV0(raw);
	return null;
}

/** A v1 sketch with every field there (a copy) */
function withDefaults(raw) {
	const sketch = clone(raw);
	const base = newSketch({
		way: sketch.way,
		thickness: sketch.thickness,
		ends: sketch.ends,
		key: typeof sketch.key === 'string' && sketch.key ? sketch.key : newSketchKey(),
		at: Number.isFinite(sketch.at) ? sketch.at : Date.now(),
	});
	return {
		...base,
		...sketch,
		way: base.way,
		ends: base.ends,
		key: base.key,
		thickness: base.thickness,
		mirror: isPlainObject(sketch.mirror) && Number.isFinite(Number(sketch.mirror.x))
			? { ...sketch.mirror, x: Math.round(Number(sketch.mirror.x)) }
			: null,
		at: base.at,
		points: isPlainObject(sketch.points) ? sketch.points : {},
		pieces: Array.isArray(sketch.pieces) ? sketch.pieces : [],
		relations: Array.isArray(sketch.relations) ? sketch.relations : [],
		build: Number.isFinite(sketch.build) ? sketch.build : BUILD_V,
		setAside: sketch.setAside === true,
		builtHash: typeof sketch.builtHash === 'string' ? sketch.builtHash : null,
	};
}

/** Format 0 (see the header) to v1 */
function fromV0(raw) {
	const sketch = newSketch({
		way: raw.way,
		thickness: raw.width ?? raw.thickness,
		ends: raw.ends,
		key: typeof raw.key === 'string' && raw.key ? raw.key : newSketchKey(),
		at: Number.isFinite(raw.at) ? raw.at : Date.now(),
	});
	if (Number.isFinite(Number(raw.mirrorX))) sketch.mirror = { x: Math.round(Number(raw.mirrorX)) };
	const points = Array.isArray(raw.points)
		? raw.points
		: Object.entries(raw.points || {}).map(([id, point]) => ({ id, ...point }));
	points.forEach((point) => {
		if (!point || point.id === undefined) return;
		const id = String(point.id);
		const next = {
			x: wholeOr(point.x, 0),
			y: wholeOr(point.y, 0),
			kind: point.smooth === true || point.kind === 'smooth' ? 'smooth' : 'corner',
		};
		const line = point.line ?? point.on;
		if (LINES.includes(line)) {
			next.on = line;
			if (sketch.way === 'center') next.inset = 'edge';
		}
		sketch.points[id] = next;
	});
	(Array.isArray(raw.pieces) ? raw.pieces : []).forEach((piece) => {
		if (!piece) return;
		const use = USES.includes(piece.use) ? piece.use : sketch.way;
		sketch.pieces.push({
			id: Number.isInteger(piece.id) ? piece.id : nextPieceId(sketch),
			key: typeof piece.key === 'string' && piece.key ? piece.key : newPieceKey(),
			use,
			closed: piece.closed === true,
			parts: (Array.isArray(piece.parts) ? piece.parts : []).map((part) => {
				const copy = clone(part);
				if (Array.isArray(copy.points)) copy.points = copy.points.map(String);
				if (copy.from !== undefined) copy.from = String(copy.from);
				if (copy.to !== undefined) copy.to = String(copy.to);
				return copy;
			}),
		});
	});
	return sketch;
}

// --------------------------------------------------------------
// Points and pieces
// --------------------------------------------------------------

/** @returns {Object | null} */
export function getPoint(sketch, id) {
	return isPlainObject(sketch?.points) && Object.hasOwn(sketch.points, id) ? sketch.points[id] : null;
}

/** @returns {Array<Object>} the piece's parts; [] when they are no list */
function partsOf(piece) {
	return Array.isArray(piece?.parts) ? piece.parts : [];
}

/** @returns {Array<Object>} the sketch's pieces; [] when they are no list */
function piecesOf(sketch) {
	return Array.isArray(sketch?.pieces) ? sketch.pieces : [];
}

/** @returns {String} 'p<n>', one more than the highest p-number in use */
export function nextPointId(sketch) {
	let highest = 0;
	Object.keys(isPlainObject(sketch?.points) ? sketch.points : {}).forEach((id) => {
		const match = /^p(\d+)$/.exec(id);
		if (match) highest = Math.max(highest, Number(match[1]));
	});
	return `p${highest + 1}`;
}

/**
 * @param {Object} sketch
 * @param {Object} point - { x, y, kind?, ...the optional fields }; x and y are made whole
 * @param {String} [id]
 * @returns {String} the point's id
 */
export function addPoint(sketch, point, id = nextPointId(sketch)) {
	sketch.points[id] = {
		...point,
		x: wholeOr(point.x, 0),
		y: wholeOr(point.y, 0),
		kind: KINDS.includes(point.kind) ? point.kind : 'corner',
	};
	return id;
}

/** @returns {Object | null} */
export function getPiece(sketch, id) {
	return piecesOf(sketch).find((piece) => piece?.id === id) || null;
}

/** @returns {Number} */
export function nextPieceId(sketch) {
	let highest = 0;
	piecesOf(sketch).forEach((piece) => {
		if (Number.isInteger(piece?.id)) highest = Math.max(highest, piece.id);
	});
	return highest + 1;
}

/**
 * @param {Object} sketch
 * @param {Object} piece - { use?, closed?, parts, ...the optional fields }
 * @returns {Object} the piece as stored, with its id and key
 */
export function addPiece(sketch, piece) {
	const stored = {
		...piece,
		id: nextPieceId(sketch),
		key: piece.key || newPieceKey(),
		use: USES.includes(piece.use) ? piece.use : sketchWay(sketch),
		closed: piece.closed === true,
		parts: Array.isArray(piece.parts) ? piece.parts : [],
	};
	sketch.pieces.push(stored);
	return stored;
}

/**
 * @param {Object} part
 * @returns {[String, String] | null} its first and last point ids
 */
export function partEnds(part) {
	if (!part) return null;
	if (part.type === 'spline') {
		const points = Array.isArray(part.points) ? part.points : [];
		return points.length ? [points[0], points.at(-1)] : null;
	}
	if (part.from === undefined || part.to === undefined) return null;
	return [part.from, part.to];
}

/** @returns {[String, String] | null} the piece's first and last point ids */
export function pieceEnds(piece) {
	const parts = partsOf(piece);
	if (!parts.length) return null;
	const first = partEnds(parts[0]);
	const last = partEnds(parts.at(-1));
	return first && last ? [first[0], last[1]] : null;
}

/** @returns {Array<String>} every point id the piece uses, in order, once each */
export function piecePointIds(piece) {
	const ids = [];
	partsOf(piece).forEach((part) => {
		const list =
			part?.type === 'spline' ? part.points || [] : [part?.from, part?.to].filter(Boolean);
		list.forEach((id) => {
			if (!ids.includes(id)) ids.push(id);
		});
	});
	return ids;
}

/** @returns {Array<Object>} the pieces that use the point */
export function piecesAt(sketch, pointId) {
	return piecesOf(sketch).filter((piece) => piecePointIds(piece).includes(pointId));
}

/** @returns {Boolean} shared by two pieces, or tied to a piece by an onPiece relation */
export function isJoined(sketch, pointId) {
	if (piecesAt(sketch, pointId).length > 1) return true;
	return (Array.isArray(sketch?.relations) ? sketch.relations : []).some(
		(relation) => relation?.type === 'onPiece' && relation.point === pointId
	);
}

/** @returns {Boolean} an open piece of one one-point spline: the nib alone */
export function isDot(piece) {
	const parts = partsOf(piece);
	return (
		!piece?.closed &&
		parts.length === 1 &&
		parts[0]?.type === 'spline' &&
		Array.isArray(parts[0].points) &&
		parts[0].points.length === 1
	);
}

/** @returns {Boolean} a closed piece whose one part is a spline: a loop through its points */
export function isCyclicSpline(piece) {
	const parts = partsOf(piece);
	return !!piece?.closed && parts.length === 1 && parts[0]?.type === 'spline';
}

// --------------------------------------------------------------
// Validation
// --------------------------------------------------------------

/**
 * @param {Object} sketch
 * @param {{project?: Object}} [options] - project: also check the thickness against its range
 * @returns {{ok: Boolean, problems: Array<String>, newer: Boolean}}
 */
export function validateSketch(sketch, { project } = {}) {
	const problems = [];
	if (!sketch || typeof sketch !== 'object') return { ok: false, problems: ['no sketch'], newer: false };
	if (isNewerSketch(sketch)) return { ok: true, problems, newer: true };
	if (Number(sketch.v) !== SKETCH_V) problems.push(`format v${sketch.v} is not v${SKETCH_V}`);
	if (typeof sketch.key !== 'string' || !sketch.key) problems.push('no key');
	if (!WAYS.includes(sketch.way)) problems.push(`way "${sketch.way}"`);
	if (!ENDS.includes(sketch.ends)) problems.push(`ends "${sketch.ends}"`);
	if (!isWhole(sketch.thickness) || sketch.thickness < 0) problems.push('thickness');
	else if (project && sketch.thickness > 0) {
		const { min, max } = thicknessRange(project);
		if (sketch.thickness < min || sketch.thickness > max) {
			problems.push(`thickness out of range (${min} to ${max})`);
		}
	}
	if (sketch.mirror !== null && sketch.mirror !== undefined && !isWhole(sketch.mirror?.x)) {
		problems.push('mirror x');
	}
	if (!isPlainObject(sketch.points)) problems.push('points');
	if (!Array.isArray(sketch.pieces)) problems.push('pieces');
	if (problems.length && (!isPlainObject(sketch.points) || !Array.isArray(sketch.pieces))) {
		return { ok: false, problems, newer: false };
	}
	Object.entries(sketch.points).forEach(([id, point]) => checkPoint(sketch, id, point, problems));
	const pieceIds = new Set();
	const pieceKeys = new Set();
	sketch.pieces.forEach((piece, index) => {
		const name = `piece ${piece?.id ?? `#${index}`}`;
		if (!Number.isInteger(piece?.id)) problems.push(`${name}: id`);
		else if (pieceIds.has(piece.id)) problems.push(`${name}: id used twice`);
		pieceIds.add(piece?.id);
		if (typeof piece?.key !== 'string' || !piece.key) problems.push(`${name}: key`);
		else if (pieceKeys.has(piece.key)) problems.push(`${name}: key used twice`);
		pieceKeys.add(piece?.key);
		checkPiece(sketch, piece, name, problems);
	});
	sketch.pieces.forEach((piece) => {
		if (piece?.insideOf === undefined || piece.insideOf === null) return;
		const outer = getPiece(sketch, piece.insideOf);
		if (!outer || !outer.closed || outer === piece) {
			problems.push(`piece ${piece.id}: inside of piece ${piece.insideOf}, which is no loop`);
		}
	});
	(Array.isArray(sketch.relations) ? sketch.relations : []).forEach((relation, index) => {
		const name = `relation ${index}`;
		if (!RELATION_TYPES.includes(relation?.type)) {
			problems.push(`${name}: type "${relation?.type}"`);
			return;
		}
		if (relation.type === 'onPiece') {
			if (!getPoint(sketch, relation.point)) problems.push(`${name}: point ${relation.point}`);
			if (!getPiece(sketch, relation.piece)) problems.push(`${name}: piece ${relation.piece}`);
			if (!(Number(relation.t) >= 0 && Number(relation.t) <= 1)) problems.push(`${name}: t`);
		} else {
			[relation.a, relation.b].forEach((id) => {
				if (!getPoint(sketch, id)) problems.push(`${name}: point ${id}`);
			});
		}
	});
	return { ok: problems.length === 0, problems, newer: false };
}

function checkPoint(sketch, id, point, problems) {
	const name = `point ${id}`;
	if (!isPlainObject(point)) {
		problems.push(`${name}: not a point`);
		return;
	}
	if (!isWhole(point.x) || !isWhole(point.y)) problems.push(`${name}: x / y not whole`);
	if (!KINDS.includes(point.kind)) problems.push(`${name}: kind "${point.kind}"`);
	if (point.on !== undefined && point.on !== null && !ON_PLACES.includes(point.on)) {
		problems.push(`${name}: on "${point.on}"`);
	}
	if (point.inset !== undefined && point.inset !== null) {
		if (point.inset !== 'edge') problems.push(`${name}: inset "${point.inset}"`);
		else if (!LINES.includes(point.on)) problems.push(`${name}: inset with no line`);
	}
	if (point.end !== undefined && point.end !== null && !ENDS.includes(point.end)) {
		problems.push(`${name}: end "${point.end}"`);
	}
	if (point.lock !== undefined && point.lock !== null && !LOCKS.includes(point.lock)) {
		problems.push(`${name}: lock "${point.lock}"`);
	}
	if (point.aim !== undefined && point.aim !== null) {
		const { dir, tin, tout } = point.aim;
		if (![dir, tin, tout].every((value) => Number.isFinite(value))) problems.push(`${name}: aim`);
		else if ([tin, tout].some((t) => t < 0.75 || t > 4)) problems.push(`${name}: aim tension`);
	}
	if (point.mirrorOf !== undefined && point.mirrorOf !== null) {
		if (!getPoint(sketch, point.mirrorOf) || point.mirrorOf === id) {
			problems.push(`${name}: mirror of ${point.mirrorOf}`);
		}
	}
}

function checkPiece(sketch, piece, name, problems) {
	if (!USES.includes(piece?.use)) problems.push(`${name}: use "${piece?.use}"`);
	if (piece?.use === 'helper' && piece.was !== undefined && !WAYS.includes(piece.was)) {
		problems.push(`${name}: was "${piece.was}"`);
	}
	if (piece?.circle !== undefined && piece.circle !== null) {
		const { cx, cy, rx, ry } = piece.circle;
		if (![cx, cy, rx, ry].every((value) => Number.isFinite(value)) || rx <= 0 || ry <= 0) {
			problems.push(`${name}: circle`);
		}
		if (!piece.closed) problems.push(`${name}: a circle is a closed loop`);
	}
	const linked = piece?.insideOf !== undefined && piece.insideOf !== null;
	if (linked && piece.closed !== true) problems.push(`${name}: an inside loop is closed`);
	if (linked && !(Number(piece.wall) > 0)) problems.push(`${name}: wall`);
	const parts = Array.isArray(piece?.parts) ? piece.parts : null;
	if (!parts) {
		problems.push(`${name}: parts`);
		return;
	}
	if (!parts.length) {
		if (!linked) problems.push(`${name}: no parts`);
		return;
	}
	parts.forEach((part, index) => {
		const label = `${name} part ${index}`;
		if (!PART_TYPES.includes(part?.type)) {
			problems.push(`${label}: type "${part?.type}"`);
			return;
		}
		if (part.type === 'spline') {
			const points = Array.isArray(part.points) ? part.points : [];
			if (!points.length) problems.push(`${label}: no points`);
			points.forEach((id) => {
				if (!getPoint(sketch, id)) problems.push(`${label}: point ${id} missing`);
			});
			if (points.length === 1 && !isDot(piece)) problems.push(`${label}: one point`);
			return;
		}
		[part.from, part.to].forEach((id) => {
			if (!getPoint(sketch, id)) problems.push(`${label}: point ${id} missing`);
		});
		if (part.from === part.to) problems.push(`${label}: starts where it ends`);
		if (part.type === 'arc' && part.tangent !== true && !Number.isFinite(part.bulge)) {
			problems.push(`${label}: bulge`);
		}
	});
	for (let index = 1; index < parts.length; index += 1) {
		const before = partEnds(parts[index - 1]);
		const now = partEnds(parts[index]);
		if (before && now && before[1] !== now[0]) {
			problems.push(`${name}: part ${index} does not start where part ${index - 1} ends`);
		}
	}
	if (piece.closed && !isCyclicSpline(piece)) {
		const ends = pieceEnds(piece);
		if (ends && ends[0] !== ends[1]) problems.push(`${name}: closed loop does not end where it starts`);
	}
	if (isCyclicSpline(piece) && (parts[0].points || []).length < 3) {
		problems.push(`${name}: a loop needs 3 points`);
	}
}

// --------------------------------------------------------------
// The font's thickness
// --------------------------------------------------------------

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {{min: Number, max: Number}} whole font units
 */
export function thicknessRange(project) {
	const height = smallLetterHeight(project);
	return {
		min: Math.max(2, Math.round(MIN_SHARE * height)),
		max: Math.max(2, Math.round(MAX_SHARE * height)),
	};
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number} whole font units
 */
export function sketchThickness(project) {
	const stored = project?.settings?.anyink?.sketchThickness;
	if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) return Math.round(stored);
	return brushSize(project);
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @param {Number | null} value - font units; null clears it
 * @returns {Number | null} what was stored
 */
export function setSketchThickness(project, value) {
	if (!project?.settings) return null;
	if (!project.settings.anyink || typeof project.settings.anyink !== 'object') {
		project.settings.anyink = {};
	}
	const number = Number(value);
	if (value === null || value === undefined || !Number.isFinite(number) || number <= 0) {
		project.settings.anyink.sketchThickness = null;
		return null;
	}
	const { min, max } = thicknessRange(project);
	const stored = Math.min(max, Math.max(min, Math.round(number)));
	project.settings.anyink.sketchThickness = stored;
	return stored;
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** The small-letter height in font units (nib/brush_size.js uses the same rule) */
function smallLetterHeight(project) {
	const font = project?.settings?.font || {};
	return Number(font.xHeight) > 0 ? Number(font.xHeight) : 0.55 * (Number(font.upm) || 1000);
}

function wholeOr(value, fallback) {
	const number = Number(value);
	return value !== null && value !== '' && Number.isFinite(number) ? Math.round(number) : fallback;
}

const isWhole = (value) => typeof value === 'number' && Number.isInteger(value);

function isPlainObject(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}
