// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 cache (UX-BEGINNER.md 7.2 "Checks (B11) run per letter on release and are cached",
// section 10 B11 cache.js): drag ticks get the kept answer; the step a drag ends with redoes
// only that letter; a whole-font step (a moved guide line) redoes every letter; Undo brings the
// old answer back; "Looks fine to me" makes a letter Ready until its shapes change; the font
// check's problems come in through 'fontCheck'; letters that flip from Ready are announced; a
// soft note never takes Ready away; the coach's 'checks' source form; and the cost on a
// 58-letter font. Real ProjectEditor and History, so a step is a real Undo step.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { History } from '../../../project_editor/history.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { QUICK_SET } from '../../board/letter_set.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { glyphId } from '../../spacing/tests/fixtures.js';
import {
	CHECKS_CHANGE_EVENT,
	CHECKS_SUBSCRIBER_ID,
	checksSource,
	getChecksCache,
	letterStamp,
	makeChecksCache,
	resetChecksCacheForTests,
} from '../cache.js';
import { CHECK } from '../checks.js';
import { setLooksFine } from '../looks_fine.js';
import { NOTE } from '../soft_notes.js';
import { AUTO, checksFont, letter, moved, plain, rect, shapesFor } from './letters.js';

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetChecksCacheForTests();
});
afterEach(() => {
	resetChecksCacheForTests();
	warn.mockRestore();
});

/**
 * An editor on a spaced font, the letter `open` selected in the letter view.
 * @returns {ProjectEditor}
 */
function editorOn(letters, { open = 'n' } = {}) {
	const editor = new ProjectEditor();
	editor.project = checksFont(letters);
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor._selectedGlyphID = glyphId(open);
	return editor;
}

const item = (editor, char) => editor.project.glyphs[glyphId(char)];
/** Moves every point of a letter, as drag ticks do (no step) */
const nudge = (editor, char, dy) => item(editor, char).updateGlyphPosition(0, dy);

describe('on release', () => {
	it('drag ticks get the kept answer; the step the drag ends with redoes only that letter', () => {
		const editor = editorOn(plain('Hnorv'));
		const cache = makeChecksCache();
		expect(cache.state(editor, item(editor, 'n')).ready).toBe(true);
		const first = cache.stats(editor);
		expect(first.passes).toBe(1);
		expect(first.recomputed).toBe(5);

		// ticks: the letter moves, nothing is recorded yet
		nudge(editor, 'n', 100);
		nudge(editor, 'n', 100);
		expect(cache.state(editor, item(editor, 'n')).ready).toBe(true);
		expect(cache.stats(editor)).toEqual(first);

		// release: one Undo step
		editor.history.addState('moved small n');
		const n = cache.state(editor, item(editor, 'n'));
		expect(n.ready).toBe(false);
		expect(n.needsLook).toMatchObject({ id: CHECK.offLine, args: { way: 'above' } });
		expect(cache.stats(editor)).toEqual({ passes: 2, recomputed: 6 });
		// every other question until the next step is free
		['H', 'o', 'r', 'v'].forEach((char) => cache.state(editor, item(editor, char)));
		expect(cache.stats(editor)).toEqual({ passes: 2, recomputed: 6 });
	});

	it('a whole-font step (the small-letter line moved) redoes every letter', () => {
		const editor = editorOn(plain('Hnorv'));
		const cache = makeChecksCache();
		cache.states(editor);
		editor.project.settings.font.xHeight = 800;
		editor.history.addSettingsState('moved the small-letter line');
		const states = cache.states(editor);
		expect(cache.stats(editor).recomputed).toBe(10);
		['n', 'o', 'r', 'v'].forEach((char) =>
			expect(states.get(glyphId(char)).needsLook?.id).toBe(CHECK.size)
		);
		expect(states.get(glyphId('H')).ready).toBe(true);
		// four small letters too tall for the same line: move the line, not the letters
		expect(states.get(glyphId('n')).needsLook.fix).toBe('moveLine');
	});

	it('Undo brings the old answer back', () => {
		const editor = editorOn(plain('Hnorv'));
		const cache = makeChecksCache();
		cache.states(editor);
		nudge(editor, 'n', 200);
		editor.history.addState('moved small n');
		expect(cache.isReady(item(editor, 'n'), { editor })).toBe(false);
		editor.history.restoreState();
		expect(cache.isReady(item(editor, 'n'), { editor })).toBe(true);
	});

	it('refresh runs a pass only when one is due; force always', () => {
		const editor = editorOn(plain('no'));
		const cache = makeChecksCache();
		expect(cache.refresh(editor).ran).toBe(true);
		expect(cache.refresh(editor).ran).toBe(false);
		const forced = cache.refresh(editor, { force: true });
		expect(forced.ran).toBe(true);
		expect(forced.recomputed.sort()).toEqual([glyphId('n'), glyphId('o')].sort());
	});
});

