// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 fix track (layer wiring): real-Chrome check of the S2 critic's wiring problems in the real
// app, Simple, with the 'sketch' flag turned on from the page (it stays off in the app):
//   1. a finished stem stays on the canvas on Select, on the Brush and after leaving the letter
//      (purple pixels on the stem's column), and nothing of it shows with the flag off
//   2. Ctrl+E, Esc, then a click near the small-letter line still snaps onto it
//   3. a right press with a piece open finishes it; the page's contextmenu event is cancelled
//   4. Menu open, Esc: the Menu closes, the piece stays open; with no piece the tool stays picked
//   5. Space-pan mid-piece, mouse let go first: the Line tool comes back with the piece open
//   6. a plain wheel zooms about the cursor (Simple with the sketch on)
//   7. Circle, Arc and Rectangle say their size at the cursor
// Prints PASS / FAIL lines; exits 1 on any FAIL.
// Usage: node tests/sketch_layer_fixes.verify.mjs [screenshot folder]   (default: OS temp)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-sketch-layer-fixes'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-sketch-layer-fixes-'));

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: {
		port: 0,
		host: '127.0.0.1',
		hmr: false,
		watch: { ignored: ['**/*'] },
		fs: { strict: false },
	},
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({
	channel: process.env.SKETCH_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
let failures = 0;
let passes = 0;

function check(label, ok, detail = '') {
	if (ok) passes++;
	else failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
	return ok;
}

const setFlag = (page, on) =>
	page.evaluate(async (value) => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: value });
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.navigate();
	}, on);

async function openLetter(page, char) {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	});
	await page.locator('[data-anyink-board]').waitFor({ timeout: 10000 });
	await page.mouse.move(5, 300);
	await page.keyboard.press(char);
	await page.waitForFunction(
		async (c) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			return (
				editor.nav.page === 'Characters' &&
				editor.selectedItem?.chars === c &&
				!!document.querySelector('edit-canvas')?.canvas?.isConnected
			);
		},
		char,
		{ timeout: 10000 }
	);
	await page.waitForTimeout(250);
}

const state = (page) =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { isPieceOpen } = await import('/anyink/sketch/tools/undo_gate.js');
		const item = editor.selectedItem;
		return {
			tool: editor.selectedTool,
			sketch: item?.anyink?.sketch ? JSON.parse(JSON.stringify(item.anyink.sketch)) : null,
			open: isPieceOpen(),
			dz: editor.view.dz,
		};
	});

const viewOf = (page) =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const canvas = document.querySelector('edit-canvas').canvas;
		const r = canvas.getBoundingClientRect();
		const { guideLines } = await import('/anyink/placement/classes.js');
		return {
			left: r.left,
			top: r.top,
			view: { ...editor.view },
			lines: guideLines(editor.project.settings.font),
		};
	});

const screenOf = (v, x, y) => ({
	x: v.left + v.view.dx + x * v.view.dz,
	y: v.top + v.view.dy - y * v.view.dz,
});

async function moveTo(page, v, x, y, steps = 6) {
	const p = screenOf(v, x, y);
	await page.mouse.move(p.x, p.y, { steps });
}

async function clickAt(page, v, x, y, { pause = 120, button = 'left' } = {}) {
	await moveTo(page, v, x, y);
	await page.mouse.down({ button });
	await page.mouse.up({ button });
	await page.waitForTimeout(pause);
}

const pick = (page, tool) =>
	page.evaluate(async (t) => (await import('/edit_canvas/tools/tools.js')).selectTool(t), tool);

/** Purple-ish pixels in a thin column of the canvas at font x, between two font ys */
const purpleOnColumn = (page, x, y0, y1) =>
	page.evaluate(
		async ({ x, y0, y1 }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			editor.editCanvas.redraw('verify');
			await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
			const canvas = document.querySelector('edit-canvas').canvas;
			const ctx = canvas.getContext('2d');
			const scale = canvas.width / canvas.getBoundingClientRect().width;
			const v = editor.view;
			const cx = Math.round((v.dx + x * v.dz) * scale);
			const top = Math.round((v.dy - y1 * v.dz) * scale);
			const bottom = Math.round((v.dy - y0 * v.dz) * scale);
			const data = ctx.getImageData(cx - 3, top, 7, bottom - top).data;
			let count = 0;
			for (let i = 0; i < data.length; i += 4) {
				const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
				if (b > 150 && r > 80 && g < 120 && b > g + 60) count++;
			}
			return count;
		},
		{ x, y0, y1 }
	);

