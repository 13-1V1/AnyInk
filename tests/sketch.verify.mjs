// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S1 real-browser check (docs/SKETCH.md section 11, S1 step 14), in Chrome with a throwaway
// profile, on tests/sketch.html. For each stored sketch (n, o, s, A, a circle), with ink lines,
// extremes, ink and handles on:
//   A. the page draws: no page or console error, the canvas holds ink, centerline and guide
//      pixels, every piece swept to ink, the extremes marked; the sketch is valid and its edge
//      points are already where the edge rule puts them
//   B. the built curves pass through every one of their points (within 1e-6 units)
//   C. every given direction (a level or plumb lock, an aim) is met within 0.1 degree where the
//      curve leaves and arrives at its point
//   D. stuck points draw filled (on a line, on another piece, or shared: the n's join is on its
//      stem), and no label (point name, piece name, lock answer, extreme tag) lies over another
// and a screenshot of the page per sketch.
// Usage: node tests/sketch.verify.mjs [screenshot folder]   (default: the OS temp folder)
// SKETCH_ORIGIN=http://localhost:5174 uses a running `npm run pages` instead of its own server.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-s1-sketch'));
await mkdir(shots, { recursive: true });

let server = null;
let origin = process.env.SKETCH_ORIGIN;
if (!origin) {
	server = await createServer({
		root: repo,
		configFile: false,
		logLevel: 'error',
		cacheDir: resolve(tmpdir(), 'anyink-s1-sketch-vite'),
		server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
	});
	await server.listen();
	origin = `http://127.0.0.1:${server.httpServer.address().port}`;
}
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-s1-sketch-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.S1_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1300, height: 1000 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
const pass = (message) => console.log(`PASS ${message}`);

/** Counts canvas pixels by kind: background, dark (ink / centerline), colored (guides, marks) */
const pixels = () =>
	page.evaluate(() => {
		const canvas = document.getElementById('view');
		const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
		const bg = data.slice(0, 4);
		let painted = 0;
		let dark = 0;
		let colored = 0;
		for (let i = 0; i < data.length; i += 4) {
			const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
			if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 6) continue;
			painted++;
			if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colored++;
			else if (r + g + b < 3 * 200) dark++;
		}
		return { painted, dark, colored, total: data.length / 4 };
	});

try {
	await page.goto(`${origin}/tests/sketch.html`);
	await page.waitForFunction(() => window.anyinkSketchPage?.ready === true);
	const names = await page.evaluate(() => window.anyinkSketchPage.names);
	assert.deepEqual(names, ['n', 'o', 's', 'A', 'circle']);

	let directions = 0;
	for (const name of names) {
		const checks = await page.evaluate((n) => {
			window.anyinkSketchPage.show(n);
			return window.anyinkSketchPage.setToggles({
				inkLines: true,
				extremes: true,
				ink: true,
				handles: true,
			});
		}, name);
		const px = await pixels();
		await page.screenshot({ path: resolve(shots, `sketch-${name}.png`), fullPage: true });
		const shown = await page.evaluate(() => document.getElementById('checks').textContent);
		console.log(
			`  ${name.padEnd(6)} pieces ${checks.pieces}  cubics ${checks.cubics}  points ${
				checks.points
			}  ` +
				`miss ${checks.maxMiss.toExponential(1)}  directions ${checks.directions}  ` +
				`worst ${checks.maxDirError.toFixed(4)} deg  ink outlines ${checks.inkOutlines}  extremes ${
					checks.extremeMarks
				}  ` +
				`pixels ${px.painted} (dark ${px.dark}, colored ${px.colored})`
		);

		// A. the page draws
		assert.equal(checks.name, name);
		assert.equal(checks.valid, true, checks.problems.join('; '));
		assert.equal(checks.placed, true, `${name}: edge points not where the edge rule puts them`);
		assert.ok(checks.inkOutlines >= checks.pieces, `${name}: ${checks.inkOutlines} ink outlines`);
		assert.ok(
			checks.extremeMarks >= 4 * checks.pieces - 4,
			`${name}: ${checks.extremeMarks} extremes`
		);
		assert.equal(checks.bumpy, 0, `${name}: bumpy`);
		assert.ok(px.painted > 0.03 * px.total, `${name}: only ${px.painted} painted pixels`);
		assert.ok(px.dark > 2000, `${name}: ${px.dark} dark pixels (ink and centerline)`);
		assert.ok(px.colored > 1000, `${name}: ${px.colored} colored pixels (guides, marks)`);
		assert.ok(!/NO /.test(shown), `${name}: the page's own checks say NO:\n${shown}`);
		pass(
			`${name}: the page draws (${checks.pieces} pieces, ${checks.inkOutlines} ink outlines, ${checks.extremeMarks} extremes, ${px.painted} pixels painted)`
		);

		// B. curves through every point
		assert.ok(checks.points > 0);
		assert.ok(checks.maxMiss < 1e-6, `${name}: misses a point by ${checks.maxMiss}`);
		pass(
			`${name}: the curves pass through all ${
				checks.points
			} points (worst ${checks.maxMiss.toExponential(1)} units)`
		);

		// C. given directions met
		assert.ok(
			checks.maxDirError < 0.1,
			`${name}: a direction off by ${checks.maxDirError} degrees`
		);
		directions += checks.directions;

		// D. filled points and labels apart
		if (name === 'n') {
			assert.ok(checks.filled.includes('join'), `n: join (on the stem) draws hollow: ${checks.filled}`);
		}
		assert.ok(checks.labels > 0, `${name}: no labels`);
		assert.equal(checks.labelOverlaps, 0, `${name}: ${checks.labelOverlaps} labels over another`);
		pass(`${name}: ${checks.filled.length} stuck points filled; ${checks.labels} labels, none over another`);
		pass(
			`${name}: ${checks.directions} given directions met (worst ${checks.maxDirError.toFixed(
				4
			)} degrees)`
		);
	}
	assert.ok(directions >= 20, `only ${directions} directions checked`);

	// the toggles change the picture: ink lines and extremes off paint fewer colored pixels
	await page.evaluate(() => window.anyinkSketchPage.show('o'));
	const on = await pixels();
	await page.evaluate(() =>
		window.anyinkSketchPage.setToggles({ inkLines: false, extremes: false, handles: false })
	);
	const off = await pixels();
	assert.ok(
		off.colored < on.colored,
		`toggles: ${off.colored} colored pixels off, ${on.colored} on`
	);
	await page.screenshot({ path: resolve(shots, 'sketch-o-plain.png'), fullPage: true });
	pass(
		`the ink lines and extremes toggles draw and clear (${on.colored} -> ${off.colored} colored pixels)`
	);

	assert.deepEqual(errors, []);
	pass(`no page or console errors; ${directions} directions in all; screenshots in ${shots}`);
} catch (error) {
	console.error('FAIL', error.message);
	if (errors.length) console.error(errors.join('\n'));
	process.exitCode = 1;
} finally {
	await context.close();
	if (server) await server.close();
}
