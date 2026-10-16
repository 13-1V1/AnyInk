// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S3 real-browser check of the Thickness slider and the sketch card (docs/SKETCH.md section 3), in
// Chrome with a throwaway profile, on tests/sketch_thickness.html:
//   A. the card: Thickness right under the header with "0.07 in wide on 1 in capitals"; Fine-tune
//      shows Sketch (way, Ends, Use this thickness on all letters); no page or console error
//   B. a real mouse drag of the slider: the see-through layer shows ink while dragging, the
//      readout follows, no step and no change to the letter until the release; the release is
//      ONE step, the ink rebuilt at the new width, the layer empty again; timing of the real
//      sweep per frame
//   C. Esc while dragging: no step, the slider and the readout back where they were
//   D. Undo takes the thickness back
//   E. Use this thickness on all letters: every sketched letter at the open one's thickness, ONE
//      whole-font step (a pre / post pair), the "Rebuilding letters..." pill gone at the end
// and a screenshot. Usage: node tests/sketch_thickness.verify.mjs [screenshot folder]
// SKETCH_ORIGIN=http://localhost:5174 uses a running `npm run pages` instead of its own server.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-s3-thickness'));
await mkdir(shots, { recursive: true });

let server = null;
let origin = process.env.SKETCH_ORIGIN;
if (!origin) {
	server = await createServer({
		root: repo,
		configFile: false,
		logLevel: 'error',
		cacheDir: resolve(tmpdir(), 'anyink-s3-thickness-vite'),
		server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
	});
	await server.listen();
	origin = `http://127.0.0.1:${server.httpServer.address().port}`;
}
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-s3-thickness-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.S3_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1100, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
const pass = (message) => console.log(`PASS ${message}`);

/** What the page's font holds now */
const facts = () =>
	page.evaluate(() => {
		const { editor, LETTERS, ids } = window.anyinkThicknessPage;
		const n = editor.project.getItem(ids.N_ID);
		const stem = n.shapes.filter((shape) => shape.anyink?.sketchId === 1).map((s) => s.maxes);
		return {
			steps: editor.history.queue.length,
			top: editor.history.queue[0]?.title || '',
			second: editor.history.queue[1]?.title || '',
			n: n.anyink.sketch.thickness,
			stemWidth: Math.max(...stem.map((b) => b.xMax)) - Math.min(...stem.map((b) => b.xMin)),
			font: editor.project.settings.anyink?.sketchThickness ?? null,
			all: Object.keys(LETTERS).map((id) => editor.project.getItem(id).anyink.sketch.thickness),
			json: JSON.stringify(n.save()),
		};
	});

/** Ink pixels on the see-through layer */
const layerInk = () =>
	page.evaluate(() => {
		const layer = document.querySelector('canvas.anyink-sketch-thickness-layer');
		if (!layer) return -1;
		const { data } = layer.getContext('2d').getImageData(0, 0, layer.width, layer.height);
		let painted = 0;
		for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
		return painted;
	});

const readout = () => page.locator('[data-anyink-sketch="readout"]').textContent();

