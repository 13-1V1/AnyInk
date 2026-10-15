// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import {
	findLineAt,
	guidesLayerState,
	handleGuidesLayerEvent,
	nudgeLine,
} from '../guides_layer.js';
import { LIVE_LABELS, METRIC_LABELS } from '../metrics_math.js';
import { word } from '../../words/words.js';
import { currentLineValue, labelText } from '../overlay.js';
import { resetGuidesLayerState } from '../state.js';

// The sample font: ascent 800, capHeight 790, xHeight 580, descent -200; glyph A advance 530.
const view = { dx: 100, dy: 500, dz: 0.5 };
const yOf = (em) => view.dy - em * view.dz;
const xOf = (em) => view.dx + em * view.dz;

function makeEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedTool = 'resize';
	Object.assign(editor.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
		leftSide: true,
		rightSide: true,
	});
	editor.view = { ...view };
	editor.history = {
		titles: [],
		addSettingsState(title) {
			this.titles.push(title);
		},
		addState(title) {
			this.titles.push(title);
		},
		addWholeProjectChangePreState(title) {
			this.titles.push(`pre:${title}`);
		},
		addWholeProjectChangePostState() {
			this.titles.push('post');
		},
	};
	editor.published = [];
	editor.publish = (topic, data) => editor.published.push({ topic, data });
	return editor;
}

function mouse(type, x, y, extra = {}) {
	return { type, offsetX: x, offsetY: y, buttons: type === 'mouseup' ? 0 : extra.down ? 1 : 0, shiftKey: !!extra.shift };
}

describe('hover', () => {
	let editor;
	beforeEach(() => {
		resetGuidesLayerState();
		editor = makeEditor();
	});

	it('finds the x-height line and publishes editCanvasView once per hover change', () => {
		expect(handleGuidesLayerEvent(mouse('mousemove', 300, yOf(580)))).toBe(true);
		expect(guidesLayerState.hover).toBe('xHeight');
		expect(document.body.style.cursor).toBe('ns-resize');
		expect(editor.published.filter((p) => p.topic === 'editCanvasView')).toHaveLength(1);

		// Same line, a little along it: no new publish, still swallowed
		expect(handleGuidesLayerEvent(mouse('mousemove', 320, yOf(580) + 2))).toBe(true);
		expect(editor.published.filter((p) => p.topic === 'editCanvasView')).toHaveLength(1);

		// Off the line: hover clears, event goes to the tool
		expect(handleGuidesLayerEvent(mouse('mousemove', 320, yOf(580) + 40))).toBe(false);
		expect(guidesLayerState.hover).toBe(false);
		expect(editor.published.filter((p) => p.topic === 'editCanvasView')).toHaveLength(2);
	});

	it('uses an ew-resize cursor on vertical lines', () => {
		handleGuidesLayerEvent(mouse('mousemove', xOf(530), 300));
		expect(guidesLayerState.hover).toBe('rsb');
		expect(document.body.style.cursor).toBe('ew-resize');
	});

	it('leaves a tool drag alone while the button is held', () => {
		expect(handleGuidesLayerEvent(mouse('mousemove', 300, yOf(580), { down: true }))).toBe(false);
		expect(guidesLayerState.hover).toBe(false);
	});

	it('does nothing off the edit canvas pages', () => {
		editor.nav.page = 'Settings';
		expect(handleGuidesLayerEvent(mouse('mousemove', 300, yOf(580)))).toBe(false);
	});

	it('gives the pen tool priority over a point sitting on the line', () => {
		const glyph = editor.selectedItem;
		const point = glyph.shapes[0].pathPoints[0];
		point.p.x = 200;
		point.p.y = 580;
		editor.selectedTool = 'pathEdit';
		expect(findLineAt(editor, { x: xOf(200), y: yOf(580) })).toBe(false);
		expect(findLineAt(editor, { x: xOf(400), y: yOf(580) }).id).toBe('xHeight');
		editor.selectedTool = 'resize';
		expect(findLineAt(editor, { x: xOf(200), y: yOf(580) }).id).toBe('xHeight');
	});
});

describe('metric drag', () => {
	let editor;
	beforeEach(() => {
		resetGuidesLayerState();
		editor = makeEditor();
	});

	it('writes per tick, publishes fontMetrics, and commits one history entry on release', () => {
		const font = editor.project.settings.font;
		expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(580)))).toBe(true);
		expect(guidesLayerState.dragging).toBe('xHeight');

		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(600), { down: true }));
		expect(font.xHeight).toBe(600);
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(620), { down: true }));
		expect(font.xHeight).toBe(620);
		const metricPublishes = editor.published.filter((p) => p.topic === 'fontMetrics');
		expect(metricPublishes).toHaveLength(2);
		expect(editor.published.some((p) => p.topic === 'currentItem')).toBe(false);
		expect(editor.history.titles).toEqual([]);

		expect(handleGuidesLayerEvent(mouse('mouseup', 300, yOf(620)))).toBe(true);
		expect(guidesLayerState.dragging).toBe(false);
		expect(editor.history.titles).toEqual([`Moved ${METRIC_LABELS.xHeight} to 620`]);
		expect(guidesLayerState.hover).toBe('xHeight');
	});

	it('snaps to 10 with Shift and clamps to the neighbors', () => {
		const font = editor.project.settings.font;
		handleGuidesLayerEvent(mouse('mousedown', 300, yOf(580)));
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(594), { down: true, shift: true }));
		expect(font.xHeight).toBe(590);
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(1200), { down: true }));
		expect(font.xHeight).toBe(790); // capHeight
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(1200)));
		expect(editor.history.titles).toEqual([`Moved ${METRIC_LABELS.xHeight} to 790`]);
	});

	it('pushes nothing when the value did not change', () => {
		handleGuidesLayerEvent(mouse('mousedown', 300, yOf(580)));
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(580.2), { down: true }));
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(580.2)));
		expect(editor.history.titles).toEqual([]);
		expect(editor.published.filter((p) => p.topic === 'fontMetrics')).toHaveLength(0);
	});
});

