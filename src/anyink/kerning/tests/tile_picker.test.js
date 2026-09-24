// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { CharacterRange } from '../../../project_data/character_range.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { enabledRanges, makeMemberChips, makeTilePicker } from '../tile_picker.js';

let project;
const smallRange = () => [new CharacterRange({ begin: 0x41, end: 0x45, name: 'A to E' })];

beforeEach(() => {
	project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	setCurrentProjectEditor(new ProjectEditor({ project }));
});

describe('tile_picker: ranges', () => {
	it('lists the enabled ranges of the project as CharacterRange instances', () => {
		const ranges = enabledRanges(project);
		expect(ranges.length).toBeGreaterThan(0);
		expect(ranges[0]).toBeInstanceOf(CharacterRange);
		expect(ranges[0].getMemberIDs()).toContain('0x41');
	});

	it('skips disabled ranges', () => {
		project.settings.project.characterRanges.push(
			new CharacterRange({ begin: 0x100, end: 0x110, name: 'Off', enabled: false })
		);
		expect(enabledRanges(project).some((r) => r.name === 'Off')).toBe(false);
	});
});

describe('tile_picker: makeTilePicker', () => {
	it('renders one glyph-tile per member with the tile selected state for initial members', () => {
		const picker = makeTilePicker({ project, ranges: smallRange(), selected: ['0x42'] });
		const tiles = picker.element.querySelectorAll('glyph-tile');
		expect(tiles.length).toBe(5);
		expect(picker.element.querySelector('.anyink-tile-picker__eyebrow').textContent).toBe('A to E');
		const b = picker.element.querySelector('glyph-tile[data-hex="0x42"]');
		expect(b.hasAttribute('selected')).toBe(true);
		expect(picker.element.querySelector('glyph-tile[data-hex="0x41"]').hasAttribute('selected')).toBe(false);
	});

	it('click toggles membership and reports the selection', () => {
		const onChange = vi.fn();
		const picker = makeTilePicker({ project, ranges: smallRange(), onChange });
		const a = picker.element.querySelector('glyph-tile[data-hex="0x41"]');
		const c = picker.element.querySelector('glyph-tile[data-hex="0x43"]');
		a.click();
		c.click();
		expect(picker.getSelected()).toEqual(['0x41', '0x43']);
		expect(a.hasAttribute('selected')).toBe(true);
		expect(onChange).toHaveBeenLastCalledWith(['0x41', '0x43']);
		a.click();
		expect(picker.getSelected()).toEqual(['0x43']);
		expect(a.hasAttribute('selected')).toBe(false);
		expect(picker.isSelected('0x43')).toBe(true);
	});

	it('single mode keeps exactly one pick and un-picks on a second click', () => {
		const picker = makeTilePicker({ project, ranges: smallRange(), multi: false });
		picker.element.querySelector('glyph-tile[data-hex="0x41"]').click();
		picker.element.querySelector('glyph-tile[data-hex="0x44"]').click();
		expect(picker.getSelected()).toEqual(['0x44']);
		expect(picker.element.querySelectorAll('glyph-tile[selected]').length).toBe(1);
		picker.element.querySelector('glyph-tile[data-hex="0x44"]').click();
		expect(picker.getSelected()).toEqual([]);
	});

	it('setSelected repaints the tiles', () => {
		const picker = makeTilePicker({ project, ranges: smallRange() });
		picker.setSelected(['0x45', '0x41']);
		expect(picker.getSelected()).toEqual(['0x45', '0x41']);
		expect(picker.element.querySelectorAll('glyph-tile[selected]').length).toBe(2);
		picker.setSelected([]);
		expect(picker.element.querySelectorAll('glyph-tile[selected]').length).toBe(0);
	});

	it('pages large ranges behind a show-more button', () => {
		const picker = makeTilePicker({ project, ranges: smallRange(), pageSize: 2 });
		expect(picker.element.querySelectorAll('glyph-tile').length).toBe(2);
		const more = picker.element.querySelector('.anyink-tile-picker__more');
		expect(more.textContent).toBe('Show 2 more');
		more.click();
		expect(picker.element.querySelectorAll('glyph-tile').length).toBe(4);
		picker.element.querySelector('.anyink-tile-picker__more').click();
		expect(picker.element.querySelectorAll('glyph-tile').length).toBe(5);
		expect(picker.element.querySelector('.anyink-tile-picker__more')).toBeNull();
	});

	it('uses the project ranges when none are passed', () => {
		const picker = makeTilePicker({ project });
		expect(picker.element.querySelector('glyph-tile[data-hex="0x41"]')).not.toBeNull();
	});
});

describe('tile_picker: makeMemberChips', () => {
	it('renders a chip per member, warns on missing glyphs, and removes on click', () => {
		const onRemove = vi.fn();
		const chips = makeMemberChips(['0x41', '0x5A'], { project, onRemove });
		const codes = chips.querySelectorAll('code');
		expect(codes.length).toBe(2);
		expect(codes[0].textContent).toBe('A');
		expect(codes[0].classList.contains('warning')).toBe(false);
		expect(codes[1].textContent).toBe('Z');
		expect(codes[1].classList.contains('warning')).toBe(true); // Z is not in the sample project
		expect(codes[1].getAttribute('title')).toContain('does not exist');
		codes[0].click();
		expect(onRemove).toHaveBeenCalledWith('0x41');
	});

	it('shows an empty note when there are no members', () => {
		const chips = makeMemberChips([], { project, emptyText: 'pick one' });
		expect(chips.querySelector('.anyink-kern-chips__empty').textContent).toBe('pick one');
	});
});
