// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2: the Undo list keeps the newest 200 steps and at most 30 whole-project steps, dropping the
// oldest from the old end, in both modes (UX-BEGINNER 7.3). What the dropped steps did stays in
// the font: undo all the way back lands on the state after the newest dropped step.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import {
	MAX_NAVIGATION_ENTRIES,
	MAX_UNDO_STEPS,
	MAX_WHOLE_PROJECT_STEPS,
	capUndoQueue,
	countSteps,
} from '../undo_cap.js';
import { B, R, traceInto, twoLetterEditor } from './two_letters.js';

const POST = '_whole_project_change_post_state_';

let warn;
beforeEach(() => {
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

const width = (editor, id = B) => editor.project.glyphs[id].advanceWidth;

/** n item steps on B: width 1, 2, ... n */
function widenB(editor, n, from = 1) {
	for (let i = from; i < from + n; i++) {
		editor.project.glyphs[B].advanceWidth = i;
		editor.history.addState(`B to ${i}`);
	}
}

/** n whole-project steps: r's width 1000 + i */
function bulkSteps(editor, n, from = 1) {
	for (let i = from; i < from + n; i++) {
		editor.history.addWholeProjectChangePreState(`bulk ${i}`);
		editor.project.glyphs[R].advanceWidth = 1000 + i;
		editor.history.addWholeProjectChangePostState();
	}
}

function undoAll(editor) {
	let presses = 0;
	while (editor.history.queue.length && presses < 1000) {
		editor.history.restoreState();
		presses++;
	}
	return presses;
}

describe('undo_cap: counting', () => {
	const item = (title) => ({ title, itemID: B, wholeProjectSave: false, settingsSave: false });
	const settings = (title) => ({ title, settingsSave: true, wholeProjectSave: false });
	const pre = (title) => ({ title, wholeProjectSave: true, settingsSave: false, itemState: {} });
	const post = () => ({ title: POST, wholeProjectSave: true, settingsSave: false, itemState: {} });

	it('a whole-project pair is one step; item and settings entries are one each', () => {
		const queue = [post(), pre('bulk'), settings('s'), item('a')];
		expect(countSteps(queue)).toEqual({ steps: 3, wholeProject: 1 });
	});

	it('drops from the old end, and a pair leaves together', () => {
		const history = { queue: [item('new'), post(), pre('bulk'), item('old')], savedMarker: null };
		const dropped = capUndoQueue(history, { maxSteps: 1, maxWholeProject: 30 });
		expect(dropped.map((entry) => entry.title)).toEqual(['old', 'bulk', POST]);
		expect(history.queue.map((entry) => entry.title)).toEqual(['new']);
	});

	it('the default limits are 200 steps and 30 whole-project steps; 30 "Navigated to" entries', () => {
		expect(MAX_UNDO_STEPS).toBe(200);
		expect(MAX_WHOLE_PROJECT_STEPS).toBe(30);
		// each "Navigated to" entry holds a letter copy that undo reads only to move the view
		expect(MAX_NAVIGATION_ENTRIES).toBe(30);
	});

	it('looking around is not a step: "Navigated to" and creation-only entries are not counted', () => {
		const nav = (title) => ({ ...item(title), navigation: true });
		const created = (title) => ({ ...pre(title), creationOnly: true });
		const createdPost = () => ({ ...post(), creationOnly: true });
		const queue = [nav('Navigated to r'), createdPost(), created('Created C'), item('a')];
		expect(countSteps(queue)).toEqual({ steps: 1, wholeProject: 0 });
		// an entry from an older snapshot, known only by its title
		expect(countSteps([item('Navigated to LATIN SMALL LETTER R')])).toEqual({
			steps: 0,
			wholeProject: 0,
		});
	});

	it('past the navigation limit, a "Navigated to" entry right under another one leaves', () => {
		const nav = (title, itemID) => ({ ...item(title), itemID, navigation: true });
		const history = {
			queue: [
				nav('n5', 'glyph-0x43'),
				nav('n4', B),
				item('edit'),
				nav('n3', B),
				nav('n2', 'glyph-0x43'),
				nav('n1', R),
			],
			savedMarker: null,
		};
		capUndoQueue(history, { maxSteps: 200, maxWholeProject: 30, maxNavigation: 2 });
		// n5 is newest (on C, so its press still moves to the edit's letter); n3 holds the state
		// the edit undoes to
		expect(history.queue.map((entry) => entry.title)).toEqual(['n5', 'edit', 'n3']);
	});

	it('never leaves a "Navigated to" entry over a step of the same letter (a press that does nothing)', () => {
		const C = 'glyph-0x43';
		const nav = (title, itemID) => ({ ...item(title), itemID, navigation: true });
		// trace B, then look at C, B, C: taking n1 out alone would put "Navigated to B" on B's step
		const history = {
			queue: [nav('n3 C', C), nav('n2 B', B), nav('n1 C', C), item('traced B')],
			savedMarker: null,
		};
		capUndoQueue(history, { maxSteps: 200, maxWholeProject: 30, maxNavigation: 1 });
		expect(history.queue.map((entry) => entry.title)).toEqual(['n3 C', 'traced B']);
	});

	it('a "Navigated to" entry under a real step is kept, however many there are', () => {
		const nav = (title) => ({ ...item(title), navigation: true });
		const history = {
			queue: [item('e2'), nav('n2'), item('e1'), nav('n1')],
			savedMarker: null,
		};
		capUndoQueue(history, { maxSteps: 200, maxWholeProject: 30, maxNavigation: 0 });
		expect(history.queue.map((entry) => entry.title)).toEqual(['e2', 'n2', 'e1', 'n1']);
	});

	it('the saved marker on a "Navigated to" entry that leaves moves to the one above it', () => {
		const nav = (title, itemID) => ({ ...item(title), itemID, navigation: true });
		const n1 = nav('n1', R);
		const n2 = nav('n2', 'glyph-0x43');
		const history = { queue: [nav('n3', R), n2, n1, item('edit')], savedMarker: n1 };
		capUndoQueue(history, { maxSteps: 200, maxWholeProject: 30, maxNavigation: 1 });
		expect(history.queue.map((entry) => entry.title)).toEqual(['n3', 'edit']);
		expect(history.savedMarker).toBe(history.queue[0]);
	});
});

/**
 * Undoes everything, counting the presses that neither move the view nor change the font.
 * @returns {{presses: Number, dead: Number}}
 */
function undoAllCountingDeadPresses(editor) {
	let presses = 0;
	let dead = 0;
	while (editor.history.queue.length && presses < 2000) {
		const font = JSON.stringify(editor.project.save());
		const view = `${editor.nav.page} ${editor.selectedItemID}`;
		editor.history.restoreState();
		presses++;
		const sameView = `${editor.nav.page} ${editor.selectedItemID}` === view;
		if (sameView && JSON.stringify(editor.project.save()) === font) dead++;
	}
	return { presses, dead };
}

describe('All tools: looking around never costs a real Undo step', () => {
	it('trace B, then open B and r 200 times: the trace is still undoable', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(traceInto(editor)).toBe(true);
		const traced = editor.history.queue[0].title;
		expect(traced).toMatch(/^Auto-traced/);
		for (let i = 0; i < 200; i++) showItem(editor, i % 2 ? B : R);

		expect(countSteps(editor.history.queue)).toEqual({ steps: 1, wholeProject: 0 });
		expect(editor.history.queue.map((entry) => entry.title)).toContain(traced);
		expect(editor.history.undoFloor).toBe(null);
		undoAll(editor);
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
	});

	it('1000 letter openings keep the list short, and the trace still undoes', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		for (let i = 0; i < 1000; i++) showItem(editor, i % 2 ? B : R);
		const navigations = editor.history.queue.filter((entry) => entry.navigation);
		expect(navigations.length).toBeLessThanOrEqual(MAX_NAVIGATION_ENTRIES + 1);
		undoAll(editor);
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
	});

	it.each([250, 300, 1000])(
		'trace B, look at r and B %i times: thinning adds no press that does nothing',
		(looks) => {
			const run = (thin) => {
				const editor = twoLetterEditor();
				// the never-thinned list to compare with (no step drops: 1 step in all)
				if (!thin) vi.spyOn(editor.history, 'capQueue').mockImplementation(() => []);
				showItem(editor, B);
				traceInto(editor);
				for (let i = 0; i < looks; i++) showItem(editor, i % 2 ? B : R);
				const result = undoAllCountingDeadPresses(editor);
				expect(editor.project.glyphs[B].shapes).toHaveLength(0);
				return result;
			};
			const thinned = run(true);
			const kept = run(false);
			expect(thinned.dead).toBe(kept.dead);
			expect(thinned.presses).toBeLessThan(kept.presses);
		}
	);

	it('opening 40 letters with no record (40 creation steps) costs no older step', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor);
		for (let code = 0x43; code < 0x43 + 40; code++) {
			// the on-demand path in the selectedGlyph getter, which All tools records
			editor._selectedGlyphID = `glyph-0x${code.toString(16).toUpperCase()}`;
			void editor.selectedGlyph;
		}
		expect(editor.history.queue.filter((entry) => entry.creationOnly)).toHaveLength(80);
		expect(countSteps(editor.history.queue)).toEqual({ steps: 1, wholeProject: 0 });
		expect(editor.history.undoFloor).toBe(null);
		undoAll(editor);
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
	});
});

