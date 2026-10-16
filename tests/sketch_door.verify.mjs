// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S3 door-coach (docs/SKETCH.md section 7): real-Chrome check of the empty letter's one green
// door and the Next line's sketch rules in the real app. Starts its own Vite server on src/,
// makes a new font in Simple, and:
//   flag off   small n opens on the Brush with today's box ([Draw with the brush], no sketch door)
//   flag on    (mode/features.js setFeaturesForTests from the page: off in the app until S9)
//              small n opens on the Line with the box up: [Sketch it] the one green button, L
//              printed, the outline link, More ways shut; strict banned-word scan of the box
//              a click on the paper opens a piece: the box goes, the Next line says "Finish the
//              line..." with [Done]; a second click, [Done] stores the piece as one step
//              after it, the Next line (rule 24 once the build track makes ink)
//              small o: the outline link picks the Line with the way Outline
//              small u: More ways > Draw with the brush picks the Brush; the box goes
// Prints PASS / FAIL lines; exits 1 on any FAIL.
// Usage: node tests/sketch_door.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-sketch-door'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-sketch-door-'));

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
	channel: process.env.SKETCH_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
let failures = 0;
let passes = 0;

function check(label, ok, detail = '') {
	if (ok) passes++;
	else failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
	return ok;
}

const shot = (page, name) => page.screenshot({ path: resolve(shots, `${name}.png`) });

const setFlag = (page, on) =>
	page.evaluate(async (value) => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: value });
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.navigate();
	}, on);

/** Opens a letter the way the board does when its key is typed */
async function openLetter(page, char) {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	});
	await page.locator('[data-anyink-board]').waitFor({ timeout: 10000 });
	await page.mouse.move(5, 300);
	await page.keyboard.press(char);
	await page.waitForFunction(
		async (c) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			return (
				editor.nav.page === 'Characters' &&
				editor.selectedItem?.chars === c &&
				!!document.querySelector('edit-canvas')?.canvas?.isConnected
			);
		},
		char,
		{ timeout: 10000 }
	);
	await page.waitForTimeout(300);
}

/** The screen now: tool, box, its green buttons, the Next line, the open letter's sketch */
const screen = (page) =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getCoach } = await import('/anyink/coach/coach_state.js');
		const { isPieceOpen } = await import('/anyink/sketch/tools/undo_gate.js');
		const coach = getCoach();
		coach.flush?.();
		const box = document.querySelector('[data-anyink-overlay]');
		const visible = (el) => !!el && el.checkVisibility();
		const greens = [...document.querySelectorAll('.anyink-primary, .anyink-coach__button')]
			.filter((el) => visible(el))
			.filter(
				(el) =>
					el.classList.contains('anyink-primary') ||
					getComputedStyle(el).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue('--touch')
			)
			.map((el) => el.textContent.trim());
		const item = editor.selectedItem;
		const line = coach.line();
		return {
			tool: editor.selectedTool,
			boxShown: visible(box),
			boxText: box?.textContent || '',
			buttons: [...(box?.querySelectorAll('[data-anyink-overlay-action]') || [])].map(
				(b) => `${b.dataset.anyinkOverlayAction}${b.classList.contains('anyink-primary') ? '*' : ''}`
			),
			key: box?.querySelector('.anyink-empty-overlay__key')?.textContent || '',
			links: [...(box?.querySelectorAll('[data-anyink-overlay-link]') || [])]
				.filter((el) => visible(el))
				.map((el) => el.dataset.anyinkOverlayLink),
			greens,
			rule: line.rule,
			sentence: line.sentence,
			lineButton: line.button,
			primary: line.primary,
			open: isPieceOpen(),
			way: item?.anyink?.sketch?.way ?? null,
			pieces: item?.anyink?.sketch?.pieces?.length ?? 0,
			shapes: item?.shapes?.length ?? 0,
			top: editor.history.queue.find((e) => !e.navigation)?.title || '',
		};
	});

/** The banned-word scan in the real page, strict */
const scan = (page, selector) =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return root ? [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit) : [];
	}, selector);

/** A click on the paper at font units (x, y) */
async function clickAt(page, x, y) {
	const p = await page.evaluate(
		async ([fx, fy]) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const r = document.querySelector('edit-canvas').canvas.getBoundingClientRect();
			return { x: r.left + editor.view.dx + fx * editor.view.dz, y: r.top + editor.view.dy - fy * editor.view.dz };
		},
		[x, y]
	);
	await page.mouse.move(p.x, p.y, { steps: 6 });
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(150);
}

