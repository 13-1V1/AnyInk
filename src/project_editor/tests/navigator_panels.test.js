// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 panel ids: the panel chooser stores each panel's id (the listOfPanels() key) in
// editor.nav.panel and shows its label. The probe renders the real page into #app__wrapper,
// opens the real PANEL chooser, clicks every row it offers, and checks the panel area fills
// with that panel's own content. Old saved display names ('Context characters') still open
// the right panel.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../app/main.js';
import { createComponent } from '../../pages/components.js';
import simpleExampleProject from '../../samples/simpleExampleProject.json';
import { importGlyphrProjectFromText } from '../import_project.js';
import { Navigator, panelForPage, panelIdFor, panelLabel } from '../navigator.js';
import { ProjectEditor } from '../project_editor.js';

describe('Navigator: panel falls back when the page does not offer it', () => {
	it('panelForPage keeps an offered panel and falls back to Attributes otherwise', () => {
		expect(panelForPage('Characters', 'Trace')).toBe('Trace');
		expect(panelForPage('Ligatures', 'Trace')).toBe('Trace');
		expect(panelForPage('Components', 'Trace')).toBe('Trace');
		expect(panelForPage('Kerning', 'Trace')).toBe('Attributes');
		expect(panelForPage('Kerning', 'Layers')).toBe('Attributes');
		expect(panelForPage('Kerning', 'History')).toBe('History');
		// Pages without a panel list keep the request
		expect(panelForPage('Overview', 'Trace')).toBe('Trace');
	});

	it('navigate() applies the fallback, as undo does when it changes the page in code', () => {
		const navigator = new Navigator();
		navigator.page = 'Kerning';
		navigator.panel = 'Trace';
		navigator.navigate(true);
		expect(navigator.panel).toBe('Attributes');
	});

	it('panelForPage keeps the panels whose label differs from their id', () => {
		expect(panelForPage('Characters', 'ContextCharacters')).toBe('ContextCharacters');
		expect(panelForPage('Characters', 'CharacterInfo')).toBe('CharacterInfo');
		expect(panelForPage('Characters', 'QualityChecks')).toBe('QualityChecks');
		expect(panelForPage('Ligatures', 'QualityChecks')).toBe('QualityChecks');
		expect(panelForPage('Components', 'QualityChecks')).toBe('QualityChecks');
	});
});

// --------------------------------------------------------------
// Ids and labels
// --------------------------------------------------------------

const LABELS = {
	Attributes: 'Attributes',
	Layers: 'Layers',
	Trace: 'Trace',
	ContextCharacters: 'Context characters',
	Transforms: 'Transforms',
	History: 'History',
	Guides: 'Guides',
	CharacterInfo: 'Character info',
	QualityChecks: 'Quality checks',
};

describe('Navigator: panel ids and labels', () => {
	it('panelLabel shows each id as its label', () => {
		Object.entries(LABELS).forEach(([id, label]) => expect(panelLabel(id)).toBe(label));
	});

	it('panelIdFor maps an old saved display name to its id, once, and keeps ids as they are', () => {
		Object.entries(LABELS).forEach(([id, label]) => {
			expect(panelIdFor(label)).toBe(id);
			expect(panelIdFor(id)).toBe(id);
		});
		expect(panelIdFor(panelIdFor('Quality checks'))).toBe('QualityChecks');
	});

	it('a Navigator given an old display name holds the id', () => {
		const navigator = new Navigator();
		navigator.panel = 'Context characters';
		expect(navigator.panel).toBe('ContextCharacters');
		navigator.panel = 'Character info';
		expect(navigator.panel).toBe('CharacterInfo');
		navigator.panel = 'Quality checks';
		expect(navigator.panel).toBe('QualityChecks');
		navigator.panel = 'Trace';
		expect(navigator.panel).toBe('Trace');
	});

	it('an old display name survives navigate() on its page instead of falling back', () => {
		const navigator = new Navigator();
		navigator.page = 'Characters';
		navigator.panel = 'Quality checks';
		navigator.navigate(true);
		expect(navigator.panel).toBe('QualityChecks');
	});
});