describe.each(['all', 'simple'])('undo cap in %s', (mode) => {
	beforeEach(() => setModeForTests(mode));

	it('keeps the newest 200 steps; undo all the way back lands after the dropped ones', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		widenB(editor, 205);
		expect(editor.history.length).toBe(200);
		expect(editor.history.queue).toHaveLength(200);
		expect(editor.history.queue.at(-1).title).toBe('B to 6');
		expect(undoAll(editor)).toBe(200);
		expect(width(editor)).toBe(5);
	});

	it('keeps at most 30 whole-project steps (each a pre / post pair)', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = R;
		bulkSteps(editor, 35);
		expect(editor.history.length).toBe(30);
		expect(editor.history.queue).toHaveLength(60);
		expect(editor.history.queue.at(-1).title).toBe('bulk 6');
		expect(editor.history.queue.at(-2).title).toBe(POST);
		undoAll(editor);
		expect(width(editor, R)).toBe(1005);
	});

	it('a 31st whole-project step drops the older item steps under the oldest one too', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		widenB(editor, 3); // B 1..3
		bulkSteps(editor, 30); // r 1001..1030
		widenB(editor, 2, 4); // B 4..5
		expect(editor.history.length).toBe(35);
		bulkSteps(editor, 1, 31); // r 1031: the oldest pair and the 3 item steps under it go
		expect(editor.history.length).toBe(32);
		expect(editor.history.queue.at(-1).title).toBe('bulk 2');
		undoAll(editor);
		expect(width(editor)).toBe(3);
		expect(width(editor, R)).toBe(1001);
	});
});

