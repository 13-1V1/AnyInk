// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 3 real-browser check: the File menu, the preview strip's Presets menu and the Projects
// menu are readable without hover, hints and greyed-out rows included. Starts its own Vite dev
// server on a free port, opens Chrome with a throwaway profile, measures contrast from the computed
// colors (opacity counted only where Chrome paints it: a display: contents box has none) and
// saves screenshots.
// B1 fix pass: the greyed-out row's reason reads "Open another font first", the Projects menu card
// labels ("Editing" on the green-tinted card) reach 4.5:1, and the Presets hints say "letters".
// Usage: node tests/menus.verify.mjs [screenshot folder] [src folder]
//   (defaults: the OS temp folder, this repo's src/)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = process.argv[3]
	? resolve(process.argv[3])
	: fileURLToPath(new URL('../src/', import.meta.url));
const shots = resolve(process.argv[2] || resolve(tmpdir(), 'anyink-menus'));
await mkdir(shots, { recursive: true });

const server = await createServer({
	root,
	configFile: false,
	logLevel: 'error',
	server: { port: 0, host: '127.0.0.1' },
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = await mkdtemp(resolve(tmpdir(), 'anyink-menus-'));
const context = await chromium.launchPersistentContext(profile, {
	channel: process.env.MENUS_BROWSER || 'chrome',
	headless: true,
	viewport: { width: 1600, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

// Runs in the page: WCAG contrast of each element's text against the first painted background
// behind it (alpha layers are composited from the menu up).
// spec: a selector, or [selector, true] to include greyed-out rows.
function measure(spec) {
	const [selector, withDisabled] = Array.isArray(spec) ? spec : [spec, false];
	const parse = (text) => {
		const m = text.match(/rgba?\(([^)]+)\)/);
		if (!m) return null;
		const [r, g, b, a = 1] = m[1]
			.split(/[\s,/]+/)
			.filter(Boolean)
			.map(Number);
		return { r, g, b, a };
	};
	const lum = ({ r, g, b }) =>
		[r, g, b]
			.map((v) => {
				v /= 255;
				return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
			})
			.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
	const ratio = (x, y) => {
		const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
		return (hi + 0.05) / (lo + 0.05);
	};
	const backgroundOf = (element) => {
		const layers = [];
		for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
			const bg = parse(getComputedStyle(node).backgroundColor);
			if (bg && bg.a > 0) {
				layers.push(bg);
				if (bg.a >= 1) break;
			}
		}
		let result = { r: 0, g: 0, b: 0, a: 1 };
		for (const layer of layers.reverse()) {
			result = {
				r: layer.r * layer.a + result.r * (1 - layer.a),
				g: layer.g * layer.a + result.g * (1 - layer.a),
				b: layer.b * layer.a + result.b * (1 - layer.a),
				a: 1,
			};
		}
		return result;
	};
	return [...document.querySelectorAll(selector)]
		.filter(
			(element) => element.textContent.trim() && (withDisabled || !element.closest('[disabled]'))
		)
		.map((element) => {
			const style = getComputedStyle(element);
			// Opacity as painted: every box up to the menu; a display: contents box paints none.
			let opacity = 1;
			for (let node = element; node && node.id !== 'context-menu'; node = node.parentElement) {
				const nodeStyle = getComputedStyle(node);
				if (nodeStyle.display !== 'contents') opacity *= Number(nodeStyle.opacity);
			}
			const fg = parse(style.color);
			const bg = backgroundOf(element);
			const seen = { ...fg, a: fg.a * opacity };
			const shown = {
				r: seen.r * seen.a + bg.r * (1 - seen.a),
				g: seen.g * seen.a + bg.g * (1 - seen.a),
				b: seen.b * seen.a + bg.b * (1 - seen.a),
			};
			return {
				text: element.textContent.trim().slice(0, 40),
				color: style.color,
				ratio: Math.round(ratio(shown, bg) * 100) / 100,
			};
		});
}

const report = (label, rows, min) => {
	assert(rows.length, `${label}: nothing measured`);
	const worst = rows.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
	console.log(
		`${label}: ${rows.length} measured, lowest ${worst.ratio}:1 ("${worst.text}", ${worst.color})`
	);
	for (const row of rows)
		assert(row.ratio >= min, `${label} "${row.text}" is ${row.ratio}:1, needs ${min}:1`);
};

const menuShot = async (name) => {
	await page.waitForTimeout(400); // let the fade-in finish
	const box = await page.locator('#context-menu').boundingBox();
	await page.screenshot({
		path: resolve(shots, name),
		clip: {
			x: Math.max(0, box.x - 8),
			y: Math.max(0, box.y - 8),
			width: box.width + 16,
			height: box.height + 16,
		},
	});
};

try {
	await page.goto(`${origin}/`);
	await page.locator('#button__create-new-project').click();
	await page.locator('#input__new-project-name').waitFor({ state: 'detached' });

	// File menu
	await page.getByRole('button', { name: 'File', exact: true }).click();
	await page.locator('#context-menu').waitFor();
	await page.mouse.move(5, 895);
	await menuShot('file-menu.png');
	report(
		'File menu labels',
		await page.evaluate(measure, '#context-menu .context-menu-row .row-name'),
		4.5
	);
	report(
		'File menu shortcut keys',
		await page.evaluate(measure, '#context-menu .context-menu-row .row-notes code'),
		3
	);
	report('File menu headings', await page.evaluate(measure, '#context-menu .spanAll h2'), 4.5);
	const rest = await page.evaluate(
		() => getComputedStyle(document.querySelector('#context-menu .row-name')).backgroundColor
	);
	await page.locator('#context-menu .row-name').first().hover();
	await menuShot('file-menu-hover.png');
	const hover = await page.evaluate(() => {
		const name = document.querySelector('#context-menu .context-menu-row:hover .row-name');
		return name && getComputedStyle(name).backgroundColor;
	});
	assert(hover && hover !== rest, `hover must change the row (rest ${rest}, hover ${hover})`);
	report(
		'File menu hovered label',
		await page.evaluate(measure, '#context-menu .context-menu-row:hover .row-name'),
		4.5
	);
	console.log(`File menu hover: row background ${rest} -> ${hover}`);
	await page.keyboard.press('Escape');
	await page.mouse.click(1200, 450);
	await page.locator('#context-menu').waitFor({ state: 'detached' });

	// Presets menu (preview strip)
	await page.locator('.preview-strip__presets').click(); // B4: the button now says Samples
	await page.locator('#context-menu').waitFor();
	await page.mouse.move(1500, 895);
	await menuShot('presets-menu.png');
	report(
		'Presets labels',
		await page.evaluate(measure, '#context-menu .context-menu-row .row-name'),
		4.5
	);
	const hints = await page.evaluate(measure, '#context-menu .context-menu-row .row-notes span');
	report('Presets hints', hints, 4.5);
	// B1 fix pass: house words in the hints ("26 letters", not "26 glyphs")
	hints.forEach((row) => assert.doesNotMatch(row.text, /glyph/i, `Presets hint "${row.text}"`));
	const declared = await page.evaluate(() =>
		[...document.querySelectorAll('#context-menu .context-menu-row, #context-menu .row-notes')]
			.map((element) => getComputedStyle(element).opacity)
			.filter((opacity) => opacity !== '1')
	);
	assert.deepEqual(declared, [], 'menu rows and notes declare no opacity');
	await page.locator('#context-menu .row-name').nth(2).hover();
	await menuShot('presets-menu-hover.png');
	report(
		'Presets hovered label',
		await page.evaluate(measure, '#context-menu .context-menu-row:hover .row-name'),
		4.5
	);
	await page.keyboard.press('Escape');
	await page.mouse.click(1200, 450);
	await page.locator('#context-menu').waitFor({ state: 'detached' });

	// Projects menu: one font open, so Cross-project actions is greyed out and says why
	await page.getByRole('button', { name: 'Projects', exact: true }).click();
	await page.locator('#context-menu').waitFor();
	await page.mouse.move(1500, 895);
	await menuShot('projects-menu.png');
	const greyed = '#context-menu .context-menu-row[disabled]';
	report(
		'Projects greyed-out row',
		await page.evaluate(measure, [`${greyed} .row-name`, true]),
		4.5
	);
	const reasons = await page.evaluate(measure, [`${greyed} .row-notes span`, true]);
	report('Projects greyed-out reason', reasons, 4.5);
	assert.deepEqual(
		reasons.map((row) => row.text),
		['Open another font first'],
		'the greyed-out row says why, in house words'
	);
	// B1 fix pass: the "Editing" label on the open font's green-tinted card was 3.76:1
	report('Projects card labels', await page.evaluate(measure, '#context-menu .project-preview__super-title'), 4.5);
	assert.deepEqual(errors, []);
	console.log(`PASS menus readable without hover; screenshots in ${shots}`);
} finally {
	await context.close();
	await server.close();
	await rm(profile, { recursive: true, force: true });
}
