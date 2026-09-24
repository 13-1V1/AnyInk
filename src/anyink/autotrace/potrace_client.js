// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: the main-thread side of the potrace worker (Milestone 8).
	Owner: TRACK A (params, binarize, worker, client, facade). Minimal but real since the
	scaffold (the smoke test needed it); track A may refine it within the contract.

	- isAutoTraceAvailable() -> Boolean: Worker and WebAssembly exist.
	- traceImageData(imageDataLike, potraceOptions, { signal } = {}) -> Promise<String svg>.
	  The pixels are copied, and the copy is transferred to the worker, so the caller's
	  data stays usable.
	  Latest wins: sending a newer request rejects the older promise at once with an Error
	  whose .stale === true (callers ignore stale). The worker runs one trace at a time;
	  while it is busy, only the newest waiting request is kept, so slider drags never pile
	  up a queue. A worker error rejects with a plain message and the worker is dropped, so
	  the next request starts a fresh one (a crashed WASM runtime is never reused).
	  An AbortSignal that fires rejects the request at once as stale too (name
	  'AbortError', .aborted === true): a request still waiting is never sent, and the
	  reply of one already running is ignored (the worker finishes it, then takes the next).
	  Latest-wins is global: callers that trace several images (the handwriting sheet)
	  must await each trace before sending the next.
	- traceRawImageData(imageDataLike, potraceOptions, preprocessing, { signal } = {})
	  -> Promise<{ svg, threshold, autoThreshold, binarizeMs }>. Uses the same queue and
	  ownership rules, but runs conditioning in the worker before WASM tracing.
	- terminateAutoTraceWorker(): stops the worker; a pending request rejects as stale.
	- setWorkerFactoryForTests(fn): fn() returns a Worker-like object ({postMessage,
	  terminate, onmessage, onerror}); null restores the real worker.

	Fixes, 09/24/2026:
	- Watchdog: a request the worker has not answered REQUEST_TIMEOUT_MS after it was sent
	  rejects with WORKER_TIMEOUT_MESSAGE, and the worker is dropped, so a newer request
	  waiting behind it goes to a fresh worker. A failed WASM start used to hang the worker
	  with no reply and no error event; the worker now answers that itself within 10 s
	  (potrace_worker_core.js), and the watchdog covers anything else (a worker the browser
	  kills silently, a runaway trace). A real full-size trace takes well under a second.
	- Idle: WORKER_IDLE_MS after its last reply with nothing waiting, the worker is stopped.
	  Its WASM heap grows to the largest image traced (a full RGBA copy: 16 MB for 2000 x
	  2000) and never shrinks. Kept warm between slider moves and the next glyph (a cold
	  start is about 0.4 s), let go after a minute unused.

	The worker is created lazily, only inside defaultWorkerFactory, so importing this file
	never loads esm-potrace-wasm (vitest runs in Node, where that package crashes).
*/

/** The message for a browser without Web Workers or WebAssembly. */
export const UNAVAILABLE_MESSAGE =
	'Auto-trace needs a browser with Web Workers and WebAssembly. Use Chrome or Edge.';

/** The message of a stale rejection (a newer request replaced it; callers ignore it). */
export const STALE_MESSAGE = 'A newer auto-trace request replaced this one.';

/** The message of an aborted request (its AbortSignal fired; callers ignore it). */
export const ABORTED_MESSAGE = 'This auto-trace request was cancelled.';

/** The message when the worker itself fails (script load, crash). */
export const WORKER_FAILED_MESSAGE = 'Auto-trace stopped unexpectedly. Try again.';

/** The message when the worker does not answer in time. */
export const WORKER_TIMEOUT_MESSAGE = 'Auto-trace took too long and was stopped. Try again.';

/** How long a sent request may wait for its answer, in ms. */
export const REQUEST_TIMEOUT_MS = 30000;

/** How long an idle worker is kept, in ms. */
export const WORKER_IDLE_MS = 60000;

function defaultWorkerFactory() {
	return new Worker(new URL('./potrace.worker.js', import.meta.url), { type: 'module' });
}

