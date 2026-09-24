// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8 scaffold: the auto-trace contract's exports exist with the right kinds, the
// shared hooks in upstream and M7 files are wired (pub/sub topic, edit canvas preview call,
// panel subscriber cleanup, About credits), esm-potrace-wasm is pinned and reachable only
// from the worker, and the potrace fixtures for track B are well formed.
// These tests hold whatever the tracks put inside the functions.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makePanel } from '../../../panels/panels.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import * as apply from '../apply.js';
import * as facade from '../autotrace.js';
import * as panel from '../autotrace_panel.js';
import * as session from '../autotrace_session.js';
import * as binarize from '../binarize.js';
import * as params from '../params.js';
import * as client from '../potrace_client.js';
import * as previewDraw from '../preview_draw.js';
import * as svgToShapes from '../svg_to_shapes.js';
import * as traceRegion from '../trace_region.js';

const fn = 'function';
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..', '..', '..');
const repoRoot = join(srcRoot, '..');
const readSrc = (path) => readFileSync(join(srcRoot, path), 'utf8');

function expectFunctions(module, names) {
	for (const name of names) expect(typeof module[name], name).toBe(fn);
}

describe('auto-trace contract exports', () => {
	it('params.js', () => {
		expect(params.AUTOTRACE_DEFAULTS).toEqual({
			mode: 'scan',
			threshold: 'auto',
			smoothing: 0.75,
			detail: 0.6,
			despeckle: true,
			invert: false,
			insideBoxOnly: true,
		});
		expect(Object.isFrozen(params.AUTOTRACE_DEFAULTS)).toBe(true);
		expectFunctions(params, ['normalizeOptions', 'toPotraceOptions']);
		const potrace = params.toPotraceOptions(params.normalizeOptions({}), { scale: 1 });
		expect(potrace).toMatchObject({ turnpolicy: 'minority', pathonly: false, extractcolors: false });
		for (const key of ['turdsize', 'alphamax', 'opttolerance']) {
			expect(Number.isFinite(potrace[key]), key).toBe(true);
		}
	});

	it('binarize.js', () => {
		expectFunctions(binarize, [
			'toGray',
			'otsuThreshold',
			'thresholdGlobal',
			'thresholdAdaptive',
			'despeckle',
			'invertMask',
			'cropImageData',
			'downscaleImageData',
			'maskToImageData',
			'binarize',
		]);
	});

	it('potrace_client.js', () => {
		expectFunctions(client, [
			'isAutoTraceAvailable',
			'traceImageData',
			'terminateAutoTraceWorker',
			'setWorkerFactoryForTests',
		]);
		expect(typeof client.isAutoTraceAvailable()).toBe('boolean');
	});

	it('autotrace.js (the facade milestone 9 calls)', () => {
		expectFunctions(facade, ['autoTraceImageData', 'autoTraceTrace']);
	});

	it('svg_to_shapes.js, trace_region.js, apply.js, preview_draw.js', () => {
		expectFunctions(svgToShapes, ['potraceSvgToShapes', 'countPoints']);
		expectFunctions(traceRegion, ['regionForGlyph']);
		expectFunctions(apply, ['applyAutoTrace']);
		expectFunctions(previewDraw, ['drawAutoTracePreview']);
	});

	it('autotrace_session.js', () => {
		expectFunctions(session, [
			'startSession',
			'updateOptions',
			'getSession',
			'onSessionChange',
			'applySession',
			'cancelSession',
		]);
		const unsubscribe = session.onSessionChange(() => {});
		expect(typeof unsubscribe).toBe(fn);
		unsubscribe();
	});

	it('autotrace_panel.js', () => {
		expectFunctions(panel, ['makeAutoTraceCard']);
	});
});

function makeEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	return editor;
}

