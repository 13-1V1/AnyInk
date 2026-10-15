// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 core real-browser check (docs/UX-BEGINNER.md 2.1 to 2.4, section 10 B4), in Chrome with a
// throwaway profile:
//   1. tests/words.html lists every words.js key (the count comes from the same module loaded
//      through Vite in Node), with text, hint, pro word and feature; none says a banned word;
//      Help's glossary shows the landed words in 2.1's order; every Undo title has a row
//   2. the dev app with ?ui=simple: the scanner (banned.js) run in the real page, with real CSS,
//      finds no banned word in the File menu, the preview strip and the edit canvas (a canvas
//      spy, the left edge pointed at: its one label is the readout "left space N", B4 + B5 fix
//      pass), as the jsdom scan
//      says now the display-points track has landed, so jsdom and Chrome agree;
//      then the whole Simple screen is scanned and must have 0 hits (B4 + B5 integration: B4
//      counted 57, B5 hid most, the Simple labels named the rest)
// Usage: node tests/words.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { toOverview } from './verify_standins.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-words'));
await mkdir(shots, { recursive: true });

const serve = async (root) => {
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'error',
		server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
	});
	await server.listen();
	return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}` };
};
const pages = await serve(repo);
const app = await serve(src);
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-words-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B4_BROWSER || 'chrome',
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
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`), fullPage: false });
const numbers = {};

