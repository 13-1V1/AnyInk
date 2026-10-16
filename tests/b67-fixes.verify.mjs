// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 + B7 finalize, real-browser check of every finding the fix tracks' verifiers left open (docs/
// UX-BEGINNER.md 4.0, 4.2, 4.3, 7.2, 7.3, 7.4, 7.6, principles 1, 5 and 6), in the real app on a Vite
// dev server, Chrome with a throwaway profile, 1600 x 900, ?ui=simple, the flags as the app has
// them. Each check uses real mouse and keyboard input:
//   G1  Space on a keyboard-focused "1 Letters" in the letter view goes to the letters; Space held
//       right after a mouse click on Undo pans and never presses Undo again
//   G2  the Point pen at points between whole font units, on five letters: Ctrl+Z after the third
//       click, then a click: the pen keeps its shape every time
//   G3  Ctrl+Z while the mouse is held on a new point: the next click places a point
//   G4  one rule for ink: three clicks leave the rail's count as it was, "Finish the shape" adds the
//       letter at once; the card and the Next line agree
//   G5  "<- All letters" with 2 points: the shape is taken away with a toast that names the letter;
//       the font check runs on the board; with 3 points the shape is finished there
//   G6  "Finish the shape" with 2 points: taken away, the Point pen stays picked, the line says
//       what to click
//   G7  Ctrl+Z, then Clear letter: "Cleared ..." [Undo] shows at once; the "Undid" toast is gone
//   G8  two like undos: the toast's [Redo] puts back the second
//   G9  Delete on a picked shape: "Deleted a shape from ..." [Undo], which brings it back; a
//       shape row picked with Edit points: Delete takes that shape
//   G10 three rectangles overlapping, a fourth inside all three: a hole (paper in its middle)
//   G11 Help and About: one green button; "Back to my letters" goes where "1 Letters" goes
//   G12 the strip's Try-it text is the font's name
//   G13 a failed save's Fix box: its first button is the one green button
//   G14 "Finish the shape" on a shape that merges into a hole: every picked shape is in the letter
//   then: no banned word on the screens it passed (strict), no page or console errors
// Usage: node tests/b67-fixes.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pinBeforeChecks } from './verify_standins.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b67-fixes'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b67-fixes-'));

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] }, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

const browser = await chromium.launch({ channel: process.env.B67_BROWSER || 'chrome', headless: true });
const errors = [];
const shotList = [];
const pass = (message) => console.log(`PASS ${message}`);
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);
const shot = async (name) => {
	await page.screenshot({ path: resolve(shots, `${name}.png`) });
	shotList.push(`${name}.png`);
};
const offCanvas = () => page.mouse.move(5, 895);

async function freshFont(name = 'Brennan Hand') {
	if (page) await page.context().close();
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	// B10 + B11 integration: this walkthrough checks B6 to B9 on toy letters; 'checks' off
	await pinBeforeChecks(page);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill(name);
	await page.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(500);
}

/** Opens a letter through the editor (standing in for B10's board, which isn't on yet) */
async function openLetter(id) {
	await page.evaluate(async (glyph) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = glyph;
		editor.nav.page = 'Characters';
		editor.navigate();
	}, id);
	await page.locator('.editor-page__tools-area').waitFor();
	await offCanvas();
	await settle(500);
}

const editorFacts = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const item = editor.nav.page === 'Characters' ? editor.selectedItem : null;
		const pen = editor.eventHandlers?.tool_addPath;
		const picked = editor.multiSelect?.shapes?.members || [];
		return {
			page: editor.nav.page,
			tool: editor.selectedTool,
			penOpen: !!pen?.newPath,
			penInLetter: !!pen?.newPath && !!item && item.shapes.includes(pen.newPath),
			points: (item?.shapes || []).map((shape) => shape.pathPoints?.length ?? 0),
			titles: editor.history.queue.slice(0, 6).map((entry) => entry.title),
			redo: editor.history.redoQueue.length,
			pickedInLetter: picked.every((shape) => !!item && item.shapes.includes(shape)),
			picked: picked.length,
		};
	});

