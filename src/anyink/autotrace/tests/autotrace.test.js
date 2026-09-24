// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8: the auto-trace facade (src/anyink/autotrace/autotrace.js) with a fake potrace
// worker, a stub SVG converter (track B's svg_to_shapes.js is mocked, so these tests hold
// whatever it does), a stub pixel reader (trace_pixels.js needs a real canvas), and a stub
// glyph-box region. Covers: the worker gets pure black-and-white pixels and the potrace
// options for this scale and em size; shapes, points, ms, threshold come back; blank images
// skip WASM tracing; latest-wins and aborts reject as stale; plain-words errors with
// codes; and autoTraceTrace's crop, preview downscale, full-resolution apply, and the
// placement math (crop offset, downscale factor, bitmap ratio) plus the kept preview pixels.
// Fixes (09/24/2026): too many shapes refused before converting; the full-size apply
// matched to its preview (speck floor, one Remove specks rule, the preview's Auto value);
// shapes the box rule drops are counted and named; the kept pixels are let go.
// Finalize: the point cap sits where converting still takes about half a second, and
// the full-size pass has looser caps (the preview already passed); the refusal names only
// the sliders that can still move; the traced area reaches half an em over the ascent;
// the result carries the traced area and how uneven the paper is.
import { installPotraceWorker } from '../potrace_worker_core.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../svg_to_shapes.js', () => ({
	potraceSvgToShapes: vi.fn((svg, placement) => [
		{ svg, placement, pathPoints: [{}, {}, {}, {}] },
		{ svg, placement, pathPoints: [{}, {}] },
	]),
	countPoints: vi.fn((shapes) => shapes.reduce((n, shape) => n + shape.pathPoints.length, 0)),
	svgShapeStats: vi.fn(() => ({ shapes: 2, points: 6 })),
}));
vi.mock('../trace_pixels.js', () => ({ readTracePixels: vi.fn() }));
vi.mock('../trace_region.js', () => ({
	BOX_MARGIN_EM: 0.25,
	ACCENT_MARGIN_EM: 0.5,
	regionForGlyph: vi.fn(),
	keepShapesInGlyphBox: vi.fn((shapes) => shapes),
}));

// vitest-setup.js imports the whole app (src/app/main.js), which already loaded the real
// facade before the mocks above were registered; start a fresh module graph so the facade
// and its client are loaded with the mocks.
let AUTOTRACE_MESSAGES;
let PREVIEW_MAX_SIDE;
let MAX_TRACE_SHAPES;
let MAX_TRACE_POINTS;
let APPLY_MAX_SHAPES;
let APPLY_MAX_POINTS;
let tooManyMessage;
let KEPT_IDLE_MS;
let autoSplit;
let downscaleImageData;
let svgShapeStats;
let autoTraceImageData;
let autoTraceTrace;
let clearAutoTraceCache;
let otsuThreshold;
let toGray;
let normalizeOptions;
let toPotraceOptions;
let turdsizeFor;
let setWorkerFactoryForTests;
let potraceSvgToShapes;
let readTracePixels;
let regionForGlyph;
let keepShapesInGlyphBox;

beforeAll(async () => {
	vi.resetModules();
	({
		AUTOTRACE_MESSAGES,
		PREVIEW_MAX_SIDE,
		MAX_TRACE_SHAPES,
		MAX_TRACE_POINTS,
		APPLY_MAX_SHAPES,
		APPLY_MAX_POINTS,
		tooManyMessage,
		KEPT_IDLE_MS,
		autoTraceImageData,
		autoTraceTrace,
		clearAutoTraceCache,
	} = await import('../autotrace.js'));
	({ autoSplit, downscaleImageData, otsuThreshold, toGray } = await import('../binarize.js'));
	({ normalizeOptions, toPotraceOptions, turdsizeFor } = await import('../params.js'));
	({ setWorkerFactoryForTests } = await import('../potrace_client.js'));
	({ potraceSvgToShapes, svgShapeStats } = await import('../svg_to_shapes.js'));
	({ readTracePixels } = await import('../trace_pixels.js'));
	({ regionForGlyph, keepShapesInGlyphBox } = await import('../trace_region.js'));
});

// --------------------------------------------------------------
// Fakes
// --------------------------------------------------------------

/** Replies on a later tick with an SVG naming the image size, or an error when told to. */
class AutoReplyWorker {
	static all = [];
	static failNext = null;
	constructor() {
		this.posted = [];
		AutoReplyWorker.all.push(this);
		this.core = installPotraceWorker(
			{
				postMessage: (data) => this.onmessage?.({ data }),
			},
			{
				init: async () => {},
				potrace: async (image) => {
					// Existing mask assertions inspect the actual pixels passed to WASM.
					this.posted.at(-1).message.data = image.data;
					this.posted.at(-1).transfer = [image.data.buffer];
					return `<svg w="${image.width}" h="${image.height}"/>`;
				},
			}
		);
	}
	postMessage(message, transfer) {
		this.posted.push({ message: { ...message }, transfer, raw: message.data });
		const fail = AutoReplyWorker.failNext;
		AutoReplyWorker.failNext = null;
		setTimeout(() => {
			if (fail) this.onmessage?.({ data: { id: message.id, error: fail } });
			else this.core.onMessage({ data: message });
		}, 0);
	}
	terminate() {}
}

