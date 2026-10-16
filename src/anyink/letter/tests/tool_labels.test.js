// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 tool column (UX-BEGINNER.md 4.3 Tools, 2.4 D, section 10 B7 "tools.js: word labels, the
// Point pen caption, Fine-tune grouping"): in the Simple letter view each tool shows its icon,
// its house word under it and its key in small print; the Point pen says "click to place points";
// Select (and the Brush, from B8) always show, while Edit points, Point pen, Rectangle and Oval
// show only while Fine-tune is open (view_switches.js fineTuneShows('tools')), except the tool
// that is picked, which never hides. All tools, and Simple before 'letterView', draw the column
// exactly as today. B8 + B9 integration: the Brush (B8, 'brush' on in the app) is in both modes'
// columns: first in the Simple letter view, after New path in All tools (7.6, visibility.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEditToolsButtons, selectTool } from '../../../edit_canvas/tools/tools.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { toolKey } from '../../mode/keys.js';
import { setModeForTests } from '../../mode/mode.js';
import { isVisible, sampleEditor } from '../../mode/tests/controls_probe.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

// S4 turned 'sketch' on; these tests read Simple as B16 shipped it, with the
// flag off (the sketch's own column, keys and door are the S2 / S3 tests)
beforeEach(() => {
	setFeaturesForTests({ sketch: false });
});

const FINE_TUNE = ['pathEdit', 'newPath', 'newRectangle', 'newOval'];

let editor;
let warn;

function letterPage() {
	editor = sampleEditor();
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.eventHandlers.tool_addPath = {};
	editor.editCanvas = { redraw() {} };
	editor.selectedTool = 'resize';
}

/** The column as the page draws it: its buttons and rules, in order */
function drawColumn() {
	const area = document.createElement('div');
	area.className = 'editor-page__tools-area';
	makeEditToolsButtons().forEach((element) => area.appendChild(element));
	document.body.replaceChildren(area);
	return area;
}

const buttons = (area) => [...area.querySelectorAll('button')];
const ids = (list) => list.map((button) => button.dataset.anyinkTool);
const shownIds = (area) => ids(buttons(area).filter(isVisible));
const button = (area, tool) => area.querySelector(`[data-anyink-tool="${tool}"]`);
const wordOf = (el) => el.querySelector('.anyink-tool__word')?.textContent ?? null;
const keyOf = (el) => el.querySelector('.anyink-tool__key')?.textContent ?? null;

function simpleLetterView() {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
}

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetLetterViewForTests();
	letterPage();
});
afterEach(() => {
	warn.mockRestore();
	resetLetterViewForTests();
	document.body.innerHTML = '';
	setModeForTests('all');
});

describe('All tools and Simple before the letter view: the column as today', () => {
	it('All tools: the six tools in upstream order, then the Brush after New path, icons only', () => {
		const area = drawColumn();
		expect(ids(buttons(area))).toEqual([
			'newRectangle',
			'newOval',
			'newPath',
			'nib',
			'pathAddPoint',
			'pathEdit',
			'resize',
		]);
		expect(shownIds(area)).toEqual(ids(buttons(area)));
		expect(area.querySelector('.anyink-tool__word, .anyink-tool--labeled')).toBeNull();
		expect(button(area, 'newPath').title).toBe('New path');
		expect(button(area, 'nib').title).toBe('Brush');
	});

	it('All tools before B8 (the brush flag off): the six tools as upstream has them', () => {
		setFeaturesForTests({ brush: false });
		const area = drawColumn();
		expect(shownIds(area)).toEqual([
			'newRectangle',
			'newOval',
			'newPath',
			'pathAddPoint',
			'pathEdit',
			'resize',
		]);
	});

	it('Simple without letterView: B5’s column (no Add a point), icons only', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false }); // on in the app since B7
		const area = drawColumn();
		expect(shownIds(area)).toEqual([
			'newRectangle',
			'newOval',
			'newPath',
			'nib',
			'pathEdit',
			'resize',
		]);
		expect(area.querySelector('.anyink-tool__word')).toBeNull();
	});
});

