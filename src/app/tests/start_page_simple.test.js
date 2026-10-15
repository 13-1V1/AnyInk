// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 finalize, the start page Simple shows until B13's start screen (verdicts "Work file is
	called 'project' on Simple screens and in the Windows Save dialog", "Simple start page
	leftovers: 'Drop it!', two or three green buttons, 'Simple v2 project', the Recover card
	twice", "Simple start page tells him to drop 'A drawing (.svg)' ... a real drawing gets an
	upstream error", "Import progress ... 'Importing characters / Item 3 of 111'"):
	  - the New, Load and Examples tabs say font and work file (start.*), never project
	  - each tab has one green button; while the Recover banner shows a backup copy, its Restore
	    is the one green and every tab button is outlined (UX-BEGINNER.md 4.1, principle 1)
	  - the Recover tab hides the banner, so the same backup copy never shows twice
	  - the drag note says "Drop it here" (no exclamation mark, 2.2)
	  - a file the drop target can't take says why in 7.7's words (a drawing, a font file it can't
	    read, a work file that won't open), never the file check's own message or code
	  - the recent fonts card's tooltips say font, and the Windows Open and Save boxes call a .gs2
	    an "ANY-INK work file"
	  - bringing in a font file says "Bringing in letters... 3 of 111"
	All tools keeps Glyphr Studio's words and buttons on every one of these.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_FILE_TYPES, projectFileTypes } from '../../anyink/files/project_files.js';
import { makeRecentFilesCard } from '../../anyink/files/recents_ui.js';
import { resetFileApi, setFileApi } from '../../anyink/files/file_api.js';
import { fakeApi } from '../../anyink/files/tests/fakes.js';
import { sampleEditor } from '../../anyink/mode/tests/controls_probe.js';
import { setModeForTests } from '../../anyink/mode/mode.js';
import { scanDom } from '../../anyink/words/banned.js';
import { word } from '../../anyink/words/words.js';
import { resetUIUpdateThrottle } from '../../common/functions.js';
import { makeProgressIndicator } from '../../controls/progress-indicator/progress_indicator.js';
import { updateFontImportProgressIndicator } from '../../formats_io/otf/font_import.js';
import { makePage_OpenProject, startPageFileError } from '../open_project.js';

const page = () => document.querySelector('#open-project__page');
const tabContent = (id) => document.querySelector(`#tab-content__${id}`);
const tab = (id) => document.querySelector(`#open-project__tab-${id}`);
const visible = (element) => {
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hidden || node.style?.display === 'none') return false;
	}
	return true;
};
/** The green buttons he can see: fancy-buttons with no secondary attribute. */
const greens = () =>
	[...document.querySelectorAll('fancy-button')]
		.filter((b) => !b.hasAttribute('secondary') && visible(b))
		.map((b) => b.textContent.trim());
const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A Recover banner with one backup copy, as recovery_ui.js draws it (a green Restore). */
function bannerCard() {
	const banner = document.createElement('div');
	banner.className = 'anyink-recovery-area anyink-recovery-area--banner';
	banner.innerHTML =
		'<div class="anyink-recovery-card"><fancy-button data-test="restore">Restore</fancy-button><fancy-button secondary>Discard</fancy-button></div>';
	return banner;
}

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
beforeEach(() => {
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	];
	setFileApi(fakeApi({ open: [], save: undefined }));
	sampleEditor();
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	resetFileApi();
	setModeForTests('all');
	document.body.innerHTML = '';
});

function startPage(mode) {
	setModeForTests(mode);
	document.body.innerHTML = '';
	document.body.appendChild(makePage_OpenProject());
	return page();
}

