// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 (docs/SKETCH.md sections 2, 6, 7, 8 and 11): real-Chrome check of sketching letters in the
// real app. Starts its own Vite server on src/, makes a new font in Simple, turns the 'sketch'
// flag on from the page (mode/features.js setFeaturesForTests: it stays off in the app until S9),
// then draws with the mouse and keyboard as he would:
//   small n   stem Line from the writing line to the small-letter line; Arc (A) leaving at an
//             angle (a corner), end and bulge clicks; Line (L) leaving along the arc (tangent)
//             down to the writing line; Undo with the piece open takes back a click; Enter
//   small o   Circle (C): a click on the writing line, then on the small-letter line
//   small s   Spline (S): five clicks, Enter
//   Capital A Lines: left leg, apex on the capitals line, right leg; a bar from leg to leg
//   small u   Rectangle (R): a box from the writing line to the small-letter line
//   small l   two clicks, Esc finishes, a second Esc goes back to Select
// and checks what is stored in glyph.anyink.sketch, the join kinds, one Undo step per finished
// piece with its name, Undo / Redo after, Undo / Redo with a piece open, a mode switch mid-piece,
// the font saved as .gs2 text and opened again (the dropped-file path), All tools with the flag
// on, and with the flag off the tool column and the keys P / E / L / S / C / R as before.
// Prints PASS / FAIL lines; exits 1 on any FAIL.
// Usage: node tests/sketch_draw.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-sketch-draw'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-sketch-draw-'));

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
	if (ok) {
		passes++;
		console.log(`PASS ${label}${detail ? `: ${detail}` : ''}`);
	} else {
		failures++;
		console.log(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
	}
	return ok;
}

// ----------------------------------------------------------------------------------------------
// Page helpers (everything the page is asked runs through the app's own modules)
// ----------------------------------------------------------------------------------------------

const setFlag = (page, on) =>
	page.evaluate(async (value) => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: value });
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.navigate();
	}, on);

/** Opens a letter the way the board does when its key is typed */
async function openLetter(page, char) {
	await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		(await import('/anyink/topbar/letters_page.js')).goToLetters(editor);
	});
	await page.locator('[data-anyink-board]').waitFor({ timeout: 10000 });
	await page.mouse.move(5, 300);
	await page.keyboard.press(
		char === char.toUpperCase() && /[A-Z]/.test(char) ? `Shift+${char}` : char
	);
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
	await page.waitForTimeout(250);
}

/** State of the open letter: tool, sketch, history titles, the open piece */
const state = (page) =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { isPieceOpen } = await import('/anyink/sketch/tools/undo_gate.js');
		const item = editor.selectedItem;
		return {
			tool: editor.selectedTool,
			page: editor.nav.page,
			chars: item?.chars ?? null,
			sketch: item?.anyink?.sketch ? JSON.parse(JSON.stringify(item.anyink.sketch)) : null,
			titles: editor.history.queue.filter((e) => !e.navigation).map((e) => e.title),
			redo: editor.history.redoQueue.length,
			open: isPieceOpen(),
			mode: document.documentElement.dataset.uiMode || null,
		};
	});

/** Font units -> page pixels, through the canvas's own view */
const viewOf = async (page) => {
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
		const { snapRadius } = await import('/anyink/sketch/tools/snap.js');
		return {
			left: r.left,
			top: r.top,
			view: { ...editor.view },
			lines: guideLines(editor.project.settings.font),
			radius: snapRadius(editor.view),
			width: editor.selectedItem.advanceWidth,
		};
	});
};

function screenOf(v, x, y) {
	return { x: v.left + v.view.dx + x * v.view.dz, y: v.top + v.view.dy - y * v.view.dz };
}

async function moveTo(page, v, x, y, steps = 6) {
	const p = screenOf(v, x, y);
	await page.mouse.move(p.x, p.y, { steps });
}

async function clickAt(page, v, x, y, { steps = 6, pause = 120 } = {}) {
	await moveTo(page, v, x, y, steps);
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(pause);
}

const handlerView = (page) =>
	page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sketchToolHandler } = await import('/anyink/sketch/tools/tool_route.js');
		const h = sketchToolHandler(editor.selectedTool);
		const v = h?.view?.() || {};
		return {
			open: !!v.open,
			points: v.points || [],
			leave: v.leave ?? null,
			dir: h?.dir ?? null,
			readout: v.readout || null,
		};
	});

