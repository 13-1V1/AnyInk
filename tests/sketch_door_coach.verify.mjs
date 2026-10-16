// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S3 fix pass (door-coach track): real-Chrome check of the four problems found in the S3 critic
// run, in the real app. Starts its own Vite server on src/, makes a new font in Simple, turns the
// 'sketch' flag on from the page (it stays off in the app until S9), then with the mouse and keys:
//   - the board's first Next line offers sketching (green, to the first letter) and keeps the
//     photo's [How] as the quiet button
//   - Capital B's stem alone: not Ready (the rail stays 0), the Next line never says "matches the
//     gray guide letter"; a wider B (a top bar and a right side) is Ready (the rail says 1)
//   - small i's stem alone: "small i still needs its dot.", never "looks done"
//   - a sketched letter with ink opens on Select (S4: Select edits the sketch; before S4 it
//     opened on the Line)
// S3 finalize adds:
//   - small i's stem alone: the letter card says Needs a look too (B11's cache has the look)
//   - the Thickness slider with the Line picked: Esc mid-drag records nothing and the slider shows
//     the letter's thickness; the arrow keys move it, one step after a pause, the keyboard kept
//   - V and a drag on B edits the sketch (S4); it is never set aside
//     (set-aside and [Use the sketch again] stay covered by unit tests)
// Prints PASS / FAIL lines; exits 1 on any FAIL.
// Usage: node tests/sketch_door_coach.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-sketch-door-coach'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-sketch-door-coach-'));

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
const shotList = [];
let failures = 0;
let passes = 0;

function check(label, ok, detail = '') {
	if (ok) passes++;
	else failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
	return ok;
}

let page = null;
const settle = (ms = 250) => page.waitForTimeout(ms);

async function shot(name) {
	await page.screenshot({ path: resolve(shots, `${name}.png`) });
	shotList.push(`${name}.png`);
}

async function openLetter(char) {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	});
	await page.locator('[data-anyink-board]').waitFor({ timeout: 10000 });
	await page.mouse.move(5, 300);
	await page.keyboard.press(/[A-Z]/.test(char) ? `Shift+${char}` : char);
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
	await settle(400);
}

const viewOf = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const r = document.querySelector('edit-canvas').canvas.getBoundingClientRect();
		const { guideLines } = await import('/anyink/placement/classes.js');
		return {
			left: r.left,
			top: r.top,
			view: { ...editor.view },
			lines: guideLines(editor.project.settings.font),
		};
	});

async function clickAt(v, x, y) {
	await page.mouse.move(v.left + v.view.dx + x * v.view.dz, v.top + v.view.dy - y * v.view.dz, {
		steps: 6,
	});
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(120);
}

async function enter() {
	await page.keyboard.press('Enter');
	await settle(400);
}

const coach = () =>
	page.evaluate(() => {
		const el = document.querySelector('anyink-coach');
		const shown = (q) => (q && !q.hidden ? q.textContent.trim() : '');
		return {
			sentence: el?.querySelector('.anyink-coach__sentence')?.textContent || '',
			button: shown(el?.querySelector('.anyink-coach__button')),
			quiet: shown(el?.querySelector('.anyink-coach__quiet')),
		};
	});

async function waitCoach(re, timeout = 6000) {
	const end = Date.now() + timeout;
	let now = await coach();
	while (Date.now() < end && !re.test(now.sentence)) {
		await page.waitForTimeout(150);
		now = await coach();
	}
	return now;
}

const rail = () =>
	page.evaluate(
		() =>
			document
				.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count')
				?.textContent?.trim() || ''
	);

const tool = () =>
	page.evaluate(
		async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedTool
	);

const cardState = () =>
	page.evaluate(() => {
		const c = document.querySelector('.anyink-letter-card__state');
		return c ? `${c.getAttribute('data-anyink-state')}|${c.textContent}` : '(no card)';
	});

const letterState = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { builtMatches } = await import('/anyink/sketch/sketch_record.js');
		const item = editor.selectedItem;
		const sketch = item?.anyink?.sketch;
		return {
			steps: editor.history.queue.length,
			title: editor.history.queue[0]?.title || '',
			thickness: sketch?.thickness ?? null,
			setAside: sketch?.setAside ?? null,
			matches: item ? builtMatches(item) : null,
		};
	});

