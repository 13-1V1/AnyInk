// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track C: the auto-trace preview session (src/anyink/autotrace/autotrace_session.js)
// against a real ProjectEditor, with the facade (autotrace.js) and apply.js mocked, so every
// trace is a promise the test settles by hand. Covers start -> tracing -> ready, the
// debounce (a slider drag makes one trace), latest wins (stale and superseded results
// ignored), errors in plain words, the session ending on a glyph switch (also mid-trace), a
// panel switch (with and without navigate), a removed trace, a closed project, a switch to
// the other open project, a hidden or locked trace (still allowed),
// re-tracing when the image moves, Replace and Add (full-size trace, one apply, session
// over), Cancel (no history), remembered options, and the subscriber-id rule.
// Fixes: Replace / Add re-trace when the image or the glyph box moves during the full-size
// trace (and give up in plain words when it keeps moving); a long slider drag re-traces at
// least every SESSION_MAX_WAIT_MS without replacing a trace that is still running.
// Finalize: ending the session lets the kept preview pixels go; a preview refused as too
// many shapes or outside the glyph box cannot be applied; an image drag traces only after
// the hand stops; after Replace gives up (the image kept moving) the preview comes back
// where the image is and the reason stays on screen.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest-setup.js loads the whole app before this file, so a hoisted vi.mock would come too
// late for modules the app already imported. Mock, then load a fresh module graph.
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

let session;
let setCurrentProjectEditor;
let importGlyphrProjectFromText;
let ProjectEditor;
let setTrace;
let getTrace;
let AUTOTRACE_DEFAULTS;
let simpleExampleProject;

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
	({ importGlyphrProjectFromText } = await import('../../../project_editor/import_project.js'));
	({ ProjectEditor } = await import('../../../project_editor/project_editor.js'));
	({ setTrace, getTrace } = await import('../../trace/trace_model.js'));
	({ AUTOTRACE_DEFAULTS } = await import('../params.js'));
	simpleExampleProject = (await import('../../../samples/simpleExampleProject.json')).default;
	session = await import('../autotrace_session.js');
});

let editor;
let seen;
let unlisten;

function glyph(id = 'glyph-0x41') {
	return editor.project.getItem(id);
}

function addTrace(id = 'glyph-0x41', overrides = {}) {
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
		...overrides,
	});
	return asset;
}

function result(shapes = 3, points = 412, extra = {}) {
	return {
		shapes: Array.from({ length: shapes }, () => ({ objType: 'Path', pathPoints: [] })),
		points,
		ms: 180,
		threshold: 120,
		autoThreshold: 120,
		...extra,
	};
}

function stale() {
	return Object.assign(new Error('A newer auto-trace request replaced this one.'), { stale: true });
}

const settle = () => vi.advanceTimersByTimeAsync(0);

function start() {
	return session.startSession({ editor, item: glyph() });
}

/** Starts a session and lands its first trace. */
async function startReady(r = result()) {
	start();
	calls.at(-1).resolve(r);
	await settle();
	return session.getSession();
}

function historyLength() {
	return editor.history.queue.length;
}

beforeEach(() => {
	vi.useFakeTimers();
	calls.length = 0;
	autoTraceTrace.mockClear();
	applyAutoTrace.mockClear();
	session.resetAutoTraceSessionForTests();
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
	addTrace();
	seen = [];
	unlisten = session.onSessionChange((s) => seen.push(s ? s.status : null));
});

afterEach(() => {
	unlisten();
	session.resetAutoTraceSessionForTests();
	vi.useRealTimers();
});