function posted() {
	return AutoReplyWorker.all.flatMap((worker) => worker.posted);
}

function makeImage(width, height, paint) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const v = paint(x, y);
			const p = (y * width + x) * 4;
			data[p] = data[p + 1] = data[p + 2] = v;
			data[p + 3] = 255;
		}
	}
	return { data, width, height };
}

/** A black ring on light gray paper. */
const ring = (x, y, cx, cy, r1, r2) => {
	const d = Math.hypot(x - cx, y - cy);
	return d >= r1 && d <= r2;
};
const ringImage = makeImage(80, 60, (x, y) => (ring(x, y, 40, 30, 12, 22) ? 20 : 230));

function settle(promise) {
	return promise.then(
		(value) => ({ value }),
		(error) => ({ error })
	);
}

beforeEach(() => {
	AutoReplyWorker.all = [];
	AutoReplyWorker.failNext = null;
	setWorkerFactoryForTests(() => new AutoReplyWorker());
	clearAutoTraceCache();
	vi.clearAllMocks();
});

afterEach(() => {
	setWorkerFactoryForTests(null);
});

// --------------------------------------------------------------
// autoTraceImageData
// --------------------------------------------------------------

describe('autoTraceImageData', () => {
	const placement = { x: 10, y: 700, scale: 2 };

	it('binarizes, traces in the worker, converts, and reports shapes, points, ms, threshold', async () => {
		const result = await autoTraceImageData(ringImage, { smoothing: 0.5, detail: 0.3 }, placement);
		expect(result.shapes.length).toBe(2);
		expect(result.points).toBe(6);
		expect(typeof result.ms).toBe('number');
		expect(result.ms).toBeGreaterThanOrEqual(0);
		expect(result.threshold).toBe(otsuThreshold(toGray(ringImage)));
		expect(result.autoThreshold).toBe(result.threshold);
		expect([result.width, result.height]).toEqual([80, 60]);
		expect(Object.keys(result.timings)).toEqual(['binarize', 'trace', 'shapes']);

		// Raw source pixels reach the worker; WASM receives the conditioned mask.
		expect(posted()[0].raw).toEqual(ringImage.data);
		expect(posted()[0].raw).not.toBe(ringImage.data);
		const [{ message, transfer }] = posted();
		expect([message.width, message.height]).toEqual([80, 60]);
		expect(transfer).toEqual([message.data.buffer]);
		const values = new Set();
		for (let i = 0; i < message.data.length; i += 4) {
			values.add(
				`${message.data[i]},${message.data[i + 1]},${message.data[i + 2]},${message.data[i + 3]}`
			);
		}
		expect([...values].sort()).toEqual(['0,0,0,255', '255,255,255,255']);
		const inkAt = (x, y) => message.data[(y * 80 + x) * 4] === 0;
		expect(inkAt(40 - 17, 30)).toBe(true); // on the ring
		expect(inkAt(40, 30)).toBe(false); // the counter
		expect(inkAt(2, 2)).toBe(false);

		// ...with the potrace options for this placement's scale
		expect(message.options).toEqual(
			toPotraceOptions(normalizeOptions({ smoothing: 0.5, detail: 0.3 }), { scale: 2 })
		);

		// The SVG went to the converter with the placement (offsets defaulted)
		expect(potraceSvgToShapes).toHaveBeenCalledTimes(1);
		const [svg, place] = potraceSvgToShapes.mock.calls[0];
		expect(svg).toBe('<svg w="80" h="60"/>');
		expect(place).toMatchObject({ x: 10, y: 700, scale: 2, offsetX: 0, offsetY: 0 });
	});

	it('sizes the speck filter by the placement em size', async () => {
		await autoTraceImageData(ringImage, { detail: 0.2 }, { ...placement, upm: 2048 });
		expect(posted()[0].message.options.turdsize).toBe(turdsizeFor(0.2, 2, 2048));
	});

	it('a blank image resolves with no shapes and skips SVG conversion', async () => {
		const blank = makeImage(40, 40, () => 240);
		const result = await autoTraceImageData(blank, {}, placement);
		expect(result).toMatchObject({ shapes: [], points: 0 });
		expect(AutoReplyWorker.all.length).toBe(1);
		expect(potraceSvgToShapes).not.toHaveBeenCalled();
	});

	it('a newer blank image supersedes an in-flight ink trace', async () => {
		const older = settle(autoTraceImageData(ringImage, {}, placement));
		const blank = autoTraceImageData(
			makeImage(40, 40, () => 240),
			{},
			placement
		);
		expect((await older).error.stale).toBe(true);
		expect(await blank).toMatchObject({ shapes: [], points: 0 });
		expect(potraceSvgToShapes).not.toHaveBeenCalled();
	});

	it('latest wins: an older call rejects as stale, the newest resolves', async () => {
		const older = settle(autoTraceImageData(ringImage, { detail: 0.1 }, placement));
		const newer = settle(autoTraceImageData(ringImage, { detail: 0.9 }, placement));
		expect((await older).error.stale).toBe(true);
		const { value } = await newer;
		expect(value.shapes.length).toBe(2);
		// Only the newest result was converted
		expect(potraceSvgToShapes).toHaveBeenCalledTimes(1);
	});

	it('an abort rejects as stale, before or during the trace', async () => {
		const before = new AbortController();
		before.abort();
		const early = await settle(
			autoTraceImageData(ringImage, {}, placement, { signal: before.signal })
		);
		expect(early.error).toMatchObject({ stale: true, aborted: true });
		expect(AutoReplyWorker.all.length).toBe(0);

		const during = new AbortController();
		const pending = settle(autoTraceImageData(ringImage, {}, placement, { signal: during.signal }));
		during.abort();
		expect((await pending).error).toMatchObject({ stale: true, aborted: true });
		expect(potraceSvgToShapes).not.toHaveBeenCalled();
	});

	it('rejects in plain words: an empty image, or a failed trace', async () => {
		await expect(
			autoTraceImageData({ data: new Uint8ClampedArray(0), width: 0, height: 0 }, {}, placement)
		).rejects.toMatchObject({
			code: 'empty-image',
			message: AUTOTRACE_MESSAGES['empty-image'],
		});
		AutoReplyWorker.failNext = 'The image to trace is empty or the wrong size.';
		const failed = await settle(autoTraceImageData(ringImage, {}, placement));
		expect(failed.error.message).toBe('The image to trace is empty or the wrong size.');
		expect(failed.error.stale).toBeUndefined();
	});

	it('survives a missing or broken placement (origin, 1 font unit per pixel)', async () => {
		await autoTraceImageData(ringImage, {}, undefined);
		expect(potraceSvgToShapes.mock.calls[0][1]).toMatchObject({
			x: 0,
			y: 0,
			scale: 1,
			offsetX: 0,
			offsetY: 0,
		});
		await autoTraceImageData(ringImage, {}, { x: 'a', scale: -2 });
		expect(potraceSvgToShapes.mock.calls[1][1]).toMatchObject({ x: 0, scale: 1 });
	});
});

