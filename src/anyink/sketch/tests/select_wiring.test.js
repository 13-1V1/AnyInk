// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 wiring: the card's sections for a pick and [Edit sketch]; the mouse route (a press on
	nothing of the sketch tries the guides layer first, then starts a window; a right press is
	never Select's); the draw layer paints Select's window, the group's handles and the grips.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flagsOn, resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { cardSections, mainButtons } from '../../letter/letter_card.js';
import {
	installSketchSelect,
	sketchPickOf,
	uninstallSketchSelectForTests,
} from '../select_tool.js';
import { drawSketchLayer } from '../tools/draw_layer.js';
import { sketchSelectPointer } from '../tools/tool_route.js';
import { VIEW } from '../tools/tests/fake_ctx.js';
import { glyphIdOf, openSketchFont } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';

let handler = null;

function openN() {
	const editor = openSketchFont({ n: storedSketch('n') });
	showItem(editor, glyphIdOf('n'));
	editor.history.addState('sketched a line on small n');
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
	return editor;
}

/** A mouse event at font units (x, y) on VIEW */
const mouse = (x, y, extra = {}) => ({
	button: 0,
	buttons: 1,
	detail: 1,
	offsetX: VIEW.dx + x * VIEW.dz,
	offsetY: VIEW.dy - y * VIEW.dz,
	...extra,
});
const at = (x, y) => ({ x: VIEW.dx + x * VIEW.dz, y: VIEW.dy - y * VIEW.dz });

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, checks: false, sketch: true });
	handler = installSketchSelect();
});
afterEach(() => {
	uninstallSketchSelectForTests();
	resetFeaturesForTests();
	setModeForTests('all');
	vi.restoreAllMocks();
});

describe('the card', () => {
	const isOn = flagsOn('letterView', 'brush', 'sketch');
	const base = {
		hasShapes: true,
		photoCardOpen: false,
		sketch: { pieces: true, centerline: true },
	};

	it('a pick puts the Sketch piece section right under Sketch', () => {
		const sections = cardSections({ ...base, sketchPiece: { what: 'point' } }, isOn);
		expect(sections.slice(0, 3)).toEqual(['header', 'sketch', 'sketchPiece']);
		expect(cardSections({ ...base, sketchPiece: null }, isOn)).not.toContain('sketchPiece');
	});

	it('[Edit sketch] on a sketched letter while another tool is picked; never on Select', () => {
		expect(mainButtons({ ...base, tool: 'sketchLine' }, isOn)).toEqual(['editSketch']);
		expect(mainButtons({ ...base, tool: 'resize' }, isOn)).toEqual([]);
		expect(mainButtons({ ...base, tool: 'sketchLine' }, flagsOn('brush'))).toEqual(['drawOver']);
	});
});

describe('the mouse route', () => {
	it("a press on the sketch is Select's; the guides layer never hears it", () => {
		const editor = openN();
		const guides = vi.fn(() => true);
		const down = mouse(560, 760);
		expect(sketchSelectPointer('down', down, { editor, at: at(560, 760), guides })).toBe(true);
		expect(guides).not.toHaveBeenCalled();
		sketchSelectPointer('up', mouse(560, 760, { buttons: 0 }), {
			editor,
			at: at(560, 760),
			guides,
		});
		expect(sketchPickOf(editor)?.points).toEqual(['shoulder']);
	});

	it('a press on nothing goes to the guides layer first; when it takes it, no window', () => {
		const editor = openN();
		const guides = vi.fn(() => true);
		sketchSelectPointer('down', mouse(900, 600), { editor, at: at(900, 600), guides });
		expect(guides).toHaveBeenCalledTimes(1);
		expect(handler.busy()).toBe(false);
	});

	it('when the guides layer leaves it, the press starts a window', () => {
		const editor = openN();
		const guides = vi.fn(() => false);
		sketchSelectPointer('down', mouse(900, 600), { editor, at: at(900, 600), guides });
		expect(handler.busy()).toBe(true);
		sketchSelectPointer('move', mouse(-50, 1200), { editor, at: at(-50, 1200), guides });
		sketchSelectPointer('up', mouse(-50, 1200, { buttons: 0 }), {
			editor,
			at: at(-50, 1200),
			guides,
		});
		// right to left: everything it touches
		expect(sketchPickOf(editor).pieces.sort()).toEqual([1, 2]);
	});

	it('a right press and All tools are never Select on the sketch', () => {
		const editor = openN();
		expect(sketchSelectPointer('down', mouse(560, 760, { button: 2 }), { editor })).toBe(false);
		setModeForTests('all');
		expect(sketchSelectPointer('down', mouse(560, 760), { editor })).toBe(false);
	});
});

describe('the draw layer', () => {
	function fakeCtx() {
		const calls = [];
		const ctx = new Proxy(
			{ canvas: { width: 800, height: 600 } },
			{
				get(target, name) {
					if (name in target) return target[name];
					return (...args) => calls.push([name, ...args]);
				},
				set(target, name, value) {
					target[name] = value;
					return true;
				},
			}
		);
		return { ctx, calls };
	}

	it('every point shows; a picked point gets its grips', () => {
		const editor = openN();
		handler.setPick(editor, { points: ['middle'], pieces: [] });
		const s = openSketchFont({ s: storedSketch('s') });
		showItem(s, glyphIdOf('s'));
		s.history.addState('sketched a spline on small s');
		s.selectedTool = 'resize';
		handler.sync(s);
		handler.setPick(s, { points: ['middle'], pieces: [] });
		const { ctx } = fakeCtx();
		const picture = drawSketchLayer(ctx, VIEW, s.selectedItem, s);
		expect(picture.points).toHaveLength(7);
		expect(picture.points.find((p) => p.id === 'middle').hot).toBe(true);
		expect(picture.grips).toMatchObject({ id: 'middle', turns: true });
		expect(picture.handles).toBe(null);
	});

	it('a group pick gets its four corner handles', () => {
		const editor = openN();
		handler.sync(editor);
		handler.setPick(editor, { points: [], pieces: [1] });
		const { ctx } = fakeCtx();
		const picture = drawSketchLayer(ctx, VIEW, editor.selectedItem, editor);
		// the stem is plumb: a box with no width still has its handles (top and bottom)
		expect(picture.handles).toHaveLength(4);
		expect(picture.grips).toBe(null);
	});
});
