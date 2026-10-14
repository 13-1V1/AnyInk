// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: exporting from the File menu still makes the font file as today. When the font check
	finds something, the export's own "where it went" sentence stays on screen and gains
	", but small a needs fixing." with a [Show me] button and the amber (warning) edge, so
	the file name and folder never disappear exactly when something is wrong.
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAppTopBar } from '../../../app/menu.js';
import { getCurrentProjectEditor } from '../../../app/main.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import {
	answerExistingFileDialog,
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	toastText,
} from '../../files/tests/fakes.js';
import { kvClear } from '../../storage/kv.js';
import {
	EXPORT_TOAST_MS,
	exportProblemsClause,
	exportProblemsMessage,
	exportWithFontCheck,
} from '../export_toast.js';
import { PROBLEM } from '../validate.js';
import { edgeProjectJSON, openProject, square, twoPointShape } from './fixtures.js';

// jsdom has no Web Animations API; upstream's toast close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const problem = (itemId, kind = PROBLEM.inkNoWidth) => ({ itemId, problem: kind, message: 'x' });

/** The edge project with small a (ink, no width) and the question mark (a 2-point shape). */
function openBroken() {
	const json = edgeProjectJSON();
	json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
	json.glyphs['glyph-0x3F'] = { id: 'glyph-0x3F', advanceWidth: 500, shapes: [twoPointShape()] };
	return openProject(json);
}

function openFileMenu() {
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	[...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
}

function clickMenuRow(name) {
	const rows = [...document.querySelectorAll('#context-menu .context-menu-row')];
	const row = rows.find((r) => r.querySelector('.row-name')?.textContent === name);
	if (!row) throw new Error(`no File menu row named "${name}"`);
	row.click();
}

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

/** The toast's words as a person reads them (no markup). */
const toastWords = () =>
	document.querySelector('#toast')?.textContent.replace(/\s+/g, ' ').trim() || '';
/** The check's sentence inside the toast, or '' when the toast is the plain export one. */
const checkSentence = () =>
	document.querySelector('#toast .anyink-export-check__text')?.textContent.trim() || '';
const showMeButton = () => document.querySelector('#toast .anyink-export-check__show');

/** A folder destination named Fonts, chosen in the picker. */
function useFontsFolder() {
	const dir = fakeDirectoryHandle('Fonts');
	const api = fakeApi({ open: [], save: undefined, directory: dir });
	setFileApi(api);
	return { dir, api };
}

let warn;
beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	resetFileApi();
	clearDialogs();
	warn.mockRestore();
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
});

describe('exportProblemsMessage', () => {
	it('says nothing when nothing is wrong', () => {
		const { project } = openBroken();
		expect(exportProblemsMessage([], project, 'Exported A.otf to Fonts')).toBe('');
		expect(exportProblemsClause([], project)).toBe('');
	});

	it('keeps where the font file went and names the letter', () => {
		const { project } = openBroken();
		expect(
			exportProblemsMessage(
				[problem('glyph-0x61')],
				project,
				'Exported CheckEdge-Regular.otf to Fonts'
			)
		).toBe('Exported CheckEdge-Regular.otf to Fonts, but small a needs fixing.');
	});

	it('without a destination it still says the font file was made', () => {
		const { project } = openBroken();
		expect(exportProblemsMessage([problem('glyph-0x61')], project)).toBe(
			'The font file was made, but small a needs fixing.'
		);
	});

	it('a destination sentence that ends in a period runs on into the check', () => {
		const { project } = openBroken();
		expect(exportProblemsMessage([problem('glyph-0x61')], project, 'Downloading it instead.')).toBe(
			'Downloading it instead, but small a needs fixing.'
		);
	});

	it('names each letter once, in order, with "and"', () => {
		const { project } = openBroken();
		const problems = [
			problem('glyph-0x41', PROBLEM.width),
			problem('glyph-0x61'),
			problem('glyph-0x61', PROBLEM.shape),
			problem('glyph-0x3F', PROBLEM.shape),
		];
		expect(exportProblemsClause(problems, project)).toBe(
			'Capital A, small a and the question mark need fixing.'
		);
	});

	it('names five letters and counts the rest', () => {
		const { project } = openBroken();
		const ids = ['0x41', '0x42', '0x43', '0x44', '0x61', '0x62', '0x63'].map(
			(hex) => `glyph-${hex}`
		);
		expect(
			exportProblemsClause(
				ids.map((id) => problem(id)),
				project
			)
		).toBe('Capital A, Capital B, Capital C, Capital D, small a and 2 more letters need fixing.');
	});

	it('names joined letters, the space and a kern pair in plain words', () => {
		const { project } = openBroken();
		expect(exportProblemsClause([problem('liga-0x66-0x69')], project)).toBe(
			'the joined letters fi need fixing.'
		);
		expect(exportProblemsClause([problem('glyph-0x3C')], project)).toBe(
			'the less-than sign needs fixing.'
		);
		expect(exportProblemsClause([problem('glyph-0x20', PROBLEM.spaceNoWidth)], project)).toBe(
			'the space needs fixing.'
		);
		expect(exportProblemsClause([problem('kern-0', PROBLEM.kern)], project)).toBe(
			'the gap between Capital A and Capital B needs fixing.'
		);
	});
});