describe('shared hooks', () => {
	it("'*' subscribers (the edit canvas redraw) hear the 'autoTrace' topic", () => {
		const editor = makeEditor();
		let heard = 0;
		editor.subscribe({
			topic: '*',
			subscriberID: 'anyink.autotrace.testAllTopics',
			callback: () => heard++,
		});
		editor.publish('autoTrace', null);
		expect(heard).toBe(1);
		editor.unsubscribe({ idToRemove: 'anyink.autotrace.testAllTopics' });
	});

	it('the edit canvas draws the preview right after the trace affordances', () => {
		const source = readSrc('edit_canvas/edit_canvas.js');
		expect(source).toMatch(
			/import \{ drawAutoTracePreview \} from '\.\.\/anyink\/autotrace\/preview_draw\.js';/
		);
		const affordances = source.indexOf('drawTraceAffordances(ctx, view, currentItem, editor);');
		const preview = source.indexOf('drawAutoTracePreview(ctx, view, currentItem, editor);');
		const highlighted = source.indexOf('drawAllHighlightedPoints(ctx);');
		expect(affordances).toBeGreaterThan(-1);
		expect(preview).toBeGreaterThan(affordances);
		expect(preview).toBeLessThan(highlighted);
	});

	it('opening another panel removes Auto-trace card subscribers, not session ones', () => {
		const editor = makeEditor();
		const cardProbe = 'anyink.autotrace.panel.testProbe';
		const sessionProbe = 'anyink.autotrace.session.testProbe';
		const has = (id) => !!editor.subscribers.autoTrace?.[id];
		for (const id of [cardProbe, sessionProbe]) {
			editor.subscribe({ topic: 'autoTrace', subscriberID: id, callback: () => {} });
		}

		editor.nav.panel = 'Trace';
		makePanel();
		expect(has(cardProbe)).toBe(true);
		expect(has(sessionProbe)).toBe(true);

		editor.nav.panel = 'History';
		makePanel();
		expect(has(cardProbe)).toBe(false);
		expect(has(sessionProbe)).toBe(true);
		editor.unsubscribe({ idToRemove: sessionProbe });
	});

	it('the About page credits Potrace and esm-potrace-wasm', () => {
		const source = readSrc('pages/about.js');
		expect(source).toContain('<h3>Potrace</h3>');
		expect(source).toContain('Peter Selinger');
		expect(source).toContain('<h3>esm-potrace-wasm</h3>');
		expect(source).toContain('Thomas Steiner');
		expect(source).toContain('version 2 or (at your option) any later version');
	});
});

describe('esm-potrace-wasm stays inside the worker', () => {
	function jsFiles(dir) {
		const out = [];
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) out.push(...jsFiles(path));
			else if (/\.(js|mjs)$/.test(name)) out.push(path);
		}
		return out;
	}
	// Built from pieces so this file never matches its own patterns
	const pkg = 'esm-' + 'potrace-wasm';
	const importsPackage = new RegExp(`(from\\s*|import\\s*\\(\\s*|import\\s+)['"]${pkg}['"]`);
	const importsWorker = new RegExp(
		`(from\\s*|import\\s*\\(\\s*|import\\s+)['"][^'"]*potrace\\.` + 'worker'
	);

	it('only potrace.worker.js imports the package, and nothing imports the worker', () => {
		const importers = [];
		const workerImporters = [];
		for (const path of jsFiles(srcRoot)) {
			const text = readFileSync(path, 'utf8');
			const name = relative(srcRoot, path).replace(/\\/g, '/');
			if (importsPackage.test(text)) importers.push(name);
			if (importsWorker.test(text)) workerImporters.push(name);
		}
		expect(importers).toEqual(['anyink/autotrace/potrace.worker.js']);
		expect(workerImporters).toEqual([]);
	});

	it('the client creates the worker with the pattern Vite bundles', () => {
		expect(readSrc('anyink/autotrace/potrace_client.js')).toContain(
			"new Worker(new URL('./potrace.worker.js', import.meta.url), { type: 'module' })"
		);
	});

	it('package.json pins esm-potrace-wasm 0.5.1 as a dependency', () => {
		const json = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
		expect(json.dependencies[pkg]).toBe('0.5.1');
	});
});

describe('potrace fixtures for track B', () => {
	const fixtures = join(here, 'fixtures');
	for (const name of ['square_hole', 'letter_o', 'letter_a']) {
		it(`${name}.svg matches its sidecar`, () => {
			const svg = readFileSync(join(fixtures, `${name}.svg`), 'utf8');
			const meta = JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8'));
			expect(meta.svg).toBe(`${name}.svg`);
			expect(svg).toContain(`width="${meta.width}.000000" height="${meta.height}.000000"`);
			expect(svg).toContain(
				`<g transform="translate(0.000000,${meta.height}.000000) scale(0.100000,-0.100000)"`
			);
			const paths = svg.match(/<path d="[^"]*"/g) || [];
			expect(paths.length).toBe(meta.expect.pathElements);
			const subpaths = paths.join(' ').match(/[Mm]/g).length;
			expect(subpaths).toBe(meta.expect.subpaths);
			expect(meta.potraceOptions).toMatchObject({ pathonly: false, extractcolors: false });
		});
	}
});
