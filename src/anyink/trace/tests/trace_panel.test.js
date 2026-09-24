// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track C: the Trace panel (src/anyink/trace/trace_panel.js), built through
// upstream's makePanel dispatcher against a real ProjectEditor and the real trace model.
// Covers the empty and full states, one history entry per action (none per slider tick),
// the panel following canvas drags, undo, and glyph switches, the thumbnail URL being
// reused for the same image and revoked a moment after the image changes, and the
// subscriber-id rule.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makePanel } from '../../../panels/panels.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { setDecoderForTests } from '../bitmap_cache.js';
import { HISTORY_ADDED, HISTORY_REMOVED } from '../trace_import.js';
import { getTrace, setTrace } from '../trace_model.js';
import {
	DRAG_HINT,
	EMPTY_TEXT,
	LOCKED_HINT,
	PANEL_SYNC_ID,
	PANEL_VIEW_ID,
	THUMBNAIL_REVOKE_DELAY_MS,
	flushThumbnailRevokes,
	historyTitles,
} from '../trace_panel.js';

let editor;
let area;
let urls;

function glyphA() {
	return editor.project.getItem('glyph-0x41');
}

function mount() {
	area.innerHTML = '';
	area.appendChild(makePanel());
}

function q(selector) {
	return area.querySelector(selector);
}

function buttonByText(text) {
	return [...area.querySelectorAll('button')].find((b) => b.textContent === text);
}

function toggleByText(text) {
	const label = [...area.querySelectorAll('.anyink-trace-panel__toggle')].find(
		(l) => l.textContent.trim() === text
	);
	return label?.querySelector('input[type="checkbox"]');
}

function click(checkbox) {
	checkbox.checked = !checkbox.checked;
	checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

function addTrace(overrides = {}) {
	const asset = editor.assets.add(new Blob(['png'], { type: 'image/png' }));
	setTrace(glyphA(), {
		asset,
		width: 400,
		height: 800,
		x: 0,
		y: 800,
		scale: 1.25,
		opacity: 0.4,
		visible: true,
		locked: false,
		invert: false,
		...overrides,
	});
	return asset;
}

function historyLength() {
	return editor.history.queue.length;
}

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="editor-page__panel"></div>';
	area = document.querySelector('#editor-page__panel');
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
	let n = 0;
	urls = { created: [], revoked: [] };
	URL.createObjectURL = vi.fn(() => {
		const url = `blob:fake-${++n}`;
		urls.created.push(url);
		return url;
	});
	URL.revokeObjectURL = vi.fn((url) => urls.revoked.push(url));
});

afterEach(() => {
	flushThumbnailRevokes();
	delete URL.createObjectURL;
	delete URL.revokeObjectURL;
	resetFileApi();
	vi.restoreAllMocks();
});

describe('Trace panel, no trace yet', () => {
	it('says how to add an image, offers a picker, and says it is never exported', () => {
		mount();
		expect(area.querySelectorAll('.panel__card')).toHaveLength(1);
		expect(q('.anyink-trace-panel__text').textContent).toBe(EMPTY_TEXT);
		const choose = buttonByText('Choose an image...');
		expect(choose).toBeTruthy();
		expect(choose.classList.contains('button__call-to-action')).toBe(true);
		expect(q('.anyink-trace-panel__note').textContent).toMatch(/reference only.*never exported/i);
		expect(q('input[type="range"]')).toBeNull();
		// Purely visual: no typed number fields
		expect(area.querySelector('input-number, input[type="number"], input[type="text"]')).toBeNull();
	});

	it('opens the picker inside the click', () => {
		const showOpenFilePicker = vi.fn(() => new Promise(() => {}));
		setFileApi({ showOpenFilePicker });
		mount();
		buttonByText('Choose an image...').click();
		expect(showOpenFilePicker).toHaveBeenCalledTimes(1);
		expect(showOpenFilePicker.mock.calls[0][0].id).toBe('anyink-trace');
	});
});

