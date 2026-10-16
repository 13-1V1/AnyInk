// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for B9 photo-core: reads the photo fixtures the way the app sees them, in Node
	(vitest). Not shipped.
	- loadPhotoFixture(name) -> { bytes, image, key }: the file's bytes (for the EXIF reader),
	  the decoded pixels ({ data: RGBA Uint8ClampedArray, width, height }; JPEGs through sharp, the
	  same libjpeg-turbo family Chrome decodes with; PNGs through placement's decodePng; the
	  first-timer photos are the WebP images the app stored, which sharp's libwebp decodes to the
	  same pixels Chrome does) and the answer key written by fixtures/make_fixtures.mjs or
	  fixtures/make_firsttimer.mjs (placement's own key for brennan-hand). stray-dot-phone is the
	  B10 + B11 critic's IMG_5012 (B r e n a H d, e written 1.62 times too big, a dipping, a
	  stray pen dot under the row between r and e), stored by Chrome the same way.
	- keyHolder(parts, key) -> for each key letter, the parts whose box holds its center.
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodePng } from '../../placement/tests/fixture_photo.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Where each fixture lives: this folder, or placement's for the B3 row. */
const FILES = {
	'alphabet-loose-phone': join(here, 'fixtures', 'alphabet-loose-phone'),
	'alphabet-tight-scan': join(here, 'fixtures', 'alphabet-tight-scan'),
	'single-j-phone': join(here, 'fixtures', 'single-j-phone'),
	'brenna-loose-phone': join(here, 'fixtures', 'brenna-loose-phone'),
	'brenna-tight-phone': join(here, 'fixtures', 'brenna-tight-phone'),
	'brennan-hand': join(here, '..', '..', 'placement', 'tests', 'fixtures', 'brennan-hand'),
	'first-try-phone': join(here, 'fixtures', 'first-try-phone'),
	'notebook-alphabet-phone': join(here, 'fixtures', 'notebook-alphabet-phone'),
	'single-g-phone': join(here, 'fixtures', 'single-g-phone'),
	'stray-dot-phone': join(here, 'fixtures', 'stray-dot-phone'),
};

/** The file kind of each fixture that is not a JPEG. */
const EXTENSION = {
	'brennan-hand': 'png',
	'first-try-phone': 'webp',
	'notebook-alphabet-phone': 'webp',
	'single-g-phone': 'webp',
	'stray-dot-phone': 'webp',
};

/**
 * @param {String} name - a key of FILES
 * @returns {Promise<{bytes: Uint8Array, image: Object, key: Object}>}
 */
export async function loadPhotoFixture(name) {
	const base = FILES[name];
	const extension = EXTENSION[name] || 'jpg';
	const png = extension === 'png';
	const bytes = new Uint8Array(readFileSync(`${base}.${extension}`));
	const key = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
	if (png) return { bytes, image: decodePng(bytes), key };
	const { data, info } = await sharp(bytes)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const image = {
		data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
		width: info.width,
		height: info.height,
	};
	return { bytes, image, key };
}

/** The middle of a key letter: the photo-core key has `center`, placement's has `box` only. */
export function keyCenter(letter) {
	if (Array.isArray(letter.center)) return letter.center;
	const [l, t, r, b] = letter.box;
	return [(l + r) / 2, (t + b) / 2];
}

/**
 * @param {Array<Object>} parts
 * @param {Object} key
 * @returns {Array<Array<Object>>} per key letter, the parts holding its middle
 */
export function keyHolder(parts, key) {
	return key.letters.map((letter) => {
		const [x, y] = keyCenter(letter);
		return parts.filter((p) => x >= p.left && x < p.right && y >= p.top && y < p.bottom);
	});
}
