// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8: the potrace worker client (src/anyink/autotrace/potrace_client.js) against a
// fake worker (the real one needs a browser: esm-potrace-wasm cannot load in Node).
// Covers the message shape, the copied and transferred pixels, latest-wins with stale
// rejections, one trace at a time with only the newest waiting request kept, error replies
// and worker failures (plain messages, a fresh worker next time), termination, and
// AbortSignal cancels (before sending, while waiting, while running). Fixes (09/24/2026):
// a worker that never answers is stopped by a watchdog, and an idle worker is let go.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ABORTED_MESSAGE,
	REQUEST_TIMEOUT_MS,
	STALE_MESSAGE,
	UNAVAILABLE_MESSAGE,
	WORKER_FAILED_MESSAGE,
	WORKER_IDLE_MS,
	WORKER_TIMEOUT_MESSAGE,
	isAutoTraceAvailable,
	setWorkerFactoryForTests,
	terminateAutoTraceWorker,
	traceImageData,
	traceRawImageData,
} from '../potrace_client.js';

class FakeWorker {
	constructor() {
		this.posted = [];
		this.terminated = false;
	}
	postMessage(message, transfer) {
		this.posted.push({ message, transfer });
	}
	reply(data) {
		this.onmessage?.({ data });
	}
	fail() {
		this.onerror?.({ message: 'boom', preventDefault() {} });
	}
	terminate() {
		this.terminated = true;
	}
}

let workers = [];

function useFakeWorkers() {
	workers = [];
	setWorkerFactoryForTests(() => {
		const worker = new FakeWorker();
		workers.push(worker);
		return worker;
	});
}

function image(width = 4, height = 3, fill = 255) {
	return { data: new Uint8ClampedArray(width * height * 4).fill(fill), width, height };
}

/** Settles a promise into a plain record, so rejections are never unhandled. */
function settle(promise) {
	return promise.then(
		(value) => ({ value }),
		(error) => ({ error })
	);
}

afterEach(() => {
	setWorkerFactoryForTests(null);
	vi.useRealTimers();
});