describe('starting', () => {
	it('goes tracing -> ready and publishes autoTrace each time', async () => {
		const published = [];
		editor.subscribe({
			topic: 'autoTrace',
			subscriberID: 'anyink.autotrace.testPublished',
			callback: (s) => published.push(s ? s.status : null),
		});

		const first = start();
		expect(first.status).toBe('tracing');
		expect(first.result).toBeNull();
		expect(first.item).toBe(glyph());
		expect(first.itemId).toBe('glyph-0x41');
		expect(first.options).toEqual(AUTOTRACE_DEFAULTS);
		expect(Object.isFrozen(first)).toBe(true);
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);
		expect(calls[0].preview).toBe(true);
		expect(calls[0].args.editor).toBe(editor);
		expect(calls[0].args.item).toBe(glyph());

		const r = result();
		calls[0].resolve(r);
		await settle();
		const ready = session.getSession();
		expect(ready.status).toBe('ready');
		expect(ready.result).toBe(r);
		expect(ready.error).toBeNull();
		expect(seen).toEqual(['tracing', 'ready']);
		expect(published).toEqual(['tracing', 'ready']);
	});

	it('does not start without a trace, off the Trace panel, or for another item', () => {
		setTrace(glyph(), null);
		expect(start()).toBeNull();
		addTrace();
		editor.nav.panel = 'Attributes';
		expect(start()).toBeNull();
		editor.nav.panel = 'Trace';
		addTrace('glyph-0x42');
		expect(session.startSession({ editor, item: glyph('glyph-0x42') })).toBeNull();
		expect(session.startSession({ editor: null, item: glyph() })).toBeNull();
		expect(autoTraceTrace).not.toHaveBeenCalled();
		expect(session.getSession()).toBeNull();
	});

	it('starting again for the same item keeps the running session', async () => {
		await startReady();
		const again = start();
		expect(again.status).toBe('ready');
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);
	});
});

describe('options', () => {
	it('a slider drag (many updates) makes one trace, after the debounce', async () => {
		const ready = await startReady();
		session.updateOptions({ smoothing: 0.1 });
		session.updateOptions({ smoothing: 0.2 });
		session.updateOptions({ smoothing: 0.3 });

		const waiting = session.getSession();
		expect(waiting.status).toBe('tracing');
		expect(waiting.result).toBe(ready.result); // the preview stays up meanwhile
		expect(waiting.options.smoothing).toBe(0.3);

		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS - 1);
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
		expect(calls[1].options.smoothing).toBe(0.3);
		expect(calls[1].preview).toBe(true);

		const r = result(2, 100);
		calls[1].resolve(r);
		await settle();
		expect(session.getSession().status).toBe('ready');
		expect(session.getSession().result).toBe(r);
	});

	it('an update that changes nothing does not re-trace', async () => {
		await startReady();
		session.updateOptions({ smoothing: AUTOTRACE_DEFAULTS.smoothing, threshold: 'auto' });
		await vi.advanceTimersByTimeAsync(500);
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);
		expect(session.getSession().status).toBe('ready');
	});

	it('options go through normalizeOptions (clamped, unknown keys dropped)', async () => {
		await startReady();
		session.updateOptions({ detail: 7, threshold: 300, color: 'red' });
		const { options } = session.getSession();
		expect(options.detail).toBe(1);
		expect(options.threshold).toBe(255);
		expect(options).not.toHaveProperty('color');
	});

	it('remembers the last options for the next session in this app session', async () => {
		await startReady();
		session.updateOptions({ smoothing: 0.2, mode: 'photo' });
		session.cancelSession();
		start();
		expect(session.getSession().options).toMatchObject({ smoothing: 0.2, mode: 'photo' });
		expect(calls.at(-1).options).toMatchObject({ smoothing: 0.2, mode: 'photo' });
	});
});

describe('latest wins', () => {
	it('ignores a stale rejection and a superseded result', async () => {
		start();
		session.updateOptions({ detail: 0.9 });
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);

		// The client rejects the older request as stale once the newer one is sent
		calls[0].reject(stale());
		await settle();
		expect(session.getSession().status).toBe('tracing');
		expect(session.getSession().error).toBeNull();

		const newer = result(1, 20);
		calls[1].resolve(newer);
		await settle();
		expect(session.getSession().result).toBe(newer);
		expect(session.getSession().status).toBe('ready');
	});

	it('an older trace landing after a newer one started is not shown', async () => {
		await startReady();
		session.updateOptions({ detail: 0.1 });
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		session.updateOptions({ detail: 0.2 });
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(3);

		calls[1].resolve(result(9, 999));
		await settle();
		expect(session.getSession().result.points).toBe(412);
		expect(session.getSession().status).toBe('tracing');

		calls[2].resolve(result(2, 50));
		await settle();
		expect(session.getSession().result.points).toBe(50);
	});

	it('a trace that lands while a newer one waits shows, and status stays tracing', async () => {
		start();
		session.updateOptions({ detail: 0.3 });
		calls[0].resolve(result(4, 44));
		await settle();
		expect(session.getSession().result.points).toBe(44);
		expect(session.getSession().status).toBe('tracing');
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
	});

	it('asks again when another caller made its newest request stale', async () => {
		start();
		calls[0].reject(stale());
		await settle();
		expect(session.getSession().status).toBe('tracing');
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
		calls[1].resolve(result());
		await settle();
		expect(session.getSession().status).toBe('ready');
	});
});

