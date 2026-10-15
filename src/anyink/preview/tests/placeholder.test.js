// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic finding "Empty preview says 'Type something to see your letters here.'
// while text is already typed"): the empty sheet's sentence fits what is on it, in both modes
// (the strip and the Overview share it). An empty text field asks for text; text whose letters
// aren't made yet says they show as he makes them; and when the letters that are made sit past
// the sheet's edge (a big type size), the sheet still says something instead of staying blank.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { startCanvasSpy } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { placeholderKey } from '../placeholder.js';

const made = { item: { shapes: [{}] } };
const notMade = { item: false };
const empty = { item: { shapes: [] } };
const block = (...rows) => ({ data: [rows] });
const on = (charData) => ({ ...charData, isVisible: true });
const off = (charData) => ({ ...charData, isVisible: false });

describe('placeholderKey', () => {
	it('an empty or blank text field: "Type something..."', () => {
		expect(placeholderKey('', block())).toBe('strip.nothingToShow');
		expect(placeholderKey('   ', block(on(notMade)))).toBe('strip.nothingToShow');
		expect(word('strip.nothingToShow')).toBe('Type something to see your letters here.');
	});

	it('text whose letters are not made yet: they show as he makes them', () => {
		expect(placeholderKey('the five boxing wizards', block(on(notMade), on(empty)))).toBe(
			'strip.lettersNotMade'
		);
		expect(word('strip.lettersNotMade')).toBe('Your letters show here as you make them.');
	});

	it('made letters only past the edge of the sheet: still says so, never a blank sheet', () => {
		expect(placeholderKey('the five a', block(on(notMade), off(made)))).toBe(
			'strip.lettersNotMade'
		);
	});

	it('a made letter on the sheet: no sentence', () => {
		expect(placeholderKey('ab', block(on(made), on(notMade)))).toBe('');
	});

	it('no layout yet: nothing to judge', () => {
		expect(placeholderKey('ab', null)).toBe('strip.lettersNotMade');
		expect(placeholderKey('', undefined)).toBe('strip.nothingToShow');
	});
});

describe('the display canvas draws the sentence that fits', () => {
	beforeAll(() => {
		if (!customElements.get('display-canvas'))
			customElements.define('display-canvas', DisplayCanvas);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	function drawn(text) {
		const editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
		const spy = startCanvasSpy();
		try {
			const canvas = new DisplayCanvas({
				text,
				fontSize: 48,
				pagePadding: 10,
				pageWidth: 'fit',
				pageHeight: 'fit',
				showPlaceholderMessage: true,
			});
			document.body.appendChild(canvas);
			canvas.redraw();
			return [...new Set(spy.texts)];
		} finally {
			spy.stop();
		}
	}

	it('letters not made yet: "Your letters show here as you make them."', () => {
		expect(drawn('xyz')).toContain(word('strip.lettersNotMade'));
		expect(drawn('xyz')).not.toContain(word('strip.nothingToShow'));
	});

	it('nothing typed: "Type something to see your letters here."', () => {
		expect(drawn('')).toEqual([word('strip.nothingToShow')]);
	});

	it('made letters: no sentence', () => {
		const texts = drawn('ABC');
		expect(texts).not.toContain(word('strip.lettersNotMade'));
		expect(texts).not.toContain(word('strip.nothingToShow'));
	});
});
