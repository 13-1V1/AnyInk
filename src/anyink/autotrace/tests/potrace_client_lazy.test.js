// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8: the potrace client creates its worker lazily. Importing
// src/anyink/autotrace/potrace_client.js (or the facade that imports it) must never
// construct a Worker, and the first trace constructs exactly one module worker from
// potrace.worker.js (the pattern Vite bundles). A stub Worker class stands in for the real
// one, so esm-potrace-wasm is never loaded (it crashes in Node).
import { afterEach, describe, expect, it, vi } from 'vitest';

class StubWorker {
	static created = [];
	constructor(url, options) {
		this.url = url;
		this.options = options;
		this.posted = [];
		StubWorker.created.push(this);
	}
	postMessage(message, transfer) {
		this.posted.push({ message, transfer });
	}
	terminate() {
		this.terminated = true;
	}
}

afterEach(async () => {
	const client = await import('../potrace_client.js');
	client.terminateAutoTraceWorker();
	vi.unstubAllGlobals();
	StubWorker.created = [];
});

describe('lazy worker creation', () => {
	it('importing the client and the facade constructs no Worker', async () => {
		vi.stubGlobal('Worker', StubWorker);
		vi.resetModules();
		const client = await import('../potrace_client.js');
		await import('../autotrace.js');
		expect(StubWorker.created.length).toBe(0);
		expect(client.isAutoTraceAvailable()).toBe(true);
	});

	it('the first trace constructs one module worker from potrace.worker.js', async () => {
		vi.stubGlobal('Worker', StubWorker);
		vi.resetModules();
		const client = await import('../potrace_client.js');
		const image = { data: new Uint8ClampedArray(2 * 2 * 4).fill(255), width: 2, height: 2 };
		client.traceImageData(image, { turdsize: 2 }).catch(() => {});
		client.traceImageData(image, { turdsize: 3 }).catch(() => {});

		expect(StubWorker.created.length).toBe(1);
		const [worker] = StubWorker.created;
		// Vite's worker transform may add a query (?worker_file&type=module); the path counts
		expect(new URL(String(worker.url)).pathname).toMatch(
			/\/anyink\/autotrace\/potrace\.worker\.js$/
		);
		expect(worker.options).toEqual({ type: 'module' });
		// One message in flight; its pixel buffer is in the transfer list
		expect(worker.posted.length).toBe(1);
		const [{ message, transfer }] = worker.posted;
		expect(transfer).toEqual([message.data.buffer]);
	});
});
