// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 (UX-BEGINNER.md 4.6 Gap handle; 7.3 "Gap fix drag or removal: whole-project step"; section
// 10 B12 unit tests "handle hit test; a one-pair rule written and removed; undo doesn't
// navigate"). Pointing between two made letters in Try it shows a purple handle; a drag writes a
// one-pair rule as one whole-font step about no letter, so Undo never jumps pages; a double-click
// takes the fix away (one step, an Undo toast).
// Written to fail first: src/anyink/tryit/gap_handle.js did not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KernGroup } from '../../../project_data/kern_group.js';
import { kernOffsetFor, onePairFixes, onePairGroupID } from '../../kerning/kern_lookup.js';
import { setModeForTests } from '../../mode/mode.js';
import { glyphId } from '../../spacing/tests/fixtures.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import {
	GAP_REACH_PX,
	attachGapHandle,
	beginGapDrag,
	findGapAtPoint,
	removeGapFix,
	touchFloor,
} from '../gap_handle.js';
import { inkBounds } from '../../spacing/measure.js';
import { rect } from '../../spacing/tests/fixtures.js';
import { gapsEditor, layoutWord } from './gaps_fixture.js';

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

const FONT = { ascent: 800, descent: -200 };
const queueOf = (editor) => editor.history.queue;

describe('the handle hit test', () => {
	it('finds the gap between two made letters near their meeting point, on the line only', () => {
		const editor = gapsEditor();
		const data = layoutWord(editor.project, 'Hen');
		const [, e, n] = data[0];
		const gapX = n.view.dx;
		const hit = findGapAtPoint(data, gapX - 2, 80, FONT);
		expect(hit).toMatchObject({ left: e, right: n, x: gapX });
		// either side of the meeting point, within reach
		expect(findGapAtPoint(data, gapX + GAP_REACH_PX - 1, 80, FONT)?.right).toBe(n);
		// the middle of a letter is not a gap
		const middle = e.view.dx + (e.widths.advance * e.view.dz) / 2;
		expect(findGapAtPoint(data, middle, 80, FONT)).toBe(false);
		// above the letters' box, or below it, is not a gap
		expect(findGapAtPoint(data, gapX, 100 - 800 * 0.1 - 5, FONT)).toBe(false);
		expect(findGapAtPoint(data, gapX, 100 + 200 * 0.1 + 5, FONT)).toBe(false);
	});

	it('picks the nearer gap, and finds one opened wider than a letter edge', () => {
		const editor = gapsEditor();
		editor.project.addItemByType(
			new KernGroup({ leftGroup: ['0x65'], rightGroup: ['0x6E'], value: 300 }),
			'KernGroup'
		);
		const data = layoutWord(editor.project, 'Hen');
		const [H, e, n] = data[0];
		// e ends, then 30 px of open gap, then n: the middle of that opening is the e n gap
		const eEnd = e.view.dx + e.widths.advance * e.view.dz;
		expect(n.view.dx - eEnd).toBeCloseTo(30);
		expect(findGapAtPoint(data, eEnd + 15, 80, FONT)).toMatchObject({ left: e, right: n });
		expect(findGapAtPoint(data, e.view.dx + 1, 80, FONT)).toMatchObject({ left: H, right: e });
	});

	it('never offers a gap beside a letter not made yet, a space or another line', () => {
		const editor = gapsEditor({ letters: 'en' });
		const data = layoutWord(editor.project, 'ex n');
		const [e, x, space, n] = data[0];
		expect(x.item).toBe(false); // not made: a stand-in
		expect(findGapAtPoint(data, x.view.dx, 80, FONT)).toBe(false);
		expect(findGapAtPoint(data, n.view.dx, 80, FONT)).toBe(false);
		expect(space.char).toBe(' ');
		const wrapped = layoutWord(editor.project, 'en');
		wrapped[0][1].lineNumber = 1;
		expect(findGapAtPoint(wrapped, wrapped[0][1].view.dx, 80, FONT)).toBe(false);
		expect(e).toBeTruthy();
	});
});