describe('Looks fine to me and Ready', () => {
	it('Looks fine makes the letter Ready (one step), until its shapes change', () => {
		const editor = editorOn({ ...plain('Hor'), n: moved(shapesFor('n'), 0, 200) });
		const cache = makeChecksCache();
		const n = () => cache.state(editor, item(editor, 'n'));
		expect(n().needsLook.id).toBe(CHECK.offLine);
		setLooksFine(item(editor, 'n'), CHECK.offLine);
		editor.history.addState('said small n looks fine');
		expect(n()).toMatchObject({ ready: true, needsLook: null, looksFine: [CHECK.offLine] });
		expect(n().checks.map((c) => c.id)).toEqual([CHECK.offLine]);
		// moving the whole letter keeps it; changing a point takes it away
		nudge(editor, 'n', 30);
		editor.history.addState('moved small n');
		expect(n().ready).toBe(true);
		item(editor, 'n').shapes[0].pathPoints[2].p.y += 60;
		editor.history.addState('moved a point on small n');
		expect(n().ready).toBe(false);
		expect(n().needsLook.id).toBe(CHECK.offLine);
	});

	it('a letter with no ink is neither Ready nor in need of a look', () => {
		const editor = editorOn({ ...plain('n'), x: [] });
		const cache = makeChecksCache();
		expect(cache.state(editor, item(editor, 'x'))).toMatchObject({
			ink: false,
			ready: false,
			needsLook: null,
			checks: [],
		});
		expect(cache.states(editor).has(glyphId('x'))).toBe(false);
		expect(cache.state(editor, { id: 'glyph-0x7A' }).ink).toBe(false);
		expect(cache.state(null, item(editor, 'n')).ink).toBe(false);
	});

	it('a soft note never takes Ready away', () => {
		// an l written with a pen three times as heavy as the rest
		const editor = editorOn({ ...plain('Hoarvn'), l: [rect(100, 0, 460, 1550)] });
		const cache = makeChecksCache();
		const l = cache.state(editor, item(editor, 'l'));
		expect(l.notes.map((note) => note.id)).toEqual([NOTE.thicker]);
		expect(l.notes[0].text).toBe('Note: thicker than your other letters.');
		expect(l.ready).toBe(true);
		expect(cache.notes(item(editor, 'n'), { editor })).toEqual([]);
	});

	it('a tail past the tail line: Ready, with a quiet note', () => {
		const editor = editorOn({
			...plain('Hoarvn'),
			y: [...shapesFor('y'), rect(300, -700, 400, 0)],
		});
		const cache = makeChecksCache();
		const y = cache.state(editor, item(editor, 'y'));
		expect(y.ready).toBe(true);
		expect(y.notes.map((note) => note.id)).toEqual([NOTE.pokes]);
		// B10 + B11 fix pass: the note says which line (written to fail first: "the top line or
		// the tail line")
		expect(y.notes[0].text).toBe(
			'Note: reaches far below the tail line, so lines of text will sit further apart.'
		);
	});

	it('a letter reaching past the top line says the top line (B10 + B11 fix pass)', () => {
		const editor = editorOn({ ...plain('Hoarvn'), h: [rect(100, 0, 232, 1800)] });
		const h = makeChecksCache().state(editor, item(editor, 'h'));
		expect(h.notes.map((note) => note.text)).toEqual([
			'Note: reaches far above the top line, so lines of text will sit further apart.',
		]);
	});
});

