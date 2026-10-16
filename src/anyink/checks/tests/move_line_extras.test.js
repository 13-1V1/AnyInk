// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize: [Move the line to fit your writing] never pushes a line past a letter that
// fits it now (UX-BEGINNER.md 4.2, D-042). The hostile pass found two ways it still did, through
// the app's checks cache: ? ! and t (judged by a line, never in its median) and round letters
// (judged against their line plus the overshoot) were not kept. Written to fail first:
//   C2: a and n written 2,000 tall pushed the capitals line past a Ready ? and !;
//   V1e: the same pushed t's line (halfway between the small-letter and top lines);
//   C3: H B E written 800 tall pulled the small-letter line under a Ready o c e (1,445 tall).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { checksSource, getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { useNeedsALook } from '../fix_step.js';
import { runFixAction } from '../fixes.js';
import { AUTO, FONT, checksFont, letter, scaled, shapesFor } from './letters.js';

let quiet = [];
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	quiet = [vi.spyOn(console, 'warn').mockImplementation(() => {})];
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
	quiet.forEach((spy) => spy.mockRestore());
	setModeForTests('all');
});

const big = (char, height, base = FONT.xHeight) => ({
	shapes: scaled(shapesFor(char), height / base, 100, 0),
	anyink: { ...AUTO },
});

function editorOn(letters) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = checksFont(letters);
	editor.nav.page = 'Overview';
	return editor;
}

const look = (editor, char) => checksSource(letter(editor.project, char), { editor });
const ready = (editor, char) => getChecksCache().state(editor, letter(editor.project, char)).ready;
const lines = (editor) => {
	const font = editor.project.settings.font;
	return [font.ascent, font.capHeight, font.xHeight];
};

/** Presses every green fix the letters offer until none needs a look (at most `most`) */
function pressAll(editor, chars, most = 8) {
	for (let i = 0; i < most; i++) {
		const char = chars.find((one) => look(editor, one));
		if (!char) return i;
		const first = look(editor, char);
		expect(runFixAction({ char, check: first.id, ...first.args }, { editor })).toBe(true);
	}
	return most;
}

describe('a moved line keeps every letter that fits it now', () => {
	it('C2: a and n 2,000 tall with ? and ! Ready: Match size, the lines stay, ? and ! stay Ready', () => {
		const editor = editorOn({ a: big('a', 2000), n: big('n', 2000), '?': null, '!': null });
		expect(ready(editor, '?')).toBe(true);
		expect(ready(editor, '!')).toBe(true);
		expect(look(editor, 'a')).toMatchObject({ fix: 'matchSize' });
		const before = lines(editor);
		pressAll(editor, ['a', 'n', '?', '!']);
		expect(lines(editor)).toEqual(before);
		expect(['a', 'n', '?', '!'].map((char) => ready(editor, char))).toEqual([true, true, true, true]);
	});

	it('V1e: a and n 2,000 tall with t Ready: t keeps fitting its line', () => {
		const editor = editorOn({ a: big('a', 2000), n: big('n', 2000), t: null });
		expect(ready(editor, 't')).toBe(true);
		expect(look(editor, 'a')).toMatchObject({ fix: 'matchSize' });
		pressAll(editor, ['a', 'n', 't']);
		expect(ready(editor, 't')).toBe(true);
	});

	it('C3: H B E 800 tall with round o c e Ready at 1,445: the small-letter line stays', () => {
		const round = (char) => big(char, 1445);
		const capital = (char) => big(char, 800, FONT.capHeight);
		const editor = editorOn({
			H: capital('H'),
			B: capital('B'),
			E: capital('E'),
			o: round('o'),
			c: round('c'),
			e: round('e'),
		});
		['o', 'c', 'e'].forEach((char) => expect([char, ready(editor, char)]).toEqual([char, true]));
		expect(look(editor, 'B')).toMatchObject({ fix: 'matchSize' });
		const small = editor.project.settings.font.xHeight;
		pressAll(editor, ['H', 'B', 'E', 'o', 'c', 'e']);
		expect(editor.project.settings.font.xHeight).toBe(small);
		['o', 'c', 'e'].forEach((char) => expect([char, ready(editor, char)]).toEqual([char, true]));
	});

	it('a line still moves where nothing that fits is in its way (capitals alone written big)', () => {
		const capital = (char) => big(char, 1900, FONT.capHeight);
		const editor = editorOn({ H: capital('H'), B: capital('B'), E: capital('E') });
		expect(look(editor, 'B')).toMatchObject({ fix: 'moveLine' });
	});
});