describe('potrace client', () => {
	it('knows whether this browser can run auto-trace', () => {
		const expected = typeof Worker === 'function' && typeof WebAssembly === 'object';
		expect(isAutoTraceAvailable()).toBe(expected);
	});

	it('rejects in plain words without Web Workers (the real worker, in Node)', async () => {
		setWorkerFactoryForTests(null);
		if (isAutoTraceAvailable()) return;
		await expect(traceImageData(image(), {})).rejects.toThrow(UNAVAILABLE_MESSAGE);
	});

	it('rejects an empty or wrongly sized image', async () => {
		useFakeWorkers();
		await expect(
			traceImageData({ data: new Uint8ClampedArray(4), width: 4, height: 4 })
		).rejects.toThrow('wrong size');
		await expect(traceImageData(null)).rejects.toThrow('wrong size');
		expect(workers.length).toBe(0);
	});

	it('posts a copy of the pixels, transferred, and resolves with the SVG', async () => {
		useFakeWorkers();
		const input = image(4, 3, 7);
		const options = { turdsize: 2, alphamax: 1, turnpolicy: 'minority' };
		const promise = traceImageData(input, options);
		expect(workers.length).toBe(1);
		const [{ message, transfer }] = workers[0].posted;
		expect(message).toMatchObject({ width: 4, height: 3, options });
		expect(message.options).not.toBe(options);
		expect(message.data).toBeInstanceOf(Uint8ClampedArray);
		expect(message.data).not.toBe(input.data);
		expect(message.data.length).toBe(48);
		expect(transfer).toEqual([message.data.buffer]);
		expect(input.data.length).toBe(48);
		expect(input.data[0]).toBe(7);

		workers[0].reply({ id: message.id, svg: '<svg/>' });
		await expect(promise).resolves.toBe('<svg/>');
	});

	it('keeps one worker warm across traces', async () => {
		useFakeWorkers();
		for (let i = 0; i < 3; i++) {
			const promise = traceImageData(image(), {});
			const { message } = workers[0].posted.at(-1);
			workers[0].reply({ id: message.id, svg: `<svg id="${i}"/>` });
			await expect(promise).resolves.toBe(`<svg id="${i}"/>`);
		}
		expect(workers.length).toBe(1);
		expect(workers[0].posted.length).toBe(3);
	});

	it('latest wins: older requests reject as stale, only the newest waiting one is sent', async () => {
		useFakeWorkers();
		const first = settle(traceImageData(image(), { n: 1 }));
		const second = settle(traceImageData(image(), { n: 2 }));
		const third = settle(traceImageData(image(), { n: 3 }));

		// The worker is busy with the first; the second was replaced before it was sent
		expect(workers[0].posted.length).toBe(1);
		for (const record of [await first, await second]) {
			expect(record.error.stale).toBe(true);
			expect(record.error.message).toBe(STALE_MESSAGE);
		}

		// The first reply arrives late and is ignored; then the third is sent
		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg old/>' });
		expect(workers[0].posted.length).toBe(2);
		const sent = workers[0].posted[1].message;
		expect(sent.options).toEqual({ n: 3 });
		workers[0].reply({ id: sent.id, svg: '<svg new/>' });
		expect(await third).toEqual({ value: '<svg new/>' });
	});

	it('an error reply rejects with its plain message and the next trace gets a fresh worker', async () => {
		useFakeWorkers();
		const failed = settle(traceImageData(image(), {}));
		const { message } = workers[0].posted[0];
		workers[0].reply({ id: message.id, error: 'The image to trace is empty or the wrong size.' });
		const record = await failed;
		expect(record.error.message).toBe('The image to trace is empty or the wrong size.');
		expect(record.error.stale).toBeUndefined();
		expect(workers[0].terminated).toBe(true);

		const next = traceImageData(image(), {});
		expect(workers.length).toBe(2);
		workers[1].reply({ id: workers[1].posted[0].message.id, svg: '<svg/>' });
		await expect(next).resolves.toBe('<svg/>');
	});

	it('a worker failure rejects in plain words and drops the worker', async () => {
		useFakeWorkers();
		const failed = settle(traceImageData(image(), {}));
		workers[0].fail();
		const record = await failed;
		expect(record.error.message).toBe(WORKER_FAILED_MESSAGE);
		expect(workers[0].terminated).toBe(true);
		// A late reply from the dead worker changes nothing
		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg/>' });
		traceImageData(image(), {}).catch(() => {});
		expect(workers.length).toBe(2);
	});

	it('a worker that cannot be created rejects in plain words', async () => {
		setWorkerFactoryForTests(() => {
			throw new Error('Workers are blocked here.');
		});
		await expect(traceImageData(image(), {})).rejects.toThrow('Workers are blocked here.');
	});

	it('terminating stops the worker and rejects the pending request as stale', async () => {
		useFakeWorkers();
		const pending = settle(traceImageData(image(), {}));
		terminateAutoTraceWorker();
		expect((await pending).error.stale).toBe(true);
		expect(workers[0].terminated).toBe(true);

		const next = traceImageData(image(), {});
		expect(workers.length).toBe(2);
		workers[1].reply({ id: workers[1].posted[0].message.id, svg: '<svg/>' });
		await expect(next).resolves.toBe('<svg/>');
	});
});

describe('potrace client: AbortSignal', () => {
	it('an already aborted signal rejects at once and creates no worker', async () => {
		useFakeWorkers();
		const controller = new AbortController();
		controller.abort();
		const record = await settle(traceImageData(image(), {}, { signal: controller.signal }));
		expect(record.error.message).toBe(ABORTED_MESSAGE);
		expect(record.error.name).toBe('AbortError');
		expect(record.error.stale).toBe(true);
		expect(record.error.aborted).toBe(true);
		expect(workers.length).toBe(0);
	});

	it('aborting a waiting request means it is never sent', async () => {
		useFakeWorkers();
		const busy = settle(traceImageData(image(), { n: 1 }));
		const controller = new AbortController();
		const waiting = settle(traceImageData(image(), { n: 2 }, { signal: controller.signal }));
		expect((await busy).error.stale).toBe(true); // replaced by the second
		controller.abort();
		expect((await waiting).error.aborted).toBe(true);

		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg/>' });
		expect(workers[0].posted.length).toBe(1);
	});

	it('aborting a running request rejects at once; its late reply is ignored', async () => {
		useFakeWorkers();
		const controller = new AbortController();
		const running = settle(traceImageData(image(), {}, { signal: controller.signal }));
		controller.abort();
		expect((await running).error.aborted).toBe(true);

		// The worker is still busy with it, so the next request waits for that reply
		const next = traceImageData(image(), { n: 2 });
		expect(workers[0].posted.length).toBe(1);
		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg old/>' });
		expect(workers[0].posted.length).toBe(2);
		workers[0].reply({ id: workers[0].posted[1].message.id, svg: '<svg new/>' });
		await expect(next).resolves.toBe('<svg new/>');
		expect(workers.length).toBe(1);
	});

	it('aborting after the reply changes nothing', async () => {
		useFakeWorkers();
		const controller = new AbortController();
		const promise = traceImageData(image(), {}, { signal: controller.signal });
		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg/>' });
		await expect(promise).resolves.toBe('<svg/>');
		controller.abort();
		const next = traceImageData(image(), {});
		workers[0].reply({ id: workers[0].posted[1].message.id, svg: '<svg 2/>' });
		await expect(next).resolves.toBe('<svg 2/>');
	});
});

