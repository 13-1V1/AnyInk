// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 (UX-BEGINNER.md 4.6 "Gaps you fixed (closed): each fix as words ("en" closer / further);
// [x] removes it (one Undo step)"; 7.3 remove a gap fix: an Undo toast, not a confirm). The list
// follows the font: a drag, a removal and an Undo all show at once.
// Written to fail first: src/anyink/tryit/gap_list.js did not exist.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { onePairFixes } from '../../kerning/kern_lookup.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import { glyphId } from '../../spacing/tests/fixtures.js';
import { beginGapDrag } from '../gap_handle.js';
import { listedGapFixes, makeGapList } from '../gap_list.js';
import { gapsEditor } from './gaps_fixture.js';

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

function fix(editor, left, right, value) {
	const drag = beginGapDrag(editor, left, right);
	drag.set(value);
	return drag.finish();
}

/** Shown, or keeping its place with nothing in it (never display: none). */
const isEmpty = (element) => {
	expect(element.hidden).toBe(false);
	expect(getComputedStyle(element).display).not.toBe('none');
	const empty = element.classList.contains('is-empty');
	expect(getComputedStyle(element).visibility).toBe(empty ? 'hidden' : 'visible');
	return empty;
};

const rowsOf = (list) =>
	[...list.element.querySelectorAll('li')].map((li) => li.querySelector('span').textContent);

describe('Gaps you fixed', () => {
	it('keeps its row empty with no gap fixes, and is closed with its count once there are some', () => {
		const editor = gapsEditor();
		const list = makeGapList({ getEditor: () => editor });
		document.body.appendChild(list.element);
		expect(isEmpty(list.element)).toBe(true);
		fix(editor, 'e', 'n', -30);
		fix(editor, 'H', 'o', 25);
		expect(isEmpty(list.element)).toBe(false);
		expect(list.element.open).toBe(false);
		expect(list.element.querySelector('summary').textContent).toBe('Gaps you fixed (2)');
		expect(rowsOf(list)).toEqual(['"en" closer', '"Ho" further apart']);
		// the pair is his own letters, shown as a quote (never read as a word)
		expect(list.element.querySelector('li .anyink-quote').textContent).toBe('en');
	});

	it('[x] takes a fix away in one step, with an Undo toast; Undo brings it back to the list', () => {
		const editor = gapsEditor();
		const list = makeGapList({ getEditor: () => editor });
		document.body.appendChild(list.element);
		fix(editor, 'e', 'n', -30);
		fix(editor, 'H', 'o', 25);
		const before = editor.history.queue.length;
		const remove = list.element.querySelector('li button');
		expect(remove.getAttribute('aria-label')).toBe(
			'Take away the gap fix between small e and small n'
		);
		remove.click();
		expect(onePairFixes(editor.project)).toHaveLength(1);
		expect(editor.history.queue.length).toBe(before + 2);
		expect(rowsOf(list)).toEqual(['"Ho" further apart']);
		expect(toastLog().at(-1)).toMatchObject({ key: 'tryitGaps.toast.removed' });
		editor.history.restoreState();
		expect(rowsOf(list)).toEqual(['"en" closer', '"Ho" further apart']);
		list.detach();
	});
});

scanSimpleScreen('Try it: gaps you fixed, open', () => {
	const editor = gapsEditor();
	const list = makeGapList({ getEditor: () => editor });
	document.body.appendChild(list.element);
	fix(editor, 'e', 'n', -30);
	fix(editor, 'o', 't', 12);
	list.element.open = true;
	list.element.querySelector('li button').click();
	return list.element;
});

// B12 fix pass (findings: "The 'Gaps you fixed' list writes the pair as a made-up word ("ol
// further")", "'Gaps you fixed' lists every one-pair kern group, including hundreds from an
// imported font", "The whole line of letters jumps up ... the first live drag tick"). Written to
// fail first: rows read 'ol further', every one-pair rule was listed (a ligature id as 'f'), and
// the list came (display: none to shown) on a live drag tick.
describe('Gaps you fixed: his fixes only, in words, on release', () => {
	it('quotes the pair and says the whole phrase, with the letter names as its tooltip', () => {
		const editor = gapsEditor();
		const list = makeGapList({ getEditor: () => editor });
		fix(editor, 'o', 'n', 20);
		const span = list.element.querySelector('li span');
		expect(span.textContent).toBe('"on" further apart');
		expect(span.title).toBe('small o and small n further apart');
		list.detach();
	});

	it("never lists an imported font's pair rules, joined letters, or a letter with no ink", () => {
		const editor = gapsEditor();
		const add = (left, right, value) =>
			editor.project.addItemByType(
				new KernGroup({ leftGroup: [left], rightGroup: [right], value }),
				'KernGroup'
			);
		add('0x48', '0x6F', -40); // from an imported font
		add('0x660x69', '0x6E', -20); // joined letters
		const list = makeGapList({ getEditor: () => editor });
		expect(isEmpty(list.element)).toBe(true);
		expect(listedGapFixes(editor.project)).toEqual([]);
		fix(editor, 'e', 'n', -30);
		expect(rowsOf(list)).toEqual(['"en" closer']);
		expect(list.element.querySelector('summary').textContent).toBe('Gaps you fixed (1)');
		// he empties the n: its fix is not listed while it has no ink
		editor.project.glyphs[glyphId('n')].shapes = [];
		list.refresh();
		expect(isEmpty(list.element)).toBe(true);
		list.detach();
	});

	it('nothing comes or changes under the pointer while a gap is dragged', () => {
		const editor = gapsEditor();
		const list = makeGapList({ getEditor: () => editor });
		document.body.appendChild(list.element);
		const drag = beginGapDrag(editor, 'e', 'n');
		drag.set(-30);
		expect(isEmpty(list.element)).toBe(true);
		drag.finish();
		expect(rowsOf(list)).toEqual(['"en" closer']);
		const again = beginGapDrag(editor, 'e', 'n');
		again.set(40);
		expect(rowsOf(list)).toEqual(['"en" closer']);
		again.finish();
		expect(rowsOf(list)).toEqual(['"en" further apart']);
		list.detach();
	});
});
