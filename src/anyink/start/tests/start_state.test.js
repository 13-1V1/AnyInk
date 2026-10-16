// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13 start screen, the pure part (UX-BEGINNER.md 4.1): which card sits on top, the other fonts,
	the name field's default, a backup copy's day and time, letters in a work file, the file name.
*/
import { describe, expect, it } from 'vitest';
import {
	chooseCard,
	countLetters,
	defaultFontName,
	otherFonts,
	suggestedFileName,
	whenParts,
} from '../start_state.js';

const recent = (name, time = 1) => ({ handle: { name: `${name}.gs2` }, name, time });
const session = (name, time, hasFile) => ({ id: `s:${name}`, name, time, hasFile, dirty: true });

describe('chooseCard: one card, never two', () => {
	it('nothing: no card (Create is the green one)', () => {
		expect(chooseCard({ recents: [], sessions: [] })).toEqual({ kind: 'none' });
	});

	it('a recent work file and no backup copy: Continue with the newest', () => {
		const a = recent('Brennan Hand');
		expect(chooseCard({ recents: [a, recent('Old Hand')], sessions: [] })).toEqual({
			kind: 'continue',
			recent: a,
		});
	});

	it('a backup copy newer than its work file: the crash card, not Continue', () => {
		const card = chooseCard({
			recents: [recent('Brennan Hand')],
			sessions: [session('Brennan Hand', 5, true)],
		});
		expect(card.kind).toBe('crashWithFile');
		expect(card.session.name).toBe('Brennan Hand');
	});

	it('a backup copy with no work file: the no-file crash card', () => {
		expect(chooseCard({ sessions: [session('Never Saved', 5, false)] }).kind).toBe('crashNoFile');
	});

	it('two backup copies: the newest one decides', () => {
		const card = chooseCard({
			sessions: [session('Old', 1, true), session('New', 9, false)],
		});
		expect(card).toMatchObject({ kind: 'crashNoFile', session: { name: 'New' } });
	});
});

// Fix pass (finding: the crash card ignores the work file's time; a Replace backup copy took over
// the start screen). Written to fail first: chooseCard showed a crash card for any backup copy.
describe('chooseCard: only a backup copy that is newer than its work file', () => {
	const a = recent('Brennan Hand', 100);
	it('a backup copy older than its work file: Continue', () => {
		const card = chooseCard({
			recents: [a],
			sessions: [{ ...session('Brennan Hand', 50, true), fileTime: 100 }],
		});
		expect(card).toEqual({ kind: 'continue', recent: a });
	});
	it('the same time as its work file: Continue (saved at that moment)', () => {
		const card = chooseCard({
			recents: [a],
			sessions: [{ ...session('Brennan Hand', 100, true), fileTime: 100 }],
		});
		expect(card.kind).toBe('continue');
	});
	it('newer than its work file: the crash card', () => {
		const card = chooseCard({
			recents: [a],
			sessions: [{ ...session('Brennan Hand', 150, true), fileTime: 100 }],
		});
		expect(card.kind).toBe('crashWithFile');
	});
	it('an older stale copy does not hide a newer one that counts', () => {
		const card = chooseCard({
			sessions: [
				{ ...session('Stale', 90, true), fileTime: 100 },
				{ ...session('Lost', 40, false) },
			],
		});
		expect(card).toMatchObject({ kind: 'crashNoFile', session: { name: 'Lost' } });
	});
	it('a Replace it backup copy is a kept copy, not a crash: Continue', () => {
		const card = chooseCard({
			recents: [a],
			sessions: [{ ...session('Brennan Hand', 500, false), replaced: true }],
		});
		expect(card).toEqual({ kind: 'continue', recent: a });
	});
	it('only a Replace it copy and no recent font: no card', () => {
		const card = chooseCard({ sessions: [{ ...session('Old', 5, false), replaced: true }] });
		expect(card).toEqual({ kind: 'none' });
	});
});

describe('otherFonts', () => {
	const list = ['A', 'B', 'C', 'D', 'E'].map((name) => recent(name));
	it('up to 3, leaving out the one the Continue card shows', () => {
		const card = chooseCard({ recents: list });
		expect(otherFonts(list, card).map((entry) => entry.name)).toEqual(['B', 'C', 'D']);
	});
	it('with a crash card every recent font can show', () => {
		const card = chooseCard({ recents: list, sessions: [session('X', 1, false)] });
		expect(otherFonts(list, card).map((entry) => entry.name)).toEqual(['A', 'B', 'C']);
	});
});

describe('defaultFontName', () => {
	const words = { base: 'My Font', numbered: (n) => `My Font ${n}` };
	it('"My Font" when no font has that name', () => {
		expect(defaultFontName(['Brennan Hand'], words)).toBe('My Font');
	});
	it('"My Font 2", "My Font 3"... when a font already has it (any case)', () => {
		expect(defaultFontName(['my font'], words)).toBe('My Font 2');
		expect(defaultFontName(['My Font', 'My Font 2', ' My Font 3 '], words)).toBe('My Font 4');
	});
});

describe('whenParts: "Tuesday 3:40 PM"', () => {
	// Thursday 10/15/2026, 9:00 AM local time
	const now = new Date(2026, 9, 15, 9, 0).getTime();
	it('today and yesterday by name', () => {
		const today = whenParts(new Date(2026, 9, 15, 8, 5).getTime(), now);
		expect(today).toEqual({ key: 'startScreen.when.today', vars: { time: '8:05 AM' } });
		const yesterday = whenParts(new Date(2026, 9, 14, 15, 40).getTime(), now);
		expect(yesterday).toEqual({ key: 'startScreen.when.yesterday', vars: { time: '3:40 PM' } });
	});
	it('this week: the weekday; older: the date', () => {
		const tuesday = whenParts(new Date(2026, 9, 13, 15, 40).getTime(), now);
		expect(tuesday).toEqual({
			key: 'startScreen.when.day',
			vars: { day: 'Tuesday', time: '3:40 PM' },
		});
		const older = whenParts(new Date(2026, 8, 30, 15, 40).getTime(), now);
		expect(older.vars.day).toBe('Sep 30');
	});
});

describe('countLetters', () => {
	it('letters (and joined letters) with at least one shape', () => {
		const content = {
			glyphs: { 'glyph-0x41': { shapes: [{}] }, 'glyph-0x42': { shapes: [] }, 'glyph-0x43': {} },
			ligatures: { 'liga-0x66-0x69': { shapes: [{}, {}] } },
		};
		expect(countLetters(content)).toBe(2);
	});
	it('no data: 0', () => {
		expect(countLetters(null)).toBe(0);
		expect(countLetters({})).toBe(0);
	});
});

describe('suggestedFileName', () => {
	it('"<name>.gs2", with what Windows forbids replaced', () => {
		expect(suggestedFileName('Brennan Hand')).toBe('Brennan Hand.gs2');
		expect(suggestedFileName('A/B: C?')).toBe('A-B- C-.gs2');
		expect(suggestedFileName('  ')).toBe('My Font.gs2');
	});
});
