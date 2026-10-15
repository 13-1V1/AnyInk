// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: historyText turns the Undo titles the app records today (upstream's and ANY-INK's) into
// plain words for the undo toast and the Undo / Redo tooltips (UX-BEGINNER 2.2, 2.4 G). Looking
// around is never shown; a title nobody mapped shows as "your last change".
import { describe, expect, it } from 'vitest';
import { findBanned } from '../banned.js';
import { describeHistoryTitle, historyText, isHiddenHistoryTitle } from '../history_text.js';
import { hasWord } from '../words.js';
import { GAP_PROJECT, HISTORY_SAMPLES } from './history_samples.js';

describe('historyText', () => {
	it.each(HISTORY_SAMPLES.map((s) => [s.title.replace(/\s+/g, ' ').trim() || '(empty)', s]))(
		'%s',
		(_name, { title, context, text }) => {
			expect(historyText(title, context)).toBe(text);
		}
	);

	it('never says a banned word', () => {
		HISTORY_SAMPLES.forEach(({ title, context }) => {
			expect(findBanned(historyText(title, context)), title).toEqual([]);
		});
	});

	it('takes anything as a title', () => {
		expect(historyText(undefined)).toBe('your last change');
		expect(historyText(null)).toBe('your last change');
		expect(historyText(42)).toBe('your last change');
	});

	it("names the step's letter from the context before the title", () => {
		expect(historyText('Imported SVG to glyph Latin Small Letter G', { chars: 'G' })).toBe(
			'brought a drawing into Capital G'
		);
		expect(historyText('Auto-traced 2 shapes (90 points)', { chars: '.' })).toBe('traced the period');
		expect(historyText('Auto-traced 2 shapes (90 points)', { chars: 'fi' })).toBe(
			'traced the joined letters fi'
		);
	});

	it('falls back to "this letter" when no letter can be named', () => {
		expect(historyText('Paths were copied from Something Odd.')).toBe('copied shapes from this letter');
	});
});

describe('the B1 titles (carried from B1)', () => {
	it('are mapped by their own rules, not only passed through', () => {
		expect(describeHistoryTitle('gave small b a width').key).toBe('history.gaveWidth');
		expect(describeHistoryTitle('gave the space a width').key).toBe('history.gaveWidth');
		expect(describeHistoryTitle('fixed the width of small b').key).toBe('history.fixedWidth');
		expect(describeHistoryTitle('removed 2 stray shapes from small b')).toMatchObject({
			key: 'history.removedStray',
			vars: { count: 2, letter: 'small b' },
		});
		expect(describeHistoryTitle('removed a stray shape from small b').vars.count).toBe(1);
	});
});

describe('looking around', () => {
	it("upstream's 'Navigated to Latin Small Letter B' is hidden, but still named", () => {
		const step = describeHistoryTitle('Navigated to Latin Small Letter B');
		expect(step).toMatchObject({ key: 'history.navigated', vars: { letter: 'small b' }, hidden: true });
		expect(step.text).toBe('went to small b');
		expect(historyText('Navigated to Latin Small Letter B')).toBe('');
	});

	it('isHiddenHistoryTitle knows every looking-around title', () => {
		expect(isHiddenHistoryTitle('Navigated to Latin Small Letter B')).toBe(true);
		expect(isHiddenHistoryTitle('Automatically navigated to Latin Small Letter D')).toBe(true);
		expect(isHiddenHistoryTitle('Created Latin Small Letter C')).toBe(true);
		expect(isHiddenHistoryTitle('_whole_project_change_post_state_')).toBe(true);
		expect(isHiddenHistoryTitle('Created ligature ff')).toBe(false);
		expect(isHiddenHistoryTitle('Moved baseline')).toBe(false);
	});
});

describe('describeHistoryTitle', () => {
	it('gives the words key and its values', () => {
		expect(describeHistoryTitle('Moved 2 shapes')).toEqual({
			key: 'history.shapesMoved',
			vars: { count: 2 },
			hidden: false,
			text: 'moved 2 shapes',
		});
	});

	it('every key it names exists in words.js', () => {
		HISTORY_SAMPLES.forEach(({ title, context }) => {
			const { key } = describeHistoryTitle(title, context);
			if (key) expect(hasWord(key), `${title} -> ${key}`).toBe(true);
		});
	});

	it('passes a plain ANY-INK title through as it is, with no key', () => {
		expect(describeHistoryTitle('named the font Brennan Hand')).toEqual({
			key: '',
			vars: {},
			hidden: false,
			text: 'named the font Brennan Hand',
		});
	});

	it('names the letters of a gap fix from the font', () => {
		expect(
			describeHistoryTitle('Nudged kern group kern-3 by -10', { project: GAP_PROJECT }).vars
		).toEqual({ left: 'Capital A', right: 'Capital V' });
	});
});
