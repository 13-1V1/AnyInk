// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track C: the Auto-trace card (src/anyink/autotrace/autotrace_panel.js), inside
// the real Trace panel (upstream makePanel) and on its own, against a real ProjectEditor and
// the real session, with the facade (autotrace.js) and apply.js mocked. Covers: no card
// without a trace; the collapsed state (and why Start can be off); the open state's controls
// and defaults; the readout, the many-points warning, the no-ink and error lines; sliders,
// mode and toggles driving the session (one debounced trace, nothing in history); the
// Threshold slider showing the Auto value and switching to hand-set on drag; Replace, Add,
// Cancel; Escape and Enter; a rebuilt card coming back open; and the subscriber-id rule.
// Fixes: Start in the Trace image card and the panel scrolling the opened card into view;
// the Photo advice (many points in Scan, ink running into the traced area's edge, Try
// Photo); the Threshold tooltip and bar ends saying which way is more ink (checked against
// binarize); Enter on a checkbox doing nothing and the Replace tooltip naming Enter.
// Finalize: refused previews read as advice and keep Replace off; shapes left out by the
// glyph box rule are named; the reason Replace gave up stays on screen; Try Photo and the
// mode buttons go back to Auto; the advice tells a box cut from a photo's uneven light;
// the Replace row stays in view.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
const autoTraceTrace = vi.fn((args) => {
	const call = { args, options: { ...args.options }, preview: args.preview };
	call.promise = new Promise((resolve, reject) => {
		call.resolve = resolve;
		call.reject = reject;
	});
	calls.push(call);
	return call.promise;
});
const clearAutoTraceCache = vi.fn();
const applyAutoTrace = vi.fn(({ editor, item, shapes }) => {
	editor.history.addState(`Auto-traced ${shapes.length} shapes`);
	editor.publish('currentItem', item);
	return true;
});

let panelModule;
let session;
let setCurrentProjectEditor;
let makePanel;
let importGlyphrProjectFromText;
let ProjectEditor;
let setTrace;
let sampleProject;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../autotrace.js', () => ({
		autoTraceTrace,
		clearAutoTraceCache,
		autoTraceImageData: vi.fn(),
		PREVIEW_MAX_SIDE: 1000,
	}));
	vi.doMock('../apply.js', () => ({ applyAutoTrace }));
	({ setCurrentProjectEditor } = await import('../../../app/main.js'));
	({ makePanel } = await import('../../../panels/panels.js'));
	({ importGlyphrProjectFromText } = await import('../../../project_editor/import_project.js'));
	({ ProjectEditor } = await import('../../../project_editor/project_editor.js'));
	({ setTrace } = await import('../../trace/trace_model.js'));
	session = await import('../autotrace_session.js');
	panelModule = await import('../autotrace_panel.js');
	sampleProject = (await import('../../../samples/simpleExampleProject.json')).default;
});

let editor;
let area;

function glyph(id = 'glyph-0x41') {
	return editor.project.getItem(id);
}

function addTrace(id = 'glyph-0x41') {
	const asset = editor.assets.add(new Blob(['png'], { type: 'image/png' }));
	setTrace(glyph(id), {
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
	});
	return asset;
}

function result(shapes = 3, points = 412, extra = {}) {
	return {
		shapes: Array.from({ length: shapes }, () => ({ objType: 'Path', pathPoints: [] })),
		points,
		ms: 180,
		threshold: 102,
		autoThreshold: 102,
		...extra,
	};
}

const settle = () => vi.advanceTimersByTimeAsync(0);

/** The card, made on its own and put in the page. */
function mountCard() {
	area.innerHTML = '';
	const card = panelModule.makeAutoTraceCard({ editor, item: glyph() });
	if (card) area.appendChild(card);
	return card;
}

/** The whole Trace panel, as the app builds it. */
function mountPanel() {
	area.innerHTML = '';
	area.appendChild(makePanel());
	return area.querySelector('.anyink-autotrace-card');
}

const q = (selector) => area.querySelector(selector);
const button = (text) => [...area.querySelectorAll('button')].find((b) => b.textContent === text);
const text = (selector) => q(selector)?.textContent || '';
function toggle(label) {
	const row = [...area.querySelectorAll('.anyink-autotrace-card__toggle')].find(
		(l) => l.textContent.trim() === label
	);
	return row?.querySelector('input[type="checkbox"]');
}
function slide(id, value) {
	const bar = area.querySelector(`#${id}`);
	bar.value = String(value);
	bar.dispatchEvent(new Event('input', { bubbles: true }));
	return bar;
}
function release(id) {
	area.querySelector(`#${id}`).dispatchEvent(new Event('change', { bubbles: true }));
}
function key(target, name) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

