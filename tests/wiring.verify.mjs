// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring real-browser check (docs/UX-BEGINNER.md 6.2, 6.3, 7.6, 4.11, section 10 B5), in the
// real app on a Vite dev server over src/, Chrome with a throwaway profile, 1600 x 900:
//   A. All tools (no ?ui), a new font, small a: the screens show exactly the controls jsdom saw
//      before the wiring (src/anyink/mode/tests/today_controls.json: choosers, tools, view tools,
//      menus, File rows); P Point pen, E Edit points, U Add a point, no toast; Ctrl+Space hides
//      the UI; Ctrl+G makes the SVG font file; Ctrl+O opens the work file picker, no new window;
//      the small-letter line drags
//   B. Simple (?ui=simple), a new font, small a: the page chooser with Simple's four pages (kept
//      until B6's rail: B5 fix track), no panel chooser, no panel; 5 tools, 6 view tools; File and
//      Help menus; File is Save, Save as..., Open a saved font... and the .otf font file; the banned-word scan of the whole letter screen;
//      R says "Switched to Rectangle (R)"; U, Ctrl+Space and Ctrl+G do nothing; the guide lines
//      don't move but the right edge does; Ctrl+O with ink not saved asks first
//   C. The landing rule with real clicks and keys: an example font in Simple, More tools on, a
//      gap nudged on the Kerning page, Back to simple, then Ctrl+Z lands on Kerning with the band
//      "Undo took you to one of the More tools pages." and Back to my letters returns
// Usage: node tests/wiring.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const today = JSON.parse(
	await readFile(new URL('../src/anyink/mode/tests/today_controls.json', import.meta.url), 'utf8')
);
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-wiring'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-wiring-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B5_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
	acceptDownloads: true,
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('dialog', (dialog) => dialog.dismiss());
let downloads = [];
page.on('download', (download) => downloads.push(download.suggestedFilename()));

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const numbers = {};
const settle = (ms = 350) => page.waitForTimeout(ms);
const offCanvas = () => page.mouse.move(5, 895);

const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};

/** The editor's state, read in the page */
const state = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getMode, getVisit } = await import('/anyink/mode/mode.js');
		const font = editor.project.settings.font;
		return {
			mode: getMode(),
			attr: document.documentElement.getAttribute('data-ui-mode'),
			visit: getVisit(),
			page: editor.nav.page,
			tool: editor.selectedTool,
			item: editor.selectedItemID,
			xHeight: font.xHeight,
			advance: editor.selectedItem?.advanceWidth,
			shapes: editor.selectedItem?.shapes?.length,
			band: document.querySelector('#app__top-bar + .anyink-band')?.dataset.anyinkBand || null,
			bands: document.querySelectorAll('.anyink-band').length,
			cursor: document.body.style.cursor,
		};
	});

/** What the page shows, read with Chrome's own visibility (real CSS) */
const controls = () =>
	page.evaluate(() => {
		const shown = (element) => !!element && element.checkVisibility();
		const nav = ['l1', 'l2', 'l3'].filter((level) =>
			shown(document.querySelector(`#nav-button-${level}`))
		);
		const titles = (selector) =>
			[...document.querySelectorAll(selector)].filter(shown).map((el) => el.getAttribute('title'));
		const panel = document.querySelector('#editor-page__panel');
		const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
		return {
			nav,
			tools: titles('.editor-page__tools-area button'),
			viewTools: titles('.editor-page__zoom-area button, .editor-page__zoom-area input'),
			panel: !!panel && shown(panel) && panel.textContent.trim().length > 0,
			numberFields: [...document.querySelectorAll('input[type=number], input-number')].filter(shown)
				.length,
			menus: [...document.querySelectorAll('#app__top-bar .menu-entry-point')]
				.filter(shown)
				.map((b) => b.textContent.trim()),
			l2Width: Math.round(rect('#nav-button-l2')?.width || 0),
			navAreaWidth: Math.round(rect('.editor-page__nav-area')?.width || 0),
		};
	});