describe('errors', () => {
	it('a failed trace gives status error with the plain message; the next change retries', async () => {
		start();
		calls[0].reject(new Error('The trace image is missing.'));
		await settle();
		expect(session.getSession()).toMatchObject({
			status: 'error',
			error: 'The trace image is missing.',
		});

		session.updateOptions({ invert: true });
		expect(session.getSession()).toMatchObject({ status: 'tracing', error: null });
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		calls[1].resolve(result());
		await settle();
		expect(session.getSession().status).toBe('ready');
	});

	it('a facade that throws instead of rejecting is an error too', async () => {
		autoTraceTrace.mockImplementationOnce(() => {
			throw new Error('boom');
		});
		start();
		await settle();
		expect(session.getSession()).toMatchObject({ status: 'error', error: 'boom' });
	});
});

describe('ending by itself', () => {
	it('a glyph switch ends it, even mid-trace, and the late result is dropped', async () => {
		start();
		editor.selectedGlyphID = 'glyph-0x42';
		editor.publish('whichGlyphIsSelected', 'glyph-0x42');
		expect(session.getSession()).toBeNull();
		expect(seen.at(-1)).toBeNull();

		const before = seen.length;
		calls[0].resolve(result());
		await settle();
		expect(session.getSession()).toBeNull();
		expect(seen.length).toBe(before);
	});

	it('a panel switch through navigate() ends it', async () => {
		await startReady();
		editor.nav.panel = 'History';
		window.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Characters', appLevel: false } })
		);
		expect(session.getSession()).toBeNull();
		expect(seen.at(-1)).toBeNull();
	});

	it('a panel switch without navigate() hides it at once and ends it right after', async () => {
		await startReady();
		editor.nav.panel = 'Attributes'; // path_add_point.js does this
		expect(session.getSession()).toBeNull();
		await settle();
		expect(seen.at(-1)).toBeNull();
		editor.nav.panel = 'Trace';
		expect(session.getSession()).toBeNull();
	});

	it('the app-level page (project closed) ends it', async () => {
		await startReady();
		window.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'app-level', appLevel: true } })
		);
		expect(session.getSession()).toBeNull();
	});

	it('switching to the other open project ends it (M8 integration)', async () => {
		await startReady();
		// The other project holds the same glyph id with its own trace
		const other = new ProjectEditor();
		other.project = importGlyphrProjectFromText(simpleExampleProject);
		other.nav.page = 'Characters';
		other.nav.panel = 'Trace';
		other.selectedGlyphID = 'glyph-0x41';
		setCurrentProjectEditor(other);
		expect(session.getSession()).toBeNull();
		window.dispatchEvent(
			new CustomEvent('anyink-page-change', { detail: { page: 'Characters', appLevel: false } })
		);
		await settle();
		expect(seen.at(-1)).toBeNull();
		setCurrentProjectEditor(editor);
		expect(session.getSession()).toBeNull();
	});

	it('a hidden, locked trace can still be auto-traced (the image is the input)', async () => {
		setTrace(glyph(), { ...getTrace(glyph()), visible: false, locked: true });
		const ready = await startReady();
		expect(ready.status).toBe('ready');
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);
	});

	it('removing the trace ends it', async () => {
		await startReady();
		setTrace(glyph(), null);
		editor.publish('traceLayer', glyph());
		expect(session.getSession()).toBeNull();
	});

	it('moving the image re-traces (debounced); opacity alone does not', async () => {
		await startReady();
		const trace = getTrace(glyph());
		setTrace(glyph(), { ...trace, opacity: 0.8 });
		editor.publish('traceLayer', glyph());
		await vi.advanceTimersByTimeAsync(500);
		expect(autoTraceTrace).toHaveBeenCalledTimes(1);

		for (let dx = 1; dx <= 5; dx++) {
			setTrace(glyph(), { ...trace, x: trace.x + dx * 10 });
			editor.publish('traceLayer', glyph());
		}
		expect(session.getSession().status).toBe('tracing');
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
	});

	it('follows the item object when undo swaps it for a copy', async () => {
		await startReady();
		const copy = importGlyphrProjectFromText(simpleExampleProject).getItem('glyph-0x41');
		copy.anyink = { trace: getTrace(glyph()) };
		editor.project.glyphs['glyph-0x41'] = copy;
		editor.publish('currentItem', copy);
		expect(session.getSession().item).toBe(copy);
	});
});