describe('Simple letter view', () => {
	it('the Brush, then Select, then the Fine-tune tools: Edit points, Point pen, Rectangle, Oval', () => {
		simpleLetterView();
		const area = drawColumn();
		expect(ids(buttons(area))).toEqual(['nib', 'resize', ...FINE_TUNE]);
		expect(button(area, 'nib').dataset.anyinkToolGroup).toBeUndefined();
		FINE_TUNE.forEach((tool) => {
			expect(button(area, tool).dataset.anyinkToolGroup).toBe('fineTune');
		});
		expect(button(area, 'resize').dataset.anyinkToolGroup).toBeUndefined();
	});

	it('each tool shows its house word under the icon and its key in small print', () => {
		simpleLetterView();
		const area = drawColumn();
		['resize', ...FINE_TUNE].forEach((tool) => {
			const el = button(area, tool);
			expect(el.querySelector('svg')).not.toBeNull();
			expect(wordOf(el)).toBe(word(`tool.${tool}`));
			expect(keyOf(el)).toBe(toolKey(tool));
			expect(el.classList.contains('anyink-tool--labeled')).toBe(true);
		});
		expect(wordOf(button(area, 'resize'))).toBe('Select');
		expect(wordOf(button(area, 'newPath'))).toBe('Point pen');
		expect(keyOf(button(area, 'newPath'))).toBe('P');
	});

	it('the Point pen says how it works: "click to place points"', () => {
		simpleLetterView();
		const area = drawColumn();
		const caption = button(area, 'newPath').querySelector('.anyink-tool__caption');
		expect(caption?.textContent).toBe('click to place points');
		expect(area.querySelectorAll('.anyink-tool__caption')).toHaveLength(1);
	});

	it('Fine-tune closed hides the extra tools; opening it shows them; closing hides them again', () => {
		simpleLetterView();
		const area = drawColumn();
		expect(shownIds(area)).toEqual(['nib', 'resize']);
		setFineTuneOpen(true, editor);
		expect(shownIds(area)).toEqual(['nib', 'resize', ...FINE_TUNE]);
		setFineTuneOpen(false, editor);
		expect(shownIds(area)).toEqual(['nib', 'resize']);
	});

	it('a column drawn while Fine-tune is open shows them at once', () => {
		simpleLetterView();
		setFineTuneOpen(true, editor);
		expect(shownIds(drawColumn())).toEqual(['nib', 'resize', ...FINE_TUNE]);
	});

	it('the picked tool never hides, and keeps its words when the pick changes', () => {
		simpleLetterView();
		const area = drawColumn();
		selectTool('newRectangle');
		expect(shownIds(area)).toEqual(['nib', 'resize', 'newRectangle']);
		const rectangle = button(area, 'newRectangle');
		expect(rectangle.classList.contains('editor-page__tool-selected')).toBe(true);
		expect(wordOf(rectangle)).toBe('Rectangle');
		expect(keyOf(rectangle)).toBe('R');
		selectTool('resize');
		expect(shownIds(area)).toEqual(['nib', 'resize']);
		expect(wordOf(rectangle)).toBe('Rectangle');
		expect(wordOf(button(area, 'resize'))).toBe('Select');
	});

	it('a column drawn with a Fine-tune tool picked shows that one', () => {
		simpleLetterView();
		editor.selectedTool = 'newOval';
		expect(shownIds(drawColumn())).toEqual(['nib', 'resize', 'newOval']);
	});

	it('the rule between Select and the Fine-tune tools shows only with them', () => {
		simpleLetterView();
		const area = drawColumn();
		const rule = area.querySelector('.anyink-tool-rail__rule');
		expect(rule).not.toBeNull();
		expect(isVisible(rule)).toBe(false);
		setFineTuneOpen(true, editor);
		expect(isVisible(rule)).toBe(true);
	});
});

scanSimpleScreen('the letter view’s tool column, Fine-tune closed and open, a tool picked', () => {
	setFeaturesForTests({ letterView: true });
	resetLetterViewForTests();
	letterPage();
	const closed = drawColumn();
	const parts = [closed.cloneNode(true)];
	setFineTuneOpen(true, editor);
	selectTool('newPath');
	parts.push(closed.cloneNode(true));
	const root = document.createElement('div');
	parts.forEach((part) => root.appendChild(part));
	document.body.replaceChildren(root);
	return root;
});