describe('undo cap and unfinished whole-project steps', () => {
	it('an action that fails between its pre and post states costs no older step', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		widenB(editor, 200);
		editor.history.addWholeProjectChangePreState('an action that fails');
		editor.history.discardLatestState();
		expect(editor.history.queue).toHaveLength(200);
		expect(editor.history.queue.at(-1).title).toBe('B to 1');
		expect(editor.history.undoFloor).toBe(null);
	});
});

describe('undo cap and the saved file', () => {
	it('saved at the newest dropped step: undo all the way back clears the dot', () => {
		const editor = twoLetterEditor({ fileHandle: { kind: 'file', name: 'Two Letters.gs2' } });
		editor.selectedGlyphID = B;
		widenB(editor, 5);
		editor.setProjectAsSaved(); // the file has B 5
		widenB(editor, 200, 6); // B 6..205: steps 1..5 drop
		expect(document.title).toBe('ANY-INK •');
		undoAll(editor);
		expect(width(editor)).toBe(5);
		expect(document.title).toBe('ANY-INK');
	});

	it('saved at an older dropped step: no undo claims the file matches any more', () => {
		const editor = twoLetterEditor({ fileHandle: { kind: 'file', name: 'Two Letters.gs2' } });
		editor.selectedGlyphID = B;
		widenB(editor, 3);
		editor.setProjectAsSaved(); // the file has B 3
		widenB(editor, 205, 4); // B 4..208: steps 1..8 drop, B 3 is out of reach
		undoAll(editor);
		expect(width(editor)).toBe(8);
		expect(document.title).toBe('ANY-INK •');
	});

	it('opened from its file and capped: the empty list no longer means "as opened"', () => {
		const editor = twoLetterEditor({ fileHandle: { kind: 'file', name: 'Two Letters.gs2' } });
		editor.selectedGlyphID = B;
		widenB(editor, 201);
		undoAll(editor);
		expect(width(editor)).toBe(1);
		expect(document.title).toBe('ANY-INK •');
	});
});

describe('undo cap and crash recovery', () => {
	it('the floor travels with the queue to a restored copy', () => {
		const editor = twoLetterEditor();
		editor.selectedGlyphID = B;
		widenB(editor, 203);
		const snapshot = structuredClone(editor.history.serializeForStorage());

		const restored = new ProjectEditor({
			project: new GlyphrStudioProject(editor.project.save()),
		});
		setCurrentProjectEditor(restored);
		restored.nav.page = 'Characters';
		restored.selectedGlyphID = B;
		expect(restored.history.adoptSnapshot(snapshot)).toBe(true);
		expect(restored.history.queue).toHaveLength(200);
		undoAll(restored);
		expect(restored.project.glyphs[B].advanceWidth).toBe(3);
		// the leave-site check still compares with the font as it was loaded
		expect(restored.history.initialProject.glyphs[B].advanceWidth).toBe(0);
	});
});
