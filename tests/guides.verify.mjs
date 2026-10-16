// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 guide lines, real-browser check (docs/UX-BEGINNER.md section 10, B1). In the real app on a
// Vite dev server over src/, Chrome with a throwaway profile, a new font:
//   1. an empty small e: the lines reach the default letter width, a faint right edge sits
//      there, and the writing line and left edge reach 3:1 against the canvas (paper and slate),
//      measured from the pixels the canvas actually drew
//   2. a narrow small l (width 440.7) and small t (width 654.3) with ink: the lines stop at the
//      letter's own width, as before B1, and there is no faint edge
//   3. (B1 fix pass) the first Pen clicks on an empty letter: it still has width 0, so the lines
//      keep the default width and the faint right edge stays (they used to shrink to stubs)
//   4. (B1 fix pass) a display scaled to 125% and 150% (Windows display scale; this PC runs at
//      150%): the browser stretches the canvas, so the writing line and the left edge are
//      measured from a screenshot of the screen itself, and still reach 3:1
// Usage: node tests/guides.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-guides'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const errors = [];
/** A fresh Chrome profile at a display scale; `page` follows the newest one. */
async function launch(deviceScaleFactor = 1) {
	const profile = await mkdtemp(resolve(tmpdir(), 'anyink-guides-'));
	const next = await chromium.launchPersistentContext(profile, {
		channel: process.env.B1_BROWSER || 'chrome',
		headless: true,
		viewport: { width: 1600, height: 900 },
		deviceScaleFactor,
	});
	const nextPage = next.pages()[0] || (await next.newPage());
	nextPage.on('pageerror', (error) => errors.push(error.message));
	nextPage.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	nextPage.on('dialog', (dialog) => dialog.dismiss());
	return { context: next, page: nextPage };
}
let { context, page } = await launch();

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(150);
	}
	throw new Error(`timed out: ${what}`);
};
const selectedID = () =>
	page.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedItemID);
const openLetter = async (id) => {
	await page.locator('button[data-nav-type="PAGE"]').click();
	await page.locator('.nav-dropdown__button:has-text("Overview"):visible').click();
	await page.waitForTimeout(400);
	await page.locator(`glyph-tile[displayed-item-id="${id}"]`).click();
	await waitUntil(async () => (await selectedID()) === id, `open ${id}`);
	await page.mouse.move(5, 895); // keep the pointer off the canvas: no hover highlight
	await page.waitForTimeout(500);
};
const setTheme = async (theme) => {
	if ((await page.evaluate(() => document.documentElement.dataset.canvas)) !== theme) {
		await page.locator('button[title="Paper / slate"]').click();
		await page.waitForTimeout(400);
	}
	assert.equal(await page.evaluate(() => document.documentElement.dataset.canvas), theme);
};

/**
 * Reads the edit canvas pixels: each guide line's contrast against the canvas background (the
 * drawn pixel laid over --canvas-bg, as the screen shows it) and the writing line's span.
 */
const measure = () =>
	page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const project = editor.project;
		const item = editor.selectedItem;
		const font = project.settings.font;
		const view = editor.view;
		const host = document.querySelector('edit-canvas');
		const canvas = (host.shadowRoot || host).querySelector('canvas');
		const ctx = canvas.getContext('2d');
		const parse = (text) => text.match(/[\d.]+/g).slice(0, 3).map(Number);
		const bg = parse(getComputedStyle(host.parentElement).backgroundColor);
		const lum = ([r, g, b]) => {
			const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
			return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
		};
		const contrastAt = (x, y) => {
			const [r, g, b, a] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
			const shown = [r, g, b].map((v, i) => v * (a / 255) + bg[i] * (1 - a / 255));
			const [hi, lo] = [lum(shown), lum(bg)].sort((p, q) => q - p);
			return (hi + 0.05) / (lo + 0.05);
		};
		const lineY = (em) => {
			const y = view.dy - em * view.dz;
			return em > 0 ? Math.floor(y) : Math.ceil(y);
		};
		const edgeX = (em) => Math.floor(view.dx + em * view.dz);
		// Where to sample: a horizontal line at 30% along the default width, so no edge is under it;
		// a vertical edge a few pixels above the top line, inside its pad
		const sampleX = view.dx + 0.3 * Math.min(project.defaultAdvanceWidth, item.advanceWidth || Infinity) * view.dz;
		const aboveTop = lineY(font.ascent) - 4;
		const row = ctx.getImageData(0, lineY(0), canvas.width, 1).data;
		let first = -1;
		let last = -1;
		for (let x = 0; x < canvas.width; x++) {
			if (row[x * 4 + 3] > 0) {
				if (first < 0) first = x;
				last = x;
			}
		}
		const pad = 50; // drawEmHorizontalLine pads each end by 50 font units
		return {
			// a 1 px line's ends are anti-aliased: allow 3 px either way, in font units
			tolerance: 3 / view.dz,
			width: item.advanceWidth,
			shapes: item.shapes.length,
			itemXMax: Math.max(item.advanceWidth || 0, item.maxes?.xMax || 0),
			defaultWidth: project.defaultAdvanceWidth,
			span: first < 0 ? 0 : (last - first + 1) / view.dz - pad * 2,
			writing: contrastAt(sampleX, lineY(0)),
			top: contrastAt(sampleX, lineY(font.ascent)),
			tail: contrastAt(sampleX, lineY(font.descent)),
			capitals: contrastAt(sampleX, lineY(font.capHeight)),
			small: contrastAt(sampleX, lineY(font.xHeight)),
			leftEdge: contrastAt(edgeX(0), aboveTop),
			defaultEdge: contrastAt(edgeX(project.defaultAdvanceWidth), aboveTop),
		};
	});

