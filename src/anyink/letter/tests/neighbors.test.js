// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 letter view, neighbors (UX-BEGINNER.md 4.3 Canvas): only while Fine-tune is open, and on by
// default once his n or H is ready: his n faintly on each side of a small letter, his H for a
// capital, placed the way they would type (gap fixes included). The first time, each is labeled
// "Your small n, shown for comparing". Drawn by a view-only override: it never writes to the
// letter or the font (upstream's context characters write item.contextCharacters and a project
// setting), and the Neighbors switch never marks the file changed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { square } from '../../history/tests/two_letters.js';
import { getSaveStatus } from '../../files/save_status.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { getDirtyGeneration } from '../../recovery/recovery.js';
import { word } from '../../words/words.js';
import { resetGuideLetterForTests } from '../guide_letter.js';
import {
	drawNeighbors,
	neighborChar,
	neighborItem,
	neighborLayout,
	neighborsAvailable,
	neighborsShown,
	resetNeighborsForTests,
} from '../neighbors.js';
import {
	isNeighborsOn,
	resetLetterViewForTests,
	setFineTuneOpen,
	setNeighbors,
} from '../view_switches.js';

const VIEW = Object.freeze({ dx: 400, dy: 500, dz: 0.5 });
const ids = { a: 'glyph-0x61', n: 'glyph-0x6E', o: 'glyph-0x6F', B: 'glyph-0x42', H: 'glyph-0x48' };

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal('requestAnimationFrame', (callback) => callback()); // draw now, not next frame
	resetNeighborsForTests();
	resetLetterViewForTests();
	resetGuideLetterForTests();
});
afterEach(() => {
	warn.mockRestore();
	vi.unstubAllGlobals();
	resetNeighborsForTests();
	resetLetterViewForTests();
	resetGuideLetterForTests();
});

/** small a, n and o and Capital B and H; n and B have ink, the others as given. */
function font({ withH = false, kern = null } = {}) {
	const letter = (id, shapes, advanceWidth) => ({
		id,
		advanceWidth,
		shapes: shapes.map((shape) => shape.save()),
		anyink: { spacing: 'manual' },
	});
	const project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Neighbors',
				id: 'g2_NEIGHBORS',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'Neighbors', upm: 1000, ascent: 800, descent: -200, capHeight: 700, xHeight: 500 },
		},
		glyphs: {
			[ids.a]: letter(ids.a, [square(40, 400)], 480),
			[ids.n]: letter(ids.n, [square(40, 420)], 500),
			[ids.o]: { id: ids.o, advanceWidth: 0, shapes: [] },
			[ids.B]: letter(ids.B, [square(40, 600)], 680),
			...(withH ? { [ids.H]: letter(ids.H, [square(40, 620)], 700) } : {}),
		},
		kerning: kern
			? { 'kern-1': { id: 'kern-1', leftGroup: ['0x6E'], rightGroup: ['0x61'], value: kern } }
			: {},
	});
	const editor = new ProjectEditor();
	editor.project = project;
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	return editor;
}

function open(editor, id) {
	showItem(editor, id);
	editor.view = { ...VIEW };
	editor.editCanvas = { redraw() {} };
	return editor.selectedItem;
}

function simpleFineTune() {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
	setFineTuneOpen(true);
}

function context() {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	return canvas.getContext('2d');
}

const texts = (ctx) =>
	ctx
		.__getEvents()
		.filter((e) => e.type === 'fillText')
		.map((e) => e.props.text);

describe('which letter is the neighbor', () => {
	it('his n beside small letters and punctuation, his H beside capitals and numbers', () => {
		expect(neighborChar('a')).toBe('n');
		expect(neighborChar('n')).toBe('n');
		expect(neighborChar('.')).toBe('n');
		expect(neighborChar('B')).toBe('H');
		expect(neighborChar('H')).toBe('H');
		expect(neighborChar('7')).toBe('H');
		expect(neighborChar('é')).toBe('n');
		expect(neighborChar('É')).toBe('H');
	});

	it('only a ready neighbor counts: one with ink and a width; nothing is made for it', () => {
		const editor = font();
		const a = open(editor, ids.a);
		expect(neighborItem(a, editor.project)?.id).toBe(ids.n);
		const B = open(editor, ids.B);
		expect(neighborItem(B, editor.project)).toBe(null); // no H in the font
		expect(editor.project.glyphs[ids.H]).toBeUndefined(); // and none was made
		editor.project.glyphs[ids.n].advanceWidth = 0;
		expect(neighborItem(a, editor.project)).toBe(null);
		expect(neighborsAvailable(a, editor.project)).toBe(false);
	});
});