try {
	// ----------------------------------------------------------
	// 1. tests/words.html
	// ----------------------------------------------------------
	const words = await pages.server.ssrLoadModule('/src/anyink/words/words.js');
	const { HISTORY_SAMPLES } = await pages.server.ssrLoadModule(
		'/src/anyink/words/tests/history_samples.js'
	);
	const keyCount = words.wordKeys().length;
	const glossaryNow = words.glossary().map((entry) => words.labelCase(entry.text));

	await page.goto(`${pages.origin}/tests/words.html`);
	await page.locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
	const listed = await page.evaluate(async () => {
		const { findBanned } = await import('/src/anyink/words/banned.js');
		const rows = [...document.querySelectorAll('#keys tbody tr')];
		// A quote entry's text (.anyink-quote, a file type like ".otf") is the one exemption (2.3)
		const wordsCells = rows.flatMap((row) =>
			[...row.querySelectorAll('td.words:not(.anyink-quote)')].map((td) => td.textContent)
		);
		return {
			rows: rows.length,
			summaryKeys: Number(document.querySelector('#summary').dataset.keys),
			summaryBanned: Number(document.querySelector('#summary').dataset.banned),
			amberRows: rows.filter((row) => row.classList.contains('banned')).length,
			bannedInCells: wordsCells.flatMap((text) =>
				findBanned(text, { strict: true }).map((h) => `${h.match} in "${text}"`)
			),
			proWords: rows.filter((row) => row.querySelector('.anyink-pro-word')).length,
			glossary: [...document.querySelectorAll('#glossary dt')].map((dt) => dt.textContent),
			titles: document.querySelectorAll('#titles tbody tr').length,
			hiddenTitles: document.querySelectorAll('#titles tbody tr[data-hidden="true"]').length,
			baseline: (() => {
				const row = rows.find((r) => r.dataset.key === 'line.baseline');
				return [...row.cells].map((cell) => cell.textContent);
			})(),
		};
	});
	assert.equal(listed.rows, keyCount, 'one row per key');
	assert.equal(listed.summaryKeys, keyCount);
	assert.equal(listed.summaryBanned, 0, 'no key says a banned word');
	assert.equal(listed.amberRows, 0);
	assert.deepEqual(listed.bannedInCells, []);
	assert.deepEqual(
		listed.glossary,
		glossaryNow,
		"Help's glossary: the landed words in 2.1's order"
	);
	assert.equal(listed.titles, HISTORY_SAMPLES.length);
	assert.equal(listed.hiddenTitles, HISTORY_SAMPLES.filter((s) => s.text === '').length);
	assert.deepEqual(listed.baseline, [
		'line.baseline',
		'writing line',
		'The line letters sit on.',
		'baseline',
		'live',
		'The ruled line on notebook paper',
		'core.js',
	]);
	await shot('b4-01-words-page');
	await page.locator('#glossary').scrollIntoViewIfNeeded();
	await shot('b4-02-words-glossary');
	await page.locator('#titles').scrollIntoViewIfNeeded();
	await shot('b4-03-words-undo-titles');
	await page.locator('#filter').fill('line.');
	const filtered = await page.evaluate(
		() => [...document.querySelectorAll('#keys tbody tr')].filter((row) => !row.hidden).length
	);
	assert.ok(filtered >= 6 && filtered < keyCount, `the filter narrows the list (${filtered})`);
	numbers.wordsPage = {
		keys: keyCount,
		glossaryShownNow: glossaryNow.length,
		undoTitles: listed.titles,
	};
	pass(
		`words.html lists all ${keyCount} keys with text, hint, pro word and feature; none says a banned ` +
			`word; Help's glossary shows ${glossaryNow.length} words; ${listed.titles} Undo titles in plain words`
	);

	// ----------------------------------------------------------
	// 2. The dev app in Simple
	// ----------------------------------------------------------
	await page.goto(`${app.origin}/?ui=simple`);
	// The canvas spy goes in before the editor makes its canvas
	await page.evaluate(() => {
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
	await page.locator('#input__new-project-name').fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	assert.equal(
		await page.evaluate(async () => (await import('/anyink/mode/mode.js')).getMode()),
		'simple'
	);
	// B5: Simple has no page chooser (verify_standins.mjs)
	await toOverview(page);
	await page.locator('glyph-tile[displayed-item-id="glyph-0x61"]').click();
	await page.waitForTimeout(600);
	// B4 + B5 fix pass: the edges of a letter with no shapes are locked in Simple (the fix track's
	// guides_layer.js), so small a gets a shape first: a rectangle, drawn with the mouse
	const unit = (ux, uy) =>
		page.evaluate(
			async ([x, y]) => {
				const view = (await import('/app/main.js')).getCurrentProjectEditor().view;
				const host = document.querySelector('edit-canvas');
				const box = (host.shadowRoot || host).querySelector('canvas').getBoundingClientRect();
				return { x: box.left + view.dx + x * view.dz, y: box.top + view.dy - y * view.dz };
			},
			[ux, uy]
		);
	await page.keyboard.press('r');
	const corner = await unit(100, 60);
	const far = await unit(400, 460);
	await page.mouse.move(corner.x, corner.y, { steps: 3 });
	await page.mouse.down();
	await page.mouse.move(far.x, far.y, { steps: 6 });
	await page.mouse.up();
	await page.keyboard.press('v');
	await page.mouse.move(5, 895);
	await page.waitForTimeout(300);

	// Point at the left edge, so its drag readout is drawn (B5: Simple locks the horizontal guide
	// lines, 7.6, so the small-letter line shows no readout there; the edges still drag)
	const linePoint = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const host = document.querySelector('edit-canvas');
		const canvas = (host.shadowRoot || host).querySelector('canvas');
		const rect = canvas.getBoundingClientRect();
		const view = editor.view;
		return {
			x: rect.left + view.dx,
			y: rect.top + view.dy - (editor.project.settings.font.xHeight / 2) * view.dz,
		};
	});
	await page.mouse.move(linePoint.x, linePoint.y - 20);
	await page.mouse.move(linePoint.x, linePoint.y, { steps: 4 });
	await page.waitForTimeout(300);
	await shot('b4-04-simple-letter-line-readout');

	const scanned = await page.evaluate(async () => {
		const { scanDom, findUppercase, scanTexts, formatHit } = await import(
			'/anyink/words/banned.js'
		);
		const strip = document.querySelector('preview-strip');
		const all = [...scanDom(document), ...findUppercase(document)];
		const area = (hit) => {
			const path = hit.path || '';
			if (/top-bar/.test(path)) return 'top bar';
			if (/preview-strip/.test(path)) return 'preview strip';
			if (/nav|page-chooser|editor-page__nav/.test(path)) return 'page and panel choosers';
			if (/panel/.test(path)) return 'panels';
			if (/edit-canvas|canvas-tools|zoom|tools/.test(path)) return 'canvas tools';
			return 'other';
		};
		const byArea = {};
		all.forEach((hit) => {
			const key = area(hit);
			byArea[key] = byArea[key] || { count: 0, words: {} };
			byArea[key].count++;
			byArea[key].words[hit.term] = (byArea[key].words[hit.term] || 0) + 1;
		});
		return {
			strip: [...scanDom(strip), ...findUppercase(strip)].map(
				(h) => `${h.where}:${h.term}:${h.match}`
			),
			canvas: scanTexts(window.__canvasTexts, 'canvas').map((h) => h.text),
			drawn: [...new Set(window.__canvasTexts)],
			wholeScreen: { hits: all.length, byArea, sample: all.slice(0, 40).map(formatHit) },
		};
	});
	// B4 display-points track: the strip and the canvas say no banned word, as in jsdom
	assert.deepEqual(scanned.strip, [], 'the strip says no banned word and nothing in capitals');
	assert.deepEqual(scanned.canvas, [], 'nothing on the canvas says a banned word');
	assert.ok(
		// B4 + B5 fix pass: one label on a pointed-at edge, the readout ("left space 0", D-035)
		scanned.drawn.some((text) => /^(left|right) space -?[\d.]+$/.test(text)) &&
			!scanned.drawn.some((text) => /^(Left|Right) space/.test(text)),
		`the left edge's readout is on the real canvas (${JSON.stringify(scanned.drawn)})`
	);
	pass(
		`real Chrome, Simple: the strip scan matches jsdom (no hits); the canvas spy reads the ` +
			`readout ${JSON.stringify(scanned.drawn.filter((t) => /space/.test(t)))} and no banned word`
	);

	await page.locator('.menu-entry-point', { hasText: 'File' }).click();
	await page.waitForTimeout(300);
	await shot('b4-05-simple-file-menu');
	const menuHits = await page.evaluate(async () => {
		const { scanDom } = await import('/anyink/words/banned.js');
		return scanDom(document.querySelector('#context-menu')).map((h) => `${h.term}:${h.text}`);
	});
	assert.deepEqual(menuHits, [], 'the File menu says no banned word (file types are quotes)');
	pass(`real Chrome, Simple: the File menu scan matches jsdom (${menuHits.length} hits)`);
	await page.keyboard.press('Escape');

	numbers.simpleScreen = {
		...scanned.wholeScreen,
		fileMenu: menuHits,
		strip: scanned.strip,
		canvas: [...new Set(scanned.canvas)],
	};
	// B4 + B5 integration: the whole-screen scan is asserted now (it was the work list while B5 and
	// the Simple labels were open; B4 counted 57 hits here)
	assert.equal(
		scanned.wholeScreen.hits,
		0,
		`the whole Simple letter screen says no banned word: ${JSON.stringify(
			scanned.wholeScreen.sample
		)}`
	);
	pass(
		'real Chrome, Simple: the whole letter screen (top bar, letter page, strip) has 0 banned-word or capitals hits'
	);

	assert.deepEqual(errors, [], 'no page errors');
	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, '\t'));
	console.log(`Screenshots and numbers.json in ${shots}`);
} finally {
	await context.close();
	await pages.server.close();
	await app.server.close();
	await rm(profile, { recursive: true, force: true });
}
