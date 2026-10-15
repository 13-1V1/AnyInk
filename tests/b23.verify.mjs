// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B3 integration, real-browser check (docs/UX-BEGINNER.md section 10, B2 and B3): the real
// app on a Vite dev server over src/, Chrome with a throwaway profile, files only in the browser's
// private file system. The photo steps use today's Trace panel and Auto-trace card; where B9's
// photo flow will place the photo, the page does what photo_flow.js will (placement/fit_lines.js
// placePart on the photo's parts, written into the letter's photo record, and the picked part as
// the traced area) with no Undo step, then presses Replace outlines.
//   Simple (?ui=simple):
//     1. new font; open a (no Undo step); add a handwriting photo of an a; place it; auto-trace
//        with Replace: one step, the a is automatic, whole numbers, fitted by the gap rule, its
//        body on the writing line, the photo still under the ink; the font check stays quiet
//     2. e and n from one photo: the same, the photo's one scale shared by both
//     3. 'aen naan' in the strip with Real font: no two neighbors overlap (measured row by row),
//        and the font face sets the line at the widths the font file holds
//     4. switching letters adds no Undo steps
//     5. from another letter, Undo twice: each press undoes the newest change, with at most one
//        view jump (the first moves to n)
//   The Simple run turns B9's 'photo' flag on in the page (B4 + B5 finalize: until B9, Simple
//   turns photos away and draws none), since it stands in for B9's photo flow; since B9 it also
//   takes the photo screens' route off (trace/photo_gate.js), so a photo picked in the Trace panel
//   stays the panel's (B8 + B9 finalize).
//   All tools (no flag, a fresh profile): the same steps behave as before B3: no refit, width 0,
//   the font check names the letter, "Navigated to" steps are kept.
// Writes numbers.json (widths, side spaces, writing-line offsets) beside the screenshots.
// Usage: node tests/b23.verify.mjs [output folder]   (default: the OS temp folder)
//        B23_A_PHOTO=path/to/a-photo.jpg traces a real photo of an a; otherwise the a is cut
//        from the placement fixture photo (src/anyink/placement/tests/fixtures/brennan-hand.png).
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { showTracePanel, toOverview } from './verify_standins.mjs';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const fixture = fileURLToPath(
	new URL('../src/anyink/placement/tests/fixtures/brennan-hand.png', import.meta.url)
);
const out = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b23'));
await mkdir(out, { recursive: true });

// The photos: an a (a real photo when given), and e and n written side by side (one photo)
const photos = {
	a: process.env.B23_A_PHOTO
		? {
				name: `a-photo${extname(process.env.B23_A_PHOTO)}`,
				bytes: await readFile(process.env.B23_A_PHOTO),
		  }
		: {
				name: 'a-photo.png',
				bytes: await crop(fixture, { left: 800, top: 150, width: 210, height: 250 }),
		  },
	en: {
		name: 'en-photo.png',
		bytes: await crop(fixture, { left: 440, top: 150, width: 390, height: 250 }),
	},
};

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(tmpdir(), 'anyink-b23-vite'),
	// No hot reload: an edit elsewhere in the repo must not reload the page mid-run.
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

const numbers = { simple: {}, all: {} };
let page;
let errors = [];
const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(out, `${name}.png`) });
const waitUntil = async (check, what, timeout = 15000) => {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (await check()) return;
		await page.waitForTimeout(150);
	}
	throw new Error(`timed out: ${what}`);
};

const LETTERS = {
	a: 'glyph-0x61',
	e: 'glyph-0x65',
	n: 'glyph-0x6E',
	b: 'glyph-0x62',
	c: 'glyph-0x63',
};

