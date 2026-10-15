// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: the banned-word scan's tools (UX-BEGINNER.md 2.3), for this B and every later B that adds
	a Simple screen. The rule itself is in ../banned.js; this file runs it inside vitest.

	  scanSimpleScreen(name, build, options)   defines one test. Simple mode is on, the canvas
	      spy and the toast recorder run, then build() makes the screen state; its DOM (visible
	      text, title, aria-label, placeholder, alt, shadow roots, sentence case), every string
	      drawn on a canvas and every toast must say no banned word.
	      build({ canvas, toasts }) returns what to scan:
	        nothing                    document.body
	        an Element / Document      that
	        { root, texts }            root (null: no DOM) and extra strings by where they
	                                   show, e.g. { texts: { 'save status': [...] } }
	      options:
	        pending: 'B4 toast track'  the screen isn't clean yet and that track cleans it: the
	                                   test then checks the hits are still there, so the suite
	                                   stays green until the track lands and turns red the day
	                                   the screen is clean ("delete its pending option"). A
	                                   build() that breaks still fails, pending or not.
	        mode: 'simple'             the mode to scan in ('all' for a shared display point)
	        strict: true               also fail on what 2.4 E and G say is never shown in Simple
	                                   (banned.js NEVER_SHOWN_TERMS: Unicode block and letter
	                                   names, "project", "JSON", error codes like [PF0]); B4 + B5
	                                   fix pass. Default STRICT_BY_DEFAULT (off until every strict
	                                   scan in strict_scan.test.js is clean; then flip it)
	        forbid: ['...']            exact strings that must not show either (a browser's own
	                                   error sentence the build threw: 7.7, B4 + B5 fix pass)
	        timeout                    passed to it()
	      ANYINK_SCAN_ALL=1 runs pending scans as ordinary tests, so their hits print.
	      ANYINK_SCAN_STRICT=1 runs every scan strict, to list what is left.
	  startCanvasSpy()        { texts, stop } - every fillText / strokeText string. Install it
	                          before the canvas gets its context: vi-canvas-mock binds the
	                          prototype's methods when a context is made.
	  startToastRecorder()    { messages, flush, stop } - the text of every toast that reaches the
	                          page (#toast, or any element marked data-anyink-toast), read from
	                          DOM mutations, so it works whoever calls the toast. A quote or pro
	                          word inside a toast reads as "…" (shownText), like scanDom skips it.
	                          Simple's toast module also marks each message it drops for having
	                          no words key (toast/toast.js), so the scan fails on it.
	  scanState({ root, canvas, toasts, texts }, { strict })   -> hits
	  expectNoBanned(hits)    one readable line per hit on failure

	Usage in a later B (e.g. src/anyink/board/tests/board_words.test.js):
	  import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
	  scanSimpleScreen('letter board, new font', async () => {
	    const board = makeBoard(editor);
	    document.body.appendChild(board);
	    return board;
	  });
*/
import { expect, it } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { EXEMPT_SELECTOR, findUppercase, formatHit, scanDom, scanTexts } from '../banned.js';

/** Where toasts show: upstream's #toast; the toast module may mark its own element. */
export const TOAST_SELECTOR = '#toast, [data-anyink-toast]';

const SCAN_ALL = globalThis.process?.env?.ANYINK_SCAN_ALL === '1';

/**
 * B4 + B5 fix pass: strict scans (2.4 E and G) were opt-in until the surfaces other tracks own
 * were clean (words/tests/strict_scan.test.js); B4 + B5 finalize: they are, so every Simple scan
 * is strict.
 */
export const STRICT_BY_DEFAULT = true;
const STRICT_ALL = globalThis.process?.env?.ANYINK_SCAN_STRICT === '1';

// --------------------------------------------------------------
// Recorders
// --------------------------------------------------------------

/**
 * Records every string drawn with fillText / strokeText on any 2D context made after this.
 * @returns {{texts: Array<String>, stop: Function}}
 */
export function startCanvasSpy() {
	const texts = [];
	const restore = [];
	let recording = true;
	const prototypes = [
		globalThis.CanvasRenderingContext2D?.prototype,
		globalThis.OffscreenCanvasRenderingContext2D?.prototype,
	].filter(Boolean);
	prototypes.forEach((proto) => {
		['fillText', 'strokeText'].forEach((name) => {
			const original = proto[name];
			if (typeof original !== 'function') return;
			restore.push(() => (proto[name] = original));
			proto[name] = function (text, ...rest) {
				if (recording) texts.push(String(text));
				return original.call(this, text, ...rest);
			};
		});
	});
	return {
		texts,
		stop() {
			recording = false;
			restore.forEach((undo) => undo());
		},
	};
}

/**
 * A toast's words as the scan reads them: an exempt part (2.3: a file name in .anyink-quote,
 * a pro word in .anyink-pro-word) stands as "…", so ".otf" in a quoted file name is never a hit.
 * (B4 toast track.)
 * @param {Node} node
 * @returns {String}
 */
export function shownText(node) {
	if (node?.nodeType !== 1) return node?.textContent || '';
	if (node.matches(EXEMPT_SELECTOR)) return '"…"';
	const copy = node.cloneNode(true);
	copy.querySelectorAll(EXEMPT_SELECTOR).forEach((part) => part.replaceWith('"…"'));
	return copy.textContent;
}

/**
 * Records the text of every toast that reaches the page (exempt parts as "…", shownText).
 * @returns {{messages: Array<String>, flush: Function, stop: Function}}
 */
export function startToastRecorder() {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	const messages = [];
	const add = (text) => {
		const value = String(text || '')
			.replace(/\s+/g, ' ')
			.trim();
		if (value && !messages.includes(value)) messages.push(value);
	};
	const isToast = (node) => node?.nodeType === 1 && node.matches(TOAST_SELECTOR);
	const toastAround = (node) => {
		const element = node?.nodeType === 1 ? node : node?.parentElement;
		return element?.closest?.(TOAST_SELECTOR) || null;
	};
	const read = (record) => {
		if (record.type === 'characterData') {
			const toast = toastAround(record.target);
			if (toast) add(shownText(toast));
			return;
		}
		if (toastAround(record.target)) {
			add([...record.addedNodes].map(shownText).join(''));
			return;
		}
		record.addedNodes.forEach((node) => {
			if (node.nodeType !== 1) return;
			if (isToast(node)) add(shownText(node));
			node.querySelectorAll?.(TOAST_SELECTOR).forEach((toast) => add(shownText(toast)));
		});
	};
	const observer = new MutationObserver((records) => records.forEach(read));
	observer.observe(document, { childList: true, subtree: true, characterData: true });
	return {
		messages,
		/** Reads what changed since the last flush (the observer reports later, in a microtask). */
		flush() {
			observer.takeRecords().forEach(read);
			return messages;
		},
		stop() {
			observer.takeRecords().forEach(read);
			observer.disconnect();
		},
	};
}

// --------------------------------------------------------------
// Scanning
// --------------------------------------------------------------

/**
 * Every banned word in one screen state.
 * @param {Object} parts
 * @param {Node | null} [parts.root] - the DOM to read
 * @param {Array<String>} [parts.canvas] - strings drawn on canvases
 * @param {Array<String>} [parts.toasts] - toast messages
 * @param {Object<String, Array<String>>} [parts.texts] - more strings, by where they show
 * @param {{strict?: Boolean}} [options] - strict: the never-shown terms too (2.4 E and G)
 * @returns {Array<import('../banned.js').BannedHit>}
 */
export function scanState(
	{ root = null, canvas = [], toasts = [], texts = {} } = {},
	{ strict = false } = {}
) {
	const hits = [];
	if (root) hits.push(...scanDom(root, { strict }), ...findUppercase(root));
	hits.push(...scanTexts(canvas, 'canvas', { strict }), ...scanTexts(toasts, 'toast', { strict }));
	Object.entries(texts).forEach(([where, list]) =>
		hits.push(...scanTexts(list, where, { strict }))
	);
	return hits;
}

/**
 * @param {Array<import('../banned.js').BannedHit>} hits
 */
export function expectNoBanned(hits) {
	expect(hits.map(formatHit)).toEqual([]);
}

/**
 * Defines one scan test for a Simple screen state.
 * @param {String} name
 * @param {(recorders: {canvas: Object, toasts: Object}) => *} build
 * @param {{pending?: String, mode?: 'simple' | 'all', strict?: Boolean, forbid?: Array<String>,
 *   timeout?: Number}} [options]
 */
export function scanSimpleScreen(
	name,
	build,
	{ pending = '', mode = 'simple', strict = STRICT_BY_DEFAULT, forbid = [], timeout } = {}
) {
	const known = pending && !SCAN_ALL;
	const title = pending ? `${name} [pending: ${pending}]` : name;
	const strictScan = strict || (STRICT_ALL && mode === 'simple');
	it(
		title,
		async () => {
			const before = setModeForTests(mode);
			const canvas = startCanvasSpy();
			const toasts = startToastRecorder();
			try {
				const result = await build({ canvas, toasts });
				toasts.flush();
				const parts = describeResult(result);
				const hits = scanState(
					{ ...parts, canvas: canvas.texts, toasts: toasts.messages },
					{ strict: strictScan }
				);
				hits.push(...forbiddenHits(parts, forbid));
				if (known) {
					expect(
						hits.length,
						`"${name}" says no banned word now: delete its pending option (${pending})`
					).toBeGreaterThan(0);
				} else {
					expectNoBanned(hits);
				}
			} finally {
				canvas.stop();
				toasts.stop();
				setModeForTests(before);
			}
		},
		timeout
	);
}

/**
 * The forbidden strings (a browser's own sentence) that show in the scanned DOM or texts.
 * @param {{root: Node | null, texts: Object}} parts
 * @param {Array<String>} forbid
 * @returns {Array<import('../banned.js').BannedHit>}
 */
function forbiddenHits({ root, texts }, forbid) {
	if (!forbid.length) return [];
	const shown = [root?.textContent || '', ...Object.values(texts || {}).flat()].join(' ');
	const flat = shown.replace(/\s+/g, ' ');
	return forbid
		.filter((text) => text && flat.includes(String(text).replace(/\s+/g, ' ')))
		.map((text) => ({ term: 'raw error sentence', match: text, where: 'text', text }));
}

/**
 * @param {*} result - what build() returned
 * @returns {{root: Node | null, texts: Object}}
 */
function describeResult(result) {
	if (result === undefined) return { root: document.body, texts: {} };
	if (result === null) return { root: null, texts: {} };
	if (typeof result.nodeType === 'number') return { root: result, texts: {} };
	return { root: result.root ?? null, texts: result.texts || {} };
}
