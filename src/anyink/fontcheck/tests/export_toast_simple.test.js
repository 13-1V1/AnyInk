// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 integration (UX-BEGINNER.md 4.0 Toasts, 7.7 "Font file can't be built"): in Simple
	the Menu's font file row (B6's Menu; the File menu before B6; Ctrl+E until B14) ends with one toast in the one queue: "Exported
	"X.otf" to "Fonts", but small a needs fixing. [Show me]", the names as quotes, the amber
	edge, [Show me] the toast's own button. It takes the place of "Exported ..." (one group), so
	[Show me] is never lost, and it lasts its own time: the export's 2.5 s close (font_export.js)
	leaves a Simple toast to the queue. All tools is unchanged (export_toast.test.js).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAppTopBar } from '../../../app/menu.js';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../../app/main.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi, fakeDirectoryHandle } from '../../files/tests/fakes.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { clearToasts, resetToastsForTests } from '../../toast/toast.js';
import { EXPORT_TOAST_MS, exportWithFontCheck } from '../export_toast.js';
import { edgeProjectJSON, openProject, openSimpleExample, square } from './fixtures.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

/** The edge project with small a: ink, no width. */
function openBroken() {
	const json = edgeProjectJSON();
	json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
	return openProject(json);
}

/** The font file row: in B6's Menu (Simple's top bar), or in the File menu before B6 */
function clickFontFileRow() {
	// B14 + B15 integration: the stand-in .otf row is Simple's before B14 (Use in Word replaces it)
	setFeaturesForTests({ useInWord: false });
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	const simpleMenu = topBar.querySelector('[data-anyink-control="menu"]');
	if (simpleMenu) simpleMenu.click();
	else [...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
	document
		.querySelector('#context-menu [data-anyink-row="font-otf"]')
		.closest('.context-menu-row')
		.click();
}

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

/** The Simple toast on screen (not leaving), or null. */
const showing = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
const words = (toast) => toast?.querySelector('.anyink-toast__text')?.textContent || '';

let warn;
beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('simple');
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	resetFileApi();
	clearDialogs();
	resetToastsForTests();
	warn.mockRestore();
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('Simple: the export check is one toast with [Show me]', () => {
	it('names the file and folder as quotes, the letter in words, with the amber edge', async () => {
		openBroken();
		setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('Fonts') }));
		clickFontFileRow();
		expect(await waitFor(() => words(showing()).includes('small a'))).toBe(true);
		const toast = showing();
		expect(words(toast)).toMatch(/^Made .+-Regular\.otf in Fonts, but small a needs fixing\.$/); // B14 + B15 finalize: "Made"
		expect([...toast.querySelectorAll('.anyink-quote')].map((q) => q.textContent)).toEqual([
			expect.stringMatching(/-Regular\.otf$/),
			'Fonts',
		]);
		expect(toast.dataset.tone).toBe('warning');
		expect(toast.querySelector('.anyink-toast__action').textContent).toBe('Show me');
		// one toast on screen: the check took the place of "Exported ..."
		expect(document.querySelectorAll('#toast:not([data-leaving])')).toHaveLength(1);
	});

	it('[Show me] opens the letter', async () => {
		openBroken();
		const editor = getCurrentProjectEditor();
		editor.nav.page = 'Overview';
		expect(await exportWithFontCheck(async () => 'download')).toBe('download');
		const toast = showing();
		expect(words(toast)).toBe('The font file was made, but small a needs fixing.');
		toast.querySelector('.anyink-toast__action').click();
		expect(editor.selectedItemID).toBe('glyph-0x61');
		expect(showing()).toBeNull();
	});

	it("outlasts the export's 2.5 s close: it shows for its own time", async () => {
		openBroken();
		setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('Fonts') }));
		clickFontFileRow();
		expect(await waitFor(() => words(showing()).includes('small a'))).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 2800));
		expect(words(showing())).toContain('small a needs fixing');
		expect(EXPORT_TOAST_MS).toBeGreaterThan(2800);
	}, 15000);
});

// B4 + B5 finalize (new problem "An offer outlives its font"): [Show me] belongs to the font that
// was exported. Another font opened in its place (Ctrl+O loads into the same editor), the next
// page change takes the toast down, and its button never opens a letter of the other font.
describe('Simple: [Show me] belongs to the font it names', () => {
	it('another font opened: the toast goes at the page change, and its button is dead', async () => {
		openBroken();
		const editor = getCurrentProjectEditor();
		editor.nav.page = 'Overview';
		await exportWithFontCheck(async () => 'download');
		const toast = showing();
		expect(words(toast)).toContain('small a needs fixing');
		const other = openSimpleExample().project;
		editor.project = other; // Ctrl+O puts the picked font in the same editor
		setCurrentProjectEditor(editor);
		const before = { page: editor.nav.page, item: editor.selectedItemID };
		toast.querySelector('.anyink-toast__action').click();
		expect({ page: editor.nav.page, item: editor.selectedItemID }).toEqual(before);
		clearToasts();
		expect(showing()).toBeNull();
	});
});