try {
	await page.goto(`${origin}/tests/sketch_thickness.html`);
	await page.waitForFunction(() => window.anyinkThicknessPage?.ready === true);

	// A
	const sections = await page.$$eval('[data-anyink-card]', (els) =>
		els.map((el) => el.dataset.anyinkCard)
	);
	assert.equal(sections[0], 'header');
	assert.equal(sections[1], 'sketch');
	assert.equal(await readout(), '0.07 in wide on 1 in capitals');
	assert.equal(await page.locator('[data-anyink-fine="sketch"]').count(), 1);
	assert.equal(await page.locator('[data-anyink-ends]').count(), 2);
	assert.equal(await page.locator('[data-anyink-action="thicknessOnAll"]').count(), 1);
	pass('A: Thickness under the header, "0.07 in wide on 1 in capitals", Fine-tune > Sketch');

	// B: a real drag
	const start = await facts();
	const slider = page.locator('.anyink-sketch-thickness__slider');
	const box = await slider.boundingBox();
	const min = Number(await slider.getAttribute('min'));
	const max = Number(await slider.getAttribute('max'));
	const xAt = (value) => box.x + 8 + ((value - min) / (max - min)) * (box.width - 16);
	await page.mouse.move(xAt(99), box.y + box.height / 2);
	await page.mouse.down();
	const sweepTimes = [];
	for (let i = 1; i <= 20; i++) {
		await page.mouse.move(xAt(99 + i * 5), box.y + box.height / 2);
		await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
	}
	await page.evaluate(
		() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
	);
	const mid = await facts();
	const inkDuring = await layerInk();
	const shownDuring = await readout();
	assert.equal(mid.steps, start.steps, 'no step while dragging');
	assert.equal(mid.json, start.json, 'the letter is unchanged while dragging');
	assert.ok(inkDuring > 1000, `the layer shows the ink while dragging (${inkDuring} px)`);
	assert.notEqual(shownDuring, '0.07 in wide on 1 in capitals');
	await page.screenshot({ path: resolve(shots, 'sketch_thickness_drag.png') });
	const ticks = await page.evaluate(() => window.anyinkThicknessPage.counts.ticks);
	assert.ok(ticks >= 5 && ticks <= 21, `one tick a frame at most (${ticks} for 20 moves)`);
	await page.mouse.up();
	await page.waitForTimeout(100);
	assert.equal(await layerInk(), 0, 'the layer is cleared once the real ink is drawn');
	const after = await facts();
	assert.equal(after.steps, start.steps + 1, 'the release is ONE step');
	assert.equal(after.top, 'changed the thickness of small n');
	assert.ok(after.n > 180, `the letter's thickness is the dragged one (${after.n})`);
	assert.equal(after.font, after.n);
	assert.ok(Math.abs(after.stemWidth - after.n) <= 4, `ink ${after.stemWidth} wide for ${after.n}`);
	// the real sweep per frame, timed in the page
	sweepTimes.push(
		...(await page.evaluate(async () => {
			const { previewOutlines } = await import('/src/anyink/sketch/thickness.js');
			const { editor, ids } = window.anyinkThicknessPage;
			const sketch = editor.project.getItem(ids.N_ID).anyink.sketch;
			const out = [];
			for (let i = 0; i < 20; i++) {
				const t0 = performance.now();
				previewOutlines(sketch, editor.project, 60 + i * 10);
				out.push(performance.now() - t0);
			}
			return out;
		}))
	);
	sweepTimes.sort((a, b) => a - b);
	const median = sweepTimes[10];
	pass(
		`B: drag of 20 moves: ${ticks} preview ticks, no step until release, one step "${after.top}", ` +
			`ink ${after.stemWidth} wide at ${after.n}; real sweep of n median ${median.toFixed(
				1
			)} ms, ` +
			`worst ${sweepTimes.at(-1).toFixed(1)} ms`
	);

	// C: Esc while dragging
	const beforeEsc = await facts();
	const shownBefore = await readout();
	await page.mouse.move(xAt(after.n), box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(xAt(after.n - 60), box.y + box.height / 2);
	await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
	await page.keyboard.press('Escape');
	await page.mouse.up();
	await page.waitForTimeout(100);
	const afterEsc = await facts();
	assert.equal(afterEsc.steps, beforeEsc.steps, 'Esc records nothing');
	assert.equal(afterEsc.n, beforeEsc.n);
	assert.equal(await readout(), shownBefore);
	pass('C: Esc while dragging: no step, readout back');

	// D: Undo
	await page.click('#undo');
	const undone = await facts();
	assert.equal(undone.n, 99);
	assert.equal(undone.json, start.json);
	pass('D: Undo puts small n back at 99, exactly as it was');

	// E: Use on all
	await page.click('#redo');
	await page.waitForTimeout(50);
	const redone = await facts();
	assert.equal(redone.n, after.n);
	const card = await page.locator('[data-anyink-action="thicknessOnAll"]');
	const t0 = Date.now();
	await card.click();
	await page.waitForFunction(() => !document.querySelector('[data-anyink-pill="rebuilding"]'));
	await page.waitForTimeout(100);
	const ms = Date.now() - t0;
	const all = await facts();
	assert.deepEqual(new Set(all.all), new Set([after.n]), `every letter at ${after.n}`);
	assert.equal(all.steps, redone.steps + 2, 'one whole-font step (pre / post)');
	assert.equal(all.second, 'set the thickness for every sketched letter');
	pass(`E: Use on all: 5 letters at ${after.n} in ${ms} ms, one whole-font step`);

	await page.screenshot({ path: resolve(shots, 'sketch_thickness.png'), fullPage: true });
	assert.deepEqual(errors, []);
	pass('no page or console error');
	console.log(`screenshot: ${resolve(shots, 'sketch_thickness.png')}`);
} catch (error) {
	console.error('FAIL', error);
	await page.screenshot({ path: resolve(shots, 'sketch_thickness_fail.png'), fullPage: true });
	if (errors.length) console.error(errors);
	process.exitCode = 1;
} finally {
	await context.close();
	await server?.close();
}
