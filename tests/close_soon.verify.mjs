// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (files-recovery) real-Chrome check: closing ANY-INK right after a change, when it is the
// only tab, so Chrome quits. Before the fix 3 of 3 such closes lost the change: no crash card,
// and not in the work file (the backup waits 3 s; the write made as the page went never got to
// the database). For each run: a fresh Chrome profile, ?ui=simple, Create my font, one letter
// inked, then after DELAY ms the page closes (Chrome's "Leave site?" box: Leave) and Chrome
// quits at once. Chrome opens again on the same profile: the start screen must show the crash
// card, or (with a work file) the work file must hold the ink.
//   A. no work file (Windows' save box cancelled): the crash card, 300 ms and 1.5 s
//   B. a work file (kept in the browser's private file system): the crash card or the ink in
//      the file, 300 ms
// Usage: node tests/close_soon.verify.mjs [screenshot folder]
//   CLOSE_SOON_ROOT=<folder> serves another copy of src/ (to run the check on an older build)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = process.env.CLOSE_SOON_ROOT || resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-close-soon'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-close-soon-'));

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: {
		port: 0,
		host: '127.0.0.1',
		hmr: false,
		watch: { ignored: ['**/*'] },
		fs: { strict: false },
	},
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const pass = (message) => console.log(`PASS ${message}`);
const failures = [];

const launch = (profile) =>
	chromium.launchPersistentContext(profile, {
		channel: process.env.CLOSE_SOON_BROWSER || 'chrome',
		headless: true,
		viewport: { width: 1600, height: 900 },
	});

/** Windows' save box: cancelled (no work file) or a file in the browser's private file system. */
function saveBox(withFile) {
	return withFile
		? async () => {
				const folder = await navigator.storage.getDirectory();
				return folder.getFileHandle('My Font.gs2', { create: true });
		  }
		: async () => {
				throw new DOMException('The user aborted a request.', 'AbortError');
		  };
}

async function run(label, { delay, withFile }) {
	const profile = await mkdtemp(resolve(scratch, 'profile-'));
	let context = await launch(profile);
	await context.addInitScript(`window.showSaveFilePicker = ${saveBox(withFile).toString()};`);
	let page = context.pages()[0] || (await context.newPage());
	let asked = 0;
	page.on('dialog', (dialog) => {
		if (dialog.type() === 'beforeunload') asked += 1;
		dialog.accept(); // Leave
	});
	await page.goto(`${origin}/?ui=simple`);
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await page.locator('#input__new-project-name').fill('Close Soon');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page.waitForTimeout(4000); // the font's first backup and file write are long done
	const before = await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const { getSaveStatus } = await import('/anyink/files/save_status.js');
		const editor = getCurrentProjectEditor();
		return { file: !!editor.loadedFileHandle, status: getSaveStatus(editor).file };
	});
	// small o opened, then (once that has settled) inked as a Brush stroke ends: one step
	await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x6F';
		editor.navigate();
	});
	await page.waitForTimeout(4000);
	await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const at = (x, y) => ({ p: { coord: { x, y } } });
		editor.selectedItem.addOneShape({
			pathPoints: [at(100, 0), at(400, 0), at(400, 500), at(100, 500)],
		});
		editor.history.addState('Close-soon check ink');
	});
	await page.waitForTimeout(delay);
	const status = await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const { getSaveStatus } = await import('/anyink/files/save_status.js');
		const { file, recovery, queued } = getSaveStatus(getCurrentProjectEditor());
		return { file, recovery, queued };
	});
	// the only tab closes, he presses Leave, and Chrome quits right away
	const closed = new Promise((done) => page.once('close', done));
	await page.close({ runBeforeUnload: true });
	await closed;
	await context.close();

	context = await launch(profile);
	page = context.pages()[0] || (await context.newPage());
	page.on('dialog', (dialog) => dialog.accept());
	await page.goto(`${origin}/?ui=simple`);
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await page.waitForTimeout(2500);
	const after = await page.evaluate(async () => {
		const { listRecoverableSessions } = await import('/anyink/recovery/recovery.js');
		const sessions = await listRecoverableSessions();
		let fileInk = null;
		try {
			const folder = await navigator.storage.getDirectory();
			const handle = await folder.getFileHandle('My Font.gs2');
			const project = JSON.parse(await (await handle.getFile()).text());
			fileInk = project.glyphs?.['glyph-0x6F']?.shapes?.length || 0;
		} catch {
			fileInk = null;
		}
		const cards = [...document.querySelectorAll('[data-anyink-card]')].map((card) =>
			card.innerText.replace(/\s+/g, ' ').trim()
		);
		const mine = sessions.filter((row) => row.name === 'Close Soon');
		const { recGet } = await import('/anyink/storage/kv.js');
		const record = mine[0] ? await recGet(mine[0].id) : null;
		const backupInk = record?.project?.glyphs?.['glyph-0x6F']?.shapes?.length || 0;
		return { crash: mine.length, backupInk, cards, fileInk };
	});
	await page.screenshot({ path: resolve(shots, `${label}.png`) });
	await context.close();
	await rm(profile, { recursive: true, force: true }).catch(() => undefined);

	const facts = `asked "Leave site?" ${asked}, file ${
		before.file
	}, status at close ${JSON.stringify(status)}; after: ${after.crash} backup(s) (small o: ${
		after.backupInk
	} shape(s)), cards ${JSON.stringify(after.cards)}, ink in file ${after.fileInk}`;
	const kept = after.backupInk > 0 || (withFile && after.fileInk > 0);
	if (!kept) {
		failures.push(`${label}: the change was lost (${facts})`);
		console.log(`FAIL ${label}: the change was lost (${facts})`);
		return;
	}
	if (after.crash > 0) {
		assert.ok(
			after.cards.some((text) => /Close Soon/.test(text)),
			`${label}: a backup but no crash card (${facts})`
		);
	}
	pass(`${label}: the change was kept (${facts})`);
}

try {
	await run('A1-no-file-300ms', { delay: 300, withFile: false });
	await run('A2-no-file-1500ms', { delay: 1500, withFile: false });
	await run('B1-work-file-300ms', { delay: 300, withFile: true });
	if (failures.length) throw new Error(`${failures.length} run(s) lost the change`);
	console.log(`ALL PASS (screenshots in ${shots})`);
} finally {
	await server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
}
