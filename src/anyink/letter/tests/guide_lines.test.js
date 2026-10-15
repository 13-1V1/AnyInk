// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 letter view, the canvas side (UX-BEGINNER.md 4.3 Canvas, 7.1 #3): in Simple, with the letter
// view on, the five guide lines span the whole canvas, each labeled at the left in house words,
// the writing line drawn heavier; labels never sit on top of each other. All tools, and Simple
// before the letter view's flag is on, draw the lines exactly as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { resetGuidesLayerState } from '../../metrics/state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { labelCase, word } from '../../words/words.js';
import {
	drawSimpleGuideLines,
	letterCanvasOn,
	placeLabels,
	simpleGuideLines,
} from '../guide_lines.js';

const FONT = Object.freeze({ upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 });
const VIEW = Object.freeze({ dx: 300, dy: 700, dz: 0.25 });
const WIDTH = 1200;
const HEIGHT = 1000;

beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (callback) => callback()); // draw now, not next frame
});
afterEach(() => {
	vi.unstubAllGlobals();
	resetGuidesLayerState();
});

function context() {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	return canvas.getContext('2d');
}

/** The simple example font in a real editor, Capital A open on the Characters page. */
function letterEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedGlyph;
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
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

/** Runs the real edit canvas redraw; returns its mock context. */
function redraw(editor) {
	const ctx = context();
	const host = { ctx, width: WIDTH, height: HEIGHT, editingItemID: editor.selectedItemID };
	EditCanvas.prototype.redraw.call(host, 'test');
	return ctx;
}

/** Every draw call and state change, without the object identities. */
const events = (ctx) => JSON.parse(JSON.stringify(ctx.__getEvents()));
const texts = (ctx) =>
	ctx
		.__getEvents()
		.filter((e) => e.type === 'fillText')
		.map((e) => e.props.text);

describe('which canvas draws the Simple lines', () => {
	it('only Simple with the letter view on', () => {
		expect(letterCanvasOn()).toBe(false);
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false }); // on in the app since B7
		expect(letterCanvasOn()).toBe(false);
		setFeaturesForTests({ letterView: true });
		expect(letterCanvasOn()).toBe(true);
		setModeForTests('all');
		expect(letterCanvasOn()).toBe(false);
	});
});

describe('simpleGuideLines', () => {
	it('lists the five lines top to bottom in house words, the writing line heavier', () => {
		const lines = simpleGuideLines(FONT);
		expect(lines.map((line) => line.key)).toEqual([
			'ascent',
			'capHeight',
			'xHeight',
			'baseline',
			'descent',
		]);
		expect(lines.map((line) => line.text)).toEqual(
			['line.ascent', 'line.capHeight', 'line.xHeight', 'line.baseline', 'line.descent'].map(
				(key) => labelCase(word(key))
			)
		);
		expect(lines.map((line) => line.y)).toEqual([1550, 1480, 1100, 0, -440]);
		expect(lines.filter((line) => line.heavy).map((line) => line.key)).toEqual(['baseline']);
	});

	it('the tail line sits below the writing line however descent is stored', () => {
		const lines = simpleGuideLines({ ...FONT, descent: 440 });
		expect(lines.at(-1)).toMatchObject({ key: 'descent', y: -440 });
	});
});

describe('placeLabels', () => {
	it('puts every label above its own line, at the left, when there is room', () => {
		const lines = simpleGuideLines(FONT);
		const placed = placeLabels(lines, VIEW);
		expect(placed.map((label) => label.key)).toEqual(lines.map((line) => line.key));
		placed.forEach((label) => {
			const line = lines.find((l) => l.key === label.key);
			expect(label.x).toBeLessThan(20);
			expect(label.place).toBe('above');
			expect(label.y).toBeLessThan(VIEW.dy - line.y * VIEW.dz);
		});
	});

	it('never lets two labels overlap: a crowded label moves below its line or is left out', () => {
		const tight = { ...VIEW, dz: 0.05 }; // 70 units between the top and capitals lines = 3.5 px
		const lines = simpleGuideLines(FONT);
		const placed = placeLabels(lines, tight, { size: 12 });
		const boxes = placed.map((label) => ({ top: label.y - 12, bottom: label.y }));
		for (let i = 1; i < boxes.length; i++) {
			expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
		}
		expect(placed.length).toBeLessThan(lines.length);
		// the writing line always keeps its label: it is the one every letter sits on
		expect(placed.map((label) => label.key)).toContain('baseline');
	});
});

describe('drawSimpleGuideLines', () => {
	it('spans the whole canvas, the writing line thicker, and labels the five lines', () => {
		const ctx = context();
		drawSimpleGuideLines(ctx, VIEW, FONT, { width: WIDTH, alpha: 1, thickness: 1 });
		const rects = ctx.__getEvents().filter((e) => e.type === 'fillRect');
		const lineRects = rects.filter((e) => e.props.x === 0 && e.props.width === WIDTH);
		expect(lineRects).toHaveLength(5);
		const writing = lineRects.find((e) => Math.abs(e.props.y - VIEW.dy) <= 1);
		expect(writing.props.height).toBe(2);
		lineRects.filter((e) => e !== writing).forEach((e) => expect(e.props.height).toBe(1));
		expect(texts(ctx)).toEqual(simpleGuideLines(FONT).map((line) => line.text));
	});
});

describe('a view not fitted yet', () => {
	it('zoom 0 (the page drawn before the canvas has a size): nothing is drawn', () => {
		const ctx = context();
		drawSimpleGuideLines(ctx, { dx: 300, dy: 0, dz: 0 }, FONT, { width: WIDTH, height: HEIGHT });
		expect(ctx.__getEvents().filter((e) => e.type === 'fillRect' || e.type === 'fillText')).toEqual(
			[]
		);
	});
});

describe('the edit canvas', () => {
	it('Simple with the letter view: full-width labeled lines, no letter-width stubs', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		const editor = letterEditor();
		editor.project.settings.app.guides.systemShowLabels = false; // Simple labels them anyway
		const ctx = redraw(editor);
		const full = ctx
			.__getEvents()
			.filter((e) => e.type === 'fillRect' && e.props.x === 0 && e.props.width === WIDTH);
		expect(full.length).toBeGreaterThanOrEqual(5);
		expect(texts(ctx)).toEqual(expect.arrayContaining(simpleGuideLines(FONT).map((l) => l.text)));
	});

	it('All tools draws exactly what it drew before, letter view flag or not', () => {
		const editor = letterEditor();
		editor.project.settings.app.guides.systemShowLabels = true;
		const before = events(redraw(editor));
		setFeaturesForTests({ letterView: true });
		const after = events(redraw(editor));
		expect(after).toEqual(before);
		// and those lines are the letter-width ones with labels on a short leader, not Simple's
		expect(
			before.filter((e) => e.type === 'fillRect' && e.props.x === 0 && e.props.width === WIDTH)
		).toHaveLength(0);
	});

	it('Simple before the letter view lands draws what All tools draws', () => {
		const editor = letterEditor();
		editor.project.settings.app.guides.systemShowLabels = true;
		const all = events(redraw(editor));
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false }); // on in the app since B7
		const simple = events(redraw(editor));
		expect(simple).toEqual(all);
	});
});