// --------------------------------------------------------------
// autoTraceTrace
// --------------------------------------------------------------

describe('autoTraceTrace', () => {
	const blob = { size: 10, slice() {} };
	const trace = { asset: 'img-abcdefgh', width: 2400, height: 1600, x: -100, y: 900, scale: 0.5 };
	const region = { x: 200, y: 400, width: 1200, height: 800 };
	const font = { upm: 1000, ascent: 700, descent: -300 };

	function makeEditor(assetBlob = blob) {
		return {
			assets: {
				get: (id) => (id === trace.asset && assetBlob ? { id, blob: assetBlob } : undefined),
			},
			project: { settings: { font } },
		};
	}
	const item = { advanceWidth: 600, anyink: { trace } };

	/** Pixels for a region at a bitmap ratio: a black square in the middle. */
	function pixelsFor(rect, ratio = 1) {
		const width = Math.round(rect.width * ratio);
		const height = Math.round(rect.height * ratio);
		const imageData = makeImage(width, height, (x, y) =>
			x > width / 3 && x < (2 * width) / 3 && y > height / 3 && y < (2 * height) / 3 ? 0 : 245
		);
		return {
			imageData,
			rect: { x: rect.x * ratio, y: rect.y * ratio, width, height },
			ratio,
		};
	}

	/** Where image pixel (px, py) of the traced image lands, in font units. */
	function land(place, px, py) {
		return [
			place.x + (px + place.offsetX) * place.scale,
			place.y - (py + place.offsetY) * place.scale,
		];
	}

	beforeEach(() => {
		regionForGlyph.mockReturnValue(region);
		readTracePixels.mockImplementation(async (b, rect, size) => pixelsFor(rect, 1, size));
	});

	it('preview: crops to the glyph box, downscales to 1000 px, and places the result', async () => {
		const result = await autoTraceTrace({ editor: makeEditor(), item, options: {}, preview: true });
		// Once to check the box reaches the image, once for the box plus a quarter em
		expect(regionForGlyph).toHaveBeenCalledTimes(2);
		const [traceArg, itemArg, fontArg] = regionForGlyph.mock.calls[0];
		expect(traceArg).toMatchObject(trace);
		expect(itemArg).toBe(item);
		expect(fontArg).toBe(font);
		expect(regionForGlyph.mock.calls[0][3]).toBeUndefined();
		expect(regionForGlyph.mock.calls[1][3]).toEqual({ margin: 250, marginTop: 500 });
		expect(readTracePixels).toHaveBeenCalledWith(
			blob,
			region,
			expect.objectContaining({ width: 2400, height: 1600 })
		);

		const factor = PREVIEW_MAX_SIDE / 1200;
		const [{ message }] = posted();
		expect([message.width, message.height]).toEqual([1000, Math.ceil(800 * factor)]);

		const place = potraceSvgToShapes.mock.calls[0][1];
		expect(place.scale).toBeCloseTo(0.5 / factor, 10);
		expect(place.offsetX).toBeCloseTo(200 * factor, 10);
		expect(place.offsetY).toBeCloseTo(400 * factor, 10);
		// The traced image's corner is the region's corner on the glyph...
		const [x0, y0] = land(place, 0, 0);
		expect(x0).toBeCloseTo(trace.x + region.x * trace.scale, 9); // 0
		expect(y0).toBeCloseTo(trace.y - region.y * trace.scale, 9); // 700
		// ...and any preview pixel p is full-image pixel p / factor + the crop offset
		const [x1, y1] = land(place, 500, 300);
		expect(x1).toBeCloseTo(trace.x + (500 / factor + region.x) * trace.scale, 9);
		expect(y1).toBeCloseTo(trace.y - (300 / factor + region.y) * trace.scale, 9);

		// The speck filter uses the preview's own scale
		expect(message.options.turdsize).toBe(turdsizeFor(0.6, 0.5 / factor, 1000));
		expect(result.area).toMatchObject({
			xMin: 0,
			xMax: 600,
			yMin: 300,
			yMax: 700,
			cut: { left: true, right: true, top: true, bottom: true },
		});
		expect(result.area.pixel).toBeCloseTo(0.5 / factor, 10);
		expect(Number.isFinite(result.paperSpread)).toBe(true);
		expect(result).toMatchObject({ points: 6 });
		expect(result.shapes.length).toBe(2);
	});

	it('preview pixels are kept: dragging a slider does not re-read the image', async () => {
		const editor = makeEditor();
		await autoTraceTrace({ editor, item, options: { detail: 0.2 }, preview: true });
		await autoTraceTrace({ editor, item, options: { detail: 0.8 }, preview: true });
		expect(readTracePixels).toHaveBeenCalledTimes(1);
		// A different region reads again
		regionForGlyph.mockReturnValue({ ...region, x: 210 });
		await autoTraceTrace({ editor, item, options: {}, preview: true });
		expect(readTracePixels).toHaveBeenCalledTimes(2);
	});

	it('apply (preview false) traces the full-resolution crop', async () => {
		await autoTraceTrace({ editor: makeEditor(), item, options: {}, preview: true });
		await autoTraceTrace({ editor: makeEditor(), item, options: {} });
		expect(readTracePixels).toHaveBeenCalledTimes(2);
		const last = posted().at(-1).message;
		expect([last.width, last.height]).toEqual([1200, 800]);
		const place = potraceSvgToShapes.mock.calls.at(-1)[1];
		expect(place).toMatchObject({ x: -100, y: 900, scale: 0.5, offsetX: 200, offsetY: 400 });
		expect(last.options.turdsize).toBe(turdsizeFor(0.6, 0.5, 1000));
	});

	it('apply waits for a painted frame before reading pixels; a preview does not', async () => {
		const full = autoTraceTrace({ editor: makeEditor(), item, options: {} });
		for (let i = 0; i < 5; i++) await Promise.resolve();
		expect(readTracePixels).not.toHaveBeenCalled();
		await full;
		expect(readTracePixels).toHaveBeenCalledTimes(1);

		const preview = autoTraceTrace({ editor: makeEditor(), item, options: {}, preview: true });
		for (let i = 0; i < 5; i++) await Promise.resolve();
		expect(readTracePixels).toHaveBeenCalledTimes(2);
		await preview;
	});

	it('preview and apply follow one Remove specks rule: thin lines and slits end the same (fix)', async () => {
		// A 2400 px crop: its preview is shrunk to 1000 px, one preview pixel = 2.4 px.
		// Features: a 2 px line and a 14 px line, and two pairs of 40 px strokes with a 2 px
		// and a 16 px slit between them
		const wide = { x: 0, y: 0, width: 2400, height: 800 };
		const inkX = (x) =>
			(x >= 600 && x < 602) ||
			(x >= 900 && x < 914) ||
			(x >= 1400 && x < 1440) ||
			(x >= 1442 && x < 1482) ||
			(x >= 1800 && x < 1840) ||
			(x >= 1856 && x < 1896);
		regionForGlyph.mockReturnValue(wide);
		readTracePixels.mockImplementation(async () => ({
			imageData: makeImage(2400, 800, (x, y) => (inkX(x) && y > 100 && y < 700 ? 10 : 240)),
			rect: wide,
			ratio: 1,
		}));
		await autoTraceTrace({ editor: makeEditor(), item, options: {}, preview: true });
		await autoTraceTrace({ editor: makeEditor(), item, options: {} });
		const [preview, full] = posted().map((p) => p.message);
		expect([preview.width, full.width]).toEqual([1000, 2400]);
		const f = 1000 / 2400;
		const inkIn = (m, x, y) => m.data[(y * m.width + x) * 4] === 0;
		const both = (x) => [inkIn(preview, Math.floor(x * f), 160), inkIn(full, x, 400)];
		expect(both(601)).toEqual([false, false]); // the 2 px line: gone from both
		expect(both(907)).toEqual([true, true]); // the 14 px line: in both
		expect(both(1441)).toEqual([true, true]); // the 2 px slit: closed in both
		expect(both(1848)).toEqual([false, false]); // the 16 px slit: open in both
	});

	it("the trace's own Invert colors (a look for the slate canvas) never changes what is traced", async () => {
		regionForGlyph.mockReturnValue({ x: 200, y: 400, width: 120, height: 80 });
		const shown = {
			...item,
			anyink: { trace: { ...trace, invert: true, visible: false, locked: true } },
		};
		await autoTraceTrace({ editor: makeEditor(), item, options: {} });
		await autoTraceTrace({ editor: makeEditor(), item: shown, options: {} });
		const [plain, inverted] = posted().map((p) => p.message);
		expect(inverted.data).toEqual(plain.data);
		// The dark square in the middle is the ink either way
		const at = (m, x, y) => m.data[(y * m.width + x) * 4];
		expect(at(inverted, 60, 40)).toBe(0);
		expect(at(inverted, 5, 5)).toBe(255);
		// 'Light ink on dark paper' is what flips it
		await autoTraceTrace({ editor: makeEditor(), item: shown, options: { invert: true } });
		const flipped = posted()[2].message;
		expect(at(flipped, 60, 40)).toBe(255);
		expect(at(flipped, 5, 5)).toBe(0);
	});

	it('inside the box: keeps the whole shapes keepShapesInGlyphBox picks, points recounted', async () => {
		keepShapesInGlyphBox.mockImplementationOnce((shapes) => shapes.slice(1));
		const result = await autoTraceTrace({ editor: makeEditor(), item, options: {} });
		expect(keepShapesInGlyphBox).toHaveBeenCalledTimes(1);
		const [, itemArg, fontArg] = keepShapesInGlyphBox.mock.calls[0];
		expect(itemArg).toBe(item);
		expect(fontArg).toBe(font);
		expect(result.shapes).toHaveLength(1);
		expect(result.points).toBe(2);
	});

	it('with insideBoxOnly off it traces the whole image', async () => {
		const result = await autoTraceTrace({
			editor: makeEditor(),
			item,
			options: { insideBoxOnly: false },
		});
		expect(result.area.cut).toEqual({ left: false, right: false, top: false, bottom: false });
		expect(regionForGlyph).not.toHaveBeenCalled();
		expect(keepShapesInGlyphBox).not.toHaveBeenCalled();
		expect(readTracePixels.mock.calls[0][1]).toEqual({ x: 0, y: 0, width: 2400, height: 1600 });
		expect(potraceSvgToShapes.mock.calls[0][1]).toMatchObject({
			offsetX: 0,
			offsetY: 0,
			scale: 0.5,
		});
	});

	it('a bitmap decoded at another size keeps the font-unit placement', async () => {
		readTracePixels.mockImplementation(async (b, rect) => pixelsFor(rect, 0.5));
		await autoTraceTrace({ editor: makeEditor(), item, options: {} });
		const place = potraceSvgToShapes.mock.calls[0][1];
		expect(place.scale).toBe(1); // 0.5 fu per stored pixel = 1 fu per bitmap pixel
		const [x0, y0] = land(place, 0, 0);
		expect([x0, y0]).toEqual([trace.x + region.x * trace.scale, trace.y - region.y * trace.scale]);
	});

	it('ms counts the pixel read too', async () => {
		readTracePixels.mockImplementation(
			(b, rect) => new Promise((resolve) => setTimeout(() => resolve(pixelsFor(rect)), 30))
		);
		const result = await autoTraceTrace({ editor: makeEditor(), item, options: {} });
		expect(result.ms).toBeGreaterThanOrEqual(25);
		expect(result.ms).toBeGreaterThanOrEqual(result.timings.binarize + result.timings.trace);
	});

	it('rejects in plain words with a code', async () => {
		await expect(
			autoTraceTrace({ editor: makeEditor(), item: { anyink: {} }, options: {} })
		).rejects.toMatchObject({
			code: 'no-trace',
			message: AUTOTRACE_MESSAGES['no-trace'],
		});
		await expect(
			autoTraceTrace({ editor: makeEditor(null), item, options: {} })
		).rejects.toMatchObject({
			code: 'missing-image',
		});
		regionForGlyph.mockReturnValue(null);
		await expect(autoTraceTrace({ editor: makeEditor(), item, options: {} })).rejects.toMatchObject(
			{
				code: 'outside-box',
				message: expect.stringContaining('Only inside the glyph box'),
			}
		);
		expect(readTracePixels).not.toHaveBeenCalled();
		const unread = Object.assign(new Error('The trace image could not be read.'), {
			code: 'read-failed',
		});
		regionForGlyph.mockReturnValue(region);
		readTracePixels.mockRejectedValueOnce(unread);
		await expect(autoTraceTrace({ editor: makeEditor(), item, options: {} })).rejects.toBe(unread);
	});

	it('an abort during the pixel read rejects as stale and sends nothing', async () => {
		const controller = new AbortController();
		readTracePixels.mockImplementation(async (b, rect) => {
			controller.abort();
			return pixelsFor(rect);
		});
		const record = await settle(
			autoTraceTrace({
				editor: makeEditor(),
				item,
				options: {},
				preview: true,
				signal: controller.signal,
			})
		);
		expect(record.error).toMatchObject({ stale: true, aborted: true });
		expect(AutoReplyWorker.all.length).toBe(0);
	});
});

