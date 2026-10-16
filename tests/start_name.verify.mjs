// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (acceptance T1, the start verifier): the start screen's name field in real Chrome, with no
// ?ui (Simple is the launch default). The field has the keyboard on load with "My Font" picked;
// a click into it, on its text or in the empty space after it, then typing "Brennan Hand" gives
// "Brennan Hand" (it gave "My FontBrennan Hand": Chrome put the caret after the click); a click
// inside a name he typed places the caret as usual.
// Usage: node tests/start_name.verify.mjs [screenshot folder]
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-start-name'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-start-name-'));
const server = await createServer({
	root: resolve(repo, 'src'),
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] }, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: process.env.START_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (text) => console.log(`PASS ${text}`);

async function freshField() {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	const page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto(`${origin}/`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await page.waitForTimeout(1500);
	return { context, page, field };
}

const read = (page) =>
	page.evaluate(() => {
		const el = document.querySelector('#input__new-project-name');
		return {
			mode: document.documentElement.dataset.uiMode,
			value: el.value,
			focused: document.activeElement === el,
			selection: [el.selectionStart, el.selectionEnd],
		};
	});

try {
	// 1. On load: Simple, the field has the keyboard, the suggestion picked
	{
		const { context, page } = await freshField();
		const s = await read(page);
		assert.equal(s.mode, 'simple', 'no ?ui opens in Simple (B16)');
		assert.equal(s.focused, true, 'the field has the keyboard on load');
		assert.deepEqual(s.selection, [0, s.value.length], `the suggestion "${s.value}" is picked`);
		pass(`no ?ui: Simple's start screen, the field has the keyboard with "${s.value}" picked`);
		await context.close();
	}
	// 2. A click on the text, on the empty right, a slow press: then typing replaces it
	for (const [label, where, delay] of [
		['on the text', 0.15, 0],
		['in the empty space after it', 0.85, 0],
		['a slow press on the text', 0.3, 150],
	]) {
		const { context, page, field } = await freshField();
		const box = await field.boundingBox();
		await page.mouse.click(box.x + box.width * where, box.y + box.height / 2, { delay });
		await page.keyboard.type('Brennan Hand');
		const s = await read(page);
		await page.screenshot({ path: resolve(shots, `click-${label.replace(/\W+/g, '-')}.png`) });
		assert.equal(s.value, 'Brennan Hand', `a click ${label}, then typing`);
		pass(`a click ${label} on the field that has the keyboard, then typing: "${s.value}"`);
		await context.close();
	}
	// 3. A click inside his own name places the caret
	{
		const { context, page, field } = await freshField();
		await page.keyboard.type('Brennan Hand');
		const box = await field.boundingBox();
		await page.mouse.click(box.x + 14, box.y + box.height / 2);
		await page.keyboard.type('X');
		const s = await read(page);
		assert.notEqual(s.value, 'X', 'his own name is never picked whole');
		assert.ok(s.value.includes('X') && s.value.length === 'Brennan Hand'.length + 1, s.value);
		pass(`a click inside his own name places the caret: "${s.value}"`);
		await context.close();
	}
	assert.deepEqual(errors, [], 'page errors');
	pass('no page errors');
} finally {
	await browser.close();
	await server.close();
}
