// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 integration real-browser check (docs/UX-BEGINNER.md 4.7 Use in Word, 4.8 Font
// details and Move the guide lines, 4.10 Help, section 8, section 10 B14 and B15): the first full
// loop, in the real app on a Vite dev server, Chrome with a throwaway context, 1600 x 900, the
// feature flags as the app ships them ('useInWord', 'fontDetails' and 'help' on now), Simple by
// ?ui=simple. Windows' save box is stood in for by one that is cancelled, and Chrome's folder
// picker by one that hands back a real folder in the browser's private file area ("My Fonts"):
// Chrome headless has neither box to press.
//   A. The start screen; Create my font "Brennan Hand"; the board
//   B. A handwriting photo dropped on the board, walked into seven letters (B r e n a H d)
//   C. Try it from the rail's step 2, the e|n gap closed with a real drag; the Word note now
//      points at Use in Word; Done
//   D. Rail step 3: Use in Word. Pick a folder... (the stand-in), Make my font file: the card
//      ("Made BrennanHand-Test1.otf", step 4 highlighted for the gap fix); the file in the folder
//      read back: family "Brennan Hand Test 1", the seven letters, a space, 'latn' beside 'DFLT';
//      loaded in the page with FontFace and typed with; the install offer comes after the first
//      font file (B13's hook) once the dialog has closed
//   E. Ctrl+E: build again, "Test 2", the card names Test 1 for removal; the Next line's
//      [Use in Word] action is wired
//   F. A broken letter (a stray two-point line in small a): Menu > Make my font file... blocks
//      with its name, no file written; Fix it clears it
//   G. Font details from the font name: renamed "Brennan Script", one settings step, the top bar
//      shows it
//   H. Menu > Move the guide lines...: the small-letter line dragged, one whole-font step, the
//      automatic letters refit; one Undo puts the whole font back; Done locks the lines
//   I. Menu > What these words mean: Help, its glossary exactly the words of the flags that are
//      on; the Word section uses B14's names; one green; no banned word anywhere checked
//   J. All tools (no ?ui): the doors do nothing, Ctrl+E is the export, the File menu as before
// Usage: node tests/b1415.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { FontFlux } from 'font-flux-js';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { scriptTags, tableChecksumsOk } from '../src/anyink/install/kern_latin.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b1415'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b1415-'));
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
	channel: process.env.B1415_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);

