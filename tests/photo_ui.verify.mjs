// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-ui fix pass, real-browser check (the first-timer's findings 1 to 5 on the photo screens;
// docs/UX-BEGINNER.md 4.4, 4.5, principles 1, 2, 6), in the real app on a Vite dev server, Chrome
// with throwaway profiles, Simple (?ui=simple) with the flags as the app has them:
//   A. The x with a real mouse closes the photo dialog, exactly as Cancel and Escape do, in all
//      three ways in: Next line [How] > [I have my photo]; Menu > How to photograph your letters >
//      [I have my photo]; an empty small a > [Use a photo] > [Choose a photo...]. No dialog comes
//      back, the photo the screens added goes, step A comes back for the letter. The How card's
//      own x too. (Upstream's button:hover resets took the x's margin-left: auto, and it jumped
//      about 600 px out from under the pointer.)
//   B. Every button on the How card, the photo dialog (letter unknown and known) and the photo
//      card (steps A and C) keeps its place and size under hover, focus and a press.
//   C. A whole-alphabet phone page (58 parts) at 1600 x 900 and 1280 x 720: letters show at least
//      READABLE_LETTER_PX tall, the page scrolls only up and down, the green box is in view; the
//      wheel scrolls, Ctrl + the wheel zooms where the pointer is, [-] goes to the whole photo,
//      [+] comes closer; a real click on the narrow i picks it; with every capital named, no name
//      tag covers another letter, close up or whole.
//   D. No ink at step C: no "Look right?", the sentence above the buttons, Adjust open on its
//      own with the ink cutoff showing, [Draw a box] the one green button; ink again: "Look
//      right?" is back.
//   E. Step C on a Capital H with the canvas zoomed in: the canvas shows the whole result and
//      every guide line; an Adjust re-trace leaves his view alone.
//   Every screen above says no banned word (strict), and no page error happens.
// Usage: node tests/photo_ui.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-photo-ui'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-photo-ui-'));
const FIXTURES = '/anyink/photo/tests/fixtures';
const ALPHABET = { url: `${FIXTURES}/alphabet-loose-phone.jpg`, name: 'IMG_4127.jpg', type: 'image/jpeg' };

const server = await createServer({
	root: resolve(repo, 'src'),
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] }, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: process.env.PHOTO_UI_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);

/** A fresh profile; the Windows picker can't be driven, so a stand-in hands over window.__next. */
async function freshPage(label, viewport = { width: 1600, height: 900 }) {
	const context = await browser.newContext({ viewport });
	await context.addInitScript(() => {
		window.__picks = [];
		window.__next = null;
		window.showOpenFilePicker = async (options) => {
			window.__picks.push(options);
			const next = window.__next;
			if (!next) throw new DOMException('The user aborted a request.', 'AbortError');
			const blob = await (await fetch(next.url)).blob();
			const file = new File([blob], next.name, { type: next.type ?? blob.type });
			return [{ kind: 'file', name: next.name, getFile: async () => file }];
		};
	});
	const p = await context.newPage();
	p.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
	p.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
	});
	p.on('dialog', (dialog) => dialog.dismiss());
	return p;
}

const shot = async (name) => {
	const path = resolve(shots, `${name}.png`);
	await page.screenshot({ path });
	shotList.push(path);
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
const newFont = async (name) => {
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill(name);
	await page.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(600);
};
const openLetter = async (id) => {
	await page.evaluate(async (glyph) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = glyph;
		editor.nav.page = 'Characters';
		editor.navigate();
	}, id);
	await page.locator('.editor-page__tools-area').waitFor();
	await page.mouse.move(5, 895);
	await settle(600);
};
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
const DIALOG = '[data-anyink-dialog="photoDialog"]';
const dialogCount = () => page.locator('[data-anyink-dialog]').count();

/** A press with the real mouse at the middle of what the selector finds */
const realClick = async (selector) => {
	const box = await page.locator(selector).boundingBox();
	assert.ok(box, `on screen: ${selector}`);
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const photoDrawn = () =>
	waitUntil(
		() => page.evaluate((d) => !!document.querySelector(`${d} .anyink-photo-dialog__loading`)?.hidden, DIALOG),
		'the photo drawn in the dialog'
	);
const photoCount = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { listPhotos } = await import('/anyink/photo/photo_registry.js');
		return listPhotos(editor.project).length;
	});
