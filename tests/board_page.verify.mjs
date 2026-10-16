// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 fix pass, board-page track: real-browser check of the board's filter and its
// "+ Numbers & symbols" (docs/UX-BEGINNER.md 4.2 Filters and Toolbar, 4.0 rule 9), in the real
// app on a Vite dev server, Chrome with a throwaway profile, 1600 x 900, Simple (?ui=simple) with
// the flags as the app ships them and the real checks. A new font gets ring-shaped letters drawn
// as one Undo step each (the real checks call them Ready); two are then moved up off the writing
// line (one step each, as a drag would be).
//   A. The filter never sticks (critic: shots/d6-board-after-new-amber.png): [Show me] puts the
//      board on Needs a look; [Looks fine to me] on every amber tile hides the filters; Ctrl+Z on
//      the board brings one amber letter back and the board stays on All, with the Next line's
//      own "1 letter needs a look." [Show me]; a letter floated in its letter view, then
//      "<- All letters": the board on All again; [Show me], a press on the amber tile and back:
//      All
//   B. "+ Numbers & symbols" on a board filtered to Needs a look (critic: shots/
//      46-numbers-added.png): the board goes back to All, the new section is scrolled into view
//      and washed green for a moment; Undo takes it away, Redo brings it back into view
// Usage: node tests/board_page.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-board-page'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-board-page-'));

const server = await createServer({
	root: src,
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
	channel: process.env.BOARD_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 400) => page.waitForTimeout(ms);
const offCanvas = () => page.mouse.move(5, 895);
const shot = async (name) => {
	const path = resolve(shots, `${name}.png`);
	await page.screenshot({ path });
	shotList.push(`${name}.png`);
	return path;
};
const waitUntil = async (check, what, timeout = 20000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

const where = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return { page: editor.nav.page, item: editor.selectedItemID };
	});

