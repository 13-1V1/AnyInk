// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1: how strongly the system guide lines are drawn. At a new font's Transparency setting the
// writing line (baseline) used to be 1.6:1 on paper and 1.7:1 on slate; it now reaches 3:1
// against the canvas, worked out from the theme's own color tokens, so a token change can't
// quietly make it faint again. The Transparency setting still runs from invisible to solid.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { transparencyToAlpha } from '../../../common/colors.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { parseToRGB } from '../../theme/theme.js';
import {
	alphaForContrast,
	contrastRatio,
	DEFAULT_SYSTEM_TRANSPARENCY,
	systemGuideAlpha,
	systemGuideStroke,
	upscaleKeeps,
	WRITING_LINE_CONTRAST,
} from '../guide_strength.js';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = readFileSync(join(here, '../../theme/tokens.css'), 'utf8').replace(
	/\/\*[\s\S]*?\*\//g,
	''
);

/** A canvas token's value in one theme block of tokens.css. */
function canvasToken(theme, name) {
	const selector = theme === 'paper' ? /:root,\s*:root\[data-canvas='light'\]/ : /:root\[data-canvas='dark'\]/;
	const start = TOKENS_CSS.search(selector);
	const block = TOKENS_CSS.slice(start, TOKENS_CSS.indexOf('}', start));
	const match = block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
	if (!match) throw new Error(`missing ${name} in ${theme}`);
	return match[1].trim();
}

const THEMES = ['paper', 'slate'].map((theme) => ({
	theme,
	guide: canvasToken(theme, '--canvas-guide'),
	canvas: canvasToken(theme, '--canvas-bg'),
}));

/** The color the screen shows for a guide drawn at this alpha over the canvas. */
function over(guide, canvas, alpha) {
	const top = parseToRGB(guide);
	const bg = parseToRGB(canvas);
	const mix = (k) => Math.round(top[k] * alpha + bg[k] * (1 - alpha));
	return `rgb(${mix('r')}, ${mix('g')}, ${mix('b')})`;
}

describe('contrastRatio', () => {
	it('black on white is 21:1, a color on itself is 1:1, and order does not matter', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
		expect(contrastRatio('#7c3aed', '#7c3aed')).toBeCloseTo(1, 5);
	});
});

describe('alphaForContrast', () => {
	THEMES.forEach(({ theme, guide, canvas }) => {
		it(`${theme}: the smallest step of alpha that reaches 3:1 for the guide token`, () => {
			const alpha = alphaForContrast(guide, canvas, WRITING_LINE_CONTRAST);
			expect(Math.round(alpha * 255)).toBeCloseTo(alpha * 255, 9);
			expect(contrastRatio(over(guide, canvas, alpha), canvas)).toBeGreaterThanOrEqual(3);
			const lower = alpha - 1 / 255;
			expect(contrastRatio(over(guide, canvas, lower), canvas)).toBeLessThan(3);
		});
	});

	it('a color that cannot reach the target even when solid is drawn solid', () => {
		expect(alphaForContrast('#eeeeee', '#ffffff', 3)).toBe(1);
	});
});

describe('systemGuideAlpha', () => {
	it('the default Transparency is the one a new font stores', () => {
		const project = new GlyphrStudioProject();
		expect(project.settings.app.guides.systemTransparency).toBe(DEFAULT_SYSTEM_TRANSPARENCY);
	});

	THEMES.forEach(({ theme, guide, canvas }) => {
		it(`${theme}: at the default Transparency the writing line reaches 3:1`, () => {
			const alpha = systemGuideAlpha(DEFAULT_SYSTEM_TRANSPARENCY, guide, canvas);
			expect(alpha).toBe(alphaForContrast(guide, canvas, WRITING_LINE_CONTRAST));
			expect(contrastRatio(over(guide, canvas, alpha), canvas)).toBeGreaterThanOrEqual(3);
			// It was 1.6:1 (paper) and 1.7:1 (slate) before B1
			const before = transparencyToAlpha(DEFAULT_SYSTEM_TRANSPARENCY);
			expect(contrastRatio(over(guide, canvas, before), canvas)).toBeLessThan(2);
		});

		it(`${theme}: the setting still runs from invisible to solid, never weaker than chosen`, () => {
			expect(systemGuideAlpha(100, guide, canvas)).toBe(0);
			expect(systemGuideAlpha(0, guide, canvas)).toBe(1);
			let previous = -1;
			for (let t = 100; t >= 1; t--) {
				const alpha = systemGuideAlpha(t, guide, canvas);
				expect(alpha, `transparency ${t}`).toBeGreaterThanOrEqual(previous);
				expect(alpha, `transparency ${t}`).toBeGreaterThanOrEqual(transparencyToAlpha(t));
				expect(alpha, `transparency ${t}`).toBeLessThanOrEqual(1);
				previous = alpha;
			}
		});
	});

	it('without theme colors (no tokens loaded) the chosen alpha is used as it is', () => {
		expect(systemGuideAlpha(70, '', '')).toBe(transparencyToAlpha(70));
		expect(systemGuideAlpha(40, '#7c3aed', '')).toBe(transparencyToAlpha(40));
	});
});

describe('systemGuideStroke on scaled displays (B1 fix pass)', () => {
	it('upscaleKeeps: 100% keeps everything, 125% keeps 60%, 150% keeps two thirds', () => {
		expect(upscaleKeeps(1)).toBe(1);
		expect(upscaleKeeps(0.9)).toBe(1);
		expect(upscaleKeeps(undefined)).toBe(1);
		expect(upscaleKeeps(1.25)).toBeCloseTo(0.6, 9);
		expect(upscaleKeeps(1.5)).toBeCloseTo(2 / 3, 9);
		expect(upscaleKeeps(2)).toBeCloseTo(0.75, 9);
	});

	THEMES.forEach(({ theme, guide, canvas }) => {
		const base = systemGuideAlpha(DEFAULT_SYSTEM_TRANSPARENCY, guide, canvas);

		it(`${theme}: at 100% it is the plain alpha and a 1 px line`, () => {
			expect(systemGuideStroke(DEFAULT_SYSTEM_TRANSPARENCY, guide, canvas, 1)).toEqual({ alpha: base, thickness: 1 });
		});

		it(`${theme}: above 100% the line's weakest screen row still shows the 100% alpha`, () => {
			for (const scale of [1.25, 1.5, 1.75, 2, 2.5, 3]) {
				const { alpha, thickness } = systemGuideStroke(DEFAULT_SYSTEM_TRANSPARENCY, guide, canvas, scale);
				expect(alpha, `${scale}`).toBeLessThanOrEqual(1);
				// 1 px: the raised alpha times what the screen keeps; 2 px: every row between keeps all
				const shown = thickness === 1 ? alpha * upscaleKeeps(scale) : alpha;
				expect(shown + 1e-9, `${scale}`).toBeGreaterThanOrEqual(base);
				expect(contrastRatio(over(guide, canvas, shown), canvas), `${scale}`).toBeGreaterThanOrEqual(2.99);
			}
		});

		it(`${theme}: invisible stays invisible at any scale`, () => {
			expect(systemGuideStroke(100, guide, canvas, 1.5).alpha).toBe(0);
		});
	});
});
