// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration real-browser check (docs/UX-BEGINNER.md 4.2 the letter board, 4.3 the
// letter card, 4.0 rules 7 and 9, 7.2, 7.3; section 10 B10 and B11), in the real app on Vite dev
// servers, Chrome with throwaway profiles, 1600 x 900, the feature flags as the app ships them
// ('board' and 'checks' on now), Simple by ?ui=simple:
//   A. A new font: the board is home, 58 faint to-do tiles (Empty, a faint outlined letter),
//      "0 of 58 ready", no filters, the rail "0/58", the Next line's first sentence; no banned
//      word on the screen (strict)
//   B. Typing b on the board opens small b; "<- All letters" comes back to the board with small
//      b's tile ringed
//   C. A handwriting photo (B r e n a H d) dropped on blank board space: the photo dialog with
//      the letter unknown; walked into all seven letters (type the letter, Trace it, Use it, the
//      Next line's [Do the next one]); the board: seven Ready tiles "from a photo", and the board,
//      the rail and the Next line say one number
//   D. Two letters broken on purpose (small e 45 % bigger, small n 10 % of the letter box over
//      the writing line), one Undo step each, as a drag would be: their tiles turn amber with
//      plain reasons, the filters show, the Next line says "2 letters need a look." [Show me],
//      the rail and the board say 5
//   E. [Show me]: the board on Needs a look, each tile with its reason and outlined fixes, and the
//      Next line takes them one at a time (small e's reason, its green [Match size]). [Sit on the
//      line] on small n's tile: one Undo step, the board stays; Ctrl+Z on the board puts it back
//      (named toast); [Looks fine to me] on small n: one step, the amber clears
//   F. Typing e: the letter card's chip "Needs a look: too tall for the small-letter line" with
//      [Looks fine to me] (outlined), the Next line's rule 7 with the one green [Match size];
//      pressing it is one step and the letter is Ready; the spacing stays automatic and at its fit;
//      the font check finds nothing; back on the board every count agrees again
//   G. A work file (.gs2) dropped on the board: with unsaved work, Ctrl+O's box first; on a font
//      with nothing to lose, it opens (the font's name and its letters)
//   H. The backup write in Chrome's own IndexedDB on a 58-letter traced font with the Undo list
//      at its fullest (200 steps, 30 whole-font): a write after one more step on a letter, and
//      after one more step about the whole font, against D-026's 100 ms (D-042: each step's saved
//      copy is a record of its own, written once)
//   I. All tools, before (the last commit's src/, git archive; B1011_BEFORE=<src folder> for
//      another, B1011_BEFORE=skip for none) and after: a new font's Overview and small a's page,
//      the same controls and the same pixels
// Usage: node tests/b1011.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync, symlinkSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b1011'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b1011-'));
const FIXTURES = '/anyink/photo/tests/fixtures';

/** The last commit's src/, for the All tools "before": git archive into a temp folder. */
function exportHeadSrc() {
	const dir = resolve(scratch, 'head');
	execSync(`mkdir "${dir}"`, { shell: true, stdio: 'pipe' });
	// Windows' own tar (bsdtar): a Git Bash tar earlier on PATH reads "C:" as a remote host
	const tar =
		process.platform === 'win32'
			? `"${resolve(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe')}"`
			: 'tar';
	execSync(`git archive HEAD src | ${tar} -x -C "${dir}"`, {
		cwd: repo,
		stdio: 'pipe',
		shell: true,
	});
	symlinkSync(resolve(repo, 'node_modules'), resolve(dir, 'node_modules'), 'junction');
	return resolve(dir, 'src');
}

