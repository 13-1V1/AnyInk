// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 stand-ins (UX-BEGINNER.md 4.0 Rendered letters, 4.6 Stand-ins): letters not made yet show
	as faint outlined letters, about 15% ink, no box, each as wide as a letter, so a word with a
	missing letter still reads as a word; a small legend says "gray = not made yet" until 5
	letters are ready. Simple only, with the 'tryIt' flag.
*/
import { describe, expect, it } from 'vitest';
import { TextBlock } from '../../../display_canvas/text_block.js';
import { twoLetterProject } from '../../history/tests/two_letters.js';
import { Path } from '../../../project_data/path.js';
import { flagsOn } from '../../mode/features.js';
import {
	CAP_RATIO,
	drawStandIns,
	isStandIn,
	legendShows,
	LEGEND_UNTIL_READY,
	makeLayoutProject,
	STAND_IN_ALPHA,
	standInsOnSheet,
	standInsWanted,
	standInType,
	standInWidth,
} from '../stand_ins.js';

const B = 'glyph-0x42';
const R = 'glyph-0x72';
/** a monospaced measure: every letter is half its type size wide */
const half = () => 0.5;

function square() {
	return new Path({
		pathPoints: [
			{ p: { coord: { x: 0, y: 0 } } },
			{ p: { coord: { x: 0, y: 700 } } },
			{ p: { coord: { x: 500, y: 700 } } },
			{ p: { coord: { x: 500, y: 0 } } },
		],
	});
}

/** B has ink and a width of 600; r is an empty record (width 0); nothing else exists */
function projectWithB() {
	const project = twoLetterProject();
	const b = project.getItem(B);
	b.shapes.push(square());
	b.advanceWidth = 600;
	return project;
}

function layout(project, text) {
	return new TextBlock({
		options: { text, fontSize: 100, pagePadding: 10, lineGap: 20 },
		canvasMaxes: { xMin: 10, xMax: 5000, yMin: 10, yMax: 1000 },
		project,
	});
}

describe('when stand-ins show', () => {
	it('Simple with the tryIt flag only', () => {
		expect(standInsWanted({ simple: true, isOn: flagsOn('tryIt') })).toBe(true);
		expect(standInsWanted({ simple: true, isOn: flagsOn('coach') })).toBe(false);
		expect(standInsWanted({ simple: false, isOn: flagsOn('tryIt') })).toBe(false);
	});
});

describe('how wide a stand-in is', () => {
	const font = { upm: 1000, capHeight: 700 };

	it('its type size puts a capital at the font capitals line', () => {
		expect(standInType(font)).toBe(Math.round(700 / CAP_RATIO));
	});

	it('as wide as the letter it stands for, plus a little room each side, in whole units', () => {
		const width = standInWidth('m', font, () => 0.8);
		const narrow = standInWidth('i', font, () => 0.25);
		expect(Number.isInteger(width)).toBe(true);
		expect(width).toBeGreaterThan(narrow);
		expect(narrow).toBeGreaterThan(0.25 * standInType(font));
	});

	it('falls back to the default width when the letter cannot be measured', () => {
		expect(standInWidth('m', font, () => NaN, 640)).toBe(640);
	});
});