let workerFactory = defaultWorkerFactory;
let worker = null;
let nextId = 1;
/** Id of the message the worker is running now, or null when it is idle. */
let busyId = null;
/** The newest request: { id, message, resolve, reject, sent }, or null. */
let latest = null;
/** Timer that stops a worker that has not answered the request it runs. */
let watchdog = null;
/** Timer that stops an idle worker. */
let idleTimer = null;

/**
 * True when this browser can run auto-trace.
 * @returns {Boolean}
 */
export function isAutoTraceAvailable() {
	return typeof Worker === 'function' && typeof WebAssembly === 'object' && WebAssembly !== null;
}

/**
 * Traces a black-on-white image with potrace in the worker.
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageDataLike
 * @param {Object} potraceOptions - from toPotraceOptions (params.js)
 * @param {{signal?: AbortSignal}} [control] - aborting rejects at once as stale
 * @returns {Promise<String>} potrace's SVG (full document, transform group kept)
 */
export function traceImageData(imageDataLike, potraceOptions = {}, { signal } = {}) {
	return requestTrace(imageDataLike, potraceOptions, { signal });
}

/** Condition raw pixels in the same latest-wins worker queue; caller pixels stay usable. */
export function traceRawImageData(imageDataLike, potraceOptions, preprocessing, { signal } = {}) {
	return requestTrace(imageDataLike, potraceOptions, { signal, preprocessing });
}

function requestTrace(imageDataLike, potraceOptions = {}, { signal, preprocessing } = {}) {
	if (workerFactory === defaultWorkerFactory && !isAutoTraceAvailable()) {
		return Promise.reject(new Error(UNAVAILABLE_MESSAGE));
	}
	const width = Math.round(Number(imageDataLike?.width));
	const height = Math.round(Number(imageDataLike?.height));
	const source = imageDataLike?.data;
	if (!(width > 0) || !(height > 0) || !source || source.length < width * height * 4) {
		return Promise.reject(new Error('The image to trace is empty or the wrong size.'));
	}
	if (signal?.aborted) return Promise.reject(abortError());

	if (latest) {
		rejectStale(latest);
		latest = null;
	}

	return new Promise((resolve, reject) => {
		const data = new Uint8ClampedArray(source.subarray(0, width * height * 4));
		// Never transfer the retained preview buffer itself, or slider reuse loses its pixels.
		let prepared = preprocessing;
		const preview = preprocessing?.followPreview?.imageData;
		if (preview) {
			prepared = {
				...preprocessing,
				followPreview: {
					...preprocessing.followPreview,
					imageData: { ...preview, data: new Uint8ClampedArray(preview.data) },
				},
			};
		}
		const id = nextId++;
		let onAbort = null;
		const settle = (fn) => (value) => {
			if (onAbort) signal.removeEventListener('abort', onAbort);
			fn(value);
		};
		const request = {
			id,
			message: { id, data, width, height, options: { ...potraceOptions }, preprocessing: prepared },
			resolve: settle(resolve),
			reject: settle(reject),
			sent: false,
		};
		if (signal) {
			onAbort = () => {
				// Only the request still in flight can be aborted; a settled one is gone
				if (latest !== request) return;
				latest = null;
				request.reject(abortError());
				pump();
			};
			signal.addEventListener('abort', onAbort, { once: true });
		}
		latest = request;
		pump();
	});
}

/** Stops the worker. A request still waiting rejects as stale. */
export function terminateAutoTraceWorker() {
	if (latest) {
		rejectStale(latest);
		latest = null;
	}
	dropWorker();
}

/**
 * Tests: replace the worker with a fake (or null for the real one). Drops any live worker.
 * @param {Function | null} fn - () => Worker-like
 */
export function setWorkerFactoryForTests(fn) {
	terminateAutoTraceWorker();
	workerFactory = typeof fn === 'function' ? fn : defaultWorkerFactory;
}

// --------------------------------------------------------------
// Internals
// --------------------------------------------------------------

function rejectStale(request) {
	request.reject(Object.assign(new Error(STALE_MESSAGE), { stale: true }));
}

