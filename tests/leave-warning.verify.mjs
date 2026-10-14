// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 4 real-browser check of Chrome's "Leave site?" prompt (UX-BEGINNER 7.5). Starts its own
// Vite dev server, opens Chrome with a throwaway profile, and saves to a file in the browser's
// private file system (no file on this PC is touched). Checks: an example (Oblegg) doesn't warn
// after just looking at it, a letter opened included, and Chrome shows no prompt; drawing on it
// warns; a new font with no ink doesn't warn;
// ink not in a file warns (Chrome really shows its prompt); after Save As it doesn't; an edit warns
// until autosave catches up, with no new call to updateWindowUnloadEvent; reopening the saved work
// file and closing with no edits doesn't prompt.
// B1 fix pass: on an example, opening empty letters still doesn't warn, but a changed gap and a
// new font name (typed into the real Settings row) do; a font file imported on the Load tab gets
// the check too (it is installed at start), so new ink on it makes Chrome prompt.
// Usage: node tests/leave-warning.verify.mjs
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1' },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-leave-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.LEAVE_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const prompts = [];
page.on('dialog', async (dialog) => {
	prompts.push(dialog.type());
	// Stay on the page for the checks that expect a prompt; let a reload through otherwise.
	if (page.stayOnPrompt) await dialog.dismiss();
	else await dialog.accept();
});

const pass = (message) => console.log(`PASS ${message}`);
/** Calls the handler the app installed, as Chrome would at unload. */
const warns = () =>
	page.evaluate(() => {
		const event = new Event('beforeunload', { cancelable: true });
		const message = window.onbeforeunload ? window.onbeforeunload(event) : undefined;
		return event.defaultPrevented || (typeof message === 'string' && message.length > 0);
	});
const status = () =>
	page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const { getSaveStatus } = await import('/anyink/files/save_status.js');
		return getSaveStatus(getCurrentProjectEditor()).file;
	});
const waitForStatus = async (want, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if ((await status()) === want) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`save status never became ${want} (is ${await status()})`);
};
const addInk = () =>
	page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x61';
		const at = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape({
			pathPoints: [at(100, 0), at(400, 0), at(400, 500), at(100, 500)],
		});
		editor.history.addState('Leave-warning check ink');
	});

const openExample = async () => {
	await page.locator('#open-project__tab-examples').click();
	await page.getByText('Oblegg', { exact: true }).click();
	await page.locator('.item-chooser__tile-grid glyph-tile').first().click(); // look at a letter
	await page.locator('.editor-page__zoom-area').waitFor();
};