// --------------------------------------------------------------
// The probe: every panel on every page, through the real chooser
// --------------------------------------------------------------

const OFFERED = {
	Characters: [
		'Attributes',
		'Layers',
		'Trace',
		'ContextCharacters',
		'Transforms',
		'History',
		'Guides',
		'CharacterInfo',
		'QualityChecks',
	],
	Ligatures: ['Attributes', 'Layers', 'Trace', 'Transforms', 'History', 'Guides', 'QualityChecks'],
	Components: ['Attributes', 'Layers', 'Trace', 'Transforms', 'History', 'Guides', 'QualityChecks'],
	Kerning: ['Attributes', 'History'],
};

let editor;
let warn;

function openPage(page) {
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	if (page === 'Components') createComponent('Probe');
	editor.nav.page = page;
	editor.nav.panel = 'Attributes';
	editor.navigate();
}

function l3Button() {
	return document.querySelector('#nav-button-l3');
}

function chooserRows() {
	l3Button().click();
	const dropdown = document.querySelector('#nav-dropdown-panel');
	expect(dropdown).toBeTruthy();
	return [...dropdown.querySelectorAll('.nav-dropdown__button')];
}

function panelArea() {
	return document.querySelector('#editor-page__panel');
}

beforeEach(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve() });
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	warn.mockRestore();
	document.body.innerHTML = '';
});

describe('Panel chooser probe: every panel offered on every page opens with real content', () => {
	Object.entries(OFFERED).forEach(([page, ids]) => {
		it(`${page}: the chooser offers ${ids.length} panels, each opens itself`, () => {
			openPage(page);
			expect(chooserRows().map((row) => row.textContent.trim())).toEqual(
				ids.map((id) => LABELS[id])
			);

			ids.forEach((id, index) => {
				const row = chooserRows()[index];
				row.click();
				// The id, not the label, is stored, and the page did not fall back to Attributes
				expect(editor.nav.panel, `${page} > ${LABELS[id]}`).toBe(id);
				// The PANEL button shows the label
				expect(l3Button().querySelector('.nav-button__title').textContent).toBe(LABELS[id]);
				// The panel area holds real content
				const area = panelArea();
				expect(area, `${page} > ${LABELS[id]} panel area`).toBeTruthy();
				expect(area.children.length, `${page} > ${LABELS[id]} children`).toBeGreaterThan(0);
				expect(area.textContent.trim().length, `${page} > ${LABELS[id]} text`).toBeGreaterThan(0);
			});
		});
	});

	it('each chooser row carries its panel id, and only the open panel is marked current', () => {
		openPage('Characters');
		chooserRows()
			.find((row) => row.textContent.trim() === 'Character info')
			.click();
		const rows = chooserRows();
		expect(rows.map((row) => row.dataset.panelId)).toEqual(OFFERED.Characters);
		const current = rows.filter((row) => row.getAttribute('aria-current') === 'true');
		expect(current.map((row) => row.dataset.panelId)).toEqual(['CharacterInfo']);
	});

	it('the panels whose label differs from their id each show their own panel', () => {
		openPage('Characters');
		const contentFor = {};
		['Attributes', 'ContextCharacters', 'CharacterInfo', 'QualityChecks'].forEach((id) => {
			chooserRows()
				.find((row) => row.dataset.panelId === id)
				.click();
			contentFor[id] = panelArea().innerHTML;
		});
		expect(contentFor.ContextCharacters).not.toBe(contentFor.Attributes);
		expect(contentFor.CharacterInfo).not.toBe(contentFor.Attributes);
		expect(contentFor.QualityChecks).not.toBe(contentFor.Attributes);
		expect(new Set(Object.values(contentFor)).size).toBe(4);
	});

	it('the choice is kept when moving to another page that offers it (panelForPage)', () => {
		openPage('Characters');
		chooserRows()
			.find((row) => row.dataset.panelId === 'QualityChecks')
			.click();
		editor.nav.page = 'Ligatures';
		editor.navigate();
		expect(editor.nav.panel).toBe('QualityChecks');
		expect(l3Button().querySelector('.nav-button__title').textContent).toBe('Quality checks');
		editor.nav.page = 'Kerning';
		editor.navigate();
		expect(editor.nav.panel).toBe('Attributes');
	});

	it('an old saved display name opens the right panel', () => {
		openPage('Characters');
		editor.nav.panel = 'Context characters';
		editor.navigate();
		expect(editor.nav.panel).toBe('ContextCharacters');
		expect(l3Button().querySelector('.nav-button__title').textContent).toBe('Context characters');
		const contextHtml = panelArea().innerHTML;
		editor.nav.panel = 'Attributes';
		editor.navigate();
		expect(panelArea().innerHTML).not.toBe(contextHtml);
	});
});

