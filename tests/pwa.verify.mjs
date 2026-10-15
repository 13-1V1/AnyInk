// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Disposable browser profile and localhost server; no installed app/user profile changes.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
// B4: the update notice's button is a key of src/anyink/words (sets/screens.js has no imports)
import SCREENS from '../src/anyink/words/sets/screens.js';

const root = resolve('dist');
let version = 1;
const requests = [];
const mime = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.webmanifest': 'application/manifest+json',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
	try {
		const pathname = new URL(req.url, 'http://localhost').pathname;
		requests.push(pathname);
		if (!pathname.startsWith('/AnyInk/')) {
			res.writeHead(404);
			res.end();
			return;
		}
		const relative = pathname.slice('/AnyInk/'.length) || 'index.html';
		const file = resolve(root, relative);
		if (!file.startsWith(root + sep)) throw new Error('Outside build');
		let bytes = await readFile(file);
		if (version === 2 && relative === 'sw.js') {
			bytes = Buffer.from(
				bytes
					.toString()
					.replace(
						/"revision":"[^"]+","url":"index.html"/,
						'"revision":"pwa-verification-build-2","url":"index.html"'
					) + '\n// Verification build 2\n'
			);
		}
		if (version === 2 && relative === 'index.html')
			bytes = Buffer.from(bytes.toString().replace('<html ', '<html data-pwa-verification="2" '));
		res.writeHead(200, {
			'Content-Type': mime[extname(file)] || 'application/octet-stream',
			'Cache-Control': 'no-store',
		});
		res.end(bytes);
	} catch {
		res.writeHead(404);
		res.end();
	}
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-pwa-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.PWA_BROWSER || 'chrome',
	headless: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());
const poll = async (predicate) => {
	for (let i = 0; i < 150; i++) {
		try {
			if (await predicate()) return;
		} catch (error) {
			// The explicit update is expected to replace the document between polls.
			if (!/Execution context was destroyed|Cannot find context/.test(error.message)) throw error;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error('Timed out waiting for browser state');
};
try {
	await page.goto(`${origin}/AnyInk/`);
	await page.waitForSelector('#input__new-project-name', { state: 'attached' });
	await page.evaluate(() => navigator.serviceWorker.ready);
	assert.equal(await page.locator('link[rel="manifest"]').count(), 1);
	const manifest = await (await fetch(`${origin}/AnyInk/manifest.webmanifest`)).json();
	assert.equal(manifest.display, 'standalone');
	assert.equal(manifest.start_url, './');
	for (const icon of manifest.icons) {
		const metadata = await sharp(await readFile(resolve(root, icon.src))).metadata();
		assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
	}
	const cdp = await context.newCDPSession(page);
	await cdp.send('Page.enable');
	const installability = await cdp.send('Page.getInstallabilityErrors');
	assert.deepEqual(installability.installabilityErrors, []);
	console.log(`PASS manifest, PNG dimensions, ${process.env.PWA_BROWSER || 'chrome'} installability criteria`);
	await page.reload();
	await poll(() => page.evaluate(() => !!navigator.serviceWorker.controller));
	await context.setOffline(true);
	await page.reload();
	await page.waitForSelector('#input__new-project-name', { state: 'attached' });
	const cached = await page.evaluate(async () => {
		const names = await caches.keys();
		return (
			await Promise.all(
				names.map(async (name) =>
					(await (await caches.open(name)).keys()).map((request) => request.url)
				)
			)
		).flat();
	});
	assert(cached.some((url) => url.includes('potrace.worker')));
	assert(cached.some((url) => url.includes('.wasm')));
	assert(cached.some((url) => url.includes('.woff2')));
	assert(!cached.some((url) => url.includes('/tests/')));
	console.log('PASS offline app boot; worker, WASM, fonts and app shell precached');
	await context.setOffline(false);
	await page.evaluate(() => {
		window.pwaSentinel = 'keep-open';
	});
	version = 2;
	await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
	await poll(() =>
		page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)
	);
	const updateButton = page.getByRole('button', { name: SCREENS['notice.reload'].text, exact: true });
	await updateButton.waitFor();
	assert.equal(await page.evaluate(() => window.pwaSentinel), 'keep-open');
	console.log('PASS update waits for explicit consent without reloading');
	const other = await context.newPage();
	await other.goto(`${origin}/AnyInk/`);
	await other.waitForSelector('#input__new-project-name', { state: 'attached' });
	await updateButton.click();
	await page
		.getByText('Close other ANY-INK tabs or windows before updating.', { exact: true })
		.waitFor();
	assert.equal(await page.evaluate(() => window.pwaSentinel), 'keep-open');
	await other.close();
	console.log('PASS activation blocked while another app window is open');
	await page.locator('#input__new-project-name').fill('PWA recovery gate fixture');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await page.evaluate(() => {
		window.pwaOriginalPut = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function (...args) {
			if (this.name === 'recovery')
				throw new DOMException('PWA test quota failure', 'QuotaExceededError');
			return window.pwaOriginalPut.apply(this, args);
		};
	});
	await updateButton.click();
	await page
		// B4 integration: the checkpoint's errors are words keys (pwa/checkpoint.js)
		.getByText(SCREENS['notice.backupNotEvery'].text, { exact: true })
		.waitFor();
	assert.equal(await page.evaluate(() => window.pwaSentinel), 'keep-open');
	assert(
		await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)
	);
	await page.evaluate(() => {
		IDBObjectStore.prototype.put = window.pwaOriginalPut;
	});
	console.log('PASS real recovery write failure blocks activation and reload with an open project');
	await updateButton.click();
	await poll(() => page.evaluate(() => document.documentElement.dataset.pwaVerification === '2'));
	await page.waitForSelector('#input__new-project-name', { state: 'attached' });
	assert.equal(await page.evaluate(() => window.pwaSentinel), undefined);
	await context.setOffline(true);
	await page.reload();
	await page.waitForSelector('#input__new-project-name', { state: 'attached' });
	assert.equal(await page.evaluate(() => document.documentElement.dataset.pwaVerification), '2');
	assert.deepEqual(errors, []);
	assert(!requests.some((path) => path.startsWith('/app/') || path.startsWith('/assets/')));
	console.log(
		'PASS explicit update loads build 2 and build 2 boots offline; no page errors or bad base paths'
	);
} finally {
	await context.close();
	await new Promise((resolve) => server.close(resolve));
	assert(resolve(profile).startsWith(resolve(tmpdir()) + sep + 'anyink-pwa-'));
	await rm(profile, { recursive: true, force: true });
}
