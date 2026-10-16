// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5): Select on a sketch against the real editor and History. In
	Simple with the flag on, Select on a letter whose sketch is live is Select on the sketch
	(tool_route.js); it picks, drags, nudges and deletes the sketch, every change ONE named step
	whose ink is rebuilt inside it, and the sketch is never set aside. Delete says what it took
	with [Undo], and Undo brings the piece and its ink back. Events are shaped as tool_route.js
	makes them.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { pieceSkeleton } from '../curves.js';
import { sketchOf } from '../model.js';
import { pickBox, pointOnCubics } from '../pick.js';
import { makeSketchPieceSection, sketchPieceState } from '../piece_card.js';
import {
	installSketchSelect,
	runSketchEdit,
	sketchPickOf,
	uninstallSketchSelectForTests,
} from '../select_tool.js';
import { builtMatches, builtShapes } from '../sketch_record.js';
import { SELECT_TOOL, activeSketchTool, sketchSelectApplies } from '../tools/tool_route.js';
import { VIEW } from '../tools/tests/fake_ctx.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';

const N = glyphIdOf('n');
let handler = null;

/** small n, sketched and built (one step), Select picked */
function openN() {
	const editor = openSketchFont({ n: storedSketch('n') });
	showItem(editor, N);
	editor.history.addState('sketched a line on small n');
	editor.selectedTool = 'resize';
	return editor;
}

/** Events as tool_route.js gives them (font units; canvas pixels from VIEW) */
function pointer(editor) {
	const ev = (x, y, extra = {}) => ({
		x,
		y,
		cx: VIEW.dx + x * VIEW.dz,
		cy: VIEW.dy - y * VIEW.dz,
		detail: 1,
		buttons: 1,
		shift: false,
		ctrl: false,
		view: VIEW,
		editor,
		item: editor.selectedItem,
		...extra,
	});
	return {
		click(x, y, extra) {
			handler.move(ev(x, y, { buttons: 0, ...extra }));
			handler.down(ev(x, y, extra));
			handler.up(ev(x, y, extra));
		},
		drag(from, to, extra = {}) {
			handler.down(ev(from.x, from.y, extra));
			const steps = 4;
			for (let i = 1; i <= steps; i++) {
				const x = from.x + ((to.x - from.x) * i) / steps;
				const y = from.y + ((to.y - from.y) * i) / steps;
				handler.move(ev(x, y, extra));
			}
			handler.up(ev(to.x, to.y, extra));
		},
		double(x, y) {
			handler.doubleClick(ev(x, y, { detail: 2 }));
		},
		key(key, type = 'down', extra = {}) {
			return handler.key({ type, key, editor, ctrl: false, shift: false, alt: false, ...extra });
		},
	};
}

