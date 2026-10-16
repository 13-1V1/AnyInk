// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 (docs/SKETCH.md 2, the key table): in Simple with 'sketch' on, keys.js remaps every shape
// key to a sketch tool (L Line, A Arc, S and P Spline, C O Q Circle, R Rectangle; E and V
// Select; M Rectangle, H and W the Point pen stay), each tool prints its first key, Help lists
// each key once, and the "Switched to" toast names the sketch tool. With the flag off Simple is
// exactly as before, and All tools never changes. visibility.js shows the five tools in Simple
// only, never inside Fine-tune. Written to fail first (keys.js and visibility.js had no sketch).
import { describe, expect, it } from 'vitest';
import { flagsOn } from '../../../mode/features.js';
import { keysShown, toolForKey, toolKey, toolSwitchToast } from '../../../mode/keys.js';
import { isShown, simplePlace } from '../../../mode/visibility.js';
import { word } from '../../../words/words.js';
import { SKETCH_TOOLS } from '../tool_names.js';

/** The flags as the app has them, plus or minus the sketch */
const APP = ['coach', 'letterView', 'brush', 'photo', 'board', 'checks', 'tryIt', 'startScreen', 'useInWord', 'fontDetails', 'help'];
const WITH_SKETCH = { mode: 'simple', isOn: flagsOn(...APP, 'sketch') };
const NO_SKETCH = { mode: 'simple', isOn: flagsOn(...APP) };
const ALL_WITH_SKETCH = { mode: 'all', isOn: flagsOn(...APP, 'sketch') };
const ALL_NO_SKETCH = { mode: 'all', isOn: flagsOn(...APP) };

const LETTERS = ['l', 'a', 's', 'p', 'c', 'o', 'q', 'r', 'e', 'v', 'm', 'h', 'w', 'b', 'n', 'u'];
const picks = (options) => Object.fromEntries(LETTERS.map((key) => [key, toolForKey(key, options)]));

describe('Simple with the sketch on', () => {
	it('every shape key makes a sketch; V and E are Select; M, H, W and the Brush keep theirs', () => {
		expect(picks(WITH_SKETCH)).toEqual({
			l: 'sketchLine',
			a: 'sketchArc',
			s: 'sketchSpline',
			p: 'sketchSpline',
			c: 'sketchCircle',
			o: 'sketchCircle',
			q: 'sketchCircle',
			r: 'sketchRectangle',
			e: 'resize',
			v: 'resize',
			m: 'newRectangle',
			h: 'newPath',
			w: 'newPath',
			b: 'nib',
			n: 'nib',
			u: null,
		});
	});

	it('Shift does not matter (Shift+L is L)', () => {
		expect(toolForKey('L', WITH_SKETCH)).toBe('sketchLine');
	});

	it('each tool prints its first key; Select prints V', () => {
		expect(SKETCH_TOOLS.map((tool) => toolKey(tool, WITH_SKETCH))).toEqual(['L', 'A', 'S', 'C', 'R']);
		expect(toolKey('resize', WITH_SKETCH)).toBe('V');
		expect(toolKey('newOval', WITH_SKETCH)).toBe(null);
	});

	it('Help lists every key once, under the tool it picks', () => {
		const tools = keysShown(WITH_SKETCH).filter((row) => row.action === 'selectTool');
		const seen = tools.flatMap((row) => row.keys);
		expect(new Set(seen).size).toBe(seen.length);
		const byTool = Object.fromEntries(tools.map((row) => [row.tool, row.keys]));
		expect(byTool).toMatchObject({
			sketchLine: ['L'],
			sketchArc: ['A'],
			sketchSpline: ['S', 'P'],
			sketchCircle: ['C', 'O', 'Q'],
			sketchRectangle: ['R'],
			resize: ['V', 'E'],
			newPath: ['H', 'W'],
			newRectangle: ['M'],
		});
		expect(byTool.pathEdit).toBeUndefined();
		expect(byTool.newOval).toBeUndefined();
		// the Brush first, then the sketch tools, then Select (the column's order)
		expect(tools.map((row) => row.tool).slice(0, 7)).toEqual(['nib', ...SKETCH_TOOLS, 'resize']);
	});

	it('the tool key toast names the sketch tool and its key', () => {
		expect(toolSwitchToast('sketchCircle', WITH_SKETCH)).toEqual({
			key: 'mode.toolSwitched',
			vars: { tool: word('sketch.tool.circle'), key: 'C' },
			options: { group: 'toolSwitch' },
		});
	});

	it('visibility: the five tools show in Simple, always on the column (never inside Fine-tune)', () => {
		SKETCH_TOOLS.forEach((tool) => {
			expect(isShown('tool', tool, WITH_SKETCH), tool).toBe(true);
			expect(simplePlace('tool', tool), tool).toBe(null);
		});
	});
});

describe('the sketch off, and All tools: as before', () => {
	it('Simple with the flag off keeps every key it had', () => {
		expect(picks(NO_SKETCH)).toEqual({
			l: null,
			a: 'resize',
			s: null,
			p: 'newPath',
			c: null,
			o: 'newOval',
			q: 'newOval',
			r: 'newRectangle',
			e: 'pathEdit',
			v: 'resize',
			m: 'newRectangle',
			h: 'newPath',
			w: 'newPath',
			b: 'nib',
			n: 'nib',
			u: null,
		});
		expect(toolKey('newPath', NO_SKETCH)).toBe('P');
		expect(toolKey('resize', NO_SKETCH)).toBe('V');
		SKETCH_TOOLS.forEach((tool) => expect(isShown('tool', tool, NO_SKETCH)).toBe(false));
	});

	it('All tools is the same with the sketch on or off, and never shows a sketch tool', () => {
		const all = picks(ALL_NO_SKETCH);
		expect(picks(ALL_WITH_SKETCH)).toEqual(all);
		expect(all).toMatchObject({ l: null, a: 'resize', p: 'newPath', e: 'pathEdit', r: 'newRectangle', o: 'newOval', u: 'pathAddPoint' });
		expect(keysShown(ALL_WITH_SKETCH)).toEqual(keysShown(ALL_NO_SKETCH));
		SKETCH_TOOLS.forEach((tool) => expect(isShown('tool', tool, ALL_WITH_SKETCH)).toBe(false));
	});
});
