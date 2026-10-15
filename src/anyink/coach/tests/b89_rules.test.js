// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: what the Next line says about the Brush and photos (UX-BEGINNER.md 4.0).
	  rule 8      the Brush picked on an empty letter says what a drag does ("Drag on the paper to
	              draw. Each drag is one stroke."), as the other drawing tools do; the Brush a letter
	              opens with is no pick of his (font_facts gives no tool), so the line still offers the
	              photo and the brush
	  rule 3      step C with nothing to use (no ink, a failed trace): [Use it] is gone, so the line
	              names the card's green button ("Press Draw a box on the card.")
	  rule 12     counts the registry's way: a part he skipped, or one under a box he drew, is no
	              "more letters" (photo_registry.js photoSummaries)
*/
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setModeForTests } from '../../mode/mode.js';
import { pickOpeningTool } from '../../nib/default_tool.js';
import { addDrawnPart, addPhoto, getPhoto, skipPart, usePart } from '../../photo/photo_registry.js';
import { ROW } from '../../photo/tests/photo_dialog_fixture.js';
import { word } from '../../words/words.js';
import { deriveEditorState, photoRecords } from '../font_facts.js';
import { pickLine } from '../rules.js';
import { fakeState } from './fake_state.js';

describe('rule 8 and the Brush', () => {
	it('the Brush he picked on an empty letter: what a drag does, with no button', () => {
		const line = pickLine(fakeState({ page: 'letter', current: 'B', tool: 'nib' }));
		expect(line).toMatchObject({ rule: 8, sentence: word('brush.next.drag'), button: '' });
	});

	it('no tool picked (the Brush the letter opened with): the photo and the brush', () => {
		const line = pickLine(fakeState({ page: 'letter', current: 'B', tool: '' }));
		expect(line.sentence).toBe(word('coach.rule.emptyPhotoBrush', { letter: 'Capital B' }));
	});

	it('font_facts gives no tool for the opening Brush, and the Brush once he picks it', () => {
		setModeForTests('simple');
		const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x42';
		pickOpeningTool(editor, 'nib', (tool) => {
			editor.selectedTool = tool;
		});
		expect(deriveEditorState(editor).tool).toBe('');
		editor.selectedGlyphID = 'glyph-0x43';
		expect(deriveEditorState(editor).tool).toBe('nib');
		setModeForTests('all');
	});
});

describe('rule 3: step C with nothing to use', () => {
	const card = (fields) =>
		pickLine({ ...fakeState({ page: 'letter', current: 'r' }), photoCard: fields });

	it('a result to use: "Look right? Press Use it..."', () => {
		expect(card({ step: 'result', char: 'r', status: 'ready', green: 'action.useIt' })).toMatchObject(
			{ rule: 3, sentence: word('coach.rule.photoResult'), button: '' }
		);
		// a state that says no status (B6's own tests) keeps the sentence
		expect(card({ step: 'result', char: 'r' }).sentence).toBe(word('coach.rule.photoResult'));
	});

	it('no ink, or a failed trace: the card green button by name', () => {
		expect(
			card({ step: 'result', char: 'r', status: 'no-ink', green: 'photo.card.drawBox' }).sentence
		).toBe('Press Draw a box on the card.');
		expect(
			card({
				step: 'result',
				char: 'r',
				status: 'error',
				green: 'photoFlow.button.chooseAnother',
			}).sentence
		).toBe('Press Choose another photo on the card.');
		expect(
			card({ step: 'result', char: 'r', status: 'error', green: 'photo.card.cancel' }).sentence
		).toBe(`Press ${word('photo.card.cancel')} on the card.`);
	});
});

describe("rule 12 counts the registry's way", () => {
	it('a skipped part and the parts under a box he drew are no "more letters"', () => {
		const project = new GlyphrStudioProject();
		addPhoto(project, { asset: 'img-aaaa0001', width: 1500, height: 520, parts: ROW, paper: 'scan' });
		const record = getPhoto(project, 'img-aaaa0001');
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		skipPart(record, 'p2');
		const box = addDrawnPart(record, { left: 470, top: 90, right: 790, bottom: 270 });
		usePart(record, box.id, { char: 'm', itemId: 'glyph-0x6d' });
		// p3 (480..580) and p4 (670..770) sit under the box he drew and used
		expect(photoRecords(project)).toEqual([{ id: 'img-aaaa0001', unused: 3, done: false }]);
	});
});
