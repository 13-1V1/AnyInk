// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 7 (strip half): the strip listens to the font check's 'fontCheck' topic and shows the
// first problem as one line with [Show me]; the line goes away when the problems do.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../../app/main.js';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { publish, subscribe, unsubscribe } from '../../../project_editor/pub_sub.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { runFontCheckNow } from '../../fontcheck/font_check.js';
import { PROBLEM } from '../../fontcheck/validate.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { CHECK_GAP, PreviewStrip } from '../preview_strip.js';
import { FONT_CHECK_ID } from '../subscriptions.js';

const problemA = {
	itemId: 'glyph-0x61',
	problem: 'width',
	message: "small a has a problem the font file can't hold.",
};
const problemB = {
	itemId: 'glyph-0x62',
	problem: 'points',
	message: "small b has a problem the font file can't hold.",
};

/** Upstream pub/sub on the smallest editor it runs against, plus what Show me needs. */
function fakeEditor() {
	const editor = {
		subscribers: {},
		selectedItem: undefined,
		multiSelect: {
			shapes: { clear() {}, length: 0, singleton: false },
			points: { clear() {}, singleton: false },
		},
		nav: { page: 'Overview' },
		selectedItemID: false,
		navigate: vi.fn(),
	};
	editor.publish = publish;
	editor.subscribe = subscribe;
	editor.unsubscribe = unsubscribe;
	return editor;
}

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});

let strip;
let editor;

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	strip = new PreviewStrip();
	strip.build();
	editor = fakeEditor();
	strip.attachEditor(editor);
});

const line = () => strip.querySelector('.preview-strip__check');