// --------------------------------------------------------------
// A closed panel stops listening (B1 fix: the Quality checks panel used to keep
// rebuilding whatever panel was open on every edit tick after one visit)
// --------------------------------------------------------------

/** Every subscriber as 'topic:id', so two moments can be compared. */
function subscriberKeys() {
	const keys = [];
	Object.entries(editor.subscribers).forEach(([topic, ids]) =>
		Object.keys(ids).forEach((id) => keys.push(`${topic}:${id}`))
	);
	return keys.sort();
}

function openPanel(id) {
	chooserRows()
		.find((row) => row.dataset.panelId === id)
		.click();
	expect(editor.nav.panel).toBe(id);
}

describe('Closing a panel removes its subscribers', () => {
	Object.entries(OFFERED).forEach(([page, ids]) => {
		it(`${page}: after any panel is closed, the subscribers are as they were before it opened`, () => {
			// History adds no subscribers of its own, so it is the clean baseline
			openPage(page);
			openPanel('History');
			const before = subscriberKeys();
			ids.forEach((id) => {
				openPanel(id);
				openPanel('History');
				expect(subscriberKeys(), `${page}: left over after closing ${LABELS[id]}`).toEqual(before);
			});
		});
	});

	it('Quality checks, then Attributes: no Quality checks subscriber is left', () => {
		openPage('Characters');
		openPanel('QualityChecks');
		openPanel('Attributes');
		const left = subscriberKeys().filter((key) => key.includes('qualityChecksPanel'));
		expect(left).toEqual([]);
	});

	it('Quality checks, then Attributes: an edit tick does not rebuild the Attributes panel', () => {
		openPage('Characters');
		openPanel('QualityChecks');
		openPanel('Attributes');
		const first = panelArea().firstElementChild;
		expect(first).toBeTruthy();
		editor.publish('currentItem', editor.selectedItem);
		editor.publish('currentPath', editor.selectedItem.shapes[0]);
		expect(panelArea().firstElementChild).toBe(first);
	});

	it('Transforms, then Attributes: the Transforms sliders stop listening', () => {
		openPage('Characters');
		openPanel('Transforms');
		expect(subscriberKeys().some((key) => key.includes('anyink.transforms.sliders'))).toBe(true);
		openPanel('Attributes');
		expect(subscriberKeys().filter((key) => key.includes('anyink.transforms.sliders'))).toEqual([]);
	});

	it('an open Quality checks panel still refreshes itself on an edit', () => {
		openPage('Characters');
		openPanel('QualityChecks');
		const first = panelArea().firstElementChild;
		editor.publish('currentItem', editor.selectedItem);
		expect(panelArea().firstElementChild).not.toBe(first);
		expect(panelArea().textContent).toContain('quality checks');
	});
});
