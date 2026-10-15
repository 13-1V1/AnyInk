// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (UX-BEGINNER.md 4.3 Tools): the Brush is the tool an empty letter opens with, Select the one
	a letter with ink opens with; before B8 nothing changes.
*/
import { describe, expect, it } from 'vitest';
import { flagsOn } from '../../mode/features.js';
import { toolForOpenedLetter } from '../default_tool.js';
import { line } from './strokes.js';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';

const square = () =>
	new Path({
		name: 'Square',
		pathPoints: [
			[0, 0],
			[400, 0],
			[400, 400],
			[0, 400],
		].map(([x, y]) => ({ p: { coord: { x, y } } })),
	});
const strayLine = () =>
	new Path({
		name: 'Line',
		pathPoints: line([0, 0], [300, 0], 300).map(([x, y]) => ({ p: { coord: { x, y } } })),
	});

/** The Brush landed, whatever else the app has on */
const BRUSH = flagsOn('brush');

describe('the tool a letter opens with', () => {
	it('an empty letter opens with the Brush', () => {
		expect(toolForOpenedLetter(new Glyph({ id: 'glyph-0x61' }), { isOn: BRUSH })).toBe('nib');
	});

	it('a letter with ink opens with Select', () => {
		const item = new Glyph({ id: 'glyph-0x61', shapes: [square()] });
		expect(toolForOpenedLetter(item, { isOn: BRUSH })).toBe('resize');
	});

	it('a letter whose only shape is a stray line is not empty (D-037): Select, to pick and clear it', () => {
		const item = new Glyph({ id: 'glyph-0x61', shapes: [strayLine()] });
		expect(toolForOpenedLetter(item, { isOn: BRUSH })).toBe('resize');
	});

	it('before B8 (the brush flag off) the tool is left as it is', () => {
		expect(toolForOpenedLetter(new Glyph({ id: 'glyph-0x61' }), { isOn: flagsOn() })).toBeNull();
	});
});
