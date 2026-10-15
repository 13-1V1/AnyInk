// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track A: drawing the trace image and its handles, checked against
// vi-canvas-mock's recorded events at a known view.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetStore } from '../../assets/asset_store.js';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import { clearTokenCache, token } from '../../theme/theme.js';
import { getBitmap, onBitmapReady, setDecoderForTests } from '../bitmap_cache.js';
import {
	drawTraceAffordances,
	drawTraceImage,
	TRACE_HANDLE_HIT_PX,
	TRACE_HANDLE_PX,
	traceCanvasRect,
	traceHandleRadiusFU,
	traceReadoutText,
} from '../trace_draw.js';
import { traceLayerState } from '../trace_layer.js';
import { setTrace } from '../trace_model.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';

// Canvas px = dx + x * dz, dy - y * dz
const VIEW = { dx: 100, dy: 400, dz: 0.5 };
// 400 x 200 px at 2.5 units per px = 1000 x 500 units, top-left (-50, 800)
// -> canvas rect x 75, y 0, 500 x 250
const TRACE = { asset: 'img-draw0001', width: 400, height: 200, x: -50, y: 800, scale: 2.5 };
const RECT = { x: 75, y: 0, width: 500, height: 250 };

const TOKENS = {
	'--canvas-selection': '#16a34a',
	'--canvas-trace-frame': '#7c3aed',
	'--canvas-handle-fill': '#ffffff',
	'--canvas-label-halo': '#ffffff',
	'--canvas-guide-label': '#6d28d9',
};

let editor;
let item;
let ctx;
let bitmap;
let decodes;

function makeCtx() {
	const canvas = document.createElement('canvas');
	canvas.width = 900;
	canvas.height = 560;
	return canvas.getContext('2d');
}

const events = (type) => ctx.__getEvents().filter((e) => e.type === type);
const drawCalls = (type) => ctx.__getDrawCalls().filter((e) => (type ? e.type === type : true));

/** Draw once to start the decode, wait for it, then clear the recorded events. */
async function warmBitmap() {
	const ready = new Promise((resolve) => {
		const off = onBitmapReady(() => {
			off();
			resolve();
		});
	});
	drawTraceImage(ctx, VIEW, item, editor);
	await ready;
	ctx.__clearEvents();
	ctx.__clearDrawCalls();
}

beforeEach(() => {
	decodes = 0;
	bitmap = new ImageBitmap(400, 200);
	setDecoderForTests({
		decode: async () => {
			decodes++;
			return bitmap;
		},
	});
	const assets = new AssetStore();
	assets.add(new Blob([new Uint8Array(8)], { type: 'image/webp' }), { id: TRACE.asset });
	editor = { assets, nav: { panel: 'Trace' }, selectedTool: 'resize' };
	item = { objType: 'Glyph', anyink: {} };
	setTrace(item, TRACE);
	ctx = makeCtx();

	for (const [name, value] of Object.entries(TOKENS)) {
		document.documentElement.style.setProperty(name, value);
	}
	clearTokenCache();
});

afterEach(() => {
	setDecoderForTests(null);
	traceLayerState.hover = false;
	traceLayerState.dragging = false;
	resetGuidesLayerState();
	for (const name of Object.keys(TOKENS)) document.documentElement.style.removeProperty(name);
	clearTokenCache();
});

describe('traceCanvasRect / traceHandleRadiusFU', () => {
	it('maps font units to canvas pixels (y-up, y is the top edge)', () => {
		expect(traceCanvasRect(setTraceAndGet(), VIEW)).toEqual(RECT);
	});

	it('refuses a view that would give a broken rectangle', () => {
		expect(traceCanvasRect(setTraceAndGet(), { dx: 0, dy: 0, dz: 0 })).toBeNull();
		expect(traceCanvasRect(setTraceAndGet(), { dx: NaN, dy: 0, dz: 1 })).toBeNull();
		expect(traceCanvasRect(null, VIEW)).toBeNull();
	});

	it('the handle hit radius is pixels divided by zoom', () => {
		expect(traceHandleRadiusFU({ dz: 0.5 })).toBe(TRACE_HANDLE_HIT_PX * 2);
		expect(traceHandleRadiusFU({ dz: 2 })).toBe(TRACE_HANDLE_HIT_PX / 2);
		expect(traceHandleRadiusFU({})).toBe(TRACE_HANDLE_HIT_PX);
	});
});