describe('a gap fix', () => {
	it('is a one-pair rule written as one whole-font step about no letter, named in plain words', () => {
		const editor = gapsEditor({ open: 'o' });
		const before = queueOf(editor).length;
		const drag = beginGapDrag(editor, 'e', 'n');
		expect(drag.startValue).toBe(0);
		drag.set(-40);
		drag.set(-51);
		// live while dragging: the lookup already answers the new value, nothing recorded yet
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-51);
		expect(queueOf(editor).length).toBe(before);
		const result = drag.finish();
		expect(result).toMatchObject({ value: -51, closer: true });
		const groupID = onePairGroupID(editor.project, 'e', 'n');
		expect(groupID).toBeTruthy();
		const group = editor.project.kerning[groupID];
		expect(group.leftGroup).toEqual(['0x65']);
		expect(group.rightGroup).toEqual(['0x6E']);
		expect(group.value).toBe(-51);
		// one step: the pre and post copies of one whole-font change
		expect(queueOf(editor).length).toBe(before + 2);
		const pre = queueOf(editor)[1];
		expect(pre.wholeProjectSave).toBe(true);
		expect(pre.itemID).toBe(false);
		expect(historyText(pre.title)).toBe('moved small e and small n closer');
		expect(onePairFixes(editor.project)).toHaveLength(1);
	});

	it('a drag that ends where it started records nothing; one back to the old gap takes the fix away', () => {
		const editor = gapsEditor();
		const still = beginGapDrag(editor, 'e', 'n');
		still.set(-30);
		still.set(0);
		expect(still.finish()).toBe(null);
		expect(queueOf(editor)).toHaveLength(0);
		expect(onePairFixes(editor.project)).toEqual([]);

		const cancelled = beginGapDrag(editor, 'e', 'n');
		cancelled.set(-50);
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-50);
		cancelled.cancel(); // a lost pointer puts it all back, no step
		expect(onePairFixes(editor.project)).toEqual([]);
		expect(queueOf(editor)).toHaveLength(0);
		const made = beginGapDrag(editor, 'e', 'n');
		made.set(-50);
		made.finish();
		const back = beginGapDrag(editor, 'e', 'n');
		back.set(0);
		expect(back.finish()).toMatchObject({ value: 0, closer: false, removed: true });
		expect(onePairFixes(editor.project)).toEqual([]);
		expect(historyText(queueOf(editor)[1].title)).toBe('moved small e and small n apart');
	});

	it('a second drag on the same pair changes its one rule, never a second one', () => {
		const editor = gapsEditor();
		const one = beginGapDrag(editor, 'e', 'n');
		one.set(-20);
		one.finish();
		const two = beginGapDrag(editor, 'e', 'n');
		two.set(35);
		expect(two.finish()).toMatchObject({ value: 35, closer: false });
		expect(onePairFixes(editor.project)).toEqual([
			expect.objectContaining({ left: '0x65', right: '0x6E', value: 35 }),
		]);
	});

	it('over a class gap rule from More tools: starts from its value, and is taken away back to it', () => {
		const editor = gapsEditor();
		editor.project.addItemByType(
			new KernGroup({ leftGroup: ['0x65', '0x6F'], rightGroup: ['0x6E'], value: -30 }),
			'KernGroup'
		);
		const drag = beginGapDrag(editor, 'e', 'n');
		expect(drag.startValue).toBe(-30);
		drag.set(-50);
		drag.finish();
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-50);
		expect(kernOffsetFor(editor.project, 'o', 'n')).toBe(-30);
		expect(removeGapFix(editor, 'e', 'n')).toBe(true);
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-30);
		expect(Object.keys(editor.project.kerning)).toHaveLength(1);
	});

	it('is taken away in one step with an Undo toast; removing a pair with no fix does nothing', () => {
		const editor = gapsEditor();
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-45);
		drag.finish();
		const before = queueOf(editor).length;
		expect(removeGapFix(editor, 'e', 'n')).toBe(true);
		expect(onePairFixes(editor.project)).toEqual([]);
		expect(queueOf(editor).length).toBe(before + 2);
		expect(historyText(queueOf(editor)[1].title)).toBe(
			'removed the gap fix between small e and small n'
		);
		const said = toastLog().at(-1);
		expect(said).toMatchObject({ key: 'tryitGaps.toast.removed' });
		expect(removeGapFix(editor, 'o', 'n')).toBe(false);
		expect(queueOf(editor).length).toBe(before + 2);
	});
});

