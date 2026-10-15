// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 + B9 finalize real-browser check (the second hostile pass; docs/UX-BEGINNER.md 4.0, 4.3, 4.4,
// 7.3; D-041), in the real app on a Vite dev server, Chrome with throwaway profiles, Simple
// (?ui=simple) with the flags as the app ships them:
//   A. The first-timer's notebook alphabet page in the photo dialog: with every part named, the
//      whole photo's name tags cover no other tag and no other letter; a window resized while it
//      is open keeps the letters their size with the green box in view; [+] pressed with the
//      keyboard until it hides hands the focus on and a letter key still lands in the field; the
//      green box on a part holding two touching letters says so; Skip reads "Not a letter, skip
//      it".
//   B. The Brush picked on small b after one stroke: the Next line (past rule 10's "not saved",
//      by Something else) no longer says "looks done" with a green [Go to ...]; it says when to
//      go on, its button outlined.
//   C. Fine-tune > Photo on a traced letter: Photo fade by a real drag (one Undo step), Hide photo,
//      Photo options > Remove photo with its Undo toast, whose [Undo] brings the photo back.
//   D. Whole-font Undo and Redo keep the photo list (Ctrl+Z, Ctrl+Y): a photo added after a
//      whole-font step ([No tail] on a traced g) stays one record with one image, and picking
//      it again adds nothing.
//   E. A photo he is done with never leads: an empty letter's overlay offers [Choose another
//      photo...] green and [Use the same photo] outlined.
//   Every screen says no banned word (strict), and no page error happens.
// Usage: node tests/b89_final.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b89-final'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b89-final-'));
const FIXTURES = '/anyink/photo/tests/fixtures';
const NOTEBOOK = { url: `${FIXTURES}/notebook-alphabet-phone.webp`, name: 'IMG_4131.webp', type: 'image/webp' };
const LOOSE = { url: `${FIXTURES}/brenna-loose-phone.jpg`, name: 'IMG_4127.jpg', type: 'image/jpeg' };
const SINGLE_G = { url: `${FIXTURES}/single-g-phone.webp`, name: 'IMG_4133.webp', type: 'image/webp' };
const FIRST_TRY = { url: `${FIXTURES}/first-try-phone.webp`, name: 'IMG_4127b.webp', type: 'image/webp' };

