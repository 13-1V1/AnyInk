// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 Try it, the strip side (UX-BEGINNER.md 4.6): the strip grows into Try it and is never
	rebuilt; his letters big (72 pt); Esc, [Done] or a page change (step 1) closes it; the rail's
	step 2, the Next line's [Try it] and the strip's [Big preview] open it; the letter under it
	hears no plain keys; [Done] is the one green button; stand-ins with their legend; B1's font
	check as one line. Simple only, with the 'tryIt' flag.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { Path } from '../../../project_data/path.js';
import { runCoachAction } from '../../coach/actions.js';
import { getCoach } from '../../coach/coach_state.js';
import { runFontCheckNow } from '../../fontcheck/font_check.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { MODE_EVENT, setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { PreviewStrip, STRIP_REDRAW_EVENT } from '../../preview/preview_strip.js';
import { DEFAULT_PT } from '../../preview/units.js';
import { startCanvasSpy } from '../../words/tests/banned_scan.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { TRY_IT_EVENT } from '../../topbar/doors.js';
import { word } from '../../words/words.js';
import {
	canOpenTryIt,
	closeTryIt,
	getTryItSlot,
	isTryItOpen,
	openTryIt,
	TRY_IT_CHANGE_EVENT,
	TRY_IT_DEFAULT_PT,
} from '../expand.js';

beforeAll(() => {
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
});
afterEach(() => {
	closeTryIt();
	setModeForTests('all');
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

function simpleOn(flags = { coach: true, tryIt: true }) {
	setModeForTests('simple');
	resetFeaturesForTests();
	setFeaturesForTests(flags);
}

/** a strip on the page, as index.html mounts it, attached to a two-letter font */
function stripOn(editor = twoLetterEditor()) {
	const strip = /** @type {PreviewStrip} */ (document.createElement('preview-strip'));
	document.body.appendChild(strip);
	strip.attachEditor(editor);
	return { strip, editor };
}

function square() {
	return new Path({
		pathPoints: [
			{ p: { coord: { x: 0, y: 0 } } },
			{ p: { coord: { x: 0, y: 700 } } },
			{ p: { coord: { x: 500, y: 700 } } },
			{ p: { coord: { x: 500, y: 0 } } },
		],
	});
}

function giveInk(editor, id) {
	const item = editor.project.getItem(id);
	item.shapes.push(square());
	item.advanceWidth = 600;
}

describe('who may open it', () => {
	it('Simple with the tryIt flag; never All tools, never before B12', () => {
		simpleOn();
		expect(canOpenTryIt()).toBe(true);
		setModeForTests('all');
		expect(canOpenTryIt()).toBe(false);
		simpleOn({ coach: true, tryIt: false });
		expect(canOpenTryIt()).toBe(false);
	});

	it('All tools: the strip stays as it is', () => {
		const { strip } = stripOn();
		expect(openTryIt()).toBe(false);
		expect(strip.classList.contains('is-try-it')).toBe(false);
	});
});

describe('the strip grows into Try it', () => {
	it('the same strip, sheet and letters, never rebuilt; his letters at 72 pt', () => {
		simpleOn();
		const { strip } = stripOn();
		strip.redrawNow();
		const sheet = strip.canvasWrapper;
		const renderer = strip.renderer;
		expect(strip.getOptions().pt).toBe(DEFAULT_PT);

		expect(openTryIt({ cause: 'test' })).toBe(true);
		expect(isTryItOpen()).toBe(true);
		expect(strip.classList.contains('is-try-it')).toBe(true);
		strip.redrawNow();
		expect(document.querySelectorAll('preview-strip').length).toBe(1);
		expect(strip.canvasWrapper).toBe(sheet);
		expect(strip.renderer).toBe(renderer);
		expect(renderer.isConnected).toBe(true);
		expect(strip.getOptions().pt).toBe(TRY_IT_DEFAULT_PT);

		// the size he picks in Try it is Try it's; the strip keeps its own
		strip.setPoints(96);
		closeTryIt();
		expect(strip.getOptions().pt).toBe(DEFAULT_PT);
		openTryIt();
		expect(strip.getOptions().pt).toBe(96);
		expect(strip.renderer).toBe(renderer);
	});

	it('the top bar stays: the strip starts under it', () => {
		simpleOn();
		const bar = document.createElement('div');
		bar.id = 'app__top-bar';
		document.body.appendChild(bar);
		vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ bottom: 88 });
		const { strip } = stripOn();
		openTryIt();
		expect(strip.style.getPropertyValue('--anyink-tryit-top')).toBe('88px');
	});

	it('the coach hears it, and the change is told to the gap-fix track with its section', () => {
		simpleOn();
		stripOn();
		const heard = vi.fn();
		window.addEventListener(TRY_IT_CHANGE_EVENT, heard);
		try {
			runCoachAction('tryIt', { open: 'letterSpacing' }, { editor: null });
			expect(getCoach().facts().tryItOpen).toBe(true);
			expect(heard.mock.calls[0][0].detail).toMatchObject({ open: true, section: 'letterSpacing' });
			closeTryIt({ cause: 'done' });
			expect(getCoach().facts().tryItOpen).toBeFalsy();
			expect(heard.mock.calls[1][0].detail).toMatchObject({ open: false });
		} finally {
			window.removeEventListener(TRY_IT_CHANGE_EVENT, heard);
		}
	});

	it('the slots for the gap fixes are inside the strip', () => {
		simpleOn();
		const { strip } = stripOn();
		['note', 'spacing', 'gaps', 'sheet'].forEach((name) => {
			const slot = getTryItSlot(name);
			expect(slot).not.toBeNull();
			expect(strip.contains(slot)).toBe(true);
		});
		expect(strip.canvasWrapper.contains(getTryItSlot('sheet'))).toBe(true);
	});
});