try {
	// ----------------------------------------------------------------------------------------
	// Simple
	// ----------------------------------------------------------------------------------------
	await withBrowser(async () => {
		await newFont('B23 Simple', '?ui=simple');
		// B4 + B5 finalize: this run stands in for B9's photo flow, so B9's 'photo' flag is on for
		// it (Simple turns photos away, and draws none, until B9 lands). B8 + B9 finalize: 'photo'
		// ships on, and a photo picked in Simple goes to the photo screens (trace/photo_gate.js);
		// this check keeps to the Trace panel's own import, which its stand-in places by hand, so
		// it takes that route off for the run (tests/b89.verify.mjs walks the real photo screens)
		await page.evaluate(async () => {
			(await import('/anyink/mode/features.js')).setFeaturesForTests({ photo: true });
			(await import('/anyink/trace/photo_gate.js')).setPhotoRoute(null);
		});
		let s = await state();
		assert.equal(s.mode, 'simple');
		assert.equal(s.steps.length, 0);

		// 1. a
		await openLetter('a');
		s = await state();
		assert.equal(s.steps.length, 0, `opening a adds no step: ${s.steps.join(' | ')}`);
		const a = await photoThenTrace('a', photos.a, ['a'], 's01-simple-a');
		assert.equal(a.letter.owner, 'auto');
		assert.ok(a.letter.whole, 'a: whole points and width');
		assert.ok(a.letter.width > 0);
		// Points are whole; a curve's far edge need not fall on a point, so the ink's edge can sit a
		// fraction of a unit off the rule
		assert.ok(
			near(a.letter.left, a.letter.rule.left),
			`a left space ${a.letter.left} vs rule ${a.letter.rule.left}`
		);
		assert.ok(
			near(a.letter.right, a.letter.rule.right),
			`a right space ${a.letter.right} vs rule ${a.letter.rule.right}`
		);
		assert.ok(
			Math.abs(a.letter.bottom) <= 0.02 * a.font.upm,
			`a sits on the writing line (${a.letter.bottom})`
		);
		// Where the part's left edge sits on the photo, within the 2 px the tracer's outline and
		// this page's own threshold can differ by
		assert.ok(
			Math.abs(a.letter.photoInkGap - a.placed.inkGapExpected) <= 2 * a.placed.scale,
			`the photo stays under the ink (${a.letter.photoInkGap} vs ${a.placed.inkGapExpected})`
		);
		assert.deepEqual(a.newSteps, ['Auto-traced'], a.stepsAll.join(' | '));
		numbers.simple.a = a;
		pass(
			`Simple a: automatic, width ${a.letter.width}, left ${a.letter.left} / right ${a.letter.right} (rule ${a.letter.rule.left} / ${a.letter.rule.right}; measured at ${a.letter.slant} degrees), ink bottom ${a.letter.bottom} (writing line 0), top ${a.letter.top} (small-letter line ${a.font.xHeight}), whole numbers, photo under the ink; one step "${a.title}"`
		);

		// 2. e and n from one photo
		await openLetter('e');
		const e = await photoThenTrace('e', photos.en, ['e'], 's02-simple-e');
		await openLetter('n');
		const n = await photoThenTrace('n', photos.en, ['e', 'n'], 's03-simple-n');
		for (const [char, r] of [
			['e', e],
			['n', n],
		]) {
			assert.equal(r.letter.owner, 'auto', `${char} automatic`);
			assert.ok(r.letter.whole, `${char}: whole numbers`);
			assert.ok(
				near(r.letter.left, r.letter.rule.left),
				`${char} left ${r.letter.left} vs ${r.letter.rule.left}`
			);
			assert.ok(
				near(r.letter.right, r.letter.rule.right),
				`${char} right ${r.letter.right} vs ${r.letter.rule.right}`
			);
			assert.ok(
				Math.abs(r.letter.bottom) <= 0.02 * r.font.upm,
				`${char} on the line (${r.letter.bottom})`
			);
			assert.equal(r.parts, 2, `${char}: the photo has 2 parts`);
		}
		numbers.simple.e = e;
		numbers.simple.n = n;
		const scaleSpread = Math.abs(n.placed.scale - e.placed.scale) / n.placed.scale;
		numbers.simple.enScaleSpread = scaleSpread;
		pass(
			`Simple e / n from one photo (${e.parts} parts): e width ${e.letter.width} (${
				e.letter.left
			} / ${e.letter.right}), n width ${n.letter.width} (${n.letter.left} / ${
				n.letter.right
			}); ink bottoms ${e.letter.bottom} and ${
				n.letter.bottom
			}; photo scale ${e.placed.scale.toFixed(3)} for e alone, ${n.placed.scale.toFixed(
				3
			)} once n was named (${(scaleSpread * 100).toFixed(1)} % apart; letters that must follow: ${
				n.follow.length ? n.follow.map((f) => f.char).join(', ') : 'none'
			}); same photo asset: ${e.placed.asset === n.placed.asset}`
		);

		// 3. the strip, Real font
		await openLetter('a');
		const strip = await realFont('aen naan');
		numbers.simple.strip = strip;
		assert.ok(
			strip.pairs.every((pair) => pair.gap >= 0),
			JSON.stringify(strip.pairs)
		);
		assert.ok(
			Math.abs(strip.measured - strip.expected) < 1,
			`line ${strip.measured} vs ${strip.expected}`
		);
		assert.equal(strip.check, '', `the font check is quiet: "${strip.check}"`);
		await shot('s04-simple-strip-real-font');
		pass(
			`Simple strip "aen naan", Real font: the face sets ${strip.measured.toFixed(
				1
			)} px (the font file's widths give ${strip.expected.toFixed(
				1
			)}); no pile-ups: gaps ${strip.pairs
				.map((p) => `${p.pair} ${p.gap}`)
				.join(', ')}; the font check line is empty`
		);

		// 4. switching letters adds no Undo steps
		const before = (await state()).steps.length;
		for (const char of ['b', 'c', 'e', 'a']) await openLetter(char);
		const after = (await state()).steps.length;
		assert.equal(after, before, `switching letters: ${before} -> ${after} steps`);
		numbers.simple.stepsWhileSwitching = { before, after };
		pass(`Simple: opening b, c, e and a leaves the Undo list at ${after} steps`);

		// 5. Undo twice from a: the newest changes, at most one view jump per press
		const presses = await undoPresses(2);
		numbers.simple.undo = presses;
		assert.equal(presses[0].result.itemID, LETTERS.n);
		assert.equal(presses[0].result.done, true);
		assert.equal(presses[0].navigations, 1, 'press 1 moves the view to n');
		assert.equal(presses[0].open, LETTERS.n);
		assert.equal(presses[0].shapes.n, 0, 'press 1 undid "traced n"');
		assert.ok(presses[1].navigations <= 1);
		assert.equal(presses[1].result.done, true);
		assert.ok(
			presses.every((press) => press.result.title && !/^Navigated/.test(press.result.title))
		);
		assert.equal(presses[1].shapes.e, e.letter.shapes, 'e untouched by two presses');
		assert.equal(presses[1].shapes.a, a.letter.shapes, 'a untouched by two presses');
		pass(
			`Simple Undo x2 from a: press 1 "${presses[0].result.title}" on n, ${presses[0].navigations} view jump; press 2 "${presses[1].result.title}" on ${presses[1].result.itemID}, ${presses[1].navigations} view jump; no navigation-only press`
		);

		assert.deepEqual(errors, [], errors.join('\n'));
		pass('Simple: no page errors');
	});

	// ----------------------------------------------------------------------------------------
	// All tools (today's behavior)
	// ----------------------------------------------------------------------------------------
	await withBrowser(async () => {
		await newFont('B23 All tools', '');
		let s = await state();
		assert.equal(s.mode, 'all');
		await openLetter('a');
		const a = await photoThenTrace('a', photos.a, ['a'], 'a01-all-a');
		assert.equal(a.letter.owner, undefined, 'All tools writes no owner flag');
		assert.equal(a.letter.width, 0, 'no refit: a traced letter keeps width 0, as before B3');
		await openLetter('e');
		const e = await photoThenTrace('e', photos.en, ['e'], 'a02-all-e');
		await openLetter('n');
		const n = await photoThenTrace('n', photos.en, ['e', 'n'], 'a03-all-n');
		numbers.all.a = a;
		numbers.all.e = e;
		numbers.all.n = n;
		const widths = [a, e, n].map((r) => r.letter.width);
		assert.deepEqual(widths, [
			a.placed.provisionalWidth,
			e.placed.provisionalWidth,
			n.placed.provisionalWidth,
		]);
		pass(
			`All tools: no refit and no owner flag; a, e and n keep the width they had before tracing (${widths.join(
				', '
			)}: 0 for a, the stand-in's picked-part width for e and n), ink where the photo put it (left ${
				a.letter.inkLeft
			}, ${e.letter.inkLeft}, ${n.letter.inkLeft})`
		);

		await openLetter('a');
		const strip = await realFont('aen naan');
		numbers.all.strip = strip;
		await shot('a04-all-strip-real-font');
		pass(
			`All tools strip "aen naan": gaps ${strip.pairs
				.map((p) => `${p.pair} ${p.gap}`)
				.join(', ')}; font check line: "${strip.check}"`
		);

		const before = (await state()).steps.length;
		for (const char of ['b', 'c', 'e', 'a']) await openLetter(char);
		const after = (await state()).steps;
		numbers.all.stepsWhileSwitching = { before, after: after.length, top: after.slice(0, 4) };
		assert.ok(after.length > before, 'All tools keeps its "Navigated to" steps');
		assert.ok(after[0].startsWith('Navigated to'));
		pass(
			`All tools: opening b, c, e and a adds ${
				after.length - before
			} "Navigated to" steps, as before`
		);

		const presses = await undoPresses(2);
		numbers.all.undo = presses;
		pass(
			`All tools Undo x2 from a: ${presses
				.map(
					(p, i) =>
						`press ${i + 1}: open ${p.open}, ${p.navigations} view jump(s), shapes a/e/n ${
							p.shapes.a
						}/${p.shapes.e}/${p.shapes.n}`
				)
				.join('; ')} (upstream's undo)`
		);
		assert.deepEqual(errors, [], errors.join('\n'));
		pass('All tools: no page errors');
	});

	await writeFile(resolve(out, 'numbers.json'), JSON.stringify(numbers, null, '\t') + '\n');
	console.log(`\nNumbers and screenshots: ${out}`);
} catch (error) {
	if (page) await shot('zz-failure').catch(() => {});
	await writeFile(resolve(out, 'numbers.json'), JSON.stringify(numbers, null, '\t') + '\n').catch(
		() => {}
	);
	console.error(error);
	if (errors.length) console.error(errors.join('\n'));
	process.exitCode = 1;
} finally {
	await server.close();
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/** Within half a font unit */
function near(value, target) {
	return Math.abs(value - target) <= 0.5;
}

async function crop(file, box) {
	return sharp(file).extract(box).png().toBuffer();
}

/** A fresh Chrome profile for one part of the run. */
async function withBrowser(run) {
	const profile = await mkdtemp(resolve(tmpdir(), 'anyink-b23-'));
	const context = await chromium.launchPersistentContext(profile, {
		channel: process.env.B23_BROWSER || 'chrome',
		headless: true,
		viewport: { width: 1600, height: 1000 },
	});
	page = context.pages()[0] || (await context.newPage());
	errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	try {
		await run();
	} finally {
		await context.close();
		await rm(profile, { recursive: true, force: true });
	}
}

async function newFont(name, search) {
	await page.goto(`${origin}/${search}`);
	await page.locator('#input__new-project-name').fill(name);
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });
	// Stand-ins for Chrome's file pickers: the photos sit in the private file system
	await page.evaluate(async (files) => {
		const folder = await navigator.storage.getDirectory();
		const pictures = await folder.getDirectoryHandle('Pictures', { create: true });
		window.__photos = {};
		for (const [key, { name, bytes }] of Object.entries(files)) {
			const handle = await pictures.getFileHandle(name, { create: true });
			const writable = await handle.createWritable();
			await writable.write(new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))]));
			await writable.close();
			window.__photos[key] = handle;
		}
		window.showOpenFilePicker = async () => [window.__photos[window.__nextPhoto]];
	}, Object.fromEntries(Object.entries(photos).map(([key, p]) => [key, { name: p.name, bytes: p.bytes.toString('base64') }])));
}