async function freshPage(label, context) {
	const p = await context.newPage();
	p.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
	p.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
	});
	p.on('dialog', (dialog) => dialog.accept());
	return p;
}
async function newContext() {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	await context.addInitScript(() => {
		// Windows' save box, cancelled
		window.showSaveFilePicker = async () => {
			throw new DOMException('The user aborted a request.', 'AbortError');
		};
		// Chrome's folder picker: he makes "My Fonts" and picks it (a real folder handle, in the
		// browser's private file area)
		window.showDirectoryPicker = async () => {
			const root = await navigator.storage.getDirectory();
			const dir = await root.getDirectoryHandle('My Fonts', { create: true });
			window.__fontsDir = dir;
			return dir;
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
		const q = editor.history.queue.filter((e) => !/_post_state_$/.test(e.title));
		return {
			page: editor.nav.page,
			item: editor.selectedItemID,
			name: editor.project?.settings?.project?.name,
			family: editor.project?.settings?.font?.family,
			steps: q.length,
			top: q[0]?.title || '',
			topWhole: !!q[0]?.wholeProjectSave,
			topSettings: !!q[0]?.settingsSave,
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
			toasts: [
				...document.querySelectorAll('#toast[data-anyink-toast="simple"]:not([data-leaving])'),
			]
				.map(text)
				.filter(Boolean),
		};
	});
const scanSimple = (selector = 'body') =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		root?.querySelectorAll('details').forEach((d) => (d.open = true));
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
const phase = () =>
	page.evaluate(
		() =>
			document.querySelector('dialog[data-anyink-dialog="useInWord"]')?.dataset
				.anyinkInstallPhase || null
	);
const waitPhase = (want) =>
	waitUntil(async () => (await phase()) === want, `Use in Word phase ${want}`, 30000);
const dialogText = () =>
	page.evaluate(() =>
		document.querySelector('dialog[data-anyink-dialog="useInWord"]').innerText.replace(/\s+/g, ' ')
	);
const folderFiles = () =>
	page.evaluate(async () => {
		const out = [];
		if (!window.__fontsDir) return out;
		for await (const name of window.__fontsDir.keys()) out.push(name);
		return out.sort();
	});
const fileBytes = async (name) => {
	const bytes = await page.evaluate(async (fileName) => {
		const file = await (await window.__fontsDir.getFileHandle(fileName)).getFile();
		return [...new Uint8Array(await file.arrayBuffer())];
	}, name);
	return new Uint8Array(bytes).buffer;
};
const openMenuRow = async (row) => {
	await page.locator('[data-anyink-control="menu"]').click();
	await settle(200);
	await page.locator(`[data-anyink-row="${row}"]`).click();
};
/** font units -> page pixels on the open letter */
const at = (ux, uy) =>
	page.evaluate(
		async ([x, y]) => {
			const view = (await import('/app/main.js')).getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const box = (host.shadowRoot || host).querySelector('canvas').getBoundingClientRect();
			return {
				x: box.left + view.dx + x * view.dz,
				y: box.top + view.dy - y * view.dz,
				left: box.left,
			};
		},
		[ux, uy]
	);

let context = await newContext();
try {
	// ------------------------------------------------------------------
	// A. The start screen; Create my font
	// ------------------------------------------------------------------
	page = await freshPage('simple', context);
	await page.goto(`${origin}/?ui=simple`);
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await settle(800);
	let s = await screen();
	assert.deepEqual(s.greens, ['Create my font']);
	const startText = await page.evaluate(() => document.body.innerText);
	assert.match(startText, /You'll make the font for Word in step 3\./, 'the note names step 3 now');
	assert.deepEqual(await scanSimple(), []);
	await shot('A1-start-screen');
	await page.locator('#input__new-project-name').fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await settle(1200);
	let st = await editorState();
	assert.equal(st.name, 'Brennan Hand');
	const railSteps = await page.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-step]')].map((el) => el.dataset.anyinkStep)
	);
	assert.deepEqual(railSteps, ['letters', 'tryIt', 'useInWord'], 'the rail has its three steps');
	await shot('A2-board-three-steps');
	pass(
		`A: the start screen (one green [Create my font], "step 3" in the work-file note, 0 banned words); Create my font opened the board for "${
			st.name
		}"; the rail is ${railSteps.join(' / ')}`
	);

	// The install offer: Chrome's offer held, the Ready-letter way in taken away, so only the
	// first font file can bring it (B13's hook, B14's noteFontFile)
	await page.evaluate(async () => {
		const offer = await import('/anyink/start/install_offer.js');
		offer.setInstallOfferDepsForTests({ readyLetters: () => 0 });
		const event = new Event('beforeinstallprompt', { cancelable: true });
		event.prompt = async () => {};
		event.userChoice = Promise.resolve({ outcome: 'dismissed' });
		window.__offerBefore = offer.holdInstallEvent(event) ?? offer.tryInstallOffer();
	});

	// ------------------------------------------------------------------
	// B. Letters from a photo
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
		true
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
	await shot('B1-board-seven-letters');
	pass(`B: a photo dropped on the board walked into ${walked.join(' ')}; the rail says ${s.rail}`);

	// ------------------------------------------------------------------
	// C. Try it: a gap fix
	// ------------------------------------------------------------------
	await page.locator('[data-anyink-step="tryIt"]').click();
	await waitUntil(
		() => page.evaluate(async () => (await import('/anyink/tryit/expand.js')).isTryItOpen()),
		'Try it open'
	);
	await offCanvas();
	await settle(900);
	const gap = await page.evaluate(async () => {
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
	assert.ok(gap?.hit, `the e|n gap: ${JSON.stringify(gap)}`);
	await page.mouse.move(gap.x - 40, gap.y);
	await page.mouse.move(gap.x + 1, gap.y, { steps: 4 });
	await settle(250);
	const hb = await page.locator('.anyink-gap-handle').boundingBox();
	const hx = hb.x + hb.width / 2;
	const hy = hb.y + hb.height / 2;
	await page.mouse.move(hx, hy);
	await page.mouse.down();
	await page.mouse.move(hx - 4, hy, { steps: 3 });
	await page.mouse.move(hx - 8, hy, { steps: 3 });
	await page.mouse.up();
	await settle(600);
	const fixed = await page.evaluate(async () => {
		const { onePairFixes } = await import('/anyink/kerning/kern_lookup.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const note = document.querySelector('.anyink-word-note');
		return {
			fixes: onePairFixes(editor.project).length,
			note:
				note && note.checkVisibility({ visibilityProperty: true }) ? note.textContent.trim() : '',
		};
	});
	assert.equal(fixed.fixes, 1);
	assert.equal(fixed.note, 'Word needs one setting for gap fixes. Use in Word will show you.');
	await shot('C1-gap-fix-word-note');
	await page.locator('.anyink-tryit__done').click();
	await settle(500);
	pass(
		`C: a real drag closed the e|n gap (${fixed.fixes} gap fix); the Word note says "${fixed.note}"; Done`
	);

	// ------------------------------------------------------------------
	// D. Rail step 3: Use in Word, the first font file
	// ------------------------------------------------------------------
	const beforeJSON = await page.evaluate(async () =>
		JSON.stringify((await import('/app/main.js')).getCurrentProjectEditor().project.save())
	);
	const stepsBefore = (await editorState()).steps;
	await page.locator('[data-anyink-step="useInWord"]').click();
	await waitPhase('before');
	await settle(400);
	let text = await dialogText();
	assert.match(text, /no folder yet/);
	assert.match(text, /51 letters aren't made yet/);
	s = await screen();
	assert.equal(s.greens.length, 1, `one green: ${JSON.stringify(s.greens)}`);
	assert.deepEqual(await scanSimple('dialog[data-anyink-dialog="useInWord"]'), []);
	await shot('D1-use-in-word-before');
	await page.locator('[data-anyink-install-action="pick"]').click();
	await page.locator('[data-anyink-install-folder="picked"]').waitFor({ timeout: 10000 });
	await settle(300);
	await shot('D2-folder-picked');
	await page.locator('[data-anyink-install-action="make"]').click();
	await waitPhase('card');
	await settle(500);
	text = await dialogText();
	assert.match(text, /Made BrennanHand-Test1\.otf\./);
	assert.match(text, /In Word it's called Brennan Hand Test 1\./);
	assert.match(text, /Open File Explorer, then Documents > My Fonts\./);
	assert.match(text, /tick Kerning for fonts/i);
	assert.match(text, /All documents based on the Normal template/);
	assert.ok(
		await page.locator('[data-anyink-install-step="gaps"].is-highlight').isVisible(),
		'step 4 shown and highlighted'
	);
	assert.deepEqual(await scanSimple('dialog[data-anyink-dialog="useInWord"]'), []);
	s = await screen();
	assert.equal(s.greens.length, 1, `one green on the card: ${JSON.stringify(s.greens)}`);
	await shot('D3-install-card-test1-step4');
	assert.deepEqual(await folderFiles(), ['BrennanHand-Test1.otf']);
	const bytes1 = await fileBytes('BrennanHand-Test1.otf');
	const font1 = FontFlux.open(bytes1);
	const codes = font1.glyphs.map((g) => g.unicode).filter((u) => u != null);
	assert.equal(font1.info.familyName, 'Brennan Hand Test 1');
	for (const char of ['B', 'r', 'e', 'n', 'a', 'H', 'd', ' '])
		assert.ok(codes.includes(char.charCodeAt(0)), `"${char}" is in the file`);
	assert.ok(!codes.includes('z'.charCodeAt(0)), 'an empty letter is left out');
	assert.deepEqual(scriptTags(bytes1), ['DFLT', 'latn'], 'gap fixes listed for Latin text');
	assert.equal(tableChecksumsOk(bytes1), true);
	assert.ok(font1.listKerning().length + (font1.kerningClasses?.length || 0) >= 0);
	const st1 = await editorState();
	assert.equal(st1.steps, stepsBefore, 'making the font file is no Undo step');
	const afterJSON = await page.evaluate(async () =>
		JSON.stringify((await import('/app/main.js')).getCurrentProjectEditor().project.save())
	);
	assert.equal(afterJSON, beforeJSON, 'the work file is unchanged');
	pass(
		`D: rail step 3 opened Use in Word (one green, 0 banned words); the stand-in picker gave "My Fonts"; Make my font file wrote ${await folderFiles()} (family "${
			font1.info.familyName
		}", ${codes.length} letters incl. B r e n a H d and a space, scripts ${scriptTags(bytes1).join(
			' + '
		)}, checksums sound); the card shows step 4 highlighted; no Undo step; the work file unchanged`
	);

	// The font in the page: FontFace, then typed with
	const typed = await page.evaluate(async () => {
		const file = await (await window.__fontsDir.getFileHandle('BrennanHand-Test1.otf')).getFile();
		const face = new FontFace('BrennanHandTest1', await file.arrayBuffer());
		await face.load();
		document.fonts.add(face);
		const box = document.createElement('div');
		box.id = 'b1415-typed';
		box.style.cssText =
			'position:fixed;left:40px;top:520px;z-index:100000;font:96px BrennanHandTest1, monospace;background:var(--anyink-paper, white);padding:12px 24px;';
		box.textContent = 'Brennan Hand';
		document.body.appendChild(box);
		const mono = document.createElement('span');
		mono.style.cssText = 'font:96px monospace;position:fixed;left:-9999px';
		mono.textContent = 'Brennan Hand';
		document.body.appendChild(mono);
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		const width = box.firstChild ? box.getBoundingClientRect().width : 0;
		const result = {
			status: face.status,
			check: document.fonts.check('96px BrennanHandTest1', 'Brennan Hand'),
			width: Math.round(width),
			mono: Math.round(mono.getBoundingClientRect().width),
		};
		mono.remove();
		return result;
	});
	assert.equal(typed.status, 'loaded');
	assert.equal(typed.check, true);
	assert.notEqual(typed.width, typed.mono + 48, 'typed in his letters, not the fallback');
	await shot('D4-typed-with-the-font-file');
	await page.evaluate(() => document.getElementById('b1415-typed')?.remove());
	pass(
		`D: the font file loaded in the page with FontFace (${typed.status}) and typed "Brennan Hand" in it (${typed.width} px wide vs ${typed.mono} px in the fallback)`
	);

	const offerState = () =>
		page.evaluate(async () => {
			const offer = await import('/anyink/start/install_offer.js');
			const { getPref } = await import('/anyink/prefs/prefs.js');
			const { toastLog } = await import('/anyink/toast/toast.js');
			return {
				offered: !!getPref(offer.INSTALL_OFFERED_PREF),
				asked: toastLog().some((record) => record.key === 'notice.install'),
			};
		});
	const whileOpen = await offerState();
	assert.equal(
		!whileOpen.offered && !whileOpen.asked,
		true,
		`never over the open dialog: ${JSON.stringify(whileOpen)}`
	);
	await page.locator('[data-anyink-install-action="done"]').click();
	await settle(300);
	assert.equal(await phase(), null);
	await waitUntil(async () => (await offerState()).asked, 'the install offer asked for', 8000);
	// an info toast waits its turn behind the gap fix's [Undo] toast (B4's queue)
	let offerShown = false;
	for (let i = 0; i < 100 && !offerShown; i++) {
		offerShown = (await screen()).toasts.some((t) => /Install ANY-INK/.test(t));
		if (!offerShown) await page.waitForTimeout(250);
	}
	s = await screen();
	await shot('D5-install-offer-after-first-font-file');
	await page.evaluate(async () => {
		const offer = await import('/anyink/start/install_offer.js');
		offer.resetInstallOfferForTests();
		const { clearToasts } = await import('/anyink/toast/toast.js');
		clearToasts?.();
	});
	pass(
		`D: the install offer waited while the dialog was open, then came after the first font file (Ready letters taken out of the rule)${
			offerShown
				? `: "${s.toasts.find((t) => /Install ANY-INK/.test(t))}"`
				: ', queued behind the [Undo] toast'
		}`
	);

	// ------------------------------------------------------------------
	// E. Ctrl+E: build again, the next test number; the Next line's action
	// ------------------------------------------------------------------
	await offCanvas();
	await page.keyboard.press('Control+e');
	await waitPhase('before');
	await settle(300);
	text = await dialogText();
	assert.match(text, /My Fonts/);
	await page.locator('[data-anyink-install-action="make"]').click();
	await waitPhase('card');
	await settle(400);
	text = await dialogText();
	assert.match(text, /Made BrennanHand-Test2\.otf\./);
	assert.match(text, /If you installed Brennan Hand Test 1 earlier/);
	assert.deepEqual(await folderFiles(), ['BrennanHand-Test1.otf', 'BrennanHand-Test2.otf']);
	assert.equal(
		FontFlux.open(await fileBytes('BrennanHand-Test2.otf')).info.familyName,
		'Brennan Hand Test 2'
	);
	await shot('E1-card-test2');
	await page.locator('[data-anyink-install-action="done"]').click();
	await settle(300);
	const coachAction = await page.evaluate(async () => {
		const { hasCoachAction, runCoachAction } = await import('/anyink/coach/actions.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const had = hasCoachAction('useInWord');
		const ran = runCoachAction('useInWord', [], { editor });
		const open = !!document.querySelector('dialog[data-anyink-dialog="useInWord"]');
		return { had, ran: !!ran, open };
	});
	assert.equal(coachAction.had, true);
	assert.equal(coachAction.open, true, "the Next line's [Use in Word] opens it");
	await page.keyboard.press('Escape');
	await settle(300);
	pass(
		`E: Ctrl+E opened Use in Word again; it made BrennanHand-Test2.otf ("Brennan Hand Test 2") and the card names Test 1 to remove; the Next line's [Use in Word] action is wired`
	);

	// ------------------------------------------------------------------
	// F. A broken letter blocks the build with its name
	// ------------------------------------------------------------------
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { Path } = await import('/project_data/path.js');
		const a = editor.project.getItem('glyph-0x61');
		a.addOneShape(
			new Path({
				name: 'Stray',
				pathPoints: [{ p: { coord: { x: 50, y: 50 } } }, { p: { coord: { x: 350, y: 350 } } }],
			})
		);
	});
	await settle(300);
	const filesBefore = await folderFiles();
	await openMenuRow('make-font-file');
	await waitPhase('before');
	await page.locator('[data-anyink-install-action="make"]').click();
	await page.locator('[data-anyink-install-note="blocked"]').waitFor({ timeout: 15000 });
	const blocked = await page.textContent('[data-anyink-install-note="blocked"]');
	assert.match(blocked, /small a has a problem the font file can't hold\./);
	assert.deepEqual(await folderFiles(), filesBefore, 'no file written');
	assert.deepEqual(await scanSimple('dialog[data-anyink-dialog="useInWord"]'), []);
	await shot('F1-broken-letter-blocks');
	const fixAction = (await page.locator('[data-anyink-install-action="fixIt"]').count())
		? 'fixIt'
		: 'showMe';
	await page.locator(`[data-anyink-install-action="${fixAction}"]`).click();
	await settle(500);
	if (fixAction === 'fixIt')
		assert.equal(await page.locator('[data-anyink-install-note="blocked"]').count(), 0);
	await shot('F2-after-fix-it');
	if (await phase()) await page.keyboard.press('Escape');
	await settle(300);
	pass(
		`F: Menu > Make my font file... with a stray line in small a blocked: "${blocked.trim()}"; no file written; [${fixAction}] pressed`
	);

	// ------------------------------------------------------------------
	// G. Font details renames
	// ------------------------------------------------------------------
	await page.locator('[data-anyink-control="logo"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await settle(400);
	const stepsG = (await editorState()).steps;
	await page.locator('[data-anyink-control="fontName"]').click();
	const details = page.locator('[data-anyink-dialog="fontDetails"]');
	await details.waitFor({ timeout: 10000 });
	await settle(300);
	assert.deepEqual(await scanSimple('[data-anyink-dialog="fontDetails"]'), []);
	s = await screen();
	assert.equal(s.greens.length, 1, `one green: ${JSON.stringify(s.greens)}`);
	await page.locator('[data-anyink-fontinfo-field="fontName"]').fill('Brennan Script');
	await page.keyboard.press('Enter');
	await settle(300);
	await shot('G1-font-details');
	await page.locator('[data-anyink-fontinfo-action="done"]').click();
	await settle(400);
	st = await editorState();
	assert.equal(st.name, 'Brennan Script');
	assert.equal(st.family, 'Brennan Script');
	assert.equal(st.steps, stepsG + 1, 'one step');
	assert.equal(st.topSettings, true, 'a settings step');
	const barName = (await page.locator('[data-anyink-control="fontName"]').textContent()).trim();
	assert.equal(barName, 'Brennan Script');
	await shot('G2-renamed');
	pass(
		`G: Font details renamed the font to "${st.name}" (family "${st.family}") in one settings step "${st.top}"; the top bar says "${barName}"`
	);

	// ------------------------------------------------------------------
	// H. Move the guide lines: the small-letter line, one step, Undo
	// ------------------------------------------------------------------
	await openMenuRow('move-guide-lines');
	await page.locator('[data-anyink-banner="moveLines"]').waitFor({ timeout: 10000 });
	await page.locator('.editor-page__tools-area').waitFor();
	await offCanvas();
	await settle(900);
	const lineState = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { inkBounds } = await import('/anyink/spacing/measure.js');
			const autos = Object.values(editor.project.glyphs).filter(
				(g) => g.anyink?.spacing === 'auto' && inkBounds(g)
			);
			return {
				item: editor.selectedItemID,
				xHeight: editor.project.settings.font.xHeight,
				widths: Object.fromEntries(autos.map((g) => [g.chars, Math.round(g.advanceWidth)])),
				json: JSON.stringify(editor.project.save()),
			};
		});
	const h0 = await lineState();
	const stepsH = (await editorState()).steps;
	assert.equal(h0.item, 'glyph-0x6E', 'small n opens');
	assert.deepEqual(await scanSimple(), []);
	const p = await at(-150, h0.xHeight);
	const left = p.left + 40;
	await page.mouse.move(left, p.y + 30);
	await page.mouse.move(left, p.y);
	await settle(200);
	await page.mouse.down();
	for (let i = 1; i <= 11; i++) await page.mouse.move(left, p.y - i * 8);
	await settle(200);
	await page.mouse.up();
	await settle(800);
	const h1 = await lineState();
	st = await editorState();
	assert.ok(h1.xHeight > h0.xHeight, `the line moved: ${h0.xHeight} -> ${h1.xHeight}`);
	assert.equal(st.steps, stepsH + 1, 'one step');
	assert.equal(st.topWhole, true, 'a whole-font step');
	assert.equal(st.top, 'moved the small-letter line');
	const refit = Object.keys(h1.widths).filter((c) => h1.widths[c] !== h0.widths[c]);
	s = await screen();
	await shot('H1-moved-small-letter-line');
	await page.locator('#app__top-bar [data-anyink-control="undo"]').click();
	await settle(700);
	const h2 = await lineState();
	assert.equal(h2.xHeight, h0.xHeight);
	assert.equal(h2.json, h0.json, 'one Undo put the whole font back');
	await shot('H2-after-undo');
	await page.locator('[data-anyink-move-lines-action="done"]').click();
	await settle(400);
	assert.equal(await page.locator('[data-anyink-banner="moveLines"]').count(), 0);
	pass(
		`H: Move the guide lines... opened small n with the banner; a real drag moved the small-letter line ${
			h0.xHeight
		} -> ${h1.xHeight} in one whole-font step "${st.top}", letters refit: ${
			refit.join(' ') || '(none changed)'
		}; toasts ${JSON.stringify(s.toasts)}; one Undo put the whole font back; Done locked the lines`
	);

	// ------------------------------------------------------------------
	// I. Help: only the words of features that are on
	// ------------------------------------------------------------------
	await openMenuRow('help-words');
	await page.locator('[data-anyink-help]').waitFor({ timeout: 10000 });
	await settle(600);
	const help = await page.evaluate(async () => {
		const { glossary, wordEntry } = await import('/anyink/words/words.js');
		const { isFeatureOn } = await import('/anyink/mode/features.js');
		const shown = [...document.querySelectorAll('[data-anyink-term]')].map(
			(el) => el.dataset.anyinkTerm
		);
		const word = document.querySelector('[data-anyink-help-section="word"]');
		return {
			shown,
			expected: glossary().map((entry) => entry.key),
			off: shown.filter((key) => {
				const feature = wordEntry(key).feature;
				return feature && !isFeatureOn(feature);
			}),
			sections: [...document.querySelectorAll('[data-anyink-help-section]')].map(
				(el) => el.dataset.anyinkHelpSection
			),
			wordText: word?.innerText.replace(/\s+/g, ' ') || '',
			focus:
				document.activeElement?.closest('[data-anyink-help-section]')?.dataset.anyinkHelpSection ||
				null,
		};
	});
	assert.deepEqual(help.shown, help.expected, 'the glossary is exactly the landed words');
	assert.deepEqual(help.off, [], 'no word of a feature that is off');
	assert.ok(help.sections.includes('word'), 'the Windows and Word section shows');
	assert.match(help.wordText, /BrennanScript-Test1\.otf/);
	assert.doesNotMatch(help.wordText, /at the top|don't show up/);
	assert.deepEqual(await scanSimple(), []);
	s = await screen();
	assert.deepEqual(s.greens, ['Back to my letters']);
	await shot('I1-help-words');
	await page.evaluate(() =>
		document.querySelector('[data-anyink-help-section="word"]')?.scrollIntoView({ block: 'start' })
	);
	await settle(300);
	await shot('I2-help-word-section');
	pass(
		`I: Menu > What these words mean opened Help at "${help.focus}"; ${
			help.shown.length
		} glossary words, exactly glossary() for the flags on, none of a feature that is off; sections ${help.sections.join(
			' / '
		)}; the Word section uses B14's names; one green [${s.greens}]; 0 banned words`
	);
	await page.close();
	await context.close();

	// ------------------------------------------------------------------
	// J. All tools: unchanged
	// ------------------------------------------------------------------
	context = await newContext();
	page = await freshPage('all tools', context);
	await page.goto(`${origin}/`);
	await page.locator('#open-project__tab-new').waitFor({ timeout: 60000 });
	await page.locator('#input__new-project-name').fill('Tools Font');
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	await settle(1200);
	const allTools = await page.evaluate(async () => {
		['anyink-open-use-in-word', 'anyink-open-font-details', 'anyink-open-move-guide-lines'].forEach(
			(name) => window.dispatchEvent(new CustomEvent(name, { detail: { cause: 'verify' } }))
		);
		window.dispatchEvent(new CustomEvent('anyink-open-help', { detail: { section: 'word' } }));
		await new Promise((r) => setTimeout(r, 300));
		const { getMode } = await import('/anyink/mode/mode.js');
		const { keyAction } = await import('/anyink/mode/keys.js');
		const { guideLinesMoving } = await import('/anyink/mode/locks.js');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return {
			mode: getMode(),
			dialogs: document.querySelectorAll('[data-anyink-dialog]').length,
			help: !!document.querySelector('[data-anyink-help]'),
			moving: guideLinesMoving(),
			ctrlE: keyAction({ key: 'e', ctrl: true, shift: false, alt: false }, { where: 'page' })
				?.action,
			page: editor.nav.page,
			rail: document.querySelectorAll('[data-anyink-step]').length,
		};
	});
	assert.equal(allTools.mode, 'all');
	assert.equal(allTools.dialogs, 0, 'no ANY-INK dialog opens');
	assert.equal(allTools.help, false, "Help's door does nothing");
	assert.equal(allTools.moving, false);
	assert.equal(allTools.ctrlE, 'exportFont');
	assert.equal(allTools.rail, 0);
	await page.locator('.menu-entry-point', { hasText: 'File' }).first().click();
	await settle(300);
	const fileRows = await page.evaluate(() =>
		[...document.querySelectorAll('#context-menu [data-anyink-row]')].map(
			(el) => el.dataset.anyinkRow
		)
	);
	for (const row of ['font-otf', 'font-ttf', 'font-woff', 'font-woff2', 'font-folder'])
		assert.ok(fileRows.includes(row), `All tools keeps ${row}`);
	await shot('J1-all-tools-file-menu');
	pass(
		`J: All tools: the Use in Word, Font details, Move the guide lines and Help doors do nothing; Ctrl+E is "${
			allTools.ctrlE
		}"; no rail; the File menu keeps ${fileRows.filter((r) => r.startsWith('font-')).join(', ')}`
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