const screen = () =>
	page.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const coach = document.querySelector('anyink-coach');
		return {
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			coachButton: shown(coach?.querySelector('.anyink-coach__button'))
				? text(coach.querySelector('.anyink-coach__button'))
				: null,
			greens: [...document.querySelectorAll('.anyink-primary')].filter(shown).map(text),
			card: document.querySelector('[data-anyink-photo-card]')?.getAttribute('data-anyink-photo-card') || null,
		};
	});
const scanSimple = (selector = 'body') =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);

/**
 * Every visible button under the root keeps its box when hovered, focused and pressed (pressed
 * and let go elsewhere, so nothing is clicked).
 * @returns {Promise<{checked: Number, moved: Array<String>}>}
 */
async function buttonsStayPut(root) {
	const boxes = await page.evaluate((sel) => {
		const out = [];
		document.querySelectorAll(`${sel} button`).forEach((b, i) => {
			if (!b.checkVisibility()) return;
			b.setAttribute('data-stay-put', String(i));
			const r = b.getBoundingClientRect();
			out.push({ i, label: b.getAttribute('aria-label') || b.textContent.trim(), r: [r.x, r.y, r.width, r.height] });
		});
		return out;
	}, root);
	const moved = [];
	const now = (i) =>
		page.evaluate((n) => {
			const r = document.querySelector(`[data-stay-put="${n}"]`)?.getBoundingClientRect();
			return r ? [r.x, r.y, r.width, r.height] : null;
		}, i);
	const same = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 0.5);
	const away = await page.evaluate((sel) => {
		const r = document.querySelector(sel).getBoundingClientRect();
		return { x: r.x + 4, y: r.y + 4 };
	}, root);
	for (const { i, label, r } of boxes) {
		const [x, y, w, h] = r;
		await page.mouse.move(x + w / 2, y + h / 2);
		await page.waitForTimeout(40);
		if (!same(await now(i), r)) moved.push(`${label} (hover)`);
		await page.mouse.down();
		await page.waitForTimeout(40);
		if (!same(await now(i), r)) moved.push(`${label} (press)`);
		await page.mouse.move(away.x, away.y);
		await page.mouse.up();
		await page.evaluate((n) => document.querySelector(`[data-stay-put="${n}"]`)?.focus(), i);
		if (!same(await now(i), r)) moved.push(`${label} (focus)`);
	}
	await page.evaluate(() => document.querySelectorAll('[data-stay-put]').forEach((b) => b.removeAttribute('data-stay-put')));
	return { checked: boxes.length, moved };
}

/** Clicks the x with the real mouse and checks it went the way Cancel goes, for good. */
async function closeWithX(label) {
	await photoDrawn();
	await page.evaluate((d) => (document.querySelector(d).__photoUiMark = 1), DIALOG);
	const before = await page.locator('[data-anyink-photo-action="close"]').boundingBox();
	await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
	await page.waitForTimeout(80);
	const hovered = await page.locator('[data-anyink-photo-action="close"]').boundingBox();
	assert.deepEqual(hovered, before, `${label}: the x stays under the pointer`);
	await realClick('[data-anyink-photo-action="close"]');
	await waitUntil(async () => (await page.locator(DIALOG).count()) === 0, `${label}: the x closes the dialog`, 2000);
	await page.waitForTimeout(1000);
	assert.equal(await page.locator(DIALOG).count(), 0, `${label}: no photo dialog comes back`);
}