// --------------------------------------------------------------
// Fixes, 09/24/2026
// --------------------------------------------------------------

describe('too many shapes: refused before converting (fix)', () => {
	const placement = { x: 10, y: 700, scale: 2 };

	it('a speck explosion rejects in plain words and never reaches the converter', async () => {
		svgShapeStats.mockReturnValueOnce({ shapes: 44514, points: 172451 });
		const record = await settle(autoTraceImageData(ringImage, { despeckle: false }, placement));
		expect(record.error).toMatchObject({ code: 'too-many' });
		expect(record.error.stale).toBeUndefined();
		expect(record.error.message).toBe(
			'This trace has 44,514 shapes and 172,451 points, too many to edit. Lower Detail, ' +
				'raise Smoothing, or turn on Remove specks.'
		);
		expect(potraceSvgToShapes).not.toHaveBeenCalled();
	});

	it('names only the remedies that help', async () => {
		svgShapeStats.mockReturnValueOnce({ shapes: MAX_TRACE_SHAPES + 1, points: 900 });
		const shapes = await settle(autoTraceImageData(ringImage, {}, placement));
		expect(shapes.error.message).toBe(
			'This trace has 501 shapes and 900 points, too many to edit. Lower Detail.'
		);
		svgShapeStats.mockReturnValueOnce({ shapes: 12, points: MAX_TRACE_POINTS + 1 });
		const points = await settle(autoTraceImageData(ringImage, {}, placement));
		expect(points.error.message).toBe(
			'This trace has 12 shapes and 30,001 points, too many to edit. Lower Detail or raise ' +
				'Smoothing.'
		);
	});

	it('right at the limits it converts as usual', async () => {
		expect([MAX_TRACE_SHAPES, MAX_TRACE_POINTS]).toEqual([500, 30000]);
		svgShapeStats.mockReturnValueOnce({ shapes: 500, points: 30000 });
		const result = await autoTraceImageData(ringImage, {}, placement);
		expect(result.shapes).toHaveLength(2);
		expect(svgShapeStats).toHaveBeenCalledWith('<svg w="80" h="60"/>');
	});
});