describe("Undo doesn't navigate", () => {
	it('Simple: undo and redo of a gap fix change the gap and leave the open letter and page alone', () => {
		const editor = gapsEditor({ open: 'o' });
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-55);
		drag.finish();
		// he looks at another letter after the fix
		editor.selectedItemID = glyphId('H');
		const navigate = vi.spyOn(editor, 'navigate');
		editor.history.restoreState();
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(0);
		expect(editor.selectedItemID).toBe(glyphId('H'));
		expect(editor.nav.page).toBe('Characters');
		expect(navigate).not.toHaveBeenCalled();
		editor.history.redoState();
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-55);
		expect(editor.selectedItemID).toBe(glyphId('H'));
		expect(navigate).not.toHaveBeenCalled();
	});

	it('Simple: undoing a removal brings the fix back, on the same screen', () => {
		const editor = gapsEditor({ open: 'e' });
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-25);
		drag.finish();
		removeGapFix(editor, 'e', 'n');
		editor.selectedItemID = glyphId('t');
		const navigate = vi.spyOn(editor, 'navigate');
		editor.history.restoreState();
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-25);
		expect(editor.selectedItemID).toBe(glyphId('t'));
		expect(navigate).not.toHaveBeenCalled();
	});
});

/** A host with a canvas laid out at the host's top left, and the layout the strip hands over. */
function mountHandle(editor, text = 'Hen') {
	const host = document.createElement('div');
	const canvas = document.createElement('canvas');
	host.appendChild(canvas);
	document.body.appendChild(host);
	const rect = { left: 0, top: 0, right: 400, bottom: 150, width: 400, height: 150, x: 0, y: 0 };
	host.getBoundingClientRect = () => /** @type {DOMRect} */ (rect);
	canvas.getBoundingClientRect = () => /** @type {DOMRect} */ (rect);
	const layout = () => ({ data: layoutWord(editor.project, text), font: FONT, canvas });
	const control = attachGapHandle({ host, getLayout: layout, getEditor: () => editor });
	return { host, canvas, control, layout };
}

function pointer(type, target, x, y, extra = {}) {
	const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra });
	Object.defineProperty(event, 'pointerId', { value: 1 });
	target.dispatchEvent(event);
	return event;
}

