// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 follow tests' helpers: a font on STORED_FONT with the letters the stored and build sketches
	draw, a letter built from a sketch through the real build (build.js rebuildItem), and how far
	apart two sets of outlines are (each outline flattened; the larger of the two one-way
	distances from every sample to the nearest piece of the other's outline).

	  FOLLOW_IDS                    { n, o, s, A, O, B, v } -> glyph ids
	  followEditor()                a ProjectEditor (made current) on that font
	  builtLetter(editor, id, sketch)   the letter, its ink built from the sketch, hashed
	  outlinesApart(shapesA, shapesB)   font units
	  freshInk(item, project)       the Paths the letter's sketch builds now (not put in it)
	  withoutRebuild(fn)            runs fn with follow.js's rebuild taken away, so the ink stays
	                                as the feature made it
*/
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { buildSketch, builtPaths, rebuildItem } from '../build.js';
import { setSketchRebuild, sketchRebuild } from '../follow.js';
import { setSketch, sketchOf, sketchThickness } from '../model.js';
import { STORED_FONT } from './fixtures/stored_sketches.js';

export const FOLLOW_IDS = Object.freeze({
	n: 'glyph-0x6E',
	o: 'glyph-0x6F',
	s: 'glyph-0x73',
	A: 'glyph-0x41',
	O: 'glyph-0x4F',
	B: 'glyph-0x42',
	v: 'glyph-0x76',
});

/** @returns {ProjectEditor} */
export function followEditor() {
	const glyphs = {};
	Object.values(FOLLOW_IDS).forEach((id) => {
		glyphs[id] = { id, advanceWidth: 0, shapes: [] };
	});
	const editor = new ProjectEditor();
	editor.project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Follow',
				id: 'g2_FOLLOWTEST',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'Follow', ...STORED_FONT },
		},
		glyphs,
	});
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	return editor;
}

/**
 * @param {ProjectEditor} editor
 * @param {String} id
 * @param {Object} sketch
 * @returns {Object} the Glyph
 */
export function builtLetter(editor, id, sketch) {
	const item = editor.project.glyphs[id];
	item.shapes = [];
	setSketch(item, sketch);
	rebuildItem(item, { project: editor.project, force: true });
	item.advanceWidth = Math.round(item.maxes.xMax + 60);
	return item;
}

/**
 * @param {Object} item
 * @param {Object} project
 * @returns {Array<Object>} Paths
 */
export function freshInk(item, project) {
	const sketch = sketchOf(item);
	const built = buildSketch(sketch, {
		font: project.settings.font,
		thickness: sketchThickness(project),
	});
	return builtPaths(sketch, built.shapes);
}

/** @param {Function} fn */
export function withoutRebuild(fn) {
	const kept = sketchRebuild();
	setSketchRebuild(null);
	try {
		return fn();
	} finally {
		setSketchRebuild(kept);
	}
}

/**
 * @param {Array<Object>} a - Paths
 * @param {Array<Object>} b - Paths
 * @returns {Number}
 */
export function outlinesApart(a, b) {
	const pa = a.map(flatten);
	const pb = b.map(flatten);
	return Math.max(oneWay(pa, pb), oneWay(pb, pa));
}

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

const STEPS = 24;

const xy = (control) => [Number(control.x), Number(control.y)];

/** A Path as a closed list of points: each segment p_i, h2_i, h1_(i+1), p_(i+1) sampled */
function flatten(path) {
	const points = path.pathPoints;
	const out = [];
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		const c = [xy(a.p), xy(a.h2), xy(b.h1), xy(b.p)];
		for (let s = 0; s < STEPS; s++) out.push(cubicAt(c, s / STEPS));
	}
	return out;
}

function cubicAt([p0, p1, p2, p3], t) {
	const u = 1 - t;
	const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
	return [
		w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0],
		w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1],
	];
}

function oneWay(from, to) {
	let worst = 0;
	for (const loop of from) {
		for (const point of loop) {
			let best = Infinity;
			for (const other of to) best = Math.min(best, toLoop(point, other));
			worst = Math.max(worst, best);
		}
	}
	return worst;
}

function toLoop(p, loop) {
	let best = Infinity;
	for (let i = 0; i < loop.length; i++) {
		best = Math.min(best, toSegment(p, loop[i], loop[(i + 1) % loop.length]));
	}
	return best;
}

function toSegment([px, py], [ax, ay], [bx, by]) {
	const dx = bx - ax;
	const dy = by - ay;
	const length = dx * dx + dy * dy;
	const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
