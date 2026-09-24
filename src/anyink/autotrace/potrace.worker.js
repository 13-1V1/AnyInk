// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: the potrace module worker (Milestone 8, D-016, D-024).
	Owner: TRACK A (params, binarize, worker, client, facade). Real since the scaffold.

	Created only by potrace_client.js:
	  new Worker(new URL('./potrace.worker.js', import.meta.url), { type: 'module' })
	so Vite emits it (and the inlined WASM) as its own chunk. NEVER import this file or
	esm-potrace-wasm from a module vitest loads: the package's Node branch calls require()
	and crashes in Node ESM (TEST_LOG M6 spike).

	Message in:  { id, data (Uint8ClampedArray RGBA, transferred), width, height, options }
	Message out: { id, svg } or { id, error: message }

	Everything it does is in potrace_worker_core.js (fix, 09/24/2026), which vitest can load:
	the options potrace gets, init() once, and the answer when the WASM cannot start (a
	failed compile used to leave every trace waiting forever). This file only hands it the
	real WASM functions. The package starts compiling on import, but a failure there reaches
	the worker as an unhandled rejection only after this module has run, so the core's
	listener is always in place.
*/
import { init, potrace } from 'esm-potrace-wasm';
import { installPotraceWorker } from './potrace_worker_core.js';

installPotraceWorker(self, { init, potrace });