try {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	await context.addInitScript(() => {
		window.showSaveFilePicker = async () => {
			throw new DOMException('The user aborted a request.', 'AbortError');
		};
	});
	page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Door Coach');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await settle(500);
	await page.evaluate(async () => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: true });
		(await import('/app/main.js')).getCurrentProjectEditor().navigate();
	});
	await page.locator('[data-anyink-board]').waitFor({ timeout: 10000 });

	// ---- the board's first line ----------------------------------------------------------------
	const first = await waitCoach(/sketching/);
	check(
		'board: the first Next line offers sketching first, green to a letter, [How] quiet',
		/^Start by sketching/.test(first.sentence) && /^Make /.test(first.button) && /How/.test(first.quiet),
		`"${first.sentence}" [${first.button}] [${first.quiet}]`
	);
	await shot('01-board-first-line');

	// ---- Capital B: the stem alone -----------------------------------------------------------
	await openLetter('B');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	let v = await viewOf();
	await clickAt(v, 150, v.lines.writing + 2);
	await clickAt(v, 150, v.lines.capitals - 2);
	await enter();
	await settle(2500);
	let line = await coach();
	const railStem = await rail();
	check('B stem alone: the rail counts no Ready letter', /^0\b/.test(railStem), railStem);
	check(
		'B stem alone: the Next line never says it matches the gray guide letter',
		!/matches the gray guide letter/.test(line.sentence),
		`"${line.sentence}" [${line.button}]`
	);
	check('B stem alone: the Next line says it looks unfinished', /looks unfinished/.test(line.sentence), line.sentence);
	await shot('02-B-stem');

	// ---- B made wide: a top bar and the right side ---------------------------------------------
	v = await viewOf();
	await clickAt(v, 150, v.lines.capitals - 2);
	await clickAt(v, 520, v.lines.capitals - 2);
	await clickAt(v, 520, v.lines.writing + 2);
	await enter();
	await settle(2500);
	const railWide = await rail();
	line = await coach();
	check('B made wide: Ready, the rail counts 1', /^1\b/.test(railWide), railWide);
	check('B made wide: no "looks unfinished"', !/looks unfinished/.test(line.sentence), line.sentence);

	// ---- a sketched letter opens on the Line ---------------------------------------------------
	await openLetter('n');
	await openLetter('B');
	const opened = await tool();
	check('B with ink opens on Select (S4: Select edits the sketch)', opened === 'resize', opened);
	await shot('03-B-reopened');

	// ---- small i: the stem alone ---------------------------------------------------------------
	await openLetter('i');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await clickAt(v, 200, v.lines.writing + 2);
	await clickAt(v, 200, v.lines.small - 2);
	await enter();
	line = await waitCoach(/dot/);
	check(
		'i stem alone: "small i still needs its dot.", never "looks done"',
		line.sentence === 'small i still needs its dot.' && !/looks done/.test(line.sentence),
		`"${line.sentence}" [${line.button}]`
	);
	await shot('04-i-stem');

	// ---- S3 finalize: the card agrees with the Next line ---------------------------------------
	let card = '';
	for (let i = 0; i < 30 && !/^needsLook\|/.test(card); i++) {
		card = await cardState();
		if (!/^needsLook\|/.test(card)) await page.waitForTimeout(150);
	}
	check('i stem alone: the letter card says Needs a look, never Ready', /^needsLook\|/.test(card), card);

	// ---- S3 finalize: Esc during a Thickness drag with the Line picked ------------------------
	const toolNow = await tool();
	check('i: a sketch tool is picked while the slider is used', /^sketch/.test(toolNow), toolNow);
	const before = await letterState();
	const slider = page.locator('.anyink-sketch-thickness__slider');
	let box = await slider.boundingBox();
	let range = await slider.evaluate((el) => ({ min: +el.min, max: +el.max, value: +el.value }));
	const thumbX = box.x + (box.width * (range.value - range.min)) / (range.max - range.min);
	await page.mouse.move(thumbX, box.y + box.height / 2, { steps: 3 });
	await page.mouse.down();
	await page.mouse.move(thumbX + 60, box.y + box.height / 2, { steps: 6 });
	await settle(200);
	await page.keyboard.press('Escape');
	await page.mouse.move(thumbX + 90, box.y + box.height / 2, { steps: 4 });
	await page.mouse.up();
	await settle(900);
	const afterEsc = await letterState();
	const shown = await page
		.locator('.anyink-sketch-thickness__slider')
		.evaluate((el) => +el.value)
		.catch(() => null);
	check(
		'Esc mid-drag with the Line picked: no step, the thickness kept, the slider shows it',
		afterEsc.steps === before.steps &&
			afterEsc.thickness === before.thickness &&
			shown === before.thickness &&
			/^sketch/.test(await tool()),
		JSON.stringify({ before, afterEsc, shown, tool: await tool() })
	);

	// ---- S3 finalize: the arrow keys on the slider, the Line still picked ----------------------
	await page.locator('.anyink-sketch-thickness__slider').focus();
	for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
	await settle(1200);
	const afterKeys = await letterState();
	const focused = await page.evaluate(() =>
		document.activeElement?.classList?.contains('anyink-sketch-thickness__slider')
	);
	check(
		'arrow keys move the slider: one step, 5 units thicker, the keyboard still on it',
		afterKeys.steps === before.steps + 1 &&
			afterKeys.thickness === before.thickness + 5 &&
			/thickness/.test(afterKeys.title) &&
			focused,
		JSON.stringify({ afterKeys, focused })
	);
	await shot('05-i-thickness-keys');

	// ---- S3 finalize: set aside by Select, and the way back --------------------------------------
	await openLetter('B');
	await page.mouse.move(5, 300);
	await page.keyboard.press('v');
	await settle(200);
	v = await viewOf();
	const at = (x, y) => [v.left + v.view.dx + x * v.view.dz, v.top + v.view.dy - y * v.view.dz];
	const [sx, sy] = at(150, 700);
	await page.mouse.move(sx, sy, { steps: 4 });
	await page.mouse.down();
	await page.mouse.move(sx + 40, sy, { steps: 6 });
	await page.mouse.up();
	await settle(800);
	const aside = await letterState();
	// S4: Select edits the sketch itself, so a drag never sets it aside
	check(
		'V and a drag on B edits the sketch: never set aside, ink matches, one step',
		aside.setAside === false && aside.matches === true,
		JSON.stringify(aside)
	);
	await shot('06-B-edited');

	check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (error) {
	failures++;
	console.log(`FAIL the run stopped: ${error?.stack || error}`);
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passes} passed, ${failures} failed; shots: ${shots}`);
console.log(`screenshots: ${shotList.join(', ')}`);
process.exit(failures ? 1 : 0);
