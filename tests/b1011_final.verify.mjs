// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize real-browser check (docs/UX-BEGINNER.md 4.0 rules 7, 9, 15; 4.2; 4.4; 7.2;
// 7.3; D-043), in the real app on a Vite dev server, Chrome with a throwaway profile, 1600 x 900,
// the feature flags as the app ships them, Simple by ?ui=simple:
//   A. small n, typed on the board, opens with the Brush; one stroke drawn 150 units under the
//      writing line: the Next line says it sinks with [Sit on the line] outlined (he may still be
//      drawing); V (Select): the same fix, green; pressed: the pen's line on the writing line, its
//      round end under it, as a Brush letter drawn to the line
//   B. Undo, the board, [Show me], Something else on small n: the line keeps to the board's letters
//      (the count, no button); n's tile opens small n with its fix back on the line
//   C. The backup in Chrome's IndexedDB through a save: Save keeps the live list's saved copies, so
//      the write after one more step sends one copy and the record
//   D. The notebook photo dropped on the board: its crossed-out Q is skipped as junk as it comes
//      in; the alphabet prefill after T U leaves the touching VW empty and, with VW skipped,
//      X's field empty (it filled in "V")
// Usage: node tests/b1011_final.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b1011-final'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b1011-final-'));

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] }, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: process.env.B1011_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);

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
const shot = async (name) => {
	await page.screenshot({ path: resolve(shots, `${name}.png`) });
	shotList.push(`${name}.png`);
};
const waitUntil = async (check, what, timeout = 20000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
const line = () =>
	page.evaluate(() => {
		const coach = document.querySelector('anyink-coach');
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const button = coach?.querySelector('.anyink-coach__button');
		const other = coach?.querySelector('.anyink-coach__else');
		return {
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			button: button?.checkVisibility() ? text(button) : null,
			green: !!button?.checkVisibility() && button.classList.contains('anyink-primary'),
			somethingElse: !!other?.checkVisibility(),
		};
	});
const editorFacts = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return { page: editor.nav.page, item: editor.selectedItemID, tool: editor.selectedTool };
	});
const measuresOf = (char) =>
	page.evaluate(async (c) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { measureLetter } = await import('/anyink/checks/checks.js');
		const id = `glyph-0x${c.codePointAt(0).toString(16).toUpperCase()}`;
		const m = measureLetter(editor.project.getItem(id), editor.project.settings.font);
		return { penBottom: m.penBottom, inkBottom: m.ink.yMin, lineAt: m.lineAt };
	}, char);
const toBoard = async () => {
	await page.evaluate(async () => {
		const { goToLetters } = await import('/anyink/topbar/letters_page.js');
		goToLetters((await import('/app/main.js')).getCurrentProjectEditor());
	});
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await settle(500);
};