describe('the purple handle on the sheet', () => {
	it('shows under the pointer between two made letters, with its tooltip, and hides away from a gap', () => {
		const editor = gapsEditor();
		const { host, control, layout } = mountHandle(editor);
		const n = layout().data[0][2];
		pointer('pointermove', host, n.view.dx + 1, 80);
		const handle = control.element;
		expect(handle.hidden).toBe(false);
		expect(handle.title).toBe('drag to close or open this gap');
		expect(handle.getAttribute('aria-label')).toBe(
			'Gap between small e and small n: drag to close or open it'
		);
		expect(parseFloat(handle.style.left)).toBeCloseTo(n.view.dx, 0);
		pointer('pointermove', host, 395, 140);
		expect(handle.hidden).toBe(true);
		control.detach();
		expect(handle.isConnected).toBe(false);
	});

	it('a drag writes the gap fix on release, and the toast offers Undo', () => {
		const editor = gapsEditor();
		const { host, control, layout } = mountHandle(editor);
		const n = layout().data[0][2];
		pointer('pointermove', host, n.view.dx, 80);
		const handle = control.element;
		pointer('pointerdown', handle, n.view.dx, 80, { button: 0 });
		pointer('pointermove', handle, n.view.dx - 3, 80);
		// live: 3 px at 0.1 px a unit is 30 units closer
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-30);
		expect(queueOf(editor)).toHaveLength(0);
		pointer('pointerup', handle, n.view.dx - 4, 80);
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(-40);
		expect(queueOf(editor)).toHaveLength(2);
		const said = toastLog().at(-1);
		expect(said).toMatchObject({ key: 'tryitGaps.toast.closer' });
		expect(said.text).toBe('Moved small e and small n closer.');
	});

	it('a double-click on the handle takes the fix away and opens no letter', () => {
		const editor = gapsEditor();
		const { host, control, layout } = mountHandle(editor);
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-30);
		drag.finish();
		const n = layout().data[0][2];
		pointer('pointermove', host, n.view.dx, 80);
		const opened = vi.fn();
		host.addEventListener('dblclick', opened);
		pointer('dblclick', control.element, n.view.dx, 80);
		expect(onePairFixes(editor.project)).toEqual([]);
		expect(opened).not.toHaveBeenCalled();
	});
});

scanSimpleScreen('Try it: the gap handle and its toasts', () => {
	const editor = gapsEditor();
	const { host, control, layout } = mountHandle(editor);
	const n = layout().data[0][2];
	pointer('pointermove', host, n.view.dx, 80);
	pointer('pointerdown', control.element, n.view.dx, 80, { button: 0 });
	pointer('pointermove', control.element, n.view.dx + 2, 80);
	pointer('pointerup', control.element, n.view.dx + 2, 80);
	removeGapFix(editor, 'e', 'n');
	return host;
});

// B12 fix pass (finding: "A gap drag has no limit, so a short drag pushes one letter inside the
// next"). Written to fail first: the drag went as far as the left letter's whole width.
describe('a gap drag stops where the ink touches', () => {
	it('never brings the two letters closer than touching, as the letter-spacing slider', () => {
		const editor = gapsEditor();
		const { glyphs } = editor.project;
		const e = glyphs[glyphId('e')];
		const n = glyphs[glyphId('n')];
		const space = e.advanceWidth - inkBounds(e).xMax + inkBounds(n).xMin;
		expect(space).toBeGreaterThan(0);
		const drag = beginGapDrag(editor, 'e', 'n');
		expect(drag.floor).toBe(Math.ceil(-space));
		expect(drag.set(-5000)).toBe(Math.ceil(-space));
		expect(drag.finish()).toMatchObject({ value: Math.ceil(-space) });
		// the e's ink ends where the n's begins: touching, not overlapping
		expect(space + kernOffsetFor(editor.project, 'e', 'n')).toBeGreaterThanOrEqual(0);
		expect(space + kernOffsetFor(editor.project, 'e', 'n')).toBeLessThan(1);
		// opening the gap again is never held back
		const back = beginGapDrag(editor, 'e', 'n');
		expect(back.set(40)).toBe(40);
		back.cancel();
	});

	it('a pair already closer than touching keeps where it is, and is never pushed further in', () => {
		const editor = gapsEditor();
		editor.project.addItemByType(
			new KernGroup({ leftGroup: ['0x65', '0x6F'], rightGroup: ['0x6E'], value: -300 }),
			'KernGroup'
		);
		expect(touchFloor(editor.project, 'e', 'n', -300)).toBe(-300);
		const drag = beginGapDrag(editor, 'e', 'n');
		expect(drag.set(-400)).toBe(-300);
		drag.cancel();
		// a letter with no ink: no floor of its own (the left letter's width still holds)
		expect(touchFloor(editor.project, 'e', 'x', 0)).toBe(-Infinity);
	});
});

