// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 mode core real-browser check (docs/UX-BEGINNER.md 6.1 to 6.3, 7.6, 4.11, section 10 B5), in
// Chrome with a throwaway profile:
//   1. tests/mode.html (a real editor on the sample font): All tools at launch shows today's
//      controls and no band; Simple shows today's Characters page minus what 6.2 hides, and
//      html[data-ui-mode] follows; More tools after Simple shows the purple band (real CSS:
//      tokens, contrast, sentence case, no banned word, an outlined button) and Back to simple
//      works; the landing rule on the real History: a gap changed in More tools, Simple's Undo
//      lands on Kerning, the band says so, Back to my letters returns; Simple's Redo lands there
//      again and the band says Redo did it (fix track); the key map in both modes with the Simple
//      toast words (the tooltip's key, Ctrl+R and B off, Ctrl+E the .otf); a flag preview adds
//      only its own control
//   2. tests/mode.html?ui=simple opens in Simple
//   3. the dev app: no ?ui is All tools with no band; ?ui=simple mirrors to html[data-ui-mode],
//      and on a real editor page turnOnMoreTools / backToSimple redraw the page through the real
//      Navigator.navigate (one 'anyink-page-change' each); the wiring draws the band under the
//      real top bar
// Usage: node tests/mode.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-mode'));
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
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-mode-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B5_BROWSER || 'chrome',
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
const attr = () => page.evaluate(() => document.documentElement.getAttribute('data-ui-mode'));
const shownIn = (area) =>
	page.$$eval(`li[data-area="${area}"][data-shown="true"]`, (items) =>
		items.map((li) => li.dataset.id)
	);