describe('when neighbors show', () => {
	it('Simple, the letter view on, Fine-tune open, the switch on (its default), n ready', () => {
		const editor = font();
		const a = open(editor, ids.a);
		expect(neighborsShown(a, editor.project)).toBe(false); // All tools
		setModeForTests('simple');
		expect(neighborsShown(a, editor.project)).toBe(false); // the letter view not on yet
		setFeaturesForTests({ letterView: true });
		expect(neighborsShown(a, editor.project)).toBe(false); // Fine-tune closed
		setFineTuneOpen(true);
		expect(isNeighborsOn()).toBe(true);
		expect(neighborsShown(a, editor.project)).toBe(true);
		setNeighbors(false, editor);
		expect(neighborsShown(a, editor.project)).toBe(false);
		setNeighbors(true, editor);
		expect(neighborsShown(a, editor.project)).toBe(true);
	});

	it('not on an empty letter, and not beside a capital until his H is ready', () => {
		simpleFineTune();
		const editor = font();
		expect(neighborsShown(open(editor, ids.o), editor.project)).toBe(false);
		expect(neighborsShown(open(editor, ids.B), editor.project)).toBe(false);
	});
});

describe('drawing', () => {
	it('his n on each side, where it would type, faint', () => {
		simpleFineTune();
		const editor = font();
		const a = open(editor, ids.a);
		const n = editor.project.glyphs[ids.n];
		const layout = neighborLayout(a, n, editor.view, editor.project);
		expect(layout.left.dx).toBeCloseTo(VIEW.dx - n.advanceWidth * VIEW.dz, 6);
		expect(layout.right.dx).toBeCloseTo(VIEW.dx + a.advanceWidth * VIEW.dz, 6);
		const ctx = context();
		expect(drawNeighbors(ctx, editor.view, a, editor.project)).toBe(true);
		expect(ctx.__getEvents().filter((e) => e.type === 'fill')).toHaveLength(2);
	});

	it('a gap fix between n and the letter brings that neighbor closer', () => {
		simpleFineTune();
		const editor = font({ kern: -60 });
		const a = open(editor, ids.a);
		const n = editor.project.glyphs[ids.n];
		const layout = neighborLayout(a, n, editor.view, editor.project);
		expect(layout.left.dx).toBeCloseTo(VIEW.dx - (n.advanceWidth - 60) * VIEW.dz, 6);
		expect(layout.right.dx).toBeCloseTo(VIEW.dx + a.advanceWidth * VIEW.dz, 6);
	});

	it('the first time each is labeled "Your small n, shown for comparing"; after that, never', () => {
		simpleFineTune();
		const editor = font({ withH: true });
		const label = word('letterCanvas.neighborLabel', { letter: 'small n' });
		const first = context();
		drawNeighbors(first, editor.view, open(editor, ids.a), editor.project);
		expect(texts(first)).toEqual([label, label]);
		// the same visit, drawn again: still labeled
		const again = context();
		drawNeighbors(again, editor.view, editor.selectedItem, editor.project);
		expect(texts(again)).toEqual([label, label]);
		// another letter: no label
		const later = context();
		drawNeighbors(later, editor.view, open(editor, ids.B), editor.project);
		expect(later.__getEvents().filter((e) => e.type === 'fill')).toHaveLength(2);
		expect(texts(later)).toEqual([]);
	});

	it('nothing is drawn when they do not show', () => {
		const editor = font();
		const ctx = context();
		expect(drawNeighbors(ctx, VIEW, open(editor, ids.a), editor.project)).toBe(false);
		expect(ctx.__getEvents()).toHaveLength(0);
	});
});

describe('view-only: neighbors never write to the letter or the font', () => {
	function snapshot(editor) {
		return {
			font: JSON.stringify(editor.project.save()),
			steps: editor.history.queue.length,
			dirty: getDirtyGeneration(),
			status: getSaveStatus(editor).revision,
			context: editor.selectedItem.contextCharacters,
			settings: JSON.stringify(editor.project.settings.app.contextCharacters),
		};
	}

	it('drawing them, on the canvas and through the real redraw, changes nothing', () => {
		simpleFineTune();
		const editor = font({ withH: true, kern: -30 });
		const a = open(editor, ids.a);
		const before = snapshot(editor);
		drawNeighbors(context(), editor.view, a, editor.project);
		const canvas = document.createElement('canvas');
		canvas.width = 1200;
		canvas.height = 1000;
		const host = {
			ctx: canvas.getContext('2d'),
			width: 1200,
			height: 1000,
			editingItemID: editor.selectedItemID,
		};
		EditCanvas.prototype.redraw.call(host, 'test');
		expect(snapshot(editor)).toEqual(before);
		expect(editor.project.settings.app.contextCharacters.showCharacters).toBeFalsy();
	});

	it('toggling the Neighbors switch does not mark the file changed', () => {
		simpleFineTune();
		const editor = font();
		open(editor, ids.a);
		const before = snapshot(editor);
		setNeighbors(false, editor);
		setNeighbors(true, editor);
		setNeighbors(false, editor);
		expect(snapshot(editor)).toEqual(before);
	});

	it('a neighbor with a broken part is left undrawn rather than repaired behind his back', () => {
		simpleFineTune();
		const editor = font();
		const a = open(editor, ids.a);
		const n = editor.project.glyphs[ids.n];
		n.shapes.push({ objType: 'ComponentInstance', link: 'comp-missing', save: () => ({}) });
		const count = n.shapes.length;
		expect(drawNeighbors(context(), editor.view, a, editor.project)).toBe(false);
		expect(n.shapes).toHaveLength(count);
	});
});
