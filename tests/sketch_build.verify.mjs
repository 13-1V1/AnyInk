// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S3 (docs/SKETCH.md sections 3, 4, 6, 7 and 11): real-Chrome check that a sketch becomes real ink
// and stays in sync, in the real app. Starts its own Vite server on src/, makes a new font in
// Simple, turns the 'sketch' flag on from the page (mode/features.js setFeaturesForTests: it stays
// off in the app until S9), and then, with the mouse and keyboard as he would:
//   - an empty letter shows the door with [Sketch it] green; sketches small n (stem, arch, leg),
//     small o (Circle between two lines), small s (Spline), Capital A (legs and a bar), small v,
//     small i (stem and its dot) and Capital B (a Rectangle and its middle bar); each gets built
//     ink whose edges sit on the lines within 1 unit, no "off the line" or size check, and ink
//     that is exactly what its sketch builds (spacing moved both together)
//   - drags the Thickness slider on n and presses the Next line's [Use on all]: every sketched
//     letter rebuilt at the new thickness, still on the lines, ONE Undo step (Undo, Redo)
//   - clears o and B and sketches them as outlines (the door's outline link): 1 and 2 holes
//   - a letter drawn too small gets [Match size], one drawn above the line [Sit on the line],
//     the small-letter line is moved up, s is flipped: sketch and ink stay together through each,
//     and through Undo and Redo
//   - Try it shows the sketched letters (no stand-ins); Use in Word and the File menu's OTF
//     export write fonts whose sketched letters have no overlapping or self-crossing outlines,
//     holes turned the right way (read back with font-flux-js); All tools' left-edge move keeps
//     the sketch; the work file saved and opened again keeps every sketch and its ink.
// Prints PASS / FAIL lines; exits 1 on any FAIL.
// Usage: node tests/sketch_build.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { FontFlux } from 'font-flux-js';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { crossesItself, loopsCross } from '../src/anyink/sketch/build_outline.js';
import { flattenCubics, outlineOrder, signedArea } from '../src/anyink/sketch/outline_order.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-sketch-build'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-sketch-build-'));

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
	if (ok) {
		passes++;
		console.log(`PASS ${label}${detail ? `: ${detail}` : ''}`);
	} else {
		failures++;
		console.log(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
	}
	return ok;
}

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
const LETTERS = ['n', 'o', 's', 'A', 'v', 'i', 'B'];

// ----------------------------------------------------------------------------------------------
// Page helpers (everything the page is asked runs through the app's own modules)
// ----------------------------------------------------------------------------------------------

let page = null;
const settle = (ms = 250) => page.waitForTimeout(ms);

async function shot(name) {
	const path = resolve(shots, `${name}.png`);
	await page.screenshot({ path });
	shotList.push(`${name}.png`);
}

const setFlag = (on) =>
	page.evaluate(async (value) => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: value });
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.navigate();
	}, on);

/** Opens a letter the way the board does when its key is typed */
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
	await settle(300);
}

const viewOf = async () => {
	await page.waitForFunction(
		() => !!document.querySelector('edit-canvas')?.canvas?.isConnected,
		null,
		{ timeout: 10000 }
	);
	return page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const canvas = document.querySelector('edit-canvas').canvas;
		const r = canvas.getBoundingClientRect();
		const { guideLines } = await import('/anyink/placement/classes.js');
		const { edgeThickness } = await import('/anyink/sketch/edge_rule.js');
		const { sketchThickness } = await import('/anyink/sketch/model.js');
		const font = editor.project.settings.font;
		return {
			left: r.left,
			top: r.top,
			view: { ...editor.view },
			lines: guideLines(font),
			r: edgeThickness(font, sketchThickness(editor.project)) / 2,
		};
	});
};

const screenOf = (v, x, y) => ({
	x: v.left + v.view.dx + x * v.view.dz,
	y: v.top + v.view.dy - y * v.view.dz,
});

async function moveTo(v, x, y, steps = 6) {
	const p = screenOf(v, x, y);
	await page.mouse.move(p.x, p.y, { steps });
}

async function clickAt(v, x, y, { steps = 6, pause = 120 } = {}) {
	await moveTo(v, x, y, steps);
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(pause);
}

async function enter() {
	await page.keyboard.press('Enter');
	await settle(300);
}

/** History: the steps he sees, newest first */
const titles = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.history.queue
			.filter((e) => !e.navigation && !/^_/.test(e.title))
			.map((e) => e.title);
	});

/**
 * One letter's sketch and ink: is the sketch active, does the stored hash match the ink, how far
 * the ink is from what the sketch builds now, the ink box, the lines, its checks.
 */
