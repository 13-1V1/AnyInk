// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for B3 placement: reads a fixture photo the way the app will, in plain code that
	runs in vitest (node). Not shipped.
	- decodePng(bytes) -> { data, width, height } (RGBA): 8-bit, non-interlaced PNG, every
	  color type and filter, inflated with node:zlib.
	- loadFixture(name) -> { image, key, mask, parts }: the photo, its answer key (written by
	  tests/placement-fixture.mjs), the ink mask (the auto-trace's own gray + Otsu cutoff) and
	  its parts (findParts).
	- findParts and strokeWidthPx come from ink_parts_lite.js (browser-safe) and are passed on.
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { otsuThreshold, thresholdGlobal, toGray } from '../../autotrace/binarize.js';
import { findParts, strokeWidthPx } from './ink_parts_lite.js';

export { findParts, strokeWidthPx };

/**
 * @param {Uint8Array} bytes - a PNG file
 * @returns {{data: Uint8ClampedArray, width: Number, height: Number}}
 */
export function decodePng(bytes) {
	const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	const signature = [137, 80, 78, 71, 13, 10, 26, 10];
	if (!signature.every((b, i) => u8[i] === b)) throw new Error('Not a PNG file.');
	const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
	let offset = 8;
	let header = null;
	const idat = [];
	while (offset < u8.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(...u8.subarray(offset + 4, offset + 8));
		const data = u8.subarray(offset + 8, offset + 8 + length);
		if (type === 'IHDR') {
			header = {
				width: view.getUint32(offset + 8),
				height: view.getUint32(offset + 12),
				depth: data[8],
				color: data[9],
				interlace: data[12],
			};
		} else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		offset += 12 + length;
	}
	if (!header || header.depth !== 8 || header.interlace !== 0) {
		throw new Error('Only 8-bit, non-interlaced PNG files are read here.');
	}
	const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.color];
	if (!channels) throw new Error(`PNG color type ${header.color} is not read here.`);
	const joined = new Uint8Array(idat.reduce((sum, chunk) => sum + chunk.length, 0));
	let at = 0;
	for (const chunk of idat) {
		joined.set(chunk, at);
		at += chunk.length;
	}
	const raw = new Uint8Array(inflateSync(joined));
	const { width, height } = header;
	const stride = width * channels;
	const pixels = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const row = y * stride;
		for (let x = 0; x < stride; x++) {
			const left = x >= channels ? pixels[row + x - channels] : 0;
			const up = y > 0 ? pixels[row - stride + x] : 0;
			const upLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels] : 0;
			let value = line[x];
			if (filter === 1) value += left;
			else if (filter === 2) value += up;
			else if (filter === 3) value += (left + up) >> 1;
			else if (filter === 4) value += paeth(left, up, upLeft);
			pixels[row + x] = value & 255;
		}
	}
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		const p = i * channels;
		const gray = channels <= 2;
		data[i * 4] = pixels[p];
		data[i * 4 + 1] = gray ? pixels[p] : pixels[p + 1];
		data[i * 4 + 2] = gray ? pixels[p] : pixels[p + 2];
		data[i * 4 + 3] = channels === 4 ? pixels[p + 3] : channels === 2 ? pixels[p + 1] : 255;
	}
	return { data, width, height };
}

/**
 * @param {String} name - fixture name without extension (brennan-hand, tails-row)
 * @returns {{image: Object, key: Object, mask: Uint8Array, parts: Array<Object>}}
 */
export function loadFixture(name) {
	const folder = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
	const image = decodePng(readFileSync(join(folder, `${name}.png`)));
	const key = JSON.parse(readFileSync(join(folder, `${name}.json`), 'utf8'));
	const gray = toGray(image);
	const mask = thresholdGlobal(gray, image.width, image.height, otsuThreshold(gray));
	return { image, key, mask, parts: findParts(mask, image.width, image.height) };
}

function paeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	return pb <= pc ? b : c;
}