/** Opens a nav chooser and reads its rows */
const chooser = async (level) => {
	await page.locator(`#nav-button-${level}`).click();
	const id = level === 'l1' ? '#nav-dropdown-page' : '#nav-dropdown-panel';
	await page.locator(id).waitFor();
	const rows = await page.$$eval(`${id} h3, ${id} .nav-dropdown__button`, (list) =>
		list.map((row) =>
			row.tagName === 'H3'
				? `# ${row.textContent.trim()}`
				: row.dataset.panelId || row.textContent.trim()
		)
	);
	await page.keyboard.press('Escape');
	await page.evaluate(() => document.querySelectorAll('nav').forEach((nav) => nav.remove()));
	return rows;
};

/** Opens a top bar menu and reads its rows the way controls_probe.js does */
const menuRows = async (name) => {
	await page.locator('#app__top-bar .menu-entry-point', { hasText: name }).click();
	await page.locator('#context-menu').waitFor();
	const rows = await page.$$eval('#context-menu > *', (list) =>
		list
			// rows are display: contents (no box of their own), so only display: none hides one
			.filter((row) => getComputedStyle(row).display !== 'none')
			.map((row) => {
				const mark = row.querySelector('[data-anyink-row]');
				if (mark) return mark.dataset.anyinkRow;
				if (row.querySelector('hr') || row.tagName === 'HR') return 'hr';
				if (row.querySelector('h2')) return 'heading';
				return row.textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
			})
	);
	await page.evaluate(() => document.querySelector('#context-menu')?.remove());
	return rows;
};

/** A canvas point for font units on the open letter */
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
const hoverCursor = async (point) => {
	await page.mouse.move(point.x - 15, point.y, { steps: 3 });
	await page.mouse.move(point.x, point.y, { steps: 3 });
	await settle(120);
	const cursor = (await state()).cursor;
	await offCanvas();
	return cursor;
};
const toastText = () =>
	page.evaluate(() => document.querySelector('#toast')?.textContent.replace(/\s+/g, ' ').trim());

const newFont = async (name, search) => {
	await page.evaluate(() => (window.onbeforeunload = null)).catch(() => {});
	await page.goto(`${origin}/${search}`);
	await page.locator('#input__new-project-name').fill(name);
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await settle();
};
/** From the Overview, the small a tile (the Overview is shown in both modes) */
const openSmallA = async () => {
	await page.locator('glyph-tile[displayed-item-id="glyph-0x61"]').click();
	await waitUntil(async () => (await state()).item === 'glyph-0x61', 'small a open');
	await page.locator('.editor-page__zoom-area').waitFor();
	await offCanvas();
	await settle(500);
};
/** Chrome's open picker, standing in: counts its opens, then cancels like the Cancel button */
const stubOpenPicker = () =>
	page.evaluate(() => {
		window.__opens = 0;
		window.showOpenFilePicker = async () => {
			window.__opens++;
			throw new DOMException('The user aborted a request.', 'AbortError');
		};
	});
const tap = async (key) => {
	await page.keyboard.press(key);
	await settle(150);
};

