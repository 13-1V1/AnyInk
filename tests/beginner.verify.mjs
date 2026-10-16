// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16: the acceptance test's automated run (docs/UX-BEGINNER.md 9.4), run before every Gate 2
// attempt. The BUILT app (vite build of src/ with src/vite.config.js, served at /AnyInk/ as
// GitHub Pages serves it), Chrome with a throwaway context, 1600 x 900, Simple as it opens with no ?ui (B16; BEGINNER_SEARCH=?ui=simple pins it), the
// feature flags as the app ships them. Windows' boxes are stood in for (Chrome headless has none
// to press): the save box hands back "Documents\<suggested name>" and the folder box
// "Documents\My Fonts", both real folders in the browser's private file area. The photos are real
// drops of tests/fixtures/brenna-loose.jpg and brenna-tight.jpg.
//   The build carries one extra module, a probe (this script's build plugin, never in dist/):
//   window.__anyinkModules holds the app's own modules, the same instances the app runs, so
//   the asserts read the editor as the dev-server checks do (M('/app/main.js') where they
//   import('/app/main.js')).
//   T1  Make a new font called Brennan Hand: the start screen, Create my font; the board; the
//       work file Documents\Brennan Hand.gs2 exists and holds the font; status "Saved"
//   T2  The capital B from the photo: the loose photo dropped on the board opens the photo
//       dialog with one part per letter (7); B traced and Use it: Ready, body bottom within 2 %
//       of the letter box of the writing line, width > 0; one Undo brings back the empty B (no
//       shapes, photo kept); Redo
//   T3  The rest (r e n a H d): every letter Ready (a Needs a look fixed or "Looks fine to me");
//       whole-number widths and points; stroke weights within 15 % of their median, or no
//       further off than the photo itself shows (beginner_weight.mjs: the drawn pen wobbles), with
//       each letter's pen kept as written within 10 %; the photo
//       lines up under the ink after Use it, after a left-edge drag and after a letter-spacing
//       change
//   T4  A small o drawn with the Brush: ink, a width, Brush strokes, no photo
//   T5  Try it shows "Brennan Hand" in his letters, no neighbours overlapping (principle 5)
//   T6  The e|n gap made closer with the real handle: one gap fix, nothing else changed
//   T7  The top bar's Undo takes it away, Redo puts it back
//   T8  (the file part) Use in Word, Pick a folder, Make my font file: the .otf in the folder
//       loads; family "Brennan Hand Test 1"; every letter in "Brennan Hand" has width > 0;
//       letters with no shapes are absent; no overlap, one writing line
//   Tight photo: a new font, the tight photo dropped: 8 parts, the dotted i as one
//   Every screen state: exactly one visible green button (none with a drawing tool picked on an
//   empty letter before its first mark), zero banned words (strict) in visible text, zero
//   number inputs, nothing in capitals; at the end every canvas text and every toast scanned too
// Usage: node tests/beginner.verify.mjs [screenshot folder]
//   BEGINNER_DIST=<folder>  use a probe build made earlier (the folder this script printed)
//   BEGINNER_BROWSER=msedge  another Chrome channel
import { chromium } from '@playwright/test';
import { FontFlux } from 'font-flux-js';
import { build } from 'vite';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { photoWeights, weightSpread } from './beginner_weight.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-beginner'));
await mkdir(shots, { recursive: true });
const fixtures = resolve(repo, 'tests/fixtures');

// ----------------------------------------------------------------------
// The build, with the probe
// ----------------------------------------------------------------------

/** The app's modules the asserts read, by the path the dev-server checks import them with */
const PROBE_MODULES = [
	'/app/main.js',
	'/anyink/words/banned.js',
	'/anyink/words/history_text.js',
	'/anyink/photo/photo_registry.js',
	'/anyink/photo/photo_flow_state.js',
	'/anyink/board/letter_set.js',
	'/anyink/spacing/measure.js',
	'/anyink/spacing/extra.js',
	'/anyink/trace/trace_model.js',
	'/anyink/kerning/kern_lookup.js',
	'/anyink/tryit/expand.js',
	'/anyink/tryit/gap_handle.js',
	'/anyink/mode/mode.js',
	'/controls/font-preview/font_preview.js',
];
const PROBE_ID = '/@anyink-beginner-probe.js';

function probePlugin() {
	const code = [
		...PROBE_MODULES.map(
			(path, i) => `import * as m${i} from ${JSON.stringify(resolve(src, `.${path}`).split(sep).join('/'))};`
		),
		`window.__anyinkModules = {${PROBE_MODULES.map((path, i) => `${JSON.stringify(path)}: m${i}`).join(', ')}};`,
	].join('\n');
	return {
		name: 'anyink-beginner-probe',
		apply: 'build',
		resolveId: (id) => (id === PROBE_ID ? '\0anyink-beginner-probe' : null),
		load: (id) => (id === '\0anyink-beginner-probe' ? code : null),
		transformIndexHtml: {
			order: 'pre',
			handler: () => [{ tag: 'script', attrs: { type: 'module', src: PROBE_ID }, injectTo: 'body' }],
		},
	};
}

let dist = process.env.BEGINNER_DIST;
if (!dist) {
	dist = await mkdtemp(resolve(tmpdir(), 'anyink-beginner-dist-'));
	const started = Date.now();
	await build({
		root: src,
		configFile: resolve(src, 'vite.config.js'),
		logLevel: 'warn',
		build: { outDir: dist, emptyOutDir: true },
		plugins: [probePlugin()],
	});
	console.log(`BUILD the app with the probe in ${Math.round((Date.now() - started) / 1000)} s: ${dist}`);
}

