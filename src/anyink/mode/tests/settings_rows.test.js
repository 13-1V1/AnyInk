// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 6.2 "Settings", 6.3): the settings tabs draw only the rows the mode
// shows. A row maker hands back [] for a hidden row; settingsSections then drops the headings
// and spacers left with nothing under them. All tools gets its list back untouched.
import { describe, expect, it } from 'vitest';
import { setModeForTests } from '../mode.js';
import { settingRow, settingShown, settingsSections } from '../settings_rows.js';

const node = (html) => {
	const box = document.createElement('div');
	box.innerHTML = html;
	return box.firstElementChild;
};
const label = (text) => [node(`<label>${text}</label>`), node('<span></span>')];
const words = (nodes) => nodes.map((n) => `${n.tagName.toLowerCase()}:${n.textContent}`);

describe('settingShown / settingRow', () => {
	it('All tools: every row today shows', () => {
		expect(settingShown('font', 'upm')).toBe(true);
		expect(settingShown('app', 'directlyDragCurves')).toBe(true);
		let built = 0;
		expect(settingRow('font', 'panose', () => (built++, label('Panose')))).toHaveLength(2);
		expect(built).toBe(1);
	});

	it('Simple: only font name, your name, copyright and the letter sets (6.2); a hidden row is never built', () => {
		setModeForTests('simple');
		expect(settingShown('font', 'family')).toBe(true);
		expect(settingShown('font', 'designer')).toBe(true);
		expect(settingShown('font', 'copyright')).toBe(true);
		expect(settingShown('project', 'characterRanges')).toBe(true);
		expect(settingShown('font', 'upm')).toBe(false);
		expect(settingShown('project', 'name')).toBe(false);
		expect(settingShown('app', 'forgetSnapshots')).toBe(false);
		let built = 0;
		expect(settingRow('font', 'panose', () => (built++, label('Panose')))).toEqual([]);
		expect(built).toBe(0);
	});
});

describe('settingsSections', () => {
	const tab = (rows) => [
		rows.family,
		node('<h2>Font metrics</h2>'),
		node('<h3>Key metrics</h3>'),
		rows.upm,
		node('<br>'),
		node('<h2>Links</h2>'),
		rows.designer,
		rows.copyright,
	];

	it('everything shown: the same nodes in the same order, flattened as addAsChildren would', () => {
		const rows = {
			family: label('Font family'),
			upm: label('UPM'),
			designer: label('Designer'),
			copyright: label('Copyright'),
		};
		const list = tab(rows);
		expect(settingsSections(list)).toEqual(list.flat());
	});

	it('a heading over only hidden rows goes, and so does the spacer after them', () => {
		const rows = {
			family: label('Font family'),
			upm: [],
			designer: [],
			copyright: label('Copyright'),
		};
		expect(words(settingsSections(tab(rows)))).toEqual([
			'label:Font family',
			'span:',
			'h2:Links',
			'label:Copyright',
			'span:',
		]);
	});

	it('nothing shown: nothing drawn', () => {
		expect(
			settingsSections([node('<h3>Saving</h3>'), [], node('<br>'), node('<h3>Behavior</h3>'), []])
		).toEqual([]);
	});
});
