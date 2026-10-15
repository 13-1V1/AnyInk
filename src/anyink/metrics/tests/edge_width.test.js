// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track, the side edges on the guides layer (UX-BEGINNER.md 7.2 "whole numbers ... a
// width above 0", 7.6, principle 5):
//   - Simple: a letter with no shapes has no edge to drag. Its left edge had nothing to move, so a
//     drag to the right only took the width below zero (an empty small e went to -192, its edge
//     line drawn left of the box, the readout stuck at "left space 0"), and a photo's corner on
//     that edge was grabbed as the edge. The press goes to the tool or the photo instead, and
//     nothing marks the letter "set by you".
//   - Both modes: an edge drag or an arrow nudge never takes a letter's width below 0, the one
//     width a font file can't hold; a press that changes nothing records no step.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setFineTuneOpen } from '../../letter/view_switches.js';
import { setModeForTests } from '../../mode/mode.js';
import { hasSpacingOwner } from '../../spacing/owner.js';
import { findLineAt, guidesLayerState, handleGuidesLayerEvent } from '../guides_layer.js';
import { resetGuidesLayerState } from '../state.js';

// The sample font: glyph A advance 530, with shapes.
const view = { dx: 100, dy: 500, dz: 0.5 };
const xOf = (em) => view.dx + em * view.dz;

function makeEditor(id = 'glyph-0x41') {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = id;
	editor.selectedTool = 'resize';
	Object.assign(editor.systemGuides, { baseline: true, leftSide: true, rightSide: true });
	editor.view = { ...view };
	editor.history = {
		titles: [],
		addState(title) {
			this.titles.push(title);
		},
		addSettingsState(title) {
			this.titles.push(title);
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
const key = (name, shiftKey = false) =>
	new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true });

/** Presses at x, drags to x + px in steps of 15 px, lets go there */
function drag(x, px) {
	const grabbed = handleGuidesLayerEvent(mouse('mousedown', x, 300));
	const step = Math.sign(px) * 15;
	for (let moved = step; Math.abs(moved) <= Math.abs(px); moved += step) {
		handleGuidesLayerEvent(mouse('mousemove', x + moved, 300, true));
	}
	handleGuidesLayerEvent(mouse('mouseup', x + px, 300));
	return grabbed;
}

let editor;
beforeEach(() => {
	resetGuidesLayerState();
	setFineTuneOpen(true, null); // Simple: B7's letter view shows (and moves) the edges in Fine-tune
});
afterEach(() => resetGuidesLayerState());

describe('Simple: a letter with no shapes has no edges to drag', () => {
	beforeEach(() => setModeForTests('simple'));

	it('an empty small e: the left edge is not grabbed, its width stays 0, no step', () => {
		editor = makeEditor('glyph-0x65');
		const glyph = editor.selectedItem;
		expect(glyph.shapes).toHaveLength(0);
		expect(glyph.advanceWidth).toBe(0);
		expect(handleGuidesLayerEvent(mouse('mousemove', xOf(0), 300))).toBe(false);
		expect(guidesLayerState.hover).toBe(false);
		expect(drag(xOf(0), 45)).toBe(false);
		expect(guidesLayerState.dragging).toBe(false);
		expect(glyph.advanceWidth).toBe(0);
		expect(editor.history.titles).toEqual([]);
		expect(hasSpacingOwner(glyph)).toBe(false);
	});

	it('an empty letter that has a width: neither edge is grabbed, and arrows move neither', () => {
		editor = makeEditor('glyph-0x65');
		const glyph = editor.selectedItem;
		glyph.advanceWidth = 500;
		expect(findLineAt(editor, { x: xOf(0), y: 300 })).toBe(false);
		expect(findLineAt(editor, { x: xOf(500), y: 300 })).toBe(false);
		expect(drag(xOf(500), -60)).toBe(false);
		document.dispatchEvent(key('ArrowLeft'));
		expect(glyph.advanceWidth).toBe(500);
		expect(editor.history.titles).toEqual([]);
	});

	it('a letter with shapes keeps both edges', () => {
		editor = makeEditor();
		expect(findLineAt(editor, { x: xOf(0), y: 300 }).id).toBe('lsb');
		expect(findLineAt(editor, { x: xOf(530), y: 300 }).id).toBe('rsb');
	});
});

describe.each(['simple', 'all'])('%s: an edge never takes the width below 0', (mode) => {
	beforeEach(() => setModeForTests(mode));

	it('the left edge dragged far right stops at width 0', () => {
		editor = makeEditor();
		const glyph = editor.selectedItem;
		expect(drag(xOf(0), 600)).toBe(true);
		expect(glyph.advanceWidth).toBe(0);
		expect(editor.history.titles).toEqual(['Updated left side bearing.']);
	});

	it('the right edge dragged far left stops at width 0', () => {
		editor = makeEditor();
		const glyph = editor.selectedItem;
		expect(drag(xOf(530), -600)).toBe(true);
		expect(glyph.advanceWidth).toBe(0);
		expect(editor.history.titles).toEqual(['Updated right side bearing.']);
	});

	it('Shift+Left on the right edge stops at width 0, and a press that moves nothing is no step', () => {
		editor = makeEditor();
		const glyph = editor.selectedItem;
		glyph.advanceWidth = 25;
		handleGuidesLayerEvent(mouse('mousemove', xOf(25), 300));
		expect(guidesLayerState.hover).toBe('rsb');
		document.dispatchEvent(key('ArrowLeft', true));
		document.dispatchEvent(key('ArrowLeft', true));
		document.dispatchEvent(key('ArrowLeft', true));
		document.dispatchEvent(key('ArrowLeft', true));
		expect(glyph.advanceWidth).toBe(0);
		expect(editor.history.titles).toHaveLength(3);
	});
});

describe('All tools: an empty letter as today, but never below 0', () => {
	it('the left edge of an empty small e dragged right: the width stays 0, no step', () => {
		editor = makeEditor('glyph-0x65');
		const glyph = editor.selectedItem;
		drag(xOf(0), 45);
		expect(glyph.advanceWidth).toBe(0);
		expect(editor.history.titles).toEqual([]);
	});
});