const titles = (editor) => editor.history.queue.map((entry) => entry.title);

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, checks: false, sketch: true });
	resetToastsForTests();
	handler = installSketchSelect();
});
afterEach(() => {
	uninstallSketchSelectForTests();
	resetToastsForTests();
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('Select on a live sketch', () => {
	it('is what Select is in Simple on a sketched letter, never in All tools or with the flag off', () => {
		const editor = openN();
		expect(sketchSelectApplies(editor)).toBe(true);
		expect(activeSketchTool(editor)).toMatchObject({ tool: SELECT_TOOL, handler });
		setModeForTests('all');
		expect(sketchSelectApplies(editor)).toBe(false);
		setModeForTests('simple');
		setFeaturesForTests({ sketch: false });
		expect(sketchSelectApplies(editor)).toBe(false);
		setFeaturesForTests({ sketch: true });
		editor.selectedTool = 'sketchLine';
		expect(sketchSelectApplies(editor)).toBe(false);
	});

	it('a click picks a piece; Ctrl+click adds a point; a click on nothing clears', () => {
		const editor = openN();
		const p = pointer(editor);
		p.click(120, 400);
		expect(sketchPickOf(editor)).toMatchObject({ points: [], pieces: [1] });
		p.click(560, 50, { ctrl: true });
		expect(sketchPickOf(editor)).toMatchObject({ points: ['rightFoot'], pieces: [1] });
		p.click(900, 600);
		expect(sketchPickOf(editor)).toBe(null);
	});

	it('a point dragged: ONE step, ink rebuilt with it, never set aside', () => {
		const editor = openN();
		const before = JSON.stringify(builtShapes(editor.selectedItem).map((s) => s.save()));
		const steps = editor.history.queue.length;
		pointer(editor).drag({ x: 560, y: 760 }, { x: 640, y: 760 });
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(titles(editor)[0]).toBe('moved a sketch point on small n');
		const n = editor.selectedItem;
		expect(sketchOf(n).setAside).toBe(false);
		expect(sketchOf(n).points.shoulder.x).toBe(640);
		expect(builtMatches(n)).toBe(true);
		expect(JSON.stringify(builtShapes(n).map((s) => s.save()))).not.toBe(before);
	});

	it('a drag publishes a narrow topic per tick and once on release', () => {
		const editor = openN();
		const seen = [];
		editor.subscribe({
			topic: 'sketchEdit',
			subscriberID: 'anyink.test.sketchEditTicks',
			callback: (data) => seen.push(data.dragging),
		});
		pointer(editor).drag({ x: 560, y: 760 }, { x: 600, y: 760 });
		expect(seen.filter((d) => d === true).length).toBeGreaterThan(1);
		expect(seen.at(-1)).toBe(false);
	});

	it('a window round the stem picks its points; dragging one moves them all, one step', () => {
		const editor = openN();
		const p = pointer(editor);
		p.drag({ x: 60, y: -20 }, { x: 180, y: 1120 });
		const pick = sketchPickOf(editor);
		expect(pick.points.sort()).toEqual(['foot', 'join', 'stemTop']);
		const steps = editor.history.queue.length;
		p.drag({ x: 120, y: 50 }, { x: 180, y: 50 });
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(titles(editor)[0]).toBe('moved part of small n');
		// automatic spacing refits the letter inside the step: read the stem against the leg
		const sketch = sketchOf(editor.selectedItem);
		expect(sketch.points.foot).toMatchObject({ y: 50, on: 'writing' });
		expect(sketch.points.stemTop.x).toBe(sketch.points.foot.x);
		expect(sketch.points.rightFoot.x - sketch.points.foot.x).toBe(560 - 180);
		expect(builtMatches(editor.selectedItem)).toBe(true);
	});

	it('the arrows nudge the pick: one step for the whole run of presses', () => {
		const editor = openN();
		const p = pointer(editor);
		p.click(560, 760);
		const steps = editor.history.queue.length;
		expect(p.key('arrowright')).toBe(true);
		p.key('arrowright');
		p.key('arrowright', 'down', { shift: true });
		expect(editor.history.queue.length).toBe(steps);
		p.key('arrowright', 'up');
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(titles(editor)[0]).toBe('nudged sketch points on small n');
		const points = sketchOf(editor.selectedItem).points;
		expect(points.shoulder.x - points.foot.x).toBe(560 + 12 - 120);
	});

	it('a double-click on a point toggles Smooth / Corner, on a piece adds a point', () => {
		const editor = openN();
		const p = pointer(editor);
		p.double(560, 760);
		expect(titles(editor)[0]).toBe('made a point a corner on small n');
		expect(sketchOf(editor.selectedItem).points.shoulder.kind).toBe('corner');
		p.double(560, 400);
		expect(titles(editor)[0]).toBe('added a sketch point on small n');
		expect(sketchPickOf(editor).points).toHaveLength(1);
	});
});

describe('Bend, Lines, handles, circles and the conflict toast', () => {
	it('an unpicked curve dragged bends it; an unpicked Line dragged moves it', () => {
		const editor = openN();
		const p = pointer(editor);
		const sketch = sketchOf(editor.selectedItem);
		const arch = pointOnCubics(pieceSkeleton(sketch.pieces[1], sketch), 0.2);
		p.drag(arch, { x: arch.x - 20, y: arch.y + 60 });
		expect(titles(editor)[0]).toBe('bent a curve on small n');
		expect(sketchOf(editor.selectedItem).points.archTop.aim).toBeTruthy();
		const foot = sketchOf(editor.selectedItem).points.foot;
		p.drag({ x: foot.x, y: 400 }, { x: foot.x - 30, y: 420 });
		expect(titles(editor)[0]).toBe('moved a line on small n');
		const points = sketchOf(editor.selectedItem).points;
		expect(points.foot.on).toBe('writing');
		expect(points.stemTop.x).toBe(points.foot.x);
	});

	it("a group's corner handle scales it: one step, the thickness kept", () => {
		const editor = openN();
		const p = pointer(editor);
		const sketch = sketchOf(editor.selectedItem);
		const leg = sketch.points.rightFoot;
		p.click(leg.x, 400);
		expect(sketchPickOf(editor).pieces).toEqual([2]);
		// the top right handle sits a snap radius (20) outside the arch's box
		const box = pickBox(sketch, { points: [], pieces: [2] });
		const handle = { x: box.xMax + 20, y: box.yMax + 20 };
		p.drag(handle, { x: handle.x + 60, y: handle.y + 60 });
		expect(titles(editor)[0]).toBe('resized part of small n');
		expect(sketchOf(editor.selectedItem).thickness).toBe(sketch.thickness);
	});

	it("a circle's edge resizes it about its center", () => {
		const editor = openSketchFont({ o: storedSketch('circle') });
		showItem(editor, glyphIdOf('o'));
		editor.history.addState('sketched a circle on small o');
		editor.selectedTool = 'resize';
		const p = pointer(editor);
		const c4 = sketchOf(editor.selectedItem).points.c4;
		const circle = sketchOf(editor.selectedItem).pieces[0].circle;
		p.drag({ x: circle.cx + 106, y: circle.cy + 106 }, { x: circle.cx + 140, y: circle.cy + 140 });
		expect(titles(editor)[0]).toBe('resized a circle on small o');
		const after = sketchOf(editor.selectedItem).pieces[0].circle;
		expect(after.rx).toBe(after.ry);
		expect(after.rx).toBeGreaterThan(circle.rx);
		expect(c4).toBeTruthy();
	});

	it('a level partner pinned to its line lets go of it: the toast says so, with [Undo]', () => {
		const sketch = storedSketch('A');
		sketch.relations = [{ type: 'level', a: 'barLeft', b: 'rightFoot' }];
		const editor = openSketchFont({ A: sketch });
		showItem(editor, glyphIdOf('A'));
		editor.history.addState('sketched a line on Capital A');
		editor.selectedTool = 'resize';
		const bar = sketchOf(editor.selectedItem).points.barLeft;
		pointer(editor).drag({ x: bar.x, y: bar.y }, { x: bar.x, y: bar.y + 120 });
		expect(titles(editor)[0]).toBe('moved a sketch point on Capital A');
		const said = toastLog().at(-1);
		expect(said.key).toBe('sketch.toast.cantKeepBoth');
		expect(said.text).toBe("Can't keep both: a point of Capital A let go of the writing line.");
	});
});

describe('Delete and Undo', () => {
	it('Delete on a picked piece: one step, the toast names it with [Undo]; Undo brings it back', () => {
		const editor = openN();
		const p = pointer(editor);
		const shapes = (item) => JSON.stringify(builtShapes(item).map((shape) => shape.save()));
		const built = shapes(editor.selectedItem);
		p.click(120, 400);
		expect(p.key('delete')).toBe(true);
		expect(titles(editor)[0]).toBe('deleted a piece of small n');
		const n = editor.selectedItem;
		expect(sketchOf(n).pieces.map((piece) => piece.id)).toEqual([2]);
		expect(shapes(n)).not.toBe(built);
		expect(builtMatches(n)).toBe(true);
		const said = toastLog().at(-1);
		expect(said.key).toBe('sketch.toast.pieceDeleted');
		expect(said.text).toBe('Deleted a piece of small n.');
		expect(said.shown).toBe(true);
		expect(document.body.textContent).toContain('Undo');
		editor.history.restoreState();
		const back = editor.selectedItem;
		expect(sketchOf(back).pieces.map((piece) => piece.id)).toEqual([1, 2]);
		expect(shapes(back)).toBe(built);
		expect(builtMatches(back)).toBe(true);
		expect(sketchOf(back).setAside).toBe(false);
	});

	it('Delete with nothing picked goes on to the key map; Esc lets go of the pick first', () => {
		const editor = openN();
		const p = pointer(editor);
		expect(p.key('delete')).toBe(false);
		p.click(560, 760);
		expect(p.key('escape')).toBe(true);
		expect(sketchPickOf(editor)).toBe(null);
		expect(p.key('escape')).toBe(false);
	});
});

describe('the card for a picked point or piece', () => {
	it('a point: Smooth / Corner pressed as it is, Delete; Corner is one step', () => {
		const editor = openN();
		pointer(editor).click(560, 760);
		const state = sketchPieceState(editor);
		expect(state).toMatchObject({ what: 'point', kind: 'smooth', locked: false, end: null });
		const section = makeSketchPieceSection(state, editor);
		document.body.append(section);
		expect(
			section.querySelector('[data-anyink-sketch="smooth"]').getAttribute('aria-pressed')
		).toBe('true');
		section.querySelector('[data-anyink-sketch="corner"]').click();
		expect(titles(editor)[0]).toBe('made a point a corner on small n');
	});

	it('an aimed point offers [Let it flow]; an open end offers This end under More', () => {
		const editor = openN();
		const p = pointer(editor);
		p.click(120, 820);
		expect(sketchPieceState(editor)).toMatchObject({ what: 'point', locked: true });
		expect(runSketchEdit(editor, 'flow')).toBe(true);
		expect(titles(editor)[0]).toBe('let a curve flow on small n');
		const foot = sketchOf(editor.selectedItem).points.rightFoot;
		p.click(foot.x, foot.y);
		const state = sketchPieceState(editor);
		expect(state.end).toBe('round');
		expect(runSketchEdit(editor, 'endFlat')).toBe(true);
		expect(titles(editor)[0]).toBe('made one end flat on small n');
	});
});
