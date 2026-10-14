// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement fixtures (docs/UX-BEGINNER.md section 10, B3): draws two synthetic handwriting
// photos in real Chrome with canvas strokes of ONE pen width, and saves them with an answer key
// under src/anyink/placement/tests/fixtures/:
//   brennan-hand.png / .json   "B r e n a H d" in one row, the How card's first try
//   tails-row.png / .json      "a g B Q f ." in one row: a hooked g tail, a Q tail that dips
//                              under its bowl, a dropping f, a period
// Like a felt-tip page photographed in even-ish light: off-white paper with a soft brightness
// falloff, near-black ink with soft edges (a 0.8 px blur), a few paper specks, and the wobble
// of real handwriting: each letter a little bigger or smaller (up to 5 %), a little off the
// line (up to 3 px) and a little tilted (up to 1.2 degrees). Handwriting proportions, not a
// font's: small letters 60 % of a capital, tall letters 106 %, tails 44 % under the line.
// The wobble is a fixed list, so the files are the same on every run.
// Usage: node tests/placement-fixture.mjs
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../src/anyink/placement/tests/fixtures/', import.meta.url));
await mkdir(out, { recursive: true });

// Letter skeletons in cap units: capitals 100 tall, the writing line at y = 0, y down.
const STROKES = {
	B: 'M0 0 L0 -100 M0 -100 L28 -100 C58 -100 58 -52 28 -52 L0 -52 M0 -52 L32 -52 C66 -52 66 0 32 0 L0 0',
	r: 'M0 0 L0 -60 M0 -36 C6 -54 20 -62 38 -58',
	e: 'M2 -30 L46 -30 C46 -50 36 -62 23 -62 C8 -62 0 -48 0 -30 C0 -10 11 0 25 0 C35 0 42 -4 46 -12',
	n: 'M0 0 L0 -60 M0 -40 C6 -55 16 -62 27 -62 C39 -62 45 -54 45 -40 L45 0',
	a: 'M44 -40 C40 -55 32 -62 22 -62 C8 -62 0 -48 0 -30 C0 -11 9 0 21 0 C33 0 41 -11 44 -26 M44 -60 L44 0',
	H: 'M0 0 L0 -100 M56 0 L56 -100 M0 -50 L56 -50',
	d: 'M44 -40 C40 -55 32 -62 22 -62 C8 -62 0 -48 0 -30 C0 -11 9 0 21 0 C33 0 41 -11 44 -26 M44 -106 L44 0',
	g: 'M44 -40 C40 -55 32 -62 22 -62 C8 -62 0 -48 0 -30 C0 -11 9 0 21 0 C33 0 41 -11 44 -26 M44 -60 L44 26 C44 40 34 46 22 46 C12 46 4 42 0 36',
	Q: 'M0 -50 A34 50 0 1 0 68 -50 A34 50 0 1 0 0 -50 Z M40 -14 L72 20',
	f: 'M40 -96 C36 -104 28 -106 22 -104 C16 -102 14 -96 14 -88 L14 30 C14 40 8 44 0 40 M0 -60 L34 -60',
	'.': 'M0 -4 L1.5 -5',
};

const PHOTOS = [
	{
		name: 'brennan-hand',
		width: 1500,
		height: 520,
		base: 330,
		letters: [
			{ char: 'B', size: 1.03, dy: 0, angle: -1.0, gap: 0 },
			{ char: 'r', size: 0.97, dy: 2, angle: 0.8, gap: 104 },
			{ char: 'e', size: 1.02, dy: -1, angle: 0.5, gap: 98 },
			{ char: 'n', size: 0.98, dy: 3, angle: -0.6, gap: 102 },
			{ char: 'a', size: 1.04, dy: -2, angle: 1.2, gap: 96 },
			{ char: 'H', size: 0.99, dy: 1, angle: -0.4, gap: 110 },
			{ char: 'd', size: 1.01, dy: -3, angle: 0.9, gap: 100 },
		],
	},
	{
		name: 'tails-row',
		width: 1400,
		height: 560,
		base: 300,
		letters: [
			{ char: 'a', size: 1.0, dy: 1, angle: 0.6, gap: 0 },
			{ char: 'g', size: 1.03, dy: -2, angle: -0.8, gap: 100 },
			{ char: 'B', size: 0.98, dy: 2, angle: 0.4, gap: 104 },
			{ char: 'Q', size: 1.02, dy: -1, angle: -0.5, gap: 96 },
			{ char: 'f', size: 0.97, dy: 2, angle: 1.0, gap: 100 },
			{ char: '.', size: 1.0, dy: 0, angle: 0, gap: 92 },
		],
	},
];
const UNIT = 1.7; // pixels per cap unit: a capital is 170 px tall, about 1 inch at 170 px per inch
const PEN = 11; // one felt-tip width, pixels
const LEFT = 120;

