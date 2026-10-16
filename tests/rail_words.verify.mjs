// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 fix pass, board area: real-browser check that Simple's top bar rail keeps every step's
// words ("1 Letters 0/58 -- 2 Try it -- 3 Use in Word") at every width the app supports and below
// it (docs/UX-BEGINNER.md 7: 1600 x 900 target, works down to 1280 x 720). The acceptance run at
// 1280 showed "2" and "3" alone with 350 px free. For each width, on the board and on Try it:
// every step's name is drawn and readable (below 1280: the current step's, the others say
// what they are in their tooltip), nothing in the bar overlaps (rail, Undo, Redo, the status pill,
// More tools, Menu), nothing runs off the window and the bar has no sideways scroll.
// Usage: node tests/rail_words.verify.mjs [screenshot folder]   (default: the OS temp folder)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = resolve(repo, 'src');
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-rail-words'));
await mkdir(shots, { recursive: true });
const scratch = await mkdtemp(resolve(tmpdir(), 'anyink-rail-words-'));

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
const browser = await chromium.launch({ channel: process.env.RAIL_BROWSER || 'chrome', headless: true });
const errors = [];
let failed = false;

/** The bar as Chrome draws it: each step's words and box, the other controls' boxes */
const look = (page) =>
	page.evaluate(() => {
		const bar = document.querySelector('#app__top-bar.anyink-topbar');
		const box = (el) => {
			if (!el || !el.checkVisibility()) return null;
			const r = el.getBoundingClientRect();
			return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
		};
		const steps = [...bar.querySelectorAll('[data-anyink-step]')].map((step) => {
			const name = step.querySelector('.anyink-topbar__step-name');
			return {
				id: step.dataset.anyinkStep,
				current: step.getAttribute('aria-current') === 'step',
				title: step.title,
				words: name && name.checkVisibility() ? name.textContent.trim() : '',
				nameWidth: box(name)?.width ?? 0,
				box: box(step),
			};
		});
		const others = ['undo', 'redo', 'status', 'more-tools', 'menu']
			.map((k) => ({ k, b: box(bar.querySelector(`.anyink-topbar__${k}`)) }))
			.filter((o) => o.b);
		return {
			steps,
			rail: box(bar.querySelector('.anyink-topbar__rail')),
			others,
			overflow: bar.scrollWidth - bar.clientWidth,
			width: window.innerWidth,
		};
	});

const WORDS = { letters: 'Letters', tryIt: 'Try it', useInWord: 'Use in Word' };

function judge(label, seen) {
	const problems = [];
	// 1280 and up (the app's sizes, UX-BEGINNER.md 7): every step's words; below, the current one's
	for (const step of seen.steps) {
		if (seen.width < 1280 && !step.current) {
			if (!step.title.trim()) problems.push(`${step.id} tooltip "${step.title}"`);
			continue;
		}
		if (step.words !== WORDS[step.id]) problems.push(`${step.id} says "${step.words}"`);
		if (step.nameWidth < 20) problems.push(`${step.id} name ${step.nameWidth} px wide`);
	}
	const boxes = [{ k: 'rail', b: seen.rail }, ...seen.others].sort((a, b) => a.b.left - b.b.left);
	for (let i = 1; i < boxes.length; i++) {
		if (boxes[i].b.left < boxes[i - 1].b.right) {
			problems.push(`${boxes[i - 1].k} (to ${boxes[i - 1].b.right}) overlaps ${boxes[i].k} (from ${boxes[i].b.left})`);
		}
	}
	if (seen.overflow > 0) problems.push(`bar scrolls sideways by ${seen.overflow} px`);
	for (const { k, b } of boxes) {
		if (b.right > seen.width) problems.push(`${k} runs off the window (to ${b.right} of ${seen.width})`);
	}
	const railText = seen.steps.map((s) => `${s.words}@${s.box.left}-${s.box.right}`).join(' | ');
	const undo = seen.others.find((o) => o.k === 'undo');
	const free = undo ? undo.b.left - seen.rail.right : null;
	if (problems.length) {
		failed = true;
		console.log(`FAIL ${label}: ${problems.join('; ')}  [${railText}]`);
	} else {
		console.log(`PASS ${label}: ${railText}; ${free} px free before Undo`);
	}
}

try {
	const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('dialog', (dialog) => dialog.dismiss());
	await page.goto(`${origin}/?ui=simple`);
	const field = page.locator('#input__new-project-name');
	await field.waitFor({ timeout: 60000 });
	// a long font name: the widest the bar gets
	await field.fill('My Very Own Handwriting Font Number One');
	await page.locator('#button__create-new-project').click();
	await page.locator('[data-anyink-board]').waitFor({ timeout: 30000 });
	await page.waitForTimeout(700);

	const widths = [
		[1600, 900],
		[1440, 900],
		[1280, 720],
		[1024, 720],
	];
	for (const [width, height] of widths) {
		await page.setViewportSize({ width, height });
		await page.waitForTimeout(300);
		judge(`board ${width}`, await look(page));
		await page.screenshot({ path: resolve(shots, `board-${width}.png`), clip: { x: 0, y: 0, width, height: 90 } });
	}
	await page.locator('[data-anyink-step="tryIt"]').click();
	await page.waitForTimeout(800);
	for (const [width, height] of widths) {
		await page.setViewportSize({ width, height });
		await page.waitForTimeout(300);
		const seen = await look(page);
		assert.ok(seen.steps.find((s) => s.id === 'tryIt').current, 'Try it is the current step');
		judge(`try-it ${width}`, seen);
		await page.screenshot({ path: resolve(shots, `tryit-${width}.png`), clip: { x: 0, y: 0, width, height: 90 } });
	}
	if (errors.length) {
		failed = true;
		console.log(`FAIL page errors: ${errors.join(' | ')}`);
	}
	console.log(`shots: ${shots}`);
} finally {
	await browser.close();
	await server.close();
	await rm(scratch, { recursive: true, force: true });
}
if (failed) process.exit(1);
