// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 real-browser check (docs/UX-BEGINNER.md section 10, B2 "Undo that never surprises"), in Chrome
// with a throwaway profile:
//   A. tests/undo.html?ui=simple (bare editor, two letters): trace B, open r, trace r; Undo twice
//      restores both with one view jump per press and no "navigated" press; redo; the board
//      stays put and offers Show me; opening letters adds no step; settings steps; the cap.
//   B. tests/undo.html in All tools: looking at a letter keeps a saved work file saved.
//   C. the real app with ?ui=simple: draw on B and r, open e, then Ctrl+Z: every press changes a
//      letter, the first press moves the view to r, and opening letters adds no step.
//   D. the real app with no flag: after Save, opening letters keeps "saved" and no title dot.
//   E. tests/undo.html (B2 finalize): Simple names every step by its own title (a whole-font step,
//      a trace whose refit of a letter made from it rides along as step parts, a whole-font trace),
//      never the internal marker; All tools: 250 looks around keep the trace undoable, at most 30
//      "Navigated to" entries, and no press that does nothing.
// Usage: node tests/undo.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { toOverview } from './verify_standins.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b2'));
await mkdir(shots, { recursive: true });

// Two servers (test pages from the repo, the app from src/), each with its own dependency
// cache, so their first dependency scans never race for node_modules/.vite.
const serve = async (root, name) => {
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'error',
		cacheDir: resolve(tmpdir(), `anyink-b2-vite-${name}`),
		server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
	});
	await server.listen();
	return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}` };
};
const pages = await serve(repo, 'pages');
const app = await serve(src, 'app');
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-b2-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B2_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 1000 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('dialog', (dialog) => dialog.dismiss());

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`), fullPage: true });
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(150);
	}
	throw new Error(`timed out: ${what}`);
};

// ---------------------------------------------------------------- test page
const testPage = () =>
	page.evaluate(() => {
		const { editor, jumps, results } = window.anyinkUndoPage;
		const glyph = (id) => editor.project.glyphs[id];
		return {
			page: editor.nav.page,
			open: editor.selectedGlyphID,
			B: glyph('glyph-0x42')?.shapes.length,
			r: glyph('glyph-0x72')?.shapes.length,
			queue: editor.history.queue.map((entry) => entry.title),
			redo: editor.history.redoQueue.length,
			jumps,
			last: results.at(-1) || null,
			letterSet: editor.project.settings.anyink.letterSet,
			name: editor.project.settings.project.name,
			dot: document.title.includes('•'),
		};
	});
const click = async (id) => {
	await page.locator(`#${id}`).click();
	await page.waitForTimeout(60);
};

