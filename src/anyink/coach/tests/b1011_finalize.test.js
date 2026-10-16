// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize: the Next line and the Brush, and "Something else" on a letter's look
// (UX-BEGINNER.md 4.0 rules 7, 9, 15; 4.2 filters). Written to fail first:
//   - the Brush on a letter with ink (picked, or the one the letter opened with): he may still be
//     drawing, so no rule gives that letter's check a green button (rule 15's outlined variant);
//   - the opening Brush counts as "no pick" only while the letter is empty;
//   - forgetLookSkips(char) ends a letter's look skips (board_page calls it on an amber tile and
//     on [Show me]);
//   - a filtered board whose every look is skipped stays on its letters (no green [Make W]).
import { afterEach, describe, expect, it } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { pickOpeningTool } from '../../nib/default_tool.js';
import { B, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { deriveEditorState } from '../font_facts.js';
import { makeCoach } from '../coach_state.js';
import { pickLine } from '../rules.js';
import { fakeState } from './fake_state.js';
import { FLOATS } from './rule_states.js';

const sinks = { ...FLOATS, id: 'offLine', reason: 'small n sinks below the writing line.' };

afterEach(() => setModeForTests('all'));

describe('the Brush on a letter with ink: no green button for its check', () => {
	it("rule 7 says the letter's problem with its fix outlined while the Brush is picked", () => {
		const brushing = pickLine(
			fakeState({ page: 'letter', current: 'n', needsLook: { n: sinks }, tool: 'nib' })
		);
		expect(brushing).toMatchObject({ rule: 7, button: 'Sit on the line', primary: false });
		// another tool: the green fix, as before
		const select = pickLine(
			fakeState({ page: 'letter', current: 'n', needsLook: { n: sinks }, tool: 'resize' })
		);
		expect(select).toMatchObject({ rule: 7, primary: true });
	});

	it('rule 9 in a letter view while brushing: [Show me] outlined', () => {
		const ready = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmopqrstuvwxyz.,\'?!-';
		const line = pickLine(
			fakeState({ ready, page: 'letter', current: 'a', needsLook: { n: sinks }, tool: 'nib' })
		);
		expect(line).toMatchObject({ rule: 9, primary: false });
	});

	it('the opening Brush on a letter that now has ink is the Brush (rule 15 outlined)', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		pickOpeningTool(editor, 'nib', (tool) => {
			editor.selectedTool = tool;
		});
		expect(deriveEditorState(editor).tool).toBe('');
		traceInto(editor);
		const state = deriveEditorState(editor);
		expect(state.tool).toBe('nib');
		const line = pickLine({ ...state, flags: { ...state.flags } });
		if (line.rule === 15) expect(line.primary).toBe(false);
	});
});

describe('Something else on a look, and the filtered board', () => {
	it('every look skipped on a board filtered to Needs a look: rule 9 stays, no button', () => {
		const state = fakeState({
			ready: 'h',
			needsLook: { B: FLOATS, n: sinks },
			boardFilter: 'needsLook',
		});
		const skips = { 'needsLook:B:seat': FLOATS.reason, 'needsLook:n:offLine': sinks.reason };
		const line = pickLine({ ...state, skips });
		expect(line).toMatchObject({ rule: 9, sentence: '2 letters need a look.', button: '' });
		expect(line.primary).toBe(false);
	});

	it('forgetLookSkips(char) ends that letter\'s look skips; with no letter, all of them', () => {
		let state = fakeState({ needsLook: { B: FLOATS, n: sinks }, page: 'letter', current: 'B' });
		const coach = makeCoach({
			getEditor: () => null,
			deriveState: () => state,
			probe: () => ({ dialog: '', otherPrimary: false }),
			schedule: (fn) => fn(),
			listen: false,
		});
		expect(coach.line()).toMatchObject({ rule: 7, skipKey: 'needsLook:B:seat' });
		coach.skip();
		expect(coach.line().rule).not.toBe(7);
		coach.forgetLookSkips('n');
		expect(coach.line().rule).not.toBe(7);
		coach.forgetLookSkips('B');
		expect(coach.line()).toMatchObject({ rule: 7, skipKey: 'needsLook:B:seat' });
		coach.skip();
		state = fakeState({ needsLook: { B: FLOATS, n: sinks }, boardFilter: 'needsLook' });
		coach.refresh();
		coach.skip();
		coach.forgetLookSkips();
		expect(coach.line()).toMatchObject({ rule: 9, args: { char: 'B' } });
	});
});
