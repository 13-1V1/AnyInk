// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 + B9 integration real-browser check (docs/UX-BEGINNER.md 4.0, 4.3, 4.4, 4.5, 7.3, 7.7, section
// 10 B8 and B9), in the real app on Vite dev servers, Chrome with throwaway profiles, 1600 x 900,
// the feature flags as the app has them ('coach', 'letterView', 'brush', 'photo' on):
//   A. The Brush (Simple, ?ui=simple, a new font): an empty small o opens with the Brush picked and
//      the overlay still offering [Use a photo] (the one green button) and the brush; a closed
//      loop drawn with a real mouse drag keeps its hole (paper in its middle, two tagged shapes),
//      every point a whole number, spacing automatic; a second stroke stays its own shape; one
//      Undo step per stroke ("drew a stroke on small o"), Ctrl+Z / Ctrl+Y one stroke at a time;
//      [Draw with the brush] on an empty letter: the overlay goes, the Next line says what a drag
//      does, the card shows the Brush's size, no green button (D-037)
//   B. The photo walk on the loose fixture (B r e n a H d, a phone photo): Next line [How], the How
//      card, [I have my photo] opens the picker (in Downloads; a stand-in picker hands over the
//      fixture), the photo dialog boxes each letter in turn, the letter is typed, Trace it, step
//      C in the letter card with the green dashed outline on the canvas, Use it; rule 12 [Do the
//      next one] for the next part. Seven letters Ready, each on the writing line, whole
//      numbers, automatic spacing, one Undo step each; "Brennan Hand" typed in the strip; the
//      real font (the exporter's own build) sets it with no letter touching another, evenly
//      spaced, every letter on one writing line
//   C. A phone-like photo (the whole alphabet, 58 parts) picked for small z from step A: the
//      dialog with the letter known, Phone photo "picked for you"; an iPhone HEIC photo: 7.7's
//      plain sentence with [Choose another photo], which opens the picker again
//   D. All tools, before (the last commit's src/, git archive) and after: the same controls but
//      the Brush button after New path (7.6), the same pixels outside the tool column, B picks
//      the Brush
//   Every Simple screen above says no banned word (strict), and no page error happens.
// Usage: node tests/b89.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync, symlinkSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pinBeforeChecks } from './verify_standins.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b89'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b89-'));
const FIXTURES = '/anyink/photo/tests/fixtures';

