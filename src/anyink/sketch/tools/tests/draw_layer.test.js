// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 (docs/SKETCH.md 2 "What it draws", 6 "Hints while drawing"): the draw layer
// (sketch/tools/draw_layer.js). It draws only with the 'sketch' flag on and a sketch tool picked;
// every stored piece's built centerline (curves.js), the open piece and the live part, points
// filled when stuck and hollow when free, green for what the pointer is on, lock ticks, the
// first point's ring, the tools' hints (snap.js / chain.js shapes), the snap tag and the readout
// in house words, the ink lines while a Centerline piece is open; every color a theme token.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flagsOn } from '../../../mode/features.js';
import { clearTokenCache } from '../../../theme/theme.js';
import { word } from '../../../words/words.js';
import { pieceSkeleton } from '../../curves.js';
import { inkLines } from '../../edge_rule.js';
import { STORED_FONT, storedSketch } from '../../tests/fixtures/stored_sketches.js';
import {
	drawSketchLayer,
	isStuck,
	paintPicture,
	readoutText,
	sketchLayerShows,
	sketchPicture,
	STYLE,
} from '../draw_layer.js';
import { clearSketchToolsForTests, registerSketchTool } from '../tool_route.js';

const ON = flagsOn('sketch');
const OFF = () => false;
const PROJECT = { settings: { font: { ...STORED_FONT } } };
const VIEW = { dx: 100, dy: 1800, dz: 0.5 };

/** Theme colors the test can tell apart (jsdom has no stylesheet) */
const TOKENS = {
	'--canvas-guide': '#7c3aed',
	'--canvas-point-selected': '#16a34a',
	'--canvas-point-fill': '#ffffff',
	'--canvas-guide-label': '#6d28d9',
	'--canvas-label-halo': '#ffffff',
	'--canvas-ink-outline': '#2f3038',
};

/** A canvas context that writes down every call and every style set */
function recordingCtx(width = 1200, height = 1600) {
	const calls = [];
	const state = {};
	const ctx = new Proxy(
		{ canvas: { width, height } },
		{
			get(target, name) {
				if (name in target) return target[name];
				if (name in state) return state[name];
				return (...args) => calls.push({ name, args, style: { ...state } });
			},
			set(target, name, value) {
				state[name] = value;
				return true;
			},
		}
	);
	return { ctx, calls };
}

const strokes = (calls) => calls.filter((call) => call.name === 'stroke');
const fills = (calls) => calls.filter((call) => call.name === 'fill');
const texts = (calls) => calls.filter((call) => call.name === 'fillText').map((call) => call.args[0]);

function letter(name) {
	return { anyink: { sketch: storedSketch(name) } };
}

beforeEach(() => {
	Object.entries(TOKENS).forEach(([name, value]) =>
		document.documentElement.style.setProperty(name, value)
	);
	clearTokenCache();
});
afterEach(() => {
	Object.keys(TOKENS).forEach((name) => document.documentElement.style.removeProperty(name));
	clearTokenCache();
	clearSketchToolsForTests();
});

describe('when the layer draws', () => {
	it('only with the flag on and a sketch tool picked', () => {
		expect(sketchLayerShows({ selectedTool: 'sketchLine' }, { isOn: ON })).toBe(true);
		expect(sketchLayerShows({ selectedTool: 'sketchLine' }, { isOn: OFF })).toBe(false);
		['resize', 'nib', 'newPath', 'pan'].forEach((tool) =>
			expect(sketchLayerShows({ selectedTool: tool }, { isOn: ON })).toBe(false)
		);
	});

	it('the flag off: drawSketchLayer paints nothing at all and never asks the tool', () => {
		const drawState = vi.fn(() => ({}));
		registerSketchTool('sketchLine', { drawState });
		const { ctx, calls } = recordingCtx();
		const editor = { selectedTool: 'sketchLine', project: PROJECT };
		expect(drawSketchLayer(ctx, VIEW, letter('n'), editor, { isOn: OFF })).toBe(null);
		expect(calls).toEqual([]);
		expect(drawState).not.toHaveBeenCalled();
	});
});

