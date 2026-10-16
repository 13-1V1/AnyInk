// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S4 (docs/SKETCH.md section 5, K5 / K6): real-Chrome check of Select on a sketch, in the real app
// with the 'sketch' flag as shipped (on since S4). Starts its own Vite server on src/, makes a new
// font in Simple and, with the mouse and keyboard as he would:
//   - an empty letter shows [Sketch it] green and the tool column shows the sketch tools
//   - sketches small n (stem, arch, leg) and presses V: Select is on the sketch (purple points)
//   - drags the arch's top: one step "bent a curve on small n", the ink rebuilt with it
//   - drags the leg (a Line): it moves whole, "moved a line on small n"
//   - a window round the stem picks its points; dragging one moves them all, "moved part of small n"
//   - picks the leg's top and presses [Corner] on the card: "made a point a corner on small n"
//   - picks the piece and presses Delete: the toast says what went with [Undo]; [Undo] brings it
//     back, ink and sketch together
//   - after every step: the sketch is never set aside and its ink is exactly what it builds;
//     the card's words pass the strict banned-word scan
//   - the Brush still draws on another letter
// Prints PASS / FAIL lines; exits 1 on any FAIL.
// Usage: node tests/sketch_edit.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-sketch-edit'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-sketch-edit-'));

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
let failures = 0;
let passes = 0;

function check(label, ok, detail = '') {
	if (ok) passes++;
	else failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
	return ok;
}

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
let page = null;
const settle = (ms = 250) => page.waitForTimeout(ms);

async function shot(name) {
	await page.screenshot({ path: resolve(shots, `${name}.png`) });
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
	await settle(300);
}

const viewOf = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const r = document.querySelector('edit-canvas').canvas.getBoundingClientRect();
		const { guideLines } = await import('/anyink/placement/classes.js');
		const { snapRadius } = await import('/anyink/sketch/tools/snap.js');
		return {
			left: r.left,
			top: r.top,
			view: { ...editor.view },
			lines: guideLines(editor.project.settings.font),
			radius: snapRadius(editor.view),
		};
	});

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

async function dragFromTo(v, from, to, { steps = 12 } = {}) {
	await moveTo(v, from.x, from.y, 4);
	await page.mouse.down();
	await moveTo(v, to.x, to.y, steps);
	await page.mouse.up();
	await settle(400);
}

/** The newest step he sees */
const newest = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.history.queue.find((e) => !e.navigation && !/^_/.test(e.title))?.title || '';
	});

const stepCount = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.history.queue.length;
	});

/** The sketch, live or not, and how far its ink is from what it builds now */
const report = (char) =>
	page.evaluate(async (id) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const item = editor.project.getItem(id);
		const { sketchOf, isSketchActive } = await import('/anyink/sketch/model.js');
		const { builtShapes, builtMatches } = await import('/anyink/sketch/sketch_record.js');
		const { freshInk, outlinesApart } = await import('/anyink/sketch/tests/follow_helpers.js');
		const sketch = item ? sketchOf(item) : null;
		if (!sketch) return { missing: true, shapes: item?.shapes?.length ?? 0 };
		const built = builtShapes(item, sketch.key);
		let apart = null;
		try {
			apart = outlinesApart(built, freshInk(item, editor.project));
		} catch (error) {
			apart = `error ${error.message}`;
		}
		return {
			active: isSketchActive(sketch),
			setAside: !!sketch.setAside,
			pieces: sketch.pieces.length,
			built: built.length,
			others: item.shapes.length - built.length,
			hash: builtMatches(item),
			apart,
			points: sketch.points,
			parts: sketch.pieces.map((piece) => piece.parts.map((part) => ({ ...part }))),
			tool: editor.selectedTool,
		};
	}, ID(char));

function inSync(label, rep) {
	return check(
		`${label}: sketch live and its ink exactly what it builds`,
		!rep.missing && rep.active && !rep.setAside && rep.hash && typeof rep.apart === 'number' && rep.apart <= 1,
		rep.missing
			? 'no sketch'
			: `active ${rep.active}, aside ${rep.setAside}, hash ${rep.hash}, ink ${
					typeof rep.apart === 'number' ? rep.apart.toFixed(2) : rep.apart
			  } units off, ${rep.built} built shapes, ${rep.others} others`
	);
}

const pick = () =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sketchPickOf } = await import('/anyink/sketch/select_tool.js');
		return sketchPickOf(editor);
	});

