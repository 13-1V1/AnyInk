// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 fix pass, real-browser check of the font check's line on the preview strip (Vite dev server
// over src/, Chrome with a throwaway profile). With a letter that has ink and no width, at 48,
// 120 and 200 pt, in canvas mode and in Real font mode:
//   1. nothing is drawn under the line: with the line made invisible (but still there), every
//      pixel of its box is the plain sheet
//   2. the letters never move when the line comes or goes: the sheet left of the line is the
//      same, pixel for pixel, with and without it
// (The first B1 fix gave the line a 40 px band across the whole sheet: the letters jumped 20 px
// every time it came or went, and in Real font mode letters still ran under it.)
// Usage: node tests/check-line.verify.mjs [screenshot folder]   (default: the OS temp folder)
/* global process */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-check-line'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-check-line-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B1_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('dialog', (dialog) => dialog.dismiss());
const pass = (message) => console.log(`PASS ${message}`);

/** Sets the strip, then waits for it to settle (a Real font rebuild takes a moment). */
const setStrip = async ({ pt, realFont }) => {
	await page.evaluate(
		([points, real]) => {
			const strip = document.querySelector('preview-strip');
			strip.setText('oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo');
			strip.setPoints(points);
			strip.setRealFont(real);
		},
		[pt, realFont]
	);
	await page.waitForTimeout(realFont ? 1500 : 600);
};

/** Shows or hides the line the way the font check does. */
const setLine = async (on) => {
	await page.evaluate(async (show) => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const { runFontCheckNow } = await import('/anyink/fontcheck/font_check.js');
		const editor = getCurrentProjectEditor();
		if (show) runFontCheckNow(editor);
		else editor.publish('fontCheck', { problems: [] });
	}, on);
	await page.waitForTimeout(400);
};

const boxes = () =>
	page.evaluate(() => {
		const box = (el) => {
			const r = el.getBoundingClientRect();
			return { x: r.left, y: r.top, width: r.width, height: r.height };
		};
		const sheet = document.querySelector('.preview-strip__canvas-wrapper');
		const line = document.querySelector('.preview-strip__check');
		return { sheet: box(sheet), line: line.hidden ? null : box(line) };
	});

/** Every pixel of a box, as one string (for "the same, pixel for pixel"). */
const pixels = async (clip) => (await page.screenshot({ clip })).toString('base64');

/** The share of pixels in a box that differ from the sheet's own color. */
const inkUnder = async (clip, sheetColor) => {
	const png = await page.screenshot({ clip });
	return page.evaluate(
		async ({ b64, bg }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${b64}`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
			let off = 0;
			for (let i = 0; i < data.length; i += 4) {
				const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
				if (d > 24) off++;
			}
			return off / (data.length / 4);
		},
		{ b64: png.toString('base64'), bg: sheetColor }
	);
};

try {
	await page.goto(`${origin}/?ui=all`);
	await page.locator('#input__new-project-name').fill('Check Line');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	// small b: one big box of ink and width 0, as a traced letter is before B3; small o fills the sheet
	await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		editor.nav.page = 'Characters';
		editor.selectedItemID = 'glyph-0x62';
		editor.navigate();
		const at = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape({ pathPoints: [at(80, 0), at(900, 0), at(900, 1400), at(80, 1400)] });
		editor.selectedItem.advanceWidth = 0;
		editor.history.addState('check line: ink with no width');
		// small o: a fine letter, set across the whole sheet by the preview text
		editor.selectedItemID = 'glyph-0x6F';
		editor.navigate();
		editor.selectedItem.addOneShape({ pathPoints: [at(60, -300), at(840, -300), at(840, 1100), at(60, 1100)] });
		editor.selectedItem.advanceWidth = 900;
		editor.history.addState('check line: a letter with a width');
		editor.publish('currentItem', editor.selectedItem);
	});
	await page.mouse.move(5, 5);
	await page.locator('.preview-strip__check').waitFor({ state: 'visible', timeout: 8000 });
	// the sheet's own color, read from the screen just inside its top right corner
	const sheetColor = await (async () => {
		const { sheet } = await boxes();
		const png = await page.screenshot({ clip: { x: sheet.x + sheet.width - 12, y: sheet.y + 6, width: 1, height: 1 } });
		return page.evaluate(async (b64) => {
			const image = new Image();
			image.src = `data:image/png;base64,${b64}`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
		}, png.toString('base64'));
	})();

	for (const realFont of [false, true]) {
		for (const pt of [48, 120, 200]) {
			const mode = realFont ? 'real-font' : 'canvas';
			await setStrip({ pt, realFont });
			await setLine(true);
			const { sheet, line } = await boxes();
			assert(line, `${mode} ${pt} pt: the line shows`);

			// 1. Nothing under the line
			const hideLine = (hide) =>
				page.evaluate((h) => {
					const el = document.querySelector('.preview-strip__check');
					for (const part of [el, ...el.querySelectorAll('*')]) {
						part.style.transition = h ? 'none' : '';
						part.style.visibility = h ? 'hidden' : '';
					}
				}, hide);
			await hideLine(true);
			await page.waitForTimeout(150);
			const under = await inkUnder(line, sheetColor);
			await page.screenshot({ path: resolve(shots, `${mode}-${pt}-under-line.png`), clip: sheet });
			await hideLine(false);
			assert(under < 0.002, `${mode} ${pt} pt: ${(under * 100).toFixed(2)}% of the line's box has ink under it`);

			// 2. The letters never move
			const left = { x: sheet.x, y: sheet.y, width: line.x - sheet.x - 12, height: sheet.height };
			const withLine = await pixels(left);
			await page.screenshot({ path: resolve(shots, `${mode}-${pt}-line.png`), clip: sheet });
			await setLine(false);
			assert.equal((await boxes()).line, null);
			const withoutLine = await pixels(left);
			await page.screenshot({ path: resolve(shots, `${mode}-${pt}-no-line.png`), clip: sheet });
			assert(withLine === withoutLine, `${mode} ${pt} pt: the letters moved when the line went away`);
			pass(`${mode} ${pt} pt: nothing under the line (${(under * 100).toFixed(2)}% off-sheet pixels), letters still when it comes and goes`);
		}
	}

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass(`no page errors; screenshots in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