/** The column as drawn with Fine-tune closed (a tool key inside Fine-tune opens it) */
const toolColumn = async (page) => {
	await page.evaluate(async () =>
		(await import('/anyink/letter/view_switches.js')).setFineTuneOpen(false)
	);
	await page.waitForTimeout(100);
	return page.evaluate(() =>
		[...document.querySelectorAll('[data-anyink-tool], [data-anyink-tool-heading]')]
			.filter((el) => el.checkVisibility())
			.map((el) => {
				if (el.dataset.anyinkToolHeading) return `heading:${el.textContent.trim()}`;
				const key = el.querySelector('.anyink-tool__key')?.textContent.trim() || '';
				return key ? `${el.dataset.anyinkTool}(${key})` : el.dataset.anyinkTool;
			})
	);
};

/** Presses a key on the canvas and reads the tool it left picked */
async function keyTool(page, key) {
	await page.evaluate(async () => {
		const { selectTool } = await import('/edit_canvas/tools/tools.js');
		selectTool('resize');
	});
	const v = await viewOf(page);
	await moveTo(page, v, 300, 300, 1);
	await page.keyboard.press(key);
	await page.waitForTimeout(80);
	return (await state(page)).tool;
}

const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const piecesOf = (s) => s.sketch?.pieces || [];
const pointOf = (s, id) => s.sketch?.points?.[id];
const partEnds = (part) =>
	part.type === 'spline' ? [part.points[0], part.points.at(-1)] : [part.from, part.to];

async function shot(page, name) {
	const path = resolve(shots, `${name}.png`);
	await page.screenshot({ path });
	console.log(`shot ${path}`);
}

// ----------------------------------------------------------------------------------------------
// The run
// ----------------------------------------------------------------------------------------------