describe('exportWithFontCheck', () => {
	it('runs the export in the same tick, returns its result, then names the letters in font order', async () => {
		openBroken();
		let called = false;
		const pending = exportWithFontCheck(async () => {
			called = true;
			return 'folder';
		});
		expect(called).toBe(true);
		expect(await pending).toBe('folder');
		expect(checkSentence()).toBe(
			'The font file was made, but the question mark and small a need fixing.'
		);
	});

	it('says nothing when the export was cancelled or failed', async () => {
		openBroken();
		expect(await exportWithFontCheck(async () => 'cancelled')).toBe('cancelled');
		expect(await exportWithFontCheck(async () => false)).toBe(false);
		expect(toastText()).toBe('');
	});

	it('says nothing when every letter is fine', async () => {
		openProject(edgeProjectJSON());
		expect(await exportWithFontCheck(async () => 'download')).toBe('download');
		expect(toastText()).toBe('');
	});

	it('the toast stays long enough to read and press Show me', () => {
		expect(EXPORT_TOAST_MS).toBeGreaterThanOrEqual(10000);
	});

	it('wears the warning edge, not the green one', async () => {
		openBroken();
		await exportWithFontCheck(async () => 'download');
		expect(document.querySelector('#toast > .anyink-export-check')).not.toBeNull();
		// the rule that turns the toast's left edge amber while the check's words are in it
		const here = dirname(fileURLToPath(import.meta.url));
		const toastStyle = readFileSync(join(here, '..', 'export-toast.css'), 'utf8');
		expect(toastStyle).toMatch(
			/#toast:has\(>\s*\.anyink-export-check\)\s*\{[^}]*border-left-color:\s*var\(--warning\)/
		);
	});

	it('Show me opens the first letter named and closes the toast', async () => {
		openBroken();
		const editor = getCurrentProjectEditor();
		editor.navigate = vi.fn();
		await exportWithFontCheck(async () => 'download');
		expect(showMeButton()?.textContent).toBe('Show me');
		showMeButton().click();
		expect(editor.navigate).toHaveBeenCalledTimes(1);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedGlyphID).toBe('glyph-0x3F');
		expect(document.querySelector('#toast:not([data-leaving])')).toBeNull();
	});
});

describe('File menu export', () => {
	it('to a folder: the file name and folder stay on screen with the letters named', async () => {
		openBroken();
		const { dir } = useFontsFolder();
		openFileMenu();
		clickMenuRow('Export OTF file');
		expect(await waitFor(() => checkSentence().includes('small a'))).toBe(true);
		expect(dir.files.has('CheckEdge-Regular.otf')).toBe(true);
		expect(checkSentence()).toBe(
			'Exported CheckEdge-Regular.otf to Fonts, but the question mark and small a need fixing.'
		);
		// the export closes its own toast after 2.5 s; it must not close this one
		await new Promise((resolve) => setTimeout(resolve, 2700));
		expect(toastWords()).toContain('Exported CheckEdge-Regular.otf to Fonts');
		expect(toastWords()).toContain('small a');
	}, 15000);

	it('a "Keep both" export names the file it really made', async () => {
		openBroken();
		const { dir } = useFontsFolder();
		dir.addFile('CheckEdge-Regular.otf'); // a font ANY-INK didn't write
		openFileMenu();
		clickMenuRow('Export OTF file');
		await answerExistingFileDialog('keepBoth');
		expect(await waitFor(() => checkSentence().includes('small a'))).toBe(true);
		expect(dir.files.has('CheckEdge-Regular (2).otf')).toBe(true);
		expect(checkSentence()).toBe(
			'Exported CheckEdge-Regular (2).otf to Fonts, but the question mark and small a need fixing.'
		);
	}, 15000);

	it('as a download: says it is downloading, then names the letters', async () => {
		openBroken();
		const api = fakeApi({});
		setFileApi(api);
		openFileMenu();
		clickMenuRow('Export OTF file');
		expect(
			await waitFor(() => api.calls.download.length > 0 && checkSentence().includes('small a'))
		).toBe(true);
		expect(api.calls.download[0].fileName).toBe('CheckEdge-Regular.otf');
		expect(checkSentence()).toBe(
			'Downloading CheckEdge-Regular.otf, but the question mark and small a need fixing.'
		);
	}, 15000);

	it('with nothing wrong, the export toast is the same as before', async () => {
		openProject(edgeProjectJSON());
		useFontsFolder();
		openFileMenu();
		clickMenuRow('Export OTF file');
		expect(await waitFor(() => toastWords() === 'Exported CheckEdge-Regular.otf to Fonts')).toBe(
			true
		);
		expect(document.querySelector('#toast .anyink-export-check')).toBeNull();
	}, 15000);
});