describe('applying', () => {
	for (const mode of ['replace', 'add']) {
		it(`${mode}: traces at full size, applies once, ends the session`, async () => {
			await startReady();
			const before = historyLength();
			const done = session.applySession(mode);
			expect(session.getSession()).toMatchObject({ status: 'tracing', applying: mode });
			expect(autoTraceTrace).toHaveBeenCalledTimes(2);
			expect(calls[1].preview).toBe(false);

			const full = result(5, 600);
			calls[1].resolve(full);
			await expect(done).resolves.toBe(true);
			expect(applyAutoTrace).toHaveBeenCalledTimes(1);
			expect(applyAutoTrace.mock.calls[0][0]).toMatchObject({
				editor,
				item: glyph(),
				shapes: full.shapes,
				mode,
			});
			expect(historyLength()).toBe(before + 1);
			expect(session.getSession()).toBeNull();
			expect(seen.at(-1)).toBeNull();
			expect(getTrace(glyph())).not.toBeNull();
		});
	}

	it('ignores option changes and drops a waiting preview while applying', async () => {
		await startReady();
		session.updateOptions({ smoothing: 0.1 });
		const done = session.applySession('replace');
		session.updateOptions({ smoothing: 0.9 });
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS * 3);
		expect(autoTraceTrace).toHaveBeenCalledTimes(2);
		expect(calls[1].options.smoothing).toBe(0.1);
		calls[1].resolve(result());
		await expect(done).resolves.toBe(true);
	});

	it('a second press while applying returns the same promise', async () => {
		await startReady();
		const first = session.applySession('replace');
		expect(session.applySession('add')).toBe(first);
		calls[1].resolve(result());
		await first;
		expect(applyAutoTrace).toHaveBeenCalledTimes(1);
		expect(applyAutoTrace.mock.calls[0][0].mode).toBe('replace');
	});

	it('no ink at full size: nothing applied, the session stays with the reason', async () => {
		await startReady();
		const before = historyLength();
		const done = session.applySession('replace');
		calls[1].resolve(result(0, 0));
		await expect(done).resolves.toBe(false);
		expect(applyAutoTrace).not.toHaveBeenCalled();
		expect(historyLength()).toBe(before);
		expect(session.getSession()).toMatchObject({
			status: 'error',
			error: session.NO_INK_REASON,
			applying: null,
		});
	});

	it('a failed full-size trace keeps the session open with the message', async () => {
		await startReady();
		const done = session.applySession('add');
		calls[1].reject(new Error('The image to trace is empty.'));
		await expect(done).resolves.toBe(false);
		expect(session.getSession()).toMatchObject({
			status: 'error',
			error: 'The image to trace is empty.',
		});
		expect(applyAutoTrace).not.toHaveBeenCalled();
	});

	it('a glyph switch during the full-size trace applies nothing', async () => {
		await startReady();
		const done = session.applySession('replace');
		editor.selectedGlyphID = 'glyph-0x42';
		editor.publish('whichGlyphIsSelected', 'glyph-0x42');
		calls[1].resolve(result());
		await expect(done).resolves.toBe(false);
		expect(applyAutoTrace).not.toHaveBeenCalled();
	});

	it('apply without a session resolves false', async () => {
		await expect(session.applySession('replace')).resolves.toBe(false);
	});
});

