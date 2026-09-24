// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8 fix (09/24/2026): the potrace worker's message handling
// (src/anyink/autotrace/potrace_worker_core.js), driven with a fake worker scope and fake
// init / potrace functions, since the real worker imports esm-potrace-wasm, which cannot
// load in Node. Covers a good trace (init once, option fixes), and the hang found in Chrome:
// a WASM start that fails (an unhandled rejection inside the worker; init() then never
// settles) or never finishes now replies in plain words instead of leaving every trace
// waiting forever.
import {
	autoSplit,
	binarize,
	binarizeFollowingPreview,
	downscaleImageData,
	maskToImageData,
} from '../binarize.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	EMPTY_IMAGE_MESSAGE,
	INIT_FAILED_MESSAGE,
	INIT_TIMEOUT_MS,
	installPotraceWorker,
} from '../potrace_worker_core.js';

class FakeScope {
	constructor() {
		this.listeners = {};
		this.posted = [];
		this.onmessage = null;
	}
	addEventListener(type, fn) {
		(this.listeners[type] ||= []).push(fn);
	}
	dispatch(type, event) {
		for (const fn of this.listeners[type] || []) fn(event);
	}
	postMessage(message) {
		this.posted.push(message);
	}
	/** Sends a message the way the client does and waits for the handler to finish. */
	send(data) {
		return this.onmessage({ data });
	}
}

const pixels = (width = 2, height = 2) => ({
	data: new Uint8ClampedArray(width * height * 4).fill(255),
	width,
	height,
});

/** Lets pending promise reactions run. */
async function flush() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

afterEach(() => {
	vi.useRealTimers();
});

