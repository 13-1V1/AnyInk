// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it, vi } from 'vitest';
import {
	classifyDroppedFile,
	CLIPBOARD_BLOCKED_HINT,
	clipboardReadState,
	DROP_HINT,
	isSVGFile,
	isTraceableItem,
	makePasteGate,
	PASTE_EVENT_WAIT_MS,
	PASTE_TEXT_HINT,
	readClipboardImage,
	summarizePaste,
} from '../paste_drop.js';

const file = (name, type) => new File([new Uint8Array([1, 2, 3])], name, { type });
const isRaster = (f) => ['image/png', 'image/jpeg', 'image/webp'].includes(f?.type);

describe('hint text', () => {
	it('uses plain words and the exact wording from the contract', () => {
		expect(DROP_HINT).toBe(
			'Drop a PNG, JPEG, or WebP image to trace over it, or an SVG file to import its shapes.'
		);
		expect(PASTE_TEXT_HINT).toBe(
			'To import SVG shapes, drop an .svg file on the canvas. Paste an image to trace over it.'
		);
	});
});

describe('isSVGFile / classifyDroppedFile', () => {
	it('knows SVG by type or by name, case-insensitive', () => {
		expect(isSVGFile(file('a.svg', ''))).toBe(true);
		expect(isSVGFile(file('A.SVG', 'text/plain'))).toBe(true);
		expect(isSVGFile(file('shape', 'image/svg+xml'))).toBe(true);
		expect(isSVGFile(file('a.png', 'image/png'))).toBe(false);
		expect(isSVGFile(null)).toBe(false);
	});

	it('SVG keeps the shape import even when the image test would say yes', () => {
		expect(classifyDroppedFile(file('a.svg', 'image/svg+xml'), () => true)).toBe('svg');
	});

	it('an image the test accepts goes to the trace layer', () => {
		expect(classifyDroppedFile(file('scan.png', 'image/png'), isRaster)).toBe('image');
		expect(classifyDroppedFile(file('photo.jpg', 'image/jpeg'), isRaster)).toBe('image');
	});

	it('anything else, a missing file, or a broken test is "other"', () => {
		expect(classifyDroppedFile(file('notes.txt', 'text/plain'), isRaster)).toBe('other');
		expect(classifyDroppedFile(file('font.otf', ''), isRaster)).toBe('other');
		expect(classifyDroppedFile(undefined, isRaster)).toBe('other');
		const throws = () => {
			throw new Error('boom');
		};
		expect(classifyDroppedFile(file('scan.png', 'image/png'), throws)).toBe('other');
		expect(classifyDroppedFile(file('scan.png', 'image/png'), undefined)).toBe('other');
	});
});

describe('isTraceableItem', () => {
	it('is true for glyph-like items and false for kern groups and empties', () => {
		expect(isTraceableItem({ objType: 'Glyph', anyink: {} })).toBe(true);
		expect(isTraceableItem({ objType: 'Component', anyink: {} })).toBe(true);
		expect(isTraceableItem({ objType: 'KernGroup', anyink: {} })).toBe(false);
		expect(isTraceableItem({ objType: 'Glyph' })).toBe(false);
		expect(isTraceableItem(null)).toBe(false);
		expect(isTraceableItem(undefined)).toBe(false);
	});
});

describe('summarizePaste (paste event clipboardData)', () => {
	const itemOf = (f) => ({ kind: 'file', type: f.type, getAsFile: () => f });

	it('finds a pasted image in items (a screenshot) and skips SVG', () => {
		const svg = file('a.svg', 'image/svg+xml');
		const shot = file('image.png', 'image/png');
		const data = { items: [itemOf(svg), itemOf(shot)], types: ['Files'] };
		const out = summarizePaste(data, () => true);
		expect(out.image).toBe(shot);
		expect(out.files).toBe(2);
		expect(out.text).toBe(false);
	});

	it('falls back to data.files when items has no files', () => {
		const shot = file('image.webp', 'image/webp');
		const data = { items: [{ kind: 'string', type: 'text/plain' }], files: [shot], types: [] };
		expect(summarizePaste(data, isRaster).image).toBe(shot);
	});

	it('reports text (from types or getData) and no image', () => {
		expect(summarizePaste({ types: ['text/plain'] }, isRaster)).toEqual({
			image: null,
			text: true,
			files: 0,
		});
		expect(summarizePaste({ types: ['text/html'] }, isRaster).text).toBe(true);
		const data = { types: [], getData: (t) => (t === 'text/plain' ? '<svg/>' : '') };
		expect(summarizePaste(data, isRaster).text).toBe(true);
	});

	it('counts files the image test refuses without calling them images', () => {
		const heic = file('IMG_0001.HEIC', 'image/heic');
		const out = summarizePaste({ files: [heic], types: ['Files'] }, isRaster);
		expect(out.image).toBe(null);
		expect(out.files).toBe(1);
	});

	it('is empty for nothing at all', () => {
		expect(summarizePaste(null, isRaster)).toEqual({ image: null, text: false, files: 0 });
		expect(summarizePaste({}, isRaster)).toEqual({ image: null, text: false, files: 0 });
	});
});

