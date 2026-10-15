// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 display-points track, real-browser check (docs/UX-BEGINNER.md 2.2 to 2.4, 4.0, 4.1, 4.11,
// section 10 B4). In Chrome with a throwaway profile, on a Vite dev server over src/, in All tools
// (the launch default) and in Simple (?ui=simple), the display points both modes share say the
// house words, with real CSS and a real canvas:
//   1. the edit canvas: the five guide lines and the two edges labeled in house words; pointing at
//      the small-letter line, the tail line and the left edge shows "small-letter line N",
//      "tail line N" (never negative) and "left space N" (B4 + B5 fix pass: the edge's one label);
//      no string drawn says a banned word
//   2. the File menu: "Make a font file (.otf)" and the rest, file names and types as quotes
//   3. the preview strip: "Preview" in sentence case, "Type anything", "Samples", "Guide lines";
//      the Samples menu ("small a with its neighbors", "26 letters")
//   4. the save status, and the app notices: offline, install, a new version
// Every place is scanned with banned.js in the page (scanDom, findUppercase, scanTexts).
// Usage: node tests/screens.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { toOverview } from './verify_standins.mjs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-screens'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const words = await server.ssrLoadModule('/anyink/words/words.js');
const label = (key) => words.labelCase(words.word(key));

const profile = await mkdtemp(resolve(tmpdir(), 'anyink-screens-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B4_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const numbers = {};

// Every string drawn on any canvas, recorded before the app makes its first context
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

/** Moves the pointer onto a font-unit point of the edit canvas, in a few steps. */
async function pointAt(page, x, y) {
	const at = await page.evaluate(
		async ({ x, y }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const host = document.querySelector('edit-canvas');
			const canvas = (host.shadowRoot || host).querySelector('canvas');
			const rect = canvas.getBoundingClientRect();
			const { dx, dy, dz } = editor.view;
			return { x: rect.left + dx + x * dz, y: rect.top + dy - y * dz };
		},
		{ x, y }
	);
	await page.mouse.move(at.x + 30, at.y - 30);
	await page.mouse.move(at.x, at.y, { steps: 5 });
	await page.waitForTimeout(250);
}

async function checkMode(mode) {
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(`${mode}: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${mode} console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	const shot = (name) => page.screenshot({ path: resolve(shots, `b4s-${mode}-${name}.png`) });
	const result = {};

	await page.goto(`${origin}/${mode === 'simple' ? '?ui=simple' : ''}`);
	await page.locator('#input__new-project-name').fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	assert.equal(
		await page.evaluate(async () => (await import('/anyink/mode/mode.js')).getMode()),
		mode
	);
	// B5: Simple has no page chooser (verify_standins.mjs)
	await toOverview(page);
	await page.locator('glyph-tile[displayed-item-id="glyph-0x61"]').click();
	await page.waitForTimeout(600);

	// ----------------------------------------------------------
	// 1. The edit canvas
	// ----------------------------------------------------------
	const font = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.project.settings.app.guides.systemShowLabels = true;
		// A new letter is 0 wide and has no right edge yet; give it one (a throwaway font)
		editor.selectedItem.advanceWidth = 600;
		// B4 + B5 fix pass: and a shape, since Simple locks the edges of a letter with none (the fix
		// track's guides_layer.js), so pointing at its edge shows the readout in both modes
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape({
			name: 'Square',
			pathPoints: [corner(100, 0), corner(500, 0), corner(500, 400), corner(100, 400)],
		});
		window.__canvasTexts.length = 0;
		document.querySelector('edit-canvas').redraw('b4 screens check');
		await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
		const { xHeight, descent } = editor.project.settings.font;
		return { xHeight, descent, width: editor.selectedItem.advanceWidth };
	});
	await shot('1-canvas-labels');
	const labels = await page.evaluate(() => [...new Set(window.__canvasTexts)]);
	const expectedLabels = [
		'line.ascent',
		'line.capHeight',
		'line.xHeight',
		'line.baseline',
		'line.descent',
		'canvas.leftEdge',
		'canvas.rightEdge',
	].map(label);
	expectedLabels.forEach((name) =>
		assert.ok(labels.includes(name), `canvas label "${name}" in ${JSON.stringify(labels)}`)
	);

	await pointAt(page, 60, font.xHeight);
	await shot('2-small-letter-line-readout');
	await pointAt(page, 60, font.descent);
	await pointAt(page, 0, font.xHeight / 2);
	await shot('3-left-edge');
	const drawn = await page.evaluate(() => [...new Set(window.__canvasTexts)]);
	const xReadout = drawn.find((t) => /^small-letter line \d+$/.test(t));
	const tailReadout = drawn.find((t) => /^tail line -?\d+$/.test(t));
	// B4 + B5 fix pass (D-035): a pointed-at edge has one label, the readout by the pointer
	const leftSpace = drawn.find((t) => /^left space -?[\d.]+$/.test(t));
	assert.equal(
		drawn.find((t) => /^Left space/.test(t)),
		undefined,
		`no second label: ${JSON.stringify(drawn)}`
	);
	if (mode === 'simple') {
		// B5 (7.6): Simple locks the horizontal lines, so pointing at one shows no readout
		assert.equal(xReadout, undefined, `a locked line has no readout: ${JSON.stringify(drawn)}`);
		assert.equal(tailReadout, undefined, `a locked line has no readout: ${JSON.stringify(drawn)}`);
	} else {
		assert.ok(xReadout, `the small-letter line readout: ${JSON.stringify(drawn)}`);
		assert.equal(
			tailReadout,
			`tail line ${Math.abs(font.descent)}`,
			'the tail line is never negative'
		);
	}
	assert.ok(leftSpace, `the left edge says "left space N": ${JSON.stringify(drawn)}`);
	const canvasHits = await page.evaluate(async () => {
		const { scanTexts, formatHit } = await import('/anyink/words/banned.js');
		return scanTexts(window.__canvasTexts, 'canvas').map(formatHit);
	});
	assert.deepEqual(canvasHits, [], 'no banned word drawn on the canvas');
	result.canvas = {
		labels: expectedLabels,
		readouts: [xReadout, tailReadout, leftSpace].filter(Boolean),
	};
	pass(
		`${mode}: canvas labels ${JSON.stringify(expectedLabels)}; readouts ${JSON.stringify(
			result.canvas.readouts
		)}; 0 banned words in ${drawn.length} strings`
	);

	// ----------------------------------------------------------
	// 2. The File menu
	// ----------------------------------------------------------
	await page.mouse.move(800, 20);
	await page.locator('.menu-entry-point', { hasText: 'File' }).click();
	await page.locator('#context-menu').waitFor();
	await page.waitForTimeout(200);
	await shot('4-file-menu');
	const menu = await page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('#context-menu');
		return {
			rows: [...root.querySelectorAll('[data-anyink-row]')].map(
				(r) => `${r.dataset.anyinkRow}: ${r.textContent}`
			),
			quotes: [...root.querySelectorAll('.anyink-quote')].map((q) => q.textContent),
			hits: [...scanDom(root), ...findUppercase(root)].map(formatHit),
		};
	});
	assert.deepEqual(menu.hits, [], 'the File menu says no banned word');
	assert.ok(menu.rows.includes('font-otf: Make a font file (.otf)'), JSON.stringify(menu.rows));
	assert.ok(menu.quotes.includes('BrennanHand-Regular.otf'), JSON.stringify(menu.quotes));
	await page.keyboard.press('Escape');
	await page.mouse.click(1200, 450);
	result.fileMenu = menu.rows;
	pass(
		`${mode}: File menu ${JSON.stringify(menu.rows)}; quotes ${JSON.stringify(menu.quotes)}; 0 hits`
	);

	// ----------------------------------------------------------
	// 3. The preview strip and its Samples menu
	// ----------------------------------------------------------
	const strip = await page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('preview-strip');
		const eyebrow = root.querySelector('.preview-strip__eyebrow');
		const text = root.querySelector('.preview-strip__text');
		return {
			eyebrow: eyebrow.textContent,
			eyebrowShown: eyebrow.innerText,
			transform: getComputedStyle(eyebrow).textTransform,
			placeholder: text.placeholder,
			samples: root.querySelector('.preview-strip__presets').textContent,
			toggles: [...root.querySelectorAll('.preview-strip__toggle')].map((t) => t.textContent),
			// B4 + B5 integration (6.2 Strip): Simple hides Real font and Guide lines
			togglesShown: [...root.querySelectorAll('.preview-strip__toggle')]
				.filter((t) => t.checkVisibility())
				.map((t) => t.textContent),
			hits: [...scanDom(root), ...findUppercase(root)].map(formatHit),
		};
	});
	assert.deepEqual(strip.hits, [], 'the strip says no banned word and nothing in capitals');
	assert.equal(strip.eyebrowShown, 'Preview', 'shown in sentence case');
	assert.equal(strip.transform, 'none');
	assert.deepEqual(strip.toggles, ['Real font', 'Guide lines']);
	assert.deepEqual(strip.togglesShown, mode === 'simple' ? [] : ['Real font', 'Guide lines']);
	assert.equal(strip.placeholder, 'Type anything');
	await page
		.locator('preview-strip')
		.screenshot({ path: resolve(shots, `b4s-${mode}-5-strip.png`) });
	await page.locator('.preview-strip__presets').click();
	await page.locator('#context-menu').waitFor();
	await page.waitForTimeout(200);
	await shot('6-samples-menu');
	const samples = await page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('#context-menu');
		return {
			first: root.querySelector('.context-menu-row .row-name')?.textContent,
			notes: [...root.querySelectorAll('.row-notes span')]
				.map((n) => n.textContent)
				.filter(Boolean),
			hits: [...scanDom(root), ...findUppercase(root)].map(formatHit),
		};
	});
	assert.deepEqual(samples.hits, []);
	assert.equal(samples.first, 'small a with its neighbors');
	assert.ok(samples.notes.includes('26 letters'), JSON.stringify(samples.notes));
	await page.keyboard.press('Escape');
	await page.mouse.click(1200, 450);
	result.strip = { ...strip, samplesFirst: samples.first, samplesNotes: samples.notes };
	pass(
		`${mode}: strip "${strip.eyebrowShown}" (text-transform ${strip.transform}), ${JSON.stringify(
			strip.toggles
		)}, "${strip.samples}"; Samples menu "${samples.first}", ${JSON.stringify(
			samples.notes
		)}; 0 hits`
	);

	// ----------------------------------------------------------
	// 4. The save status and the app notices
	// ----------------------------------------------------------
	const notices = await page.evaluate(async () => {
		const { scanDom, scanTexts, findUppercase, formatHit } = await import(
			'/anyink/words/banned.js'
		);
		const register = await import('/anyink/pwa/register.js');
		const queue = await import('/anyink/pwa/notices.js');
		const status = document.querySelector('anyink-save-status')?.textContent || '';
		const shown = [];
		const hits = [...scanTexts([status], 'save status').map(formatHit)];
		const show = async (make) => {
			queue.resetNotices();
			register.resetLaunch();
			document.querySelectorAll('#anyink-pwa-notices').forEach((n) => n.remove());
			make();
			await new Promise((done) => requestAnimationFrame(done));
			const panel = document.querySelector('.anyink-pwa-notice');
			shown.push(panel.innerText.replace(/\s+/g, ' ').trim());
			hits.push(...[...scanDom(panel), ...findUppercase(panel)].map(formatHit));
		};
		localStorage.clear(); // the offline notice shows once ever; the first mode's run said it
		(await import('/anyink/prefs/prefs.js')).resetPrefsCache();
		await show(() => register.announceOfflineReady());
		const install = new Event('beforeinstallprompt', { cancelable: true });
		install.prompt = async () => {};
		install.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
		await show(() => register.offerInstall(install));
		await show(() => register.showAppNotice(register.makeUpdateNotice(async () => {})));
		return { status, shown, hits };
	});
	await shot('7-update-notice');
	assert.deepEqual(notices.hits, []);
	// B4 + B5 fix pass (4.11): Simple says one of four states, never the backup copy
	if (mode === 'simple') {
		assert.ok(
			['Saved', 'Saving...', 'Not saved yet', "Couldn't save"].includes(notices.status),
			notices.status
		);
	} else {
		assert.ok(
			['Not saved yet', 'Saved'].some((s) => notices.status.startsWith(s)) ||
				/Backup copy|No backup copy/.test(notices.status),
			notices.status
		);
	}
	assert.ok(notices.shown[0].startsWith('ANY-INK works offline now.'), notices.shown[0]);
	assert.ok(
		notices.shown[2].startsWith('A new version of ANY-INK is ready. Your work is kept.'),
		notices.shown[2]
	);
	await page.evaluate(async () => (await import('/anyink/pwa/notices.js')).resetNotices());
	result.saveStatus = notices.status;
	result.notices = notices.shown;
	pass(
		`${mode}: save status "${notices.status}"; notices ${JSON.stringify(notices.shown)}; 0 hits`
	);

	await page.close();
	return result;
}

try {
	numbers.all = await checkMode('all');
	numbers.simple = await checkMode('simple');
	// B5 (6.2 Menus): Simple's File menu has Save, Save as... and the .otf font file, each row in
	// the same words as All tools' (B4 + B5 fix pass: a row only Simple has, like the mode track's
	// "Open a saved font...", is left out of the comparison)
	const id = (row) => row.split(':')[0];
	const allIds = numbers.all.fileMenu.map(id);
	assert.deepEqual(
		numbers.simple.fileMenu.filter((row) => allIds.includes(id(row))),
		// B4 + B5 finalize: the folder row stays in Simple until Use in Word (B14)
		numbers.all.fileMenu.filter((row) => /^(save|save-as|font-otf|font-folder): /.test(row)),
		"Simple's File rows are All tools' rows, in the same words"
	);
	assert.deepEqual(numbers.all.canvas.labels, numbers.simple.canvas.labels);
	pass('both modes say the same house words at every shared display point');
	assert.deepEqual(errors, [], 'no page errors');
	await writeFile(resolve(shots, 'b4s-numbers.json'), JSON.stringify(numbers, null, '\t'));
	console.log(`Screenshots and b4s-numbers.json in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