/** The built centerline's place at a share t of a part of piece 1 */
const onPart = (char, part, t) =>
	page.evaluate(
		async ([id, index, share]) => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const item = editor.project.getItem(id);
			const { sketchOf } = await import('/anyink/sketch/model.js');
			const { piecePartCubics } = await import('/anyink/sketch/curves.js');
			const { pointOnCubics } = await import('/anyink/sketch/pick.js');
			const sketch = sketchOf(item);
			const entries = piecePartCubics(sketch.pieces[0], sketch).filter((e) => e.part === index);
			return pointOnCubics(entries.flatMap((e) => e.cubics), share);
		},
		[ID(char), part, t]
	);

const scanCard = () =>
	page.evaluate(async () => {
		const { scanDom, findUppercase, formatHit } = await import('/anyink/words/banned.js');
		const root = document.querySelector('.anyink-letter-card');
		return root ? [...scanDom(root, { strict: true }), ...findUppercase(root)].map(formatHit) : ['no card'];
	});

try {
	const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	page = await context.newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	await field.fill('Sketch Edit');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await settle(500);

	// ---- the flag as shipped: the door and the column -------------------------------------------
	const flag = await page.evaluate(async () => (await import('/anyink/mode/features.js')).isFeatureOn('sketch'));
	check("the 'sketch' flag is on as shipped", flag === true);
	await openLetter('n');
	const door = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const box = document.querySelector('[data-anyink-overlay]');
		const greens = [...document.querySelectorAll('.anyink-primary')]
			.filter((el) => el.checkVisibility())
			.map((el) => el.textContent.trim());
		const tools = [...document.querySelectorAll('[data-anyink-tool]')]
			.filter((el) => el.checkVisibility())
			.map((el) => el.dataset.anyinkTool);
		return { shown: !!box?.checkVisibility(), greens, tools, tool: editor.selectedTool };
	});
	check(
		'an empty letter shows [Sketch it], the one green button, on the Line',
		door.shown && door.greens.length === 1 && /Sketch it/.test(door.greens[0]) && door.tool === 'sketchLine',
		JSON.stringify(door.greens)
	);
	check(
		'the tool column shows the Brush, the sketch tools and Select',
		['nib', 'sketchLine', 'sketchArc', 'sketchSpline', 'sketchCircle', 'resize'].every((t) => door.tools.includes(t)),
		door.tools.join(', ')
	);
	await shot('01-door-n');
	await page.locator('[data-anyink-overlay-action="sketchIt"]').click();
	await settle(200);

	// ---- small n: stem, arch, leg (as sketch_build.verify draws it) --------------------------------
	let v = await viewOf();
	const { lines } = v;
	await clickAt(v, 160, lines.writing + 2);
	await clickAt(v, 160, lines.small - 2);
	await page.keyboard.press('a');
	await settle(80);
	await moveTo(v, 170, lines.small - 4, 2);
	await moveTo(v, 260, lines.small - 4, 8);
	await clickAt(v, 640, lines.small - 260, { steps: 10 });
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
	await moveTo(v, along(12).x, along(12).y, 2);
	await moveTo(v, along(60).x, along(60).y, 6);
	const reach = Math.abs(Math.sin(dir)) > 0.2 ? (lines.writing + 4 - legEnd.y) / Math.sin(dir) : 600;
	await clickAt(v, along(reach).x, along(reach).y, { steps: 10 });
	await page.keyboard.press('Enter');
	await settle(300);
	let rep = await report('n');
	check('n: sketched as one piece: a line, an arc, a line', rep.pieces === 1 && rep.parts[0].length === 3, JSON.stringify(rep.parts));
	inSync('n sketched', rep);

	// ---- V: Select on the sketch ---------------------------------------------------------------
	await page.mouse.move(5, 300);
	await page.keyboard.press('v');
	await settle(200);
	const select = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const route = await import('/anyink/sketch/tools/tool_route.js');
		return { tool: editor.selectedTool, applies: route.sketchSelectApplies(editor) };
	});
	check('V picks Select, and Select is on the sketch', select.tool === 'resize' && select.applies, JSON.stringify(select));
	await shot('02-n-select');

	// ---- drag the arch's top: Bend ------------------------------------------------------------
	v = await viewOf();
	const archTop = await onPart('n', 1, 0.5);
	const before = await report('n');
	let steps = await stepCount();
	await dragFromTo(v, archTop, { x: archTop.x + 10, y: archTop.y + 8 * v.radius });
	rep = await report('n');
	const bulge = (r) => r.parts[0][1].bulge;
	check(
		"the arch's top dragged up: one step, bent a curve on small n",
		(await stepCount()) === steps + 1 && (await newest()) === 'bent a curve on small n',
		await newest()
	);
	check(
		"the arch is still an arc, its ends put, its bulge bigger (it let go of the small-letter line)",
		rep.parts[0][1].type === 'arc' && Math.abs(bulge(rep)) > Math.abs(bulge(before)) && !rep.parts[0][1].top,
		`bulge ${bulge(before)} -> ${bulge(rep)}`
	);
	inSync('after the bend', rep);
	await shot('03-arch-bent');

	// ---- drag the leg: a Line moves whole ---------------------------------------------------------
	// the view follows the letter as automatic spacing moves it: read it again before each press
	v = await viewOf();
	const leg = await onPart('n', 2, 0.5);
	const legBefore = rep;
	steps = await stepCount();
	await dragFromTo(v, leg, { x: leg.x + 60, y: leg.y });
	rep = await report('n');
	const legPart = (r) => r.parts[0][2];
	const legPoints = (r) => [r.points[legPart(r).from], r.points[legPart(r).to]];
	const [top0, foot0] = legPoints(legBefore);
	const [top1, foot1] = legPoints(rep);
	check(
		'the leg dragged: one step, moved a line on small n; its foot stays on the writing line',
		(await stepCount()) === steps + 1 && (await newest()) === 'moved a line on small n' && foot1.on === 'writing' && foot1.y === foot0.y,
		`${await newest()}; foot ${JSON.stringify(foot0)} -> ${JSON.stringify(foot1)}`
	);
	check(
		'the leg moved whole: both its ends moved right by the same amount (against the stem)',
		top1.x - top0.x === foot1.x - foot0.x && top1.x - rep.points[rep.parts[0][0].from].x > top0.x - legBefore.points[legBefore.parts[0][0].from].x,
		`top ${top0.x} -> ${top1.x}, foot ${foot0.x} -> ${foot1.x}`
	);
	inSync('after moving the leg', rep);
	await shot('04-leg-moved');

	// ---- a window round the stem, then move it ------------------------------------------------
	v = await viewOf();
	const stemFrom = rep.points[rep.parts[0][0].from];
	const stemTo = rep.points[rep.parts[0][0].to];
	await dragFromTo(
		v,
		{ x: stemFrom.x - 60, y: lines.writing - 120 },
		{ x: stemFrom.x + 60, y: stemTo.y + 120 }
	);
	const picked = await pick();
	check(
		'a window left to right round the stem picks its two points (not the whole piece)',
		!!picked && picked.points.includes(rep.parts[0][0].from) && picked.points.includes(rep.parts[0][0].to) && picked.pieces.length === 0,
		JSON.stringify(picked)
	);
	await shot('05-stem-window');
	steps = await stepCount();
	const gap0 = top1.x - stemFrom.x;
	v = await viewOf();
	await dragFromTo(v, { x: stemFrom.x, y: stemFrom.y }, { x: stemFrom.x + 50, y: stemFrom.y + 10 });
	rep = await report('n');
	const stemFoot = rep.points[rep.parts[0][0].from];
	const stemTop = rep.points[rep.parts[0][0].to];
	check(
		'dragging a picked point moves the whole pick: one step, moved part of small n',
		(await stepCount()) === steps + 1 && (await newest()) === 'moved part of small n',
		await newest()
	);
	check(
		'the stem moved right whole, still plumb, its foot still on the writing line',
		stemFoot.x === stemTop.x && stemFoot.on === 'writing' && rep.points[legPart(rep).from].x - stemFoot.x < gap0,
		`stem x ${stemFoot.x}, gap to the leg ${gap0} -> ${rep.points[legPart(rep).from].x - stemFoot.x}`
	);
	inSync('after moving the stem', rep);
	await shot('06-stem-moved');

	// ---- the leg's top to Corner on the card ----------------------------------------------------
	const legTopId = legPart(rep).from;
	const legTop = rep.points[legTopId];
	await page.keyboard.press('Escape');
	v = await viewOf();
	await clickAt(v, legTop.x, legTop.y);
	const card = await page.evaluate(() => {
		const section = document.querySelector('[data-anyink-sketch-piece]');
		return {
			what: section?.dataset.anyinkSketchPiece || null,
			smooth: section?.querySelector('[data-anyink-sketch="smooth"]')?.getAttribute('aria-pressed') || null,
			text: section?.textContent || '',
		};
	});
	check(
		"picking the leg's top shows the Point card: Smooth pressed, Corner, Delete",
		card.what === 'point' && card.smooth === 'true' && /Corner/.test(card.text) && /Delete/.test(card.text),
		JSON.stringify(card)
	);
	const hits = await scanCard();
	check('the card passes the strict banned-word scan', hits.length === 0, hits.join(' | '));
	await shot('07-point-card');
	await page.locator('[data-anyink-sketch="corner"]').click();
	await settle(300);
	rep = await report('n');
	check(
		'[Corner]: one step, made a point a corner on small n',
		(await newest()) === 'made a point a corner on small n' && rep.points[legTopId].kind === 'corner',
		`${await newest()}; kind ${rep.points[legTopId].kind}`
	);
	inSync('after Corner', rep);
	await shot('08-corner');

	// ---- delete the piece, then Undo ------------------------------------------------------------
	const builtBefore = rep.built;
	v = await viewOf();
	const legMid = await onPart('n', 2, 0.5);
	await clickAt(v, legMid.x, legMid.y);
	const piecePick = await pick();
	check('a click on the leg picks the piece', piecePick?.pieces?.length === 1, JSON.stringify(piecePick));
	await page.keyboard.press('Delete');
	await settle(400);
	rep = await report('n');
	const toast = await page.evaluate(() => {
		const el = [...document.querySelectorAll('.anyink-toast, [data-anyink-toast]')].find((t) => t.checkVisibility());
		return el ? el.textContent : document.body.innerText.match(/Deleted a piece of small n\.[^\n]*/)?.[0] || '';
	});
	check(
		'Delete: one step, deleted a piece of small n; the toast says so with [Undo]',
		(await newest()) === 'deleted a piece of small n' && /Deleted a piece of small n\./.test(toast) && /Undo/.test(toast),
		`${await newest()}; toast "${toast}"`
	);
	check('the piece and its ink are gone', rep.pieces === 0 && rep.built === 0, `${rep.pieces} pieces, ${rep.built} built`);
	await shot('09-deleted');
	const undo = page.locator('.anyink-toast button, [data-anyink-toast] button').filter({ hasText: 'Undo' }).first();
	if (await undo.count()) await undo.click();
	else await page.keyboard.press('Control+z');
	await settle(500);
	rep = await report('n');
	check('[Undo] brings the piece back with its ink', rep.pieces === 1 && rep.built === builtBefore, `${rep.pieces} pieces, ${rep.built} built`);
	inSync('after Undo', rep);
	await shot('10-undone');

	// ---- the Brush still draws ------------------------------------------------------------------
	await openLetter('o');
	await page.mouse.move(5, 300);
	await page.keyboard.press('b');
	await settle(150);
	v = await viewOf();
	await moveTo(v, 200, 300, 2);
	await page.mouse.down();
	for (let i = 1; i <= 24; i++) {
		const a = (i / 24) * Math.PI * 1.6;
		await moveTo(v, 330 + 160 * Math.cos(a), 520 + 300 * Math.sin(a), 2);
	}
	await page.mouse.up();
	await settle(500);
	const brush = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const item = editor.selectedItem;
		return {
			tool: editor.selectedTool,
			shapes: item?.shapes?.length || 0,
			strokes: item?.anyink?.nib?.strokes?.length || 0,
			top: editor.history.queue.find((e) => !e.navigation)?.title || '',
		};
	});
	check('the Brush still draws (small o)', brush.tool === 'nib' && brush.shapes > 0 && brush.strokes > 0, JSON.stringify(brush));
	await shot('11-brush');

	check('no page errors', !errors.length, errors.slice(0, 5).join(' | '));
} catch (error) {
	failures++;
	console.log(`FAIL the run stopped: ${error.stack || error.message}`);
	if (page) await page.screenshot({ path: resolve(shots, 'stopped.png') }).catch(() => {});
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true });
}
console.log(`${passes} passed, ${failures} failed; shots: ${shots}`);
if (failures) process.exit(1);
