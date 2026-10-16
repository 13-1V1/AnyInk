// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 real-browser check (src/anyink/mode/locks.js): in All tools a drawing tool's press always
// belongs to the tool, never to a guide line or an edge. Found in Chrome: a New path click on the
// writing line placed no point, and a New rectangle started on the right edge dragged the edge
// (width 1252 -> 1672) with no shape. Upstream v2.10.5 had no draggable lines on the edit canvas.
// The real app on a Vite dev server, Chrome with a throwaway context, 1600 x 900, ?ui=all:
//   1. capital A gets a rectangle (its ink); New path: two clicks on the writing line and one
//      off it make one 3-point shape
//   2. New rectangle started on the right edge draws a rectangle; the width stays
//   3. New oval started on the small-letter line draws an oval; the line stays
//   4. Resize (Select) still drags the right edge, as M5 intended; Ctrl+Z puts it back
// Usage: node tests/drawing_tools_lines.verify.mjs [screenshot folder]
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-drawing-tools-lines'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-drawing-tools-lines-'));
const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({
	channel: process.env.LINES_BROWSER || 'chrome',
	headless: true,
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('dialog', (dialog) => dialog.dismiss());
const pass = (message) => console.log(`PASS ${message}`);
const settle = (ms = 300) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });

/** Font units to page pixels on the open letter */
const at = (ux, uy) =>
	page.evaluate(
		async ([x, y]) => {
			const view = (await import('/app/main.js')).getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const box = (host.shadowRoot || host).querySelector('canvas').getBoundingClientRect();
			return { x: box.left + view.dx + x * view.dz, y: box.top + view.dy - y * view.dz };
		},
		[ux, uy]
	);
const letter = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const item = editor.selectedItem;
		return {
			tool: editor.selectedTool,
			shapes: item.shapes.length,
			points: item.shapes.map((shape) => shape.pathPoints?.length ?? 0),
			width: item.advanceWidth,
			xHeight: editor.project.settings.font.xHeight,
		};
	});
const drag = async (from, to) => {
	const a = await at(...from);
	const b = await at(...to);
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 8 });
	await page.mouse.up();
	await settle();
};
const click = async (ux, uy) => {
	const p = await at(ux, uy);
	await page.mouse.move(p.x, p.y, { steps: 2 });
	await page.mouse.down();
	await page.mouse.up();
	await settle(200);
};

try {
	await page.goto(`${origin}/?ui=all`);
	await page.locator('#input__new-project-name').waitFor({ timeout: 60000 });
	assert.equal(await page.evaluate(async () => (await import('/anyink/mode/mode.js')).getMode()), 'all');
	await page.locator('#input__new-project-name').fill('Lines Test');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = 'glyph-0x41';
		editor.nav.page = 'Characters';
		editor.navigate();
	});
	await page.locator('.editor-page__tools-area').waitFor();
	await page.mouse.move(5, 895);
	await settle(600);

	// 1. ink first (a rectangle away from every line), then New path on the writing line
	await page.keyboard.press('r');
	await drag([150, 150], [450, 450]);
	let a = await letter();
	assert.equal(a.shapes, 1, 'capital A has its rectangle');
	const width0 = a.width;
	await page.keyboard.press('p');
	await settle();
	assert.equal((await letter()).tool, 'newPath');
	await click(120, 0);
	await click(520, 0);
	await click(320, 300);
	a = await letter();
	await shot('1-new-path-on-the-writing-line');
	assert.equal(a.shapes, 2, `a new shape: ${JSON.stringify(a)}`);
	assert.equal(a.points[1], 3, `three points, two of them on the writing line: ${JSON.stringify(a.points)}`);
	pass(`New path: two clicks on the writing line and one off it made one ${a.points[1]}-point shape`);
	await page.keyboard.press('Escape');
	await page.keyboard.press('v');
	await settle();

	// 2. New rectangle started on the right edge
	await page.keyboard.press('r');
	await settle();
	const before2 = await letter();
	await drag([before2.width, 200], [before2.width - 120, 380]);
	const after2 = await letter();
	await shot('2-rectangle-from-the-right-edge');
	assert.equal(after2.shapes, before2.shapes + 1, `a rectangle was drawn: ${JSON.stringify(after2)}`);
	assert.equal(after2.width, before2.width, 'the width stayed');
	pass(`New rectangle from the right edge: a rectangle (shapes ${before2.shapes} -> ${after2.shapes}), width ${after2.width} unchanged`);

	// 3. New oval started on the small-letter line
	await page.keyboard.press('o');
	await settle();
	const before3 = await letter();
	await drag([200, before3.xHeight], [320, before3.xHeight - 140]);
	const after3 = await letter();
	assert.equal(after3.shapes, before3.shapes + 1, `an oval was drawn: ${JSON.stringify(after3)}`);
	assert.equal(after3.xHeight, before3.xHeight, 'the small-letter line stayed');
	pass(`New oval from the small-letter line: an oval (shapes ${before3.shapes} -> ${after3.shapes}), the line stayed at ${after3.xHeight}`);

	// 4. Resize still drags the right edge
	await page.keyboard.press('v');
	await page.mouse.move(5, 895);
	await settle();
	const before4 = await letter();
	const edge = await at(before4.width, 640);
	await page.mouse.move(edge.x + 15, edge.y);
	await page.mouse.move(edge.x, edge.y, { steps: 4 });
	await page.mouse.down();
	await page.mouse.move(edge.x + 60, edge.y, { steps: 6 });
	await page.mouse.up();
	await settle();
	const after4 = await letter();
	assert.ok(after4.width > before4.width, `Resize dragged the right edge: ${before4.width} -> ${after4.width}`);
	assert.equal(after4.shapes, before4.shapes);
	await page.keyboard.press('Control+z');
	await settle(500);
	assert.equal((await letter()).width, before4.width, 'Ctrl+Z put the edge back');
	await shot('4-resize-drags-the-edge');
	pass(`Resize still drags the right edge (width ${before4.width} -> ${after4.width}); Ctrl+Z put it back (first width ${width0})`);

	assert.deepEqual(errors, [], 'page errors');
	pass('no page errors');
	console.log(`Screenshots in ${shots}`);
} catch (error) {
	console.error(`FAIL ${error.stack || error}`);
	await shot('FAIL').catch(() => {});
	process.exitCode = 1;
} finally {
	await browser.close();
	await server.close();
}
