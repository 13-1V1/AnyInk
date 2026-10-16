// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B3 Undo hooks, real-browser check (docs/UX-BEGINNER.md section 10, B2 and B3; D-033,
// D-034): the real app on a Vite dev server over src/, Chrome with throwaway profiles.
//   A. ?ui=simple: B drawn with the mouse; r s t u v made from B; a wider second shape on B is one
//      item step whose parts refit the five (no whole-font copy); Ctrl+Z / Ctrl+Y move all six in
//      one press; 40 Shift+Arrow nudges keep every earlier step (nothing dropped); Use it
//      'replace' on r (made from B) refits r in its whole-font step; dragging the small-letter
//      line with the mouse is one whole-font step about no letter that refits every automatic
//      letter; Ctrl+Z from small r undoes it without leaving r; the writing line nudged with the
//      keyboard on B, then Ctrl+Z from r, stays on r; 40 quick Shift+ArrowDown presses on the
//      small-letter line are one step; every step undoes.
//   B. A list made in Simple, recovered after a crash under the default launch (All tools) with
//      the real Recover card: two Ctrl+Z presses undo both letters, two Ctrl+Y bring them back.
//   C. Simple: Delete letter (the real button), one Ctrl+Z brings the letter back; a later change
//      to B, recovered under All tools, is undone by the first Ctrl+Z (never dropped).
// Usage: node tests/hooks.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
	moveGuideLines,
	nudgeWritingLine,
	pressInAllTools,
	toOverview,
} from './verify_standins.mjs';
// B4: the line's name in the Undo title is the house word (sets/core.js has no imports)
import CORE from '../src/anyink/words/sets/core.js';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b23-hooks'));
await mkdir(shots, { recursive: true });
const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(tmpdir(), 'anyink-b23-hooks-vite'),
	// No hot reload: an edit elsewhere in the repo must not reload the page mid-run.
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

const B = 'glyph-0x42';
const R = 'glyph-0x72';
const MADE_FROM_B = ['glyph-0x72', 'glyph-0x73', 'glyph-0x74', 'glyph-0x75', 'glyph-0x76'];
const contexts = [];
const profiles = [];
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);

async function openChrome() {
	const profile = await mkdtemp(resolve(tmpdir(), 'anyink-b23-hooks-'));
	profiles.push(profile);
	const context = await chromium.launchPersistentContext(profile, {
		channel: 'chrome',
		headless: true,
		viewport: { width: 1600, height: 1000 },
	});
	contexts.push(context);
	return context;
}
function watch(page) {
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
}
const shotOf = (page) => (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
async function waitUntil(page, check, what, timeout = 15000) {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(150);
	}
	throw new Error(`timed out: ${what}`);
}

/** The font as the live app has it */
const state = (page) =>
	page.evaluate(
		async ({ B, MADE_FROM_B }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { sitsAtFit } = await import('/anyink/spacing/auto_space.js');
			const { inkBounds } = await import('/anyink/spacing/measure.js');
			const { getMode } = await import('/anyink/mode/mode.js');
			const { countSteps } = await import('/anyink/history/undo_cap.js');
			const letter = (id) => {
				const g = editor.project.glyphs[id];
				if (!g) return null;
				const ink = g.shapes.length ? inkBounds(g) : null;
				return {
					shapes: g.shapes.length,
					width: g.advanceWidth,
					left: ink ? ink.xMin : null,
					right: ink ? ink.xMax : null,
					bottom: ink ? ink.yMin : null,
					owner: g.anyink?.spacing,
					atFit: g.shapes.length ? sitsAtFit(g, editor.project) : null,
				};
			};
			const letters = {};
			[B, ...MADE_FROM_B].forEach((id) => (letters[id] = letter(id)));
			const canvas = document.querySelector('edit-canvas')?.shadowRoot?.querySelector('canvas');
			const box = canvas?.getBoundingClientRect();
			const q = editor.history.queue;
			return {
				mode: getMode(),
				open: editor.selectedItemID,
				letters,
				entries: q.length,
				steps: editor.history.length,
				counted: countSteps(q),
				wholeFont: q.filter((e) => e.wholeProjectSave).length,
				top: q.slice(0, 7).map((e) => ({
					title: e.title,
					itemID: e.itemID,
					step: e.step || null,
					whole: !!e.wholeProjectSave,
				})),
				floor: !!editor.history.undoFloor,
				redo: editor.history.redoQueue.length,
				xHeight: editor.project.settings.font.xHeight,
				descent: editor.project.settings.font.descent,
				view: { ...editor.view },
				canvas: box ? { left: box.left, top: box.top } : null,
				snapshotChars: JSON.stringify(editor.history.serializeForStorage()).length,
			};
		},
		{ B, MADE_FROM_B }
	);