/** Gives the open letter one rectangle of ink and a width, as a traced letter has. */
const giveInk = (width) =>
	page.evaluate(async (advance) => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const { Path } = await import('/project_data/path.js');
		const editor = getCurrentProjectEditor();
		const glyph = editor.selectedItem;
		const right = Math.round(advance - 60);
		glyph.addOneShape(
			new Path({
				pathPoints: [
					{ p: { coord: { x: 60, y: 0 } } },
					{ p: { coord: { x: 60, y: 1400 } } },
					{ p: { coord: { x: right, y: 1400 } } },
					{ p: { coord: { x: right, y: 0 } } },
				],
			})
		);
		glyph.advanceWidth = advance;
		editor.publish('currentItem', glyph);
	}, width);

const fmt = (n) => n.toFixed(2);

const newFont = async (name) => {
	await page.goto(`${origin}/?ui=all`);
	await page.locator('#input__new-project-name').fill(name);
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
};

/** Clicks the Pen tool at these font units on the open letter. */
const penClick = async (x, y) => {
	const at = await page.evaluate(
		async ([ux, uy]) => {
			const { getCurrentProjectEditor } = await import('/app/main.js');
			const view = getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const box = (host.shadowRoot || host).querySelector('canvas').getBoundingClientRect();
			return { x: box.left + view.dx + ux * view.dz, y: box.top + view.dy - uy * view.dz };
		},
		[x, y]
	);
	await page.mouse.move(at.x - 20, at.y, { steps: 4 });
	await page.mouse.move(at.x, at.y, { steps: 4 });
	await page.mouse.down();
	await page.waitForTimeout(50);
	await page.mouse.up();
	await page.mouse.move(5, 895);
	await page.waitForTimeout(500);
};

/**
 * The writing line's and the left edge's strongest screen pixel against the canvas, read from
 * a screenshot at the display's own scale (what he sees), not from the canvas buffer.
 */
const measureOnScreen = async () => {
	const geo = await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const view = editor.view;
		const font = editor.project.settings.font;
		const host = document.querySelector('edit-canvas');
		const canvas = (host.shadowRoot || host).querySelector('canvas');
		const box = canvas.getBoundingClientRect();
		const lineY = (em) => {
			const y = view.dy - em * view.dz;
			return em > 0 ? Math.floor(y) : Math.ceil(y);
		};
		return {
			left: box.left,
			top: box.top,
			scale: box.width / canvas.width,
			dpr: devicePixelRatio,
			sampleX: view.dx + 0.3 * editor.project.defaultAdvanceWidth * view.dz,
			writingY: lineY(0),
			aboveTop: lineY(font.ascent) - 4,
			edgeX: Math.floor(view.dx),
		};
	});
	const png = await page.screenshot({ scale: 'device' });
	return page.evaluate(
		async ({ b64, geo }) => {
			const image = new Image();
			image.src = `data:image/png;base64,${b64}`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			const lum = ([r, g, b]) => {
				const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
				return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
			};
			const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
			const ratio = (a, b) => {
				const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
				return (hi + 0.05) / (lo + 0.05);
			};
			const d = geo.dpr;
			const s = geo.scale;
			const bg = px(Math.round((geo.left + 5) * d), Math.round((geo.top + 5) * d));
			const across = (fixed, from, to, horizontal) => {
				let best = 1;
				for (let v = Math.floor(from) - 2; v <= Math.ceil(to) + 2; v++) {
					const [x, y] = horizontal ? [fixed, v] : [v, fixed];
					best = Math.max(best, ratio(px(x, y), bg));
				}
				return best;
			};
			const screenX = (cx) => (geo.left + cx * s) * d;
			const screenY = (cy) => (geo.top + cy * s) * d;
			return {
				writing: across(Math.round(screenX(geo.sampleX)), screenY(geo.writingY), screenY(geo.writingY + 1), true),
				leftEdge: across(Math.round(screenY(geo.aboveTop)), screenX(geo.edgeX), screenX(geo.edgeX + 1), false),
			};
		},
		{ b64: png.toString('base64'), geo }
	);
};

