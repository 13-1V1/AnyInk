// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "Overview sample sentence is dark on dark (both modes)"): a
// <display-canvas> draws its letters in the paper's ink (--canvas-ink), so it carries the paper
// (--canvas-bg) behind them wherever it sits: the Overview's dark card, the Projects menu, the
// strip and Live preview (which already had paper around it). Colors stay tokens (tokens.css).
// (Vitest reads CSS imports as empty, so the shadow root's copy is checked in real Chrome:
// tests/words.verify.mjs.)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../../display_canvas/display-canvas.css'), 'utf8');

/** The declarations of the :host rule, or '' when there is none. */
const hostRule = (text) => /:host\s*\{([^}]*)\}/.exec(text)?.[1] || '';

describe('the display canvas carries its paper', () => {
	it('its own stylesheet puts the paper token behind the letters', () => {
		expect(hostRule(css)).toMatch(/background(-color)?:\s*var\(--canvas-bg\)/);
	});

	it('no color is written into it: tokens only', () => {
		expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
	});
});