// B12 finalize (new problem: "The gap floor stops at the letters' bounding boxes, so overhang
// pairs like To / Ty / Wa / Yo can never be closed"). Written to fail first: touchFloor read the
// two boxes and gave -150 here.
describe('a letter tucks under an overhang', () => {
	const T = {
		shapes: [rect(50, 1300, 1050, 1400), rect(500, 0, 600, 1300)],
		advanceWidth: 1100,
		anyink: { spacing: 'manual' },
	};
	const o = { shapes: [rect(100, 0, 1000, 900)], advanceWidth: 1100, anyink: { spacing: 'manual' } };

	it('the floor is where the ink touches row by row, not where the boxes meet', () => {
		const editor = gapsEditor({ letters: '', own: { T, o } });
		expect(touchFloor(editor.project, 'T', 'o', 0)).toBe(-600);
		const drag = beginGapDrag(editor, 'T', 'o');
		expect(drag.set(-500)).toBe(-500);
		expect(drag.set(-900)).toBe(-600);
		drag.cancel();
	});

	it('two letters that share no row of ink still stop where their boxes meet', () => {
		const high = { shapes: [rect(100, 1000, 500, 1400)], advanceWidth: 600, anyink: { spacing: 'manual' } };
		const low = { shapes: [rect(100, 0, 500, 400)], advanceWidth: 600, anyink: { spacing: 'manual' } };
		const editor = gapsEditor({ letters: '', own: { "'": high, '.': low } });
		expect(touchFloor(editor.project, "'", '.', 0)).toBe(-200);
	});
});

// B12 fix pass (finding: "Ctrl+Z during a held gap drag throws and leaves half an Undo step").
// Written to fail first: finish() wrote on the swapped font and threw after the before-copy.
describe('Undo during a held gap drag', () => {
	const unpaired = (editor) => {
		const q = queueOf(editor);
		const posts = q.filter((entry) => /_post_state_$/.test(entry.title)).length;
		const pres = q.filter((entry) => entry.wholeProjectSave && !/_post_state_$/.test(entry.title));
		return pres.length - posts;
	};

	it('a font swapped under the drag drops it: no throw, no half step, nothing written', () => {
		const editor = gapsEditor();
		const first = beginGapDrag(editor, 'o', 'n');
		first.set(-20);
		first.finish();
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-40);
		editor.history.restoreState(); // Ctrl+Z: a new font object on the editor
		const before = queueOf(editor).length;
		expect(() => drag.set(-45)).not.toThrow();
		expect(() => expect(drag.finish()).toBe(null)).not.toThrow();
		expect(queueOf(editor).length).toBe(before);
		expect(unpaired(editor)).toBe(0);
		expect(kernOffsetFor(editor.project, 'e', 'n')).toBe(0);
		expect(onePairFixes(editor.project)).toEqual([]);
	});

	it('a throw while the step is written still closes the step', () => {
		const editor = gapsEditor();
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-30);
		const add = vi.spyOn(editor.project, 'addItemByType').mockImplementation(() => {
			throw new Error('broken');
		});
		expect(() => drag.finish()).toThrow('broken');
		add.mockRestore();
		expect(queueOf(editor).length).toBe(2);
		expect(queueOf(editor)[0].title).toMatch(/_post_state_$/);
		expect(unpaired(editor)).toBe(0);
	});

	it('Ctrl+Z and Ctrl+Y wait while the handle is held, and work again on release', () => {
		const editor = gapsEditor();
		const { host, control, layout } = mountHandle(editor);
		const heard = [];
		const listen = (event) => heard.push(event.key);
		document.addEventListener('keydown', listen);
		const n = layout().data[0][2];
		pointer('pointermove', host, n.view.dx, 80);
		pointer('pointerdown', control.element, n.view.dx, 80, { button: 0 });
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
		document.body.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true })
		);
		document.body.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true, bubbles: true })
		);
		expect(heard).toEqual([]);
		pointer('pointerup', control.element, n.view.dx - 2, 80);
		document.body.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
		);
		expect(heard).toEqual(['z']);
		document.removeEventListener('keydown', listen);
		control.detach();
	});
});
