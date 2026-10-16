// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 fix track (layer wiring): the draw layer after the S2 critic.
//   - A finished sketch stays on the canvas, read-only and purple, whatever tool is picked
//     (Select, the Brush, after leaving the letter and coming back), with no dots, hints, snap or
//     readout; nothing at all with the flag off, off a letter's canvas, or with no pieces.
//   - Circle, Arc and Rectangle say their size at the cursor, gray, in inches on 1 in capitals,
//     never typed: "0.40 in across", "R 0.40 in", "0.50 x 0.75 in". Line keeps its own readout.
// Written to fail first: the layer drew nothing unless a sketch tool was picked, and only Line
// had a readout.
import { afterEach, describe, expect, it } from 'vitest';
import { flagsOn } from '../../../mode/features.js';
import { arcCubics } from '../../arc.js';
import { circleCubics } from '../../curves.js';
import { STORED_FONT, storedSketch } from '../../tests/fixtures/stored_sketches.js';
import {
	drawSketchLayer,
	sizeReadout,
	sketchPicture,
	storedSketchShows,
} from '../draw_layer.js';
import { clearSketchToolsForTests, registerSketchTool } from '../tool_route.js';

const ON = flagsOn('sketch');
const OFF = () => false;
const PROJECT = { settings: { font: { ...STORED_FONT } } };
const VIEW = { dx: 100, dy: 1800, dz: 0.5 };
/** capitals = 1480 font units = "1 in" */
const IN = 1480;