try {
	page = await freshPage('simple');
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page.mouse.move(5, 895);
	await settle(600);

	// ------------------------------------------------------------------
	// A. The Brush on small n: the fix outlined while drawing
	// ------------------------------------------------------------------
	await page.keyboard.press('n');
	await waitUntil(async () => (await editorFacts()).item === 'glyph-0x6E', 'small n opens');
	await settle(600);
	assert.equal((await editorFacts()).tool, 'nib', 'the letter opens with the Brush');
	const box = await page.evaluate(() => {
		const host = document.querySelector('edit-canvas');
		const canvas = host?.shadowRoot?.querySelector('canvas');
		const r = (canvas || host).getBoundingClientRect();
		return { x: r.left, y: r.top };
	});
	const view = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return { ...editor.view, x: editor.project.settings.font.xHeight };
	});
	const at = (x, y) => [box.x + view.dx + x * view.dz, box.y + view.dy - y * view.dz];
	const [sx, sy] = at(250, view.x);
	const [, ey] = at(250, -150);
	await page.mouse.move(sx, sy);
	await page.mouse.down();
	for (let i = 1; i <= 30; i++) await page.mouse.move(sx, sy + ((ey - sy) * i) / 30);
	for (let i = 0; i < 8; i++) {
		await page.mouse.move(sx + (i % 2), ey);
		await page.waitForTimeout(25);
	}
	await page.mouse.up();
	await settle(900);
	let l = await line();
	assert.match(l.sentence || '', /small n sinks below the writing line/);
	assert.equal(l.button, 'Sit on the line');
	assert.equal(l.green, false, 'outlined while the Brush is the tool');
	assert.equal((await editorFacts()).tool, 'nib');
	await shot('A1-brush-stroke-sinks-fix-outlined');
	pass(`A1 one Brush stroke 150 under the line: "${l.sentence}" [${l.button}] outlined`);

	await page.keyboard.press('v');
	await settle(500);
	l = await line();
	assert.equal(l.button, 'Sit on the line');
	assert.equal(l.green, true, 'green once Select is the tool');
	await shot('A2-select-fix-green');
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(700);
	const seated = await measuresOf('n');
	assert.ok(Math.abs(seated.penBottom) <= 2, `pen line on the writing line (${seated.penBottom})`);
	assert.ok(seated.inkBottom < -20, `the round end hangs under it (${seated.inkBottom})`);
	l = await line();
	assert.doesNotMatch(l.sentence || '', /small n sinks/);
	await shot('A3-sat-on-the-line-pen-line');
	pass(
		`A2/A3 V: [Sit on the line] green; pressed: pen line at ${seated.penBottom.toFixed(1)}, ink bottom ${seated.inkBottom.toFixed(1)} (half the nib under, as drawn)`
	);

	// ------------------------------------------------------------------
	// B. Something else on the board, then the tile
	// ------------------------------------------------------------------
	await page.keyboard.press('Control+z');
	await settle(600);
	await toBoard();
	l = await line();
	assert.match(l.sentence || '', /1 letter needs a look/);
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(600);
	l = await line();
	assert.match(l.sentence || '', /small n sinks/);
	assert.equal(l.green, true);
	await page.locator('anyink-coach .anyink-coach__else').click();
	await settle(500);
	l = await line();
	assert.equal(l.sentence, '1 letter needs a look.');
	assert.equal(l.button, null, 'no green way on to a letter not on screen');
	await shot('B1-something-else-on-the-filtered-board');
	await page.locator('[data-anyink-board] glyph-tile[data-anyink-char="n"]').click();
	await waitUntil(async () => (await editorFacts()).page === 'Characters', 'small n opens');
	await settle(700);
	l = await line();
	assert.match(l.sentence || '', /small n sinks/);
	assert.equal(l.button, 'Sit on the line');
	await shot('B2-tile-opened-fix-back');
	pass(`B1/B2 Something else on the filtered board: "1 letter needs a look." with no button; n's tile: "${l.sentence}" [${l.button}]${l.green ? ' green' : ''}`);

	// ------------------------------------------------------------------
	// C. The backup through a save
	// ------------------------------------------------------------------
	const backup = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const recovery = await import('/anyink/recovery/recovery.js');
		const { recEntries } = await import('/anyink/storage/kv.js');
		const states = async () => (await recEntries()).filter(([key]) => key.startsWith('state:'));
		const sessions = async () =>
			(await recEntries()).filter(([key]) => key.startsWith('session:'));
		const step = (i) => {
			const shape = editor.project.getItem('glyph-0x6E').shapes[0];
			shape.pathPoints[0].p.x += 1 + (i % 2);
			editor.history.addState(`moved a point ${i}`);
		};
		for (let i = 0; i < 40; i++) step(i);
		await recovery.snapshotNow('manual');
		const before = (await states()).length;
		await recovery.markClean(editor);
		const afterSave = { states: (await states()).length, sessions: (await sessions()).length };
		step(41);
		const t0 = performance.now();
		await recovery.snapshotNow('manual');
		const took = performance.now() - t0;
		return {
			before,
			afterSave,
			afterStep: { states: (await states()).length, sessions: (await sessions()).length },
			took,
		};
	});
	assert.ok(backup.before >= 40, JSON.stringify(backup));
	assert.equal(backup.afterSave.sessions, 0);
	assert.equal(backup.afterSave.states, backup.before, 'Save keeps the copies');
	assert.equal(backup.afterStep.states, backup.before + 1, 'one new copy');
	assert.ok(backup.took < 100, `${backup.took} ms`);
	pass(
		`C backup: ${backup.before} saved copies; Save deleted the record and kept them; the next write added ${backup.afterStep.states - backup.before} copy in ${backup.took.toFixed(1)} ms (D-026: 100 ms)`
	);

	// ------------------------------------------------------------------
	// D. The notebook photo: the crossed-out Q, the prefill after a skip
	// ------------------------------------------------------------------
	await toBoard();
	const fixture = '/anyink/photo/tests/fixtures/notebook-alphabet-phone';
	await page.evaluate(async (url) => {
		const blob = await (await fetch(`${url}.webp`)).blob();
		const file = new File([blob], 'notebook.webp', { type: 'image/webp' });
		const transfer = new DataTransfer();
		transfer.items.add(file);
		const target = document.querySelector('[data-anyink-board]');
		target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
		target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
	}, fixture);
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 60000 });
	await settle(1500);
	await shot('D1-notebook-dialog');
	const photo = await page.evaluate(async (url) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const registry = await import('/anyink/photo/photo_registry.js');
		const key = await (await fetch(`${url}.json`)).json();
		const [asset] = registry.listPhotos(editor.project).map((r) => r.asset ?? r);
		const record = registry.getPhoto(editor.project, typeof asset === 'string' ? asset : asset.asset);
		const k = record.width / key.width;
		const holder = ([x, y]) =>
			record.parts.find(
				(p) => !p.drawn && x * k >= p.left && x * k < p.right && y * k >= p.top && y * k < p.bottom
			);
		const crossed = holder(key.crossedOut.center);
		const partOf = (char) => holder(key.letters.find((l) => l.char === char).center);
		const copy = () => JSON.parse(JSON.stringify(record));
		const walk = (skipVW) => {
			const r = copy();
			registry.usePart(r, partOf('T').id, { char: 'T', itemId: 'glyph-0x54' });
			registry.usePart(r, partOf('U').id, { char: 'U', itemId: 'glyph-0x55' });
			const onVW = registry.prefillChar(r, partOf('V').id);
			if (skipVW) registry.skipPart(r, partOf('V').id);
			return { onVW, onX: registry.prefillChar(r, partOf('X').id) };
		};
		return {
			crossed: crossed?.id || null,
			junk: record.junk || [],
			skipped: record.skipped,
			guess: registry.guessPart(record),
			sameVW: partOf('V')?.id === partOf('W')?.id,
			skipped1: walk(true),
		};
	}, fixture);
	assert.ok(photo.crossed, 'the crossed-out Q is a part');
	assert.ok(photo.junk.includes(photo.crossed), JSON.stringify(photo));
	assert.ok(photo.skipped.includes(photo.crossed));
	assert.notEqual(photo.guess, photo.crossed);
	assert.equal(photo.sameVW, true, 'V and W touch: one part');
	assert.equal(photo.skipped1.onVW, '', 'never on a part that may be two letters');
	assert.equal(photo.skipped1.onX, '', 'no "V" on the X after VW is skipped');
	pass(
		`D the notebook photo: the crossed-out Q (${photo.crossed}) skipped as junk as it came in (never the green box: ${photo.guess}); after T U the touching VW gets no guess, and with VW skipped the X gets nothing (it got "V")`
	);

	assert.deepEqual(errors, [], JSON.stringify(errors));
	pass('no page or console errors');
	console.log(`screenshots (${shotList.length}) in ${shots}:`);
	shotList.forEach((name) => console.log(`  ${name}`));
} catch (error) {
	console.error('FAIL', error);
	try {
		await shot('FAIL');
	} catch {
		// nothing to show
	}
	process.exitCode = 1;
} finally {
	await browser.close();
	await server.close();
}
