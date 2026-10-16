// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 board-tiles real-browser check (docs/UX-BEGINNER.md 4.2 Tiles, keys, Drops, 7.3, 7.6;
// section 10 B10), in the real app on a Vite dev server, Chrome with throwaway profiles,
// 1600 x 900, Simple (?ui=simple) with the flags as the app ships them and 'board' turned on in
// the page (B10's integration turns it on in features.js):
//   A. Tiles in every state on the board (the board page draws them with tile_state.js): Empty
//      (a faint outlined letter, dashed), Ready "from a photo" / "drawn", a stray line is Empty,
//      the last touched ring; and a row with "Needs a look" (amber, "!", the reason) from a stand-in
//      check; 96 x 112 px; the banned-word scan on the board (strict)
//   B. Keys: b opens small b, Shift+B Capital B, . the period; arrows move the focus ring, Enter
//      opens; 7 says it isn't on the board yet, with [Add numbers & symbols]; a held e opens small e
//      and its repeats never reach the letter view (no "Switched to Edit points")
//   C. Drops: a photo held over a tile marks it; a photo on blank board space opens the photo
//      dialog with the letter unknown (photo_app.js); on a tile, the dialog for that letter;
//      anything else gets one sentence
//   D. Undo on the board stays on the board: "Undid: traced small g" [Show me]
//   E. The backup write (recovery.js snapshotNow, Chrome's own IndexedDB) on a 58-letter traced
//      font with the Undo list at its fullest (200 steps, 30 whole-font; All tools also 30
//      "Navigated to"), against D-026's 100 ms; then the same font with fewer whole-font steps.
//      B10 + B11 integration (D-042): each step's saved copy is a record of its own, written by
//      the session's first write; the writes timed here send the session's record (its size
//      printed) and nothing new
// Usage: node tests/board_tiles.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pinBeforeChecks } from './verify_standins.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-board-tiles'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-board-tiles-'));

const server = await createServer({
	root: src,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] }, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

const browser = await chromium.launch({ channel: process.env.BOARD_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;

async function freshPage(label) {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	const p = await context.newPage();
	p.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
	p.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
	});
	p.on('dialog', (dialog) => dialog.dismiss());
	return p;
}
const settle = (ms = 350, p = page) => p.waitForTimeout(ms);
const shot = async (name, clip, p = page) => {
	const path = resolve(shots, `${name}.png`);
	await p.screenshot({ path, ...(clip ? { clip } : {}) });
	shotList.push(`${name}.png`);
	return path;
};
const waitUntil = async (check, what, timeout = 15000, p = page) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await p.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
const newFont = async (p, name, search = '?ui=simple') => {
	await p.goto(`${origin}/${search}`);
	// B10 + B11 integration: the tiles are checked on toy letters (a square, a rectangle) that
	// B11's checks would call "Needs a look"; 'checks' off (b1011.verify.mjs checks them on)
	await pinBeforeChecks(p);
	const field = p.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill(name);
	await p.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(500, p);
};
const where = (p = page) =>
	p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return { page: editor.nav.page, item: editor.selectedItemID, tool: editor.selectedTool };
	});
const toBoard = async (p = page) => {
	await p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	});
	await p.locator('glyph-tile[board]').first().waitFor({ timeout: 15000 });
	await p.mouse.move(5, 895);
	await settle(500, p);
};
const toastNow = (p = page) =>
	p.evaluate(() => {
		const toast = document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
		return toast
			? {
					text: toast.querySelector('.anyink-toast__text')?.textContent.trim() ?? '',
					button: toast.querySelector('button')?.textContent.trim() ?? null,
			  }
			: null;
	});
/** Each board tile as Chrome draws it */
const tilesNow = (p = page, selector = 'glyph-tile[board]') =>
	p.evaluate((sel) =>
		[...document.querySelectorAll(sel)].map((tile) => {
			const wrapper = tile.shadowRoot.querySelector('.wrapper');
			const css = getComputedStyle(wrapper);
			const box = tile.getBoundingClientRect();
			const standIn = tile.shadowRoot.querySelector('.stand-in');
			return {
				char: tile.dataset.anyinkChar,
				state: wrapper.getAttribute('session-state'),
				caption: tile.shadowRoot.querySelector('.caption')?.textContent,
				title: tile.title,
				ring: getComputedStyle(wrapper).outlineStyle !== 'none' && tile.hasAttribute('last-touched'),
				border: `${css.borderTopStyle} ${css.borderTopColor}`,
				mark: getComputedStyle(tile.shadowRoot.querySelector('.mark')).display !== 'none',
				ink: !!tile.shadowRoot.querySelector('.thumbnail svg'),
				standIn: standIn ? getComputedStyle(standIn).webkitTextStrokeWidth : null,
				size: [Math.round(box.width), Math.round(box.height)],
			};
		}), selector);

