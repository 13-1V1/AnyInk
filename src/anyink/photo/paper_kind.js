// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-core: the paper detector, "Paper: (Flat scan) (Phone photo) picked for you" in the
	photo card's Adjust section (docs/UX-BEGINNER.md 4.4 step C, D-016 amended). Pure: bytes and
	ImageData-like pixels in, a plain answer out; no DOM, no editor.

	The rule (UX-BEGINNER 4.4): a JPEG with camera fields in its EXIF, or a page whose paper
	brightness varies by more than a set amount across the image, gets Phone photo ('photo',
	auto-trace's Photo mode: a cutoff that follows the local paper); anything else gets Flat scan
	('scan', one cutoff for the whole image).
	- Camera fields: at least MIN_CAMERA_FIELDS of the four exposure fields every phone camera
	  writes in its Exif IFD (exposure time, f-number, ISO, focal length). Make and Model alone
	  don't count: scanners and editing apps write those too.
	- The EXIF must be read from the file he picked, before import: the trace import decodes,
	  turns upright and re-encodes the photo (D-023), and the stored image has no EXIF.
	- The paper's spread: auto-trace's own paper map (binarize.js estimatePaper: the brightest
	  pixel near each spot) on a copy at most PAPER_SAMPLE_SIDE pixels long, and how far its 95th
	  percentile sits above its 5th, in gray levels. A flatbed scan measures under 10, a phone
	  photo in room light 30 or more. PHONE_SPREAD (20) is the set amount: below it one cutoff
	  has room to spare (felt-tip ink sits about 150 gray levels under the paper, pencil 60 to
	  100), above it the dim side of the page starts to reach a single cutoff. When unsure it
	  leans to Phone photo, which also reads a scan correctly.
	- Light ink on dark paper (a chalkboard, a white gel pen on black card): more than
	  LIGHT_INK_SHARE of the middle of the photo (its middle half, left to right and top to
	  bottom, where the page is even when the table shows round it) is darker than Otsu's cutoff.
	  The paper map is then made from the image turned negative.

	  readExif(bytes)   -> { jpeg, exif, make, model, camera: ['exposureTime', 'fNumber', 'iso',
	                      'focalLength'] (the ones present) }; bytes: Uint8Array or ArrayBuffer
	                      of the file. Never throws: cut-off or broken files read as far as they
	                      go, and an IFD offset is followed only once.
	  paperSpread(imageData, { lightInk })   -> gray levels (0 for an empty image)
	  guessLightInk(imageData)   -> Boolean
	  paperKind({ bytes, imageData })   -> { kind: 'photo' | 'scan', reason: 'camera' |
	                      'uneven' | 'even', spread, lightInk, camera }; either input may be
	                      missing (no pixels: spread 0)
*/
import { downscaleImageData, estimatePaper, otsuThreshold, toGray } from '../autotrace/binarize.js';

/** Paper brightness varying by more than this many gray levels makes it a phone photo. */
export const PHONE_SPREAD = 20;

/** The paper map is made on a copy at most this many pixels long. */
export const PAPER_SAMPLE_SIDE = 800;

/** Light ink on dark paper when more than this share of the photo's middle is dark. */
export const LIGHT_INK_SHARE = 0.5;

/** The four exposure fields a phone camera writes, by the names readExif gives them. */
export const CAMERA_FIELDS = Object.freeze(['exposureTime', 'fNumber', 'iso', 'focalLength']);

/** At least this many camera fields make it a camera photo. */
export const MIN_CAMERA_FIELDS = 2;

const CAMERA_TAGS = new Map([
	[0x829a, 'exposureTime'],
	[0x829d, 'fNumber'],
	[0x8827, 'iso'],
	[0x920a, 'focalLength'],
]);
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_EXIF_IFD = 0x8769;
/** More entries than this in one IFD is a broken file. */
const MAX_ENTRIES = 512;
const MAX_TEXT = 64;

// --------------------------------------------------------------
// EXIF
// --------------------------------------------------------------

/**
 * @param {Uint8Array | ArrayBuffer} bytes - the photo file
 * @returns {{jpeg: Boolean, exif: Boolean, make: String, model: String, camera: Array<String>}}
 */
export function readExif(bytes) {
	const u8 =
		bytes instanceof Uint8Array
			? bytes
			: bytes instanceof ArrayBuffer
			? new Uint8Array(bytes)
			: null;
	const out = { jpeg: false, exif: false, make: '', model: '', camera: [] };
	if (!u8 || u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) return out;
	out.jpeg = true;
	let at = 2;
	while (at + 4 <= u8.length && u8[at] === 0xff) {
		const marker = u8[at + 1];
		if (marker === 0xff) {
			at++;
			continue;
		}
		// End of image or start of the picture data: no more headers
		if (marker === 0xd9 || marker === 0xda) break;
		// Markers with no length
		if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
			at += 2;
			continue;
		}
		const length = (u8[at + 2] << 8) | u8[at + 3];
		if (length < 2) break;
		const start = at + 4;
		const end = Math.min(u8.length, at + 2 + length);
		if (marker === 0xe1 && end - start >= 14 && isExifHeader(u8, start)) {
			readTiff(u8, start + 6, end, out);
			if (out.exif) break;
		}
		at += 2 + length;
	}
	return out;
}

