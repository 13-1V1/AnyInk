// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-page: the board's progress (UX-BEGINNER.md 4.2 Letter set, Ready, Progress).
	  - one progress line "N of 58 ready"; every letter in exactly one of three states (Ready,
	    Needs a look, Empty), so the counts add up to the total
	  - a stray line is no ink: Empty, as the letter card says (D-037)
	  - sections in board order: Capitals, Small letters, Punctuation, then Numbers & symbols only
	    with "+ Numbers & symbols"; a section's count shows once it has a ready letter; a section
	    is done when every letter in it is ready
	  - a finished section is "new" only after a first look (the first look at a font never
	    toasts)
	  - the board's counts agree with the rail's "7/58" (topbar/ready_count.js) and the Next
	    line's state (coach/font_facts.js deriveEditorState), with and without B11's checks
	Written before progress.js existed (red: the module was missing).
*/
import { afterEach, describe, expect, it } from 'vitest';
import { deriveEditorState } from '../../coach/font_facts.js';
import { flagsOn } from '../../mode/features.js';
import { readyCount } from '../../topbar/ready_count.js';
import {
	boardFacts,
	boardSummary,
	doneSections,
	newlyDone,
	sectionList,
	sectionOf,
	tileState,
} from '../progress.js';
import {
	addLetter,
	boardEditor,
	boardProject,
	LOOK,
	lookChecks,
	SEED,
	square,
} from './board_font.js';

afterEach(() => {
	document.body.innerHTML = '';
});

const chars = (list) => list.map((letter) => letter.char).join('');

describe('sections', () => {
	it('in board order: Capitals, Small letters, Punctuation, Numbers & symbols', () => {
		expect(sectionList().map((section) => section.id)).toEqual([
			'capitals',
			'small',
			'punctuation',
			'numbers',
		]);
		expect(sectionList().map((section) => section.nameKey)).toEqual([
			'board.section.capitals',
			'board.section.small',
			'board.section.punctuation',
			'board.section.numbers',
		]);
	});

	it('every letter of the board is in one section', () => {
		expect(sectionOf('B')).toBe('capitals');
		expect(sectionOf('b')).toBe('small');
		['.', ',', "'", '?', '!', '-'].forEach((char) => expect(sectionOf(char)).toBe('punctuation'));
		['0', '7', ':', ';', '"', '(', ')', '&', '@', '#', '$', '%', '/', '*'].forEach((char) =>
			expect(sectionOf(char)).toBe('numbers')
		);
	});
});

describe('tile states', () => {
	it("Ready, Needs a look, Empty: ink decides, then B11's look", () => {
		expect(tileState({ ink: false, ready: false, needsLook: null })).toBe('empty');
		expect(tileState({ ink: true, ready: true, needsLook: null })).toBe('ready');
		expect(tileState({ ink: true, ready: false, needsLook: LOOK })).toBe('needsLook');
		// a look on a letter with no ink never makes it amber (the coach never checks one)
		expect(tileState({ ink: false, ready: false, needsLook: LOOK })).toBe('empty');
	});
});

