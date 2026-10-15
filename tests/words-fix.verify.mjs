// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass, words track: real-browser check of the critic findings this track fixed, in
// the dev app (Vite on src/), Chrome with a throwaway profile, 1600 x 900, ?ui=simple then All tools:
//   1. the empty preview says what fits: "Your letters show here as you make them." with text and
//      no made letter, "Type something to see your letters here." with an empty field
//   2. the Overview's sample sentence sits on the paper token (not ink on the dark card), with its
//      contrast measured
//   3. Simple's save status: one of the four 4.11 states, no word about backup copies, its tooltip
//      what to press
//   4. pointing at the left edge draws one label (the readout), not two
//   5. after touching the strip (the size slider, Samples, [Fix it]) Ctrl+Z, Ctrl+Y and the tool
//      keys work
//   6. a letter in the strip says "Double-click to work on small a"
//   7. Simple draws no neighbor letters even when More tools turned them on
//   8. the strict scan (2.3 plus 2.4 E and G) on the letter page is clean; on the surfaces other
//      tracks put words on (the Overview's letter-set switch, the start page, About, the error box)
//      it is recorded, for their report
//   9. All tools: the save status and the neighbor letters as before; the edge has one label too
// Usage: node tests/words-fix.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { toOverview } from './verify_standins.mjs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-words-fix'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-words-fix-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B4_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
await context.addInitScript(() => {
	window.__canvasTexts = [];
	for (const proto of [
		CanvasRenderingContext2D.prototype,
		OffscreenCanvasRenderingContext2D.prototype,
	]) {
		for (const name of ['fillText', 'strokeText']) {
			const original = proto[name];
			proto[name] = function (text, ...rest) {
				window.__canvasTexts.push(String(text));
				return original.call(this, text, ...rest);
			};
		}
	}
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('dialog', (dialog) => dialog.dismiss());

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`), fullPage: false });
const settle = (ms = 350) => page.waitForTimeout(ms);
const offCanvas = () => page.mouse.move(5, 895);
const numbers = {};

const editorState = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return {
			page: editor.nav.page,
			item: editor.selectedItemID,
			shapes: editor.selectedItem?.shapes?.length ?? 0,
			history: editor.history.queue.length,
			tool: editor.selectedTool,
		};
	});
const canvasTexts = () => page.evaluate(() => [...new Set(window.__canvasTexts)]);
const resetCanvasTexts = () => page.evaluate(() => (window.__canvasTexts = []));
const redrawLetter = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		window.__canvasTexts = [];
		editor.editCanvas.redraw('verify');
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	});
/** A point on the open letter's canvas, in font units */
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
const drag = async (from, to) => {
	await page.mouse.move(from.x - 15, from.y, { steps: 3 });
	await page.mouse.move(from.x, from.y, { steps: 3 });
	await settle(80);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 4 });
	await page.mouse.up();
	await offCanvas();
	await settle(250);
};
const newFont = async (search) => {
	await page.evaluate(() => (window.onbeforeunload = null)).catch(() => {});
	await page.goto(`${origin}/${search}`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle();
};
const openSmallA = async () => {
	await toOverview(page);
	await page.locator('glyph-tile[displayed-item-id="glyph-0x61"]').click();
	await page.locator('.editor-page__zoom-area').waitFor();
	await offCanvas();
	await settle(500);
};
const status = () =>
	page.evaluate(() => {
		const element = document.querySelector('#app__top-bar anyink-save-status');
		return {
			text: element.textContent,
			title: element.title,
			status: element.dataset.status || '',
		};
	});
/** The strict scan (2.3 plus 2.4 E and G) in the real page, with real CSS */
const strictScan = (selector) =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		if (!root) return ['(nothing on screen)'];
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);
/** WCAG contrast of two CSS colors as the page computes them */
const contrast = (a, b) =>
	page.evaluate(
		([x, y]) => {
			const rgb = (css) => {
				const probe = document.createElement('div');
				probe.style.color = css;
				document.body.appendChild(probe);
				const value = getComputedStyle(probe)
					.color.match(/[\d.]+/g)
					.map(Number);
				probe.remove();
				return value;
			};
			const lum = ([r, g, b]) =>
				[r, g, b]
					.map((c) => c / 255)
					.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
					.reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
			const [l1, l2] = [lum(rgb(x)), lum(rgb(y))].sort((p, q) => q - p);
			return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
		},
		[a, b]
	);

try {
	// ----------------------------------------------------------
	// Simple
	// ----------------------------------------------------------
	await newFont('?ui=simple');
	await settle(800);

	// 1. The empty preview's sentence
	const stripText = await page.locator('preview-strip .preview-strip__text').inputValue();
	let drawn = await canvasTexts();
	assert.ok(stripText.trim().length > 0, 'the strip has text');
	assert.ok(drawn.includes('Your letters show here as you make them.'), JSON.stringify(drawn));
	assert.ok(
		!drawn.includes('Type something to see your letters here.'),
		'not "Type something" with text typed'
	);
	await shot('fix-01-strip-letters-not-made');
	await page.locator('preview-strip .preview-strip__text').fill('');
	await resetCanvasTexts();
	await settle(300);
	drawn = await canvasTexts();
	assert.ok(drawn.includes('Type something to see your letters here.'), JSON.stringify(drawn));
	await page.locator('preview-strip .preview-strip__text').fill(stripText);
	await page.locator('preview-strip .preview-strip__text').press('Escape');
	pass(
		`the empty preview: "Your letters show here as you make them." with "${stripText}" typed; "Type something..." when the field is empty`
	);

	// 2. The Overview's sample sentence on paper
	await toOverview(page);
	const overview = await page.evaluate(() => {
		const canvas = document.querySelector('.content-page__right-area display-canvas');
		const root = getComputedStyle(document.documentElement);
		return {
			background: getComputedStyle(canvas).backgroundColor,
			card: getComputedStyle(canvas.parentElement).backgroundColor,
			paper: root.getPropertyValue('--canvas-bg').trim(),
			ink: root.getPropertyValue('--canvas-ink').trim(),
			hostRule: canvas.shadowRoot.querySelector('style').textContent.includes('var(--canvas-bg)'),
		};
	});
	const inkOnPaper = await contrast(overview.ink, overview.background);
	const inkOnCard = await contrast(overview.ink, overview.card);
	assert.ok(overview.hostRule, 'the display canvas carries the paper rule in its shadow root');
	assert.ok(inkOnPaper >= 4.5, `ink on the sample's paper: ${inkOnPaper}:1`);
	numbers.overview = { ...overview, inkOnPaper, inkOnCard };
	await shot('fix-02-overview-paper');
	pass(
		`the Overview's sample sentence sits on the paper (${overview.background}): ink ${inkOnPaper}:1 (it was ${inkOnCard}:1 on the card)`
	);

	// 8a. The strict scan of the Overview (the letter-set switch is the pages track's)
	numbers.strict = { overview: await strictScan('#app__wrapper') };

	// 3. The save status, Simple
	await page.locator('glyph-tile[displayed-item-id="glyph-0x61"]').click();
	await page.locator('.editor-page__zoom-area').waitFor();
	await offCanvas();
	await settle(500);
	const before = await status();
	assert.equal(before.text, 'Not saved yet');
	await page.keyboard.press('r');
	await settle(200);
	await drag(await at(100, 60), await at(400, 460));
	let now = await editorState();
	assert.equal(now.shapes, 1, 'the rectangle is drawn');
	await settle(3500); // past the backup copy's 3 s wait
	const after = await status();
	assert.equal(after.text, 'Not saved yet', JSON.stringify(after));
	assert.equal(after.title, 'Press Save to choose where your work file goes.');
	assert.equal(after.status, 'not-saved');
	assert.ok(!/backup/i.test(`${after.text} ${after.title}`), 'no word about the backup copy');
	await shot('fix-03-status-after-rectangle');
	pass(
		`Simple's save status after a rectangle and a backup copy: "${after.text}", tooltip "${after.title}"`
	);

	// 4. One label on the pointed-at left edge
	await page.keyboard.press('v');
	await settle(200);
	const edge = await at(0, 300);
	await resetCanvasTexts();
	await page.mouse.move(edge.x - 30, edge.y, { steps: 3 });
	await page.mouse.move(edge.x, edge.y, { steps: 4 });
	await settle(300);
	const spaces = (await canvasTexts()).filter((text) => /space/i.test(text));
	assert.equal(spaces.length, 1, JSON.stringify(spaces));
	assert.match(spaces[0], /^left space -?\d/);
	await shot('fix-04-left-edge-one-label');
	await offCanvas();
	pass(`pointing at the left edge draws one label: ${JSON.stringify(spaces)}`);

	// 5. Keys after touching the strip
	now = await editorState();
	const slider = page.locator('preview-strip .points-slider input[type="range"]');
	await slider.click();
	await settle(200);
	assert.equal(
		await page.evaluate(() => document.activeElement?.type),
		'range',
		'the slider has focus'
	);
	await page.keyboard.press('Control+z');
	await settle(300);
	const undone = await editorState();
	assert.equal(
		undone.shapes,
		0,
		`Ctrl+Z from the size slider undoes the rectangle (${JSON.stringify(undone)})`
	);
	await page.locator('preview-strip .preview-strip__presets').focus();
	await page.keyboard.press('Control+y');
	await settle(300);
	assert.equal((await editorState()).shapes, 1, 'Ctrl+Y from the Samples button redoes it');
	await page.keyboard.press('r');
	await settle(200);
	assert.equal(
		(await editorState()).tool,
		'newRectangle',
		'R from the Samples button picks Rectangle'
	);
	await page.keyboard.press('v');
	await settle(200);
	// [Fix it]: a letter whose width is below zero, set by hand (the critic's small e); Simple's
	// spacing leaves a letter set by hand alone, so the check names it and Fix it gives it a width
	// (small b too, so the line stays up with b's problem after small a is fixed and the focus
	// stays on [Fix it], as in the critic's run)
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { Glyph } = await import('/project_data/glyph.js');
		const item = editor.selectedItem;
		item.anyink = { ...(item.anyink || {}), spacing: 'manual' };
		item.advanceWidth = -40;
		editor.project.addItemByType(new Glyph({ advanceWidth: -40 }), 'Glyph', 'glyph-0x62');
		const { runFontCheckNow } = await import('/anyink/fontcheck/font_check.js');
		runFontCheckNow(editor);
	});
	await settle(400);
	const historyBeforeFix = (await editorState()).history;
	const fixIt = page.locator('preview-strip .preview-strip__check .anyink-notice__button').nth(1);
	await fixIt.waitFor({ state: 'visible', timeout: 5000 });
	const widthBefore = await page.evaluate(
		async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedItem.advanceWidth
	);
	await fixIt.click();
	await settle(400);
	const widthFixed = await page.evaluate(
		async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedItem.advanceWidth
	);
	assert.equal(
		await page.evaluate(() => document.activeElement?.textContent),
		'Fix it',
		'focus stays on Fix it'
	);
	assert.equal((await editorState()).history, historyBeforeFix + 1, 'Fix it is one Undo step');
	await page.keyboard.press('Control+z');
	await settle(400);
	const widthUndone = await page.evaluate(
		async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedItem.advanceWidth
	);
	// The width set by hand above made no Undo step, so Undo goes back to the step before Fix it
	assert.ok(
		widthFixed > 0 && widthUndone !== widthFixed,
		`Fix it then Ctrl+Z: ${widthBefore} -> ${widthFixed} -> ${widthUndone}`
	);
	assert.equal(
		(await editorState()).history,
		historyBeforeFix,
		'Ctrl+Z from [Fix it] undid that step'
	);
	await page.keyboard.press('Control+y');
	await settle(300);
	assert.equal(
		(await editorState()).history,
		historyBeforeFix + 1,
		'Ctrl+Y from [Fix it] redid it'
	);
	await shot('fix-05-keys-after-strip');
	pass(
		`after the size slider, Samples and [Fix it] the app's keys work: Ctrl+Z, Ctrl+Y, R (Fix it ${widthBefore} -> ${widthFixed}, Ctrl+Z -> ${widthUndone})`
	);

	// 6. The strip's letter tooltip
	await page.locator('preview-strip .preview-strip__text').fill('aaa');
	await page.locator('preview-strip .preview-strip__text').press('Escape');
	await settle(400);
	const letterPoint = await page.evaluate(() => {
		const strip = document.querySelector('preview-strip');
		const renderer = strip.renderer;
		const box = renderer.canvas.getBoundingClientRect();
		for (const block of renderer.textBlock.data) {
			for (const data of block) {
				if (data.char === 'a' && data.isVisible && data.view) {
					return {
						x: box.left + data.view.dx + (data.widths.advance * data.view.dz) / 2,
						y: box.top + data.view.dy - 5,
					};
				}
			}
		}
		return null;
	});
	assert.ok(letterPoint, 'small a is on the strip');
	const stripTitle = () =>
		page.evaluate(() =>
			document.querySelector('preview-strip .preview-strip__canvas-wrapper').getAttribute('title')
		);
	const openLetter = (id) =>
		page.evaluate(async (itemId) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			(await import('/anyink/preview/show_item.js')).showItem(editor, itemId);
		}, id);
	// B4 + B5 finalize: over the letter already open the tooltip says nothing (a double-click
	// there opens nothing); with another letter open it offers small a
	await page.mouse.move(letterPoint.x, letterPoint.y, { steps: 4 });
	await settle(200);
	const tipOpen = await stripTitle();
	assert.equal(tipOpen, null, 'no tooltip over the letter already open');
	await offCanvas();
	await openLetter('glyph-0x62');
	await settle(400);
	await page.mouse.move(letterPoint.x, letterPoint.y, { steps: 4 });
	await settle(200);
	const tip = await stripTitle();
	assert.equal(tip, 'Double-click to work on small a');
	await shot('fix-06-strip-tooltip');
	await offCanvas();
	await openLetter('glyph-0x61');
	await settle(400);
	await page.locator('preview-strip .preview-strip__text').fill(stripText);
	await page.locator('preview-strip .preview-strip__text').press('Escape');
	pass(`the strip says "${tip}" over small a while small b is open, and nothing over it while small a is open`);

	// 7. No neighbor letters in Simple
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedItem.contextCharacters = 'nan';
		Object.assign(editor.project.settings.app.contextCharacters, {
			showCharacters: true,
			showGuides: true,
		});
	});
	await redrawLetter();
	const simpleNeighbors = (await canvasTexts()).filter((text) => /letter n|kern/i.test(text));
	assert.deepEqual(simpleNeighbors, [], 'Simple draws no neighbor letters');
	pass('Simple draws no neighbor letters, names or gap values with them turned on');

	// 8b. The strict scan of the letter page (top bar, letter page, strip): clean
	const letterPage = await strictScan('body');
	numbers.strict.letterPage = letterPage;
	assert.deepEqual(letterPage, [], 'the whole Simple letter screen, strict');
	pass('the strict scan of the whole Simple letter screen finds nothing');

	// 8c. Recorded for the other tracks: About's tabs, the error box (Ctrl+O on a damaged file)
	numbers.strict.about = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.nav.page = 'About';
		editor.navigate();
		const { scanDom, formatHit } = await import('/anyink/words/banned.js');
		const hits = [];
		for (const tab of document.querySelectorAll('.tab-control__tab')) {
			tab.click();
			hits.push(
				...scanDom(document.querySelector('#app__wrapper'), { strict: true }).map(formatHit)
			);
		}
		return [...new Set(hits)];
	});
	await shot('fix-08-about');
	numbers.strict.errorBoxOpen = await page.evaluate(async () => {
		const { openProjectFromHandle } = await import('/anyink/files/project_files.js');
		const handle = {
			kind: 'file',
			name: 'Broken.gs2',
			async queryPermission() {
				return 'granted';
			},
			async requestPermission() {
				return 'granted';
			},
			async getFile() {
				return new File(['{bad'], 'Broken.gs2', { lastModified: 1 });
			},
		};
		await openProjectFromHandle(handle, { load: () => null });
		await new Promise((resolve) => setTimeout(resolve, 100));
		const { scanDom, formatHit } = await import('/anyink/words/banned.js');
		const box = document.querySelector('#error');
		return box ? scanDom(box, { strict: true }).map(formatHit) : ['(no error box)'];
	});
	await shot('fix-08-error-box-open');
	await page.evaluate(() => document.querySelector('#error')?.remove());
	pass(
		`recorded for the other tracks (strict hits): Overview ${numbers.strict.overview.length}, About ${numbers.strict.about.length}, Ctrl+O error box ${numbers.strict.errorBoxOpen.length}`
	);

	// ----------------------------------------------------------
	// 9. All tools
	// ----------------------------------------------------------
	await newFont('');
	await openSmallA();
	await page.locator('button[title="New rectangle"]').click();
	await drag(await at(100, 60), await at(400, 460));
	await settle(3500);
	const allStatus = await status();
	assert.match(allStatus.text, /not saved yet/i);
	assert.equal(allStatus.title, allStatus.text, 'All tools: the tooltip is the text, as before');
	assert.equal(allStatus.status, '', 'All tools: no data-status');
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedItem.contextCharacters = 'nan';
		Object.assign(editor.project.settings.app.contextCharacters, {
			showCharacters: true,
			showGuides: true,
		});
	});
	await redrawLetter();
	const allNeighbors = (await canvasTexts()).filter((text) => /letter n/i.test(text));
	assert.ok(allNeighbors.length > 0, 'All tools still draws the neighbor letters with their names');
	await page.locator('button[title="Resize"]').click();
	const allEdge = await at(0, 300);
	await resetCanvasTexts();
	await page.mouse.move(allEdge.x - 30, allEdge.y, { steps: 3 });
	await page.mouse.move(allEdge.x, allEdge.y, { steps: 4 });
	await settle(300);
	const allSpaces = (await canvasTexts()).filter((text) => /space/i.test(text));
	assert.equal(allSpaces.length, 1, JSON.stringify(allSpaces));
	await shot('fix-09-all-tools');
	pass(
		`All tools: save status "${
			allStatus.text
		}" (tooltip the same), neighbor letters ${JSON.stringify(
			allNeighbors.slice(0, 3)
		)}, one edge label ${JSON.stringify(allSpaces)}`
	);

	assert.deepEqual(errors, [], 'no page errors');
	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, '\t'));
	console.log(`Screenshots and numbers.json in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
