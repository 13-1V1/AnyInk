// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 toast track, real-browser check (docs/UX-BEGINNER.md 2.2 "Toasts, one voice", 4.0 Toasts,
// 2.4 G, section 10 B4), in Chrome with a throwaway profile:
//   1. tests/toast.html: All tools draws a toast where and as long as upstream always did (top
//      middle, 3 s, the newest replaces the last); Simple draws it bottom right just above the
//      strip, 6 s, the pointer over it pauses it, an undo toast holds while an info toast waits
//      its turn, a toast with a button holds against info, a message with no words key is
//      dropped, file names are quotes, nothing is in capitals
//   2. the dev app with ?ui=simple, a new font, small a open: the real Merge button says
//      "Merging the shapes..." then "Merged the shapes"; Ctrl+R with Edit points says nothing;
//      a photo is turned away (fix track); Ctrl+S says nothing (the save status does); no message was
//      dropped on the way
//   3. the same steps in All tools keep today's words, except Merge, which both modes share
//   4. fix track (10/14/2026), Simple: a dropped photo is turned away until B9's photo card; a
//      work file and an empty drawing dropped on a letter say what they are; an error toast holds
//      while a tool key's toast waits its turn; an offer ("Couldn't save a backup copy [Save]")
//      keeps its button through a click on the canvas; after a reload, Discard on never-saved
//      work asks "Throw away this unsaved work?" and the Recover tab says "backup copy"
// Usage: node tests/toast.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pressInAllTools } from './verify_standins.mjs';

/** The letter canvas's drawing surface (B4 + B5 finalize: on screen, unlike <edit-canvas>) */
const CANVAS = '#editor-page__edit-canvas canvas';
const repo = fileURLToPath(new URL('..', import.meta.url));
const src = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-toast'));
await mkdir(shots, { recursive: true });

