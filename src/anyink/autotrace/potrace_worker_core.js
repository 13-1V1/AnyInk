// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: what the potrace worker does with each message (Milestone 8 fix,
	09/24/2026). Pure: the WASM's init() and potrace() are handed in, so vitest drives this
	with fakes. potrace.worker.js is the only real caller:
	  installPotraceWorker(self, { init, potrace })   (both from esm-potrace-wasm)

	Message in:  { id, data (Uint8ClampedArray RGBA, transferred), width, height, options,
	  preprocessing?: { options, control: { previewPixel, split },
	    followPreview?: { factor, maxSide, speckArea, imageData? } } }
	Message out: { id, svg } or { id, error: message }; raw requests also return
	  threshold, autoThreshold, and binarizeMs. Blank raw images return svg: ''.

	- Raw requests reuse binarize.js and maskToImageData here, before starting WASM.
	  Legacy requests supply pure black ink on white paper, so potrace's cutoff does not matter. Options pass through with
	  three fixes (wasmOptions): turnpolicy may be a name ('minority') and becomes potrace's
	  number; pathonly is always false and extractcolors always false, so the reply is always
	  one full SVG with potrace's transform group (D-024: one SVG hand-off path).
	- init() runs once; the WASM runtime then stays warm for every later message.

	Start-up that fails (the fix). esm-potrace-wasm compiles its WASM as soon as it is
	imported, and its init() settles only when that finishes. When the compile fails (out
	of memory, or a page policy without 'wasm-unsafe-eval'), the failure is a promise
	rejection nobody handles inside the worker: it never reaches the page's Worker.onerror,
	and init() never settles, so every trace waited forever (seen in Chrome: no reply, no
	error event, only a reload helped). Now:
	- an 'unhandledrejection' in the worker before init() has finished counts as a failed
	  start: the waiting message, and every later one, gets INIT_FAILED_MESSAGE at once;
	- init() that neither finishes nor fails within INIT_TIMEOUT_MS, or that rejects, gets
	  INIT_FAILED_MESSAGE too, and the next message tries the start again.
	The client drops a worker after any error reply, so the next trace starts a new worker,
	which imports (and compiles) the WASM afresh.
*/

import {
	binarize,
	binarizeFollowingPreview,
	downscaleImageData,
	hasInk,
	maskToImageData,
} from './binarize.js';

/** The reply when the WASM runtime cannot start. */
export const INIT_FAILED_MESSAGE = 'Auto-trace could not start in this browser.';

/** The reply for pixels that do not match their size. */
export const EMPTY_IMAGE_MESSAGE = 'The image to trace is empty or the wrong size.';

/** How long init() may take before the message is answered with a failure, in ms. */
export const INIT_TIMEOUT_MS = 10000;

/** potracelib.h POTRACE_TURNPOLICY_* values. */
const TURN_POLICIES = Object.freeze({
	black: 0,
	white: 1,
	left: 2,
	right: 3,
	minority: 4,
	majority: 5,
	random: 6,
});

/**
 * The options potrace gets.
 * @param {Object} [options]
 * @returns {Object}
 */
export function wasmOptions(options = {}) {
	const out = { ...options, pathonly: false, extractcolors: false };
	if (typeof out.turnpolicy === 'string') {
		out.turnpolicy = TURN_POLICIES[out.turnpolicy.toLowerCase()] ?? TURN_POLICIES.minority;
	}
	return out;
}

/**
 * Sets the worker scope's onmessage and its start-up failure watch.
 * @param {Object} scope - the worker's global scope (self): postMessage, addEventListener
 * @param {{init: Function, potrace: Function, initTimeoutMs?: Number}} wasm - from
 *   esm-potrace-wasm: init() -> Promise, potrace(imageData, options) -> Promise<String>
 * @returns {{onMessage: Function}} the handler (also set as scope.onmessage)
 */
export function installPotraceWorker(scope, { init, potrace, initTimeoutMs = INIT_TIMEOUT_MS }) {
	/** The start while it runs, and after it worked; null before, or after a retryable fail. */
	let ready = null;
	/** init() finished. */
	let started = false;
	/** A failed start that no retry can fix (the WASM compile failed). */
	let broken = null;
	/** Ends the start that is running now with a failure. */
	let failRunning = null;

	scope.addEventListener?.('unhandledrejection', (event) => {
		// After a good start this is something else; the trace that caused it replies itself
		if (started) return;
		broken = event?.reason || new Error(INIT_FAILED_MESSAGE);
		failRunning?.(broken);
	});

	function start() {
		if (broken) return Promise.reject(broken);
		if (!ready) {
			ready = new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error('The WASM runtime did not start in time.')),
					initTimeoutMs
				);
				failRunning = (reason) => {
					clearTimeout(timer);
					reject(reason);
				};
				Promise.resolve()
					.then(init)
					.then(
						() => {
							clearTimeout(timer);
							started = true;
							resolve();
						},
						(reason) => {
							clearTimeout(timer);
							reject(reason);
						}
					);
			});
			ready.then(
				() => {
					failRunning = null;
				},
				() => {
					failRunning = null;
					ready = null;
				}
			);
		}
		return ready;
	}

	async function onMessage(event) {
		const { id, data, width, height, options, preprocessing } = event?.data || {};
		try {
			if (!data || !(width > 0) || !(height > 0) || data.length < width * height * 4) {
				throw new Error(EMPTY_IMAGE_MESSAGE);
			}
			let image = { data, width, height };
			let metadata = {};
			if (preprocessing) {
				const before = performance.now();
				const follow = preprocessing.followPreview;
				let result;
				if (follow) {
					if (!(follow.factor > 0 && follow.factor < 1) || !(follow.maxSide > 0)) {
						throw new Error(EMPTY_IMAGE_MESSAGE);
					}
					const preview = follow.imageData || downscaleImageData(image, follow.maxSide).imageData;
					if (
						preview.width !== Math.max(1, Math.ceil(width * follow.factor - 1e-9)) ||
						preview.height !== Math.max(1, Math.ceil(height * follow.factor - 1e-9)) ||
						!preview.data ||
						preview.data.length < preview.width * preview.height * 4
					) {
						throw new Error(EMPTY_IMAGE_MESSAGE);
					}
					result = binarizeFollowingPreview(image, preview, preprocessing.options, follow);
				} else {
					result = binarize(image, preprocessing.options, preprocessing.control);
				}
				const ink = hasInk(result.mask);
				if (ink) image = maskToImageData(result.mask, width, height);
				metadata = {
					threshold: result.threshold,
					autoThreshold: result.autoThreshold,
					paperSpread: result.paperSpread,
					binarizeMs: performance.now() - before,
				};
				if (!ink) {
					scope.postMessage({ id, svg: '', ...metadata });
					return;
				}
			}
			try {
				await start();
			} catch {
				throw new Error(INIT_FAILED_MESSAGE);
			}
			// A plain {data, width, height} object: potrace reads its pixels directly
			const svg = await potrace(image, wasmOptions(options));
			scope.postMessage({ id, svg, ...metadata });
		} catch (error) {
			scope.postMessage({ id, error: String(error?.message || error || 'Tracing failed.') });
		}
	}

	scope.onmessage = onMessage;
	return { onMessage };
}