try {
	await page.goto(`${origin}/`);
	await openExample(); // the clicks are also Chrome's needed user gesture
	assert.equal(await warns(), false);
	await page.reload();
	await page.locator('#open-project__tab-examples').waitFor();
	assert.deepEqual(prompts, []);
	pass('an example, after looking at a letter, does not warn and Chrome shows no prompt');

	await openExample();
	await addInk();
	assert.equal(await warns(), true);
	pass('drawing on an example warns');
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/`);

	// B1 fix pass: everything an example's work file would hold counts, looking around doesn't
	await openExample();
	const opened = await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const ids = ['glyph-0x7E', 'glyph-0x20', 'glyph-0xE9', 'glyph-0x41'];
		for (const id of ids) {
			editor.nav.page = 'Characters';
			editor.selectedItemID = id;
			editor.navigate();
			editor.history.addState(`Navigated to ${id}`);
		}
		return ids.map((id) => editor.project.getItem(id)?.shapes?.length ?? 'none');
	});
	assert.equal(await warns(), false, `opening letters (shapes ${opened}) must not warn`);
	pass(`an example, after opening four letters (empty ones too, shapes ${opened.join(' / ')}), does not warn`);

	await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const [id] = Object.keys(editor.project.kerning);
		editor.project.kerning[id].value += 10;
		editor.history.addState('Edited kern group');
	});
	assert.equal(await warns(), true);
	pass('changing one gap on an example warns');
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/`);

	await openExample();
	await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		editor.nav.page = 'Settings';
		editor.navigate();
	});
	await page.locator('#content-page__panel').getByText('Font', { exact: true }).click();
	const family = page.locator('#settings-page-input__font-family');
	await family.fill('Brennan Script');
	await family.dispatchEvent('change');
	assert.equal(
		await page.evaluate(async () => (await import('/app/main.js')).getCurrentProject().settings.font.family),
		'Brennan Script'
	);
	assert.equal(await warns(), true);
	pass('renaming an example in the Settings row warns');
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/`);

	// A font file imported on the Load tab (font_import.js never set the check itself). The
	// picker hands over a font file kept in the browser's private file system.
	const fontBytes = (await readFile(fileURLToPath(new URL('../src/formats_io/otf/tests/ObleggKernTestRegular.otf', import.meta.url)))).toString('base64');
	await page.evaluate(async (b64) => {
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const folder = await navigator.storage.getDirectory();
		const handle = await folder.getFileHandle('ObleggKernTestRegular.otf', { create: true });
		const writable = await handle.createWritable();
		await writable.write(bytes);
		await writable.close();
		window.showOpenFilePicker = async () => [handle];
	}, fontBytes);
	await page.locator('#open-project__tab-load').click();
	await page.getByText('or, import a font or SVG file...').click();
	await page.locator('.item-chooser__tile-grid glyph-tile').first().waitFor({ timeout: 20000 });
	assert.equal(await page.evaluate(() => typeof window.onbeforeunload), 'function');
	assert.equal(await warns(), false);
	await addInk();
	assert.equal(await warns(), true);
	page.stayOnPrompt = true;
	await page.close({ runBeforeUnload: true });
	await page.waitForTimeout(1000);
	assert.deepEqual(prompts, ['beforeunload']);
	assert.equal(page.isClosed(), false);
	pass('an imported font file: no warning as loaded; new ink makes Chrome prompt');
	page.stayOnPrompt = false;
	prompts.length = 0;
	await page.evaluate(() => (window.onbeforeunload = null));
	await page.goto(`${origin}/`);

	await page.locator('#button__create-new-project').click(); // also Chrome's needed user gesture
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	assert.equal(await warns(), false);
	pass('a new font with no ink does not warn');

	await addInk();
	assert.notEqual(await status(), 'saved');
	assert.equal(await warns(), true);
	page.stayOnPrompt = true;
	await page.close({ runBeforeUnload: true });
	await page.waitForTimeout(1000);
	assert.deepEqual(prompts, ['beforeunload']);
	assert.equal(page.isClosed(), false);
	pass('ink that only lives in memory warns, and Chrome shows its prompt');

	await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const api = await import('/anyink/files/file_api.js');
		const files = await import('/anyink/files/project_files.js');
		const folder = await navigator.storage.getDirectory();
		const handle = await folder.getFileHandle('Leave Check.gs2', { create: true });
		api.setFileApi({ ...api.getFileApi(), showSaveFilePicker: async () => handle });
		if (!(await files.saveProjectAs(getCurrentProjectEditor()))) throw new Error('Save As failed');
	});
	await waitForStatus('saved');
	assert.equal(await warns(), false);
	pass('right after Save As it does not warn');

	await addInk();
	assert.equal(await warns(), true);
	await waitForStatus('saved'); // autosave (D-030), no new updateWindowUnloadEvent call
	assert.equal(await warns(), false);
	pass('an edit warns until autosave writes it, then stops warning');

	page.stayOnPrompt = false;
	await page.reload();
	await page.locator('#button__create-new-project').waitFor();
	assert.deepEqual(prompts, ['beforeunload']);
	pass('reloading a saved font shows no prompt');

	await page.evaluate(async () => {
		const files = await import('/anyink/files/project_files.js');
		const folder = await navigator.storage.getDirectory();
		const handle = await folder.getFileHandle('Leave Check.gs2');
		const result = await files.openProjectFromHandle(handle, { mode: 'readwrite' });
		if (result !== 'opened') throw new Error(`reopen: ${result}`);
	});
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await page.mouse.click(1000, 300); // a fresh user gesture, so Chrome would prompt if asked to
	await waitForStatus('saved');
	assert.equal(await warns(), false);
	page.stayOnPrompt = true;
	const closed = page.waitForEvent('close', { timeout: 5000 });
	await page.close({ runBeforeUnload: true });
	await closed;
	assert.deepEqual(prompts, ['beforeunload']);
	pass('reopening the work file and closing with no edits shows no prompt');
	assert.deepEqual(errors, []);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
