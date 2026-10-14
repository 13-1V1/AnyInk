// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 real-browser walkthrough (docs/UX-BEGINNER.md section 10, B1): redoes the first-timer steps
// B1 fixed, in the real app on a Vite dev server over src/ (app_config devMode stays as committed,
// so the leave-site rule is the real one). Chrome with a throwaway profile; files go only to the
// browser's private file system. Checks, in order:
//   1. a new font's empty letter shows the guide lines (paper and slate)
//   2. the File menu is readable without hover
//   3. the panel chooser opens Context characters, Character info and Quality checks
//   4. a first shape gives a fractional width, and Real font shows the letters at the width the
//      font file gets (no system-font fallback)
//   5. a photo traced onto a fresh letter: the font check names it on the preview strip, and
//      Show me opens it
//   6. Ctrl+E makes the font file and the toast names the letter
//   7. after Save, reloading shows no "Leave site?" prompt
//   8. app notices show one at a time, in the top bar, clear of the menus, the save status, the
//      zoom bar and the strip line
// Usage: node tests/b1.verify.mjs [screenshot folder]   (default: the OS temp folder)
//        B1_PHOTO=path/to/photo.jpg uses a real photo; otherwise one is drawn in the page.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b1'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	// No hot reload: an edit elsewhere in the repo must not reload the page mid-run.
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-b1-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B1_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
const prompts = [];
page.on('dialog', async (dialog) => {
	prompts.push(dialog.type());
	await dialog.dismiss(); // a leave prompt would keep the page, so the reload below would hang
});

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const editorState = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const item = editor.selectedItem;
		return {
			id: editor.selectedItemID,
			page: editor.nav.page,
			panel: editor.nav.panel,
			width: item?.advanceWidth,
			shapes: item?.shapes?.length,
			defaultWidth: editor.project.defaultAdvanceWidth,
		};
	});
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(150);
	}
	throw new Error(`timed out: ${what}`);
};
const chooseFromNav = async (type, selector) => {
	await page.locator(`button[data-nav-type="${type}"]`).click();
	await page.locator(`${selector}:visible`).click();
	await page.waitForTimeout(400);
};
const openLetter = async (id) => {
	await chooseFromNav('PAGE', '.nav-dropdown__button:has-text("Overview")');
	await page.locator(`glyph-tile[displayed-item-id="${id}"]`).click();
	await waitUntil(async () => (await editorState()).id === id, `open ${id}`);
	await page.waitForTimeout(500);
};

/** How long the baseline is drawn on the edit canvas, in font units. */
const baselineSpan = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const host = document.querySelector('edit-canvas');
		const canvas = (host.shadowRoot || host).querySelector('canvas');
		const scale = canvas.width / canvas.getBoundingClientRect().width;
		const y = Math.round(Math.ceil(editor.view.dy) * scale);
		const row = canvas.getContext('2d').getImageData(0, y, canvas.width, 1).data;
		let first = -1;
		let last = -1;
		for (let x = 0; x < canvas.width; x++) {
			if (row[x * 4 + 3] > 0) {
				if (first < 0) first = x;
				last = x;
			}
		}
		return first < 0 ? 0 : (last - first) / scale / editor.view.dz;
	});

/** Stands in for Chrome's file pickers: everything lands in the private file system. */
const stubPickers = async (photo) => {
	await page.evaluate(async (bytes) => {
		const folder = await navigator.storage.getDirectory();
		const pictures = await folder.getDirectoryHandle('Pictures', { create: true });
		const photoHandle = await pictures.getFileHandle('handwriting.jpg', { create: true });
		let blob;
		if (bytes) blob = new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))]);
		else {
			// A stand-in photo: dark pen strokes of an "a" on off-white paper
			const canvas = new OffscreenCanvas(1200, 900);
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = 'rgb(240, 236, 226)';
			ctx.fillRect(0, 0, 1200, 900);
			ctx.strokeStyle = 'rgb(30, 30, 34)';
			ctx.lineWidth = 34;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.arc(560, 500, 170, 0, Math.PI * 2);
			ctx.moveTo(740, 280);
			ctx.lineTo(740, 690);
			ctx.stroke();
			blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
		}
		const writable = await photoHandle.createWritable();
		await writable.write(blob);
		await writable.close();
		window.showOpenFilePicker = async () => [photoHandle];
		window.showSaveFilePicker = async (options) => {
			const documents = await folder.getDirectoryHandle('Documents', { create: true });
			return documents.getFileHandle(options?.suggestedName || 'Untitled.gs2', { create: true });
		};
		window.showDirectoryPicker = async () => folder.getDirectoryHandle('Fonts', { create: true });
	}, photo);
};