/** The board, the Next line and the rail as Chrome draws them */
const look = () =>
	page.evaluate(async () => {
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const shown = (el) => !!el && el.checkVisibility();
		const root = document.querySelector('[data-anyink-board]');
		const coach = document.querySelector('anyink-coach');
		const coachButton = coach?.querySelector('.anyink-coach__button');
		const { getCoach } = await import('/anyink/coach/coach_state.js');
		const numbers = root?.querySelector('[data-anyink-board-section="numbers"]');
		const box = numbers?.getBoundingClientRect();
		const head = numbers?.querySelector('.anyink-board__section-head')?.getBoundingClientRect();
		return {
			filter: root?.getAttribute('data-filter') ?? null,
			filters: [...(root?.querySelectorAll('[data-anyink-board-filter]') || [])].map((b) => ({
				text: text(b),
				pressed: b.getAttribute('aria-pressed') === 'true',
			})),
			tiles: [...(root?.querySelectorAll('[data-anyink-board-cell] > glyph-tile') || [])].map(
				(t) => t.dataset.anyinkChar
			),
			amber: [...(root?.querySelectorAll('[data-anyink-board-cell][data-state="needsLook"]') || [])].map(
				(c) => c.dataset.char
			),
			progress: text(root?.querySelector('.anyink-board__progress')),
			rail: text(document.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			coachButton: shown(coachButton) ? text(coachButton) : null,
			coachFilter: getCoach().state().boardFilter,
			numbers: numbers
				? {
						marked: numbers.hasAttribute('data-anyink-new'),
						wash: getComputedStyle(numbers).animationName,
						headInView: head.top >= 0 && head.bottom <= innerHeight,
						top: Math.round(box.top),
						bottom: Math.round(box.bottom),
						hit: numbers.contains(
							document.elementFromPoint(head.left + 4, (head.top + head.bottom) / 2)
						),
				  }
				: null,
		};
	});

const toBoardByBack = async () => {
	await page.locator('[data-anyink-letter="back"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(600);
};

/** Opens a letter by typing it on the board, as he would */
const openByKey = async (char) => {
	await page.keyboard.press(char);
	await waitUntil(async () => (await where()).item === ID(char), `${char} opens`);
	await offCanvas();
	await settle(500);
};

try {
	page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Board Fix');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await offCanvas();
	await settle(700);

	// Ring-shaped small letters, one Undo step each: the real checks call them Ready
	const LETTERS = ['o', 'c', 's', 'x', 'v', 'z'];
	await page.evaluate(async (chars) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { Path } = await import('/project_data/path.js');
		const { showItem } = await import('/anyink/preview/show_item.js');
		const xHeight = editor.project.settings.font.xHeight;
		const ring = (cx, cy, rx, ry, reversed) => {
			const points = [];
			for (let i = 0; i < 24; i++) {
				const a = ((reversed ? -1 : 1) * 2 * Math.PI * i) / 24;
				points.push({
					p: { coord: { x: Math.round(cx + rx * Math.cos(a)), y: Math.round(cy + ry * Math.sin(a)) } },
					type: 'corner',
				});
			}
			return new Path({ name: 'Shape', pathPoints: points });
		};
		for (const char of chars) {
			showItem(editor, `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`);
			const rx = Math.round(xHeight * 0.42);
			const ry = Math.round(xHeight / 2);
			editor.selectedItem.addOneShape(ring(rx + 60, ry, rx, ry, false));
			editor.selectedItem.addOneShape(ring(rx + 60, ry, rx * 0.6, ry * 0.7, true));
			editor.history.addState(`drew small ${char}`);
		}
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	}, LETTERS);
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(800);
	let v = await look();
	assert.equal(v.progress, '6 of 58 ready', 'six ring letters, all Ready');
	assert.deepEqual(v.filters, [], 'nothing needs a look: no filters');

	/** Moves the open letter up 10 % of the letter box: one step, as a drag would be */
	const floatOpenLetter = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const glyph = editor.selectedItem;
			glyph.updateGlyphPosition(0, Math.round(editor.project.settings.font.upm * 0.1));
			editor.history.addState('moved it up');
			editor.publish('currentItem', glyph);
		});
	for (const char of ['o', 'c']) {
		await openByKey(char);
		await floatOpenLetter();
		await settle(500);
		await toBoardByBack();
	}
	v = await look();
	assert.deepEqual(v.amber.sort(), ['c', 'o']);
	assert.equal(v.sentence, '2 letters need a look.');
	assert.equal(v.coachButton, 'Show me');

	// ------------------------------------------------------------------
	// A. The filter never sticks
	// ------------------------------------------------------------------
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(600);
	v = await look();
	assert.equal(v.filter, 'needsLook');
	assert.deepEqual(v.tiles.sort(), ['c', 'o']);
	await shot('A1-show-me-needs-a-look');
	pass(`A: [Show me] put the board on Needs a look: ${JSON.stringify(v.tiles)}, Next line "${v.sentence}"`);

	for (const char of ['o', 'c']) {
		await page
			.locator(`[data-anyink-board-cell][data-char="${char}"] [data-anyink-board-fix="looksFine"]`)
			.click();
		await settle(700);
	}
	v = await look();
	assert.deepEqual(v.filters, [], 'the filters hid');
	assert.equal(v.tiles.length, 58);
	await shot('A2-looks-fine-on-both-filters-hide');
	pass(`A: [Looks fine to me] on both amber tiles: the filters hid, ${v.tiles.length} tiles, "${v.progress}"`);

	// still on the board: Ctrl+Z brings small c's amber back; the pick ended when the filters hid
	await page.keyboard.press('Control+z');
	await settle(800);
	v = await look();
	assert.deepEqual(v.amber, ['c']);
	assert.equal(v.filter, 'all', 'the board stays on All');
	assert.equal(v.tiles.length, 58, 'every letter shows');
	assert.deepEqual(
		v.filters.map((f) => [f.text, f.pressed]),
		[
			['All 58', true],
			['Needs a look 1', false],
			['Empty 52', false],
		]
	);
	assert.equal(v.coachFilter, 'all');
	assert.equal(v.sentence, '1 letter needs a look.');
	assert.equal(v.coachButton, 'Show me');
	await shot('A3-undo-on-the-board-stays-on-all');
	pass(
		`A: Ctrl+Z on the board brought small c's amber back: the board on All (${v.tiles.length} tiles, filters ${JSON.stringify(
			v.filters.map((f) => f.text)
		)}, All pressed), Next line "${v.sentence}" [${v.coachButton}] (rule 9 reads "${v.coachFilter}")`
	);
	// back to nothing amber: Redo puts Looks fine to me back
	await page.keyboard.press('Control+y');
	await settle(800);
	v = await look();
	assert.deepEqual(v.amber, []);

	// the critic's path: small s floated in its letter view, then "<- All letters"
	await openByKey('s');
	await floatOpenLetter();
	await settle(500);
	await toBoardByBack();
	v = await look();
	assert.deepEqual(v.amber, ['s']);
	assert.equal(v.filter, 'all', 'not filtered to the new amber letter');
	assert.equal(v.tiles.length, 58);
	assert.equal(v.coachFilter, 'all');
	assert.equal(v.sentence, '1 letter needs a look.');
	assert.equal(v.coachButton, 'Show me');
	await shot('A4-new-amber-letter-board-on-all');
	pass(
		`A: small s floated later, "<- All letters": the board on All (${v.tiles.length} tiles, s amber), Next line "${v.sentence}" [${v.coachButton}]`
	);

	// leaving the board ends the pick: Show me, the amber tile, back
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(600);
	v = await look();
	assert.deepEqual([v.filter, v.tiles], ['needsLook', ['s']]);
	await page.locator('[data-anyink-board-cell][data-char="s"] glyph-tile').click();
	await waitUntil(async () => (await where()).item === ID('s'), 's opens from its tile');
	await offCanvas();
	await settle(500);
	await toBoardByBack();
	v = await look();
	assert.equal(v.filter, 'all');
	assert.equal(v.tiles.length, 58);
	await shot('A5-back-from-a-letter-board-on-all');
	pass(`A: [Show me], s's tile, "<- All letters": the board on All again (${v.tiles.length} tiles)`);

	// ------------------------------------------------------------------
	// B. "+ Numbers & symbols" on a board filtered to Needs a look
	// ------------------------------------------------------------------
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(600);
	v = await look();
	assert.deepEqual([v.filter, v.tiles], ['needsLook', ['s']]);
	await shot('B0-filtered-before-numbers');
	await page.locator('[data-anyink-board-tool="numbers"]').click();
	await settle(250);
	v = await look();
	assert.equal(v.filter, 'all', 'back to All');
	assert.equal(v.tiles.length, 80);
	assert.equal(v.progress, '5 of 80 ready');
	assert.ok(v.numbers, 'the Numbers & symbols section is on the board');
	assert.equal(v.numbers.marked, true, 'marked');
	assert.equal(v.numbers.wash, 'anyink-board-new', 'the green wash runs');
	assert.equal(v.numbers.headInView, true, `scrolled into view: ${JSON.stringify(v.numbers)}`);
	assert.equal(v.numbers.hit, true, 'nothing covers it');
	await shot('B1-numbers-added-in-view-washed');
	pass(
		`B: "+ Numbers & symbols" on the filtered board: back to All, ${v.tiles.length} tiles, "${v.progress}", the new section in view (top ${v.numbers.top}, bottom ${v.numbers.bottom} of 900) with the green wash "${v.numbers.wash}"`
	);
	await settle(2300);
	v = await look();
	assert.equal(v.numbers.marked, false, 'the mark goes after a moment');

	await page.keyboard.press('Control+z');
	await settle(700);
	v = await look();
	assert.equal(v.numbers, null);
	assert.equal(v.tiles.length, 58);
	await page.evaluate(() => {
		const area = document.querySelector('[data-anyink-board]').closest('.anyink-board-area');
		area?.scrollTo?.(0, 0);
		document.scrollingElement?.scrollTo?.(0, 0);
	});
	await page.keyboard.press('Control+y');
	await settle(300);
	v = await look();
	assert.ok(v.numbers?.headInView, 'Redo brings the section back into view');
	await shot('B2-redo-numbers-back-in-view');
	pass(`B: Ctrl+Z took the section away (58 tiles); Ctrl+Y brought it back into view`);

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