/** WCAG contrast of two computed rgb() colors */
const contrast = (a, b) => {
	const lum = (rgb) => {
		const [r, g, bl] = rgb
			.match(/\d+(\.\d+)?/g)
			.slice(0, 3)
			.map(Number)
			.map((v) => {
				const c = v / 255;
				return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

try {
	// ----------------------------------------------------------
	// 1. tests/mode.html
	// ----------------------------------------------------------
	await page.goto(`${pages.origin}/tests/mode.html`);
	await page.locator('body[data-ready="true"]').waitFor({ timeout: 20000 });
	assert.equal(await attr(), 'all');
	assert.equal(await page.locator('#bandSlot').getAttribute('data-band'), 'none');
	assert.equal(await page.locator('.anyink-band').count(), 0);
	const today = Number(await page.locator('#summary').getAttribute('data-today'));
	assert.equal(Number(await page.locator('#summary').getAttribute('data-shown')), today);
	assert.equal(await page.locator('.drift').count(), 0, 'every table id is in the code');
	numbers.allToolsShown = today;
	pass(
		`All tools at launch: all ${today} of today's controls show, html[data-ui-mode]="all", no band, no table drift`
	);
	await shot('1-all-tools-launch');

	await page.locator('#toSimple').click();
	assert.equal(await attr(), 'simple');
	const simple = {
		page: await shownIn('page'),
		chooser: await shownIn('chooser'),
		panel: await shownIn('panel'),
		tool: await shownIn('tool'),
		viewTool: await shownIn('viewTool'),
		menu: await shownIn('menu'),
		menuRow: await shownIn('menuRow'),
		strip: await shownIn('strip'),
	};
	assert.deepEqual(simple, {
		page: ['Overview', 'Characters', 'Help', 'About'],
		// fix track: Simple keeps the page chooser until B6's rail
		chooser: ['page', 'item'],
		panel: [],
		tool: ['resize', 'pathEdit', 'newPath', 'newRectangle', 'newOval'],
		viewTool: ['zoomOut', 'zoomSlider', 'zoomIn', 'displayMode', 'canvasTheme', 'zoomEm'],
		menu: ['file', 'help'],
		menuRow: [
			'file.heading-work-file',
			'file.save',
			'file.save-as',
			'file.open-font',
			'file.heading-font-file',
			'file.font-otf',
			// B4 + B5 finalize: until Use in Word (B14)
			'file.font-folder',
			'help.help-page',
			'help.about',
		],
		strip: ['title', 'text', 'samples', 'size', 'checkLine'],
	});
	numbers.simpleShown = Number(await page.locator('#summary').getAttribute('data-shown'));
	assert.equal(await page.locator('.anyink-band').count(), 0);
	pass(
		`Simple (no flag): ${numbers.simpleShown} of ${today} show: the Characters page minus 6.2's hidden controls; html[data-ui-mode]="simple"`
	);
	await shot('2-simple-stub');

	// More tools after Simple: the band
	await page.locator('#toAll').click();
	assert.equal(await attr(), 'all');
	const band = page.locator('.anyink-band');
	await band.waitFor();
	const look = await band.evaluate(async (node) => {
		const { scanDom, findUppercase } = await import('/src/anyink/words/banned.js');
		const style = getComputedStyle(node);
		const button = node.querySelector('button');
		const buttonStyle = getComputedStyle(button);
		return {
			kind: node.dataset.anyinkBand,
			text: node.querySelector('.anyink-band__text').textContent,
			button: button.textContent,
			primary: node.querySelectorAll('.anyink-primary').length,
			bg: style.backgroundColor,
			color: style.color,
			buttonBg: buttonStyle.backgroundColor,
			buttonBorder: buttonStyle.borderTopColor,
			hits: scanDom(node),
			upper: findUppercase(node),
			height: node.getBoundingClientRect().height,
			top: node.getBoundingClientRect().top,
			topBarBottom: document.querySelector('#topbar').getBoundingClientRect().bottom,
		};
	});
	assert.equal(look.kind, 'moreTools');
	assert.equal(
		look.text,
		"More tools: every Glyphr Studio tool is showing, with Glyphr Studio's own words."
	);
	assert.equal(look.button, 'Back to simple');
	assert.equal(look.primary, 0);
	assert.equal(look.bg, 'rgb(124, 58, 237)');
	assert.equal(look.buttonBg, 'rgba(0, 0, 0, 0)');
	assert.deepEqual(look.hits, []);
	assert.deepEqual(look.upper, []);
	assert.equal(Math.round(look.top), Math.round(look.topBarBottom));
	numbers.bandContrast = Number(contrast(look.color, look.bg).toFixed(2));
	assert.ok(numbers.bandContrast >= 4.5, `band text contrast ${numbers.bandContrast}`);
	numbers.bandHeight = look.height;
	pass(
		`More tools after Simple: purple band under the top bar (${look.bg}, text ${numbers.bandContrast}:1), "${look.text}" [${look.button}] outlined, no banned word, sentence case`
	);
	await shot('3-more-tools-band');

	await band.locator('button').click();
	assert.equal(await attr(), 'simple');
	assert.equal(await page.locator('.anyink-band').count(), 0);
	pass('[Back to simple]: Simple again, band gone');

	// The landing rule on the real History
	await page.locator('#gap').click();
	assert.equal(await attr(), 'all');
	const gapAfterChange = Number(
		(await page.locator('#landing').textContent()).match(/is (-?\d+)$/)[1]
	);
	assert.equal(await page.locator('#page').textContent(), 'Kerning');
	await page.locator('#undo').click();
	assert.equal(await page.locator('#page').textContent(), 'Kerning');
	assert.equal(await attr(), 'all');
	assert.equal(await page.locator('#visit').textContent(), 'Kerning (undo)');
	const landed = await page.locator('.anyink-band').evaluate((node) => ({
		kind: node.dataset.anyinkBand,
		text: node.querySelector('.anyink-band__text').textContent,
		button: node.querySelector('button').textContent,
	}));
	assert.deepEqual(landed, {
		kind: 'landed',
		text: 'Undo took you to one of the More tools pages.',
		button: 'Back to my letters',
	});
	const gapAfterUndo = Number(
		(await page.locator('#landing').textContent()).match(/is (-?\d+)$/)[1]
	);
	assert.equal(gapAfterUndo, gapAfterChange - 10);
	numbers.gap = { changed: gapAfterChange, undone: gapAfterUndo };
	pass(
		`landing: Simple's Undo of a More tools gap change lands on Kerning; More tools turns on for the visit; band "${landed.text}" [${landed.button}]`
	);
	await shot('4-landed-on-kerning');
	await page.locator('.anyink-band button').click();
	assert.equal(await attr(), 'simple');
	assert.equal(await page.locator('#page').textContent(), 'Characters');
	assert.equal(await page.locator('.anyink-band').count(), 0);
	pass('[Back to my letters]: Simple, on the letter view, band gone; the gap stays undone');
	await page.locator('#redo').click();
	assert.equal(await page.locator('#page').textContent(), 'Kerning');
	assert.equal(await page.locator('#visit').textContent(), 'Kerning (redo)');
	assert.equal(
		await page.locator('.anyink-band .anyink-band__text').textContent(),
		'Redo took you to one of the More tools pages.'
	);
	pass('Redo from Simple lands on Kerning again; the band says "Redo took you to one of the More tools pages."');
	await shot('4b-redo-landed');
	await page.locator('.anyink-band button').click();
	assert.equal(await attr(), 'simple');

	// Keys
	const pressIn = async (key) => {
		await page.locator('#keybox').focus();
		await page.keyboard.press(key);
		return {
			action: await page.locator('#keyResult').getAttribute('data-action'),
			result: JSON.parse(await page.locator('#keyResult').textContent()).result,
			toast: await page.locator('#keyToast').textContent(),
		};
	};
	const r = await pressIn('r');
	assert.equal(r.result.tool, 'newRectangle');
	assert.equal(r.toast, 'Toast: Switched to Rectangle (R)');
	assert.equal((await pressIn('p')).result.tool, 'newPath');
	assert.equal((await pressIn('e')).result.tool, 'pathEdit');
	assert.equal((await pressIn('u')).action, '');
	assert.equal((await pressIn('Control+g')).action, '');
	assert.equal((await pressIn('Control+e')).action, 'exportOtf');
	assert.equal((await pressIn('Control+r')).action, '');
	assert.equal((await pressIn('b')).action, '');
	const h = await pressIn('h');
	assert.equal(h.result.tool, 'newPath');
	assert.equal(h.toast, 'Toast: Switched to Point pen (P)');
	assert.equal(await page.locator('#keys tr[data-key="svgFontFile"]').count(), 0);
	assert.equal(await page.locator('#keys tr[data-key="round"]').count(), 0);
	pass(
		'keys in Simple: R "Switched to Rectangle (R)", H "Switched to Point pen (P)", P Point pen, E Edit points; U, B, Ctrl+R and Ctrl+G do nothing; Ctrl+E makes the .otf (Use in Word not landed)'
	);
	await page.locator('#toAll').click();
	assert.equal((await pressIn('u')).result.tool, 'pathAddPoint');
	assert.equal((await pressIn('Control+g')).action, 'exportSvgFont');
	const p2 = await pressIn('p');
	assert.equal(p2.result.tool, 'newPath');
	assert.equal(p2.toast, '');
	assert.equal(await page.locator('#keys tr[data-key="svgFontFile"]').count(), 1);
	pass(
		'keys in All tools: U Add a point, Ctrl+G SVG font file, P Point pen (the one map), no toast'
	);

	// A flag preview adds only its own control
	await page.locator('#toSimple').click();
	await page.locator('input[data-flag="letterView"]').check();
	assert.deepEqual(await shownIn('panel'), ['letterCard']);
	assert.deepEqual(await shownIn('chooser'), ['page']);
	await page.locator('input[data-flag="letterView"]').uncheck();
	assert.deepEqual(await shownIn('chooser'), ['page', 'item']);
	pass(
		'flag preview: letterView adds the letter card and takes the item chooser (Simple only); unticked, the stub is back'
	);

	// ----------------------------------------------------------
	// 2. ?ui=simple on the test page
	// ----------------------------------------------------------
	await page.goto(`${pages.origin}/tests/mode.html?ui=simple`);
	await page.locator('body[data-ready="true"]').waitFor({ timeout: 20000 });
	assert.equal(await attr(), 'simple');
	assert.equal(await page.locator('#used').textContent(), 'true');
	pass('tests/mode.html?ui=simple opens in Simple');

	// ----------------------------------------------------------
	// 3. The dev app
	// ----------------------------------------------------------
	await page.goto(`${app.origin}/`);
	await page.locator('#input__new-project-name').waitFor({ timeout: 30000 });
	assert.equal(await attr(), 'all');
	assert.equal(
		await page.evaluate(async () => (await import('/anyink/mode/band.js')).bandState()),
		null
	);
	pass('dev app, no ?ui: html[data-ui-mode]="all", no band (today\'s app)');

	await page.goto(`${app.origin}/?ui=simple`);
	await page.locator('#input__new-project-name').waitFor({ timeout: 30000 });
	assert.equal(await attr(), 'simple');
	await page.locator('#input__new-project-name').fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await page.waitForTimeout(400);
	const real = await page.evaluate(async () => {
		const { turnOnMoreTools, bandState } = await import('/anyink/mode/band.js');
		const { getMode } = await import('/anyink/mode/mode.js');
		let pageChanges = 0;
		window.addEventListener('anyink-page-change', () => pageChanges++);
		const before = document.querySelector('#app__top-bar');
		turnOnMoreTools();
		const after = {
			mode: getMode(),
			attr: document.documentElement.getAttribute('data-ui-mode'),
			band: bandState()?.kind,
			pageChanges,
			topBarRebuilt: document.querySelector('#app__top-bar') !== before,
			// B5 wiring: Navigator.navigate draws the band right under the real top bar
			drawnBand: document.querySelector('#app__top-bar + .anyink-band')?.dataset.anyinkBand,
			bands: document.querySelectorAll('.anyink-band').length,
		};
		return after;
	});
	assert.deepEqual(real, {
		mode: 'all',
		attr: 'all',
		band: 'moreTools',
		pageChanges: 1,
		topBarRebuilt: true,
		drawnBand: 'moreTools',
		bands: 1,
	});
	await page.waitForTimeout(300);
	const placed = await page.evaluate(() => {
		const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
		const band = rect('.anyink-band');
		return {
			bandTop: Math.round(band.top),
			bandHeight: Math.round(band.height),
			topBarBottom: Math.round(rect('#app__top-bar').bottom),
			pageTop: Math.round(rect('#app__main-content').top),
			pageBottom: Math.round(rect('#app__main-content').bottom),
			wrapperBottom: Math.round(rect('#app__wrapper').bottom),
		};
	});
	assert.equal(placed.bandTop, placed.topBarBottom);
	assert.ok(placed.bandHeight >= 30, `band height ${placed.bandHeight}`);
	assert.equal(placed.pageTop, placed.bandTop + placed.bandHeight);
	assert.ok(placed.pageBottom <= placed.wrapperBottom, 'the page still ends above the strip');
	numbers.devAppBand = placed;
	await shot('5-dev-app-more-tools-band');
	await page.locator('.anyink-band button').click();
	await page.waitForTimeout(300);
	assert.equal(await attr(), 'simple');
	assert.equal(await page.locator('.anyink-band').count(), 0);
	pass(
		'dev app ?ui=simple: html[data-ui-mode]="simple"; turnOnMoreTools redraws the real page once (one anyink-page-change) in All tools with the More tools band; its button brings Simple back'
	);
	await shot('6-dev-app-back-to-simple');

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass('no page errors');
	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, 2));
	console.log(`Screenshots and numbers.json in ${shots}`);
} finally {
	await context.close();
	await pages.server.close();
	await app.server.close();
	await rm(profile, { recursive: true, force: true });
}
