// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 fix pass: the banned-word scan reaches the Simple states the critic found it missed, and
	runs strict there (UX-BEGINNER.md 2.3 plus 2.4 E and G: no Unicode block or letter names, no
	"project", no "JSON", no error codes; banned.js NEVER_SHOWN_TERMS), and an error box never shows
	the browser's own sentence (7.7).
	  - the Overview's letter-set switch, inside the option chooser's shadow root ("Basic Latin")
	  - every start page tab ("Start a new project", "Project name", "Open a project file...")
	  - About, every tab ("Unique project ID", the Credits' "glyph editor ... ligatures, kerning")
	  - the start page while a font file is brought in ("Importing characters", "Item 3 of 111")
	  - the error box: Ctrl+O on a damaged work file ("JSON", "[PF0]") and on JSON that isn't a
	    font ("project settings", "[PF1]"), a save that failed because the file changed on disk
	    (Chrome's own sentence), a file command that didn't finish (its own sentence), a font file
	    that couldn't be written ("The OTF file could not be saved", the disk's own sentence)
	  - the letter canvas and the strip, which already pass strict (no pending)
	B4 + B5 finalize: every surface here is clean, so none is pending any more, and banned_scan.js
	STRICT_BY_DEFAULT is true: every Simple scan runs strict.
*/
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { makePage_OpenProject } from '../../../app/open_project.js';
import { OptionChooser } from '../../../controls/option-chooser/option_chooser.js';
import { makeProgressIndicator } from '../../../controls/progress-indicator/progress_indicator.js';
import { updateFontImportProgressIndicator } from '../../../formats_io/otf/font_import.js';
import { resetUIUpdateThrottle } from '../../../common/functions.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { openProjectFromHandle } from '../../files/project_files.js';
import { runFileCommand } from '../../files/run_command.js';
import {
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	fakeFileHandle,
	namedError,
} from '../../files/tests/fakes.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { scanSimpleScreen } from './banned_scan.js';

const BROWSER_SENTENCE =
	'An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.';
const COMMAND_SENTENCE =
	'Failed to execute write on FileSystemWritableFileStream: the stream is closed.';

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	if (!customElements.get('option-chooser')) customElements.define('option-chooser', OptionChooser);
});
beforeEach(() => {
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	];
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	resetFileApi();
	clearDialogs();
	document.body.innerHTML = '';
});

/** One of the pages Simple shows today, drawn by the real Navigator. */
function simplePage(page) {
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.navigate();
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return editor;
}

/**
 * A page with every tab's content: TabControl draws one tab at a time, so each tab is pressed
 * and what it drew is kept beside the page, so a tab nobody opened is scanned too.
 * @param {Element} page
 * @returns {Element} the page and a copy of each tab's content
 */
function everyTab(page) {
	const all = document.createElement('div');
	const area = page.querySelector('.content-page__right-area');
	page.querySelectorAll('.tab-control__tab').forEach((tab) => {
		tab.click();
		const copy = document.createElement('section');
		copy.dataset.tab = tab.textContent;
		copy.append(...[...area.childNodes].map((node) => node.cloneNode(true)));
		all.appendChild(copy);
	});
	page.appendChild(all);
	return page;
}

async function waitFor(check, ms = 3000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

// --------------------------------------------------------------
// Pages
// --------------------------------------------------------------

scanSimpleScreen(
	"the Overview's letter-set switch (inside the option chooser's shadow root)",
	() => {
		simplePage('Overview');
		return document.querySelector('#app__wrapper');
	},
	{ strict: true }
);

scanSimpleScreen(
	'the start page, every tab shown',
	() => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		sampleEditor();
		const page = makePage_OpenProject();
		document.body.appendChild(page);
		page.querySelectorAll('.open-project__tab-content').forEach((tab) => (tab.style.display = ''));
		return page;
	},
	{ strict: true }
);

scanSimpleScreen(
	'About, every tab shown',
	() => {
		simplePage('About');
		return everyTab(document.querySelector('#app__wrapper'));
	},
	{ strict: true }
);

scanSimpleScreen(
	'the start page while a font file is brought in',
	async () => {
		document.body.appendChild(makeProgressIndicator());
		const said = [];
		for (const type of ['character', 'kern group', 'ligature']) {
			resetUIUpdateThrottle();
			await updateFontImportProgressIndicator(type);
			said.push(document.querySelector('#progress-indicator__message').textContent);
		}
		return { root: document.body, texts: { 'import progress': said } };
	},
	{ strict: true }
);

// --------------------------------------------------------------
// The error box
// --------------------------------------------------------------

/** Opens a work file through the real reader, as Ctrl+O and the start page do. */
async function openBroken(name, text) {
	sampleEditor();
	const handle = fakeFileHandle(name, { text });
	await openProjectFromHandle(handle, { load: () => sampleEditor() });
	await waitFor(() => document.querySelector('#error'));
	return document.querySelector('#error');
}

scanSimpleScreen(
	'the error box: Ctrl+O on a damaged work file',
	() => openBroken('Broken.gs2', '{bad'),
	{ strict: true }
);

scanSimpleScreen(
	"the error box: Ctrl+O on a file that isn't a font",
	() => openBroken('Notes.gs2', '{"hello": "world"}'),
	{ strict: true }
);

scanSimpleScreen(
	'the error box: Save, when the work file changed on disk',
	async () => {
		const editor = sampleEditor();
		setFileApi(fakeApi({ open: [], save: undefined }));
		editor.loadedFileHandle = fakeFileHandle('Brennan Hand.gs2', {
			writeError: namedError('InvalidStateError', BROWSER_SENTENCE),
		});
		editor.setProjectAsUnsaved();
		await runFileCommand(() => editor.saveProjectFile());
		await waitFor(() => document.querySelector('#error'));
		return document.querySelector('#error');
	},
	{ strict: true, forbid: [BROWSER_SENTENCE] }
);

scanSimpleScreen(
	"the error box: a file command that didn't finish",
	async () => {
		await runFileCommand(() => {
			throw namedError('InvalidStateError', COMMAND_SENTENCE);
		});
		return document.querySelector('#error');
	},
	{ strict: true, forbid: [COMMAND_SENTENCE] }
);

const DISK_SENTENCE = 'The disk is full: QuotaExceededError while writing the stream.';

scanSimpleScreen(
	"the error box: a font file that couldn't be written",
	async () => {
		await forgetExportFolder();
		sampleEditor();
		const disk = namedError('QuotaExceededError', DISK_SENTENCE);
		setFileApi(
			fakeApi({
				open: [],
				save: undefined,
				directory: fakeDirectoryHandle('My Fonts', { fileOptions: { writeError: disk } }),
				download: () => {
					throw disk;
				},
			})
		);
		await ioFont_exportFont('otf');
		await waitFor(() => document.querySelector('#error'));
		return document.querySelector('#error');
	},
	{ strict: true, forbid: [DISK_SENTENCE] }
);