function isExifHeader(u8, at) {
	return (
		u8[at] === 0x45 &&
		u8[at + 1] === 0x78 &&
		u8[at + 2] === 0x69 &&
		u8[at + 3] === 0x66 &&
		u8[at + 4] === 0 &&
		u8[at + 5] === 0
	);
}

/** Reads IFD0 (Make, Model, the Exif IFD pointer) and the Exif IFD (the camera fields). */
function readTiff(u8, base, end, out) {
	if (end - base < 8) return;
	const little = u8[base] === 0x49 && u8[base + 1] === 0x49;
	const big = u8[base] === 0x4d && u8[base + 1] === 0x4d;
	if (!little && !big) return;
	const u16 = (offset) => {
		const p = base + offset;
		if (offset < 0 || p + 2 > end) return null;
		return little ? u8[p] | (u8[p + 1] << 8) : (u8[p] << 8) | u8[p + 1];
	};
	const u32 = (offset) => {
		const p = base + offset;
		if (offset < 0 || p + 4 > end) return null;
		const v = little
			? u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24)
			: (u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3];
		return v >>> 0;
	};
	if (u16(2) !== 42) return;
	out.exif = true;
	const visited = new Set();
	const entries = (offset) => {
		if (offset === null || visited.has(offset)) return [];
		visited.add(offset);
		const count = u16(offset);
		if (count === null || count > MAX_ENTRIES) return [];
		const list = [];
		for (let i = 0; i < count; i++) {
			const at = offset + 2 + i * 12;
			const tag = u16(at);
			const type = u16(at + 2);
			const n = u32(at + 4);
			if (tag === null || type === null || n === null) break;
			list.push({ tag, type, count: n, at });
		}
		return list;
	};
	const text = (entry) => {
		if (entry.type !== 2 || entry.count < 1) return '';
		const length = Math.min(entry.count, MAX_TEXT);
		const from = entry.count <= 4 ? entry.at + 8 : u32(entry.at + 8);
		if (from === null || base + from + length > end) return '';
		let s = '';
		for (let i = 0; i < length; i++) {
			const c = u8[base + from + i];
			if (c === 0) break;
			s += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '';
		}
		return s.trim();
	};
	let exifOffset = null;
	for (const entry of entries(u32(4))) {
		if (entry.tag === TAG_MAKE) out.make = text(entry);
		else if (entry.tag === TAG_MODEL) out.model = text(entry);
		else if (entry.tag === TAG_EXIF_IFD && entry.count === 1) exifOffset = u32(entry.at + 8);
	}
	const found = new Set();
	for (const entry of entries(exifOffset)) {
		const name = CAMERA_TAGS.get(entry.tag);
		if (name && entry.count > 0) found.add(name);
	}
	out.camera = CAMERA_FIELDS.filter((name) => found.has(name));
}

