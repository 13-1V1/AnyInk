// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The Open Project page in Simple and All tools.
	B13 (UX-BEGINNER.md 4.1, section 10 B13): Simple with 'startScreen' on draws the start screen
	(src/anyink/start) in place of the four tabs, keeping both ids; Create there makes the font from
	the name field (importProjectDataAndNavigate still reads it) and opens the board, whatever the
	save box does. "Other ways to start..." shows the original tabs in All tools under the purple
	More tools band; its [Back to simple] brings the start screen back. B4 + B5's Simple words on
	the tabs are retired (they show only under More tools now, in Glyphr Studio's words).
	Kept from B4 + B5 finalize: a file the start page can't take says why in 7.7's words, the Windows
	Open and Save boxes call a .gs2 an "ANY-INK work file", and bringing in a font file says
	"Bringing in letters... 3 of 111". All tools keeps Glyphr Studio's words and buttons.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_FILE_TYPES, projectFileTypes } from '../../anyink/files/project_files.js';
import { makeRecentFilesCard } from '../../anyink/files/recents_ui.js';
import { resetFileApi, setFileApi } from '../../anyink/files/file_api.js';
import { abortError, fakeApi } from '../../anyink/files/tests/fakes.js';
import { sampleEditor } from '../../anyink/mode/tests/controls_probe.js';
import { setFeaturesForTests } from '../../anyink/mode/features.js';
import { getMode, setModeForTests } from '../../anyink/mode/mode.js';
import { scanDom } from '../../anyink/words/banned.js';
import { word } from '../../anyink/words/words.js';
import { resetUIUpdateThrottle } from '../../common/functions.js';
import { makeProgressIndicator } from '../../controls/progress-indicator/progress_indicator.js';
import { updateFontImportProgressIndicator } from '../../formats_io/otf/font_import.js';
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../main.js';
import {
	importProjectDataAndNavigate,
	makePage_OpenProject,
	startPageFileError,
} from '../open_project.js';

const tabContent = (id) => document.querySelector(`#tab-content__${id}`);
const tab = (id) => document.querySelector(`#open-project__tab-${id}`);
const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
const flush = async (n = 6) => {
	for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const visible = (element) => {
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hidden || node.style?.display === 'none') return false;
	}
	return true;
};
const greens = () =>
	[...document.querySelectorAll('fancy-button')]
		.filter((b) => !b.hasAttribute('secondary') && visible(b))
		.map((b) => b.textContent.trim());

let quiet;
let api;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
beforeEach(() => {
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	];
	api = fakeApi({ open: [], save: undefined });
	setFileApi(api);
	sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	resetFileApi();
	setModeForTests('all');
	document.body.innerHTML = '';
	window.dispatchEvent(
		new CustomEvent('anyink-page-change', { detail: { page: 'Overview', appLevel: false } })
	);
});

/** The page as the app draws it (app.js setUp): an app-level page in #app__wrapper */
function openPage(mode, { startScreen = true } = {}) {
	setModeForTests(mode);
	setFeaturesForTests({ startScreen });
	getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
	return document.querySelector('#open-project__page');
}

