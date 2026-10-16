// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 tryit-gaps fix pass, real-browser check (docs/UX-BEGINNER.md 4.6 Try it, gap handle, Gaps you
// fixed, the Word note; 7.3). The real app on a Vite dev server, Chrome, 1600 x 900, Simple by
// ?ui=simple, the flags as the app ships them. "Brennan Hand" with B r e n a H d made (traced-like
// letters), Try it from the rail's step 2:
//   A. A real mouse drag on the e|n handle: mid-drag the words stay at the same height and the
//      sheet keeps its size; nothing new comes under the pointer (no Word note, no list); Ctrl+Z
//      mid-drag does nothing (no throw, no half step); on release one step, the note ("Nothing to
//      do now ...") and "Gaps you fixed (1)" show, and the words still haven't moved
//   B. A long drag closer stops where the e's ink meets the n's: touching, never inside
//   C. The list says '"en" closer' (letter names as its tooltip); a one-pair rule the font brought
//      (not made by the handle) is not listed
//   D. No banned word on the strip (strict)
//   E. Measured, not asserted (the strip's layout belongs to the preview track): opening the two
//      closed sections
// Usage: node tests/tryit_gaps.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-tryit-gaps'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-tryit-gaps-'));

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
const browser = await chromium.launch({ channel: process.env.B12_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const waitUntil = async (check, what, timeout = 20000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};

/** Where the words sit and how big the sheet is, plus what shows under the sheet. */
const measure = () =>
	page.evaluate(async () => {
		const strip = document.querySelector('preview-strip');
		const canvas = strip.renderer?.canvas;
		const data = strip.renderer?.textBlock?.data || [];
		const first = data[0]?.[0];
		const crect = canvas.getBoundingClientRect();
		const box = strip.canvasWrapper.getBoundingClientRect();
		const note = document.querySelector('.anyink-word-note');
		const list = document.querySelector('.anyink-gap-list');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { kernOffsetFor, onePairFixes } = await import('/anyink/kerning/kern_lookup.js');
		const q = editor.history.queue;
		return {
			baseline: Math.round((crect.top + (first?.view?.dy || 0)) * 10) / 10,
			boxTop: Math.round(box.top),
			boxBottom: Math.round(box.bottom),
			note: note && getComputedStyle(note).visibility === 'visible' ? note.textContent.trim() : '',
			noteRow: note ? Math.round(note.getBoundingClientRect().height) : -1,
			list:
				list && getComputedStyle(list).visibility === 'visible'
					? list.querySelector('summary').textContent.trim()
					: '',
			listRow: list ? Math.round(list.getBoundingClientRect().height) : -1,
			kern: kernOffsetFor(editor.project, 'e', 'n'),
			fixes: onePairFixes(editor.project).length,
			steps: q.filter((e) => !/_post_state_$/.test(e.title)).length,
			posts: q.filter((e) => /_post_state_$/.test(e.title)).length,
			wholes: q.filter((e) => e.wholeProjectSave && !/_post_state_$/.test(e.title)).length,
		};
	});
const gapAt = (leftChar, rightChar) =>
	page.evaluate(
		async ({ l, r }) => {
			const { stripLayout } = await import('/anyink/tryit/gap_handle.js');
			const layout = stripLayout(document.querySelector('preview-strip'));
			const rect = layout.canvas.getBoundingClientRect();
			for (const line of layout.data) {
				const i = line.findIndex((c, k) => c.char === l && line[k + 1]?.char === r);
				if (i < 0) continue;
				const n = line[i + 1];
				return { x: rect.left + n.view.dx, y: rect.top + n.view.dy - 300 * n.view.dz };
			}
			return null;
		},
		{ l: leftChar, r: rightChar }
	);
const grabHandle = async (l, r) => {
	const gap = await gapAt(l, r);
	assert.ok(gap, `the ${l}|${r} gap is on the sheet`);
	await page.mouse.move(gap.x - 40, gap.y);
	await page.mouse.move(gap.x + 1, gap.y, { steps: 4 });
	await settle(250);
	const handle = page.locator('.anyink-gap-handle');
	assert.equal(await handle.isVisible(), true, 'the purple handle shows');
	const hb = await handle.boundingBox();
	return { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
};

const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await context.addInitScript(() => {
	window.showSaveFilePicker = async () => {
		throw new DOMException('The user aborted a request.', 'AbortError');
	};
});
try {
	page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.accept());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { tracedLetter } = await import('/anyink/board/tests/traced_font.js');
		const asset = editor.assets.add(new Blob([new Uint8Array(64)], { type: 'image/webp' }));
		for (const char of ['B', 'r', 'e', 'n', 'a', 'H', 'd']) {
			const glyph = tracedLetter(char, { asset });
			editor.project.glyphs[glyph.id] = glyph;
		}
		// every automatic letter at its fit, as each step leaves them
		(await import('/anyink/spacing/auto_space.js')).fitAllAutomatic(editor.project);
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	});
	await settle(800);
	await page.locator('[data-anyink-step="tryIt"]').click();
	await waitUntil(
		() => page.evaluate(async () => (await import('/anyink/tryit/expand.js')).isTryItOpen()),
		'Try it open'
	);
	await page.mouse.move(5, 895);
	await settle(900);

	// ------------------------------------------------------------------
	// A. The e|n drag: nothing moves, nothing comes mid-drag, Ctrl+Z waits
	// ------------------------------------------------------------------
	const opened = await measure();
	// the strip's next redraw (as a drag's first tick makes) never moves the words, even though
	// its controls row settles after the first one (finalize: Try it centers on the height the
	// canvas was sized to)
	await page.evaluate(() => document.querySelector('preview-strip').scheduleRedraw());
	await settle(400);
	const before = await measure();
	assert.equal(
		before.baseline,
		opened.baseline,
		`the next redraw after Try it opened kept the words put (${opened.baseline} -> ${before.baseline})`
	);
	assert.equal(before.fixes, 0);
	assert.equal(before.note, '');
	assert.equal(before.list, '');
	assert.ok(before.noteRow > 0 && before.listRow > 0, `the rows keep their place: ${JSON.stringify(before)}`);
	const h = await grabHandle('e', 'n');
	await shot('T1-hover-e-n');
	await page.mouse.down();
	await page.mouse.move(h.x - 5, h.y, { steps: 3 });
	await page.mouse.move(h.x - 10, h.y, { steps: 3 });
	await settle(300);
	const mid = await measure();
	await shot('T2-mid-drag');
	assert.ok(mid.kern < 0, `live while dragging (${mid.kern})`);
	assert.equal(mid.steps, before.steps, 'no step while dragging');
	assert.equal(mid.note, '', 'no Word note under the pointer mid-drag');
	assert.equal(mid.list, '', 'no list under the pointer mid-drag');
	assert.equal(mid.baseline, before.baseline, `the words stay put mid-drag (${before.baseline} -> ${mid.baseline})`);
	assert.equal(mid.boxBottom, before.boxBottom, 'the sheet keeps its size mid-drag');
	await page.keyboard.press('Control+z');
	await settle(300);
	const afterKey = await measure();
	assert.equal(afterKey.steps, before.steps, 'Ctrl+Z waited while the handle was held');
	assert.equal(afterKey.kern, mid.kern, 'the live gap is still there');
	await page.mouse.move(h.x - 12, h.y, { steps: 2 });
	await page.mouse.up();
	await settle(600);
	const after = await measure();
	await shot('T3-after-release');
	assert.equal(after.fixes, 1);
	assert.equal(after.steps, before.steps + 1, 'one Undo step');
	assert.equal(after.posts, after.wholes, `every before-copy has its after-copy (${after.wholes}/${after.posts})`);
	assert.equal(
		after.note,
		'Word needs one setting for gap fixes. Nothing to do now: you will be shown it when you put your font in Word.'
	);
	assert.equal(after.list, 'Gaps you fixed (1)');
	assert.equal(after.baseline, before.baseline, `the words stay put on release (${before.baseline} -> ${after.baseline})`);
	assert.equal(after.boxBottom, before.boxBottom, 'the sheet keeps its size on release');
	pass(
		`A: e|n dragged 12 px: mid-drag kern ${mid.kern}, baseline ${before.baseline} -> ${mid.baseline} -> ${after.baseline}, sheet bottom ${before.boxBottom} -> ${mid.boxBottom} -> ${after.boxBottom}; no note or list mid-drag; Ctrl+Z mid-drag waited (steps ${afterKey.steps}); on release one step, "${after.note}", "${after.list}"`
	);
	await page.keyboard.press('Control+z');
	await settle(500);
	const undone = await measure();
	assert.equal(undone.kern, 0, 'Ctrl+Z after release puts the gap back');
	assert.equal(undone.note, '');
	assert.equal(undone.baseline, before.baseline, 'and the words still stay put');
	pass(`A: Ctrl+Z after release put the gap back (kern ${undone.kern}); note gone, baseline ${undone.baseline}`);

	// ------------------------------------------------------------------
	// B. A long drag closer stops at touching
	// ------------------------------------------------------------------
	const h2 = await grabHandle('e', 'n');
	await page.mouse.down();
	await page.mouse.move(h2.x - 120, h2.y, { steps: 8 });
	await page.mouse.up();
	await settle(600);
	const touch = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { kernOffsetFor } = await import('/anyink/kerning/kern_lookup.js');
		const { inkBounds } = await import('/anyink/spacing/measure.js');
		const e = editor.project.glyphs['glyph-0x65'];
		const n = editor.project.glyphs['glyph-0x6E'];
		const space = e.advanceWidth - inkBounds(e).xMax + inkBounds(n).xMin;
		const kern = kernOffsetFor(editor.project, 'e', 'n');
		return { space, kern, gap: space + kern, upm: editor.project.settings.font.upm };
	});
	await shot('T4-long-drag-touching');
	assert.ok(touch.gap >= 0 && touch.gap < 1, `the e and n ink touch, never overlap: ${JSON.stringify(touch)}`);
	pass(`B: a 120 px drag closer stopped at kern ${touch.kern} (ink gap ${touch.gap} units of ${touch.upm}): touching, not inside`);

	// ------------------------------------------------------------------
	// C. The list in words; a rule the font brought is not listed
	// ------------------------------------------------------------------
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { KernGroup } = await import('/project_data/kern_group.js');
		const { notifyKernPairsChanged } = await import('/anyink/kerning/kern_lookup.js');
		editor.project.addItemByType(
			new KernGroup({ leftGroup: ['0x48'], rightGroup: ['0x61'], value: -60 }),
			'KernGroup'
		);
		notifyKernPairsChanged(editor, {});
		document.querySelector('.anyink-gap-list').open = true;
	});
	await page.mouse.move(5, 895);
	await settle(500);
	const rows = await page.evaluate(() =>
		[...document.querySelectorAll('.anyink-gap-list li > span')].map((s) => ({
			text: s.textContent,
			tip: s.title,
		}))
	);
	assert.deepEqual(rows, [{ text: '"en" closer', tip: 'small e and small n closer' }]);
	const listTitle = await page.evaluate(() =>
		document.querySelector('.anyink-gap-list summary').textContent.trim()
	);
	assert.equal(listTitle, 'Gaps you fixed (1)', 'the H|a rule the font brought is not listed');
	await shot('T5-list-open');
	pass(`C: the list shows ${JSON.stringify(rows)}; "${listTitle}" with a font-brought H|a rule in the font`);

	// ------------------------------------------------------------------
	// D. No banned word
	// ------------------------------------------------------------------
	const hits = await page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('preview-strip');
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	});
	assert.deepEqual(hits, []);
	pass('D: 0 banned words on the strip (strict)');

	// ------------------------------------------------------------------
	// E. Measured only: opening the closed sections (preview track's layout)
	// ------------------------------------------------------------------
	const closed = await page.evaluate(async () => {
		document.querySelector('.anyink-gap-list').open = false;
		return true;
	});
	await settle(200);
	const sectionsClosed = await measure();
	await page.locator('.anyink-tryit-spacing summary').click();
	await page.evaluate(() => {
		document.querySelector('.anyink-gap-list').open = true;
		const editor = document.querySelector('preview-strip');
		editor.scheduleRedraw?.();
	});
	await page.mouse.move(5, 895);
	await settle(600);
	const sectionsOpen = await measure();
	await shot('T6-sections-open');
	assert.equal(
		sectionsOpen.baseline,
		sectionsClosed.baseline,
		`opening the two sections keeps the words put (${sectionsClosed.baseline} -> ${sectionsOpen.baseline})`
	);
	pass(
		`E (${closed}): sections closed -> open: sheet bottom ${sectionsClosed.boxBottom} -> ${sectionsOpen.boxBottom}, the words stayed at ${sectionsOpen.baseline}`
	);
	assert.deepEqual(errors, [], `no page errors: ${errors.join(' | ')}`);
	pass('no page errors');
	console.log(`screenshots: ${shots}`);
} finally {
	await browser.close();
	await server.close();
}