const screenFacts = () =>
	page.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const coach = document.querySelector('anyink-coach');
		const coachButton = coach?.querySelector('.anyink-coach__button');
		const greenSelector =
			'.anyink-primary, fancy-button:not([secondary]):not([minimal]):not([danger]):not([disabled])';
		return {
			rail: text(document.querySelector('#app__top-bar [data-anyink-step="letters"]')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			tip: text(coach?.querySelector('.anyink-coach__tip')),
			coachButton: shown(coachButton) ? text(coachButton) : null,
			coachButtonGreen: shown(coachButton) && coachButton.classList.contains('anyink-primary'),
			card: document.querySelector('.anyink-letter-card')?.dataset.anyinkCardState || null,
			overlay: shown(document.querySelector('[data-anyink-overlay]')),
			greens: [...document.querySelectorAll(greenSelector)]
				.filter(shown)
				.filter((el) => !(el.closest('anyink-coach') && !el.classList.contains('anyink-primary')))
				.map((el) => text(el)),
			finish: shown(document.querySelector('#done-creating-path-button')),
			strip: document.querySelector('preview-strip input[type="text"], preview-strip input:not([type])')?.value ?? null,
		};
	});
const ready = async () => Number(/(\d+)\/\d+/.exec((await screenFacts()).rail)?.[1] ?? NaN);
const toastNow = () =>
	page.evaluate(() => {
		const toast = document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
		return toast
			? { text: toast.querySelector('.anyink-toast__text')?.textContent.trim() ?? '', button: toast.querySelector('button')?.textContent.trim() ?? null }
			: null;
	});
const scanSimple = () =>
	page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		return [...scanDom(document.body, { strict: true }), ...findUppercase(document.body)].map(formatHit);
	});

/** Font units to page pixels on the open letter (the view as it is now) */
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
const clickAt = async (p) => {
	await page.mouse.move(p.x, p.y, { steps: 2 });
	await settle(60);
	await page.mouse.down();
	await page.mouse.up();
	await settle(250);
};
const fineTune = async (open) => {
	const now = await page.evaluate(async () => (await import('/anyink/letter/view_switches.js')).isFineTuneOpen());
	if (now !== open) await page.locator('[data-anyink-toggle="fineTune"]').click();
	await offCanvas();
	await settle(300);
};
/** The tool keys (mode/keys.js, 7.6) */
const TOOL_KEYS = { resize: 'v', pathEdit: 'e', newPath: 'p', newRectangle: 'r', newOval: 'o' };
/**
 * Picks a tool: its button in the tool column when it shows, else its key (inside Fine-tune the
 * key opens Fine-tune and picks it, as on an empty letter, which has no Fine-tune section yet)
 */
const pickTool = async (tool) => {
	const button = page.locator(`[data-anyink-tool="${tool}"]`);
	if (await button.isVisible()) {
		await button.click();
	} else {
		await page.evaluate(() => document.activeElement?.blur?.());
		await page.keyboard.press(TOOL_KEYS[tool]);
	}
	await offCanvas();
	await settle(250);
	const now = await page.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedTool);
	assert.equal(now, tool, `picking ${tool}`);
};
/** A Rectangle tool drag from font units (x1, y1) to (x2, y2); the tool is Select after each */
const dragRect = async (x1, y1, x2, y2) => {
	await pickTool('newRectangle');
	const a = await at(x1, y2);
	const b = await at(x2, y1);
	await page.mouse.move(a.x, a.y, { steps: 2 });
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 6 });
	await page.mouse.up();
	await offCanvas();
	await settle(400);
};
/** Is the canvas pixel at these font units ink (dark) or paper? Nothing picked, so no handles */
const inkAt = async (ux, uy) => {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.multiSelect.points.clear();
		editor.multiSelect.shapes.clear();
		editor.editCanvas.redraw();
	});
	await settle(150);
	return page.evaluate(
		async ([x, y]) => {
			const view = (await import('/app/main.js')).getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const canvas = (host.shadowRoot || host).querySelector('canvas');
			const box = canvas.getBoundingClientRect();
			const scale = canvas.width / box.width;
			const [r, g, b, a] = canvas
				.getContext('2d')
				.getImageData(Math.round((view.dx + x * view.dz) * scale), Math.round((view.dy - y * view.dz) * scale), 1, 1).data;
			return a > 128 && (r + g + b) / 3 < 128;
		},
		[ux, uy]
	);
};
/** A shape's box in font units now (automatic spacing slides the letter at each step) */
const boxOf = (index) =>
	page.evaluate(async (i) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const m = editor.selectedItem.shapes.at(i).maxes;
		return { xMin: m.xMin, xMax: m.xMax, yMin: m.yMin, yMax: m.yMax };
	}, index);