const MIME = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.webmanifest': 'application/manifest+json',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.gs2': 'application/json',
	'.txt': 'text/plain',
};
const server = createServer(async (req, res) => {
	try {
		const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
		if (!pathname.startsWith('/AnyInk/')) throw new Error('outside the base');
		const file = resolve(dist, pathname.slice('/AnyInk/'.length) || 'index.html');
		if (!file.startsWith(resolve(dist) + sep)) throw new Error('outside the build');
		const bytes = await readFile(file);
		res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
		res.end(bytes);
	} catch {
		res.writeHead(404);
		res.end();
	}
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
// B16: Simple is the launch default, so the app opens with no ?ui, as Brennan will open it
// (BEGINNER_SEARCH=?ui=simple to pin it, as before the flip)
const APP = `${origin}/AnyInk/${process.env.BEGINNER_SEARCH || ''}`;

// Each task's time, wall clock, settles and measuring included (9.2's limits are for a person)
const taskTimes = {};
let task = null;
const startTask = (name) => {
	stopTask();
	task = { name, at: Date.now() };
};
const stopTask = () => {
	if (task) taskTimes[task.name] = (taskTimes[task.name] || 0) + (Date.now() - task.at);
	task = null;
};
const printTimes = () => {
	const rows = Object.entries(taskTimes).map(([name, ms]) => `${name} ${(ms / 1000).toFixed(1)} s`);
	const total = Object.values(taskTimes).reduce((a, b) => a + b, 0) / 1000;
	console.log(`TASK TIMES (robot, wall clock): ${rows.join(', ')}; total ${total.toFixed(1)} s`);
};

// ----------------------------------------------------------------------
// Chrome, the stand-ins, the helpers
// ----------------------------------------------------------------------

const browser = await chromium.launch({
	channel: process.env.BEGINNER_BROWSER || 'chrome',
	headless: true,
});
const errors = [];
const results = [];
const pass = (message) => {
	results.push(message);
	console.log(`PASS ${message}`);
};
const states = [];
/** Result checks that fail are listed and the run goes on, so one run shows every failure */
const failures = [];
function soft(label, check) {
	try {
		check();
		return true;
	} catch (error) {
		if (!(error instanceof assert.AssertionError)) throw error;
		const line = `${label}: ${error.message.split(/\r?\n/)[0]}${
			error.actual !== undefined && typeof error.actual !== 'boolean'
				? ` (saw ${JSON.stringify(error.actual)})`
				: ''
		}`;
		failures.push(line);
		console.log(`FAIL ${line}`);
		return false;
	}
}
let page;
const settle = (ms = 350) => page.waitForTimeout(ms);

async function newContext() {
	const context = await browser.newContext({
		viewport: { width: 1600, height: 900 },
	});
	await context.addInitScript(() => {
		window.M = (path) => {
			const found = window.__anyinkModules?.[path];
			if (!found) throw new Error(`the probe has no ${path}`);
			return found;
		};
		// Windows' save box: he keeps the name it suggests, in Documents
		window.__savePicks = [];
		window.showSaveFilePicker = async (options = {}) => {
			window.__savePicks.push({ suggestedName: options.suggestedName, startIn: options.startIn });
			const root = await navigator.storage.getDirectory();
			const documents = await root.getDirectoryHandle('Documents', { create: true });
			return documents.getFileHandle(options.suggestedName || 'Untitled.gs2', { create: true });
		};
		// Chrome's folder box: he makes "My Fonts" in Documents and picks it
		window.showDirectoryPicker = async () => {
			const root = await navigator.storage.getDirectory();
			const documents = await root.getDirectoryHandle('Documents', { create: true });
			return documents.getDirectoryHandle('My Fonts', { create: true });
		};
		window.showOpenFilePicker = async () => {
			throw new DOMException('The user aborted a request.', 'AbortError');
		};
		// every text drawn on a canvas, and every toast, for the banned-word scan at the end
		window.__canvasTexts = [];
		for (const name of ['fillText', 'strokeText']) {
			const original = CanvasRenderingContext2D.prototype[name];
			CanvasRenderingContext2D.prototype[name] = function (text, ...rest) {
				if (window.__canvasTexts.length < 20000) window.__canvasTexts.push(String(text));
				return original.call(this, text, ...rest);
			};
		}
		window.__toasts = [];
		const watchToasts = () => {
			new MutationObserver(() => {
				const toast = document.querySelector('#toast');
				const text = toast?.textContent.replace(/\s+/g, ' ').trim();
				if (text && window.__toasts.at(-1) !== text) window.__toasts.push(text);
			}).observe(document.body, { childList: true, subtree: true, characterData: true });
		};
		if (document.body) watchToasts();
		else document.addEventListener('DOMContentLoaded', watchToasts);
	});
	return context;
}
async function freshPage(label, context) {
	const p = await context.newPage();
	p.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
	p.on('console', (message) => {
		if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
	});
	p.on('dialog', (dialog) => dialog.accept());
	return p;
}
const shot = async (name) => page.screenshot({ path: resolve(shots, `${name}.png`) });
const offCanvas = () => page.mouse.move(5, 895);
const waitUntil = async (check, what, timeout = 20000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(100);
	}
	throw new Error(`timed out: ${what}`);
};
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

/** The editor's facts the asserts read */
const editorState = () =>
	page.evaluate(() => {
		const editor = M('/app/main.js').getCurrentProjectEditor();
		const q = editor.history.queue.filter((e) => !/_post_state_$/.test(e.title));
		return {
			page: editor.nav.page,
			item: editor.selectedItemID,
			tool: editor.selectedTool,
			name: editor.project?.settings?.project?.name,
			file: !!editor.loadedFileHandle,
			steps: q.length,
			top: M('/anyink/words/history_text.js').historyText(q[0]?.title || ''),
		};
	});

const GREEN =
	'.anyink-primary, fancy-button:not([secondary]):not([minimal]):not([danger]):not([disabled])';
/** What the screen shows: the green buttons, the Next line, the status, the toast */
const screen = () =>
	page.evaluate((green) => {
		const shown = (el) => !!el && el.checkVisibility();
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		const coach = document.querySelector('anyink-coach');
		return {
			rail: text(document.querySelector('[data-anyink-step="letters"] .anyink-topbar__step-count')),
			sentence: text(coach?.querySelector('.anyink-coach__sentence')),
			greens: [...new Set(document.querySelectorAll(green))].filter(shown).map(text),
			outlinedNext: [...document.querySelectorAll('anyink-coach .anyink-coach__button--outlined')]
				.filter(shown)
				.map(text),
			status: text(document.querySelector('[data-anyink-control="status"] anyink-save-status')),
			toast: text(
				document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__text')
			),
		};
	}, GREEN);

/**
 * One screen state, checked as 9.4 asks: the green buttons, banned words (strict) in visible
 * text, number inputs, capitals. Records it for the summary.
 * @param {String} label
 * @param {Number | 'brushing'} [greens] - 1, or 0 for a drawing tool on an empty letter before its
 *   first mark, or 'brushing' for the Brush on a letter with ink (no green; the Next line's one
 *   button outlined: D-043, D-046)
 */
async function checkState(label, greens = 1) {
	const s = await screen();
	const found = await page.evaluate(() => {
		const { scanDom, findUppercase, formatHit } = M('/anyink/words/banned.js');
		return {
			banned: scanDom(document.body, { strict: true }).map(formatHit),
			upper: findUppercase(document.body).map(formatHit),
			numbers: [...document.querySelectorAll('input[type="number"]')].filter((el) =>
				el.checkVisibility()
			).length,
		};
	});
	states.push({ label, greens: s.greens, ...found });
	if (greens === 'brushing') {
		// D-043 / D-046: while the Brush is the tool on a letter with ink he may still be drawing,
		// so no rule gives that letter a green: either one green for something else (Try it), or
		// none and the Next line names its one button outlined (9.3's "a Next sentence naming one")
		soft(label, () =>
			assert.ok(
				s.greens.length === 1 || (s.greens.length === 0 && s.outlinedNext.length === 1),
				`one green, or none and one outlined Next button; saw ${JSON.stringify(s.greens)} / ${JSON.stringify(s.outlinedNext)}; Next line "${s.sentence}"`
			)
		);
	} else {
		soft(label, () => assert.equal(s.greens.length, greens, `${greens} green button(s), saw ${JSON.stringify(s.greens)}; Next line "${s.sentence}"`));
	}
	soft(label, () => assert.deepEqual(found.banned, [], 'banned words'));
	soft(label, () => assert.deepEqual(found.upper, [], 'text in capitals'));
	soft(label, () => assert.equal(found.numbers, 0, 'number inputs'));
	return s;
}

/** A file from tests/fixtures dropped on an element, as Chrome's drag and drop hands it over */
async function dropFixture(selector, file, name) {
	const base64 = (await readFile(resolve(fixtures, file))).toString('base64');
	return page.evaluate(
		async ({ sel, data, n }) => {
			const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
			const transfer = new DataTransfer();
			transfer.items.add(new File([bytes], n, { type: 'image/jpeg' }));
			const target = document.querySelector(sel);
			target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
			target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
			const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
			target.dispatchEvent(drop);
			return drop.defaultPrevented;
		},
		{ sel: selector, data: base64, n: name }
	);
}
const fixtureKey = async (file) => JSON.parse(await readFile(resolve(fixtures, file), 'utf8'));

const photoDrawn = () =>
	waitUntil(
		() =>
			page.evaluate(() => {
				const loading = document.querySelector('[data-anyink-dialog="photoDialog"] .anyink-photo-dialog__loading');
				return !!loading && loading.hidden;
			}),
		'the photo drawn in the dialog',
		30000
	);
const dialogParts = () =>
	page.evaluate(() => {
		const dialog = document.querySelector('[data-anyink-dialog="photoDialog"]');
		const picked = dialog?.querySelector('[data-anyink-picked]')?.getAttribute('data-anyink-part');
		const editor = M('/app/main.js').getCurrentProjectEditor();
		const { getPhoto } = M('/anyink/photo/photo_registry.js');
		const photos = Object.keys(editor.project.settings.anyink?.photos || {});
		const record = getPhoto(editor.project, photos.at(-1));
		return {
			boxes: dialog ? dialog.querySelectorAll('[data-anyink-part]').length : 0,
			parts: record?.parts || [],
			picked: record?.parts.find((p) => p.id === picked) || null,
		};
	});
const flowStatus = () =>
	page.evaluate(() => {
		const flow = M('/anyink/photo/photo_flow_state.js').getFlow(M('/app/main.js').getCurrentProjectEditor());
		return flow ? flow.status : null;
	});

/**
 * Where a letter's ink sits against the photo part it was traced from, in font units: the
 * photo part's box (from the trace's place and scale) and the ink's box. Lining up = the same
 * box, within the outline's own error.
 */
const photoFit = (char) =>
	page.evaluate((id) => {
		const editor = M('/app/main.js').getCurrentProjectEditor();
		const item = editor.project.getItem(id);
		const trace = M('/anyink/trace/trace_model.js').getTrace(item);
		const fit = item.anyink?.photoFit;
		const record = fit && M('/anyink/photo/photo_registry.js').getPhoto(editor.project, fit.asset);
		const part = record?.parts.find((p) => p.id === fit.part);
		const ink = M('/anyink/spacing/measure.js').inkBounds(item);
		if (!trace || !part || !ink) return { char: id, missing: { trace: !!trace, part: !!part, ink: !!ink } };
		const photo = {
			xMin: trace.x + part.left * trace.scale,
			xMax: trace.x + part.right * trace.scale,
			yMax: trace.y - part.top * trace.scale,
			yMin: trace.y - part.bottom * trace.scale,
		};
		const r = (n) => Math.round(n * 10) / 10;
		return {
			lsb: item.leftSideBearing,
			width: item.advanceWidth,
			dx: r(ink.xMin - photo.xMin),
			dxRight: r(ink.xMax - photo.xMax),
			dy: r(ink.yMin - photo.yMin),
			dyTop: r(ink.yMax - photo.yMax),
			inkH: r(ink.yMax - ink.yMin),
			box: editor.project.settings.font.ascent - editor.project.settings.font.descent,
		};
	}, ID(char));
/** Lines up: every edge of the ink within 2 % of the letter box of the photo part's edge */
const assertLinesUp = (fit, label) => {
	if (!soft(label, () => assert.ok(!fit.missing, JSON.stringify(fit)))) return Infinity;
	const worst = Math.max(...[fit.dx, fit.dxRight, fit.dy, fit.dyTop].map(Math.abs));
	soft(label, () => assert.ok(worst <= 0.02 * fit.box, `the photo is off the ink by ${worst} units (${JSON.stringify(fit)})`));
	return worst;
};
/**
 * The photo kept its place under the ink: each edge's offset the same, within 1 unit and the
 * rounding. A letter resized to match the others (B9) scales its photo with it, so the offsets
 * are compared at the letter's new size.
 */
const sameFit = (a, b, label) => {
	const k = a.inkH ? b.inkH / a.inkH : 1;
	for (const key of ['dx', 'dxRight', 'dy', 'dyTop'])
		soft(label, () =>
			assert.ok(
				Math.abs(a[key] * k - b[key]) <= 1.5,
				`the photo moved against the ink (${key} ${a[key]} -> ${b[key]}, size x${Math.round(k * 1000) / 1000})`
			)
		);
};

/** The board, read as Chrome draws it */
const board = () =>
	page.evaluate(() => {
		const root = document.querySelector('[data-anyink-board]');
		if (!root) return null;
		const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
		return {
			tiles: [...root.querySelectorAll('[data-anyink-board-cell] > glyph-tile')].map((tile) => ({
				char: tile.dataset.anyinkChar,
				state: tile.shadowRoot?.querySelector('.wrapper')?.getAttribute('session-state'),
			})),
			looks: [...root.querySelectorAll('.anyink-board__look')].map((look) => ({
				char: look.closest('[data-anyink-board-cell]').dataset.char,
				reason: text(look.querySelector('.anyink-board__reason')),
				fixes: [...look.querySelectorAll('[data-anyink-board-fix]')].map((b) => b.dataset.anyinkBoardFix),
			})),
		};
	});
const toBoard = async () => {
	await page.locator('[data-anyink-control="logo"]').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(700);
};
const openTile = async (char) => {
	await page.locator(`[data-anyink-board-cell][data-char="${char}"] glyph-tile`).click();
	await page.locator('.editor-page__tools-area').waitFor({ timeout: 15000 });
	await offCanvas();
	await settle(700);
};
/** Font units to page pixels on the open letter */
const at = (ux, uy) =>
	page.evaluate(
		([x, y]) => {
			const view = M('/app/main.js').getCurrentProjectEditor().view;
			const host = document.querySelector('edit-canvas');
			const box = (host.shadowRoot || host).querySelector('canvas').getBoundingClientRect();
			return { x: box.left + view.dx + x * view.dz, y: box.top + view.dy - y * view.dz };
		},
		[ux, uy]
	);

/**
 * A font (its bytes, base64) set in Chrome at `px` (default 240): each letter of the text alone at
 * its pen position, so the measures are the font's, row by row. Returns per letter its ink bottom,
 * its stroke weight (twice the median distance from the middle of a stroke to its edge, in px)
 * and per neighbouring pair in a word the narrowest gap on any row both have ink on.
 */
const setInFont = (base64, text, size = 240) =>
	page.evaluate(
		async ({ data, words, px }) => {
			const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
			const family = `Beginner${Math.round(Math.random() * 1e9)}`;
			const face = new FontFace(family, bytes.buffer);
			await face.load();
			document.fonts.add(face);
			const W = 10 * px;
			const H = 2 * px;
			const baseline = Math.round(1.42 * px);
			const left = Math.round(px / 6);
			const work = document.createElement('canvas');
			work.width = W;
			work.height = H;
			const ctx = work.getContext('2d', { willReadFrequently: true });
			ctx.font = `${px}px ${family}`;
			const letters = [];
			for (let i = 0; i < words.length; i++) {
				const char = words[i];
				if (char === ' ') continue;
				const x = left + ctx.measureText(words.slice(0, i)).width;
				ctx.fillStyle = 'white';
				ctx.fillRect(0, 0, W, H);
				ctx.fillStyle = 'black';
				ctx.fillText(char, x, baseline);
				const pixels = ctx.getImageData(0, 0, W, H).data;
				const ink = new Uint8Array(W * H);
				const rows = new Map();
				let bottom = -1;
				let x0 = W;
				let x1 = -1;
				let y0 = H;
				for (let y = 0; y < H; y++) {
					for (let xx = 0; xx < W; xx++) {
						if (pixels[(y * W + xx) * 4] < 128) {
							ink[y * W + xx] = 1;
							const row = rows.get(y) || [Infinity, -Infinity];
							row[0] = Math.min(row[0], xx);
							row[1] = Math.max(row[1], xx);
							rows.set(y, row);
							bottom = Math.max(bottom, y);
							y0 = Math.min(y0, y);
							x0 = Math.min(x0, xx);
							x1 = Math.max(x1, xx);
						}
					}
				}
				// distance to paper (chamfer 3-4, two passes) inside the letter's box, then the
				// ridge: the middle of each stroke
				const d = new Float32Array(W * H);
				const get = (xx, y) => (xx < 0 || y < 0 || xx >= W || y >= H ? 0 : d[y * W + xx]);
				const [bx0, bx1, by0, by1] = [Math.max(1, x0 - 1), Math.min(W - 2, x1 + 1), Math.max(1, y0 - 1), Math.min(H - 2, bottom + 1)];
				for (let y = by0; y <= by1; y++)
					for (let xx = bx0; xx <= bx1; xx++) if (ink[y * W + xx]) d[y * W + xx] = 1e9;
				for (let y = by0; y <= by1; y++)
					for (let xx = bx0; xx <= bx1; xx++) {
						const k = y * W + xx;
						if (!ink[k]) continue;
						d[k] = Math.min(d[k], get(xx - 1, y) + 3, get(xx, y - 1) + 3, get(xx - 1, y - 1) + 4, get(xx + 1, y - 1) + 4);
					}
				for (let y = by1; y >= by0; y--)
					for (let xx = bx1; xx >= bx0; xx--) {
						const k = y * W + xx;
						if (!ink[k]) continue;
						d[k] = Math.min(d[k], get(xx + 1, y) + 3, get(xx, y + 1) + 3, get(xx + 1, y + 1) + 4, get(xx - 1, y + 1) + 4);
					}
				const ridge = [];
				for (let y = by0; y <= by1; y++)
					for (let xx = bx0; xx <= bx1; xx++) {
						const v = d[y * W + xx];
						if (!v) continue;
						let top = true;
						for (let oy = -1; oy <= 1 && top; oy++)
							for (let ox = -1; ox <= 1; ox++) if (d[(y + oy) * W + xx + ox] > v) top = false;
						if (top) ridge.push(v / 3);
					}
				ridge.sort((a, b) => a - b);
				letters.push({
					char,
					word: words.slice(0, i).split(' ').length - 1,
					rows,
					bottom,
					weight: ridge.length ? Math.round(2 * ridge[Math.floor(ridge.length / 2)] * 10) / 10 : 0,
				});
			}
			const pairs = [];
			for (let i = 1; i < letters.length; i++) {
				const a = letters[i - 1];
				const b = letters[i];
				if (a.word !== b.word) continue;
				let min = Infinity;
				for (const [y, [, aRight]] of a.rows) {
					const row = b.rows.get(y);
					if (row) min = Math.min(min, row[0] - aRight - 1);
				}
				pairs.push({ pair: a.char + b.char, min });
			}
			return {
				px,
				baseline,
				letters: letters.map(({ char, bottom, weight }) => ({ char, bottom, weight })),
				pairs,
			};
		},
		{ data: base64, words: text, px: size }
	);
/** The real font of the open project, as the exporter builds it, base64 */
const builtFont = (text) =>
	page.evaluate((words) => {
		const editor = M('/app/main.js').getCurrentProjectEditor();
		const { FontPreviewBuilder } = M('/controls/font-preview/font_preview.js');
		const buffer = new FontPreviewBuilder(editor.project).buildFontBuffer(words);
		let binary = '';
		new Uint8Array(buffer).forEach((b) => (binary += String.fromCharCode(b)));
		return btoa(binary);
	}, text);
const assertSetWell = (set, label) => {
	set.pairs.forEach((p) => soft(label, () => assert.ok(p.min > 0, `${p.pair} overlap or touch (${p.min} px)`)));
	const offLine = set.letters.map((l) => Math.abs(l.bottom + 1 - set.baseline));
	// 2 % of the letter box at this size (the box is about 2 em tall in px, ascent to descent)
	offLine.forEach((off, i) =>
		soft(label, () => assert.ok(off <= 0.02 * set.px * 2, `${set.letters[i].char} off the line by ${off} px`))
	);
	return Math.max(...offLine);
};
const median = (list) => {
	const sorted = [...list].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// ----------------------------------------------------------------------
// The run
// ----------------------------------------------------------------------
const PHOTO_LETTERS = [...'BrenaHd'];
let context = await newContext();
try {
	// ------------------------------------------------------------------
	// T1 Make a new font called Brennan Hand
	// ------------------------------------------------------------------
	page = await freshPage('T1-T8', context);
	startTask('T1');
	await page.goto(APP);
	await page.locator('#open-project__page.anyink-start').waitFor({ timeout: 60000 });
	await settle(800);
	assert.equal(await page.evaluate(() => M('/anyink/mode/mode.js').getMode()), 'simple');
	let s = await checkState('T1 start screen');
	assert.deepEqual(s.greens, ['Create my font']);
	await shot('T1-1-start-screen');
	await page.locator('#input__new-project-name').fill('Brennan Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await waitUntil(async () => (await screen()).status === 'Saved', 'status "Saved"');
	let st = await editorState();
	const picks = await page.evaluate(() => window.__savePicks);
	const workFile = await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		const documents = await root.getDirectoryHandle('Documents');
		const file = await (await documents.getFileHandle('Brennan Hand.gs2')).getFile();
		return { size: file.size, text: await file.text() };
	});
	const saved = JSON.parse(workFile.text);
	assert.equal(st.name, 'Brennan Hand');
	assert.equal(st.file, true, 'a work file');
	assert.deepEqual(picks, [{ suggestedName: 'Brennan Hand.gs2', startIn: 'documents' }]);
	assert.equal(saved.settings.project.name, 'Brennan Hand');
	s = await checkState('T1 the board');
	await shot('T1-2-board-saved');
	pass(
		`T1 the start screen [${states[0].greens}]; Create my font -> the board for "${st.name}"; the save box offered "${picks[0].suggestedName}" in ${picks[0].startIn}; Documents\\Brennan Hand.gs2 exists (${workFile.size} bytes, the font's name inside); status "${s.status}"`
	);

	// ------------------------------------------------------------------
	// T2 + T3 Letters from the loose photo
	// ------------------------------------------------------------------
	startTask('T2');
	const loose = await fixtureKey('brenna-loose.json');
	assert.equal(await dropFixture('.anyink-board__sections', 'brenna-loose.jpg', 'IMG_2041.jpg'), true, 'the board takes the drop');
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 30000 });
	await photoDrawn();
	await settle(500);
	let parts = await dialogParts();
	assert.equal(parts.parts.length, loose.letters.length, `one part per letter: ${parts.parts.length}`);
	assert.equal(parts.boxes, loose.letters.length);
	await checkState('T2 photo dialog');
	await shot('T2-1-photo-dialog');
	pass(`T2 the loose photo dropped on the board opens the photo dialog with ${parts.parts.length} parts, one per letter`);

	const fits = {};
	for (let n = 0; n < loose.letters.length; n++) {
		parts = await dialogParts();
		const p = parts.picked;
		const letter = loose.letters.find(
			(l) => l.center[0] >= p.left && l.center[0] < p.right && l.center[1] >= p.top && l.center[1] < p.bottom
		);
		assert.ok(letter, `the green box holds a letter: ${JSON.stringify(p)}`);
		await page.locator('[data-anyink-photo-field]').focus();
		await page.keyboard.press(letter.char);
		await settle(150);
		await page.locator('[data-anyink-photo-action="trace"]').click();
		await waitUntil(async () => (await flowStatus()) === 'ready', `step C for ${letter.char}`, 30000);
		await offCanvas();
		await settle(400);
		s = await checkState(`T2/T3 step C ${letter.char}`);
		assert.deepEqual(s.greens, ['Use it']);
		await page.locator('[data-anyink-photo-card-action="useIt"]').click();
		await waitUntil(async () => (await flowStatus()) === null, `Use it for ${letter.char}`);
		await offCanvas();
		await settle(500);
		fits[letter.char] = await photoFit(letter.char);
		assertLinesUp(fits[letter.char], `${letter.char} after Use it`);
		await checkState(`T2/T3 ${letter.char} used`);
		if (letter.char === 'B') {
			const b = await page.evaluate((id) => {
				const editor = M('/app/main.js').getCurrentProjectEditor();
				const item = editor.project.getItem(id);
				const ink = M('/anyink/spacing/measure.js').inkBounds(item);
				const font = editor.project.settings.font;
				return {
					ready: M('/anyink/board/letter_set.js').hasInk(item),
					width: item.advanceWidth,
					bottom: Math.round(ink.yMin),
					box: font.ascent - font.descent,
				};
			}, ID('B'));
			soft('T2 capital B', () => {
				assert.equal(b.ready, true, 'Ready');
				assert.ok(b.width > 0, 'width > 0');
				assert.ok(Math.abs(b.bottom) <= 0.02 * b.box, `body bottom ${b.bottom} (2 % = ${0.02 * b.box})`);
			});
			await shot('T2-2-capital-b-used');
			// One Undo: the empty B, photo kept (the top bar's Undo, on screen)
			await page.locator('[data-anyink-control="undo"]').click();
			await settle(600);
			const undone = await page.evaluate((id) => {
				const item = M('/app/main.js').getCurrentProjectEditor().project.getItem(id);
				const editor = M('/app/main.js').getCurrentProjectEditor();
				return {
					shapes: item.shapes.length,
					photo: !!M('/anyink/trace/trace_model.js').getTrace(item),
					photosInFont: Object.keys(editor.project.settings.anyink?.photos || {}).length,
				};
			}, ID('B'));
			soft('T2 one Undo', () =>
				assert.deepEqual({ shapes: undone.shapes, photo: undone.photo }, { shapes: 0, photo: true }, 'the empty B, photo kept')
			);
			await shot('T2-3-undo-empty-b');
			await page.locator('[data-anyink-control="redo"]').click();
			await settle(600);
			assert.equal(
				await page.evaluate((id) => M('/app/main.js').getCurrentProjectEditor().project.getItem(id).shapes.length > 0, ID('B')),
				true,
				'Redo brings B back'
			);
			sameFit(fits.B, await photoFit('B'), 'B after Undo and Redo');
			pass(
				`T2 capital B: Ready, width ${b.width}, body bottom ${b.bottom} (within 2 % of the ${b.box}-unit letter box); one Undo (top bar) left ${JSON.stringify(undone)}; Redo brought it back`
			);
			startTask('T3');
		}
		if (n < loose.letters.length - 1) {
			s = await screen();
			for (let guard = 0; guard < 6 && !/more letter/.test(s.sentence || ''); guard++) {
				await page.locator('anyink-coach .anyink-coach__else').click();
				await settle(250);
				s = await screen();
			}
			assert.match(s.sentence || '', /This photo has \d+ more letter/);
			await page.locator('anyink-coach .anyink-coach__button').click();
			await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 20000 });
			await photoDrawn();
			await settle(300);
		}
	}
	// each letter's photo stays where Use it put it while the next letters come in (B3 refits)
	for (const char of PHOTO_LETTERS) sameFit(fits[char], await photoFit(char), `${char} at the end of the walk`);
	await toBoard();
	let b = await board();
	const looked = [];
	for (let guard = 0; guard < 10 && b.looks.length; guard++) {
		const look = b.looks[0];
		const kind = look.fixes.includes('fix') ? 'fix' : 'looksFine';
		looked.push(`${look.char}: "${look.reason}" -> ${kind}`);
		await page.locator(`[data-anyink-board-cell][data-char="${look.char}"] [data-anyink-board-fix="${kind}"]`).click();
		await settle(800);
		b = await board();
	}
	const tiles = PHOTO_LETTERS.map((char) => b.tiles.find((t) => t.char === char));
	tiles.forEach((t) => soft('T3 Ready', () => assert.equal(t?.state, 'ready', `${t?.char}: ${JSON.stringify(t)}`)));
	s = await checkState('T3 board, seven letters');
	assert.match(s.rail || '', /^7\//);
	const letters = await page.evaluate((chars) => {
		const editor = M('/app/main.js').getCurrentProjectEditor();
		const font = editor.project.settings.font;
		return chars.map((char) => {
			const item = editor.project.getItem(`glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`);
			const ink = M('/anyink/spacing/measure.js').inkBounds(item);
			const coords = item.shapes.flatMap((sh) => sh.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y, pp.h1.x, pp.h1.y, pp.h2.x, pp.h2.y]));
			return {
				char,
				width: item.advanceWidth,
				bottom: Math.round(ink.yMin),
				box: font.ascent - font.descent,
				whole: coords.every(Number.isInteger) && Number.isInteger(item.advanceWidth),
			};
		});
	}, PHOTO_LETTERS);
	letters.forEach((l) =>
		soft(`T3 ${l.char}`, () => {
			assert.ok(l.width > 0, 'width > 0');
			assert.equal(l.whole, true, 'whole numbers');
			assert.ok(Math.abs(l.bottom) <= 0.02 * l.box, `body bottom ${l.bottom} off the writing line`);
		})
	);
	const real7 = await setInFont(await builtFont('BrenaHd'), 'B r e n a H d', 720);
	const weights = real7.letters.map((l) => l.weight);
	const mid = median(weights);
	const spread = real7.letters.map((l) => ({ char: l.char, weight: l.weight, off: Math.round((Math.abs(l.weight - mid) / mid) * 1000) / 10 }));
	// B16: the drawn fixture's pen wobbles a little (7 %), so a short letter can be thinner on
	// the paper itself; the photo is measured the same way (beginner_weight.mjs). A letter more
	// than 15 % off passes only when the photo shows the same: the app kept the pen as written
	// (its font-to-photo weight within 10 % of the other letters'), and the font's spread is at
	// most 5 points more than the photo's own for that letter.
	const onPhoto = new Map(weightSpread(await photoWeights(resolve(fixtures, 'brenna-loose.jpg'), resolve(fixtures, 'brenna-loose.json'))).map((w) => [w.char, w]));
	const ratios = spread.map((w) => w.weight / onPhoto.get(w.char).weight);
	const midRatio = median(ratios);
	spread.forEach((w, i) => {
		const photo = onPhoto.get(w.char);
		w.photo = photo.weight;
		w.photoOff = photo.off;
		w.kept = Math.round((Math.abs(ratios[i] - midRatio) / midRatio) * 1000) / 10;
	});
	spread.forEach((w) =>
		soft('T3 stroke weight', () => {
			assert.ok(w.kept <= 10, `${w.char}: the font's weight is ${w.kept} % off the photo's for that letter (${JSON.stringify(spread)})`);
			assert.ok(w.off <= 15 || w.off <= w.photoOff + 5, `${w.char} is ${w.off} % off the median ${mid}, the photo's own ${w.photoOff} % (${JSON.stringify(spread)})`);
		})
	);
	await shot('T3-1-board-seven-ready');
	pass(
		`T3 r e n a H d walked from the photo; ${looked.length ? `Needs a look handled: ${looked.join('; ')}; ` : 'no Needs a look; '}all seven tiles Ready, rail "${s.rail}"; widths ${letters.map((l) => `${l.char} ${l.width}`).join(', ')} (whole numbers); bottoms ${letters.map((l) => l.bottom).join(' ')}; stroke weights ${spread.map((w) => `${w.char} ${w.weight}`).join(', ')} px at 720 px, worst ${Math.max(...spread.map((w) => w.off))} % off the median (on the photo itself ${spread.map((w) => `${w.char} ${w.photoOff}`).join(', ')} %; the font keeps each letter's pen as written within ${Math.max(...spread.map((w) => w.kept))} %)`
	);
	pass(
		`T3 the photo lines up under the ink after Use it: worst edge ${Math.max(...PHOTO_LETTERS.map((c) => Math.max(...['dx', 'dxRight', 'dy', 'dyTop'].map((k) => Math.abs(fits[c][k])))))} units (2 % = ${0.02 * letters[0].box}), and stays put while the other letters came in`
	);

	// An edge drag: small n's left edge, Fine-tune open, with the real mouse
	await openTile('n');
	await page.locator('[data-anyink-toggle="fineTune"]').click();
	await settle(500);
	await checkState('T3 small n, Fine-tune open');
	const nBefore = await photoFit('n');
	const edge = await at(0, 200);
	await page.mouse.move(edge.x + 20, edge.y);
	await page.mouse.move(edge.x, edge.y, { steps: 4 });
	await page.mouse.down();
	await page.mouse.move(edge.x - 30, edge.y, { steps: 6 });
	await page.mouse.up();
	await offCanvas();
	await settle(600);
	const nDragged = await photoFit('n');
	assert.notEqual(nDragged.lsb, nBefore.lsb, `the drag moved the left edge (${nBefore.lsb} -> ${nDragged.lsb})`);
	sameFit(nBefore, nDragged, 'n after the left-edge drag');
	await shot('T3-2-n-left-edge-dragged');
	await page.keyboard.press('Control+z');
	await settle(600);
	const nUndone = await photoFit('n');
	assert.equal(nUndone.lsb, nBefore.lsb, 'Ctrl+Z puts the edge back');
	sameFit(nBefore, nUndone, 'n after Undo of the drag');
	await page.locator('[data-anyink-toggle="fineTune"]').click();
	await settle(300);
	pass(`T3 small n's left edge dragged with the mouse (left space ${nBefore.lsb} -> ${nDragged.lsb}): the photo moved with the ink (offsets ${nBefore.dx}/${nBefore.dy} -> ${nDragged.dx}/${nDragged.dy}); Ctrl+Z put it back`);
	await toBoard();

	// ------------------------------------------------------------------
	// T4 Draw a small o with the Brush
	// ------------------------------------------------------------------
	startTask('T4');
	await openTile('o');
	st = await editorState();
	assert.equal(st.tool, 'nib', 'an empty letter opens with the Brush');
	s = await checkState('T4 empty small o');
	await shot('T4-1-empty-o');
	await page.locator('[data-anyink-overlay-action="drawBrush"]').click();
	await offCanvas();
	await settle(500);
	await checkState('T4 the Brush on an empty o, before its first mark', 0);
	const k = await page.evaluate(() => M('/app/main.js').getCurrentProjectEditor().project.settings.font.upm / 1000);
	const ring = [];
	for (let a = 90; a <= 450; a += 8) {
		const t = (a * Math.PI) / 180;
		ring.push(await at((260 + 190 * Math.cos(t)) * k, (200 + 190 * Math.sin(t)) * k));
	}
	await page.mouse.move(ring[0].x, ring[0].y);
	await page.mouse.down();
	for (const point of ring.slice(1)) await page.mouse.move(point.x, point.y, { steps: 2 });
	for (let i = 0; i < 8; i++) {
		await page.mouse.move(ring.at(-1).x + (i % 2), ring.at(-1).y);
		await settle(20);
	}
	await page.mouse.up();
	await offCanvas();
	await settle(700);
	const o = await page.evaluate((id) => {
		const editor = M('/app/main.js').getCurrentProjectEditor();
		const item = editor.project.getItem(id);
		return {
			ink: M('/anyink/board/letter_set.js').hasInk(item),
			width: item.advanceWidth,
			strokes: (item.anyink?.nib?.strokes || []).length,
			tagged: item.shapes.every((sh) => sh.anyink?.strokeId != null),
			photo: !!item.anyink?.trace || !!item.anyink?.photoFit,
		};
	}, ID('o'));
	assert.deepEqual({ ...o, width: o.width > 0 }, { ink: true, width: true, strokes: 1, tagged: true, photo: false });
	// The Brush is still the tool; the font check runs 2 s after a change (B1), so wait for it
	await settle(2600);
	const brushed = await checkState('T4 small o drawn, the Brush still picked', 'brushing');
	// He picks Select (V): done drawing, the one green comes back
	await page.keyboard.press('v');
	await settle(400);
	await checkState('T4 small o drawn, Select picked');
	await shot('T4-2-o-drawn');
	pass(`T4 small o opened with the Brush (the one green [Use a photo] on the empty letter, none once Draw with the brush was pressed); one real drag drew it: ink, width ${o.width}, 1 Brush stroke, no photo; with the Brush still picked the Next line "${brushed.sentence}" [${[...brushed.greens, ...brushed.outlinedNext.map((t) => `${t}, outlined`)].join('')}], with Select picked one green`);
	await toBoard();

	// ------------------------------------------------------------------
	// T5 Try it: Brennan Hand
	// ------------------------------------------------------------------
	startTask('T5');
	await page.locator('[data-anyink-step="tryIt"]').click();
	await waitUntil(() => page.evaluate(() => M('/anyink/tryit/expand.js').isTryItOpen()), 'Try it open');
	await offCanvas();
	await settle(900);
	const stripText = await page.evaluate(() => document.querySelector('preview-strip')?.options?.text);
	assert.equal(stripText, 'Brennan Hand');
	await checkState('T5 Try it');
	const real = await setInFont(await builtFont('Brennan Hand'), 'Brennan Hand');
	assert.equal(real.letters.length, 11);
	const t5Off = assertSetWell(real, 'T5 Brennan Hand');
	await shot('T5-1-try-it');
	pass(`T5 Try it shows "${stripText}"; in his real font no two neighbours overlap (closest ${Math.min(...real.pairs.map((p) => p.min))} px at 240 px: ${real.pairs.map((p) => `${p.pair} ${p.min}`).join(', ')}); every bottom within ${t5Off} px of one writing line`);

	// ------------------------------------------------------------------
	// T6 One gap too wide: e|n closer, with the real handle
	// ------------------------------------------------------------------
	startTask('T6');
	const fontJSON = () =>
		page.evaluate(() => {
			const saved = M('/app/main.js').getCurrentProjectEditor().project.save();
			return JSON.stringify({ glyphs: saved.glyphs, ligatures: saved.ligatures, components: saved.components, font: saved.settings.font });
		});
	const before6 = { font: await fontJSON(), steps: (await editorState()).steps };
	const gap = await page.evaluate(() => {
		const { stripLayout, findGapAtPoint } = M('/anyink/tryit/gap_handle.js');
		const layout = stripLayout(document.querySelector('preview-strip'));
		const rect = layout.canvas.getBoundingClientRect();
		for (const line of layout.data) {
			const i = line.findIndex((c, k2) => c.char === 'e' && line[k2 + 1]?.char === 'n');
			if (i < 0) continue;
			const n = line[i + 1];
			const y = n.view.dy - 150 * n.view.dz;
			return { x: rect.left + n.view.dx, y: rect.top + y, hit: !!findGapAtPoint(layout.data, n.view.dx, y, layout.font) };
		}
		return null;
	});
	assert.ok(gap?.hit, `the e|n gap on the sheet: ${JSON.stringify(gap)}`);
	const handle = page.locator('.anyink-gap-handle');
	for (let tries = 0; tries < 4 && !(await handle.isVisible()); tries++) {
		await page.mouse.move(gap.x - 40, gap.y);
		await page.mouse.move(gap.x + 1, gap.y, { steps: 4 });
		await settle(300 + 300 * tries);
	}
	assert.equal(await handle.isVisible(), true, 'the purple handle shows');
	const hb = await handle.boundingBox();
	await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
	await page.mouse.down();
	await page.mouse.move(hb.x + hb.width / 2 - 4, hb.y + hb.height / 2, { steps: 3 });
	await page.mouse.move(hb.x + hb.width / 2 - 10, hb.y + hb.height / 2, { steps: 3 });
	await page.mouse.up();
	await settle(600);
	const kernNow = () =>
		page.evaluate(() => {
			const { kernOffsetFor, onePairFixes } = M('/anyink/kerning/kern_lookup.js');
			const project = M('/app/main.js').getCurrentProjectEditor().project;
			return { kern: kernOffsetFor(project, 'e', 'n'), fixes: onePairFixes(project).length };
		});
	const fixed = await kernNow();
	st = await editorState();
	assert.ok(fixed.kern < 0, `e|n closer: ${fixed.kern}`);
	assert.equal(fixed.fixes, 1, 'one gap fix');
	assert.equal(st.steps, before6.steps + 1, 'one Undo step');
	assert.equal(await fontJSON(), before6.font, 'nothing else changed');
	await page.mouse.move(5, 300);
	await settle(200);
	await checkState('T6 after the gap fix');
	await shot('T6-1-gap-fixed');
	pass(`T6 the e|n gap dragged closer with the purple handle: one gap fix (${fixed.kern} units), one step "${st.top}", the letters and the font's lines unchanged`);

	// ------------------------------------------------------------------
	// T7 Undo it, then put it back (the top bar's buttons)
	// ------------------------------------------------------------------
	startTask('T7');
	await page.locator('[data-anyink-control="undo"]').click();
	await settle(600);
	const undone7 = await kernNow();
	assert.deepEqual(undone7, { kern: 0, fixes: 0 }, 'the gap fix is gone');
	await page.locator('[data-anyink-control="redo"]').click();
	await settle(600);
	const redone7 = await kernNow();
	assert.deepEqual(redone7, fixed, 'the gap fix is back');
	await checkState('T7 after Redo');
	await shot('T7-1-redo');
	pass(`T7 the top bar's Undo took the gap fix away (kern ${undone7.kern}), Redo put it back (kern ${redone7.kern})`);

	// The letter spacing slider: the photos move with their letters
	const fitsBefore = {};
	for (const char of PHOTO_LETTERS) fitsBefore[char] = await photoFit(char);
	await page.locator('.anyink-tryit-spacing summary').click();
	await settle(300);
	const slider = page.locator('.anyink-tryit-spacing input[type=range]');
	const sb = await slider.boundingBox();
	await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
	await page.mouse.down();
	await page.mouse.move(sb.x + sb.width * 0.7, sb.y + sb.height / 2, { steps: 4 });
	await page.mouse.up();
	await settle(600);
	const extra = await page.evaluate(() => M('/anyink/spacing/extra.js').getExtra(M('/app/main.js').getCurrentProjectEditor().project));
	assert.ok(extra > 0, `letters further apart: extra ${extra}`);
	const moved = [];
	for (const char of PHOTO_LETTERS) {
		const after = await photoFit(char);
		sameFit(fitsBefore[char], after, `${char} after the letter spacing change`);
		moved.push(`${char} ${fitsBefore[char].lsb}->${after.lsb}`);
	}
	await checkState('T7 letter spacing changed');
	await shot('T7-2-letter-spacing');
	await page.keyboard.press('Control+z');
	await settle(600);
	pass(`T3 the letter spacing slider moved all letters further apart (extra ${extra}; left spaces ${moved.join(', ')}): every photo moved with its ink; Ctrl+Z put it back`);
	await page.locator('.anyink-tryit__done').click();
	await settle(500);

	// ------------------------------------------------------------------
	// T8 (the file part) Use in Word
	// ------------------------------------------------------------------
	startTask('T8 file part');
	await page.locator('[data-anyink-step="useInWord"]').click();
	await page.locator('[data-anyink-install-action="pick"]').waitFor({ timeout: 15000 });
	await settle(400);
	await checkState('T8 Use in Word, before');
	await page.locator('[data-anyink-install-action="pick"]').click();
	await page.locator('[data-anyink-install-folder="picked"]').waitFor({ timeout: 10000 });
	await settle(300);
	await checkState('T8 folder picked');
	await page.locator('[data-anyink-install-action="make"]').click();
	await waitUntil(() => page.locator('[data-anyink-install-step="gaps"]').isVisible().catch(() => false), 'the install card', 30000);
	await settle(500);
	await checkState('T8 the install card');
	await shot('T8-1-install-card');
	const otf = await page.evaluate(async () => {
		const root = await navigator.storage.getDirectory();
		const folder = await (await root.getDirectoryHandle('Documents')).getDirectoryHandle('My Fonts');
		const names = [];
		for await (const [name] of folder.entries()) names.push(name);
		const file = await (await folder.getFileHandle(names[0])).getFile();
		let binary = '';
		new Uint8Array(await file.arrayBuffer()).forEach((b) => (binary += String.fromCharCode(b)));
		return { names, base64: btoa(binary) };
	});
	assert.deepEqual(otf.names, ['BrennanHand-Test1.otf']);
	const font = FontFlux.open(Buffer.from(otf.base64, 'base64'));
	assert.equal(font.info.familyName, 'Brennan Hand Test 1');
	const inFile = new Map(font.glyphs.filter((g) => g.unicode != null).map((g) => [String.fromCodePoint(g.unicode), g]));
	for (const char of new Set('Brennan Hand'))
		assert.ok(inFile.get(char)?.advanceWidth > 0, `"${char}" in the file with width > 0`);
	const made = [...PHOTO_LETTERS, 'o', ' '].sort();
	assert.deepEqual([...inFile.keys()].sort(), made, 'the letters with no shapes are left out');
	const word = await setInFont(otf.base64, 'Brennan Hand');
	const t8Off = assertSetWell(word, 'T8 the font file');
	pass(`T8 Use in Word wrote ${otf.names[0]} to Documents\\My Fonts; it loads (family "${font.info.familyName}"), holds exactly ${made.map((c) => (c === ' ' ? 'space' : c)).join(' ')}, every letter of "Brennan Hand" wider than 0 (${[...new Set('Brennan Hand')].map((c) => `${c === ' ' ? 'space' : c} ${inFile.get(c).advanceWidth}`).join(', ')}); typed in Chrome no neighbours overlap (closest ${Math.min(...word.pairs.map((p) => p.min))} px), one writing line (within ${t8Off} px)`);

	// the canvas texts and toasts of the whole run
	const late = await page.evaluate(() => {
		const { scanTexts, formatHit } = M('/anyink/words/banned.js');
		return {
			canvas: scanTexts(window.__canvasTexts, 'canvas', { strict: true }).map(formatHit),
			toasts: scanTexts(window.__toasts, 'toast', { strict: true }).map(formatHit),
			drawn: new Set(window.__canvasTexts).size,
			toastList: window.__toasts,
		};
	});
	soft('canvas texts', () => assert.deepEqual(late.canvas, [], 'banned words drawn on a canvas'));
	soft('toasts', () => assert.deepEqual(late.toasts, [], 'banned words in a toast'));
	pass(`no banned word in ${late.drawn} distinct canvas texts or ${late.toastList.length} toasts (${late.toastList.slice(0, 8).map((t) => `"${t}"`).join(', ')}${late.toastList.length > 8 ? ', ...' : ''})`);
	await context.close();

	// ------------------------------------------------------------------
	// The tight photo: 8 parts, the dotted i one of them
	// ------------------------------------------------------------------
	stopTask();
	context = await newContext();
	page = await freshPage('tight photo', context);
	await page.goto(APP);
	await page.locator('#input__new-project-name').waitFor({ timeout: 60000 });
	await page.locator('#input__new-project-name').fill('Tight Hand');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 20000 });
	await offCanvas();
	await settle(800);
	const tight = await fixtureKey('brenna-tight.json');
	assert.equal(await dropFixture('.anyink-board__sections', 'brenna-tight.jpg', 'IMG_2042.jpg'), true);
	await page.locator('[data-anyink-dialog="photoDialog"]').waitFor({ timeout: 30000 });
	await photoDrawn();
	await settle(500);
	parts = await dialogParts();
	assert.equal(parts.parts.length, 8, `8 parts: ${JSON.stringify(parts.parts.map((p) => [p.left, p.top, p.right, p.bottom]))}`);
	const i = tight.letters.find((l) => l.char === 'i');
	const iPart = parts.parts.find((p) => i.center[0] >= p.left && i.center[0] < p.right);
	assert.ok(iPart && iPart.top <= i.box[1] + 3 && iPart.bottom >= i.box[3] - 3, `the dotted i is one part: ${JSON.stringify(iPart)} vs ${i.box}`);
	tight.letters.forEach((l) =>
		assert.equal(
			parts.parts.filter((p) => l.center[0] >= p.left && l.center[0] < p.right).length,
			1,
			`${l.char}: one part`
		)
	);
	await checkState('tight photo dialog');
	await shot('tight-1-photo-dialog');
	await page.locator('[data-anyink-photo-action="close"]').click();
	await settle(400);
	pass(`the tight photo (gaps about a quarter of the small-letter height) dropped on the board opens the photo dialog with 8 parts, one per letter; the dotted i one part (${iPart.left},${iPart.top} to ${iPart.right},${iPart.bottom}, its dot included)`);

	assert.deepEqual(errors, [], 'page errors');
	assert.deepEqual(failures, [], `${failures.length} result check(s) failed`);
	pass(`${states.length} screen states, each with the green buttons asked for, 0 banned words, 0 number inputs, nothing in capitals; no page errors`);
	console.log(`\nALL PASS (${results.length}). Screenshots: ${shots}`);
	printTimes();
} catch (error) {
	stopTask();
	printTimes();
	console.error(`FAIL ${error.stack || error}`);
	if (failures.length)
		console.error(`Result checks that failed (${failures.length}):\n  ${failures.join('\n  ')}`);
	if (page) await shot('FAIL').catch(() => {});
	console.error(`Screen states so far: ${JSON.stringify(states.map((s) => [s.label, s.greens]))}`);
	if (errors.length) console.error(`Page errors: ${JSON.stringify(errors.slice(0, 10))}`);
	process.exitCode = 1;
} finally {
	await browser.close();
	server.close();
}