try {
	// ----------------------------------------------------------
	// A. All tools
	// ----------------------------------------------------------
	await newFont('Wiring All', '');
	await openSmallA();
	let s = await state();
	assert.equal(s.mode, 'all');
	assert.equal(s.page, 'Characters');
	let c = await controls();
	assert.deepEqual(c.nav, today.pages.Characters.nav);
	assert.deepEqual(c.tools, today.pages.Characters.tools);
	assert.deepEqual(c.viewTools, today.pages.Characters.viewTools);
	assert.equal(c.panel, true);
	assert.deepEqual(c.menus, today.topMenus);
	assert.deepEqual(await chooser('l1'), today.pages.Characters.pageChooser);
	assert.deepEqual(await chooser('l3'), today.pages.Characters.panelChooser);
	assert.deepEqual(await menuRows('File'), today.fileMenu.fileSystem);
	assert.deepEqual(await menuRows('Help'), today.helpMenu);
	assert.equal(s.band, null);
	numbers.allTools = { ...c, band: s.band };
	pass(
		`All tools: the real screens match the jsdom snapshot taken before the wiring: nav ${c.nav.join(
			', '
		)}; ${c.tools.length} tools; ${c.viewTools.length} view controls; panel; menus ${c.menus.join(
			', '
		)}; 13 page chooser rows, 9 panels, ${today.fileMenu.fileSystem.length} File rows; no band`
	);
	await shot('A1-all-tools-letter');

	const picks = {};
	for (const key of ['p', 'e', 'u', 'b', 'v']) {
		await tap(key);
		picks[key] = (await state()).tool;
	}
	assert.deepEqual(picks, {
		p: 'newPath',
		e: 'pathEdit',
		u: 'pathAddPoint',
		b: 'pathEdit',
		v: 'resize',
	});
	assert.notEqual(await toastText(), 'Switched to Rectangle (R)');
	await page.keyboard.down('Control');
	await page.keyboard.down('Space');
	await settle(200);
	const hidden = await page.locator('#hideUI').count();
	await shot('A2-all-tools-ctrl-space');
	await page.keyboard.up('Space');
	await page.keyboard.up('Control');
	await settle(200);
	assert.equal(hidden, 1);
	assert.equal(await page.locator('#hideUI').count(), 0);
	downloads = [];
	await tap('Control+g');
	await waitUntil(async () => downloads.length > 0, 'the SVG font file download', 10000);
	assert.match(downloads[0], /\.svg$/);
	await stubOpenPicker();
	const pagesBefore = context.pages().length;
	await tap('Control+o');
	await waitUntil(() => page.evaluate(() => window.__opens === 1), 'the open picker', 5000);
	assert.equal(context.pages().length, pagesBefore);
	pass(
		`All tools keys: P Point pen, E Edit points, U Add a point, B Edit points, V Select, no toast; Ctrl+Space hides the UI; Ctrl+G downloads ${downloads[0]}; Ctrl+O opens the work file picker, no new window`
	);

	const xBefore = (await state()).xHeight;
	await drag(await at(-150, xBefore), await at(-150, xBefore + 60));
	const xAfter = (await state()).xHeight;
	assert.ok(xAfter > xBefore, `All tools moves the small-letter line (${xBefore} -> ${xAfter})`);
	await tap('Control+z');
	assert.equal((await state()).xHeight, xBefore);
	numbers.allToolsLineDrag = { before: xBefore, dragged: xAfter };
	pass(`All tools: the small-letter line drags (${xBefore} -> ${xAfter}), Ctrl+Z puts it back`);

	// ----------------------------------------------------------
	// B. Simple
	// ----------------------------------------------------------
	await newFont('Wiring Simple', '?ui=simple');
	s = await state();
	assert.equal(s.attr, 'simple');
	// B5 fix track: Simple keeps the page chooser until B6's rail (Help and About were dead ends)
	assert.deepEqual((await controls()).nav, ['l1'], 'the Overview has the page chooser in Simple');
	await openSmallA();
	s = await state();
	assert.equal(s.mode, 'simple');
	c = await controls();
	assert.deepEqual(c.nav, ['l1', 'l2']);
	assert.equal(c.panel, false);
	assert.equal(c.numberFields, 0);
	// B4 + B5 integration: Simple's tooltips say the house words (mode/simple_labels.js)
	assert.deepEqual(c.tools, [
		'Rectangle (R)',
		'Oval (O)',
		'Point pen (P)',
		'Edit points (E)',
		'Select (V)',
	]);
	assert.deepEqual(c.viewTools, [
		'Zoom out',
		'Zoom level',
		'Zoom in',
		'Outline only',
		'Dark paper',
		'Fit letter',
	]);
	assert.deepEqual(c.menus, ['File', 'Help']);
	// B4 + B5 finalize: "Choose where font files go" stays in Simple until Use in Word (B14)
	assert.deepEqual(await menuRows('File'), [
		'heading',
		'save',
		'save-as',
		'open-font',
		'hr',
		'heading',
		'font-otf',
		'font-folder',
	]);
	assert.deepEqual(await menuRows('Help'), today.helpMenu);
	assert.equal(s.band, null);
	const scan = await page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('#app__wrapper');
		const hits = [...scanDom(root), ...findUppercase(root)];
		const area = (hit) =>
			hit.element?.closest?.(
				'.editor-page__tools-area, .editor-page__zoom-area, .editor-page__nav-area, #app__top-bar, #editor-page__panel'
			)?.className ||
			hit.element?.closest?.('[id]')?.id ||
			'other';
		const byArea = {};
		hits.forEach((hit) => (byArea[area(hit)] = (byArea[area(hit)] || 0) + 1));
		return { count: hits.length, byArea, sample: hits.slice(0, 12).map(formatHit) };
	});
	numbers.simple = { ...c, scan };
	pass(
		`Simple letter page: the page chooser and the letter button, no panel chooser, no panel (0 number fields); ${c.tools.length} tools; ${c.viewTools.length} view controls; menus File, Help; File: Save, Save as..., Open a saved font..., the .otf font file`
	);
	// B4 + B5 integration: the scan is asserted now (it was INFO while B4's work list was open)
	assert.equal(scan.count, 0, `banned-word scan hits: ${JSON.stringify(scan.sample)}`);
	pass(
		'Simple letter screen: the banned-word scan (visible text, tooltips, sentence case) finds 0 hits (B4 counted 57 before the wiring)'
	);
	await shot('B1-simple-letter');

	await tap('r');
	assert.equal((await state()).tool, 'newRectangle');
	assert.equal(await toastText(), 'Switched to Rectangle (R)');
	await shot('B2-simple-tool-toast');
	await tap('u');
	assert.equal((await state()).tool, 'newRectangle');
	await page.keyboard.down('Control');
	await page.keyboard.down('Space');
	await settle(200);
	const hiddenSimple = await page.locator('#hideUI').count();
	await page.keyboard.up('Space');
	await page.keyboard.up('Control');
	assert.equal(hiddenSimple, 0);
	downloads = [];
	await tap('Control+g');
	await settle(800);
	assert.deepEqual(downloads, []);
	pass(
		'Simple keys: R picks the Rectangle and says "Switched to Rectangle (R)"; U, Ctrl+Space and Ctrl+G do nothing'
	);

	// a square to have edges, drawn with the Rectangle tool
	await drag(await at(100, 0), await at(400, 400));
	s = await state();
	assert.equal(s.shapes, 1);
	await tap('v');
	const xLine = s.xHeight;
	const lineCursor = await hoverCursor(await at(-150, xLine));
	await drag(await at(-150, xLine), await at(-150, xLine + 60));
	assert.equal((await state()).xHeight, xLine, 'the small-letter line stays put in Simple');
	assert.notEqual(lineCursor, 'ns-resize');
	const advance = (await state()).advance;
	const edgeCursor = await hoverCursor(await at(advance, 200));
	assert.equal(edgeCursor, 'ew-resize');
	const edgeFrom = await at(advance, 200);
	await drag(edgeFrom, { x: edgeFrom.x + 30, y: edgeFrom.y });
	const advanceAfter = (await state()).advance;
	assert.ok(advanceAfter > advance, `the right edge drags (${advance} -> ${advanceAfter})`);
	numbers.simpleLines = { xHeight: xLine, lineCursor, edgeCursor, advance, advanceAfter };
	pass(
		`Simple guide lines: the small-letter line shows no drag cursor and doesn't move; the right edge does (cursor ${edgeCursor}, width ${advance} -> ${advanceAfter})`
	);

	await stubOpenPicker();
	await tap('Control+o');
	const box = page.locator('#modal-dialog .anyink-open-box');
	await box.waitFor();
	const boxWords = await box.evaluate(async (node) => {
		const { scanDom } = await import('/anyink/words/banned.js');
		return {
			text: node.querySelector('p').textContent,
			buttons: [...node.querySelectorAll('fancy-button')].map((b) => b.textContent.trim()),
			hits: scanDom(node).length,
		};
	});
	assert.deepEqual(boxWords, {
		text: "Your work has changes that aren't saved.",
		buttons: ['Save', 'Cancel'],
		hits: 0,
	});
	assert.equal(await page.evaluate(() => window.__opens), 0);
	await shot('B3-simple-ctrl-o-unsaved');
	await page.locator('#modal-dialog fancy-button[data-anyink-choice="cancel"]').click();
	await settle(300);
	assert.equal(await page.locator('#modal-dialog').count(), 0);
	assert.equal(await page.evaluate(() => window.__opens), 0);
	pass(
		'Simple Ctrl+O with ink not in a work file: "Your work has changes that aren\'t saved." [Save] [Cancel]; Cancel opens nothing'
	);

	// ----------------------------------------------------------
	// C. The landing rule, real clicks and keys
	// ----------------------------------------------------------
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/?ui=simple`);
	await page.locator('#open-project__tab-examples').click();
	await page.locator('#tab-content__examples fancy-button').nth(1).click(); // the simple example (its words differ per mode)
	await page.locator('glyph-tile').first().waitFor();
	await settle();
	// B6's More tools button stands in: the call it will make
	await page.evaluate(async () => (await import('/anyink/mode/band.js')).turnOnMoreTools());
	await settle();
	s = await state();
	assert.equal(s.mode, 'all');
	assert.equal(s.band, 'moreTools');
	await page.locator('#nav-button-l1').click();
	await page.locator('#nav-dropdown-page .nav-dropdown__button', { hasText: 'Kerning' }).click();
	await page.locator('.editor-page__zoom-area').waitFor();
	await settle(500);
	const gap = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			return editor.selectedKernGroup?.value;
		});
	const gapBefore = await gap();
	await offCanvas();
	await tap('ArrowUp');
	const gapChanged = await gap();
	assert.equal(gapChanged, gapBefore + 1);
	await shot('C1-more-tools-kerning');
	await page.locator('.anyink-band button').click();
	await settle(500);
	s = await state();
	assert.deepEqual([s.mode, s.page, s.band], ['simple', 'Characters', null]);
	await offCanvas();
	await tap('Control+z');
	await settle(500);
	s = await state();
	assert.equal(s.page, 'Kerning');
	assert.equal(s.mode, 'all');
	assert.deepEqual(s.visit, { page: 'Kerning', cause: 'undo' });
	assert.equal(s.band, 'landed');
	assert.equal(s.bands, 1);
	assert.equal(await gap(), gapBefore);
	const landed = await page.locator('.anyink-band').evaluate((node) => ({
		text: node.querySelector('.anyink-band__text').textContent,
		button: node.querySelector('button').textContent,
	}));
	assert.deepEqual(landed, {
		text: 'Undo took you to one of the More tools pages.',
		button: 'Back to my letters',
	});
	c = await controls();
	assert.deepEqual(c.nav, ['l1', 'l2', 'l3'], 'the Kerning page draws with More tools controls');
	await shot('C2-landed-on-kerning');
	await page.locator('.anyink-band button').click();
	await settle(500);
	s = await state();
	assert.deepEqual([s.mode, s.page, s.band, s.visit], ['simple', 'Characters', null, null]);
	assert.deepEqual((await controls()).nav, ['l1', 'l2']);
	numbers.landing = { gapBefore, gapChanged, landed };
	pass(
		`landing with real clicks: More tools, Kerning, ArrowUp moved the gap ${gapBefore} -> ${gapChanged}; Back to simple; Ctrl+Z lands on Kerning (More tools controls, band "${landed.text}" [${landed.button}], gap back to ${gapBefore}); Back to my letters: Simple on the letter page`
	);
	await shot('C3-back-to-my-letters');

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass('no page errors');
	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, 2));
	console.log(`Screenshots and numbers.json in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