describe('ways in', () => {
	it("the rail's step 2", () => {
		simpleOn();
		stripOn();
		window.dispatchEvent(new CustomEvent(TRY_IT_EVENT, { detail: { cause: 'rail' } }));
		expect(isTryItOpen()).toBe(true);
	});

	it("the strip's Big preview, in Simple only", () => {
		simpleOn();
		const { strip } = stripOn();
		const big = strip.querySelector('[data-anyink-strip="bigPreview"]');
		expect(big.hidden).toBe(false);
		expect(big.textContent).toBe(word('tryit.bigPreview'));
		big.click();
		expect(isTryItOpen()).toBe(true);

		closeTryIt();
		setModeForTests('all');
		window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { mode: 'all' } }));
		expect(big.hidden).toBe(true);
	});
});

describe('ways out', () => {
	it('Done', () => {
		simpleOn();
		const { strip } = stripOn();
		openTryIt();
		strip.querySelector('.anyink-tryit__done').click();
		expect(isTryItOpen()).toBe(false);
		expect(strip.classList.contains('is-try-it')).toBe(false);
	});

	it('Esc, also from the text field; not while a menu is open', () => {
		simpleOn();
		const { strip } = stripOn();
		openTryIt();
		const menu = document.createElement('div');
		menu.id = 'context-menu';
		document.body.appendChild(menu);
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(isTryItOpen()).toBe(true);
		menu.remove();
		strip.textInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(isTryItOpen()).toBe(false);
	});

	it('a page change (step 1, the logo, a double-clicked letter)', () => {
		simpleOn();
		stripOn();
		openTryIt();
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		expect(isTryItOpen()).toBe(false);
	});

	it('a switch to All tools', () => {
		simpleOn();
		stripOn();
		openTryIt();
		setModeForTests('all');
		window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { mode: 'all' } }));
		expect(isTryItOpen()).toBe(false);
	});
});

describe('the letter under Try it', () => {
	it('hears no tool keys, Delete or arrows; Undo and the strip itself still work', () => {
		simpleOn();
		const { strip } = stripOn();
		const app = vi.fn();
		window.addEventListener('keydown', app);
		try {
			openTryIt();
			['b', 'Delete', 'ArrowLeft'].forEach((key) =>
				document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
			);
			expect(app).not.toHaveBeenCalled();
			document.body.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
			);
			expect(app).toHaveBeenCalledTimes(1);
			closeTryIt();
			document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
			expect(app).toHaveBeenCalledTimes(2);
			expect(strip.isConnected).toBe(true);
		} finally {
			window.removeEventListener('keydown', app);
		}
	});

	it("a press from the strip's own summary, button or switch never reaches the letter", () => {
		simpleOn();
		const { strip } = stripOn();
		const app = vi.fn();
		document.addEventListener('keydown', app);
		try {
			openTryIt();
			// a summary in a Try it slot, as Letter spacing and Gaps you fixed have
			const details = document.createElement('details');
			const summary = document.createElement('summary');
			summary.tabIndex = 0;
			details.appendChild(summary);
			getTryItSlot('spacing').appendChild(details);
			const button = document.createElement('button');
			getTryItSlot('gaps').appendChild(button);
			const press = (target, key, more = {}) =>
				target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...more }));
			['Delete', 'Backspace', 'ArrowRight', 'ArrowUp', 'v', 'b'].forEach((key) => {
				press(summary, key);
				press(button, key);
			});
			press(strip.tryIt.elements.done, 'Delete');
			expect(app).not.toHaveBeenCalled();
			// Undo from there still reaches the app
			press(summary, 'z', { ctrlKey: true });
			expect(app).toHaveBeenCalledTimes(1);
			// the strip's own keys still reach its controls
			const range = document.createElement('input');
			range.type = 'range';
			getTryItSlot('spacing').appendChild(range);
			const onRange = vi.fn();
			range.addEventListener('keydown', onRange);
			press(range, 'ArrowRight');
			expect(onRange).toHaveBeenCalledTimes(1);
			const field = strip.textInput;
			if (field) {
				const onField = vi.fn();
				field.addEventListener('keydown', onField);
				press(field, 'Delete');
				expect(onField).toHaveBeenCalledTimes(1);
			}
			expect(app).toHaveBeenCalledTimes(1);
		} finally {
			document.removeEventListener('keydown', app);
		}
	});
});