function recordingCtx() {
	const calls = [];
	const state = {};
	const ctx = new Proxy(
		{ canvas: { width: 1200, height: 1600 } },
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

const letter = (name) => ({ anyink: { sketch: storedSketch(name) } });
const editorOn = (tool, page = 'Characters') => ({
	selectedTool: tool,
	project: PROJECT,
	nav: { page },
});

afterEach(() => clearSketchToolsForTests());

describe('a finished sketch stays on the canvas whatever tool is picked', () => {
	it('Select, the Brush, the Point pen and Pan draw the stored pieces read-only', () => {
		const item = letter('n');
		['resize', 'nib', 'newPath', 'pan', 'pathEdit'].forEach((tool) => {
			expect(storedSketchShows(editorOn(tool), item, { isOn: ON })).toBe(true);
			const { ctx, calls } = recordingCtx();
			const picture = drawSketchLayer(ctx, VIEW, item, editorOn(tool), { isOn: ON });
			expect(picture, tool).not.toBe(null);
			expect(picture.pieces.length).toBe(item.anyink.sketch.pieces.length);
			// read-only: no dots, hints, snap, readout, ink lines or open piece
			expect(picture).toMatchObject({
				points: [],
				hints: [],
				inkLines: [],
				snap: null,
				readout: null,
				ring: null,
				open: null,
				preview: null,
			});
			// purple strokes only, never green
			const strokes = calls.filter((call) => call.name === 'stroke');
			expect(strokes.length).toBe(picture.pieces.length);
		});
	});

	it('the picked tool is never asked while it is not a sketch tool', () => {
		let asked = 0;
		registerSketchTool('sketchLine', { drawState: () => (asked++, {}) });
		drawSketchLayer(recordingCtx().ctx, VIEW, letter('n'), editorOn('resize'), { isOn: ON });
		expect(asked).toBe(0);
	});

	it('nothing with the flag off, off a letter canvas, or with no pieces', () => {
		const item = letter('n');
		expect(storedSketchShows(editorOn('resize'), item, { isOn: OFF })).toBe(false);
		const { ctx, calls } = recordingCtx();
		expect(drawSketchLayer(ctx, VIEW, item, editorOn('resize'), { isOn: OFF })).toBe(null);
		expect(calls).toEqual([]);
		expect(storedSketchShows(editorOn('kern', 'Kerning'), item, { isOn: ON })).toBe(false);
		expect(storedSketchShows(editorOn('resize'), {}, { isOn: ON })).toBe(false);
		expect(
			storedSketchShows(editorOn('resize'), { anyink: { sketch: { points: {}, pieces: [] } } }, { isOn: ON })
		).toBe(false);
		// all pieces hidden: nothing to show
		const hidden = letter('n');
		hidden.anyink.sketch.pieces.forEach((piece) => (piece.hidden = true));
		expect(storedSketchShows(editorOn('resize'), hidden, { isOn: ON })).toBe(false);
	});

	it('during a Space-pan the tool it gives back still draws its open piece', () => {
		registerSketchTool('sketchLine', {
			drawState: () => ({ open: { cubics: [[[0, 0], [1, 1], [2, 2], [3, 3]]] } }),
		});
		const picture = drawSketchLayer(recordingCtx().ctx, VIEW, letter('n'), editorOn('pan'), {
			isOn: ON,
			tool: 'sketchLine',
		});
		expect(picture.open.cubics.length).toBe(1);
	});

	it('a sketch tool picked still draws the full picture (dots and all)', () => {
		const picture = drawSketchLayer(recordingCtx().ctx, VIEW, letter('n'), editorOn('sketchLine'), {
			isOn: ON,
		});
		expect(picture.points.length).toBeGreaterThan(0);
	});
});

describe('the size at the cursor for Circle, Arc and Rectangle', () => {
	it('a Circle being sized: its size across', () => {
		const state = { open: { cubics: circleCubics({ cx: 500, cy: 550, rx: IN * 0.2, ry: IN * 0.2 }) } };
		expect(sizeReadout('sketchCircle', state, STORED_FONT)).toBe('0.40 in across');
		const picture = sketchPicture(letter('n'), PROJECT, { ...state, tool: 'sketchCircle', pointer: { x: 10, y: 20 } });
		expect(picture.readout).toEqual({ x: 10, y: 20, text: '0.40 in across' });
	});

	it('an oval (Shift): width x height', () => {
		const state = { open: { cubics: circleCubics({ cx: 500, cy: 550, rx: IN * 0.25, ry: IN * 0.375 }) } };
		expect(sizeReadout('sketchCircle', state, STORED_FONT)).toBe('0.50 x 0.75 in');
	});

	it('a Rectangle being dragged: width x height', () => {
		const c = [
			[100, 0],
			[100 + IN * 0.5, 0],
			[100 + IN * 0.5, IN * 0.75],
			[100, IN * 0.75],
		];
		const cubics = c.map((p, i) => [p, [...p], [...c[(i + 1) % 4]], c[(i + 1) % 4]]);
		expect(sizeReadout('sketchRectangle', { open: { cubics } }, STORED_FONT)).toBe('0.50 x 0.75 in');
	});

	it('an Arc (and the Line tool\'s pull-back arc): its radius; a straight chord says nothing', () => {
		// a half circle of radius 0.4 in
		const r = IN * 0.4;
		const half = { preview: { cubics: arcCubics([0, 0], [2 * r, 0], 1) } };
		expect(sizeReadout('sketchArc', half, STORED_FONT)).toBe('R 0.40 in');
		expect(sizeReadout('sketchLine', half, STORED_FONT)).toBe('R 0.40 in');
		// a shallow arc of the same radius
		const a = Math.PI / 6;
		const shallow = {
			preview: {
				cubics: arcCubics([r * Math.cos(Math.PI / 2 + a), r * Math.sin(Math.PI / 2 + a)], [r * Math.cos(Math.PI / 2 - a), r * Math.sin(Math.PI / 2 - a)], -Math.tan(a / 2)),
			},
		};
		expect(sizeReadout('sketchArc', shallow, STORED_FONT)).toBe('R 0.40 in');
		const chord = { preview: { cubics: [[[0, 0], [10, 0], [20, 0], [30, 0]]] } };
		expect(sizeReadout('sketchArc', chord, STORED_FONT)).toBe('');
		// Line's straight part keeps its own readout (none derived here)
		expect(sizeReadout('sketchLine', chord, STORED_FONT)).toBe('');
	});

	it('the tool\'s own readout wins; nothing derived without a part being drawn', () => {
		const state = {
			tool: 'sketchCircle',
			open: { cubics: circleCubics({ cx: 0, cy: 0, rx: 100, ry: 100 }) },
			readout: { x: 1, y: 2, text: 'own' },
		};
		expect(sketchPicture(letter('n'), PROJECT, state).readout.text).toBe('own');
		expect(sizeReadout('sketchCircle', {}, STORED_FONT)).toBe('');
		expect(sizeReadout('sketchRectangle', {}, STORED_FONT)).toBe('');
		expect(sizeReadout('resize', state, STORED_FONT)).toBe('');
	});

	it('drawSketchLayer puts it at the pointer (canvas pixels), gray', () => {
		registerSketchTool('sketchCircle', {
			drawState: () => ({ open: { cubics: circleCubics({ cx: 500, cy: 550, rx: IN * 0.2, ry: IN * 0.2 }) } }),
		});
		const { ctx, calls } = recordingCtx();
		const picture = drawSketchLayer(ctx, VIEW, letter('n'), editorOn('sketchCircle'), {
			isOn: ON,
			pointer: { x: 300, y: 1000 },
		});
		// canvas (300, 1000) is font ((300 - 100) / 0.5, (1800 - 1000) / 0.5)
		expect(picture.readout).toEqual({ x: 400, y: 1600, text: '0.40 in across' });
		expect(calls.some((call) => call.name === 'fillText' && call.args[0] === '0.40 in across')).toBe(true);
	});
});
