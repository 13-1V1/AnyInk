// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (critic findings "a failed Save shows the browser's raw error sentence in an Error
// box", "Ctrl+O shows JSON, [PF0]/[PF1] codes and raw parser text", "Error boxes bypass the words
// layer in Simple", "Make a font file: cancelling says only 'No font file was made'", and the
// start page's SVG font errors). UX-BEGINNER.md 7.7 gives each situation one plain sentence and
// its buttons; error_words.js picks them from what went wrong, so a caller never shows the
// browser's own sentence, a code or a file format's name. The file and folder names are quotes.
import { describe, expect, it } from 'vitest';
import { findBanned } from '../banned.js';
import {
	exportFolderWords,
	fileCommandWords,
	fontFileFailedWords,
	openErrorWords,
	saveErrorWords,
	startFileErrorWords,
} from '../error_words.js';
import { wordHTML } from '../word_html.js';
import { word } from '../words.js';

const error = (
	name,
	message = 'An operation that depends on state cached in an interface object was made.'
) => Object.assign(new Error(message), { name });

/** The sentence as Brennan reads it, the file name standing in as itself. */
const shown = ({ key, vars }) => word(key, vars);

describe('7.7: a save that failed', () => {
	it('a write that failed: "Couldn\'t save to X. A backup copy is kept." [Try again] [Save somewhere else]', () => {
		const words = saveErrorWords(error('AbortError'), 'Brennan Hand.gs2');
		expect(shown(words)).toBe("Couldn't save to Brennan Hand.gs2. A backup copy is kept.");
		expect(words.buttons.map((key) => word(key))).toEqual(['Try again', 'Save somewhere else']);
		expect(words.quotes).toEqual(['file']);
	});

	it("the file changed on disk (Chrome's InvalidStateError, a lock, ANY-INK's own check): save as a new file", () => {
		['InvalidStateError', 'NoModificationAllowedError', 'FileConflictError'].forEach((name) => {
			const words = saveErrorWords(error(name), 'Brennan Hand.gs2');
			expect(shown(words)).toBe(
				'Brennan Hand.gs2 was changed somewhere else. Save your work as a new file so nothing is lost.'
			);
			expect(words.buttons.map((key) => word(key))).toEqual(['Save as a new file']);
		});
	});

	it('never the browser\'s own sentence, and a work file with no name yet is "your work file"', () => {
		const words = saveErrorWords(error('AbortError'), '');
		expect(shown(words)).toBe("Couldn't save to your work file. A backup copy is kept.");
		expect(JSON.stringify(words)).not.toMatch(/operation|cached/);
	});
});

describe("7.7: a work file that won't open (Ctrl+O, the start page, a recent font)", () => {
	it('damaged, not JSON, not a font at all: one sentence that says what to do, no code', () => {
		['[PF0]', '[PF1]', '[PF2]', '[PF3]', '[PF5]', 'Unexpected token'].forEach((message) => {
			const words = openErrorWords(message, 'Broken.gs2');
			expect(shown(words)).toBe(
				"Broken.gs2 isn't an ANY-INK work file, or it is damaged. Open another work file, or look on the start page for a backup copy."
			);
			expect(shown(words)).not.toMatch(/JSON|\[PF\d\]|token/);
		});
	});

	it('made by a newer ANY-INK ([PF4]): reload first', () => {
		expect(shown(openErrorWords('newer version [PF4]', 'New.gs2'))).toBe(
			'New.gs2 was made with a newer ANY-INK. Reload ANY-INK to get the newest version, then open New.gs2 again.'
		);
	});
});