const letterReport = (char) =>
	page.evaluate(async (id) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const project = editor.project;
		const item = project.getItem(id);
		const { sketchOf, isSketchActive } = await import('/anyink/sketch/model.js');
		const { builtShapes, builtMatches } = await import('/anyink/sketch/sketch_record.js');
		const { freshInk, outlinesApart } = await import('/anyink/sketch/tests/follow_helpers.js');
		const { inkBounds } = await import('/anyink/spacing/measure.js');
		const { guideLines } = await import('/anyink/placement/classes.js');
		const { checkLetter } = await import('/anyink/checks/checks.js');
		const { isAutomatic } = await import('/anyink/spacing/owner.js');
		const sketch = item ? sketchOf(item) : null;
		if (!item || !sketch) return { missing: true };
		const built = builtShapes(item, sketch.key);
		let apart = null;
		try {
			apart = outlinesApart(built, freshInk(item, project));
		} catch (error) {
			apart = `error ${error.message}`;
		}
		const box = inkBounds(item);
		const font = project.settings.font;
		const checks = (checkLetter(item, { font }) || []).map((c) => c.id);
		return {
			active: isSketchActive(sketch),
			setAside: !!sketch.setAside,
			way: sketch.way,
			pieces: sketch.pieces.length,
			thickness: sketch.thickness,
			shapes: item.shapes.length,
			built: built.length,
			others: item.shapes.length - built.length,
			hash: builtMatches(item),
			apart,
			box,
			lines: guideLines(font),
			checks,
			automatic: isAutomatic(item),
			hasSketchKey: !!sketch.key,
		};
	}, ID(char));

const near = (a, b, tolerance = 1.01) => Math.abs(a - b) <= tolerance;
/** The distance from y to the nearest of the targets */
const off = (y, targets) => Math.min(...targets.map((t) => Math.abs(y - t)));

/** Sketch and ink together: active, hash, and the ink is what the sketch builds (<= 1 unit) */
function inSync(label, rep) {
	return check(
		`${label}: sketch and ink together`,
		!rep.missing && rep.active && rep.hash && typeof rep.apart === 'number' && rep.apart <= 1,
		rep.missing
			? 'no sketch'
			: `active ${rep.active}, hash ${rep.hash}, ink ${
					typeof rep.apart === 'number' ? rep.apart.toFixed(2) : rep.apart
			  } units from a fresh build, ${rep.built} built shapes`
	);
}

/** The ink's bottom and top against the lines they should touch (round ones with overshoot) */
function onLines(label, rep, bottoms, tops) {
	const b = off(rep.box.yMin, bottoms);
	const t = off(rep.box.yMax, tops);
	return check(
		`${label}: ink edges on the lines (bottom ${b.toFixed(2)}, top ${t.toFixed(2)} off)`,
		b <= 1.01 && t <= 1.01,
		`ink ${Math.round(rep.box.yMin * 100) / 100} to ${Math.round(rep.box.yMax * 100) / 100}`
	);
}

const coachButton = () =>
	page.evaluate(() => {
		const coach = document.querySelector('anyink-coach');
		const button = coach?.querySelector('.anyink-coach__button');
		return {
			sentence: coach?.querySelector('.anyink-coach__sentence')?.textContent || '',
			button: button && !button.hidden ? button.textContent : '',
			quiet: (() => {
				const q = coach?.querySelector('.anyink-coach__quiet');
				return q && !q.hidden ? q.textContent : '';
			})(),
		};
	});

async function waitCoach(re, timeout = 8000) {
	const end = Date.now() + timeout;
	let now = await coachButton();
	while (Date.now() < end) {
		now = await coachButton();
		if (re.test(now.button)) return now;
		await page.waitForTimeout(150);
	}
	return now;
}

async function undoButton(kind = 'undo') {
	await page.locator(`[data-anyink-control="${kind}"]`).click();
	await settle(500);
}

async function fineTuneAction(action) {
	await page.evaluate(async () =>
		(await import('/anyink/letter/view_switches.js')).setFineTuneOpen(true)
	);
	await settle(200);
	const options = page.locator('[data-anyink-toggle="shapeOptions"]');
	if ((await options.getAttribute('aria-expanded')) !== 'true') await options.click();
	await settle(150);
	await page.locator(`[data-anyink-action="${action}"]`).click();
	await settle(500);
}

// ----------------------------------------------------------------------------------------------
// Font file reading (Node side)
// ----------------------------------------------------------------------------------------------

function commandPoints(contour) {
	const points = [];
	let at = null;
	contour.forEach((cmd) => {
		if (cmd.type === 'M' || cmd.type === 'L') {
			at = [cmd.x, cmd.y];
			points.push(at);
		} else if (cmd.type === 'C') {
			points.push(
				...flattenCubics([[at, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y]]]).slice(1)
			);
			at = [cmd.x, cmd.y];
		} else if (cmd.type === 'Q') {
			const c1 = [at[0] + (2 / 3) * (cmd.x1 - at[0]), at[1] + (2 / 3) * (cmd.y1 - at[1])];
			const c2 = [cmd.x + (2 / 3) * (cmd.x1 - cmd.x), cmd.y + (2 / 3) * (cmd.y1 - cmd.y)];
			points.push(...flattenCubics([[at, c1, c2, [cmd.x, cmd.y]]]).slice(1));
			at = [cmd.x, cmd.y];
		}
	});
	const first = points[0];
	const last = points.at(-1);
	if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();
	return points;
}

function overlapProblems(contours) {
	const loops = contours.map(commandPoints).filter((points) => points.length >= 3);
	const problems = [];
	loops.forEach((loop, i) => {
		if (crossesItself(loop)) problems.push(`outline ${i} crosses itself`);
		for (let j = i + 1; j < loops.length; j++) {
			if (loopsCross(loop, loops[j])) problems.push(`outlines ${i} and ${j} cross`);
		}
	});
	outlineOrder(loops.map((points, id) => ({ id, points }))).forEach((entry) => {
		if (entry.reverse) problems.push(`outline ${entry.id} turns the wrong way at depth ${entry.depth}`);
	});
	return problems;
}

