// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 (UX-BEGINNER.md 2.2, section 10 B4 "Carried from B1"): the font check's sentences, the
	strip line's buttons and counts, the Real font notice and the export toast's ", but ... needs
	fixing." come from src/anyink/words (check.*), with the same words B1 put on screen. The
	export toast shows the file name and folder as quotes (.anyink-quote), so the banned-word scan
	reads the toast's own words and lets the exact file name through.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAppTopBar } from '../../../app/menu.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi, fakeDirectoryHandle } from '../../files/tests/fakes.js';
import { FIX_IT as FIX_IT_LINE } from '../../preview/fix_it.js';
import { FIX_IT, SHOW_ME, buildFailureText, hintFor, moreText } from '../../preview/font_status.js';
import { kvClear } from '../../storage/kv.js';
import { findUppercase, scanDom } from '../../words/banned.js';
import { word } from '../../words/words.js';
import {
	SHOW_ME as SHOW_ME_TOAST,
	exportProblemsClause,
	exportProblemsMessage,
} from '../export_toast.js';
import { PROBLEM, validateItem } from '../validate.js';
import { kernSubject, validateKerning } from '../validate_kerning.js';
import { edgeProjectJSON, openProject, square, twoPointShape } from './fixtures.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

/** The edge project with these letters added. */
function openWith(glyphs = {}, change = (json) => json) {
	const json = edgeProjectJSON();
	Object.assign(json.glyphs, glyphs);
	return openProject(change(json));
}

const one = { letter: 'small a', n: 1 };
const messageOf = (project, id) => validateItem(project.getItem(id))[0]?.message;

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

describe('font check sentences (validate.js)', () => {
	it('ink with no width', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] },
		});
		expect(messageOf(project, 'glyph-0x61')).toBe(word('check.inkNoWidth', one));
	});

	it('a width the font file cannot hold, too wide, or below zero', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 70000, shapes: [square()] },
			'glyph-0x62': { id: 'glyph-0x62', advanceWidth: -20, shapes: [square()] },
		});
		expect(messageOf(project, 'glyph-0x61')).toBe(word('check.tooWide', one));
		expect(messageOf(project, 'glyph-0x62')).toBe(
			word('check.widthBelowZero', { letter: 'small b', n: 1 })
		);
		// A width that isn't a number (a Glyph turns NaN into 0, so a plain record says it)
		const item = { id: 'glyph-0x61', chars: 'a', advanceWidth: Number.NaN, shapes: [] };
		expect(validateItem(item)[0].message).toBe(word('check.widthBad', one));
	});

	it('the space with no width', () => {
		const { project } = openWith({
			'glyph-0x20': { id: 'glyph-0x20', advanceWidth: 0, shapes: [] },
		});
		expect(messageOf(project, 'glyph-0x20')).toBe(
			word('check.spaceNoWidth', { letter: 'The space', n: 1 })
		);
	});

	it('a point too far out', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 500, shapes: [square(100, 0, 40000)] },
		});
		expect(messageOf(project, 'glyph-0x61')).toBe(word('check.pointFar', one));
	});

	it('stray shapes, one and many', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 500, shapes: [square(), twoPointShape()] },
			'glyph-0x62': {
				id: 'glyph-0x62',
				advanceWidth: 500,
				shapes: [twoPointShape(), twoPointShape(9)],
			},
		});
		expect(messageOf(project, 'glyph-0x61')).toBe(
			word('check.strayShape', { ...one, count: 2, min: 3 })
		);
		expect(messageOf(project, 'glyph-0x62')).toBe(
			word('check.strayShapes', { letter: 'small b', n: 1, count: 2, min: 3 })
		);
	});

	it('joined letters take the plural verbs', () => {
		const { project } = openWith({}, (json) => {
			json.ligatures['liga-0x66-0x69'].advanceWidth = 0;
			return json;
		});
		const message = messageOf(project, 'liga-0x66-0x69');
		expect(message).toBe(word('check.inkNoWidth', { letter: 'The joined letters fi', n: 2 }));
		expect(message).toBe(
			'The joined letters fi have ink but no width, so the next letter would sit on top of them.'
		);
	});
});

