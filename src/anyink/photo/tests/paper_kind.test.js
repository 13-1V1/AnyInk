// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core: the Flat scan / Phone photo detector (docs/UX-BEGINNER.md 4.4 "Paper is picked by
// B9's detector: a JPEG with camera fields in its EXIF, or a page whose paper brightness varies by
// more than a set amount across the image, gets Phone photo; anything else gets Flat scan (D-016
// amended)"; section 10 B9 unit test "the paper detector picks Phone photo for the phone
// fixture"). Written before paper_kind.js existed (failed on the missing module).
import { beforeAll, describe, expect, it } from 'vitest';
import {
	CAMERA_FIELDS,
	LIGHT_INK_SHARE,
	PHONE_SPREAD,
	guessLightInk,
	paperKind,
	paperSpread,
	readExif,
} from '../paper_kind.js';
import { loadPhotoFixture } from './fixture_image.js';

const fx = {};
beforeAll(async () => {
	for (const name of [
		'alphabet-loose-phone',
		'alphabet-tight-scan',
		'single-j-phone',
		'brenna-loose-phone',
		'brenna-tight-phone',
		'brennan-hand',
	]) {
		fx[name] = await loadPhotoFixture(name);
	}
}, 60000);

/** A big-endian (Motorola) Exif APP1 with Make and an Exif IFD holding FNumber and ISO. */
function bigEndianJpeg({ camera = true } = {}) {
	const bytes = [];
	const u16 = (v) => bytes.push((v >> 8) & 255, v & 255);
	// TIFF: MM, 42, IFD0 at 8
	const tiff = [];
	const t16 = (v) => tiff.push((v >> 8) & 255, v & 255);
	const t32 = (v) => tiff.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
	tiff.push(0x4d, 0x4d);
	t16(42);
	t32(8);
	// IFD0: 2 entries (Make inline 'Abc\0', ExifIFD pointer), next 0 -> 2 + 24 + 4 = 30 bytes
	t16(2);
	t16(0x010f);
	t16(2);
	t32(4);
	tiff.push(0x41, 0x62, 0x63, 0);
	t16(0x8769);
	t16(4);
	t32(1);
	t32(38);
	t32(0);
	// Exif IFD at 38: FNumber (rational at 68) and ISO (short inline)
	const n = camera ? 2 : 1;
	t16(n);
	if (camera) {
		t16(0x829d);
		t16(5);
		t32(1);
		t32(38 + 2 + 12 * n + 4);
	}
	t16(camera ? 0x8827 : 0xa001);
	t16(3);
	t32(1);
	t16(camera ? 100 : 1);
	t16(0);
	t32(0);
	if (camera) {
		t32(28);
		t32(10);
	}
	u16(0xffd8);
	u16(0xffe1);
	u16(2 + 6 + tiff.length);
	bytes.push(0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff);
	u16(0xffd9);
	return new Uint8Array(bytes);
}

describe('readExif: the camera fields a phone writes', () => {
	it('the phone fixture: a JPEG with Make, Model and the camera fields', () => {
		const exif = readExif(fx['alphabet-loose-phone'].bytes);
		expect(exif.jpeg).toBe(true);
		expect(exif.exif).toBe(true);
		expect(exif.make).toBe('FixturePhone');
		expect(exif.model).toBe('Test Camera 1');
		expect(exif.camera.sort()).toEqual(['exposureTime', 'fNumber', 'focalLength', 'iso']);
	});

	it('the scanner fixture: a JPEG whose EXIF names the scanner but holds no camera field', () => {
		const exif = readExif(fx['alphabet-tight-scan'].bytes);
		expect(exif.jpeg).toBe(true);
		expect(exif.exif).toBe(true);
		expect(exif.make).toBe('FixtureScan');
		expect(exif.camera).toEqual([]);
	});

	it('a PNG is not a JPEG and has no EXIF here', () => {
		expect(readExif(fx['brennan-hand'].bytes)).toEqual({
			jpeg: false,
			exif: false,
			make: '',
			model: '',
			camera: [],
		});
	});

	it('big-endian (Motorola) EXIF reads the same', () => {
		const exif = readExif(bigEndianJpeg());
		expect(exif.make).toBe('Abc');
		expect(exif.camera.sort()).toEqual(['fNumber', 'iso']);
		expect(readExif(bigEndianJpeg({ camera: false })).camera).toEqual([]);
	});

	it('cut-off, empty and nonsense bytes never throw', () => {
		const phone = fx['alphabet-loose-phone'].bytes;
		for (const length of [0, 1, 2, 3, 4, 6, 12, 20, 40, 100, 300]) {
			expect(() => readExif(phone.subarray(0, length))).not.toThrow();
		}
		expect(readExif(null).jpeg).toBe(false);
		expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2])).camera).toEqual([]);
		// the Exif IFD pointer aimed back at IFD0 (a loop), and past the end of the file
		const TIFF = 12; // after FFD8, FFE1, the length and the six bytes of the Exif header
		const loop = bigEndianJpeg();
		loop[TIFF + 33] = 8;
		expect(readExif(loop).make).toBe('Abc');
		expect(readExif(loop).camera).toEqual([]);
		const far = bigEndianJpeg();
		far[TIFF + 32] = 0x7f;
		expect(readExif(far).camera).toEqual([]);
		// an ArrayBuffer is read like the bytes
		expect(readExif(phone.slice().buffer).make).toBe('FixturePhone');
	});

	it('two of the four camera fields are needed (a scanner may write one)', () => {
		expect(CAMERA_FIELDS).toEqual(['exposureTime', 'fNumber', 'iso', 'focalLength']);
		expect(paperKind({ bytes: bigEndianJpeg() }).kind).toBe('photo');
	});
});

