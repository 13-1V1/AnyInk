// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 (UX-BEGINNER.md 2.2, 2.4 B, 4.3): the edit canvas labels its guide lines in house words, in
// both modes: top line, capitals line, small-letter line, writing line, tail line, and the
// letter's left and right edges. Words from src/anyink/words; a custom guide keeps the name it
// was given.
// B4 + B5 fix pass (critic finding "Pointing at the left edge draws two labels: 'Left space 0' and
// 'left space 0'"; D-035: the readout replaces the edge's own label): pointing at or dragging an
// edge draws one label, the drag readout by the pointer ("left space 0", metrics/overlay.js), and
// nothing at the top of the edge.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setModeForTests } from '../../mode/mode.js';
import { findBanned } from '../../words/banned.js';
import { labelCase, word } from '../../words/words.js';
import { collectGuideLines } from '../hit_test.js';
import { guidesLayerState, resetGuidesLayerState } from '../state.js';

/** The simple example font, Capital A open, every system guide on. */
function letterEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedGlyph;
	editor.selectedTool = 'resize';
	editor.view = { dx: 300, dy: 700, dz: 0.25 };
	Object.assign(editor.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
		leftSide: true,
		rightSide: true,
	});
	return editor;
}

/** Every string the edit canvas draws in one redraw. */
function drawnTexts(editor) {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	const ctx = canvas.getContext('2d');
	const texts = [];
	const fillText = ctx.fillText.bind(ctx);
	ctx.fillText = (text, ...rest) => {
		texts.push(String(text));
		return fillText(text, ...rest);
	};
	const host = { ctx, width: 1200, height: 1000, editingItemID: editor.selectedItemID };
	EditCanvas.prototype.redraw.call(host, 'test');
	return texts;
}

beforeEach(() => {
	resetGuidesLayerState();
	vi.stubGlobal('requestAnimationFrame', (callback) => callback()); // draw now, not next frame
});
afterEach(() => {
	vi.unstubAllGlobals();
	resetGuidesLayerState();
	setModeForTests('all');
});

describe('edit canvas guide labels', () => {
	['all', 'simple'].forEach((mode) => {
		it(`names the five lines and the two edges in house words (${mode})`, () => {
			setModeForTests(mode);
			const editor = letterEditor();
			editor.project.settings.app.guides.systemShowLabels = true;
			const texts = drawnTexts(editor);
			const expected = [
				labelCase(word('line.capHeight')),
				labelCase(word('line.ascent')),
				labelCase(word('line.xHeight')),
				labelCase(word('line.descent')),
				labelCase(word('line.baseline')),
				labelCase(word('canvas.leftEdge')),
				labelCase(word('canvas.rightEdge')),
			];
			expect(texts).toEqual(expect.arrayContaining(expected));
			expect(expected).toEqual([
				'Capitals line',
				'Top line',
				'Small-letter line',
				'Tail line',
				'Writing line',
				'Left edge',
				'Right edge',
			]);
			expect(texts.flatMap((text) => findBanned(text).map((hit) => hit.match))).toEqual([]);
		});
	});

	/** Points at a side edge the way the guides layer does (hover, the line, the pointer). */
	function pointAt(editor, side, dragging = false) {
		const { font, app } = editor.project.settings;
		const lines = collectGuideLines({
			font,
			systemGuides: editor.systemGuides,
			guides: app.guides,
			item: editor.selectedItem,
		});
		const line = lines.find((l) => l.id === side);
		Object.assign(guidesLayerState, {
			hover: side,
			line,
			dragging: dragging ? side : false,
			pointer: { x: 400, y: 300 },
		});
	}

	const spaceTexts = (texts) => texts.filter((text) => /space/i.test(text));

	['all', 'simple'].forEach((mode) => {
		it(`pointing at a side edge draws one label: the readout by the pointer (${mode})`, () => {
			setModeForTests(mode);
			const editor = letterEditor();
			editor.project.settings.app.guides.systemShowLabels = false;
			const item = editor.selectedItem;
			const value = (n) => Math.round(n * 100) / 100;
			const readout = (key, n) =>
				word('canvas.readout', { label: word(key), value: String(value(n)) });
			pointAt(editor, 'lsb');
			expect(spaceTexts(drawnTexts(editor))).toEqual([readout('space.lsb', item.leftSideBearing)]);
			pointAt(editor, 'rsb');
			expect(spaceTexts(drawnTexts(editor))).toEqual([readout('space.rsb', item.rightSideBearing)]);
			pointAt(editor, 'lsb', true);
			expect(spaceTexts(drawnTexts(editor))).toEqual([readout('space.lsb', item.leftSideBearing)]);
		});
	});

	it('with the labels on, a pointed-at edge loses its own label; the other edge keeps its name', () => {
		const editor = letterEditor();
		editor.project.settings.app.guides.systemShowLabels = true;
		pointAt(editor, 'lsb');
		const texts = drawnTexts(editor);
		expect(spaceTexts(texts)).toHaveLength(1);
		expect(spaceTexts(texts)[0]).toMatch(/^left space -?\d/);
		expect(texts).not.toContain(labelCase(word('canvas.leftEdge')));
		expect(texts).toContain(labelCase(word('canvas.rightEdge')));
	});

	it('with the line labels off, only a custom guide shows: by the name it was given', () => {
		const editor = letterEditor();
		const guides = editor.project.settings.app.guides;
		guides.systemShowLabels = false;
		const named = (guides.custom || []).filter((g) => g.visible).map((g) => g.name);
		expect(named.length).toBeGreaterThan(0); // the sample has one ("Test guide")
		expect(drawnTexts(editor)).toEqual(guides.customShowLabels ? named : []);
	});
});
