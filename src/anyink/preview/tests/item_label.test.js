// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { validateKerning } from '../../fontcheck/validate_kerning.js';
import { itemLabel } from '../item_label.js';

describe('itemLabel', () => {
	const project = (items = {}) => ({ getItem: (id) => items[id] || false });

	it('names letters the house way', () => {
		expect(itemLabel(project(), 'glyph-0x61')).toEqual({ name: 'small a', plural: false });
		expect(itemLabel(project(), 'glyph-0x41')).toEqual({ name: 'Capital A', plural: false });
		expect(itemLabel(project(), 'glyph-0x3f')).toEqual({
			name: 'the question mark',
			plural: false,
		});
	});

	it('names joined letters by what they join', () => {
		const items = { 'liga-0x66-0x66': { chars: 'ff' } };
		expect(itemLabel(project(items), 'liga-0x66-0x66')).toEqual({
			name: 'the joined letters ff',
			plural: true,
		});
	});

	// B1 fix pass: a gap is named the way the font check and the export toast name it
	// (validate_kerning.js kernSubject): every letter on each side that the font file holds.
	// It used to take the first letter of each side, even one he never drew ("Capital Z").
	const sample = () => new GlyphrStudioProject(structuredClone(simpleExampleProject));

	it('names a gap by the letters on each side, the same words as the font check', () => {
		const real = sample();
		real.kerning['kern-0'].value = 40000;
		const [checked] = validateKerning(real);
		expect(checked.itemId).toBe('kern-0');
		const label = itemLabel(real, 'kern-0');
		expect(label.plural).toBe(false);
		expect(checked.message.toLowerCase()).toContain(label.name.toLowerCase());
		expect(label.name).toBe('the gap between Capital A, Capital B or Capital C and Capital C');
	});

	it('leaves out a letter that is not in his font', () => {
		const real = sample();
		expect(real.getItem('glyph-0x5A')).toBeFalsy(); // no Capital Z in the sample
		real.kerning['kern-0'].leftGroup = ['0x5A', '0x41', '0x42'];
		expect(itemLabel(real, 'kern-0')).toEqual({
			name: 'the gap between Capital A or Capital B and Capital C',
			plural: false,
		});
	});

	it('gives null for a gap with a side it cannot name', () => {
		const real = sample();
		real.kerning['kern-0'].leftGroup = ['0x5A'];
		expect(itemLabel(real, 'kern-0')).toBe(null);
		expect(itemLabel(real, 'kern-99')).toBe(null);
		expect(itemLabel(project(), 'kern-9')).toBe(null);
	});

	it('gives null for anything it cannot name in plain words', () => {
		expect(itemLabel(project(), null)).toBe(null);
		expect(itemLabel(project(), 'comp-3')).toBe(null);
		expect(itemLabel(project(), 'glyph-0xZZ')).toBe(null);
		expect(itemLabel(project(), 'liga-0x66-0x66')).toBe(null);
	});
});
