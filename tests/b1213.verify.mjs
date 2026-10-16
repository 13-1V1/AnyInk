// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 + B13 integration real-browser check (docs/UX-BEGINNER.md 4.1 the start screen, 4.6 Try it,
// 7.4 / 7.5 confirmations and recovery; section 10 B12 and B13), in the real app on a Vite dev
// server, Chrome with a throwaway context, 1600 x 900, the feature flags as the app ships them
// ('tryIt' and 'startScreen' on now), Simple by ?ui=simple. Windows' save box is stood in for by
// one that is cancelled (Chrome headless has no save box to press Cancel in):
//   A. Opening the app: the start screen, "Make a new font" with [Create my font] the one green
//      button, no banned word (strict)
//   B. Create my font with the save box cancelled: the board opens under the typed name, with no
//      work file ("Not saved yet")
//   C. A handwriting photo (B r e n a H d) dropped on the board, walked into seven letters
//   D. The rail's step 2: Try it opens under the top bar, his words big (72 pt), "Brennan Hand"
//      as he wrote it; typing "Brennan Hand today" shows stand-ins for t, o and y with the
//      legend; one green button; no banned word
//   E. The e|n gap: the purple handle, a real mouse drag closer: one whole-font step, a toast with
//      [Undo], "Word needs one setting for gap fixes. Use in Word will show you." (B14 on) and "Gaps you fixed (1)"; Ctrl+Z puts the
//      gap back and the page, the letter and Try it stay where they were
//   F. Move all letters closer or further apart: the slider dragged closer, live, one step on
//      release ("moved all letters closer")
//   G. [Done] closes Try it; the board is still there
//   H. A reload with unsaved work: the start screen's crash card (no work file) with exactly one
//      green button, [Continue with it]; it brings the seven letters back
//   I. All tools (no ?ui): the four tabs in Glyphr Studio's words, Create opens the Overview, the
//      rail's Try it door does nothing, no start screen, no Try it
// Usage: node tests/b1213.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b1213'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b1213-'));
const FIXTURES = '/anyink/photo/tests/fixtures';

const server = await createServer({
	root: resolve(repo, 'src'),
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

const browser = await chromium.launch({
	channel: process.env.B1213_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let leaveAsked = 0;
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);

async function freshPage(label, context) {
	const p = await context.newPage();
	p.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
	p.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
	});
	// a reload with unsaved work: Chrome's "Leave site?" (7.5); he leaves anyway
	p.on('dialog', (dialog) => {
		if (dialog.type() === 'beforeunload') {
			leaveAsked += 1;
			dialog.accept();
		} else dialog.dismiss();
	});
	return p;
}
async function newContext() {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	// Windows' save box, cancelled: what he does when he presses Cancel in it
	await context.addInitScript(() => {
		window.showSaveFilePicker = async () => {
			throw new DOMException('The user aborted a request.', 'AbortError');
		};
	});
	return context;
}
const shot = async (name) => {
	await page.screenshot({ path: resolve(shots, `${name}.png`) });
	shotList.push(`${name}.png`);
};
const offCanvas = () => page.mouse.move(5, 895);
const waitUntil = async (check, what, timeout = 20000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
const editorState = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		// a whole-font step is two entries (before and after): count it once
		const q = editor.history.queue.filter((e) => !/_post_state_$/.test(e.title));
		return {
			page: editor.nav.page,
			item: editor.selectedItemID,
			name: editor.project?.settings?.project?.name,
			file: !!editor.loadedFileHandle,
			steps: q.length,
			top: q[0]?.title || '',
		};
	});
const screen = () =>
	page.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const coach = document.querySelector('anyink-coach');
		return {
			rail: text(document.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			greens: [
				...document.querySelectorAll(
					'.anyink-primary, fancy-button:not([secondary]):not([minimal]):not([danger]):not([disabled])'
				),
			]
				.filter(shown)
				.map(text),
			toast: text(
				document.querySelector(
					'#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__text'
				)
			),
			toastButtons: [
				...document.querySelectorAll(
					'#toast[data-anyink-toast="simple"]:not([data-leaving]) button'
				),
			].map(text),
			status: text(document.querySelector('anyink-save-status')),
		};
	});