try {
	const photo = process.env.B1_PHOTO ? (await readFile(process.env.B1_PHOTO)).toString('base64') : null;
	await page.goto(`${origin}/`);
	await page.locator('#input__new-project-name').fill('B1 Walkthrough');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await stubPickers(photo);

	// 1. Guide lines on an empty letter, paper and slate
	await openLetter('glyph-0x65');
	let letter = await editorState();
	assert.equal(letter.shapes, 0);
	assert.equal(letter.width, 0);
	const paperSpan = await baselineSpan();
	assert.ok(paperSpan >= letter.defaultWidth, `baseline ${paperSpan} units on paper`);
	await shot('b1-01-empty-e-guides-paper');
	await page.locator('button[title="Paper / slate"]').click();
	await page.waitForTimeout(400);
	assert.equal(await page.evaluate(() => document.documentElement.dataset.canvas), 'dark');
	const slateSpan = await baselineSpan();
	assert.ok(slateSpan >= letter.defaultWidth, `baseline ${slateSpan} units on slate`);
	await shot('b1-02-empty-e-guides-slate');
	await page.locator('button[title="Paper / slate"]').click();
	await page.waitForTimeout(300);
	pass(`an empty letter shows guide lines (${Math.round(paperSpan)} font units, default width ${letter.defaultWidth}) on paper and slate`);

	// 2. File menu readable without hover
	await page.locator('.menu-entry-point', { hasText: 'File' }).click();
	await page.mouse.move(1300, 600);
	await page.waitForTimeout(300);
	await shot('b1-03-file-menu');
	const rows = await page.evaluate(() => {
		const luminance = (color) => {
			const [r, g, b] = color
				.match(/[\d.]+/g)
				.slice(0, 3)
				.map((v) => Number(v) / 255)
				.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const menu = document.querySelector('#context-menu');
		const background = luminance(getComputedStyle(menu).backgroundColor);
		return [...menu.querySelectorAll('.row-name')].map((row) => {
			const text = luminance(getComputedStyle(row).color);
			const [hi, lo] = [text, background].sort((a, b) => b - a);
			return { name: row.textContent.trim(), ratio: (hi + 0.05) / (lo + 0.05) };
		});
	});
	assert.ok(rows.length >= 8, 'File menu rows');
	rows.forEach(({ name, ratio }) => assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}:1`));
	await page.keyboard.press('Escape');
	await page.mouse.click(700, 680);
	await page.waitForTimeout(400);
	pass(`File menu: ${rows.length} rows readable without hover (lowest ${Math.min(...rows.map((r) => r.ratio)).toFixed(2)}:1)`);

	// 3. Panel chooser
	await page.locator('button[data-nav-type="PANEL"]').click();
	await page.waitForTimeout(300);
	await shot('b1-04-panel-chooser');
	await page.mouse.click(700, 680);
	await page.waitForTimeout(400);
	const panels = [
		['ContextCharacters', 'Context characters', 'Context characters are', 'b1-05-panel-context-characters'],
		['CharacterInfo', 'Character info', 'Character name', 'b1-06-panel-character-info'],
		['QualityChecks', 'Quality checks', 'quality checks', 'b1-07-panel-quality-checks'],
	];
	for (const [id, label, text, name] of panels) {
		await chooseFromNav('PANEL', `.nav-dropdown__button[data-panel-id="${id}"]`);
		const shown = await page.evaluate(() => ({
			button: document.querySelector('button[data-nav-type="PANEL"] .nav-button__title').textContent.trim(),
			content: document.querySelector('#editor-page__panel').innerText,
		}));
		assert.equal((await editorState()).panel, id);
		assert.equal(shown.button, label);
		assert.ok(shown.content.includes(text), `${label} panel shows "${text}"`);
		await shot(name);
	}
	await chooseFromNav('PANEL', '.nav-dropdown__button[data-panel-id="Attributes"]');
	pass('the panel chooser opens Context characters, Character info and Quality checks');

	// 4. A fractional width and Real font
	await page.locator('button[title="New rectangle"]').click();
	await page.mouse.move(960, 330);
	await page.mouse.down();
	await page.mouse.move(1080, 515, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(400);
	letter = await editorState();
	assert.equal(letter.shapes, 1);
	assert.ok(!Number.isInteger(letter.width), `first shape width ${letter.width} is fractional`);
	await page.locator('.preview-strip__text').fill('eee');
	await page.evaluate(() => {
		window.__fontStatus = [];
		document.addEventListener('font-status', (event) => window.__fontStatus.push(event.detail), true);
	});
	await page.locator('.preview-strip__toggle', { hasText: 'Real font' }).click();
	await waitUntil(() => page.evaluate(() => window.__fontStatus.length > 0), 'font status');
	const real = await page.evaluate(async () => {
		const preview = document.querySelector('preview-strip font-preview');
		const face = preview.currentFontFace;
		await face.loaded;
		const text = preview.shadowRoot.querySelector('.font-preview__text');
		const size = parseFloat(getComputedStyle(text).fontSize);
		const ctx = new OffscreenCanvas(10, 10).getContext('2d');
		ctx.font = `${size}px "${face.family}"`;
		const notice = preview.shadowRoot.querySelector('.anyink-notice');
		return {
			status: window.__fontStatus.at(-1),
			face: face.status,
			used: getComputedStyle(text).fontFamily,
			family: face.family,
			size,
			eee: ctx.measureText('eee').width,
			notice: notice ? getComputedStyle(notice).display : 'none',
		};
	});
	const upm = await page.evaluate(async () => (await import('/app/main.js')).getCurrentProject().settings.font.upm);
	const expected = (3 * Math.round(letter.width) * real.size) / upm;
	assert.equal(real.status.ok, true);
	assert.equal(real.face, 'loaded');
	assert.ok(real.used.includes(real.family), `sheet uses ${real.used}`);
	assert.equal(real.notice, 'none');
	assert.ok(Math.abs(real.eee - expected) < 1, `"eee" is ${real.eee}px, the font file gives ${expected}px`);
	await page.waitForTimeout(500);
	await shot('b1-08-fractional-width-real-font');
	pass(`Real font with width ${letter.width}: the font loads and "eee" sets ${real.eee.toFixed(1)}px, as the font file (width ${Math.round(letter.width)})`);

	// 5. A photo traced onto a fresh letter; the font check names it
	await openLetter('glyph-0x62');
	await chooseFromNav('PANEL', '.nav-dropdown__button[data-panel-id="Trace"]');
	await page.locator('button', { hasText: 'Choose an image...' }).click();
	await waitUntil(() => page.locator('button', { hasText: 'Start auto-trace' }).first().isVisible(), 'photo added');
	await page.waitForTimeout(800);
	await shot('b1-09-photo-on-fresh-b');
	await page.locator('button', { hasText: 'Start auto-trace' }).first().click();
	const replace = page.locator('button', { hasText: 'Replace outlines' }).first();
	await replace.waitFor();
	await waitUntil(() => replace.isEnabled(), 'auto-trace preview', 30000);
	await replace.click();
	await waitUntil(async () => (await editorState()).shapes > 0, 'traced shapes', 30000);
	const tracedAt = Date.now();
	letter = await editorState();
	assert.equal(letter.width, 0, 'a traced letter still has width 0 until B3');
	const line = page.locator('.preview-strip__check');
	await line.waitFor({ state: 'visible', timeout: 8000 });
	const lineText = await line.innerText();
	assert.match(lineText, /^small b /);
	assert.match(lineText, /Show me/);
	await shot('b1-10-traced-b-check-line');
	pass(`the font check names the traced letter ${((Date.now() - tracedAt) / 1000).toFixed(1)} s after the trace: "${lineText.split('\n')[0]}"`);

	await openLetter('glyph-0x65');
	await line.locator('button', { hasText: 'Show me' }).click();
	await waitUntil(async () => (await editorState()).id === 'glyph-0x62', 'Show me opens small b');
	await page.waitForTimeout(400);
	await shot('b1-11-show-me-opened-b');
	pass('Show me opens small b');

	// 6. Ctrl+E names the letter
	await page.mouse.click(700, 680);
	await page.keyboard.press('Control+e');
	const toast = () =>
		page.evaluate(
			() => document.querySelector('#toast .anyink-export-check__text')?.innerText || ''
		);
	await waitUntil(async () => (await toast()).includes('needs fixing'), 'export toast');
	assert.equal(
		await toast(),
		'Exported B1Walkthrough-Regular.otf to Fonts, but small b needs fixing.'
	);
	const exported = await page.evaluate(async () => {
		const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle('Fonts');
		const names = [];
		for await (const name of folder.keys()) names.push(name);
		return names;
	});
	assert.deepEqual(exported, ['B1Walkthrough-Regular.otf']);
	await shot('b1-12-export-toast');
	pass('Ctrl+E makes the font file and the toast names small b');

	// 7. Save, then reload: no leave prompt
	const fileStatus = () =>
		page.evaluate(async () => {
			const { getCurrentProjectEditor } = await import('/app/main.js');
			const { getSaveStatus } = await import('/anyink/files/save_status.js');
			return getSaveStatus(getCurrentProjectEditor()).file;
		});
	assert.notEqual(await fileStatus(), 'saved');
	await page.mouse.click(700, 680);
	await page.keyboard.press('Control+s');
	await waitUntil(async () => (await fileStatus()) === 'saved', 'saved to the work file');
	await page.waitForTimeout(300);
	await shot('b1-13-saved');
	await page.reload();
	await page.locator('#button__create-new-project').waitFor({ timeout: 10000 });
	assert.deepEqual(prompts, []);
	await shot('b1-14-reloaded-no-prompt');
	pass('after Save, reloading shows no "Leave site?" prompt');

	// 8. One notice at a time, clear of the save status and the strip line. Notices only run in
	// the production build (tests/notices.verify.mjs); here the same module is loaded by hand.
	await page.locator('#input__new-project-name').fill('B1 Notices');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await stubPickers(photo);
	await openLetter('glyph-0x61');
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const at = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape({ pathPoints: [at(100, 0), at(400, 0), at(400, 500), at(100, 500)] });
		editor.selectedItem.advanceWidth = 0;
		editor.publish('currentItem', editor.selectedItem);
		editor.history.addState('B1 check: ink with no width');
	});
	await line.waitFor({ state: 'visible', timeout: 8000 });
	const notices = await page.evaluate(async () => {
		await import('/anyink/pwa/pwa.css');
		const queue = await import('/anyink/pwa/notices.js');
		const offer = {
			key: 'b1-install',
			kind: 'offer',
			message: 'Install ANY-INK to open it from your desktop.',
			actionLabel: 'Install ANY-INK',
			action: async () => {},
			dismissLabel: 'Not now',
		};
		queue.showNotice({ key: 'b1-offline', kind: 'info', message: 'ANY-INK is ready to open offline.' });
		queue.showNotice(offer);
		queue.showNotice(offer); // asked twice, still one
		await new Promise((done) => setTimeout(done, 200));
		const box = (el) => el?.getBoundingClientRect();
		const overlaps = (a, b) =>
			!!(a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
		const shown = [...document.querySelectorAll('.anyink-pwa-notice')];
		const notice = box(shown[0]);
		return {
			shown: shown.length,
			active: queue.activeNotice(),
			waiting: queue.waitingNotices(),
			overSaveStatus: overlaps(notice, box(document.querySelector('anyink-save-status'))),
			overCheckLine: overlaps(notice, box(document.querySelector('.preview-strip__check'))),
			overMenus: overlaps(notice, box(document.querySelector('.top-bar__menus'))),
			overZoomBar: overlaps(notice, box(document.querySelector('.editor-page__zoom-area'))),
			inTopBar: !!notice && notice.bottom <= box(document.querySelector('#app__top-bar')).bottom,
		};
	});
	assert.deepEqual(notices, {
		shown: 1,
		active: 'b1-offline',
		waiting: ['b1-install'],
		overSaveStatus: false,
		overCheckLine: false,
		overMenus: false,
		overZoomBar: false,
		inTopBar: true,
	});
	await shot('b1-15-one-notice-in-editor');
	await page.locator('.anyink-pwa-notice button', { hasText: 'OK' }).click();
	await page.waitForTimeout(200);
	assert.equal(await page.locator('.anyink-pwa-notice').count(), 1);
	assert.match(await page.locator('.anyink-pwa-notice').innerText(), /Install ANY-INK/);
	await shot('b1-16-next-notice');
	pass('notices show one at a time, in the top bar, clear of the menus, save status, zoom bar and strip line');

	assert.deepEqual(errors, []);
	pass(`no page errors; screenshots in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