function setTraceAndGet() {
	return { ...TRACE, opacity: 0.4, visible: true, locked: false, invert: false };
}

describe('drawTraceImage', () => {
	it('draws nothing while the bitmap is still decoding, then draws once it is ready', async () => {
		drawTraceImage(ctx, VIEW, item, editor);
		expect(drawCalls('drawImage')).toHaveLength(0);
		expect(decodes).toBe(1);

		await new Promise((resolve) => {
			const off = onBitmapReady(() => {
				off();
				resolve();
			});
		});
		drawTraceImage(ctx, VIEW, item, editor);
		expect(drawCalls('drawImage')).toHaveLength(1);
		expect(decodes).toBe(1);
	});

	it('draws the whole bitmap into the trace rectangle at the known view', async () => {
		await warmBitmap();
		drawTraceImage(ctx, VIEW, item, editor);
		const [call] = drawCalls('drawImage');
		expect(call.props).toEqual({
			img: bitmap,
			sx: 0,
			sy: 0,
			sWidth: 400,
			sHeight: 200,
			dx: RECT.x,
			dy: RECT.y,
			dWidth: RECT.width,
			dHeight: RECT.height,
		});
	});

	it('sets opacity and high-quality smoothing inside save / restore, and no filter', async () => {
		await warmBitmap();
		drawTraceImage(ctx, VIEW, item, editor);
		const order = ctx.__getEvents().map((e) => e.type);
		expect(order[0]).toBe('save');
		expect(order[order.length - 1]).toBe('restore');
		expect(order.indexOf('globalAlpha')).toBeLessThan(order.indexOf('drawImage'));
		expect(order.indexOf('imageSmoothingQuality')).toBeLessThan(order.indexOf('drawImage'));
		expect(events('globalAlpha')[0].props.value).toBe(0.4);
		expect(events('imageSmoothingQuality')[0].props.value).toBe('high');
		expect(events('filter')).toHaveLength(0);
		// restore put everything back
		expect(ctx.globalAlpha).toBe(1);
		expect(ctx.filter).toBe('none');
	});

	it('uses the stored opacity, clamped', async () => {
		await warmBitmap();
		setTrace(item, { ...TRACE, opacity: 0.75 });
		drawTraceImage(ctx, VIEW, item, editor);
		expect(events('globalAlpha')[0].props.value).toBe(0.75);

		ctx.__clearEvents();
		item.anyink.trace.opacity = 0.001; // a hand-edited file
		drawTraceImage(ctx, VIEW, item, editor);
		expect(events('globalAlpha')[0].props.value).toBe(0.05);
	});

	it('invert draws through an invert filter, then restores it', async () => {
		await warmBitmap();
		setTrace(item, { ...TRACE, invert: true });
		drawTraceImage(ctx, VIEW, item, editor);
		const order = ctx.__getEvents().map((e) => e.type);
		expect(events('filter')[0].props.value).toBe('invert(1)');
		expect(order.indexOf('filter')).toBeLessThan(order.indexOf('drawImage'));
		expect(ctx.filter).toBe('none');
	});

	it('a hidden trace draws nothing and does not even start a decode', () => {
		setTrace(item, { ...TRACE, visible: false });
		drawTraceImage(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
		expect(decodes).toBe(0);
	});

	it('draws nothing (and never throws) without a trace, an image, an item, or an editor', async () => {
		await warmBitmap();
		editor.assets.delete(TRACE.asset);
		drawTraceImage(ctx, VIEW, item, editor);
		drawTraceImage(ctx, VIEW, { anyink: {} }, editor);
		drawTraceImage(ctx, VIEW, null, editor);
		drawTraceImage(ctx, VIEW, undefined, undefined);
		drawTraceImage(ctx, VIEW, item, {});
		drawTraceImage(null, VIEW, item, editor);
		drawTraceImage(ctx, null, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('the cache is looked up by the Blob in editor.assets', async () => {
		await warmBitmap();
		expect(getBitmap(editor.assets.get(TRACE.asset).blob)).toBe(bitmap);
	});
});

describe('drawTraceAffordances', () => {
	const touch = () => token('--canvas-selection');

	it('with the Trace panel open: a frame and four corner handles, even before the image decodes', () => {
		drawTraceAffordances(ctx, VIEW, item, editor);
		const strokes = drawCalls('strokeRect');
		const fills = drawCalls('fillRect');
		expect(strokes).toHaveLength(5);
		expect(fills).toHaveLength(4);
		expect(strokes[0].props).toEqual({
			x: RECT.x + 0.5,
			y: RECT.y + 0.5,
			width: RECT.width,
			height: RECT.height,
		});

		const half = TRACE_HANDLE_PX / 2;
		const corners = fills.map((f) => [f.props.x + half, f.props.y + half]);
		expect(corners).toEqual([
			[Math.round(RECT.x - half) + half, Math.round(RECT.y - half) + half],
			[Math.round(RECT.x + RECT.width - half) + half, Math.round(RECT.y - half) + half],
			[
				Math.round(RECT.x + RECT.width - half) + half,
				Math.round(RECT.y + RECT.height - half) + half,
			],
			[Math.round(RECT.x - half) + half, Math.round(RECT.y + RECT.height - half) + half],
		]);
		for (const f of fills) {
			expect(f.props.width).toBe(TRACE_HANDLE_PX);
			expect(f.props.height).toBe(TRACE_HANDLE_PX);
		}
		expect(decodes).toBe(0); // affordances never need the bitmap
		expect(ctx.__getEvents()[0].type).toBe('save');
		expect(ctx.__getEvents().at(-1).type).toBe('restore');
	});

	it('nothing with another panel open, or when locked or hidden', () => {
		editor.nav.panel = 'Layers';
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);

		editor.nav.panel = 'Trace';
		setTrace(item, { ...TRACE, locked: true });
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);

		setTrace(item, { ...TRACE, visible: false });
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(ctx.__getEvents()).toHaveLength(0);

		setTrace(item, null);
		drawTraceAffordances(ctx, VIEW, item, editor);
		drawTraceAffordances(ctx, VIEW, null, editor);
		drawTraceAffordances(ctx, VIEW, item, undefined);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('with a drawing tool: the purple frame only, no handles and no hover (integration, D-028)', () => {
		for (const tool of ['newPath', 'pathEdit', 'pathAddPoint', 'newRectangle', 'newOval', 'pan']) {
			ctx.__clearEvents();
			ctx.__clearDrawCalls();
			editor.selectedTool = tool;
			traceLayerState.hover = 'ne';
			drawTraceAffordances(ctx, VIEW, item, editor);
			expect(drawCalls('strokeRect'), tool).toHaveLength(1);
			expect(drawCalls('fillRect'), tool).toHaveLength(0);
			expect(events('strokeStyle').map((e) => e.props.value)).toEqual(['#7c3aed']);
			expect(ctx.__getEvents().at(-1).type).toBe('restore');
		}
	});

	it('the frame is structure purple at rest; handles are outlined in touch green', () => {
		expect(touch()).toBe('#16a34a'); // tokens resolve in this test document
		drawTraceAffordances(ctx, VIEW, item, editor);
		const strokeStyles = events('strokeStyle').map((e) => e.props.value);
		expect(strokeStyles[0]).toBe('#7c3aed');
		expect(strokeStyles.slice(1)).toEqual(['#16a34a', '#16a34a', '#16a34a', '#16a34a']);
		const fillStyles = events('fillStyle').map((e) => e.props.value);
		expect(fillStyles).toEqual(['#ffffff', '#ffffff', '#ffffff', '#ffffff']);
		expect(events('lineWidth')[0].props.value).toBe(1);
	});

	it('the hovered corner fills green', () => {
		traceLayerState.hover = 'ne';
		drawTraceAffordances(ctx, VIEW, item, editor);
		const fillStyles = events('fillStyle').map((e) => e.props.value);
		// order: nw, ne, se, sw
		expect(fillStyles).toEqual(['#ffffff', '#16a34a', '#ffffff', '#ffffff']);
		expect(drawCalls('fillText')).toHaveLength(0); // no readout while only hovering
	});

	it('hovering or dragging the body turns the frame green and 2 px wide', () => {
		traceLayerState.hover = 'move';
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(events('strokeStyle')[0].props.value).toBe('#16a34a');
		expect(events('lineWidth')[0].props.value).toBe(2);
	});

	it('the dragged part wins over the hovered one, and a readout shows while dragging', () => {
		traceLayerState.hover = 'nw';
		traceLayerState.dragging = 'se';
		drawTraceAffordances(ctx, VIEW, item, editor);
		const fillStyles = events('fillStyle').map((e) => e.props.value);
		expect(fillStyles.slice(0, 4)).toEqual(['#ffffff', '#ffffff', '#16a34a', '#ffffff']);
		const [label] = drawCalls('fillText');
		expect(label.props.text).toBe('1000 wide, 500 tall');
		// beside the se corner, outside the image
		expect(label.props.x).toBeGreaterThan(RECT.x + RECT.width);
		expect(label.props.y).toBeGreaterThan(RECT.y + RECT.height);
	});

	it('a metric line under the pointer owns the hover: no grab highlight on the image (fix track)', () => {
		// The pointer went from the image body onto the baseline: the guides layer took the
		// mousemove, so the trace layer never heard it and its hover is stale
		traceLayerState.hover = 'move';
		guidesLayerState.hover = 'baseline';
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(events('strokeStyle')[0].props.value).toBe('#7c3aed');
		expect(events('lineWidth')[0].props.value).toBe(1);

		// Same for a corner hover left behind, and while a line is being dragged
		ctx.__clearEvents();
		traceLayerState.hover = 'ne';
		guidesLayerState.hover = false;
		guidesLayerState.dragging = 'xHeight';
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(events('fillStyle').map((e) => e.props.value)).toEqual([
			'#ffffff',
			'#ffffff',
			'#ffffff',
			'#ffffff',
		]);

		// A trace drag in progress still shows as grabbed
		ctx.__clearEvents();
		traceLayerState.dragging = 'move';
		guidesLayerState.dragging = false;
		guidesLayerState.hover = 'baseline';
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(events('strokeStyle')[0].props.value).toBe('#16a34a');
	});

	it('a move drag reads out where the top-left corner is', () => {
		traceLayerState.dragging = 'move';
		drawTraceAffordances(ctx, VIEW, item, editor);
		expect(drawCalls('fillText')[0].props.text).toBe('left -50, top 800');
	});

	it('the readout stays on the canvas', () => {
		traceLayerState.dragging = 'nw';
		// top-left corner far off the top-left of the canvas
		setTrace(item, { ...TRACE, x: -2000, y: 5000 });
		drawTraceAffordances(ctx, VIEW, item, editor);
		const [label] = drawCalls('fillText');
		expect(label.props.x).toBeGreaterThanOrEqual(4);
		expect(label.props.y).toBeGreaterThanOrEqual(12);
	});
});

describe('traceReadoutText', () => {
	it('plain words, font units rounded', () => {
		const t = { ...setTraceAndGet(), x: 12.4, y: 799.6, scale: 2.1234 };
		expect(traceReadoutText(t, 'move')).toBe('left 12, top 800');
		expect(traceReadoutText(t, 'ne')).toBe('849 wide, 425 tall');
	});
});

// B4 + B5 finalize (verdict "A dropped photo is a dead end in Simple", the variant that failed: a
// photo put under a letter in More tools still showed in Simple, where nothing can hide, remove
// or trace it until B9's photo card). Until the 'photo' flag is on, Simple doesn't draw a photo
// (it never goes in the font file, and Simple has no way to use it); All tools draws it as before.
describe('drawTraceImage in Simple before the photo card (B9)', () => {
	afterEach(() => {
		setModeForTests('all');
		resetFeaturesForTests();
	});

	it('Simple, photo flag off: draws nothing', async () => {
		await warmBitmap();
		setModeForTests('simple');
		// B8 + B9 integration: 'photo' is on in the app now; this is Simple before B9
		setFeaturesForTests({ photo: false });
		drawTraceImage(ctx, VIEW, item, editor);
		expect(drawCalls('drawImage')).toHaveLength(0);
	});

	it("Simple, once B9 turns 'photo' on: draws it", async () => {
		await warmBitmap();
		setModeForTests('simple');
		setFeaturesForTests({ photo: true });
		drawTraceImage(ctx, VIEW, item, editor);
		expect(drawCalls('drawImage')).toHaveLength(1);
	});

	it('All tools: draws it, as before', async () => {
		await warmBitmap();
		drawTraceImage(ctx, VIEW, item, editor);
		expect(drawCalls('drawImage')).toHaveLength(1);
	});
});
