// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track B: the auto-trace preview on the edit canvas (preview_draw.js),
// checked against vi-canvas-mock's recorded calls at a known view. The session module
// (track C) is replaced by a stub whose getSession returns what each test sets.
// The setup file (vitest-setup.js -> app/main.js) already loads the edit canvas and with it
// preview_draw.js and the real session module, so the modules are reset and imported again
// after the stub is in place.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState = vi.hoisted(() => ({ current: null }));
vi.mock('../autotrace_session.js', () => ({
	getSession: () => sessionState.current,
}));

let drawAutoTracePreview;
let previewShapesFor;
let setPhotoPreview;
let setModeForTests;
let PREVIEW_DASH;
let PREVIEW_FILL_ALPHA;
let PREVIEW_LINE_WIDTH;
let potraceSvgToShapes;
let clearTokenCache;
let withAlpha;

beforeAll(async () => {
	vi.resetModules();
	({
		drawAutoTracePreview,
		previewShapesFor,
		setPhotoPreview,
		PREVIEW_DASH,
		PREVIEW_FILL_ALPHA,
		PREVIEW_LINE_WIDTH,
	} = await import('../preview_draw.js'));
	({ potraceSvgToShapes } = await import('../svg_to_shapes.js'));
	({ clearTokenCache, withAlpha } = await import('../../theme/theme.js'));
	({ setModeForTests } = await import('../../mode/mode.js'));
});

const here = dirname(fileURLToPath(import.meta.url));
const SQUARE = readFileSync(join(here, 'fixtures', 'square_hole.svg'), 'utf8');

// Canvas px = dx + x * dz, dy - y * dz
const VIEW = { dx: 100, dy: 400, dz: 0.5 };
const TOUCH = '#16a34a';

let ctx;
let item;
let editor;
let shapes;

const calls = (name) => ctx.__getEvents().filter((e) => e.type === name);
const session = (fields) => ({
	item,
	options: {},
	status: 'ready',
	result: { shapes, points: 8, ms: 12, threshold: 128 },
	error: null,
	...fields,
});

beforeEach(() => {
	document.documentElement.style.setProperty('--canvas-selection', TOUCH);
	clearTokenCache();
	const canvas = document.createElement('canvas');
	canvas.width = 900;
	canvas.height = 560;
	ctx = canvas.getContext('2d');
	item = { objType: 'Glyph', name: 'A', shapes: [] };
	editor = { nav: { panel: 'Trace', page: 'Characters' } };
	// The 64 px square with a hole, 1 unit per pixel, top-left at (0, 64): x 8..56, y 8..56
	shapes = potraceSvgToShapes(SQUARE, { x: 0, y: 64, scale: 1 });
	sessionState.current = null;
});

afterEach(() => {
	document.documentElement.style.removeProperty('--canvas-selection');
	clearTokenCache();
	sessionState.current = null;
	setPhotoPreview(null);
	setModeForTests('all');
});