describe('potrace worker core', () => {
	it('traces once the WASM is ready, init runs once, options fixed for potrace', async () => {
		const scope = new FakeScope();
		const init = vi.fn(async () => {});
		const potrace = vi.fn(async () => '<svg/>');
		installPotraceWorker(scope, { init, potrace });
		await scope.send({ id: 1, ...pixels(), options: { turnpolicy: 'minority', pathonly: true } });
		await scope.send({ id: 2, ...pixels(), options: { extractcolors: true } });
		expect(init).toHaveBeenCalledTimes(1);
		expect(scope.posted).toEqual([
			{ id: 1, svg: '<svg/>' },
			{ id: 2, svg: '<svg/>' },
		]);
		const [image, options] = potrace.mock.calls[0];
		expect([image.width, image.height]).toEqual([2, 2]);
		expect(options).toEqual({ turnpolicy: 4, pathonly: false, extractcolors: false });
		expect(potrace.mock.calls[1][1]).toMatchObject({ pathonly: false, extractcolors: false });
	});

	it('an empty image replies in plain words', async () => {
		const scope = new FakeScope();
		installPotraceWorker(scope, { init: async () => {}, potrace: async () => '' });
		await scope.send({ id: 7, data: new Uint8ClampedArray(3), width: 2, height: 2 });
		expect(scope.posted).toEqual([{ id: 7, error: EMPTY_IMAGE_MESSAGE }]);
	});

	it('a WASM start that fails replies at once, and so does every later message', async () => {
		// esm-potrace-wasm compiles its WASM on import; a failure there is a rejection nobody
		// handles, and its init() never settles
		const scope = new FakeScope();
		const potrace = vi.fn();
		installPotraceWorker(scope, { init: () => new Promise(() => {}), potrace });
		const first = scope.send({ id: 1, ...pixels() });
		await flush();
		expect(scope.posted).toEqual([]);
		scope.dispatch('unhandledrejection', { reason: new Error('CompileError: out of memory') });
		await first;
		expect(scope.posted).toEqual([{ id: 1, error: INIT_FAILED_MESSAGE }]);
		await scope.send({ id: 2, ...pixels() });
		expect(scope.posted[1]).toEqual({ id: 2, error: INIT_FAILED_MESSAGE });
		expect(potrace).not.toHaveBeenCalled();
	});

	it('a failure seen before the first message fails that message at once', async () => {
		const scope = new FakeScope();
		installPotraceWorker(scope, { init: () => new Promise(() => {}), potrace: vi.fn() });
		scope.dispatch('unhandledrejection', { reason: 'no wasm-unsafe-eval' });
		await scope.send({ id: 3, ...pixels() });
		expect(scope.posted).toEqual([{ id: 3, error: INIT_FAILED_MESSAGE }]);
	});

	it('a start that never finishes replies in plain words after INIT_TIMEOUT_MS', async () => {
		vi.useFakeTimers();
		const scope = new FakeScope();
		const init = vi.fn(() => new Promise(() => {}));
		installPotraceWorker(scope, { init, potrace: vi.fn() });
		const pending = scope.send({ id: 4, ...pixels() });
		expect(INIT_TIMEOUT_MS).toBe(10000);
		await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS - 1);
		expect(scope.posted).toEqual([]);
		await vi.advanceTimersByTimeAsync(1);
		await pending;
		expect(scope.posted).toEqual([{ id: 4, error: INIT_FAILED_MESSAGE }]);
		// A later message tries the start again (the client drops this worker anyway)
		const again = scope.send({ id: 5, ...pixels() });
		await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS);
		await again;
		expect(init).toHaveBeenCalledTimes(2);
		expect(scope.posted[1]).toEqual({ id: 5, error: INIT_FAILED_MESSAGE });
	});

	it('an init that rejects replies in plain words', async () => {
		const scope = new FakeScope();
		installPotraceWorker(scope, {
			init: async () => {
				throw new Error('Aborted(RangeError)');
			},
			potrace: vi.fn(),
		});
		await scope.send({ id: 6, ...pixels() });
		expect(scope.posted).toEqual([{ id: 6, error: INIT_FAILED_MESSAGE }]);
	});

	it('an unhandled rejection after a good start is not a start-up failure', async () => {
		const scope = new FakeScope();
		installPotraceWorker(scope, { init: async () => {}, potrace: async () => '<svg/>' });
		await scope.send({ id: 1, ...pixels() });
		scope.dispatch('unhandledrejection', { reason: new Error('something else') });
		await scope.send({ id: 2, ...pixels() });
		expect(scope.posted).toEqual([
			{ id: 1, svg: '<svg/>' },
			{ id: 2, svg: '<svg/>' },
		]);
	});

	it('a potrace failure replies with its own words', async () => {
		const scope = new FakeScope();
		installPotraceWorker(scope, {
			init: async () => {},
			potrace: async () => {
				throw new Error('memory access out of bounds');
			},
		});
		await scope.send({ id: 8, ...pixels() });
		expect(scope.posted).toEqual([{ id: 8, error: 'memory access out of bounds' }]);
	});
});

// Compare the worker boundary to the existing pure pipeline, including apply's split.
describe('raw image conditioning in the worker', () => {
	it.each(['scan', 'photo'])(
		'%s preserves pixels and thresholds at preview and apply scales',
		async (mode) => {
			const image = pixels(48, 32);
			for (let y = 0; y < image.height; y++) {
				for (let x = 0; x < image.width; x++) {
					const p = (y * image.width + x) * 4;
					const v = x > 12 && x < 32 && y > 6 && y < 26 ? 20 : 160 + x;
					image.data[p] = image.data[p + 1] = image.data[p + 2] = v;
				}
			}
			const original = image.data.slice();
			for (const invert of [false, true]) {
				for (const previewPixel of [1, 2]) {
					const options = { mode, invert, despeckle: true, threshold: 'auto' };
					const control = { previewPixel, split: autoSplit(image, options) };
					const expected = binarize(image, options, control);
					const scope = new FakeScope();
					const potrace = vi.fn(async () => '<svg/>');
					installPotraceWorker(scope, { init: async () => {}, potrace });
					await scope.send({ id: 1, ...image, preprocessing: { options, control } });
					expect(potrace.mock.calls[0][0]).toEqual(maskToImageData(expected.mask, 48, 32));
					expect(scope.posted[0]).toMatchObject({
						id: 1,
						svg: '<svg/>',
						threshold: expected.threshold,
						autoThreshold: expected.autoThreshold,
					});
					expect(scope.posted[0].binarizeMs).toBeGreaterThanOrEqual(0);
				}
			}
			expect(image.data).toEqual(original);
		}
	);

	it('blank raw pixels return threshold metadata without initializing or tracing WASM', async () => {
		const scope = new FakeScope();
		const init = vi.fn();
		const potrace = vi.fn();
		installPotraceWorker(scope, { init, potrace });
		await scope.send({ id: 9, ...pixels(), preprocessing: { options: {} } });
		expect(scope.posted[0]).toMatchObject({ id: 9, svg: '', threshold: 128, autoThreshold: 128 });
		expect(init).not.toHaveBeenCalled();
		expect(potrace).not.toHaveBeenCalled();
	});
});