describe('readClipboardImage (async clipboard for a Ctrl+V with no paste event)', () => {
	const clipItem = (types, blobs = {}) => ({
		types,
		getType: async (type) => {
			if (!blobs[type]) throw new Error('not here');
			return blobs[type];
		},
	});

	it('returns the first image blob the test accepts, typed, with no name', async () => {
		const png = new Blob([new Uint8Array([1])], { type: 'image/png' });
		const clipboard = {
			read: async () => [clipItem(['text/plain']), clipItem(['image/png'], { 'image/png': png })],
		};
		const out = await readClipboardImage(clipboard, isRaster);
		expect(out.image).toBe(png);
		expect(out.text).toBe(true);
	});

	it('gives an untyped blob the clipboard type before testing it', async () => {
		const bare = new Blob([new Uint8Array([1])]);
		const clipboard = { read: async () => [clipItem(['image/png'], { 'image/png': bare })] };
		const out = await readClipboardImage(clipboard, isRaster);
		expect(out.image.type).toBe('image/png');
	});

	it('skips SVG and failed getType calls', async () => {
		const clipboard = {
			read: async () => [clipItem(['image/svg+xml', 'image/png'], {})],
		};
		expect(await readClipboardImage(clipboard, () => true)).toEqual({
			image: null,
			text: false,
			denied: false,
		});
	});

	it('never throws: refused permission, missing API, no clipboard', async () => {
		const empty = { image: null, text: false, denied: false };
		expect(await readClipboardImage({}, isRaster)).toEqual(empty);
		expect(await readClipboardImage(undefined, isRaster)).toEqual(empty);
		const broken = {
			read: async () => {
				throw new Error('the clipboard is busy');
			},
		};
		expect(await readClipboardImage(broken, isRaster)).toEqual(empty);
	});

	// Finalize: a refused read is reported, so the paste can say so instead of doing nothing
	it('flags a read the browser refused (blocked or dismissed permission)', async () => {
		for (const name of ['NotAllowedError', 'SecurityError']) {
			const refused = {
				read: async () => {
					throw new DOMException('denied', name);
				},
			};
			expect(await readClipboardImage(refused, isRaster)).toEqual({
				image: null,
				text: false,
				denied: true,
			});
		}
	});
});

describe('clipboardReadState (finalize)', () => {
	const permissionsSaying = (state) => ({ query: vi.fn(async () => ({ state })) });

	it('asks for the clipboard-read permission and passes the answer on', async () => {
		for (const state of ['granted', 'prompt', 'denied']) {
			const permissions = permissionsSaying(state);
			expect(await clipboardReadState(permissions)).toBe(state);
			expect(permissions.query).toHaveBeenCalledWith({ name: 'clipboard-read' });
		}
	});

	it('says unknown when it cannot tell, and never throws', async () => {
		expect(await clipboardReadState(undefined)).toBe('unknown');
		expect(await clipboardReadState({})).toBe('unknown');
		const throwing = {
			query: async () => {
				throw new TypeError('clipboard-read is not a permission name here');
			},
		};
		expect(await clipboardReadState(throwing)).toBe('unknown');
		expect(await clipboardReadState(permissionsSaying(undefined))).toBe('unknown');
	});

	it('the blocked-clipboard hint says what to do in plain words', () => {
		expect(CLIPBOARD_BLOCKED_HINT).toMatch(/not allowed to read the clipboard/);
		expect(CLIPBOARD_BLOCKED_HINT).toMatch(/drop the image on the canvas/);
	});
});

describe('makePasteGate', () => {
	function fakeTimers() {
		let t = 1000;
		const queue = [];
		return {
			now: () => t,
			wait: (fn, ms) => queue.push({ fn, at: t + ms }),
			advance(ms) {
				t += ms;
				for (const job of queue.splice(0)) {
					if (job.at <= t) job.fn();
					else queue.push(job);
				}
			},
		};
	}

	it('handles one paste event once even when two listeners get it', () => {
		const gate = makePasteGate();
		const event = new Event('paste');
		expect(gate.firstSight(event)).toBe(true);
		expect(gate.firstSight(event)).toBe(false);
		expect(gate.firstSight(new Event('paste'))).toBe(true);
		expect(gate.firstSight(undefined)).toBe(true);
	});

	it('a Ctrl+V keydown reads the clipboard when no paste event follows', () => {
		const timers = fakeTimers();
		const gate = makePasteGate(timers);
		const fn = vi.fn();
		gate.afterKeyboardPaste(fn);
		timers.advance(PASTE_EVENT_WAIT_MS - 1);
		expect(fn).not.toHaveBeenCalled();
		timers.advance(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('a paste event after the keydown wins, so nothing is imported twice', () => {
		const timers = fakeTimers();
		const gate = makePasteGate(timers);
		const fn = vi.fn();
		gate.afterKeyboardPaste(fn);
		gate.notePasteEvent();
		timers.advance(PASTE_EVENT_WAIT_MS);
		expect(fn).not.toHaveBeenCalled();
	});

	it('an older paste event does not cancel a later keydown', () => {
		const timers = fakeTimers();
		const gate = makePasteGate(timers);
		gate.notePasteEvent();
		timers.advance(5000);
		const fn = vi.fn();
		gate.afterKeyboardPaste(fn);
		timers.advance(PASTE_EVENT_WAIT_MS);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
