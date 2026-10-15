// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core fixtures (docs/UX-BEGINNER.md 4.4, section 10 B9): the three phone photos of the
// B8 + B9 first-timer walk, stored the way the app stores a photo, with answer keys.
//   first-try-phone.webp / .json        IMG_4127: "B r e n a H d" on printer paper, held
//       landscape; a hand shadow over one corner reaching the photo's bottom edge, a gray finger
//       smudge just under the e, n written touching a
//   notebook-alphabet-phone.webp / .json   IMG_4131: the whole alphabet and . , ' ? ! - on
//       wide-ruled notebook paper, held portrait (stored sideways, EXIF Orientation 6); blue
//       ruled lines, a 2 px red margin line, three punch holes, a shadow over the top right, a
//       smudge between g and h, a crossed-out Q, V touching W and l touching m
//   single-g-phone.webp / .json         IMG_4133: one big g, the phone held close, a shadow band
//       across the bottom reaching the photo's left edge
// How: firsttimer_photos.py draws the JPEGs (Pillow); then, in real Chrome, the app's own
// trace/bitmap_cache.js decodeImageFile turns each upright, caps its long side at 2000 px and
// encodes it (WebP, 0.92), exactly the stored image the parts are found on; those bytes are
// written here. sharp decodes these WebP files to the same pixels Chrome does (checked: the same
// parts, box for box). The keys map the generator's page coordinates through each photo's
// page-to-frame perspective and the 2000 px cap: per letter its character, row, box (image
// pixels, y down, right and bottom exclusive; the box round its turned corners) and center; the
// letters written touching (one part each), the crossed-out letter, and where the smudges,
// punch holes, the margin line and the shadow lie.
// Usage: node src/anyink/photo/tests/fixtures/make_firsttimer.mjs
// (needs Python 3 with Pillow and NumPy, Windows' Ink Free font, and Chrome)
import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = fileURLToPath(new URL('./', import.meta.url));
const src = resolve(here, '..', '..', '..', '..');

const PHOTOS = [
	{ file: 'IMG_4127.JPG', name: 'first-try-phone' },
	{ file: 'IMG_4131.JPG', name: 'notebook-alphabet-phone' },
	{ file: 'IMG_4133.JPG', name: 'single-g-phone' },
];

const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-firsttimer-'));
execFileSync('python', [resolve(here, 'firsttimer_photos.py'), scratch], { stdio: 'inherit' });
const drawn = JSON.parse(await readFile(resolve(scratch, 'boxes.json'), 'utf8'));

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: process.env.B9_BROWSER || 'chrome' });
try {
	const page = await browser.newPage();
	await page.goto(`${origin}/anyink/trace/bitmap_cache.js`);
	for (const { file, name } of PHOTOS) {
		const bytes = await readFile(resolve(scratch, file));
		const stored = await page.evaluate(
			async ({ b64, file, origin }) => {
				const { decodeImageFile } = await import(`${origin}/anyink/trace/bitmap_cache.js`);
				const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
				const decoded = await decodeImageFile(new File([raw], file, { type: 'image/jpeg' }));
				const out = new Uint8Array(await decoded.blob.arrayBuffer());
				let text = '';
				for (let i = 0; i < out.length; i += 0x8000) {
					text += String.fromCharCode(...out.subarray(i, i + 0x8000));
				}
				return { b64: btoa(text), width: decoded.width, height: decoded.height };
			},
			{ b64: bytes.toString('base64'), file, origin }
		);
		await writeFile(resolve(here, `${name}.webp`), Buffer.from(stored.b64, 'base64'));
		const key = answerKey(drawn[file.replace(/\.JPG$/, '')], stored);
		await writeFile(resolve(here, `${name}.json`), `${JSON.stringify(key, null, '\t')}\n`);
		console.log(name, stored.width, 'x', stored.height, key.letters.length, 'letters');
	}
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true });
}

/** The answer key of one photo, in the stored image's pixels. */
function answerKey(meta, stored) {
	const [pw, ph] = meta.page;
	const toFrame = homography(
		[
			[0, 0],
			[pw, 0],
			[pw, ph],
			[0, ph],
		],
		meta.corners
	);
	const k = stored.width / meta.frame[0];
	const [ox, oy] = meta.offset || [0, 0];
	const at = ([x, y]) => toFrame([x - ox, y - oy]).map((v) => round1(v * k));
	const boxOf = ([l, t, r, b]) => {
		const corners = [at([l, t]), at([r, t]), at([r, b]), at([l, b])];
		const xs = corners.map((c) => c[0]);
		const ys = corners.map((c) => c[1]);
		return [
			Math.floor(Math.min(...xs)),
			Math.floor(Math.min(...ys)),
			Math.ceil(Math.max(...xs)),
			Math.ceil(Math.max(...ys)),
		];
	};
	const crossed = meta.crossedOut || null;
	const letters = [];
	let crossedOut = null;
	meta.rows.forEach((row, r) =>
		row.forEach((letter, i) => {
			const [l, t, rr, b] = letter.box;
			const entry = {
				char: letter.char,
				row: r,
				box: boxOf(letter.box),
				center: at([(l + rr) / 2, (t + b) / 2]),
			};
			if (crossed && crossed[0] === r && crossed[1] === i) crossedOut = entry;
			else letters.push(entry);
		})
	);
	const radius = (r) => round1((r * k * (meta.corners[1][0] - meta.corners[0][0])) / pw);
	const key = {
		about:
			'Answer key for the photo of the same name (make_firsttimer.mjs). Stored image pixels, y down; box = [left, top, right, bottom], right and bottom exclusive.',
		width: stored.width,
		height: stored.height,
		kind: 'phone',
		paper: 'photo',
		rows: meta.rows.length,
		letters,
		touching: meta.touching || [],
		crossedOut,
		smudges: (meta.smudges || []).map((s) => ({ center: at(s.center), radius: radius(s.radius) })),
		holes: (meta.holes || []).map((center) => ({ center: at(center), radius: radius(40) })),
		marginLine: meta.marginX
			? {
					top: at([meta.marginX, 0]),
					bottom: at([meta.marginX, ph]),
			  }
			: null,
		shadow: meta.shadow.map(([x, y]) => [round1(x * k), round1(y * k)]),
	};
	return key;
}

/** The perspective map taking four points to four others (as Pillow's PERSPECTIVE solves it). */
function homography(from, to) {
	const a = [];
	const b = [];
	from.forEach(([x, y], i) => {
		const [u, v] = to[i];
		a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
		a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
		b.push(u, v);
	});
	const h = solve(a, b);
	return ([x, y]) => {
		const w = h[6] * x + h[7] * y + 1;
		return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
	};
}

/** Gaussian elimination with partial pivoting. */
function solve(a, b) {
	const n = b.length;
	const m = a.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c++) {
		let pivot = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
		[m[c], m[pivot]] = [m[pivot], m[c]];
		for (let r = 0; r < n; r++) {
			if (r === c) continue;
			const f = m[r][c] / m[c][c];
			for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
		}
	}
	return m.map((row, i) => row[n] / row[i]);
}

function round1(value) {
	return Math.round(value * 10) / 10;
}
