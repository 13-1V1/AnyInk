// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize: a Circle drawn between two writing lines stays a circle when a line moves (B15's
	Move the guide lines, B11's Move the line: follow.js followLines) and through every build
	(build.js buildSketch), not only on a thickness change. Before, the edge rule moved its top
	and bottom with the line while its plumb sides and stored { rx, ry } stayed: an oval.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { buildSketch } from '../build.js';
import { edgeY } from '../edge_rule.js';
import { followLines } from '../follow.js';
import { sketchOf } from '../model.js';
import { placePins } from '../follow_sketch.js';
import { STORED_FONT } from './fixtures/stored_sketches.js';
import { FOLLOW_IDS, builtLetter, followEditor } from './follow_helpers.js';

function circleBetweenLines(font, thickness, cx = 627) {
	const pin = (on) => ({ on, inset: 'edge', kind: 'smooth', lock: 'level' });
	const top = pin('small');
	const bottom = pin('writing');
	const topY = edgeY(top, font, thickness);
	const bottomY = edgeY(bottom, font, thickness);
	const r = (topY - bottomY) / 2;
	const cy = (topY + bottomY) / 2;
	return {
		v: 1,
		build: 1,
		key: 'sk_circle_lines',
		way: 'center',
		thickness,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points: {
			p1: { x: cx + r, y: cy, kind: 'smooth', lock: 'plumb' },
			p2: { x: cx, y: topY, ...top },
			p3: { x: cx - r, y: cy, kind: 'smooth', lock: 'plumb' },
			p4: { x: cx, y: bottomY, ...bottom },
		},
		pieces: [
			{
				id: 1,
				key: 'pc_o',
				use: 'center',
				closed: true,
				circle: { cx, cy, rx: r, ry: r },
				parts: [{ type: 'spline', points: ['p1', 'p2', 'p3', 'p4'] }],
			},
		],
		relations: [],
		setAside: false,
		at: 1760659200000,
	};
}

function expectRound(sketch) {
	const { p1, p2, p3, p4 } = sketch.points;
	const circle = sketch.pieces[0].circle;
	expect(p1.x - p3.x).toBeCloseTo(p2.y - p4.y, 0);
	expect(circle.rx).toBeCloseTo(circle.ry, 6);
	expect(2 * circle.ry).toBeCloseTo(p2.y - p4.y, 0);
}

describe('a circle between two lines follows a moved line and stays round', () => {
	beforeEach(() => setFeaturesForTests({ sketch: true }));
	afterEach(() => resetFeaturesForTests());

	it('buildSketch places a circle whose top moved as a circle again', () => {
		const sketch = circleBetweenLines(STORED_FONT, 99);
		const raised = { ...STORED_FONT, xHeight: STORED_FONT.xHeight + 120 };
		const { placed } = buildSketch(sketch, { font: raised });
		expectRound(placed);
	});

	it('placePins keeps it round', () => {
		const sketch = circleBetweenLines(STORED_FONT, 99);
		const raised = { ...STORED_FONT, xHeight: STORED_FONT.xHeight + 120 };
		expectRound(placePins(sketch, raised));
	});

	it('followLines after the small-letter line moves up 120: the o stays a circle', () => {
		const editor = followEditor();
		const item = builtLetter(editor, FOLLOW_IDS.o, circleBetweenLines(STORED_FONT, 99));
		editor.project.settings.font.xHeight += 120;
		followLines(editor.project);
		expectRound(sketchOf(item));
	});
});
