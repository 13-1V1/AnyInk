// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK base64 helpers for binary assets (Milestone 6, D-012).
	One job: turn a Blob into base64 text for the .gs2 file and back, byte for byte,
	in every runtime this code runs in.
	  - Browser: FileReader.readAsDataURL, the native encoder. No JS binary string
	    is built, so a multi-megabyte photo does not stall the tab.
	  - vitest (jsdom 24): Blob has no arrayBuffer(), but FileReader works, so the
	    browser path is what the unit tests exercise.
	  - Plain Node: Buffer. A chunked btoa encoder is the last resort when neither
	    FileReader nor Buffer exists.
	Decoding is always atob + Uint8Array. Nothing here throws at import time.
*/

const CHUNK = 0x8000; // bytes per String.fromCharCode call in the manual encoder

function readWithFileReader(blob, method) {
	if (typeof FileReader !== 'function') {
		return Promise.reject(new Error('This environment has no way to read the file.'));
	}
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
		reader[method](blob);
	});
}

/**
 * Reads every byte of a Blob. Uses blob.arrayBuffer() when the runtime has it,
 * FileReader.readAsArrayBuffer otherwise (jsdom).
 * @param {Blob} blob
 * @returns {Promise<Uint8Array>}
 */
export async function blobToBytes(blob) {
	if (typeof blob?.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
	return new Uint8Array(await readWithFileReader(blob, 'readAsArrayBuffer'));
}

/**
 * Bytes to base64 text.
 * @param {Uint8Array} bytes
 * @param {Object} [options]
 * @param {Boolean} [options.manual] - skip Buffer and use the chunked btoa encoder (tests)
 * @returns {String}
 */
export function bytesToBase64(bytes, { manual = false } = {}) {
	if (!manual && typeof globalThis.Buffer === 'function') {
		return globalThis.Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
			'base64'
		);
	}
	// btoa wants a "binary string"; build it in chunks so a big image never exceeds
	// the argument limit of String.fromCharCode.
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/**
 * Base64 text to bytes (atob + Uint8Array). A full data: URL is tolerated; its
 * header is dropped. Throws on anything that is not valid base64.
 * @param {String} base64
 * @returns {Uint8Array}
 */
export function base64ToBytes(base64) {
	if (typeof base64 !== 'string') throw new TypeError('The image data is not text.');
	const clean = base64.startsWith('data:') ? base64.slice(base64.indexOf(',') + 1) : base64;
	if (typeof atob !== 'function') return new Uint8Array(globalThis.Buffer.from(clean, 'base64'));
	const binary = atob(clean);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * Blob to base64 text (no data: prefix).
 * @param {Blob} blob
 * @param {Object} [options]
 * @param {'filereader' | 'buffer' | 'manual'} [options.via] - force one path (tests).
 *   Default: FileReader when the runtime has one, otherwise Buffer, otherwise manual.
 * @returns {Promise<String>}
 */
export async function blobToBase64(blob, { via } = {}) {
	const useReader = via ? via === 'filereader' : typeof FileReader === 'function';
	if (useReader) {
		const dataURL = await readWithFileReader(blob, 'readAsDataURL');
		return dataURL.slice(dataURL.indexOf(',') + 1);
	}
	return bytesToBase64(await blobToBytes(blob), { manual: via === 'manual' });
}

/**
 * Base64 text to a Blob of the given MIME type.
 * @param {String} base64
 * @param {String} type
 * @returns {Blob}
 */
export function base64ToBlob(base64, type) {
	return new Blob([base64ToBytes(base64)], { type });
}
