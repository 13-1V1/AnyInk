// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { isShown } from '../anyink/mode/visibility.js';
import { makePanel_Trace } from '../anyink/trace/trace_panel.js';
import { getCurrentProjectEditor } from '../app/main.js';
import { addAsChildren, makeElement } from '../common/dom.js';
import { countItems } from '../common/functions.js';
import { makePanel_GlyphAttributes } from './attributes_glyph_edit.js';
import { makePanel_KernGroupAttributes } from './attributes_kern.js';
import { makePanel_CharacterInfo } from './character_info.js';
import { makePanel_ContextCharacters } from './context_characters.js';
import { makePanel_Guides } from './guides.js';
import { makePanel_History } from './history.js';
import { makePanel_Layers } from './layers.js';
import { handlePanelsKeyPress, handlePanelsKeyUp } from './panel_events.js';
import { makePanel_QualityChecks } from './quality_checks.js';
import { makePanel_Transforms } from './transforms.js';

/**
 * Assembles the correct panel based on the current
 * project editor and page.
 */
export function makePanel() {
	// log(`makePanel`, 'start');

	const editor = getCurrentProjectEditor();
	// log(editor.nav);
	let content = makeElement();
	// ANY-INK (B1): nav.panel holds the panel id (a listOfPanels() key in navigator.js),
	// so the comparisons below use ids, never labels like 'Context characters'
	let panel = editor.nav.panel;
	// log(`panel: ${panel}`);

	if (panel !== 'Layers') {
		document.removeEventListener('keydown', handlePanelsKeyPress, false);
		document.removeEventListener('keyup', handlePanelsKeyUp, false);
	}

	// ANY-INK (B5, UX-BEGINNER 6.2 Panels): Simple shows none of the 9 panels (B7's letter card
	// takes their place). Nothing is drawn and no panel keeps listening.
	if (!isShown('panel', panel)) {
		document.removeEventListener('keydown', handlePanelsKeyPress, false);
		document.removeEventListener('keyup', handlePanelsKeyUp, false);
		unsubscribeExcept();
		return content;
	}

	if (editor.nav.page === 'Components' && countItems(editor.project.components) <= 0) {
		return content;
	}

	if (editor.nav.page === 'Ligatures' && countItems(editor.project.ligatures) <= 0) {
		return content;
	}

	if (editor.nav.page === 'Kerning' && countItems(editor.project.kerning) <= 0) {
		return content;
	}

	if (panel === 'Attributes') {
		unsubscribeExcept('attributesPanel');
		if (editor.nav.page === 'Kerning') addAsChildren(content, makePanel_KernGroupAttributes());
		else addAsChildren(content, makePanel_GlyphAttributes());
	} else if (panel === 'Transforms') {
		unsubscribeExcept('transformsPanel');
		addAsChildren(content, makePanel_Transforms());
	} else if (panel === 'Layers') {
		unsubscribeExcept('layersPanel');
		addAsChildren(content, makePanel_Layers());
		document.addEventListener('keydown', handlePanelsKeyPress, false);
		document.addEventListener('keyup', handlePanelsKeyUp, false);
	} else if (panel === 'ContextCharacters') {
		unsubscribeExcept('contextCharactersPanel');
		addAsChildren(content, makePanel_ContextCharacters());
	} else if (panel === 'History') {
		unsubscribeExcept('historyPanel');
		addAsChildren(content, makePanel_History());
	} else if (panel === 'Guides') {
		unsubscribeExcept('guidesPanel');
		addAsChildren(content, makePanel_Guides());
	} else if (panel === 'CharacterInfo') {
		unsubscribeExcept('characterInfoPanel');
		addAsChildren(content, makePanel_CharacterInfo());
	} else if (panel === 'QualityChecks') {
		unsubscribeExcept('qualityChecksPanel');
		addAsChildren(content, makePanel_QualityChecks());
	} else if (panel === 'Trace') {
		// ANY-INK (M7): trace image controls (src/anyink/trace/trace_panel.js)
		unsubscribeExcept('tracePanel');
		addAsChildren(content, makePanel_Trace());
	}

	// log(`makePanel`, 'end');
	return content;
}

/**
 * ANY-INK (B1): the subscriber ids each panel listens with. Opening one panel removes every
 * other panel's ids, so a closed panel never refreshes the open one. Upstream listed the
 * panels by hand and missed Quality checks, whose currentItem / currentPath subscriber then
 * rebuilt whatever panel was open on every edit tick. A new panel adds its row here.
 * Removal matches by substring (pub_sub.js unsubscribe), so each id also removes every id that
 * contains it: 'attributesPanel' removes the card inputs 'attributesPanel.currentItem.x', and
 * 'guidesPanel' removes 'anyink.metrics.guidesPanel.system.ascent'.
 */
const panelSubscriberIDs = {
	attributesPanel: ['attributesPanel'],
	transformsPanel: ['anyink.transforms.sliders'],
	layersPanel: ['layersPanel'],
	contextCharactersPanel: ['contextCharactersPanel'],
	historyPanel: ['historyPanel'],
	guidesPanel: ['guidesPanel'],
	characterInfoPanel: ['characterInfoPanel'],
	qualityChecksPanel: ['qualityChecksPanel'],
	// ANY-INK (M7, M8): the Trace panel and the Auto-trace card inside it
	tracePanel: ['anyink.trace.panel', 'anyink.autotrace.panel'],
};

function unsubscribeExcept(panelName = '') {
	const editor = getCurrentProjectEditor();
	Object.entries(panelSubscriberIDs).forEach(([name, ids]) => {
		if (name === panelName) return;
		ids.forEach((id) => editor.unsubscribe({ idToRemove: id }));
	});
}

/**
 * Refreshes the panel area in the current document
 */
export function refreshPanel() {
	// log(`refreshPanel`, 'start');
	if (getCurrentProjectEditor().nav.panel === 'Transforms') {
		// log(`refreshPanel`, 'end');
		return;
	}
	let panelArea = document.querySelector('#editor-page__panel');
	if (panelArea) {
		let newContent = makePanel();
		// log(newContent);
		panelArea.innerHTML = '';
		panelArea.appendChild(newContent);
	}
	// log(`refreshPanel`, 'end');
}