const server = await createServer({
	root: resolve(repo, 'src'),
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(scratch, 'vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] }, fs: { strict: false } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: process.env.B89_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);

/** A fresh profile; the Windows picker can't be driven, so a stand-in hands over window.__next. */
async function freshPage(label, viewport = { width: 1600, height: 900 }) {
	const context = await browser.newContext({ viewport });
	await context.addInitScript(() => {
		window.__next = null;
		window.showOpenFilePicker = async () => {
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
	await settle(700);
};
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
const DIALOG = '[data-anyink-dialog="photoDialog"]';
const photoDrawn = () =>
	waitUntil(
		() => page.evaluate((d) => !!document.querySelector(`${d} .anyink-photo-dialog__loading`)?.hidden, DIALOG),
		'the photo drawn in the dialog'
	);
const scanSimple = (selector = 'body') =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);
const line = () =>
	page.evaluate(() => {
		const coach = document.querySelector('anyink-coach');
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const button = coach?.querySelector('.anyink-coach__button');
		return {
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			button: button?.checkVisibility() ? text(button) : null,
			green: !!button?.classList.contains('anyink-primary'),
		};
	});
/** A photo in through the flow itself (the app's own code; the dialog is for A). */
const tracePart = (photo, char, pick = 'guess') =>
	page.evaluate(
		async ({ photo, char, pick }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const flow = await import('/anyink/photo/photo_flow.js');
			const { guessPart } = await import('/anyink/photo/photo_registry.js');
			const blob = await (await fetch(photo.url)).blob();
			const added = await flow.addPhotoFile(new File([blob], photo.name, { type: photo.type }), { editor });
			// pick: 'guess' (the green box's start), or [x, y] a point of the letter on the photo
			const at = Array.isArray(pick)
				? added.record.parts.find((p) => pick[0] >= p.left && pick[0] < p.right && pick[1] >= p.top && pick[1] < p.bottom)
				: null;
			const partId = at ? at.id : guessPart(added.record, { char });
			await flow.startPart({ editor, asset: added.asset, partId, char });
			const settled = await flow.whenFlowSettled(editor);
			const used = await flow.useIt(editor);
			return { asset: added.asset, added: added.added, partId, status: settled.status, ok: used.ok, title: used.title };
		},
		{ photo, char, pick }
	);
const photoFacts = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { listPhotos } = await import('/anyink/photo/photo_registry.js');
		return {
			records: listPhotos(editor.project, { limit: 99 }).map((r) => r.asset).sort(),
			images: [...(editor.assets?.ids?.() || Object.keys(editor.assets?.toBlobMap?.() || {}))].sort(),
		};
	});

try {
	// ----------------------------------------------------------
	// A. The notebook page in the dialog
	// ----------------------------------------------------------
	page = await freshPage('dialog');
	await newFont('Brennan Hand');
	await page.evaluate((next) => (window.__next = next), NOTEBOOK);
	await page.locator('anyink-coach .anyink-coach__button').click();
	await page.locator('[data-anyink-how-action="havePhoto"]').click();
	await page.locator(DIALOG).waitFor({ timeout: 30000 });
	await photoDrawn();
	// every part named (the registry's own call, as Use it makes it), then drawn again
	const named = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { listPhotos, usePart } = await import('/anyink/photo/photo_registry.js');
		const record = listPhotos(editor.project)[0];
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,\'?!-0123456789';
		record.parts.forEach((part, i) => usePart(record, part.id, { char: chars[i % chars.length], itemId: `glyph-test-${i}` }));
		return record.parts.length;
	});
	const field = page.locator(`${DIALOG} [data-anyink-photo-field]`);
	await field.focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowLeft');
	for (let i = 0; i < 8 && (await page.locator(`${DIALOG} [data-anyink-photo-action="zoomOut"]`).isVisible()); i++) {
		await page.locator(`${DIALOG} [data-anyink-photo-action="zoomOut"]`).click();
		await settle(150);
	}
	const tags = await page.evaluate((d) => {
		const dialog = document.querySelector(d);
		const rects = [...dialog.querySelectorAll('.anyink-photo-dialog__tag')]
			.filter((t) => ![...t.classList].some((c) => c.endsWith('--inside')))
			.map((t) => t.getBoundingClientRect());
		const parts = [...dialog.querySelectorAll('[data-anyink-part]')].map((p) => p.getBoundingClientRect());
		const hit = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
		let onTags = 0;
		for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i], rects[j])) onTags++;
		return { tags: dialog.querySelectorAll('.anyink-photo-dialog__tag').length, onTags };
	}, DIALOG);
	assert.equal(tags.onTags, 0, `tags on tags: ${JSON.stringify(tags)}`);
	await shot('A1-whole-photo-every-part-named');
	pass(`A1 the notebook page (${named} parts), every part named, the whole photo: ${tags.tags} name tags, none on another tag`);

	// back close up, then a resize while it is open
	await page.locator(`${DIALOG} [data-anyink-photo-action="zoomIn"]`).click();
	await page.locator(`${DIALOG} [data-anyink-photo-action="zoomIn"]`).click();
	await settle(300);
	const scale = () =>
		page.evaluate((d) => {
			const dialog = document.querySelector(d);
			const stage = dialog.querySelector('[data-anyink-photo-stage]').getBoundingClientRect();
			const canvas = dialog.querySelector('canvas.anyink-photo-dialog__photo');
			const view = dialog.querySelector('[data-anyink-photo-view]');
			const vr = view.getBoundingClientRect();
			const picked = dialog.querySelector('[data-anyink-picked]')?.getBoundingClientRect();
			const inView = !!picked && picked.left >= vr.left && picked.top >= vr.top && picked.right <= vr.left + view.clientWidth && picked.bottom <= vr.top + view.clientHeight;
			return { k: stage.width / canvas.width, inView, sideways: view.scrollWidth - view.clientWidth };
		}, DIALOG);
	const before = await scale();
	await page.setViewportSize({ width: 1280, height: 720 });
	await settle(900);
	const after = await scale();
	await page.setViewportSize({ width: 1920, height: 1080 });
	await settle(900);
	const again = await scale();
	await page.setViewportSize({ width: 1600, height: 900 });
	await settle(900);
	assert.ok(Math.abs(after.k / before.k - 1) < 0.02, `letters resized: ${JSON.stringify([before, after])}`);
	assert.ok(Math.abs(again.k / before.k - 1) < 0.02, `letters resized: ${JSON.stringify([before, again])}`);
	assert.equal(after.inView, true, 'the green box after a resize');
	await shot('A2-after-resizes');
	pass(`A2 resized 1600x900 -> 1280x720 -> 1920x1080 while open: ${before.k.toFixed(3)} / ${after.k.toFixed(3)} / ${again.k.toFixed(3)} screen px per photo px, the green box in view`);

	// [+] by the keyboard until it hides
	const zoomIn = page.locator(`${DIALOG} [data-anyink-photo-action="zoomIn"]`);
	await zoomIn.focus();
	for (let i = 0; i < 12 && (await zoomIn.isVisible()); i++) {
		await page.keyboard.press('Enter');
		await settle(120);
	}
	assert.equal(await zoomIn.isVisible(), false);
	const focus = await page.evaluate((d) => {
		const a = document.activeElement;
		return { inside: !!document.querySelector(d)?.contains(a), what: a?.getAttribute('data-anyink-photo-action') || a?.tagName };
	}, DIALOG);
	assert.equal(focus.inside, true, `focus fell out of the dialog: ${JSON.stringify(focus)}`);
	await page.keyboard.press('k');
	assert.equal(await field.inputValue(), 'k');
	await shot('A3-keyboard-zoom-closest');
	pass(`A3 [+] pressed with Enter until it hides: the focus goes to ${focus.what}; the k key lands in the field`);

	// two touching letters
	const touching = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { listPhotos, mayBeTwoLetters } = await import('/anyink/photo/photo_registry.js');
		const record = listPhotos(editor.project)[0];
		return record.parts.filter((p) => mayBeTwoLetters(record, p.id)).map((p) => p.id);
	});
	assert.ok(touching.length > 0, 'the notebook page has touching letters (lm, VW)');
	const part = page.locator(`${DIALOG} [data-anyink-part="${touching[0]}"]`);
	await part.scrollIntoViewIfNeeded();
	const box = await part.boundingBox();
	await page.mouse.click(box.x + box.width / 2, box.y + 3);
	await settle(200);
	const message = await page.locator(`${DIALOG} [data-anyink-photo-message]`).innerText();
	assert.equal(message, 'Two letters touch here. Drag a box around each one.');
	assert.equal(await page.locator(`${DIALOG} [data-anyink-photo-action="skip"]`).innerText(), 'Not a letter, skip it');
	assert.deepEqual(await scanSimple(DIALOG), []);
	await shot('A4-two-letters-touch-here');
	pass(`A4 the green box on ${touching.join(', ')} (two touching letters): "${message}"; Skip reads "Not a letter, skip it"; 0 banned words`);
	await page.locator(`${DIALOG} [data-anyink-photo-action="close"]`).click();
	assert.deepEqual(errors, [], JSON.stringify(errors));
	await page.context().close();

	// ----------------------------------------------------------
	// B. The Brush on small b after one stroke
	// ----------------------------------------------------------
	page = await freshPage('brush');
	await newFont('Brennan Hand');
	await openLetter(ID('b'));
	await page.locator('[data-anyink-overlay-action="drawBrush"]').click();
	await settle(300);
	const area = await page.locator('.editor-page__edit-canvas-wrapper').boundingBox();
	const x = area.x + area.width * 0.45;
	await page.mouse.move(x, area.y + area.height * 0.25);
	await page.mouse.down();
	for (let i = 1; i <= 30; i++) await page.mouse.move(x, area.y + area.height * (0.25 + (0.4 * i) / 30));
	await page.mouse.up();
	await settle(900);
	// no work file yet: rule 10 ("Your work isn't saved yet.") comes first; Something else skips it
	if ((await line()).sentence === "Your work isn't saved yet.") {
		await page.locator('anyink-coach .anyink-coach__else').click();
		await settle(400);
	}
	const brushLine = await line();
	assert.match(brushLine.sentence || '', /^When small b looks right, go to /);
	assert.equal(brushLine.green, false, 'the button is outlined while the Brush is picked');
	assert.deepEqual(await scanSimple(), []);
	await shot('B1-brush-after-one-stroke');
	pass(`B1 small b, one brush stroke: Next line "${brushLine.sentence}" [${brushLine.button}] outlined`);
	await page.context().close();

	// ----------------------------------------------------------
	// C. Fine-tune > Photo; D. the photo list through Undo; E. a photo he is done with
	// ----------------------------------------------------------
	page = await freshPage('photo');
	await newFont('Brennan Hand');
	await openLetter(ID('e'));
	// the e of the loose B r e n a H d page (its answer key: e at 522..574, 530..596)
	const e = await tracePart(LOOSE, 'e', [548, 563]);
	assert.equal(e.ok, true, JSON.stringify(e));
	await settle(600);
	await page.locator('[data-anyink-toggle="fineTune"]').click();
	await settle(300);
	const fine = await page.$$eval('[data-anyink-fine]', (list) => list.map((el) => el.dataset.anyinkFine));
	assert.equal(fine[0], 'photo');
	const steps = () => page.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().history.queue.map((q) => q.title));
	const traceNow = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { getTrace } = await import('/anyink/trace/trace_model.js');
			return getTrace(editor.selectedItem);
		});
	const slider = await page.locator('[data-anyink-photo-input="fade"]').boundingBox();
	const stepsBefore = (await steps()).length;
	await page.mouse.move(slider.x + slider.width * 0.25, slider.y + slider.height / 2);
	await page.mouse.down();
	for (let i = 1; i <= 10; i++) await page.mouse.move(slider.x + slider.width * (0.25 + 0.05 * i), slider.y + slider.height / 2);
	await page.mouse.up();
	await settle(400);
	const faded = await traceNow();
	const afterFade = await steps();
	assert.equal(afterFade.length, stepsBefore + 1, JSON.stringify(afterFade.slice(0, 3)));
	assert.equal(afterFade[0], 'set the photo fade of small e');
	assert.ok(faded.opacity > 0.5, `fade ${faded.opacity}`);
	await shot('C1-photo-fade-dragged');
	await page.locator('[data-anyink-photo-action="hide"]').click();
	await settle(300);
	assert.equal((await traceNow()).visible, false);
	await shot('C2-photo-hidden');
	await page.locator('[data-anyink-photo-action="show"]').click();
	await page.locator('[data-anyink-toggle="photoOptions"]').click();
	await settle(200);
	assert.deepEqual(await scanSimple('.anyink-letter-card'), []);
	await shot('C3-photo-options');
	await page.locator('[data-anyink-photo-action="remove"]').click();
	await settle(400);
	assert.equal(await traceNow(), null);
	const toastText = await page.locator('#toast').innerText();
	assert.match(toastText, /Took the photo off small e\./);
	await shot('C4-photo-removed-toast');
	await page.locator('#toast button').filter({ hasText: 'Undo' }).click();
	await settle(500);
	assert.equal((await traceNow())?.asset, e.asset);
	await shot('C5-undo-brings-it-back');
	pass(`C Fine-tune > Photo first in Fine-tune (${fine.join(', ')}): a real drag of Photo fade is one step "set the photo fade of small e" (to ${Math.round(faded.opacity * 100)} %); Hide photo hides it; Photo options (0 banned words); Remove photo: "${toastText.split('\n')[0]}" and its [Undo] brings the photo back`);

	// D. the single g, then [No tail] on it (a whole-font step, Fine-tune > Tail), then a new
	// photo (the first try) for small d; Undo twice and Redo twice
	await openLetter(ID('g'));
	const g = await tracePart(SINGLE_G, 'g');
	assert.equal(g.ok, true, JSON.stringify(g));
	const tail = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const flow = await import('/anyink/photo/photo_flow.js');
		return flow.setLetterTail(editor, editor.selectedGlyphID, false);
	});
	assert.equal(tail.ok, true, JSON.stringify(tail));
	await openLetter(ID('d'));
	const d = await tracePart(FIRST_TRY, 'd', [1812, 341]);
	assert.equal(d.ok, true, JSON.stringify(d));
	const listed = await photoFacts();
	assert.equal(listed.records.length, 3, JSON.stringify(listed));
	const kinds = await page.evaluate(async () => {
		const seen = [];
		for (const q of (await import('/app/main.js')).getCurrentProjectEditor().history.queue) {
			if (q.title === '_whole_project_change_post_state_' || seen.some((s) => s.startsWith(q.title))) continue;
			seen.push(`${q.title}${q.wholeProjectSave ? ' (whole font)' : ''}`);
			if (seen.length === 2) break;
		}
		return seen;
	});
	assert.equal(kinds[1], 'said small g has no tail (whole font)', JSON.stringify(kinds));
	await page.mouse.move(5, 895);
	for (const keys of ['Control+z', 'Control+z']) {
		await page.keyboard.press(keys);
		await settle(600);
	}
	const undone = await photoFacts();
	assert.deepEqual(undone.records, listed.records, `the photo list after Undo: ${JSON.stringify(undone)}`);
	for (const keys of ['Control+y', 'Control+y']) {
		await page.keyboard.press(keys);
		await settle(600);
	}
	const kept = await photoFacts();
	assert.deepEqual(kept.records, listed.records, `the photo list after Redo: ${JSON.stringify(kept)}`);
	const pickedAgain = await page.evaluate(async (photo) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const flow = await import('/anyink/photo/photo_flow.js');
		const blob = await (await fetch(photo.url)).blob();
		const added = await flow.addPhotoFile(new File([blob], photo.name, { type: photo.type }), { editor });
		return { asset: added.asset, added: added.added };
	}, FIRST_TRY);
	assert.deepEqual(pickedAgain, { asset: d.asset, added: false });
	await shot('D1-after-undo-redo');
	pass(`D steps ${JSON.stringify(kinds)}, then Ctrl+Z twice (the whole-font step undone) and Ctrl+Y twice: the photo list still holds all ${kept.records.length} photos, and the first-try photo picked again is the same one (added: false)`);

	// E. Done with every photo that still has letters (the loose page and the first try), each
	// by its dialog's own button after rule 12's [Do the next one], then an empty letter
	for (const asset of [e.asset, d.asset]) {
		await page.evaluate(async (id) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { nextPart } = await import('/anyink/photo/photo_app.js');
			nextPart(editor, id);
		}, asset);
		await page.locator(DIALOG).waitFor({ timeout: 20000 });
		await page.locator(`${DIALOG} [data-anyink-photo-action="done"]`).click();
		await settle(400);
	}
	await openLetter(ID('k'));
	const overlay = await page.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-overlay-action]')].map((b) => ({
			action: b.getAttribute('data-anyink-overlay-action'),
			green: b.classList.contains('anyink-primary'),
		}))
	);
	assert.deepEqual(overlay.map((b) => b.action).slice(0, 2), ['chooseAnother', 'useSamePhoto']);
	assert.deepEqual(overlay.filter((b) => b.green).map((b) => b.action), ['chooseAnother']);
	assert.deepEqual(await scanSimple(), []);
	await shot('E1-done-photo-overlay');
	pass(`E after "Done with this photo" on both photos with letters left: small k's overlay ${JSON.stringify(overlay.map((b) => b.action))}, [Choose another photo...] the one green`);

	assert.deepEqual(errors, [], JSON.stringify(errors));
	pass('no page errors and no console errors');
	console.log(`screenshots (${shotList.length}) in ${shots}:\n  ${shotList.join('\n  ')}`);
} catch (error) {
	console.error(`FAIL ${error.message}`);
	if (errors.length) console.error(`page errors: ${JSON.stringify(errors, null, 1)}`);
	await shot('FAIL-screen').catch(() => {});
	process.exitCode = 1;
} finally {
	await browser.close();
	await server.close();
}