describe('Done is the one green button', () => {
	it('green while the Next line has no button (rule 5); outlined beside rule 4', () => {
		simpleOn();
		const { strip } = stripOn();
		openTryIt();
		const done = strip.querySelector('.anyink-tryit__done');
		expect(done.classList.contains('anyink-primary')).toBe(true);
		vi.spyOn(getCoach(), 'line').mockReturnValue({
			sentence: word('coach.rule.tryItHappy'),
			button: { label: 'Use in Word' },
		});
		strip.tryIt.updateDone();
		expect(done.classList.contains('anyink-primary')).toBe(false);
		expect(done.classList.contains('anyink-outlined')).toBe(true);
	});
});

describe('the font check line', () => {
	it('checking, then "Your font builds OK."; B1\'s corner line never shows beside it', () => {
		simpleOn();
		const { strip, editor } = stripOn();
		openTryIt();
		const line = strip.querySelector('.anyink-tryit-check');
		// opening checks at once: never a blank line
		expect(line.textContent).toContain(word('tryit.checkOk'));
		expect(strip.checkLine.visible).toBe(false);
		giveInk(editor, 'glyph-0x42');
		editor.project.getItem('glyph-0x42').advanceWidth = 70000;
		runFontCheckNow(editor);
		expect(line.textContent).toContain('Capital B');
		expect(line.querySelector('button:not([hidden])').textContent).toBe(word('check.fixIt'));
		line.querySelector('button:not([hidden])').click();
		expect(line.textContent).toContain(word('tryit.checkOk'));
	});
});