describe('preview strip font check line', () => {
	it('is hidden until the font check finds something', () => {
		expect(line()).toBeTruthy();
		expect(line().hidden).toBe(true);
		expect(editor.subscribers.fontCheck[FONT_CHECK_ID]).toBeTypeOf('function');
	});

	it('shows the first problem in one line that names the letter', () => {
		editor.publish('fontCheck', { problems: [problemA, problemB] });
		expect(line().hidden).toBe(false);
		expect(line().textContent).toContain("small a has a problem the font file can't hold.");
		expect(line().textContent).not.toContain('small b');
		const button = line().querySelector('button');
		expect(button.textContent).toBe('Show me');
		expect(button.hidden).toBe(false);
	});

	it('sits on the sheet, not in the controls', () => {
		editor.publish('fontCheck', { problems: [problemA] });
		expect(line().parentElement.classList.contains('preview-strip__canvas-wrapper')).toBe(true);
	});

	it('Show me opens that letter', () => {
		editor.publish('fontCheck', { problems: [problemA] });
		line().querySelector('button').click();
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe('glyph-0x61');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('disappears when the problems are fixed', () => {
		editor.publish('fontCheck', { problems: [problemA] });
		expect(line().hidden).toBe(false);
		editor.publish('fontCheck', { problems: [] });
		expect(line().hidden).toBe(true);
	});

	it('follows the next problem when the first one is fixed', () => {
		editor.publish('fontCheck', { problems: [problemA, problemB] });
		editor.publish('fontCheck', { problems: [problemB] });
		expect(line().textContent).toContain('small b');
		line().querySelector('button').click();
		expect(editor.selectedItemID).toBe('glyph-0x62');
	});

	it("forgets the old font's problems when another font is opened", () => {
		editor.publish('fontCheck', { problems: [problemA] });
		const next = fakeEditor();
		strip.attachEditor(next);
		expect(line().hidden).toBe(true);
		editor.publish('fontCheck', { problems: [problemA] });
		expect(line().hidden).toBe(true);
		next.publish('fontCheck', { problems: [problemB] });
		expect(line().textContent).toContain('small b');
	});

	it("picks up a font's last check result when that font becomes current", () => {
		// Coming back to a font that was already checked: no 2 s wait for the next check.
		const checked = fakeEditor();
		checked.project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		checked.project.getItem('glyph-0x41').advanceWidth = 0; // ink with no width
		const result = runFontCheckNow(checked);
		expect(result.problems.length).toBeGreaterThan(0);

		strip.attachEditor(checked);
		expect(line().hidden).toBe(false);
		expect(line().textContent).toContain('Capital A');
	});

	it('steps aside while the real-font sheet already says the font cannot be shown', () => {
		editor.publish('fontCheck', { problems: [problemA] });
		const sheet = strip.querySelector('.preview-strip__canvas-wrapper');
		sheet.dispatchEvent(
			new CustomEvent('font-status', { bubbles: true, detail: { ok: false, itemId: 'glyph-0x61' } })
		);
		expect(line().hidden).toBe(true);
		sheet.dispatchEvent(
			new CustomEvent('font-status', { bubbles: true, detail: { ok: true, itemId: null } })
		);
		expect(line().hidden).toBe(false);
	});
});

// Walkthrough p2 / p8: the line named one letter and stopped there. It now says how many more
// letters need fixing, and [Fix it] fixes what can be fixed safely (fix_it.js) and moves the line
// on at once, instead of 2 s later.
describe('preview strip font check line: what to do next', () => {
	const text = () => line().querySelector('.anyink-notice__text').textContent;
	const more = () => line().querySelector('.anyink-notice__more');
	const button = (label) =>
		[...line().querySelectorAll('button')].find((b) => b.textContent === label);

	let previous;
	let real;

	/** A real editor on the sample with A and B given ink but no width, open on A. */
	function realEditor() {
		const next = new ProjectEditor();
		setCurrentProjectEditor(next);
		next.project = importGlyphrProjectFromText(simpleExampleProject);
		next.project.getItem('glyph-0x41').advanceWidth = 0;
		next.project.getItem('glyph-0x42').advanceWidth = 0;
		next.nav.page = 'Characters';
		next.selectedItemID = 'glyph-0x41';
		next.navigate = vi.fn();
		return next;
	}

	beforeEach(() => {
		previous = getCurrentProjectEditor();
	});

	afterEach(() => {
		setCurrentProjectEditor(previous);
	});

	it('says how many more letters need fixing', () => {
		const checked = fakeEditor();
		checked.project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		['glyph-0x41', 'glyph-0x42', 'glyph-0x43'].forEach(
			(id) => (checked.project.getItem(id).advanceWidth = 0)
		);
		strip.attachEditor(checked);
		runFontCheckNow(checked);
		expect(text()).toBe(
			'Capital A has ink but no width, so the next letter would sit on top of it.'
		);
		expect(more().hidden).toBe(false);
		expect(more().textContent).toBe('2 more letters need fixing too.');
	});

	it('says nothing more when only one letter needs fixing', () => {
		editor.publish('fontCheck', { problems: [problemA] });
		expect(more().hidden).toBe(true);
	});

	it('offers Fix it for a width or stray shapes, not for a point too far out', () => {
		const as = (problem) => ({ ...problemA, problem });
		// Fix it is offered only when it would change the letter (fix_it.js canFixProblem)
		editor.project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		const a = editor.project.getItem('glyph-0x61', true);
		a.addOneShape({ pathPoints: [{ p: { coord: { x: 0, y: 0 } } }, { p: { coord: { x: 9, y: 9 } } }] });
		editor.publish('fontCheck', { problems: [as(PROBLEM.inkNoWidth)] });
		expect(button('Fix it').hidden).toBe(false);
		editor.publish('fontCheck', { problems: [as(PROBLEM.shape)] });
		expect(button('Fix it').hidden).toBe(false);
		editor.publish('fontCheck', { problems: [as(PROBLEM.point)] });
		expect(button('Fix it').hidden).toBe(true);
		expect(button('Show me').hidden).toBe(false);
	});

	it('Fix it gives the letter a width as one Undo step, and the line moves on at once', () => {
		real = realEditor();
		strip.attachEditor(real);
		runFontCheckNow(real);
		expect(text()).toMatch(/^Capital A has ink but no width/);
		expect(more().textContent).toBe('1 more letter needs fixing too.');
		const steps = real.history.queue.length;

		button('Fix it').click();
		const a = real.project.getItem('glyph-0x41');
		expect(a.advanceWidth).toBeGreaterThan(0);
		expect(Number.isInteger(a.advanceWidth)).toBe(true);
		expect(real.history.queue.length).toBe(steps + 1);
		expect(real.history.queue[0].title).toBe('gave Capital A a width');
		// No 2 s wait: the line already names the next letter
		expect(text()).toMatch(/^Capital B has ink but no width/);
		expect(more().hidden).toBe(true);
	});

	it('a point too far out gets a sentence saying what to do, with Show me only (B1 fix pass)', () => {
		const message = 'small a has a point too far out for the font file to hold.';
		editor.publish('fontCheck', { problems: [{ ...problemA, problem: PROBLEM.point, message }] });
		expect(text()).toBe(`${message} Show me, then drag the far point back near the letter.`);
		expect(button('Fix it').hidden).toBe(true);
	});

	it('the count calls a gap a gap (B1 fix pass)', () => {
		const gap = {
			itemId: 'kern-0',
			problem: PROBLEM.kern,
			message: 'The gap between Capital A and Capital C is moved further than the font file can hold.',
		};
		editor.publish('fontCheck', { problems: [problemA, gap] });
		expect(more().textContent).toBe('1 gap needs fixing too.');
	});

	it('Fix it on a space with no width gives it one (B1 fix pass)', () => {
		real = realEditor();
		real.project.getItem('glyph-0x41').advanceWidth = 600;
		real.project.getItem('glyph-0x42').advanceWidth = 600;
		real.selectedItemID = 'glyph-0x20';
		real.selectedItem.advanceWidth = 0;
		strip.attachEditor(real);
		runFontCheckNow(real);
		expect(text()).toBe('The space has no width, so your words would run together.');
		expect(button('Fix it').hidden).toBe(false);
		button('Fix it').click();
		expect(real.project.getItem('glyph-0x20').advanceWidth).toBeGreaterThan(0);
		expect(line().hidden).toBe(true);
	});

	it('Fix it on a check result that is already out of date checks again, and changes nothing', () => {
		real = realEditor();
		strip.attachEditor(real);
		runFontCheckNow(real);
		expect(text()).toMatch(/^Capital A has ink but no width/);
		// he gives A a width himself; the 2 s check hasn't run yet
		real.project.getItem('glyph-0x41').advanceWidth = 350;
		const steps = real.history.queue.length;
		button('Fix it').click();
		expect(real.project.getItem('glyph-0x41').advanceWidth).toBe(350);
		expect(real.history.queue.length).toBe(steps);
		// the line moved on to what is really left
		expect(text()).toMatch(/^Capital B has ink but no width/);
	});

	it('Fix it on the last problem clears the line', () => {
		real = realEditor();
		real.project.getItem('glyph-0x42').advanceWidth = 405;
		strip.attachEditor(real);
		runFontCheckNow(real);
		button('Fix it').click();
		expect(line().hidden).toBe(true);
	});
});

// Walkthrough p10: at 200 pt the line's dark pill covered the bottom-right letters, which is
// often where the problem letter is. The first fix gave the line a 40 px band across the whole
// sheet, so the letters jumped 20 px every time the line came or went, and at large sizes the
// whole sheet lost its bottom 40 px. Now the letters keep the whole sheet and never move: only
// the corner under the line is cut away (clip-path), in both canvas and Real font mode, so the
// line never sits on a letter.
describe('preview strip font check line: a corner of its own (B1 fix pass)', () => {
	const sheet = () => strip.querySelector('.preview-strip__canvas-wrapper');
	const page = () => sheet().querySelector(':scope > .preview-strip__page');
	const rect = (left, top, right, bottom) => ({
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
		x: left,
		y: top,
		toJSON() {},
	});

	it('marks the sheet only while the line shows', () => {
		expect(sheet().classList.contains('has-check')).toBe(false);
		editor.publish('fontCheck', { problems: [problemA] });
		expect(sheet().classList.contains('has-check')).toBe(true);
		editor.publish('fontCheck', { problems: [] });
		expect(sheet().classList.contains('has-check')).toBe(false);
	});

	it('never lays the letters out again when the line comes and goes, so they never move', () => {
		strip.needsResize = false;
		editor.publish('fontCheck', { problems: [problemA] });
		expect(strip.needsResize).toBe(false);
		editor.publish('fontCheck', { problems: [problemB] });
		editor.publish('fontCheck', { problems: [] });
		expect(strip.needsResize).toBe(false);
	});

	it('cuts away just the corner the line covers, plus a small gap', () => {
		vi.spyOn(page(), 'getBoundingClientRect').mockReturnValue(rect(344, 760, 1588, 892));
		vi.spyOn(line(), 'getBoundingClientRect').mockReturnValue(rect(1052, 850, 1580, 884));
		editor.publish('fontCheck', { problems: [problemA] });
		const cut = (name) => sheet().style.getPropertyValue(name);
		// from the line's left edge (less the gap) to the page's right edge; same for the top
		expect(cut('--preview-check-cut-w')).toBe(`${1588 - 1052 + CHECK_GAP}px`);
		expect(cut('--preview-check-cut-h')).toBe(`${892 - 850 + CHECK_GAP}px`);
	});

	it('measures the corner again for a longer or shorter line', () => {
		const pageRect = vi.spyOn(page(), 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1000, 134));
		const lineRect = vi.spyOn(line(), 'getBoundingClientRect').mockReturnValue(rect(600, 96, 992, 130));
		editor.publish('fontCheck', { problems: [problemA] });
		expect(sheet().style.getPropertyValue('--preview-check-cut-w')).toBe(`${400 + CHECK_GAP}px`);
		lineRect.mockReturnValue(rect(300, 96, 992, 130));
		editor.publish('fontCheck', { problems: [problemB] });
		expect(sheet().style.getPropertyValue('--preview-check-cut-w')).toBe(`${700 + CHECK_GAP}px`);
		expect(pageRect).toHaveBeenCalled();
	});

	it('lays the letters out in a page beside the line, never under it', () => {
		// DisplayCanvas sizes itself to its parent's box: the page is the room the letters get
		expect(page()).toBeTruthy();
		expect(line().parentElement).toBe(sheet());
		expect(page().contains(line())).toBe(false);
		const renderer = strip.ensureRenderer();
		expect(renderer.parentElement).toBe(page());
	});

	it('styles: the page fills the sheet, clips Real font text to itself, and loses only the corner', () => {
		const here = dirname(fileURLToPath(import.meta.url));
		const css = readFileSync(join(here, '../preview-strip.css'), 'utf8').replace(/\s+/g, ' ');
		expect(css).toMatch(/\.preview-strip__page \{[^}]*position: absolute; inset: 0;/);
		// the real-font text box grows with its text; the page keeps it to the sheet
		expect(css).toMatch(/\.preview-strip__page \{[^}]*overflow: hidden;/);
		expect(css).toMatch(
			/\.preview-strip__canvas-wrapper\.has-check \.preview-strip__page \{[^}]*clip-path: polygon\([^}]*var\(--preview-check-cut-w[,)][^}]*var\(--preview-check-cut-h[,)]/
		);
		// no band that shrinks the page
		expect(css).not.toMatch(/has-check \.preview-strip__page \{[^}]*bottom:/);
	});
});