describe('the full-size apply matched to its preview (fix)', () => {
	const blob = { size: 10, slice() {} };
	const trace = { asset: 'img-abcdefgh', width: 2400, height: 1600, x: -100, y: 900, scale: 0.5 };
	const font = { upm: 1000, ascent: 700, descent: -300 };
	const item = { advanceWidth: 600, anyink: { trace } };
	const editor = () => ({
		assets: { get: (id) => (id === trace.asset ? { id, blob } : undefined) },
		project: { settings: { font } },
	});
	const wide = { x: 0, y: 0, width: 2400, height: 800 };
	/** Hairlines: 1 px dark lines every 6 px, which the preview's shrink turns gray. */
	const hairlines = makeImage(2400, 800, (x, y) => (x % 6 === 0 && y > 100 && y < 700 ? 10 : 240));

	beforeEach(() => {
		regionForGlyph.mockReturnValue(wide);
		readTracePixels.mockImplementation(async () => ({
			imageData: hairlines,
			rect: wide,
			ratio: 1,
		}));
	});

	it('the speck filter never drops below one preview pixel, at either size', async () => {
		await autoTraceTrace({ editor: editor(), item, options: { detail: 1 }, preview: true });
		await autoTraceTrace({ editor: editor(), item, options: { detail: 1 } });
		const [preview, full] = posted().map((p) => p.message);
		expect(preview.options.turdsize).toBe(1);
		expect(full.options.turdsize).toBe(5); // 2.4 x 2.4 = 5.76 full-size pixels
		// ...and the placement tells the converter both scales
		expect(potraceSvgToShapes.mock.calls[1][1]).toMatchObject({ scale: 0.5, previewScale: 1.2 });
	});

	it('Apply sends matching preview pixels and its Detail speck filter; a cache miss delegates shrinking', async () => {
		const crop = { x: 0, y: 0, width: 1100, height: 48 };
		regionForGlyph.mockReturnValue(crop);
		readTracePixels.mockImplementation(async () => ({
			imageData: makeImage(1100, 48, (x, y) => (x > 100 && x < 800 && y > 8 && y < 40 ? 20 : 230)),
			rect: crop,
			ratio: 1,
		}));
		const options = { detail: 0.9, despeckle: false };
		await autoTraceTrace({ editor: editor(), item, options, preview: true });
		await autoTraceTrace({ editor: editor(), item, options });
		const [preview, full] = posted();
		const follow = full.message.preprocessing.followPreview;
		expect(follow.factor).toBe(1000 / 1100);
		expect(follow.speckArea).toBe(preview.message.options.turdsize);
		expect(follow.imageData.data.every((value, i) => value === preview.raw[i])).toBe(true);
		expect(follow.imageData.data).not.toBe(preview.raw);
		const mask = full.message.data.slice();
		// Apply clears the cache. The next apply recreates the exact preview in the worker.
		await autoTraceTrace({ editor: editor(), item, options });
		expect(posted().at(-1).message.preprocessing.followPreview.imageData).toBeUndefined();
		expect(
			posted()
				.at(-1)
				.message.data.every((value, i) => value === mask[i])
		).toBe(true);
	});

	it('Auto is the value the preview showed on the slider', async () => {
		const shown = await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		const applied = await autoTraceTrace({ editor: editor(), item, options: {} });
		// The two sizes disagree on their own...
		const small = downscaleImageData(hairlines, PREVIEW_MAX_SIDE).imageData;
		expect(autoSplit(hairlines, {}).threshold).not.toBe(autoSplit(small, {}).threshold);
		// ...but the apply uses the preview's
		expect(shown.autoThreshold).toBe(autoSplit(small, {}).threshold);
		expect(applied.autoThreshold).toBe(shown.autoThreshold);
		expect(applied.threshold).toBe(shown.threshold);
		// Also without a preview first
		clearAutoTraceCache();
		const alone = await autoTraceTrace({ editor: editor(), item, options: {} });
		expect(alone.autoThreshold).toBe(shown.autoThreshold);
	});
});