async function chooseFromNav(type, selector) {
	await page.locator(`button[data-nav-type="${type}"]`).click();
	await page.locator(`${selector}:visible`).click();
	await page.waitForTimeout(400);
}

async function openLetter(char) {
	const id = LETTERS[char];
	// B5: Simple has no page chooser (verify_standins.mjs)
	await toOverview(page);
	await page.locator(`glyph-tile[displayed-item-id="${id}"]`).click();
	await waitUntil(async () => (await state()).open === id, `open ${char}`);
	await page.waitForTimeout(400);
}

/** The editor, the Undo list and every letter of 'aen' as the font file will have them. */
function state() {
	return page.evaluate(async (letters) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { getMode } = await import('/anyink/mode/mode.js');
		const { inkBounds } = await import('/anyink/spacing/measure.js');
		const { fittedSides, spacingBounds } = await import('/anyink/spacing/auto_space.js');
		const { getTrace } = await import('/anyink/trace/trace_model.js');
		const font = editor.project.settings.font;
		const glyphs = {};
		Object.entries(letters).forEach(([char, id]) => {
			const item = editor.project.glyphs[id];
			if (!item) return;
			const ink = inkBounds(item);
			const trace = getTrace(item);
			const coords = item.shapes.flatMap((shape) =>
				(shape.pathPoints || []).flatMap((p) => [p.p.x, p.p.y, p.h1.x, p.h1.y, p.h2.x, p.h2.y])
			);
			const fit = ink ? fittedSides(item, editor.project) : null;
			// The sides spacing measures (the body, slant taken out; B3 sides.js): for an upright
			// letter with nothing hanging, the ink box
			const sides = ink ? spacingBounds(item, editor.project) : null;
			glyphs[char] = {
				shapes: item.shapes.length,
				width: item.advanceWidth,
				owner: item.anyink?.spacing,
				left: sides ? Math.round(sides.xMin * 100) / 100 : null,
				right: sides ? Math.round((item.advanceWidth - sides.xMax) * 100) / 100 : null,
				inkLeft: ink ? Math.round(ink.xMin * 100) / 100 : null,
				slant: fit ? Math.round(fit.angle * 10) / 10 : null,
				bottom: ink ? Math.round(ink.yMin * 100) / 100 : null,
				top: ink ? Math.round(ink.yMax * 100) / 100 : null,
				rule: fit ? { ...fit.target, kinds: `${fit.kinds.left}/${fit.kinds.right}` } : null,
				whole: coords.every(Number.isInteger) && Number.isInteger(item.advanceWidth),
				photoInkGap: trace && ink ? Math.round((ink.xMin - trace.x) * 100) / 100 : null,
				trace: trace ? { x: trace.x, y: trace.y, scale: trace.scale, asset: trace.asset } : null,
			};
		});
		return {
			mode: getMode(),
			open: editor.selectedItemID,
			steps: editor.history.queue.map((entry) => entry.title),
			redo: editor.history.redoQueue.length,
			font: {
				upm: font.upm,
				xHeight: font.xHeight,
				capHeight: font.capHeight,
				ascent: font.ascent,
				descent: font.descent,
			},
			glyphs,
		};
	}, LETTERS);
}

