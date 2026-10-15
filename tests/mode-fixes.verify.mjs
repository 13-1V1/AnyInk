// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track (mode) real-browser check, in the real app on a Vite dev server over src/,
// Chrome with a throwaway profile, 1600 x 900, Simple (?ui=simple) unless it says otherwise:
//   1. the page chooser stays until B6's rail: on the Overview, a letter, Help and About, with
//      "All letters", "One letter", "Help", "About ANY-INK"; About -> All letters is the Overview
//   2. an empty small e: its left edge is not grabbed and its width stays 0 after a 45 px drag;
//      Delete x3 and Backspace add no Undo step; Ctrl+R adds none and is left to the browser
//      (not default-prevented); B picks nothing; H says "Switched to Point pen (P)"
//   3. a photo on an empty small b (added in More tools: Simple takes none before B9): its
//      bottom-left corner, on the left edge, resizes the photo and the width stays 0
//   4. a rectangle on small a: its tile says "Changed since you opened the font.", an empty
//      letter's "Not made yet. Click to start it."
//   5. File: Open a saved font... (Ctrl+O) is there, every row's key chips sit on one line, and a
//      font imported from a .woff still names and makes the .otf with Ctrl+E
//   6. All tools: the left edge of an empty letter never takes its width below 0
//   7. the landing band with real keys: Ctrl+Z says Undo took him there, Ctrl+Y says Redo did
//   8. the Open Project page follows a mode switch (its Load tab's words)
// B6 + B7 finalize: its Simple parts check B5's Simple, so every feature flag is turned off in
// the page (verify_standins.mjs pinB5Simple); B6 and B7's Simple: b67.verify.mjs, b67-fixes.verify.mjs.
// Usage: node tests/mode-fixes.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pinB5Simple } from './verify_standins.mjs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-mode-fixes'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-mode-fixes-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B5_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
	acceptDownloads: true,
});
// Every page: a recorder for Ctrl+R (was it left to the browser?), and no reload happens here
await context.addInitScript(() => {
	window.__ctrlR = [];
	window.addEventListener('keydown', (event) => {
		if (event.ctrlKey && event.key.toLowerCase() === 'r') {
			window.__ctrlR.push(event.defaultPrevented);
			event.preventDefault();
		}
	});
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('dialog', (dialog) => dialog.dismiss());

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const numbers = {};
const settle = (ms = 350) => page.waitForTimeout(ms);
const offCanvas = () => page.mouse.move(5, 895);
const tap = async (key) => {
	await page.keyboard.press(key);
	await settle(150);
};
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};

const state = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getMode, getVisit } = await import('/anyink/mode/mode.js');
		const { guidesLayerState } = await import('/anyink/metrics/state.js');
		const trace = editor.selectedItem?.anyink?.trace;
		return {
			mode: getMode(),
			visit: getVisit(),
			page: editor.nav.page,
			tool: editor.selectedTool,
			item: editor.selectedItemID,
			advance: editor.selectedItem?.advanceWidth,
			shapes: editor.selectedItem?.shapes?.length,
			steps: editor.history.queue.length,
			titles: editor.history.queue.slice(0, 3).map((entry) => entry.title),
			hover: guidesLayerState.hover,
			trace: trace ? { x: trace.x, y: trace.y, scale: trace.scale } : null,
			band: document.querySelector('.anyink-band .anyink-band__text')?.textContent || null,
		};
	});
const shown = (selector) => page.locator(selector).first().isVisible();
const text = (selector) =>
	page.locator(selector).first().evaluate((node) => node.textContent.replace(/\s+/g, ' ').trim());
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
const toastNow = () =>
	page.evaluate(() => {
		const toast = [...document.querySelectorAll('#toast:not([data-leaving])')].at(-1);
		return toast ? toast.textContent.replace(/\s+/g, ' ').trim() : null;
	});