/** The last commit's src/, for the All tools "before": git archive into a temp folder. */
function exportHeadSrc() {
	const dir = resolve(scratch, 'head');
	execSync(`mkdir "${dir}"`, { shell: true, stdio: 'pipe' });
	const tar =
		process.platform === 'win32'
			? `"${resolve(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe')}"`
			: 'tar';
	execSync(`git archive HEAD src | ${tar} -x -C "${dir}"`, { cwd: repo, stdio: 'pipe', shell: true });
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

const beforeSetting = process.env.B89_BEFORE || '';
const beforeRoot =
	beforeSetting === 'skip' ? null : beforeSetting ? resolve(beforeSetting) : exportHeadSrc();
const after = await serve(src, 'after');
const before = beforeRoot ? await serve(beforeRoot, 'before') : null;

const browser = await chromium.launch({ channel: process.env.B89_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
let page;
const settle = (ms = 350, p = page) => p.waitForTimeout(ms);

/**
 * A fresh, empty profile with one page. The Windows file picker can't be driven from a script,
 * so a stand-in hands over the file the check puts in window.__b89Next (bytes from the dev
 * server); every call is kept in window.__b89Picks with its options.
 */
async function freshPage(label) {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	await context.addInitScript(() => {
		window.__b89Picks = [];
		window.__b89Next = null;
		window.showOpenFilePicker = async (options) => {
			window.__b89Picks.push(options);
			const next = window.__b89Next;
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

const shot = async (name, clip, p = page) => {
	const path = resolve(shots, `${name}.png`);
	await p.screenshot({ path, ...(clip ? { clip } : {}) });
	shotList.push(`${name}.png`);
	return path;
};
const offCanvas = (p = page) => p.mouse.move(5, 895);
const waitUntil = async (check, what, timeout = 20000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
/** The photo dialog has drawn its photo ("Loading the photo..." is gone) */
const photoDrawn = () =>
	waitUntil(
		() =>
			page.evaluate(() => {
				const loading = document.querySelector('[data-anyink-dialog="photoDialog"] .anyink-photo-dialog__loading');
				return !!loading && loading.hidden;
			}),
		'the photo drawn in the dialog'
	);
const newFont = async (p, origin, name, search = '') => {
	await p.goto(`${origin}/${search}`);
	// B10 + B11 integration: this walkthrough checks B6 to B9 on toy letters; 'checks' off
	await pinBeforeChecks(p);
	const field = p.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill(name);
	await p.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(600, p);
};
/** Opens a letter through the editor (standing in for B10's board, which isn't on yet) */
const openLetter = async (p, id) => {
	await p.evaluate(async (glyph) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedGlyphID = glyph;
		editor.nav.page = 'Characters';
		editor.navigate();
	}, id);
	await p.locator('.editor-page__tools-area').waitFor();
	await offCanvas(p);
	await settle(600, p);
};
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

/** What the Simple screen says and shows, read with Chrome's own visibility */
const screen = (p = page) =>
	p.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const coach = document.querySelector('anyink-coach');
		const coachButton = coach?.querySelector('.anyink-coach__button');
		const tip = coach?.querySelector('.anyink-coach__tip');
		const overlay = document.querySelector('[data-anyink-overlay]');
		return {
			rail: text(document.querySelector('[data-anyink-step="letters"]')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			coachButton: shown(coachButton) ? text(coachButton) : null,
			tip: shown(tip) ? text(tip.querySelector('.anyink-coach__tip-text')) : null,
			overlay: shown(overlay) ? text(overlay) : null,
			overlayActions: shown(overlay)
				? [...overlay.querySelectorAll('[data-anyink-overlay-action]')].map(
						(el) => el.dataset.anyinkOverlayAction
				  )
				: [],
			greens: [...document.querySelectorAll('.anyink-primary, fancy-button.anyink-primary')]
				.filter(shown)
				.map((el) => ({
					text: text(el),
					where: el.closest('anyink-coach')
						? 'next line'
						: el.closest('[data-anyink-overlay]')
						? 'overlay'
						: el.closest('[data-anyink-photo-card]')
						? 'photo card'
						: el.closest('[data-anyink-dialog]')
						? el.closest('[data-anyink-dialog]').dataset.anyinkDialog
						: el.closest('#error')
						? 'error box'
						: el.closest('.anyink-letter-card')
						? 'card'
						: 'other',
				})),
			card: [...document.querySelectorAll('.anyink-letter-card > [data-anyink-card]')].map(
				(el) => el.dataset.anyinkCard
			),
			cardState: document.querySelector('.anyink-letter-card')?.dataset.anyinkCardState || null,
			toast: text(document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__text')),
		};
	});

/** The banned-word scan in the real page (real CSS), strict: visible text, tooltips, case */
const scanSimple = (selector = 'body', p = page) =>
	p.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);

const editorFacts = (p = page) =>
	p.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { isOpeningBrush } = await import('/anyink/nib/default_tool.js');
		const item = editor.selectedItem;
		const coords = (item?.shapes || []).flatMap((shape) =>
			shape.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y, pp.h1.x, pp.h1.y, pp.h2.x, pp.h2.y])
		);
		return {
			tool: editor.selectedTool,
			openingBrush: isOpeningBrush(editor),
			steps: editor.history.queue.length,
			titles: editor.history.queue.slice(0, 12).map((entry) => entry.title),
			shapes: item?.shapes?.length ?? 0,
			strokeIds: (item?.shapes || []).map((shape) => shape.anyink?.strokeId ?? null),
			whole: coords.every((n) => Number.isInteger(n)) && Number.isInteger(item?.advanceWidth),
			width: item?.advanceWidth,
			spacing: item?.anyink?.spacing,
		};
	});

/** Font units to page pixels on the open letter (the view as it is now) */
const at = (ux, uy) =>
	page.evaluate(
		async ([x, y]) => {
			const view = (await import('/app/main.js')).getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const box = (host.shadowRoot || host).querySelector('canvas').getBoundingClientRect();
			return { x: box.left + view.dx + x * view.dz, y: box.top + view.dy - y * view.dz };
		},
		[ux, uy]
	);
/** Is the canvas pixel at these font units ink (dark) or paper? */
const inkAt = async (ux, uy) => {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.multiSelect.points.clear();
		editor.multiSelect.shapes.clear();
		editor.editCanvas.redraw();
	});
	await settle(150);
	return page.evaluate(
		async ([x, y]) => {
			const view = (await import('/app/main.js')).getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const canvas = (host.shadowRoot || host).querySelector('canvas');
			const box = canvas.getBoundingClientRect();
			const scale = canvas.width / box.width;
			const [r, g, b, a] = canvas
				.getContext('2d')
				.getImageData(Math.round((view.dx + x * view.dz) * scale), Math.round((view.dy - y * view.dz) * scale), 1, 1).data;
			return a > 128 && (r + g + b) / 3 < 128;
		},
		[ux, uy]
	);
};
/** A real mouse drag along font-unit points: the Brush's pointer events, as a hand draws */
const drag = async (points) => {
	const pagePoints = [];
	for (const [x, y] of points) pagePoints.push(await at(x, y));
	const [first, ...rest] = pagePoints;
	await page.mouse.move(first.x, first.y);
	await page.mouse.down();
	for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 2 });
	const last = pagePoints.at(-1);
	for (let i = 0; i < 8; i++) {
		await page.mouse.move(last.x + (i % 2), last.y);
		await settle(20);
	}
	await page.mouse.up();
	await offCanvas();
	await settle(500);
};
const circle = (cx, cy, r, from = 0, to = 360, step = 10) => {
	const points = [];
	for (let a = from; a <= to; a += step) {
		const t = (a * Math.PI) / 180;
		points.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
	}
	return points;
};

/** Pixels that differ between two screenshots inside the given boxes, counted in Chrome */
const pixelDiff = async (a, b, boxes) => {
	const p = await freshPage('diff');
	const data = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
	const result = await p.evaluate(
		async ([one, two, areas]) => {
			const load = (url) =>
				new Promise((done) => {
					const img = new Image();
					img.onload = () => done(img);
					img.src = url;
				});
			const [i1, i2] = await Promise.all([load(one), load(two)]);
			if (i1.width !== i2.width || i1.height !== i2.height) return { size: false, differ: -1 };
			const read = (img) => {
				const c = document.createElement('canvas');
				c.width = img.width;
				c.height = img.height;
				const ctx = c.getContext('2d');
				ctx.drawImage(img, 0, 0);
				return ctx.getImageData(0, 0, img.width, img.height).data;
			};
			const d1 = read(i1);
			const d2 = read(i2);
			let differ = 0;
			let total = 0;
			for (const box of areas) {
				for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(i1.height, Math.ceil(box.y + box.height)); y++) {
					for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(i1.width, Math.ceil(box.x + box.width)); x++) {
						const i = (y * i1.width + x) * 4;
						total++;
						if (d1[i] !== d2[i] || d1[i + 1] !== d2[i + 1] || d1[i + 2] !== d2[i + 2]) differ++;
					}
				}
			}
			return { size: true, differ, total };
		},
		[data(a), data(b), boxes]
	);
	await p.context().close();
	return result;
};