const scanSimple = (selector = 'body') =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);
const photoDrawn = () =>
	waitUntil(
		() =>
			page.evaluate(() => {
				const loading = document.querySelector(
					'[data-anyink-dialog="photoDialog"] .anyink-photo-dialog__loading'
				);
				return !!loading && loading.hidden;
			}),
		'the photo drawn in the dialog'
	);
const dropOn = (selector, { url, name, type }) =>
	page.evaluate(
		async ({ sel, url: u, name: n, type: t }) => {
			const blob = await (await fetch(u)).blob();
			const file = new File([blob], n, { type: t });
			const transfer = new DataTransfer();
			transfer.items.add(file);
			const target = document.querySelector(sel);
			target.dispatchEvent(
				new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer })
			);
			const event = new DragEvent('drop', {
				bubbles: true,
				cancelable: true,
				dataTransfer: transfer,
			});
			target.dispatchEvent(event);
			return event.defaultPrevented;
		},
		{ sel: selector, url, name, type }
	);
const tryIt = () =>
	page.evaluate(async () => {
		const { isTryItOpen } = await import('/anyink/tryit/expand.js');
		const { isStandIn } = await import('/anyink/tryit/stand_ins.js');
		const strip = document.querySelector('preview-strip');
		const data = strip?.renderer?.textBlock?.data || [];
		const chars = data.flat ? data.flat() : [];
		const rect = strip.getBoundingClientRect();
		const legend = [...strip.querySelectorAll('*')].find(
			(el) => el.textContent.trim() === 'gray = not made yet' && el.children.length === 0
		);
		return {
			open: isTryItOpen(),
			top: Math.round(rect.top),
			height: Math.round(rect.height),
			text: strip.options?.text,
			pt: strip.querySelector('.preview-strip__size-value, [data-anyink-strip="size"]')
				?.textContent,
			standIns: chars.filter((c) => c?.item && isStandIn(c.item)).map((c) => c.char),
			legend: !!legend && legend.checkVisibility(),
			check: strip.querySelector('.anyink-tryit-check__text')?.textContent || '',
		};
	});