async function serve(root, name) {
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'error',
		cacheDir: resolve(scratch, `vite-${name}`),
		server: {
			port: 0,
			host: '127.0.0.1',
			hmr: false,
			watch: { ignored: ['**/*'] },
			fs: { strict: false },
		},
	});
	await server.listen();
	return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}` };
}

const beforeSetting = process.env.B1011_BEFORE || '';
const beforeRoot =
	beforeSetting === 'skip' ? null : beforeSetting ? resolve(beforeSetting) : exportHeadSrc();
const after = await serve(src, 'after');
const before = beforeRoot ? await serve(beforeRoot, 'before') : null;

const browser = await chromium.launch({
	channel: process.env.B1011_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 350, p = page) => p.waitForTimeout(ms);

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
const shot = async (name, clip, p = page) => {
	const path = resolve(shots, `${name}.png`);
	await p.screenshot({ path, ...(clip ? { clip } : {}) });
	shotList.push(`${name}.png`);
	return path;
};
const offCanvas = (p = page) => p.mouse.move(5, 895);
const waitUntil = async (check, what, timeout = 20000, p = page) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await p.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
const newFont = async (p, origin, name, search = '?ui=all') => {
	await p.goto(`${origin}/${search}`);
	const field = p.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill(name);
	await p.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(700, p);
};
const where = (p = page) =>
	p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return { page: editor.nav.page, item: editor.selectedItemID, tool: editor.selectedTool };
	});
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

/** What the Simple screen says, read with Chrome's own visibility */
const screen = (p = page) =>
	p.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const coach = document.querySelector('anyink-coach');
		const coachButton = coach?.querySelector('.anyink-coach__button');
		return {
			rail: text(document.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			coachButton: shown(coachButton) ? text(coachButton) : null,
			greens: [...document.querySelectorAll('.anyink-primary, fancy-button.anyink-primary')]
				.filter(shown)
				.map((el) => ({
					text: text(el),
					where: el.closest('anyink-coach')
						? 'next line'
						: el.closest('[data-anyink-photo-card]')
						? 'photo card'
						: el.closest('[data-anyink-dialog]')
						? el.closest('[data-anyink-dialog]').dataset.anyinkDialog
						: el.closest('.anyink-letter-card')
						? 'card'
						: el.closest('[data-anyink-overlay]')
						? 'overlay'
						: 'other',
				})),
			toast: text(
				document.querySelector(
					'#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__text'
				)
			),
			toastButton: text(
				document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving]) button')
			),
		};
	});

/** The board as Chrome draws it */
const board = (p = page) =>
	p.evaluate(() => {
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const root = document.querySelector('[data-anyink-board]');
		if (!root) return null;
		const tiles = [...root.querySelectorAll('[data-anyink-board-cell] > glyph-tile')].map(
			(tile) => {
				const wrapper = tile.shadowRoot?.querySelector('.wrapper');
				const standIn = tile.shadowRoot?.querySelector('.stand-in');
				const mark = tile.shadowRoot?.querySelector('.mark');
				return {
					char: tile.dataset.anyinkChar,
					state: wrapper?.getAttribute('session-state'),
					caption: text(tile.shadowRoot?.querySelector('.caption')),
					title: tile.title,
					standIn: !!standIn && getComputedStyle(standIn).display !== 'none',
					border: wrapper ? getComputedStyle(wrapper).borderTopStyle : null,
					mark: !!mark && getComputedStyle(mark).display !== 'none',
					ring: tile.hasAttribute('last-touched'),
				};
			}
		);
		return {
			progress: text(root.querySelector('.anyink-board__progress')),
			filters: [...root.querySelectorAll('[data-anyink-board-filter]')].map(text),
			filter: root.getAttribute('data-filter'),
			tiles,
			looks: [...root.querySelectorAll('.anyink-board__look')].map((look) => ({
				char: look.closest('[data-anyink-board-cell]').dataset.char,
				reason: text(look.querySelector('.anyink-board__reason')),
				buttons: [...look.querySelectorAll('button')].map((b) => ({
					text: text(b),
					kind: b.dataset.anyinkBoardFix,
					outlined:
						b.classList.contains('anyink-outlined') && !b.classList.contains('anyink-primary'),
				})),
			})),
		};
	});
const tileOf = (b, char) => b.tiles.find((t) => t.char === char);

/** The Next line's own count, and the coach's letters (what rule 9 reads) */
const coachFacts = (p = page) =>
	p.evaluate(async () => {
		const { getCoach } = await import('/anyink/coach/coach_state.js');
		const state = getCoach().state();
		const letters = state.letters || [];
		return {
			ready: letters.filter((l) => l.ready).length,
			needsLook: letters.filter((l) => l.needsLook).map((l) => l.char),
			rule: getCoach().line().rule,
		};
	});

/** The banned-word scan in the real page (real CSS), strict: visible text, tooltips, case */
const scanSimple = (selector = 'body', p = page) =>
	p.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);

/** The Undo list's newest press and its length */
const history = (p = page) =>
	p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const q = editor.history.queue;
		return { length: q.length, top: q[0]?.title || '' };
	});

const toBoardByBack = async () => {
	await page.locator('[data-anyink-letter="back"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(600);
};
const toBoardByLogo = async () => {
	await page.locator('[data-anyink-control="logo"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(600);
};

/** The photo dialog has drawn its photo ("Loading the photo..." is gone) */
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

/** Drops a file on an element the way Chrome does (a DragEvent with a DataTransfer) */
const dropOn = (selector, { url, name, type, text }) =>
	page.evaluate(
		async ({ sel, url: u, name: n, type: t, text: body }) => {
			const blob = u ? await (await fetch(u)).blob() : new Blob([body], { type: t });
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
		{ sel: selector, url, name, type, text }
	);

try {
	// ------------------------------------------------------------------
	// A. A new font: the board is home
	// ------------------------------------------------------------------
	page = await freshPage('simple');
	await newFont(page, after.origin, 'Brennan Hand', '?ui=simple');
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await settle(600);
	let b = await board();
	let s = await screen();
	assert.equal((await where()).page, 'Overview');
	assert.equal(b.tiles.length, 58);
	assert.ok(
		b.tiles.every((t) => t.state === 'empty' && t.caption === 'Empty'),
		'every tile Empty'
	);
	assert.ok(
		b.tiles.every((t) => t.standIn && t.border === 'dashed'),
		'faint outlined to-do letters, dashed'
	);
	assert.equal(b.progress, '0 of 58 ready');
	assert.deepEqual(b.filters, []);
	assert.equal(s.rail, '0/58');
	assert.equal(s.sentence, 'First, write your letters on paper and take one photo of the page.');
	assert.deepEqual(await scanSimple(), []);
	await shot('A1-board-home-new-font');
	pass(
		`A: a new font in Simple opens on the board: 58 faint to-do tiles (Empty, dashed, an outlined letter), "${b.progress}", no filters, rail "${s.rail}", Next line "${s.sentence}" [${s.coachButton}]; 0 banned words (strict)`
	);

	// ------------------------------------------------------------------
	// B. Type b
	// ------------------------------------------------------------------
	await page.keyboard.press('b');
	await waitUntil(async () => (await where()).item === 'glyph-0x62', 'b opens small b');
	await offCanvas();
	await settle(700);
	const header = await page.locator('[data-anyink-letter="name"]').innerText();
	assert.equal(header, 'small b');
	assert.equal((await where()).page, 'Characters');
	assert.equal((await history()).length, 0, 'opening a letter is no Undo step');
	await shot('B1-typed-b-opens-small-b');
	await toBoardByBack();
	b = await board();
	assert.deepEqual(
		b.tiles.filter((t) => t.ring).map((t) => t.char),
		['b']
	);
	pass(
		`B: typing b on the board opened "${header}" (no Undo step); "<- All letters" came back with small b's tile ringed`
	);

	// ------------------------------------------------------------------
	// C. A handwriting photo dropped on the board, walked into seven letters
	// ------------------------------------------------------------------
	const key = await page.evaluate(
		async (base) => (await fetch(`${base}/brenna-loose-phone.json`)).json(),
		FIXTURES
	);
	const dropped = await dropOn('.anyink-board__sections', {
		url: `${FIXTURES}/brenna-loose-phone.jpg`,
		name: 'IMG_2041.jpg',
		type: 'image/jpeg',
	});
	assert.equal(dropped, true, 'the board takes the drop');
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 30000 });
	await photoDrawn();
	await settle(500);
	const mode = await page
		.locator('[data-anyink-dialog="photoDialog"]')
		.getAttribute('data-anyink-photo-dialog');
	assert.equal(mode, 'unknown', 'the letter unknown');
	assert.equal((await where()).page, 'Overview', 'the board stays behind the dialog');
	assert.deepEqual(await scanSimple(), []);
	await shot('C1-photo-dropped-on-board-dialog');

	const walked = [];
	for (let n = 0; n < key.letters.length; n++) {
		const info = await page.evaluate(async () => {
			const dialog = document.querySelector('[data-anyink-dialog="photoDialog"]');
			const picked = dialog.querySelector('[data-anyink-picked]')?.getAttribute('data-anyink-part');
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { getPhoto } = await import('/anyink/photo/photo_registry.js');
			const asset = Object.keys(editor.project.settings.anyink.photos)[0];
			const record = getPhoto(editor.project, asset);
			return { part: record.parts.find((p) => p.id === picked) };
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
		await offCanvas();
		await settle(400);
		if (n === 0) await shot('C2-step-c-first-letter');
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
			// rule 12; another rule may come first (the work file isn't saved, rule 10; a letter
			// that needs a look, rule 7): Something else moves on, as he would
			for (let guard = 0; guard < 5 && !/more letter/.test(s.sentence || ''); guard++) {
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
	await toBoardByLogo();
	b = await board();
	s = await screen();
	let coach = await coachFacts();
	const ready = b.tiles.filter((t) => t.state === 'ready');
	assert.deepEqual(
		ready.map((t) => t.char).sort(),
		[...'BrenaHd'].sort(),
		`the seven traced letters are Ready: ${JSON.stringify(
			b.tiles.filter((t) => t.state !== 'empty')
		)}`
	);
	assert.ok(
		ready.every((t) => /from a photo/.test(t.title)),
		'tooltips say "from a photo"'
	);
	assert.equal(b.progress, '7 of 58 ready');
	assert.equal(s.rail, '7/58');
	assert.equal(coach.ready, 7);
	assert.deepEqual(coach.needsLook, []);
	assert.deepEqual(await scanSimple(), []);
	await shot('C3-board-seven-ready-from-the-photo');
	pass(
		`C: a photo dropped on blank board space opened the photo dialog (letter unknown); walked into ${walked.join(
			' '
		)}; the board: 7 Ready tiles "from a photo", "${b.progress}", rail "${
			s.rail
		}", the Next line's letters 7 ready, none needs a look; 0 banned words`
	);

	// ------------------------------------------------------------------
	// D. Two letters broken on purpose
	// ------------------------------------------------------------------
	const breakLetter = async (char, how) => {
		await page.keyboard.press(char);
		await waitUntil(async () => (await where()).item === ID(char), `${char} opens`);
		await offCanvas();
		await settle(500);
		const steps = (await history()).length;
		await page.evaluate(async (way) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const glyph = editor.selectedItem;
			const upm = editor.project.settings.font.upm;
			if (way === 'bigger') {
				const m = glyph.maxes;
				glyph.updateGlyphSize({
					width: (m.xMax - m.xMin) * 0.45,
					height: (m.yMax - m.yMin) * 0.45,
				});
				editor.history.addState(`made small e bigger`);
			} else {
				glyph.updateGlyphPosition(0, Math.round(upm * 0.1));
				editor.history.addState(`moved small n up`);
			}
			editor.publish('currentItem', glyph);
		}, how);
		await settle(500);
		assert.equal((await history()).length, steps + 1, `${char}: one Undo step`);
		await toBoardByBack();
	};
	await breakLetter('e', 'bigger');
	await breakLetter('n', 'up');
	b = await board();
	s = await screen();
	coach = await coachFacts();
	const e = tileOf(b, 'e');
	const nTile = tileOf(b, 'n');
	assert.deepEqual([e.state, nTile.state], ['needsLook', 'needsLook']);
	assert.ok(e.mark && nTile.mark, 'the "!" on both');
	assert.equal(e.caption, 'Needs a look');
	assert.equal(e.title, 'small e · Needs a look: too tall for the small-letter line');
	assert.equal(nTile.title, 'small n · Needs a look: floats above the writing line');
	assert.deepEqual(b.filters, ['All 58', 'Needs a look 2', 'Empty 51']);
	assert.equal(b.progress, '5 of 58 ready');
	assert.equal(s.rail, '5/58');
	assert.equal(s.sentence, '2 letters need a look.');
	assert.equal(s.coachButton, 'Show me');
	assert.deepEqual(coach.needsLook.sort(), ['e', 'n']);
	assert.equal(coach.ready, 5);
	assert.deepEqual(await scanSimple(), []);
	await shot('D1-two-letters-need-a-look');
	pass(
		`D: small e made 45 % bigger and small n moved up (one step each): both tiles amber with "!" ("${
			e.title
		}"; "${nTile.title}"), filters ${JSON.stringify(b.filters)}, "${b.progress}", rail "${
			s.rail
		}", Next line "${s.sentence}" [${s.coachButton}]: one count everywhere; 0 banned words`
	);

	// ------------------------------------------------------------------
	// E. Show me, the tile's fixes, Undo on the board, Looks fine to me
	// ------------------------------------------------------------------
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(600);
	b = await board();
	assert.equal(b.filter, 'needsLook');
	assert.deepEqual(b.tiles.map((t) => t.char).sort(), ['e', 'n']);
	const lookN = b.looks.find((l) => l.char === 'n');
	const lookE = b.looks.find((l) => l.char === 'e');
	assert.equal(lookN.reason, 'small n floats above the writing line.');
	assert.deepEqual(
		lookN.buttons.map((x) => x.text),
		['Sit on the line', 'Looks fine to me']
	);
	assert.equal(lookE.reason, 'small e is too tall for the small-letter line.');
	assert.deepEqual(
		lookE.buttons.map((x) => x.text),
		['Match size', 'Looks fine to me']
	);
	assert.ok(
		[...lookN.buttons, ...lookE.buttons].every((x) => x.outlined),
		'every tile button outlined'
	);
	s = await screen();
	// the Next line takes them one at a time: the first one's reason, its fix the one green
	assert.equal(s.sentence, 'small e is too tall for the small-letter line.');
	assert.deepEqual(s.greens, [{ text: 'Match size', where: 'next line' }]);
	assert.deepEqual(await scanSimple(), []);
	await shot('E1-show-me-needs-a-look');

	let steps = (await history()).length;
	await page
		.locator('[data-anyink-board-cell][data-char="n"] [data-anyink-board-fix="fix"]')
		.click();
	await settle(700);
	let h = await history();
	assert.equal(h.length, steps + 1, 'Sit on the line: one step');
	assert.equal(h.top, 'sat small n on the writing line');
	assert.equal((await where()).page, 'Overview', 'the board stays the board');
	b = await board();
	s = await screen();
	assert.equal(b.progress, '6 of 58 ready');
	assert.equal(s.rail, '6/58');
	const nSeated = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { inkBounds } = await import('/anyink/spacing/measure.js');
		const { sitsAtFit } = await import('/anyink/spacing/auto_space.js');
		const n = editor.project.getItem('glyph-0x6E');
		return {
			bottom: Math.round(inkBounds(n).yMin),
			auto: n.anyink?.spacing,
			fit: sitsAtFit(n, editor.project),
		};
	});
	assert.ok(Math.abs(nSeated.bottom) <= 41, `small n sits on the line: ${nSeated.bottom}`);
	assert.deepEqual(
		[nSeated.auto, nSeated.fit],
		['auto', true],
		'its spacing automatic and at its fit'
	);
	await shot('E2-sit-on-the-line-from-the-tile');
	pass(
		`E: [Show me] put the board on Needs a look (e and n, each with its reason and outlined fixes; the Next line took the first, "small e is too tall for the small-letter line." with the one green [Match size]); small n's own [Sit on the line]: one step "${h.top}", the board stayed, "${b.progress}", rail "${s.rail}", n's bottom at ${nSeated.bottom}, spacing automatic and at its fit`
	);

	await page.keyboard.press('Control+z');
	await settle(700);
	s = await screen();
	b = await board();
	assert.equal((await where()).page, 'Overview', 'Undo stayed on the board');
	assert.equal(s.toast, 'Undid: sat small n on the writing line');
	assert.equal(tileOf(b, 'n').state, 'needsLook');
	assert.equal(s.rail, '5/58');
	await shot('E3-undo-the-fix-on-the-board');
	pass(
		`E: Ctrl+Z on the board: "${s.toast}" [${s.toastButton}], small n amber again, rail "${s.rail}"`
	);

	steps = (await history()).length;
	await page
		.locator('[data-anyink-board-cell][data-char="n"] [data-anyink-board-fix="looksFine"]')
		.click();
	await settle(700);
	h = await history();
	b = await board();
	s = await screen();
	assert.equal(h.length, steps + 1, 'Looks fine to me: one step');
	assert.equal(h.top, 'said small n looks fine');
	assert.equal(tileOf(b, 'n')?.state ?? 'ready', 'ready');
	const nNow = await page.evaluate(async () => {
		const { isLooksFine } = await import('/anyink/checks/looks_fine.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return isLooksFine(editor.project.getItem('glyph-0x6E'), 'offLine');
	});
	assert.equal(nNow, true);
	assert.equal(s.rail, '6/58');
	assert.equal(s.sentence, 'small e is too tall for the small-letter line.');
	assert.equal(s.coachButton, 'Match size');
	await shot('E4-looks-fine-clears-the-amber');
	pass(
		`E: small n's [Looks fine to me]: one step "${h.top}", the amber cleared (small n left the Needs a look filter), rail "${s.rail}", Next line "${s.sentence}" [${s.coachButton}]`
	);

	// ------------------------------------------------------------------
	// F. The letter view of small e: the card and the Next line's fix
	// ------------------------------------------------------------------
	await page.keyboard.press('e');
	await waitUntil(async () => (await where()).item === 'glyph-0x65', 'e opens');
	await offCanvas();
	await settle(800);
	const card = await page.evaluate(() => {
		const chip = document.querySelector('.anyink-letter-card [data-anyink-state]');
		const looksFine = document.querySelector(
			'.anyink-letter-card [data-anyink-action="looksFine"]'
		);
		return {
			state: chip?.dataset.anyinkState,
			chip: chip?.textContent.trim(),
			chipColor: chip ? getComputedStyle(chip).borderTopColor : null,
			looksFine: looksFine?.textContent.trim() || null,
			looksFineGreen: looksFine?.classList.contains('anyink-primary') || false,
		};
	});
	s = await screen();
	assert.equal(card.state, 'needsLook');
	assert.equal(card.chip, 'Needs a look: too tall for the small-letter line');
	assert.equal(card.looksFine, 'Looks fine to me');
	assert.equal(card.looksFineGreen, false);
	assert.equal(s.sentence, 'small e is too tall for the small-letter line.');
	assert.equal(s.coachButton, 'Match size');
	assert.deepEqual(s.greens, [{ text: 'Match size', where: 'next line' }]);
	assert.deepEqual(await scanSimple(), []);
	await shot('F1-letter-card-needs-a-look');
	steps = (await history()).length;
	await page.locator('anyink-coach .anyink-coach__button').click();
	await settle(800);
	h = await history();
	const eAfter = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sitsAtFit } = await import('/anyink/spacing/auto_space.js');
		const e = editor.project.getItem('glyph-0x65');
		const coords = e.shapes.flatMap((sh) => sh.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y]));
		return {
			chip: document.querySelector('.anyink-letter-card [data-anyink-state]')?.textContent.trim(),
			auto: e.anyink?.spacing,
			fit: sitsAtFit(e, editor.project),
			whole: coords.every(Number.isInteger) && Number.isInteger(e.advanceWidth),
		};
	});
	s = await screen();
	assert.equal(h.length, steps + 1, 'Match size: one step');
	assert.match(h.top, /small e/);
	assert.equal(eAfter.chip, 'Ready');
	assert.deepEqual([eAfter.auto, eAfter.fit, eAfter.whole], ['auto', true, true]);
	assert.equal(s.rail, '7/58');
	await shot('F2-match-size-from-the-next-line');
	pass(
		`F: small e's card says "${card.chip}" (amber) with [${card.looksFine}] outlined; the Next line "small e is too tall for the small-letter line." with the one green [Match size]; pressed: one step "${h.top}", the card says Ready, spacing automatic and at its fit, whole numbers, rail "${s.rail}"`
	);

	// the font check (2 s after the last change) finds nothing; back on the board, one count
	await page.waitForTimeout(2600);
	const fontCheck = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getLastFontCheck } = await import('/anyink/fontcheck/font_check.js');
		return getLastFontCheck(editor)?.problems?.length ?? null;
	});
	assert.equal(fontCheck, 0, 'the font check finds nothing');
	await toBoardByBack();
	b = await board();
	s = await screen();
	coach = await coachFacts();
	assert.equal(b.progress, '7 of 58 ready');
	assert.equal(s.rail, '7/58');
	assert.equal(coach.ready, 7);
	assert.deepEqual(b.filters, [], 'no letter needs a look: no filters');
	assert.ok(b.tiles.length === 58, 'every letter shows again');
	assert.notEqual(coach.rule, 9);
	assert.deepEqual(await scanSimple(), []);
	await shot('F3-board-all-seven-ready-again');
	pass(
		`F: the font check found ${fontCheck} problems; the board "${b.progress}", rail "${s.rail}", the Next line's letters ${coach.ready} ready, no filters; 0 banned words`
	);

	// ------------------------------------------------------------------
	// G. A work file dropped on the board
	// ------------------------------------------------------------------
	const gs2 = await page.evaluate(async () =>
		(await import('/app/main.js')).getCurrentProjectEditor().makeProjectFileText()
	);
	// this font has unsaved work: Ctrl+O's box first
	await dropOn('.anyink-board__sections', { name: 'Brennan Hand.gs2', type: '', text: gs2 });
	await page.locator('#modal-dialog .anyink-open-box').waitFor({ timeout: 10000 });
	const boxText = await page.locator('#modal-dialog .anyink-open-box').innerText();
	assert.match(boxText, /aren.t saved/);
	await shot('G1-work-file-dropped-unsaved-asks');
	await page.locator('#modal-dialog [data-anyink-choice="cancel"]').click();
	await settle(400);
	await page.context().close();

	page = await freshPage('drop a work file');
	await newFont(page, after.origin, 'Empty Font', '?ui=simple');
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await dropOn('.anyink-board__sections', { name: 'Brennan Hand.gs2', type: '', text: gs2 });
	await waitUntil(
		async () =>
			(await page.locator('[data-anyink-control="fontName"]').innerText()) === 'Brennan Hand',
		'the dropped font opens'
	);
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await settle(800);
	b = await board();
	s = await screen();
	assert.equal(b.progress, '7 of 58 ready');
	assert.equal(s.rail, '7/58');
	assert.deepEqual(await scanSimple(), []);
	await shot('G2-work-file-dropped-opens');
	pass(
		`G: a .gs2 dropped on the board: with unsaved work, Ctrl+O's box ("${boxText
			.replace(/\s+/g, ' ')
			.trim()}"), Cancel kept the font; on a new font, the dropped "Brennan Hand" opened on its board ("${
			b.progress
		}", rail "${s.rail}")`
	);
	await page.context().close();

	// ------------------------------------------------------------------
	// H. The backup write on a 58-letter traced font, the Undo list at its fullest
	// ------------------------------------------------------------------
	const backup = async (label, search, navigation) => {
		const p = await freshPage(`backup ${label}`);
		await newFont(p, after.origin, `Backup ${label}`, search);
		const result = await p.evaluate(async (nav) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { buildTracedFont, fillUndoList, undoListSize } = await import(
				'/anyink/board/tests/traced_font.js'
			);
			const { snapshotNow, getRecoveryStatus } = await import('/anyink/recovery/recovery.js');
			const { recEntries } = await import('/anyink/storage/kv.js');
			const { points } = buildTracedFont(editor);
			fillUndoList(editor, { steps: 200, wholeFont: 30, navigation: nav });
			const size = undoListSize(editor.history);
			let t0 = performance.now();
			await snapshotNow('manual'); // the session's first write: every copy the list names
			const firstMs = performance.now() - t0;
			const runs = [];
			for (let i = 0; i < 5; i++) {
				fillUndoList(editor, { steps: 1, wholeFont: 0 });
				t0 = performance.now();
				const written = await snapshotNow('manual');
				runs.push({ ms: performance.now() - t0, written });
			}
			// a step about the whole font (the letter-spacing slider, a moved line): two copies
			const wholeRuns = [];
			for (let i = 0; i < 3; i++) {
				fillUndoList(editor, { steps: 2, wholeFont: 1 });
				t0 = performance.now();
				await snapshotNow('manual');
				wholeRuns.push(performance.now() - t0);
			}
			wholeRuns.sort((a, b) => a - b);
			const entries = await recEntries();
			const session = entries.find(([key]) => key.startsWith('session:'));
			const sessionMb =
				JSON.stringify({ ...session[1], fileHandle: null, assets: null }).length / 1e6;
			const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
			return {
				points,
				size,
				firstMs,
				median: ms[2],
				max: ms[4],
				wholeMedian: wholeRuns[1],
				written: runs.every((r) => r.written),
				states: getRecoveryStatus().lastWrite?.states ?? null,
				sessionMb,
			};
		}, navigation);
		await p.context().close();
		return result;
	};
	const simpleBackup = await backup('simple', '?ui=simple', 0);
	const allBackup = await backup('all-tools', '?ui=all', 30); // B16: Simple is the launch default
	[
		['Simple, 200 steps, 30 whole-font', simpleBackup],
		['All tools, 200 steps, 30 whole-font, 30 "Navigated to"', allBackup],
	].forEach(([label, r]) => {
		assert.ok(r.written, `${label}: written`);
		console.log(
			`MEASURE backup write, ${label}: after one more step median ${r.median.toFixed(
				1
			)} ms (max ${r.max.toFixed(1)}); the session's record ${r.sessionMb.toFixed(2)} MB naming ${
				r.states
			} saved copies; the first write (every copy) ${r.firstMs.toFixed(0)} ms; ${
				r.points
			} points; D-026 point 100 ms: ${
				r.median <= 100 ? 'under' : 'OVER'
			}; after a whole-font step ${r.wholeMedian.toFixed(1)} ms (${
				r.wholeMedian <= 100 ? 'under' : 'OVER'
			})`
		);
		assert.ok(r.median < 100, `${label}: ${r.median} ms`);
		assert.ok(r.wholeMedian < 100, `${label}, a whole-font step: ${r.wholeMedian} ms`);
	});
	pass(
		`H: the backup write after one more step on a 58-letter traced font with the list at its fullest: Simple ${simpleBackup.median.toFixed(
			1
		)} ms, All tools ${allBackup.median.toFixed(1)} ms (D-026: 100 ms)`
	);

	assert.deepEqual(errors, [], 'no page errors in Simple');
	pass('Simple: no page errors, no console errors');

	// ------------------------------------------------------------------
	// I. All tools, before and after: the same controls, the same pixels
	// ------------------------------------------------------------------
	const allTools = async (origin, label) => {
		const p = await freshPage(label);
		await newFont(p, origin, 'Brennan Hand');
		await p.mouse.move(5, 895);
		await settle(900, p);
		const overview = await p.evaluate(() => ({
			page: document.querySelector('#app__page')?.className || '',
			board: !!document.querySelector('[data-anyink-board]'),
			tiles: document.querySelectorAll('glyph-tile').length,
			amber: [...document.querySelectorAll('glyph-tile')].filter(
				(t) =>
					t.shadowRoot?.querySelector('.wrapper')?.getAttribute('session-state') === 'needsLook'
			).length,
			simpleBar: !!document.querySelector('[data-anyink-topbar="simple"]'),
			coach: !!document.querySelector('anyink-coach'),
		}));
		const overviewShot = await shot(`I-${label}-all-tools-overview`, null, p);
		await p.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			editor.selectedGlyphID = 'glyph-0x61';
			editor.nav.page = 'Characters';
			editor.navigate();
		});
		await p.locator('.editor-page__tools-area').waitFor();
		await p.mouse.move(5, 895);
		await settle(900, p);
		const letter = await p.evaluate(() => ({
			card: !!document.querySelector('.anyink-letter-card'),
			panel: document
				.querySelector('#editor-page__panel')
				?.innerText.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 300),
			tools: [...document.querySelectorAll('.editor-page__tools-area button')].map((el) =>
				el.getAttribute('title')
			),
		}));
		const letterShot = await shot(`I-${label}-all-tools-small-a`, null, p);
		const errorsHere = errors.filter((line) => line.startsWith(label));
		await p.context().close();
		return { overview, letter, overviewShot, letterShot, errorsHere };
	};
	const pixelDiff = async (a, c) => {
		const p = await freshPage('diff');
		const data = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
		const result = await p.evaluate(
			async ([one, two]) => {
				const load = (url) =>
					new Promise((done) => {
						const img = new Image();
						img.onload = () => done(img);
						img.src = url;
					});
				const [i1, i2] = await Promise.all([load(one), load(two)]);
				if (i1.width !== i2.width || i1.height !== i2.height) return { size: false, differ: -1 };
				const read = (img) => {
					const canvas = document.createElement('canvas');
					canvas.width = img.width;
					canvas.height = img.height;
					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0);
					return ctx.getImageData(0, 0, img.width, img.height).data;
				};
				const d1 = read(i1);
				const d2 = read(i2);
				let differ = 0;
				for (let i = 0; i < d1.length; i += 4) {
					if (d1[i] !== d2[i] || d1[i + 1] !== d2[i + 1] || d1[i + 2] !== d2[i + 2]) differ++;
				}
				return { size: true, differ, total: d1.length / 4 };
			},
			[data(a), data(c)]
		);
		await p.context().close();
		return result;
	};
	const now = await allTools(after.origin, 'after');
	assert.deepEqual(
		[
			now.overview.board,
			now.overview.amber,
			now.overview.simpleBar,
			now.overview.coach,
			now.letter.card,
		],
		[false, 0, false, false, false]
	);
	assert.deepEqual(now.errorsHere, []);
	if (before) {
		const was = await allTools(before.origin, 'before');
		assert.deepEqual(now.overview, was.overview, 'the All tools Overview changed');
		assert.deepEqual(now.letter, was.letter, "small a's All tools page changed");
		const o = await pixelDiff(was.overviewShot, now.overviewShot);
		const l = await pixelDiff(was.letterShot, now.letterShot);
		assert.equal(o.differ, 0, `All tools Overview pixels differ: ${o.differ} of ${o.total}`);
		assert.equal(l.differ, 0, `All tools letter page pixels differ: ${l.differ} of ${l.total}`);
		pass(
			`I: All tools, before (last commit) and after: the same Overview (${now.overview.tiles} tiles, no board, no amber) and small a's page (${now.letter.tools.length} tools, the Attributes panel), 0 of ${o.total} and 0 of ${l.total} pixels differ`
		);
	} else {
		pass(
			`I: All tools today: the Overview has ${now.overview.tiles} tiles, no board, no amber; no Simple bar, Next line or card`
		);
	}
	assert.deepEqual(errors, [], 'no page errors');
	console.log(`screenshots (${shotList.length}) in ${shots}:\n  ${shotList.join('\n  ')}`);
} catch (error) {
	console.error(`FAIL ${error.message}`);
	if (errors.length) console.error(`page errors: ${JSON.stringify(errors, null, 1)}`);
	await shot('FAIL-screen').catch(() => {});
	process.exitCode = 1;
} finally {
	await browser.close();
	await after.server.close();
	await before?.server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => {});
}
