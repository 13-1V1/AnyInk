// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track A: decoding rules (D-023) and the redraw-loop bitmap cache.
// jsdom has no real image decoder, so a fake one is injected with setDecoderForTests.
// ImageBitmap here is vi-canvas-mock's class (the setup file installs it).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BITMAP_CACHE_SIZE,
	DECODE_MESSAGES,
	decodeImageFile,
	ENCODE_QUALITY,
	fitWithin,
	getBitmap,
	onBitmapReady,
	setDecoderForTests,
	TRACE_MAX_SIDE,
	unsupportedMessage,
} from '../bitmap_cache.js';

const bytes = () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const file = (name, type) => new File([bytes()], name, { type });

/**
 * A fake decoder: decode() gives a bitmap of the given size, encode() gives a Blob of
 * whatever type was asked for (or of `encodeAs` when set, like a browser that cannot
 * encode WebP and hands back PNG).
 */
function fakeDecoder({ width = 400, height = 200, encodeAs, decodeError, encodeError } = {}) {
	const bitmaps = [];
	return {
		bitmaps,
		decode: vi.fn(async () => {
			if (decodeError) throw decodeError;
			const bitmap = new ImageBitmap(width, height);
			bitmaps.push(bitmap);
			return bitmap;
		}),
		encode: vi.fn(async (_bitmap, options) => {
			if (encodeError) throw encodeError(options);
			const type = typeof encodeAs === 'function' ? encodeAs(options) : encodeAs ?? options.type;
			return new Blob([new Uint8Array(16)], { type });
		}),
	};
}

/** Resolves on the next onBitmapReady call. */
function nextReady() {
	return new Promise((resolve) => {
		const off = onBitmapReady(() => {
			off();
			resolve();
		});
	});
}