const holesOf = (contours) =>
	contours.map(commandPoints).filter((points) => signedArea(points) < 0).length;

function fontReport(label, bytes, chars) {
	const font = FontFlux.open(bytes);
	const glyphOf = (char) => font.glyphs.find((glyph) => glyph.unicode === char.charCodeAt(0));
	const report = {};
	chars.forEach((char) => {
		const contours = glyphOf(char)?.contours || [];
		report[char] = { contours: contours.length, holes: holesOf(contours), problems: overlapProblems(contours) };
	});
	const bad = chars.filter((char) => !report[char].contours || report[char].problems.length);
	check(
		`${label}: every sketched letter is in the file with no overlapping or self-crossing outline, holes turned right`,
		bad.length === 0,
		chars
			.map((c) => `${c} ${report[c].contours}/${report[c].holes}${report[c].problems.length ? ` [${report[c].problems.join('; ')}]` : ''}`)
			.join(', ')
	);
	return report;
}

async function opfsFiles() {
	return page.evaluate(async () => {
		const out = [];
		if (!window.__fontsDir) return out;
		for await (const name of window.__fontsDir.keys()) out.push(name);
		return out.sort();
	});
}

async function opfsBytes(name) {
	const bytes = await page.evaluate(async (fileName) => {
		const file = await (await window.__fontsDir.getFileHandle(fileName)).getFile();
		return [...new Uint8Array(await file.arrayBuffer())];
	}, name);
	return new Uint8Array(bytes).buffer;
}

// ----------------------------------------------------------------------------------------------
// The run
// ----------------------------------------------------------------------------------------------

