// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 + B7 integration real-browser check (docs/UX-BEGINNER.md 4.0, 4.3, 4.11, 7.3, section 10 B6
// and B7), in the real app on Vite dev servers, Chrome with throwaway profiles, 1600 x 900, the
// feature flags as the app ships them ('coach', 'letterView', 'brush' and 'photo' on; B8 + B9
// finalize: this check ran with the Brush and photos forced off, a set of screens that no longer
// ships):
//   A. Simple (?ui=simple), a new font, small a: the Simple top bar, the Next line and the empty
//      overlay say what to do in plain words, one green button on screen (the overlay's [Use a
//      photo]), the whole page says no banned word (strict); an app notice sits in the bar's
//      gap, over no control
//   B. The Point pen, by its own key (P; the overlay offers the photo and the Brush now): it
//      draws a shape by plain clicks (each click one Undo
//      step, the pill says "Not saved yet"), closes it on its first point with the pointer moving
//      (no error), and a second shape drawn inside it becomes a hole (paper in its middle) with
//      "Made shape 2 a hole [Make it solid]"
//   C. Fine-tune: open, the purple edges show and take the pointer; closed, they are hidden and
//      never take it
//   D. Ctrl+Z: a named undo toast ("Undid: ..." [Redo]) takes the hole toast's place; its Redo
//      puts it back ("Redid: ...")
//   E. The status pill as he saves: Not saved yet [Save] -> Saved; a change -> Saving... ->
//      Saved; Couldn't save [Fix]; the leave warning agrees with each (4.11)
//   F. All tools, before and after: the last commit's src/ (git archive; B67_BEFORE=<src folder>
//      for another, B67_BEFORE=skip for none) and today's, each a new font with small a open:
//      the same controls and the same pixels, but for the Brush B8 added to the tool column
//      (tests/b89.verify.mjs D checks it)
// Usage: node tests/b67.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync, symlinkSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { formatHit, scanTexts } from '../src/anyink/words/banned.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b67'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-b67-'));

/** The last commit's src/, for the "before" screenshots: git archive into a temp folder. */
function exportHeadSrc() {
	const dir = resolve(scratch, 'head');
	execSync(`mkdir "${dir}"`, { shell: true, stdio: 'pipe' });
	// Windows' own tar (bsdtar): a Git Bash tar earlier on PATH reads "C:" as a remote host
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

const beforeSetting = process.env.B67_BEFORE || '';
const beforeRoot =
	beforeSetting === 'skip' ? null : beforeSetting ? resolve(beforeSetting) : exportHeadSrc();
const after = await serve(src, 'after');
const before = beforeRoot ? await serve(beforeRoot, 'before') : null;

const browser = await chromium.launch({ channel: process.env.B67_BROWSER || 'chrome', headless: true });
const errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shotList = [];
const settle = (ms = 350, p = page) => p.waitForTimeout(ms);

/** A fresh, empty profile (its own storage) with one page */
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

let page = await freshPage('simple');
const shot = async (name, clip, p = page) => {
	const path = resolve(shots, `${name}.png`);
	await p.screenshot({ path, ...(clip ? { clip } : {}) });
	shotList.push(`${name}.png`);
	return path;
};
const offCanvas = (p = page) => p.mouse.move(5, 895);
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};