describe('applying while the image or the glyph box moves (fix)', () => {
	it('re-traces when the image moves during the full-size trace, then applies the new outlines', async () => {
		await startReady();
		const done = session.applySession('replace');
		expect(calls[1].preview).toBe(false);
		// An arrow nudge or an image drag lands while the worker runs
		setTrace(glyph(), { ...getTrace(glyph()), x: 200 });
		editor.publish('traceLayer', glyph());
		calls[1].resolve(result(3, 300));
		await settle();
		expect(applyAutoTrace).not.toHaveBeenCalled();
		expect(autoTraceTrace).toHaveBeenCalledTimes(3);
		expect(calls[2].preview).toBe(false);
		expect(session.getSession()).toMatchObject({ status: 'tracing', applying: 'replace' });

		const moved = result(3, 310);
		calls[2].resolve(moved);
		await expect(done).resolves.toBe(true);
		expect(applyAutoTrace).toHaveBeenCalledTimes(1);
		expect(applyAutoTrace.mock.calls[0][0].shapes).toBe(moved.shapes);
	});

	it('re-traces when the glyph box changes during the full-size trace (Only inside the glyph box)', async () => {
		await startReady();
		expect(session.getSession().options.insideBoxOnly).toBe(true);
		const done = session.applySession('add');
		// A metric-line drag: no topic the session watches has to fire for this to count
		glyph().advanceWidth = 900;
		calls[1].resolve(result(2, 200));
		await settle();
		expect(applyAutoTrace).not.toHaveBeenCalled();
		expect(autoTraceTrace).toHaveBeenCalledTimes(3);
		const wider = result(2, 220);
		calls[2].resolve(wider);
		await expect(done).resolves.toBe(true);
		expect(applyAutoTrace.mock.calls[0][0]).toMatchObject({ shapes: wider.shapes, mode: 'add' });
	});

	it('re-traces when undo swaps in a copy of the glyph with the image elsewhere', async () => {
		await startReady();
		const done = session.applySession('replace');
		const copy = importGlyphrProjectFromText(simpleExampleProject).getItem('glyph-0x41');
		copy.anyink = { trace: { ...getTrace(glyph()), y: 600 } };
		editor.project.glyphs['glyph-0x41'] = copy;
		editor.publish('currentItem', copy);
		calls[1].resolve(result());
		await settle();
		expect(applyAutoTrace).not.toHaveBeenCalled();
		expect(autoTraceTrace).toHaveBeenCalledTimes(3);
		expect(calls[2].args.item).toBe(copy);
		calls[2].resolve(result(1, 40));
		await expect(done).resolves.toBe(true);
		expect(applyAutoTrace.mock.calls[0][0].item).toBe(copy);
	});

	it('gives up with a plain reason when the image keeps moving, and applies nothing', async () => {
		await startReady();
		const before = historyLength();
		const done = session.applySession('replace');
		for (let i = 1; i <= 10 && calls.length > i; i++) {
			setTrace(glyph(), { ...getTrace(glyph()), x: i * 10 });
			calls[i].resolve(result());
			await settle();
		}
		await expect(done).resolves.toBe(false);
		expect(applyAutoTrace).not.toHaveBeenCalled();
		expect(historyLength()).toBe(before);
		// The reason stays on screen (notice) while the preview traces the image where it is
		expect(session.getSession()).toMatchObject({
			status: 'tracing',
			notice: session.movedReason('replace'),
			applying: null,
		});
		expect(session.movedReason('replace')).toBe(
			'the image moved while tracing. Press Replace outlines again.'
		);
		expect(session.movedReason('add')).toBe(
			'the image moved while tracing. Press Add to outlines again.'
		);
	});
});

describe('live preview during a long drag (fix)', () => {
	it('traces at least every SESSION_MAX_WAIT_MS while the hand moves, not only after it stops', async () => {
		await startReady(result(1, 41));
		const shown = new Set();
		// 30 input ticks, 16 ms apart (480 ms); the worker answers every trace at once
		for (let i = 1; i <= 30; i++) {
			session.updateOptions({ detail: 0.2 + i / 100 });
			await vi.advanceTimersByTimeAsync(16);
			calls.forEach((call, n) => call.resolve(result(1, 100 + n)));
			await settle();
			shown.add(session.getSession().result.points);
		}
		expect(autoTraceTrace.mock.calls.length - 1).toBeGreaterThanOrEqual(3);
		expect(shown.size).toBeGreaterThanOrEqual(3);
		expect(calls.every((call) => call.preview)).toBe(true);
		expect(session.SESSION_MAX_WAIT_MS).toBe(150);
		// The last value is traced too (by the max wait or the trailing debounce), then it rests
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS + session.SESSION_MAX_WAIT_MS);
		calls.forEach((call) => call.resolve(result(1, 7)));
		await settle();
		expect(calls.at(-1).options.detail).toBeCloseTo(0.5, 9);
		expect(session.getSession().status).toBe('ready');
		const traces = autoTraceTrace.mock.calls.length;
		await vi.advanceTimersByTimeAsync(1000);
		expect(autoTraceTrace).toHaveBeenCalledTimes(traces);
	});

	it('a mid-drag trace waits for the one still running instead of replacing it', async () => {
		await startReady();
		const tick = async (i) => {
			session.updateOptions({ detail: 0.2 + i / 100 });
			await vi.advanceTimersByTimeAsync(16);
		};
		for (let i = 1; i <= 12; i++) await tick(i); // 192 ms: one mid-drag trace started
		expect(calls.length).toBe(2);
		for (let i = 13; i <= 24; i++) await tick(i); // 384 ms: the wait ran out again
		expect(calls.length).toBe(2); // ...but that trace still runs, so nothing replaced it
		calls[1].resolve(result(2, 222));
		await settle();
		expect(session.getSession().result.points).toBe(222); // shown when it lands
		expect(calls.length).toBe(3); // and the next one starts right away
		expect(calls[2].options.detail).toBeCloseTo(0.44, 9);
		expect(session.getSession().status).toBe('tracing');
	});
});

