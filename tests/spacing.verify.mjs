// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 spacing real-browser check (docs/UX-BEGINNER.md section 10, B3): tests/spacing.html in Chrome
// with a throwaway profile. The gap rule at 2,048 and 1,000 units, the measured fallback, sides
// measured on the body (a drifted i dot and a hooked g tail don't set a side, and hang no closer
// than 0.1 G to the letter's width: gg, gy, ig, il never touch), diagonal pairs (ty vy
// Ay yo) no closer than 0.7 G, a hand leaning 20 degrees spaced like the same hand upright, the
// slider dragged with the real mouse to both ends (no overlaps, photos stay under the ink), Reset
// gives the exact font back, an edge drag sets "set by you" and the slider still moves that letter,
// Mess up + Fit all, and a letter drawn by clicking on the pad.
// Usage: node tests/spacing.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-b3-spacing'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root: repo,
	configFile: false,
	logLevel: 'error',
	cacheDir: resolve(tmpdir(), 'anyink-b3-spacing-vite'),
	server: { port: 0, host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-b3-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: 'chrome',
	headless: true,
	viewport: { width: 1500, height: 1000 },
});
const page = context.pages()[0] || (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

let passed = 0;
const pass = (message) => {
	passed++;
	console.log(`PASS ${message}`);
};
const shot = (name) => page.screenshot({ path: resolve(shots, `${name}.png`), fullPage: true });

/** Every letter as the page has it, read from the live project */
const state = () =>
	page.evaluate(async () => {
		const { inkBounds } = await import('/src/anyink/spacing/measure.js');
		const { sideKinds, spacingBounds } = await import('/src/anyink/spacing/auto_space.js');
		const { fontSlant } = await import('/src/anyink/spacing/slant.js');
		const { getTrace } = await import('/src/anyink/trace/trace_model.js');
		const { getExtra } = await import('/src/anyink/spacing/extra.js');
		const p = window.anyinkSpacingPage;
		const font = p.project.settings.font;
		const letters = {};
		const slant = fontSlant(p.project);
		Object.values(p.project.glyphs).forEach((item) => {
			if (!item.shapes.length) return;
			const ink = inkBounds(item);
			const sides = spacingBounds(item, p.project);
			const trace = getTrace(item);
			const coords = item.shapes.flatMap((s) => s.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y]));
			letters[item.chars] = {
				left: sides.xMin,
				right: item.advanceWidth - sides.xMax,
				inkLeft: ink.xMin,
				inkRight: item.advanceWidth - ink.xMax,
				width: item.advanceWidth,
				kinds: sideKinds(item, font, slant),
				owner: item.anyink.spacing,
				photoGap: trace ? ink.xMin - trace.x : null,
				whole: coords.every(Number.isInteger) && Number.isInteger(item.advanceWidth),
			};
		});
		return {
			grid: p.grid,
			slant,
			slantText: document.getElementById('slant-readout').textContent,
			xHeight: font.xHeight,
			extra: getExtra(p.project),
			letters,
			lineGaps: p.lineGaps,
			readout: document.getElementById('line-readout').textContent,
			glyphs: JSON.stringify(p.project.save().glyphs),
			cards: document.querySelectorAll('.letter').length,
		};
	});

/** How close two letters' inks come on any row, set side by side on the page */
const gapOf = (a, b) =>
	page.evaluate(([x, y]) => window.anyinkSpacingPage.closestGap(x, y), [a, b]);

/** Drag the slider's thumb with the real mouse to a share of its track (0 = left end) */
async function dragSlider(share) {
	const box = await page.locator('#extra').boundingBox();
	const value = await page.evaluate(() => {
		const input = document.getElementById('extra');
		return (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
	});
	const y = box.y + box.height / 2;
	const thumb = 8;
	const xAt = (s) => box.x + thumb + s * (box.width - 2 * thumb);
	await page.mouse.move(xAt(value), y);
	await page.mouse.down();
	const steps = 12;
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(xAt(value + ((share - value) * i) / steps), y);
	}
	await page.mouse.up();
}

