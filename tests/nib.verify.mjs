// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 brush real-browser check (docs/UX-BEGINNER.md 4.3 Tools, 7.3, 10 B8; D-014, D-015), Chrome
// with throwaway profiles, 1600 x 900, the feature flags as the app has them ('brush' on):
//   A. tests/nib.html: B picks the Brush; a mouse drag draws a stroke: while the button is down
//      the live picture shows under the pointer, on release the ink lands where the picture was
//      (measured twice: from the stroke's own samples in font units, and from screenshots in
//      pixels, the release point's end left out since the filter catches up there); one Undo
//      step per stroke, each stroke its own tagged shape(s) with whole-number points; an o drawn
//      in one stroke keeps paper in its middle; Undo / Redo; the size slider; All tools draws too
//   B. the app with ?ui=simple: a new font, small a, the Brush button in the tool column, a
//      stroke: "drew a stroke on small a", the letter Ready, the rail counts it; Ctrl+Z says
//      "Undid: drew a stroke on small a"; the page says no banned word (strict); the live
//      picture vs the ink again, in the app
//   C. the app in All tools: the Brush button is in the tool column after New path ("Brush")
// Usage: node tests/nib.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import sharp from 'sharp';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b8'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b8-'));

async function serve(root, name) {
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'error',
		cacheDir: resolve(scratch, `vite-${name}`),
		server: {
			port: 0,
			host: '127.0.0.1',
			hmr: false,
			watch: { ignored: ['**/*'] },
			fs: { strict: false },
		},
	});
	await server.listen();
	return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}` };
}

const pages = await serve(repo, 'pages');
const app = await serve(src, 'app');
const browser = await chromium.launch({
	channel: process.env.B8_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
const results = {};
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];

async function freshPage(label) {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	const p = await context.newPage();
	p.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
	p.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
	});
	p.on('dialog', (dialog) => dialog.dismiss());
	return p;
}
const shot = async (p, name, clip) => {
	const path = resolve(shots, `${name}.png`);
	const buffer = await p.screenshot({ path, ...(clip ? { clip } : {}) });
	shotList.push(path);
	return buffer;
};
const settle = (p, ms = 300) => p.waitForTimeout(ms);

/** The edit canvas's box on the page */
const canvasBox = (p) =>
	p.evaluate(() => {
		const host = document.querySelector('edit-canvas');
		const canvas = host?.shadowRoot?.querySelector('canvas');
		const r = (canvas || host).getBoundingClientRect();
		return { x: r.left, y: r.top, width: r.width, height: r.height };
	});

/** Font units to page pixels through the editor's view */
async function toPage(p, box, editorPath, points) {
	const view = await p.evaluate(editorPath);
	return points.map(([x, y]) => [box.x + view.dx + x * view.dz, box.y + view.dy - y * view.dz]);
}

/**
 * A drag along page points; a screenshot of the canvas while the button is still down. At the
 * end the pointer rests a moment, as a hand does before it lifts (a pixel each way, a few times),
 * so the filter has caught up and the picture reaches the pointer before the screenshot.
 */
async function dragWithShots(p, pagePoints, name, clip) {
	const [first, ...rest] = pagePoints;
	await p.mouse.move(first[0], first[1]);
	await p.mouse.down();
	for (const [x, y] of rest) await p.mouse.move(x, y, { steps: 2 });
	const [ex, ey] = pagePoints.at(-1);
	for (let i = 0; i < 12; i++) {
		await p.mouse.move(ex + (i % 2 ? 1 : 0), ey);
		await p.waitForTimeout(25);
	}
	await p.mouse.move(ex, ey);
	await p.waitForTimeout(120); // two frames: the picture of the last samples is drawn
	const during = await shot(p, `${name}-1-while-drawing`, clip);
	await p.mouse.up();
	await settle(p, 400);
	const after = await shot(p, `${name}-2-after-release`, clip);
	return { during, after };
}

/** Pixels of ink (dark and grey, not the purple guide lines) */
async function inkMask(buffer) {
	const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
	const { width, height, channels } = info;
	const mask = new Uint8Array(width * height);
	for (let i = 0; i < width * height; i++) {
		const r = data[i * channels];
		const g = data[i * channels + 1];
		const b = data[i * channels + 2];
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		mask[i] = max < 128 && max - min < 40 ? 1 : 0;
	}
	return { mask, width, height };
}

/** Edge pixels of a mask: ink with paper beside it */
function edges({ mask, width, height }) {
	const out = [];
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const i = y * width + x;
			if (!mask[i]) continue;
			if (!mask[i - 1] || !mask[i + 1] || !mask[i - width] || !mask[i + width]) out.push([x, y]);
		}
	}
	return out;
}

/**
 * The farthest an edge pixel of one is from the other's edge, both ways, counting only edges near
 * the stroke's path (near: [points in the clip's pixels, how near]), so nothing else on screen
 * that changed (the empty-letter box going away) counts
 */
function pixelGap(a, b, near) {
	const [path, reach] = near;
	const close = ([x, y]) =>
		path.some(([px, py], i) => {
			const [qx, qy] = path[Math.min(i + 1, path.length - 1)];
			const dx = qx - px;
			const dy = qy - py;
			const length2 = dx * dx + dy * dy;
			const t =
				length2 > 0 ? Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / length2)) : 0;
			return Math.hypot(x - (px + dx * t), y - (py + dy * t)) <= reach;
		});
	const one = edges(a).filter(close);
	const two = edges(b).filter(close);
	const far = (from, to) => {
		const cells = new Map();
		const cell = 8;
		to.forEach(([x, y]) => {
			const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
			if (!cells.has(key)) cells.set(key, []);
			cells.get(key).push([x, y]);
		});
		let worst = 0;
		from.forEach(([x, y]) => {
			let best = Infinity;
			for (let ring = 0; ring < 40 && best > (ring - 1) * cell; ring++) {
				for (let cx = -ring; cx <= ring; cx++) {
					for (let cy = -ring; cy <= ring; cy++) {
						if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
						const list = cells.get(`${Math.floor(x / cell) + cx},${Math.floor(y / cell) + cy}`);
						list?.forEach(([px, py]) => (best = Math.min(best, Math.hypot(px - x, py - y))));
					}
				}
			}
			worst = Math.max(worst, best);
		});
		return worst;
	};
	return Math.max(far(one, two), far(two, one));
}

/** An S, as a hand writes it (font units, for a 1,000-unit letter box) */
function sPath(x0, y0, w, h) {
	const r = h / 4;
	const cx = x0 + w / 2;
	const pts = [];
	for (let a = 20; a <= 270; a += 10) {
		const t = (a * Math.PI) / 180;
		pts.push([cx + r * Math.cos(t), y0 + 3 * r + r * Math.sin(t)]);
	}
	for (let a = 80; a >= -160; a -= 10) {
		const t = (a * Math.PI) / 180;
		pts.push([cx + r * Math.cos(t), y0 + r + r * Math.sin(t)]);
	}
	return pts;
}
function loopPath(cx, cy, r) {
	const pts = [];
	for (let a = 90; a <= 90 + 380; a += 10) {
		const t = (a * Math.PI) / 180;
		pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
	}
	return pts;
}

/** The inking of the last stroke on its own samples, in the page: milliseconds per stroke */
const inkTime = async () => {
	const { inkStroke } = await import('/src/anyink/nib/ink.js');
	const { lastStrokeForChecks } = await import('/src/anyink/nib/nib_tool.js');
	const last = lastStrokeForChecks();
	const t0 = performance.now();
	for (let i = 0; i < 5; i++) inkStroke(last.samples, { size: last.size, pixel: last.pixel });
	return (performance.now() - t0) / 5;
};

// --------------------------------------------------------------
// A. tests/nib.html
// --------------------------------------------------------------
{
	const p = await freshPage('nib.html');
	await p.goto(`${pages.origin}/tests/nib.html`);
	await p.locator('edit-canvas').waitFor({ timeout: 30000 });
	await settle(p, 800);
	const nibPage = () => window.anyinkNibPage.editor.view;
	await p.evaluate(() => {
		const { editor } = window.anyinkNibPage;
		// zoomed in for the S, so a pixel is a small share of the stroke width. dy is not a
		// multiple of the zoom: upstream's sYcY turns a canvas y of exactly 0 into dy, which
		// draws a whole-number point on the canvas's top edge as a spike to the writing line
		editor.view = { dx: 250, dy: 641, dz: 2.5 };
		editor.editCanvas.redraw('verify');
	});
	await p.mouse.move(5, 895);
	await p.keyboard.press('b');
	await settle(p);
	const picked = await p.evaluate(() => ({
		tool: window.anyinkNibPage.editor.selectedTool,
		title: document.querySelector('[data-anyink-tool="nib"]')?.title,
		selected: document
			.querySelector('[data-anyink-tool="nib"]')
			?.classList.contains('editor-page__tool-selected'),
	}));
	assert.deepEqual(picked, { tool: 'nib', title: 'Brush (B)', selected: true });
	pass('A1 B picks the Brush ("Brush (B)", shown picked)');

	const box = await canvasBox(p);
	const clip = {
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(Math.min(box.width, 1600 - box.x)),
		height: Math.round(Math.min(box.height, 900 - box.y)),
	};
	const stepsBefore = await p.evaluate(() => window.anyinkNibPage.editor.history.queue.length);
	// the empty-letter box sits over the canvas until the letter has ink; out of the way of
	// the screenshots (NEEDS FROM OTHER TRACK: it should step aside for the Brush)
	await p.addStyleTag({ content: '[data-anyink-overlay] { visibility: hidden !important; }' });
	const sPage = await toPage(p, box, nibPage, sPath(40, 20, 140, 220));
	const s = await dragWithShots(p, sPage, 'A2-s-stroke', clip);
	const sCheck = await p.evaluate(() => {
		const { editor, measureLastStroke } = window.anyinkNibPage;
		const item = editor.selectedItem;
		return {
			steps: editor.history.queue.length,
			title: editor.history.queue[0].title,
			shapes: item.shapes.length,
			tagged: item.shapes.every((shape) => shape.anyink?.strokeId === 1),
			records: item.anyink?.nib?.strokes?.length || 0,
			whole: item.shapes.every((shape) =>
				shape.pathPoints.every((pp) =>
					[pp.p, pp.h1, pp.h2].every((c) => Number.isInteger(c.x) && Number.isInteger(c.y))
				)
			),
			measure: measureLastStroke(),
			dz: editor.view.dz,
		};
	});
	assert.equal(sCheck.steps, stepsBefore + 1);
	assert.equal(sCheck.title, 'drew a stroke on small a');
	assert.equal(sCheck.shapes, 1);
	assert.ok(sCheck.tagged && sCheck.records === 1 && sCheck.whole);
	assert.ok(sCheck.measure.share <= 0.02, `S: ${(sCheck.measure.share * 100).toFixed(2)} %`);
	results.inkMs = await p.evaluate(inkTime);
	const widthPx = sCheck.measure.size * sCheck.dz;
	const sPixels = pixelGap(await inkMask(s.during), await inkMask(s.after), [
		sPage.map(([x, y]) => [x - clip.x, y - clip.y]),
		widthPx,
	]);
	results.sStroke = {
		samples: sCheck.measure.samples,
		points: sCheck.measure.points,
		geometric: `${sCheck.measure.gap.toFixed(2)} units = ${(sCheck.measure.share * 100).toFixed(
			2
		)} % of ${sCheck.measure.size}`,
		pixels: `${sPixels.toFixed(1)} px of ${widthPx.toFixed(0)} px = ${(
			(sPixels / widthPx) *
			100
		).toFixed(2)} %`,
	};
	pass(
		`A2 an S stroke: one step "drew a stroke on small a", one tagged shape, whole numbers; live picture vs ink ${results.sStroke.geometric} (pixels: ${results.sStroke.pixels}, the release end left out)`
	);

	// an o in one stroke: paper in the middle
	await p.locator('#clear').click();
	await p.evaluate(() => {
		const { editor } = window.anyinkNibPage;
		editor.view = { dx: 250, dy: 640, dz: 1 };
		editor.editCanvas.redraw('verify');
	});
	await settle(p);
	await p.mouse.move(5, 895);
	const oPage = await toPage(p, box, nibPage, loopPath(250, 300, 200));
	const o = await dragWithShots(p, oPage, 'A3-o-stroke', clip);
	const oCheck = await p.evaluate(() => {
		const { editor, measureLastStroke } = window.anyinkNibPage;
		const item = editor.selectedItem;
		return {
			shapes: item.shapes.length,
			tagged: item.shapes.every((shape) => shape.anyink?.strokeId === 1),
			measure: measureLastStroke(),
		};
	});
	const center = await toPage(p, box, nibPage, [[250, 300]]);
	const oMask = await inkMask(o.after);
	const cx = Math.round(center[0][0] - clip.x);
	const cy = Math.round(center[0][1] - clip.y);
	assert.equal(oMask.mask[cy * oMask.width + cx], 0, 'the middle of the o is paper');
	assert.equal(oCheck.shapes, 2);
	assert.ok(oCheck.tagged);
	assert.ok(oCheck.measure.share <= 0.02, `o: ${(oCheck.measure.share * 100).toFixed(2)} %`);
	results.oStroke = `${oCheck.measure.gap.toFixed(2)} units = ${(
		oCheck.measure.share * 100
	).toFixed(2)} %`;
	pass(
		`A3 an o in one stroke: two shapes (ink and hole), both tagged, paper in its middle; live picture vs ink ${results.oStroke}`
	);

	// a second stroke, then Undo and Redo
	const bar = await toPage(p, box, nibPage, [
		[0, 300],
		[500, 300],
	]);
	await p.mouse.move(bar[0][0], bar[0][1]);
	await p.mouse.down();
	await p.mouse.move(bar[1][0], bar[1][1], { steps: 30 });
	await p.mouse.up();
	await settle(p);
	const two = await p.evaluate(
		() => window.anyinkNibPage.editor.selectedItem.anyink.nib.strokes.length
	);
	await p.locator('#undo').click();
	await settle(p);
	const undone = await p.evaluate(() => {
		const item = window.anyinkNibPage.editor.selectedItem;
		return { strokes: item.anyink.nib.strokes.length, shapes: item.shapes.length };
	});
	await p.locator('#redo').click();
	await settle(p);
	const redone = await p.evaluate(() => {
		const item = window.anyinkNibPage.editor.selectedItem;
		return {
			strokes: item.anyink.nib.strokes.length,
			shapes: item.shapes.length,
			tagged: item.shapes.every((shape) => !!shape.anyink?.strokeId),
		};
	});
	assert.equal(two, 2);
	assert.deepEqual(undone, { strokes: 1, shapes: 2 });
	assert.deepEqual(redone, { strokes: 2, shapes: 3, tagged: true });
	pass('A4 a second stroke; Undo takes away only it, Redo brings it back still tagged');
	await shot(p, 'A4-o-and-bar', clip);

	// the size slider: thick
	await p.evaluate(() => {
		const slider = document.querySelector('#size input[type="range"]');
		slider.value = slider.max;
		slider.dispatchEvent(new Event('input'));
	});
	const thick = await toPage(p, box, nibPage, [
		[0, 600],
		[500, 620],
	]);
	await p.mouse.move(thick[0][0], thick[0][1]);
	await p.mouse.down();
	await p.mouse.move(thick[1][0], thick[1][1], { steps: 30 });
	await p.mouse.up();
	await settle(p);
	const thickCheck = await p.evaluate(() => window.anyinkNibPage.measureLastStroke());
	assert.ok(thickCheck.size > 130 && thickCheck.share <= 0.02);
	pass(
		`A5 Size at thick: a ${thickCheck.size}-unit stroke; live picture vs ink ${(
			thickCheck.share * 100
		).toFixed(2)} %`
	);
	await shot(p, 'A5-thick', clip);

	pass(
		`A6 inking the S stroke took ${results.inkMs.toFixed(
			1
		)} ms here (the whole pipeline, on its own samples)`
	);

	// All tools draws too, one step
	await p.locator('#simple').uncheck();
	await settle(p, 600);
	await p.mouse.move(5, 895);
	await p.keyboard.press('b');
	await settle(p);
	const allBefore = await p.evaluate(() => ({
		steps: window.anyinkNibPage.editor.history.queue.length,
		tool: window.anyinkNibPage.editor.selectedTool,
	}));
	const allBox = await canvasBox(p);
	const allLine = await toPage(p, allBox, nibPage, [
		[0, 100],
		[400, 150],
	]);
	await p.mouse.move(allLine[0][0], allLine[0][1]);
	await p.mouse.down();
	await p.mouse.move(allLine[1][0], allLine[1][1], { steps: 25 });
	await p.mouse.up();
	await settle(p);
	const allAfter = await p.evaluate(() => ({
		steps: window.anyinkNibPage.editor.history.queue.length,
		title: window.anyinkNibPage.editor.history.queue[0].title,
	}));
	assert.equal(allBefore.tool, 'nib');
	assert.equal(allAfter.steps, allBefore.steps + 1);
	pass(`A7 All tools: B picks the Brush, a stroke is one step ("${allAfter.title}")`);
	await shot(p, 'A7-all-tools');
	await p.context().close();
}

// --------------------------------------------------------------
// B. the app, Simple
// --------------------------------------------------------------
async function newFont(p, search) {
	await p.goto(`${app.origin}/${search}`);
	const field = p.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill('Brennan Hand');
	await p.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(p, 600);
}
async function openLetter(p, id) {
	await p.evaluate(async (glyph) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = glyph;
		editor.nav.page = 'Characters';
		editor.navigate();
	}, id);
	await p.locator('.editor-page__tools-area').waitFor();
	await p.mouse.move(5, 895);
	await settle(p, 600);
}
const appView = async () => (await import('/app/main.js')).getCurrentProjectEditor().view;
{
	const p = await freshPage('app simple');
	await newFont(p, '?ui=simple');
	await openLetter(p, 'glyph-0x61');
	const column = await p.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-tool]')]
			.filter((el) => el.checkVisibility())
			.map((el) => `${el.dataset.anyinkTool}:${el.title}`)
	);
	assert.ok(column[0].startsWith('nib:Brush (B)'), column.join(' | '));
	await shot(p, 'B1-app-simple-empty-letter');
	await p.locator('[data-anyink-tool="nib"]').click();
	await settle(p);
	await p.mouse.move(5, 895);
	await settle(p);
	await shot(p, 'B2-app-simple-brush-picked');
	const box = await canvasBox(p);
	const view = await p.evaluate(appView);
	const before = await p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return { steps: editor.history.queue.length, upm: editor.project.settings.font.upm };
	});
	// a small a's bowl and stem, in this font's units
	const k = before.upm / 1000;
	const aPath = [];
	for (let a = 20; a <= 340; a += 10) {
		const t = (a * Math.PI) / 180;
		aPath.push([(250 + 170 * Math.cos(t)) * k, (230 + 200 * Math.sin(t)) * k]);
	}
	const aPage = aPath.map(([x, y]) => [
		box.x + view.dx + x * view.dz,
		box.y + view.dy - y * view.dz,
	]);
	const clip = {
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
	};
	await dragWithShots(p, aPage, 'B3-app-stroke', clip);
	const after = await p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { lastStrokeForChecks } = await import('/anyink/nib/nib_tool.js');
		const { previewShapes } = await import('/anyink/nib/preview.js');
		const { flattenContour, outlineGap } = await import('/anyink/nib/match.js');
		const { strokeRecords, strokeShapes } = await import('/anyink/nib/stroke_record.js');
		const item = editor.selectedItem;
		const last = lastStrokeForChecks();
		const record = strokeRecords(item).find((entry) => entry.id === last.strokeId);
		const shapes = strokeShapes(item, last.strokeId);
		const xMin = Math.round(Math.min(...shapes.map((s) => s.maxes.xMin)));
		const yMin = Math.round(Math.min(...shapes.map((s) => s.maxes.yMin)));
		const dx = record.at[0] - xMin;
		const dy = record.at[1] - yMin;
		const ink = shapes.map((shape) =>
			flattenContour(
				shape.pathPoints.map((pp, i) => {
					const next = shape.pathPoints[(i + 1) % shape.pathPoints.length];
					return [
						[pp.p.x + dx, pp.p.y + dy],
						[pp.h2.x + dx, pp.h2.y + dy],
						[next.h1.x + dx, next.h1.y + dy],
						[next.p.x + dx, next.p.y + dy],
					];
				}),
				0.1
			)
		);
		const gap = outlineGap(previewShapes(last.samples, last.size, { pixel: last.pixel }), ink);
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		return {
			steps: editor.history.queue.length,
			title: editor.history.queue[0].title,
			size: last.size,
			gap,
			share: gap / last.size,
			spacing: item.anyink.spacing,
			width: item.advanceWidth,
			card: document.querySelector('.anyink-letter-card')?.dataset.anyinkCardState,
			rail: text(document.querySelector('[data-anyink-step="letters"]')),
			sentence: text(document.querySelector('anyink-coach .anyink-coach__sentence')),
			undoTip: document.querySelector('[data-anyink-control="undo"]')?.title,
		};
	});
	assert.equal(after.steps, before.steps + 1);
	assert.equal(after.title, 'drew a stroke on small a');
	assert.equal(after.card, 'ready');
	assert.equal(after.spacing, 'auto');
	assert.ok(Number.isInteger(after.width) && after.width > 0);
	assert.ok(after.share <= 0.02, `app: ${(after.share * 100).toFixed(2)} %`);
	results.app = after;
	pass(
		`B3 the app (Simple): "${after.title}", one step, small a Ready, spacing automatic (width ${
			after.width
		}), rail "${after.rail}", Undo tip "${after.undoTip}"; live picture vs ink ${after.gap.toFixed(
			2
		)} units = ${(after.share * 100).toFixed(2)} % of ${after.size}`
	);
	await p.mouse.move(5, 895);
	await settle(p, 400);
	await shot(p, 'B4-app-simple-after-stroke');

	// the page says no banned word (strict), the canvas's own words included
	const hits = await p.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		return [...scanDom(document.body, { strict: true }), ...findUppercase(document.body)].map(
			formatHit
		);
	});
	assert.deepEqual(hits, []);
	pass('B5 the Simple page with a stroke says no banned word (strict)');

	await p.keyboard.press('Control+z');
	await settle(p, 300);
	const toastText = await p.evaluate(
		() =>
			document.querySelector('#toast[data-anyink-toast="simple"] .anyink-toast__text')
				?.textContent || null
	);
	await shot(p, 'B6-app-simple-undo-toast');
	const undone = await p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.selectedItem.shapes.length;
	});
	assert.equal(undone, 0);
	assert.equal(toastText, 'Undid: drew a stroke on small a');
	await p.keyboard.press('Control+y');
	await settle(p, 300);
	const redone = await p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return (
			editor.selectedItem.shapes.every((shape) => !!shape.anyink?.strokeId) &&
			editor.selectedItem.shapes.length
		);
	});
	assert.ok(redone >= 1);
	pass(
		`B6 Ctrl+Z: "${toastText}", the letter empty again; Ctrl+Y brings the stroke back, still brush ink`
	);
	await p.context().close();
}

// --------------------------------------------------------------
// C. the app, All tools
// --------------------------------------------------------------
{
	const p = await freshPage('app all');
	await newFont(p, '');
	await openLetter(p, 'glyph-0x61');
	const column = await p.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-tool]')]
			.filter((el) => el.checkVisibility())
			.map((el) => el.title)
	);
	assert.deepEqual(column.slice(0, 4), ['New rectangle', 'New oval', 'New path', 'Brush']);
	pass(`C1 All tools: the tool column is ${column.join(', ')}`);
	const brush = await p.locator('[data-anyink-tool="nib"]').boundingBox();
	await shot(p, 'C1-app-all-tools-column', {
		x: Math.max(0, Math.round(brush.x) - 60),
		y: Math.max(0, Math.round(brush.y) - 160),
		width: 160,
		height: 360,
	});
	await p.context().close();
}

await browser.close();
await pages.server.close();
await app.server.close();
console.log(JSON.stringify(results, null, 2));
console.log(`screenshots:\n${shotList.join('\n')}`);
if (errors.length) {
	console.log(`page errors:\n${errors.join('\n')}`);
	process.exitCode = 1;
}