describe('Simple: the start page in house words', () => {
	it('New: "Make a new font", "Font name", [Make the font]', () => {
		startPage('simple');
		expect(text(tabContent('new'))).toContain(word('start.newFontTitle'));
		expect(text(tabContent('new'))).toContain(word('start.fontName'));
		expect(text(document.querySelector('#button__create-new-project'))).toBe(
			word('start.createFont')
		);
	});

	it('Load: [Open a work file...] green, [Or open a font file...] outlined', () => {
		startPage('simple');
		tab('load').click();
		expect(greens()).toEqual([word('start.openWorkFile')]);
		expect(text(tabContent('load'))).toContain(word('start.openFontFile'));
	});

	it('Examples: "Open an example font", [Simple example font] green, [Oblegg] outlined', () => {
		startPage('simple');
		tab('examples').click();
		expect(text(tabContent('examples'))).toContain(word('start.examplesTitle'));
		expect(greens()).toEqual([word('start.exampleSimpleButton')]);
	});

	it('no tab says project, JSON or a code', () => {
		startPage('simple');
		document.querySelectorAll('.open-project__tab-content').forEach((content) => {
			content.style.display = 'block'; // every tab, not only the one showing
			// file types (.otf, .gs2) are quotes, the scan's one exemption for them (2.3)
			expect(scanDom(content, { strict: true }), content.id).toEqual([]);
		});
	});

	it('the drag note says "Drop it here"', () => {
		startPage('simple');
		const drag = new Event('dragenter', { bubbles: true });
		drag.dataTransfer = { dropEffect: 'none' };
		page().dispatchEvent(drag);
		expect(text(document.querySelector('#open-project__drop-note'))).toBe(word('start.dropNote'));
	});
});

describe('Simple: one green button', () => {
	it('each tab has one, with no backup copy to offer', () => {
		startPage('simple');
		['new', 'load', 'examples'].forEach((id) => {
			tab(id).click();
			expect(greens(), id).toHaveLength(1);
		});
	});

	it("a backup copy in the banner: its Restore is the one green; the tabs' buttons are outlined", async () => {
		startPage('simple');
		document.querySelector('#open-project__right-area').prepend(bannerCard());
		await flush();
		['new', 'load', 'examples'].forEach((id) => {
			tab(id).click();
			expect(greens(), id).toEqual(['Restore']);
		});
	});

	it('the banner goes (copy restored or thrown away): each tab has its green again', async () => {
		startPage('simple');
		const banner = bannerCard();
		document.querySelector('#open-project__right-area').prepend(banner);
		await flush();
		banner.remove();
		await flush();
		tab('new').click();
		expect(greens()).toEqual([word('start.createFont')]);
	});

	it('the Recover tab hides the banner, so the copy never shows twice', async () => {
		startPage('simple');
		const banner = bannerCard();
		document.querySelector('#open-project__right-area').prepend(banner);
		await flush();
		tab('recover').click();
		await flush();
		expect(visible(banner)).toBe(false);
		tab('new').click();
		await flush();
		expect(visible(banner)).toBe(true);
	});
});

describe('Simple: a file the start page can\'t take', () => {
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

describe('Simple: the work file in Windows and in the recent fonts card', () => {
	it('the Open and Save boxes call a .gs2 an "ANY-INK work file"', () => {
		setModeForTests('simple');
		expect(projectFileTypes()[0].description).toBe(word('file.workFileType'));
		setModeForTests('all');
		expect(projectFileTypes()).toEqual(PROJECT_FILE_TYPES);
	});

	it('the recent fonts card says font in its tooltips', () => {
		setModeForTests('simple');
		const card = makeRecentFilesCard();
		expect(card.querySelector('.anyink-recents__clear').title).toBe(word('start.recentForgetAll'));
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

describe('All tools: the start page as before', () => {
	it('its words and buttons', () => {
		startPage('all');
		expect(text(tabContent('new'))).toContain('Start a new project');
		tab('examples').click();
		expect(text(tabContent('examples'))).toContain('Simple v2 project');
		tab('load').click();
		expect(greens().length).toBeGreaterThan(1);
	});
});
