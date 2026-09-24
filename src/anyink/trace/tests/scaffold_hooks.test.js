// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 scaffold: the trace contract's exports exist with the right kinds, and the
// shared hooks in upstream files are wired (pub/sub topic, panel dispatch and cleanup).
// These tests hold whatever the tracks put inside the functions.
import { describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makePanel } from '../../../panels/panels.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import * as bitmapCache from '../bitmap_cache.js';
import * as traceDraw from '../trace_draw.js';
import * as traceImport from '../trace_import.js';
import * as traceLayer from '../trace_layer.js';
import * as traceModel from '../trace_model.js';
import * as tracePanel from '../trace_panel.js';

const fn = 'function';

describe('trace contract exports', () => {
	it('trace_model.js', () => {
		expect(typeof traceModel.TRACE_DEFAULTS).toBe('object');
		expect(traceModel.OPACITY_MIN).toBe(0.05);
		expect(traceModel.MIN_SIZE_FU).toBe(20);
		expect(typeof traceModel.ASSET_PRUNING_READY).toBe('boolean');
		for (const name of [
			'getTrace',
			'setTrace',
			'makeTrace',
			'normalizeTrace',
			'traceBounds',
			'hitTestTrace',
			'moveTrace',
			'scaleTraceFromCorner',
			'collectReferencedAssetIds',
		]) {
			expect(typeof traceModel[name], name).toBe(fn);
		}
		expect(traceModel.collectReferencedAssetIds({})).toBeInstanceOf(Set);
	});

	it('bitmap_cache.js', () => {
		for (const name of ['decodeImageFile', 'getBitmap', 'onBitmapReady', 'setDecoderForTests']) {
			expect(typeof bitmapCache[name], name).toBe(fn);
		}
		const unsubscribe = bitmapCache.onBitmapReady(() => {});
		expect(typeof unsubscribe).toBe(fn);
		unsubscribe();
	});

	it('trace_draw.js', () => {
		expect(typeof traceDraw.drawTraceImage).toBe(fn);
		expect(typeof traceDraw.drawTraceAffordances).toBe(fn);
	});

	it('trace_layer.js', () => {
		expect(typeof traceLayer.handleTraceLayerEvent).toBe(fn);
		for (const key of ['hover', 'dragging', 'start', 'original', 'changed']) {
			expect(key in traceLayer.traceLayerState, key).toBe(true);
		}
	});

	it('trace_import.js', () => {
		for (const name of ['isTraceImageFile', 'importTraceImage', 'pickTraceImage', 'removeTrace']) {
			expect(typeof traceImport[name], name).toBe(fn);
		}
	});

	it('trace_panel.js', () => {
		expect(typeof tracePanel.makePanel_Trace).toBe(fn);
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
	it("'*' subscribers (the edit canvas redraw) hear the 'traceLayer' topic", () => {
		const editor = makeEditor();
		let heard = 0;
		editor.subscribe({
			topic: '*',
			subscriberID: 'anyink.trace.testAllTopics',
			callback: () => heard++,
		});
		editor.publish('traceLayer', editor.selectedItem);
		expect(heard).toBe(1);
		editor.unsubscribe({ idToRemove: 'anyink.trace.testAllTopics' });
	});

	it("the 'Trace' panel is built by makePanel_Trace", () => {
		const editor = makeEditor();
		editor.nav.panel = 'Trace';
		const content = makePanel();
		expect(content.children.length).toBeGreaterThan(0);
	});

	it('opening another panel removes Trace panel subscribers; reopening Trace keeps them', () => {
		const editor = makeEditor();
		const probe = 'anyink.trace.panel.testProbe';
		const has = () => !!editor.subscribers.traceLayer?.[probe];
		const subscribeProbe = () =>
			editor.subscribe({ topic: 'traceLayer', subscriberID: probe, callback: () => {} });

		editor.nav.panel = 'Trace';
		makePanel();
		subscribeProbe();
		editor.nav.panel = 'Trace';
		makePanel();
		expect(has()).toBe(true);

		editor.nav.panel = 'History';
		makePanel();
		expect(has()).toBe(false);
	});
});
