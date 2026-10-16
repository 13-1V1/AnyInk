// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 font check and export, in the real app (Vite dev server over src/, Chrome with a throwaway
// profile; files go only to the browser's private file system). Checks what only a browser shows:
//   1. a letter with ink and no width: Ctrl+E keeps "Exported <file> to Fonts" on screen, adds
//      ", but small b needs fixing.", the toast's edge is amber, it outlasts the export's own
//      2.5 s close, and Show me opens small b
//   2. a clean export: the toast is the plain green "Exported <file> to Fonts", no Show me
//   3. one click on the Space tile: the strip line says the space has no width, and the
//      export toast names the space
//   4. a shape from -20,000 to 20,000: the strip line names the letter (the 40,000 step)
//   5. a kern value of 12.5: the font file is made, no error box, the check stays quiet, and the
//      Real font preview shows the letters (B1 fix pass);
//      40,000: the toast names the gap between Capital A and Capital V
// Usage: node tests/fontcheck.verify.mjs [screenshot folder]   (default: the OS temp folder)
/* global process */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-fontcheck'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-fontcheck-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B1_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('dialog', (dialog) => dialog.dismiss());

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(150);
	}
	throw new Error(`timed out: ${what}`);
};

/** Runs fn(editor, modules) in the page and returns its result. */
const inEditor = (fn, arg) =>
	page.evaluate(
		async ([source, value]) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const kerning = await import('/anyink/kerning/kern_lookup.js');
			const { KernGroup } = await import('/project_data/kern_group.js');
			return new Function(
				'editor',
				'kerning',
				'KernGroup',
				'value',
				`return (${source})(editor, kerning, KernGroup, value);`
			)(editor, kerning, KernGroup, value);
		},
		[fn.toString(), arg]
	);

const editorState = () =>
	inEditor((editor) => ({ id: editor.selectedItemID, page: editor.nav.page }));

const openLetter = async (id) => {
	await page.locator('button[data-nav-type="PAGE"]').click();
	await page.locator('.nav-dropdown__button:has-text("Overview"):visible').click();
	await page.waitForTimeout(400);
	await page.locator(`glyph-tile[displayed-item-id="${id}"]`).click();
	await waitUntil(async () => (await editorState()).id === id, `open ${id}`);
	await page.waitForTimeout(400);
};

const toastInfo = () =>
	page.evaluate(() => {
		const toast = document.querySelector('#toast:not([data-leaving])');
		if (!toast || getComputedStyle(toast).display === 'none') return null;
		const button = toast.querySelector('.anyink-export-check__show');
		const root = getComputedStyle(document.documentElement);
		return {
			text: toast.querySelector('.anyink-export-check__text')?.innerText ?? toast.innerText,
			edge: getComputedStyle(toast).borderLeftColor,
			warning: root.getPropertyValue('--warning').trim(),
			showMe: !!button && !button.hidden && getComputedStyle(button).display !== 'none',
		};
	});

