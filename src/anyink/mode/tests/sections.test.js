// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring: the list filter the page chooser, the menus and the settings tabs share (6.3). A
// heading stays only over something shown, separators never dangle, and a list with nothing
// hidden comes back exactly as it was (All tools looks as today).
import { describe, expect, it } from 'vitest';
import { heading, item, keepShown, rule } from '../sections.js';

const ids = (list) =>
	list.map((entry) => (entry.kind === 'item' ? entry.id : `${entry.kind}:${entry.value}`));
const only =
	(...shown) =>
	(id) =>
		shown.includes(id);

describe('keepShown', () => {
	const fileMenu = [
		heading('work file'),
		item('save'),
		item('save-as'),
		rule('hr'),
		heading('font file'),
		item('font-otf'),
		item('font-ttf'),
		item('font-folder'),
		rule('hr'),
		heading('svg'),
		item('font-svg'),
	];

	it('nothing hidden: the same list, separators and all, even a trailing one', () => {
		const list = [item('a'), rule('br'), item('b'), rule('br')];
		expect(keepShown(list, () => true)).toEqual(list);
		expect(keepShown(fileMenu, () => true)).toEqual(fileMenu);
	});

	it('drops a heading whose section is all hidden, and the rule that led to it', () => {
		expect(ids(keepShown(fileMenu, only('save', 'save-as', 'font-otf')))).toEqual([
			'heading:work file',
			'save',
			'save-as',
			'rule:hr',
			'heading:font file',
			'font-otf',
		]);
	});

	it('never starts or ends with a rule, and never puts two together', () => {
		const list = [rule('a'), item('x'), rule('b'), rule('c'), item('y'), rule('d'), item('z')];
		expect(ids(keepShown(list, only('x', 'y')))).toEqual(['x', 'rule:b', 'y']);
		expect(ids(keepShown(list, only('y')))).toEqual(['y']);
		expect(keepShown(list, () => false)).toEqual([]);
	});

	it('an h2 stays over the h3 sections under it while any of them shows', () => {
		const list = [
			heading('Font metrics', 2),
			heading('Key metrics', 3),
			item('ascent'),
			heading('Other metrics', 3),
			item('lineGap'),
			heading('Links', 2),
			item('designer'),
			item('copyright'),
		];
		expect(ids(keepShown(list, only('lineGap', 'copyright')))).toEqual([
			'heading:Font metrics',
			'heading:Other metrics',
			'lineGap',
			'heading:Links',
			'copyright',
		]);
		expect(ids(keepShown(list, only('designer')))).toEqual(['heading:Links', 'designer']);
	});

	it('page chooser: subtitles over no shown page go', () => {
		const toc = [
			item('Overview'),
			heading('Design glyphs'),
			item('Characters'),
			item('Ligatures'),
			heading('Refine'),
			item('Kerning'),
			heading('Settings & more'),
			item('Settings'),
			item('Help'),
		];
		expect(ids(keepShown(toc, only('Overview', 'Characters', 'Help')))).toEqual([
			'Overview',
			'heading:Design glyphs',
			'Characters',
			'heading:Settings & more',
			'Help',
		]);
	});

	it('keeps each entry object as given (callers read their own values back)', () => {
		const save = item('save', { name: 'Save' });
		expect(keepShown([save, item('x')], only('save'))[0]).toBe(save);
	});
});
