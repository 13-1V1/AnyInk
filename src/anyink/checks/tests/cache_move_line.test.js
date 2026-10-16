// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 integration (the fixes track's need 1): [Move the line to fit your writing] is offered
// only on a line the middle of his letters says is off the way the letter is. Right after the
// line moved to his writing, the letters it flipped (a and r, now too short for it) are off a
// line that fits his writing already: they get [Match size], not a second Move the line that
// could only resize them (UX-BEGINNER.md principle 6, 4.2 Needs a look).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { fitAllAutomatic } from '../../spacing/auto_space.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { checksSource, getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { lineMoveWays } from '../fit_lines_to_writing.js';
import { useNeedsALook } from '../fix_step.js';
import { applyFix } from '../fixes.js';
import { fixEditor, glyphId, shapesOf } from './fix_fixtures.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
	resetToastsForTests();
	resetChecksCacheForTests();
	useNeedsALook(checksSource);
});
afterEach(() => {
	useNeedsALook(null);
	resetChecksCacheForTests();
	resetToastsForTests();
	warn.mockRestore();
});

const auto = { spacing: 'auto' };
const A = glyphId('a');
const R = glyphId('r');
const N = glyphId('n');

/** Five small letters 30 % over the small-letter line, two a little under it (fixes_real_checks) */
function lineFont() {
	const big = (char) => ({ shapes: shapesOf(char, { k: 1.3 }), anyink: auto });
	const short = (char) => ({ shapes: shapesOf(char, { k: 0.9 }), anyink: auto });
	const editor = fixEditor({
		n: big('n'),
		u: big('u'),
		m: big('m'),
		x: big('x'),
		z: big('z'),
		a: short('a'),
		r: short('r'),
		H: { shapes: shapesOf('H'), anyink: auto },
	});
	fitAllAutomatic(editor.project);
	return editor;
}

const look = (editor, id) => checksSource(editor.project.glyphs[id], { editor });

describe('Move the line is offered only where the line would really move', () => {
	it('before the move: the big letters are offered it (their line is off the way they are)', () => {
		const editor = lineFont();
		expect(lineMoveWays(editor.project).small).toBe('big');
		expect(look(editor, N)).toMatchObject({ id: 'size', fix: 'moveLine' });
		expect(look(editor, N).fixLabel).toBe('Move the line to fit your writing');
	});

	it('after the move: the two letters it flipped get Match size, not Move the line again', () => {
		const editor = lineFont();
		const result = applyFix(editor, N, look(editor, N).args);
		expect(result).toMatchObject({ done: true, fix: 'moveLine', flipped: [A, R] });
		// the line fits his writing now, though a and r are 2 letters off it the same way
		expect(lineMoveWays(editor.project).small).toBeNull();
		[A, R].forEach((id) => {
			expect(look(editor, id)).toMatchObject({ id: 'size', fix: 'matchSize' });
			expect(look(editor, id).fixLabel).toBe('Match size');
			expect(look(editor, id).args.fix).toBe('matchSize');
		});
	});

	it('Match size on a flipped letter resizes only that letter and leaves the line', () => {
		const editor = lineFont();
		applyFix(editor, N, look(editor, N).args);
		const line = editor.project.settings.font.xHeight;
		const fixed = applyFix(editor, A, look(editor, A).args);
		expect(fixed).toMatchObject({ done: true, fix: 'matchSize' });
		expect(editor.project.settings.font.xHeight).toBe(line);
		expect(look(editor, A)).toBeNull();
		expect(getChecksCache().state(editor, editor.project.glyphs[A]).ready).toBe(true);
	});
});