describe('canceling', () => {
	it('ends the session with no history and no apply', async () => {
		await startReady();
		const before = historyLength();
		session.cancelSession();
		expect(session.getSession()).toBeNull();
		expect(seen.at(-1)).toBeNull();
		expect(historyLength()).toBe(before);
		expect(applyAutoTrace).not.toHaveBeenCalled();
	});

	it('a trace landing after Cancel is dropped', async () => {
		start();
		session.cancelSession();
		const before = seen.length;
		calls[0].resolve(result());
		await settle();
		expect(seen.length).toBe(before);
	});

	it('passes an abort signal that fires when the session ends', () => {
		start();
		const { signal } = calls[0].args;
		expect(signal?.aborted).toBe(false);
		session.cancelSession();
		expect(signal.aborted).toBe(true);
	});
});

describe('subscriber ids', () => {
	function autotraceIds() {
		const ids = new Set();
		for (const topic of Object.keys(editor.subscribers)) {
			for (const id of Object.keys(editor.subscribers[topic])) {
				if (id.includes('autotrace') && !id.includes('test')) ids.add(id);
			}
		}
		return [...ids];
	}

	it("the session's one id starts with anyink.autotrace.session and goes away with it", async () => {
		await startReady();
		expect(autotraceIds()).toEqual([session.SESSION_WATCH_ID]);
		expect(session.SESSION_WATCH_ID.startsWith('anyink.autotrace.session.')).toBe(true);
		expect(session.SESSION_WATCH_ID.includes('anyink.autotrace.panel')).toBe(false);
		// No other id in the app contains it, and it contains no other id
		const all = new Set(Object.values(editor.subscribers).flatMap((t) => Object.keys(t)));
		for (const id of all) {
			if (id === session.SESSION_WATCH_ID) continue;
			expect(id.includes(session.SESSION_WATCH_ID)).toBe(false);
			expect(session.SESSION_WATCH_ID.includes(id)).toBe(false);
		}
		session.cancelSession();
		expect(autotraceIds()).toEqual([]);
	});
});

// --------------------------------------------------------------
// Finalize, 09/24/2026
// --------------------------------------------------------------