const serve = async (root) => {
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'error',
		cacheDir: resolve(tmpdir(), `anyink-toast-vite-${root === repo ? 'pages' : 'app'}`),
		server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
	});
	await server.listen();
	return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}` };
};
const pages = await serve(repo);
const app = await serve(src);

const numbers = {};
let page;
let errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};

/**
 * Opens a letter on the letter page through the editor, in either mode (the choosers are not
 * what this check is about, and Simple draws none: verify_standins.mjs).
 * @param {String} id - 'glyph-0x61'
 */
const openLetter = async (id) => {
	await page.evaluate(async (glyphId) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = glyphId;
		editor.nav.page = 'Characters';
		editor.navigate();
	}, id);
	await page.locator('#editor-page__edit-canvas').waitFor({ timeout: 15000 });
	await page.waitForTimeout(600);
};

/** The toast the user can read: its words, quotes, place and style. */
const readToast = () =>
	page.evaluate(() => {
		const live = [...document.querySelectorAll('#toast')].filter(
			(el) => !el.hasAttribute('data-leaving') && getComputedStyle(el).display !== 'none'
		);
		const el = live.at(-1);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const style = getComputedStyle(el);
		return {
			count: live.length,
			text: el.innerText.replace(/\s+/g, ' ').trim(),
			simple: el.dataset.anyinkToast === 'simple',
			quotes: [...el.querySelectorAll('.anyink-quote')].map((q) => q.textContent),
			button: el.querySelector('button:not([hidden])')?.textContent ?? null,
			left: Math.round(rect.left),
			top: Math.round(rect.top),
			right: Math.round(window.innerWidth - rect.right),
			bottom: Math.round(window.innerHeight - rect.bottom),
			transform: style.textTransform,
			edge: style.borderLeftColor,
		};
	});

async function withBrowser(run) {
	const profile = await mkdtemp(resolve(tmpdir(), 'anyink-toast-'));
	const context = await chromium.launchPersistentContext(profile, {
		channel: process.env.B4_BROWSER || 'chrome',
		headless: true,
		viewport: { width: 1600, height: 900 },
	});
	page = context.pages()[0] || (await context.newPage());
	errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	try {
		await run();
		assert.deepEqual(errors, [], 'no page errors');
	} finally {
		await context.close();
		await rm(profile, { recursive: true, force: true });
	}
}

try {
	// ----------------------------------------------------------
	// 1. tests/toast.html
	// ----------------------------------------------------------
	await withBrowser(async () => {
		await page.goto(`${pages.origin}/tests/toast.html`);
		await page.locator('body[data-ready="true"]').waitFor({ timeout: 15000 });
		const click = (id) => page.locator(`button[data-try="${id}"]`).click();

		// All tools: upstream's toast, as always
		await click('upstream-6'); // an unmapped message
		let t = await readToast();
		assert.equal(t.text, 'Done! Something new from upstream');
		assert.equal(t.simple, false);
		assert.equal(t.top, 5, 'top middle, as dialogs.css puts it');
		assert.equal(t.left, 520);
		await shot('t01-all-tools-unmapped');
		await click('upstream-2');
		t = await readToast();
		assert.equal(t.text, 'Values were rounded for the selected path points.');
		assert.equal(t.count, 1, 'the newest replaces the last');
		await page.waitForTimeout(3300);
		assert.equal(await readToast(), null, 'gone after its 3 s');
		await click('upstream-0');
		t = await readToast();
		assert.equal(t.text, 'Merging the shapes...', 'Merge is shared: house words in both modes');
		numbers.allTools = { left: t.left, top: t.top };
		pass('All tools: top middle, 3 s, newest replaces, Glyphr words kept, Merge in house words');

		// Simple
		await page.locator('input[name="mode"][value="simple"]').check();
		await page.waitForTimeout(300);
		await click('keyed-1'); // an info toast
		t = await readToast();
		assert.equal(t.text, 'Replaced the photo');
		assert.equal(t.simple, true);
		assert.equal(t.right, 16, 'bottom right: 16 px from the right edge');
		assert.equal(t.bottom, 150 + 16, 'just above the 150 px strip');
		assert.equal(t.transform, 'none', 'sentence case');
		numbers.simple = { right: t.right, bottom: t.bottom };
		await shot('t02-simple-info');
		// hover pauses it
		await page.waitForTimeout(4000);
		await page.locator('#toast[data-anyink-toast="simple"]:not([data-leaving])').hover();
		await page.waitForTimeout(5000);
		assert.equal(
			(await readToast())?.text,
			'Replaced the photo',
			'still up after 9 s with the pointer on it'
		);
		await page.mouse.move(5, 5);
		await page.waitForTimeout(2500);
		assert.equal(await readToast(), null, 'gone about 2 s after the pointer left');
		pass('Simple: bottom right above the strip, 6 s, the pointer over it pauses it');

		// priorities: an undo toast holds; an info toast waits its turn
		await click('keyed-0');
		await page.waitForTimeout(1000);
		await click('keyed-1');
		t = await readToast();
		assert.equal(t.text, 'Brought back small c Redo');
		assert.equal(t.count, 1, 'one at a time');
		await shot('t03-simple-undo-holds');
		await page.waitForTimeout(5400);
		assert.equal((await readToast())?.text, 'Replaced the photo', 'the info toast had its turn');
		pass('Simple: the undo toast held for its 6 s, then the waiting info toast showed');
		await page.locator('#close-all').click();
		await page.waitForTimeout(300);

		// a toast with a button holds against info; pressing it lets the next one show
		await click('keyed-2');
		await click('upstream-1');
		t = await readToast();
		assert.equal(t.text, "Couldn't save a backup copy. Press Save to keep your work. Save");
		assert.equal(t.button, 'Save');
		const warning = await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--warning').trim()
		);
		await shot('t04-simple-button-holds');
		await page.locator('#toast:not([data-leaving]) button').click();
		await page.waitForTimeout(200);
		assert.equal((await readToast())?.text, 'Merged the shapes');
		pass(
			`Simple: a toast with a button held against info (amber edge ${t.edge}, token ${warning})`
		);

		// Simple never says these; an unmapped message is dropped and listed
		await page.locator('#close-all').click();
		await page.waitForTimeout(300);
		for (const id of ['upstream-2', 'upstream-4', 'upstream-6', 'keyed-4']) await click(id);
		await page.waitForTimeout(200);
		assert.equal(await readToast(), null, 'rounding, no more undo, unmapped, Saved: nothing shows');
		const rows = await page.$$eval('#log tbody tr', (trs) =>
			trs.slice(0, 4).map((tr) => [...tr.cells].map((c) => c.textContent))
		);
		assert.deepEqual(
			rows.map((r) => r[4]),
			['all-tools only', 'unmapped', 'never', 'never']
		);
		await shot('t05-simple-dropped-listed');
		pass(
			'Simple: rounding and "No more undo" never show, Saved is the pill, an unmapped message is dropped'
		);

		// file names as quotes
		await click('upstream-5');
		t = await readToast();
		// B14 + B15 finalize: Simple says "Made", as Use in Word's card does
		assert.equal(t.text, 'Made BrennanHand-Regular.otf in Fonts');
		assert.deepEqual(t.quotes, ['BrennanHand-Regular.otf', 'Fonts']);
		await shot('t06-simple-quotes');
		pass('Simple: the font file toast shows its file and folder as quotes');
	});

	// ----------------------------------------------------------
	// 2 and 3. The dev app: Simple, then All tools
	// ----------------------------------------------------------
	const flows = {};
	for (const mode of ['simple', 'all']) {
		await withBrowser(async () => {
			const search = mode === 'simple' ? '?ui=simple' : '';
			await page.goto(`${app.origin}/${search}`);
			await page.locator('#input__new-project-name').fill('Toast Check');
			await page.locator('#button__create-new-project').click();
			await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
			await openLetter('glyph-0x61');
			const said = [];

			// two overlapping squares in small a, then the real Merge button
			await page.evaluate(async () => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				const { Path } = await import('/project_data/path.js');
				const square = (x0, y0) => {
					const corner = (x, y) => ({ p: { coord: { x, y } } });
					return new Path({
						name: 'Square',
						pathPoints: [
							corner(x0, y0),
							corner(x0 + 300, y0),
							corner(x0 + 300, y0 + 300),
							corner(x0, y0 + 300),
						],
					});
				};
				editor.selectedItem.addOneShape(square(100, 0));
				editor.selectedItem.addOneShape(square(250, 150));
				editor.history.addState('two squares');
				editor.navigate();
			});
			await page.waitForTimeout(500);
			// B5: Simple draws no panel, so its Merge icon is pressed through the same code (the
			// Merge Simple keeps in Shape options, B7)
			if (mode === 'simple') await pressInAllTools(page, 'glyphActions', 'combine_unite');
			else await page.locator('button[title^="Combine all paths: Unite"]').first().click();
			let t = await readToast();
			said.push(t.text);
			assert.equal(t.text, 'Merging the shapes...');
			await waitUntil(async () => (await readToast())?.text === 'Merged the shapes', 'merged');
			await page.waitForTimeout(400); // its slide-in has finished
			t = await readToast();
			said.push(t.text);
			await shot(`a${mode === 'simple' ? 1 : 5}-${mode}-merged`);
			const shapes = await page.evaluate(
				async () =>
					(await import('/app/main.js')).getCurrentProjectEditor().selectedItem.shapes.length
			);
			assert.equal(shapes, 1, 'the two squares are one shape');
			if (mode === 'simple') assert.equal(t.simple && t.bottom, 150 + 16);
			pass(`${mode}: the real Merge button says "Merging the shapes..." then "Merged the shapes"`);

			// Ctrl+R with Edit points
			await page.evaluate(async () => {
				const { closeAllToasts } = await import('/controls/dialogs/dialogs.js');
				closeAllToasts();
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				editor.multiSelect.points.selectAll?.();
				(await import('/edit_canvas/tools/tools.js')).selectTool('pathEdit');
			});
			await page.waitForTimeout(400);
			await page.locator(CANVAS).hover();
			await page.keyboard.press('Control+r');
			await page.waitForTimeout(500);
			t = await readToast();
			if (mode === 'simple') assert.equal(t, null, 'Simple: Ctrl+R says nothing');
			else assert.equal(t?.text, 'Values were rounded for the selected path points.');
			said.push(t?.text ?? '(nothing)');
			pass(
				`${mode}: Ctrl+R with Edit points ${mode === 'simple' ? 'says nothing' : 'keeps its words'}`
			);

			// a photo, through the real import (Chrome decodes it)
			await page.evaluate(async () => {
				const canvas = new OffscreenCanvas(300, 400);
				const ctx = canvas.getContext('2d');
				ctx.fillStyle = 'white';
				ctx.fillRect(0, 0, 300, 400);
				ctx.fillStyle = 'black';
				ctx.fillRect(100, 100, 100, 200);
				const blob = await canvas.convertToBlob({ type: 'image/png' });
				const file = new File([blob], 'a-photo.png', { type: 'image/png' });
				const { importTraceImage } = await import('/anyink/trace/trace_import.js');
				window.__added = await importTraceImage(file);
			});
			await waitUntil(
				async () => /photo|trace image/.test((await readToast())?.text ?? ''),
				'photo toast'
			);
			t = await readToast();
			said.push(t.text);
			if (mode === 'simple') {
				// fix track: until B9's photo card, Simple turns a photo away with what to do instead
				assert.equal(
					t.text,
					"ANY-INK can't use photos yet. Draw the letter with the Rectangle, Oval or Point pen for now."
				);
				assert.equal(await page.evaluate(() => window.__added), false, 'no photo was added');
			} else {
				assert.match(t.text, /^Added a trace image\. Press Start auto-trace/);
			}
			await shot(`a${mode === 'simple' ? 2 : 6}-${mode}-photo`);
			pass(`${mode}: adding a photo says "${t.text.slice(0, 48)}..."`);

			// Ctrl+S to a work file (Chrome's own file system stands in for the save picker)
			await page.evaluate(async () => {
				const { closeAllToasts } = await import('/controls/dialogs/dialogs.js');
				closeAllToasts();
				const folder = await navigator.storage.getDirectory();
				const handle = await folder.getFileHandle('Toast Check.gs2', { create: true });
				window.showSaveFilePicker = async () => handle;
			});
			await page.waitForTimeout(300);
			await page.locator(CANVAS).hover();
			await page.keyboard.press('Control+s');
			const status = () =>
				page.evaluate(
					() => document.querySelector('#app__top-bar anyink-save-status')?.textContent.trim() ?? ''
				);
			await waitUntil(async () => /saved/i.test(await status()), 'the save status says saved');
			await page.waitForTimeout(300);
			t = await readToast();
			if (mode === 'simple') assert.equal(t, null, 'Simple: no Saved toast');
			else assert.equal(t?.text, 'Saved Toast Check.gs2');
			said.push(t?.text ?? '(nothing)');
			await shot(`a${mode === 'simple' ? 3 : 7}-${mode}-saved`);
			pass(
				`${mode}: Ctrl+S ${
					mode === 'simple'
						? 'shows no toast; the save status says'
						: 'keeps its toast and the status says'
				} "${await status()}"`
			);

			const log = await page.evaluate(async () => {
				const { droppedToasts, toastLog } = await import('/anyink/toast/toast.js');
				return {
					dropped: droppedToasts(),
					log: toastLog().map((r) => `${r.reason}: ${r.key ?? '-'}`),
				};
			});
			if (mode === 'simple') assert.deepEqual(log.dropped, [], 'no message dropped on the way');
			flows[mode] = { said, log: log.log, dropped: log.dropped };
			pass(`${mode}: ${log.dropped.length} messages dropped; the log: ${log.log.join(', ')}`);
		});
	}
	numbers.flows = flows;

	// ----------------------------------------------------------
	// 4. Fix track (10/14/2026): the dev app in Simple
	// ----------------------------------------------------------
	await withBrowser(async () => {
		await page.goto(`${app.origin}/?ui=simple`);
		await page.locator('#input__new-project-name').fill('Never Saved');
		await page.locator('#button__create-new-project').click();
		await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
		await openLetter('glyph-0x62');
		/** Takes every toast down and lets the last one finish fading out. */
		const clear = async () => {
			await page.evaluate(async () =>
				(await import('/anyink/toast/toast.js')).resetToastsForTests()
			);
			await page.waitForTimeout(300);
		};

		/** Drags a file over the letter and drops it, as Chrome hands a drop over. */
		const drop = (name, type, body) =>
			page.evaluate(
				async ({ name, type, body }) => {
					let parts = [body];
					if (type === 'image/png') {
						const canvas = new OffscreenCanvas(200, 300);
						const ctx = canvas.getContext('2d');
						ctx.fillStyle = 'white';
						ctx.fillRect(0, 0, 200, 300);
						ctx.fillStyle = 'black';
						ctx.fillRect(60, 60, 80, 180);
						parts = [await canvas.convertToBlob({ type })];
					}
					const data = new DataTransfer();
					data.items.add(new File(parts, name, { type }));
					const target = document.querySelector('#editor-page__edit-canvas');
					const fire = (kind) =>
						target.dispatchEvent(
							new DragEvent(kind, { dataTransfer: data, bubbles: true, cancelable: true })
						);
					fire('dragenter');
					fire('drop');
				},
				{ name, type, body }
			);

		// a photo, a work file and an empty drawing dropped on small b
		await drop('handwriting.png', 'image/png', '');
		await waitUntil(async () => /photos yet/.test((await readToast())?.text ?? ''), 'refused');
		let t = await readToast();
		assert.equal(t.count, 1, 'the drag-over hint gave way to the drop at once');
		const trace = await page.evaluate(
			async () =>
				!!(await import('/app/main.js')).getCurrentProjectEditor().selectedItem.anyink?.trace
		);
		assert.equal(trace, false, 'no photo under small b');
		await page.waitForTimeout(500); // its slide-in has finished
		await shot('f01-simple-photo-turned-away');
		pass(`Simple: a dropped photo is turned away: "${t.text}"`);

		await clear();
		await drop('Brennan Hand.gs2', '', '{"projectSettings":{}}');
		await page.waitForTimeout(200);
		t = await readToast();
		assert.equal(t.text, "That's an ANY-INK work file. To open it, press Ctrl+O.");
		assert.equal(t.count, 1);
		await page.waitForTimeout(500); // its slide-in has finished
		await shot('f02-simple-work-file-dropped');
		pass(`Simple: a work file dropped on a letter says "${t.text}"`);

		await clear();
		await drop('empty.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		await waitUntil(async () => /no shapes/.test((await readToast())?.text ?? ''), 'empty drawing');
		t = await readToast();
		assert.equal(t.text, 'That drawing has no shapes ANY-INK can use.');
		assert.equal(await page.locator('#error').count(), 0, "no reader's error box as well");
		await page.waitForTimeout(500); // its slide-in has finished
		await shot('f03-simple-empty-drawing');
		pass(`Simple: an empty drawing says "${t.text}"`);

		// an error toast holds; the tool key's toast waits its turn (4.0)
		await clear();
		await page.evaluate(async () => {
			const { toast } = await import('/anyink/toast/toast.js');
			toast('toast.saveNotAllowed', { file: 'Brennan Hand.gs2' }, { quotes: ['file'] });
		});
		await page.locator(CANVAS).hover();
		await page.waitForTimeout(50);
		await page.keyboard.press('r');
		await page.waitForTimeout(300);
		t = await readToast();
		assert.equal(t.text, "ANY-INK wasn't allowed to write Brennan Hand.gs2. Choose a new file.");
		const tool = await page.evaluate(
			async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedTool
		);
		await shot('f04-simple-error-holds');
		await waitUntil(
			async () => /^Switched to /.test((await readToast())?.text ?? ''),
			'the tool toast had its turn',
			9000
		);
		t = await readToast();
		pass(`Simple: the error held its 6 s (R picked ${tool}); then "${t.text}" had its turn`);

		// an offer keeps its button through a click on the canvas
		await clear();
		await page.evaluate(async () => {
			const { toast } = await import('/anyink/toast/toast.js');
			window.__saved = 0;
			toast(
				'toast.backupFailed',
				{},
				{ tone: 'warning', action: { key: 'term.save', run: () => window.__saved++ } }
			);
		});
		// B4 + B5 finalize (critic: the step clicked off screen, below the window, so it proved
		// nothing): the click lands on the drawing surface, and the canvas hears it
		const box = await page.locator(CANVAS).boundingBox();
		const point = { x: box.x + 200, y: Math.min(box.y + 200, 700) };
		const landed = await page.evaluate(({ x, y }) => {
			const hit = document.elementFromPoint(x, y);
			window.__canvasPresses = 0;
			document
				.querySelector('#editor-page__edit-canvas')
				.addEventListener('mousedown', () => window.__canvasPresses++, true);
			return !!hit?.closest?.('#editor-page__edit-canvas');
		}, point);
		assert.equal(landed, true, 'the click point is on the letter canvas');
		await page.mouse.click(point.x, point.y);
		await page.waitForTimeout(300);
		assert.equal(await page.evaluate(() => window.__canvasPresses), 1, 'the canvas heard the click');
		t = await readToast();
		assert.equal(t?.text, "Couldn't save a backup copy. Press Save to keep your work. Save");
		await shot('f05-simple-offer-kept-after-click');
		await page.locator('#toast[data-anyink-toast="simple"]:not([data-leaving]) button').click();
		assert.equal(await page.evaluate(() => window.__saved), 1);
		pass('Simple: a click on the canvas left "Couldn\'t save a backup copy [Save]"; Save worked');

		// a never-saved font with ink, then a reload: the Recover card asks before throwing away
		await page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { Path } = await import('/project_data/path.js');
			const corner = (x, y) => ({ p: { coord: { x, y } } });
			editor.selectedItem.addOneShape(
				new Path({
					pathPoints: [corner(100, 0), corner(400, 0), corner(400, 500), corner(100, 500)],
				})
			);
			editor.history.addState('a rectangle');
		});
		await waitUntil(
			() =>
				page.evaluate(
					async () => (await import('/anyink/recovery/recovery.js')).getRecoveryStatus().writes > 0
				),
			'a backup copy was kept',
			20000
		);
		// ANY-INK closes before the work is saved (the tab goes, past its leave warning); a new
		// tab in the same browser profile opens the start page
		const closing = page;
		page = await closing.context().newPage();
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(`console: ${message.text()}`);
		});
		await closing.close({ runBeforeUnload: false });
		await page.goto(`${app.origin}/?ui=simple`);
		const row = page.locator('.anyink-recovery-row:has-text("Never Saved")').first();
		await row.waitFor({ timeout: 15000 });
		assert.equal(await row.locator('.anyink-recovery-row__badge').count(), 0, 'no work file');
		await shot('f06-simple-recover-never-saved');
		await row.locator('.anyink-recovery-row__discard').click();
		const confirm = page.locator('dialog#modal-dialog .anyink-recovery-confirm');
		await confirm.waitFor({ timeout: 5000 });
		const asked = (await confirm.innerText()).replace(/\s+/g, ' ').trim();
		assert.equal(
			asked,
			"Throw away this unsaved work? This can't be undone. Throw it away Keep it"
		);
		const green = await confirm.evaluate((el) =>
			[...el.querySelectorAll('fancy-button')]
				.filter((b) => !b.hasAttribute('secondary'))
				.map((b) => b.textContent)
		);
		assert.deepEqual(green, ['Keep it'], 'one green button: Keep it');
		await page.waitForTimeout(800); // the box has faded in
		await shot('f07-simple-throw-away-confirm');
		await confirm.locator('[data-anyink-choice="keep"]').click();
		await page.waitForTimeout(400);
		assert.equal(await row.isVisible(), true, 'Keep it kept the backup copy');
		await row.locator('.anyink-recovery-row__discard').click();
		await confirm.waitFor({ timeout: 5000 });
		await page.locator('dialog#modal-dialog [data-anyink-choice="throw-away"]').last().click();
		await waitUntil(
			async () =>
				(await page.locator('.anyink-recovery-row:has-text("Never Saved")').count()) === 0,
			'the row went after Throw it away'
		);
		await page.locator('#open-project__tab-recover').click();
		await page.waitForTimeout(300);
		const empty = (await page.locator('#tab-content__recover').innerText()).replace(/\s+/g, ' ');
		assert.match(empty, /ANY-INK keeps a backup copy every few seconds while you work\./);
		assert.doesNotMatch(empty, /snapshot/i);
		await shot('f08-simple-recover-tab-empty');
		pass(
			'Simple: Discard on never-saved work asked first; Keep it kept it; Throw it away threw it'
		);
	});

	await writeFile(resolve(shots, 'numbers.json'), JSON.stringify(numbers, null, '\t'));
	console.log(`screenshots and numbers.json in ${shots}`);
} finally {
	await pages.server.close();
	await app.server.close();
}