describe('custom guide drag', () => {
	it('moves the guide and publishes guides', () => {
		resetGuidesLayerState();
		const editor = makeEditor();
		const guide = editor.project.settings.app.guides.custom[0];
		guide.angle = 90;
		guide.location = 300;
		handleGuidesLayerEvent(mouse('mousedown', 300, yOf(300)));
		expect(guidesLayerState.dragging).toBe('guide:0');
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(345), { down: true }));
		expect(guide.location).toBe(345);
		expect(editor.published.filter((p) => p.topic === 'guides')).toHaveLength(1);
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(345)));
		expect(editor.history.titles).toEqual(['Moved Test guide to 345']);
	});
});

describe('side bearing drag', () => {
	it('moves the left side bearing and shifts the view so the glyph stays put', () => {
		resetGuidesLayerState();
		const editor = makeEditor();
		const glyph = editor.selectedItem;
		const lsb = glyph.leftSideBearing;
		const advance = glyph.advanceWidth;
		handleGuidesLayerEvent(mouse('mousedown', xOf(0), 300));
		expect(guidesLayerState.dragging).toBe('lsb');
		// 20 px right = 40 Em right: the line moves right, so the LSB shrinks by 40
		handleGuidesLayerEvent(mouse('mousemove', xOf(0) + 20, 300, { down: true }));
		expect(glyph.leftSideBearing).toBe(Math.round(lsb) - 40);
		expect(glyph.advanceWidth).toBe(advance - 40 + (Math.round(lsb) - lsb));
		expect(editor.view.dx).toBeCloseTo(100 + 20, 5);
		expect(editor.published.some((p) => p.topic === 'currentItem')).toBe(false);
		expect(editor.published.some((p) => p.topic === 'editCanvasView')).toBe(true);

		handleGuidesLayerEvent(mouse('mouseup', xOf(0) + 20, 300));
		expect(editor.history.titles).toEqual(['Updated left side bearing.']);
		expect(editor.published.some((p) => p.topic === 'currentItem')).toBe(true);
	});

	it('moves the right side bearing', () => {
		resetGuidesLayerState();
		const editor = makeEditor();
		const glyph = editor.selectedItem;
		const rsb = glyph.rightSideBearing;
		handleGuidesLayerEvent(mouse('mousedown', xOf(530), 300));
		expect(guidesLayerState.dragging).toBe('rsb');
		handleGuidesLayerEvent(mouse('mousemove', xOf(530) + 10, 300, { down: true, shift: true }));
		expect(glyph.rightSideBearing).toBe(Math.round((rsb + 20) / 10) * 10);
		handleGuidesLayerEvent(mouse('mouseup', xOf(530) + 10, 300));
		expect(editor.history.titles).toEqual(['Updated right side bearing.']);
	});
});

describe('baseline drag (D-009)', () => {
	it('only tracks the delta during the drag, then applies one whole-project change', () => {
		resetGuidesLayerState();
		const editor = makeEditor();
		const font = editor.project.settings.font;
		const glyph = editor.selectedItem;
		const pointY = glyph.shapes[0].pathPoints[0].p.y;

		handleGuidesLayerEvent(mouse('mousedown', 300, yOf(0)));
		expect(guidesLayerState.dragging).toBe('baseline');
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(40), { down: true }));
		expect(guidesLayerState.baselineDelta).toBe(40);
		expect(glyph.shapes[0].pathPoints[0].p.y).toBe(pointY); // nothing moved yet
		expect(font.ascent).toBe(800);
		expect(labelText(guidesLayerState.line, 40, glyph, guidesLayerState)).toBe(
			word('canvas.readout', { label: LIVE_LABELS.baseline, value: '+40' })
		);
		expect(currentLineValue(guidesLayerState.line, glyph, font, guidesLayerState)).toBe(40);

		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(40)));
		expect(glyph.shapes[0].pathPoints[0].p.y).toBe(pointY - 40);
		expect(font.ascent).toBe(760);
		expect(font.descent).toBe(-240);
		expect(editor.history.titles).toEqual(['pre:Moved baseline', 'post']);
		expect(guidesLayerState.baselineDelta).toBe(0);
	});
});

describe('keyboard nudge', () => {
	it('moves the hovered line by 1, or 10 with Shift, and skips focused inputs', () => {
		resetGuidesLayerState();
		const editor = makeEditor();
		const font = editor.project.settings.font;
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(580)));
		expect(guidesLayerState.hover).toBe('xHeight');

		const up = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
		document.dispatchEvent(up);
		expect(font.xHeight).toBe(581);
		expect(up.defaultPrevented).toBe(true);
		expect(editor.history.titles).toEqual([`Moved ${METRIC_LABELS.xHeight} to 581`]);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
		expect(font.xHeight).toBe(571);

		// Left / right do nothing to a horizontal line
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(font.xHeight).toBe(571);

		// A focused input keeps its arrows
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		expect(font.xHeight).toBe(571);
		input.remove();
	});

	it('nudges vertical lines with left and right', () => {
		resetGuidesLayerState();
		const editor = makeEditor();
		const glyph = editor.selectedItem;
		const rsb = glyph.rightSideBearing;
		const line = findLineAt(editor, { x: xOf(530), y: 300 });
		expect(line.id).toBe('rsb');
		nudgeLine(editor, line, 10);
		expect(glyph.rightSideBearing).toBe(rsb + 10);
		expect(editor.history.titles).toEqual(['Updated right side bearing.']);
	});
});