describe('potrace client: a worker that never answers (fix)', () => {
	it('is stopped after REQUEST_TIMEOUT_MS; the trace rejects in plain words; the next gets a fresh worker', async () => {
		// What Chrome showed when the WASM start failed: no reply, no error event, forever
		vi.useFakeTimers();
		useFakeWorkers();
		let record = null;
		settle(traceImageData(image(), {})).then((r) => (record = r));
		expect(REQUEST_TIMEOUT_MS).toBe(30000);
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
		expect(record).toBeNull();
		expect(workers[0].terminated).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(record.error.message).toBe(WORKER_TIMEOUT_MESSAGE);
		expect(record.error.stale).toBeUndefined();
		expect(workers[0].terminated).toBe(true);

		const next = traceImageData(image(), {});
		expect(workers.length).toBe(2);
		workers[1].reply({ id: workers[1].posted[0].message.id, svg: '<svg/>' });
		await expect(next).resolves.toBe('<svg/>');
	});

	it('a newer request waiting behind the stuck one is sent to a fresh worker', async () => {
		vi.useFakeTimers();
		useFakeWorkers();
		const stuck = settle(traceImageData(image(), { n: 1 }));
		const newer = traceImageData(image(), { n: 2 });
		expect((await stuck).error.stale).toBe(true);
		expect(workers[0].posted.length).toBe(1);
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
		expect(workers[0].terminated).toBe(true);
		expect(workers.length).toBe(2);
		const sent = workers[1].posted[0].message;
		expect(sent.options).toEqual({ n: 2 });
		workers[1].reply({ id: sent.id, svg: '<svg n2/>' });
		await expect(newer).resolves.toBe('<svg n2/>');
	});

	it('a reply in time clears the watchdog', async () => {
		vi.useFakeTimers();
		useFakeWorkers();
		const promise = traceImageData(image(), {});
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 10);
		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg/>' });
		await expect(promise).resolves.toBe('<svg/>');
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
		expect(workers[0].terminated).toBe(false);
	});
});

describe('potrace client: an idle worker is let go (fix)', () => {
	it('stops the worker WORKER_IDLE_MS after its last reply; the next trace starts a fresh one', async () => {
		vi.useFakeTimers();
		useFakeWorkers();
		const first = traceImageData(image(), {});
		workers[0].reply({ id: workers[0].posted[0].message.id, svg: '<svg 1/>' });
		await first;
		expect(WORKER_IDLE_MS).toBe(60000);
		await vi.advanceTimersByTimeAsync(WORKER_IDLE_MS - 1000);
		// Used again before the minute is up: the clock starts over at its reply
		const second = traceImageData(image(), {});
		expect(workers.length).toBe(1);
		workers[0].reply({ id: workers[0].posted[1].message.id, svg: '<svg 2/>' });
		await second;
		await vi.advanceTimersByTimeAsync(WORKER_IDLE_MS - 1);
		expect(workers[0].terminated).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(workers[0].terminated).toBe(true);

		const third = traceImageData(image(), {});
		expect(workers.length).toBe(2);
		workers[1].reply({ id: workers[1].posted[0].message.id, svg: '<svg 3/>' });
		await expect(third).resolves.toBe('<svg 3/>');
	});
});

it('copies and transfers both raw and cached preview buffers without detaching the caller', async () => {
	useFakeWorkers();
	const full = image(8, 8);
	const preview = image(4, 4);
	const pending = traceRawImageData(
		full,
		{},
		{
			options: {},
			followPreview: {
				factor: 0.5,
				maxSide: 4,
				imageData: preview,
				speckArea: 1,
			},
		}
	);
	const { message, transfer } = workers[0].posted[0];
	expect(transfer).toEqual([
		message.data.buffer,
		message.preprocessing.followPreview.imageData.data.buffer,
	]);
	const received = structuredClone(message, { transfer });
	expect(full.data.byteLength).toBe(256);
	expect(preview.data.byteLength).toBe(64);
	expect(Array.from(received.preprocessing.followPreview.imageData.data)).toEqual(
		Array.from(preview.data)
	);
	workers[0].reply({ id: message.id, svg: '', threshold: 128, autoThreshold: 128, binarizeMs: 1 });
	expect(await pending).toMatchObject({ svg: '', threshold: 128 });
});
