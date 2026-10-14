// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement real-browser check (docs/UX-BEGINNER.md section 10, B3), in Chrome with a throwaway
// profile, on tests/placement.html: the synthetic handwriting photos are decoded by Chrome, their
// letters placed by src/anyink/placement and traced by the real auto-trace (potrace worker). Checks,
// in font units of the traced shapes:
//   A. "B r e n a H d" (one row): one scale for all 7; every letter's ink sits on the writing line
//      (within 2 % of the letter box, B11's limit); stroke weights within 15 %, where fitting each
//      letter to its own lines would spread them past 15 %; x and y are whole units.
//   B. "a g B Q f ." (one row): the line comes from the letters on it; g, Q and the dropping f hang
//      their tails more than 200 units below it.
//   C. the same letters, each as its own photo: a, B and the period sit their ink on the line and
//      reach their own lines; g and Q sit their bowls on it (Q 1.5 % under); a lone f has no tail
//      until he says so.
// Usage: node tests/placement.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b3-placement'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root: repo,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(tmpdir(), 'anyink-b3-placement-vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-b3-placement-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.B3_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1500, height: 1300 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const pass = (message) => console.log(`PASS ${message}`);
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`), fullPage: true });
const BOX = 2048;
const ON_THE_LINE = 0.02 * BOX;
const O = 0.015 * BOX;
const spread = (values) => Math.max(...values) / Math.min(...values) - 1;
const run = (name, alone) =>
	page.evaluate(([n, a]) => window.anyinkPlacementPage.run(n, { alone: a }), [name, alone]);
const table = (result) =>
	result.letters
		.map(
			(l) =>
				`  ${l.char}  ${l.seat.padEnd(6)} tail ${l.tail ? 'yes' : 'no '}  body ${String(
					l.bodyFrom || '-'
				).padEnd(7)} ` +
				`scale ${l.scale.toFixed(3)}  stroke ${l.stroke.toFixed(1)}  ink ${Math.round(
					l.inkBottom
				)}..${Math.round(l.inkTop)}  pen line ${Math.round(l.penLine)}`
		)
		.join('\n');

try {
	await page.goto(`${origin}/tests/placement.html`);
	await page.waitForFunction(() => window.anyinkPlacementPage?.ready === true);

	// A. B r e n a H d, one row
	const brennan = await run('brennan-hand', false);
	console.log(table(brennan));
	assert.equal(brennan.letters.length, 7);
	assert.deepEqual(brennan.letters.map((l) => l.char).join(''), 'BrenaHd');
	assert.ok(
		brennan.letters.every((l) => l.seat === 'bottom' && l.scale === brennan.scale),
		'one scale, one row'
	);
	assert.ok(
		brennan.letters.every((l) => l.wholeUnits),
		'x and y are whole units'
	);
	for (const l of brennan.letters) {
		assert.ok(
			Math.abs(l.inkBottom) <= ON_THE_LINE,
			`${l.char} ink bottom ${l.inkBottom.toFixed(1)} is on the line`
		);
		assert.ok(l.shapes >= 1, `${l.char} traced`);
	}
	const strokes = brennan.letters.map((l) => l.stroke);
	const own = brennan.letters.map((l) => (l.stroke / l.scale) * l.ownRatio);
	assert.ok(spread(strokes) <= 0.15, `stroke spread ${(spread(strokes) * 100).toFixed(1)} %`);
	assert.ok(spread(own) > 0.15, `per-letter spread ${(spread(own) * 100).toFixed(1)} %`);
	pass(
		`A. B r e n a H d: one scale ${brennan.scale.toFixed(
			3
		)}; every ink bottom within ${ON_THE_LINE} units of the writing line; ` +
			`traced stroke weights ${Math.min(...strokes).toFixed(1)} to ${Math.max(...strokes).toFixed(
				1
			)} units ` +
			`(spread ${(spread(strokes) * 100).toFixed(1)} %; fitting each letter alone would spread ${(
				spread(own) * 100
			).toFixed(1)} %)`
	);
	await shot('a-brennan-hand-row');

	// B. a g B Q f ., one row
	const tails = await run('tails-row', false);
	console.log(table(tails));
	const letter = (result, char) => result.letters.find((l) => l.char === char);
	for (const char of ['g', 'Q', 'f']) {
		assert.equal(letter(tails, char).tail, true, `${char} has a tail`);
		assert.ok(letter(tails, char).inkBottom < -200, `${char} tail hangs below`);
	}
	for (const char of ['a', 'B', 'g', 'Q', 'f']) {
		assert.ok(
			Math.abs(letter(tails, char).penLine) <= ON_THE_LINE,
			`${char} pen line ${letter(tails, char).penLine.toFixed(1)}`
		);
	}
	assert.ok(Math.abs(letter(tails, 'a').inkBottom) <= ON_THE_LINE);
	assert.ok(Math.abs(letter(tails, 'B').inkBottom) <= ON_THE_LINE);
	const tailStrokes = tails.letters.filter((l) => l.char !== '.').map((l) => l.stroke);
	assert.ok(
		spread(tailStrokes) <= 0.15,
		`tails-row stroke spread ${(spread(tailStrokes) * 100).toFixed(1)} %`
	);
	pass(
		`B. a g B Q f .: g, Q and f hang tails to ${Math.round(
			letter(tails, 'g').inkBottom
		)}, ${Math.round(letter(tails, 'Q').inkBottom)}, ` +
			`${Math.round(
				letter(tails, 'f').inkBottom
			)}; every pen line within ${ON_THE_LINE} units; stroke spread ${(
				spread(tailStrokes) * 100
			).toFixed(1)} %`
	);
	await shot('b-tails-row');

	// C. each letter as its own photo
	const lone = await run('tails-row', true);
	console.log(table(lone));
	const near = (value, target, slack) => Math.abs(value - target) <= slack;
	// potrace smooths the corners a little, so traced ink edges get 1 % of the box of slack
	const TRACE = 0.01 * BOX;
	assert.ok(
		near(letter(lone, 'a').inkBottom, 0, TRACE) && near(letter(lone, 'a').inkTop, 1100, TRACE),
		'a on its lines'
	);
	assert.ok(
		near(letter(lone, 'B').inkBottom, 0, TRACE) && near(letter(lone, 'B').inkTop, 1480, TRACE),
		'B on its lines'
	);
	assert.ok(
		near(letter(lone, '.').inkBottom, 0, TRACE) && near(letter(lone, '.').inkTop, 132, TRACE),
		'period on its lines'
	);
	assert.equal(letter(lone, 'g').bodyFrom, 'counter');
	assert.ok(
		near(letter(lone, 'g').penLine, 0, ON_THE_LINE),
		`g bowl ${letter(lone, 'g').penLine.toFixed(1)}`
	);
	assert.ok(letter(lone, 'g').inkBottom < -400, 'g tail hangs');
	assert.equal(letter(lone, 'Q').tail, true);
	assert.ok(
		near(letter(lone, 'Q').penLine, -O, ON_THE_LINE),
		`Q bowl ${letter(lone, 'Q').penLine.toFixed(1)}`
	);
	assert.equal(letter(lone, 'f').tail, false);
	assert.ok(near(letter(lone, 'f').inkBottom, 0, TRACE), 'a lone f stands on its ink');
	pass(
		`C. each alone: a, B and the period on their lines; g's bowl at ${Math.round(
			letter(lone, 'g').penLine
		)} and Q's at ` +
			`${Math.round(letter(lone, 'Q').penLine)} (target ${-Math.round(
				O
			)}), tails below; a lone f has no tail until he says so`
	);
	await shot('c-tails-alone');

	assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
	pass('no page errors');
	console.log(`Screenshots: ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
