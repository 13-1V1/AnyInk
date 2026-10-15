// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 (UX-BEGINNER.md 4.9 Menu, principle 8): Simple's one Menu, in four groups (File, Font, View,
// Help). A row shows only when visibility.js says its feature has landed, so no row is a door to
// an unbuilt room. Until B14 and B15 land, two rows Simple had in its File and Help menus stay
// (Make a font file (.otf) with Ctrl+E and its folder; the Help page), or the Menu would take
// them away; each goes the moment the row that replaces it shows.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCanvasTheme, setCanvasTheme } from '../../theme/theme.js';
import { getPref, resetPrefsCache, setPref } from '../../prefs/prefs.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { USE_IN_WORD_EVENT } from '../../mode/doors.js';
import { getMode, setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { HELP_EVENT } from '../doors.js';
import { setInstallEventForTests } from '../install_offer.js';
import { menuRows, openSimpleMenu } from '../simple_menu.js';

const rowIds = (rows) =>
	rows.map((row) => {
		if (row.name === 'hr') return '---';
		if (row.child) return `# ${row.child.textContent}`;
		return /data-anyink-row="([\w-]+)"/.exec(row.name)?.[1] || '?';
	});

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	localStorage.clear();
	resetPrefsCache();
	resetToastsForTests();
	setInstallEventForTests(null);
	document.body.innerHTML = '';
	setModeForTests('simple');
	setFeaturesForTests({ coach: true });
});
afterEach(() => {
	resetToastsForTests();
	setInstallEventForTests(null);
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('the rows that show', () => {
	it('with only the top bar landed: File, View and Help, and the two rows Simple keeps until B14 / B15', () => {
		const editor = twoLetterEditor();
		expect(rowIds(menuRows(editor))).toEqual([
			'# File',
			'save',
			'save-as',
			'open-font',
			'font-otf',
			'font-folder',
			'---',
			'# View',
			'dark-paper',
			'more-tools',
			'---',
			'# Help',
			'help-page',
			'tips-again',
			'about',
		]);
	});

	it('each later B brings its rows, and the stand-in goes', () => {
		const editor = twoLetterEditor();
		setFeaturesForTests({
			startScreen: true,
			useInWord: true,
			fontDetails: true,
			help: true,
			photo: true,
		});
		expect(rowIds(menuRows(editor))).toEqual([
			'# File',
			'save',
			'save-as',
			'open-font',
			'new-font',
			'make-font-file',
			'---',
			'# Font',
			'font-details',
			'move-guide-lines',
			'---',
			'# View',
			'dark-paper',
			'more-tools',
			'---',
			'# Help',
			'help-how',
			'help-photo',
			'help-words',
			'help-word',
			'help-keys',
			'tips-again',
			'about',
		]);
	});

	it('Install shows only when Chrome offers it and ANY-INK is not installed yet', () => {
		const editor = twoLetterEditor();
		expect(rowIds(menuRows(editor))).not.toContain('install');
		const offer = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) };
		setInstallEventForTests(offer);
		const rows = menuRows(editor);
		expect(rowIds(rows)).toContain('install');
		rows.find((row) => /"install"/.test(row.name)).onClick();
		expect(offer.prompt).toHaveBeenCalledTimes(1);
	});

	it('keys show beside the rows that have them (Save Ctrl+S, Open Ctrl+O, the font file Ctrl+E)', () => {
		const notes = Object.fromEntries(
			menuRows(twoLetterEditor())
				.filter((row) => row.note)
				.map((row) => [/data-anyink-row="([\w-]+)"/.exec(row.name)[1], row.note])
		);
		expect(notes.save).toEqual(['Ctrl', 's']);
		expect(notes['open-font']).toEqual(['Ctrl', 'o']);
		expect(notes['font-otf']).toEqual(['Ctrl', 'e']);
	});
});

describe('what the rows do', () => {
	const run = (editor, id) =>
		menuRows(editor)
			.find((row) => new RegExp(`data-anyink-row="${id}"`).test(row.name || ''))
			.onClick();

	it('Save and Save as... save the work file', () => {
		const editor = twoLetterEditor();
		const save = vi.spyOn(editor, 'saveProjectFile').mockResolvedValue(true);
		run(editor, 'save');
		expect(save).toHaveBeenLastCalledWith();
		run(editor, 'save-as');
		expect(save).toHaveBeenLastCalledWith(true);
	});

	it('Dark paper switches the paper, and the row says whether it is on', () => {
		const editor = twoLetterEditor();
		setCanvasTheme('light', { remember: false });
		const darkRow = () => menuRows(editor).find((row) => /"dark-paper"/.test(row.name));
		expect(darkRow().note).toBe('Off');
		darkRow().onClick();
		expect(getCanvasTheme()).toBe('dark');
		expect(darkRow().note).toBe('On');
		darkRow().onClick();
		expect(getCanvasTheme()).toBe('light');
	});

	it('More tools turns on All tools', () => {
		const editor = twoLetterEditor();
		editor.navigate = vi.fn();
		run(editor, 'more-tools');
		expect(getMode()).toBe('all');
	});

	it('Help (until B15) opens the Help page; About opens About', () => {
		const editor = twoLetterEditor();
		editor.navigate = vi.fn();
		run(editor, 'help-page');
		expect(editor.nav.page).toBe('Help');
		run(editor, 'about');
		expect(editor.nav.page).toBe('About');
		expect(editor.navigate).toHaveBeenCalledTimes(2);
	});

	it('Show tips again: the coach forgets the tips seen, and the toast says so', () => {
		const editor = twoLetterEditor();
		setPref('tipsSeen', ['brush', 'photo']);
		run(editor, 'tips-again');
		expect(getPref('tipsSeen')).toEqual([]);
		expect(
			document.querySelector('#toast[data-anyink-toast="simple"] .anyink-toast__text').textContent
		).toBe('Tips will show again as you work');
	});

	it('the later rows open their screens through doors (Use in Word, Help sections)', () => {
		setFeaturesForTests({ useInWord: true, help: true });
		const editor = twoLetterEditor();
		const word = vi.fn();
		const help = vi.fn();
		window.addEventListener(USE_IN_WORD_EVENT, word);
		window.addEventListener(HELP_EVENT, help);
		run(editor, 'make-font-file');
		run(editor, 'help-keys');
		window.removeEventListener(USE_IN_WORD_EVENT, word);
		window.removeEventListener(HELP_EVENT, help);
		expect(word.mock.calls[0][0].detail).toEqual({ cause: 'menu' });
		expect(help.mock.calls[0][0].detail).toEqual({ section: 'keys' });
	});
});

describe('the menu on screen', () => {
	it('opens under the Menu button, marked simple, with the rows as data-anyink-row', () => {
		const editor = twoLetterEditor();
		const button = document.createElement('button');
		document.body.appendChild(button);
		const menu = openSimpleMenu(button, editor);
		expect(menu.id).toBe('context-menu');
		expect(menu.dataset.anyinkMenu).toBe('simple');
		expect(button.getAttribute('aria-expanded')).toBe('true');
		expect(menu.querySelector('[data-anyink-row="save"]').textContent).toBe('Save');
		expect(menu.querySelector('[data-anyink-row="about"]').textContent).toBe('About ANY-INK');
	});
});