let page = null;
try {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Door Test');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page.waitForTimeout(500);

	// ---- flag off: today's box and the opening Brush ---------------------------------------
	await openLetter(page, 'n');
	let s = await screen(page);
	check(
		'flag off: small n opens on the Brush, the box with [Draw with the brush], no sketch door',
		s.tool === 'nib' && s.boxShown && s.buttons.includes('drawBrush') && !s.buttons.includes('sketchIt'),
		JSON.stringify({ tool: s.tool, buttons: s.buttons })
	);
	await shot(page, '01-flag-off');

	// ---- flag on: the door --------------------------------------------------------------------
	await setFlag(page, true);
	await openLetter(page, 'n');
	s = await screen(page);
	check('flag on: small n opens on the Line', s.tool === 'sketchLine', s.tool);
	check(
		'the box stays up with [Sketch it] green and L printed, [Use a photo] outlined',
		s.boxShown && s.buttons[0] === 'sketchIt*' && s.buttons[1] === 'usePhoto' && s.key === 'L',
		JSON.stringify({ buttons: s.buttons, key: s.key })
	);
	check(
		'no Brush button and no "Draw it with points"; the outline link and More ways (shut)',
		!s.buttons.includes('drawBrush') &&
			!s.buttons.includes('drawPoints') &&
			s.links.includes('outline') &&
			s.links.includes('more') &&
			!s.links.includes('brush'),
		JSON.stringify(s.links)
	);
	check('one green button on screen', s.greens.length === 1, JSON.stringify(s.greens));
	check('the Next line gives no tool for the Line it opened with (rule 8)', s.rule === 8, `${s.rule} ${s.sentence}`);
	await page.locator('[data-anyink-overlay-link="more"]').click();
	await page.waitForTimeout(100);
	const hits = await scan(page, '[data-anyink-overlay]');
	check('strict banned-word scan of the box (More ways open)', !hits.length, hits.join(' | '));
	await shot(page, '02-door');

	// ---- a piece: the box goes, rule 19, [Done] -----------------------------------------------
	await clickAt(page, 150, 0);
	s = await screen(page);
	check(
		'a click on the paper opens a piece: the box goes, the Next line says finish it with [Done]',
		s.open && !s.boxShown && s.rule === 19 && /^Finish the line/.test(s.sentence) && s.lineButton === 'Done',
		JSON.stringify({ open: s.open, box: s.boxShown, rule: s.rule, sentence: s.sentence })
	);
	const small = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return Number(editor.project.settings.font.xHeight) || 500;
	});
	await clickAt(page, 150, small);
	await shot(page, '03-piece-open');
	await page.locator('anyink-coach .anyink-coach__button').click();
	await page.waitForTimeout(300);
	s = await screen(page);
	check(
		'[Done] stores the piece as one step',
		!s.open && s.pieces === 1 && s.top === 'sketched a line on small n',
		JSON.stringify({ open: s.open, pieces: s.pieces, top: s.top })
	);
	console.log(
		`INFO after the piece: ${s.shapes} shape(s) on small n; Next line rule ${s.rule}: "${s.sentence}" [${s.lineButton}]`
	);
	if (s.shapes > 0) {
		// rule 7 (a letter's look) comes first by design; rule 24 is next in line then
		check(
			'with built Centerline ink and no font thickness: rule 24 [Looks good] (or rule 7 first)',
			(s.rule === 24 && s.lineButton === 'Looks good') || s.rule === 7,
			`${s.rule} ${s.sentence}`
		);
		if (s.rule === 24) {
			await page.locator('anyink-coach .anyink-coach__button').click();
			await page.waitForTimeout(200);
			const kept = await page.evaluate(async () => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				return {
					font: editor.project.settings.anyink?.sketchThickness ?? null,
					letter: editor.selectedItem.anyink.sketch.thickness,
				};
			});
			s = await screen(page);
			check(
				"[Looks good] keeps the letter's thickness as the font's; rule 24 goes",
				kept.font === kept.letter && s.rule !== 24,
				JSON.stringify(kept)
			);
		}
	}
	await shot(page, '04-after-done');

	// ---- the outline door ----------------------------------------------------------------------
	await openLetter(page, 'o');
	await page.locator('[data-anyink-overlay-link="outline"]').click();
	await page.waitForTimeout(200);
	s = await screen(page);
	check(
		'small o: the outline link picks the Line with the way Outline; the box goes',
		s.tool === 'sketchLine' && s.way === 'outline' && !s.boxShown,
		JSON.stringify({ tool: s.tool, way: s.way, box: s.boxShown })
	);

	// ---- More ways > the Brush -----------------------------------------------------------------
	await openLetter(page, 'u');
	await page.locator('[data-anyink-overlay-link="more"]').click();
	await page.locator('[data-anyink-overlay-link="brush"]').click();
	await page.waitForTimeout(200);
	s = await screen(page);
	check('small u: More ways > Draw with the brush picks the Brush; the box goes', s.tool === 'nib' && !s.boxShown, s.tool);
	await shot(page, '05-more-ways-brush');

	check('no page errors', !errors.length, errors.slice(0, 5).join(' | '));
} catch (error) {
	failures++;
	console.log(`FAIL the run stopped: ${error.stack || error.message}`);
	if (page) await page.screenshot({ path: resolve(shots, 'stopped.png') }).catch(() => {});
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true });
}
console.log(`${passes} passed, ${failures} failed; shots: ${shots}`);
if (failures) process.exit(1);
