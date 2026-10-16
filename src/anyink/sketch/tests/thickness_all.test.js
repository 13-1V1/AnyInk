// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 Use on all (docs/SKETCH.md section 3 and rule 25): the offer stands only while the slider's
	step is the newest change and other sketched letters differ; [Use on all] re-inks every letter
	at another thickness a few per frame behind the "Rebuilding letters..." pill, as ONE whole-font
	step that one Undo takes back; a letter whose ink was changed behind its sketch is left alone.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sketchOf } from '../model.js';
import { builtMatches, builtShapes } from '../sketch_record.js';
import { commitThickness } from '../thickness.js';
import {
	CHUNK,
	isRebuildingAll,
	justThisOne,
	noteThicknessOffer,
	resetThicknessAllForTests,
	thicknessOffer,
	useThicknessOnAll,
} from '../thickness_all.js';
import {
	A_ID,
	N_ID,
	O_ID,
	R_ID,
	S_ID,
	U_ID,
	sketchedEditor,
	stemWidth,
} from './thickness_fixture.js';

const FIVE = { [N_ID]: 99, [A_ID]: 120, [O_ID]: 99, [R_ID]: 140, [S_ID]: 160 };

/** A frame queue that counts the frames it ran */
function frames() {
	let count = 0;
	return {
		frame: (fn) => {
			count += 1;
			setTimeout(fn, 0);
		},
		count: () => count,
	};
}

beforeEach(() => {
	setModeForTests('simple');
	setFeaturesForTests({ sketch: true });
	resetThicknessAllForTests();
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('the offer (rule 25)', () => {
	it('"Use this thickness on all 5 sketched letters?" after the slider\'s step', () => {
		const editor = sketchedEditor({ letters: FIVE });
		commitThickness(editor, 150);
		expect(noteThicknessOffer(editor)).toBe(true);
		expect(thicknessOffer(editor)).toEqual({ count: 5, thickness: 150, itemId: N_ID });
	});

	it('goes with [Just this one], with any later step, and after an Undo', () => {
		const editor = sketchedEditor({ letters: FIVE });
		commitThickness(editor, 150);
		noteThicknessOffer(editor);
		justThisOne();
		expect(thicknessOffer(editor)).toBe(null);

		commitThickness(editor, 160);
		noteThicknessOffer(editor);
		editor.history.addState('another change');
		expect(thicknessOffer(editor)).toBe(null);

		commitThickness(editor, 170);
		noteThicknessOffer(editor);
		editor.history.restoreState();
		expect(thicknessOffer(editor)).toBe(null);
	});

	it('is never made when every sketched letter already matches', () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99, [R_ID]: 150 } });
		commitThickness(editor, 150);
		expect(noteThicknessOffer(editor)).toBe(false);
		expect(thicknessOffer(editor)).toBe(null);
	});

	it('belongs to its font: another font open never shows it', () => {
		const editor = sketchedEditor({ letters: FIVE });
		commitThickness(editor, 150);
		noteThicknessOffer(editor);
		const other = sketchedEditor({ letters: FIVE });
		expect(thicknessOffer(other)).toBe(null);
	});
});