describe('shapes the glyph box rule drops (fix)', () => {
	const blob = { size: 10, slice() {} };
	const trace = { asset: 'img-abcdefgh', width: 2400, height: 1600, x: -100, y: 900, scale: 0.5 };
	const font = { upm: 1000, ascent: 700, descent: -300 };
	const item = { advanceWidth: 600, anyink: { trace } };
	const region = { x: 200, y: 400, width: 1200, height: 800 };
	const editor = () => ({
		assets: { get: (id) => (id === trace.asset ? { id, blob } : undefined) },
		project: { settings: { font } },
	});
	const square = (rect) =>
		makeImage(rect.width, rect.height, (x, y) =>
			x > rect.width / 3 &&
			x < (2 * rect.width) / 3 &&
			y > rect.height / 3 &&
			y < (2 * rect.height) / 3
				? 0
				: 245
		);

	beforeEach(() => {
		regionForGlyph.mockReturnValue(region);
		readTracePixels.mockImplementation(async (b, rect) => ({
			imageData: square(rect),
			rect: { ...rect },
			ratio: 1,
		}));
	});

	it('when it drops every shape, it says how many lie outside and what to do', async () => {
		keepShapesInGlyphBox.mockImplementationOnce(() => []);
		const record = await settle(autoTraceTrace({ editor: editor(), item, options: {} }));
		expect(record.error).toMatchObject({ code: 'shapes-outside-box' });
		expect(record.error.message).toBe(
			'2 shapes lie outside the glyph box. Move the image over the glyph, or turn off ' +
				'"Only inside the glyph box".'
		);
		potraceSvgToShapes.mockImplementationOnce(() => [{ pathPoints: [{}, {}] }]);
		keepShapesInGlyphBox.mockImplementationOnce(() => []);
		const one = await settle(
			autoTraceTrace({ editor: editor(), item, options: {}, preview: true })
		);
		expect(one.error.message).toMatch(/^1 shape lies outside the glyph box\./);
	});

	it('counts the shapes it drops, and 0 with the box rule off', async () => {
		keepShapesInGlyphBox.mockImplementationOnce((shapes) => shapes.slice(1));
		const some = await autoTraceTrace({ editor: editor(), item, options: {} });
		expect(some).toMatchObject({ dropped: 1, points: 2 });
		const off = await autoTraceTrace({ editor: editor(), item, options: { insideBoxOnly: false } });
		expect(off.dropped).toBe(0);
	});

	it('hands the rule the traced area in font units, less two traced pixels', async () => {
		await autoTraceTrace({ editor: editor(), item, options: {} });
		const [, , , area] = keepShapesInGlyphBox.mock.calls[0];
		// Region x 200..1400, y 400..1200 at 0.5 fu per pixel from (-100, 900); 2 px = 1 fu
		expect(area.crop.xMin).toBeCloseTo(1, 9);
		expect(area.crop.xMax).toBeCloseTo(599, 9);
		expect(area.crop.yMax).toBeCloseTo(699, 9);
		expect(area.crop.yMin).toBeCloseTo(301, 9);
	});
});