describe('7.7: the folder font files go to', () => {
	it('no folder picked: the Documents advice and [Pick a folder...]', () => {
		const words = exportFolderWords('cancelled');
		expect(shown(words)).toBe(
			"No folder picked. Make a new folder inside Documents (Chrome won't let you pick Documents itself) and choose it."
		);
		expect(words.buttons.map((key) => word(key))).toEqual(['Pick a folder...']);
	});

	it('not allowed to write there: [Try again] [Pick a different folder]', () => {
		const words = exportFolderWords('refused', 'My Fonts');
		expect(shown(words)).toBe("Couldn't write to My Fonts. Chrome may need your OK.");
		expect(words.quotes).toEqual(['folder']);
		expect(words.buttons.map((key) => word(key))).toEqual(['Try again', 'Pick a different folder']);
	});

	it('the font file could not be made: no format name, no browser sentence', () => {
		expect(shown(fontFileFailedWords(error('QuotaExceededError')))).toBe(
			"Couldn't make the font file. Your work is safe. Try again."
		);
	});
});

describe('a file command that failed, and the start page', () => {
	it('"That did not finish." becomes plain words with no browser sentence', () => {
		expect(shown(fileCommandWords(error('TypeError')))).toBe(
			"That didn't finish. Your work is safe. Try again."
		);
	});

	it("a drawing dropped where a font file goes, and a font file that can't be read", () => {
		expect(shown(startFileErrorWords('SVG1', 'logo.svg'))).toBe(
			'logo.svg is a drawing, not a font file. To bring in its shapes, open a letter and drop the drawing on it.'
		);
		expect(shown(startFileErrorWords('SVG0', 'odd.svg'))).toBe(
			"ANY-INK couldn't read odd.svg as a font file. It may be damaged."
		);
		expect(shown(startFileErrorWords('', 'notes.docx'))).toBe(
			'ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files (.gs2).'
		);
	});
});

describe('every one in plain words', () => {
	const all = [
		saveErrorWords(error('AbortError'), 'a.gs2'),
		saveErrorWords(error('InvalidStateError'), 'a.gs2'),
		openErrorWords('[PF0]', 'a.gs2'),
		openErrorWords('[PF4]', 'a.gs2'),
		exportFolderWords('cancelled'),
		exportFolderWords('refused', 'Fonts'),
		fontFileFailedWords(error('Error')),
		fileCommandWords(error('Error')),
		startFileErrorWords('SVG1', 'a.svg'),
		startFileErrorWords('SVG0', 'a.svg'),
		startFileErrorWords('', 'a.txt'),
	];

	it('no banned word in a sentence or a button; names as quotes', () => {
		all.forEach((words) => {
			const html = wordHTML(words.key, words.vars, words.quotes);
			const outside = html.replace(/<span class="anyink-quote">[^<]*<\/span>/g, '');
			expect(findBanned(outside), html).toEqual([]);
			words.buttons.forEach((key) => expect(findBanned(word(key))).toEqual([]));
		});
	});

	it('the error box HTML: text escaped, names in .anyink-quote', () => {
		const html = wordHTML('error.saveFailed', { file: '<b>Hand</b>.gs2' }, ['file']);
		expect(html).toBe(
			'Couldn&#39;t save to <span class="anyink-quote">&lt;b&gt;Hand&lt;/b&gt;.gs2</span>. A backup copy is kept.'
		);
	});
});

// B4 + B5 finalize (verdict "Simple start page ... a real drawing gets an upstream error"): the
// start page's drop target reports every code upstream's file check gives: a font file it can't
// read (FF0, FF1) like a damaged SVG font, and a work file that won't open (PF0 to PF5) the way
// Ctrl+O says it.
describe("the start page's file check codes", () => {
	it('FF0 and FF1: a font file ANY-INK could not read', () => {
		['FF0', 'FF1'].forEach((code) =>
			expect(shown(startFileErrorWords(code, 'odd.otf'))).toBe(
				"ANY-INK couldn't read odd.otf as a font file. It may be damaged."
			)
		);
	});

	it('PF0 to PF5: a work file that will not open, as Ctrl+O says it', () => {
		expect(startFileErrorWords('PF1', 'Notes.gs2')).toEqual(openErrorWords('[PF1]', 'Notes.gs2'));
		expect(shown(startFileErrorWords('PF4', 'New.gs2'))).toBe(
			shown(openErrorWords('[PF4]', 'New.gs2'))
		);
	});
});