describe('Trace panel with a trace', () => {
	it('shows the thumbnail, the opacity slider, the toggles, and the buttons', () => {
		addTrace();
		mount();
		const img = q('img.anyink-trace-panel__thumb');
		expect(img.getAttribute('src')).toBe('blob:fake-1');
		expect(q('.anyink-trace-panel__size').textContent).toBe('400 × 800 pixels');

		const bar = q('#anyink-trace-opacity');
		expect(bar.type).toBe('range');
		expect(bar.getAttribute('min')).toBe('5');
		expect(bar.getAttribute('max')).toBe('100');
		expect(bar.value).toBe('40');
		expect(q('.anyink-slider-row__unit').textContent).toBe('%');

		expect(toggleByText('Show').checked).toBe(true);
		expect(toggleByText('Lock').checked).toBe(false);
		expect(toggleByText('Invert colors').checked).toBe(false);
		expect(toggleByText('Draw glyph as outline').checked).toBe(false); // sample project draws filled
		for (const text of ['Replace image...', 'Remove image', 'Fit to em', 'Fit to cap height']) {
			expect(buttonByText(text), text).toBeTruthy();
		}
		expect(q('.anyink-trace-panel__readout').textContent).toBe(
			'Top left: 0, 800 · Size: 500 × 1000 font units'
		);
		expect(area.querySelector('input-number, input[type="number"], input[type="text"]')).toBeNull();
	});

	it('says so when the image is missing from the project', () => {
		setTrace(glyphA(), { asset: 'img-gone0000', width: 10, height: 10, x: 0, y: 800, scale: 100 });
		mount();
		expect(q('img')).toBeNull();
		expect(q('.anyink-trace-panel__missing').textContent).toMatch(/missing/);
		expect(buttonByText('Replace image...')).toBeTruthy();
	});

	it('slider: live preview on input with no history entry, one entry on release', () => {
		addTrace();
		mount();
		let ticks = 0;
		editor.subscribe({
			topic: 'traceLayer',
			subscriberID: 'anyink.test.panelTicks',
			callback: () => ticks++,
		});
		const bar = q('#anyink-trace-opacity');
		const before = historyLength();

		bar.value = '55';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		bar.value = '70';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		expect(getTrace(glyphA()).opacity).toBeCloseTo(0.7, 9);
		expect(historyLength()).toBe(before);
		expect(ticks).toBe(2);

		bar.dispatchEvent(new Event('change', { bubbles: true }));
		expect(historyLength()).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe('Set trace opacity to 70%');
		expect(historyTitles.opacity(70)).toBe('Set trace opacity to 70%');
		// The slider element was not rebuilt under the pointer
		expect(q('#anyink-trace-opacity')).toBe(bar);
	});

	it('slider: a release back where it started records nothing', () => {
		addTrace();
		mount();
		const bar = q('#anyink-trace-opacity');
		const before = historyLength();
		bar.value = '60';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		bar.value = '40';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		bar.dispatchEvent(new Event('change', { bubbles: true }));
		expect(historyLength()).toBe(before);
		expect(getTrace(glyphA()).opacity).toBeCloseTo(0.4, 9);
	});

	it('undo of an opacity change moves the slider back', () => {
		addTrace();
		editor.history.addState('Added a trace image');
		mount();
		const bar = q('#anyink-trace-opacity');
		bar.value = '90';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		bar.dispatchEvent(new Event('change', { bubbles: true }));

		editor.history.restoreState();
		expect(getTrace(glyphA()).opacity).toBeCloseTo(0.4, 9);
		expect(q('#anyink-trace-opacity').value).toBe('40');
	});

	it.each([
		['Show', 'visible', false, 'Hid the trace image'],
		['Lock', 'locked', true, 'Locked the trace image'],
		['Invert colors', 'invert', true, 'Inverted the trace image colors'],
	])('%s: one history entry, trace updated', (text, key, value, title) => {
		addTrace();
		mount();
		const before = historyLength();
		click(toggleByText(text));
		expect(getTrace(glyphA())[key]).toBe(value);
		expect(historyLength()).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe(title);

		click(toggleByText(text));
		expect(getTrace(glyphA())[key]).toBe(!value);
		expect(historyLength()).toBe(before + 2);
	});

	it('Lock turns off the fit buttons and changes the hint', () => {
		addTrace();
		mount();
		expect(buttonByText('Fit to em').disabled).toBe(false);
		expect(q('.anyink-trace-panel__hint').textContent).toBe(DRAG_HINT);
		click(toggleByText('Lock'));
		expect(buttonByText('Fit to em').disabled).toBe(true);
		expect(buttonByText('Fit to cap height').disabled).toBe(true);
		expect(q('.anyink-trace-panel__hint').textContent).toBe(LOCKED_HINT);
	});

	// Finalize: shapes over the image now win a press (D-028 revisit), so the hint says
	// the image moves from an empty part of it, and a press on a shape selects the shape
	it('the hint matches the canvas rule: empty paper moves the image, a shape press selects it', () => {
		addTrace();
		mount();
		const hint = q('.anyink-trace-panel__hint').textContent;
		expect(hint).toMatch(/Resize tool \(the arrow\)/);
		expect(hint).toMatch(/empty part of the image to move it/);
		expect(hint).toMatch(/a corner to resize it/);
		expect(hint).toMatch(/Press a shape to select it/);
		expect(hint).toMatch(/drawing tools always draw over the image/);
	});

	it('Fit to cap height and Fit to em: one entry each, placement from the font metrics', () => {
		addTrace({ x: 40, y: 500, scale: 0.5 });
		mount();
		const before = historyLength();

		buttonByText('Fit to cap height').click();
		let trace = getTrace(glyphA());
		expect(trace.x).toBe(0);
		expect(trace.y).toBe(790);
		expect(trace.height * trace.scale).toBeCloseTo(790, 9);
		expect(historyLength()).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe('Fit the trace image to the cap height');

		buttonByText('Fit to em').click();
		trace = getTrace(glyphA());
		expect(trace.y).toBe(800);
		expect(trace.height * trace.scale).toBeCloseTo(1000, 9);
		expect(historyLength()).toBe(before + 2);
		expect(editor.history.queue[0].title).toBe('Fit the trace image to the em');
		expect(q('.anyink-trace-panel__readout').textContent).toBe(
			'Top left: 0, 800 · Size: 500 × 1000 font units'
		);

		// Already fitted: nothing to undo
		buttonByText('Fit to em').click();
		expect(historyLength()).toBe(before + 2);
	});

	it('Draw glyph as outline flips the canvas display mode, with no history entry', () => {
		addTrace();
		mount();
		const settings = editor.project.settings.app;
		const before = historyLength();
		let views = 0;
		editor.subscribe({
			topic: 'editCanvasView',
			subscriberID: 'anyink.test.panelView',
			callback: () => views++,
		});

		click(toggleByText('Draw glyph as outline'));
		expect(settings.canvasDisplayModeFilled).toBe(false);
		expect(views).toBe(1);
		expect(historyLength()).toBe(before);

		// The canvas toolbar's fill / outline button flips it back; the checkbox follows
		settings.canvasDisplayModeFilled = true;
		editor.publish('editCanvasView', editor.view);
		expect(toggleByText('Draw glyph as outline').checked).toBe(false);
	});

	it('Remove image empties the panel; undo brings the full panel back', () => {
		addTrace();
		editor.history.addState('Added a trace image');
		mount();
		buttonByText('Remove image').click();
		expect(getTrace(glyphA())).toBeNull();
		expect(editor.history.queue[0].title).toBe(HISTORY_REMOVED);
		expect(q('.anyink-trace-panel__text').textContent).toBe(EMPTY_TEXT);

		editor.history.restoreState();
		expect(getTrace(glyphA())).not.toBeNull();
		expect(q('#anyink-trace-opacity')).not.toBeNull();
	});

	it('follows canvas drags in place (readout updates, nothing rebuilt)', () => {
		addTrace();
		mount();
		const bar = q('#anyink-trace-opacity');
		setTrace(glyphA(), { ...getTrace(glyphA()), x: 120, y: 640 });
		editor.publish('traceLayer', glyphA());
		expect(q('.anyink-trace-panel__readout').textContent).toBe(
			'Top left: 120, 640 · Size: 500 × 1000 font units'
		);
		expect(q('#anyink-trace-opacity')).toBe(bar);
		expect(urls.created).toHaveLength(1);
	});

	it('leaves the DOM alone on currentItem ticks that change nothing it shows', () => {
		addTrace();
		mount();
		const readout = q('.anyink-trace-panel__readout');
		readout.textContent = 'untouched';
		// A point drag on the glyph publishes currentItem every tick; the trace is unchanged
		editor.publish('currentItem', glyphA());
		editor.publish('currentItem', glyphA());
		expect(readout.textContent).toBe('untouched');

		setTrace(glyphA(), { ...getTrace(glyphA()), x: 10 });
		editor.publish('currentItem', glyphA());
		expect(readout.textContent).toBe('Top left: 10, 800 · Size: 500 × 1000 font units');
	});

	it('rebuilds for another glyph and revokes the old thumbnail URL a moment later', () => {
		addTrace();
		mount();
		expect(urls.created).toEqual(['blob:fake-1']);
		flushThumbnailRevokes(); // an earlier test's thumbnail was released by this build
		urls.revoked.length = 0;

		editor.selectedGlyphID = 'glyph-0x42'; // publishes whichGlyphIsSelected
		expect(q('.anyink-trace-panel__text').textContent).toBe(EMPTY_TEXT);
		// Not at once: a just-detached <img> may still be about to fetch it
		expect(urls.revoked).toEqual([]);
		flushThumbnailRevokes();
		expect(urls.revoked).toEqual(['blob:fake-1']);

		editor.selectedGlyphID = 'glyph-0x41';
		expect(q('img.anyink-trace-panel__thumb').getAttribute('src')).toBe('blob:fake-2');
	});

	it('reuses the thumbnail URL when the panel is rebuilt for the same image (integration)', () => {
		addTrace();
		mount();
		flushThumbnailRevokes();
		urls.revoked.length = 0;
		const first = q('img.anyink-trace-panel__thumb').getAttribute('src');
		mount(); // a page change or an undo across items rebuilds the whole panel
		mount();
		expect(q('img.anyink-trace-panel__thumb').getAttribute('src')).toBe(first);
		expect(urls.created).toEqual([first]);
		flushThumbnailRevokes();
		expect(urls.revoked).toEqual([]);
	});

	it('revokes a released URL on its own after the delay', () => {
		vi.useFakeTimers();
		try {
			addTrace();
			mount();
			flushThumbnailRevokes();
			urls.revoked.length = 0;
			editor.selectedGlyphID = 'glyph-0x42';
			vi.advanceTimersByTime(THUMBNAIL_REVOKE_DELAY_MS - 1);
			expect(urls.revoked).toEqual([]);
			vi.advanceTimersByTime(1);
			expect(urls.revoked).toEqual([urls.created.at(-1)]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('Trace panel subscribers', () => {
	function allIDs() {
		const ids = new Set();
		for (const topic of Object.keys(editor.subscribers)) {
			for (const id of Object.keys(editor.subscribers[topic] || {})) ids.add(id);
		}
		return [...ids];
	}

	it('use anyink.trace.panel ids that are never a substring of another id', () => {
		addTrace();
		mount();
		const ids = allIDs();
		const mine = ids.filter((id) => id.startsWith('anyink.trace.panel'));
		expect(mine.sort()).toEqual([PANEL_VIEW_ID, PANEL_SYNC_ID].sort());
		for (const id of mine) {
			for (const other of ids) {
				if (other === id) continue;
				expect(other.includes(id), `${other} contains ${id}`).toBe(false);
				expect(id.includes(other), `${id} contains ${other}`).toBe(false);
			}
		}
	});

	it('are removed when another panel opens', () => {
		addTrace();
		mount();
		editor.nav.panel = 'History';
		mount();
		expect(allIDs().filter((id) => id.startsWith('anyink.trace.panel'))).toEqual([]);
	});
});

// --------------------------------------------------------------
// Fix: keyboard focus (finding 'Clicking a Trace panel checkbox leaves the keyboard stuck')
// --------------------------------------------------------------

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * What a real mouse click does in Chrome, in order: pointerdown, mousedown focuses the
 * control, pointerup, then click (a checkbox toggles and fires change). The canvas cancels
 * its own mousedown, so clicking it afterwards never takes the focus back.
 */
function mouseClick(element, focusTarget = element) {
	element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
	focusTarget.focus();
	window.dispatchEvent(new Event('pointerup'));
	element.click();
}

describe('Trace panel hands the keyboard back after a mouse click', () => {
	it('a checkbox clicked with the mouse lets go of the focus, so Space and Ctrl+Z reach the canvas', async () => {
		addTrace();
		mount();
		const outline = toggleByText('Draw glyph as outline');
		mouseClick(outline);
		expect(outline.checked).toBe(true);
		await nextTask();
		expect(document.activeElement).not.toBe(outline);
		expect(document.activeElement).toBe(document.body);
	});

	it('clicking the words of a toggle lets go too (Chrome focuses the box during the click)', async () => {
		addTrace();
		mount();
		const lock = toggleByText('Lock');
		const before = historyLength();
		lock.closest('label').dispatchEvent(new Event('pointerdown', { bubbles: true }));
		window.dispatchEvent(new Event('pointerup'));
		lock.click();
		lock.focus();
		await nextTask();
		expect(document.activeElement).not.toBe(lock);
		// Space after this pans the canvas instead of flipping Lock back with a history entry
		expect(lock.checked).toBe(true);
		expect(historyLength()).toBe(before + 1);
	});

	it('the opacity slider lets go when the mouse is released, so arrows move the image again', async () => {
		addTrace();
		mount();
		const bar = q('input[type="range"]');
		const before = historyLength();
		bar.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		bar.focus();
		bar.value = '60';
		bar.dispatchEvent(new Event('input', { bubbles: true }));
		window.dispatchEvent(new Event('pointerup'));
		bar.dispatchEvent(new Event('change', { bubbles: true }));
		await nextTask();
		expect(document.activeElement).not.toBe(bar);
		expect(getTrace(glyphA()).opacity).toBeCloseTo(0.6);
		expect(historyLength()).toBe(before + 1);
	});

	it('a button clicked with the mouse lets go too (Space would press it again)', async () => {
		addTrace();
		mount();
		const fit = buttonByText('Fit to em');
		mouseClick(fit);
		await nextTask();
		expect(document.activeElement).not.toBe(fit);
	});

	it('keyboard use keeps the focus where the user put it', async () => {
		addTrace();
		mount();
		const lock = toggleByText('Lock');
		lock.focus();
		lock.click(); // Space on a focused checkbox clicks it
		await nextTask();
		expect(lock.checked).toBe(true);
		expect(document.activeElement).toBe(lock);
	});
});

// --------------------------------------------------------------
// Fix: a photo dropped on the Trace panel (finding 'Dropping the photo anywhere but the canvas')
// --------------------------------------------------------------

function dragEvent(type, files = []) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const types = files.length ? ['Files'] : ['text/plain'];
	Object.defineProperty(event, 'dataTransfer', { value: { types, files, dropEffect: 'none' } });
	return event;
}

const lettering = () => new File([new Uint8Array(16)], 'lettering.png', { type: 'image/png' });

describe('Trace panel takes a dropped image', () => {
	beforeEach(() => {
		setDecoderForTests({
			decode: vi.fn(async () => ({ width: 400, height: 800, close: vi.fn() })),
			encode: vi.fn(
				async (_bitmap, o) => new Blob([`${o.width}x${o.height}`], { type: 'image/webp' })
			),
		});
	});
	afterEach(() => setDecoderForTests(null));

	it('an image dropped on the empty card becomes the trace, the same as on the canvas', async () => {
		mount();
		const drop = dragEvent('drop', [lettering()]);
		q('.panel__card').dispatchEvent(drop);
		// Chrome's own file drop (open the image, "Leave site?") never happens
		expect(drop.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(getTrace(glyphA())).not.toBeNull());
		expect(editor.history.queue[0].title).toBe(HISTORY_ADDED);
		expect(editor.assets.ids()).toHaveLength(1);
		// The empty card says so
		expect(EMPTY_TEXT).toMatch(/on the canvas or here/);
	});

	it('accepts the drag and lights the cards up while a file is over them', () => {
		addTrace();
		mount();
		const host = q('.anyink-trace-panel');
		const card = q('.panel__card');
		card.dispatchEvent(dragEvent('dragenter', [lettering()]));
		const over = dragEvent('dragover', [lettering()]);
		card.dispatchEvent(over);
		expect(over.defaultPrevented).toBe(true);
		expect(host.classList.contains('anyink-trace-panel--drop')).toBe(true);
		card.dispatchEvent(dragEvent('dragleave', [lettering()]));
		expect(host.classList.contains('anyink-trace-panel--drop')).toBe(false);
	});

	it('leaves a drag of text alone', () => {
		mount();
		const over = dragEvent('dragover');
		q('.panel__card').dispatchEvent(over);
		expect(over.defaultPrevented).toBe(false);
		expect(q('.anyink-trace-panel').classList.contains('anyink-trace-panel--drop')).toBe(false);
	});
});