async function openReady(r = result()) {
	mountCard();
	button(panelModule.START_LABEL).click();
	calls.at(-1).resolve(r);
	await settle();
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('Worker', class FakeWorker {});
	calls.length = 0;
	autoTraceTrace.mockClear();
	applyAutoTrace.mockClear();
	session.resetAutoTraceSessionForTests();
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(sampleProject);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
	area = document.createElement('div');
	area.id = 'editor-page__panel';
	document.body.appendChild(area);
});

afterEach(() => {
	session.resetAutoTraceSessionForTests();
	area.remove();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('collapsed card', () => {
	it('is null while the item has no trace', () => {
		expect(panelModule.makeAutoTraceCard({ editor, item: glyph() })).toBeNull();
		expect(panelModule.makeAutoTraceCard({ editor, item: null })).toBeNull();
		mountPanel();
		expect(q('.anyink-autotrace-card')).toBeNull();
	});

	it('shows the title, one line, and Start, last in the Trace panel', () => {
		addTrace();
		const card = mountPanel();
		expect(card).not.toBeNull();
		expect(q('.anyink-trace-panel').lastElementChild).toBe(card);
		expect(card.querySelector('h3').textContent).toBe(panelModule.CARD_TITLE);
		expect(text('.anyink-autotrace-card__text')).toBe(panelModule.INTRO_TEXT);
		const start = button(panelModule.START_LABEL);
		expect(start.disabled).toBe(false);
		expect(start.className).toContain('button__call-to-action');
		expect(button(panelModule.BUTTON_LABELS.replace)).toBeUndefined();
		expect(autoTraceTrace).not.toHaveBeenCalled();
	});

	it('Start is off, with the reason, without workers or without the picture', () => {
		addTrace();
		vi.stubGlobal('Worker', undefined);
		mountCard();
		expect(button(panelModule.START_LABEL).disabled).toBe(true);
		expect(text('.anyink-autotrace-card__note')).toBe(panelModule.UNAVAILABLE_TEXT);

		vi.stubGlobal('Worker', class FakeWorker {});
		mountCard();
		expect(button(panelModule.START_LABEL).disabled).toBe(false);
		expect(q('.anyink-autotrace-card__note').hidden).toBe(true);

		editor.assets.delete(addTrace());
		mountCard();
		expect(button(panelModule.START_LABEL).disabled).toBe(true);
		expect(text('.anyink-autotrace-card__note')).toBe(panelModule.MISSING_TEXT);
	});
});

describe('open card', () => {
	beforeEach(() => addTrace());

	it('Start opens every control at its default and traces once', () => {
		mountCard();
		button(panelModule.START_LABEL).click();
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);
		expect(q('.anyink-autotrace-card--open')).not.toBeNull();
		expect(button(panelModule.START_LABEL).closest('[hidden]')).not.toBeNull();

		const scan = button('Scan');
		const photo = button('Photo');
		expect(scan.getAttribute('aria-pressed')).toBe('true');
		expect(photo.getAttribute('aria-pressed')).toBe('false');
		expect(q('#anyink-autotrace-smoothing').value).toBe('75');
		expect(q('#anyink-autotrace-detail').value).toBe('60');
		expect(button('Auto').getAttribute('aria-pressed')).toBe('true');
		expect(toggle('Remove specks').checked).toBe(true);
		expect(toggle('Light ink on dark paper').checked).toBe(false);
		expect(toggle('Only inside the glyph box').checked).toBe(true);
		expect(text('.anyink-autotrace-card__readout')).toBe(panelModule.TRACING_TEXT);
		for (const label of ['Replace outlines', 'Add to outlines', 'Cancel']) {
			expect(button(label), label).toBeDefined();
		}
		expect(q('.anyink-autotrace-card__warning').hidden).toBe(true);
	});

	it('the readout says shapes, points and time; Threshold shows the Auto value', async () => {
		await openReady(result(3, 412, { autoThreshold: 102 }));
		expect(text('.anyink-autotrace-card__readout')).toBe('3 shapes, 412 points, traced in 180 ms');
		expect(q('#anyink-autotrace-threshold').value).toBe('40'); // 102 / 255
		expect(q('.anyink-autotrace-card__warning').hidden).toBe(true);
		expect(panelModule.readoutText(result(1, 1))).toBe('1 shape, 1 point, traced in 180 ms');
	});

	it('warns above 1,000 points', async () => {
		await openReady(result(12, 1204));
		expect(text('.anyink-autotrace-card__readout')).toBe(
			'12 shapes, 1,204 points, traced in 180 ms'
		);
		const warning = q('.anyink-autotrace-card__warning');
		expect(warning.hidden).toBe(false);
		expect(text('.anyink-autotrace-card__warning-text')).toBe(panelModule.MANY_POINTS_SCAN_TEXT);
	});

	it('no ink: says so and turns Replace and Add off', async () => {
		await openReady(result(0, 0));
		expect(text('.anyink-autotrace-card__readout')).toBe(panelModule.NO_SHAPES_TEXT);
		expect(button('Replace outlines').disabled).toBe(true);
		expect(button('Add to outlines').disabled).toBe(true);
		expect(button('Cancel').disabled).toBe(false);
	});

	it("an error reads 'Auto-trace failed: <reason>'", async () => {
		mountCard();
		button(panelModule.START_LABEL).click();
		calls[0].reject(new Error('The trace image is missing.'));
		await settle();
		expect(text('.anyink-autotrace-card__readout')).toBe(
			'Auto-trace failed: The trace image is missing.'
		);
		expect(q('.anyink-autotrace-card__readout--error')).not.toBeNull();
	});

	it('a slider drag makes one trace after the debounce and no history', async () => {
		await openReady();
		const before = editor.history.queue.length;
		for (const v of [70, 60, 50, 40, 30]) slide('anyink-autotrace-smoothing', v);
		release('anyink-autotrace-smoothing');
		expect(text('.anyink-autotrace-card__readout')).toBe('3 shapes, 412 points, traced in 180 ms');
		expect(q('.anyink-autotrace-card__readout--busy')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
		expect(calls[1].options.smoothing).toBe(0.3);
		slide('anyink-autotrace-detail', 90);
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(calls.at(-1).options.detail).toBe(0.9);
		expect(editor.history.queue.length).toBe(before);
	});

	it('dragging Threshold switches to hand-set; Auto goes back', async () => {
		await openReady();
		slide('anyink-autotrace-threshold', 30);
		expect(session.getSession().options.threshold).toBe(77); // 30 % of 255
		expect(button('Auto').getAttribute('aria-pressed')).toBe('false');
		expect(q('#anyink-autotrace-threshold').value).toBe('30');

		button('Auto').click();
		expect(session.getSession().options.threshold).toBe('auto');
		expect(button('Auto').getAttribute('aria-pressed')).toBe('true');
		expect(q('#anyink-autotrace-threshold').value).toBe('40'); // back to the image's value

		slide('anyink-autotrace-threshold', 55);
		q('#anyink-autotrace-threshold')
			.closest('.anyink-slider-row')
			.querySelector('.fancy-slider__slider-readout')
			.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(session.getSession().options.threshold).toBe('auto');
	});

	it('mode and toggles change the options', async () => {
		await openReady();
		button('Photo').click();
		expect(session.getSession().options.mode).toBe('photo');
		expect(button('Photo').getAttribute('aria-pressed')).toBe('true');
		for (const [label, key, value] of [
			['Remove specks', 'despeckle', false],
			['Light ink on dark paper', 'invert', true],
			['Only inside the glyph box', 'insideBoxOnly', false],
		]) {
			const input = toggle(label);
			input.checked = !input.checked;
			input.dispatchEvent(new Event('change', { bubbles: true }));
			expect(session.getSession().options[key], label).toBe(value);
		}
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
		expect(calls[1].options).toMatchObject({
			mode: 'photo',
			despeckle: false,
			invert: true,
			insideBoxOnly: false,
		});
	});
});

describe('Replace, Add, Cancel', () => {
	beforeEach(() => addTrace());

	for (const [label, mode] of [
		['Replace outlines', 'replace'],
		['Add to outlines', 'add'],
	]) {
		it(`${label} applies once and collapses the card`, async () => {
			await openReady();
			const before = editor.history.queue.length;
			button(label).click();
			expect(text('.anyink-autotrace-card__readout')).toBe(panelModule.APPLYING_TEXT);
			expect(button('Replace outlines').disabled).toBe(true);
			expect(q('#anyink-autotrace-smoothing').disabled).toBe(true);
			expect(calls[1].preview).toBe(false);
			calls[1].resolve(result(4, 300));
			await settle();
			expect(applyAutoTrace).toHaveBeenCalledTimes(1);
			expect(applyAutoTrace.mock.calls[0][0].mode).toBe(mode);
			expect(editor.history.queue.length).toBe(before + 1);
			expect(session.getSession()).toBeNull();
			expect(q('.anyink-autotrace-card--open')).toBeNull();
			expect(button(panelModule.START_LABEL).closest('[hidden]')).toBeNull();
		});
	}

	it('Cancel collapses the card with no history', async () => {
		await openReady();
		const before = editor.history.queue.length;
		button('Cancel').click();
		expect(session.getSession()).toBeNull();
		expect(q('.anyink-autotrace-card--open')).toBeNull();
		expect(editor.history.queue.length).toBe(before);
		expect(applyAutoTrace).not.toHaveBeenCalled();
	});

	it('the Replace tooltip counts the shapes it takes out', async () => {
		await openReady();
		const n = glyph().shapes.length;
		expect(button('Replace outlines').title).toContain(`${n} shape`);
	});
});

describe('keyboard', () => {
	beforeEach(() => addTrace());

	it('Escape cancels from the page, but not from a text field', async () => {
		await openReady();
		const field = document.createElement('input');
		field.type = 'text';
		document.body.appendChild(field);
		field.focus();
		key(field, 'Escape');
		expect(session.getSession()).not.toBeNull();
		field.remove();

		const event = key(document.body, 'Escape');
		expect(session.getSession()).toBeNull();
		expect(event.defaultPrevented).toBe(true);
		expect(q('.anyink-autotrace-card--open')).toBeNull();
	});

	it('Escape does nothing without a session or when something used it first', async () => {
		expect(panelModule.handleAutoTraceEscape(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(
			false
		);
		await openReady();
		const used = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
		used.preventDefault();
		expect(panelModule.handleAutoTraceEscape(used)).toBe(false);
		expect(session.getSession()).not.toBeNull();
	});

	it('Enter on a slider means Replace; Enter on a button is the button', async () => {
		await openReady();
		key(button('Cancel'), 'Enter');
		expect(calls.length).toBe(1);

		const input = q('#anyink-autotrace-smoothing');
		input.focus();
		const event = key(input, 'Enter');
		expect(event.defaultPrevented).toBe(true);
		expect(calls.length).toBe(2);
		expect(calls[1].preview).toBe(false);
		calls[1].resolve(result());
		await settle();
		expect(applyAutoTrace).toHaveBeenCalledTimes(1);
		expect(applyAutoTrace.mock.calls[0][0].mode).toBe('replace');
	});

	it('Enter outside the card does not apply', async () => {
		await openReady();
		key(document.body, 'Enter');
		expect(calls.length).toBe(1);
	});

	it('Enter on a checkbox does nothing (fix: it replaced the outlines)', async () => {
		await openReady();
		const input = toggle('Remove specks');
		input.focus();
		const event = key(input, 'Enter');
		expect(event.defaultPrevented).toBe(false);
		await settle();
		expect(calls.length).toBe(1);
		expect(applyAutoTrace).not.toHaveBeenCalled();
		expect(session.getSession()).not.toBeNull();
	});

	it('the Replace outlines tooltip names its key (fix)', async () => {
		await openReady();
		expect(button('Replace outlines').title).toMatch(/\(Enter\)$/);
		expect(button('Cancel').title).toMatch(/\(Esc\)$/);
	});
});

describe('finding Auto-trace after adding an image (fix)', () => {
	beforeEach(() => addTrace());

	/** The Trace image card (the first card) of a mounted Trace panel. */
	function imageCard() {
		return [...area.querySelectorAll('.panel__card')].find(
			(card) => card.querySelector('h3')?.textContent === 'Trace image'
		);
	}

	/** Makes the panel area a 462 px tall scroller with the Auto-trace card below its fold. */
	function layOut(cardTop = 742, cardHeight = 460) {
		area.style.overflowY = 'auto';
		area.scrollTop = 0;
		area.getBoundingClientRect = () => ({
			top: 100,
			bottom: 562,
			height: 462,
			left: 0,
			right: 300,
		});
		const card = q('.anyink-autotrace-card');
		card.getBoundingClientRect = () => {
			const top = cardTop - area.scrollTop;
			return { top, bottom: top + cardHeight, height: cardHeight, left: 0, right: 300 };
		};
		return card;
	}

	it('the Trace image card starts auto-trace, beside Replace image and Remove image', () => {
		mountPanel();
		const buttons = [...imageCard().querySelectorAll('button')];
		expect(buttons.map((b) => b.textContent)).toEqual([
			panelModule.START_LABEL,
			'Replace image...',
			'Remove image',
		]);
		expect(buttons[0].className).toContain('button__call-to-action');
		expect(buttons[0].hidden).toBe(false);
		expect(buttons[0].disabled).toBe(false);
	});

	it('pressing it opens the Auto-trace card and scrolls the panel so the card is in view', () => {
		mountPanel();
		const card = layOut();
		imageCard().querySelector('button').click();
		expect(session.getSession()).not.toBeNull();
		expect(card.classList.contains('anyink-autotrace-card--open')).toBe(true);
		// Taller than the panel: its top (Mode, Threshold) lines up with the panel's top
		expect(area.scrollTop).toBe(742 - 100 - panelModule.REVEAL_MARGIN);
		// While the card is open the image card's Start is out of the way; it comes back after
		expect(imageCard().querySelector('button').hidden).toBe(true);
		button('Cancel').click();
		expect(imageCard().querySelector('button').hidden).toBe(false);
	});

	it("the card's own Start scrolls the opened card fully into view", () => {
		mountPanel();
		const card = layOut(500, 300);
		card.querySelector('button').click();
		expect(card.classList.contains('anyink-autotrace-card--open')).toBe(true);
		// Its bottom (Replace, Add, Cancel) comes up to the panel's bottom
		expect(area.scrollTop).toBe(500 + 300 - 562 + panelModule.REVEAL_MARGIN);
	});

	it('leaves the scroll alone when the open card already shows', () => {
		mountPanel();
		layOut(150, 300);
		imageCard().querySelector('button').click();
		expect(area.scrollTop).toBe(0);
	});

	it("the image card's Start stays out of the way when auto-trace cannot run", () => {
		vi.stubGlobal('Worker', undefined);
		mountPanel();
		const start = [...imageCard().querySelectorAll('button')].find(
			(b) => b.textContent === panelModule.START_LABEL
		);
		expect(start.hidden).toBe(true);
		// The Auto-trace card says why
		expect(q('.anyink-autotrace-card__note').textContent).toBe(panelModule.UNAVAILABLE_TEXT);
	});
});

describe('suggesting Photo mode (fix)', () => {
	beforeEach(() => addTrace());

	/** A traced shape whose bounding box is the given font-unit rect. */
	function shape(xMin, xMax, yMin, yMax) {
		return { objType: 'Path', pathPoints: [], maxes: { xMin, xMax, yMin, yMax } };
	}

	// The test trace covers x 0..500, y -200..800 font units (400 x 800 px at 1.25), and the
	// glyph box plus its margin covers all of it, so the traced area (the facade's
	// result.area) is the whole image; the paper is uneven (a photo)
	const traced = (shapes, points) => ({
		...result(0, points),
		shapes,
		width: 400,
		height: 800,
		paperSpread: 54,
		area: {
			xMin: 0,
			xMax: 500,
			yMin: -200,
			yMax: 800,
			pixel: 1.25,
			cut: { left: false, right: false, top: false, bottom: false },
		},
	});

	it('in Scan mode the many-points warning names Photo and offers Try Photo', async () => {
		await openReady(result(12, 1204));
		const warning = q('.anyink-autotrace-card__warning');
		expect(warning.hidden).toBe(false);
		expect(warning.textContent).toContain('try Photo');
		const tryPhoto = button(panelModule.BUTTON_LABELS.tryPhoto);
		expect(tryPhoto.hidden).toBe(false);
		tryPhoto.click();
		expect(session.getSession().options.mode).toBe('photo');
	});

	it('in Photo mode the many-points warning keeps the plain advice', async () => {
		mountCard();
		button(panelModule.START_LABEL).click();
		button('Photo').click();
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		calls.at(-1).resolve(result(12, 1204));
		await settle();
		expect(text('.anyink-autotrace-card__warning-text')).toBe(panelModule.MANY_POINTS_TEXT);
		expect(button(panelModule.BUTTON_LABELS.tryPhoto).hidden).toBe(true);
	});

	it('a shape that runs into the edge of the traced area suggests Photo, under 1,000 points too', async () => {
		// The R merged with the dim corner: it reaches the right and bottom edges
		await openReady(traced([shape(40, 500, -200, 760), shape(120, 300, 400, 640)], 838));
		const warning = q('.anyink-autotrace-card__warning');
		expect(warning.hidden).toBe(false);
		expect(text('.anyink-autotrace-card__warning-text')).toBe(panelModule.EDGE_PHOTO_TEXT);
		expect(button(panelModule.BUTTON_LABELS.tryPhoto).hidden).toBe(false);
	});

	it('a letter clear of the edges gets no hint', async () => {
		await openReady(traced([shape(40, 460, -150, 760), shape(120, 300, 400, 640)], 838));
		expect(q('.anyink-autotrace-card__warning').hidden).toBe(true);
	});

	it('photoAdvice is plain data (the test page bench uses it too)', () => {
		expect(panelModule.photoAdvice({ mode: 'scan', points: 1204 })).toEqual({
			text: panelModule.MANY_POINTS_SCAN_TEXT,
			tryPhoto: true,
		});
		expect(panelModule.photoAdvice({ mode: 'photo', points: 1204 })).toEqual({
			text: panelModule.MANY_POINTS_TEXT,
			tryPhoto: false,
		});
		expect(panelModule.photoAdvice({ mode: 'scan', points: 40, touchesEdge: true })).toEqual({
			text: panelModule.EDGE_PHOTO_TEXT,
			tryPhoto: true,
		});
		expect(panelModule.photoAdvice({ mode: 'photo', points: 40, touchesEdge: true })).toBeNull();
		expect(panelModule.photoAdvice({ mode: 'scan', points: 40 })).toBeNull();
	});
});

describe('Threshold says which way is more ink (fix)', () => {
	beforeEach(() => addTrace());

	it('the tooltip and the bar ends say that higher means more ink', async () => {
		await openReady();
		const row = q('#anyink-autotrace-threshold').closest('.anyink-slider-row');
		expect(row.title).not.toMatch(/How dark/);
		expect(row.title).toMatch(/^Higher counts more of the image as ink/);
		const ends = q('.anyink-autotrace-card__ends');
		expect([...ends.children].map((e) => e.textContent)).toEqual(['less ink', 'more ink']);
	});

	it('binarize agrees: a higher Threshold marks more ink in Scan, Photo, and light ink on dark paper', async () => {
		const { binarize } = await import('../binarize.js');
		// A soft-edged dot: the cutoff decides how wide it comes out
		const size = 64;
		const image = (ink, paper) => {
			const data = new Uint8ClampedArray(size * size * 4);
			for (let y = 0; y < size; y++) {
				for (let x = 0; x < size; x++) {
					const d = Math.hypot(x - 32, y - 32);
					const t = Math.min(1, Math.max(0, (d - 8) / 16));
					const v = Math.round(ink + (paper - ink) * t);
					data.set([v, v, v, 255], (y * size + x) * 4);
				}
			}
			return { data, width: size, height: size };
		};
		const inkCount = (img, options) => binarize(img, options).mask.reduce((a, b) => a + b, 0);
		for (const [mode, invert] of [
			['scan', false],
			['photo', false],
			['scan', true],
			['photo', true],
		]) {
			const img = invert ? image(230, 30) : image(30, 230);
			const low = inkCount(img, { mode, invert, threshold: 90, despeckle: false });
			const high = inkCount(img, { mode, invert, threshold: 170, despeckle: false });
			expect(high, `${mode}${invert ? ' inverted' : ''}`).toBeGreaterThan(low);
		}
	});
});

describe('rebuilds and subscriber ids', () => {
	beforeEach(() => addTrace());

	it('a rebuilt card (the panel refreshes) comes back open with the same values', async () => {
		await openReady();
		slide('anyink-autotrace-detail', 20);
		const card = mountPanel();
		expect(card.classList.contains('anyink-autotrace-card--open')).toBe(true);
		expect(q('#anyink-autotrace-detail').value).toBe('20');
		expect(text('.anyink-autotrace-card__readout')).toBe('3 shapes, 412 points, traced in 180 ms');
		// The old card stopped listening: only the new one follows the session
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		calls.at(-1).resolve(result(1, 10));
		await settle();
		expect(text('.anyink-autotrace-card__readout')).toBe('1 shape, 10 points, traced in 180 ms');
	});

	it('a glyph switch collapses the card', async () => {
		await openReady();
		addTrace('glyph-0x42');
		editor.selectedGlyphID = 'glyph-0x42';
		editor.publish('whichGlyphIsSelected', 'glyph-0x42');
		const card = mountPanel();
		expect(session.getSession()).toBeNull();
		expect(card.classList.contains('anyink-autotrace-card--open')).toBe(false);
	});

	it("ids start 'anyink.autotrace.panel.' / '.session.', none inside another; panels clean up", async () => {
		await openReady();
		mountPanel();
		const ids = () =>
			new Set(Object.values(editor.subscribers).flatMap((topic) => Object.keys(topic)));
		const mine = [...ids()].filter((id) => id.includes('autotrace'));
		expect(mine.sort()).toEqual([panelModule.PANEL_OUTLINES_ID, session.SESSION_WATCH_ID].sort());
		for (const id of mine) {
			expect(/^anyink\.autotrace\.(panel|session)\./.test(id), id).toBe(true);
			for (const other of ids()) {
				if (other !== id) {
					expect(other.includes(id), `${other} contains ${id}`).toBe(false);
					expect(id.includes(other), `${id} contains ${other}`).toBe(false);
				}
			}
		}

		// Another panel: the card's id goes (panels.js), and the session ends with the panel
		editor.nav.panel = 'History';
		mountPanel();
		expect(ids().has(panelModule.PANEL_OUTLINES_ID)).toBe(false);
		window.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Characters', appLevel: false } })
		);
		expect(session.getSession()).toBeNull();
		expect(ids().has(session.SESSION_WATCH_ID)).toBe(false);
	});
});

describe('number helpers', () => {
	it('percent and threshold round-trip every slider step', () => {
		for (let p = 0; p <= 100; p++) {
			expect(panelModule.thresholdToPercent(panelModule.percentToThreshold(p))).toBe(p);
		}
		expect(panelModule.percentToThreshold(50)).toBe(128);
		expect(panelModule.failedText('the worker stopped.')).toBe(
			'Auto-trace failed: the worker stopped.'
		);
	});
});

// --------------------------------------------------------------
// Finalize, 09/24/2026
// --------------------------------------------------------------

describe('finalize: refused previews, left-out shapes, giving up', () => {
	beforeEach(() => addTrace());

	const refused = (code, message) => Object.assign(new Error(message), { code });

	it('a preview refused as too many shapes reads as advice, and Replace and Add stay off', async () => {
		const message =
			'This trace has 2,542 shapes and 9,120 points, too many to edit. Lower Detail or turn on Remove specks.';
		mountCard();
		button(panelModule.START_LABEL).click();
		calls[0].reject(refused('too-many', message));
		await settle();
		expect(text('.anyink-autotrace-card__readout')).toBe(message);
		expect(q('.anyink-autotrace-card__readout--empty')).not.toBeNull();
		expect(button('Replace outlines').disabled).toBe(true);
		expect(button('Add to outlines').disabled).toBe(true);
		// Enter on a slider does not apply either
		key(q('#anyink-autotrace-detail'), 'Enter');
		expect(calls).toHaveLength(1);
		// Moving a slider traces again and turns them back on while it runs
		slide('anyink-autotrace-detail', 20);
		expect(button('Replace outlines').disabled).toBe(false);
	});

	it('every shape outside the glyph box: the message says so, and Replace stays off', async () => {
		const message =
			'1 shape lies outside the glyph box. Move the image over the glyph, or turn off "Only inside the glyph box".';
		mountCard();
		button(panelModule.START_LABEL).click();
		calls[0].reject(refused('shapes-outside-box', message));
		await settle();
		expect(text('.anyink-autotrace-card__readout')).toBe(message);
		expect(button('Replace outlines').disabled).toBe(true);
	});

	it('names the shapes the glyph box rule left out', async () => {
		await openReady(result(1, 4, { dropped: 1 }));
		const note = q('.anyink-autotrace-card__dropped');
		expect(note.hidden).toBe(false);
		expect(note.textContent).toBe('1 shape outside the glyph box is left out.');
		expect(panelModule.droppedText(3)).toBe('3 shapes outside the glyph box are left out.');
		calls.length = 0;
		slide('anyink-autotrace-detail', 20);
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		calls.at(-1).resolve(result(2, 40, { dropped: 0 }));
		await settle();
		expect(q('.anyink-autotrace-card__dropped').hidden).toBe(true);
	});

	it('when Replace gives up because the image kept moving, the reason stays under the preview', async () => {
		await openReady(result(2, 20));
		button('Replace outlines').click();
		for (let i = 1; i <= 10 && calls.length > i; i++) {
			const t = glyph().anyink.trace;
			setTrace(glyph(), { ...t, x: t.x + 10 });
			calls[i].resolve(result());
			await settle();
		}
		const notice = q('.anyink-autotrace-card__notice');
		expect(notice.hidden).toBe(false);
		expect(notice.textContent).toBe(panelModule.failedText(session.movedReason('replace')));
		// The preview traces again where the image is; the notice survives it
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		calls.at(-1).resolve(result(2, 31));
		await settle();
		expect(text('.anyink-autotrace-card__readout')).toBe('2 shapes, 31 points, traced in 180 ms');
		expect(q('.anyink-autotrace-card__notice').hidden).toBe(false);
	});
});

describe('finalize: Photo advice and Threshold', () => {
	beforeEach(() => addTrace());

	function shape(xMin, xMax, yMin, yMax) {
		return { objType: 'Path', pathPoints: [], maxes: { xMin, xMax, yMin, yMax } };
	}
	/** The traced area x 0..500, y -200..800; cut marks sides the glyph box rule cut. */
	const tracedIn = (shapes, points, { cut = {}, paperSpread = 54 } = {}) => ({
		...result(0, points),
		shapes,
		width: 400,
		height: 800,
		paperSpread,
		area: {
			xMin: 0,
			xMax: 500,
			yMin: -200,
			yMax: 800,
			pixel: 1.25,
			cut: { left: false, right: false, top: false, bottom: false, ...cut },
		},
	});

	it('Try Photo from a hand-set Threshold goes back to Auto (a hand-set cutoff means another thing in Photo)', async () => {
		await openReady(result(12, 1204, { paperSpread: 54 }));
		slide('anyink-autotrace-threshold', 80);
		expect(session.getSession().options.threshold).toBe(204);
		button(panelModule.BUTTON_LABELS.tryPhoto).click();
		expect(session.getSession().options).toMatchObject({ mode: 'photo', threshold: 'auto' });
	});

	it('the mode buttons go back to Auto when the mode changes, and leave it alone otherwise', async () => {
		await openReady();
		slide('anyink-autotrace-threshold', 30);
		button('Scan').click();
		expect(session.getSession().options.threshold).toBe(77);
		button('Photo').click();
		expect(session.getSession().options).toMatchObject({ mode: 'photo', threshold: 'auto' });
	});

	it('in Photo with a hand-set Threshold the many-points line names Auto first', async () => {
		expect(panelModule.photoAdvice({ mode: 'photo', points: 1155, handSet: true })).toEqual({
			text: panelModule.MANY_POINTS_HAND_TEXT,
			tryPhoto: false,
		});
		expect(panelModule.MANY_POINTS_HAND_TEXT).toMatch(/^Many points: press Auto/);
	});

	it('a letter cut by the glyph box margin says so, not Photo', async () => {
		// The S is cut flat on the right, where the box plus its margin cut the image
		await openReady(tracedIn([shape(20, 500, -150, 760)], 55, { cut: { right: true } }));
		expect(text('.anyink-autotrace-card__warning-text')).toBe(panelModule.BOX_EDGE_TEXT);
		expect(button(panelModule.BUTTON_LABELS.tryPhoto).hidden).toBe(true);
	});

	it('ink at the edge of a clean, evenly lit scan gets no Photo hint', async () => {
		await openReady(tracedIn([shape(0, 460, -150, 760)], 55, { paperSpread: 3 }));
		expect(q('.anyink-autotrace-card__warning').hidden).toBe(true);
		// ...and its many-points line is the plain one
		expect(panelModule.photoAdvice({ mode: 'scan', points: 1204, paperSpread: 3 })).toEqual({
			text: panelModule.MANY_POINTS_TEXT,
			tryPhoto: false,
		});
	});

	it('ink at the image edge with uneven paper still suggests Photo', async () => {
		await openReady(tracedIn([shape(0, 460, -150, 760)], 55));
		expect(text('.anyink-autotrace-card__warning-text')).toBe(panelModule.EDGE_PHOTO_TEXT);
		expect(button(panelModule.BUTTON_LABELS.tryPhoto).hidden).toBe(false);
	});

	it('without the traced area in the result there is no edge hint', async () => {
		await openReady({ ...tracedIn([shape(0, 500, -200, 800)], 55), area: undefined });
		expect(q('.anyink-autotrace-card__warning').hidden).toBe(true);
	});
});

describe('finalize: the Replace row stays in view', () => {
	it('the open card marks its button row, and the style keeps that row at the panel bottom', async () => {
		addTrace();
		await openReady();
		const row = button('Replace outlines').parentElement;
		expect(row.classList.contains('anyink-autotrace-card__actions')).toBe(true);
		const css = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '..', 'autotrace.css'),
			'utf8'
		);
		const rule = css.match(/\.anyink-autotrace-card__actions\s*\{([^}]*)\}/);
		expect(rule, 'a rule for the action row').not.toBeNull();
		expect(rule[1]).toMatch(/position:\s*sticky/);
		expect(rule[1]).toMatch(/bottom:\s*0/);
		expect(rule[1]).toMatch(/background-color:\s*var\(--chrome-bg-raised\)/);
	});
});
