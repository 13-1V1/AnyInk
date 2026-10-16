// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize (thickness-card verifier): an n drawn with the real Line tool, stem, the pull-back
	tangent arch tagged on the small-letter line, then a leaning leg. A thickness change slid the
	arch's end round its circle and dragged the leg he drew with it (its top from x 937 to 618
	between 200 and 264), so the font's slant and n's sides jumped. Now an end another part goes on
	from is held: the arch moves up or down instead, the leg keeps its x, the arch's top stays on
	its line, and the slant does not move with the thickness.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLines } from '../../placement/classes.js';
import { fontSlant } from '../../spacing/slant.js';
import { rebuildItem } from '../build.js';
import { pieceSkeleton } from '../curves.js';
import { extremeTargets } from '../tools/arc_snap.js';
import { setSketch, sketchOf } from '../model.js';
import { commitThickness } from '../thickness.js';
import { N_ID, sketchedEditor } from './thickness_fixture.js';
import { makeCtx, pointer } from '../tools/tests/fake_ctx.js';
import { makeLineTool } from '../tools/line.js';
import '../slant_vote.js';

/** The n the verifier drew: stem to `stemTop`, the tangent arch, a leg leaning by legDx */
function toolN(font, stemTop, legDx) {
	const lines = guideLines(font);
	const ctx = makeCtx();
	const tool = makeLineTool(ctx);
	const p = pointer(tool);
	p.click(300, lines.writing);
	p.click(300, stemTop);
	p.path([
		[300, stemTop + 60],
		[300, stemTop + 2],
		[340, stemTop + 60],
	]);
	const r = lines.small - stemTop;
	p.click(300 + 2 * r + 8, stemTop - 10);
	p.click(300 + 2 * r + 8 + legDx, lines.writing);
	p.key('enter');
	return ctx.commits.at(-1)?.sketch;
}

/** The highest y of the piece's built centerline */
function centerTop(sketch) {
	let top = -Infinity;
	for (const cubic of pieceSkeleton(sketch.pieces[0], sketch)) {
		for (let i = 0; i <= 64; i++) {
			const t = i / 64;
			const u = 1 - t;
			const y =
				u * u * u * cubic[0][1] +
				3 * u * u * t * cubic[1][1] +
				3 * u * t * t * cubic[2][1] +
				t * t * t * cubic[3][1];
			top = Math.max(top, y);
		}
	}
	return top;
}

describe('a tangent arch held by the leg after it', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		setModeForTests('simple');
		setFeaturesForTests({ sketch: true });
	});
	afterEach(() => {
		resetFeaturesForTests();
		setModeForTests(null);
		vi.restoreAllMocks();
	});

	for (const stemTop of [700, 800]) {
		it(`stem to ${stemTop}: the leg keeps its x and the slant holds at every thickness`, () => {
			const editor = sketchedEditor({ letters: {} });
			const font = editor.project.settings.font;
			const drawn = toolN(font, stemTop, 300);
			expect(drawn).toBeTruthy();
			const arch = drawn.pieces[0].parts.find((part) => part.type === 'arc');
			expect(arch?.tangent).toBe(true);
			expect(arch?.top?.on).toBe('small');
			const n = editor.project.getItem(N_ID);
			setSketch(n, { ...drawn, key: 'sk_tool_n' });
			rebuildItem(n, { project: editor.project });
			editor.history.addState('drew n');
			commitThickness(editor, 99);
			// spacing moves the whole letter sideways: measured from the arch's start
			const across = (sketch) => sketch.points[arch.to].x - sketch.points[arch.from].x;
			const x0 = across(sketchOf(n));
			const slant0 = fontSlant(editor.project);
			for (const value of [33, 150, 200, 264, 99]) {
				commitThickness(editor, value);
				const sketch = sketchOf(n);
				expect(Math.abs(across(sketch) - x0)).toBeLessThanOrEqual(2);
				expect(Math.abs(fontSlant(editor.project) - slant0)).toBeLessThanOrEqual(2.5);
				const target = extremeTargets(font, sketch.thickness, 'center').find(
					(entry) => entry.on === 'small'
				);
				expect(Math.abs(centerTop(sketch) - target.y)).toBeLessThanOrEqual(6);
			}
		});
	}
});