/**
 * Adds a photo to the open letter (Trace panel, Choose an image...), places it the way B9's photo
 * flow will, then Start auto-trace and Replace outlines.
 * @param {String} char - the open letter
 * @param {Object} photo
 * @param {Array<String>} named - letters named from this photo so far, in reading order of its parts
 */
async function photoThenTrace(char, photo, named, shotName) {
	const key = photo === photos.a ? 'a' : 'en';
	await page.evaluate((k) => (window.__nextPhoto = k), key);
	// B5: Simple draws no panel; the real Trace panel stands in for B9's photo card
	await showTracePanel(page);
	await page.locator('button', { hasText: 'Choose an image...' }).first().click();
	await waitUntil(
		() => page.locator('button', { hasText: 'Start auto-trace' }).first().isVisible(),
		'photo added'
	);
	await page.waitForTimeout(500);
	const stepsBefore = (await state()).steps.length;

	const placed = await page.evaluate(
		async ({ char, named, letters }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { getTrace, setTrace } = await import('/anyink/trace/trace_model.js');
			const { toGray, otsuThreshold, thresholdGlobal } = await import(
				'/anyink/autotrace/binarize.js'
			);
			const { findParts } = await import('/anyink/placement/tests/ink_parts_lite.js');
			const { placePart, followPlan } = await import('/anyink/placement/fit_lines.js');
			const item = editor.selectedItem;
			const trace = getTrace(item);
			const blob = editor.assets.get(trace.asset).blob;
			const bitmap = await createImageBitmap(blob);
			const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			ctx.drawImage(bitmap, 0, 0);
			const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
			const gray = toGray(image);
			const mask = thresholdGlobal(gray, image.width, image.height, otsuThreshold(gray));
			// Parts that could be letters (a ruling line across the page is not one)
			const parts = findParts(mask, image.width, image.height).filter(
				(part) => part.right - part.left < 0.8 * image.width
			);
			const photo = { asset: trace.asset, parts, uses: {} };
			named.forEach((name, i) => {
				if (parts[i]) photo.uses[parts[i].id] = { char: name, itemId: letters[name] };
			});
			const part = parts[named.indexOf(char)];
			const font = editor.project.settings.font;
			const at = placePart(photo, part.id, font, { left: 0 });
			// The picked part is the area traced (B9): the glyph box holds just that part while
			// it traces; the refit (Simple) gives the letter its real width in the same step
			const provisionalWidth = Math.ceil((part.right - part.left) * at.scale);
			setTrace(item, { ...trace, x: at.x, y: at.y, scale: at.scale });
			const several = parts.length > 1;
			if (several) item.advanceWidth = provisionalWidth;
			editor.publish('traceLayer', item);
			editor.publish('currentItem', item);
			const follow = followPlan(photo, font, {
				except: part.id,
				getItem: (id) => {
					const other = editor.project.glyphs[id];
					// Use it would set photoFit (B9); the stand-in counts a letter traced from this
					// photo with no change since as untouched
					return other
						? { ...other, anyink: { ...other.anyink, photoFit: { asset: trace.asset, part: 'x' } } }
						: null;
				},
			});
			return {
				asset: trace.asset,
				parts: parts.length,
				partPx: { left: part.left, top: part.top, right: part.right, bottom: part.bottom },
				x: at.x,
				y: at.y,
				scale: at.scale,
				seat: at.seat,
				provisionalWidth: several ? provisionalWidth : 0,
				inkGapExpected: null,
				follow: follow.map((f) => ({ char: f.char, resized: f.resized, reseated: f.reseated })),
			};
		},
		{ char, named, letters: LETTERS }
	);
	await page.waitForTimeout(300);
	await shot(`${shotName}-photo-placed`);

	await page.locator('button', { hasText: 'Start auto-trace' }).first().click();
	const replace = page.locator('button', { hasText: 'Replace outlines' }).first();
	await replace.waitFor();
	await waitUntil(() => replace.isEnabled(), 'auto-trace preview', 30000);
	await replace.click();
	await waitUntil(
		async () => ((await state()).glyphs[char]?.shapes || 0) > 0,
		'traced shapes',
		30000
	);
	await page.waitForTimeout(2600); // the font check runs 2 s after the last change
	const s = await state();
	const letter = s.glyphs[char];
	// The photo keeps its place under the ink: where the part's left edge lands, in font units
	placed.inkGapExpected = Math.round(placed.partPx.left * placed.scale * 100) / 100;
	const check = await page.evaluate(() => {
		const line = document.querySelector('.preview-strip__check');
		return line && getComputedStyle(line).display !== 'none' ? line.innerText.trim() : '';
	});
	await shot(`${shotName}-traced`);
	const newSteps = s.steps.slice(0, s.steps.length - stepsBefore).map((t) => t.replace(/ .*/, ''));
	return {
		letter,
		placed,
		font: s.font,
		parts: placed.parts,
		follow: placed.follow,
		title: s.steps[0],
		newSteps,
		stepsAll: s.steps,
		check,
	};
}

