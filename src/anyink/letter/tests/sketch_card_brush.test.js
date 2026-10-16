// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix (thickness-card, critic 54-fine-tune.png): on a sketched letter the card showed
	"Thickness thin-thick" and right under it "Brush Size thin-thick" with nothing saying which one
	changes the letter he sees, and [Draw over it] started freehand ink on top of the sketch.
	Now, in Simple with the sketch on, a sketched letter's card has no [Draw over it] (S4 brings
	[Edit sketch], SKETCH.md 7; until then plain Select would only set the sketch aside), and the
	Brush's slider says it is the size of new Brush strokes. With the flag off nothing changes.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { N_ID, sketchedEditor } from '../../sketch/tests/thickness_fixture.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word, wordEntry } from '../../words/words.js';
import { letterCardState, mainButtons, makeLetterCard } from '../letter_card.js';
import { resetLetterViewForTests } from '../view_switches.js';

function open({ sketch = true, tool = 'nib' } = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, brush: true, sketch });
	const editor = sketchedEditor({ letters: { [N_ID]: 99 } });
	editor.selectedTool = tool;
	return editor;
}

function card(editor) {
	const element = makeLetterCard(editor);
	document.body.replaceChildren(element);
	return element;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetLetterViewForTests();
});
afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('one thin / thick slider that says what it changes', () => {
	it('a sketched letter has no [Draw over it]', () => {
		const editor = open({ tool: 'resize' });
		const state = letterCardState(editor);
		expect(state.hasShapes).toBe(true);
		expect(mainButtons(state)).not.toContain('drawOver');
		const element = card(editor);
		expect(element.textContent).not.toContain(word('letter.action.drawOver'));
	});

	it('the Brush picked on a sketched letter: its slider names new Brush strokes', () => {
		const element = card(open({ tool: 'nib' }));
		const thickness = element.querySelector('[data-anyink-sketch="thickness"]');
		const brush = element.querySelector('[data-anyink-card="brush"]');
		expect(thickness).not.toBeNull();
		expect(brush).not.toBeNull();
		const label = brush.querySelector('.anyink-brush-size__label');
		expect(label.textContent).toBe(word('sketch.card.brushSize'));
		expect(label.textContent).not.toBe(word('brush.size.label'));
		expect(brush.querySelector('[data-anyink-brush="size"]').title).toBe(
			wordEntry('sketch.card.brushSize').hint
		);
		expect(brush.querySelector('input').getAttribute('aria-label')).toBe(
			word('sketch.card.brushSlider')
		);
	});

	scanSimpleScreen('a sketched letter with the Brush picked: Thickness and the Brush size', () =>
		card(open({ tool: 'nib' }))
	);

	it('the flag off: [Draw over it] and "Size" as before', () => {
		const editor = open({ sketch: false, tool: 'resize' });
		expect(mainButtons(letterCardState(editor))).toContain('drawOver');
		editor.selectedTool = 'nib';
		const element = card(editor);
		const label = element.querySelector('[data-anyink-card="brush"] .anyink-brush-size__label');
		expect(label.textContent).toBe(word('brush.size.label'));
	});

	it('a letter with no sketch keeps [Draw over it] with the sketch on', () => {
		const editor = open({ tool: 'resize' });
		const other = editor.project.getItem('glyph-0x61');
		other.shapes = editor.selectedItem.shapes.map((shape) => shape);
		editor.selectedGlyphID = 'glyph-0x61';
		expect(mainButtons(letterCardState(editor))).toContain('drawOver');
	});
});
