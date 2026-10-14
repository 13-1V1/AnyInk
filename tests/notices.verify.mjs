// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 5 real-browser check of the app notices on a production build (the service worker only
// runs there). Serves dist/ on localhost with a throwaway Chrome profile. Checks: never more than
// one notice on screen, and at most one app notice per launch (the install offer and "ready to
// open offline" never come back to back); "ready to open offline" exactly once, on the first
// launch or, when the install offer took that launch, on the next; the install offer's "Not now"
// keeps it away on later launches (when Chrome offers install at all).
// B1 fix pass: a notice is one line in the top bar and covers nothing on any page: on the start
// page, Overview (letter tiles), the editor (zoom bar, preview strip) and Settings (buttons,
// links), it overlaps no button, link, field, letter tile, the menus or the save status.
// Usage: npm run build && node tests/notices.verify.mjs [screenshot folder] [built folder]
//   (defaults: the OS temp folder, dist/)
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(process.argv[3] || 'dist');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-notices'));
await mkdir(shots, { recursive: true });
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
		if (!pathname.startsWith('/AnyInk/')) throw new Error('Outside base');
		const file = resolve(root, pathname.slice('/AnyInk/'.length) || 'index.html');
		if (!file.startsWith(root + sep)) throw new Error('Outside build');
		const bytes = await readFile(file);
		res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
		res.end(bytes);
	} catch {
		res.writeHead(404);
		res.end();
	}
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-notices-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.NOTICES_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
	args: ['--bypass-app-banner-engagement-checks'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const OFFLINE = 'ANY-INK is ready to open offline.';
const INSTALL = 'Install ANY-INK to open it from your desktop.';
let seen = new Set();
let most = 0;
/** Samples the notices for a while; records every text seen and the most on screen at once. */
async function watch(ms) {
	const end = Date.now() + ms;
	let texts = [];
	while (Date.now() < end) {
		texts = await page.evaluate(() =>
			[...document.querySelectorAll('.anyink-pwa-notice p')].map((p) => p.textContent)
		);
		texts.forEach((text) => seen.add(text));
		most = Math.max(most, texts.length);
		await page.waitForTimeout(100);
	}
	return texts;
}
async function dismissAll(label) {
	for (let i = 0; i < 5; i++) {
		const texts = await watch(1500);
		if (!texts.length) return;
		await page.screenshot({ path: resolve(shots, `${label}-${i + 1}.png`) });
		const text = texts[0];
		const name = text === INSTALL ? 'Not now' : 'OK';
		await page.locator('.anyink-pwa-notice').getByRole('button', { name, exact: true }).click();
	}
}

/**
 * What the notice on screen covers: every visible button, link, field, letter tile, the menus,
 * the save status, the canvas zoom bar and the preview strip it overlaps.
 * @returns {Promise<{notice: Object | null, covered: String[]}>}
 */
const covered = () =>
	page.evaluate(() => {
		const panel = document.querySelector('.anyink-pwa-notice');
		if (!panel) return { notice: null, covered: [] };
		const n = panel.getBoundingClientRect();
		const overlaps = (r) =>
			r.width > 0 && r.height > 0 && n.left < r.right && r.left < n.right && n.top < r.bottom && r.top < n.bottom;
		const selectors = [
			'button',
			'a',
			'input',
			'select',
			'textarea',
			'fancy-button',
			'option-chooser',
			'glyph-tile',
			'.top-bar__menus',
			'anyink-save-status',
			'.editor-page__zoom-area',
			'preview-strip',
			'edit-canvas',
		];
		const hits = [];
		for (const element of document.querySelectorAll(selectors.join(','))) {
			if (panel.contains(element)) continue;
			if (overlaps(element.getBoundingClientRect())) {
				hits.push(`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} "${(element.textContent || '').trim().slice(0, 24)}"`);
			}
		}
		return { notice: { left: n.left, top: n.top, right: n.right, bottom: n.bottom }, covered: hits };
	});
const coversNothing = async (where) => {
	const { notice, covered: hits } = await covered();
	assert(notice, `${where}: the notice is up`);
	assert.deepEqual(hits, [], `${where}: the notice ${JSON.stringify(notice)} covers ${hits.join(', ')}`);
	await page.screenshot({ path: resolve(shots, `placement-${where.replace(/\W+/g, '-')}.png`) });
	console.log(`PASS placement, ${where}: notice at x ${Math.round(notice.left)}-${Math.round(notice.right)}, y ${Math.round(notice.top)}-${Math.round(notice.bottom)}, covers nothing`);
};

try {
	const launches = [];
	await page.goto(`${origin}/AnyInk/`);
	await page.waitForSelector('#input__new-project-name', { state: 'attached' });
	await page.evaluate(() => navigator.serviceWorker.ready);

	// Launch 1: with the first notice still up, visit every kind of page and check it covers
	// nothing (the start page, Overview, the editor, Settings), at two window sizes.
	const first = Date.now() + 15000;
	while (Date.now() < first && !(await watch(300)).length);
	assert(seen.size, 'the first launch shows a notice');
	await coversNothing('start page');
	await page.locator('#button__create-new-project').click();
	await page.locator('.item-chooser__tile-grid glyph-tile').first().waitFor();
	await page.waitForTimeout(400);
	await coversNothing('Overview');
	await page.locator('.item-chooser__tile-grid glyph-tile').first().click(); // open a letter
	await page.locator('.editor-page__zoom-area').waitFor();
	await page.waitForTimeout(500);
	await coversNothing('editor');
	await page.locator('button[data-nav-type="PAGE"]').click();
	await page.locator('.nav-dropdown__button:has-text("Settings"):visible').click();
	await page.waitForTimeout(500);
	await coversNothing('Settings');
	for (const [width, height] of [
		[1280, 720],
		[1024, 768],
	]) {
		await page.setViewportSize({ width, height });
		await page.waitForTimeout(400);
		await coversNothing(`Settings ${width}x${height}`);
		await page.locator('button[data-nav-type="PAGE"]').click();
		await page.locator('.nav-dropdown__button:has-text("Overview"):visible').click();
		await page.waitForTimeout(500);
		await coversNothing(`Overview ${width}x${height}`);
		await page.locator('button[data-nav-type="PAGE"]').click();
		await page.locator('.nav-dropdown__button:has-text("Settings"):visible').click();
		await page.waitForTimeout(500);
	}
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.waitForTimeout(300);
	await dismissAll('first-launch');
	await watch(4000); // nothing may follow the first notice in this launch
	launches.push(seen);

	for (let launch = 2; launch <= 3; launch++) {
		seen = new Set();
		await page.reload();
		await page.waitForSelector('#input__new-project-name', { state: 'attached' });
		await dismissAll(`launch-${launch}`);
		await watch(4000);
		launches.push(seen);
	}
	await page.screenshot({ path: resolve(shots, 'third-launch.png') });

	launches.forEach((texts, i) =>
		console.log(`launch ${i + 1}: ${texts.size ? [...texts].join(' | ') : '(no notices)'}`)
	);
	launches.forEach((texts, i) =>
		assert(texts.size <= 1, `launch ${i + 1} showed ${texts.size} notices back to back`)
	);
	const offeredInstall = launches[0].has(INSTALL);
	const offlineAt = launches.map((texts) => texts.has(OFFLINE));
	assert.equal(offlineAt.filter(Boolean).length, 1, 'ready offline is shown exactly once');
	assert(
		offlineAt[offeredInstall ? 1 : 0],
		'ready offline comes on launch 1, or on launch 2 after the install offer'
	);
	if (offeredInstall)
		assert(
			!launches[1].has(INSTALL) && !launches[2].has(INSTALL),
			'Not now keeps the install offer away'
		);
	assert.equal(most, 1, 'never more than one notice on screen');
	const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('anyink-prefs') || '{}'));
	assert(prefs.pwaOfflineReadyShown);
	if (offeredInstall) assert(prefs.pwaInstallNotNow);
	assert.deepEqual(errors, []);
	console.log(
		`PASS one notice per launch` +
			(offeredInstall
				? ' (install offered on launch 1, Not now pressed; ready offline on launch 2)'
				: ' (Chrome did not offer install here)') +
			`; screenshots in ${shots}`
	);
} finally {
	await context.close();
	await new Promise((done) => server.close(done));
	await rm(profile, { recursive: true, force: true });
}
