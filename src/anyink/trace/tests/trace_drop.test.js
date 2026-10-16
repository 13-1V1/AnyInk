// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 fix (panel track): a photo dropped anywhere but the canvas no longer gets
// Chrome's own file drop (the image opening in the tab behind a "Leave site?" prompt).
// src/anyink/trace/trace_drop.js against a real ProjectEditor; the decoder goes through
// bitmap_cache's setDecoderForTests (jsdom has no createImageBitmap). Toasts are read from
// the #toast element.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Navigator } from '../../../project_editor/navigator.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { setDecoderForTests } from '../bitmap_cache.js';
import { DROP_HINT, NOT_TRACEABLE_HINT } from '../paste_drop.js';
import {
	TRACE_PAGES,
	hasFiles,
	installPageDropGuard,
	makeFileDropTarget,
	routeStrayDrop,
} from '../trace_drop.js';
import { HISTORY_ADDED } from '../trace_import.js';
import { getTrace } from '../trace_model.js';
import { setModeForTests } from '../../mode/mode.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { word } from '../../words/words.js';

function dragEvent(type, files = [], { types } = {}) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', {
		value: {
			types: types || (files.length ? ['Files'] : ['text/plain']),
			files,
			dropEffect: 'none',
		},
	});
	return event;
}

const photo = () => new File([new Uint8Array(16)], 'lettering.jpg', { type: 'image/jpeg' });
const svg = () => new File(['<svg/>'], 'shapes.svg', { type: 'image/svg+xml' });
const project = () => new File(['{}'], 'my font.gs2', { type: '' });
const toastText = () => document.querySelector('#toast')?.textContent || '';

let editor;
let uninstall = () => {};

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '<div id="spot"></div>';
	editor = new ProjectEditor({
		project: new GlyphrStudioProject(structuredClone(simpleExampleProject)),
	});
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = 'glyph-0x41';
	setDecoderForTests({
		decode: vi.fn(async () => ({ width: 300, height: 600, close: vi.fn() })),
		encode: vi.fn(async (_b, o) => new Blob([`${o.width}x${o.height}`], { type: 'image/webp' })),
	});
});

afterEach(() => {
	uninstall();
	uninstall = () => {};
	setDecoderForTests(null);
	vi.restoreAllMocks();
});

describe('hasFiles', () => {
	it('is true only for drags that carry files', () => {
		expect(hasFiles({ types: ['Files', 'text/uri-list'] })).toBe(true);
		expect(hasFiles({ types: { contains: (t) => t === 'Files' } })).toBe(true);
		expect(hasFiles({ types: ['text/plain'] })).toBe(false);
		expect(hasFiles({})).toBe(false);
		expect(hasFiles(null)).toBe(false);
	});
});

describe('page drop guard', () => {
	it('navigating to a page installs it: a photo dropped off the canvas never leaves the app', () => {
		new Navigator().navigate(true);
		uninstall = installPageDropGuard(); // the one navigate installed (idempotent)
		const over = dragEvent('dragover', [photo()]);
		const drop = dragEvent('drop', [photo()]);
		document.querySelector('#spot').dispatchEvent(over);
		document.querySelector('#spot').dispatchEvent(drop);
		expect(over.defaultPrevented).toBe(true);
		expect(drop.defaultPrevented).toBe(true);
	});

	it('leaves drags without files alone (text dragged into a field still works)', () => {
		uninstall = installPageDropGuard({ route: vi.fn() });
		const over = dragEvent('dragover');
		const drop = dragEvent('drop');
		document.body.dispatchEvent(over);
		document.body.dispatchEvent(drop);
		expect(over.defaultPrevented).toBe(false);
		expect(drop.defaultPrevented).toBe(false);
	});

	it('routes each stray drop once, however often it is installed', () => {
		const route = vi.fn();
		uninstall = installPageDropGuard({ route });
		expect(installPageDropGuard({ route })).toBe(uninstall);
		document.body.dispatchEvent(dragEvent('drop', [photo()]));
		expect(route).toHaveBeenCalledTimes(1);
	});

	it('does not touch a drop something else already handled', () => {
		const route = vi.fn();
		uninstall = installPageDropGuard({ route });
		const spot = document.querySelector('#spot');
		spot.addEventListener('drop', (event) => event.preventDefault());
		spot.dispatchEvent(dragEvent('drop', [photo()]));
		expect(route).not.toHaveBeenCalled();
	});

	it('on a Characters page, a photo dropped beside the canvas becomes the trace', async () => {
		uninstall = installPageDropGuard();
		document.querySelector('#spot').dispatchEvent(dragEvent('drop', [photo()]));
		await vi.waitFor(() => expect(getTrace(editor.project.getItem('glyph-0x41'))).not.toBeNull());
		expect(editor.history.queue[0].title).toBe(HISTORY_ADDED);
	});
});

