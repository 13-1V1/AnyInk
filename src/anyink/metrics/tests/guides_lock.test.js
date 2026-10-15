// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 7.6, section 10 B5 "horizontal lines locked and edges not"): in Simple
// the guides layer leaves the horizontal guide lines alone (kinds 'metric' and 'baseline') at its
// two gates, handleGuidesLayerEvent (hover and drag) and onKeyDown (arrow nudges): no hover, no
// drag, no nudge, and the press goes to the tool instead. The side edges ('sideBearing') and
// guides added in More tools stay draggable. All tools locks nothing.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setGuideLinesMoving } from '../../mode/locks.js';
import { setModeForTests } from '../../mode/mode.js';
import { findLineAt, guidesLayerState, handleGuidesLayerEvent } from '../guides_layer.js';
import { resetGuidesLayerState } from '../state.js';

// The sample font: ascent 800, capHeight 790, xHeight 580, descent -200; glyph A advance 530.
const view = { dx: 100, dy: 500, dz: 0.5 };
const yOf = (em) => view.dy - em * view.dz;
const xOf = (em) => view.dx + em * view.dz;

function makeEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
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
	editor.publish = () => {};
	return editor;
}

const mouse = (type, x, y, down = false) => ({
	type,
	offsetX: x,
	offsetY: y,
	buttons: type === 'mouseup' ? 0 : down ? 1 : 0,
	shiftKey: false,
});
const key = (name) => new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });

/** The horizontal lines: the four metric lines and the writing line, at x = 300 px */
const HORIZONTAL = { ascent: 800, capHeight: 790, xHeight: 580, baseline: 0, descent: -200 };

let editor;
let font;
beforeEach(() => {
	resetGuidesLayerState();
	editor = makeEditor();
	font = editor.project.settings.font;
});

describe('Simple: the horizontal lines are locked', () => {
	beforeEach(() => setModeForTests('simple'));

	it.each(Object.entries(HORIZONTAL))(
		'%s: no hover, no drag; the press goes to the tool',
		(id, em) => {
			expect(handleGuidesLayerEvent(mouse('mousemove', 300, yOf(em)))).toBe(false);
			expect(guidesLayerState.hover).toBe(false);
			expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(em)))).toBe(false);
			expect(guidesLayerState.dragging).toBe(false);
			expect(handleGuidesLayerEvent(mouse('mousemove', 300, yOf(em + 40), true))).toBe(false);
			expect(handleGuidesLayerEvent(mouse('mouseup', 300, yOf(em + 40)))).toBe(false);
			expect(font.ascent).toBe(800);
			expect(font.capHeight).toBe(790);
			expect(font.xHeight).toBe(580);
			expect(font.descent).toBe(-200);
			expect(editor.history.titles).toEqual([]);
		}
	);

	it('an arrow key never nudges one, even one picked up before Simple came on', () => {
		setModeForTests('all');
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(580)));
		expect(guidesLayerState.hover).toBe('xHeight');
		setModeForTests('simple');
		const up = key('ArrowUp');
		document.dispatchEvent(up);
		expect(font.xHeight).toBe(580);
		expect(up.defaultPrevented).toBe(false);
		expect(editor.history.titles).toEqual([]);
	});

	it('the right edge still drags, and still nudges with the arrows', () => {
		const glyph = editor.selectedItem;
		const rsb = glyph.rightSideBearing;
		expect(handleGuidesLayerEvent(mouse('mousedown', xOf(530), 300))).toBe(true);
		expect(guidesLayerState.dragging).toBe('rsb');
		handleGuidesLayerEvent(mouse('mousemove', xOf(530) + 10, 300, true));
		handleGuidesLayerEvent(mouse('mouseup', xOf(530) + 10, 300));
		expect(glyph.rightSideBearing).toBe(Math.round(rsb) + 20);
		expect(editor.history.titles).toEqual(['Updated right side bearing.']);

		handleGuidesLayerEvent(mouse('mousemove', xOf(glyph.advanceWidth), 300));
		expect(guidesLayerState.hover).toBe('rsb');
		document.dispatchEvent(key('ArrowRight'));
		expect(glyph.rightSideBearing).toBe(Math.round(rsb) + 21);
	});

	it('the left edge still drags', () => {
		expect(handleGuidesLayerEvent(mouse('mousedown', xOf(0), 300))).toBe(true);
		expect(guidesLayerState.dragging).toBe('lsb');
		handleGuidesLayerEvent(mouse('mouseup', xOf(0), 300));
	});

	it('where an edge crosses a locked line, the edge wins', () => {
		expect(findLineAt(editor, { x: xOf(0), y: yOf(0) }).id).toBe('lsb');
		expect(findLineAt(editor, { x: xOf(530), y: yOf(580) }).id).toBe('rsb');
	});

	it('a guide added in More tools stays draggable', () => {
		const guide = editor.project.settings.app.guides.custom[0];
		guide.angle = 90;
		guide.location = 300;
		expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(300)))).toBe(true);
		expect(guidesLayerState.dragging).toBe('guide:0');
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(300)));
	});
});

describe("Simple with Move the guide lines on (B15's switch, setGuideLinesMoving)", () => {
	beforeEach(() => {
		setModeForTests('simple');
		setGuideLinesMoving(true);
	});
	afterEach(() => setGuideLinesMoving(false));

	it('the small-letter line drags and nudges again', () => {
		expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(580)))).toBe(true);
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(600), true));
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(600)));
		expect(font.xHeight).toBe(600);
		handleGuidesLayerEvent(mouse('mousemove', 300, yOf(600)));
		document.dispatchEvent(key('ArrowUp'));
		expect(font.xHeight).toBe(601);
	});

	it('the writing line stays locked', () => {
		expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(0)))).toBe(false);
		expect(guidesLayerState.dragging).toBe(false);
	});

	it('turned off again, the lines lock again', () => {
		setGuideLinesMoving(false);
		expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(580)))).toBe(false);
	});
});

describe('All tools: nothing is locked', () => {
	it.each(Object.entries(HORIZONTAL))('%s hovers and drags as today', (id, em) => {
		expect(handleGuidesLayerEvent(mouse('mousemove', 300, yOf(em)))).toBe(true);
		expect(guidesLayerState.hover).toBe(id);
		expect(handleGuidesLayerEvent(mouse('mousedown', 300, yOf(em)))).toBe(true);
		expect(guidesLayerState.dragging).toBe(id);
		handleGuidesLayerEvent(mouse('mouseup', 300, yOf(em)));
	});
});
