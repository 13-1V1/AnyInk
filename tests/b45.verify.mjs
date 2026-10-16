// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 integration real-browser check (docs/UX-BEGINNER.md 2.2, 2.3, 4.0, 4.9 to 4.11, 6, 7.6,
// 7.7, section 10 B4 and B5), in the real app on Vite dev servers, Chrome with a throwaway profile,
// 1600 x 900:
//   A. All tools, before and after: the last commit's src/ (exported with git archive into a temp
//      folder, B45_BEFORE=<src folder> to serve another, B45_BEFORE=skip for none) and today's,
//      each with a new font and small a: screenshots of the Characters page, the File menu, the
//      guide labels (with the small-letter line's readout), the save status and the strip. All
//      tools keeps its controls (page and panel choosers, tools and their tooltips, view tools,
//      menus, panel); the shared display points changed to house words with 0 banned-word hits;
//      the keys keep their tools except P and E (7.6, both modes)
//   B. Simple (?ui=simple): every start page tab, the Overview, the letter page, the letter
//      chooser, Help and About say no banned word and nothing in capitals; the hidden pages,
//      panels, tools, actions, menu rows and settings rows are gone; the keys follow the map (R
//      "Switched to Rectangle (R)", U / Ctrl+Space / Ctrl+G nothing); the writing lines don't move
//      but the edges do; Merge, Ctrl+R, Ctrl+S, Ctrl+E (a letter that needs fixing) and Undo
//      past the start speak in plain words, none dropped (a photo goes to the photo screens:
//      B8 + B9 finalize, 'photo' on for that step); then the landing rule: More tools,
//      a gap nudged on Kerning, Back to simple, Ctrl+Z lands on Kerning with the purple band (the
//      page takes the band's height off), Back to my letters returns
//   D. B4 + B5 finalize: the Simple start page has one green button on each tab; a font file
//      brought in on its Load tab says "Bringing in letters... N of M" all the way (every progress
//      line is scanned as it shows); Help and About have [Back to my letters]; and in All tools a
//      strip toggle with focus no longer swallows Ctrl+Z, and the strip redraws when a rectangle
//      is drawn (its empty-sheet sentence goes)
//   Simple scans are strict (UX-BEGINNER.md 2.4 E and G: no "project", no block names, no codes).
//   B6 + B7 finalize: B and D check B5's Simple, so every feature flag is turned off in the page
//   (verify_standins.mjs pinB5Simple); B6 and B7's Simple is b67.verify.mjs and b67-fixes.verify.mjs.
// Usage: node tests/b45.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { formatHit, scanTexts } from '../src/anyink/words/banned.js';
import { pinB5Simple, pressInAllTools, toOverview } from './verify_standins.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b45'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b45-'));
const junction = resolve(scratch, 'head', 'node_modules');

/** The last commit's src/, for the "before" screenshots: git archive into a temp folder. */
function exportHeadSrc() {
	const dir = resolve(scratch, 'head');
	// Windows' own tar (bsdtar): a Git Bash tar earlier on PATH reads "C:" as a remote host
	const tar =
		process.platform === 'win32'
			? `"${resolve(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe')}"`
			: 'tar';
	execSync(`git archive HEAD src | ${tar} -x -C "${dir}"`, { cwd: repo, stdio: 'pipe', shell: true });
	// Vite finds the packages through a junction to this repo's node_modules
	symlinkSync(resolve(repo, 'node_modules'), junction, 'junction');
	return resolve(dir, 'src');
}

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

const beforeSetting = process.env.B45_BEFORE || '';
let beforeRoot = null;
if (beforeSetting !== 'skip') {
	await mkdir(resolve(scratch, 'head'), { recursive: true });
	beforeRoot = beforeSetting ? resolve(beforeSetting) : exportHeadSrc();
}
const after = await serve(src, 'after');
const before = beforeRoot ? await serve(beforeRoot, 'before') : null;