function abortError() {
	return Object.assign(new Error(ABORTED_MESSAGE), {
		name: 'AbortError',
		stale: true,
		aborted: true,
	});
}

/** Sends the newest request when the worker is idle. */
function pump() {
	if (!latest || latest.sent || busyId !== null) return;
	let target;
	try {
		target = ensureWorker();
	} catch (error) {
		const request = latest;
		latest = null;
		request.reject(new Error(plainMessage(error)));
		return;
	}
	latest.sent = true;
	busyId = latest.id;
	const { message } = latest;
	stopTimer('idle');
	try {
		const transfer = [message.data.buffer];
		const previewData = message.preprocessing?.followPreview?.imageData?.data;
		if (previewData) transfer.push(previewData.buffer);
		target.postMessage(message, transfer);
	} catch (error) {
		const request = latest;
		latest = null;
		busyId = null;
		dropWorker();
		request.reject(new Error(plainMessage(error)));
		return;
	}
	startWatchdog(message.id);
}

/** Drops the worker when the request it runs has not been answered in time. */
function startWatchdog(id) {
	stopTimer('watchdog');
	watchdog = setTimeout(() => {
		watchdog = null;
		if (busyId !== id) return;
		const request = latest && latest.id === id ? latest : null;
		if (request) latest = null;
		dropWorker();
		if (request) request.reject(new Error(WORKER_TIMEOUT_MESSAGE));
		// A newer request waiting behind the stuck one goes to a fresh worker
		pump();
	}, REQUEST_TIMEOUT_MS);
	unref(watchdog);
}

/** Stops the worker after WORKER_IDLE_MS with nothing sent or waiting. */
function startIdleTimer() {
	stopTimer('idle');
	if (!worker || busyId !== null || latest) return;
	idleTimer = setTimeout(() => {
		idleTimer = null;
		if (busyId === null && !latest) dropWorker();
	}, WORKER_IDLE_MS);
	unref(idleTimer);
}

function stopTimer(which) {
	if (which === 'watchdog' && watchdog !== null) {
		clearTimeout(watchdog);
		watchdog = null;
	}
	if (which === 'idle' && idleTimer !== null) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}
}

/** Node (tests): a timer never holds the process open. */
function unref(timer) {
	timer?.unref?.();
}

function ensureWorker() {
	if (worker) return worker;
	const created = workerFactory();
	created.onmessage = (event) => handleReply(created, event?.data || {});
	created.onerror = (event) => handleWorkerFailure(created, event);
	created.onmessageerror = (event) => handleWorkerFailure(created, event);
	worker = created;
	return worker;
}

function handleReply(from, reply) {
	if (from !== worker) return;
	const { id, svg, error } = reply;
	if (id === busyId) {
		busyId = null;
		stopTimer('watchdog');
	}
	if (latest && latest.id === id) {
		const request = latest;
		latest = null;
		if (typeof error === 'string' || typeof svg !== 'string') {
			request.reject(new Error(error || WORKER_FAILED_MESSAGE));
		} else {
			request.resolve(request.message.preprocessing ? reply : svg);
		}
	}
	// A failed trace may have left the WASM runtime broken: start fresh next time
	if (typeof error === 'string') dropWorker();
	pump();
	startIdleTimer();
}

function handleWorkerFailure(from, event) {
	if (from !== worker) return;
	if (event && typeof event.preventDefault === 'function') event.preventDefault();
	dropWorker();
	if (latest) {
		const request = latest;
		latest = null;
		request.reject(new Error(WORKER_FAILED_MESSAGE));
	}
}

function dropWorker() {
	busyId = null;
	stopTimer('watchdog');
	stopTimer('idle');
	if (!worker) return;
	const old = worker;
	worker = null;
	old.onmessage = null;
	old.onerror = null;
	old.onmessageerror = null;
	try {
		old.terminate();
	} catch {
		// Already gone
	}
}

function plainMessage(error) {
	return String(error?.message || error || WORKER_FAILED_MESSAGE);
}