// A small noisy image makes the old threshold-only apply differ from the preview follower.
function noisyPixels() {
	const image = pixels(66, 48);
	let seed = 17;
	for (let y = 0; y < image.height; y++) {
		for (let x = 0; x < image.width; x++) {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			const p = (y * image.width + x) * 4;
			const v = (x > 20 && x < 40 && y > 8 && y < 40) || seed % 13 === 0 ? 20 : 230;
			image.data[p] = image.data[p + 1] = image.data[p + 2] = v;
		}
	}
	return image;
}

describe('Apply follows the actual preview mask in the worker', () => {
	it.each(['scan', 'photo'])(
		'%s matches the helper with cached or recreated previews',
		async (mode) => {
			const image = noisyPixels();
			const { imageData: preview, factor } = downscaleImageData(image, 50);
			for (const despeckle of [false, true]) {
				for (const invert of [false, true]) {
					const options = { mode, despeckle, invert };
					const expected = binarizeFollowingPreview(image, preview, options, {
						factor,
						speckArea: 2,
					});
					if (!invert) {
						const old = binarize(image, options, {
							previewPixel: 1 / factor,
							split: expected.split,
						});
						expect(expected.mask).not.toEqual(old.mask);
					}
					for (const cached of [false, true]) {
						const scope = new FakeScope();
						const potrace = vi.fn(async () => '<svg/>');
						installPotraceWorker(scope, { init: async () => {}, potrace });
						await scope.send({
							id: 1,
							...image,
							preprocessing: {
								options,
								followPreview: {
									factor,
									maxSide: 50,
									speckArea: 2,
									imageData: cached ? preview : undefined,
								},
							},
						});
						expect(scope.posted[0]).toMatchObject({
							svg: '<svg/>',
							threshold: expected.threshold,
							autoThreshold: expected.autoThreshold,
						});
						expect(potrace.mock.calls[0][0]).toEqual(maskToImageData(expected.mask, 66, 48));
					}
				}
			}
		}
	);

	it('blank followed previews skip WASM and malformed preview buffers fail safely', async () => {
		const scope = new FakeScope();
		const init = vi.fn();
		const potrace = vi.fn();
		installPotraceWorker(scope, { init, potrace });
		const followPreview = { factor: 0.5, maxSide: 4, speckArea: 1 };
		await scope.send({ id: 1, ...pixels(8, 8), preprocessing: { options: {}, followPreview } });
		expect(scope.posted[0]).toMatchObject({ svg: '', threshold: 128 });
		await scope.send({
			id: 2,
			...pixels(8, 8),
			preprocessing: {
				options: {},
				followPreview: {
					...followPreview,
					imageData: { width: 4, height: 4, data: new Uint8ClampedArray(1) },
				},
			},
		});
		expect(scope.posted[1]).toEqual({ id: 2, error: EMPTY_IMAGE_MESSAGE });
		expect(init).not.toHaveBeenCalled();
		expect(potrace).not.toHaveBeenCalled();
	});
});
