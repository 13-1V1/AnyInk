// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix (thickness-card): a sketched Centerline letter votes on the font's slant with its
	centerline, never its swept ink, so one letter's thickness can never re-slant the font.
	Probe run3b (10/16/2026): an n whose right leg leans about 20 degrees, slid to the thick end
	(264), turned the font's slant to -24 and n's sides to 285 / -61.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { estimateSlant, fontSlant, letterSlant } from '../../spacing/slant.js';
import { rebuildItem } from '../build.js';
import { setSketch, sketchOf } from '../model.js';
import { commitThickness } from '../thickness.js';
import { centerlineRuns } from '../slant_vote.js';
import { N_ID, sketchedEditor } from './thickness_fixture.js';

const pin = (x, y, on) => ({ x, y, kind: 'corner', on, inset: 'edge' });

/** run3b's n: a plumb stem, an arc over the top, a leg leaning about 20 degrees */
function leaningN({ thickness = 99 } = {}) {
	return {
		v: 1,
		build: 1,
		key: 'sk_leaning_n',
		way: 'center',
		thickness,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points: {
			p1: pin(138, 50, 'writing'),
			p2: pin(138, 1051, 'small'),
			p3: { x: 620, y: 840, kind: 'smooth' },
			p4: pin(909, 50, 'writing'),
		},
		pieces: [
			{
				id: 1,
				key: 'pc_n',
				use: 'center',
				closed: false,
				parts: [
					{ type: 'line', from: 'p1', to: 'p2' },
					{ type: 'arc', from: 'p2', to: 'p3', bulge: -0.4, top: { on: 'small' } },
					{ type: 'line', from: 'p3', to: 'p4' },
				],
			},
		],
		relations: [],
		setAside: false,
		at: 1760659200000,
	};
}

function editorWithLeaningN(options) {
	const editor = sketchedEditor({ letters: {} });
	const item = editor.project.getItem(N_ID);
	setSketch(item, leaningN(options));
	rebuildItem(item, { project: editor.project });
	editor.history.addState('sketched small n');
	return { editor, item };
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	vi.restoreAllMocks();
});

describe('a sketched letter votes on the slant with its centerline', () => {
	it('the centerline runs: the plumb stem and the leaning leg, the same at any thickness', () => {
		const { editor, item } = editorWithLeaningN();
		const font = editor.project.settings.font;
		const runs = centerlineRuns(item, font, 440);
		expect(runs.length).toBeGreaterThanOrEqual(2);
		const stem = runs.find((run) => Math.abs(run.slope) < 0.01);
		expect(stem.height).toBeGreaterThan(900);
		// the ink's own outline is never read (the vote is the stem's: 0)
		expect(Math.abs(letterSlant(item, font))).toBeLessThan(0.01);
	});

	it('a leaning-leg n at the thick end (264) keeps the font upright and its sides even', () => {
		const { editor, item } = editorWithLeaningN();
		expect(fontSlant(editor.project)).toBe(0);
		for (const value of [200, 230, 264]) {
			commitThickness(editor, value);
			expect(sketchOf(item).thickness).toBe(value);
			expect(Math.abs(estimateSlant(editor.project))).toBeLessThan(1);
			expect(fontSlant(editor.project)).toBe(0);
			expect(item.anyink.spacingSlant ?? 0).toBe(0);
			expect(Math.abs(item.leftSideBearing - item.rightSideBearing)).toBeLessThanOrEqual(2);
		}
	});

	it('Flat ends at 264 change nothing about the slant', () => {
		const { editor, item } = editorWithLeaningN();
		[200, 230, 264].forEach((value) => commitThickness(editor, value));
		sketchOf(item).ends = 'flat';
		editor.history.addState('made the ends flat on small n');
		expect(fontSlant(editor.project)).toBe(0);
		expect(Math.abs(item.leftSideBearing - item.rightSideBearing)).toBeLessThanOrEqual(2);
	});

	it('a letter whose ink was changed behind its sketch votes with its ink, as before', () => {
		const { editor, item } = editorWithLeaningN();
		const font = editor.project.settings.font;
		const shape = item.shapes[0];
		shape.pathPoints[0].p.x += 40;
		expect(centerlineRuns(item, font, 440)).toBeUndefined();
	});
});
