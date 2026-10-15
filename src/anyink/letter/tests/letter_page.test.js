// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 wiring (UX-BEGINNER.md 4.3, 6.3): the real Characters page drawn by the real Navigator.
	In Simple with the letter view, the left area's letter and panel buttons give way to the letter
	header, the panel slot holds the letter card (nav.panel stays 'Attributes' or 'Trace'), an
	empty letter's canvas gets the overlay, and the view switches sit under the canvas inside
	Fine-tune (the upstream outline and paper buttons go: the switches replace them). All tools,
	and Simple before the flag, draw the page exactly as before. The banned-word scan covers every
	state of the new screens (2.3).
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { resetLetterCardForTests } from '../letter_card.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');

/** The stylesheets that decide what shows and its case (vitest skips CSS imports). */
function addStyles() {
	[
		'project_editor/nav.css',
		'anyink/mode/hide.css',
		'anyink/mode/simple_labels.css',
		'anyink/letter/letter.css',
	].forEach((path) => {
		const style = document.createElement('style');
		style.dataset.scan = path;
		style.textContent = css(path);
		document.head.appendChild(style);
	});
}

const square = (x = 100) =>
	new Path({
		name: 'Square',
		pathPoints: [
			{ p: { coord: { x, y: 0 } } },
			{ p: { coord: { x: x + 400, y: 0 } } },
			{ p: { coord: { x: x + 400, y: 400 } } },
			{ p: { coord: { x, y: 400 } } },
		],
	});

/**
 * The Characters page on one letter.
 * @param {Object} options
 * @param {'simple' | 'all'} [options.mode]
 * @param {Boolean} [options.letterView]
 * @param {String} [options.id] - the letter (the sample's A, B and C have ink; D is empty)
 */
function letterPage({ mode = 'simple', letterView = true, id = 'glyph-0x44' } = {}) {
	setModeForTests(mode);
	setFeaturesForTests({ letterView });
	addStyles();
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = id;
	editor.selectedGlyph;
	editor.navigate();
	// jsdom has no <edit-canvas> element; picking a letter redraws it
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return editor;
}

const q = (selector) => document.querySelector(selector);
const visible = (element) => {
	for (let el = element; el; el = el.parentElement) {
		if (el.hidden || getComputedStyle(el).display === 'none') return false;
	}
	return !!element;
};

let quiet;
const hush = () =>
	(quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	]);

beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
beforeEach(() => {
	resetLetterViewForTests();
	resetLetterCardForTests();
	hush();
});
afterEach(() => {
	quiet?.forEach((spy) => spy.mockRestore());
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

describe('Simple with the letter view: the letter page', () => {
	it('the left area holds the header and the panel slot the letter card', () => {
		const editor = letterPage();
		expect(q('.anyink-letter-header')).not.toBeNull();
		expect(q('[data-anyink-letter="name"]').textContent).toBe('Capital D');
		expect(visible(q('#nav-button-l2'))).toBe(false);
		expect(visible(q('#nav-button-l3'))).toBe(false);
		const panel = q('#editor-page__panel');
		expect(panel.querySelector('.anyink-letter-card')).not.toBeNull();
		expect(panel.querySelectorAll('.panel__card').length).toBe(0);
		expect(editor.nav.panel).toBe('Attributes');
	});

	it('keeps nav.panel as Trace too', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Characters';
		editor.nav.panel = 'Trace';
		editor.selectedGlyphID = 'glyph-0x41';
		editor.navigate();
		expect(q('#editor-page__panel .anyink-letter-card')).not.toBeNull();
		expect(editor.nav.panel).toBe('Trace');
	});

	it('an empty letter: the overlay shows over the canvas, the card has no buttons', () => {
		letterPage();
		expect(visible(q('[data-anyink-overlay]'))).toBe(true);
		expect(q('.anyink-letter-card').querySelectorAll('button').length).toBe(0);
		expect([...document.querySelectorAll('.anyink-primary')].filter(visible).length).toBe(1);
	});

	it('a letter with ink: no overlay; Fine-tune closed, so no switches and no extra tools', () => {
		letterPage({ id: 'glyph-0x41' });
		expect(visible(q('[data-anyink-overlay]'))).toBe(false);
		expect(visible(q('.anyink-letter-switches'))).toBe(false);
		const tools = [...document.querySelectorAll('.editor-page__tools-area [data-anyink-tool]')]
			.filter(visible)
			.map((button) => button.dataset.anyinkTool);
		expect(tools).toEqual(['resize']);
	});

	it('opening Fine-tune shows the switches and the extra tools', () => {
		const editor = letterPage({ id: 'glyph-0x41' });
		q('[data-anyink-toggle="fineTune"]').click();
		expect(visible(q('.anyink-letter-switches'))).toBe(true);
		const tools = [...document.querySelectorAll('.editor-page__tools-area [data-anyink-tool]')]
			.filter(visible)
			.map((button) => button.dataset.anyinkTool);
		expect(tools).toEqual(expect.arrayContaining(['resize', 'pathEdit', 'newPath', 'newRectangle', 'newOval']));
		setFineTuneOpen(false, editor);
		expect(visible(q('.anyink-letter-switches'))).toBe(false);
	});

	it("an empty letter's first ink brings Fine-tune's switches, when Fine-tune is open", () => {
		const editor = letterPage();
		setFineTuneOpen(true, editor);
		expect(visible(q('.anyink-letter-switches'))).toBe(false);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('drew a shape');
		editor.publish('currentItem', editor.selectedItem);
		expect(visible(q('.anyink-letter-switches'))).toBe(true);
	});

	it('the outline and paper buttons give way to the switches', () => {
		letterPage({ id: 'glyph-0x41' });
		expect(q('[data-anyink-view-tool="displayMode"]')).toBeNull();
		expect(q('[data-anyink-view-tool="canvasTheme"]')).toBeNull();
		expect(q('[data-anyink-view-tool="zoomEm"]')).not.toBeNull();
	});

	it('the next letter keeps the page: the header, card and overlay follow it', () => {
		const editor = letterPage({ id: 'glyph-0x43' });
		const steps = editor.history.queue.length;
		q('[data-anyink-letter="next"]').click();
		expect(editor.selectedGlyphID).toBe('glyph-0x44');
		expect(q('[data-anyink-letter="name"]').textContent).toBe('Capital D');
		expect(q('.anyink-letter-card [data-anyink-state]').textContent).toBe(word('letter.state.empty'));
		expect(visible(q('[data-anyink-overlay]'))).toBe(true);
		expect(editor.history.queue.length).toBe(steps);
	});

	it('drawing the first shape takes the overlay away and the card says Ready', () => {
		const editor = letterPage();
		editor.selectedItem.addOneShape(square());
		editor.history.addState('drew a shape');
		editor.publish('currentItem', editor.selectedItem);
		expect(visible(q('[data-anyink-overlay]'))).toBe(false);
		expect(q('.anyink-letter-card [data-anyink-state]').textContent).toBe(word('letter.state.ready'));
	});
});

describe('All tools, and Simple before the flag, are unchanged', () => {
	const unchanged = () => {
		expect(q('.anyink-letter-header')).toBeNull();
		expect(q('.anyink-letter-card')).toBeNull();
		expect(q('[data-anyink-overlay]')).toBeNull();
		expect(q('.anyink-letter-switches')).toBeNull();
		expect(q('.editor__page').hasAttribute('data-anyink-letter-view')).toBe(false);
		expect(q('[data-anyink-view-tool="displayMode"]')).not.toBeNull();
	};

	it('All tools, with the flag on: today\'s page and the Attributes panel', () => {
		letterPage({ mode: 'all', letterView: true, id: 'glyph-0x41' });
		unchanged();
		expect(q('#editor-page__panel').querySelectorAll('.panel__card').length).toBeGreaterThan(0);
		expect(visible(q('#nav-button-l3'))).toBe(true);
	});

	it('Simple before the flag: B5\'s page', () => {
		letterPage({ mode: 'simple', letterView: false, id: 'glyph-0x41' });
		unchanged();
		expect(visible(q('#nav-button-l2'))).toBe(true);
	});
});

describe('the letter view says no banned word (2.3)', () => {
	scanSimpleScreen('an empty letter: header, card, overlay', () => {
		setFeaturesForTests({ letterView: true });
		letterPage();
		return q('#app__wrapper');
	});

	scanSimpleScreen('a letter with ink, Fine-tune open, Shape options open, a shape picked', () => {
		setFeaturesForTests({ letterView: true });
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(0));
		editor.selectedItem.addOneShape(square(600));
		// B6 + B7 integration: one inside the first, so the picked shape can be a hole and its
		// Solid / Hole switch shows (a shape with nothing around it gets none)
		editor.selectedItem.addOneShape(
			new Path({
				name: 'Inside',
				pathPoints: [
					{ p: { coord: { x: 100, y: 100 } } },
					{ p: { coord: { x: 300, y: 100 } } },
					{ p: { coord: { x: 300, y: 300 } } },
					{ p: { coord: { x: 100, y: 300 } } },
				],
			})
		);
		editor.history.addState('drew three shapes');
		editor.publish('currentItem', editor.selectedItem);
		q('[data-anyink-toggle="fineTune"]').click();
		q('[data-anyink-toggle="shapeOptions"]').click();
		q('[data-anyink-shape-row="2"]').click();
		expect(q('[data-anyink-kind-switch]')).not.toBeNull();
		return q('#app__wrapper');
	});

	scanSimpleScreen('Edit points with one point picked: This point', () => {
		setFeaturesForTests({ letterView: true });
		const editor = letterPage({ id: 'glyph-0x41' });
		setFineTuneOpen(true, editor);
		const shape = editor.selectedItem.shapes[0];
		editor.selectedTool = 'pathEdit';
		editor.multiSelect.shapes.select(shape);
		editor.multiSelect.points.select(shape.pathPoints[0]);
		editor.publish('whichPathPointIsSelected', shape.pathPoints[0]);
		expect(q('[data-anyink-fine="point"]')).not.toBeNull();
		return q('#app__wrapper');
	});

	// B6 + B7 fix pass (letter-card track): Merge is the card's own now, with its own toasts
	scanSimpleScreen('Merge overlapping shapes: two that overlap, and its toast', () => {
		setFeaturesForTests({ letterView: true });
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(0));
		editor.selectedItem.addOneShape(square(200));
		editor.history.addState('drew two shapes');
		editor.publish('currentItem', editor.selectedItem);
		q('[data-anyink-toggle="fineTune"]').click();
		q('[data-anyink-toggle="shapeOptions"]').click();
		q('[data-anyink-action="merge"]').click();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		return q('#app__wrapper');
	});

	scanSimpleScreen('Merge overlapping shapes: nothing overlaps, and its toast', () => {
		setFeaturesForTests({ letterView: true });
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(0));
		editor.selectedItem.addOneShape(square(600));
		editor.history.addState('drew two shapes');
		editor.publish('currentItem', editor.selectedItem);
		q('[data-anyink-toggle="fineTune"]').click();
		q('[data-anyink-toggle="shapeOptions"]').click();
		q('[data-anyink-action="merge"]').click();
		expect(editor.selectedItem.shapes).toHaveLength(2);
		return q('#app__wrapper');
	});

	scanSimpleScreen('Clear letter: the toast with [Undo]', () => {
		setFeaturesForTests({ letterView: true });
		const editor = letterPage({ id: 'glyph-0x41' });
		setFineTuneOpen(true, editor);
		q('[data-anyink-toggle="shapeOptions"]').click();
		q('[data-anyink-action="clear"]').click();
		return q('#app__wrapper');
	});
});