describe('the picture', () => {
	it('every stored piece built by curves.js, its points, filled when stuck and hollow when free', () => {
		const item = letter('n');
		const sketch = item.anyink.sketch;
		const picture = sketchPicture(item, PROJECT, {});
		expect(picture.pieces.map((piece) => piece.id)).toEqual(sketch.pieces.map((piece) => piece.id));
		picture.pieces.forEach((piece, i) =>
			expect(piece.cubics).toEqual(pieceSkeleton(sketch.pieces[i], sketch))
		);
		const byId = Object.fromEntries(picture.points.map((point) => [point.id, point]));
		expect(Object.keys(byId).sort()).toEqual(Object.keys(sketch.points).sort());
		// pinned to a line: stuck; the shoulder is a free smooth point with a plumb lock
		expect(byId.foot.stuck).toBe(true);
		expect(byId.rightFoot.stuck).toBe(true);
		expect(byId.shoulder).toMatchObject({ stuck: false, lock: 'plumb', hot: false });
		expect(byId.archTop.lock).toBe('level');
		// nothing open: no ink lines, no hints, no snap, no readout
		expect(picture).toMatchObject({ inkLines: [], hints: [], snap: null, readout: null, ring: null });
		expect(picture.open).toBe(null);
	});

	it('isStuck: on a line, a mirror twin, shared by two pieces, or on a piece', () => {
		const sketch = {
			points: { a: { x: 0, y: 0, on: 'writing' }, b: { x: 1, y: 1, mirrorOf: 'c' }, c: { x: 2, y: 2 }, d: { x: 3, y: 3 }, e: { x: 4, y: 4 } },
			pieces: [
				{ id: 1, parts: [{ type: 'line', from: 'c', to: 'd' }] },
				{ id: 2, parts: [{ type: 'line', from: 'd', to: 'e' }] },
			],
			relations: [{ type: 'onPiece', point: 'e', piece: 1, t: 0.5 }],
		};
		expect(['a', 'b', 'c', 'd', 'e', 'missing'].map((id) => isStuck(sketch, id))).toEqual([
			true,
			true,
			false,
			true,
			true,
			false,
		]);
	});

	it('the open piece is drawn once, as the open piece; its new points show; the ink lines show', () => {
		const item = letter('n');
		const working = structuredClone(item.anyink.sketch);
		working.points.p9 = { x: 900, y: 600, kind: 'corner' };
		const piece = { use: 'center', closed: false, parts: [{ type: 'line', from: 'rightFoot', to: 'p9' }] };
		const picture = sketchPicture(item, PROJECT, { sketch: working, open: { piece } });
		expect(picture.open.cubics).toEqual(pieceSkeleton(piece, working));
		expect(picture.points.find((point) => point.id === 'p9')).toMatchObject({ x: 900, y: 600, stuck: false });
		const lines = inkLines(STORED_FONT, 99);
		expect(picture.inkLines).toEqual(
			['top', 'capitals', 'small', 'writing', 'tail'].map((name) => ({ name, y: lines[name] }))
		);
		// the writing line's ink line sits half the thickness above it
		expect(picture.inkLines.find((line) => line.name === 'writing').y).toBeCloseTo(49.5, 5);
	});

	it('an open Outline piece shows no ink lines (its points are the edge already)', () => {
		const item = letter('o');
		const piece = { use: 'outline', closed: false, parts: [{ type: 'spline', points: ['top'] }] };
		expect(sketchPicture(item, PROJECT, { open: { piece } }).inkLines).toEqual([]);
		expect(sketchPicture(item, PROJECT, { open: { piece }, inkLines: true }).inkLines).toHaveLength(5);
	});

	it('the tools\' hints: snap.js and chain.js shapes, ink lines from the hints, "line" adds nothing', () => {
		const picture = sketchPicture(letter('n'), PROJECT, {
			hints: [
				{ type: 'line', on: 'writing', y: 0 },
				{ type: 'halfway', on: 'halfSmall', y: 550 },
				{ type: 'middle', x: 340 },
				{ type: 'level', pointId: 'foot', from: { x: 120, y: 50 }, to: { x: 560, y: 50 } },
				{ type: 'inkLine', on: 'writing', y: 49.5 },
			],
			tangent: { x: 120, y: 1051, dir: 90 },
			snap: { x: 560, y: 50, tag: { key: 'sketch.tag.joins' }, hints: [{ type: 'plumb', from: [1, 2], to: [1, 9] }] },
		});
		expect(picture.hints).toEqual([
			{ kind: 'halfway', y: 550 },
			{ kind: 'middle', x: 340 },
			{ kind: 'level', from: [120, 50], to: [560, 50] },
			{ kind: 'plumb', from: [1, 2], to: [1, 9] },
			{ kind: 'tangent', from: [120, 1051], dir: 90 },
		]);
		expect(picture.inkLines).toEqual([{ name: 'writing', y: 49.5 }]);
		expect(picture.snap).toEqual({ x: 560, y: 50, text: word('sketch.tag.joins') });
	});

	it('the snap tag and the readout in house words; the readout in inches on 1 in capitals', () => {
		expect(readoutText({ length: 740, angle: 90 }, STORED_FONT)).toBe('0.50 in, 90°');
		expect(readoutText({ length: 1480, angle: -90 }, STORED_FONT)).toBe('1.00 in, 270°');
		expect(readoutText({ length: 0, angle: 360 }, STORED_FONT)).toBe('0.00 in, 0°');
		const keyed = sketchPicture(letter('n'), PROJECT, {
			pointer: { x: 300, y: 1040 },
			readout: { key: 'sketch.readout.line', vars: { length: '0.50', angle: 90 } },
			snap: { x: 300, y: 1051, tagKey: 'line.xHeight' },
		});
		expect(keyed.readout).toEqual({ x: 300, y: 1040, text: '0.50 in, 90°' });
		expect(keyed.snap.text).toBe(word('line.xHeight'));
		const measured = sketchPicture(letter('n'), PROJECT, { readout: { x: 1, y: 2, length: 370, angle: 45 } });
		expect(measured.readout.text).toBe('0.25 in, 45°');
	});

	it('hot points and pieces, the first point\'s ring (overFirst), extra dots by id or place', () => {
		const item = letter('n');
		const sketch = item.anyink.sketch;
		const picture = sketchPicture(item, PROJECT, {
			hot: { points: ['foot'], pieces: ['pc_stem'] },
			points: [{ x: 5, y: 6, hot: true }, 'foot'],
			overFirst: true,
			open: { piece: { use: 'center', closed: false, parts: [{ type: 'line', from: 'shoulder', to: 'rightFoot' }] } },
		});
		expect(picture.pieces.find((piece) => piece.key === 'pc_stem').hot).toBe(true);
		expect(picture.points.find((point) => point.id === 'foot').hot).toBe(true);
		expect(picture.points.filter((point) => point.id === 'foot')).toHaveLength(1);
		expect(picture.points.at(-1)).toMatchObject({ id: null, x: 5, y: 6, hot: true });
		// the open piece's first point is not 'foot' (points[0] is a place): the place wins
		expect(picture.ring).toEqual({ x: 5, y: 6 });
		const ringed = sketchPicture(item, PROJECT, {
			overFirst: true,
			open: { piece: { use: 'center', closed: false, parts: [{ type: 'line', from: 'shoulder', to: 'rightFoot' }] } },
		});
		expect(ringed.ring).toEqual({ x: sketch.points.shoulder.x, y: sketch.points.shoulder.y });
	});

	it('a helper piece is dashed and labeled; an unfinished Outline piece says it has a gap; hidden pieces stay out', () => {
		const sketch = storedSketch('n');
		sketch.pieces[0].use = 'helper';
		sketch.pieces[1].use = 'outline';
		sketch.pieces.push({ id: 9, key: 'pc_gone', use: 'center', hidden: true, closed: false, parts: [] });
		const picture = sketchPicture({ anyink: { sketch } }, PROJECT, {});
		expect(picture.pieces.map((piece) => [piece.dashed, piece.label])).toEqual([
			[true, word('sketch.label.helper')],
			[false, word('sketch.label.gap')],
		]);
		expect(picture.pieces.every((piece) => piece.labelAt)).toBe(true);
	});

	it('a letter with no sketch: an empty picture, no crash', () => {
		const picture = sketchPicture({}, PROJECT, {});
		expect(picture).toMatchObject({ pieces: [], points: [], open: null, preview: null });
	});
});

