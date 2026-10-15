// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 fix pass: the words the critic findings need, in sets/ (the words track owns them; the
	page, files, import and history tracks put them on screen in Simple).
	- "Simple start page tells him to drop 'A drawing (.svg)', but the Load tab only takes SVG font
	  files": the line names a font file (2.4 E: an SVG font is a font file; a plain drawing goes
	  on a letter).
	- Every key another track was handed exists and says no banned or never-shown word (strict),
	  so a typo in a key fails here and never on a screen.
*/
import { describe, expect, it } from 'vitest';
import { findBanned } from '../banned.js';
import { hasWord, word, wordEntry } from '../words.js';

describe("the start page's .svg line", () => {
	it('names a font file, not a drawing', () => {
		expect(word('start.dropDrawing')).toMatch(/font file/);
		expect(word('start.dropDrawing')).not.toBe('A drawing');
		expect(wordEntry('start.dropDrawing').hint).toMatch(/drawing goes on a letter/);
	});
});

/** The keys handed to other tracks in the fix pass (see the words track's report). */
const HANDED_OVER = [
	// files track: the error box (7.7)
	'error.boxTitle',
	'error.saveFailed',
	'error.changedElsewhere',
	'error.notWorkFile',
	'error.newerWorkFile',
	'error.didntFinish',
	'error.button.tryAgain',
	'error.button.saveElsewhere',
	'error.button.saveAsNew',
	'error.button.openAnother',
	'error.button.close',
	// export track: the folder and the font file (7.7)
	'error.noFolderPicked',
	'error.folderNotWritable',
	'error.fontFileFailed',
	'error.button.pickFolder',
	'error.button.pickDifferentFolder',
	'menu.pickFolderFirst',
	'menu.fontFileNextStep',
	'menu.fontFolder',
	// pages track: the start page, Help, About, the letter-set switch
	'start.newFontTitle',
	'start.fontName',
	'start.createFont',
	'start.openWorkFile',
	'start.openFontFile',
	'start.examplesTitle',
	'start.exampleSimpleButton',
	'start.exampleObleggButton',
	'start.recentOpen',
	'start.recentForgetAll',
	'start.recentRemove',
	'file.workFileType',
	'error.drawingNotFont',
	'error.fontFileUnreadable',
	'error.unsupportedFile',
	'help.howPick',
	'help.howDraw',
	'help.toolKey',
	'help.howUndo',
	'help.howSave',
	'help.howFontFile',
	'help.fullManual',
	'about.builtOn',
	'about.library',
	'mode.band.backToLetters',
	'set.basic',
	'set.accented',
	'set.moreAccented',
	'set.punctuation',
	'set.like',
	// import track: the progress on the start page
	'start.importing',
	'start.importReading',
	// history track: an undo on a page that isn't the letter
	'undo.undid',
	'undo.undidOn',
	'undo.redid',
	'undo.redidOn',
	'undo.goToLetter',
];

describe('the keys handed to other tracks', () => {
	it('all exist', () => {
		expect(HANDED_OVER.filter((key) => !hasWord(key))).toEqual([]);
	});

	it("say no banned word and nothing 2.4 E and G never show (a quote entry's text is exempt)", () => {
		const hits = HANDED_OVER.flatMap((key) => {
			const { text, hint, quote } = wordEntry(key);
			return [quote ? '' : text, hint].flatMap((value) =>
				findBanned(value, { strict: true }).map((hit) => `${key}: ${hit.match}`)
			);
		});
		expect(hits).toEqual([]);
	});

	it('Simple Help and the start page name the work file and the font, never "project"', () => {
		['start.newFontTitle', 'start.fontName', 'start.openWorkFile', 'file.workFileType'].forEach(
			(key) => expect(word(key)).toMatch(/font|work file/i)
		);
	});
});