try {
	// A. Simple, on the test page
	await page.goto(`${pages.origin}/tests/undo.html?ui=simple`);
	await page.locator('#mode', { hasText: 'Simple' }).waitFor();
	await click('open-b');
	await click('trace');
	await click('open-r');
	await click('trace');
	let s = await testPage();
	assert.deepEqual([s.B, s.r, s.queue.length], [1, 1, 2]);
	assert.ok(!s.queue.some((title) => title.startsWith('Navigated')), s.queue.join(' | '));
	await shot('b2-01-simple-traced-b-and-r');

	await click('undo');
	s = await testPage();
	assert.deepEqual([s.B, s.r, s.open, s.last.jumps], [1, 0, 'glyph-0x72', 0]);
	assert.equal(s.last.result.itemID, 'glyph-0x72');
	await click('undo');
	s = await testPage();
	assert.deepEqual([s.B, s.r, s.open, s.last.jumps, s.queue.length], [0, 0, 'glyph-0x42', 1, 0]);
	assert.equal(s.last.result.moved, true);
	await shot('b2-02-simple-undo-twice');
	pass(
		'Simple: trace B, open r, trace r; Undo twice restores both (view jumps 0 then 1, no navigation press)'
	);

	await click('redo');
	await click('redo');
	s = await testPage();
	assert.deepEqual([s.B, s.r, s.open], [1, 1, 'glyph-0x72']);
	pass('Simple: Redo twice puts both back, the view following the letter');

	await click('board');
	await click('undo');
	s = await testPage();
	assert.deepEqual([s.page, s.r, s.last.jumps], ['Overview', 0, 0]);
	assert.deepEqual(s.last.result.showMe, { itemID: 'glyph-0x72', page: 'Characters' });
	assert.equal(await page.locator('#showme').isVisible(), true);
	assert.match(await page.locator('#last').innerText(), /^Undid: Auto-traced/);
	await shot('b2-03-simple-board-show-me');
	await click('showme');
	s = await testPage();
	assert.deepEqual([s.page, s.open], ['Characters', 'glyph-0x72']);
	pass('Simple: on the board Undo stays on the board and offers Show me, which opens small r');

	const before = (await testPage()).queue.length;
	for (const id of ['open-a', 'open-b', 'open-r', 'open-a', 'board', 'open-b']) await click(id);
	s = await testPage();
	assert.equal(s.queue.length, before);
	pass(
		`Simple: opening letters (including one made on demand) adds 0 steps (${before} before and after)`
	);

	await click('letterset');
	await click('rename');
	s = await testPage();
	assert.deepEqual([s.letterSet, s.name], ['quick+numbers', 'Brennan Hand 1']);
	await click('undo');
	await click('undo');
	s = await testPage();
	assert.deepEqual([s.letterSet, s.name], [undefined, 'Two Letters']);
	pass('Simple: the letter-set toggle and the font name each undo as a settings step');

	await page.keyboard.press('Control+z');
	await page.waitForTimeout(100);
	s = await testPage();
	assert.equal(s.B, 0, 'Ctrl+Z undid the trace of B');
	await page.keyboard.press('Control+y');
	await page.waitForTimeout(100);
	assert.equal((await testPage()).B, 1, 'Ctrl+Y redid it');
	pass('Simple: Ctrl+Z / Ctrl+Y take the same path');

	await click('many');
	s = await testPage();
	assert.equal(s.queue.length, 200);
	assert.equal(s.queue[0], 'B width 805');
	await shot('b2-04-simple-cap');
	pass('the Undo list keeps the newest 200 steps');

	// B. All tools, on the test page
	await page.goto(`${pages.origin}/tests/undo.html?ui=all`);
	await page.locator('#mode', { hasText: 'All tools' }).waitFor();
	await click('trace');
	await click('save');
	await click('open-r');
	await click('open-b');
	s = await testPage();
	assert.equal(s.queue.filter((title) => title.startsWith('Navigated')).length, 2);
	assert.equal(s.dot, false);
	assert.equal(await page.locator('[data-key="work file"]').innerText(), 'saved');
	await click('open-r');
	await click('trace');
	assert.equal((await testPage()).dot, true);
	await click('undo');
	s = await testPage();
	assert.deepEqual([s.r, s.dot], [0, false]);
	await shot('b2-05-all-tools-navigation-stays-saved');
	pass(
		'All tools: "Navigated to" steps are kept but a saved work file stays saved; undo back to it clears the dot'
	);

	// E. titles and looking around (B2 finalize)
	await page.goto(`${pages.origin}/tests/undo.html?ui=simple`);
	await page.locator('#mode', { hasText: 'Simple' }).waitFor();
	const lastText = () => page.locator('#last').innerText();
	await click('open-b');
	await click('trace');
	await click('closer');
	await click('undo');
	assert.equal(await lastText(), 'Undid: moved all letters closer');
	assert.match(await page.locator('#redoList').innerText(), /moved all letters closer/);
	assert.doesNotMatch(await page.locator('#redoList').innerText(), /_whole_project/);
	await click('redo');
	assert.equal(await lastText(), 'Redid: moved all letters closer');
	pass(
		'Simple: a whole-font step undoes and redoes as "moved all letters closer" (never the internal marker)'
	);

	await page.goto(`${pages.origin}/tests/undo.html?ui=simple`);
	await page.locator('#mode', { hasText: 'Simple' }).waitFor();
	await click('open-b');
	await click('trace');
	await click('open-r');
	const parts = await page.evaluate(async () => {
		const { insertComponentInstance } = await import('/src/project_editor/cross_item_actions.js');
		const { applyAutoTrace } = await import('/src/anyink/autotrace/apply.js');
		const { showItem } = await import('/src/anyink/preview/show_item.js');
		const { square } = await import('/src/anyink/history/tests/two_letters.js');
		const { editor } = window.anyinkUndoPage;
		insertComponentInstance('glyph-0x42', 'glyph-0x72');
		editor.history.addState('Inserted Capital B into small r');
		showItem(editor, 'glyph-0x42');
		applyAutoTrace({ editor, item: editor.selectedItem, shapes: [square(100, 900)], mode: 'add' });
		const q = editor.history.queue;
		return {
			title: q[0].title,
			whole: q.slice(0, 2).some((entry) => entry.wholeProjectSave),
			sameStep: !!q[0].step && q[1].step === q[0].step,
			items: [q[0].itemID, q[1].itemID],
		};
	});
	assert.equal(parts.whole, false, 'no whole-font copy');
	assert.equal(parts.sameStep, true, 'B and its refit of r are one step');
	assert.deepEqual(parts.items, ['glyph-0x42', 'glyph-0x72']);
	await click('undo');
	assert.equal(await lastText(), `Undid: ${parts.title}`);
	await click('redo');
	assert.equal(await lastText(), `Redid: ${parts.title}`);
	pass(
		`Simple: a trace on B that refits r (made from B) is one step with parts, undone and redone as "${parts.title}"`
	);

	const whole = await page.evaluate(async () => {
		const { applyAutoTrace } = await import('/src/anyink/autotrace/apply.js');
		const { showItem } = await import('/src/anyink/preview/show_item.js');
		const { square } = await import('/src/anyink/history/tests/two_letters.js');
		const { editor } = window.anyinkUndoPage;
		showItem(editor, 'glyph-0x72');
		applyAutoTrace(
			{ editor, item: editor.selectedItem, shapes: [square(150, 700)], mode: 'replace' },
			{ title: 'traced r again' }
		);
		const q = editor.history.queue;
		return { top: !!q[0].wholeProjectSave };
	});
	assert.equal(whole.top, true, 'replacing a part made from B is a whole-font step');
	await click('undo');
	assert.equal(await lastText(), 'Undid: traced r again');
	await click('redo');
	assert.equal(await lastText(), 'Redid: traced r again');
	assert.doesNotMatch(await page.locator('#redoList').innerText(), /_whole_project/);
	await shot('b2-09-simple-titles');
	pass(
		'Simple: a whole-font trace (replacing a part made from another letter) undoes and redoes as "traced r again"'
	);

	await page.goto(`${pages.origin}/tests/undo.html?ui=all`);
	await page.locator('#mode', { hasText: 'All tools' }).waitFor();
	await click('open-b');
	await click('trace');
	await click('browse');
	const readout = (key) => page.locator(`[data-key="${key}"]`).innerText();
	assert.match(await readout('undo steps'), /^1 \(0 whole-font\)/);
	const looks = Number((await readout('looking around')).split(' ')[0]);
	assert.ok(looks <= 30, `"Navigated to" entries kept: ${looks}`);
	assert.equal(
		await page.evaluate(() => window.anyinkUndoPage.editor.history.undoFloor),
		null,
		'nothing dropped off the old end'
	);
	await shot('b2-10-all-tools-after-250-looks');
	let dead = 0;
	let undoPresses = 0;
	for (;;) {
		const before = await testPage();
		if (!before.queue.length || undoPresses > 60) break;
		await click('undo');
		undoPresses++;
		const now = await testPage();
		if (now.B === before.B && now.r === before.r && now.open === before.open) dead++;
	}
	s = await testPage();
	assert.equal(s.B, 0, 'the trace undid');
	assert.equal(dead, 0, `${dead} presses did nothing`);
	pass(
		`All tools: trace B, look at B and r 250 times: 1 step counted, ${looks} "Navigated to" entries kept (at most 30), nothing dropped; ${undoPresses} Undo presses bring B back to empty, none of them doing nothing`
	);

	// C. the real app in Simple
	const appState = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const save = (id) => JSON.stringify(editor.project.glyphs[id]?.save() || null);
			return {
				mode: (await import('/anyink/mode/mode.js')).getMode(),
				page: editor.nav.page,
				open: editor.selectedItemID,
				steps: editor.history.queue.map((entry) => entry.title),
				B: save('glyph-0x42'),
				r: save('glyph-0x72'),
				Bshapes: editor.project.glyphs['glyph-0x42']?.shapes.length || 0,
				rshapes: editor.project.glyphs['glyph-0x72']?.shapes.length || 0,
				toast: document.querySelector('#toast')?.innerText || '',
			};
		});
	const openLetter = async (id) => {
		// B5: Simple has no page chooser (verify_standins.mjs)
		await toOverview(page, 300);
		await page.locator(`glyph-tile[displayed-item-id="${id}"]`).click();
		await waitUntil(async () => (await appState()).open === id, `open ${id}`);
		await page.waitForTimeout(400);
	};
	const drawRectangle = async () => {
		// B4 + B5 integration: tools by their id; Simple's tooltips say "Rectangle (R)". B6 + B7
		// finalize: in Simple's letter view the Rectangle sits inside Fine-tune, which an empty
		// letter doesn't show yet: its key opens Fine-tune and picks it (UX-BEGINNER.md 7.6)
		const rectangle = page.locator('button[data-anyink-tool="newRectangle"]');
		if (await rectangle.isVisible()) {
			await rectangle.click();
		} else {
			await page.evaluate(() => document.activeElement?.blur?.());
			await page.keyboard.press('r');
		}
		await page.mouse.move(960, 330);
		await page.mouse.down();
		await page.mouse.move(1080, 515, { steps: 8 });
		await page.mouse.up();
		await page.waitForTimeout(400);
	};
	await page.goto(`${app.origin}/?ui=simple`);
	await page.locator('#input__new-project-name').fill('B2 Simple');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	let a = await appState();
	assert.equal(a.mode, 'simple');
	for (const id of ['glyph-0x42', 'glyph-0x72', 'glyph-0x65', 'glyph-0x61']) await openLetter(id);
	a = await appState();
	assert.deepEqual(a.steps, [], 'opening four letters adds no step');
	pass('real app ?ui=simple: opening 4 letters from the Overview adds 0 Undo steps');

	await openLetter('glyph-0x42');
	await drawRectangle();
	await openLetter('glyph-0x72');
	await drawRectangle();
	await openLetter('glyph-0x65');
	a = await appState();
	assert.deepEqual([a.Bshapes, a.rshapes], [1, 1]);
	assert.ok(!a.steps.some((title) => title.startsWith('Navigated')), a.steps.join(' | '));
	await shot('b2-06-app-simple-drawn');
	const presses = [];
	let previous = a;
	while (previous.steps.length) {
		await page
			.locator('edit-canvas')
			.click({ position: { x: 20, y: 20 } })
			.catch(() => {});
		await page.keyboard.press('Control+z');
		await page.waitForTimeout(250);
		const now = await appState();
		assert.ok(
			now.B !== previous.B || now.r !== previous.r,
			`press ${presses.length + 1} changed a letter`
		);
		assert.ok(!/Navigated/.test(now.toast), 'no "Navigated without undo-ing" toast');
		presses.push({ open: now.open, B: now.Bshapes, r: now.rshapes });
		previous = now;
		if (presses.length > 20) throw new Error('too many presses');
	}
	assert.equal(presses[0].open, 'glyph-0x72', 'the first press moved the view to small r');
	assert.equal(presses.at(-1).open, 'glyph-0x42', 'the last press is on Capital B');
	assert.deepEqual([previous.Bshapes, previous.rshapes], [0, 0]);
	await shot('b2-07-app-simple-undone');
	pass(
		`real app ?ui=simple: ${presses.length} Ctrl+Z presses, each changed a letter; views ${presses
			.map((p) => p.open.slice(-4))
			.join(' > ')}`
	);

	// D. the real app in All tools: after Save, looking around keeps it saved
	await page.goto(`${app.origin}/?ui=all`); // B16: Simple is the launch default
	await page.locator('#input__new-project-name').fill('B2 All');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await page.evaluate(async () => {
		const folder = await navigator.storage.getDirectory();
		window.showSaveFilePicker = async (options) => {
			const documents = await folder.getDirectoryHandle('Documents', { create: true });
			return documents.getFileHandle(options?.suggestedName || 'Untitled.gs2', { create: true });
		};
	});
	const fileStatus = () =>
		page.evaluate(async () => {
			const { getCurrentProjectEditor } = await import('/app/main.js');
			const { getSaveStatus } = await import('/anyink/files/save_status.js');
			return {
				file: getSaveStatus(getCurrentProjectEditor()).file,
				dot: document.title.includes('•'),
			};
		});
	await openLetter('glyph-0x42');
	await drawRectangle();
	await page.keyboard.press('Control+s');
	await waitUntil(async () => (await fileStatus()).file === 'saved', 'saved to the work file');
	for (const id of ['glyph-0x72', 'glyph-0x65', 'glyph-0x42']) await openLetter(id);
	await page.waitForTimeout(3500); // longer than the autosave interval
	a = await appState();
	assert.equal(a.mode, 'all');
	assert.ok(
		a.steps.filter((title) => title.startsWith('Navigated')).length >= 2,
		a.steps.join(' | ')
	);
	assert.deepEqual(await fileStatus(), { file: 'saved', dot: false });
	await shot('b2-08-app-all-tools-saved-after-looking');
	pass(
		'real app, All tools: after Save, opening 3 letters keeps the work file "saved" with no title dot'
	);

	assert.deepEqual(errors, []);
	pass('no page errors');
} finally {
	await context.close();
	await pages.server.close();
	await app.server.close();
	await rm(profile, { recursive: true, force: true });
}