describe('the summary', () => {
	it('a new font: 0 of 58, every letter empty, no section count, nothing done', () => {
		const project = boardProject({ seed: false });
		const summary = boardSummary(boardFacts(project));
		expect(summary).toMatchObject({ total: 58, ready: 0, needsLook: 0, empty: 58, fraction: 0 });
		expect(summary.sections.map((s) => [s.id, s.total, s.ready, s.showCount, s.done])).toEqual([
			['capitals', 26, 0, false, false],
			['small', 26, 0, false, false],
			['punctuation', 6, 0, false, false],
		]);
		expect(chars(summary.letters)).toBe(
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,'?!-"
		);
		// reading never makes a letter's record
		expect(Object.keys(project.glyphs)).toEqual([]);
	});

	it('the seeded font: 7 ready, a stray line is empty, the counts add up', () => {
		const project = boardProject();
		const summary = boardSummary(boardFacts(project));
		const ready = [...SEED.photo, ...SEED.drawn, ...SEED.look].length;
		expect(summary).toMatchObject({ total: 58, ready, needsLook: 0, empty: 58 - ready });
		expect(summary.letters.find((l) => l.char === 'c').state).toBe('empty');
		const [capitals, small, punctuation] = summary.sections;
		expect([capitals.ready, capitals.showCount]).toEqual([2, true]);
		expect([small.ready, small.showCount]).toEqual([5, true]);
		expect([punctuation.ready, punctuation.showCount]).toEqual([0, false]);
	});

	it("with B11's checks on, small e needs a look and isn't ready", () => {
		const project = boardProject();
		const summary = boardSummary(boardFacts(project, { checks: lookChecks(), checksOn: true }));
		expect(summary).toMatchObject({ ready: 6, needsLook: 1, empty: 51 });
		expect(summary.letters.find((l) => l.char === 'e')).toMatchObject({
			state: 'needsLook',
			needsLook: LOOK,
		});
		// checks off: the stub, Ready = ink
		expect(boardSummary(boardFacts(project, { checks: lookChecks() })).needsLook).toBe(0);
	});

	it('"+ Numbers & symbols" adds its section and raises the total to 80', () => {
		const project = boardProject();
		project.settings.anyink = { ...(project.settings.anyink || {}), letterSet: 'quick+numbers' };
		const summary = boardSummary(boardFacts(project));
		expect(summary.total).toBe(80);
		expect(summary.sections.map((s) => s.id)).toEqual([
			'capitals',
			'small',
			'punctuation',
			'numbers',
		]);
		expect(summary.sections[3]).toMatchObject({ total: 22, ready: 0, showCount: false });
	});

	it('a section is done when every letter in it is ready', () => {
		const project = boardProject({ seed: false });
		[...".,'?!"].forEach((char) => addLetter(project, char, [square()]));
		let summary = boardSummary(boardFacts(project));
		expect(doneSections(summary)).toEqual([]);
		addLetter(project, '-', [square()]);
		summary = boardSummary(boardFacts(project));
		expect(doneSections(summary)).toEqual(['punctuation']);
		expect(summary.sections[2]).toMatchObject({ ready: 6, total: 6, done: true, showCount: true });
		// a letter that needs a look keeps its section from being done
		const looked = boardSummary(boardFacts(project, { checks: lookChecks(['-']), checksOn: true }));
		expect(doneSections(looked)).toEqual([]);
	});
});

describe('newly done', () => {
	it('the first look notes what is done without saying so', () => {
		expect(newlyDone(null, ['small'])).toEqual([]);
	});

	it('then a section that finishes is new once', () => {
		expect(newlyDone([], ['small'])).toEqual(['small']);
		expect(newlyDone(['small'], ['small', 'capitals'])).toEqual(['capitals']);
		expect(newlyDone(['small', 'capitals'], ['small'])).toEqual([]);
	});
});

describe('the board, the rail and the Next line agree', () => {
	const kinds = [
		['a new font', { seed: false }],
		['the seeded font', {}],
	];

	it.each(kinds)('%s: the rail counts what the board counts', (_name, options) => {
		const project = boardProject(options);
		const summary = boardSummary(boardFacts(project));
		expect(readyCount(project)).toEqual({ ready: summary.ready, total: summary.total });
	});

	it.each(kinds)("%s: the Next line's letters are the board's", (_name, options) => {
		const editor = boardEditor(options);
		const isOn = flagsOn('coach', 'board', 'checks');
		const state = deriveEditorState(editor, { isOn, sources: { checks: lookChecks() } });
		const summary = boardSummary(
			boardFacts(editor.project, { checks: lookChecks(), checksOn: true, editor })
		);
		expect(state.letters.map((l) => l.char)).toEqual(summary.letters.map((l) => l.char));
		expect(state.letters.filter((l) => l.ready).length).toBe(summary.ready);
		expect(state.letters.filter((l) => l.needsLook).length).toBe(summary.needsLook);
	});
});