/** Types into the strip, turns on Real font, and measures the line. */
async function realFont(text) {
	await page.locator('.preview-strip__text').fill(text);
	await page.evaluate(() => {
		window.__fontStatus = [];
		document.addEventListener(
			'font-status',
			(event) => window.__fontStatus.push(event.detail),
			true
		);
	});
	// B4 + B5 integration (UX-BEGINNER 6.2 Strip): Real font is a More tools switch; in Simple the
	// strip goes to All tools for the measurement (the font file is the same in both modes) and
	// comes back after it
	const simple = await page.evaluate(async () => {
		const mode = await import('/anyink/mode/mode.js');
		if (!mode.isSimpleMode()) return false;
		mode.setMode('all');
		return true;
	});
	const toggle = page.locator('.preview-strip__toggle', { hasText: 'Real font' });
	const on = await toggle
		.locator('input')
		.isChecked()
		.catch(() => false);
	if (!on) await toggle.click();
	await waitUntil(() => page.evaluate(() => window.__fontStatus.length > 0), 'font status', 20000);
	await page.waitForTimeout(2600);
	const measured = await page.evaluate(
		async ({ text, letters }) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { inkBounds } = await import('/anyink/spacing/measure.js');
			const { closestGap } = await import('/anyink/spacing/tests/fixtures.js');
			const { spaceWidth } = await import('/anyink/fontcheck/export_list.js');
			const preview = document.querySelector('preview-strip font-preview');
			const face = preview.currentFontFace;
			await face.loaded;
			const node = preview.shadowRoot.querySelector('.font-preview__text');
			const size = parseFloat(getComputedStyle(node).fontSize);
			const ctx = new OffscreenCanvas(10, 10).getContext('2d');
			ctx.font = `${size}px "${face.family}"`;
			const upm = editor.project.settings.font.upm;
			const glyph = (ch) => editor.project.glyphs[letters[ch]] || null;
			const advance = (ch) => {
				const item = glyph(ch);
				// A font with no space gets the exporter's (a quarter of the letter box)
				if (ch === ' ')
					return editor.project.glyphs['glyph-0x20']?.advanceWidth ?? spaceWidth(editor.project);
				return item ? Math.round(item.advanceWidth) : editor.project.defaultAdvanceWidth;
			};
			const chars = [...text];
			const expected = (chars.reduce((sum, ch) => sum + advance(ch), 0) * size) / upm;
			const pairs = [];
			for (let i = 0; i + 1 < chars.length; i++) {
				const [l, r] = [chars[i], chars[i + 1]];
				if (l === ' ' || r === ' ') continue;
				const li = inkBounds(glyph(l));
				const ri = inkBounds(glyph(r));
				// How close the two inks come when set side by side, row by row (a hanging dot or
				// tail, or a leaning hand, can reach past the other's box without touching it);
				// box: the gap between their ink boxes, for the record (no gap fixes in this font)
				const gap = Math.round(closestGap(glyph(l), glyph(r)) ?? Infinity);
				const box = Math.round(advance(l) - li.xMax + ri.xMin);
				pairs.push({ pair: `${l}${r}`, gap, box });
			}
			const line = document.querySelector('.preview-strip__check');
			return {
				size,
				status: window.__fontStatus.at(-1),
				measured: ctx.measureText(text).width,
				expected,
				pairs,
				check: line && getComputedStyle(line).display !== 'none' ? line.innerText.trim() : '',
			};
		},
		{ text, letters: LETTERS }
	);
	if (simple) {
		await page.evaluate(async () => (await import('/anyink/mode/mode.js')).setMode('simple'));
	}
	return measured;
}