describe('the kept preview pixels are let go (fix)', () => {
	const blob = { size: 10, slice() {} };
	const trace = { asset: 'img-abcdefgh', width: 2400, height: 1600, x: -100, y: 900, scale: 0.5 };
	const font = { upm: 1000, ascent: 700, descent: -300 };
	const item = { advanceWidth: 600, anyink: { trace } };
	const region = { x: 200, y: 400, width: 1200, height: 800 };
	const editor = () => ({
		assets: { get: (id) => (id === trace.asset ? { id, blob } : undefined) },
		project: { settings: { font } },
	});

	beforeEach(() => {
		regionForGlyph.mockReturnValue(region);
		readTracePixels.mockImplementation(async (b, rect) => ({
			imageData: makeImage(rect.width, rect.height, (x, y) =>
				x > 400 && x < 800 && y > 200 && y < 600 ? 0 : 245
			),
			rect: { ...rect },
			ratio: 1,
		}));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('after a full-size trace (the session ends with it)', async () => {
		await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		expect(readTracePixels).toHaveBeenCalledTimes(1);
		await autoTraceTrace({ editor: editor(), item, options: {} });
		expect(readTracePixels).toHaveBeenCalledTimes(2);
		await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		expect(readTracePixels).toHaveBeenCalledTimes(3);
	});

	it('after a minute unused', async () => {
		vi.useFakeTimers();
		const first = autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		await vi.advanceTimersByTimeAsync(10);
		await first;
		expect(KEPT_IDLE_MS).toBe(60000);
		await vi.advanceTimersByTimeAsync(KEPT_IDLE_MS - 1000);
		const second = autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		await vi.advanceTimersByTimeAsync(10);
		await second;
		expect(readTracePixels).toHaveBeenCalledTimes(1); // still kept: in use
		await vi.advanceTimersByTimeAsync(KEPT_IDLE_MS + 1);
		const third = autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		await vi.advanceTimersByTimeAsync(10);
		await third;
		expect(readTracePixels).toHaveBeenCalledTimes(2);
	});
});

// --------------------------------------------------------------
// Finalize, 09/24/2026
// --------------------------------------------------------------

describe('finalize: size caps, refusal advice, traced area', () => {
	const blob = { size: 10, slice() {} };
	const trace = { asset: 'img-abcdefgh', width: 2400, height: 1600, x: -100, y: 900, scale: 0.5 };
	const font = { upm: 1000, ascent: 700, descent: -300 };
	const item = { advanceWidth: 600, anyink: { trace } };
	const region = { x: 200, y: 400, width: 1200, height: 800 };
	const editor = () => ({
		assets: { get: (id) => (id === trace.asset ? { id, blob } : undefined) },
		project: { settings: { font } },
	});
	/** A dark square on paper that is lighter on the left than on the right (a photo). */
	const unevenSquare = (rect) =>
		makeImage(rect.width, rect.height, (x, y) =>
			x > rect.width / 3 &&
			x < (2 * rect.width) / 3 &&
			y > rect.height / 3 &&
			y < (2 * rect.height) / 3
				? 20
				: 245 - Math.round((70 * x) / rect.width)
		);

	beforeEach(() => {
		regionForGlyph.mockReturnValue(region);
		readTracePixels.mockImplementation(async (b, rect) => ({
			imageData: unevenSquare(rect),
			rect: { ...rect },
			ratio: 1,
		}));
	});

	it('a textured letter whose preview passed is applied, not refused (8,560 points)', async () => {
		expect([APPLY_MAX_SHAPES, APPLY_MAX_POINTS]).toEqual([2000, 60000]);
		svgShapeStats.mockReturnValueOnce({ shapes: 60, points: 4701 });
		const shown = await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		expect(shown.shapes).toHaveLength(2);
		svgShapeStats.mockReturnValueOnce({ shapes: 61, points: 8560 });
		const applied = await autoTraceTrace({ editor: editor(), item, options: {} });
		expect(applied.shapes).toHaveLength(2);
	});

	it('the full-size pass refuses only past its own, looser caps; a preview past its caps is refused', async () => {
		svgShapeStats.mockReturnValueOnce({ shapes: 900, points: 40000 });
		const full = await autoTraceTrace({ editor: editor(), item, options: {} });
		expect(full.shapes).toHaveLength(2);
		svgShapeStats.mockReturnValueOnce({ shapes: 2001, points: 9000 });
		const tooMany = await settle(autoTraceTrace({ editor: editor(), item, options: {} }));
		expect(tooMany.error).toMatchObject({ code: 'too-many' });
		svgShapeStats.mockReturnValueOnce({ shapes: 501, points: 900 });
		const preview = await settle(
			autoTraceTrace({ editor: editor(), item, options: {}, preview: true })
		);
		expect(preview.error).toMatchObject({ code: 'too-many' });
	});

	it('names only the sliders that can still move, and says so when none can', () => {
		const at = (options) => normalizeOptions(options);
		expect(tooManyMessage({ shapes: 600, points: 900 }, at({ detail: 0 }))).toBe(
			'This trace has 600 shapes and 900 points, too many to edit. Use a cleaner image, or ' +
				'crop it closer.'
		);
		expect(tooManyMessage({ shapes: 12, points: 31000 }, at({ detail: 0.4, smoothing: 1 }))).toBe(
			'This trace has 12 shapes and 31,000 points, too many to edit. Lower Detail.'
		);
		expect(tooManyMessage({ shapes: 12, points: 31000 }, at({ detail: 0, smoothing: 0.5 }))).toBe(
			'This trace has 12 shapes and 31,000 points, too many to edit. Raise Smoothing.'
		);
		expect(tooManyMessage({ shapes: 900, points: 900 }, at({ detail: 0, despeckle: false }))).toBe(
			'This trace has 900 shapes and 900 points, too many to edit. Turn on Remove specks.'
		);
	});

	it('the result carries the traced area in font units, with the sides the box rule cut', async () => {
		const result = await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		// Region x 200..1400, y 400..1200 at 0.5 fu per pixel from (-100, 900)
		expect(result.area).toMatchObject({ xMin: 0, xMax: 600, yMin: 300, yMax: 700 });
		expect(result.area.pixel).toBeCloseTo(0.5 * (1200 / PREVIEW_MAX_SIDE), 9);
		expect(result.area.cut).toEqual({ left: true, right: true, top: true, bottom: true });
		// The whole image: no side is a cut
		regionForGlyph.mockReturnValue({ x: 0, y: 0, width: 2400, height: 1600 });
		const whole = await autoTraceTrace({
			editor: editor(),
			item,
			options: { insideBoxOnly: false },
			preview: true,
		});
		expect(whole.area.cut).toEqual({ left: false, right: false, top: false, bottom: false });
		expect(whole.area).toMatchObject({ xMin: -100, xMax: 1100, yMin: 100, yMax: 900 });
	});

	it('the preview says how uneven the paper is (a clean scan is near 0)', async () => {
		const uneven = await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		expect(uneven.paperSpread).toBeGreaterThanOrEqual(24);
		clearAutoTraceCache();
		readTracePixels.mockImplementation(async (b, rect) => ({
			imageData: makeImage(rect.width, rect.height, (x, y) =>
				x > rect.width / 3 &&
				x < (2 * rect.width) / 3 &&
				y > rect.height / 3 &&
				y < (2 * rect.height) / 3
					? 20
					: 245
			),
			rect: { ...rect },
			ratio: 1,
		}));
		const even = await autoTraceTrace({ editor: editor(), item, options: {}, preview: true });
		expect(even.paperSpread).toBeLessThan(5);
	});
});
