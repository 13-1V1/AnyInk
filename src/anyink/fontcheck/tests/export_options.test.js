// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 item 8: one export can leave out empty letters, add a space, and use another family
	or file name, without touching the project's settings or its undo history.
*/
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { kvClear } from '../../storage/kv.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi } from '../../files/tests/fakes.js';
import { edgeProjectJSON, openProject } from './fixtures.js';

// jsdom has no Web Animations API; upstream's toast close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const byUnicode = (font, code) => font.glyphs.find((glyph) => glyph.unicode === code);

/** The edge project with no C yet; opening C creates it, as clicking its tile does. */
function openWithOpenedC() {
	const json = edgeProjectJSON();
	delete json.glyphs['glyph-0x43'];
	const editor = openProject(json);
	editor.selectedGlyphID = 'glyph-0x43';
	expect(editor.selectedGlyph.shapes).toHaveLength(0);
	return editor;
}

/** The edge project without its ligature (exporting one adds its missing letters). */
function noLigatureJSON() {
	const json = edgeProjectJSON();
	json.ligatures = {};
	return json;
}

/** What an export with options must never change (range caches aside). */
function snapshot(editor) {
	const { project, font, app, anyink } = editor.project.settings;
	const { characterRanges, ...projectSettings } = project;
	return {
		settings: JSON.stringify({ projectSettings, font, app, anyink }),
		ranges: characterRanges.map((range) => [range.begin, range.end, range.enabled]),
		glyphIds: Object.keys(editor.project.glyphs).sort(),
		history: editor.history.queue.length,
		redo: editor.history.redoQueue.length,
	};
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('omitEmptyLetters', () => {
	it("a letter that was only opened is in today's font file, and not with the option", async () => {
		const editor = openWithOpenedC();
		const before = await ioFont_exportFont('otf', true);
		expect(byUnicode(FontFlux.open(before), 0x43)).toBeDefined();

		const after = FontFlux.open(await ioFont_exportFont('otf', true, { omitEmptyLetters: true }));
		expect(byUnicode(after, 0x43)).toBeUndefined();
		expect(byUnicode(after, 0x41)).toBeDefined();
		// the ligature still has its letters, so the font file holds it
		expect(byUnicode(after, 0x66)).toBeDefined();
		expect(after.glyphs.some((glyph) => glyph.name === 'lig.0066.0069')).toBe(true);
		// the work file keeps C
		expect(editor.project.glyphs['glyph-0x43']).toBeDefined();
	});
});

describe('addSpaceIfMissing', () => {
	it('adds a space 512 wide at the 2,048 grid, in the font file only', async () => {
		const editor = openProject(noLigatureJSON());
		const before = snapshot(editor);
		const font = FontFlux.open(await ioFont_exportFont('otf', true, { addSpaceIfMissing: true }));
		const space = byUnicode(font, 0x20);
		// named the way the exporter names every letter: ANY-INK made it, not the library
		expect(space.name).toBe('uni0020');
		expect(space.advanceWidth).toBe(512);
		expect(snapshot(editor)).toEqual(before);
		expect(editor.project.glyphs['glyph-0x20']).toBeUndefined();
	});

	it('leaves a space the font already has alone', async () => {
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x20'] = { id: 'glyph-0x20', advanceWidth: 300, shapes: [] };
		openProject(json);
		const font = FontFlux.open(await ioFont_exportFont('otf', true, { addSpaceIfMissing: true }));
		expect(byUnicode(font, 0x20).advanceWidth).toBe(300);
	});
});

describe('familyName and fileName', () => {
	beforeEach(async () => {
		await kvClear();
		await forgetExportFolder();
		clearDialogs();
	});
	afterEach(() => {
		resetFileApi();
		clearDialogs();
	});

	it('familyName names this one font file; the project keeps its own name', async () => {
		const editor = openProject(noLigatureJSON());
		const before = snapshot(editor);
		const font = FontFlux.open(
			await ioFont_exportFont('otf', true, { familyName: 'Brennan Hand Test1' })
		);
		expect(font.info.familyName).toBe('Brennan Hand Test1');
		expect(font.info.postScriptName).toBe('BrennanHandTest1-Regular');
		expect(editor.project.settings.font.family).toBe('Check Edge');
		expect(snapshot(editor)).toEqual(before);
	});

	it('fileName is the name the file is saved under', async () => {
		const editor = openProject(noLigatureJSON());
		const before = snapshot(editor);
		const api = fakeApi({});
		setFileApi(api);
		const result = await ioFont_exportFont('otf', false, {
			familyName: 'Brennan Hand Test1',
			fileName: 'BrennanHand-Test1.otf',
		});
		expect(result).toBe('download');
		expect(api.calls.download[0].fileName).toBe('BrennanHand-Test1.otf');
		expect(snapshot(editor)).toEqual(before);
	}, 15000);

	it('a fileName without the extension gets one', async () => {
		openProject(edgeProjectJSON());
		const api = fakeApi({});
		setFileApi(api);
		await ioFont_exportFont('ttf', false, { fileName: 'BrennanHand-Test2' });
		expect(api.calls.download[0].fileName).toBe('BrennanHand-Test2.ttf');
	}, 15000);
});

describe('all options off', () => {
	it('an empty options object builds the same bytes as no options', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
		try {
			openProject(edgeProjectJSON());
			const plain = new Uint8Array(await ioFont_exportFont('otf', true));
			openProject(edgeProjectJSON());
			const withOptions = new Uint8Array(
				await ioFont_exportFont('otf', true, {
					omitEmptyLetters: false,
					addSpaceIfMissing: false,
				})
			);
			expect(withOptions).toEqual(plain);
		} finally {
			vi.useRealTimers();
		}
	});
});
