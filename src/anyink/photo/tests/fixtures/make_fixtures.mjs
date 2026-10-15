// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core fixtures (docs/UX-BEGINNER.md 4.4 and section 10 B9): draws five handwriting
// photos in real Chrome (Playwright, channel 'chrome') with pen-like strokes and writes them,
// with an answer key each, beside this file:
//   alphabet-loose-phone.jpg / .json  the How card's whole-alphabet page, written loose (about a
//       finger's width between letters, a thumb's width between rows), photographed with a phone:
//       the page turned and in perspective on a table, light falling off toward one corner with
//       a soft hand shadow, camera blur and sensor noise, saved as a JPEG with the camera fields
//       a phone writes in its EXIF (exposure time, f-number, ISO, focal length)
//   alphabet-tight-scan.jpg / .json   the same alphabet written tight (gaps of about a quarter
//       of the small-letter height, rows closer), with : and ; added, through a flatbed scanner
//       at 150 dpi: even light, a 0.3 degree turn on the glass, very little noise, a JPEG whose
//       EXIF names the scanner but holds no camera fields
//   single-j-phone.jpg / .json        one small j filling a phone photo (its dot and its tail),
//       as "Use a photo" on one letter gets it
//   brenna-loose-phone.jpg / .json    the How card's first try, B r e n a H d in one row on a
//   brenna-tight-phone.jpg / .json    landscape page, photographed with a phone, as UX-BEGINNER
//       9.4 describes its two drop fixtures: loose with gaps wider than a capital's height; tight
//       with gaps of about a quarter of the small-letter height and a dotted i at the end (8
//       parts). Synthetic stand-ins until B0's real felt-tip photos exist.
// The hand: one felt-tip width (about 1 mm) with a little width wobble, round pen ends, a 6
// degree lean, every letter a little bigger or smaller, turned and off the line, strokes with a
// slow wobble, pen lifts where a hand lifts (i and j dots, ! ? : ; dots). Letters never overlap
// left to right, so the answer key's one-part-per-letter is exact. The loose page's i dot drifts
// right of its stem; the tight page's i has a fat felt-tip dot. A seeded random source makes the
// files the same on every run with the same Chrome.
// The answer key: per letter its character, row, and box (image pixels, y down, right and bottom
// exclusive, from the stroke skeleton and the pen width), the photo's size and pen width in
// pixels, and the paper kind the detector should pick.
// Usage: node src/anyink/photo/tests/fixtures/make_fixtures.mjs
import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./', import.meta.url));

// --------------------------------------------------------------
// The hand: letter skeletons in cap units (capitals 100 tall, small letters 60, tall letters
// 106, tails 44 under the line; y down, the writing line at 0). Each M starts a pen stroke.
// --------------------------------------------------------------