try {
	// ----------------------------------------------------------
	// A + B. The x, three ways in; every button stays put
	// ----------------------------------------------------------
	page = await freshPage('x');
	await newFont('Brennan Hand');
	let s = await screen();
	assert.equal(s.coachButton, 'How');
	await page.locator('anyink-coach .anyink-coach__button').click();
	await page.locator('[data-anyink-dialog="howCard"]').waitFor();
	let stay = await buttonsStayPut('[data-anyink-dialog="howCard"]');
	assert.deepEqual(stay.moved, [], 'How card buttons');
	assert.deepEqual(await scanSimple('[data-anyink-dialog="howCard"]'), []);
	const how = await page.locator('[data-anyink-dialog="howCard"]').innerText();
	assert.match(how, /printer paper, not lined notebook paper/);
	assert.match(how, /capitals in rows, then small letters in rows/);
	assert.match(how, /More than one page\? Take one photo of each\./);
	await shot('A0-how-card');
	await realClick('[data-anyink-how-action="x"]');
	await settle(300);
	assert.equal(await dialogCount(), 0, 'the How card x closes it');
	pass(`A0 the How card: ${stay.checked} buttons stay put under hover, press and focus; it asks for printer paper, rows, a photo of each page; its x closes it with a real mouse`);

	await page.evaluate((next) => (window.__next = next), ALPHABET);
	await page.locator('anyink-coach .anyink-coach__button').click();
	await page.locator('[data-anyink-how-action="havePhoto"]').click();
	await page.locator(DIALOG).waitFor({ timeout: 20000 });
	await photoDrawn();
	assert.equal(await photoCount(), 1);
	stay = await buttonsStayPut(DIALOG);
	assert.deepEqual(stay.moved, [], 'photo dialog buttons (letter unknown)');
	await closeWithX('Next line [How]');
	assert.equal(await photoCount(), 0, 'Cancel takes out the photo the screens added');
	s = await screen();
	assert.equal(s.coachButton, 'How', 'back where he started');
	await shot('A1-after-x-from-next-line');
	pass(`A1 Next line [How] > [I have my photo] > the dialog (${stay.checked} buttons stay put): the x closes it with a real mouse, nothing comes back, the photo the screens added is gone, the Next line says [How] again`);

	await page.getByRole('button', { name: /^Menu/ }).click();
	await settle(300);
	await page.getByText('How to photograph your letters').click();
	await page.locator('[data-anyink-how-action="havePhoto"]').click();
	await page.locator(DIALOG).waitFor({ timeout: 20000 });
	await closeWithX('Menu > How to photograph your letters');
	assert.equal(await photoCount(), 0);
	await shot('A2-after-x-from-menu');
	pass('A2 Menu > How to photograph your letters > [I have my photo] > the dialog: the x closes it, nothing comes back');

	await openLetter(ID('a'));
	await page.locator('[data-anyink-overlay-action="usePhoto"]').click();
	await page.locator('[data-anyink-photo-card-action="choose"]').waitFor();
	stay = await buttonsStayPut('[data-anyink-photo-card]');
	assert.deepEqual(stay.moved, [], 'photo card step A buttons');
	const stepA = stay.checked;
	await page.locator('[data-anyink-photo-card-action="choose"]').click();
	await page.locator(DIALOG).waitFor({ timeout: 20000 });
	await photoDrawn();
	assert.equal(await page.locator(`${DIALOG} h2`).innerText(), 'Which part is your small a?');
	stay = await buttonsStayPut(DIALOG);
	assert.deepEqual(stay.moved, [], 'photo dialog buttons (letter known)');
	await closeWithX('an empty small a > [Use a photo] > [Choose a photo...]');
	await settle(400);
	s = await screen();
	assert.equal(s.card, 'pick', 'step A is back for small a');
	assert.deepEqual(s.greens, ['Choose a photo...']);
	assert.equal(await photoCount(), 0);
	await shot('A3-after-x-step-a-back');
	pass(`A3 small a > [Use a photo] > [Choose a photo...] > "Which part is your small a?" (${stay.checked} buttons stay put; step A's ${stepA} too): the x closes it, step A comes back with [Choose a photo...] green`);
	await page.locator('[data-anyink-photo-card-action="cancel"]').click();
	assert.deepEqual(errors, [], JSON.stringify(errors));
	await page.context().close();

	// ----------------------------------------------------------
	// C. A whole-alphabet page, close up, at two window sizes
	// ----------------------------------------------------------
	const key = await (await fetch(`${origin}${FIXTURES}/alphabet-loose-phone.json`)).json();
	for (const [w, h] of [
		[1600, 900],
		[1280, 720],
	]) {
		const size = `${w}x${h}`;
		page = await freshPage(`page ${size}`, { width: w, height: h });
		await newFont('Brennan Hand');
		await page.evaluate((next) => (window.__next = next), ALPHABET);
		await page.locator('anyink-coach .anyink-coach__button').click();
		await page.locator('[data-anyink-how-action="havePhoto"]').click();
		await page.locator(DIALOG).waitFor({ timeout: 20000 });
		await photoDrawn();
		await settle(300);
		const facts = () =>
			page.evaluate(async (d) => {
				const dialog = document.querySelector(d);
				const view = dialog.querySelector('[data-anyink-photo-view]');
				const vr = view.getBoundingClientRect();
				const parts = [...dialog.querySelectorAll('[data-anyink-part]')].map((el) => el.getBoundingClientRect());
				const heights = parts.map((r) => r.height).sort((a, b) => a - b);
				const picked = dialog.querySelector('[data-anyink-picked]')?.getBoundingClientRect();
				const viewBox = { left: vr.left, top: vr.top, right: vr.left + view.clientWidth, bottom: vr.top + view.clientHeight };
				const inside = (r) => !!r && r.left >= viewBox.left && r.top >= viewBox.top && r.right <= viewBox.right && r.bottom <= viewBox.bottom;
				const stage = dialog.querySelector('[data-anyink-photo-stage]').getBoundingClientRect();
				return {
					parts: parts.length,
					letterPx: Math.round(heights[Math.floor(heights.length / 2)]),
					sideways: view.scrollWidth - view.clientWidth,
					upDown: view.scrollHeight - view.clientHeight,
					scrollTop: view.scrollTop,
					pickedInView: inside(picked),
					stage: { width: Math.round(stage.width), height: Math.round(stage.height) },
					view: { width: view.clientWidth, height: view.clientHeight, x: vr.left, y: vr.top },
					zoomOut: !dialog.querySelector('[data-anyink-photo-action="zoomOut"]').hidden,
				};
			}, DIALOG);
		let f = await facts();
		// photo-core finds the parts (58 letters on the page); this check needs only many of them
		assert.ok(f.parts >= key.letters.length * 0.8, `${size}: ${f.parts} parts`);
		assert.ok(f.letterPx >= 56, `${size}: letters show ${f.letterPx} px`);
		assert.ok(f.sideways <= 1, `${size}: no sideways scrolling (${f.sideways})`);
		assert.ok(f.upDown > 0, `${size}: the page scrolls up and down`);
		assert.equal(f.pickedInView, true, `${size}: the green box is in view`);
		assert.deepEqual(await scanSimple(DIALOG), []);
		await shot(`C1-${size}-close-up`);
		const opened = f;

		// the wheel scrolls; Ctrl + the wheel zooms where the pointer is
		const mid = { x: f.view.x + f.view.width / 2, y: f.view.y + f.view.height / 2 };
		await page.mouse.move(mid.x, mid.y);
		await page.mouse.wheel(0, 300);
		await settle(300);
		f = await facts();
		assert.ok(f.scrollTop > opened.scrollTop, `${size}: the wheel scrolls (${opened.scrollTop} -> ${f.scrollTop})`);
		assert.equal(f.stage.width, opened.stage.width);
		await page.keyboard.down('Control');
		await page.mouse.wheel(0, -200);
		await page.keyboard.up('Control');
		await settle(300);
		f = await facts();
		assert.ok(f.stage.width > opened.stage.width, `${size}: Ctrl + the wheel comes closer`);
		// [-] down to the whole photo, then it is not offered
		for (let n = 0; n < 8 && f.zoomOut; n++) {
			await realClick('[data-anyink-photo-action="zoomOut"]');
			await settle(150);
			f = await facts();
		}
		assert.equal(f.zoomOut, false);
		assert.ok(f.upDown <= 1 && f.sideways <= 1, `${size}: the whole photo fits`);
		const wholePx = f.letterPx;
		await shot(`C2-${size}-whole-photo`);
		await realClick('[data-anyink-photo-action="zoomIn"]');
		await settle(150);
		f = await facts();
		assert.ok(f.letterPx > wholePx);
		assert.equal(
			await page.evaluate(() => document.activeElement?.hasAttribute('data-anyink-photo-field')),
			true,
			'the zoom buttons leave the focus in the field'
		);

		// a real click on the narrow i picks it, after scrolling to it as he would
		const iCenter = key.letters.find((l) => l.char === 'i').center;
		const iPart = await page.evaluate(async (center) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { listPhotos } = await import('/anyink/photo/photo_registry.js');
			const record = listPhotos(editor.project)[0];
			const part = record.parts.find((p) => center[0] >= p.left && center[0] < p.right && center[1] >= p.top && center[1] < p.bottom);
			return { id: part.id, width: part.right - part.left };
		}, iCenter);
		const iSelector = `${DIALOG} [data-anyink-part="${iPart.id}"]`;
		for (let n = 0; n < 20; n++) {
			const inView = await page.evaluate(([sel, d]) => {
				const r = document.querySelector(sel).getBoundingClientRect();
				const view = document.querySelector(`${d} [data-anyink-photo-view]`);
				const v = view.getBoundingClientRect();
				return r.top >= v.top && r.bottom <= v.top + view.clientHeight ? 0 : r.top < v.top ? -1 : 1;
			}, [iSelector, DIALOG]);
			if (!inView) break;
			await page.mouse.move(mid.x, mid.y);
			await page.mouse.wheel(0, inView * 120);
			await settle(120);
		}
		const iBox = await page.locator(iSelector).boundingBox();
		await page.mouse.click(iBox.x + iBox.width / 2, iBox.y + iBox.height / 2);
		await settle(200);
		assert.equal(
			await page.evaluate((d) => document.querySelector(`${d} [data-anyink-picked]`)?.getAttribute('data-anyink-part'), DIALOG),
			iPart.id,
			`${size}: a click on the i picks it`
		);
		pass(`C1 ${size}: the whole-alphabet page opens close up: letters ${opened.letterPx} px (whole photo: ${wholePx} px), no sideways scrolling, the green box in view; the wheel scrolls, Ctrl + the wheel comes closer, [-] goes back to the whole photo and is then not offered, [+] comes closer, the field keeps the focus; the i (${iPart.width} photo px wide, ${Math.round(iBox.width)} px on screen) picked by a real click`);

		// every capital named: no tag covers another letter, close up or whole. [Done with this
		// photo] keeps the photo the screens added (Cancel would take it out)
		await realClick('[data-anyink-photo-action="done"]');
		await settle(300);
		assert.equal(await photoCount(), 1);
		await page.evaluate(async (letters) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { listPhotos, usePart } = await import('/anyink/photo/photo_registry.js');
			const record = listPhotos(editor.project)[0];
			for (const l of letters.filter((x) => x.row < 4)) {
				const part = record.parts.find((p) => l.center[0] >= p.left && l.center[0] < p.right && l.center[1] >= p.top && l.center[1] < p.bottom);
				if (part) usePart(record, part.id, { char: l.char, itemId: `glyph-0x${l.char.codePointAt(0).toString(16).toUpperCase()}` });
			}
		}, key.letters);
		const tagsCover = () =>
			page.evaluate((d) => {
				const dialog = document.querySelector(d);
				const parts = [...dialog.querySelectorAll('[data-anyink-part]')];
				const hits = [];
				let tags = 0;
				parts.forEach((part) => {
					const tag = part.querySelector('.anyink-photo-dialog__tag');
					if (!tag) return;
					tags++;
					const t = tag.getBoundingClientRect();
					parts.forEach((other) => {
						if (other === part) return;
						const o = other.getBoundingClientRect();
						if (t.left < o.right && t.right > o.left && t.top < o.bottom && t.bottom > o.top) hits.push(`${tag.textContent} on ${other.dataset.anyinkPart}`);
					});
				});
				return { tags, hits };
			}, DIALOG);
		await page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { listPhotos } = await import('/anyink/photo/photo_registry.js');
			const { nextPart } = await import('/anyink/photo/photo_app.js');
			await nextPart(editor, listPhotos(editor.project)[0].asset);
		});
		await page.locator(DIALOG).waitFor({ timeout: 20000 });
		await photoDrawn();
		await settle(300);
		let tags = await tagsCover();
		assert.ok(tags.tags >= 20, `${size}: tags shown (${tags.tags})`);
		assert.deepEqual(tags.hits, [], `${size}: close up, no tag covers another letter`);
		await shot(`C3-${size}-tags-close-up`);
		for (let n = 0; n < 8; n++) {
			if (await page.locator('[data-anyink-photo-action="zoomOut"]').isHidden()) break;
			await realClick('[data-anyink-photo-action="zoomOut"]');
			await settle(150);
		}
		tags = await tagsCover();
		assert.deepEqual(tags.hits, [], `${size}: whole photo, no tag covers another letter`);
		assert.deepEqual(await scanSimple(DIALOG), []);
		await shot(`C4-${size}-tags-whole-photo`);
		pass(`C2 ${size}: the first four rows named (${tags.tags} tags); no name tag covers another letter, close up or on the whole photo`);
		await page.keyboard.press('Escape');
		assert.deepEqual(errors, [], JSON.stringify(errors));
		await page.context().close();
	}

	// ----------------------------------------------------------
	// D + E. Step C: no ink; a tall result on a zoomed-in canvas
	// ----------------------------------------------------------
	page = await freshPage('step C');
	await newFont('Brennan Hand');
	await openLetter(ID('H'));
	// the canvas zoomed in on the middle of the letter box, as he might have left it
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const v = editor.view;
		editor.view = { dx: v.dx - 250, dy: v.dy + 120, dz: v.dz * 2.2 };
		editor.publish('editCanvasView', editor.view);
	});
	await settle(300);
	await page.evaluate((next) => (window.__next = next), ALPHABET);
	await page.locator('[data-anyink-overlay-action="usePhoto"]').click();
	await page.locator('[data-anyink-photo-card-action="choose"]').click();
	await page.locator(DIALOG).waitFor({ timeout: 20000 });
	await photoDrawn();
	const hCenter = key.letters.find((l) => l.char === 'H').center;
	const hPart = await page.evaluate(async (center) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { listPhotos } = await import('/anyink/photo/photo_registry.js');
		const record = listPhotos(editor.project)[0];
		return record.parts.find((p) => center[0] >= p.left && center[0] < p.right && center[1] >= p.top && center[1] < p.bottom).id;
	}, hCenter);
	await page.locator(`${DIALOG} [data-anyink-part="${hPart}"]`).scrollIntoViewIfNeeded();
	await realClick(`${DIALOG} [data-anyink-part="${hPart}"]`);
	await page.locator('[data-anyink-photo-action="trace"]').click();
	const flowStatus = () =>
		page.evaluate(async () => {
			const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
			return getFlow((await import('/app/main.js')).getCurrentProjectEditor())?.status || null;
		});
	await waitUntil(async () => (await flowStatus()) === 'ready', 'step C for H');
	await page.mouse.move(5, h0());
	await settle(500);
	const canvasShows = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { photoPreviewShapes } = await import('/anyink/photo/photo_flow_state.js');
			const shapes = photoPreviewShapes(editor.selectedItem, editor) || [];
			const ink = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
			shapes.forEach((s) => {
				const m = s.maxes;
				ink.xMin = Math.min(ink.xMin, m.xMin);
				ink.xMax = Math.max(ink.xMax, m.xMax);
				ink.yMin = Math.min(ink.yMin, m.yMin);
				ink.yMax = Math.max(ink.yMax, m.yMax);
			});
			const font = editor.project.settings.font;
			const v = editor.view;
			const rect = editor.getEditCanvasWrapperBounds();
			const top = v.dy - Math.max(ink.yMax, font.ascent) * v.dz;
			const bottom = v.dy - Math.min(ink.yMin, font.descent) * v.dz;
			const left = v.dx + Math.min(ink.xMin, 0) * v.dz;
			const right = v.dx + ink.xMax * v.dz;
			return {
				view: { dx: Math.round(v.dx), dy: Math.round(v.dy), dz: Number(v.dz.toFixed(4)) },
				whole: top >= 0 && left >= 0 && bottom <= rect.height && right <= rect.width,
				edges: { top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), right: Math.round(right), height: Math.round(rect.height), width: Math.round(rect.width) },
				shapes: shapes.length,
			};
		});
	let c = await canvasShows();
	assert.ok(c.shapes > 0);
	assert.equal(c.whole, true, `step C shows the whole H and every guide line: ${JSON.stringify(c.edges)}`);
	s = await screen();
	assert.deepEqual(s.greens, ['Use it']);
	assert.deepEqual(await scanSimple(), []);
	await shot('E1-step-c-H-fitted');
	// he zooms in a little; an Adjust re-trace leaves his view alone
	const his = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const v = editor.view;
		editor.view = { dx: v.dx - 20, dy: v.dy + 20, dz: v.dz * 1.1 };
		editor.publish('editCanvasView', editor.view);
		return { ...editor.view };
	});
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const flow = await import('/anyink/photo/photo_flow.js');
		flow.adjustPart(editor, { smoothDetail: 0.7 });
	});
	await waitUntil(async () => (await flowStatus()) === 'tracing', 'the re-trace starts', 5000).catch(() => {});
	await waitUntil(async () => (await flowStatus()) === 'ready', 'the re-trace');
	await settle(300);
	const after = await page.evaluate(async () => ({ ...(await import('/app/main.js')).getCurrentProjectEditor().view }));
	assert.deepEqual(after, his, 'an Adjust re-trace leaves his view alone');
	pass(`E1 step C for Capital H on a canvas zoomed in 2.2 times: the view fits the whole result and every guide line (${JSON.stringify(c.edges)}); [Use it] the one green button; after he zooms, an Adjust re-trace leaves his view as it is`);

	// D. no ink: Flat scan with the ink cutoff at its "less ink" end, with Adjust closed
	assert.equal(
		await page.locator('[data-anyink-photo-card-action="adjust"]').getAttribute('aria-expanded'),
		'false'
	);
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const flow = await import('/anyink/photo/photo_flow.js');
		// Flat scan: one cutoff for the page, and nothing is darker than 0
		flow.adjustPart(editor, { paper: 'scan', threshold: 0 });
	});
	await waitUntil(async () => (await flowStatus()) === 'no-ink', 'no ink found');
	await settle(300);
	const noInk = await page.evaluate(() => {
		const card = document.querySelector('[data-anyink-photo-card]');
		const shown = (el) => !!el && el.checkVisibility();
		const status = card.querySelector('[data-anyink-photo-card-status]');
		const cancel = card.querySelector('[data-anyink-photo-card-action="cancel"]');
		return {
			lookRight: shown(card.querySelector('.anyink-photo-card__title')),
			sentence: status.textContent,
			sentenceFirst: !!(status.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING),
			adjust: card.querySelector('[data-anyink-photo-card-action="adjust"]').getAttribute('aria-expanded'),
			inkCutoff: shown(card.querySelector('[data-anyink-photo-card-input="inkCutoff"]')),
			moreInk: shown([...card.querySelectorAll('.anyink-photo-card__end')].find((e) => e.textContent === 'more ink')),
		};
	});
	assert.deepEqual(
		{ ...noInk, sentence: undefined },
		{ lookRight: false, sentence: undefined, sentenceFirst: true, adjust: 'true', inkCutoff: true, moreInk: true }
	);
	s = await screen();
	assert.deepEqual(s.greens, ['Draw a box']);
	stay = await buttonsStayPut('[data-anyink-photo-card]');
	assert.deepEqual(stay.moved, [], 'photo card step C buttons');
	assert.deepEqual(await scanSimple(), []);
	await shot('D1-no-ink-adjust-open');
	await page.locator('[data-anyink-photo-card-action="auto"]').click();
	await waitUntil(async () => (await flowStatus()) === 'ready', 'ink again');
	await settle(300);
	assert.equal(await page.locator('.anyink-photo-card__title').isVisible(), true, '"Look right?" is back');
	await shot('D2-ink-again');
	pass(`D1 no ink at step C: no "Look right?", "${noInk.sentence}" above the buttons, Adjust open on its own with the ink cutoff and its "more ink" end showing, [Draw a box] the one green button (${stay.checked} card buttons stay put); [Auto]: ink again and "Look right?" is back`);
	await page.locator('[data-anyink-photo-card-action="cancel"]').click();
	assert.deepEqual(errors, [], JSON.stringify(errors));
	await page.context().close();
} finally {
	await browser.close();
	await server.close();
}
console.log(`screenshots (${shotList.length}) in ${shots}`);

/** Off the canvas, at the window's bottom left. */
function h0() {
	return (page.viewportSize()?.height || 900) - 5;
}
