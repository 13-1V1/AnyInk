// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	base64ToBlob,
	base64ToBytes,
	blobToBase64,
	blobToBytes,
	bytesToBase64,
} from '../base64.js';

// 1 x 1 transparent PNG, 70 bytes.
const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0x64, 0x60, 0xf8, 0x5f,
	0x0f, 0x00, 0x02, 0x87, 0x01, 0x80, 0xeb, 0x47, 0xba, 0x92, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
	0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function randomBytes(n) {
	const out = new Uint8Array(n);
	for (let i = 0; i < n; i++) out[i] = (i * 7919 + 13) % 256;
	return out;
}

describe('bytesToBase64', () => {
	it('encodes the PNG to the known string via Buffer and via the manual encoder', () => {
		expect(bytesToBase64(PNG_BYTES)).toBe(PNG_BASE64);
		expect(bytesToBase64(PNG_BYTES, { manual: true })).toBe(PNG_BASE64);
	});

	it('manual encoder matches Buffer across chunk boundaries and padding lengths', () => {
		for (const n of [0, 1, 2, 3, 0x8000 - 1, 0x8000, 0x8000 + 1, 100_003]) {
			const bytes = randomBytes(n);
			expect(bytesToBase64(bytes, { manual: true })).toBe(bytesToBase64(bytes));
		}
	});

	it('respects a subarray view (byteOffset)', () => {
		const backing = new Uint8Array(PNG_BYTES.length + 10);
		backing.set(PNG_BYTES, 5);
		const view = backing.subarray(5, 5 + PNG_BYTES.length);
		expect(bytesToBase64(view)).toBe(PNG_BASE64);
		expect(bytesToBase64(view, { manual: true })).toBe(PNG_BASE64);
	});
});

describe('base64ToBytes', () => {
	it('decodes the known string back to the exact PNG bytes', () => {
		expect(Array.from(base64ToBytes(PNG_BASE64))).toEqual(Array.from(PNG_BYTES));
	});

	it('tolerates a full data: URL', () => {
		const decoded = base64ToBytes(`data:image/png;base64,${PNG_BASE64}`);
		expect(Array.from(decoded)).toEqual(Array.from(PNG_BYTES));
	});

	it('round-trips random bytes of every padding length', () => {
		for (const n of [0, 1, 2, 3, 4, 257, 1000]) {
			const bytes = randomBytes(n);
			expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
		}
	});

	it('throws on non-text and on broken base64', () => {
		expect(() => base64ToBytes(undefined)).toThrow(TypeError);
		expect(() => base64ToBytes(42)).toThrow(TypeError);
		expect(() => base64ToBytes('***not base64***')).toThrow();
	});
});

describe('blobToBytes / blobToBase64 / base64ToBlob', () => {
	it('reads a jsdom Blob (no arrayBuffer) through FileReader', async () => {
		const blob = new Blob([PNG_BYTES], { type: 'image/png' });
		expect(typeof blob.arrayBuffer).toBe('undefined'); // jsdom 24; documents why FileReader exists
		expect(Array.from(await blobToBytes(blob))).toEqual(Array.from(PNG_BYTES));
	});

	it('prefers blob.arrayBuffer() when the runtime has it', async () => {
		let called = 0;
		const fake = {
			size: PNG_BYTES.length,
			type: 'image/png',
			slice() {},
			arrayBuffer: async () => {
				called++;
				return PNG_BYTES.buffer.slice(0);
			},
		};
		expect(Array.from(await blobToBytes(fake))).toEqual(Array.from(PNG_BYTES));
		expect(called).toBe(1);
	});

	it('gives the same base64 on the FileReader, Buffer, and manual paths', async () => {
		const blob = new Blob([PNG_BYTES], { type: 'image/png' });
		expect(await blobToBase64(blob)).toBe(PNG_BASE64);
		expect(await blobToBase64(blob, { via: 'filereader' })).toBe(PNG_BASE64);
		expect(await blobToBase64(blob, { via: 'buffer' })).toBe(PNG_BASE64);
		expect(await blobToBase64(blob, { via: 'manual' })).toBe(PNG_BASE64);
	});

	it('handles an empty Blob and a Blob with no type', async () => {
		expect(await blobToBase64(new Blob([]))).toBe('');
		expect(await blobToBase64(new Blob([PNG_BYTES]))).toBe(PNG_BASE64);
	});

	it('base64ToBlob builds a Blob of the given type and exact size', async () => {
		const blob = base64ToBlob(PNG_BASE64, 'image/webp');
		expect(blob.type).toBe('image/webp');
		expect(blob.size).toBe(PNG_BYTES.length);
		expect(Array.from(await blobToBytes(blob))).toEqual(Array.from(PNG_BYTES));
	});
});