describe('[Use on all]', () => {
	it('re-inks every letter at another thickness, in chunks, as ONE whole-font step', async () => {
		const editor = sketchedEditor({ letters: FIVE });
		commitThickness(editor, 150);
		const steps = editor.history.queue.length;
		const queue = frames();
		let pillSeen = false;
		const watching = vi.fn(() => {
			pillSeen ||= !!document.querySelector('[data-anyink-pill="rebuilding"]');
		});
		const timer = setInterval(watching, 0);
		const done = await useThicknessOnAll(editor, { chunk: 2, frame: queue.frame });
		clearInterval(timer);
		expect(done).toBe(true);
		// 4 letters differ: 2 chunks of 2, one frame between them
		expect(queue.count()).toBe(1);
		expect(pillSeen).toBe(true);
		expect(document.querySelector('[data-anyink-pill="rebuilding"]')).toBeNull();
		for (const id of Object.keys(FIVE)) {
			const item = editor.project.getItem(id);
			expect(sketchOf(item).thickness, id).toBe(150);
			expect(builtMatches(item), id).toBe(true);
			expect(stemWidth(item), id).toBeGreaterThan(147);
			expect(stemWidth(item), id).toBeLessThan(155);
		}
		expect(editor.project.settings.anyink.sketchThickness).toBe(150);
		// a whole-font step is a pre / post pair
		expect(editor.history.queue.length).toBe(steps + 2);
		expect(editor.history.queue[1].title).toBe('set the thickness for every sketched letter');
		expect(editor.history.queue[0].wholeProjectSave).toBe(true);
		expect(isRebuildingAll()).toBe(false);
	});

	it('one Undo takes every letter back', async () => {
		const editor = sketchedEditor({ letters: FIVE });
		commitThickness(editor, 150);
		const before = Object.fromEntries(
			Object.keys(FIVE).map((id) => [id, JSON.stringify(editor.project.getItem(id).save())])
		);
		await useThicknessOnAll(editor, { frame: frames().frame });
		editor.history.restoreState();
		for (const id of Object.keys(FIVE)) {
			expect(JSON.stringify(editor.project.getItem(id).save()), id).toBe(before[id]);
		}
	});

	it('a letter whose ink was changed behind its sketch keeps its thickness and its ink', async () => {
		const editor = sketchedEditor({ letters: FIVE });
		const r = editor.project.getItem(R_ID);
		builtShapes(r)[0].pathPoints[0].p.x += 40;
		const edited = JSON.stringify(r.save());
		await useThicknessOnAll(editor, { value: 150, frame: frames().frame });
		expect(sketchOf(r).thickness).toBe(140);
		expect(JSON.stringify(r.save())).toBe(edited);
		expect(sketchOf(editor.project.getItem(A_ID)).thickness).toBe(150);
	});

	it('a second press while it runs does nothing; nothing to change is no step', async () => {
		const editor = sketchedEditor({ letters: FIVE });
		const steps = editor.history.queue.length;
		const first = useThicknessOnAll(editor, { value: 150, chunk: 1, frame: frames().frame });
		expect(isRebuildingAll()).toBe(true);
		expect(await useThicknessOnAll(editor, { value: 150 })).toBe(false);
		await first;
		expect(editor.history.queue.length).toBe(steps + 2);
		expect(await useThicknessOnAll(editor, { value: 150 })).toBe(false);
		expect(editor.history.queue.length).toBe(steps + 2);
	});

	it("defaults to the open letter's thickness and leaves letters with no sketch alone", async () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 130, [R_ID]: 99 }, open: N_ID });
		const u = JSON.stringify(editor.project.getItem(U_ID).save());
		await useThicknessOnAll(editor, { frame: frames().frame });
		expect(sketchOf(editor.project.getItem(R_ID)).thickness).toBe(130);
		expect(JSON.stringify(editor.project.getItem(U_ID).save())).toBe(u);
	});

	it(`re-inks ${CHUNK} letters a frame by default; the pill only when it takes frames`, async () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99, [R_ID]: 140 } });
		const queue = frames();
		let pill = false;
		const timer = setInterval(() => {
			pill ||= !!document.querySelector('.anyink-sketch-rebuilding');
		}, 0);
		await useThicknessOnAll(editor, { value: 150, frame: queue.frame });
		clearInterval(timer);
		expect(queue.count()).toBe(0);
		expect(pill).toBe(false);
	});
});

// S3 fix (thickness-card; critic interleave.probe.test.js): the pre-state was pushed first and the
// letters re-inked over several frames with nothing holding off other steps, so a step made
// meanwhile landed inside the whole-font step: [post, his step, pre]. His first Undo did nothing he
// could see, the second left letters at a mix of thicknesses and stranded the pre-state. Now the
// new ink is built first (pure, a few letters a frame) and the step is pre, swap, post in one task.
describe('[Use on all] while other things happen', () => {
	const titles = (editor) => editor.history.queue.map((entry) => entry.title);
	const thicknesses = (editor) =>
		Object.keys(FIVE).map((id) => sketchOf(editor.project.getItem(id)).thickness);

	it('a step made while it runs comes before it: Undo takes back one, then the other', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const editor = sketchedEditor({ letters: FIVE });
		const before = thicknesses(editor);
		const run = useThicknessOnAll(editor, { value: 160, chunk: 1, frame: frames().frame });
		await new Promise((resolve) => setTimeout(resolve, 0));
		const n = editor.selectedItem;
		const free = Object.keys(sketchOf(n).points).find((id) => !sketchOf(n).points[id].on);
		const x0 = sketchOf(n).points[free].x;
		sketchOf(n).points[free] = { ...sketchOf(n).points[free], x: x0 + 30 };
		editor.history.addState('moved a point mid run');
		expect(await run).toBe(true);
		// the whole-font step is whole, and newest
		const queue = titles(editor);
		expect(queue[1]).toBe('set the thickness for every sketched letter');
		expect(queue[2]).toBe('moved a point mid run');
		expect(thicknesses(editor).every((value) => value === 160)).toBe(true);
		expect(sketchOf(editor.selectedItem).points[free].x).toBe(x0 + 30);
		// Undo 1: every letter back to its thickness, his point still moved
		editor.history.restoreState();
		expect(thicknesses(editor)).toEqual(before);
		expect(sketchOf(editor.selectedItem).points[free].x).toBe(x0 + 30);
		// Undo 2: his point back; nothing of the thickness step is left in the list
		editor.history.restoreState();
		expect(sketchOf(editor.selectedItem).points[free].x).toBe(x0);
		expect(thicknesses(editor)).toEqual(before);
		expect(titles(editor)).not.toContain('set the thickness for every sketched letter');
		vi.restoreAllMocks();
	});

	it('an Undo while it runs stops it: no step, every letter as it was', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const editor = sketchedEditor({ letters: FIVE });
		editor.history.addState('a real step before');
		const before = thicknesses(editor);
		const run = useThicknessOnAll(editor, { value: 160, chunk: 1, frame: frames().frame });
		await new Promise((resolve) => setTimeout(resolve, 0));
		editor.history.restoreState();
		const after = titles(editor);
		expect(await run).toBe(false);
		expect(titles(editor)).toEqual(after);
		expect(thicknesses(editor)).toEqual(before);
		expect(isRebuildingAll()).toBe(false);
		expect(document.querySelector('[data-anyink-pill="rebuilding"]')).toBeNull();
		vi.restoreAllMocks();
	});
});
