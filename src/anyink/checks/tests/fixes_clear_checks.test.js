// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 seam: every check's one-click fix clears that very check (UX-BEGINNER.md 4.2: the tile
// turns Ready). The checks come from the checks track's checks.js (checkLetter / checkFont,
// { id, reason, fix, args }); the fix runs through applyFix with the check's own fix and args,
// as the board's tile buttons and the Next line's fixLetter action do. Pokes past the top or
// tail line is a soft note while checks.js POKES_IS_NOTE is true; [Shrink to fit] is checked
// against the check it would be (pokesAsNote: false), so it is ready if that flips back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { oval, rect } from '../../spacing/tests/fixtures.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { checkFont, checkLetter } from '../checks.js';
import { applyFix } from '../fixes.js';
import { fixEditor, glyphId, shapesOf, speck } from './fix_fixtures.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setFeaturesForTests({ checks: true });
	resetToastsForTests();
});
afterEach(() => {
	resetToastsForTests();
	warn.mockRestore();
});

const auto = { spacing: 'auto' };
const manual = { spacing: 'manual' };

/**
 * @param {{pokesAsNote?: Boolean}} [options] - false: pokes as the check it would be
 * @returns {Array<Object>} the letter's described checks now
 */
function checksOf(editor, char, { pokesAsNote } = {}) {
	const item = editor.project.glyphs[glyphId(char)];
	return checkLetter(item, { font: editor.project.settings.font, pokesAsNote });
}

const CASES = [
	[
		'floats above the line',
		'n',
		{ shapes: shapesOf('n', { dy: 80 }), anyink: auto },
		'offLine',
		'sitOnLine',
	],
	[
		'sinks under the line',
		'H',
		{ shapes: shapesOf('H', { dy: -70 }), anyink: auto },
		'offLine',
		'sitOnLine',
	],
	[
		'a round letter floats',
		'o',
		{ shapes: shapesOf('o', { dy: 60 }), anyink: auto },
		'offLine',
		'sitOnLine',
	],
	[
		'a comma floats',
		',',
		{ shapes: [oval(130, 160, 30, 30), rect(110, 40, 125, 140)], anyink: auto },
		'offLine',
		'sitOnLine',
	],
	['too tall', 'n', { shapes: shapesOf('n', { k: 1.4 }), anyink: auto }, 'size', 'matchSize'],
	['too short', 'H', { shapes: shapesOf('H', { k: 0.6 }), anyink: auto }, 'size', 'matchSize'],
	[
		'an i too tall, dot and all',
		'i',
		{ shapes: shapesOf('i', { k: 1.5 }), anyink: auto },
		'size',
		'matchSize',
	],
	[
		'a g too tall, tail and all',
		'g',
		{ shapes: shapesOf('g', { k: 1.4 }), anyink: auto },
		'size',
		'matchSize',
	],
	[
		'a round letter too short',
		'o',
		{ shapes: shapesOf('o', { k: 0.6 }), anyink: auto },
		'size',
		'matchSize',
	],
	[
		'specks',
		'n',
		{
			shapes: [...shapesOf('n'), speck(700, 300), speck(800, 100, 15), speck(-60, 250)],
			anyink: auto,
		},
		'specks',
		'removeSpecks',
	],
	[
		'pokes past the top line',
		'l',
		{ shapes: shapesOf('l', { k: 1.3 }), anyink: auto },
		'pokes',
		'shrinkToFit',
	],
	[
		'pokes past the tail line',
		'y',
		{ shapes: shapesOf('y', { k: 2 }), anyink: auto },
		'pokes',
		'shrinkToFit',
	],
	[
		'ink with no width',
		'n',
		{ shapes: shapesOf('n'), advanceWidth: 0, anyink: manual },
		'inkNoWidth',
		'fitSpacing',
	],
	[
		'hangs past its right edge',
		'n',
		{ shapes: shapesOf('n'), advanceWidth: 300, anyink: manual },
		'hangs',
		'fitSpacing',
	],
];

describe.each([
	['Simple', 'simple'],
	['All tools', 'all'],
])('%s: a fix clears the check that offered it', (_label, mode) => {
	it.each(CASES)('%s', (_name, char, spec, checkId, fixId) => {
		setModeForTests(mode);
		const editor = fixEditor({ [char]: { advanceWidth: 600, ...spec } });
		const asCheck = checkId === 'pokes' ? { pokesAsNote: false } : {};
		const check = checksOf(editor, char, asCheck).find((found) => found.id === checkId);
		expect(check, `the ${checkId} check is there before the fix`).toBeTruthy();
		expect(check.fix).toBe(fixId);
		const result = applyFix(editor, glyphId(char), check.args);
		expect(result.done).toBe(true);
		expect(checksOf(editor, char, asCheck).map((found) => found.id)).not.toContain(checkId);
	});
});

describe('Move the line to fit your writing clears the letters that offered it', () => {
	it.each([
		['Simple', 'simple'],
		['All tools', 'all'],
	])('%s', (_label, mode) => {
		setModeForTests(mode);
		const big = (char) => ({
			shapes: shapesOf(char, { k: 1.35 }),
			advanceWidth: 600,
			anyink: auto,
		});
		const editor = fixEditor({ n: big('n'), u: big('u'), m: big('m') });
		const before = checkFont(editor.project);
		const offered = before.get(glyphId('n')).find((found) => found.id === 'size');
		expect(offered?.fix).toBe('moveLine');
		expect(applyFix(editor, glyphId('n'), offered.args).done).toBe(true);
		const after = checkFont(editor.project);
		['n', 'u', 'm'].forEach((char) =>
			expect(after.get(glyphId(char)).map((found) => found.id)).not.toContain('size')
		);
	});
});