try {
	// ----------------------------------------------------------
	// A. The Brush in Simple
	// ----------------------------------------------------------
	page = await freshPage('brush');
	await newFont(page, after.origin, 'Brennan Hand', '?ui=simple');
	const flags = await page.evaluate(async () => {
		const { isFeatureOn } = await import('/anyink/mode/features.js');
		const { getMode } = await import('/anyink/mode/mode.js');
		return { mode: getMode(), brush: isFeatureOn('brush'), photo: isFeatureOn('photo') };
	});
	assert.deepEqual(flags, { mode: 'simple', brush: true, photo: true });
	await openLetter(page, ID('o'));
	let s = await screen();
	let e = await editorFacts();
	assert.equal(e.tool, 'nib', 'an empty letter opens with the Brush');
	assert.equal(e.openingBrush, true);
	assert.deepEqual(s.overlayActions, ['usePhoto', 'drawBrush']);
	assert.deepEqual(s.greens, [{ text: 'Use a photo', where: 'overlay' }]);
	assert.equal(s.sentence, 'small o is empty. Use a photo of it, or draw it with the brush.');
	assert.equal(s.coachButton, null);
	assert.deepEqual(await scanSimple(), []);
	await shot('A1-empty-letter-opening-brush');
	pass(`A1 an empty small o opens with the Brush picked; the overlay offers ${JSON.stringify(s.overlayActions)} with [Use a photo] the one green button; Next line "${s.sentence}" (no button); 0 banned words (strict)`);

	// a closed loop, drawn left of the overlay box with the Brush the letter opened with
	const upm = await page.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().project.settings.font.upm);
	const k = upm / 1000;
	const stepsBefore = e.steps;
	await drag(circle(260 * k, 260 * k, 190 * k, 90, 450, 8));
	e = await editorFacts();
	s = await screen();
	assert.equal(e.steps - stepsBefore, 1, `one stroke, one step: ${JSON.stringify(e.titles)}`);
	assert.equal(e.titles[0], 'drew a stroke on small o');
	assert.equal(e.shapes, 2, 'a closed loop is its ink and its hole');
	assert.deepEqual(e.strokeIds, [1, 1]);
	assert.equal(e.whole, true, 'every point and the width are whole numbers');
	assert.equal(e.spacing, 'auto');
	assert.equal(s.cardState, 'ready');
	assert.equal(s.overlay, null);
	const ring = await page.evaluate(async () => {
		const item = (await import('/app/main.js')).getCurrentProjectEditor().selectedItem;
		const m = item.shapes.map((shape) => {
			const x = shape.maxes;
			return { xMin: x.xMin, xMax: x.xMax, yMin: x.yMin, yMax: x.yMax };
		});
		const outer = m.reduce((a, b) => (a.xMax - a.xMin > b.xMax - b.xMin ? a : b));
		const inner = m.find((x) => x !== outer);
		return { outer, inner };
	});
	const mid = [(ring.inner.xMin + ring.inner.xMax) / 2, (ring.inner.yMin + ring.inner.yMax) / 2];
	assert.equal(await inkAt(...mid), false, 'the middle of the o is paper');
	assert.equal(await inkAt((ring.outer.xMin + ring.inner.xMin) / 2, mid[1]), true, 'the ring is ink');
	await shot('A2-closed-loop-keeps-its-hole');
	pass(`A2 a closed loop drawn with a real drag: one step "${e.titles[0]}", 2 shapes (ink and hole, stroke ${e.strokeIds[0]}), paper in the middle, whole numbers, spacing automatic (width ${e.width}), small o Ready`);

	// a second stroke: its own step and its own shape
	await drag([[520 * k, 40 * k], [540 * k, 300 * k], [560 * k, 520 * k]]);
	e = await editorFacts();
	assert.equal(e.steps - stepsBefore, 2);
	assert.deepEqual(e.strokeIds, [1, 1, 2]);
	const mergeable = await page.evaluate(async () => {
		const { letterCardState } = await import('/anyink/letter/letter_card.js');
		return letterCardState().mergeable;
	});
	assert.equal(mergeable, 0, 'brush strokes are never merged');
	await page.keyboard.press('Control+z');
	await settle(400);
	e = await editorFacts();
	s = await screen();
	assert.deepEqual(e.strokeIds, [1, 1]);
	assert.equal(s.toast, 'Undid: drew a stroke on small o');
	await shot('A3-undo-one-stroke');
	await page.keyboard.press('Control+z');
	await settle(400);
	assert.equal((await editorFacts()).shapes, 0);
	await page.keyboard.press('Control+y');
	await settle(400);
	e = await editorFacts();
	assert.deepEqual(e.strokeIds, [1, 1]);
	pass(`A3 a second stroke is its own shape (strokes ${JSON.stringify([1, 1, 2])}, nothing to merge); Ctrl+Z takes one stroke at a time ("${s.toast}"), Ctrl+Y brings it back, still tagged`);

	// [Draw with the brush] on another empty letter
	await openLetter(page, ID('c'));
	await page.locator('[data-anyink-overlay-action="drawBrush"]').click();
	await offCanvas();
	await settle(500);
	s = await screen();
	e = await editorFacts();
	assert.equal(e.tool, 'nib');
	assert.equal(e.openingBrush, false);
	assert.equal(s.overlay, null);
	assert.equal(s.sentence, 'Drag on the paper to draw. Each drag is one stroke.');
	assert.equal(s.coachButton, null);
	assert.deepEqual(s.greens, [], 'D-037: a drawing tool on an empty letter, before its first mark');
	assert.deepEqual(s.card, ['header', 'brush']);
	assert.deepEqual(await scanSimple(), []);
	await shot('A4-draw-with-the-brush');
	pass(`A4 [Draw with the brush]: the overlay goes, Next line "${s.sentence}", tip "${s.tip}", card ${JSON.stringify(s.card)} (Size: thin --o-- thick), no green button; 0 banned words`);
	await page.context().close();

	// ----------------------------------------------------------
	// B. The photo walk: the loose B r e n a H d photo
	// ----------------------------------------------------------
	page = await freshPage('photo walk');
	await newFont(page, after.origin, 'Brennan Hand', '?ui=simple');
	const key = await page.evaluate(async (base) => (await fetch(`${base}/brenna-loose-phone.json`)).json(), FIXTURES);
	s = await screen();
	assert.equal(s.sentence, 'First, write your letters on paper and take one photo of the page.');
	assert.equal(s.coachButton, 'How');
	await page.locator('anyink-coach .anyink-coach__button').click();
	await page.locator('[data-anyink-dialog="howCard"]').waitFor();
	await settle(300);
	s = await screen();
	const howText = await page.locator('[data-anyink-dialog="howCard"]').innerText();
	assert.match(howText, /B r e n a H d/);
	assert.deepEqual(s.greens, [{ text: 'I have my photo', where: 'howCard' }]);
	assert.equal(s.sentence, '', 'rule 1: the line steps aside for the How card');
	assert.deepEqual(await scanSimple(), []);
	await shot('B1-how-card');
	await page.evaluate((base) => {
		window.__b89Next = { url: `${base}/brenna-loose-phone.jpg`, name: 'IMG_2041.jpg', type: 'image/jpeg' };
	}, FIXTURES);
	await page.locator('[data-anyink-how-action="havePhoto"]').click();
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
	await settle(500);
	const picks = await page.evaluate(() => window.__b89Picks);
	assert.equal(picks.length, 1);
	assert.equal(picks[0].startIn, 'downloads');
	assert.equal(await page.locator('[data-anyink-dialog="howCard"]').count(), 0);
	pass(`B1 Next line [How] -> the How card (asks for "B r e n a H d"; [I have my photo] the one green button) -> the picker, in Downloads -> the photo dialog`);

	const walk = [];
	let firstStepC = true;
	for (let n = 0; n < 7; n++) {
		const dialogInfo = await page.evaluate(async () => {
			const dialog = document.querySelector('[data-anyink-dialog="photoDialog"]');
			const picked = dialog.querySelector('[data-anyink-picked]')?.getAttribute('data-anyink-part');
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { getPhoto } = await import('/anyink/photo/photo_registry.js');
			const asset = Object.keys(editor.project.settings.anyink.photos)[0];
			const record = getPhoto(editor.project, asset);
			const part = record.parts.find((p) => p.id === picked);
			return {
				mode: dialog.getAttribute('data-anyink-photo-dialog'),
				parts: dialog.querySelectorAll('[data-anyink-part]').length,
				picked,
				part,
				tags: [...dialog.querySelectorAll('.anyink-photo-dialog__tag, [data-anyink-used]')].map((el) => el.textContent.trim()),
			};
		});
		const letter = key.letters.find(
			(l) => l.center[0] >= dialogInfo.part.left && l.center[0] < dialogInfo.part.right && l.center[1] >= dialogInfo.part.top && l.center[1] < dialogInfo.part.bottom
		);
		assert.ok(letter, `the green box holds a letter of the key: ${JSON.stringify(dialogInfo.part)}`);
		if (n === 0) {
			await photoDrawn();
			assert.equal(dialogInfo.mode, 'unknown');
			assert.equal(dialogInfo.parts, 7);
			s = await screen();
			assert.deepEqual(s.greens.map((g) => g.where), ['photoDialog']);
			assert.deepEqual(await scanSimple(), []);
			await shot('B2-photo-dialog-green-box');
		}
		const field = page.locator('[data-anyink-photo-field]');
		await field.focus();
		await page.keyboard.press(letter.char);
		await settle(150);
		const thats = await page.locator('[data-anyink-photo-thats]').innerText();
		await page.locator('[data-anyink-photo-action="trace"]').click();
		await waitUntil(
			() =>
				page.evaluate(async () => {
					const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
					const editor = (await import('/app/main.js')).getCurrentProjectEditor();
					const flow = getFlow(editor);
					return !!flow && flow.status === 'ready';
				}),
			`step C for ${letter.char}`
		);
		await offCanvas();
		await settle(400);
		s = await screen();
		assert.deepEqual(s.greens, [{ text: 'Use it', where: 'photo card' }], `${letter.char}: one green at step C`);
		assert.equal(s.sentence, 'Look right? Press Use it. Wrong part? Press Draw a box.');
		assert.equal(s.coachButton, null);
		assert.ok(s.card.includes('photo'), `the photo card sits in the letter card: ${s.card}`);
		if (firstStepC) {
			firstStepC = false;
			// the green dashed traced outline over the photo, on the canvas
			const dashed = await page.evaluate(async () => {
				const { photoPreviewShapes } = await import('/anyink/photo/photo_flow_state.js');
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				return photoPreviewShapes(editor.selectedItem, editor)?.length || 0;
			});
			assert.ok(dashed > 0);
			await page.locator('[data-anyink-photo-card-action="adjust"]').click();
			await settle(300);
			const paper = await page.evaluate(() => ({
				photo: document.querySelector('[data-anyink-photo-card-action="paperPhoto"]')?.getAttribute('aria-pressed'),
				picked: document.querySelector('[data-anyink-photo-card-picked]')?.checkVisibility(),
			}));
			assert.deepEqual(paper, { photo: 'true', picked: true }, 'a phone photo: Phone photo, picked for you');
			assert.deepEqual(await scanSimple(), []);
			await shot('B3-step-c-look-right-adjust');
			await page.locator('[data-anyink-photo-card-action="adjust"]').click();
			await settle(200);
			pass(`B2 the dialog boxes the first part (7 parts, letter unknown); typed "${letter.char}" ("${thats}"), Trace it -> step C: the letter card holds the photo card, [Use it] the one green, Next line "${s.sentence}", the dashed outline on the canvas (${dashed} shapes); Adjust: Phone photo "picked for you"`);
		}
		await page.locator('[data-anyink-photo-card-action="useIt"]').click();
		await waitUntil(
			() =>
				page.evaluate(async () => {
					const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
					return !getFlow((await import('/app/main.js')).getCurrentProjectEditor());
				}),
			`Use it for ${letter.char}`
		);
		await settle(300);
		s = await screen();
		walk.push({ char: letter.char, thats, toast: s.toast });
		if (n === 1) await shot('B4-second-letter-resizes-the-first');
		if (n < 6) {
			// rule 12; the unsaved-work rule (10) comes first until B13 picks the work file at
			// Create, so "Something else" moves on to it
			for (let guard = 0; guard < 4 && !/more letter/.test(s.sentence || ''); guard++) {
				await page.locator('anyink-coach .anyink-coach__else').click();
				await settle(250);
				s = await screen();
			}
			assert.match(s.sentence, new RegExp(`This photo has ${6 - n} more letter`));
			assert.equal(s.coachButton, 'Do the next one');
			if (n === 0) await shot('B5-rule-12-do-the-next-one');
			await page.locator('anyink-coach .anyink-coach__button').click();
			await page.locator('[data-anyink-dialog="photoDialog"]').waitFor();
			await settle(300);
		}
	}
	const result = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { hasInk } = await import('/anyink/board/letter_set.js');
		const { inkBounds } = await import('/anyink/spacing/measure.js');
		const font = editor.project.settings.font;
		const box = font.ascent - font.descent;
		const letters = [...'BrenaHd'].map((char) => {
			const item = editor.project.getItem(`glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`);
			const ink = inkBounds(item);
			const coords = item.shapes.flatMap((s) => s.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y, pp.h1.x, pp.h1.y, pp.h2.x, pp.h2.y]));
			return {
				char,
				ready: hasInk(item),
				width: item.advanceWidth,
				bottom: Math.round(ink.yMin),
				offLine: Math.abs(ink.yMin) / box,
				whole: coords.every(Number.isInteger) && Number.isInteger(item.advanceWidth),
				spacing: item.anyink.spacing,
				photo: item.anyink.trace?.locked === true && item.anyink.trace?.opacity === 0.25,
			};
		});
		return {
			letters,
			// the Undo list as presses: a whole-font step once, a step's parts (B3 refits) once
			titles: editor.history.queue
				.filter(
					(entry, i, queue) =>
						entry.title !== '_whole_project_change_post_state_' &&
						!(entry.step && i > 0 && queue[i - 1].step === entry.step)
				)
				.map((entry) => entry.title),
			rail: document.querySelector('[data-anyink-step="letters"]')?.textContent.replace(/\s+/g, ' ').trim(),
		};
	});
	result.letters.forEach((l) => {
		assert.equal(l.ready, true, `${l.char} Ready`);
		assert.ok(l.width > 0, `${l.char} width`);
		assert.ok(l.offLine <= 0.02, `${l.char} sits on the writing line (${l.bottom})`);
		assert.equal(l.whole, true, `${l.char} whole numbers`);
		assert.equal(l.spacing, 'auto');
		assert.equal(l.photo, true, `${l.char}: the photo faded and locked`);
	});
	const traced = result.titles.filter((t) => t.startsWith('traced '));
	assert.equal(traced.length, 7, JSON.stringify(result.titles));
	assert.match(result.rail, /7\/58/);
	assert.deepEqual(await scanSimple(), []);
	await shot('B6-seven-letters-ready');
	const resized = walk.filter((w) => /Also (resized|moved)/.test(w.toast || ''));
	pass(`B3 the walk: ${walk.map((w) => `${w.char} (${w.thats})`).join(', ')}; seven letters Ready (rail "${result.rail}"), bottoms ${JSON.stringify(result.letters.map((l) => l.bottom))} (all within 2 % of the letter box of the writing line), widths ${JSON.stringify(result.letters.map((l) => l.width))}, whole numbers, spacing automatic, photos faded and locked; 7 Undo steps "traced ..."; ${resized.length} toasts named followers (e.g. "${resized[0]?.toast || '-'}")`);

	// "Brennan Hand" in the strip, and in the real font (the exporter's own build)
	const strip = await page.evaluate(() => {
		const strip = document.querySelector('preview-strip');
		const input = strip?.querySelector('input[type="text"], input:not([type])');
		const box = strip?.getBoundingClientRect();
		return { text: input?.value, box: box && { x: box.x, y: box.y, width: box.width, height: box.height } };
	});
	assert.equal(strip.text, 'Brennan Hand');
	await shot('B7-strip-brennan-hand', { x: 0, y: Math.round(strip.box.y), width: 1600, height: Math.round(strip.box.height) });
	const real = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { FontPreviewBuilder } = await import('/controls/font-preview/font_preview.js');
		const text = 'Brennan Hand';
		const buffer = new FontPreviewBuilder(editor.project).buildFontBuffer(text);
		const face = new FontFace('B89Real', buffer);
		await face.load();
		document.fonts.add(face);
		const px = 200;
		const W = 1500;
		const H = 420;
		const baseline = 300;
		const left = 30;
		const canvas = document.createElement('canvas');
		canvas.width = W;
		canvas.height = H;
		Object.assign(canvas.style, { position: 'fixed', left: '50px', top: '120px', zIndex: 99999, background: 'white', border: '1px solid #888' });
		canvas.id = 'b89-real-font';
		document.body.appendChild(canvas);
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, W, H);
		ctx.font = `${px}px B89Real`;
		ctx.fillStyle = 'black';
		ctx.fillText(text, left, baseline);
		ctx.strokeStyle = 'rgb(124, 58, 237)';
		ctx.beginPath();
		ctx.moveTo(0, baseline + 0.5);
		ctx.lineTo(W, baseline + 0.5);
		ctx.stroke();
		// each letter alone, where the font puts it (its pen position in the text), so slanted
		// letters are told apart row by row, not by their shadow on the line
		const work = document.createElement('canvas');
		work.width = W;
		work.height = H;
		const w = work.getContext('2d', { willReadFrequently: true });
		w.font = `${px}px B89Real`;
		const letters = [];
		[...text].forEach((char, i) => {
			if (char === ' ') return;
			const x = left + w.measureText(text.slice(0, i)).width;
			w.fillStyle = 'white';
			w.fillRect(0, 0, W, H);
			w.fillStyle = 'black';
			w.fillText(char, x, baseline);
			const data = w.getImageData(0, 0, W, H).data;
			const rows = new Map();
			let bottom = -1;
			for (let y = 0; y < H; y++) {
				for (let xx = 0; xx < W; xx++) {
					const k = (y * W + xx) * 4;
					if (data[k] < 128) {
						const row = rows.get(y) || [Infinity, -Infinity];
						row[0] = Math.min(row[0], xx);
						row[1] = Math.max(row[1], xx);
						rows.set(y, row);
						bottom = Math.max(bottom, y);
					}
				}
			}
			letters.push({ char, word: text.slice(0, i).includes(' ') ? 1 : 0, rows, bottom });
		});
		// between neighbours in a word: the narrowest paper along any row both have ink on, and
		// the median of those rows (how far apart they look)
		const pairs = [];
		for (let i = 1; i < letters.length; i++) {
			const a = letters[i - 1];
			const b = letters[i];
			if (a.word !== b.word) continue;
			const gaps = [];
			for (const [y, [, aRight]] of a.rows) {
				const row = b.rows.get(y);
				if (row) gaps.push(row[0] - aRight - 1);
			}
			gaps.sort((m, n) => m - n);
			pairs.push({ pair: a.char + b.char, min: gaps[0], median: gaps[Math.floor(gaps.length / 2)] });
		}
		return { pairs, bottoms: letters.map((l) => [l.char, l.bottom]), px, baseline, count: letters.length };
	});
	await shot('B8-real-font-brennan-hand', { x: 50, y: 120, width: 1502, height: 422 });
	await page.evaluate(() => document.querySelector('#b89-real-font')?.remove());
	// 11 letters; no two neighbours touch on any row; the gaps look alike; one writing line
	assert.equal(real.count, 11);
	real.pairs.forEach((p) => assert.ok(p.min > 0, `${p.pair} touch: ${JSON.stringify(p)}`));
	// evenly spaced: each pair's closest approach (an r's open side makes its row median wide, so
	// the closest approach is the measure a reader's eye takes)
	const closest = real.pairs.map((p) => p.min);
	assert.ok(Math.max(...closest) <= 3 * Math.min(...closest), `uneven gaps: ${JSON.stringify(real.pairs)}`);
	const offLine = real.bottoms.map(([char, bottom]) => [char, Math.abs(bottom + 1 - real.baseline)]);
	offLine.forEach(([char, off]) => assert.ok(off <= 0.02 * real.px * 2, `${char} off the line by ${off} px`));
	pass(`B4 "Brennan Hand" in the strip; the real font (the exporter's own build, ${real.px} px): 11 letters, no neighbours touching on any row, closest approach ${Math.min(...closest)}..${Math.max(...closest)} px (${real.pairs.map((p) => `${p.pair} ${p.min}`).join(', ')}), every bottom within ${Math.max(...offLine.map(([, o]) => o))} px of one writing line`);

	// ----------------------------------------------------------
	// C. A phone-like whole-alphabet photo for small z (step A), and an iPhone HEIC photo
	// ----------------------------------------------------------
	const zKey = await page.evaluate(async (base) => (await fetch(`${base}/alphabet-loose-phone.json`)).json(), FIXTURES);
	await openLetter(page, ID('z'));
	s = await screen();
	assert.deepEqual(s.overlayActions, ['usePhoto', 'drawBrush'], 'the loose photo has no part left');
	await page.locator('[data-anyink-overlay-action="usePhoto"]').click();
	await settle(400);
	s = await screen();
	assert.equal(s.overlay, null);
	assert.deepEqual(s.greens, [{ text: 'Choose a photo...', where: 'photo card' }]);
	assert.equal(s.sentence, 'Choose the photo that has your small z on it.');
	const stepASentence = s.sentence;
	assert.deepEqual(await scanSimple(), []);
	await shot('C1-step-a-photo-card');
	await page.evaluate((base) => {
		window.__b89Next = { url: `${base}/alphabet-loose-phone.jpg`, name: 'IMG_2077.jpg', type: 'image/jpeg' };
	}, FIXTURES);
	await page.locator('[data-anyink-photo-card-action="choose"]').click();
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
	await settle(500);
	const zDialog = await page.evaluate(() => {
		const dialog = document.querySelector('[data-anyink-dialog="photoDialog"]');
		return {
			mode: dialog.getAttribute('data-anyink-photo-dialog'),
			title: dialog.querySelector('h2')?.textContent.trim(),
			parts: dialog.querySelectorAll('[data-anyink-part]').length,
		};
	});
	assert.equal(zDialog.mode, 'known');
	assert.equal(zDialog.title, 'Which part is your small z?');
	assert.equal(zDialog.parts, 58);
	// he clicks his z in the photo
	const z = zKey.letters.find((l) => l.char === 'z');
	const zPart = await page.evaluate(async (center) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getPhoto, listPhotos } = await import('/anyink/photo/photo_registry.js');
		const record = listPhotos(editor.project)[0];
		return getPhoto(editor.project, record.asset).parts.find(
			(p) => center[0] >= p.left && center[0] < p.right && center[1] >= p.top && center[1] < p.bottom
		)?.id;
	}, z.center);
	// the dialog opens close up on a whole page (B9 photo-ui fix): bring the part into view first
	await page.locator(`[data-anyink-dialog="photoDialog"] [data-anyink-part="${zPart}"]`).scrollIntoViewIfNeeded();
	const zBox = await page.locator(`[data-anyink-dialog="photoDialog"] [data-anyink-part="${zPart}"]`).boundingBox();
	await page.mouse.click(zBox.x + zBox.width / 2, zBox.y + zBox.height / 2);
	await settle(300);
	assert.equal(
		await page.evaluate(() => document.querySelector('[data-anyink-dialog="photoDialog"] [data-anyink-picked]')?.getAttribute('data-anyink-part')),
		zPart
	);
	await photoDrawn();
	s = await screen();
	assert.deepEqual(s.greens, [{ text: 'Trace it', where: 'photoDialog' }], 'the card behind gives its green up');
	assert.deepEqual(await scanSimple(), []);
	await shot('C2-alphabet-photo-small-z-known');
	await page.locator('[data-anyink-photo-action="trace"]').click();
	await waitUntil(
		() =>
			page.evaluate(async () => {
				const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
				return getFlow((await import('/app/main.js')).getCurrentProjectEditor())?.status === 'ready';
			}),
		'step C for z'
	);
	const zPaper = await page.evaluate(async () => {
		const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
		const flow = getFlow((await import('/app/main.js')).getCurrentProjectEditor());
		return { paper: flow.options.paper, picked: flow.options.paperPicked };
	});
	assert.deepEqual(zPaper, { paper: 'photo', picked: true });
	await page.locator('[data-anyink-photo-card-action="useIt"]').click();
	await settle(800);
	e = await editorFacts();
	assert.equal(e.titles[0], 'traced small z');
	pass(`C1 small z from step A ([Use a photo] -> "${stepASentence}" -> Choose a photo...): the whole-alphabet phone photo, ${zDialog.parts} parts, "${zDialog.title}", his click on z picks it; Phone photo picked for him; "${e.titles[0]}"`);

	// Fine-tune > Tail on a g traced from the same photo: [No tail] re-seats it in one step
	await openLetter(page, ID('g'));
	await page.locator('[data-anyink-overlay-action="useSamePhoto"]').click();
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
	await photoDrawn();
	const gCenter = zKey.letters.find((l) => l.char === 'g').center;
	const gPart = await page.evaluate(async (center) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getPhoto, listPhotos } = await import('/anyink/photo/photo_registry.js');
		const record = listPhotos(editor.project)[0];
		return getPhoto(editor.project, record.asset).parts.find(
			(p) => center[0] >= p.left && center[0] < p.right && center[1] >= p.top && center[1] < p.bottom
		)?.id;
	}, gCenter);
	await page.locator(`[data-anyink-dialog="photoDialog"] [data-anyink-part="${gPart}"]`).scrollIntoViewIfNeeded();
	const gBox = await page.locator(`[data-anyink-dialog="photoDialog"] [data-anyink-part="${gPart}"]`).boundingBox();
	await page.mouse.click(gBox.x + gBox.width / 2, gBox.y + gBox.height / 2);
	await settle(200);
	await page.locator('[data-anyink-photo-action="trace"]').click();
	await waitUntil(
		() =>
			page.evaluate(async () => {
				const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
				return getFlow((await import('/app/main.js')).getCurrentProjectEditor())?.status === 'ready';
			}),
		'step C for g'
	);
	// step C on the letter already open: the opening Brush gave way to Select
	assert.equal((await editorFacts()).tool, 'resize', 'Select during step C');
	await page.locator('[data-anyink-photo-card-action="useIt"]').click();
	await settle(800);
	s = await screen();
	assert.deepEqual(s.card.slice(0, 2), ['header', 'main']);
	assert.deepEqual(
		await page.evaluate(() => [...document.querySelectorAll('[data-anyink-card="main"] button')].map((b) => b.textContent.trim())),
		['Trace again', 'Draw over it']
	);
	await page.locator('[data-anyink-toggle="fineTune"]').click();
	await offCanvas();
	await settle(400);
	const gInk = () =>
		page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { inkBounds } = await import('/anyink/spacing/measure.js');
			const font = editor.project.settings.font;
			return { yMin: Math.round(inkBounds(editor.selectedItem).yMin), box: font.ascent - font.descent };
		});
	const tailBefore = await gInk();
	const pressed = await page.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-tail]')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`)
	);
	assert.deepEqual(pressed, ['It has a tail:true', 'No tail:false']);
	assert.ok(tailBefore.yMin < -0.1 * tailBefore.box, `g hangs its tail: ${JSON.stringify(tailBefore)}`);
	await shot('C2b-tail-it-has-a-tail');
	await page.locator('[data-anyink-tail="none"]').click();
	await settle(800);
	const tailAfter = await gInk();
	assert.ok(Math.abs(tailAfter.yMin) <= 0.02 * tailAfter.box, `No tail sits it on the line: ${JSON.stringify(tailAfter)}`);
	e = await editorFacts();
	assert.equal(e.titles.find((t) => t !== '_whole_project_change_post_state_'), 'said small g has no tail');
	assert.deepEqual(await scanSimple(), []);
	await shot('C2c-tail-no-tail');
	await page.keyboard.press('Control+z');
	await settle(500);
	assert.equal((await gInk()).yMin, tailBefore.yMin, 'Undo puts the tail back below the line');
	s = await screen();
	pass(`C1b a g from [Use the same photo] (Select during step C; then [Trace again] [Draw over it]); Fine-tune > Tail: [It has a tail] pressed, ink to ${tailBefore.yMin}; [No tail] re-seats it (ink bottom ${tailAfter.yMin}, on the writing line) in one step "said small g has no tail"; Ctrl+Z puts it back ("${s.toast}")`);
	await page.locator('[data-anyink-toggle="fineTune"]').click();
	await settle(300);

	await openLetter(page, ID('y'));
	await page.locator('[data-anyink-overlay-action="useSamePhoto"]').waitFor();
	s = await screen();
	assert.deepEqual(s.overlayActions, ['useSamePhoto', 'chooseAnother', 'drawBrush']);
	assert.deepEqual(s.greens, [{ text: 'Use the same photo', where: 'overlay' }]);
	await shot('C3-use-the-same-photo');
	await page.locator('[data-anyink-overlay-action="chooseAnother"]').click();
	await settle(300);
	await page.evaluate(() => {
		// the first bytes of an iPhone HEIC photo (Chrome can't write one): its file box, brand heic
		const bytes = Uint8Array.from('\0\0\0\x18ftypheic\0\0\0\0mif1heic', (c) => c.charCodeAt(0));
		window.__b89Next = { url: URL.createObjectURL(new Blob([bytes])), name: 'IMG_4410.HEIC', type: '' };
	});
	const picksBefore = await page.evaluate(() => window.__b89Picks.length);
	await page.locator('[data-anyink-photo-card-action="choose"]').click();
	await page.locator('#error').waitFor({ timeout: 10000 });
	await settle(300);
	const heic = await page.evaluate(() => {
		const box = document.querySelector('#error');
		return {
			text: box.querySelector('.error__body p')?.textContent.replace(/\s+/g, ' ').trim(),
			buttons: [...box.querySelectorAll('[data-anyink-choice]')].map((b) => b.textContent.trim()),
		};
	});
	assert.equal(
		heic.text,
		"That's an iPhone HEIC photo, which Chrome can't open. Send it as a JPEG instead: on the iPhone, Settings > Camera > Formats > Most Compatible."
	);
	assert.deepEqual(heic.buttons, ['Choose another photo']);
	s = await screen();
	assert.deepEqual(s.greens.map((g) => g.where), ['error box']);
	assert.deepEqual(await scanSimple(), []);
	await shot('C4-heic-plain-words');
	await page.evaluate((base) => {
		window.__b89Next = { url: `${base}/single-j-phone.jpg`, name: 'IMG_2090.jpg', type: 'image/jpeg' };
	}, FIXTURES);
	await page.locator('#error [data-anyink-choice="photoFlow.button.chooseAnother"]').click();
	await settle(200);
	assert.equal(await page.evaluate(() => window.__b89Picks.length), picksBefore + 2, '[Choose another photo] opens the picker again');
	// a photo with one part, picked for a letter: straight to step C (4.4 step B)
	await waitUntil(
		() =>
			page.evaluate(async () => {
				const { getFlow } = await import('/anyink/photo/photo_flow_state.js');
				return getFlow((await import('/app/main.js')).getCurrentProjectEditor())?.status === 'ready';
			}),
		'step C for y from a one-part photo'
	);
	assert.equal(await page.locator('[data-anyink-dialog="photoDialog"]').count(), 0);
	await page.locator('[data-anyink-photo-card-action="cancel"]').click();
	await settle(400);
	s = await screen();
	assert.equal(s.cardState, 'empty');
	pass(`C2 an iPhone HEIC photo: "${heic.text}" [${heic.buttons[0]}] (the one green button); it opens the picker again; a one-part photo goes straight to step C, and Cancel leaves small y empty`);
	assert.deepEqual(errors, [], `page errors: ${JSON.stringify(errors)}`);
	await page.context().close();

	// ----------------------------------------------------------
	// D. All tools, before and after
	// ----------------------------------------------------------
	const allTools = async (origin, label) => {
		const p2 = await freshPage(label);
		await newFont(p2, origin, 'Brennan Hand');
		await openLetter(p2, ID('a'));
		await p2.mouse.move(5, 895);
		await settle(800, p2);
		const facts = await p2.evaluate(() => {
			const shown = (el) => !!el && el.checkVisibility();
			const titles = (sel) => [...document.querySelectorAll(sel)].filter(shown).map((el) => el.getAttribute('title'));
			const box = (el) => {
				const r = el.getBoundingClientRect();
				return { x: r.x, y: r.y, width: r.width, height: r.height };
			};
			return {
				simpleBar: !!document.querySelector('[data-anyink-topbar="simple"]'),
				coach: !!document.querySelector('anyink-coach'),
				letterCard: !!document.querySelector('.anyink-letter-card'),
				overlay: !!document.querySelector('[data-anyink-overlay]'),
				menus: [...document.querySelectorAll('#app__top-bar .menu-entry-point')].filter(shown).map((b) => b.textContent.trim()),
				nav: ['l1', 'l2', 'l3'].filter((l) => shown(document.querySelector(`#nav-button-${l}`))),
				tools: titles('.editor-page__tools-area button'),
				viewTools: titles('.editor-page__zoom-area button, .editor-page__zoom-area input'),
				panel: document.querySelector('#editor-page__panel')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 400),
				status: document.querySelector('#app__top-bar anyink-save-status')?.textContent.trim(),
				areas: {
					top: box(document.querySelector('#app__top-bar')),
					left: box(document.querySelector('.editor-page__left-area')),
					canvas: box(document.querySelector('.editor-page__edit-canvas-wrapper')),
					zoom: box(document.querySelector('.editor-page__zoom-area')),
				},
			};
		});
		const path = await shot(`D-${label}-all-tools-small-a`, null, p2);
		await p2.keyboard.press('b');
		await settle(200, p2);
		const bTool = await p2.evaluate(async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedTool);
		const errorsHere = errors.filter((line) => line.startsWith(label));
		await p2.context().close();
		return { facts, path, bTool, errorsHere };
	};
	const now = await allTools(after.origin, 'after');
	assert.deepEqual(
		[now.facts.simpleBar, now.facts.coach, now.facts.letterCard, now.facts.overlay],
		[false, false, false, false]
	);
	assert.deepEqual(now.errorsHere, []);
	assert.equal(now.bTool, 'nib');
	if (before) {
		const was = await allTools(before.origin, 'before');
		const { tools: toolsNow, areas: areasNow, ...restNow } = now.facts;
		const { tools: toolsWas, areas: areasWas, ...restWas } = was.facts;
		assert.deepEqual(restNow, restWas, 'All tools controls changed');
		const expected = [...toolsWas];
		// B10 + B11 integration: the last commit (B8 + B9) has the Brush already, as b67 allows
		if (!toolsWas.includes('Brush')) expected.splice(expected.indexOf('New path') + 1, 0, 'Brush');
		assert.deepEqual(toolsNow, expected, 'the tool column gains only the Brush, after New path');
		assert.deepEqual(areasNow, areasWas, 'the page areas moved');
		const diff = await pixelDiff(was.path, now.path, Object.values(areasNow));
		assert.equal(diff.size, true);
		assert.equal(diff.differ, 0, `All tools pixels differ outside the tool column: ${diff.differ} of ${diff.total}`);
		// before B8, B picked Edit points (7.6); the last commit has the Brush already
		assert.equal(was.bTool, toolsWas.includes('Brush') ? 'nib' : 'pathEdit');
		pass(`D All tools, before (last commit) and after: the same menus (${now.facts.menus.join(', ')}), panel and ${now.facts.viewTools.length} view tools; the tool column gains only "Brush" after "New path" (${toolsNow.length} tools); the same pixels outside the tool column (0 of ${diff.total} differ); B picks the Brush (was Edit points, 7.6)`);
	} else {
		pass(`D All tools today: ${now.facts.menus.join(', ')}; no Simple bar, Next line, card or overlay; B picks the Brush`);
	}
	assert.deepEqual(errors, [], `page errors: ${JSON.stringify(errors)}`);
	pass('no page errors and no console errors');
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