describe('the layout project', () => {
	it('a made letter is the letter itself', () => {
		const project = projectWithB();
		const view = makeLayoutProject(project, { measure: half });
		expect(view.getItem(B)).toBe(project.getItem(B));
		expect(isStandIn(view.getItem(B))).toBe(false);
	});

	it('an empty letter (width 0) gets a stand-in width; the font is never changed', () => {
		const project = projectWithB();
		const view = makeLayoutProject(project, { measure: half });
		const r = view.getItem(R);
		expect(isStandIn(r)).toBe(true);
		expect(r.advanceWidth).toBe(standInWidth('r', project.settings.font, half));
		expect(r.id).toBe(R);
		expect(project.getItem(R).advanceWidth).toBe(0);
	});

	it('a letter with no record yet is a stand-in that a double-click can open', () => {
		const project = projectWithB();
		const view = makeLayoutProject(project, { measure: half });
		const a = view.getItem('glyph-0x61');
		expect(isStandIn(a)).toBe(true);
		expect(a.id).toBe('glyph-0x61');
		expect(a.shapes).toEqual([]);
		expect(project.getItem('glyph-0x61')).toBe(false);
	});

	it('the shape still being drawn with the Point pen is no ink', () => {
		const project = projectWithB();
		const r = project.getItem(R);
		const open = square();
		r.shapes.push(open);
		expect(isStandIn(makeLayoutProject(project, { measure: half }).getItem(R))).toBe(false);
		expect(isStandIn(makeLayoutProject(project, { open, measure: half }).getItem(R))).toBe(
			true
		);
	});

	it('everything else reads through to the font', () => {
		const project = projectWithB();
		const view = makeLayoutProject(project, { measure: half });
		expect(view.settings).toBe(project.settings);
		expect(view.getItem(B, true)).toBe(project.getItem(B));
		expect(view.totalVertical).toBe(project.totalVertical);
	});
});

describe('stand-ins on the sheet', () => {
	it('"Br a" lays the missing letters out a letter wide each, never on top of each other', () => {
		const project = projectWithB();
		const block = layout(makeLayoutProject(project, { measure: half }), 'Bra');
		const [b, r, a] = block.data[0];
		expect(r.view.dx).toBeGreaterThan(b.view.dx);
		expect(a.view.dx).toBeGreaterThan(r.view.dx);
		expect(standInsOnSheet(block).map((c) => c.char)).toEqual(['r', 'a']);
	});

	it('spaces are never stand-ins', () => {
		const project = projectWithB();
		const block = layout(makeLayoutProject(project, { measure: half }), 'B a');
		expect(standInsOnSheet(block).map((c) => c.char)).toEqual(['a']);
	});

	it('draws each as a faint outline, about 15% ink, no box', () => {
		const project = projectWithB();
		const block = layout(makeLayoutProject(project, { measure: half }), 'Bra');
		const calls = [];
		const ctx = {
			save: () => calls.push('save'),
			restore: () => calls.push('restore'),
			strokeText: (text, x, y) => calls.push(['strokeText', text, ctx.globalAlpha, x, y]),
			fillText: () => calls.push('fillText'),
			strokeRect: () => calls.push('strokeRect'),
			fillRect: () => calls.push('fillRect'),
			globalAlpha: 1,
		};
		const drawn = drawStandIns(ctx, block, { color: '#111318', font: project.settings.font });
		expect(drawn).toBe(2);
		const strokes = calls.filter((c) => Array.isArray(c));
		expect(strokes.map((c) => c[1])).toEqual(['r', 'a']);
		strokes.forEach((c) => expect(c[2]).toBe(STAND_IN_ALPHA));
		expect(STAND_IN_ALPHA).toBeCloseTo(0.15);
		expect(calls).not.toContain('fillText');
		expect(calls).not.toContain('strokeRect');
		expect(calls).not.toContain('fillRect');
		// centered in its slot, on the writing line
		const r = block.data[0][1];
		expect(strokes[0][3]).toBeCloseTo(r.view.dx + (r.widths.advance * r.view.dz) / 2);
		expect(strokes[0][4]).toBeCloseTo(r.view.dy);
	});
});

describe('the legend', () => {
	it('shows while a stand-in is on the sheet and fewer than 5 letters are ready', () => {
		expect(LEGEND_UNTIL_READY).toBe(5);
		expect(legendShows({ drawn: 2, ready: 4 })).toBe(true);
		expect(legendShows({ drawn: 2, ready: 5 })).toBe(false);
		expect(legendShows({ drawn: 0, ready: 1 })).toBe(false);
	});
});