// --------------------------------------------------------------
// The paper
// --------------------------------------------------------------

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @param {{lightInk?: Boolean}} [options] - read the paper from the image turned negative
 * @returns {Number} gray levels between the 5th and the 95th percentile of the paper map
 */
export function paperSpread(imageData, { lightInk = false } = {}) {
	const sample = sampleGray(imageData);
	if (!sample) return 0;
	const { gray, width, height } = sample;
	if (lightInk) for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];
	const paper = estimatePaper(gray, width, height);
	const hist = new Uint32Array(256);
	for (let i = 0; i < paper.length; i++) hist[paper[i]]++;
	const low = percentile(hist, paper.length, 0.05);
	const high = percentile(hist, paper.length, 0.95);
	return Math.max(0, high - low);
}

/**
 * @param {{data: Uint8ClampedArray, width: Number, height: Number}} imageData
 * @returns {Boolean} light ink on dark paper
 */
export function guessLightInk(imageData) {
	const sample = sampleGray(imageData);
	if (!sample) return false;
	const { gray, width, height } = sample;
	const cut = otsuThreshold(gray);
	const x0 = Math.floor(width / 4);
	const x1 = Math.max(x0 + 1, Math.ceil((3 * width) / 4));
	const y0 = Math.floor(height / 4);
	const y1 = Math.max(y0 + 1, Math.ceil((3 * height) / 4));
	let dark = 0;
	let all = 0;
	for (let y = y0; y < Math.min(height, y1); y++) {
		for (let x = x0; x < Math.min(width, x1); x++) {
			if (gray[y * width + x] < cut) dark++;
			all++;
		}
	}
	return all > 0 && dark / all > LIGHT_INK_SHARE;
}

/**
 * @param {{bytes?: Uint8Array | ArrayBuffer, imageData?: Object}} source - the picked file's
 *   bytes (for its EXIF) and the decoded image (for its paper); either may be missing
 * @returns {{kind: 'photo' | 'scan', reason: 'camera' | 'uneven' | 'even', spread: Number,
 *   lightInk: Boolean, camera: Array<String>}}
 */
export function paperKind({ bytes, imageData } = {}) {
	const exif = bytes ? readExif(bytes) : null;
	const camera = exif?.jpeg ? exif.camera : [];
	const lightInk = imageData ? guessLightInk(imageData) : false;
	const spread = imageData ? paperSpread(imageData, { lightInk }) : 0;
	let kind = 'scan';
	let reason = 'even';
	if (camera.length >= MIN_CAMERA_FIELDS) {
		kind = 'photo';
		reason = 'camera';
	} else if (spread > PHONE_SPREAD) {
		kind = 'photo';
		reason = 'uneven';
	}
	return { kind, reason, spread, lightInk, camera };
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** Gray of a copy at most PAPER_SAMPLE_SIDE long; null for an image with no pixels. */
function sampleGray(imageData) {
	const width = Number(imageData?.width);
	const height = Number(imageData?.height);
	if (
		!(width > 0) ||
		!(height > 0) ||
		!imageData.data ||
		imageData.data.length < width * height * 4
	) {
		return null;
	}
	const { imageData: small } = downscaleImageData(imageData, PAPER_SAMPLE_SIDE);
	return { gray: toGray(small), width: small.width, height: small.height };
}

/** The gray level below which `share` of the values lie. */
function percentile(hist, total, share) {
	const want = total * share;
	let seen = 0;
	for (let k = 0; k < 256; k++) {
		seen += hist[k];
		if (seen > want) return k;
	}
	return 255;
}