let page = null;
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
	await field.fill('Sketch Test');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page.waitForTimeout(500);

	// ---- flag off first: today's column and keys (Simple) ----------------------------------
	await openLetter(page, 'n');
	const columnOff = await toolColumn(page);
	check(
		'flag off, Simple: no sketch tools on the column',
		!columnOff.some((t) => t.startsWith('sketch') || t.startsWith('heading')),
		columnOff.join(' ')
	);
	const keysOff = {};
	for (const key of ['p', 'e', 'l', 's', 'c', 'r']) keysOff[key] = await keyTool(page, key);
	check(
		'flag off, Simple: P / E / L / S / C / R as before',
		keysOff.p === 'newPath' &&
			keysOff.e === 'pathEdit' &&
			keysOff.l === 'resize' &&
			keysOff.s === 'resize' &&
			keysOff.c === 'resize' &&
			keysOff.r === 'newRectangle',
		JSON.stringify(keysOff)
	);
	await page.evaluate(async () =>
		(await import('/edit_canvas/tools/tools.js')).selectTool('resize')
	);

	// ---- flag on ---------------------------------------------------------------------------
	await setFlag(page, true);
	await openLetter(page, 'n');
	const columnOn = await toolColumn(page);
	check(
		'flag on, Simple: Brush, the Sketch heading, the five tools with their keys printed, then Select',
		columnOn.slice(0, 7).join(' ') ===
			'nib(B) heading:Sketch sketchLine(L) sketchArc(A) sketchSpline(S) sketchCircle(C) sketchRectangle(R)' &&
			columnOn[7]?.startsWith('resize'),
		columnOn.join(' ')
	);
	const keysOn = {};
	for (const key of ['l', 'a', 's', 'p', 'c', 'o', 'r', 'e', 'v'])
		keysOn[key] = await keyTool(page, key);
	check(
		'flag on, Simple: L Line, A Arc, S / P Spline, C / O Circle, R Rectangle, E / V Select',
		keysOn.l === 'sketchLine' &&
			keysOn.a === 'sketchArc' &&
			keysOn.s === 'sketchSpline' &&
			keysOn.p === 'sketchSpline' &&
			keysOn.c === 'sketchCircle' &&
			keysOn.o === 'sketchCircle' &&
			keysOn.r === 'sketchRectangle' &&
			keysOn.e === 'resize' &&
			keysOn.v === 'resize',
		JSON.stringify(keysOn)
	);

	// ---- small n -----------------------------------------------------------------------------
	let v = await viewOf(page);
	const { lines } = v;
	const before = (await state(page)).titles.length;
	await page.keyboard.press('l');
	const x0 = 160;
	const x1 = 640;
	await clickAt(page, v, x0, lines.writing + 2);
	await clickAt(page, v, x0, lines.small - 2);
	let s = await state(page);
	check('n: the stem is an open piece (nothing stored yet)', s.open && !s.sketch, `open ${s.open}`);
	// the Arc, leaving the stem's top at an angle (to the right): a corner, then end and bulge
	await page.keyboard.press('a');
	await page.waitForTimeout(80);
	const stemTop = { x: x0, y: lines.small };
	await moveTo(page, v, stemTop.x + v.radius * 0.5, stemTop.y - v.radius * 0.2, 2);
	await moveTo(page, v, stemTop.x + v.radius * 4, stemTop.y - v.radius * 0.2, 8);
	let h = await handlerView(page);
	check(
		'n: leaving the stem top to the right reads as a corner',
		h.leave === 'corner',
		`leave ${h.leave}`
	);
	const archEnd = { x: x1, y: lines.small - 260 };
	await clickAt(page, v, archEnd.x, archEnd.y, { steps: 10 });
	await clickAt(page, v, (x0 + x1) / 2, lines.small + 40, { steps: 10 });
	h = await handlerView(page);
	check(
		'n: the arch is placed and the piece is still open',
		h.open && h.points.length === 3,
		`points ${h.points.length}`
	);
	await shot(page, '01-n-arch');
	// the Line, leaving the arch's end along the curve (tangent), down to the writing line
	await page.keyboard.press('l');
	await page.waitForTimeout(80);
	h = await handlerView(page);
	const dir = (h.dir * Math.PI) / 180;
	const endNow = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sketchToolHandler } = await import('/anyink/sketch/tools/tool_route.js');
		const tool = sketchToolHandler(editor.selectedTool);
		const id = tool.lastId();
		return tool.sketch.points[id];
	});
	const along = (d) => ({ x: endNow.x + d * Math.cos(dir), y: endNow.y + d * Math.sin(dir) });
	const step1 = along(v.radius * 0.6);
	const step2 = along(v.radius * 3);
	await moveTo(page, v, step1.x, step1.y, 2);
	await moveTo(page, v, step2.x, step2.y, 6);
	h = await handlerView(page);
	check(
		'n: leaving the arch along its end reads as tangent',
		h.leave === 'tangent',
		`leave ${h.leave}, dir ${Math.round(h.dir)}`
	);
	const reach =
		Math.abs(Math.sin(dir)) > 0.2 ? (lines.writing + 4 - endNow.y) / Math.sin(dir) : 600;
	const foot = along(reach);
	await moveTo(page, v, foot.x, foot.y, 10);
	h = await handlerView(page);
	const readout = h.readout
		? await page.evaluate(
				async ({ r }) => {
					const editor = (await import('/app/main.js')).getCurrentProjectEditor();
					return (await import('/anyink/sketch/tools/draw_layer.js')).readoutText(
						r,
						editor.project.settings.font
					);
				},
				{ r: h.readout }
		  )
		: '';
	check(
		'n: while the Line part is drawn the cursor reads its length in inches and its angle',
		/^\d+\.\d\d in, \d+°$/.test(readout),
		readout
	);
	await clickAt(page, v, foot.x, foot.y, { steps: 2 });
	// Undo with the piece open: the last click is taken back, the history is untouched
	const titlesOpen = (await state(page)).titles.length;
	await page.keyboard.press('Control+z');
	await page.waitForTimeout(150);
	h = await handlerView(page);
	s = await state(page);
	check(
		'n: Ctrl+Z with the piece open takes back the last click only',
		s.open && h.points.length === 3 && s.titles.length === titlesOpen && !s.sketch,
		`points ${h.points.length}, steps ${s.titles.length - before}`
	);
	const undoTip = await page.evaluate(() => {
		const button = document.querySelector('[data-anyink-control="undo"]');
		const redo = document.querySelector('[data-anyink-control="redo"]');
		return {
			undo: button?.title || '',
			redo: redo?.title || '',
			redoOff: redo?.getAttribute('aria-disabled'),
		};
	});
	check(
		"n: the top bar's Undo says it takes back the last point; Redo waits",
		/take back the last point/i.test(undoTip.undo) && /finish the line first/i.test(undoTip.redo),
		JSON.stringify(undoTip)
	);
	await page.keyboard.press('Control+y');
	await page.waitForTimeout(100);
	h = await handlerView(page);
	check(
		'n: Ctrl+Y with the piece open does nothing',
		h.points.length === 3 && (await state(page)).open,
		`points ${h.points.length}`
	);
	await clickAt(page, v, foot.x, foot.y, { steps: 6 });
	h = await handlerView(page);
	check('n: the foot clicked again', h.points.length === 4, `points ${h.points.length}`);
	await shot(page, '02-n-open');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(250);
	s = await state(page);
	const n = piecesOf(s)[0];
	const nParts = (n?.parts || []).map((part) => part.type).join(',');
	check(
		'n: one piece, one Undo step "sketched a line on small n"',
		piecesOf(s).length === 1 &&
			s.titles.length === before + 1 &&
			s.titles[0] === 'sketched a line on small n',
		`${s.titles[0]} (${s.titles.length - before} steps)`
	);
	check(
		'n: line, arc, line (the arc kept: it left the stem at a corner)',
		nParts === 'line,arc,line',
		nParts
	);
	const [stemFoot, top] = partEnds(n.parts[0]);
	const archEndId = partEnds(n.parts[1])[1];
	const footId = partEnds(n.parts[2])[1];
	check(
		'n: a corner where it left at an angle, smooth where it left along',
		pointOf(s, top).kind === 'corner' && pointOf(s, archEndId).kind === 'smooth',
		`${pointOf(s, top).kind} / ${pointOf(s, archEndId).kind}`
	);
	const r = s.sketch.thickness / 2;
	check(
		'n: the feet sit on the writing line by the edge rule (center r above), the stem top on the small-letter line',
		pointOf(s, stemFoot).on === 'writing' &&
			pointOf(s, stemFoot).inset === 'edge' &&
			near(pointOf(s, stemFoot).y, r, 1.01) &&
			pointOf(s, top).on === 'small' &&
			near(pointOf(s, top).y, lines.small - r, 1.01) &&
			pointOf(s, footId).on === 'writing' &&
			near(pointOf(s, footId).y, r, 1.01),
		`feet ${pointOf(s, stemFoot).y}, ${pointOf(s, footId).y}; top ${pointOf(s, top).y}; r ${r}`
	);
	check(
		'n: the stem is plumb (its clicked ends kept)',
		pointOf(s, stemFoot).x === pointOf(s, top).x,
		`${pointOf(s, stemFoot).x} / ${pointOf(s, top).x}`
	);
	await shot(page, '03-n-done');
	// Undo after: the piece goes, named; Redo brings it back
	await page.keyboard.press('Control+z');
	await page.waitForTimeout(300);
	s = await state(page);
	const toastText = await page.evaluate(() =>
		[...document.querySelectorAll('.anyink-toast, [data-anyink-toast]')]
			.map((t) => t.textContent.trim())
			.join(' | ')
	);
	check(
		'n: Ctrl+Z after takes the piece away',
		!piecesOf(s).length && s.redo >= 1,
		`pieces ${piecesOf(s).length}`
	);
	check(
		'n: the Undo toast names it',
		/Undid: sketched a line on small n/.test(toastText),
		toastText
	);
	await page.keyboard.press('Control+y');
	await page.waitForTimeout(300);
	s = await state(page);
	check(
		'n: Ctrl+Y brings it back as it was',
		piecesOf(s).length === 1 &&
			piecesOf(s)[0]
				.parts.map((p) => p.type)
				.join(',') === nParts,
		`pieces ${piecesOf(s).length}`
	);
	const nSketch = s.sketch;

	// ---- small o: Circle between two lines ---------------------------------------------------
	await openLetter(page, 'o');
	v = await viewOf(page);
	await page.keyboard.press('c');
	const oc = 360;
	await clickAt(page, v, oc, lines.writing + 1);
	await clickAt(page, v, oc + 40, lines.small - 1);
	s = await state(page);
	const o = piecesOf(s)[0];
	const oIds = o?.parts?.[0]?.points || [];
	const oTop = oIds.map((id) => pointOf(s, id)).find((p) => p.on === 'small');
	const oBottom = oIds.map((id) => pointOf(s, id)).find((p) => p.on === 'writing');
	check(
		'o: a closed circle piece of four smooth points, one step "sketched a circle on small o"',
		!!o &&
			o.closed &&
			!!o.circle &&
			oIds.length === 4 &&
			s.titles[0] === 'sketched a circle on small o',
		s.titles[0]
	);
	const over = lines.overshoot;
	check(
		'o: its ink edges touch the writing and small-letter lines, plus the overshoot (edge rule)',
		!!oTop &&
			!!oBottom &&
			near(oTop.y, lines.small - s.sketch.thickness / 2 + over, 1.01) &&
			near(oBottom.y, s.sketch.thickness / 2 - over, 1.01),
		`top ${oTop?.y}, bottom ${oBottom?.y}, r ${s.sketch.thickness / 2}, overshoot ${over}`
	);
	await shot(page, '04-o');

	// ---- small s: Spline -------------------------------------------------------------------------
	await openLetter(page, 's');
	v = await viewOf(page);
	await page.keyboard.press('s');
	const sPoints = [
		[480, lines.small - 160],
		[300, lines.small - 10],
		[150, lines.small - 260],
		[460, lines.small - 640],
		[150, lines.writing + 120],
	];
	for (const [x, y] of sPoints) await clickAt(page, v, x, y);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(250);
	s = await state(page);
	const sp = piecesOf(s)[0];
	check(
		's: one spline through all five clicks, one step "sketched a spline on small s"',
		sp?.parts?.length === 1 &&
			sp.parts[0].type === 'spline' &&
			sp.parts[0].points.length === 5 &&
			s.titles[0] === 'sketched a spline on small s',
		`${sp?.parts?.[0]?.points?.length} points; ${s.titles[0]}`
	);
	const sTop = pointOf(s, sp.parts[0].points[1]);
	check(
		's: the top snapped to the small-letter line is an edge point with a level lock',
		sTop.on === 'small' && sTop.inset === 'edge' && sTop.lock === 'level',
		JSON.stringify(sTop)
	);
	await shot(page, '05-s');

	// ---- Capital A: Lines ------------------------------------------------------------------------
	await openLetter(page, 'A');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 120, lines.writing + 2);
	await clickAt(page, v, 520, lines.capitals - 2);
	await clickAt(page, v, 920, lines.writing + 2);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(200);
	s = await state(page);
	const legs = piecesOf(s)[0];
	const apex = pointOf(s, legs.parts[0].to);
	check(
		'A: two legs as one piece, a corner at the apex on the capitals line',
		legs.parts.map((p) => p.type).join(',') === 'line,line' &&
			apex.kind === 'corner' &&
			apex.on === 'capitals',
		JSON.stringify(apex)
	);
	// the bar, from leg to leg: each end snaps onto the leg ("on the stem")
	const legPoint = (t, side) => {
		const foot = pointOf(s, side === 'left' ? legs.parts[0].from : legs.parts[1].to);
		return { x: foot.x + (apex.x - foot.x) * t, y: foot.y + (apex.y - foot.y) * t };
	};
	const barL = legPoint(0.3, 'left');
	// fix track chain-snap: the bar end aimed 6 units above level, as a hand does
	const rise = pointOf(s, legs.parts[1].to);
	const barR = legPoint(0.3 + 6 / (apex.y - rise.y), 'right');
	await moveTo(page, v, barL.x, barL.y);
	const tag = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sketchToolHandler } = await import('/anyink/sketch/tools/tool_route.js');
		const hit = sketchToolHandler(editor.selectedTool).view().hit;
		return hit?.onPiece ? { piece: hit.onPiece.piece, t: hit.onPiece.t } : null;
	});
	check('A: the pointer on a leg snaps onto it', !!tag, JSON.stringify(tag));
	await clickAt(page, v, barL.x, barL.y);
	await clickAt(page, v, barR.x, barR.y);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(200);
	s = await state(page);
	const bar = piecesOf(s)[1];
	const barOn = (s.sketch.relations || []).filter(
		(rel) =>
			rel.type === 'onPiece' && [bar?.parts?.[0]?.from, bar?.parts?.[0]?.to].includes(rel.point)
	);
	check(
		'A: the bar is its own piece and step; both ends stay on the legs (onPiece)',
		piecesOf(s).length === 2 &&
			barOn.length === 2 &&
			s.titles.slice(0, 2).every((t) => t === 'sketched a line on Capital A'),
		`${barOn.length} onPiece; ${s.titles.slice(0, 2).join(' / ')}`
	);
	const barA = pointOf(s, bar?.parts?.[0]?.from);
	const barB = pointOf(s, bar?.parts?.[0]?.to);
	const barLevel = (s.sketch.relations || []).some(
		(rel) =>
			rel.type === 'level' &&
			[rel.a, rel.b].sort().join() === [bar?.parts?.[0]?.from, bar?.parts?.[0]?.to].sort().join()
	);
	check(
		'A: the bar end aimed 6 units high is stored level with its start AND on the leg',
		barA?.y === barB?.y && barLevel,
		`${JSON.stringify(barA)} ${JSON.stringify(barB)} level ${barLevel}`
	);
	await shot(page, '06-A');

	// ---- small v: Lines closed by clicking the small-letter line where the loop started ----------
	await openLetter(page, 'v');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 100, lines.small);
	await clickAt(page, v, 500, lines.small);
	await clickAt(page, v, 300, lines.writing);
	// the pointer on the line, not on the dot the edge rule drew r below it
	await moveTo(page, v, 100, lines.small);
	const closeHit = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { sketchToolHandler } = await import('/anyink/sketch/tools/tool_route.js');
		const hit = sketchToolHandler(editor.selectedTool).view().hit;
		return hit ? { join: hit.join, closes: hit.closes } : null;
	});
	check(
		'v: the pointer on the line where the loop started shows it closes',
		!!closeHit?.join && closeHit.closes === true,
		JSON.stringify(closeHit)
	);
	await clickAt(page, v, 100, lines.small);
	await page.waitForTimeout(200);
	s = await state(page);
	const vPiece = piecesOf(s)[0];
	check(
		'v: that click closes it: one closed piece of three Lines, three points, nothing open',
		!s.open &&
			vPiece?.closed === true &&
			vPiece.parts.length === 3 &&
			Object.keys(s.sketch.points).length === 3,
		`open ${s.open}, closed ${vPiece?.closed}, ${vPiece?.parts?.length} parts, ${
			Object.keys(s.sketch?.points || {}).length
		} points`
	);
	await shot(page, '06b-v-closed');

	// ---- small u: a box with Rectangle -------------------------------------------------------------
	await openLetter(page, 'u');
	v = await viewOf(page);
	await page.keyboard.press('r');
	await clickAt(page, v, 140, lines.writing + 1);
	await clickAt(page, v, 700, lines.small - 1);
	s = await state(page);
	const box = piecesOf(s)[0];
	const boxKinds = box?.parts?.map((p) => pointOf(s, p.from).kind) || [];
	check(
		'u: the box is a closed loop of four Lines with corners, one step "sketched a rectangle on small u"',
		box?.closed &&
			box.parts.length === 4 &&
			box.parts.every((p) => p.type === 'line') &&
			boxKinds.every((k) => k === 'corner') &&
			s.titles[0] === 'sketched a rectangle on small u',
		`${box?.parts?.length} parts, ${boxKinds.join(',')}; ${s.titles[0]}`
	);
	await shot(page, '07-u-box');

	// ---- small l: Esc finishes, a second Esc goes back to Select -------------------------------------
	await openLetter(page, 'l');
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 200, lines.writing + 2);
	await clickAt(page, v, 200, lines.top - 2);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(150);
	s = await state(page);
	check(
		'l: Esc finishes the open piece as one step',
		piecesOf(s).length === 1 &&
			!s.open &&
			s.tool === 'sketchLine' &&
			s.titles[0] === 'sketched a line on small l',
		`${s.tool}; ${s.titles[0]}`
	);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(150);
	s = await state(page);
	check('l: a second Esc goes back to Select', s.tool === 'resize', s.tool);

	// ---- S2 finalize: a stray click then Select stores nothing -------------------------------------
	await page.keyboard.press('l');
	await clickAt(page, v, 700, 700);
	await page.keyboard.press('v');
	await page.waitForTimeout(150);
	s = await state(page);
	check(
		'l: a stray click then Select (V) stores nothing and adds no step',
		piecesOf(s).length === 1 && !s.open && s.tool === 'resize' && s.titles[0] === 'sketched a line on small l',
		`pieces ${piecesOf(s).length}; ${s.titles[0]}; tool ${s.tool}`
	);

	// ---- leaving the letter mid-piece finishes it on its own letter --------------------------------
	await page.keyboard.press('l');
	await clickAt(page, v, 420, lines.writing + 2);
	await clickAt(page, v, 420, lines.small - 2);
	await openLetter(page, 'n');
	s = await state(page);
	const lNow = await page.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		return editor.project.getItem('glyph-0x6C')?.anyink?.sketch?.pieces?.length ?? 0;
	});
	check(
		'l: opening another letter mid-piece stores the piece on small l, as its own step',
		lNow === 2 && s.titles[0] === 'sketched a line on small l' && piecesOf(s).length === 1,
		`l pieces ${lNow}; ${s.titles[0]}`
	);
	const reopenedN = await page.evaluate(() => {
		const box = document.querySelector('[data-anyink-overlay]');
		return {
			box: !!box && !box.hidden && box.checkVisibility(),
			line: document.querySelector('anyink-coach')?.textContent || '',
		};
	});
	check(
		'n: a sketched letter (no ink yet) opens on Line, with no empty-letter box and no brush steer',
		s.tool === 'sketchLine' && !reopenedN.box && !/is empty/.test(reopenedN.line),
		`tool ${s.tool}; box ${reopenedN.box}; line "${reopenedN.line.trim().slice(0, 80)}"`
	);

	// ---- a mode switch mid-piece -------------------------------------------------------------------
	v = await viewOf(page);
	await page.keyboard.press('l');
	await clickAt(page, v, 900, lines.writing + 2);
	await clickAt(page, v, 900, lines.small - 2);
	await page.locator('[data-anyink-control="moreTools"]').click();
	await page.waitForTimeout(400);
	s = await state(page);
	check(
		'More tools mid-piece: the piece is finished on n and the tool goes back to Select',
		piecesOf(s).length === 2 && s.tool === 'resize' && !s.open,
		`pieces ${piecesOf(s).length}, tool ${s.tool}`
	);
	const columnAll = await toolColumn(page);
	check(
		'All tools with the flag on: no sketch tools on its tools',
		!columnAll.some((t) => t.startsWith('sketch') || t.startsWith('heading')),
		columnAll.join(' ')
	);
	await shot(page, '08-all-tools');

	// ---- save as .gs2 and open it again --------------------------------------------------------------
	const text = await page.evaluate(async () =>
		(await import('/app/main.js')).getCurrentProjectEditor().makeProjectFileText()
	);
	const file = resolve(shots, 'sketch-test.gs2');
	await writeFile(file, text, 'utf8');
	const saved = JSON.parse(text);
	const savedN = saved.glyphs?.['glyph-0x6E']?.anyink?.sketch;
	check(
		"save: the .gs2 holds each letter's sketch",
		!!savedN &&
			savedN.pieces.length === 2 &&
			!!saved.glyphs['glyph-0x6F']?.anyink?.sketch &&
			!!saved.glyphs['glyph-0x41']?.anyink?.sketch,
		`n pieces ${savedN?.pieces?.length}; ${text.length} bytes`
	);
	const page2 = await context.newPage();
	page2.on('pageerror', (error) => errors.push(`page 2: ${error.message}`));
	page2.on('dialog', (dialog) => dialog.dismiss());
	await page2.goto(`${origin}/?ui=simple`);
	await page2.locator('#input__new-project-name').waitFor({ timeout: 60000 });
	await page2.locator('#input__new-project-name').fill('Empty');
	await page2.locator('#button__create-new-project').click();
	await page2.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	const reopened = await page2.evaluate(async (gs2) => {
		const { openDroppedFont } = await import('/anyink/files/open_font.js');
		const outcome = await openDroppedFont({
			file: new File([gs2], 'sketch-test.gs2', { type: 'application/json' }),
		});
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const read = (id) => editor.project.getItem(id)?.anyink?.sketch ?? null;
		return {
			outcome,
			name: editor.project.settings.project.name,
			n: read('glyph-0x6E'),
			o: read('glyph-0x6F'),
			A: read('glyph-0x41'),
		};
	}, text);
	check(
		'reopen: the dropped .gs2 opens with every sketch as it was saved',
		reopened.outcome === 'opened' &&
			JSON.stringify(reopened.n) === JSON.stringify(savedN) &&
			reopened.o?.pieces?.length === 1 &&
			reopened.A?.pieces?.length === 2,
		`${reopened.outcome}, ${reopened.name}`
	);
	check(
		"reopen: n's first piece is the one drawn before the save",
		JSON.stringify(reopened.n?.pieces?.[0]) === JSON.stringify(nSketch.pieces[0])
	);
	await page2.close();

	// ---- All tools (?ui=all) with the flag on: keys as before; Undo as before ---------------------------
	const page3 = await context.newPage();
	page3.on('pageerror', (error) => errors.push(`page 3: ${error.message}`));
	page3.on('dialog', (dialog) => dialog.dismiss());
	await page3.goto(`${origin}/?ui=all`);
	await page3.waitForTimeout(1500);
	await page3.evaluate(async (gs2) => {
		(await import('/anyink/mode/features.js')).setFeaturesForTests({ sketch: true });
		const { importGlyphrProjectFromText } = await import('/project_editor/import_project.js');
		const { importProjectDataAndNavigate } = await import('/app/open_project.js');
		importProjectDataAndNavigate(importGlyphrProjectFromText(gs2));
	}, text);
	await page3.waitForTimeout(800);
	await page3.evaluate(async () => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x6E';
		editor.navigate();
	});
	await page3.waitForTimeout(500);
	const allColumn = await toolColumn(page3);
	const allKeys = {};
	for (const key of ['p', 'e', 'l', 's', 'c', 'r']) allKeys[key] = await keyTool(page3, key);
	const allState = await state(page3);
	check(
		'All tools, flag on: the sketch stays on the letter',
		allState.sketch?.pieces?.length === 2,
		`pieces ${allState.sketch?.pieces?.length}`
	);
	check(
		'All tools, flag on: no sketch tools',
		!allColumn.some((t) => t.startsWith('sketch') || t.startsWith('heading')),
		allColumn.join(' ')
	);
	check(
		'All tools, flag on: P / E / L / S / C / R as before',
		allKeys.p === 'newPath' &&
			allKeys.e === 'pathEdit' &&
			allKeys.l === 'resize' &&
			allKeys.s === 'resize' &&
			allKeys.c === 'resize' &&
			allKeys.r === 'newRectangle',
		JSON.stringify(allKeys)
	);
	await shot(page3, '09-all-tools-reopened');
	await page3.close();

	// ---- flag off again: the same column and keys as at the start --------------------------------------
	await page.evaluate(async () => {
		const { setMode } = await import('/anyink/mode/mode.js');
		setMode('simple');
	});
	await setFlag(page, false);
	await openLetter(page, 'n');
	const columnBack = await toolColumn(page);
	check(
		'flag off again, Simple: the column is exactly as before',
		JSON.stringify(columnBack) === JSON.stringify(columnOff),
		columnBack.join(' ')
	);
	const keysBack = {};
	for (const key of ['p', 'e', 'l', 's', 'c', 'r']) keysBack[key] = await keyTool(page, key);
	check(
		'flag off again, Simple: the keys are exactly as before',
		JSON.stringify(keysBack) === JSON.stringify(keysOff),
		JSON.stringify(keysBack)
	);
	s = await state(page);
	check(
		'flag off: nothing is drawn by the sketch layer and the stored sketch is left alone',
		piecesOf(s).length === 2
	);
	await shot(page, '10-flag-off');

	check('no page errors', !errors.length, errors.slice(0, 5).join(' | '));
} catch (error) {
	failures++;
	console.log(`FAIL the run stopped: ${error.stack || error.message}`);
	if (page) {
		await page.screenshot({ path: resolve(shots, 'stopped.png') }).catch(() => {});
		const where = await page
			.evaluate(async () => {
				const editor = (await import('/app/main.js')).getCurrentProjectEditor();
				return `page ${editor.nav.page}, tool ${editor.selectedTool}, letter ${editor.selectedItem?.chars}`;
			})
			.catch(() => '');
		console.log(`  stopped at: ${where}`);
	}
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true });
}
console.log(`${passes} passed, ${failures} failed; shots: ${shots}`);
if (failures) process.exit(1);