describe('B13: Simple draws the start screen', () => {
	it('in place of the tabs, keeping both ids', () => {
		const page = openPage('simple');
		expect(page.classList.contains('anyink-start')).toBe(true);
		expect(document.querySelector('.open-project__tab')).toBeNull();
		expect(document.querySelector('#input__new-project-name')).not.toBeNull();
		expect(text(document.querySelector('#button__create-new-project'))).toBe(
			word('startScreen.create')
		);
	});

	it('All tools keeps the tabs, and so does the second font', () => {
		openPage('all');
		expect(tab('new')).not.toBeNull();
		setModeForTests('simple');
		setFeaturesForTests({ startScreen: true });
		document.body.innerHTML = '';
		document.body.appendChild(makePage_OpenProject(true));
		expect(tab('new')).not.toBeNull();
	});

	it('Create with a cancelled save box: the font takes the typed name and the board opens', async () => {
		setFileApi(fakeApi({ open: [], save: abortError() }));
		openPage('simple');
		document.querySelector('#input__new-project-name').value = 'Brennan Hand';
		document.querySelector('#button__create-new-project').click();
		const editor = getCurrentProjectEditor();
		expect(editor.project.settings.project.name).toBe('Brennan Hand');
		expect(editor.project.settings.font.family).toBe('Brennan Hand');
		expect(editor.nav.page).toBe('Overview');
		expect(document.querySelector('.anyink-start')).toBeNull();
		await flush();
		expect(editor.loadedFileHandle).toBeFalsy();
	});

	// B12 + B13 integration: Menu > Start a new font... brings the start screen back over a font
	// that came from a work file; Create must not leave that file on the new font (the pill would
	// call it Saved, and Ctrl+S would write the new font over the old one). Written to fail first.
	it('Create after another font: the new font has no work file yet', () => {
		setFileApi(fakeApi({ open: [], save: () => new Promise(() => {}) }));
		const editor = getCurrentProjectEditor();
		editor.loadedFileHandle = { kind: 'file', name: 'Old Hand.gs2' };
		openPage('simple');
		document.querySelector('#input__new-project-name').value = 'Fresh';
		document.querySelector('#button__create-new-project').click();
		expect(getCurrentProjectEditor().project.settings.project.name).toBe('Fresh');
		expect(getCurrentProjectEditor().loadedFileHandle).toBeFalsy();
	});

	it('Create with a save box that never answers: the board opens all the same', () => {
		setFileApi(fakeApi({ open: [], save: () => new Promise(() => {}) }));
		openPage('simple');
		document.querySelector('#input__new-project-name').value = 'Never Answers';
		document.querySelector('#button__create-new-project').click();
		expect(getCurrentProjectEditor().project.settings.project.name).toBe('Never Answers');
		expect(document.querySelector('.anyink-start')).toBeNull();
	});

	it('"Other ways to start..." shows the tabs in All tools under the More tools band', async () => {
		openPage('simple');
		await flush();
		document.querySelector('.anyink-start__other-ways').click();
		expect(getMode()).toBe('all');
		const band = document.querySelector('.anyink-band');
		expect(band).not.toBeNull();
		expect(text(band)).toContain(word('mode.band.moreTools'));
		band.querySelector('button').click();
		expect(getMode()).toBe('simple');
		expect(document.querySelector('.anyink-start')).not.toBeNull();
	});

	// Fix pass (finding: "Other ways to start..." opened on a second green Create that made "My
	// Font" in All tools). Written to fail first: the New tab was picked.
	it('"Other ways to start..." opens on the Load tab; there is no second Create', async () => {
		openPage('simple');
		await flush();
		document.querySelector('.anyink-start__other-ways').click();
		expect(tab('load').hasAttribute('selected')).toBe(true);
		expect(visible(tabContent('load'))).toBe(true);
		expect(visible(tab('new'))).toBe(false);
		expect(visible(tabContent('new'))).toBe(false);
		expect(visible(document.querySelector('#button__create-new-project'))).toBe(false);
		// the examples and the backups list are still there
		expect(visible(tab('examples'))).toBe(true);
		tab('examples').click();
		expect(visible(tabContent('examples'))).toBe(true);
	});

	it('the tabs reached from the start screen stay without Create when they are drawn again', async () => {
		openPage('simple');
		await flush();
		document.querySelector('.anyink-start__other-ways').click();
		getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
		expect(visible(tab('new'))).toBe(false);
		expect(tab('load').hasAttribute('selected')).toBe(true);
	});

	it('All tools on its own (not from the start screen) still opens on New', () => {
		openPage('all');
		expect(tab('new').hasAttribute('selected')).toBe(true);
		expect(visible(tab('new'))).toBe(true);
	});

	it('after a font is opened from those tabs, All tools has its New tab again', async () => {
		openPage('simple');
		await flush();
		document.querySelector('.anyink-start__other-ways').click();
		importProjectDataAndNavigate();
		getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
		expect(visible(tab('new'))).toBe(true);
	});

	it('a mode switch keeps the name he typed', async () => {
		openPage('simple');
		document.querySelector('#input__new-project-name').value = 'Keep Me';
		document.querySelector('.anyink-start__other-ways').click();
		expect(document.querySelector('#input__new-project-name').value).toBe('Keep Me');
		document.querySelector('.anyink-band button').click();
		await flush();
		expect(document.querySelector('#input__new-project-name').value).toBe('Keep Me');
	});

	it('the whole start screen passes the strict banned-word scan', async () => {
		const page = openPage('simple');
		await flush();
		expect(scanDom(page, { strict: true })).toEqual([]);
	});
});

describe("B13: the tabs say Glyphr Studio's words (B4 + B5's Simple words retired)", () => {
	it('its words and buttons, as before', () => {
		openPage('all');
		expect(text(tabContent('new'))).toContain('Start a new project');
		tab('examples').click();
		expect(text(tabContent('examples'))).toContain('Simple v2 project');
		tab('load').click();
		expect(greens().length).toBeGreaterThan(1);
		// All tools launched as All tools: no band
		expect(document.querySelector('.anyink-band')).toBeNull();
	});

	it('the recent projects card says project again', () => {
		setModeForTests('simple');
		const card = makeRecentFilesCard();
		expect(card.querySelector('.anyink-recents__clear').title).toBe('Forget every recent project');
	});
});

describe("Simple: a file the start page can't take", () => {
	it.each([
		['SVG1', 'logo.svg', 'error.drawingNotFont'],
		['FF0', 'odd.otf', 'error.fontFileUnreadable'],
		['PF0', 'Broken.gs2', 'error.notWorkFile'],
	])('%s: the 7.7 words, no code', (code, fileName, key) => {
		setModeForTests('simple');
		startPageFileError({ errorMessage: `Upstream words. [${code}]`, fileName });
		const box = document.querySelector('#error');
		expect(box.dataset.anyinkError).toBe(key);
		expect(text(box)).not.toMatch(/\[|Upstream/);
	});

	it('All tools: the message as before', () => {
		startPageFileError({ errorMessage: 'Upstream words. [SVG1]', fileName: 'logo.svg' });
		expect(text(document.querySelector('#error'))).toContain('Upstream words. [SVG1]');
	});
});

describe('Simple: the work file in Windows', () => {
	it('the Open and Save boxes call a .gs2 an "ANY-INK work file"', () => {
		setModeForTests('simple');
		expect(projectFileTypes()[0].description).toBe(word('file.workFileType'));
		setModeForTests('all');
		expect(projectFileTypes()).toEqual(PROJECT_FILE_TYPES);
	});
});

describe('Simple: bringing in a font file', () => {
	it('"Bringing in letters... 3 of 111", never "Importing characters"', async () => {
		setModeForTests('simple');
		document.body.appendChild(makeProgressIndicator());
		resetUIUpdateThrottle();
		await updateFontImportProgressIndicator('character');
		const said = text(document.querySelector('#progress-indicator__message'));
		expect(said).toMatch(/^Bringing in letters\.\.\. \d+ of \d+$/);
	});

	it('All tools: as before', async () => {
		document.body.appendChild(makeProgressIndicator());
		resetUIUpdateThrottle();
		await updateFontImportProgressIndicator('character');
		expect(text(document.querySelector('#progress-indicator__message'))).toMatch(
			/^Importing characters/
		);
	});
});