// B8 + B9 integration: Simple has no Trace panel; the photo flow's step C draws its green dashed
// outline here through the shapes the photo screens register (photo_app.js at boot)
describe("drawAutoTracePreview in Simple: the photo flow's step C", () => {
	it('draws the shapes the photo flow gives for this letter, whatever panel is open', () => {
		setModeForTests('simple');
		const seen = [];
		setPhotoPreview((forItem, forEditor) => {
			seen.push([forItem, forEditor]);
			return shapes;
		});
		drawAutoTracePreview(ctx, VIEW, item, { nav: { panel: 'Attributes' } });
		expect(calls('fill')).toHaveLength(1);
		expect(calls('stroke')).toHaveLength(1);
		expect(calls('setLineDash')[0].props.segments).toEqual([...PREVIEW_DASH]);
		expect(seen[0][0]).toBe(item);
	});

	it('draws nothing in Simple without a step C, even with a Trace session', () => {
		setModeForTests('simple');
		sessionState.current = session();
		setPhotoPreview(() => null);
		drawAutoTracePreview(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('All tools never asks the photo flow (the Trace panel session draws, as before)', () => {
		const photo = vi.fn(() => shapes);
		setPhotoPreview(photo);
		drawAutoTracePreview(ctx, VIEW, item, { nav: { panel: 'Attributes' } });
		expect(ctx.__getEvents()).toHaveLength(0);
		expect(photo).not.toHaveBeenCalled();
	});
});

describe('drawAutoTracePreview', () => {
	it('draws nothing when no session runs', () => {
		drawAutoTracePreview(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('draws nothing for another item than the session is tracing', () => {
		sessionState.current = session({ item: { objType: 'Glyph', name: 'B' } });
		drawAutoTracePreview(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('draws nothing before the first result is ready, or after an error', () => {
		sessionState.current = session({ status: 'idle', result: null });
		drawAutoTracePreview(ctx, VIEW, item, editor);
		sessionState.current = session({ status: 'tracing', result: null });
		drawAutoTracePreview(ctx, VIEW, item, editor);
		sessionState.current = session({ status: 'error', error: 'The trace failed.' });
		drawAutoTracePreview(ctx, VIEW, item, editor);
		sessionState.current = session({ status: 'ready', result: { shapes: [] } });
		drawAutoTracePreview(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('draws nothing once another panel is open', () => {
		sessionState.current = session();
		drawAutoTracePreview(ctx, VIEW, item, { nav: { panel: 'Attributes' } });
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('draws a ready result: one light nonzero fill and one dashed outline, in touch green', () => {
		sessionState.current = session();
		drawAutoTracePreview(ctx, VIEW, item, editor);

		expect(calls('fill')).toHaveLength(1);
		expect(calls('fill')[0].props.fillRule).toBe('nonzero');
		expect(calls('stroke')).toHaveLength(1);
		expect(calls('fillStyle').at(-1).props.value).toBe(
			ctxColor(withAlpha(TOUCH, PREVIEW_FILL_ALPHA))
		);
		expect(calls('strokeStyle').at(-1).props.value).toBe(ctxColor(TOUCH));
		expect(calls('setLineDash')[0].props.segments).toEqual([...PREVIEW_DASH]);
		expect(calls('lineWidth').at(-1).props.value).toBe(PREVIEW_LINE_WIDTH);
		// Everything it set is put back
		expect(calls('save')).toHaveLength(1);
		expect(calls('restore')).toHaveLength(1);
	});

	it('uses the canvas math: x -> dx + x * dz, y -> dy - y * dz, both contours closed', () => {
		sessionState.current = session();
		drawAutoTracePreview(ctx, VIEW, item, editor);
		const moves = calls('moveTo').map((e) => [e.props.x, e.props.y]);
		expect(moves).toHaveLength(2);
		const firstOuter = shapes[0].pathPoints[0].p;
		expect(moves[0]).toEqual([VIEW.dx + firstOuter.x * VIEW.dz, VIEW.dy - firstOuter.y * VIEW.dz]);
		// 4 + 4 straight edges
		expect(calls('lineTo')).toHaveLength(8);
		expect(calls('closePath')).toHaveLength(2);
		// Every line ends on the square's corners: x 8..56 -> 104..128, y 8..56 -> 396..372
		for (const e of calls('lineTo')) {
			expect([104, 112, 120, 128]).toContain(e.props.x);
			expect([372, 380, 388, 396]).toContain(e.props.y);
		}
	});

	it('draws curves as bezierCurveTo with mapped handles', () => {
		const O = readFileSync(join(here, 'fixtures', 'letter_o.svg'), 'utf8');
		shapes = potraceSvgToShapes(O, { x: 0, y: 200, scale: 1 });
		sessionState.current = session();
		drawAutoTracePreview(ctx, VIEW, item, editor);
		const curves = calls('bezierCurveTo');
		expect(curves.length).toBeGreaterThan(5);
		for (const e of curves) {
			// The ring spans 15..185 px: canvas x 107.5..192.5, y 392.5..307.5
			expect(e.props.x).toBeGreaterThanOrEqual(107);
			expect(e.props.x).toBeLessThanOrEqual(193);
			expect(e.props.y).toBeGreaterThanOrEqual(307);
			expect(e.props.y).toBeLessThanOrEqual(393);
		}
	});

	it('keeps the last result up while a newer trace runs (no flicker while sliding)', () => {
		sessionState.current = session({ status: 'tracing' });
		drawAutoTracePreview(ctx, VIEW, item, editor);
		expect(calls('fill')).toHaveLength(1);
		expect(calls('stroke')).toHaveLength(1);
	});

	it('refuses a broken view or a missing canvas', () => {
		sessionState.current = session();
		drawAutoTracePreview(ctx, { dx: 0, dy: 0, dz: 0 }, item, editor);
		drawAutoTracePreview(ctx, { dx: NaN, dy: 0, dz: 1 }, item, editor);
		drawAutoTracePreview(ctx, null, item, editor);
		drawAutoTracePreview(null, VIEW, item, editor);
		drawAutoTracePreview(ctx, VIEW, null, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
	});
});

describe('previewShapesFor', () => {
	it('gives the session result for the session item only', () => {
		expect(previewShapesFor(item)).toBeNull();
		sessionState.current = session();
		expect(previewShapesFor(item)).toBe(shapes);
		expect(previewShapesFor({})).toBeNull();
		expect(previewShapesFor(null)).toBeNull();
	});

	it('matches by id when undo swapped the glyph object, and only on the session editor', () => {
		const sessionEditor = { nav: { panel: 'Trace', page: 'Characters' } };
		sessionState.current = session({ editor: sessionEditor, itemId: 'glyph-0x41' });
		const copy = { objType: 'Glyph', id: 'glyph-0x41', shapes: [] };
		expect(previewShapesFor(copy, sessionEditor)).toBe(shapes);
		expect(previewShapesFor({ ...copy, id: 'glyph-0x42' }, sessionEditor)).toBeNull();
		// The other open project can hold the same glyph id: its canvas draws nothing
		const otherEditor = { nav: { panel: 'Trace', page: 'Characters' } };
		expect(previewShapesFor(copy, otherEditor)).toBeNull();
		drawAutoTracePreview(ctx, VIEW, copy, otherEditor);
		expect(ctx.__getEvents()).toHaveLength(0);
		drawAutoTracePreview(ctx, VIEW, copy, sessionEditor);
		expect(calls('fill')).toHaveLength(1);
	});
});

/** The color string the canvas mock stores for a CSS color (it normalizes to #rrggbb / rgba). */
function ctxColor(value) {
	const probe = document.createElement('canvas').getContext('2d');
	probe.fillStyle = value;
	return probe.fillStyle;
}