let context = await newContext();
try {
	// ------------------------------------------------------------------
	// A. Opening the app: the start screen
	// ------------------------------------------------------------------
	page = await freshPage('simple', context);
	await page.goto(`${origin}/?ui=simple`);
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await settle(800);
	let s = await screen();
	assert.deepEqual(s.greens, ['Create my font'], 'one green: Create my font');
	assert.equal(await page.locator('.open-project__tab').count(), 0, 'no tabs');
	assert.deepEqual(await scanSimple(), []);
	await shot('A1-start-screen');
	pass(
		`A: the app opens on the start screen; one green button [${s.greens}]; no tabs; 0 banned words (strict)`
	);

	// ------------------------------------------------------------------
	// B. Create my font, save box cancelled
	// ------------------------------------------------------------------
	await page.locator('#input__new-project-name').fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await settle(1200);
	let st = await editorState();
	s = await screen();
	assert.equal(st.name, 'Brennan Hand');
	assert.equal(st.file, false, 'no work file');
	assert.equal(await page.locator('.anyink-start').count(), 0);
	await shot('B1-board-after-cancelled-save-box');
	pass(
		`B: Create my font with the save box cancelled opened the board for "${st.name}", no work file, status "${s.status}"`
	);

	// ------------------------------------------------------------------
	// C. Letters from a photo
	// ------------------------------------------------------------------
	const key = await page.evaluate(
		async (base) => (await fetch(`${base}/brenna-loose-phone.json`)).json(),
		FIXTURES
	);
	assert.equal(
		await dropOn('.anyink-board__sections', {
			url: `${FIXTURES}/brenna-loose-phone.jpg`,
			name: 'IMG_2041.jpg',
			type: 'image/jpeg',
		}),
		true,
		'the board takes the drop'
	);
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 30000 });
	await photoDrawn();
	await settle(500);
	const walked = [];
	for (let n = 0; n < key.letters.length; n++) {
		const info = await page.evaluate(async () => {
			const dialog = document.querySelector('[data-anyink-dialog="photoDialog"]');
			const picked = dialog.querySelector('[data-anyink-picked]')?.getAttribute('data-anyink-part');
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { getPhoto } = await import('/anyink/photo/photo_registry.js');
			const asset = Object.keys(editor.project.settings.anyink.photos)[0];
			return { part: getPhoto(editor.project, asset).parts.find((p) => p.id === picked) };
		});
		const letter = key.letters.find(
			(l) =>
				l.center[0] >= info.part.left &&
				l.center[0] < info.part.right &&
				l.center[1] >= info.part.top &&
				l.center[1] < info.part.bottom
		);
		assert.ok(letter, `the green box holds a letter: ${JSON.stringify(info.part)}`);
		await page.locator('[data-anyink-photo-field]').focus();
		await page.keyboard.press(letter.char);
		await settle(150);
		await page.locator('[data-anyink-photo-action="trace"]').click();
		await waitUntil(
			() =>
				page.evaluate(async () => {
					const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
					const flow = getFlow((await import('/app/main.js')).getCurrentProjectEditor());
					return !!flow && flow.status === 'ready';
				}),
			`step C for ${letter.char}`,
			30000
		);
		await settle(300);
		await page.locator('[data-anyink-photo-card-action="useIt"]').click();
		await waitUntil(
			() =>
				page.evaluate(async () => {
					const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
					return !getFlow((await import('/app/main.js')).getCurrentProjectEditor());
				}),
			`Use it for ${letter.char}`
		);
		await settle(400);
		walked.push(letter.char);
		if (n < key.letters.length - 1) {
			s = await screen();
			for (let guard = 0; guard < 6 && !/more letter/.test(s.sentence || ''); guard++) {
				await page.locator('anyink-coach .anyink-coach__else').click();
				await settle(250);
				s = await screen();
			}
			assert.match(s.sentence, /This photo has \d+ more letter/);
			await page.locator('anyink-coach .anyink-coach__button').click();
			await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
			await photoDrawn();
			await settle(300);
		}
	}
	await page.locator('[data-anyink-control="logo"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(700);
	s = await screen();
	assert.equal(s.rail, '7/58');
	await shot('C1-board-seven-letters-from-a-photo');
	pass(`C: a photo dropped on the board walked into ${walked.join(' ')}; the rail says ${s.rail}`);

	// ------------------------------------------------------------------
	// D. Try it from the rail's step 2
	// ------------------------------------------------------------------
	const stepsBeforeTryIt = (await editorState()).steps;
	await page.locator('[data-anyink-step="tryIt"]').click();
	await waitUntil(async () => (await tryIt()).open, 'Try it open');
	await offCanvas();
	await settle(900);
	let t = await tryIt();
	const barBottom = await page.evaluate(() =>
		Math.round(document.querySelector('#app__top-bar').getBoundingClientRect().bottom)
	);
	assert.equal(t.text, 'Brennan Hand', 'his font name, as he wrote it');
	assert.ok(Math.abs(t.top - barBottom) <= 1, `under the top bar (${t.top} vs ${barBottom})`);
	assert.ok(t.height > 600, `fills the page area (${t.height} px)`);
	assert.deepEqual(t.standIns, [], 'every letter of his name is made');
	const pt = await page.evaluate(async () => {
		const { getPref } = await import('/anyink/prefs/prefs.js');
		return getPref('tryItPt') ?? 72;
	});
	assert.equal(pt, 72);
	await shot('D1-try-it-his-name');
	await page.evaluate(() => {
		const strip = document.querySelector('preview-strip');
		strip.textInput.value = 'Brennan Hand today';
		strip.textInput.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await settle(900);
	t = await tryIt();
	assert.deepEqual([...new Set(t.standIns)].sort(), ['o', 't', 'y']);
	// the legend shows only while fewer than 5 letters are ready; he has 7
	assert.equal(t.legend, false, 'no legend with 7 ready');
	s = await screen();
	assert.equal(s.greens.length, 1, `one green: ${JSON.stringify(s.greens)}`);
	assert.deepEqual(await scanSimple('preview-strip'), []);
	await shot('D2-try-it-stand-ins');
	pass(
		`D: the rail's step 2 opened Try it under the top bar (${t.top} px, ${
			t.height
		} px tall, ${pt} pt) with "Brennan Hand"; "Brennan Hand today" shows stand-ins for ${[
			...new Set(t.standIns),
		].join(' ')}; one green [${s.greens}]; check line "${t.check}"; 0 banned words`
	);
	assert.equal((await editorState()).steps, stepsBeforeTryIt, 'opening Try it is no Undo step');
	const rail = await page.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-step][aria-current="step"]')].map(
			(el) => el.dataset.anyinkStep
		)
	);
	assert.deepEqual(rail, ['tryIt'], 'step 2 is the current step');
	pass(`D: the rail marks step 2 as current while Try it is open; opening it was no Undo step`);

	// ------------------------------------------------------------------
	// E. The e|n gap: drag closer, then Ctrl+Z
	// ------------------------------------------------------------------
	const where0 = await editorState();
	const gapAt = () =>
		page.evaluate(async () => {
			const { stripLayout, findGapAtPoint } = await import('/anyink/tryit/gap_handle.js');
			const layout = stripLayout(document.querySelector('preview-strip'));
			const rect = layout.canvas.getBoundingClientRect();
			for (const line of layout.data) {
				const i = line.findIndex((c, k) => c.char === 'e' && line[k + 1]?.char === 'n');
				if (i < 0) continue;
				const n = line[i + 1];
				const y = n.view.dy - 150 * n.view.dz;
				return {
					x: rect.left + n.view.dx,
					y: rect.top + y,
					hit: !!findGapAtPoint(layout.data, n.view.dx, y, layout.font),
				};
			}
			return null;
		});
	const gap = await gapAt();
	assert.ok(gap?.hit, `the e|n gap is found on the sheet: ${JSON.stringify(gap)}`);
	await page.mouse.move(gap.x - 40, gap.y);
	await page.mouse.move(gap.x + 1, gap.y, { steps: 4 });
	await settle(250);
	const handle = page.locator('.anyink-gap-handle');
	assert.equal(await handle.isVisible(), true, 'the purple handle shows');
	assert.equal(await handle.getAttribute('title'), 'drag to close or open this gap');
	const color = await handle.evaluate((el) => getComputedStyle(el).backgroundColor);
	assert.equal(color, 'rgb(124, 58, 237)');
	await shot('E1-gap-handle');
	const hb = await handle.boundingBox();
	const hx = hb.x + hb.width / 2;
	const hy = hb.y + hb.height / 2;
	const wordsAt = () =>
		page.evaluate(() => {
			const strip = document.querySelector('preview-strip');
			const first = strip.renderer?.textBlock?.data?.[0]?.[0];
			const top = strip.renderer?.canvas?.getBoundingClientRect().top || 0;
			return Math.round((top + (first?.view?.dy || 0)) * 10) / 10;
		});
	await page.mouse.move(hx, hy);
	const wordsBefore = await wordsAt();
	await page.mouse.down();
	await page.mouse.move(hx - 4, hy, { steps: 3 });
	await settle(100);
	const wordsMid = await wordsAt();
	assert.equal(wordsMid, wordsBefore, `the words stay under the pointer on the first drag tick (${wordsBefore} -> ${wordsMid})`);
	const live = await page.evaluate(async () => {
		const { kernOffsetFor } = await import('/anyink/kerning/kern_lookup.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return {
			kern: kernOffsetFor(editor.project, 'e', 'n'),
			steps: editor.history.queue.filter((e) => !/_post_state_$/.test(e.title)).length,
		};
	});
	assert.ok(live.kern < 0, `live while dragging (${JSON.stringify(live)})`);
	assert.equal(live.steps, where0.steps, 'no step while dragging');
	await page.mouse.move(hx - 8, hy, { steps: 3 });
	await page.mouse.up();
	await settle(500);
	const fixed = await page.evaluate(async () => {
		const { kernOffsetFor, onePairFixes } = await import('/anyink/kerning/kern_lookup.js');
		const { historyText } = await import('/anyink/words/history_text.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const note = document.querySelector('.anyink-word-note');
		return {
			kern: kernOffsetFor(editor.project, 'e', 'n'),
			fixes: onePairFixes(editor.project).length,
			steps: editor.history.queue.filter((e) => !/_post_state_$/.test(e.title)).length,
			title: historyText(editor.history.queue.find((e) => !/_post_state_$/.test(e.title))?.title),
			itemID: editor.history.queue.find((e) => !/_post_state_$/.test(e.title))?.itemID,
			note:
				note && note.checkVisibility({ visibilityProperty: true }) ? note.textContent.trim() : '',
			list: document.querySelector('.anyink-gap-list summary')?.textContent.trim(),
		};
	});
	s = await screen();
	assert.equal(fixed.fixes, 1);
	assert.equal(fixed.steps, where0.steps + 1, 'one Undo step');
	assert.equal(fixed.title, 'moved small e and small n closer');
	assert.ok(!fixed.itemID, 'a whole-font step about no letter');
	// B14 + B15 integration: Use in Word is on now, so the note points at it
	assert.equal(fixed.note, 'Word needs one setting for gap fixes. Use in Word will show you.');
	assert.equal(fixed.list, 'Gaps you fixed (1)');
	assert.match(s.toast || '', /small e and small n closer/);
	assert.deepEqual(s.toastButtons, ['Undo']);
	await page.evaluate(() => {
		const list = document.querySelector('.anyink-gap-list');
		if (list) list.open = true;
	});
	await settle(200);
	await shot('E2-after-gap-fix-word-note');
	pass(
		`E: the purple handle (${color}, "drag to close or open this gap"); a real drag closer was live (kern ${live.kern}, no step) and on release one step "${fixed.title}" (kern ${fixed.kern}), toast "${s.toast}" [${s.toastButtons}], the note "${fixed.note}", "${fixed.list}"`
	);
	await page.mouse.move(5, 300);
	await page.keyboard.press('Control+z');
	await settle(600);
	const undone = await page.evaluate(async () => {
		const { kernOffsetFor } = await import('/anyink/kerning/kern_lookup.js');
		const { isTryItOpen } = await import('/anyink/tryit/expand.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const note = document.querySelector('.anyink-word-note');
		return {
			kern: kernOffsetFor(editor.project, 'e', 'n'),
			page: editor.nav.page,
			item: editor.selectedItemID,
			open: isTryItOpen(),
			note: !!note && note.checkVisibility({ visibilityProperty: true }),
		};
	});
	assert.equal(undone.kern, 0, 'the gap is back');
	assert.equal(undone.page, where0.page, 'Undo did not change the page');
	assert.equal(undone.item, where0.item, 'Undo did not open another letter');
	assert.equal(undone.open, true, 'Try it stays open');
	await shot('E3-after-undo');
	pass(
		`E: Ctrl+Z put the gap back (kern ${undone.kern}); the page (${undone.page}), the letter (${undone.item}) and Try it stayed where they were`
	);

	// ------------------------------------------------------------------
	// F. Move all letters closer or further apart
	// ------------------------------------------------------------------
	await page.locator('.anyink-tryit-spacing summary').click();
	await settle(300);
	const slider = page.locator('.anyink-tryit-spacing input[type=range]');
	assert.equal(await slider.isVisible(), true);
	const widthOf = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			return ['e', 'n', 'a'].map(
				(c) =>
					editor.project.getItem(`glyph-0x${c.charCodeAt(0).toString(16).toUpperCase()}`)
						.advanceWidth
			);
		});
	const before = await widthOf();
	const steps0 = (await editorState()).steps;
	const sb = await slider.boundingBox();
	await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
	await page.mouse.down();
	await page.mouse.move(sb.x + sb.width * 0.35, sb.y + sb.height / 2, { steps: 4 });
	const mid = { widths: await widthOf(), steps: (await editorState()).steps };
	await page.mouse.up();
	await settle(500);
	const spaced = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getExtra } = await import('/anyink/spacing/extra.js');
		const { historyText } = await import('/anyink/words/history_text.js');
		return {
			extra: getExtra(editor.project),
			steps: editor.history.queue.filter((e) => !/_post_state_$/.test(e.title)).length,
			title: historyText(editor.history.queue.find((e) => !/_post_state_$/.test(e.title))?.title),
		};
	});
	const after = await widthOf();
	assert.ok(
		mid.widths.every((w, i) => w < before[i]),
		`live: ${before} -> ${mid.widths}`
	);
	assert.equal(mid.steps, steps0, 'no step while dragging');
	assert.ok(spaced.extra < 0);
	assert.equal(spaced.steps, steps0 + 1, 'one step on release');
	assert.equal(spaced.title, 'moved all letters closer');
	await shot('F1-letter-spacing-closer');
	pass(
		`F: the letter spacing slider moved letters closer live (e n a widths ${before} -> ${after}, no step mid-drag) and recorded one step "${spaced.title}" (extra ${spaced.extra})`
	);

	// ------------------------------------------------------------------
	// G. Done closes Try it
	// ------------------------------------------------------------------
	await page.locator('.anyink-tryit__done').click();
	await settle(500);
	t = await tryIt();
	assert.equal(t.open, false);
	assert.equal(await page.locator('[data-anyink-board]').isVisible(), true);
	await shot('G1-done-back-to-the-board');
	pass(`G: [Done] closed Try it; the board shows again (strip ${t.height} px)`);

	// ------------------------------------------------------------------
	// H. Reload with unsaved work: the crash card, one green
	// ------------------------------------------------------------------
	await page.evaluate(async () => {
		const { snapshotNow } = await import('/anyink/recovery/recovery.js');
		await snapshotNow('verify');
	});
	await settle(4000); // and the debounced backup has had its time too
	await page.reload();
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await page.locator('[data-anyink-card]').waitFor({ timeout: 20000 });
	await settle(800);
	s = await screen();
	const card = await page.evaluate(() => {
		const cards = document.querySelectorAll('[data-anyink-card]');
		return { count: cards.length, text: cards[0]?.innerText.replace(/\s+/g, ' ').trim() };
	});
	assert.equal(leaveAsked, 1, 'Chrome asked "Leave site?" once (unsaved work with ink)');
	assert.equal(card.count, 1, 'one card');
	assert.match(card.text, /Unsaved work from .+Brennan Hand/);
	assert.deepEqual(s.greens, ['Continue with it'], 'one green');
	assert.deepEqual(await scanSimple(), []);
	await shot('H1-reload-crash-card');
	await page.locator('[data-anyink-choice="continue"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await settle(1200);
	s = await screen();
	st = await editorState();
	assert.equal(st.name, 'Brennan Hand');
	assert.equal(s.rail, '7/58');
	await shot('H2-continued-seven-letters');
	pass(
		`H: a reload with unsaved work asked "Leave site?" (${leaveAsked}), then showed one card "${card.text}" with one green [Continue with it]; it brought "${st.name}" back with ${s.rail} letters, status "${s.status}"`
	);

	// Menu > Start a new font...: Ctrl+O's box first (7.4 #4), [Cancel] keeps his font; with
	// nothing unsaved it would go straight to the start screen
	await page.locator('[data-anyink-control="menu"]').click();
	await page.locator('[data-anyink-row="new-font"]').click();
	await page.locator('#modal-dialog .anyink-open-box').waitFor({ timeout: 10000 });
	await settle(400);
	const box = await page.evaluate(() => ({
		text: document.querySelector('#modal-dialog .anyink-open-box p')?.textContent,
		buttons: [...document.querySelectorAll('#modal-dialog fancy-button')].map((b) => ({
			text: b.textContent.trim(),
			outlined: b.hasAttribute('secondary'),
		})),
	}));
	assert.equal(box.text, "Your work has changes that aren't saved.");
	assert.deepEqual(box.buttons, [
		{ text: 'Save', outlined: false },
		{ text: 'Cancel', outlined: true },
	]);
	await shot('H3-start-a-new-font-asks-first');
	await page.locator('#modal-dialog [data-anyink-choice="cancel"]').click();
	await settle(500);
	assert.equal(await page.locator('[data-anyink-board]').isVisible(), true);
	assert.equal(await page.locator('.anyink-start').count(), 0);
	pass(
		`H: Menu > Start a new font... with unsaved work asks first ("${box.text}" [Save] green, [Cancel] outlined); Cancel keeps his font on the board`
	);
	await page.close();
	await context.close();

	// ------------------------------------------------------------------
	// J. Start fix pass: Other ways to start..., a saved font then Start a new font..., the card
	// ------------------------------------------------------------------
	context = await newContext();
	page = await freshPage('start fix pass', context);
	await page.goto(`${origin}/?ui=simple`);
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await settle(800);
	await page.locator('#input__new-project-name').fill('Typed Name');
	await page.locator('.anyink-start__other-ways').click();
	await page.locator('#open-project__tab-load').waitFor({ timeout: 10000 });
	await settle(500);
	const ways = await page.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		return {
			band: shown(document.querySelector('.anyink-band')),
			picked: document.querySelector('.open-project__tab[selected]')?.id,
			tabs: [...document.querySelectorAll('.open-project__tab')]
				.filter(shown)
				.map((el) => el.textContent.trim()),
			create: shown(document.querySelector('#button__create-new-project')),
		};
	});
	assert.equal(ways.band, true, 'the purple band');
	assert.equal(ways.picked, 'open-project__tab-load', 'opens on Load');
	assert.deepEqual(ways.tabs, ['Load', 'Recover', 'Examples'], 'no New tab');
	assert.equal(ways.create, false, 'no second Create');
	await shot('J1-other-ways-opens-on-load');
	await page.locator('.anyink-band button').click();
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 10000 });
	assert.equal(await page.locator('#input__new-project-name').inputValue(), 'Typed Name');
	pass(
		`J: "Other ways to start..." opens on Load under the band with tabs ${ways.tabs.join(
			' / '
		)} and no Create; Back to simple brings the start screen with "Typed Name" kept`
	);

	// A saved font (a real file handle, in the browser's private file area), then Menu > Start a
	// new font...: nothing unsaved, so straight to the start screen; Create fills the same editor
	await page.locator('#input__new-project-name').fill('Old Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await settle(800);
	const saved = await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const root = await navigator.storage.getDirectory();
		const handle = await root.getFileHandle('Old Hand.gs2', { create: true });
		editor.loadedFileHandle = handle;
		await editor.saveProjectFile();
		const { hasUnsavedWork } = await import('/anyink/files/open_font.js');
		const file = await handle.getFile();
		window.__oldEditor = editor;
		return { unsaved: hasUnsavedWork(editor), bytes: file.size };
	});
	assert.equal(saved.unsaved, false, 'the font is saved');
	assert.ok(saved.bytes > 100, 'its work file has the font');
	await page.locator('[data-anyink-control="menu"]').click();
	await page.locator('[data-anyink-row="new-font"]').click();
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 10000 });
	assert.equal(await page.locator('#modal-dialog .anyink-open-box').count(), 0, 'no question');
	await settle(800);
	await shot('J2-saved-font-then-start-screen');
	await page.locator('#input__new-project-name').fill('Fresh Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await settle(1200);
	const fresh = await page.evaluate(async () => {
		const { getCurrentProjectEditor } = await import('/app/main.js');
		const editor = getCurrentProjectEditor();
		const steps = editor.history.queue.length;
		document.querySelector('[data-anyink-control="undo"]')?.click();
		await new Promise((resolve) => setTimeout(resolve, 300));
		return {
			same: editor === window.__oldEditor,
			name: editor.project.settings.project.name,
			file: !!editor.loadedFileHandle,
			steps,
			afterUndo: getCurrentProjectEditor().project.settings.project.name,
		};
	});
	assert.equal(fresh.same, true, 'the same editor');
	assert.equal(fresh.name, 'Fresh Hand');
	assert.equal(fresh.file, false, 'no work file: the old file is not the new font');
	assert.equal(fresh.steps, 0, 'no step to undo');
	assert.equal(fresh.afterUndo, 'Fresh Hand', 'Undo cannot reach the old font');
	s = await screen();
	await shot('J3-fresh-font-no-work-file');
	pass(
		`J: a saved font, then Menu > Start a new font... went straight to the start screen (no question); Create made "${fresh.name}" in the same editor with no work file, ${fresh.steps} Undo steps, status "${s.status}"; Undo left "${fresh.afterUndo}"`
	);

	// The card: a Replace it copy of "Old Hand" and a backup copy older than its work file are
	// no crash: Continue stays on the font he is making
	const card2 = await page.evaluate(async () => {
		const { keepBackupCopy } = await import('/anyink/start/keep_backup.js');
		const { pushRecentProject } = await import('/anyink/files/handles.js');
		const { recSet } = await import('/anyink/storage/kv.js');
		const { chooseCard } = await import('/anyink/start/start_state.js');
		const { sessionFacts } = await import('/anyink/start/card_facts.js');
		const { listRecentProjects } = await import('/anyink/files/handles.js');
		const { listRecoverableSessions } = await import('/anyink/recovery/recovery.js');
		const { recGet } = await import('/anyink/storage/kv.js');
		const root = await navigator.storage.getDirectory();
		const handle = await root.getFileHandle('Old Hand.gs2');
		const content = JSON.parse(await (await handle.getFile()).text());
		await keepBackupCopy(content, { now: Date.now() + 1000 });
		await recSet('session:stale1:s1', {
			id: 'stale1',
			key: 'session:stale1:s1',
			sessionId: 's1',
			lock: 'anyink-verify-stale',
			name: 'Old Hand',
			time: Date.now() - 60 * 60 * 1000,
			dirty: true,
			hasFile: true,
			fileHandle: handle,
			project: content,
			assets: {},
			history: null,
		});
		await pushRecentProject(handle, 'Old Hand');
		const recents = await listRecentProjects();
		const listed = await listRecoverableSessions();
		const sessions = await sessionFacts(listed, recents, { readRecord: recGet });
		return {
			listed: listed.map((row) => row.name),
			card: chooseCard({ recents, sessions }).kind,
		};
	});
	assert.ok(card2.listed.length >= 2, 'both copies are in the backups list');
	assert.equal(card2.card, 'continue', 'no crash card for either');
	pass(
		`J: a Replace it copy and a backup copy older than its work file stay in the backups list (${card2.listed.join(
			', '
		)}) and the start screen's card is "${card2.card}"`
	);
	await page.close();
	await context.close();

	// ------------------------------------------------------------------
	// I. All tools: unchanged
	// ------------------------------------------------------------------
	context = await newContext();
	page = await freshPage('all tools', context);
	await page.goto(`${origin}/`);
	await page.locator('#open-project__tab-new').waitFor({ timeout: 60000 });
	await settle(600);
	const tabs = await page.evaluate(() => ({
		start: !!document.querySelector('.anyink-start'),
		band: !!document.querySelector('.anyink-band'),
		tabs: [...document.querySelectorAll('.open-project__tab')].map((el) => el.textContent.trim()),
		create: document.querySelector('#button__create-new-project')?.textContent.trim(),
	}));
	assert.equal(tabs.start, false);
	assert.equal(tabs.band, false);
	assert.equal(tabs.create, 'Create a new font from scratch');
	await shot('I1-all-tools-tabs');
	await page.locator('#input__new-project-name').fill('Tools Font');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await settle(1200);
	st = await editorState();
	const allTools = await page.evaluate(async () => {
		window.dispatchEvent(new CustomEvent('anyink-open-try-it', { detail: { cause: 'rail' } }));
		const { isTryItOpen } = await import('/anyink/tryit/expand.js');
		const { getMode } = await import('/anyink/mode/mode.js');
		return {
			mode: getMode(),
			open: isTryItOpen(),
			rail: document.querySelectorAll('[data-anyink-step]').length,
			board: !!document.querySelector('[data-anyink-board]'),
			bigPreview: !!document.querySelector('[data-anyink-strip="bigPreview"]')?.checkVisibility(),
		};
	});
	assert.equal(allTools.mode, 'all');
	assert.equal(st.page, 'Overview');
	assert.equal(allTools.open, false, 'Try it never opens in All tools');
	assert.equal(allTools.rail, 0);
	assert.equal(allTools.board, false);
	assert.equal(allTools.bigPreview, false);
	await shot('I2-all-tools-overview');
	pass(
		`I: All tools keeps the four tabs (${tabs.tabs.join(' / ')}) and "${
			tabs.create
		}", no start screen or band; Create opened the ${
			st.page
		} page; no rail, no board, no Big preview, and the Try it door does nothing`
	);

	assert.deepEqual(errors, [], 'no page errors');
	pass('no page errors or console errors');
	console.log(`screenshots (${shotList.length}) in ${shots}: ${shotList.join(', ')}`);
} catch (error) {
	console.log(`FAIL ${error.stack || error.message}`);
	console.log(errors.join('\n'));
	await shot('fail').catch(() => {});
	process.exitCode = 1;
}
await browser.close();
await server.close();