const newFont = async (p, origin, name, search = '') => {
	await p.goto(`${origin}/${search}`);
	const field = p.locator('#input__new-project-name');
	await field.waitFor({ timeout: 30000 });
	await field.fill(name);
	await p.locator('#button__create-new-project').click();
	await field.waitFor({ state: 'detached' });
	await settle(500, p);
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

/** What the Simple screen says and shows, read with Chrome's own visibility */
const screen = () =>
	page.evaluate(() => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const bar = document.querySelector('#app__top-bar');
		const coach = document.querySelector('anyink-coach');
		const coachButton = coach?.querySelector('.anyink-coach__button');
		const overlay = document.querySelector('[data-anyink-overlay]');
		const pill = bar?.querySelector('[data-anyink-control="status"]');
		const pillButton = pill?.querySelector('button');
		return {
			bar: bar?.dataset.anyinkTopbar || null,
			rail: text(bar?.querySelector('[data-anyink-step="letters"]')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			coachButton: shown(coachButton) ? text(coachButton) : null,
			overlay: shown(overlay) ? text(overlay) : null,
			greens: [...document.querySelectorAll('.anyink-primary')]
				.filter(shown)
				.map((el) => ({
					text: text(el),
					where: el.closest('anyink-coach')
						? 'next line'
						: el.closest('[data-anyink-overlay]')
						? 'overlay'
						: el.closest('.anyink-letter-card')
						? 'card'
						: 'other',
				})),
			header: text(document.querySelector('.anyink-letter-header')),
			cardState: document.querySelector('.anyink-letter-card')?.dataset.anyinkCardState || null,
			pill: text(pill?.querySelector('anyink-save-status')),
			pillButton: shown(pillButton) ? text(pillButton) : null,
			undoTip: bar?.querySelector('[data-anyink-control="undo"]')?.title || null,
		};
	});

/** The banned-word scan in the real page (real CSS), strict: visible text, tooltips, case */
const scanSimple = (selector = 'body') =>
	page.evaluate(async (sel) => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector(sel);
		return [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit);
	}, selector);

const editorState = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { shapeRole } = await import('/anyink/letter/auto_hole.js');
		const { getSaveStatus } = await import('/anyink/files/save_status.js');
		const { hasInkNotInItsFile } = await import('/app/app.js');
		const item = editor.selectedItem;
		return {
			tool: editor.selectedTool,
			steps: editor.history.queue.length,
			titles: editor.history.queue.slice(0, 12).map((entry) => entry.title),
			shapes: item?.shapes?.length ?? 0,
			points: (item?.shapes || []).map((shape) => shape.pathPoints?.length ?? 0),
			roles: (item?.shapes || []).map((shape) => shapeRole(item, shape)),
			file: getSaveStatus(editor).file,
			warns: hasInkNotInItsFile(editor),
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
/** A real plain click on a screen point: press and release with the pointer still */
const clickAt = async (p) => {
	await page.mouse.move(p.x, p.y, { steps: 2 });
	await settle(60);
	await page.mouse.down();
	await page.mouse.up();
	await settle(250);
};
/** The same point, the pointer moving a little during the press (a closing click) */
const clickMoving = async (p) => {
	await page.mouse.move(p.x, p.y, { steps: 2 });
	await settle(60);
	await page.mouse.down();
	await page.mouse.move(p.x + 3, p.y + 2, { steps: 2 });
	await page.mouse.up();
	await offCanvas();
	await settle(400);
};
/** Where the canvas sits on the page: it must never move while he draws */
const canvasTop = () =>
	page.evaluate(() => {
		const host = document.querySelector('edit-canvas');
		return Math.round((host.shadowRoot || host).querySelector('canvas').getBoundingClientRect().top);
	});
/** Where a shape's point is on screen now (its ink stays under the pointer through refits) */
const pointOnScreen = async (shape, index) => {
	const [x, y] = await page.evaluate(
		async ([i, j]) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const point = editor.selectedItem.shapes[i].pathPoints[j].p;
			return [point.x, point.y];
		},
		[shape, index]
	);
	return at(x, y);
};
const boxOf = (index) =>
	page.evaluate(async (i) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const m = editor.selectedItem.shapes[i].maxes;
		return { xMin: m.xMin, xMax: m.xMax, yMin: m.yMin, yMax: m.yMax };
	}, index);
/** Is the canvas pixel at these font units ink (dark) or paper? Nothing picked, so no handles */
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
const toastNow = () =>
	page.evaluate(() => {
		const toast = document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
		return toast
			? {
					text: toast.querySelector('.anyink-toast__text')?.textContent.trim() ?? '',
					button: toast.querySelector('button')?.textContent.trim() ?? null,
			  }
			: null;
	});