describe('finalize: pixels, refused previews, image drags, giving up', () => {
	it('ending the session lets the kept preview pixels go at once (cancel, glyph switch)', async () => {
		await startReady();
		clearAutoTraceCache.mockClear();
		session.cancelSession();
		expect(clearAutoTraceCache).toHaveBeenCalledTimes(1);

		await startReady();
		clearAutoTraceCache.mockClear();
		editor.selectedGlyphID = 'glyph-0x42';
		editor.publish('whichGlyphIsSelected', 'glyph-0x42');
		expect(session.getSession()).toBeNull();
		expect(clearAutoTraceCache).toHaveBeenCalledTimes(1);
	});

	it('a preview refused as too many shapes, or outside the glyph box, cannot be applied', async () => {
		for (const code of ['too-many', 'shapes-outside-box']) {
			session.resetAutoTraceSessionForTests();
			calls.length = 0;
			start();
			calls[0].reject(Object.assign(new Error(`refused: ${code}`), { code }));
			await settle();
			expect(session.getSession()).toMatchObject({ status: 'error', errorCode: code });
			await expect(session.applySession('replace')).resolves.toBe(false);
			expect(calls).toHaveLength(1); // no full-size trace, nothing applied
			expect(applyAutoTrace).not.toHaveBeenCalled();
			// A control change clears it, and the next preview can be applied
			session.updateOptions({ detail: 0.3 });
			expect(session.getSession().errorCode).toBeNull();
			await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
			calls.at(-1).resolve(result());
			await settle();
			const done = session.applySession('replace');
			calls.at(-1).resolve(result());
			await expect(done).resolves.toBe(true);
			applyAutoTrace.mockClear();
		}
	});

	it('other preview failures keep Replace open (a later press may work)', async () => {
		start();
		calls[0].reject(
			Object.assign(new Error('The image could not be read.'), { code: 'read-failed' })
		);
		await settle();
		expect(session.getSession()).toMatchObject({ status: 'error', errorCode: 'read-failed' });
		const done = session.applySession('replace');
		expect(calls).toHaveLength(2);
		calls[1].resolve(result());
		await expect(done).resolves.toBe(true);
	});

	it('an image drag traces only after the hand stops: the max wait is for sliders', async () => {
		await startReady();
		// 60 drag ticks of 2 font units, 16 ms apart (960 ms)
		for (let i = 1; i <= 60; i++) {
			setTrace(glyph(), { ...getTrace(glyph()), x: i * 2 });
			editor.publish('traceLayer', glyph());
			await vi.advanceTimersByTimeAsync(16);
		}
		expect(calls).toHaveLength(1); // nothing traced mid-drag
		expect(session.getSession().status).toBe('tracing');
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(calls).toHaveLength(2);
		expect(calls[1].preview).toBe(true);
	});

	it('after Replace gives up, the preview traces where the image is and the reason stays', async () => {
		await startReady(result(2, 20));
		const done = session.applySession('add');
		for (let i = 1; i <= 10 && calls.length > i; i++) {
			setTrace(glyph(), { ...getTrace(glyph()), x: i * 10 });
			calls[i].resolve(result());
			await settle();
		}
		await expect(done).resolves.toBe(false);
		const fullSize = calls.length;
		expect(session.getSession()).toMatchObject({
			status: 'tracing',
			notice: session.movedReason('add'),
			error: null,
		});
		// The old outlines stay drawn until the new preview lands
		expect(session.getSession().result.points).toBe(20);
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(calls).toHaveLength(fullSize + 1);
		expect(calls.at(-1).preview).toBe(true);
		calls.at(-1).resolve(result(2, 31));
		await settle();
		expect(session.getSession()).toMatchObject({
			status: 'ready',
			notice: session.movedReason('add'),
		});
		expect(session.getSession().result.points).toBe(31);
		// The next change clears the notice; so does the next press
		session.updateOptions({ smoothing: 0.2 });
		expect(session.getSession().notice).toBeNull();
	});
});

// A canvas drag must also cancel the max-wait timer left by a preceding slider change.
describe('session scheduling and failure transitions', () => {
	it('moving the image cancels a pending slider max-wait deadline', async () => {
		await startReady();
		session.updateOptions({ detail: 0.3 });
		await vi.advanceTimersByTimeAsync(40);
		for (let i = 1; i <= 20; i++) {
			setTrace(glyph(), { ...getTrace(glyph()), x: i * 2 });
			editor.publish('traceLayer', glyph());
			await vi.advanceTimersByTimeAsync(16);
		}
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(session.SESSION_DEBOUNCE_MS);
		expect(calls).toHaveLength(2);
		expect(calls[1].options.detail).toBe(0.3);
		calls[1].resolve(result());
		await settle();
		expect(session.getSession().status).toBe('ready');
	});

	it('a refused full-size trace keeps its code and blocks another apply until a change', async () => {
		await startReady();
		const done = session.applySession('replace');
		calls[1].reject(Object.assign(new Error('Too many points.'), { code: 'too-many' }));
		await expect(done).resolves.toBe(false);
		expect(session.getSession()).toMatchObject({
			status: 'error',
			errorCode: 'too-many',
			applying: null,
		});
		await expect(session.applySession('add')).resolves.toBe(false);
		expect(calls).toHaveLength(2);
		expect(applyAutoTrace).not.toHaveBeenCalled();
		session.updateOptions({ detail: 0.1 });
		expect(session.getSession()).toMatchObject({ status: 'tracing', errorCode: null });
	});
});