const profile = resolve(tmpdir(), `anyink-placement-fixture-${Date.now()}`);
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B3_BROWSER || 'chrome',
	headless: true,
});
const page = context.pages()[0] || (await context.newPage());
try {
	for (const photo of PHOTOS) {
		const result = await page.evaluate(
			({ photo, strokes, unit, pen, left }) => {
				const { width, height, base } = photo;
				const ink = document.createElement('canvas');
				ink.width = width;
				ink.height = height;
				const ctx = ink.getContext('2d');

				// Paper: off-white, a little darker toward the corners (a phone's uneven light).
				// Drawn tiny and stretched, so it is smooth with no dither (a small PNG).
				const paper = document.createElement('canvas');
				paper.width = 24;
				paper.height = 9;
				const pp = paper.getContext('2d');
				for (let py = 0; py < paper.height; py++) {
					for (let px = 0; px < paper.width; px++) {
						const dx = (px + 0.5) / paper.width - 0.46;
						const dy = (py + 0.5) / paper.height - 0.42;
						const fall = Math.min(1, Math.hypot(dx, dy * 0.6) / 0.62);
						const v = 240 - 26 * fall * fall;
						pp.fillStyle = `rgb(${v}, ${v - 4}, ${v - 13})`;
						pp.fillRect(px, py, 1, 1);
					}
				}
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(paper, 0, 0, width, height);

				// Ink: one pen width for every stroke, so every letter has the same stroke weight
				const pens = document.createElement('canvas');
				pens.width = width;
				pens.height = height;
				const pc = pens.getContext('2d');
				pc.strokeStyle = 'rgb(26, 27, 36)';
				pc.lineWidth = pen;
				pc.lineCap = 'round';
				pc.lineJoin = 'round';
				let x = left;
				const key = [];
				for (const letter of photo.letters) {
					x += letter.gap;
					const s = unit * letter.size;
					const a = (letter.angle * Math.PI) / 180;
					const y0 = base + letter.dy;
					// scale, then tilt about the letter's writing-line start, then move into place
					const m = new DOMMatrix([
						s * Math.cos(a),
						s * Math.sin(a),
						-s * Math.sin(a),
						s * Math.cos(a),
						x,
						y0,
					]);
					const path = new Path2D();
					path.addPath(new Path2D(strokes[letter.char]), m);
					pc.stroke(path);
					// Where this letter's skeleton went: its bounds and its own writing line
					const probe = document.createElement('canvas').getContext('2d');
					probe.canvas.width = width;
					probe.canvas.height = height;
					probe.lineWidth = pen;
					probe.lineCap = 'round';
					probe.lineJoin = 'round';
					probe.stroke(path);
					const data = probe.getImageData(0, 0, width, height).data;
					let l = width,
						r = -1,
						t = height,
						b = -1;
					for (let py = 0; py < height; py++) {
						for (let px = 0; px < width; px++) {
							if (data[(py * width + px) * 4 + 3] < 128) continue;
							if (px < l) l = px;
							if (px > r) r = px;
							if (py < t) t = py;
							if (py > b) b = py;
						}
					}
					key.push({
						char: letter.char,
						x0: x,
						base: y0,
						size: letter.size,
						angle: letter.angle,
						// The writing line under the middle of the letter, after the tilt
						lineAtMiddle: y0 + ((l + r) / 2 - x) * Math.tan(a),
						box: [l, t, r + 1, b + 1],
					});
					x = r + 1;
				}
				// Soft edges, as a camera gives them
				ctx.filter = 'blur(0.8px)';
				ctx.drawImage(pens, 0, 0);
				ctx.filter = 'none';
				// A few paper specks, away from the letters
				ctx.fillStyle = 'rgb(70, 70, 76)';
				for (const [sx, sy, sr] of [
					[60, 60, 1.2],
					[width - 70, height - 50, 1.5],
					[width / 2, 30, 1.0],
				]) {
					ctx.beginPath();
					ctx.arc(sx, sy, sr, 0, Math.PI * 2);
					ctx.fill();
				}
				return { png: ink.toDataURL('image/png'), key };
			},
			{ photo, strokes: STROKES, unit: UNIT, pen: PEN, left: LEFT }
		);
		const bytes = Buffer.from(result.png.split(',')[1], 'base64');
		await writeFile(resolve(out, `${photo.name}.png`), bytes);
		const answer = {
			about:
				'Answer key for the synthetic handwriting photo of the same name (tests/placement-fixture.mjs). Image pixels, y down.',
			width: photo.width,
			height: photo.height,
			unitPx: UNIT,
			penPx: PEN,
			capitalPx: 100 * UNIT,
			smallPx: 60 * UNIT,
			letters: result.key,
		};
		await writeFile(resolve(out, `${photo.name}.json`), `${JSON.stringify(answer, null, '\t')}\n`);
		console.log(`wrote ${photo.name}.png (${bytes.length} bytes) and its answer key`);
	}
} finally {
	await context.close();
}
