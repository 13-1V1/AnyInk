// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';

// Own server, own disposable context. Never attach to an existing browser or server.
const server = await createServer({
	configFile: 'tests/vite.config.js',
	server: { host: '127.0.0.1', port: 0, open: false, hmr: false, watch: null },
});
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/tests/autosave.html`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-pwa-storage-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.PWA_BROWSER || 'chrome',
	headless: true,
});
const page = await context.newPage();
let pagehideObserved = false;
await page.exposeFunction('reportPagehide', () => {
	pagehideObserved = true;
});
await page.addInitScript(() => addEventListener('pagehide', () => window.reportPagehide()));
try {
	await page.goto(url);
	await page.getByRole('button', { name: 'Run native storage checks', exact: true }).click();
	await page.waitForFunction(
		() => /READY FOR RELOAD|FAIL/.test(document.querySelector('#result').textContent),
		null,
		{ timeout: 30000 }
	);
	const before = await page.locator('#result').textContent();
	assert(!before.includes('FAIL'), before);
	assert(before.includes('READY FOR RELOAD'), before);
	console.log(before);
	const cdp = await context.newCDPSession(page);
	const crashed = page.waitForEvent('crash', { timeout: 15000 });
	// Page.crash terminates only this newly created test renderer. No graceful close.
	void cdp.send('Page.crash').catch(() => {});
	await crashed;
	assert.equal(pagehideObserved, false, 'renderer crashed without a pagehide callback');
	console.log('PASS isolated renderer killed with CDP Page.crash; no pagehide event');
	// Playwright's reload wrapper rejects an already-crashed page; reload the same
	// target directly, as Chrome's Reload button does, and await its new document.
	await cdp.send('Page.reload');
	// Chrome has a fresh renderer, but Playwright retains the target's crashed flag.
	// CDP observes the new document directly without touching any other target.
	const evaluate = async (expression) => {
		const result = await cdp.send('Runtime.evaluate', {
			expression,
			awaitPromise: true,
			returnByValue: true,
		});
		if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
		return result.result.value;
	};
	let loaded = false;
	for (let attempt = 0; attempt < 150; attempt++) {
		try {
			loaded = await evaluate("typeof document.querySelector('#recover')?.onclick === 'function'");
		} catch {
			/* document still starting */
		}
		if (loaded) break;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	assert(loaded, 'same crashed target reloaded');
	await evaluate("document.querySelector('#recover').onclick()");
	const after = await evaluate("document.querySelector('#result').textContent");
	assert(!after.includes('FAIL'), after);
	assert(after.includes('PASS restored width 604'), after);
	assert(after.includes('PASS restored four undo entries'), after);
	console.log(after);
	console.log(
		'PASS actual IndexedDB recovery after renderer crash. Files exercised OPFS, not a native user-picked path.'
	);
} finally {
	await context.close();
	await server.close();
	assert(resolve(profile).startsWith(resolve(tmpdir()) + sep + 'anyink-pwa-storage-'));
	await rm(profile, { recursive: true, force: true });
}