try {
	// ------------------------------------------------------------------
	// A. Tiles in every state
	// ------------------------------------------------------------------
	page = await freshPage('simple');
	await newFont(page, 'Brennan Hand');
	await page.evaluate(async () => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ board: true });
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { tracedLetter } = await import('/anyink/board/tests/traced_font.js');
		const { Glyph } = await import('/project_data/glyph.js');
		const { Path } = await import('/project_data/path.js');
		const { tagStroke } = await import('/anyink/nib/stroke_record.js');
		const asset = editor.assets.add(new Blob([new Uint8Array(64)], { type: 'image/webp' }));
		for (const char of ['B', 'H', 'a', 'd', 'e', 'n']) {
			const glyph = tracedLetter(char, { asset });
			delete glyph.anyink.spacing;
			editor.project.glyphs[glyph.id] = glyph;
		}
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		// r drawn with the brush; c a stray line (no ink: Empty, as the letter card says)
		const r = new Glyph({ id: 'glyph-0x72', advanceWidth: 700 });
		const stroke = new Path({
			name: 'Brush stroke 1',
			pathPoints: [corner(100, 0), corner(200, 0), corner(200, 1000), corner(100, 1000)],
		});
		tagStroke(stroke, 1);
		r.addOneShape(stroke);
		editor.project.glyphs[r.id] = r;
		const c = new Glyph({ id: 'glyph-0x63', advanceWidth: 700 });
		c.addOneShape(new Path({ name: 'Line', pathPoints: [corner(0, 0), corner(300, 0)] }));
		editor.project.glyphs[c.id] = c;
	});
	// the board, small a opened by its key, then back: the letter he touched last
	await toBoard();
	await page.keyboard.press('a');
	await waitUntil(async () => (await where()).page === 'Characters', 'a opens small a');
	await settle(400);
	await toBoard();
	const boardTiles = await tilesNow();
	const byChar = Object.fromEntries(boardTiles.map((t) => [t.char, t]));
	assert.equal(boardTiles.length, 58, 'the Quick font: 58 tiles');
	assert.deepEqual(byChar.B.size, [96, 112]);
	assert.equal(byChar.B.state, 'ready');
	assert.equal(byChar.B.caption, 'Ready');
	assert.equal(byChar.B.title, 'Capital B · Ready · from a photo');
	assert.equal(byChar.r.title, 'small r · Ready · drawn');
	assert.ok(byChar.B.ink && byChar.r.ink, 'his ink on the ready tiles');
	assert.equal(byChar.A.state, 'empty');
	assert.equal(byChar.A.caption, 'Empty');
	assert.match(byChar.A.border, /^dashed/);
	assert.equal(byChar.A.standIn, '1px', 'a faint outlined letter');
	assert.equal(byChar.c.state, 'empty', 'a stray line is no ink');
	assert.equal(byChar.a.ring, true, 'small a, the letter he had open, has the green ring');
	await shot('A1-board-tiles');
	const scan = await page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('.anyink-board') || document.body;
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	});
	assert.deepEqual(scan, [], 'the board says no banned word');
	pass(
		`A: 58 tiles, 96 x 112: Capital B "Ready" (from a photo), small r "Ready" (drawn), Capital A "Empty" (dashed, a 1 px outlined letter), small c's stray line "Empty", the green ring on small a; no banned word`
	);

	// a row of tiles in every state, "Needs a look" from a stand-in check (B11's own come later)
	const row = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { makeBoardTile } = await import('/anyink/board/tile_state.js');
		const look = {
			id: 'line',
			reason: 'small e floats above the writing line.',
			short: 'floats above the writing line',
		};
		const strip = document.createElement('div');
		strip.id = 'states-row';
		strip.style.cssText =
			'position:fixed;left:20px;bottom:20px;z-index:99999;display:flex;gap:12px;padding:16px;background:var(--chrome-bg);border:1px solid var(--chrome-border-strong)';
		['A', 'B', 'r', 'e', 'a'].forEach((char) =>
			strip.appendChild(
				makeBoardTile(editor.project, char, {
					checks: (_item, { char: c }) => (c === 'e' ? look : null),
					checksOn: true,
					lastTouched: char === 'a',
				})
			)
		);
		document.body.appendChild(strip);
		const box = strip.getBoundingClientRect();
		return { x: box.x, y: box.y, width: box.width, height: box.height };
	});
	await settle(200);
	const rowTiles = await tilesNow(page, '#states-row glyph-tile');
	const e = rowTiles.find((t) => t.char === 'e');
	assert.equal(e.state, 'needsLook');
	assert.equal(e.caption, 'Needs a look');
	assert.equal(e.mark, true, 'the amber "!"');
	assert.match(e.border, /solid rgb\(245, 158, 11\)/, 'amber border (--warning)');
	assert.equal(e.title, 'small e · Needs a look: floats above the writing line');
	await shot('A2-tile-states-row', { x: row.x - 4, y: row.y - 4, width: row.width + 8, height: row.height + 8 });
	await page.evaluate(() => document.querySelector('#states-row')?.remove());
	pass('A: a row of every state: Empty, Ready (photo), Ready (drawn), Needs a look (amber border, "!", the reason), last touched (green ring)');

	// ------------------------------------------------------------------
	// B. Keys
	// ------------------------------------------------------------------
	await page.keyboard.press('b');
	await waitUntil(async () => (await where()).page === 'Characters', 'b opens a letter');
	assert.deepEqual((await where()).item, 'glyph-0x62');
	await settle(400);
	await shot('B1-b-opens-small-b');
	await toBoard();
	await page.keyboard.press('Shift+B');
	await waitUntil(async () => (await where()).page === 'Characters', 'Shift+B opens');
	assert.equal((await where()).item, 'glyph-0x42');
	await toBoard();
	await page.keyboard.press('.');
	await waitUntil(async () => (await where()).page === 'Characters', '. opens');
	assert.equal((await where()).item, 'glyph-0x2E');
	pass('B: b opened small b, Shift+B Capital B, . the period (each its letter view)');

	await toBoard();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await settle(200);
	const focused = await page.evaluate(() => document.activeElement?.dataset?.anyinkChar || '');
	assert.ok(focused, 'an arrow put the focus ring on a tile');
	const rings = (await tilesNow()).filter((t) => t.ring).map((t) => t.char);
	assert.deepEqual(rings, [focused], 'one green ring, on the tile the arrows are on');
	await shot('B2-arrows-focus-ring');
	await page.keyboard.press('Enter');
	await waitUntil(async () => (await where()).page === 'Characters', 'Enter opens');
	const opened = (await where()).item;
	assert.equal(opened, `glyph-0x${focused.codePointAt(0).toString(16).toUpperCase()}`);
	pass(`B: from the period, Right, Right, Down put the one green ring on ${JSON.stringify(focused)}; Enter opened it`);

	await toBoard();
	await page.keyboard.press('7');
	await settle(300);
	const seven = await toastNow();
	assert.deepEqual(seven, {
		text: "The number 7 isn't on your board yet.",
		button: 'Add numbers & symbols',
	});
	await shot('B3-seven-not-on-board');
	pass(`B: 7 said "${seven.text}" [${seven.button}]`);

	// a held key: down, two repeats, up
	await page.keyboard.down('e');
	await page.keyboard.down('e');
	await page.keyboard.down('e');
	await page.keyboard.up('e');
	await waitUntil(async () => (await where()).page === 'Characters', 'e opens');
	await settle(500);
	const held = await where();
	const heldToast = await toastNow();
	assert.equal(held.item, 'glyph-0x65');
	assert.notEqual(held.tool, 'pathEdit', 'the repeats never picked Edit points');
	assert.ok(!/Switched to/.test(heldToast?.text || ''), `no tool toast: ${heldToast?.text}`);
	pass(`B: a held e opened small e; its repeats never reached the letter view (tool ${held.tool}, no "Switched to")`);

	// ------------------------------------------------------------------
	// C. Drops
	// ------------------------------------------------------------------
	await toBoard();
	const makePhoto = `
		async function photoFile() {
			const canvas = new OffscreenCanvas(900, 300);
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, 900, 300);
			ctx.strokeStyle = '#111';
			ctx.lineWidth = 14;
			ctx.lineCap = 'round';
			// three letters: an l, an o and a c
			ctx.beginPath(); ctx.moveTo(150, 60); ctx.lineTo(150, 240); ctx.stroke();
			ctx.beginPath(); ctx.ellipse(420, 180, 55, 60, 0, 0, Math.PI * 2); ctx.stroke();
			ctx.beginPath(); ctx.arc(700, 180, 58, 0.6, Math.PI * 2 - 0.6); ctx.stroke();
			const blob = await canvas.convertToBlob({ type: 'image/png' });
			return new File([blob], 'page.png', { type: 'image/png' });
		}
		function drag(type, target, file) {
			const transfer = new DataTransfer();
			transfer.items.add(file);
			const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer });
			target.dispatchEvent(event);
			return event.defaultPrevented;
		}`;
	const marked = await page.evaluate(`(async () => {
		${makePhoto}
		const tile = document.querySelector('glyph-tile[board][data-anyink-char="n"]');
		drag('dragover', tile, await photoFile());
		return tile.hasAttribute('drop-target');
	})()`);
	assert.equal(marked, true, 'a photo held over small n marks its tile');
	const nBox = await page.evaluate(() => {
		const r = document.querySelector('glyph-tile[board][data-anyink-char="n"]').getBoundingClientRect();
		return { x: r.x - 30, y: r.y - 30, width: r.width + 60, height: r.height + 60 };
	});
	await shot('C1-photo-held-over-small-n', nBox);

	await page.evaluate(`(async () => {
		${makePhoto}
		const blank = document.querySelector('.anyink-board') || document.querySelector('#app__page');
		drag('drop', blank, await photoFile());
	})()`);
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
	await settle(800);
	const unknown = await page.evaluate(() => {
		const d = document.querySelector('[data-anyink-dialog="photoDialog"]');
		return { kind: d.getAttribute('data-anyink-photo-dialog'), text: d.innerText.replace(/\s+/g, ' ').slice(0, 160) };
	});
	assert.equal(unknown.kind, 'unknown');
	assert.equal((await where()).page, 'Overview', 'the board stays behind the dialog');
	await shot('C2-photo-on-blank-board-dialog-letter-unknown');
	pass(`C: a photo dropped on blank board space opened the photo dialog, letter unknown: "${unknown.text}"`);
	await page.keyboard.press('Escape');
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ state: 'detached' });

	await page.evaluate(`(async () => {
		${makePhoto}
		drag('drop', document.querySelector('glyph-tile[board][data-anyink-char="o"]'), await photoFile());
	})()`);
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
	await settle(800);
	const known = await page.evaluate(() => {
		const d = document.querySelector('[data-anyink-dialog="photoDialog"]');
		return { kind: d.getAttribute('data-anyink-photo-dialog'), text: d.innerText.replace(/\s+/g, ' ').slice(0, 120) };
	});
	assert.equal(known.kind, 'known');
	assert.match(known.text, /small o/);
	await shot('C3-photo-on-small-o-tile-dialog-letter-known');
	pass(`C: the same photo dropped on small o's tile: the dialog for small o ("${known.text}")`);
	await page.keyboard.press('Escape');
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ state: 'detached' });

	await page.evaluate(`(async () => {
		${makePhoto}
		drag('drop', document.querySelector('.anyink-board') || document.body, new File(['notes'], 'notes.txt', { type: 'text/plain' }));
	})()`);
	// an info toast waits its turn behind 7's offer (4.0: an offer is never replaced by info)
	const sentence = 'ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files (.gs2).';
	await waitUntil(async () => (await toastNow())?.text === sentence, 'the drop sentence', 15000);
	const other = await toastNow();
	await shot('C4-other-file-one-sentence');
	pass(`C: a .txt dropped on the board: "${other.text}"`);

	// ------------------------------------------------------------------
	// D. Undo on the board stays on the board
	// ------------------------------------------------------------------
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { Path } = await import('/project_data/path.js');
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x67';
		editor.navigate();
		editor.selectedGlyph.addOneShape(
			new Path({ name: 'Ink', pathPoints: [corner(100, -300), corner(600, -300), corner(600, 500), corner(100, 500)] })
		);
		editor.history.addState('traced small g');
	});
	await settle(500);
	await toBoard();
	assert.equal((await tilesNow()).find((t) => t.char === 'g').state, 'ready');
	await page.keyboard.press('Control+z');
	await settle(600);
	const undone = await toastNow();
	assert.equal((await where()).page, 'Overview', 'Undo stayed on the board');
	assert.deepEqual(undone, { text: 'Undid: traced small g', button: 'Show me' });
	assert.equal((await tilesNow()).find((t) => t.char === 'g').state, 'empty', "small g's tile is Empty again");
	await shot('D1-undo-on-the-board');
	pass(`D: Ctrl+Z on the board: "${undone.text}" [${undone.button}], the board stayed, small g's tile went back to Empty`);
	await page.context().close();

	// ------------------------------------------------------------------
	// E. The backup write
	// ------------------------------------------------------------------
	const backup = async (label, { search, wholeFont, navigation }) => {
		const p = await freshPage(label);
		await newFont(p, `Backup ${label}`, search);
		const result = await p.evaluate(
			async ({ wholeFont: wf, navigation: nav }) => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				const { buildTracedFont, fillUndoList, undoListSize } = await import('/anyink/board/tests/traced_font.js');
				const { snapshotNow } = await import('/anyink/recovery/recovery.js');
				const { recEntries } = await import('/anyink/storage/kv.js');
				const { points } = buildTracedFont(editor);
				fillUndoList(editor, { steps: 200, wholeFont: wf, navigation: nav });
				const size = undoListSize(editor.history);
				await snapshotNow('manual'); // warm: the session's first write also prunes
				const runs = [];
				for (let i = 0; i < 5; i++) {
					const t0 = performance.now();
					const written = await snapshotNow('manual');
					runs.push({ ms: performance.now() - t0, written });
				}
				// B10 + B11 integration (D-042): the session's record as written; each step's saved
				// copy is a record of its own, written once (the first write above)
				const session = (await recEntries()).find(([key]) => key.startsWith('session:'))[1];
				const mb = JSON.stringify({ project: session.project, history: session.history }).length / 1e6;
				const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
				return { points, size, mb, written: runs.every((r) => r.written), median: ms[2], max: ms[4], min: ms[0] };
			},
			{ wholeFont, navigation }
		);
		await p.context().close();
		return result;
	};
	const rows = [];
	const simpleFull = await backup('simple-full', { search: '?ui=simple', wholeFont: 30, navigation: 0 });
	rows.push(['Simple, 200 steps, 30 whole-font', simpleFull]);
	const allFull = await backup('all-full', { search: '?ui=all', wholeFont: 30, navigation: 30 }); // B16: Simple is the launch default
	rows.push(['All tools, 200 steps, 30 whole-font, 30 "Navigated to"', allFull]);
	for (const wf of [0, 5, 10, 20]) {
		rows.push([`Simple, 200 steps, ${wf} whole-font`, await backup(`simple-${wf}`, { search: '?ui=simple', wholeFont: wf, navigation: 0 })]);
	}
	rows.forEach(([label, r]) => {
		assert.ok(r.written, `${label}: written`);
		console.log(
			`MEASURE backup write, ${label}: median ${r.median.toFixed(0)} ms (min ${r.min.toFixed(0)}, max ${r.max.toFixed(
				0
			)}) for ${r.mb.toFixed(1)} MB; ${r.points} points; list ${JSON.stringify(r.size)}; D-026 point 100 ms: ${
				r.median <= 100 ? 'under' : 'OVER'
			}`
		);
	});
	assert.deepEqual(simpleFull.size, { steps: 200, wholeFont: 30, navigation: 0, entries: simpleFull.size.entries });
	pass('E: the backup write measured in Chrome (numbers above)');

	assert.deepEqual(errors, [], 'no page errors');
	console.log(`screenshots (${shotList.length}) in ${shots}:\n  ${shotList.join('\n  ')}`);
} catch (error) {
	console.error(`FAIL ${error.message}`);
	if (errors.length) console.error(`page errors: ${JSON.stringify(errors, null, 1)}`);
	await shot('FAIL-screen').catch(() => {});
	process.exitCode = 1;
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => {});
}
