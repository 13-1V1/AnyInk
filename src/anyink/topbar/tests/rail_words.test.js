// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (board fix area): the rail keeps every step's words at every supported width (UX-BEGINNER.md
// 7: works down to 1280 x 720). The acceptance run at 1280 showed "2" and "3" alone, with room to
// spare. jsdom does not run media queries, so this reads the stylesheet: no rule that hides a
// step's name may apply at 1280 px or wider, and none ever hides the current step's name.
// tests/rail_words.verify.mjs measures it in Chrome at 1600, 1440, 1280 and 1024.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'simple_top_bar.css'), 'utf8');

/** Every @media block as { max, body } (max = its max-width in px, Infinity when it has none) */
function mediaBlocks(text) {
	const blocks = [];
	const re = /@media\s*([^{]*)\{/g;
	let match;
	while ((match = re.exec(text))) {
		let depth = 1;
		let i = re.lastIndex;
		while (depth > 0 && i < text.length) {
			if (text[i] === '{') depth++;
			else if (text[i] === '}') depth--;
			i++;
		}
		const maxMatch = /max-width:\s*(\d+)px/.exec(match[1]);
		blocks.push({
			max: maxMatch ? Number(maxMatch[1]) : Infinity,
			body: text.slice(re.lastIndex, i),
		});
		re.lastIndex = i;
	}
	return blocks;
}

/** The selectors of every rule in a block that sets display: none */
function hidingSelectors(body) {
	const out = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let match;
	while ((match = re.exec(body))) {
		if (/display:\s*none/.test(match[2])) out.push(match[1].replace(/\s+/g, ' ').trim());
	}
	return out;
}

describe('the rail keeps its words', () => {
	it('no rule hides a step name at 1280 px or wider', () => {
		const blocks = mediaBlocks(css);
		const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
		expect(hidingSelectors(outside).filter((s) => s.includes('step-name'))).toEqual([]);
		for (const block of blocks) {
			const hides = hidingSelectors(block.body).filter((s) => s.includes('step-name'));
			if (hides.length) expect(block.max).toBeLessThan(1280);
		}
	});

	it('below 1280 px only the steps he is not on drop their names; the current step keeps its own', () => {
		for (const block of mediaBlocks(css)) {
			for (const selector of hidingSelectors(block.body)) {
				for (const part of selector.split(',')) {
					if (/step-name(?![-\w])/.test(part)) {
						expect(part).toContain(":not([aria-current='step'])");
					}
				}
			}
		}
	});
});