const screenOf = (s, x, y) => ({
	x: s.canvas.left + s.view.dx + x * s.view.dz,
	y: s.canvas.top + s.view.dy - y * s.view.dz,
});

async function openLetter(page, id) {
	// B5: Simple has no page chooser (verify_standins.mjs)
	await toOverview(page, 300);
	await page.locator(`glyph-tile[displayed-item-id="${id}"]`).click();
	await waitUntil(page, async () => (await state(page)).open === id, `open ${id}`);
	await page.waitForTimeout(400);
}
async function drawRectangle(page, x0, y0, x1, y1) {
	// B4 + B5 integration: tools by their id; Simple's tooltips say "Rectangle (R)". B6 + B7
	// finalize: in Simple's letter view the Rectangle sits inside Fine-tune, which an empty letter
	// doesn't show yet: its key opens Fine-tune and picks it (UX-BEGINNER.md 7.6)
	const rectangle = page.locator('button[data-anyink-tool="newRectangle"]');
	if (await rectangle.isVisible()) {
		await rectangle.click();
	} else {
		await page.evaluate(() => document.activeElement?.blur?.());
		await page.keyboard.press('r');
	}
	await page.mouse.move(x0, y0);
	await page.mouse.down();
	await page.mouse.move(x1, y1, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}
async function pickArrow(page) {
	await page.locator('button[data-anyink-tool="resize"]').click();
	await page.waitForTimeout(200);
}
async function newProject(page, name) {
	// A cold Vite cache can reload the page once while it finds the app's packages
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 20000 }).catch(() => page.reload());
	await field.fill(name);
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
}
const allAtFit = (s) => Object.values(s.letters).every((l) => !l || l.atFit === true);