/** The draw layer's picture for the picked tool, at the pointer */
const pictureNow = (page, at) =>
	page.evaluate(async (pointer) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { drawSketchLayer } = await import('/anyink/sketch/tools/draw_layer.js');
		const ctx = document.createElement('canvas').getContext('2d');
		const p = drawSketchLayer(ctx, editor.view, editor.selectedItem, editor, { pointer });
		return p ? { readout: p.readout, pieces: p.pieces.length, points: p.points.length } : null;
	}, at);

async function shot(page, name) {
	const path = resolve(shots, `${name}.png`);
	await page.screenshot({ path });
	console.log(`shot ${path}`);
}

let page = null;
try {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Layer Fixes');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page.waitForTimeout(500);

	// ---- flag off: plain wheel does nothing (as before) --------------------------------------
	await openLetter(page, 'n');
	let v = await viewOf(page);
	await moveTo(page, v, 300, 600);
	let dz0 = (await state(page)).dz;
	await page.mouse.wheel(0, -300);
	await page.waitForTimeout(150);
	check('flag off: a plain wheel leaves the zoom as before', (await state(page)).dz === dz0);

	await setFlag(page, true);
	await openLetter(page, 'n');
	v = await viewOf(page);
	const { lines } = v;
	const stemX = 160;

	// ---- 1. the stem stays on the canvas ------------------------------------------------------
	await page.keyboard.press('l');
	await clickAt(page, v, stemX, lines.writing + 2);
	await clickAt(page, v, stemX, lines.small - 2);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(120);
	let s = await state(page);
	check('1. the stem is stored', s.sketch?.pieces?.length === 1, `pieces ${s.sketch?.pieces?.length}`);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(120);
	s = await state(page);
	const onSelect = await purpleOnColumn(page, stemX, lines.writing + 100, lines.small - 100);
	check('1. on Select the stem still shows', s.tool === 'resize' && onSelect > 20, `tool ${s.tool}, purple ${onSelect}`);
	await shot(page, 'f1-select');
	await pick(page, 'nib');
	const onBrush = await purpleOnColumn(page, stemX, lines.writing + 100, lines.small - 100);
	check('1. on the Brush the stem still shows', onBrush > 20, `purple ${onBrush}`);
	await openLetter(page, 'o');
	await openLetter(page, 'n');
	const backOnN = await purpleOnColumn(page, stemX, lines.writing + 100, lines.small - 100);
	check('1. after o and back to n the stem still shows', backOnN > 20, `purple ${backOnN} tool ${(await state(page)).tool}`);
	// S2 finalize: a sketched letter with no ink opens on Line; the read-only picture is Select's
	await pick(page, 'resize');
	const picture = await pictureNow(page, null);
	check('1. read-only: no dots off the sketch tools', picture && picture.points === 0 && picture.pieces === 1, JSON.stringify(picture));
	await setFlag(page, false);
	await openLetter(page, 'n');
	const flagOff = await purpleOnColumn(page, stemX, lines.writing + 100, lines.small - 100);
	check('1. flag off: nothing of the sketch is drawn', flagOff === 0, `purple ${flagOff}`);
	await setFlag(page, true);

	// ---- 2. Ctrl+E, Esc, the next click still snaps --------------------------------------------
	await openLetter(page, 'x');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 200, lines.writing + 2);
	await page.keyboard.press('Control+e');
	await page.waitForTimeout(600);
	const dialogOpen = await page.evaluate(() => !!document.querySelector('[data-anyink-dialog]'));
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	await clickAt(page, v, 400, lines.small - 4);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(150);
	s = await state(page);
	const xPoints = Object.values(s.sketch?.points || {});
	const top = xPoints.find((p) => p.on === 'small');
	check('2. Ctrl+E, Esc, then a click near the small-letter line snaps onto it', !!top, `dialog ${dialogOpen}, points ${JSON.stringify(xPoints)}`);

	// ---- 3. a right press finishes the piece -------------------------------------------------
	await openLetter(page, 'v');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 150, lines.small - 2);
	await clickAt(page, v, 300, lines.writing + 2);
	const menuCancelled = page.evaluate(
		() =>
			new Promise((done) => {
				const canvas = document.querySelector('edit-canvas').canvas;
				canvas.addEventListener('contextmenu', (e) => setTimeout(() => done(e.defaultPrevented)), { once: true });
			})
	);
	await clickAt(page, v, 450, lines.small - 2, { button: 'right' });
	s = await state(page);
	check('3. a right press finishes the open piece', !s.open && s.sketch?.pieces?.length === 1 && s.tool === 'sketchLine', `open ${s.open} pieces ${s.sketch?.pieces?.length} tool ${s.tool}`);
	check('3. the browser menu is cancelled', (await menuCancelled) === true);

	// ---- 4. Esc with the Menu open -----------------------------------------------------------
	await openLetter(page, 'w');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 150, lines.small - 2);
	await clickAt(page, v, 300, lines.writing + 2);
	await page.locator('[data-anyink-control="menu"]').click();
	await page.waitForTimeout(250);
	const menusBefore = await page.locator('[data-anyink-menu="simple"]').count();
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	const menusAfter = await page.locator('[data-anyink-menu="simple"]').count();
	s = await state(page);
	check('4. Esc closes the Menu and the piece stays open', menusBefore === 1 && menusAfter === 0 && s.open && !s.sketch, `menus ${menusBefore} -> ${menusAfter}, open ${s.open}`);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(120);
	await page.locator('[data-anyink-control="menu"]').click();
	await page.waitForTimeout(250);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	s = await state(page);
	check('4. no piece open: Esc closes the Menu and the Line tool stays picked', s.tool === 'sketchLine', `tool ${s.tool}`);

	// ---- 5. Space-pan mid-piece --------------------------------------------------------------
	await openLetter(page, 'k');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 150, lines.writing + 2);
	await moveTo(page, v, 400, 600);
	await page.keyboard.down('Space');
	await page.waitForTimeout(80);
	await page.mouse.down();
	await page.mouse.move(v.left + 600, v.top + 300, { steps: 6 });
	await page.mouse.up();
	await page.waitForTimeout(300); // the held Space repeats its key-down
	await page.keyboard.up('Space');
	await page.waitForTimeout(120);
	s = await state(page);
	check('5. after a Space-pan the Line tool is back with the piece open', s.tool === 'sketchLine' && s.open, `tool ${s.tool} open ${s.open}`);
	v = await viewOf(page);
	await clickAt(page, v, 150, lines.small - 2);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(120);
	s = await state(page);
	check('5. the next click goes on the same piece', s.sketch?.pieces?.length === 1 && s.sketch.pieces[0].parts.length === 1, JSON.stringify(s.sketch?.pieces?.map((p) => p.parts.length)));

	// ---- 6. the wheel --------------------------------------------------------------------------
	dz0 = (await state(page)).dz;
	await moveTo(page, v, 300, 600);
	await page.mouse.wheel(0, -300);
	await page.waitForTimeout(150);
	const dz1 = (await state(page)).dz;
	check('6. a plain wheel zooms in (Simple, sketch on)', dz1 > dz0, `${dz0} -> ${dz1}`);

	// ---- 7. readouts ---------------------------------------------------------------------------
	await openLetter(page, 'o');
	v = await viewOf(page);
	await page.keyboard.press('c');
	await moveTo(page, v, 500, 550);
	await page.mouse.down();
	await moveTo(page, v, 800, 550);
	const center = screenOf(v, 800, 550);
	let pic = await pictureNow(page, { x: center.x - v.left, y: center.y - v.top });
	check('7. Circle: its size across at the cursor', /^\d\.\d\d in across$/.test(pic?.readout?.text || ''), pic?.readout?.text);
	await shot(page, 'f7-circle');
	await page.mouse.up();
	await page.keyboard.press('Escape');
	await page.keyboard.press('r');
	await clickAt(page, v, 200, 100);
	await moveTo(page, v, 700, 900);
	pic = await pictureNow(page, null);
	check('7. Rectangle: width x height', /^\d\.\d\d x \d\.\d\d in$/.test(pic?.readout?.text || ''), pic?.readout?.text);
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await page.keyboard.press('a');
	await clickAt(page, v, 200, 500);
	await clickAt(page, v, 800, 500);
	await moveTo(page, v, 500, 800);
	pic = await pictureNow(page, null);
	check('7. Arc: its radius, beside the bend words', /^R \d\.\d\d in, click to set how far it bends$/.test(pic?.readout?.text || ''), pic?.readout?.text);
	await shot(page, 'f7-arc');
	await page.keyboard.press('Escape');

	check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (error) {
	failures++;
	console.log(`FAIL the run stopped: ${error?.stack || error}`);
	if (page) await shot(page, 'stopped').catch(() => {});
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => {});
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
