// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Tool_Kern and the exception group against a real GlyphrStudioProject in jsdom.
	The canvas is not mounted; the tool only needs the editor, its view, and the
	pointer position in eventHandlerData.
*/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { Tool_Kern } from '../../../edit_canvas/tools/kern.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { findExceptionGroup, selectOrCreateExceptionGroup } from '../exception_group.js';
import { kernOffsetFor } from '../kern_lookup.js';
import { kernPairState, resetKernPairState } from '../pair_state.js';

let editor;
let project;
const view = { dx: 500, dy: 400, dz: 0.5 }; // em x=0 at px 500, baseline at px 400

function setup(kerning) {
	const data = structuredClone(simpleExampleProject);
	data.kerning = kerning;
	project = new GlyphrStudioProject(data);
	editor = new ProjectEditor({ project });
	editor.nav.page = 'Kerning';
	editor.selectedTool = 'kern';
	setCurrentProjectEditor(editor);
	editor.selectedKernGroupID = 'kern-0';
	editor.view = { ...view };
	editor.history.addState = vi.fn();
	editor.history.addWholeProjectChangePreState = vi.fn();
	editor.history.addWholeProjectChangePostState = vi.fn();
	editor.publish = vi.fn();
	resetKernPairState();
	eventHandlerData.isShiftDown = false;
	eventHandlerData.isAltDown = false;
}

/** The right glyph (C, 420 wide) starts at em x = value; put the pointer on its ink. */
function pointerOnRightGlyph(value) {
	eventHandlerData.mousePosition = { x: view.dx + (value + 200) * view.dz, y: view.dy - 300 * view.dz };
}

describe('Tool_Kern', () => {
	beforeEach(() => {
		setup({ 'kern-0': { leftGroup: ['0x41'], rightGroup: ['0x43'], value: -100 } });
	});

	it('ignores a mousedown that is not on the right glyph or the value line', () => {
		const tool = new Tool_Kern();
		eventHandlerData.mousePosition = { x: 100, y: 250 }; // far left, over the left glyph
		tool.mousedown({});
		expect(tool.dragging).toBe(false);
		tool.mouseup({});
		expect(editor.history.addState).not.toHaveBeenCalled();
	});

	it('drags the value from the first pointer position and commits one history entry', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousedown({});
		expect(tool.dragging).toBe(true);
		expect(kernPairState.dragging).toBe(true);

		const startX = eventHandlerData.mousePosition.x;
		eventHandlerData.mousePosition.x = startX + 1; // 2 units at dz 0.5
		tool.mousemove({ buttons: 1 });
		expect(project.kerning['kern-0'].value).toBe(-98);
		eventHandlerData.mousePosition.x = startX + 25; // 50 units total, not 2 + 48 of drift
		tool.mousemove({ buttons: 1 });
		expect(project.kerning['kern-0'].value).toBe(-50);
		expect(editor.publish).toHaveBeenCalledWith('currentKernGroup', project.kerning['kern-0']);
		// no 'kernPairs' while dragging: that topic rebuilds the real font, release only
		expect(editor.publish.mock.calls.some(([topic]) => topic === 'kernPairs')).toBe(false);
		expect(kernOffsetFor(project, 'A', 'C')).toBe(-50); // the lookup already sees the tick

		tool.mouseup({});
		expect(tool.dragging).toBe(false);
		expect(editor.history.addState).toHaveBeenCalledTimes(1);
		expect(editor.history.addState).toHaveBeenCalledWith('Kern group value: -50');
		expect(editor.publish).toHaveBeenLastCalledWith('kernPairs', expect.objectContaining({ dragging: false, value: -50 }));
		expect(kernOffsetFor(project, 'A', 'C')).toBe(-50);
	});

	it('does not add history when the value did not change', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousedown({});
		tool.mousemove({ buttons: 1 });
		tool.mouseup({});
		expect(editor.history.addState).not.toHaveBeenCalled();
		expect(project.kerning['kern-0'].value).toBe(-100);
	});

	it('Shift snaps to multiples of 10', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousedown({});
		eventHandlerData.mousePosition.x += 13; // +26 units -> -74 -> snaps to -70
		tool.mousemove({ buttons: 1, shiftKey: true });
		expect(project.kerning['kern-0'].value).toBe(-70);
	});

	it('finishes the drag when the button was released off-canvas', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousedown({});
		eventHandlerData.mousePosition.x += 10;
		tool.mousemove({ buttons: 1 });
		tool.mousemove({ buttons: 0 });
		expect(tool.dragging).toBe(false);
		expect(editor.history.addState).toHaveBeenCalledTimes(1);
	});

	it('tracks hover over the drag zone when not dragging', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousemove({ buttons: 0 });
		expect(kernPairState.hover).toBe(true);
		eventHandlerData.mousePosition = { x: 100, y: 250 };
		tool.mousemove({ buttons: 0 });
		expect(kernPairState.hover).toBe(false);
	});
});

describe('Tool_Kern: Alt-drag on a class group', () => {
	beforeEach(() => {
		setup({
			'kern-0': { leftGroup: ['0x41', '0x42'], rightGroup: ['0x43'], value: -100 },
		});
	});

	it('creates a one-by-one exception for the shown pair, selects it, and drags that', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousedown({ altKey: true });
		expect(editor.selectedKernGroupID).toBe('kern-1');
		const exception = project.kerning['kern-1'];
		expect(exception.leftGroup).toEqual(['0x41']);
		expect(exception.rightGroup).toEqual(['0x43']);
		expect(exception.value).toBe(-100);
		expect(editor.history.addWholeProjectChangePreState).toHaveBeenCalledTimes(1);
		expect(editor.history.addWholeProjectChangePostState).toHaveBeenCalledTimes(1);
		// the view was carried over so the canvas does not jump
		expect(editor.view).toMatchObject(view);

		eventHandlerData.mousePosition.x += 20; // +40 units
		tool.mousemove({ buttons: 1 });
		tool.mouseup({});
		expect(exception.value).toBe(-60);
		expect(project.kerning['kern-0'].value).toBe(-100); // the class group is untouched
		expect(kernOffsetFor(project, 'A', 'C')).toBe(-60); // exception wins for A C
		expect(kernOffsetFor(project, 'B', 'C')).toBe(-100); // class still covers B C
	});

	it('reuses an existing exception instead of duplicating it', () => {
		project.kerning['kern-1'] = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x43'], value: -5 });
		project.kerning['kern-1'].id = 'kern-1';
		expect(findExceptionGroup(project, '0x41', '0x43').id).toBe('kern-1');
		const result = selectOrCreateExceptionGroup(editor, project.kerning['kern-0'], { left: '0x41', right: '0x43' });
		expect(result.id).toBe('kern-1');
		expect(Object.keys(project.kerning)).toEqual(['kern-0', 'kern-1']);
		expect(editor.history.addWholeProjectChangePreState).not.toHaveBeenCalled();
		expect(editor.selectedKernGroupID).toBe('kern-1');
	});

	it('plain drag on a class group edits the class itself', () => {
		const tool = new Tool_Kern();
		pointerOnRightGlyph(-100);
		tool.mousedown({});
		eventHandlerData.mousePosition.x += 20;
		tool.mousemove({ buttons: 1 });
		tool.mouseup({});
		expect(Object.keys(project.kerning)).toEqual(['kern-0']);
		expect(project.kerning['kern-0'].value).toBe(-60);
	});
});