describe('paperSpread: how far the paper brightness varies across the photo (gray levels)', () => {
	it('the scan is even; the phone photo falls off toward a corner', () => {
		const scan = paperSpread(fx['alphabet-tight-scan'].image);
		const phone = paperSpread(fx['alphabet-loose-phone'].image);
		expect(scan).toBeLessThan(PHONE_SPREAD / 2);
		expect(phone).toBeGreaterThan(PHONE_SPREAD * 1.5);
	});

	it('an empty or one-pixel image is 0', () => {
		expect(paperSpread({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toBe(0);
		expect(
			paperSpread({ data: new Uint8ClampedArray([200, 200, 200, 255]), width: 1, height: 1 })
		).toBe(0);
	});
});

describe('paperKind: Phone photo or Flat scan, picked for him', () => {
	it('picks Phone photo for the phone fixture (its camera fields)', () => {
		const { bytes, image } = fx['alphabet-loose-phone'];
		expect(paperKind({ bytes, imageData: image })).toMatchObject({
			kind: 'photo',
			reason: 'camera',
		});
		expect(paperKind({ bytes, imageData: image }).spread).toBeGreaterThan(PHONE_SPREAD);
	});

	it('picks Phone photo for the phone fixture with its EXIF gone (sent by a chat app): the uneven paper', () => {
		const { image } = fx['alphabet-loose-phone'];
		expect(paperKind({ imageData: image })).toMatchObject({ kind: 'photo', reason: 'uneven' });
	});

	it('picks Phone photo for the single-letter and the B r e n a H d phone photos', () => {
		for (const name of ['single-j-phone', 'brenna-loose-phone', 'brenna-tight-phone']) {
			const { bytes, image } = fx[name];
			expect(paperKind({ bytes, imageData: image }).kind, name).toBe('photo');
			// and with the EXIF gone, from the light alone
			expect(paperKind({ imageData: image }).kind, name).toBe('photo');
		}
	});

	it('picks Flat scan for the scanner fixture: even paper, no camera fields', () => {
		const { bytes, image } = fx['alphabet-tight-scan'];
		expect(paperKind({ bytes, imageData: image })).toMatchObject({ kind: 'scan', reason: 'even' });
	});

	it('picks Flat scan with nothing to go on', () => {
		expect(paperKind({})).toMatchObject({
			kind: 'scan',
			reason: 'even',
			spread: 0,
			lightInk: false,
		});
	});
});

describe('guessLightInk: light ink on dark paper (a chalkboard, white gel pen on black card)', () => {
	it('dark ink on light paper is not light ink', () => {
		expect(guessLightInk(fx['alphabet-tight-scan'].image)).toBe(false);
		expect(guessLightInk(fx['alphabet-loose-phone'].image)).toBe(false);
		expect(guessLightInk(fx['single-j-phone'].image)).toBe(false);
	});

	it('the scan turned negative is light ink on dark paper', () => {
		const { image } = fx['alphabet-tight-scan'];
		const data = new Uint8ClampedArray(image.data);
		for (let i = 0; i < data.length; i += 4) {
			data[i] = 255 - data[i];
			data[i + 1] = 255 - data[i + 1];
			data[i + 2] = 255 - data[i + 2];
		}
		const negative = { data, width: image.width, height: image.height };
		expect(guessLightInk(negative)).toBe(true);
		expect(paperKind({ imageData: negative }).lightInk).toBe(true);
		expect(LIGHT_INK_SHARE).toBe(0.5);
	});
});