const hoverLayer = () =>
	page.evaluate(async () => (await import('/anyink/metrics/state.js')).guidesLayerState.hover);
const fineTune = async (open) => {
	const now = await page.evaluate(
		async () => (await import('/anyink/letter/view_switches.js')).isFineTuneOpen()
	);
	if (now !== open) await page.locator('[data-anyink-toggle="fineTune"]').click();
	await offCanvas();
	await settle(400);
};

/** Pixels that differ between two screenshots, counted in Chrome */
const pixelDiff = async (a, b, boxes = null) => {
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
			const boxes = areas || [{ x: 0, y: 0, width: i1.width, height: i1.height }];
			for (const box of boxes) {
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
	// A. Simple, a new font, small a
	// ----------------------------------------------------------
	await newFont(page, after.origin, 'Brennan Hand', '?ui=simple');
	// the flags as the app ships them (B8 + B9 finalize: no flag is forced here any more)
	const flags = await page.evaluate(async () => {
		const { isFeatureOn } = await import('/anyink/mode/features.js');
		const { getMode } = await import('/anyink/mode/mode.js');
		return {
			mode: getMode(),
			coach: isFeatureOn('coach'),
			letterView: isFeatureOn('letterView'),
			brush: isFeatureOn('brush'),
			photo: isFeatureOn('photo'),
		};
	});
	assert.deepEqual(flags, { mode: 'simple', coach: true, letterView: true, brush: true, photo: true });
	await shot('A0-simple-new-font');
	await openLetter(page, 'glyph-0x61');
	let s = await screen();
	assert.equal(s.bar, 'simple');
	assert.match(s.rail, /^1 ?Letters ?0\/58/);
	assert.match(s.sentence, /^small a is empty\./);
	assert.equal(s.coachButton, null, 'rule 8: the Next line has no button (the overlay holds it)');
	assert.match(s.overlay, /^small a is empty\./);
	assert.equal(s.sentence, 'small a is empty. Use a photo of it, or draw it with the brush.');
	assert.deepEqual(s.greens, [{ text: 'Use a photo', where: 'overlay' }]);
	assert.match(s.header, /small a/);
	assert.equal(s.cardState, 'empty');
	assert.equal(s.pill, 'Not saved yet');
	assert.deepEqual(await scanSimple(), []);
	await shot('A1-simple-small-a-empty');
	await shot('A1b-top-bar-and-next-line', { x: 0, y: 0, width: 1600, height: 110 });
	pass(
		`Simple, new font, small a: bar "${s.rail}", Next line "${s.sentence}" (no button), overlay "${s.overlay}", one green button ${JSON.stringify(s.greens)}, pill "${s.pill}", 0 banned words (strict)`
	);

	// an app notice: inside the bar's gap, over no control (notice_place.js). The dev server has
	// no service worker, so the notice is asked for the way register.js asks (which also brings
	// in pwa.css)
	const notice = await page.evaluate(async () => {
		const { showAppNotice } = await import('/anyink/pwa/register.js');
		const { closeNotice } = await import('/anyink/pwa/notices.js');
		const { word } = await import('/anyink/words/words.js');
		showAppNotice({ key: 'b67-check', kind: 'info', message: word('notice.offlineReady'), waits: false });
		await new Promise((r) => setTimeout(r, 300));
		const box = (el) => el?.getBoundingClientRect();
		const n = box(document.querySelector('#anyink-pwa-notices .anyink-pwa-notice'));
		const controls = [...document.querySelectorAll('#app__top-bar [data-anyink-control], #app__top-bar [data-anyink-step]')]
			.filter((el) => el.checkVisibility())
			.map((el) => ({ id: el.dataset.anyinkControl || el.dataset.anyinkStep, b: box(el) }));
		const overlaps = controls
			.filter(({ b }) => n && b.left < n.right && n.left < b.right && b.top < n.bottom && n.top < b.bottom)
			.map(({ id }) => id);
		const result = { shown: !!n && n.width > 0, overlaps, left: n?.left, right: n?.right };
		window.__closeB67Notice = () => closeNotice('b67-check');
		return result;
	});
	await shot('A2-simple-notice-in-the-gap', { x: 0, y: 0, width: 1600, height: 110 });
	await page.evaluate(() => window.__closeB67Notice());
	assert.equal(notice.shown, true);
	assert.deepEqual(notice.overlaps, []);
	pass(`an app notice sits in the bar's gap (${Math.round(notice.left)}..${Math.round(notice.right)} px), over no control`);

	// ----------------------------------------------------------
	// B. The Point pen (its key, P): plain clicks, a closing click that moves, a hole inside
	// ----------------------------------------------------------
	await offCanvas();
	await page.keyboard.press('p');
	await offCanvas();
	await settle(400);
	let e = await editorState();
	assert.equal(e.tool, 'newPath');
	s = await screen();
	assert.equal(s.overlay, null, 'the overlay steps aside once a shape tool is picked');
	await shot('B0-point-pen-picked');
	// a hand: the screen points are chosen once, as he sees the page; automatic spacing may move
	// the ink in font units after a click, but the view moves with it, so the ink stays put
	const stepsBefore = e.steps;
	const top = await canvasTop();
	const corners = [await at(0, 0), await at(500, 0), await at(500, 600), await at(0, 600)];
	const greensWhileDrawing = [];
	for (const corner of corners) {
		await clickAt(corner);
		greensWhileDrawing.push((await screen()).greens.map((g) => g.text));
		assert.equal(await canvasTop(), top, 'the canvas moved under the pointer');
	}
	e = await editorState();
	assert.equal(e.steps - stepsBefore, 4, `four plain clicks, four steps: ${JSON.stringify(e.titles)}`);
	assert.equal((await screen()).pill, 'Not saved yet'); // no work file yet
	assert.equal(e.warns, true, 'ink only in memory: leaving warns');
	// while a shape is open its "Finish the shape" is the one green button; nothing judges it yet
	greensWhileDrawing.forEach((list) => assert.deepEqual(list, ['Finish the shape']));
	await shot('B1-drawing-finish-the-shape-is-green');
	const first = await pointOnScreen(0, 0);
	assert.ok(Math.abs(first.x - corners[0].x) < 1.5 && Math.abs(first.y - corners[0].y) < 1.5, 'the first point stayed under the pointer');
	await clickMoving(first);
	e = await editorState();
	assert.deepEqual(e.points, [4]);
	assert.equal(e.tool, 'pathEdit');
	assert.equal(await page.locator('#done-creating-path-button').count(), 0, '"Finish the shape" stays after the shape is closed');
	assert.deepEqual(errors, [], 'closing the shape with the pointer moving threw');
	pass(`the Point pen by plain clicks at fixed screen points: one step a point (${e.steps - stepsBefore} steps), the canvas never moved (top ${top} px), the ink stayed under the pointer, "Finish the shape" the one green button while drawing; closed on its first point with the pointer moving: no error, the button gone`);

	await page.locator('[data-anyink-tool="newPath"]').click();
	await offCanvas();
	await settle(250);
	const outer = await boxOf(0);
	const fx = (f) => outer.xMin + (outer.xMax - outer.xMin) * f;
	const fy = (f) => outer.yMin + (outer.yMax - outer.yMin) * f;
	const innerCorners = [await at(fx(0.3), fy(0.3)), await at(fx(0.7), fy(0.3)), await at(fx(0.7), fy(0.7)), await at(fx(0.3), fy(0.7))];
	for (const corner of innerCorners) await clickAt(corner);
	assert.equal(await canvasTop(), top, 'the canvas moved under the pointer');
	await clickMoving(await pointOnScreen(1, 0));
	e = await editorState();
	assert.deepEqual(e.roles, ['solid', 'hole']);
	const holeToast = await toastNow();
	assert.deepEqual(holeToast, { text: 'Made shape 2 a hole', button: 'Make it solid' });
	// the toast sits above the canvas's zoom bar and the view switches, covering neither
	const covered = await page.evaluate(() => {
		const toast = document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
		const t = toast.getBoundingClientRect();
		return [...document.querySelectorAll('.editor-page__zoom-area button, .editor-page__zoom-area input, .anyink-letter-switch')]
			.filter((el) => el.checkVisibility())
			.filter((el) => {
				const b = el.getBoundingClientRect();
				return b.left < t.right && t.left < b.right && b.top < t.bottom && t.top < b.bottom;
			})
			.map((el) => el.dataset.anyinkSwitch || el.title || el.className);
	});
	assert.deepEqual(covered, [], 'a toast covers the zoom bar or a switch');
	const inner = await boxOf(1);
	const mid = [(inner.xMin + inner.xMax) / 2, (inner.yMin + inner.yMax) / 2];
	assert.equal(await inkAt(...mid), false, 'the middle of the inner shape is paper');
	// the ring: between the outer shape's left side and the inner one's, where they are now
	const ring = await boxOf(0);
	assert.equal(await inkAt((ring.xMin + inner.xMin) / 2, mid[1]), true, 'the ring is ink');
	s = await screen();
	assert.deepEqual(s.greens.map((g) => g.where), ['next line'], `one green button: ${JSON.stringify(s.greens)}`);
	assert.equal(s.sentence, "Your work isn't saved yet.");
	assert.equal(s.coachButton, 'Save');
	assert.match(s.rail, /1\/58/);
	assert.deepEqual(await scanSimple(), []);
	await shot('B2-hole-inside-the-shape');
	pass(`a shape drawn inside is a hole: roles ${JSON.stringify(e.roles)}, paper in its middle, toast "${holeToast.text}" [${holeToast.button}]; one green button (the Next line's [${s.coachButton}]); rail "${s.rail}"`);

	// the font check, 2 s after the last change, finds nothing to say about the finished letter
	await settle(2600);
	s = await screen();
	assert.equal(s.sentence, "Your work isn't saved yet.", `the Next line after the check: ${s.sentence}`);

	// ----------------------------------------------------------
	// C. Fine-tune: the edges show and move only while it is open
	// ----------------------------------------------------------
	const advance = await page.evaluate(
		async () => (await import('/app/main.js')).getCurrentProjectEditor().selectedItem.advanceWidth
	);
	const edgePoint = async () => at(advance, 200);
	await page.locator('[data-anyink-tool="resize"]').click();
	await fineTune(true);
	let shown = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return (await import('/anyink/letter/edges.js')).edgesShown(editor.selectedItem);
	});
	assert.equal(shown, true);
	let p = await edgePoint();
	await page.mouse.move(p.x - 20, p.y, { steps: 3 });
	await page.mouse.move(p.x, p.y, { steps: 3 });
	await settle(250);
	assert.equal(await hoverLayer(), 'rsb', 'Fine-tune open: the right edge takes the pointer');
	const switches = await page.$$eval('.anyink-letter-switch', (list) =>
		list.filter((el) => el.checkVisibility()).map((el) => el.dataset.anyinkSwitch)
	);
	// Neighbors has nothing to show until his small n is made
	assert.deepEqual(switches, ['darkPaper', 'outlineOnly', 'guideLetter']);
	await shot('C1-fine-tune-open-edges');
	await fineTune(false);
	shown = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return (await import('/anyink/letter/edges.js')).edgesShown(editor.selectedItem);
	});
	assert.equal(shown, false);
	p = await edgePoint();
	await page.mouse.move(p.x - 20, p.y, { steps: 3 });
	await page.mouse.move(p.x, p.y, { steps: 3 });
	await settle(250);
	assert.equal(await hoverLayer(), false, 'Fine-tune closed: the hidden edge never takes the pointer');
	await shot('C2-fine-tune-closed-no-edges');
	await offCanvas();
	await fineTune(true);
	pass(`Fine-tune open: the purple edges show and the right edge takes the pointer, switches ${JSON.stringify(switches)} (no Neighbors before his n); closed: hidden, and the pointer passes through`);

	// ----------------------------------------------------------
	// D. Ctrl+Z: a named undo toast takes the hole toast's place
	// ----------------------------------------------------------
	await page.keyboard.press('Control+z');
	await settle(400);
	const undid = await toastNow();
	assert.ok(undid && /^Undid: /.test(undid.text), `undo toast: ${JSON.stringify(undid)}`);
	assert.equal(undid.button, 'Redo');
	s = await screen();
	await shot('D1-undo-toast');
	await page.locator('#toast[data-anyink-toast="simple"]:not([data-leaving]) button').click();
	await settle(400);
	const redid = await toastNow();
	assert.ok(redid && /^Redid: /.test(redid.text), `redo toast: ${JSON.stringify(redid)}`);
	assert.deepEqual(await scanSimple(), []);
	await shot('D2-redo-toast');
	pass(`Ctrl+Z: "${undid.text}" [${undid.button}] took the hole toast's place; its Redo: "${redid.text}"; Undo tooltip "${s.undoTip}"`);

	// ----------------------------------------------------------
	// E. The status pill as he saves, and the leave warning
	// ----------------------------------------------------------
	const seen = [];
	const watchPill = async (until, timeout = 20000) => {
		const end = Date.now() + timeout;
		while (Date.now() < end) {
			const now = (await screen()).pill;
			if (seen.at(-1) !== now) seen.push(now);
			if (now === until) return;
			await page.waitForTimeout(40);
		}
		throw new Error(`pill never said "${until}": ${JSON.stringify(seen)}`);
	};
	s = await screen();
	assert.deepEqual([s.pill, s.pillButton], ['Not saved yet', 'Save']);
	e = await editorState();
	assert.equal(e.warns, true);
	await shot('E1-pill-not-saved-yet', { x: 800, y: 0, width: 800, height: 110 });
	// the work file: a file in the browser's private file system, handed to the save picker
	await page.evaluate(async () => {
		const api = await import('/anyink/files/file_api.js');
		const folder = await navigator.storage.getDirectory();
		const handle = await folder.getFileHandle('Brennan Hand.gs2', { create: true });
		api.setFileApi({ ...api.getFileApi(), showSaveFilePicker: async () => handle });
	});
	await page.locator('#app__top-bar [data-anyink-control="status"] button').click();
	await watchPill('Saved');
	e = await editorState();
	assert.equal(e.warns, false, 'Saved: leaving does not warn');
	await shot('E2-pill-saved', { x: 800, y: 0, width: 800, height: 110 });
	// a change: Saving... while the write waits, then Saved again
	seen.length = 0;
	await page.locator('[data-anyink-shape-row="0"]').click().catch(() => {});
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.selectedItem.shapes[0].pathPoints[2].p.x += 20;
		editor.history.addState('Moved path point: 3');
		editor.publish('currentItem', editor.selectedItem);
	});
	await watchPill('Saving...');
	const savingWarns = (await editorState()).warns;
	await shot('E3-pill-saving', { x: 800, y: 0, width: 800, height: 110 });
	await watchPill('Saved');
	assert.equal(savingWarns, true, 'Saving...: leaving warns');
	// a write that failed: Couldn't save [Fix] (the status the autosave sets, stood in here)
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { setSaveStatus } = await import('/anyink/files/save_status.js');
		setSaveStatus(editor, { file: 'failed', error: 'NotAllowedError' });
	});
	await settle(300);
	s = await screen();
	assert.deepEqual([s.pill, s.pillButton], ["Couldn't save", 'Fix']);
	assert.equal((await editorState()).warns, true, "Couldn't save: leaving warns");
	await shot('E4-pill-couldnt-save', { x: 800, y: 0, width: 800, height: 110 });
	await page.locator('#app__top-bar [data-anyink-control="status"] button').click();
	await settle(400);
	const fixBox = await page.evaluate(() => document.querySelector('#error')?.innerText.replace(/\s+/g, ' ').trim());
	assert.match(fixBox, /Couldn't save to .*Brennan Hand.*A backup copy is kept\./);
	assert.deepEqual(await scanSimple(), []);
	await shot('E5-fix-box');
	pass(`the pill as he saves: ${JSON.stringify(['Not saved yet [Save]', ...seen])}, then "Couldn't save [Fix]" with its box; the leave warning agrees each time (warns unless Saved)`);
	assert.deepEqual(errors, [], 'page errors in Simple');
	pass('Simple: no page errors, no console errors');
	await page.context().close();

	// ----------------------------------------------------------
	// F. All tools, before and after: the same controls, the same pixels
	// ----------------------------------------------------------
	const allTools = async (origin, label) => {
		const p2 = await freshPage(label);
		await newFont(p2, origin, 'Brennan Hand');
		await openLetter(p2, 'glyph-0x61');
		await p2.mouse.move(5, 895);
		await settle(800, p2);
		const facts = await p2.evaluate(() => {
			const shown = (el) => !!el && el.checkVisibility();
			const titles = (sel) => [...document.querySelectorAll(sel)].filter(shown).map((el) => el.getAttribute('title'));
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
				// B8 + B9 finalize: the page areas outside the tool column (the Brush, B8, joined it)
				areas: Object.fromEntries(
					[
						['top', '#app__top-bar'],
						['left', '.editor-page__left-area'],
						['canvas', '.editor-page__edit-canvas-wrapper'],
						['zoom', '.editor-page__zoom-area'],
					].map(([name, selector]) => {
						const r = document.querySelector(selector)?.getBoundingClientRect();
						return [name, r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null];
					})
				),
			};
		});
		const path = await shot(`F-${label}-all-tools-small-a`, null, p2);
		const errorsHere = errors.filter((line) => line.startsWith(label));
		await p2.context().close();
		return { facts, path, errorsHere };
	};
	const now = await allTools(after.origin, 'after');
	assert.deepEqual(
		[now.facts.simpleBar, now.facts.coach, now.facts.letterCard, now.facts.overlay],
		[false, false, false, false]
	);
	assert.deepEqual(now.errorsHere, []);
	if (before) {
		const was = await allTools(before.origin, 'before');
		// B8 (D-038, 7.6): the tool column has the Brush after New path; everything else as it was
		const { tools: toolsNow, areas: areasNow, ...restNow } = now.facts;
		const { tools: toolsWas, areas: areasWas, ...restWas } = was.facts;
		assert.deepEqual(restNow, restWas, 'All tools controls changed');
		const expected = [...toolsWas];
		if (!toolsWas.includes('Brush')) expected.splice(expected.indexOf('New path') + 1, 0, 'Brush');
		assert.deepEqual(toolsNow, expected, 'the tool column changed beyond the Brush');
		assert.deepEqual(areasNow, areasWas, 'the page areas moved');
		const diff = await pixelDiff(was.path, now.path, Object.values(areasNow).filter(Boolean));
		assert.equal(diff.size, true);
		assert.equal(diff.differ, 0, `All tools pixels differ outside the tool column: ${diff.differ} of ${diff.total}`);
		pass(`All tools, before (last commit) and after: the same controls (${now.facts.menus.join(', ')}; ${toolsNow.length} tools, the Brush after New path as B8 added it; ${now.facts.viewTools.length} view tools) and the same pixels outside the tool column (0 of ${diff.total} differ)`);
	} else {
		pass(`All tools today: ${now.facts.menus.join(', ')}; no Simple bar, Next line, card or overlay`);
	}
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