/** A dot of the pen: a tiny circle the pen width rounds out. */
const dot = (x, y, r = 1.4) =>
	`M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const BOWL_A =
	'M42 -42 C38 -56 30 -62 22 -62 C8 -62 0 -48 0 -30 C0 -12 8 0 20 0 C32 0 40 -10 42 -24';
const BOWL_B = 'C4 -52 14 -62 26 -62 C40 -62 46 -48 46 -30 C46 -12 38 0 24 0 C12 0 4 -8 0 -20';
const OVAL =
	'M30 -102 C12 -102 0 -80 0 -50 C0 -20 12 2 30 2 C48 2 60 -20 60 -50 C60 -80 48 -102 30 -102';

const SKELETONS = {
	A: 'M0 0 L28 -100 L56 0 M12 -42 L44 -42',
	B: 'M0 0 L0 -100 L26 -100 C52 -100 52 -52 26 -52 L0 -52 M0 -52 L30 -52 C60 -52 60 0 30 0 L0 0',
	C: 'M58 -84 C50 -98 38 -102 30 -102 C10 -102 0 -78 0 -50 C0 -20 12 2 32 2 C44 2 54 -4 60 -16',
	D: 'M0 0 L0 -100 L22 -100 C48 -100 60 -78 60 -50 C60 -22 48 0 22 0 L0 0',
	E: 'M50 -100 L0 -100 L0 0 L52 0 M0 -52 L40 -52',
	F: 'M50 -100 L0 -100 L0 0 M0 -52 L40 -52',
	G: 'M58 -84 C50 -98 40 -102 31 -102 C10 -102 0 -78 0 -50 C0 -20 12 2 32 2 C50 2 60 -12 60 -40 L36 -40',
	H: 'M0 0 L0 -100 M56 0 L56 -100 M0 -50 L56 -50',
	I: 'M-12 -100 L12 -100 M0 -100 L0 0 M-12 0 L12 0',
	J: 'M50 -100 L50 -26 C50 -6 40 2 26 2 C12 2 4 -8 2 -20',
	K: 'M0 0 L0 -100 M50 -100 L2 -46 M18 -62 L54 0',
	L: 'M0 -100 L0 0 L46 0',
	M: 'M0 0 L4 -100 L34 -36 L64 -100 L68 0',
	N: 'M0 0 L0 -100 L54 0 L54 -100',
	O: OVAL,
	P: 'M0 0 L0 -100 L26 -100 C54 -100 54 -48 26 -48 L0 -48',
	Q: `${OVAL} M38 -18 L66 14`,
	R: 'M0 0 L0 -100 L26 -100 C54 -100 54 -50 26 -50 L0 -50 M22 -50 L54 0',
	S: 'M54 -86 C48 -98 38 -102 28 -102 C12 -102 2 -92 2 -76 C2 -58 20 -54 30 -50 C46 -44 58 -38 58 -22 C58 -6 46 2 30 2 C16 2 6 -4 0 -16',
	T: 'M0 -100 L60 -100 M30 -100 L30 0',
	U: 'M0 -100 L0 -34 C0 -10 12 2 28 2 C44 2 56 -10 56 -34 L56 -100',
	V: 'M0 -100 L28 0 L56 -100',
	W: 'M0 -100 L18 0 L40 -70 L62 0 L80 -100',
	X: 'M0 -100 L56 0 M56 -100 L0 0',
	Y: 'M0 -100 L28 -50 L56 -100 M28 -50 L28 0',
	Z: 'M2 -100 L56 -100 L0 0 L58 0',
	a: `${BOWL_A} M43 -60 L43 0`,
	b: `M0 -106 L0 0 M0 -34 ${BOWL_B}`,
	c: 'M42 -50 C38 -58 30 -62 22 -62 C8 -62 0 -48 0 -30 C0 -12 8 0 22 0 C32 0 38 -4 42 -12',
	d: `${BOWL_A} M43 -106 L43 0`,
	e: 'M2 -30 L44 -30 C44 -50 34 -62 22 -62 C8 -62 0 -48 0 -30 C0 -12 10 0 24 0 C34 0 40 -4 44 -12',
	f: 'M38 -98 C34 -104 28 -106 22 -106 C14 -106 10 -98 10 -88 L10 0 M0 -60 L32 -60',
	g: `${BOWL_A} M43 -60 L43 26 C43 40 34 44 22 44 C12 44 4 40 0 34`,
	h: 'M0 -106 L0 0 M0 -38 C6 -54 14 -62 26 -62 C38 -62 44 -54 44 -40 L44 0',
	i: `M0 -60 L0 0 ${dot(0, -80)}`,
	j: `M20 -60 L20 26 C20 40 12 44 4 44 C-4 44 -10 40 -12 34 ${dot(20, -80)}`,
	k: 'M0 -106 L0 0 M36 -60 L2 -28 M14 -38 L40 0',
	l: 'M0 -106 L0 0',
	m: 'M0 0 L0 -60 M0 -40 C4 -54 10 -62 18 -62 C28 -62 32 -54 32 -42 L32 0 M32 -42 C36 -56 42 -62 50 -62 C60 -62 64 -54 64 -42 L64 0',
	n: 'M0 0 L0 -60 M0 -40 C6 -55 14 -62 24 -62 C36 -62 42 -54 42 -40 L42 0',
	o: 'M23 -62 C8 -62 0 -48 0 -30 C0 -12 8 0 23 0 C38 0 46 -12 46 -30 C46 -48 38 -62 23 -62',
	p: `M0 -60 L0 44 M0 -40 ${BOWL_B}`,
	q: `${BOWL_A} M43 -60 L43 44`,
	r: 'M0 0 L0 -60 M0 -36 C6 -54 18 -62 34 -58',
	s: 'M36 -54 C32 -60 26 -62 20 -62 C8 -62 2 -56 2 -46 C2 -36 12 -33 20 -30 C32 -26 38 -22 38 -14 C38 -4 30 0 20 0 C10 0 4 -4 0 -10',
	t: 'M12 -82 L12 -10 C12 -2 18 2 26 0 M0 -58 L28 -58',
	u: 'M0 -60 L0 -22 C0 -8 8 0 20 0 C32 0 40 -8 42 -20 M42 -60 L42 0',
	v: 'M0 -60 L22 0 L44 -60',
	w: 'M0 -60 L14 0 L30 -44 L46 0 L60 -60',
	x: 'M0 -60 L42 0 M42 -60 L0 0',
	y: 'M0 -60 L22 0 M44 -60 L18 26 C14 38 8 44 -2 44',
	z: 'M0 -60 L40 -60 L0 0 L42 0',
	'.': dot(0, -3, 1.8),
	',': `${dot(2, -4, 1.6)} M3.5 -3 C3.5 4 1 8 -3 12`,
	"'": 'M0 -100 L-2 -82',
	'?': `M0 -84 C2 -98 12 -102 22 -102 C36 -102 44 -94 44 -82 C44 -68 34 -62 26 -56 C22 -52 22 -46 22 -34 ${dot(
		22,
		-4
	)}`,
	'!': `M0 -100 L0 -30 ${dot(0, -4)}`,
	'-': 'M0 -32 L28 -32',
	':': `${dot(0, -50)} ${dot(0, -4)}`,
	';': `${dot(2, -50)} ${dot(2, -4, 1.6)} M3.5 -3 C3.5 4 1 8 -3 12`,
};

/** Variants: the loose page's i dot drifted right; the tight page's fat felt-tip i dot. */
const VARIANTS = {
	'i-drift': `M0 -60 L0 0 ${dot(9, -81)}`,
	'i-fat': `M0 -60 L0 0 ${dot(1, -80, 4.2)}`,
};

/** How far each letter's top and bottom reach, in cap units (for row spacing). */
const ROW_KINDS = {
	caps: { up: 100, down: 0 },
	small: { up: 106, down: 44 },
	marks: { up: 100, down: 12 },
};

const ALPHA_UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const ALPHA_LOWER = [...'abcdefghijklmnopqrstuvwxyz'];

const PHOTOS = [
	{
		name: 'alphabet-loose-phone',
		kind: 'phone',
		paper: 'photo',
		seed: 9101,
		// The page as written, 8.5 x 11 in at 150 px per inch
		page: { width: 1275, height: 1650, dpi: 150 },
		// The photo: 1200 x 1600, the page's corners (top-left, top-right, bottom-right,
		// bottom-left) where the phone saw them: turned about 1.5 degrees, in perspective
		photo: {
			width: 1200,
			height: 1600,
			corners: [
				[104, 118],
				[1083, 96],
				[1146, 1532],
				[64, 1497],
			],
		},
		unit: 0.9, // pixels per cap unit on the page: capitals 0.6 in tall
		pen: 6.5, // cap units: about 1 mm
		left: 135,
		top: 150,
		gap: 52, // about a finger's width at this size, pixels on the page
		gapJitter: 10,
		rowGap: 90, // a thumb's width at this size
		rows: [
			{ kind: 'caps', chars: ALPHA_UPPER.slice(0, 9) },
			{ kind: 'caps', chars: ALPHA_UPPER.slice(9, 18) },
			{ kind: 'caps', chars: ALPHA_UPPER.slice(18) },
			{ kind: 'small', chars: ALPHA_LOWER.slice(0, 9), variants: { i: 'i-drift' } },
			{ kind: 'small', chars: ALPHA_LOWER.slice(9, 18) },
			{ kind: 'small', chars: ALPHA_LOWER.slice(18) },
			{ kind: 'marks', chars: [...".,'?!-"] },
		],
	},
	{
		name: 'alphabet-tight-scan',
		kind: 'scan',
		paper: 'scan',
		seed: 4242,
		page: { width: 1275, height: 1650, dpi: 150 },
		scan: { turn: 0.3 },
		unit: 0.75, // capitals 0.5 in tall
		pen: 7,
		left: 110,
		top: 160,
		gap: 11, // a quarter of the small-letter height (45 px)
		gapJitter: 3,
		rowGap: 45,
		rows: [
			{ kind: 'caps', chars: ALPHA_UPPER.slice(0, 13) },
			{ kind: 'caps', chars: ALPHA_UPPER.slice(13) },
			{ kind: 'small', chars: ALPHA_LOWER.slice(0, 13), variants: { i: 'i-fat' } },
			{ kind: 'small', chars: ALPHA_LOWER.slice(13) },
			{ kind: 'marks', chars: [...".,'?!-:;"] },
		],
	},
	{
		name: 'single-j-phone',
		kind: 'phone',
		paper: 'photo',
		seed: 77,
		page: { width: 900, height: 1200, dpi: 600 },
		photo: {
			width: 900,
			height: 1200,
			corners: [
				[-30, -24],
				[930, -40],
				[948, 1236],
				[-44, 1222],
			],
		},
		unit: 5.6,
		pen: 6.5,
		left: 330,
		top: 0,
		baseline: 730,
		gap: 0,
		gapJitter: 0,
		rowGap: 0,
		rows: [{ kind: 'small', chars: ['j'] }],
	},
	{
		name: 'brenna-loose-phone',
		kind: 'phone',
		paper: 'photo',
		seed: 5150,
		page: { width: 1650, height: 1275, dpi: 150 },
		photo: {
			width: 1600,
			height: 1200,
			corners: [
				[60, 92],
				[1546, 58],
				[1580, 1150],
				[34, 1118],
			],
		},
		unit: 1.2, // capitals 0.8 in tall
		pen: 5, // about 1 mm
		left: 140,
		top: 510,
		gap: 135, // wider than a capital (120 px on the page)
		gapJitter: 7,
		rowGap: 0,
		rows: [{ kind: 'small', chars: [...'BrenaHd'] }],
	},
	{
		name: 'brenna-tight-phone',
		kind: 'phone',
		paper: 'photo',
		seed: 6160,
		page: { width: 1650, height: 1275, dpi: 150 },
		photo: {
			width: 1600,
			height: 1200,
			corners: [
				[96, 70],
				[1570, 110],
				[1548, 1164],
				[70, 1130],
			],
		},
		unit: 1.2,
		pen: 5,
		left: 520,
		top: 510,
		gap: 18, // a quarter of the small-letter height (72 px), about 1/8 in
		gapJitter: 3,
		rowGap: 0,
		rows: [{ kind: 'small', chars: [...'BrenaHdi'] }],
	},
];

// --------------------------------------------------------------
// EXIF (a phone's camera fields, or a scanner's name only), built in Node
// --------------------------------------------------------------

const TYPE_SIZE = { 2: 1, 3: 2, 4: 4, 5: 8 };

/** One IFD entry: { tag, type, values } (ASCII: a string; RATIONAL: [[num, den], ...]) */
function entryBytes({ type, values }) {
	if (type === 2) return { count: values.length + 1, data: Buffer.from(`${values}\0`, 'latin1') };
	const count = values.length;
	const data = Buffer.alloc(count * TYPE_SIZE[type]);
	values.forEach((v, i) => {
		if (type === 3) data.writeUInt16LE(v, i * 2);
		else if (type === 4) data.writeUInt32LE(v, i * 4);
		else {
			data.writeUInt32LE(v[0], i * 8);
			data.writeUInt32LE(v[1], i * 8 + 4);
		}
	});
	return { count, data };
}

/** An IFD at `offset` (from the TIFF header), its values after it; next IFD 0. */
function ifdBytes(entries, offset) {
	const sorted = [...entries].sort((a, b) => a.tag - b.tag);
	const head = Buffer.alloc(2 + 12 * sorted.length + 4);
	head.writeUInt16LE(sorted.length, 0);
	const extra = [];
	let at = offset + head.length;
	sorted.forEach((entry, i) => {
		const { count, data } = entryBytes(entry);
		const base = 2 + i * 12;
		head.writeUInt16LE(entry.tag, base);
		head.writeUInt16LE(entry.type, base + 2);
		head.writeUInt32LE(count, base + 4);
		if (data.length <= 4) data.copy(head, base + 8);
		else {
			head.writeUInt32LE(at, base + 8);
			const padded = data.length % 2 ? Buffer.concat([data, Buffer.alloc(1)]) : data;
			extra.push(padded);
			at += padded.length;
		}
	});
	return Buffer.concat([head, ...extra]);
}

/** The APP1 Exif segment for a phone camera or a scanner. */
function exifSegment(kind, width, height) {
	const ascii = (tag, text) => ({ tag, type: 2, values: text });
	const ifd0 = [
		ascii(0x010f, kind === 'phone' ? 'FixturePhone' : 'FixtureScan'),
		ascii(0x0110, kind === 'phone' ? 'Test Camera 1' : 'Flatbed 150'),
		{ tag: 0x0112, type: 3, values: [1] },
		{ tag: 0x011a, type: 5, values: [[kind === 'phone' ? 72 : 150, 1]] },
		{ tag: 0x011b, type: 5, values: [[kind === 'phone' ? 72 : 150, 1]] },
		{ tag: 0x0128, type: 3, values: [2] },
		ascii(0x0131, kind === 'phone' ? 'Fixture 1.0' : 'Fixture Scan 2.1'),
		{ tag: 0x8769, type: 4, values: [0] }, // the Exif IFD, filled in below
	];
	const exif = [
		{ tag: 0xa001, type: 3, values: [1] },
		{ tag: 0xa002, type: 4, values: [width] },
		{ tag: 0xa003, type: 4, values: [height] },
	];
	if (kind === 'phone') {
		exif.push(
			{ tag: 0x829a, type: 5, values: [[1, 60]] },
			{ tag: 0x829d, type: 5, values: [[18, 10]] },
			{ tag: 0x8827, type: 3, values: [200] },
			ascii(0x9003, '2026:10:14 15:20:00'),
			{ tag: 0x920a, type: 5, values: [[43, 10]] }
		);
	}
	const first = ifdBytes(ifd0, 8);
	ifd0[ifd0.length - 1].values = [8 + first.length];
	const tiff = Buffer.concat([
		Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]),
		ifdBytes(ifd0, 8),
		ifdBytes(exif, 8 + first.length),
	]);
	const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
	const head = Buffer.from([0xff, 0xe1, 0, 0]);
	head.writeUInt16BE(body.length + 2, 2);
	return Buffer.concat([head, body]);
}

/** The JPEG with its JFIF APP0 swapped for the Exif APP1 (as a camera writes it). */
function withExif(jpeg, segment) {
	if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG.');
	let at = 2;
	if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + jpeg.readUInt16BE(4);
	return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(at)]);
}

// --------------------------------------------------------------
// Drawing, in Chrome
// --------------------------------------------------------------

const profile = await mkdtemp(resolve(tmpdir(), 'anyink-photo-fixtures-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B9_BROWSER || 'chrome',
	headless: true,
});
const page = context.pages()[0] || (await context.newPage());
try {
	for (const spec of PHOTOS) {
		const result = await page.evaluate(
			({ spec, skeletons, variants, rowKinds }) => {
				// Seeded random source (mulberry32), so every run draws the same photo
				let state = spec.seed >>> 0;
				const random = () => {
					state = (state + 0x6d2b79f5) >>> 0;
					let t = state;
					t = Math.imul(t ^ (t >>> 15), t | 1);
					t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
					return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
				};
				const between = (a, b) => a + (b - a) * random();
				const gauss = () => {
					const u = Math.max(1e-9, random());
					return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
				};

				// Sample a skeleton: one polyline per pen stroke, every cap unit
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				document.body.appendChild(svg);
				const sample = (d) =>
					d
						.split(/(?=M)/)
						.map((part) => part.trim())
						.filter(Boolean)
						.map((part) => {
							const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
							el.setAttribute('d', part);
							svg.appendChild(el);
							const length = el.getTotalLength();
							const steps = Math.max(2, Math.ceil(length));
							const points = [];
							for (let i = 0; i <= steps; i++) {
								const p = el.getPointAtLength((length * i) / steps);
								points.push([p.x, p.y]);
							}
							el.remove();
							return points;
						});

				const { page: pg, unit } = spec;
				const pageCanvas = document.createElement('canvas');
				pageCanvas.width = pg.width;
				pageCanvas.height = pg.height;
				const pc = pageCanvas.getContext('2d');

				// Paper: off-white with a faint fiber texture
				const paperRGB = spec.kind === 'scan' ? [243, 242, 238] : [246, 243, 235];
				const paperData = pc.createImageData(pg.width, pg.height);
				for (let i = 0; i < pg.width * pg.height; i++) {
					const n = gauss() * (spec.kind === 'scan' ? 1.0 : 1.6);
					paperData.data[i * 4] = paperRGB[0] + n;
					paperData.data[i * 4 + 1] = paperRGB[1] + n;
					paperData.data[i * 4 + 2] = paperRGB[2] + n;
					paperData.data[i * 4 + 3] = 255;
				}
				pc.putImageData(paperData, 0, 0);

				// Ink, on its own layer
				const inkCanvas = document.createElement('canvas');
				inkCanvas.width = pg.width;
				inkCanvas.height = pg.height;
				const ic = inkCanvas.getContext('2d');
				ic.strokeStyle = 'rgb(24, 25, 34)';
				ic.lineCap = 'round';
				ic.lineJoin = 'round';

				const lean = Math.tan((6 * Math.PI) / 180); // the hand leans right
				const letters = [];
				let baseline = spec.baseline ?? spec.top + rowKinds[spec.rows[0].kind].up * unit;
				spec.rows.forEach((row, rowIndex) => {
					const kind = rowKinds[row.kind];
					if (rowIndex > 0) {
						const prev = rowKinds[spec.rows[rowIndex - 1].kind];
						baseline += prev.down * unit + spec.rowGap + kind.up * unit;
					}
					// The hand drifts a little along the row
					const drift = between(-3, 3);
					let x = spec.left;
					row.chars.forEach((char, i) => {
						const d = variants[row.variants?.[char]] || skeletons[char];
						const size = between(0.95, 1.05);
						const turn = (between(-2, 2) * Math.PI) / 180;
						const dy = between(-2.5, 2.5) + (drift * i) / Math.max(1, row.chars.length - 1);
						const s = unit * size;
						const map = ([px, py]) => {
							// lean, then turn, then scale, about the letter's start on the line
							const lx = px - py * lean;
							const rx = lx * Math.cos(turn) - py * Math.sin(turn);
							const ry = lx * Math.sin(turn) + py * Math.cos(turn);
							return [rx * s, ry * s];
						};
						const phase = random() * 100;
						const strokes = sample(d).map((points, k) =>
							points.map(([px, py], j) => {
								// a slow wobble along the stroke, as a hand gives it
								const wob = 0.7 * Math.sin(j / 9 + phase + k) + 0.4 * Math.sin(j / 23 + 2 * phase);
								const wob2 = 0.7 * Math.cos(j / 11 + phase - k) + 0.4 * Math.cos(j / 19 + phase);
								return map([px + wob, py + wob2]);
							})
						);
						const penPx = spec.pen * s;
						const xs = strokes.flat().map((p) => p[0]);
						const minX = Math.min(...xs) - penPx / 2;
						const maxX = Math.max(...xs) + penPx / 2;
						const x0 =
							x - minX + (i === 0 ? 0 : spec.gap + between(-spec.gapJitter, spec.gapJitter));
						const y0 = baseline + dy;
						const placed = strokes.map((points) => points.map(([px, py]) => [x0 + px, y0 + py]));
						// Draw: short segments, the width wobbling a little, round ends
						const wPhase = random() * 10;
						for (const points of placed) {
							for (let j = 1; j < points.length; j++) {
								const w = penPx * (1 + 0.07 * Math.sin(j / 13 + wPhase));
								ic.lineWidth = w;
								ic.beginPath();
								ic.moveTo(points[j - 1][0], points[j - 1][1]);
								ic.lineTo(points[j][0], points[j][1]);
								ic.stroke();
							}
							if (
								points.length === 1 ||
								points.every((p) => p[0] === points[0][0] && p[1] === points[0][1])
							) {
								ic.beginPath();
								ic.arc(points[0][0], points[0][1], penPx / 2, 0, Math.PI * 2);
								ic.fillStyle = ic.strokeStyle;
								ic.fill();
							}
						}
						letters.push({ char, row: rowIndex, points: placed, pen: penPx * 1.07 });
						x = x0 + maxX;
					});
				});
				svg.remove();
				pc.globalAlpha = 0.95;
				pc.drawImage(inkCanvas, 0, 0);
				pc.globalAlpha = 1;
				// Paper dust: tiny dark specks, away from the letters
				pc.fillStyle = 'rgb(90, 88, 84)';
				for (let k = 0; k < (spec.kind === 'scan' ? 14 : 22); k++) {
					pc.beginPath();
					pc.arc(
						between(30, pg.width - 30),
						between(30, pg.height - 30),
						between(0.5, 0.9),
						0,
						Math.PI * 2
					);
					pc.fill();
				}

				// --- To the photo -------------------------------------------------
				let W = pg.width;
				let H = pg.height;
				let toPhoto = (p) => p;
				let pixels;
				if (spec.kind === 'scan') {
					// The page on the scanner glass, turned a little
					const scan = document.createElement('canvas');
					scan.width = W;
					scan.height = H;
					const sc = scan.getContext('2d');
					sc.fillStyle = `rgb(${paperRGB.join(',')})`;
					sc.fillRect(0, 0, W, H);
					const a = (spec.scan.turn * Math.PI) / 180;
					sc.translate(W / 2, H / 2);
					sc.rotate(a);
					sc.translate(-W / 2, -H / 2);
					sc.drawImage(pageCanvas, 0, 0);
					toPhoto = ([px, py]) => [
						W / 2 + (px - W / 2) * Math.cos(a) - (py - H / 2) * Math.sin(a),
						H / 2 + (px - W / 2) * Math.sin(a) + (py - H / 2) * Math.cos(a),
					];
					const soft = document.createElement('canvas');
					soft.width = W;
					soft.height = H;
					const so = soft.getContext('2d');
					// The blur is drawn over a sharp copy: a canvas blur fades the edge pixels to
					// transparent, and a JPEG would turn them into a black frame
					so.drawImage(scan, 0, 0);
					so.filter = 'blur(0.4px)';
					so.drawImage(scan, 0, 0);
					pixels = so.getImageData(0, 0, W, H);
					for (let i = 0; i < W * H; i++) {
						const n = gauss() * 1.1;
						for (let c = 0; c < 3; c++) pixels.data[i * 4 + c] += n;
					}
					so.putImageData(pixels, 0, 0);
					return {
						jpeg: soft.toDataURL('image/jpeg', 0.9),
						width: W,
						height: H,
						letters: letters.map((l) => ({ ...l, points: l.points.map((s) => s.map(toPhoto)) })),
						scale: 1,
					};
				}

				// Phone: the page's corners land where the phone saw them (a homography)
				const { photo } = spec;
				W = photo.width;
				H = photo.height;
				const src = [
					[0, 0],
					[pg.width, 0],
					[pg.width, pg.height],
					[0, pg.height],
				];
				const solve = (from, to) => {
					// 8 x 8 linear system for h11..h32 (h33 = 1)
					const A = [];
					const b = [];
					for (let k = 0; k < 4; k++) {
						const [x, y] = from[k];
						const [u, v] = to[k];
						A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
						b.push(u);
						A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
						b.push(v);
					}
					for (let c = 0; c < 8; c++) {
						let pivot = c;
						for (let r = c + 1; r < 8; r++)
							if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r;
						[A[c], A[pivot]] = [A[pivot], A[c]];
						[b[c], b[pivot]] = [b[pivot], b[c]];
						for (let r = 0; r < 8; r++) {
							if (r === c) continue;
							const f = A[r][c] / A[c][c];
							for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
							b[r] -= f * b[c];
						}
					}
					const h = b.map((v, i) => v / A[i][i]);
					return (x, y) => {
						const w = h[6] * x + h[7] * y + 1;
						return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
					};
				};
				const forward = solve(src, photo.corners);
				const backward = solve(photo.corners, src);
				toPhoto = ([px, py]) => forward(px, py);
				const pageData = pc.getImageData(0, 0, pg.width, pg.height).data;
				const outCanvas = document.createElement('canvas');
				outCanvas.width = W;
				outCanvas.height = H;
				const oc = outCanvas.getContext('2d');
				const img = oc.createImageData(W, H);
				const d = img.data;
				// The light: brighter at the top left, falling off to the bottom right, a soft
				// shadow of the phone and hand at the bottom, a little vignette
				const light = (x, y) => {
					const fx = x / W;
					const fy = y / H;
					let l = 1.0 - 0.28 * (0.55 * fx + 0.45 * fy) ** 1.3;
					const sx = (x - 0.72 * W) / (0.32 * W);
					const sy = (y - 1.02 * H) / (0.22 * H);
					l *= 1 - 0.16 * Math.exp(-(sx * sx + sy * sy));
					const vx = fx - 0.5;
					const vy = fy - 0.5;
					l *= 1 - 0.12 * (vx * vx + vy * vy) * 2;
					return l;
				};
				const grain = (x, y) =>
					6 * Math.sin(x / 7 + Math.sin(y / 40) * 3) + 4 * Math.sin(y / 3.3 + x / 90);
				for (let y = 0; y < H; y++) {
					for (let x = 0; x < W; x++) {
						const [u, v] = backward(x + 0.5, y + 0.5);
						const o = (y * W + x) * 4;
						let r;
						let g;
						let bl;
						if (u >= 0 && v >= 0 && u < pg.width - 1 && v < pg.height - 1) {
							const x0 = Math.floor(u - 0.5);
							const y0 = Math.floor(v - 0.5);
							const fx = u - 0.5 - x0;
							const fy = v - 0.5 - y0;
							const at = (xx, yy) =>
								(Math.max(0, Math.min(pg.height - 1, yy)) * pg.width +
									Math.max(0, Math.min(pg.width - 1, xx))) *
								4;
							const p00 = at(x0, y0);
							const p10 = at(x0 + 1, y0);
							const p01 = at(x0, y0 + 1);
							const p11 = at(x0 + 1, y0 + 1);
							const mix = (c) =>
								(pageData[p00 + c] * (1 - fx) + pageData[p10 + c] * fx) * (1 - fy) +
								(pageData[p01 + c] * (1 - fx) + pageData[p11 + c] * fx) * fy;
							r = mix(0);
							g = mix(1);
							bl = mix(2);
						} else {
							// The table: a brownish wood grain; darker right at the page (its shadow)
							const t = grain(x, y);
							const du = Math.min(Math.abs(u), Math.abs(u - pg.width));
							const dv = Math.min(Math.abs(v), Math.abs(v - pg.height));
							const near = Math.min(
								u < 0 || u > pg.width ? du : 999,
								v < 0 || v > pg.height ? dv : 999
							);
							const shade = 1 - 0.18 * Math.exp(-near / 10);
							r = (128 + t) * shade;
							g = (108 + t * 0.8) * shade;
							bl = (88 + t * 0.6) * shade;
						}
						const l = light(x, y);
						d[o] = r * l;
						d[o + 1] = g * l;
						d[o + 2] = bl * l;
						d[o + 3] = 255;
					}
				}
				oc.putImageData(img, 0, 0);
				// Camera blur, then sensor noise (luminance and a little color)
				const cam = document.createElement('canvas');
				cam.width = W;
				cam.height = H;
				const cc = cam.getContext('2d');
				cc.drawImage(outCanvas, 0, 0);
				cc.filter = 'blur(0.8px)';
				cc.drawImage(outCanvas, 0, 0);
				const shot = cc.getImageData(0, 0, W, H);
				for (let i = 0; i < W * H; i++) {
					const n = gauss() * 3.2;
					shot.data[i * 4] += n + gauss() * 1.4;
					shot.data[i * 4 + 1] += n + gauss() * 1.0;
					shot.data[i * 4 + 2] += n + gauss() * 1.8;
				}
				cc.putImageData(shot, 0, 0);
				// How big a page pixel is in the photo near the middle, for the pen width
				const [ax, ay] = forward(pg.width / 2, pg.height / 2);
				const [bx, by] = forward(pg.width / 2 + 10, pg.height / 2);
				return {
					jpeg: cam.toDataURL('image/jpeg', 0.85),
					width: W,
					height: H,
					letters: letters.map((l) => ({ ...l, points: l.points.map((s) => s.map(toPhoto)) })),
					scale: Math.hypot(bx - ax, by - ay) / 10,
				};
			},
			{ spec, skeletons: SKELETONS, variants: VARIANTS, rowKinds: ROW_KINDS }
		);

		const raw = Buffer.from(result.jpeg.split(',')[1], 'base64');
		const jpeg = withExif(raw, exifSegment(spec.kind, result.width, result.height));
		await writeFile(resolve(out, `${spec.name}.jpg`), jpeg);
		const letters = result.letters.map((letter) => {
			const pen = (letter.pen * result.scale) / 2;
			const all = letter.points.flat();
			const xs = all.map((p) => p[0]);
			const ys = all.map((p) => p[1]);
			const box = [
				Math.floor(Math.min(...xs) - pen),
				Math.floor(Math.min(...ys) - pen),
				Math.ceil(Math.max(...xs) + pen),
				Math.ceil(Math.max(...ys) + pen),
			];
			return {
				char: letter.char,
				row: letter.row,
				box,
				center: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
			};
		});
		const key = {
			about:
				'Answer key for the photo of the same name (src/anyink/photo/tests/fixtures/make_fixtures.mjs). Image pixels, y down; box = [left, top, right, bottom], right and bottom exclusive, from the strokes and the pen width.',
			width: result.width,
			height: result.height,
			kind: spec.kind,
			paper: spec.paper,
			penPx: Math.round(spec.pen * spec.unit * result.scale * 100) / 100,
			rows: spec.rows.length,
			letters,
		};
		await writeFile(resolve(out, `${spec.name}.json`), `${JSON.stringify(key, null, '\t')}\n`);
		console.log(`wrote ${spec.name}.jpg (${jpeg.length} bytes) and its answer key`);
	}
} finally {
	await context.close();
	await rm(profile, { recursive: true, force: true });
}