try {
	// ----------------------------------------------------------------------------------------
	// A. Simple
	// ----------------------------------------------------------------------------------------
	const contextA = await openChrome();
	const page = contextA.pages()[0] || (await contextA.newPage());
	watch(page);
	const shot = shotOf(page);
	await page.goto(`${origin}/?ui=simple`);
	await newProject(page, 'Hooks check');
	await openLetter(page, B);
	await drawRectangle(page, 900, 330, 980, 515);
	let s = await state(page);
	assert.equal(s.mode, 'simple');
	assert.equal(s.letters[B].owner, 'auto');
	assert.equal(s.letters[B].atFit, true);

	// r s t u v made from B, the way the Insert-component action records it
	await page.evaluate(
		async ({ B, MADE_FROM_B }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { showItem } = await import('/anyink/preview/show_item.js');
			const { insertComponentInstance } = await import('/project_editor/cross_item_actions.js');
			MADE_FROM_B.forEach((id) => {
				showItem(editor, id);
				insertComponentInstance(B, id);
				editor.history.addState(`Inserted Capital B into ${editor.selectedItem.name}`);
			});
		},
		{ B, MADE_FROM_B }
	);
	s = await state(page);
	MADE_FROM_B.forEach((id) => assert.equal(s.letters[id].owner, 'auto', id));
	assert.ok(allAtFit(s));
	assert.equal(s.steps, 6);

	// Finding 3: a wider second shape on B, drawn with the mouse
	await openLetter(page, B);
	const before = await state(page);
	await drawRectangle(page, 1010, 420, 1100, 515);
	s = await state(page);
	assert.equal(s.letters[B].shapes, 2);
	assert.ok(allAtFit(s), JSON.stringify(s.letters));
	assert.equal(s.steps, 7);
	assert.equal(s.wholeFont, 0, 'no whole-font copy');
	assert.equal(s.top[0].itemID, B);
	const key = s.top[0].step;
	assert.ok(key);
	const parts = s.top.slice(1, 6);
	assert.ok(parts.every((e) => e.step === key && !e.whole));
	assert.deepEqual(parts.map((e) => e.itemID).sort(), MADE_FROM_B.slice().sort());
	MADE_FROM_B.forEach((id) =>
		assert.ok(s.letters[id].width > before.letters[id].width, `${id} wider`)
	);
	await shot('h01-simple-B-widened-five-refit');
	pass(
		`Simple: a wider shape on B is one item step (${s.top[0].title}); r s t u v refit inside it as parts (${s.entries} entries, ${s.steps} steps, 0 whole-font copies); widths r ${before.letters[R].width} -> ${s.letters[R].width}`
	);

	await page.keyboard.press('Control+z');
	await page.waitForTimeout(400);
	let u = await state(page);
	assert.equal(u.letters[B].shapes, 1);
	MADE_FROM_B.forEach((id) => assert.equal(u.letters[id].width, before.letters[id].width, id));
	assert.equal(u.steps, 6);
	assert.equal(u.open, B);
	await page.keyboard.press('Control+y');
	await page.waitForTimeout(400);
	u = await state(page);
	assert.equal(u.letters[B].shapes, 2);
	MADE_FROM_B.forEach((id) => assert.equal(u.letters[id].width, s.letters[id].width, id));
	pass(
		'Simple: one Ctrl+Z puts B and the five letters made from it back; one Ctrl+Y brings all six again'
	);

	// 40 Shift+ArrowRight nudges of B's right shape (10 units each)
	await pickArrow(page);
	s = await state(page);
	const inside = screenOf(s, s.letters[B].right - 40, s.letters[B].bottom + 40);
	await page.mouse.click(inside.x, inside.y);
	await page.waitForTimeout(200);
	const selected = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.multiSelect.shapes.length;
	});
	if (selected !== 1) {
		await shot('zz-debug-click');
		const tool = await page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			return { tool: editor.selectedTool, page: editor.nav.page, panel: editor.nav.panel };
		});
		console.log(
			'DEBUG',
			JSON.stringify({ inside, letter: s.letters[B], view: s.view, canvas: s.canvas, tool })
		);
	}
	assert.equal(selected, 1, 'the right shape of B is selected');
	for (let k = 0; k < 40; k++) await page.keyboard.press('Shift+ArrowRight');
	await page.waitForTimeout(400);
	const nudged = await state(page);
	assert.equal(nudged.steps, 47, nudged.top.map((e) => e.title).join(' | '));
	assert.equal(nudged.entries, 12 + 40 * 6);
	assert.equal(nudged.wholeFont, 0);
	assert.equal(nudged.floor, false, 'nothing dropped off the old end');
	assert.ok(allAtFit(nudged));
	assert.equal(nudged.letters[R].width, s.letters[R].width + 400);
	await shot('h02-simple-40-nudges');
	pass(
		`Simple: 40 Shift+Arrow nudges of B: ${nudged.entries} entries, ${
			nudged.steps
		} steps, nothing dropped (the 200-step limit counts a step with its parts once); crash copy ${(
			nudged.snapshotChars / 1e6
		).toFixed(2)} MB`
	);

	// Finding 4: Use it 'replace' on r, which holds a part made from B
	await openLetter(page, R);
	const rBefore = await state(page);
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { applyAutoTrace } = await import('/anyink/autotrace/apply.js');
		const { Path } = await import('/project_data/path.js');
		const corner = (x, y) => ({ p: { coord: { x, y } } });
		const square = new Path({
			name: 'Traced',
			pathPoints: [corner(700, 0), corner(1600, 0), corner(1600, 400), corner(700, 400)],
		});
		applyAutoTrace(
			{ editor, item: editor.selectedItem, shapes: [square], mode: 'replace' },
			{ round: true, title: 'traced r' }
		);
	});
	s = await state(page);
	assert.equal(s.top[0].whole, true, 'the whole-font path');
	assert.equal(s.letters[R].owner, 'auto');
	assert.equal(s.letters[R].atFit, true);
	assert.ok(s.letters[R].left < 700);
	assert.ok(s.letters[R].width > 900);
	await shot('h03-simple-use-it-replace-r');
	await page.keyboard.press('Control+z');
	await page.waitForTimeout(400);
	u = await state(page);
	assert.equal(u.letters[R].width, rBefore.letters[R].width);
	assert.equal(u.steps, rBefore.steps);
	await page.keyboard.press('Control+y');
	await page.waitForTimeout(400);
	pass(
		`Simple: Use it 'replace' on r (made from B) is a whole-font step that leaves r automatic and at its fit (left ${s.letters[R].left}, width ${s.letters[R].width}); Ctrl+Z gives back r as it was`
	);

	// Finding 5 + 1: drag the small-letter line with the mouse, on B
	await openLetter(page, B);
	await pickArrow(page);
	s = await state(page);
	const onLine = screenOf(s, s.letters[B].width + 150, s.xHeight);
	// B5: Simple locks the guide lines; B15's Move the guide lines unlocks them (stand-in)
	await moveGuideLines(page, true);
	await page.mouse.move(onLine.x, onLine.y);
	await page.waitForTimeout(200);
	await page.mouse.down();
	await page.mouse.move(onLine.x, onLine.y + 40, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(500);
	await moveGuideLines(page, false);
	const moved = await state(page);
	assert.ok(moved.xHeight < s.xHeight, `line moved down (${s.xHeight} -> ${moved.xHeight})`);
	assert.equal(moved.top[0].whole, true);
	assert.equal(moved.top[1].whole, true);
	const xHeightLabel = CORE['line.xHeight'].text.replace(/^./, (c) => c.toUpperCase());
	assert.ok(moved.top[1].title.startsWith(`Moved ${xHeightLabel} to`), moved.top[1].title);
	assert.equal(moved.top[0].itemID, false);
	assert.equal(moved.top[1].itemID, false);
	assert.equal(moved.steps, s.steps + 1);
	assert.ok(allAtFit(moved), JSON.stringify(moved.letters));
	assert.notEqual(moved.letters[B].width, s.letters[B].width);
	await shot('h04-simple-xheight-dragged');
	pass(
		`Simple: dragging the small-letter line (${s.xHeight} -> ${moved.xHeight}) is one whole-font step about no letter; every automatic letter refit inside it (B width ${s.letters[B].width} -> ${moved.letters[B].width})`
	);

	await openLetter(page, R);
	await page.keyboard.press('Control+z');
	await page.waitForTimeout(500);
	u = await state(page);
	assert.equal(u.open, R, 'Undo from r stays on r');
	assert.equal(u.xHeight, s.xHeight);
	assert.equal(u.letters[B].width, s.letters[B].width);
	assert.ok(allAtFit(u));
	await shot('h05-simple-undo-from-r-stays');
	pass(
		`Simple: Ctrl+Z from small r puts the line (${u.xHeight}) and every gap back and stays on r`
	);

	// The writing line (a guide line) nudged with the keyboard on B; Undo from r stays on r
	await openLetter(page, B);
	await pickArrow(page);
	s = await state(page);
	// B5: the writing line stays locked in Simple (7.6), so the step its arrow key makes stands in
	// (a writing line step made in More tools, undone in Simple)
	await nudgeWritingLine(page, 1);
	await page.waitForTimeout(500);
	const raised = await state(page);
	assert.equal(
		Math.abs(raised.descent - s.descent),
		1,
		`descent ${s.descent} -> ${raised.descent}`
	);
	assert.equal(raised.top[1].title, 'Moved baseline');
	assert.equal(raised.top[1].itemID, false, 'about no letter');
	await openLetter(page, R);
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		window.__navigations = 0;
		const navigate = editor.navigate.bind(editor);
		editor.navigate = (...args) => {
			window.__navigations++;
			return navigate(...args);
		};
	});
	await page.mouse.move(5, 500);
	await page.keyboard.press('Control+z');
	await page.waitForTimeout(500);
	u = await state(page);
	const baselineNavigations = await page.evaluate(() => window.__navigations);
	assert.equal(u.open, R, 'Undo of the line from r stays on r');
	assert.equal(baselineNavigations, 0);
	assert.equal(u.descent, s.descent);
	await shot('h06-simple-baseline-undo-from-r');
	pass(
		`Simple: the writing line nudged on B (descent ${s.descent} -> ${raised.descent}) is a step about no letter; Ctrl+Z from r puts it back and stays on r (0 view jumps)`
	);

	// 40 quick Shift+ArrowDown presses on the small-letter line: one step, every press refit
	await openLetter(page, B);
	await pickArrow(page);
	s = await state(page);
	const onSmallLine = screenOf(s, s.letters[B].width + 150, s.xHeight);
	await moveGuideLines(page, true); // B5: B15's Move the guide lines (stand-in)
	await page.mouse.move(onSmallLine.x, onSmallLine.y);
	await page.waitForTimeout(250);
	for (let k = 0; k < 40; k++) await page.keyboard.press('Shift+ArrowDown');
	await page.waitForTimeout(500);
	await page.mouse.move(5, 500);
	await moveGuideLines(page, false);
	const burst = await state(page);
	assert.equal(
		burst.xHeight,
		s.xHeight - 400,
		`small-letter line ${s.xHeight} -> ${burst.xHeight}`
	);
	assert.equal(burst.steps, s.steps + 1, `${s.steps} -> ${burst.steps} steps`);
	assert.equal(burst.floor, false, 'nothing dropped');
	assert.ok(allAtFit(burst), JSON.stringify(burst.letters));
	await shot('h07-simple-line-40-presses');
	await page.mouse.move(5, 500);
	await page.keyboard.press('Control+z');
	await page.waitForTimeout(500);
	u = await state(page);
	assert.equal(u.xHeight, s.xHeight, 'one Ctrl+Z puts the line back');
	assert.ok(allAtFit(u));
	pass(
		`Simple: 40 quick Shift+ArrowDown presses on the small-letter line (${s.xHeight} -> ${burst.xHeight}) are one Undo step (${s.steps} -> ${burst.steps}), every letter at its fit; one Ctrl+Z puts the line back`
	);

	// Every step is still in reach: undo everything with the keyboard
	let presses = 0;
	while ((await state(page)).steps > 0 && presses < 80) {
		await page.keyboard.press('Control+z');
		presses++;
	}
	u = await state(page);
	assert.equal(u.steps, 0);
	assert.equal(u.letters[B]?.shapes || 0, 0);
	MADE_FROM_B.forEach((id) => assert.equal(u.letters[id]?.shapes || 0, 0, id));
	pass(`Simple: ${presses} more Ctrl+Z presses undo every step back to the empty font`);

	// ----------------------------------------------------------------------------------------
	// B. A list made in Simple, recovered under the default launch (All tools)
	// ----------------------------------------------------------------------------------------
	const contextB = await openChrome();
	const first = contextB.pages()[0] || (await contextB.newPage());
	watch(first);
	await first.goto(`${origin}/?ui=simple`);
	await newProject(first, 'Crash test');
	await openLetter(first, B);
	await drawRectangle(first, 900, 330, 980, 515);
	await openLetter(first, R);
	await drawRectangle(first, 900, 400, 960, 515);
	const made = await state(first);
	assert.deepEqual(
		made.top.map((e) => e.itemID),
		[R, B],
		'Simple records no navigation steps'
	);
	await first.evaluate(async () =>
		(await import('/anyink/recovery/recovery.js')).snapshotNow('verify')
	);
	await first.waitForTimeout(1500);
	await first.close({ runBeforeUnload: false });

	const second = await contextB.newPage();
	watch(second);
	await second.goto(`${origin}/?ui=all`);
	const restore = second.locator('.anyink-recovery-row__restore').first();
	await restore.waitFor({ timeout: 15000 });
	await shotOf(second)('h08-recover-card-all-tools');
	await restore.click();
	await waitUntil(
		second,
		async () => (await state(second).catch(() => null))?.entries === 2,
		'restored list'
	);
	let c = await state(second);
	assert.equal(c.mode, 'all');
	assert.deepEqual(
		c.top.map((e) => e.itemID),
		[R, B]
	);
	const crashTop = c.top.map((e) => e.title);
	await second.keyboard.press('Control+z');
	await second.waitForTimeout(400);
	c = await state(second);
	assert.equal(c.letters[R].shapes, 0, 'press 1 undoes r');
	assert.equal(c.letters[B].shapes, 1);
	assert.equal(c.redo, 1);
	await second.keyboard.press('Control+z');
	await second.waitForTimeout(400);
	c = await state(second);
	assert.equal(c.letters[B].shapes, 0, 'press 2 undoes B');
	assert.equal(c.entries, 0);
	assert.equal(c.redo, 2);
	await shotOf(second)('h09-all-tools-both-undone');
	await second.keyboard.press('Control+y');
	await second.waitForTimeout(300);
	await second.keyboard.press('Control+y');
	await second.waitForTimeout(300);
	c = await state(second);
	assert.equal(c.letters[R].shapes, 1);
	assert.equal(c.letters[B].shapes, 1);
	assert.deepEqual(
		c.top.map((e) => e.itemID),
		[R, B]
	);
	pass(
		`All tools after the Recover card: the Simple list [${crashTop.join(
			' | '
		)}] undoes r, then B, in two Ctrl+Z presses; two Ctrl+Y bring both back`
	);

	// ----------------------------------------------------------------------------------------
	// C. Simple: Delete letter, one Undo; a later change survives a crash into All tools
	// ----------------------------------------------------------------------------------------
	const contextC = await openChrome();
	const deleting = contextC.pages()[0] || (await contextC.newPage());
	watch(deleting);
	await deleting.goto(`${origin}/?ui=simple`);
	await newProject(deleting, 'Delete check');
	await openLetter(deleting, B);
	await drawRectangle(deleting, 900, 330, 980, 515);
	await openLetter(deleting, R);
	await drawRectangle(deleting, 900, 400, 950, 515);
	// B5: Simple draws no panel, so the Delete letter icon is pressed through its own code (B7's
	// Fine-tune row stands where it was)
	await pressInAllTools(deleting, 'glyphActions', 'deleteGlyph');
	await deleting.waitForTimeout(500);
	let d = await state(deleting);
	assert.equal(d.letters[R], null, 'r deleted');
	assert.ok(!d.top.some((e) => /^Automatically/.test(e.title)), JSON.stringify(d.top));
	await deleting.mouse.move(5, 500);
	await deleting.keyboard.press('Control+z');
	await deleting.waitForTimeout(400);
	d = await state(deleting);
	assert.equal(d.letters[R]?.shapes, 1, 'one Ctrl+Z brings r back');
	pass(
		'Simple: Delete letter (the code of its button; Simple draws no panel since B5) records no "Automatically navigated" step; one Ctrl+Z brings small r back with its shape'
	);
	await openLetter(deleting, B);
	await drawRectangle(deleting, 1010, 420, 1100, 515);
	await deleting.evaluate(async () =>
		(await import('/anyink/recovery/recovery.js')).snapshotNow('verify')
	);
	await deleting.waitForTimeout(1500);
	await deleting.close({ runBeforeUnload: false });
	const after = await contextC.newPage();
	watch(after);
	await after.goto(`${origin}/?ui=all`);
	const restoreC = after.locator('.anyink-recovery-row__restore').first();
	await restoreC.waitFor({ timeout: 15000 });
	await restoreC.click();
	await waitUntil(
		after,
		async () => ((await state(after).catch(() => null))?.entries || 0) > 0,
		'restored'
	);
	d = await state(after);
	assert.equal(d.mode, 'all');
	assert.equal(d.letters[B].shapes, 2);
	await after.keyboard.press('Control+z');
	await after.waitForTimeout(500);
	d = await state(after);
	assert.equal(d.letters[B].shapes, 1, 'press 1 undoes the second shape on B');
	assert.equal(d.redo, 1);
	await shotOf(after)('h10-all-tools-after-delete-list');
	pass(
		'All tools after the Recover card: a change made after a deletion and its Undo is undone by the first Ctrl+Z, never dropped'
	);

	assert.deepEqual(errors, []);
	pass('no page errors');
} finally {
	for (const context of contexts) await context.close().catch(() => {});
	await server.close();
	for (const profile of profiles)
		await rm(profile, { recursive: true, force: true }).catch(() => {});
}