/** rgb(r, g, b) for a #rrggbb token. */
const rgb = (hex) => {
	const n = parseInt(hex.replace('#', ''), 16);
	return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const exportNow = async () => {
	await page.evaluate(() => document.querySelectorAll('#toast').forEach((t) => t.remove()));
	await page.mouse.click(700, 500);
	await page.keyboard.press('Control+e');
};

const checkLine = page.locator('.preview-strip__check');

try {
	await page.goto(`${origin}/?ui=all`);
	await page.locator('#input__new-project-name').fill('Check Verify');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await page.evaluate(async () => {
		const folder = await navigator.storage.getDirectory();
		window.showSaveFilePicker = async (options) => {
			const documents = await folder.getDirectoryHandle('Documents', { create: true });
			return documents.getFileHandle(options?.suggestedName || 'Untitled.gs2', { create: true });
		};
		window.showDirectoryPicker = async () => folder.getDirectoryHandle('Fonts', { create: true });
	});

	// 1. small b: ink, no width
	await openLetter('glyph-0x62');
	await inEditor((editor) => {
		const b = editor.selectedItem;
		b.addOneShape({
			name: 'Bowl',
			pathPoints: [
				{ p: { coord: { x: 100, y: 0 } } },
				{ p: { coord: { x: 500, y: 0 } } },
				{ p: { coord: { x: 500, y: 700 } } },
				{ p: { coord: { x: 100, y: 700 } } },
			],
		});
		b.advanceWidth = 0;
		editor.publish('currentItem', b);
	});
	await exportNow();
	await waitUntil(async () => (await toastInfo())?.text.includes('needs fixing'), 'check toast');
	let toast = await toastInfo();
	assert.equal(toast.text, 'Exported CheckVerify-Regular.otf to Fonts, but small b needs fixing.');
	assert.equal(toast.edge, rgb(toast.warning), 'amber edge');
	assert.ok(toast.showMe, 'Show me is offered');
	await shot('fc-01-export-toast-small-b');
	await page.waitForTimeout(3000);
	toast = await toastInfo();
	assert.ok(toast?.text.includes('CheckVerify-Regular.otf to Fonts'), 'still there after 3 s');
	pass(
		`the export toast keeps the file and folder, names small b, amber edge ${toast.edge}, still up after 3 s`
	);

	await openLetter('glyph-0x65');
	await exportNow();
	await waitUntil(async () => (await toastInfo())?.showMe, 'check toast again');
	await page.locator('#toast .anyink-export-check__show').click();
	await waitUntil(async () => (await editorState()).id === 'glyph-0x62', 'Show me opens small b');
	assert.equal((await editorState()).page, 'Characters');
	await shot('fc-02-show-me-opened-b');
	pass('Show me in the toast opens small b');

	// 2. clean export
	await inEditor((editor) => {
		const b = editor.project.getItem('glyph-0x62');
		b.advanceWidth = 600;
		editor.publish('currentItem', b);
	});
	await exportNow();
	await waitUntil(
		async () => (await toastInfo())?.text === 'Exported CheckVerify-Regular.otf to Fonts',
		'clean toast'
	);
	toast = await toastInfo();
	assert.equal(toast.edge, rgb('#16a34a'), 'green edge on a clean export');
	assert.equal(toast.showMe, false);
	await shot('fc-03-clean-export-toast');
	pass(`a clean export toast is unchanged: "${toast.text}", green edge`);

	// 3. one click on the Space tile
	await openLetter('glyph-0x20');
	// the check runs 2 s after the change
	await waitUntil(
		async () =>
			(await checkLine.isVisible()) && (await checkLine.innerText()).startsWith('The space'),
		'space check line'
	);
	const spaceLine = await checkLine.innerText();
	assert.match(spaceLine, /^The space has no width, so your words would run together\./);
	await shot('fc-04-space-check-line');
	await exportNow();
	await waitUntil(async () => (await toastInfo())?.text.includes('needs fixing'), 'space toast');
	assert.equal(
		(await toastInfo()).text,
		'Exported CheckVerify-Regular.otf to Fonts, but the space needs fixing.'
	);
	await shot('fc-05-space-export-toast');
	pass(
		`one click on Space: the strip says "${spaceLine.split('\n')[0]}" and the toast names the space`
	);
	await inEditor((editor) => {
		const space = editor.project.getItem('glyph-0x20');
		space.advanceWidth = 512;
		editor.publish('currentItem', space);
	});

	// 4. a 40,000 step inside small c
	await openLetter('glyph-0x63');
	await inEditor((editor) => {
		const c = editor.selectedItem;
		c.addOneShape({
			name: 'Far',
			pathPoints: [
				{ p: { coord: { x: -20000, y: 0 } } },
				{ p: { coord: { x: 20000, y: 0 } } },
				{ p: { coord: { x: 20000, y: 400 } } },
				{ p: { coord: { x: -20000, y: 400 } } },
			],
		});
		c.advanceWidth = 600;
		editor.publish('currentItem', c);
	});
	await waitUntil(
		async () =>
			(await checkLine.isVisible()) && (await checkLine.innerText()).startsWith('small c'),
		'far step line'
	);
	const farLine = (await checkLine.innerText()).split('\n')[0];
	// B1 fix pass: no Fix it for this one, so the line says what to do instead
	assert.equal(
		farLine,
		'small c has a point too far out for the font file to hold. Show me, then drag the far point back near the letter.'
	);
	await shot('fc-06-far-step-check-line');
	pass(`a 40,000 step: "${farLine}"`);
	await inEditor((editor) => {
		const c = editor.project.getItem('glyph-0x63');
		c.shapes.splice(0, c.shapes.length);
		editor.publish('currentItem', c);
	});

	// 5. kerning: 12.5 is fine, 40,000 is named
	for (const id of ['glyph-0x41', 'glyph-0x56']) {
		await openLetter(id);
		await inEditor((editor) => {
			const item = editor.selectedItem;
			item.addOneShape({
				name: 'Box',
				pathPoints: [
					{ p: { coord: { x: 50, y: 0 } } },
					{ p: { coord: { x: 550, y: 0 } } },
					{ p: { coord: { x: 550, y: 700 } } },
					{ p: { coord: { x: 50, y: 700 } } },
				],
			});
			item.advanceWidth = 600;
			editor.publish('currentItem', item);
		});
	}
	await inEditor((editor, kerning, KernGroup, value) => {
		const group = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56'], value });
		group.id = 'kern-0';
		editor.project.kerning['kern-0'] = group;
		kerning.notifyKernPairsChanged(editor, { groupID: 'kern-0', value, created: true });
	}, 12.5);
	await page.waitForTimeout(2600);
	assert.equal(await checkLine.isVisible(), false, 'the check stays quiet for 12.5');
	await exportNow();
	await waitUntil(async () => (await toastInfo())?.text.startsWith('Exported'), 'kern 12.5 export');
	assert.equal((await toastInfo()).text, 'Exported CheckVerify-Regular.otf to Fonts');
	assert.equal(await page.locator('#error').count(), 0, 'no error box');
	pass('a kern value of 12.5: the font file is made, no error box, the check is quiet');

	// B1 fix pass: the Real font preview writes gaps the way the font file holds them, so it
	// shows his letters with a gap of 12.5 too (it used to say "Can't show your font yet")
	await page.evaluate(() => {
		const strip = document.querySelector('preview-strip');
		strip.setText('AV AV');
		strip.setRealFont(true);
	});
	await page.waitForTimeout(2000);
	const sheet = await page.evaluate(() => {
		const preview = document.querySelector('preview-strip font-preview');
		const notice = preview?.shadowRoot?.querySelector('.anyink-notice');
		const text = preview?.shadowRoot?.querySelector('.font-preview__text');
		return {
			preview: !!preview,
			notice: notice ? !notice.hidden : false,
			textShown: !!text && text.style.display !== 'none',
		};
	});
	assert.deepEqual(sheet, { preview: true, notice: false, textShown: true });
	await shot('fc-07a-kern-12_5-real-font');
	await page.evaluate(() => document.querySelector('preview-strip').setRealFont(false));
	pass("a kern value of 12.5: Real font shows the letters, no 'Can't show your font yet'");

	await inEditor((editor, kerning, KernGroup, value) => {
		editor.project.kerning['kern-0'].value = value;
		kerning.notifyKernPairsChanged(editor, { groupID: 'kern-0', value });
	}, 40000);
	await exportNow();
	await waitUntil(
		async () => (await toastInfo())?.text.includes('needs fixing'),
		'kern 40,000 toast'
	);
	assert.equal(
		(await toastInfo()).text,
		'Exported CheckVerify-Regular.otf to Fonts, but the gap between Capital A and Capital V needs fixing.'
	);
	await shot('fc-07-kern-export-toast');
	pass('a kern value of 40,000: the toast names the gap between Capital A and Capital V');

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass('no page errors');
	console.log(`screenshots: ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
