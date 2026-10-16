// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration: the Next line's rule 25 on real built letters, end to end. The slider's step
	on small n (thickness.js commitThickness, then thickness_all.js noteThicknessOffer, as the drag
	does on release) makes the offer; deriveEditorState hands it to the rules; [Use on all] (the
	coach action 'sketchUseOnAll', sketch_actions.js) re-inks every sketched letter as ONE step;
	[Just this one] drops the offer. [Looks good] (rule 24) marks the work file behind.
	Written to fail first: before the integration no handler answered 'sketchUseOnAll' (rule 25
	never showed), and rule 25 read the font's thickness instead of the slider's offer.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { getDirtyGeneration } from '../../recovery/recovery.js';
import { sketchOf } from '../../sketch/model.js';
import { commitThickness } from '../../sketch/thickness.js';
import {
	noteThicknessOffer,
	resetThicknessAllForTests,
	thicknessOffer,
} from '../../sketch/thickness_all.js';
import {
	A_ID,
	N_ID,
	O_ID,
	R_ID,
	sketchedEditor,
	stemWidth,
} from '../../sketch/tests/thickness_fixture.js';
import { hasCoachAction, resetCoachActionsForTests, runCoachAction } from '../actions.js';
import { deriveEditorState } from '../font_facts.js';
import { pickLine } from '../rules.js';
import { installSketchCoach, resetSketchCoachForTests } from '../sketch_actions.js';

const FLAGS = ['coach', 'letterView', 'sketch', 'brush', 'board', 'checks'];
const on = (flag) => FLAGS.includes(flag);
/** The Next line as the coach picks it (coach_state.js adds the flags to the state) */
const line = (editor) =>
	pickLine({
		flags: Object.fromEntries(FLAGS.map((flag) => [flag, true])),
		...deriveEditorState(editor, { isOn: on }),
	});

beforeEach(() => {
	setModeForTests('simple');
	setFeaturesForTests({ sketch: true });
	resetThicknessAllForTests();
	resetSketchCoachForTests();
	installSketchCoach({ isOn: () => true });
});
afterEach(() => {
	resetSketchCoachForTests();
	resetCoachActionsForTests();
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('rule 25 on real letters', () => {
	it('the slider step on n asks "on all 4"; [Use on all] makes every letter 160 as one step', async () => {
		const editor = sketchedEditor({
			letters: { [N_ID]: 99, [A_ID]: 120, [O_ID]: 99, [R_ID]: 140 },
			fontThickness: 99,
		});
		expect(hasCoachAction('sketchUseOnAll')).toBe(true);
		expect(line(editor).rule).not.toBe(25);
		expect(commitThickness(editor, 160)).toBeTruthy();
		expect(noteThicknessOffer(editor)).toBe(true);
		const ask = line(editor);
		expect(ask).toMatchObject({ rule: 25, action: 'sketchUseOnAll', args: { thickness: 160 } });
		expect(ask.sentence).toMatch(/4/);
		const steps = editor.history.queue.filter((entry) => !/^_/.test(entry.title)).length;
		const frame = vi.fn((fn) => setTimeout(fn, 0));
		globalThis.requestAnimationFrame = frame;
		runCoachAction(ask.action, ask.args, { editor });
		await vi.waitFor(() => expect(sketchOf(editor.project.getItem(R_ID)).thickness).toBe(160));
		// a whole-font step is History's pre / post pair: one step he sees
		const seen = () => editor.history.queue.filter((entry) => !/^_/.test(entry.title));
		await vi.waitFor(() => expect(seen().length).toBe(steps + 1));
		expect(seen()[0].title).toBe('set the thickness for every sketched letter');
		for (const id of [N_ID, A_ID, O_ID, R_ID]) {
			expect(sketchOf(editor.project.getItem(id)).thickness).toBe(160);
			expect(Math.abs(stemWidth(editor.project.getItem(id)) - 160)).toBeLessThanOrEqual(3);
		}
		expect(thicknessOffer(editor)).toBeNull();
		expect(line(editor).rule).not.toBe(25);
	});

	it('[Just this one] drops the offer; the next slider step asks again', () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99, [A_ID]: 120 }, fontThickness: 99 });
		commitThickness(editor, 150);
		noteThicknessOffer(editor);
		expect(line(editor).rule).toBe(25);
		runCoachAction('sketchJustThisOne', null, { editor });
		expect(thicknessOffer(editor)).toBeNull();
		expect(line(editor).rule).not.toBe(25);
		commitThickness(editor, 170);
		noteThicknessOffer(editor);
		expect(line(editor).rule).toBe(25);
	});

	it('any later step ends the offer (it speaks only for the newest change)', () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99, [A_ID]: 120 }, fontThickness: 99 });
		commitThickness(editor, 150);
		noteThicknessOffer(editor);
		expect(line(editor).rule).toBe(25);
		editor.history.addState('moved a sketch point on small n');
		expect(line(editor).rule).not.toBe(25);
	});

	it("[Looks good] (rule 24) stores the font's thickness and marks the work file behind", () => {
		const editor = sketchedEditor({ letters: { [N_ID]: 99 } });
		expect(line(editor).rule).toBe(24);
		const before = getDirtyGeneration();
		runCoachAction('sketchThicknessOk', { thickness: 99 }, { editor });
		expect(editor.project.settings.anyink.sketchThickness).toBe(99);
		expect(getDirtyGeneration()).toBeGreaterThan(before);
		expect(line(editor).rule).not.toBe(24);
	});
});