describe('painting', () => {
	it('purple structure, green for what is touched, hollow points filled with the canvas point fill', () => {
		const { ctx, calls } = recordingCtx();
		const picture = sketchPicture(letter('n'), PROJECT, {
			hot: { pieces: ['pc_arch'], points: ['foot'] },
			preview: [[[0, 0], [10, 10], [20, 10], [30, 0]]],
		});
		const marks = paintPicture(ctx, VIEW, picture);
		expect(marks).toBeGreaterThan(0);
		// the curves come first (then the 1.5 px point rims)
		const pieceStrokes = strokes(calls).filter((call) => call.style.lineWidth === STYLE.line).slice(0, 3);
		// stem purple, arch green (hot), preview green
		expect(pieceStrokes.map((call) => call.style.strokeStyle)).toEqual([
			TOKENS['--canvas-guide'],
			TOKENS['--canvas-point-selected'],
			TOKENS['--canvas-point-selected'],
		]);
		const dotFills = fills(calls).map((call) => call.style.fillStyle);
		expect(dotFills).toContain(TOKENS['--canvas-point-fill']); // the free shoulder
		expect(dotFills).toContain(TOKENS['--canvas-point-selected']); // the hot foot
		expect(dotFills).toContain(TOKENS['--canvas-guide']); // stuck, not hot
		// every color painted is one of the tokens (or one of them with alpha)
		const allowed = new Set([...Object.values(TOKENS), 'rgba(124, 58, 237, 0.35)', 'rgba(124, 58, 237, 0.6)', 'rgba(47, 48, 56, 0.75)']);
		calls.forEach(({ style }) => {
			['strokeStyle', 'fillStyle'].forEach((key) => {
				if (style[key] !== undefined) expect(allowed.has(style[key]), `${key} ${style[key]}`).toBe(true);
			});
		});
	});

	it('the points sit where the view puts them (font units, y up)', () => {
		const { ctx, calls } = recordingCtx();
		const sketch = { v: 1, points: { a: { x: 200, y: 400, kind: 'corner' } }, pieces: [{ id: 1, closed: false, use: 'center', parts: [{ type: 'spline', points: ['a'] }] }], relations: [] };
		paintPicture(ctx, VIEW, sketchPicture({}, PROJECT, { sketch }));
		const arc = calls.find((call) => call.name === 'arc' && call.args[2] === STYLE.dot / 2);
		expect(arc.args.slice(0, 2)).toEqual([VIEW.dx + 200 * VIEW.dz, VIEW.dy - 400 * VIEW.dz]);
	});

	it('words on the canvas: the snap tag, the readout gray, the helper label', () => {
		const sketch = storedSketch('n');
		sketch.pieces[0].use = 'helper';
		const { ctx, calls } = recordingCtx();
		paintPicture(
			ctx,
			VIEW,
			sketchPicture({ anyink: { sketch } }, PROJECT, {
				snap: { x: 0, y: 0, tagKey: 'line.baseline' },
				readout: { x: 0, y: 0, length: 740, angle: 90 },
			})
		);
		expect(texts(calls)).toEqual([word('line.baseline'), word('sketch.label.helper'), '0.50 in, 90°']);
		const readout = calls.find((call) => call.name === 'fillText' && call.args[0] === '0.50 in, 90°');
		expect(readout.style.fillStyle).toBe('rgba(47, 48, 56, 0.75)');
	});

	it('hints across the canvas, the tangent a short ray; nothing without a fitted view', () => {
		const { ctx, calls } = recordingCtx(1000, 800);
		paintPicture(
			ctx,
			VIEW,
			sketchPicture({}, PROJECT, {
				hints: [{ type: 'halfway', y: 0 }, { type: 'edge', x: 0 }],
				tangent: { x: 0, y: 0, dir: 0 },
			})
		);
		const lines = calls.filter((call) => call.name === 'lineTo').map((call) => call.args);
		expect(lines).toEqual([
			[1000, VIEW.dy],
			[VIEW.dx, 800],
			[VIEW.dx + STYLE.tangent, VIEW.dy],
		]);
		expect(paintPicture(ctx, { dx: 0, dy: 0, dz: 0 }, sketchPicture({}, PROJECT, {}))).toBe(0);
	});

	it('drawSketchLayer asks the picked tool (drawState, else view()); a tool that throws still leaves the sketch drawn', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const editor = { selectedTool: 'sketchArc', project: PROJECT };
		registerSketchTool('sketchArc', { view: () => ({ snap: { x: 1, y: 2, text: 'writing line' } }) });
		const picture = drawSketchLayer(recordingCtx().ctx, VIEW, letter('n'), editor, { isOn: ON });
		expect(picture.snap.text).toBe('writing line');
		registerSketchTool('sketchArc', {
			drawState: () => {
				throw new Error('boom');
			},
		});
		const after = drawSketchLayer(recordingCtx().ctx, VIEW, letter('n'), editor, { isOn: ON });
		expect(after.pieces).toHaveLength(2);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