try {
	await newFont('Guides Check');

	// 1. Empty small e, paper and slate
	await openLetter('glyph-0x65');
	for (const theme of ['light', 'dark']) {
		await setTheme(theme);
		const name = theme === 'light' ? 'paper' : 'slate';
		const m = await measure();
		assert.equal(m.shapes, 0);
		assert.equal(m.width, 0);
		assert.ok(Math.abs(m.span - m.defaultWidth) <= m.tolerance, `${name}: writing line spans ${m.span}`);
		assert.ok(m.writing >= 3, `${name}: writing line ${fmt(m.writing)}:1`);
		assert.ok(m.leftEdge >= 3, `${name}: left edge ${fmt(m.leftEdge)}:1`);
		assert.ok(m.defaultEdge > 1.2 && m.defaultEdge < m.leftEdge, `${name}: faint right edge ${fmt(m.defaultEdge)}:1`);
		assert.ok(m.writing > m.top && m.top > m.capitals, `${name}: line order`);
		await shot(`guides-01-empty-e-${name}`);
		pass(
			`${name}, empty e: lines ${Math.round(m.span)} units (default ${m.defaultWidth}); writing line ` +
				`${fmt(m.writing)}:1, left edge ${fmt(m.leftEdge)}:1, faint right edge ${fmt(m.defaultEdge)}:1, ` +
				`top ${fmt(m.top)}:1, tail ${fmt(m.tail)}:1, capitals ${fmt(m.capitals)}:1, small letters ${fmt(m.small)}:1`
		);
	}
	await setTheme('light');

	// 2. Narrow letters with ink keep their own box
	for (const [id, width, name] of [
		['glyph-0x6C', 440.7, 'small-l'],
		['glyph-0x74', 654.3, 'small-t'],
	]) {
		await openLetter(id);
		await giveInk(width);
		await page.waitForTimeout(400);
		const m = await measure();
		assert.equal(m.width, width);
		assert.ok(m.itemXMax < m.defaultWidth, `${name} is narrower than the default width`);
		assert.ok(Math.abs(m.span - m.itemXMax) <= m.tolerance, `${name}: writing line spans ${m.span}, letter ${m.itemXMax}`);
		assert.ok(m.defaultEdge < 1.05, `${name}: no line at the default width (${fmt(m.defaultEdge)}:1)`);
		await shot(`guides-02-${name}`);
		pass(`${name} (width ${width}): lines ${Math.round(m.span)} units, stop at the letter, no faint edge`);
	}

	// 3. The first Pen clicks on an empty letter (B1 fix pass)
	await openLetter('glyph-0x72');
	const before = await measure();
	await page.locator('button[title="New path"]').click();
	await penClick(80, 400);
	const one = await measure();
	assert.equal(one.shapes, 1, 'the first click made a shape');
	assert.equal(one.width, 0, 'the letter still has width 0');
	assert.ok(Math.abs(one.span - one.defaultWidth) <= one.tolerance, `after one click the lines span ${one.span}`);
	assert.ok(one.defaultEdge > 1.2, `after one click the faint right edge stays (${fmt(one.defaultEdge)}:1)`);
	await penClick(380, 700);
	const two = await measure();
	assert.ok(Math.abs(two.span - two.defaultWidth) <= two.tolerance, `after two clicks the lines span ${two.span}`);
	await shot('guides-03-first-pen-clicks');
	pass(
		`first Pen clicks on an empty small r: lines ${Math.round(before.span)} -> ${Math.round(one.span)} -> ` +
			`${Math.round(two.span)} units, faint right edge ${fmt(one.defaultEdge)}:1 (width still 0)`
	);
	await page.keyboard.press('Escape');
	await context.close();

	// 4. Displays scaled above 100% (B1 fix pass)
	for (const scale of [1.25, 1.5]) {
		({ context, page } = await launch(scale));
		await newFont(`Guides ${scale * 100}`);
		await openLetter('glyph-0x65');
		for (const theme of ['light', 'dark']) {
			await setTheme(theme);
			const name = theme === 'light' ? 'paper' : 'slate';
			const m = await measureOnScreen();
			assert.ok(m.writing >= 3, `${scale * 100}% ${name}: writing line ${fmt(m.writing)}:1 on screen`);
			assert.ok(m.leftEdge >= 3, `${scale * 100}% ${name}: left edge ${fmt(m.leftEdge)}:1 on screen`);
			await shot(`guides-04-scale-${scale * 100}-${name}`);
			pass(`${scale * 100}% display, ${name}: on screen the writing line is ${fmt(m.writing)}:1, the left edge ${fmt(m.leftEdge)}:1`);
		}
		await context.close();
	}

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass(`no page errors; screenshots in ${shots}`);
} finally {
	await context.close().catch(() => {});
	await server.close();
}