// The strip's double-click on a letter (M5) moved without upstream's "Navigated to" step, so the
// first Undo after an edit there only moved back and dropped that edit. It now opens letters the
// way Show me does.
describe('preview strip double-click', () => {
	let previous;

	beforeEach(() => {
		previous = getCurrentProjectEditor();
	});

	afterEach(() => {
		setCurrentProjectEditor(previous);
	});

	it('opens the letter with a Navigated step, so the next edit there undoes', () => {
		const real = new ProjectEditor();
		setCurrentProjectEditor(real);
		real.project = importGlyphrProjectFromText(simpleExampleProject);
		real.nav.page = 'Characters';
		real.selectedItemID = 'glyph-0x41';
		real.navigate = vi.fn();
		strip.attachEditor(real);
		strip.hitTest = () => ({ item: { id: 'glyph-0x42' } });

		strip.onDoubleClick(new MouseEvent('dblclick'));
		expect(real.selectedItemID).toBe('glyph-0x42');
		expect(real.navigate).toHaveBeenCalledTimes(1);
		expect(real.history.queue[0].title).toMatch(/^Navigated to /);

		const b = real.selectedItem;
		const width = b.advanceWidth;
		b.advanceWidth = width + 100;
		real.history.addState('wider B');
		real.history.restoreState();
		expect(real.project.getItem('glyph-0x42').advanceWidth).toBe(width);
	});

	it('leaves the letter that is already open alone', () => {
		const real = new ProjectEditor();
		setCurrentProjectEditor(real);
		real.project = importGlyphrProjectFromText(simpleExampleProject);
		real.nav.page = 'Characters';
		real.selectedItemID = 'glyph-0x41';
		real.navigate = vi.fn();
		real.autoFitView = vi.fn();
		strip.attachEditor(real);
		strip.hitTest = () => ({ item: { id: 'glyph-0x41' } });
		const steps = real.history.queue.length;

		strip.onDoubleClick(new MouseEvent('dblclick'));
		expect(real.navigate).not.toHaveBeenCalled();
		expect(real.autoFitView).not.toHaveBeenCalled();
		expect(real.history.queue.length).toBe(steps);
	});
});