afterEach(() => {
	setDecoderForTests(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('decodeImageFile: which files are accepted (D-023)', () => {
	let decoder;
	beforeEach(() => {
		decoder = fakeDecoder();
		setDecoderForTests(decoder);
	});

	it('rejects anything that is not PNG, JPEG, or WebP with a plain message', async () => {
		const gif = file('dance.gif', 'image/gif');
		await expect(decodeImageFile(gif)).rejects.toMatchObject({
			code: 'unsupported',
			message:
				'Only PNG, JPEG, or WebP images can be traced over. This is a GIF image. ' +
				'Save it as a PNG or JPEG and try again.',
		});
		await expect(decodeImageFile(file('notes.txt', 'text/plain'))).rejects.toMatchObject({
			code: 'unsupported',
			message: expect.stringContaining('This is a .txt file.'),
		});
		await expect(decodeImageFile(file('scan.tif', ''))).rejects.toMatchObject({
			message: expect.stringContaining('This is a TIFF image.'),
		});
		await expect(decodeImageFile(file('mystery', ''))).rejects.toMatchObject({
			message: expect.stringContaining('This is a file with no image type.'),
		});
		expect(decoder.decode).not.toHaveBeenCalled();
	});

	it('SVG gets pointed at the shape import instead', () => {
		expect(unsupportedMessage(file('a.svg', 'image/svg+xml'))).toContain(
			'an SVG drawing (drop it on the canvas to import its shapes instead)'
		);
	});

	it('rejects iPhone HEIC photos by type or by name, with its own message', async () => {
		for (const heic of [
			file('IMG_0001.jpg.heic', 'image/heic'),
			file('IMG_0002.HEIC', ''),
			file('IMG_0003.heif', 'application/octet-stream'),
			new Blob([bytes()], { type: 'image/heif' }),
		]) {
			await expect(decodeImageFile(heic)).rejects.toMatchObject({
				code: 'heic',
				message: DECODE_MESSAGES.heic,
			});
		}
		expect(DECODE_MESSAGES.heic).toMatch(/HEIC/);
		expect(DECODE_MESSAGES.heic).toMatch(/JPEG/);
		expect(decoder.decode).not.toHaveBeenCalled();
	});

	it('accepts the three types by MIME type, and by name when the type is missing', async () => {
		for (const ok of [
			file('a.png', 'image/png'),
			file('b.jpg', 'image/jpeg'),
			file('c.jpeg', 'image/JPG'),
			file('d.webp', 'image/webp'),
			file('E.JPG', ''),
			file('f.png', 'application/octet-stream'),
			new Blob([bytes()], { type: 'image/png' }), // async clipboard: a type, no name
		]) {
			await expect(decodeImageFile(ok)).resolves.toMatchObject({ width: 400, height: 200 });
		}
		expect(decoder.decode).toHaveBeenCalledTimes(7);
	});

	it('rejects something that is not a file at all', async () => {
		for (const junk of [null, undefined, 'a.png', { name: 'a.png', type: 'image/png' }]) {
			await expect(decodeImageFile(junk)).rejects.toMatchObject({
				code: 'not-a-file',
				message: DECODE_MESSAGES.notAFile,
			});
		}
	});
});

describe('decodeImageFile: decode, cap, re-encode', () => {
	it('decodes upright (EXIF orientation), caps 4000 x 1000 to 2000 x 500, encodes WebP at 0.92', async () => {
		const decoder = fakeDecoder({ width: 4000, height: 1000 });
		setDecoderForTests(decoder);
		const source = file('wide.jpg', 'image/jpeg');

		const out = await decodeImageFile(source);

		expect(decoder.decode).toHaveBeenCalledWith(source, { imageOrientation: 'from-image' });
		expect(decoder.encode).toHaveBeenCalledTimes(1);
		expect(decoder.encode).toHaveBeenCalledWith(decoder.bitmaps[0], {
			width: 2000,
			height: 500,
			type: 'image/webp',
			quality: ENCODE_QUALITY,
		});
		expect(ENCODE_QUALITY).toBe(0.92);
		expect(out.type).toBe('image/webp');
		expect(out.blob).toBeInstanceOf(Blob);
		expect(out.blob.type).toBe('image/webp');
		expect(out).toMatchObject({ width: 2000, height: 500 });
		// The full-size decode is released once the small copy exists
		expect(decoder.bitmaps[0].close).toHaveBeenCalled();
	});

	it('caps the long side whichever way the image faces, and honors maxSide', async () => {
		setDecoderForTests(fakeDecoder({ width: 1000, height: 4000 }));
		await expect(decodeImageFile(file('tall.png', 'image/png'))).resolves.toMatchObject({
			width: 500,
			height: 2000,
		});
		setDecoderForTests(fakeDecoder({ width: 3200, height: 2400 }));
		await expect(
			decodeImageFile(file('sheet.png', 'image/png'), { maxSide: 1600 })
		).resolves.toMatchObject({ width: 1600, height: 1200 });
	});

	it('leaves an image inside the cap at its own size', async () => {
		setDecoderForTests(fakeDecoder({ width: 800, height: 600 }));
		await expect(decodeImageFile(file('small.png', 'image/png'))).resolves.toMatchObject({
			width: 800,
			height: 600,
		});
		expect(TRACE_MAX_SIDE).toBe(2000);
	});

	it('fitWithin rounds to whole pixels and never goes below 1', () => {
		expect(fitWithin(4000, 1000, 2000)).toEqual({ width: 2000, height: 500 });
		expect(fitWithin(3024, 4032, 2000)).toEqual({ width: 1500, height: 2000 });
		expect(fitWithin(9000, 1, 2000)).toEqual({ width: 2000, height: 1 });
		expect(fitWithin(2000, 2000, 2000)).toEqual({ width: 2000, height: 2000 });
		expect(fitWithin(2001, 3, 2000)).toEqual({ width: 2000, height: 3 });
	});

	it('falls back to PNG when the browser cannot encode WebP', async () => {
		// The browser hands back PNG for a WebP request: keep it, no second encode
		const pngBack = fakeDecoder({ encodeAs: 'image/png' });
		setDecoderForTests(pngBack);
		await expect(decodeImageFile(file('a.jpg', 'image/jpeg'))).resolves.toMatchObject({
			type: 'image/png',
		});
		expect(pngBack.encode).toHaveBeenCalledTimes(1);

		// The WebP attempt gives an untyped Blob: encode again as PNG
		const untyped = fakeDecoder({ encodeAs: (o) => (o.type === 'image/webp' ? '' : o.type) });
		setDecoderForTests(untyped);
		await expect(decodeImageFile(file('a.jpg', 'image/jpeg'))).resolves.toMatchObject({
			type: 'image/png',
		});
		expect(untyped.encode).toHaveBeenCalledTimes(2);
		expect(untyped.encode.mock.calls[1][1]).toMatchObject({
			type: 'image/png',
			width: 400,
			height: 200,
		});

		// The WebP attempt throws: PNG
		const throws = fakeDecoder();
		throws.encode.mockImplementation(async (_b, o) => {
			if (o.type === 'image/webp') throw new Error('no webp');
			return new Blob([new Uint8Array(4)], { type: o.type });
		});
		setDecoderForTests(throws);
		await expect(decodeImageFile(file('a.jpg', 'image/jpeg'))).resolves.toMatchObject({
			type: 'image/png',
		});
	});

	it('a decode failure becomes a plain message', async () => {
		setDecoderForTests(fakeDecoder({ decodeError: new DOMException('bad', 'InvalidStateError') }));
		await expect(decodeImageFile(file('broken.png', 'image/png'))).rejects.toMatchObject({
			code: 'decode-failed',
			message: DECODE_MESSAGES.decodeFailed,
		});
		setDecoderForTests(fakeDecoder({ width: 0, height: 0 }));
		await expect(decodeImageFile(file('empty.png', 'image/png'))).rejects.toMatchObject({
			code: 'decode-failed',
		});
	});

	it('an encode failure becomes a plain message and still releases the bitmap', async () => {
		const decoder = fakeDecoder({ encodeError: () => new Error('out of memory') });
		setDecoderForTests(decoder);
		await expect(decodeImageFile(file('huge.png', 'image/png'))).rejects.toMatchObject({
			code: 'encode-failed',
			message: DECODE_MESSAGES.encodeFailed,
		});
		expect(decoder.bitmaps[0].close).toHaveBeenCalled();
	});

	it('says so when the browser has no decoder at all', async () => {
		vi.stubGlobal('createImageBitmap', undefined);
		await expect(decodeImageFile(file('a.png', 'image/png'))).rejects.toMatchObject({
			code: 'no-decoder',
			message: DECODE_MESSAGES.noDecoder,
		});
	});

	it('the default browser path runs end to end (vi-canvas-mock decoder and canvas)', async () => {
		// No injected decoder: createImageBitmap + <canvas>.toBlob from vi-canvas-mock
		const out = await decodeImageFile(file('a.png', 'image/png'));
		expect(out.type).toBe('image/webp');
		expect(out.blob.size).toBeGreaterThan(0);
		expect(out.width).toBeGreaterThan(0);
		expect(out.height).toBeGreaterThan(0);
	});

	it('every message is plain words: no metric units, no jargon codes', () => {
		const all = [...Object.values(DECODE_MESSAGES), unsupportedMessage(file('a.gif', 'image/gif'))];
		for (const message of all) {
			expect(message).not.toMatch(/\b(mm|cm|MIME|EXIF|codec|decode|bitmap)\b/i);
			expect(message.endsWith('.')).toBe(true);
		}
	});
});

describe('getBitmap / onBitmapReady', () => {
	let decoder;
	beforeEach(() => {
		decoder = fakeDecoder({ width: 300, height: 150 });
		setDecoderForTests(decoder);
	});

	it('a miss returns null and starts one decode; later calls hit the same bitmap', async () => {
		const blob = new Blob([bytes()], { type: 'image/webp' });
		const ready = nextReady();

		expect(getBitmap(blob)).toBeNull();
		expect(getBitmap(blob)).toBeNull(); // still decoding: no second decode
		await ready;
		expect(decoder.decode).toHaveBeenCalledTimes(1);
		expect(decoder.decode).toHaveBeenCalledWith(blob, { imageOrientation: 'from-image' });

		const bitmap = getBitmap(blob);
		expect(bitmap).toBe(decoder.bitmaps[0]);
		expect(bitmap.width).toBe(300);
		expect(getBitmap(blob)).toBe(bitmap);
		expect(decoder.decode).toHaveBeenCalledTimes(1);
	});

	it('is keyed by the Blob object: the same bytes in another Blob is a miss', async () => {
		const a = new Blob([bytes()], { type: 'image/png' });
		const b = new Blob([bytes()], { type: 'image/png' });
		let ready = nextReady();
		getBitmap(a);
		await ready;
		ready = nextReady();
		expect(getBitmap(b)).toBeNull();
		await ready;
		expect(decoder.decode).toHaveBeenCalledTimes(2);
		expect(getBitmap(a)).not.toBe(getBitmap(b));
	});

	it('onBitmapReady fires once per decode and stops after unsubscribe', async () => {
		const listener = vi.fn();
		const off = onBitmapReady(listener);
		const a = new Blob([bytes()], { type: 'image/png' });
		const b = new Blob([bytes()], { type: 'image/png' });

		let ready = nextReady();
		getBitmap(a);
		getBitmap(a);
		await ready;
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith();

		getBitmap(a); // hit: no decode, no event
		await Promise.resolve();
		expect(listener).toHaveBeenCalledTimes(1);

		ready = nextReady();
		getBitmap(b);
		await ready;
		expect(listener).toHaveBeenCalledTimes(2);

		off();
		ready = nextReady();
		getBitmap(new Blob([bytes()], { type: 'image/png' }));
		await ready;
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('a failed decode is reported once and never retried (no redraw loop)', async () => {
		setDecoderForTests(fakeDecoder({ decodeError: new Error('broken') }));
		const listener = vi.fn();
		const off = onBitmapReady(listener);
		const blob = new Blob([bytes()], { type: 'image/png' });

		const ready = nextReady();
		expect(getBitmap(blob)).toBeNull();
		await ready;
		expect(listener).toHaveBeenCalledTimes(1);
		for (let i = 0; i < 5; i++) expect(getBitmap(blob)).toBeNull();
		await Promise.resolve();
		expect(listener).toHaveBeenCalledTimes(1);
		off();
	});

	it('a listener that throws does not stop the others', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const offBad = onBitmapReady(() => {
			throw new Error('boom');
		});
		const good = vi.fn();
		const offGood = onBitmapReady(good);
		const ready = nextReady();
		getBitmap(new Blob([bytes()], { type: 'image/png' }));
		await ready;
		expect(good).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalled();
		offBad();
		offGood();
	});

	it('not a Blob, or no decoder: null, never a throw', () => {
		expect(getBitmap(null)).toBeNull();
		expect(getBitmap('img-a1b2c3d4')).toBeNull();
		expect(getBitmap({ width: 10 })).toBeNull();
		expect(decoder.decode).not.toHaveBeenCalled();

		setDecoderForTests(null);
		vi.stubGlobal('createImageBitmap', undefined);
		expect(getBitmap(new Blob([bytes()]))).toBeNull();
	});

	it('setDecoderForTests empties the cache', async () => {
		const blob = new Blob([bytes()], { type: 'image/png' });
		let ready = nextReady();
		getBitmap(blob);
		await ready;
		expect(getBitmap(blob)).not.toBeNull();

		const next = fakeDecoder({ width: 10, height: 10 });
		setDecoderForTests(next);
		ready = nextReady();
		expect(getBitmap(blob)).toBeNull();
		await ready;
		expect(getBitmap(blob).width).toBe(10);
	});

	it('onBitmapReady ignores a non-function and still returns an unsubscribe', () => {
		const off = onBitmapReady('redraw');
		expect(typeof off).toBe('function');
		off();
	});
});

// Fix track (finding: the cache never let go). One photo per glyph for ~70 glyphs kept
// ~840 MB of decoded pixels alive, because every Blob stays in editor.assets for undo.
describe('getBitmap keeps only a few recent bitmaps (D-023: one per glyph on screen)', () => {
	let decoder;
	beforeEach(() => {
		decoder = fakeDecoder({ width: 300, height: 150 });
		setDecoderForTests(decoder);
	});

	async function decodeNow(blob) {
		const ready = nextReady();
		expect(getBitmap(blob)).toBeNull();
		await ready;
		return getBitmap(blob);
	}

	it('closes the least recently drawn bitmap past the cap, and decodes it again on the next miss', async () => {
		expect(BITMAP_CACHE_SIZE).toBe(4);
		const blobs = Array.from({ length: 6 }, () => new Blob([bytes()], { type: 'image/webp' }));
		const bitmaps = [];
		for (const blob of blobs) bitmaps.push(await decodeNow(blob));
		expect(decoder.decode).toHaveBeenCalledTimes(6);

		// The two oldest were released; the four newest are still live and cached
		const closed = (bitmap) => bitmap.close.mock.calls.length === 1 && bitmap._closed === true;
		expect(closed(bitmaps[0])).toBe(true);
		expect(closed(bitmaps[1])).toBe(true);
		for (let i = 2; i < 6; i++) {
			expect(closed(bitmaps[i]), `bitmap ${i}`).toBe(false);
			expect(getBitmap(blobs[i])).toBe(bitmaps[i]);
		}
		expect(decoder.decode).toHaveBeenCalledTimes(6);

		// The oldest is a miss now: one fresh decode, and it becomes the newest
		const again = await decodeNow(blobs[0]);
		expect(decoder.decode).toHaveBeenCalledTimes(7);
		expect(again).not.toBe(bitmaps[0]);
		expect(again.width).toBe(300);
	});

	it('a hit counts as recent use, so the glyph on screen is never the one evicted', async () => {
		const blobs = Array.from({ length: 5 }, () => new Blob([bytes()], { type: 'image/png' }));
		const first = await decodeNow(blobs[0]);
		for (let i = 1; i < 4; i++) await decodeNow(blobs[i]);
		expect(getBitmap(blobs[0])).toBe(first); // drawn again: most recent now
		await decodeNow(blobs[4]);
		expect(getBitmap(blobs[0])).toBe(first);
		const ready = nextReady();
		expect(getBitmap(blobs[1])).toBeNull(); // blobs[1] was the oldest and went instead
		await ready;
	});

	it('setDecoderForTests releases every cached bitmap', async () => {
		const bitmap = await decodeNow(new Blob([bytes()], { type: 'image/png' }));
		expect(bitmap.close).not.toHaveBeenCalled();
		setDecoderForTests(fakeDecoder());
		expect(bitmap.close).toHaveBeenCalledTimes(1);
	});
});

describe('import-time safety', () => {
	it('the module loads with no createImageBitmap, OffscreenCanvas, or document canvas', async () => {
		vi.resetModules();
		vi.stubGlobal('createImageBitmap', undefined);
		vi.stubGlobal('OffscreenCanvas', undefined);
		const fresh = await import('../bitmap_cache.js');
		expect(fresh.getBitmap(new Blob([bytes()]))).toBeNull();
		await expect(fresh.decodeImageFile(file('a.png', 'image/png'))).rejects.toMatchObject({
			code: 'no-decoder',
		});
	});
});