try {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	await context.addInitScript(() => {
		window.showSaveFilePicker = async () => {
			throw new DOMException('The user aborted a request.', 'AbortError');
		};
		// Chrome's folder picker: "My Fonts" in the browser's private file area
		window.showDirectoryPicker = async () => {
			const root = await navigator.storage.getDirectory();
			const dir = await root.getDirectoryHandle('My Fonts', { create: true });
			window.__fontsDir = dir;
			return dir;
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
	await field.fill('Sketch Build');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await settle(500);
	await setFlag(true);

	// ---- the empty letter's door ------------------------------------------------------------
	await openLetter('n');
	const door = await page.evaluate(async () => {
		const box = document.querySelector('[data-anyink-overlay]');
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const greens = [...document.querySelectorAll('.anyink-primary')]
			.filter((el) => el.checkVisibility())
			.map((el) => el.textContent.trim());
		return {
			shown: !!box && box.checkVisibility(),
			first: box?.querySelector('[data-anyink-overlay-action]')?.dataset.anyinkOverlayAction,
			greens,
			tool: editor.selectedTool,
		};
	});
	check(
		'door: an empty letter shows [Sketch it] first, the one green button, on the Line',
		door.shown && door.first === 'sketchIt' && door.greens.length === 1 && /Sketch it/.test(door.greens[0]) && door.tool === 'sketchLine',
		JSON.stringify(door)
	);
	await shot('01-door-n');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(200);

	// ---- small n: stem, arch, leg ------------------------------------------------------------
	let v = await viewOf();
	let { lines } = v;
	const over = lines.overshoot;
	await clickAt(v, 160, lines.writing + 2);
	await clickAt(v, 160, lines.small - 2);
	await page.keyboard.press('a');
	await settle(80);
	await moveTo(v, 170, lines.small - 4, 2);
	await moveTo(v, 260, lines.small - 4, 8);
	await clickAt(v, 640, lines.small - 260, { steps: 10 });
	// the bend just under the small-letter line: the arch's top snaps onto it (arc_snap.js)
	await clickAt(v, 400, lines.small - 6, { steps: 10 });
	await page.keyboard.press('l');
	await settle(80);
	const legEnd = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sketchToolHandler } = await import('/anyink/sketch/tools/tool_route.js');
		const tool = sketchToolHandler(editor.selectedTool);
		return { ...tool.sketch.points[tool.lastId()], dir: tool.dir };
	});
	const dir = (legEnd.dir * Math.PI) / 180;
	const along = (d) => ({ x: legEnd.x + d * Math.cos(dir), y: legEnd.y + d * Math.sin(dir) });
	const a1 = along(12);
	const a2 = along(60);
	await moveTo(v, a1.x, a1.y, 2);
	await moveTo(v, a2.x, a2.y, 6);
	const reach = Math.abs(Math.sin(dir)) > 0.2 ? (lines.writing + 4 - legEnd.y) / Math.sin(dir) : 600;
	const foot = along(reach);
	await clickAt(v, foot.x, foot.y, { steps: 10 });
	await enter();
	let rep = await letterReport('n');
	const nArc = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const sketch = editor.project.getItem('glyph-0x6E').anyink.sketch;
		return sketch.pieces[0].parts.map((p) => `${p.type}${p.top ? `@${p.top.on}` : ''}`).join(',');
	});
	check('n: one piece, ink built from it', rep.pieces === 1 && rep.built >= 1 && rep.others === 0, `${nArc}; ${rep.built} built shapes`);
	check("n: the arch's top snapped to the small-letter line is tagged on the part (S3)", /arc@small/.test(nArc), nArc);
	onLines('n', rep, [lines.writing], [lines.small, lines.small + over]);
	inSync('n', rep);
	check('n: no "off the line" or size check on a freshly sketched letter', !rep.checks.includes('offLine') && !rep.checks.includes('size'), rep.checks.join(',') || 'none');
	check('n: spacing is automatic (Simple), so the step fitted it', rep.automatic);
	await shot('02-n-built');

	// ---- small o: Circle between the writing and small-letter lines ---------------------------------
	await openLetter('o');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await page.keyboard.press('c');
	await clickAt(v, 360, lines.writing + 1);
	await clickAt(v, 400, lines.small - 1);
	await settle(300);
	rep = await letterReport('o');
	check('o: a ring (ink and its hole)', rep.built === 2, `${rep.built} built shapes`);
	onLines('o', rep, [lines.writing - over], [lines.small + over]);
	inSync('o', rep);
	check('o: no "off the line" or size check', !rep.checks.includes('offLine') && !rep.checks.includes('size'), rep.checks.join(',') || 'none');

	// ---- small s: Spline ----------------------------------------------------------------------------
	await openLetter('s');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await page.keyboard.press('s');
	for (const [x, y] of [
		[470, lines.small - 170],
		[300, lines.small - 4],
		[150, lines.small - 250],
		[450, 330],
		[300, lines.writing + 4],
		[140, 150],
	])
		await clickAt(v, x, y);
	await enter();
	rep = await letterReport('s');
	check('s: one spline piece with built ink', rep.pieces === 1 && rep.built >= 1, `${rep.built} built shapes`);
	onLines('s', rep, [lines.writing - over, lines.writing], [lines.small + over, lines.small]);
	inSync('s', rep);

	// ---- Capital A: legs and a bar ------------------------------------------------------------------
	await openLetter('A');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await clickAt(v, 120, lines.writing + 2);
	await clickAt(v, 520, lines.capitals - 2);
	await clickAt(v, 920, lines.writing + 2);
	await enter();
	v = await viewOf();
	const legs = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const sketch = editor.project.getItem('glyph-0x41').anyink.sketch;
		const p = sketch.points;
		const [l1, l2] = sketch.pieces[0].parts;
		return { a: p[l1.from], apex: p[l1.to], b: p[l2.to] };
	});
	const legAt = (end, t) => ({ x: end.x + (legs.apex.x - end.x) * t, y: end.y + (legs.apex.y - end.y) * t });
	const barL = legAt(legs.a, 0.3);
	const barR = legAt(legs.b, 0.3);
	await clickAt(v, barL.x, barL.y);
	await clickAt(v, barR.x, barR.y);
	await enter();
	rep = await letterReport('A');
	check('A: two pieces (legs, bar) with built ink', rep.pieces === 2 && rep.built >= 2, `${rep.pieces} pieces, ${rep.built} built`);
	onLines('A', rep, [lines.writing], [lines.capitals]);
	inSync('A', rep);
	check('A: no "off the line" or size check', !rep.checks.includes('offLine') && !rep.checks.includes('size'), rep.checks.join(',') || 'none');
	await shot('03-A-built');

	// ---- small v: three clicks, left open ---------------------------------------------------------
	await openLetter('v');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await clickAt(v, 100, lines.small - 2);
	await clickAt(v, 320, lines.writing + 2);
	await clickAt(v, 540, lines.small - 2);
	await enter();
	rep = await letterReport('v');
	onLines('v', rep, [lines.writing], [lines.small]);
	inSync('v', rep);
	check('v: no "off the line" or size check', !rep.checks.includes('offLine') && !rep.checks.includes('size'), rep.checks.join(',') || 'none');

	// ---- small i: stem and its dot ---------------------------------------------------------------------
	await openLetter('i');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await clickAt(v, 200, lines.writing + 2);
	await clickAt(v, 200, lines.small - 2);
	await enter();
	v = await viewOf();
	const iStem = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const sketch = editor.project.getItem('glyph-0x69').anyink.sketch;
		return sketch.points[sketch.pieces[0].parts[0].from].x;
	});
	await clickAt(v, iStem, lines.small + 260);
	await enter();
	rep = await letterReport('i');
	const iTitles = await titles();
	check('i: the stem and its dot are two pieces, the dot its own step', rep.pieces === 2 && rep.built >= 2 && /dot on small i/.test(iTitles[0]), `${rep.pieces} pieces; "${iTitles[0]}"`);
	check('i: the stem sits on the writing line', near(rep.box.yMin, lines.writing), `ink bottom ${rep.box.yMin}`);
	inSync('i', rep);
	check('i: the dot is no speck', !rep.checks.includes('specks'), rep.checks.join(',') || 'none');

	// ---- Capital B: a Rectangle and its middle bar (Centerline) ---------------------------------------
	await openLetter('B');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	await page.keyboard.press('r');
	await clickAt(v, 140, lines.writing + 2);
	await clickAt(v, 620, lines.capitals - 2);
	await settle(300);
	v = await viewOf();
	const box = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const sketch = editor.project.getItem('glyph-0x42').anyink.sketch;
		const xs = Object.values(sketch.points).map((p) => p.x);
		const ys = Object.values(sketch.points).map((p) => p.y);
		return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
	});
	await page.keyboard.press('l');
	const midY = Math.round((box.y0 + box.y1) / 2);
	await clickAt(v, box.x0, midY);
	await clickAt(v, box.x1, midY);
	await enter();
	rep = await letterReport('B');
	check('B (Centerline): a box and a bar, built', rep.pieces === 2 && rep.built >= 2, `${rep.pieces} pieces, ${rep.built} built`);
	onLines('B', rep, [lines.writing], [lines.capitals]);
	inSync('B', rep);
	await shot('04-B-centerline');

	// ---- spacing moved them all with their sketches ------------------------------------------------------
	const all = {};
	for (const char of LETTERS) all[char] = await letterReport(char);
	check(
		'spacing: every sketched letter is automatic and its sketch still matches its ink after the fit',
		LETTERS.every((c) => all[c].automatic && all[c].active && all[c].hash && all[c].apart <= 1),
		LETTERS.map((c) => `${c} ${typeof all[c].apart === 'number' ? all[c].apart.toFixed(2) : all[c].apart}`).join(', ')
	);

	// ---- thickness on n, then Use on all --------------------------------------------------------------------
	await openLetter('n');
	const before = (await letterReport('n')).thickness;
	const slider = page.locator('.anyink-sketch-thickness__slider');
	await slider.waitFor({ timeout: 5000 });
	const range = await slider.evaluate((el) => ({ min: Number(el.min), max: Number(el.max), value: Number(el.value), ...el.getBoundingClientRect().toJSON() }));
	const xFor = (value) => range.left + 8 + ((value - range.min) / (range.max - range.min)) * (range.width - 16);
	const yMid = range.top + range.height / 2;
	const stepsBefore = (await titles()).length;
	await page.mouse.move(xFor(range.value), yMid);
	await page.mouse.down();
	for (let i = 1; i <= 12; i++) {
		await page.mouse.move(xFor(range.value) + ((xFor(range.value + 50) - xFor(range.value)) * i) / 12, yMid);
		await page.waitForTimeout(16);
	}
	await page.mouse.up();
	await settle(500);
	const nThick = await letterReport('n');
	const t1 = await titles();
	check(
		'thickness: one drag is ONE step "changed the thickness of small n" and the ink is rebuilt thicker',
		t1.length === stepsBefore + 1 && /changed the thickness of small n/.test(t1[0]) && nThick.thickness > before,
		`${before} -> ${nThick.thickness}; "${t1[0]}"`
	);
	onLines('n after the thickness', nThick, [lines.writing], [lines.small, lines.small + over]);
	inSync('n after the thickness', nThick);
	const offer = await waitCoach(/Use on all/);
	check(
		'thickness: the Next line asks to use it on all the sketched letters, [Use on all] green and [Just this one] quiet',
		/Use on all/.test(offer.button) && /Just this one/.test(offer.quiet) && /7/.test(offer.sentence),
		`"${offer.sentence}" [${offer.button}] [${offer.quiet}]`
	);
	await shot('05-thickness-offer');
	await page.locator('anyink-coach .anyink-coach__button').click();
	await page.waitForFunction(
		async (t) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			return ['glyph-0x6F', 'glyph-0x41', 'glyph-0x42', 'glyph-0x69'].every(
				(id) => editor.project.getItem(id).anyink.sketch.thickness === t
			);
		},
		nThick.thickness,
		{ timeout: 10000 }
	);
	await settle(400);
	const t2 = await titles();
	check(
		'Use on all: every sketched letter at the new thickness, ONE step "set the thickness for every sketched letter"',
		t2.length === t1.length + 1 && /set the thickness for every sketched letter/.test(t2[0]),
		`"${t2[0]}" (${t2.length - t1.length} step)`
	);
	v = await viewOf();
	lines = v.lines;
	const thick = {};
	for (const char of LETTERS) thick[char] = await letterReport(char);
	check(
		'Use on all: each letter rebuilt from its sketch and still in sync',
		LETTERS.every((c) => thick[c].thickness === nThick.thickness && thick[c].hash && thick[c].apart <= 1),
		LETTERS.map((c) => `${c} ${thick[c].thickness}/${typeof thick[c].apart === 'number' ? thick[c].apart.toFixed(2) : thick[c].apart}`).join(', ')
	);
	onLines('Use on all, o', thick.o, [lines.writing - over], [lines.small + over]);
	onLines('Use on all, A', thick.A, [lines.writing], [lines.capitals]);
	onLines('Use on all, v', thick.v, [lines.writing], [lines.small]);
	await shot('06-use-on-all');
	await undoButton('undo');
	let back = {};
	for (const char of ['o', 'A']) back[char] = await letterReport(char);
	check(
		'Use on all: one Undo puts every other letter back at its old thickness, in sync',
		back.o.thickness === before && back.A.thickness === before && back.o.apart <= 1 && back.A.apart <= 1 && back.o.hash,
		`o ${back.o.thickness}, A ${back.A.thickness}`
	);
	await undoButton('redo');
	back = { o: await letterReport('o') };
	check('Use on all: Redo brings it back', back.o.thickness === nThick.thickness && back.o.apart <= 1, `o ${back.o.thickness}`);

	// ---- outline o and B (clear, then the door's outline link) ---------------------------------------
	for (const [char, holes] of [
		['o', 1],
		['B', 2],
	]) {
		await openLetter(char);
		await fineTuneAction('clear');
		const cleared = await page.evaluate(async (id) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const item = editor.project.getItem(id);
			return { shapes: item.shapes.length, sketch: !!item.anyink?.sketch };
		}, ID(char));
		check(`${char}: Clear letter takes the ink and the sketch in one step`, cleared.shapes === 0 && !cleared.sketch, JSON.stringify(cleared));
		await page.locator('[data-anyink-overlay-link="outline"]').waitFor({ timeout: 5000 });
		await page.locator('[data-anyink-overlay-link="outline"]').click();
		await settle(200);
		v = await viewOf();
		if (char === 'o') {
			await page.keyboard.press('c');
			await clickAt(v, 360, lines.writing + 1);
			await clickAt(v, 400, lines.small - 1);
			await settle(300);
			const ring = await page.evaluate(async () => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				const c = editor.project.getItem('glyph-0x6F').anyink.sketch.pieces[0].circle;
				return c;
			});
			v = await viewOf();
			await clickAt(v, ring.cx, ring.cy);
			await clickAt(v, ring.cx + ring.rx - 110, ring.cy);
			await settle(300);
		} else {
			await page.keyboard.press('r');
			const top = lines.capitals;
			await clickAt(v, 140, lines.writing + 1);
			await clickAt(v, 620, top - 1);
			await settle(300);
			v = await viewOf();
			const outer = await page.evaluate(async () => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				const pts = Object.values(editor.project.getItem('glyph-0x42').anyink.sketch.points);
				return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)) };
			});
			const mid = Math.round(top / 2);
			await page.keyboard.down('Control');
			await clickAt(v, outer.x0 + 110, lines.writing + 110);
			await clickAt(v, outer.x1 - 110, mid - 50);
			await clickAt(v, outer.x0 + 110, mid + 50);
			await clickAt(v, outer.x1 - 110, top - 110);
			await page.keyboard.up('Control');
			await settle(300);
		}
		rep = await letterReport(char);
		check(
			`${char} (Outline): ${holes === 1 ? 'an outer loop and 1 hole' : 'an outer loop and 2 holes'}, built, in sync`,
			rep.way === 'outline' && rep.built === holes + 1 && rep.hash && rep.apart <= 1,
			`way ${rep.way}, ${rep.pieces} loops, ${rep.built} built, apart ${rep.apart}`
		);
		onLines(`${char} (Outline)`, rep, char === 'o' ? [lines.writing - over] : [lines.writing], char === 'o' ? [lines.small + over] : [lines.capitals]);
		await shot(`07-outline-${char}`);
	}

	// ---- Match size: x drawn too small (no snaps) ------------------------------------------------------
	await openLetter('x');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	const r = v.r;
	const low = Math.round(lines.small * 0.6);
	await page.keyboard.down('Control');
	await clickAt(v, 150, lines.writing + r);
	await clickAt(v, 450, low - r);
	await page.keyboard.up('Control');
	await enter();
	await page.keyboard.down('Control');
	await clickAt(v, 450, lines.writing + r);
	await clickAt(v, 150, low - r);
	await page.keyboard.up('Control');
	await enter();
	rep = await letterReport('x');
	check('x: drawn short, it needs a look for its size', rep.checks.includes('size'), rep.checks.join(','));
	let line = await waitCoach(/Match size|size/i);
	check('x: the Next line offers [Match size]', /Match size/i.test(line.button), `"${line.sentence}" [${line.button}]`);
	if (/Match size/i.test(line.button)) {
		await page.locator('anyink-coach .anyink-coach__button').click();
		await settle(600);
	}
	rep = await letterReport('x');
	check('x: after Match size the size check is gone', !rep.checks.includes('size'), rep.checks.join(',') || 'none');
	check('x: Match size kept the thickness (it never scales)', rep.thickness === nThick.thickness, `${rep.thickness}`);
	inSync('x after Match size', rep);
	onLines('x after Match size', rep, [lines.writing], [lines.small]);
	await undoButton('undo');
	inSync('x after Undo of Match size', await letterReport('x'));
	await undoButton('redo');
	inSync('x after Redo of Match size', await letterReport('x'));
	await shot('08-x-match-size');

	// ---- Sit on the line: z drawn 80 above it (no snaps) ------------------------------------------------
	await openLetter('z');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(150);
	v = await viewOf();
	const lift = 80;
	await page.keyboard.down('Control');
	await clickAt(v, 150, lines.small + lift - r);
	await clickAt(v, 500, lines.small + lift - r);
	await clickAt(v, 150, lift + r);
	await clickAt(v, 500, lift + r);
	await page.keyboard.up('Control');
	await enter();
	rep = await letterReport('z');
	check('z: drawn above the line, it is off the line', rep.checks.includes('offLine'), rep.checks.join(','));
	line = await waitCoach(/Sit on the line/i);
	check('z: the Next line offers [Sit on the line]', /Sit on the line/i.test(line.button), `"${line.sentence}" [${line.button}]`);
	if (/Sit on the line/i.test(line.button)) {
		await page.locator('anyink-coach .anyink-coach__button').click();
		await settle(600);
	}
	rep = await letterReport('z');
	check('z: after Sit on the line its ink sits on the writing line', near(rep.box.yMin, lines.writing) && !rep.checks.includes('offLine'), `ink bottom ${rep.box.yMin}`);
	inSync('z after Sit on the line', rep);
	await undoButton('undo');
	inSync('z after Undo of Sit on the line', await letterReport('z'));
	await undoButton('redo');
	inSync('z after Redo of Sit on the line', await letterReport('z'));

	// ---- the small-letter line moved up 50 (B15's drag, one whole-font step) ------------------------------
	await openLetter('n');
	const nBefore = await letterReport('n');
	const moved = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { linesOf, movedLines, commitDraggedLine } = await import('/anyink/fontinfo/move_lines.js');
		const font = editor.project.settings.font;
		const from = linesOf(font);
		font.xHeight = from.xHeight + 50;
		const result = commitDraggedLine(editor, movedLines(font, from));
		return { done: result.done, title: result.title };
	});
	const nUp = await letterReport('n');
	check(
		'small-letter line +50: n\'s ink top moves up 50, its feet stay, in one step',
		moved.done && near(nUp.box.yMax, nBefore.box.yMax + 50, 1.5) && near(nUp.box.yMin, nBefore.box.yMin),
		`${moved.title}; top ${nBefore.box.yMax} -> ${nUp.box.yMax}; bottom ${nBefore.box.yMin} -> ${nUp.box.yMin}`
	);
	inSync('n after the line moved', nUp);
	const vUp = await letterReport('v');
	inSync('v after the line moved', vUp);
	check('v: its tops follow the line', near(vUp.box.yMax, vUp.lines.small), `top ${vUp.box.yMax} vs line ${vUp.lines.small}`);
	await shot('09-line-moved');
	await undoButton('undo');
	const nDown = await letterReport('n');
	check('the line move: one Undo puts the line and n back', near(nDown.box.yMax, nBefore.box.yMax) && nDown.lines.small === nBefore.lines.small, `top ${nDown.box.yMax}`);
	inSync('n after Undo of the line move', nDown);

	// ---- Flip s left-right ------------------------------------------------------------------------------
	await openLetter('s');
	const sBefore = await letterReport('s');
	await fineTuneAction('flipLeftRight');
	const sFlip = await letterReport('s');
	check('Flip: s flipped left-right (one step)', /flip/i.test((await titles())[0]), (await titles())[0]);
	inSync('s after Flip', sFlip);
	await undoButton('undo');
	const sBack = await letterReport('s');
	inSync('s after Undo of Flip', sBack);
	check('Flip: Undo puts s back where it was', near(sBack.box.xMin, sBefore.box.xMin) && near(sBack.box.xMax, sBefore.box.xMax), `${sBack.box.xMin}..${sBack.box.xMax}`);
	await undoButton('redo');
	inSync('s after Redo of Flip', await letterReport('s'));
	await shot('10-s-flipped');

	// ---- Try it ------------------------------------------------------------------------------------------
	await page.locator('[data-anyink-step="tryIt"]').click();
	await page.waitForFunction(async () => (await import('/anyink/tryit/expand.js')).isTryItOpen(), null, { timeout: 10000 });
	await page.evaluate(() => {
		const strip = document.querySelector('preview-strip');
		strip.textInput.value = 'nos Av iB xz';
		strip.textInput.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await page.mouse.move(5, 895);
	await settle(1200);
	const tryIt = await page.evaluate(async () => {
		const { isStandIn } = await import('/anyink/tryit/stand_ins.js');
		const strip = document.querySelector('preview-strip');
		const data = strip?.renderer?.textBlock?.data || [];
		const chars = data.flat ? data.flat() : [];
		return {
			text: strip.options?.text,
			drawn: chars.filter((c) => c?.item && !isStandIn(c.item)).map((c) => c.char).join(''),
			standIns: chars.filter((c) => c?.item && isStandIn(c.item)).map((c) => c.char),
		};
	});
	check(
		'Try it: every sketched letter shows as his own (no stand-ins)',
		tryIt.standIns.length === 0 && ['n', 'o', 's', 'A', 'v', 'i', 'B', 'x', 'z'].every((c) => tryIt.drawn.includes(c)),
		`drawn "${tryIt.drawn}", stand-ins [${tryIt.standIns.join('')}]`
	);
	await shot('11-try-it');
	await page.locator('.anyink-tryit__done').click();
	await settle(400);

	// ---- Use in Word -----------------------------------------------------------------------------------
	const beforeWord = await page.evaluate(async () =>
		JSON.stringify((await import('/app/main.js')).getCurrentProjectEditor().project.save())
	);
	await page.locator('[data-anyink-step="useInWord"]').click();
	const phase = () =>
		page.evaluate(() => document.querySelector('dialog[data-anyink-dialog="useInWord"]')?.dataset.anyinkInstallPhase || null);
	const waitPhase = async (want) => {
		const end = Date.now() + 30000;
		while (Date.now() < end) {
			if ((await phase()) === want) return true;
			await page.waitForTimeout(150);
		}
		return false;
	};
	await waitPhase('before');
	await page.locator('[data-anyink-install-action="pick"]').click();
	await page.locator('[data-anyink-install-folder="picked"]').waitFor({ timeout: 10000 });
	await page.locator('[data-anyink-install-action="make"]').click();
	const made = await waitPhase('card');
	await settle(500);
	await shot('12-use-in-word');
	const wordFiles = await opfsFiles();
	check('Use in Word: the font file is made', made && wordFiles.some((f) => f.endsWith('.otf')), wordFiles.join(', '));
	const sketchedChars = ['n', 'o', 's', 'A', 'v', 'i', 'B', 'x', 'z'];
	if (wordFiles.length) {
		const word = fontReport('Use in Word', await opfsBytes(wordFiles.find((f) => f.endsWith('.otf'))), sketchedChars);
		check('Use in Word: the outline o has 1 hole and the outline B 2', word.o.holes === 1 && word.B.holes === 2, `o ${word.o.holes}, B ${word.B.holes}`);
	}
	const afterWord = await page.evaluate(async () =>
		JSON.stringify((await import('/app/main.js')).getCurrentProjectEditor().project.save())
	);
	check('Use in Word: the work file is unchanged by making the font', afterWord === beforeWord);
	await page.keyboard.press('Escape');
	await settle(400);

	// ---- All tools: the File menu's OTF export, the left edge -------------------------------------------
	await page.locator('[data-anyink-control="moreTools"]').click();
	await settle(800);
	const mode = await page.evaluate(() => document.documentElement.dataset.uiMode);
	check('All tools: More tools switched the mode', mode === 'all', mode);
	const exported = await page.evaluate(async () => {
		const { ioFont_exportOTF } = await import('/formats_io/otf/font_export.js');
		return ioFont_exportOTF();
	});
	await settle(800);
	const filesAfter = await opfsFiles();
	const menuFile = filesAfter.find((f) => f.endsWith('.otf') && !wordFiles.includes(f));
	check("File menu export (All tools' Export OTF) writes a font file", !!menuFile, `${exported}; ${filesAfter.join(', ')}`);
	if (menuFile) {
		const menu = fontReport('File menu export', await opfsBytes(menuFile), sketchedChars);
		check('File menu export: the outline o has 1 hole and the outline B 2', menu.o.holes === 1 && menu.B.holes === 2, `o ${menu.o.holes}, B ${menu.B.holes}`);
	}
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x6E';
		editor.navigate();
	});
	await settle(600);
	const nAll = await letterReport('n');
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { nudgeLine } = await import('/anyink/metrics/guides_layer.js');
		nudgeLine(editor, { kind: 'sideBearing', side: 'lsb', orientation: 'v' }, -20);
	});
	await settle(300);
	const nAll2 = await letterReport('n');
	check('All tools: moving n\'s left edge moves its sketch with the ink', near(nAll2.box.xMin, nAll.box.xMin + 20) && nAll2.active, `${nAll.box.xMin} -> ${nAll2.box.xMin}`);
	inSync('n in All tools after the left edge moved', nAll2);
	await shot('13-all-tools');

	// ---- save and open again ------------------------------------------------------------------------------
	const text = await page.evaluate(async () =>
		(await import('/app/main.js')).getCurrentProjectEditor().makeProjectFileText()
	);
	await writeFile(resolve(shots, 'sketch-build.gs2'), text, 'utf8');
	const saved = JSON.parse(text);
	const page2 = await context.newPage();
	page2.on('pageerror', (error) => errors.push(`page 2: ${error.message}`));
	page2.on('dialog', (dialog) => dialog.dismiss());
	await page2.goto(`${origin}/?ui=simple`);
	await page2.locator('#input__new-project-name').waitFor({ timeout: 60000 });
	await page2.locator('#input__new-project-name').fill('Empty');
	await page2.locator('#button__create-new-project').click();
	await page2.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page2.evaluate(async () => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: true });
	});
	const reopened = await page2.evaluate(
		async ({ gs2, ids }) => {
			const { openDroppedFont } = await import('/anyink/files/open_font.js');
			const outcome = await openDroppedFont({ file: new File([gs2], 'sketch-build.gs2', { type: 'application/json' }) });
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { builtMatches } = await import('/anyink/sketch/sketch_record.js');
			const { freshInk, outlinesApart } = await import('/anyink/sketch/tests/follow_helpers.js');
			const out = {};
			for (const id of ids) {
				const item = editor.project.getItem(id);
				out[id] = {
					sketch: JSON.stringify(item?.anyink?.sketch ?? null),
					shapes: item?.shapes?.length ?? 0,
					hash: builtMatches(item),
					apart: outlinesApart(item.shapes.filter((s) => s.anyink?.sketchKey), freshInk(item, editor.project)),
				};
			}
			return { outcome, out };
		},
		{ gs2: text, ids: sketchedChars.map(ID) }
	);
	const same = sketchedChars.filter((c) => {
		const id = ID(c);
		const r2 = reopened.out[id];
		return (
			r2.sketch === JSON.stringify(saved.glyphs[id]?.anyink?.sketch ?? null) &&
			r2.shapes === (saved.glyphs[id]?.shapes?.length ?? 0) &&
			r2.hash &&
			r2.apart <= 1
		);
	});
	check(
		'save and open again: every sketch, its ink and its hash come back as saved, in sync',
		reopened.outcome === 'opened' && same.length === sketchedChars.length,
		`${reopened.outcome}; ${same.length}/${sketchedChars.length} letters the same`
	);
	await page2.close();

	check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (error) {
	check('the run finished', false, error?.stack || String(error));
	if (page) await shot('zz-error').catch(() => {});
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passes} passed, ${failures} failed; shots: ${shots}`);
console.log(`screenshots: ${shotList.join(', ')}`);
process.exit(failures ? 1 : 0);