describe('stand-ins on the sheet', () => {
	function sheetSized(strip) {
		vi.spyOn(strip.page, 'getClientRects').mockReturnValue([{ width: 1200, height: 400 }]);
		vi.spyOn(strip.page, 'clientHeight', 'get').mockReturnValue(400);
	}

	it('letters not made yet as faint outlines, with the legend until 5 are ready', () => {
		simpleOn();
		const editor = twoLetterEditor();
		giveInk(editor, 'glyph-0x42');
		const { strip } = stripOn(editor);
		sheetSized(strip);
		strip.setText('Bra');
		const spy = startCanvasSpy();
		try {
			strip.needsResize = true;
			strip.redrawNow();
		} finally {
			spy.stop();
		}
		expect(strip.standInCount).toBe(2);
		expect(spy.texts).toEqual(expect.arrayContaining(['r', 'a']));
		// no "Your letters show here as you make them." over the stand-ins
		expect(spy.texts).not.toContain(word('strip.lettersNotMade'));
		const legend = strip.querySelector('.anyink-standin-legend');
		expect(legend.hidden).toBe(false);
		expect(legend.textContent).toBe('gray = not made yet');

		// Try it: the same stand-ins, big
		openTryIt();
		strip.redrawNow();
		expect(strip.standInCount).toBe(2);
	});

	it('in Try it the legend is a sentence on the hint line under the sheet, not a corner tag', () => {
		simpleOn();
		const editor = twoLetterEditor();
		giveInk(editor, 'glyph-0x42');
		const { strip } = stripOn(editor);
		sheetSized(strip);
		strip.setText('Bra');
		openTryIt();
		strip.needsResize = true;
		strip.redrawNow();
		expect(strip.standInCount).toBe(2);
		const hint = strip.tryIt.elements.hint;
		const line = hint.querySelector('.anyink-tryit__legend-line');
		expect(line).not.toBeNull();
		expect(line.hidden).toBe(false);
		expect(line.textContent).toBe(word('tryit.legendLine'));
		expect(line.textContent).toBe("Gray letters aren't made yet. Double-click one to make it.");
		// the hint's own words stay
		expect(hint.textContent).toContain(word('tryit.hint'));
		// the corner tag steps aside while Try it is open
		const corner = strip.querySelector('.anyink-standin-legend');
		expect(corner.hidden).toBe(true);
		// back on the small strip, the corner tag is its legend again
		closeTryIt();
		expect(corner.hidden).toBe(false);
		openTryIt();
		expect(corner.hidden).toBe(true);

		// five letters ready: the sentence goes too
		['a', 'c', 'd', 'e'].forEach((char) => {
			const id = `glyph-0x${char.charCodeAt(0).toString(16)}`;
			editor.project.getItem(id, true);
			giveInk(editor, id);
		});
		strip.setText('Bz');
		strip.needsResize = true;
		strip.redrawNow();
		expect(line.hidden).toBe(true);
	});

	it('a stand-in opens its letter on double-click', () => {
		simpleOn();
		const editor = twoLetterEditor();
		giveInk(editor, 'glyph-0x42');
		editor.navigate = vi.fn();
		const { strip } = stripOn(editor);
		sheetSized(strip);
		strip.setText('Ba');
		strip.needsResize = true;
		strip.redrawNow();
		const a = strip.renderer.textBlock.data[0][1];
		const canvas = strip.renderer.canvas;
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 });
		const x = a.view.dx + 5;
		const y = a.view.dy - 10;
		strip.onMouseMove({ clientX: x, clientY: y });
		expect(strip.canvasWrapper.title).toBe(word('strip.openHint', { letter: 'small a' }));
		strip.onDoubleClick({ clientX: x, clientY: y });
		expect(editor.selectedItemID).toBe('glyph-0x61');
		expect(editor.navigate).toHaveBeenCalled();
	});

	it('the legend goes once 5 letters are ready', () => {
		simpleOn();
		const editor = twoLetterEditor();
		['glyph-0x42', 'glyph-0x72'].forEach((id) => giveInk(editor, id));
		['a', 'b', 'c'].forEach((char) => {
			const id = `glyph-0x${char.charCodeAt(0).toString(16)}`;
			editor.project.getItem(id, true);
			giveInk(editor, id);
		});
		const { strip } = stripOn(editor);
		sheetSized(strip);
		strip.setText('Brz');
		strip.needsResize = true;
		strip.redrawNow();
		expect(strip.standInCount).toBe(1);
		expect(strip.querySelector('.anyink-standin-legend').hidden).toBe(true);
	});

	it('All tools: no stand-ins, the sheet as before', () => {
		const editor = twoLetterEditor();
		giveInk(editor, 'glyph-0x42');
		const { strip } = stripOn(editor);
		sheetSized(strip);
		strip.setText('Bra');
		strip.needsResize = true;
		strip.redrawNow();
		expect(strip.standInCount).toBe(0);
		expect(strip.querySelector('.anyink-standin-legend').hidden).toBe(true);
	});

	it('every redraw is told to the gap-fix track', () => {
		simpleOn();
		const { strip } = stripOn();
		const heard = vi.fn();
		strip.addEventListener(STRIP_REDRAW_EVENT, heard);
		strip.redrawNow();
		expect(heard).toHaveBeenCalled();
		expect(heard.mock.lastCall[0].detail.textBlock).toBe(strip.renderer.textBlock);
	});
});

scanSimpleScreen('Try it, the strip side', async () => {
	setFeaturesForTests({ coach: true, tryIt: true });
	const editor = twoLetterEditor();
	giveInk(editor, 'glyph-0x42');
	const { strip } = stripOn(editor);
	vi.spyOn(strip.page, 'getClientRects').mockReturnValue([{ width: 1200, height: 400 }]);
	strip.setText('Bra');
	openTryIt();
	strip.needsResize = true;
	strip.redrawNow();
	return strip;
});

describe('his letters never move while the sheet changes height under them', () => {
	it('Try it centers on the height the canvas was sized to, until the next resize', () => {
		simpleOn();
		const editor = twoLetterEditor();
		giveInk(editor, 'glyph-0x42');
		const { strip } = stripOn(editor);
		let height = 581;
		vi.spyOn(strip.page, 'getClientRects').mockImplementation(() => [
			{ width: 1200, height },
		]);
		vi.spyOn(strip.page, 'clientHeight', 'get').mockImplementation(() => height);
		strip.setText('B');
		openTryIt();
		strip.redrawNow();
		const gap = strip.renderer.textBlockOptions.lineGap;

		// a row under the sheet settles, or a section opens: the sheet is shorter
		height = 512;
		strip.redrawNow(); // a live redraw, as a gap drag's first tick makes
		expect(strip.renderer.textBlockOptions.lineGap).toBe(gap);
		height = 565;
		strip.redrawNow();
		expect(strip.renderer.textBlockOptions.lineGap).toBe(gap);

		// a window resize sizes the canvas again: then the new height counts
		strip.handleWindowResize();
		strip.redrawNow();
		expect(strip.renderer.textBlockOptions.lineGap).not.toBe(gap);
	});
});
