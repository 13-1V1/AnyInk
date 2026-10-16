// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16, for tests/beginner.verify.mjs T3: the stroke weight of each letter as written in a fixture
// photo, by the same measure the script uses on the built font (twice the median distance from
// the middle of a stroke to its edge), so the font's spread can be read against the photo's own.
// The drawn fixtures give their pen a little width wobble (src/anyink/photo/tests/fixtures/
// make_fixtures.mjs: 7 %), so a short letter can come out thinner on the paper itself; T3 asks
// that the app keeps each letter's pen as written, which this makes measurable.
//   photoWeights(jpgPath, answerKeyPath) -> Promise<Map<char, px>>
//   weightSpread(weights) -> [{ char, weight, off }]   off: % from the median
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

/** The photo is looked at this many times larger, so the measure has pixels to work with. */
const UP = 6;
const PAD = 8;

export async function photoWeights(jpgPath, keyPath) {
	const key = JSON.parse(await readFile(keyPath, 'utf8'));
	const out = new Map();
	for (const letter of key.letters) {
		const [l, t, r, b] = letter.box;
		const w0 = r - l + 2 * PAD;
		const h0 = b - t + 2 * PAD;
		const { data, info } = await sharp(jpgPath)
			.extract({ left: l - PAD, top: t - PAD, width: w0, height: h0 })
			.resize(w0 * UP, h0 * UP, { kernel: 'cubic' })
			.greyscale()
			.raw()
			.toBuffer({ resolveWithObject: true });
		out.set(letter.char, ridgeWeight(data, info.width, info.height) / UP);
	}
	return out;
}

/** Twice the median ridge distance (chamfer 3-4) of the dark pixels, in pixels. */
function ridgeWeight(gray, W, H) {
	let min = 255;
	let max = 0;
	for (const v of gray) {
		min = Math.min(min, v);
		max = Math.max(max, v);
	}
	const cut = (min + max) / 2;
	const d = new Float32Array(W * H);
	for (let i = 0; i < W * H; i++) if (gray[i] < cut) d[i] = 1e9;
	const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const i = y * W + x;
			if (!d[i]) continue;
			d[i] = Math.min(d[i], get(x - 1, y) + 3, get(x, y - 1) + 3, get(x - 1, y - 1) + 4, get(x + 1, y - 1) + 4);
		}
	for (let y = H - 1; y >= 0; y--)
		for (let x = W - 1; x >= 0; x--) {
			const i = y * W + x;
			if (!d[i]) continue;
			d[i] = Math.min(d[i], get(x + 1, y) + 3, get(x, y + 1) + 3, get(x + 1, y + 1) + 4, get(x - 1, y + 1) + 4);
		}
	const ridge = [];
	for (let y = 1; y < H - 1; y++)
		for (let x = 1; x < W - 1; x++) {
			const v = d[y * W + x];
			if (!v) continue;
			let top = true;
			for (let oy = -1; oy <= 1 && top; oy++)
				for (let ox = -1; ox <= 1; ox++) if (d[(y + oy) * W + x + ox] > v) top = false;
			if (top) ridge.push(v / 3);
		}
	ridge.sort((a, b) => a - b);
	return ridge.length ? 2 * ridge[Math.floor(ridge.length / 2)] : 0;
}

export function weightSpread(weights) {
	const list = [...weights];
	const values = list.map(([, w]) => w).sort((a, b) => a - b);
	const mid = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
	return list.map(([char, weight]) => ({
		char,
		weight: Math.round(weight * 100) / 100,
		off: Math.round((Math.abs(weight - mid) / mid) * 1000) / 10,
	}));
}