describe('routeStrayDrop', () => {
	it('sends drops on the Characters, Ligatures, and Components pages to the canvas handler', () => {
		for (const page of TRACE_PAGES) {
			editor.nav.page = page;
			const dropOnCanvas = vi.fn();
			const event = dragEvent('drop', [photo()]);
			routeStrayDrop(event, { editor, dropOnCanvas });
			expect(dropOnCanvas, page).toHaveBeenCalledWith(event);
		}
	});

	it('on other pages says where an image or SVG can go, and what can be dropped otherwise', () => {
		const dropOnCanvas = vi.fn();
		editor.nav.page = 'Kerning';
		routeStrayDrop(dragEvent('drop', [photo()]), { editor, dropOnCanvas });
		expect(toastText()).toBe(NOT_TRACEABLE_HINT);
		editor.nav.page = 'Overview';
		routeStrayDrop(dragEvent('drop', [svg()]), { editor, dropOnCanvas });
		expect(toastText()).toBe(NOT_TRACEABLE_HINT);
		routeStrayDrop(dragEvent('drop', [project()]), { editor, dropOnCanvas });
		expect(toastText()).toBe(DROP_HINT);
		expect(dropOnCanvas).not.toHaveBeenCalled();
	});

	it('stays quiet on the open-project page, which has its own drop area', () => {
		document.body.innerHTML = '<div id="open-project__page"><p id="inside"></p></div>';
		const dropOnCanvas = vi.fn();
		const event = dragEvent('drop', [photo()]);
		document.querySelector('#inside').dispatchEvent(event); // sets event.target
		routeStrayDrop(event, { editor, dropOnCanvas });
		expect(dropOnCanvas).not.toHaveBeenCalled();
		expect(toastText()).toBe('');
	});
});

describe('makeFileDropTarget', () => {
	it('lights up across child elements and clears on leave and on drop', () => {
		const host = document.createElement('div');
		host.innerHTML = '<p><span id="child"></span></p>';
		document.body.appendChild(host);
		const onDrop = vi.fn();
		makeFileDropTarget(host, { onDrop, hoverClass: 'lit' });
		const child = host.querySelector('#child');
		host.firstChild.dispatchEvent(dragEvent('dragenter', [photo()]));
		child.dispatchEvent(dragEvent('dragenter', [photo()]));
		host.firstChild.dispatchEvent(dragEvent('dragleave', [photo()]));
		expect(host.classList.contains('lit')).toBe(true);
		child.dispatchEvent(dragEvent('dragleave', [photo()]));
		expect(host.classList.contains('lit')).toBe(false);

		host.firstChild.dispatchEvent(dragEvent('dragenter', [photo()]));
		const drop = dragEvent('drop', [photo()]);
		child.dispatchEvent(drop);
		expect(drop.defaultPrevented).toBe(true);
		expect(onDrop).toHaveBeenCalledWith(drop);
		expect(host.classList.contains('lit')).toBe(false);
	});
});

// B4 + B5 finalize (verdict "Some drops give no message or the wrong one": a work file dropped on
// the Overview in Simple got the drawing hint): his own work file dropped anywhere but a letter
// says how to open it (Ctrl+O, 7.6), like a drop on a letter does. All tools keeps its drop hint.
describe('routeStrayDrop: a work file', () => {
	afterEach(() => setModeForTests('all'));

	it('Simple: off a letter page, says to press Ctrl+O', () => {
		setModeForTests('simple');
		// B10 + B11 integration: B5's Overview; on the letter board a work file opens
		// (board/tests/board_drop.test.js, files/tests/open_dropped_font.test.js)
		setFeaturesForTests({ board: false });
		editor.nav.page = 'Overview';
		routeStrayDrop(dragEvent('drop', [project()]), { editor, dropOnCanvas: vi.fn() });
		expect(document.querySelector('#toast[data-anyink-toast]')?.textContent).toBe(
			word('toast.dropWorkFile')
		);
	});

	it('All tools: the drop hint, as before', () => {
		editor.nav.page = 'Overview';
		routeStrayDrop(dragEvent('drop', [project()]), { editor, dropOnCanvas: vi.fn() });
		expect(toastText()).toBe(DROP_HINT);
	});
});