describe('the font check and flips', () => {
	it("takes the font check's problems in through 'fontCheck' (one subscriber id)", () => {
		const editor = editorOn(plain('Hno'));
		const cache = makeChecksCache();
		cache.watch(editor);
		expect(Object.keys(editor.subscribers.fontCheck || {})).toEqual([CHECKS_SUBSCRIBER_ID]);
		expect(cache.isReady(item(editor, 'o'), { editor })).toBe(true);
		editor.publish('fontCheck', {
			problems: [
				{ itemId: glyphId('o'), problem: 'shape-points', message: 'small o has a stray shape.' },
			],
		});
		const o = cache.state(editor, item(editor, 'o'));
		expect(o.needsLook).toMatchObject({ id: CHECK.fontFile, reason: 'small o has a stray shape.' });
		// geometry was not measured again for it
		expect(cache.stats(editor).recomputed).toBe(3);
		cache.unwatch(editor);
		expect(Object.keys(editor.subscribers.fontCheck || {})).toEqual([]);
	});

	it('or from a problems source (font_check.js getLastFontCheck)', () => {
		const editor = editorOn(plain('Hno'));
		let problems = [];
		const cache = makeChecksCache({ problemsOf: () => problems });
		expect(cache.isReady(item(editor, 'H'), { editor })).toBe(true);
		problems = [{ itemId: glyphId('H'), problem: 'point-range', message: 'Capital H is far.' }];
		expect(cache.needsLook(item(editor, 'H'), { editor }).id).toBe(CHECK.fontFile);
	});

	it('a source that hands over a new empty list every time runs no extra pass', () => {
		const editor = editorOn(plain('Hno'));
		const cache = makeChecksCache({ problemsOf: () => [] });
		for (let n = 0; n < 5; n++) cache.states(editor);
		expect(cache.stats(editor).passes).toBe(1);
	});

	it('another font in the same editor announces nothing as flipped', () => {
		const editor = editorOn(plain('Hnorv'));
		const cache = makeChecksCache();
		cache.states(editor);
		const other = checksFont({ ...plain('Hor'), n: moved(shapesFor('n'), 0, 200) });
		editor.project = other;
		editor.history = new History();
		const result = cache.refresh(editor);
		expect(result.ran).toBe(true);
		expect(result.became).toEqual([]);
		expect(cache.isReady(other.glyphs[glyphId('n')], { editor })).toBe(false);
	});

	it('Simple with checks on: a step that makes Ready letters need a look is announced', async () => {
		setModeForTests('simple');
		setFeaturesForTests({ checks: true });
		const editor = editorOn(plain('Hnorv'), { open: 'H' });
		const cache = makeChecksCache();
		cache.watch(editor);
		cache.states(editor);
		const heard = [];
		const listen = (event) => heard.push(event.detail);
		window.addEventListener(CHECKS_CHANGE_EVENT, listen);
		try {
			editor.project.settings.font.xHeight = 760;
			editor.history.addSettingsState('moved the small-letter line');
			await Promise.resolve();
			await Promise.resolve();
			expect(heard).toHaveLength(1);
			expect(heard[0].editor).toBe(editor);
			expect(heard[0].became.sort()).toEqual(['n', 'o', 'r', 'v'].map(glyphId).sort());
			expect(heard[0].cleared).toEqual([]);
		} finally {
			window.removeEventListener(CHECKS_CHANGE_EVENT, listen);
		}
	});

	it('All tools: nothing is measured behind his back', async () => {
		const editor = editorOn(plain('Hnorv'));
		const cache = makeChecksCache();
		cache.watch(editor);
		editor.history.addState('moved small n');
		await Promise.resolve();
		expect(cache.stats(editor).passes).toBe(0);
	});
});

describe("the coach's source", () => {
	it('checksSource(item, { char, editor }) is the first open problem, or null', () => {
		const editor = editorOn({ ...plain('Ho'), n: moved(shapesFor('n'), 0, 200) });
		const look = checksSource(item(editor, 'n'), { char: 'n', editor });
		expect(look).toMatchObject({
			id: CHECK.offLine,
			reason: 'small n floats above the writing line.',
			short: 'floats above the writing line',
			fix: 'sitOnLine',
			action: 'fixLetter',
			args: { fix: 'sitOnLine', way: 'above' },
		});
		expect(checksSource(item(editor, 'o'), { char: 'o', editor })).toBeNull();
		expect(checksSource(item(editor, 'o'), {})).toBeNull();
		expect(getChecksCache()).toBe(getChecksCache());
	});
});

describe('stamps and cost', () => {
	it('the stamp changes with a point, a handle, the width or the spacing owner; not with Looks fine', () => {
		const project = checksFont(plain('n'));
		const n = letter(project, 'n');
		const before = letterStamp(n);
		setLooksFine(n, CHECK.size);
		expect(letterStamp(n)).toBe(before);
		const changes = [
			() => (n.shapes[0].pathPoints[1].p.x += 1),
			() => (n.shapes[0].pathPoints[1].h1.y += 1),
			() => (n.advanceWidth = n.advanceWidth + 1),
			() => (n.anyink.spacing = 'manual'),
		];
		let last = before;
		changes.forEach((change) => {
			change();
			const now = letterStamp(n);
			expect(now).not.toBe(last);
			last = now;
		});
		expect(AUTO.spacing).toBe('auto');
	});

	it('58 letters: one pass, then kept answers; a one-letter step redoes one letter', () => {
		const letters = {};
		QUICK_SET.forEach((char) => (letters[char] = shapesFor(char)));
		const editor = editorOn(letters, { open: 'a' });
		const cache = makeChecksCache();
		let start = performance.now();
		const states = cache.states(editor);
		const firstMs = performance.now() - start;
		expect(states.size).toBe(58);
		start = performance.now();
		for (let round = 0; round < 10; round++) {
			QUICK_SET.forEach((char) => cache.needsLook(item(editor, char), { editor }));
		}
		const keptMs = (performance.now() - start) / 10;
		nudge(editor, 'a', 2);
		editor.history.addState('moved small a');
		start = performance.now();
		cache.states(editor);
		const stepMs = performance.now() - start;
		expect(cache.stats(editor)).toEqual({ passes: 2, recomputed: 59 });
		console.log(
			`B11 cache, 58 letters: first pass ${firstMs.toFixed(1)} ms, 58 kept answers ` +
				`${keptMs.toFixed(2)} ms, the pass after a one-letter step ${stepMs.toFixed(1)} ms`
		);
		expect(keptMs).toBeLessThan(16);
		expect(stepMs).toBeLessThan(firstMs);
	});
});