const chooserRows = async () => {
	await page.locator('#nav-button-l1').click();
	await page.locator('#nav-dropdown-page').waitFor();
	return page.$$eval('#nav-dropdown-page h3, #nav-dropdown-page .nav-dropdown__button', (list) =>
		list.map((row) => (row.tagName === 'H3' ? `# ${row.textContent.trim()}` : row.textContent.trim()))
	);
};
const closeNav = () => page.evaluate(() => document.querySelectorAll('nav').forEach((nav) => nav.remove()));
const openLetter = async (id) => {
	await page.evaluate(async (glyph) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = glyph;
		editor.nav.page = 'Characters';
		editor.navigate();
	}, id);
	await page.locator('.editor-page__zoom-area').waitFor();
	await offCanvas();
	await settle(500);
};
const newFont = async (name, search) => {
	await page.evaluate(() => (window.onbeforeunload = null)).catch(() => {});
	await page.goto(`${origin}/${search}`);
	if (String(search).includes('ui=simple')) await pinB5Simple(page);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill(name);
	await page.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle();
};
const SIMPLE_PAGES = ['All letters', 'One letter', 'Help', 'About ANY-INK'];

try {
	// ----------------------------------------------------------
	// 1. The page chooser in Simple
	// ----------------------------------------------------------
	await newFont('Fix Check', '?ui=simple');
	let s = await state();
	assert.equal(s.mode, 'simple');
	assert.equal(s.page, 'Overview');
	assert.ok(await shown('#nav-button-l1'), 'the page button on the Overview');
	assert.equal(await text('#nav-button-l1'), 'Page All letters');
	assert.deepEqual(await chooserRows(), SIMPLE_PAGES);
	await settle(700);
	// every row is on top where it is drawn (nothing on the page covers the open chooser)
	const covered = await page.evaluate(() =>
		[...document.querySelectorAll('#nav-dropdown-page .nav-dropdown__button')]
			.filter((row) => {
				const box = row.getBoundingClientRect();
				const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
				return !row.contains(top);
			})
			.map((row) => row.textContent.trim())
	);
	await shot('1a-overview-page-chooser');
	assert.deepEqual(covered, [], 'chooser rows covered by the page');
	await closeNav();
	await page.locator('#app__top-bar .menu-entry-point', { hasText: 'Help' }).click();
	await page.locator('#context-menu .context-menu-row', { hasText: 'About ANY-INK' }).click();
	await settle(500);
	assert.equal((await state()).page, 'About');
	assert.equal(await text('#nav-button-l1'), 'Page About ANY-INK');
	await shot('1b-about-with-page-chooser');
	await page.locator('#nav-button-l1').click();
	await page.locator('#nav-dropdown-page .nav-dropdown__button[data-anyink-page="Overview"]').click();
	await settle(500);
	s = await state();
	assert.deepEqual([s.page, s.mode, s.steps], ['Overview', 'simple', 0]);
	pass(`Simple keeps the page chooser: ${JSON.stringify(SIMPLE_PAGES)}; Help menu > About, then the chooser's "All letters" is the Overview again (no Undo step)`);

	// ----------------------------------------------------------
	// 2. An empty small e
	// ----------------------------------------------------------
	await openLetter('glyph-0x65');
	s = await state();
	assert.deepEqual([s.item, s.shapes, s.advance], ['glyph-0x65', 0, 0]);
	const steps0 = s.steps;
	const edge = await at(0, 300);
	await page.mouse.move(edge.x - 10, edge.y);
	await page.mouse.move(edge.x, edge.y, { steps: 2 });
	await settle(200);
	assert.equal((await state()).hover, false, 'the empty letter\'s left edge is not hovered');
	await drag(edge, { x: edge.x + 45, y: edge.y });
	s = await state();
	assert.equal(s.advance, 0);
	assert.equal(s.steps, steps0);
	await shot('2a-empty-e-after-left-edge-drag');
	numbers.emptyE = { advance: s.advance, steps: s.steps };
	pass('empty small e: the left edge is not grabbed; after a 45 px drag its width is still 0 and no Undo step was added');

	await page.locator('#editor-page__edit-canvas canvas').hover();
	for (const key of ['Delete', 'Delete', 'Delete', 'Backspace']) await tap(key);
	s = await state();
	assert.equal(s.steps, steps0, `Delete / Backspace added steps: ${JSON.stringify(s.titles)}`);
	await tap('Control+r');
	s = await state();
	assert.equal(s.steps, steps0, `Ctrl+R added a step: ${JSON.stringify(s.titles)}`);
	assert.deepEqual(await page.evaluate(() => window.__ctrlR), [false]);
	pass('nothing picked: Delete x3 and Backspace add no Undo step; Ctrl+R adds none and is left to the browser (not default-prevented: Chrome reloads)');

	await page.evaluate(() => (window.__toastTexts = []));
	await tap('v');
	await tap('b');
	assert.equal((await state()).tool, 'resize', 'B picks nothing in Simple');
	await tap('h');
	assert.equal((await state()).tool, 'newPath');
	assert.equal(await toastNow(), 'Switched to Point pen (P)');
	const tooltip = await page.locator('button[data-anyink-tool="newPath"]').getAttribute('title');
	assert.equal(tooltip, 'Point pen (P)');
	await shot('2b-h-key-toast');
	await tap('Escape');
	await tap('v');
	pass(`B picks nothing until the Brush; H says "Switched to Point pen (P)", the tooltip's "${tooltip}"`);

	// ----------------------------------------------------------
	// 3. A photo on an empty small b: its corner wins over the edge
	// ----------------------------------------------------------
	await openLetter('glyph-0x62');
	// Simple takes no photo before B9's photo card, so it comes in from More tools, as a photo
	// added there would; then Back to simple
	await page.evaluate(async () => (await import('/anyink/mode/band.js')).turnOnMoreTools());
	await settle(400);
	await page.evaluate(async () => {
		const canvas = new OffscreenCanvas(300, 400);
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, 300, 400);
		ctx.fillStyle = 'black';
		ctx.fillRect(100, 60, 60, 300);
		const blob = await canvas.convertToBlob({ type: 'image/png' });
		const { importTraceImage } = await import('/anyink/trace/trace_import.js');
		await importTraceImage(new File([blob], 'b-photo.png', { type: 'image/png' }));
	});
	await waitUntil(async () => !!(await state()).trace, 'the photo is in');
	// B4 + B5 finalize: Simple draws and grabs no photo until B9's photo card, so its flag
	// stands in here (the corner-wins-over-the-edge rule is for when photos exist in Simple)
	await page.evaluate(async () =>
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ photo: true })
	);
	await page.evaluate(async () => (await import('/anyink/mode/band.js')).backToSimple());
	await settle(400);
	assert.equal((await state()).mode, 'simple');
	await page.evaluate(async () => (await import('/edit_canvas/tools/tools.js')).selectTool('resize'));
	await settle(400);
	s = await state();
	const traceBefore = s.trace;
	const box = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getTrace } = await import('/anyink/trace/trace_model.js');
		const trace = getTrace(editor.selectedItem);
		return { x: trace.x, bottom: trace.y - trace.height * trace.scale, panel: editor.nav.panel };
	});
	assert.equal(Math.round(box.x), 0, 'the photo\'s left side sits on the left edge');
	const corner = await at(box.x, box.bottom);
	await shot('3a-photo-on-empty-b');
	await drag(corner, { x: corner.x + 44, y: corner.y - 60 });
	s = await state();
	assert.equal(s.advance, 0, 'the width stays 0');
	assert.notDeepEqual(s.trace, traceBefore, 'the photo was resized');
	assert.ok(s.trace.scale < traceBefore.scale, `the photo got smaller (${traceBefore.scale} -> ${s.trace.scale})`);
	await shot('3b-photo-corner-dragged');
	numbers.photo = { before: traceBefore, after: s.trace, panel: box.panel };
	pass(`photo on an empty small b: its bottom-left corner (on the left edge) resizes the photo (scale ${traceBefore.scale.toFixed(3)} -> ${s.trace.scale.toFixed(3)}); the width stays 0`);

	// ----------------------------------------------------------
	// 4. Letter tiles say what they show
	// ----------------------------------------------------------
	await openLetter('glyph-0x61');
	await page.locator('button[data-anyink-tool="newRectangle"]').click();
	await drag(await at(100, 60), await at(400, 460));
	assert.equal((await state()).shapes, 1);
	const sessionState = await page.evaluate(async () =>
		(await import('/app/main.js')).getCurrentProjectEditor().selectedItem.sessionState
	);
	await page.locator('#nav-button-l2').click();
	await page.locator('#nav-dropdown-chooser').waitFor();
	await settle(400);
	const tiles = await page.evaluate(() =>
		Object.fromEntries(
			['glyph-0x61', 'glyph-0x62', 'glyph-0x63'].map((id) => [
				id,
				document.querySelector(`#nav-dropdown-chooser glyph-tile[displayed-item-id="${id}"]`)?.getAttribute('title'),
			])
		)
	);
	await shot('4-letter-chooser-tiles');
	await closeNav();
	assert.equal(tiles['glyph-0x61'], 'small a\n\nChanged since you opened the font.');
	assert.equal(tiles['glyph-0x63'], 'small c\n\nNot made yet. Click to start it.');
	assert.equal(tiles['glyph-0x62'], 'small b\n\nNot made yet. Click to start it.');
	numbers.tiles = { sessionState, tiles };
	pass(`tiles: small a with a rectangle (upstream session state "${sessionState}") says "Changed since you opened the font."; empty b (with a record and a photo) and c (none) both say "Not made yet. Click to start it."`);

	// ----------------------------------------------------------
	// 5. The File menu
	// ----------------------------------------------------------
	const fileMenu = async () => {
		await page.locator('#app__top-bar .menu-entry-point', { hasText: 'File' }).click();
		await page.locator('#context-menu').waitFor();
		await settle(250);
		return page.evaluate(() =>
			[...document.querySelectorAll('#context-menu > *')].map((row) => {
				const chips = [...row.querySelectorAll('.row-notes code')].map((chip) => ({
					text: chip.textContent,
					top: Math.round(chip.getBoundingClientRect().top),
				}));
				const name = row.querySelector('.row-name');
				return {
					id: row.querySelector('[data-anyink-row]')?.dataset.anyinkRow || (row.querySelector('h2') ? 'heading' : 'hr'),
					text: (row.querySelector('h2') || name)?.textContent.replace(/\s+/g, ' ').trim() || '',
					nameTop: name ? Math.round(name.getBoundingClientRect().top) : null,
					chips,
				};
			})
		);
	};
	let rows = await fileMenu();
	await shot('5a-file-menu');
	await page.evaluate(() => document.querySelector('#context-menu')?.remove());
	// B4 + B5 finalize: "Choose where font files go" stays in Simple until Use in Word (B14)
	assert.deepEqual(rows.map((row) => row.id), ['heading', 'save', 'save-as', 'open-font', 'hr', 'heading', 'font-otf', 'font-folder']);
	const open = rows.find((row) => row.id === 'open-font');
	assert.equal(open.text, 'Open a saved font...');
	assert.deepEqual(open.chips.map((chip) => chip.text), ['Ctrl', 'o']);
	rows.filter((row) => row.chips.length).forEach((row) =>
		row.chips.forEach((chip) => assert.ok(Math.abs(chip.top - row.chips[0].top) <= 2, `${row.id} chips on one line: ${JSON.stringify(row.chips)}`))
	);
	const saveAs = rows.find((row) => row.id === 'save-as');
	assert.ok(Math.abs(saveAs.chips[0].top - saveAs.nameTop) <= 6, `Save as chips beside its name: ${JSON.stringify(saveAs)}`);
	// a font imported from a .woff (what font_import.js stores)
	await page.evaluate(async () => {
		(await import('/app/main.js')).getCurrentProjectEditor().project.settings.project.exportFormat = 'woff';
	});
	rows = await fileMenu();
	await page.evaluate(() => document.querySelector('#context-menu')?.remove());
	const fontHeading = rows[rows.findIndex((row) => row.id === 'font-otf') - 1].text;
	assert.match(fontHeading, /-Regular\.otf$/);
	assert.deepEqual(rows.find((row) => row.id === 'font-otf').chips.map((chip) => chip.text), ['Ctrl', 'e']);
	await page.evaluate(async () => {
		const folder = await navigator.storage.getDirectory();
		const fonts = await folder.getDirectoryHandle('Fonts', { create: true });
		window.showDirectoryPicker = async () => fonts;
	});
	await page.locator('#editor-page__edit-canvas canvas').hover();
	await tap('Control+e');
	await waitUntil(async () => /\.otf/.test((await toastNow()) ?? ''), 'the font file toast', 30000);
	const made = await page.evaluate(async () => {
		const folder = await navigator.storage.getDirectory();
		const fonts = await folder.getDirectoryHandle('Fonts');
		const names = [];
		for await (const name of fonts.keys()) names.push(name);
		return names;
	});
	await shot('5b-ctrl-e-from-woff-made-otf');
	assert.ok(made.length > 0 && made.every((name) => name.endsWith('.otf')), JSON.stringify(made));
	numbers.fileMenu = { rows, fontHeading, made };
	pass(`File: Save, Save as... (chips ${JSON.stringify(saveAs.chips.map((c) => c.text))} on one line), Open a saved font... [Ctrl o], the .otf; a font from a .woff: heading "${fontHeading}" and Ctrl+E wrote ${JSON.stringify(made)}`);

	// ----------------------------------------------------------
	// 6. All tools: an empty letter's width never goes below 0
	// ----------------------------------------------------------
	await newFont('Fix Check All', '');
	assert.equal((await state()).mode, 'all');
	await openLetter('glyph-0x65');
	const allEdge = await at(0, 300);
	const allSteps = (await state()).steps;
	await drag(allEdge, { x: allEdge.x + 45, y: allEdge.y });
	s = await state();
	assert.equal(s.advance, 0, `All tools: width ${s.advance}`);
	assert.equal(s.steps, allSteps);
	pass('All tools: the left edge of an empty small e dragged 45 px right leaves its width at 0, no step');

	// ----------------------------------------------------------
	// 7. The landing band with real keys: Undo, then Redo
	// ----------------------------------------------------------
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/?ui=simple`);
	await pinB5Simple(page);
	await page.locator('#open-project__tab-examples').click();
	await page.locator('#tab-content__examples fancy-button').nth(1).click(); // the simple example (its words differ per mode)
	await page.locator('glyph-tile').first().waitFor();
	await settle();
	await page.evaluate(async () => (await import('/anyink/mode/band.js')).turnOnMoreTools());
	await settle();
	await page.locator('#nav-button-l1').click();
	await page.locator('#nav-dropdown-page .nav-dropdown__button[data-anyink-page="Kerning"]').click();
	await page.locator('.editor-page__zoom-area').waitFor();
	await settle(500);
	await offCanvas();
	await tap('ArrowUp');
	await page.locator('.anyink-band button').click();
	await settle(500);
	await offCanvas();
	await tap('Control+z');
	await settle(500);
	s = await state();
	assert.deepEqual([s.page, s.visit?.cause, s.band], ['Kerning', 'undo', 'Undo took you to one of the More tools pages.']);
	await page.locator('.anyink-band button').click();
	await settle(500);
	assert.deepEqual([(await state()).mode, (await state()).page], ['simple', 'Characters']);
	await offCanvas();
	await tap('Control+y');
	await settle(500);
	s = await state();
	assert.deepEqual([s.page, s.visit?.cause, s.band], ['Kerning', 'redo', 'Redo took you to one of the More tools pages.']);
	await shot('7-redo-landed-band');
	pass(`landing with real keys: Ctrl+Z "Undo took you to one of the More tools pages."; Back to my letters; Ctrl+Y "${s.band}"`);

	// ----------------------------------------------------------
	// 8. The Open Project page follows a mode switch
	// ----------------------------------------------------------
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/`);
	await page.locator('#open-project__tab-load').waitFor({ timeout: 30000 });
	await page.locator('#open-project__tab-load').click();
	const before = await text('#open-project__drop-target');
	await page.evaluate(async () => (await import('/anyink/mode/switch.js')).switchMode('simple'));
	await settle(300);
	await page.locator('#open-project__tab-load').click();
	const after = await text('#open-project__drop-target');
	assert.match(before, /ANY-INK project/);
	assert.match(after, /An ANY-INK work file/);
	await shot('8-open-project-after-switch');
	numbers.openProject = { before, after };
	pass(`Open Project page, All tools -> Simple: the Load tab's drop target went from "${before}" to "${after}"`);

	assert.deepEqual(errors, [], 'no page errors');
	pass('no page errors');
	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, 2));
	console.log(`Screenshots and numbers.json in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true }).catch(() => {});
}