/** Ctrl+Z `count` times, away from any text field; what each press did. */
async function undoPresses(count) {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		window.__navigations = 0;
		window.__undoResults = [];
		const navigate = editor.navigate.bind(editor);
		editor.navigate = (...args) => {
			window.__navigations++;
			return navigate(...args);
		};
		const restore = editor.history.restoreState.bind(editor.history);
		editor.history.restoreState = (...args) => {
			const result = restore(...args);
			window.__undoResults.push(result || null);
			return result;
		};
	});
	const presses = [];
	for (let i = 0; i < count; i++) {
		await page.evaluate(() => {
			document.activeElement?.blur?.();
			window.__navigations = 0;
		});
		await page.keyboard.press('Control+z');
		await page.waitForTimeout(600);
		const s = await state();
		const press = await page.evaluate(() => ({
			navigations: window.__navigations,
			result: window.__undoResults.at(-1),
		}));
		presses.push({
			...press,
			open: s.open,
			steps: s.steps.length,
			shapes: {
				a: s.glyphs.a?.shapes ?? 0,
				e: s.glyphs.e?.shapes ?? 0,
				n: s.glyphs.n?.shapes ?? 0,
			},
		});
		await shot(`${s.mode === 'simple' ? 's' : 'a'}0${5 + i}-${s.mode}-after-undo-${i + 1}`);
	}
	return presses;
}