const finishShape = async () => {
	await page.locator('#done-creating-path-button').click();
	await offCanvas();
	await settle(400);
};

try {
	await freshFont();
	// ----------------------------------------------------------
	// G12 the strip's Try-it text
	// ----------------------------------------------------------
	let s = await screenFacts();
	assert.equal(s.strip, 'Brennan Hand', `the strip's text: ${s.strip}`);
	pass(`G12 the strip's Try-it text starts as the font name: "${s.strip}"`);

	// ----------------------------------------------------------
	// G1 Space on the keyboard-focused rail; Space after a mouse click on Undo pans
	// ----------------------------------------------------------
	await openLetter('glyph-0x62');
	await pickTool('newRectangle');
	await dragRect(100, 0, 400, 500);
	const undo = page.locator('#app__top-bar [data-anyink-control="undo"]');
	await undo.click();
	await settle(300);
	let e = await editorFacts();
	assert.deepEqual(e.points, []);
	await page.keyboard.down('Space');
	await settle(200);
	await page.keyboard.up('Space');
	await settle(300);
	e = await editorFacts();
	assert.equal(e.redo, 1, 'Space after a click on Undo pressed it again');
	await offCanvas();
	// the keyboard's way there: Tab from the logo until "1 Letters" has the focus
	await page.locator('#app__top-bar [data-anyink-control="logo"]').focus();
	let focused = '';
	for (let tab = 0; tab < 5 && focused !== 'letters'; tab++) {
		await page.keyboard.press('Tab');
		focused = await page.evaluate(() => document.activeElement?.dataset?.anyinkStep || document.activeElement?.dataset?.anyinkControl);
	}
	assert.equal(focused, 'letters', `Tab reached ${focused}`);
	await page.keyboard.press('Space');
	await settle(500);
	e = await editorFacts();
	assert.equal(e.page, 'Overview', 'Space on the focused "1 Letters" did nothing');
	await shot('G1-space-on-rail-overview');
	pass('G1 Space on the keyboard-focused "1 Letters" in the letter view goes to the letters (Overview); Space held after a mouse click on Undo pans and presses nothing (the Redo list kept its 1 step)');

	// ----------------------------------------------------------
	// G2 Undo mid-shape at fractional points, five letters
	// ----------------------------------------------------------
	const kept = [];
	for (const id of ['glyph-0x61', 'glyph-0x63', 'glyph-0x6B', 'glyph-0x6D', 'glyph-0x62']) {
		await openLetter(id);
		await page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			editor.selectedItem.shapes = [];
		});
		await pickTool('newPath');
		const view = await page.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().view.dz);
		// screen points chosen between whole font units
		const p0 = await at(100.37, 0.41);
		const pts = [p0, { x: p0.x + 301.3 * view, y: p0.y }, { x: p0.x + 300.7 * view, y: p0.y - 499.6 * view }];
		for (const p of pts) await clickAt(p);
		await page.keyboard.press('Control+z');
		await settle(300);
		await clickAt({ x: p0.x + 0.6 * view, y: p0.y - 500.4 * view });
		e = await editorFacts();
		kept.push({ id, points: e.points, penInLetter: e.penInLetter });
		assert.deepEqual(e.points, [3], `${id}: ${JSON.stringify(e)}`);
		assert.equal(e.penInLetter, true, `${id}: the pen let go of its shape`);
		await finishShape();
	}
	await shot('G2-undo-mid-shape-fractional');
	pass(`G2 Undo mid-shape at points between whole units, then a click: the pen kept its shape on all five letters ${JSON.stringify(kept.map((k) => k.id.slice(-2)))}`);

	// ----------------------------------------------------------
	// G3 Ctrl+Z with the mouse held on a new point
	// ----------------------------------------------------------
	await openLetter('glyph-0x73');
	await pickTool('newPath');
	const q0 = await at(100, 0);
	await clickAt(q0);
	await clickAt(await at(400, 0));
	const third = await at(400, 500);
	await page.mouse.move(third.x, third.y, { steps: 2 });
	await page.mouse.down();
	await page.mouse.move(third.x + 6, third.y + 4, { steps: 2 });
	await page.keyboard.press('Control+z');
	await page.mouse.move(third.x + 10, third.y + 6, { steps: 2 });
	await page.mouse.up();
	await settle(300);
	await clickAt(await at(100, 500));
	e = await editorFacts();
	assert.equal(e.penInLetter, true, `the pen is dead: ${JSON.stringify(e)}`);
	assert.deepEqual(e.points, [2]);
	assert.equal(e.titles.some((t) => /undefined/.test(t)), false, `a step that changes nothing: ${e.titles}`);
	await finishShape();
	pass(`G3 Ctrl+Z with the mouse held on a new point: the next click placed a point (points ${JSON.stringify(e.points)}), no "added point undefined" step`);

	// ----------------------------------------------------------
	// G4 one rule for ink
	// ----------------------------------------------------------
	await openLetter('glyph-0x64');
	const before = await ready();
	await pickTool('newPath');
	for (const [x, y] of [[100, 0], [450, 0], [450, 500]]) await clickAt(await at(x, y));
	s = await screenFacts();
	assert.equal(await ready(), before, `three points open: the rail counted the letter (${s.rail})`);
	assert.equal(s.card, 'empty');
	assert.equal(s.sentence, 'Click your first point, or press Finish the shape.');
	assert.deepEqual(s.greens, ['Finish the shape']);
	await shot('G4a-three-points-open');
	await clickAt(await at(100, 500));
	await finishShape();
	s = await screenFacts();
	assert.equal(await ready(), before + 1, `finished: the rail didn't count it (${s.rail})`);
	assert.equal(s.card, 'ready');
	await shot('G4b-finished-counted');
	pass(`G4 three points still open: rail ${before}, card Empty, line "Click your first point, or press Finish the shape."; finished: rail ${before + 1} at once, card Ready`);

	// ----------------------------------------------------------
	// G5 leaving mid-shape
	// ----------------------------------------------------------
	await openLetter('glyph-0x65');
	const beforeE = await ready();
	await pickTool('newPath');
	await clickAt(await at(100, 0));
	await clickAt(await at(400, 0));
	await page.locator('[data-anyink-letter="back"]').click();
	await settle(500);
	e = await editorFacts();
	const dropped = await toastNow();
	assert.equal(e.page, 'Overview');
	assert.equal(e.penOpen, false);
	assert.deepEqual(dropped, { text: 'A shape needs at least 3 points, so the one on small e was taken away.', button: null });
	assert.equal(await ready(), beforeE);
	const checked = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getLastFontCheck } = await import('/anyink/fontcheck/font_check.js');
		const was = getLastFontCheck(editor);
		await new Promise((r) => setTimeout(r, 2600));
		return getLastFontCheck(editor) !== was;
	});
	assert.equal(checked, true, 'the font check waited on the board');
	await shot('G5a-left-with-two-points');
	await openLetter('glyph-0x65');
	await pickTool('newPath');
	for (const [x, y] of [[100, 0], [400, 0], [400, 500]]) await clickAt(await at(x, y));
	await page.locator('[data-anyink-letter="back"]').click();
	await settle(500);
	e = await editorFacts();
	const eShapes = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.project.getItem('glyph-0x65').shapes.map((shape) => shape.pathPoints.length);
	});
	assert.equal(e.penOpen, false);
	assert.deepEqual(eShapes, [3]);
	assert.equal(await ready(), beforeE + 1);
	pass(`G5 "<- All letters" with 2 points: "${dropped.text}", the rail unchanged, the font check ran on the board; with 3 points: finished there (points ${JSON.stringify(eShapes)}), counted`);

	// ----------------------------------------------------------
	// G6 Finish with 2 points
	// ----------------------------------------------------------
	await openLetter('glyph-0x66');
	await pickTool('newPath');
	await clickAt(await at(100, 0));
	await clickAt(await at(400, 0));
	await finishShape();
	e = await editorFacts();
	s = await screenFacts();
	const finishToast = await toastNow();
	assert.deepEqual(e.points, []);
	assert.equal(e.tool, 'newPath');
	assert.equal(finishToast.text, 'A shape needs at least 3 points, so that one was taken away.');
	assert.equal(s.sentence, 'Click on the paper to drop your first point.');
	assert.equal(s.card, 'empty');
	assert.deepEqual(await scanSimple(), []);
	await shot('G6-finish-with-two-points');
	pass(`G6 "Finish the shape" with 2 points: "${finishToast.text}", the letter empty, the Point pen still picked, the line "${s.sentence}"`);

	// ----------------------------------------------------------
	// G7, G8 undo toasts
	// ----------------------------------------------------------
	await openLetter('glyph-0x68');
	await pickTool('newRectangle');
	await dragRect(100, 0, 300, 400);
	await dragRect(400, 0, 600, 400);
	await page.keyboard.press('Control+z');
	await settle(300);
	assert.match((await toastNow()).text, /^Undid: /);
	await fineTune(true);
	const options = page.locator('[data-anyink-toggle="shapeOptions"]');
	if ((await options.getAttribute('aria-expanded')) !== 'true') await options.click();
	await settle(200);
	await page.locator('[data-anyink-action="clear"]').click();
	await settle(120);
	const cleared = await toastNow();
	assert.deepEqual(cleared, { text: 'Cleared small h.', button: 'Undo' });
	await shot('G7-cleared-at-once');
	await page.locator('#toast[data-anyink-toast="simple"]:not([data-leaving]) button').click();
	await settle(300);
	e = await editorFacts();
	assert.deepEqual(e.points, [4]);
	pass(`G7 Ctrl+Z, then Clear letter: "${cleared.text}" [${cleared.button}] showed at once (120 ms), the "Undid" toast gone; its Undo brought the shape back`);

	await page.keyboard.press('Escape');
	await pickTool('newRectangle');
	await dragRect(400, 0, 600, 400);
	await page.keyboard.press('Control+z');
	await settle(200);
	await page.keyboard.press('Control+z');
	await settle(300);
	e = await editorFacts();
	assert.equal(e.points.length, 0);
	const twice = await toastNow();
	await page.locator('#toast[data-anyink-toast="simple"]:not([data-leaving]) button').click();
	await settle(300);
	e = await editorFacts();
	assert.equal(e.points.length, 1, `two like undos: the toast's Redo did nothing (${JSON.stringify(e)})`);
	await shot('G8-two-undos-redo');
	pass(`G8 two like undos ("${twice.text}" [${twice.button}]): its Redo put back the second (shapes 0 -> 1)`);

	// ----------------------------------------------------------
	// G9 Delete
	// ----------------------------------------------------------
	await openLetter('glyph-0x6E');
	await pickTool('newRectangle');
	await dragRect(100, 0, 300, 400);
	const firstN = await boxOf(0);
	await dragRect(firstN.xMax + 100, 0, firstN.xMax + 300, 400);
	await pickTool('resize');
	const second = await boxOf(1);
	// a click on the paper lets go of the shape just drawn; a click on the second picks it
	await clickAt(await at(second.xMax + 300, 600));
	await clickAt(await at((second.xMin + second.xMax) / 2, (second.yMin + second.yMax) / 2));
	assert.equal((await editorFacts()).picked, 1, 'the click picked no shape');
	await page.keyboard.press('Delete');
	await settle(300);
	const deleted = await toastNow();
	assert.deepEqual(deleted, { text: 'Deleted a shape from small n.', button: 'Undo' });
	await shot('G9a-deleted-shape-toast');
	await page.locator('#toast[data-anyink-toast="simple"]:not([data-leaving]) button').click();
	await settle(300);
	e = await editorFacts();
	assert.deepEqual(e.points, [4, 4]);
	await fineTune(true);
	await pickTool('pathEdit');
	const firstBox = await boxOf(0);
	await clickAt(await at(firstBox.xMin, firstBox.yMin));
	await page.locator('[data-anyink-shape-row="1"]').click();
	await settle(200);
	await page.keyboard.press('Delete');
	await settle(300);
	e = await editorFacts();
	assert.deepEqual(e.points, [4]);
	pass(`G9 Delete on a picked shape: "${deleted.text}" [${deleted.button}], its Undo brought it back; with Edit points and the Shape 2 row picked, Delete took Shape 2 (points ${JSON.stringify(e.points)})`);

	// ----------------------------------------------------------
	// G10 three rectangles overlapping, a fourth inside all three
	// ----------------------------------------------------------
	await openLetter('glyph-0x6F');
	await pickTool('newRectangle');
	await dragRect(0, 0, 500, 500);
	// where the first one sits now: each later one is drawn against it
	const ox = async () => (await boxOf(0)).xMin;
	let x0 = await ox();
	await dragRect(x0 + 200, 0, x0 + 700, 500);
	x0 = await ox();
	await dragRect(x0 + 100, 200, x0 + 600, 700);
	x0 = await ox();
	await dragRect(x0 + 300, 250, x0 + 400, 350);
	const centre = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const m = editor.selectedItem.shapes.at(-1).maxes;
		return [(m.xMin + m.xMax) / 2, (m.yMin + m.yMax) / 2, m.xMin - 30, (m.yMin + m.yMax) / 2];
	});
	const holeToast = await toastNow();
	const middlePaper = !(await inkAt(centre[0], centre[1]));
	const besideInk = await inkAt(centre[2], centre[3]);
	assert.equal(middlePaper, true, 'the fourth rectangle is no hole');
	assert.equal(besideInk, true, 'the overlap beside it lost its ink');
	await shot('G10-hole-in-triple-overlap');
	pass(`G10 three rectangles overlapping, a fourth inside all three: paper in its middle, ink beside it; toast "${holeToast?.text}"`);

	// ----------------------------------------------------------
	// G14 Finish on a shape that merges into a hole: no ghost
	// ----------------------------------------------------------
	await openLetter('glyph-0x71');
	await pickTool('newRectangle');
	await dragRect(0, 0, 800, 800);
	const outerNow = await boxOf(0);
	await dragRect(outerNow.xMin + 150, 150, outerNow.xMin + 450, 450);
	const hole = await boxOf(1);
	await pickTool('newPath');
	// four points across the hole's top right corner, all inside the outer shape
	const hx = (hole.xMin + hole.xMax) / 2;
	const hy = (hole.yMin + hole.yMax) / 2;
	const across = [
		[hx, hy],
		[hole.xMax + 150, hy],
		[hole.xMax + 150, hole.yMax + 150],
		[hx, hole.yMax + 150],
	];
	for (const [x, y] of across) await clickAt(await at(x, y));
	await finishShape();
	e = await editorFacts();
	assert.equal(e.pickedInLetter, true, `a picked shape is not in the letter: ${JSON.stringify(e)}`);
	await shot('G14-finish-merged-no-ghost');
	pass(`G14 "Finish the shape" on a shape merged into the hole it crossed: every picked shape is in the letter (${e.picked} picked, shapes ${JSON.stringify(e.points)}), toast "${(await toastNow())?.text}"`);

	// ----------------------------------------------------------
	// G13 a failed save's Fix box
	// ----------------------------------------------------------
	await openLetter('glyph-0x75');
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { setSaveStatus } = await import('/anyink/files/save_status.js');
		setSaveStatus(editor, { file: 'failed', error: 'NotAllowedError' });
	});
	await settle(300);
	await page.locator('#app__top-bar [data-anyink-control="status"] button').click();
	await settle(400);
	s = await screenFacts();
	assert.deepEqual(s.greens, ['Try again'], `greens with the Fix box open: ${JSON.stringify(s.greens)}`);
	assert.equal(s.overlay, true);
	await shot('G13-fix-box-one-green');
	await page.keyboard.press('Escape');
	await settle(300);
	pass(`G13 the Fix box over an empty letter: one green button ${JSON.stringify(s.greens)} (the overlay's outlined)`);

	// ----------------------------------------------------------
	// G11 Help and About
	// ----------------------------------------------------------
	for (const name of ['About', 'Help']) {
		await page.evaluate(async (pageName) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			editor.nav.page = pageName;
			editor.navigate();
		}, name);
		await settle(600);
		s = await screenFacts();
		assert.deepEqual(s.greens, ['Back to my letters'], `${name}: ${JSON.stringify(s.greens)}`);
		assert.equal(s.coachButtonGreen, false);
		await shot(`G11-${name.toLowerCase()}-one-green`);
		await page.locator('[data-anyink-choice="backToLetters"]').click();
		await settle(500);
		assert.equal((await editorFacts()).page, 'Overview');
	}
	assert.deepEqual(await scanSimple(), []);
	pass('G11 Help and About: one green button, "Back to my letters" (the Next line\'s outlined); it goes to the Overview, where "1 Letters" goes');

	assert.deepEqual(errors, [], 'page errors');
	pass('no page errors, no console errors');
	console.log(`screenshots (${shotList.length}) in ${shots}:\n  ${shotList.join('\n  ')}`);
} catch (error) {
	console.error(`FAIL ${error.message}`);
	if (errors.length) console.error(`page errors: ${JSON.stringify(errors, null, 1)}`);
	await page?.screenshot({ path: resolve(shots, 'FAIL-screen.png') }).catch(() => {});
	process.exitCode = 1;
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => {});
}