describe('gap sentences (validate_kerning.js)', () => {
	it('names the gap and says it is moved too far', () => {
		const { project } = openWith({}, (json) => {
			json.kerning['kern-0'].value = 40000;
			return json;
		});
		const gap = word('check.gapBetween', { left: 'Capital A', right: 'Capital B' });
		expect(kernSubject(project, 'kern-0')).toBe(gap);
		const letters = Object.keys(project.glyphs).map((id) => id.replace('glyph-', ''));
		expect(validateKerning(project, letters)[0].message).toBe(
			word('check.gapTooFar', { gap: 'The gap between Capital A and Capital B' })
		);
	});
});

describe('the strip line and the Real font notice (preview/font_status.js)', () => {
	it('buttons', () => {
		expect(SHOW_ME).toBe(word('check.showMe'));
		expect(FIX_IT).toBe(word('check.fixIt'));
		expect(FIX_IT_LINE).toBe(FIX_IT);
		expect(SHOW_ME_TOAST).toBe(SHOW_ME);
	});

	it('counts', () => {
		expect(moreText(1)).toBe(
			word('check.needFixingToo', { list: word('check.moreLetters', { count: 1 }), count: 1 })
		);
		expect(moreText(2, 1)).toBe(
			word('check.needFixingToo', {
				list: word('check.andList', {
					names: word('check.moreLetters', { count: 2 }),
					last: word('check.gaps', { count: 1 }),
				}),
				count: 3,
			})
		);
		expect(moreText(1, 2, true)).toBe('1 letter and 2 more gaps need fixing too.');
	});

	it("Can't show your font yet", () => {
		expect(buildFailureText({ name: 'small a' })).toBe(
			word('check.cantShow', { list: 'small a', count: 1 })
		);
		expect(buildFailureText({ name: 'the joined letters ff', plural: true })).toBe(
			word('check.cantShow', { list: 'the joined letters ff', count: 2 })
		);
		expect(buildFailureText(null)).toBe(word('check.cantShowUnknown'));
	});

	it('what to do when Fix it cannot fix it', () => {
		expect(hintFor(PROBLEM.point, false)).toBe(word('check.hintPoint'));
		expect(hintFor(PROBLEM.kern, false)).toBe(word('check.hintGap'));
		expect(hintFor(PROBLEM.shape, false)).toBe(word('check.hintShape'));
		expect(hintFor(PROBLEM.shape, true)).toBe('');
	});
});

describe('the export toast (export_toast.js)', () => {
	it('names the letters with the words keys', () => {
		const { project } = openWith();
		const problem = (itemId) => ({ itemId, problem: PROBLEM.inkNoWidth, message: 'x' });
		expect(exportProblemsClause([problem('glyph-0x61')], project)).toBe(
			word('check.needsFixing', { list: 'small a', count: 1 })
		);
		expect(exportProblemsMessage([problem('glyph-0x61')], project)).toBe(
			word('check.butNeedsFixing', {
				where: word('check.madeAnyway'),
				clause: word('check.needsFixing', { list: 'small a', count: 1 }),
			})
		);
	});

	it('shows the file name and the folder as quotes, and says no banned word around them', async () => {
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
		openProject(json);
		setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('Fonts') }));
		const topBar = makeAppTopBar();
		document.body.appendChild(topBar);
		[...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
		document
			.querySelector('#context-menu [data-anyink-row="font-otf"]')
			.closest('.context-menu-row')
			.click();
		const text = () => document.querySelector('#toast .anyink-export-check__text');
		const end = Date.now() + 12000;
		while (!text() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
		expect(text().textContent).toBe(
			'Exported CheckEdge-Regular.otf to Fonts, but small a needs fixing.'
		);
		const quotes = [...text().querySelectorAll('.anyink-quote')].map((q) => q.textContent);
		expect(quotes).toEqual(['CheckEdge-Regular.otf', 'Fonts']);
		const toast = document.querySelector('#toast');
		expect([...scanDom(toast), ...findUppercase(toast)]).toEqual([]);
	}, 15000);
});