const context = await chromium.launchPersistentContext(resolve(scratch, 'profile'), {
	channel: process.env.B45_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
	acceptDownloads: true,
});
// Every page: a canvas spy (strings drawn) and a toast recorder (text of every toast, a quote
// or a pro word read as "…", the way the banned-word scan reads them)
await context.addInitScript(() => {
	window.__canvasTexts = [];
	for (const proto of [CanvasRenderingContext2D.prototype, OffscreenCanvasRenderingContext2D.prototype]) {
		for (const name of ['fillText', 'strokeText']) {
			const original = proto[name];
			proto[name] = function (text, ...rest) {
				window.__canvasTexts.push(String(text));
				return original.call(this, text, ...rest);
			};
		}
	}
	window.__toasts = [];
	const shown = (node) => {
		const copy = node.cloneNode(true);
		copy.querySelectorAll('.anyink-quote, .anyink-pro-word').forEach((part) => part.replaceWith('"…"'));
		return copy.textContent.replace(/\s+/g, ' ').trim();
	};
	const read = (node) => {
		if (node?.nodeType !== 1) return;
		const toasts = node.matches('#toast, [data-anyink-toast]')
			? [node]
			: [...node.querySelectorAll('#toast, [data-anyink-toast]')];
		toasts.forEach((toast) => {
			const text = shown(toast);
			if (text && window.__toasts.at(-1) !== text) window.__toasts.push(text);
		});
	};
	new MutationObserver((records) =>
		records.forEach((record) => {
			record.addedNodes.forEach(read);
			const around = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
			const toast = around?.closest?.('#toast, [data-anyink-toast]');
			if (toast) read(toast);
		})
	).observe(document, { childList: true, subtree: true, characterData: true });
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
const shotList = [];
const shot = async (name, locator) => {
	const path = resolve(shots, `${name}.png`);
	if (locator) await locator.screenshot({ path });
	else await page.screenshot({ path });
	shotList.push(`${name}.png`);
};
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

/** The editor's state, read in the page */
const state = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const mode = await import('/anyink/mode/mode.js').catch(() => null);
		const font = editor.project.settings.font;
		return {
			mode: mode?.getMode?.() ?? 'all',
			visit: mode?.getVisit?.() ?? null,
			page: editor.nav.page,
			tool: editor.selectedTool,
			item: editor.selectedItemID,
			xHeight: font.xHeight,
			advance: editor.selectedItem?.advanceWidth,
			shapes: editor.selectedItem?.shapes?.length,
			band: document.querySelector('#app__top-bar + .anyink-band')?.dataset.anyinkBand || null,
			bandHeight: getComputedStyle(document.documentElement)
				.getPropertyValue('--anyink-band-height')
				.trim(),
			cursor: document.body.style.cursor,
			status: document.querySelector('#app__top-bar anyink-save-status')?.textContent.trim() ?? '',
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
		return {
			nav,
			tools: titles('.editor-page__tools-area button'),
			toolIds: [...document.querySelectorAll('.editor-page__tools-area button')]
				.filter(shown)
				.map((el) => el.dataset.anyinkTool || null),
			viewTools: titles('.editor-page__zoom-area button, .editor-page__zoom-area input'),
			panel: !!panel && shown(panel) && panel.textContent.trim().length > 0,
			panelIcons: panel
				? [...panel.querySelectorAll('.action-button, button[title]')].filter(shown).length
				: 0,
			numberFields: [...document.querySelectorAll('input[type=number], input-number')].filter(shown)
				.length,
			menus: [...document.querySelectorAll('#app__top-bar .menu-entry-point')]
				.filter(shown)
				.map((b) => b.textContent.trim()),
			letterButton: document.querySelector('#nav-button-l2')?.innerText.replace(/\s+/g, ' ').trim(),
		};
	});

/** Opens a nav chooser and reads its rows (All tools) */
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

/** Opens a top bar menu; its rows' ids (B4's data-anyink-row) or words, and the menu's text */
const openMenu = async (name) => {
	await page.locator('#app__top-bar .menu-entry-point', { hasText: name }).click();
	await page.locator('#context-menu').waitFor();
	await settle(200);
	return page.$$eval('#context-menu > *', (list) =>
		list
			.filter((row) => getComputedStyle(row).display !== 'none')
			.map((row) => ({
				id: row.querySelector('[data-anyink-row]')?.dataset.anyinkRow || null,
				text: row.textContent.replace(/\s+/g, ' ').trim(),
			}))
			.filter((row) => row.text)
	);
};
const closeMenu = () => page.evaluate(() => document.querySelector('#context-menu')?.remove());

/** The banned-word scan in the real page (real CSS): visible text, tooltips, sentence case */
const scan = (selector = 'body', { strict = false } = {}) =>
	page.evaluate(
		async ({ sel, strict }) => {
			const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
			const root = document.querySelector(sel);
			const hits = [...scanDom(root, { strict }), ...findUppercase(root)];
			return hits.map(formatHit);
		},
		{ sel: selector, strict }
	);
/** B4 + B5 finalize: a Simple screen is scanned strict (2.4 E and G) */
const scanSimple = (selector = 'body') => scan(selector, { strict: true });
/** The scan's matcher on strings (canvas text, toasts), run here in Node */
const scanStrings = (texts, { strict = false } = {}) =>
	scanTexts(texts, 'text', { strict }).map(formatHit);
/** The letter canvas's drawing surface (on screen; the outer <edit-canvas> box is not) */
const CANVAS = '#editor-page__edit-canvas canvas';
/**
 * The "before" app has no banned.js: its text and tooltips are read in the page and matched here
 * (the same matcher; no CSS case check), for the record.
 */
const scanBefore = async (selector) =>
	scanStrings(
		await page.evaluate((sel) => {
			const root = document.querySelector(sel);
			if (!root) return [];
			const attributes = [...root.querySelectorAll('[title], [aria-label], [placeholder]')].flatMap(
				(el) => ['title', 'aria-label', 'placeholder'].map((name) => el.getAttribute(name) || '')
			);
			return [root.innerText, ...attributes].filter(Boolean);
		}, selector)
	);

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
const hover = async (point) => {
	await page.mouse.move(point.x - 15, point.y, { steps: 3 });
	await page.mouse.move(point.x, point.y, { steps: 3 });
	await settle(200);
};

const newFont = async (origin, name, search = '?ui=all') => {
	await page.evaluate(() => (window.onbeforeunload = null)).catch(() => {});
	await page.goto(`${origin}/${search}`);
	if (search.includes('ui=simple')) await pinB5Simple(page);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill(name);
	await page.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle();
};
const openSmallA = async () => {
	await toOverview(page);
	await page.locator('glyph-tile[displayed-item-id="glyph-0x61"]').click();
	await waitUntil(async () => (await state()).item === 'glyph-0x61', 'small a open');
	await page.locator('.editor-page__zoom-area').waitFor();
	await offCanvas();
	await settle(500);
};
/** A rectangle in the open letter, drawn with the mouse; the tool found by its tooltip or id */
const drawRectangle = async (button) => {
	await page.locator(button).click();
	// off every guide line: in All tools a press on a line drags the line
	await drag(await at(100, 60), await at(400, 460));
};
const toastNow = () =>
	page.evaluate(() => {
		const toast = [...document.querySelectorAll('#toast:not([data-leaving])')].at(-1);
		return toast ? toast.textContent.replace(/\s+/g, ' ').trim() : null;
	});

// --------------------------------------------------------------
// A. All tools, before and after
// --------------------------------------------------------------

/** One All tools pass on a server: screenshots, controls, shared display points */
async function allToolsPass(label, origin) {
	const result = {};
	await newFont(origin, 'B45 Check');
	await openSmallA();
	const xHeightBefore = (await state()).xHeight;
	await drawRectangle('button[title="New rectangle"]');
	await page.locator('button[title="Resize"]').click();
	await offCanvas();
	await settle(300);
	const drawn = await state();
	assert.equal(drawn.shapes, 1, `${label}: the rectangle is drawn`);
	assert.equal(drawn.xHeight, xHeightBefore, `${label}: no guide line moved`);
	result.controls = await controls();
	result.pageChooser = await chooser('l1');
	result.panelChooser = await chooser('l3');
	await shot(`A-${label}-1-characters-page`);

	// the guide labels on, the small-letter line pointed at (its readout)
	const xHeight = (await state()).xHeight;
	await page.evaluate(async () => {
		window.__canvasTexts = [];
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.project.settings.app.guides.systemShowLabels = true;
		editor.editCanvas.redraw();
	});
	await hover(await at(-150, xHeight));
	await shot(`A-${label}-2-guide-labels`, page.locator('.editor-page__edit-canvas-wrapper'));
	result.canvasTexts = await page.evaluate(() => [...new Set(window.__canvasTexts)]);
	await offCanvas();

	result.saveStatus = (await state()).status;
	await shot(`A-${label}-3-save-status`, page.locator('#app__top-bar'));
	result.strip = await page.evaluate(() => {
		const root = document.querySelector('preview-strip');
		return {
			eyebrow: root.querySelector('.preview-strip__eyebrow').innerText,
			placeholder: root.querySelector('.preview-strip__text').placeholder,
			samples: root.querySelector('.preview-strip__presets').textContent.trim(),
			toggles: [...root.querySelectorAll('.preview-strip__toggle')]
				.filter((t) => t.checkVisibility())
				.map((t) => t.textContent.trim()),
		};
	});
	await shot(`A-${label}-4-strip`, page.locator('preview-strip'));
	result.fileMenu = await openMenu('File');
	// the file name headings keep their look (a quote span inside keeps the heading's font)
	result.headingFont = await page.evaluate(() => {
		const heading = document.querySelector('#context-menu .spanAll h2');
		const words = heading.querySelector('.anyink-quote') || heading;
		const style = getComputedStyle(words);
		return { family: style.fontFamily, size: style.fontSize };
	});
	await shot(`A-${label}-5-file-menu`);
	const scanHere = label === 'after' ? scan : scanBefore;
	result.fileMenuHits = await scanHere('#context-menu');
	await closeMenu();
	result.stripHits = await scanHere('preview-strip');
	result.statusHits = await scanHere('#app__top-bar anyink-save-status');
	result.canvasHits = scanStrings(result.canvasTexts);

	// the tool keys on the letter canvas
	result.keys = {};
	for (const key of ['p', 'e', 'u', 'v', 'r', 'o']) {
		await tap(key);
		result.keys[key] = (await state()).tool;
	}
	await tap('v');
	return result;
}

const shared = {};
try {
	if (before) {
		shared.before = await allToolsPass('before', before.origin);
		pass(
			`before (last commit's src/): Characters page, File menu, guide labels, save status and strip captured; File menu says ${JSON.stringify(
				shared.before.fileMenu.map((row) => row.text).slice(0, 4)
			)}`
		);
	}
	shared.after = await allToolsPass('after', after.origin);
	const a = shared.after;
	assert.equal((await state()).mode, 'all');
	assert.equal(a.controls.panel, true, 'All tools draws the panel');
	assert.deepEqual(a.controls.nav, ['l1', 'l2', 'l3']);
	assert.deepEqual(a.controls.menus, ['File', 'Projects', 'Help']);
	if (shared.before) {
		const b = shared.before;
		assert.deepEqual(a.controls.nav, b.controls.nav);
		// B8 (D-038, 7.6): the Brush joined the tool column after New path; the rest as before
		const toolsBefore = [...b.controls.tools];
		if (!toolsBefore.some((t) => /^Brush/.test(t))) {
			const at = toolsBefore.findIndex((t) => /^New path/.test(t));
			toolsBefore.splice(at + 1, 0, a.controls.tools[at + 1]);
		}
		assert.match(a.controls.tools[toolsBefore.findIndex((t) => /^New path/.test(t)) + 1], /^Brush/);
		assert.deepEqual(a.controls.tools, toolsBefore, 'tool tooltips unchanged in All tools');
		assert.deepEqual(a.controls.viewTools, b.controls.viewTools);
		assert.deepEqual(a.controls.menus, b.controls.menus);
		assert.equal(a.controls.panelIcons, b.controls.panelIcons, 'the same panel icons');
		assert.deepEqual(a.pageChooser, b.pageChooser);
		assert.deepEqual(a.panelChooser, b.panelChooser);
		assert.equal(a.controls.letterButton, b.controls.letterButton);
		assert.deepEqual(a.fileMenu.length, b.fileMenu.length, 'the same number of File rows');
		assert.deepEqual(a.headingFont, b.headingFont, 'File menu headings keep their font');
		// 7.6, both modes: P picks the Point pen and E Edit points; every other key as before
		// (B6 + B7 finalize: the last commit has B5's keys already, so P and E match it too)
		// B8: B and N pick the Brush in both modes (7.6; B picked Edit points before)
		const changed = Object.keys(a.keys).filter(
			(key) => !['e', 'p', 'b', 'n'].includes(key) && a.keys[key] !== b.keys[key]
		);
		assert.deepEqual(changed, [], JSON.stringify({ before: b.keys, after: a.keys }));
		assert.deepEqual([a.keys.p, a.keys.e], ['newPath', 'pathEdit']);
		if ('b' in a.keys) assert.equal(a.keys.b, 'nib');
	}
	assert.deepEqual(a.fileMenuHits, [], 'the File menu says no banned word');
	assert.deepEqual(a.stripHits, [], 'the strip says no banned word');
	assert.deepEqual(a.statusHits, []);
	assert.deepEqual(a.canvasHits, [], `the canvas says no banned word: ${JSON.stringify(a.canvasTexts)}`);
	assert.ok(a.canvasTexts.includes('Small-letter line'), JSON.stringify(a.canvasTexts));
	assert.ok(
		a.canvasTexts.some((text) => /^small-letter line \d+$/.test(text)),
		`the readout says "small-letter line N": ${JSON.stringify(a.canvasTexts)}`
	);
	assert.deepEqual(a.strip.toggles, ['Real font', 'Guide lines']);
	assert.equal(a.strip.eyebrow, 'Preview');
	numbers.allTools = shared;
	pass(
		`All tools after B4 + B5: the same choosers (${a.pageChooser.length} page rows, ${
			a.panelChooser.length
		} panels), tools ${JSON.stringify(a.controls.tools)}, ${
			a.controls.viewTools.length
		} view controls, menus ${a.controls.menus.join(', ')}, ${a.controls.panelIcons} panel icons${
			shared.before ? ' (all equal to before)' : ''
		}; keys ${JSON.stringify(a.keys)}${shared.before ? ' (only P and E changed, 7.6)' : ''}`
	);
	pass(
		`All tools shared display points in house words, 0 hits: canvas ${JSON.stringify(
			a.canvasTexts.filter((t) => /line|edge|space/i.test(t)).slice(0, 8)
		)}; save status "${a.saveStatus}"${
			shared.before ? ` (before: "${shared.before.saveStatus}")` : ''
		}; strip "${a.strip.eyebrow}", "${a.strip.placeholder}", "${a.strip.samples}", ${JSON.stringify(
			a.strip.toggles
		)}; File menu ${JSON.stringify(a.fileMenu.map((row) => row.text).slice(1, 6))}${
			shared.before
				? ` (before: ${shared.before.fileMenuHits.length} File menu hits, ${
						shared.before.stripHits.length
				  } strip hits, ${(shared.before.canvasHits || []).length} canvas hits)`
				: ''
		}`
	);

	// ----------------------------------------------------------
	// B. Simple
	// ----------------------------------------------------------
	await page.evaluate(() => (window.onbeforeunload = null)).catch(() => {});
	await page.goto(`${after.origin}/?ui=simple`);
	await pinB5Simple(page);
	await page.locator('#input__new-project-name').waitFor({ timeout: 30000 });
	// B12 + B13 finalize: Simple's start page is B13's start screen now (its words are scanned
	// strict in b1213.verify.mjs A); the B5 start-page words were retired with it, so the page
	// pinB5Simple draws again is only the way in to B5's Simple here, not a screen to scan
	await page.locator('#open-project__tab-new').click();
	await page.locator('#input__new-project-name').fill('B45 Simple');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await settle(600);
	let s = await state();
	assert.equal(s.mode, 'simple');
	assert.equal(s.page, 'Overview');
	assert.deepEqual(await scanSimple('body'), [], 'the Overview');
	// B5 fix track: Simple keeps the page chooser until B6's rail
	assert.deepEqual((await controls()).nav, ['l1'], 'the page chooser on the Overview');
	await shot('B-simple-02-overview');
	pass('Simple Overview: 0 banned-word or capitals hits; the page chooser stays (until B6); the start page is B13 start screen (b1213.verify A)');

	await openSmallA();
	let c = await controls();
	assert.deepEqual(c.nav, ['l1', 'l2'], 'the page chooser and the letter button');
	assert.equal(c.letterButton, 'Letter small a');
	assert.equal(c.panel, false);
	assert.equal(c.numberFields, 0);
	assert.deepEqual(c.toolIds, ['newRectangle', 'newOval', 'newPath', 'pathEdit', 'resize']);
	assert.deepEqual(c.tools, ['Rectangle (R)', 'Oval (O)', 'Point pen (P)', 'Edit points (E)', 'Select (V)']);
	assert.deepEqual(c.viewTools, ['Zoom out', 'Zoom level', 'Zoom in', 'Outline only', 'Dark paper', 'Fit letter']);
	assert.deepEqual(c.menus, ['File', 'Help']);
	const fileRows = await openMenu('File');
	await shot('B-simple-03-file-menu');
	// B4 + B5 finalize: "Choose where font files go" stays until Use in Word (B14)
	assert.deepEqual(fileRows.filter((row) => row.id).map((row) => row.id), ['save', 'save-as', 'open-font', 'font-otf', 'font-folder']);
	assert.deepEqual(await scanSimple('#context-menu'), []);
	await closeMenu();
	const helpRows = await openMenu('Help');
	assert.deepEqual(await scanSimple('#context-menu'), []);
	await closeMenu();
	const hidden = await page.evaluate(async () => {
		const { shownIds, hiddenIds } = await import('/anyink/mode/visibility.js');
		const { getActionData } = await import('/panels/actions.js');
		const { actionId } = await import('/anyink/mode/visibility.js');
		const groups = ['allActions', 'addShapeActions', 'glyphActions', 'shapeActions', 'boolActions', 'layerActions', 'pointActions'];
		const actions = groups.flatMap((group) => [].concat(getActionData(group)).map((entry) => actionId(group, entry)));
		const { makeSettingsTabContentFont } = await import('/pages/settings_font.js');
		const tab = makeSettingsTabContentFont();
		document.body.appendChild(tab);
		const rows = [...tab.querySelectorAll('h2, .settings__label, label')]
			.filter((el) => el.checkVisibility())
			.map((el) => el.textContent.replace(/\s+/g, ' ').trim())
			.filter(Boolean);
		tab.remove();
		return { pages: shownIds('page'), hiddenPages: hiddenIds('page'), panels: shownIds('panel'), actions, rows };
	});
	assert.deepEqual(hidden.panels, []);
	assert.ok(!hidden.pages.includes('Kerning') && !hidden.pages.includes('Settings'), JSON.stringify(hidden.pages));
	assert.deepEqual(hidden.actions, ['allActions.undo', 'allActions.redo', 'glyphActions.flipHorizontal', 'glyphActions.flipVertical', 'boolActions.combine_unite']);
	assert.ok(hidden.rows.some((row) => /Font family/.test(row)), JSON.stringify(hidden.rows));
	assert.ok(!hidden.rows.some((row) => /PANOSE|Weight|Style|Version|Ascent/i.test(row)), JSON.stringify(hidden.rows));
	const letterHits = await scanSimple('body');
	assert.deepEqual(letterHits, [], 'the whole Simple letter screen');
	await shot('B-simple-04-letter-page');
	await page.locator('#nav-button-l2').click();
	await page.locator('#nav-dropdown-chooser').waitFor();
	await settle(300);
	assert.deepEqual(await scanSimple('body'), [], 'the letter chooser');
	await shot('B-simple-05-letter-chooser');
	await page.keyboard.press('Escape');
	await page.evaluate(() => document.querySelectorAll('nav').forEach((nav) => nav.remove()));
	numbers.simple = { controls: c, fileRows, helpRows, hidden };
	pass(
		`Simple letter page: the page chooser and the letter button ("${c.letterButton}"), no panel chooser, no panel, 0 number fields; tools ${JSON.stringify(
			c.tools
		)}; view ${JSON.stringify(c.viewTools)}; menus File (Save, Save as..., Open a saved font..., the .otf font file) and Help; pages shown ${JSON.stringify(
			hidden.pages
		)}, hidden ${hidden.hiddenPages.length}; actions ${hidden.actions.length} (Undo, Redo, two flips, Merge); Font settings rows ${JSON.stringify(
			hidden.rows
		)}; the letter screen and the letter chooser: 0 hits`
	);

	// keys
	await page.evaluate(() => (window.__toasts = []));
	await tap('r');
	assert.equal((await state()).tool, 'newRectangle');
	assert.equal(await toastNow(), 'Switched to Rectangle (R)');
	await shot('B-simple-06-tool-key-toast');
	await tap('u');
	assert.equal((await state()).tool, 'newRectangle', 'U does nothing in Simple');
	await page.keyboard.down('Control');
	await page.keyboard.down('Space');
	await settle(200);
	const hideUI = await page.locator('#hideUI').count();
	await page.keyboard.up('Space');
	await page.keyboard.up('Control');
	assert.equal(hideUI, 0, 'Ctrl+Space does nothing in Simple');
	downloads = [];
	await tap('Control+g');
	await settle(800);
	assert.deepEqual(downloads, [], 'Ctrl+G makes no SVG font file in Simple');
	await tap('p');
	assert.equal((await state()).tool, 'newPath');
	assert.equal(await toastNow(), 'Switched to Point pen (P)');
	await tap('Escape');
	await tap('v');
	assert.equal((await state()).tool, 'resize');
	pass('Simple keys: R picks the Rectangle and says "Switched to Rectangle (R)"; P "Switched to Point pen (P)"; U, Ctrl+Space and Ctrl+G do nothing');

	// lines locked, edges free
	await drawRectangle('button[data-anyink-tool="newRectangle"]');
	await tap('v');
	s = await state();
	assert.equal(s.shapes, 1);
	const xLine = s.xHeight;
	await drag(await at(-150, xLine), await at(-150, xLine + 60));
	assert.equal((await state()).xHeight, xLine, 'the small-letter line stays');
	const baselineBefore = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.selectedItem.shapes[0].maxes.yMin;
	});
	await drag(await at(-150, 0), await at(-150, 80));
	const baselineAfter = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.selectedItem.shapes[0].maxes.yMin;
	});
	assert.equal(baselineAfter, baselineBefore, 'the writing line stays (the letter does not move)');
	const advance = (await state()).advance;
	const edge = await at(advance, 200);
	await drag(edge, { x: edge.x + 30, y: edge.y });
	const advanceAfter = (await state()).advance;
	assert.ok(advanceAfter > advance, `the right edge drags (${advance} -> ${advanceAfter})`);
	await shot('B-simple-07-edge-dragged');
	numbers.simpleLines = { xLine, advance, advanceAfter };
	pass(`Simple guide lines: the small-letter line and the writing line don't move; the right edge drags (${advance} -> ${advanceAfter})`);

	// toasts: Merge, Ctrl+R, a photo, Ctrl+S, Ctrl+E with a letter that needs fixing, Undo past the start
	await page.evaluate(async () => {
		window.__toasts = [];
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { Path } = await import('/project_data/path.js');
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape(
			new Path({ name: 'Square', pathPoints: [corner(250, 150), corner(550, 150), corner(550, 450), corner(250, 450)] })
		);
		editor.history.addState('a second square');
		editor.navigate();
	});
	await settle(500);
	await pressInAllTools(page, 'glyphActions', 'combine_unite');
	await waitUntil(async () => (await toastNow()) === 'Merged the shapes', 'merged');
	await shot('B-simple-08-merged-toast');
	await page.evaluate(async () => (await import('/edit_canvas/tools/tools.js')).selectTool('pathEdit'));
	await page.locator(CANVAS).hover();
	// B5 fix track: Ctrl+R is off in Simple (Chrome keeps its reload key), so it is not pressed
	// here; the fix track's own check presses it
	// B8 + B9 finalize: Simple turned a photo away ("... photos yet") only until B9; the words are
	// gone (D-040) and 'photo' ships on, so for this one step the flag is as shipped: the photo
	// goes to the photo screens (tests/b89.verify.mjs walks them), and Cancel takes it out again
	await page.evaluate(async () => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ photo: true });
		const canvas = new OffscreenCanvas(300, 400);
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, 300, 400);
		ctx.fillStyle = 'black';
		ctx.fillRect(100, 100, 100, 200);
		const blob = await canvas.convertToBlob({ type: 'image/png' });
		const { importTraceImage } = await import('/anyink/trace/trace_import.js');
		await importTraceImage(new File([blob], 'a-photo.png', { type: 'image/png' }));
	});
	// (a one-part photo opened from a letter goes straight to step C, the photo flow's; the
	// B5 letter page has no letter card to show the photo card in)
	await waitUntil(
		() =>
			page.evaluate(async () => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
				return !!getFlow(editor) || !!document.querySelector('[data-anyink-dialog="photoDialog"]');
			}),
		'the photo went to the photo screens'
	);
	await shot('B-simple-09-photo-to-the-photo-screens');
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		(await import('/anyink/photo/photo_dialog.js')).closePhotoDialog();
		(await import('/anyink/photo/photo_flow.js')).cancelPart(editor);
		(await import('/anyink/photo/photo_card.js')).closePhotoCard();
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ photo: false });
	});
	await settle(300);
	await page.evaluate(async () => {
		const folder = await navigator.storage.getDirectory();
		const handle = await folder.getFileHandle('B45 Simple.gs2', { create: true });
		window.showSaveFilePicker = async () => handle;
		const fonts = await folder.getDirectoryHandle('Fonts', { create: true });
		window.showDirectoryPicker = async () => fonts;
	});
	await page.locator(CANVAS).hover();
	await tap('Control+s');
	await waitUntil(async () => (await state()).status === 'Saved', 'the save status says Saved');
	await shot('B-simple-10-saved-status');
	// small a: ink but no width, so the font check names it
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedItem.advanceWidth = 0;
	});
	await page.locator(CANVAS).hover();
	await tap('Control+e');
	await waitUntil(
		async () => /needs fixing/.test((await toastNow()) ?? ''),
		'the font check toast after Ctrl+E',
		30000
	);
	const checkToast = await page.evaluate(() => {
		const toast = [...document.querySelectorAll('#toast:not([data-leaving])')].at(-1);
		return {
			text: toast.querySelector('.anyink-toast__text')?.textContent,
			quotes: [...toast.querySelectorAll('.anyink-quote')].map((q) => q.textContent),
			button: toast.querySelector('.anyink-toast__action')?.textContent,
			tone: toast.dataset.tone,
			simple: toast.dataset.anyinkToast,
		};
	});
	await shot('B-simple-11-font-file-check-toast');
	// B4 + B5 finalize: the first Ctrl+E said what to pick before the folder picker opened
	const askedFirst = await page.evaluate(async () =>
		(await import('/anyink/toast/toast.js'))
			.toastLog()
			.filter((record) => record.key === 'menu.pickFolderFirst' && record.shown)
			.map((record) => record.text)
	);
	assert.equal(askedFirst.length, 1, 'the sentence before the first folder picker');
	checkToast.beforePicker = askedFirst[0];
	assert.equal(checkToast.simple, 'simple');
	assert.equal(checkToast.button, 'Show me');
	assert.equal(checkToast.tone, 'warning');
	// B14 + B15 finalize: Simple says "Made", as Use in Word's card does
	assert.match(checkToast.text, /^Made .+\.otf in Fonts, but small a needs fixing\.$/);
	await page.waitForTimeout(3000); // the export's own 2.5 s close leaves it alone
	assert.match((await toastNow()) ?? '', /small a needs fixing/);
	for (let i = 0; i < 12; i++) await tap('Control+z');
	await settle(500);
	const toastRecord = await page.evaluate(async () => {
		const { droppedToasts } = await import('/anyink/toast/toast.js');
		return { said: window.__toasts, dropped: droppedToasts() };
	});
	assert.deepEqual(toastRecord.dropped, [], 'no message dropped');
	assert.deepEqual(scanStrings(toastRecord.said, { strict: true }), [], JSON.stringify(toastRecord.said));
	assert.ok(toastRecord.said.includes('Merging the shapes...'), JSON.stringify(toastRecord.said));
	assert.ok(!toastRecord.said.some((t) => /rounded|No more undo|Saved B45/.test(t)), JSON.stringify(toastRecord.said));
	numbers.simpleToasts = { ...toastRecord, checkToast };
	pass(
		`Simple toasts in plain words, 0 hits, none dropped: ${JSON.stringify(toastRecord.said)}; Ctrl+S and Undo past the start say nothing; the font check toast "${checkToast.text}" [${checkToast.button}] (names as quotes ${JSON.stringify(checkToast.quotes)}) outlasts the export's 2.5 s close; before the first folder picker: "${checkToast.beforePicker}"`
	);

	// Help and About
	await openMenu('Help');
	// Help's rows carry their ids as row data (menu.js anyinkRow), not in the DOM
	await page.locator('#context-menu .context-menu-row', { hasText: 'In-app help' }).click();
	await settle(500);
	assert.equal((await state()).page, 'Help');
	assert.deepEqual(await scanSimple('body'), [], 'Help');
	// B14 + B15 finalize: B5's one-tab stand-in Help was retired by B15's Help page (pages/help.js,
	// anyink/help/help_page.js), which shows only the entries of the flags that are on
	const helpTabs = await page.$$eval('.tab-control__tab', (list) => list.map((t) => t.textContent));
	assert.deepEqual(helpTabs, []);
	assert.equal(await page.locator('[data-anyink-help]').count(), 1, "B15's Help page");
	await shot('B-simple-12-help');
	// B4 + B5 finalize: a way back from Help and About (principle 7)
	await page.locator('[data-anyink-choice="backToLetters"]').click();
	await settle(500);
	assert.equal((await state()).page, 'Characters', 'Back to my letters from Help');
	await openMenu('Help');
	await page.locator('#context-menu .context-menu-row', { hasText: 'About ANY-INK' }).click();
	await settle(500);
	assert.deepEqual(await scanSimple('body'), [], 'About');
	await page.locator('.tab-control__tab', { hasText: 'Credits' }).click();
	await settle(200);
	assert.deepEqual(await scanSimple('body'), [], 'About > Credits');
	await shot('B-simple-13-about-credits');
	await page.locator('[data-anyink-choice="backToLetters"]').click();
	await settle(500);
	assert.equal((await state()).page, 'Characters', 'Back to my letters from About');
	pass("Simple Help (B15's Help page, no tabs) and About (every tab): 0 hits, strict; [Back to my letters] on both returns to the letter page");

	// ----------------------------------------------------------
	// C. The landing rule, real clicks and keys
	// ----------------------------------------------------------
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${after.origin}/?ui=simple`);
	await pinB5Simple(page);
	await page.locator('#open-project__tab-examples').click();
	await page.locator('#tab-content__examples fancy-button').nth(1).click();
	await page.locator('glyph-tile').first().waitFor();
	await settle();
	// B6's More tools button stands in: the call it will make
	await page.evaluate(async () => (await import('/anyink/mode/band.js')).turnOnMoreTools());
	await settle();
	s = await state();
	assert.deepEqual([s.mode, s.band, s.bandHeight], ['all', 'moreTools', '36px']);
	await shot('C-1-more-tools-band');
	await page.locator('#nav-button-l1').click();
	await page.locator('#nav-dropdown-page .nav-dropdown__button', { hasText: 'Kerning' }).click();
	await page.locator('.editor-page__zoom-area').waitFor();
	await settle(500);
	const gap = () =>
		page.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedKernGroup?.value);
	const gapBefore = await gap();
	await offCanvas();
	await tap('ArrowUp');
	assert.equal(await gap(), gapBefore + 1);
	await page.locator('.anyink-band button').click();
	await settle(500);
	s = await state();
	assert.deepEqual([s.mode, s.page, s.band, s.bandHeight], ['simple', 'Characters', null, '']);
	await offCanvas();
	await tap('Control+z');
	await settle(500);
	s = await state();
	assert.deepEqual([s.page, s.mode, s.band], ['Kerning', 'all', 'landed']);
	assert.deepEqual(s.visit, { page: 'Kerning', cause: 'undo' });
	assert.equal(await gap(), gapBefore);
	const landed = await page.locator('.anyink-band').evaluate((node) => ({
		text: node.querySelector('.anyink-band__text').textContent,
		button: node.querySelector('button').textContent,
		color: getComputedStyle(node).backgroundColor,
		height: node.getBoundingClientRect().height,
	}));
	assert.deepEqual([landed.text, landed.button], ['Undo took you to one of the More tools pages.', 'Back to my letters']);
	assert.equal(landed.height, 36);
	assert.deepEqual(await scan('.anyink-band'), []);
	await shot('C-2-landed-on-kerning');
	await page.locator('.anyink-band button').click();
	await settle(500);
	s = await state();
	assert.deepEqual([s.mode, s.page, s.band, s.visit], ['simple', 'Characters', null, null]);
	await shot('C-3-back-to-my-letters');
	numbers.landing = { gapBefore, landed };
	pass(
		`landing: More tools (band ${s.bandHeight || '36px'} tall, the page takes it off), Kerning, ArrowUp ${gapBefore} -> ${gapBefore + 1}; Back to simple; Ctrl+Z lands on Kerning with the purple band (${landed.color}) "${landed.text}" [${landed.button}], gap back to ${gapBefore}; Back to my letters: Simple, letter page`
	);

	// ----------------------------------------------------------
	// D. B4 + B5 finalize
	// ----------------------------------------------------------
	// the start page's one green button is B13's start screen now (b1213.verify.mjs A); B5's Simple
	// start page and its words were retired with it, so the page pinB5Simple draws again is only
	// the way in to the Load tab below (B12 + B13 finalize)
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${after.origin}/?ui=simple`);
	await pinB5Simple(page);
	await page.locator('#input__new-project-name').waitFor({ timeout: 30000 });

	// a font file brought in on the Load tab: every progress line in house words
	const fontBytes = readFileSync(resolve(src, 'formats_io/otf/tests/ObleggExtendedTestRegular.otf'));
	await page.evaluate(async (base64) => {
		const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
		const folder = await navigator.storage.getDirectory();
		const handle = await folder.getFileHandle('Oblegg Extended.otf', { create: true });
		const writable = await handle.createWritable();
		await writable.write(bytes);
		await writable.close();
		window.showOpenFilePicker = async () => [handle];
		window.__progress = [];
		new MutationObserver(() => {
			const text = document.querySelector('#progress-indicator__message')?.textContent?.replace(/\s+/g, ' ').trim();
			if (text && window.__progress.at(-1) !== text) window.__progress.push(text);
		}).observe(document.body, { childList: true, subtree: true, characterData: true });
	}, fontBytes.toString('base64'));
	await page.locator('#open-project__tab-load').click();
	// B12 + B13 finalize: B5's Simple Load words were retired with its start page (B13), so the
	// button says upstream's words here
	await page.locator('#tab-content__load fancy-button', { hasText: /open a font file|import a font/i }).click();
	await page.locator('#progress-indicator__message').waitFor({ timeout: 15000 });
	// the screenshot while letters come in (the first line is upstream's "Working...")
	await waitUntil(
		() => page.evaluate(() => (window.__progress.at(-1) || '').startsWith('Bringing in')),
		'the first progress line'
	).catch(() => {});
	await shot('D-1-simple-bringing-in-letters');
	await waitUntil(async () => (await state()).page === 'Overview', 'the imported font opens', 60000);
	await settle(500);
	const progress = await page.evaluate(() => window.__progress);
	assert.ok(progress.length > 1, JSON.stringify(progress));
	assert.ok(progress.some((line) => /^Bringing in letters\.\.\. \d+ of \d+$/.test(line)), JSON.stringify(progress));
	assert.deepEqual(scanStrings(progress, { strict: true }), [], JSON.stringify(progress));
	assert.deepEqual(await scanSimple('body'), [], 'the imported font, Overview');
	await shot('D-2-simple-imported-overview');
	numbers.importProgress = progress;
	pass(`Simple: bringing in a font file says ${JSON.stringify(progress.slice(0, 2))} ... ${JSON.stringify(progress.at(-1))} (${progress.length} lines, 0 hits, strict); its Overview 0 hits`);

	// All tools: a strip toggle with focus, then Ctrl+Z; the strip after a rectangle
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${after.origin}/?ui=all`);
	await newFont(after.origin, 'B45 Keys');
	await openSmallA();
	await page.evaluate(async () => {
		const strip = document.querySelector('preview-strip');
		const field = strip.querySelector('textarea, input[type="text"]');
		if (field) {
			field.value = 'aaa';
			field.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await settle(500);
	const sheet = () =>
		page.evaluate(async () => {
			const { placeholderKey } = await import('/anyink/preview/placeholder.js');
			const renderer = document.querySelector('preview-strip').renderer;
			return placeholderKey(renderer?.textBlockOptions?.text, renderer?.textBlock);
		});
	const sheetBefore = await sheet();
	await page.evaluate(() => {
		const strip = document.querySelector('preview-strip');
		const redraw = strip.redrawNow.bind(strip);
		window.__stripRedraws = 0;
		strip.redrawNow = () => {
			window.__stripRedraws++;
			return redraw();
		};
	});
	await page.locator('button[data-anyink-tool="newRectangle"]').click();
	await settle(300);
	await page.evaluate(() => (window.__stripRedraws = 0));
	await drawRectangle('button[data-anyink-tool="newRectangle"]');
	await settle(800);
	const stripRedraws = await page.evaluate(() => window.__stripRedraws);
	const sheetAfter = await sheet();
	assert.equal(sheetBefore, 'strip.lettersNotMade', 'the empty sheet said so before');
	assert.ok(stripRedraws > 0, 'the strip redrew after the rectangle');
	assert.equal(sheetAfter, '', 'the strip shows the letter, no sentence');
	const shapesBefore = (await state()).shapes;
	await page.locator('[data-anyink-strip="guideLines"] input').click();
	const focused = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.type}`);
	await tap('Control+z');
	await settle(300);
	const shapesAfter = (await state()).shapes;
	assert.equal(focused, 'INPUT:checkbox');
	assert.equal(shapesAfter, shapesBefore - 1, `Ctrl+Z after the Guide lines toggle (${shapesBefore} -> ${shapesAfter})`);
	await tap('r');
	assert.equal((await state()).tool, 'newRectangle', 'R after the toggle');
	await shot('D-3-all-tools-after-toggle');
	pass(`All tools: the strip redrew after a rectangle (${stripRedraws} redraws; "${sheetBefore}" -> no sentence); with the Guide lines toggle focused (${focused}) Ctrl+Z undid it (${shapesBefore} -> ${shapesAfter} shapes) and R picked the Rectangle`);

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass('no page errors');
	numbers.screenshots = shotList;
	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, 2));
	console.log(`Screenshots (${shotList.length}) and numbers.json in ${shots}`);
} finally {
	await context.close();
	await after.server.close();
	if (before) await before.server.close();
	// the junction first, on its own, so nothing ever reaches this repo's node_modules
	try {
		if (existsSync(junction) && lstatSync(junction).isSymbolicLink()) unlinkSync(junction);
	} catch (error) {
		console.warn(`left ${scratch} in place: ${error.message}`);
	}
	if (!existsSync(junction)) await rm(scratch, { recursive: true, force: true }).catch(() => {});
}