try {
	await page.goto(`${origin}/tests/spacing.html`);
	await page.waitForFunction(() => window.anyinkSpacingPage?.ready === true, null, {
		timeout: 30000,
	});

	for (const grid of [2048, 1000]) {
		await page.click(`#grid-${grid}`);
		const s = await state();
		assert.equal(s.grid, grid);
		const G = s.xHeight * 0.08;
		const S = Math.round(G);
		const R = Math.round(0.6 * G);
		const O = Math.round(0.4 * G);
		const expect = {
			H: [S, S],
			n: [S, S],
			o: [R, R],
			r: [S, O],
			a: [R, S],
			c: [R, O],
			v: [O, O],
			f: [S, O],
			'.': [R, R],
			'!': [R, R],
			"'": [R, R],
			Ħ: [S, S],
			ø: [R, R],
			ɔ: [O, R],
			l: [S, S],
			i: [S, S],
			g: [R, S],
			t: [S, O],
			y: [O, O],
			A: [O, O],
		};
		Object.entries(expect).forEach(([char, [left, right]]) => {
			const l = s.letters[char];
			assert.ok(l, `${char} missing`);
			assert.ok(Math.abs(l.left - left) <= 0.5, `${grid} ${char} left ${l.left} vs ${left}`);
			assert.ok(Math.abs(l.right - right) <= 0.5, `${grid} ${char} right ${l.right} vs ${right}`);
			assert.ok(l.whole, `${grid} ${char} has whole points and width`);
		});
		assert.equal(s.letters['Ħ'].kinds.source, 'measured');
		assert.deepEqual([s.letters['ɔ'].kinds.left, s.letters['ɔ'].kinds.right], ['O', 'R']);
		['H', 'n', 'o'].forEach((char) => assert.equal(s.letters[char].photoGap, 30, `${char} photo`));
		assert.equal(s.cards, 20);
		pass(
			`${grid} units: G = ${G.toFixed(
				1
			)}; 20 letters fitted by the rule (straight ${S}, round ${R}, open ${O}, punctuation ${R}); measured Ħ ø ɔ; whole numbers; photos 30 units left of the ink`
		);
		// The body sets the sides: the i's dot (drifted a stroke right) and the g's tail (hooking
		// left by 0.3 of the small-letter height) hang into the space beside the letter, but stop
		// 0.1 G short of its width, so the letter widens only by what is left over
		const stroke = Math.round(s.xHeight * 0.12);
		const hang = s.letters.i.right - s.letters.i.inkRight;
		assert.ok(Math.abs(hang - (S - 0.1 * G)) <= 1, `the i dot hangs ${hang} into a ${S} space`);
		assert.ok(
			Math.abs(s.letters.i.inkRight - 0.1 * G) <= 1,
			`the i dot stops 0.1 G inside: ${s.letters.i.inkRight}`
		);
		assert.ok(
			s.letters.i.width < 2 * stroke + 2 * S,
			`the i is narrower than stem, dot and two gaps: ${s.letters.i.width}`
		);
		assert.ok(
			Math.abs(s.letters.g.inkLeft - 0.1 * G) <= 1,
			`the g tail stops 0.1 G inside: ${s.letters.g.inkLeft}`
		);
		pass(
			`${grid} units: the drifted i dot hangs ${hang.toFixed(
				1
			)} into its ${S} space and the hooked g tail stops ${s.letters.g.inkLeft.toFixed(
				1
			)} inside the letter; i is ${s.letters.i.width} wide`
		);
		// Descenders and dots side by side never meet
		await page.fill('#text', 'gg gy yg yy ig gi il li ti');
		const tails = await state();
		const closestTail = tails.lineGaps.reduce((best, entry) =>
			!best || entry.gap < best.gap ? entry : best
		);
		assert.ok(closestTail.gap >= 0.2 * G - 1, JSON.stringify(tails.lineGaps));
		pass(
			`${grid} units: "gg gy yg yy ig gi il li ti" row by row, closest "${
				closestTail.pair
			}" ${closestTail.gap.toFixed(1)} units apart (0.2 G = ${(0.2 * G).toFixed(1)}); "${tails.readout}"`
		);
		await shot(`01a-tails-${grid}`);
		await page.fill('#text', 'Hon r av! ty Ay yo');
		// Diagonal pairs: open sides meeting at the same height are 0.8 G apart, never touching
		const diagonal = {};
		for (const pair of ['ty', 'vy', 'Ay', 'yo', 'vv'])
			diagonal[pair] = await gapOf(pair[0], pair[1]);
		Object.entries(diagonal).forEach(([pair, gap]) =>
			assert.ok(gap >= 0.7 * G, `${grid} ${pair}: ${gap} < 0.7 G`)
		);
		['ty', 'vy'].forEach((pair) =>
			assert.ok(
				Math.abs(diagonal[pair] - 2 * O) <= 0.5,
				`${grid} ${pair}: ${diagonal[pair]} vs ${2 * O}`
			)
		);
		pass(
			`${grid} units: diagonal pairs ${Object.entries(diagonal)
				.map(([pair, gap]) => `${pair} ${gap.toFixed(1)}`)
				.join(', ')} (0.7 G = ${(0.7 * G).toFixed(1)}; was 0.4 G = ${(0.4 * G).toFixed(1)} for ty)`
		);
		await shot(`01-fitted-${grid}`);
	}

	// A hand leaning 20 degrees: the slant read from the stems, every pair as close as upright
	const STEMMED = ['l', 'n', 'H', 't', 'i', 'o', 'v', 'r', 'a'];
	for (const grid of [2048, 1000]) {
		await page.click(`#grid-${grid}`);
		await page.click('#lean-0');
		const upright = {};
		for (const a of STEMMED) for (const b of STEMMED) upright[a + b] = await gapOf(a, b);
		await page.click('#lean-20');
		const s = await state();
		assert.equal(s.slant, 20, `slant ${s.slant}`);
		assert.match(s.slantText, /20 degrees/);
		const worst = { pair: '', off: 0 };
		for (const a of STEMMED) {
			for (const b of STEMMED) {
				const gap = await gapOf(a, b);
				const want = upright[a + b];
				const off = Math.abs(gap - want);
				assert.ok(
					off <= Math.max(2, 0.1 * want),
					`${grid} leaning ${a}${b}: ${gap} vs upright ${want}`
				);
				assert.ok(gap > 0, `${grid} leaning ${a}${b} overlaps`);
				if (off > worst.off) Object.assign(worst, { pair: a + b, off });
			}
		}
		const G = s.xHeight * 0.08;
		// A letter the table doesn't know is measured with the slant taken out too
		assert.deepEqual([s.letters['Ħ'].kinds.left, s.letters['Ħ'].kinds.right], ['S', 'S']);
		const hText = await page.locator('.letter[data-char="Ħ"] .kinds').textContent();
		assert.match(hText, /left straight 100%, right straight 100%/, hText);
		pass(`${grid} units, leaning: measured Ħ reads "${hText.trim()}"`);
		pass(
			`${grid} units, leaning 20 degrees: the stems say ${s.slant} degrees; ll ${(
				await gapOf('l', 'l')
			).toFixed(1)} (2 G = ${(2 * G).toFixed(1)}, upright ${upright.ll.toFixed(1)}); all ${
				STEMMED.length ** 2
			} pairs within ${worst.off.toFixed(1)} units of upright (worst ${worst.pair})`
		);
		await page.fill('#text', 'Hint lollino vital');
		const lined = await state();
		assert.ok(
			lined.lineGaps.every((entry) => entry.gap > 0),
			JSON.stringify(lined.lineGaps)
		);
		await shot(`01b-leaning-${grid}`);
		await page.click('#lean-0');
	}
	await page.fill('#text', 'Hon r av! ty Ay yo');

	// 2,048 for the rest
	await page.click('#grid-2048');
	const start = await state();
	const G = Math.round(start.xHeight * 0.08);
	await page.fill('#text', 'Hon r av! ocean');
	await page.fill('#text', 'Hon r av!');

	await dragSlider(0);
	let s = await state();
	assert.equal(s.extra, -G, `slider at the left end: ${s.extra}`);
	Object.entries(s.letters).forEach(([char, l]) => {
		assert.ok(l.left >= 0 && l.right >= 0, `${char} touches at most: ${l.left} / ${l.right}`);
	});
	['H', 'n', 'o'].forEach((char) =>
		assert.equal(s.letters[char].photoGap, 30, `${char} photo at -G`)
	);
	assert.ok(
		s.lineGaps.every((entry) => entry.gap >= 0),
		JSON.stringify(s.lineGaps)
	);
	assert.match(s.readout, /No letters overlap/);
	assert.deepEqual([s.letters.H.left, s.letters.H.right], [0, 0]);
	pass(
		`slider dragged with the mouse to the left end: extra ${s.extra}; every side 0 or more, H touches (0 / 0); the line reads "${s.readout}"; photos still 30 left of the ink`
	);
	await shot('02-closest');

	await dragSlider(1);
	s = await state();
	assert.equal(s.extra, G);
	assert.deepEqual([s.letters.H.left, s.letters.H.right], [2 * G, 2 * G]);
	assert.deepEqual(
		[s.letters.o.left, s.letters.o.right],
		[Math.round(0.6 * 88) + G, Math.round(0.6 * 88) + G]
	);
	['H', 'n', 'o'].forEach((char) => assert.equal(s.letters[char].photoGap, 30));
	pass(
		`slider at the right end: extra +${G}; H ${s.letters.H.left} / ${s.letters.H.right}, o ${s.letters.o.left} / ${s.letters.o.right}; photos follow`
	);
	await shot('03-furthest');

	await page.click('#reset');
	s = await state();
	assert.equal(s.extra, 0);
	assert.equal(s.glyphs, start.glyphs, 'Reset gives the exact font back');
	pass('Reset: the font is exactly as before the slider (every point, width and photo)');

	// An edge drag on n: set by you; the slider still moves it
	await page.locator('.letter[data-char="n"] button', { hasText: 'Drag left edge' }).click();
	s = await state();
	assert.equal(s.letters.n.owner, 'manual');
	assert.equal(s.letters.n.left, G + 40);
	assert.equal(s.letters.n.photoGap, 30);
	await page.locator('#extra').focus();
	for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
	s = await state();
	assert.equal(s.extra, -10);
	assert.equal(s.letters.n.left, G + 30);
	assert.equal(s.letters.H.left, G - 10);
	assert.equal(s.letters.n.photoGap, 30);
	pass(
		`edge drag on n: "Set by you", left space ${
			G + 40
		}, photo follows; 10 arrow presses on the slider move n (manual) and H (automatic) closer by 10`
	);
	await shot('04-manual-n');

	await page.click('#reset');
	await page.click('#mess');
	s = await state();
	const messed = Object.values(s.letters).filter(
		(l) => l.owner === 'auto' && l.left !== S_(l, G)
	).length;
	assert.ok(messed > 5, `mess moved letters: ${messed}`);
	await shot('05-messed');
	await page.click('#fit-all');
	s = await state();
	assert.equal(s.letters.H.left, G);
	assert.equal(s.letters.o.left, Math.round(0.6 * 88));
	assert.equal(s.letters.n.owner, 'manual');
	['H', 'o'].forEach((char) => assert.equal(s.letters[char].photoGap, 30));
	pass(
		`Mess up then Fit all: ${messed} automatic letters back on the rule, photos under their ink, the manual n left as he set it`
	);
	await shot('06-fit-all');

	// Draw ß on the pad: a block from the writing line to the small-letter line (both sides straight)
	const corners = [
		[200, 0],
		[800, 0],
		[800, 1100],
		[200, 1100],
	];
	await page.locator('#pad').scrollIntoViewIfNeeded();
	for (const [x, y] of corners) {
		const at = await page.evaluate(
			([fx, fy]) => {
				const svg = document.getElementById('pad');
				const p = svg.createSVGPoint();
				p.x = fx;
				p.y = -fy;
				const screen = p.matrixTransform(svg.getScreenCTM());
				return { x: screen.x, y: screen.y };
			},
			[x, y]
		);
		await page.mouse.click(at.x, at.y);
	}
	await page.selectOption('#pad-char', 'ß');
	await page.click('#pad-done');
	s = await state();
	const sz = s.letters['ß'];
	assert.ok(sz, 'drawn letter added');
	assert.equal(sz.kinds.source, 'measured');
	assert.deepEqual([sz.kinds.left, sz.kinds.right], ['S', 'S']);
	assert.ok(Math.abs(sz.left - G) <= 1 && Math.abs(sz.right - G) <= 1, `${sz.left} / ${sz.right}`);
	const cardText = await page.locator('.letter[data-char="ß"] .kinds').textContent();
	pass(
		`a block drawn on the pad by mouse clicks as ß: measured "${cardText.trim()}", fitted ${
			sz.left
		} / ${sz.right}`
	);
	await shot('07-drawn');

	assert.deepEqual(errors, [], errors.join('\n'));
	pass('no page errors');
	console.log(`\n${passed} checks passed. Screenshots: ${shots}`);
} catch (error) {
	await shot('zz-failure').catch(() => {});
	console.error(error);
	console.error(errors.join('\n'));
	process.exitCode = 1;
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}

/** The left space the rule gives a letter */
function S_(l, G) {
	const share = { S: 1, R: 0.6, O: 0.4 }[l.kinds.left];
	return Math.round((l.kinds.punctuation ? 0.6 : share) * G);
}
