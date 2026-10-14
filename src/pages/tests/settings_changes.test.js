// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 fix pass: every write on the Settings page marks the font changed (autosave, backup copy and
// the "Leave site?" prompt all depend on it). The rows are covered in app/tests/leave_warning.test.js;
// these are the other writers: the PANOSE builder and the character range actions.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSaveStatus } from '../../anyink/files/save_status.js';
import { getGlyphrStudioApp } from '../../app/main.js';
import { closeEveryTypeOfDialog } from '../../controls/dialogs/dialogs.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import { makeSettingsTabContentFont } from '../settings_font.js';
import { addCharacterRangeToCurrentProject, makeSettingsTabContentProject } from '../settings_project.js';

// jsdom has no Web Animations; the dialogs fade out with element.animate.
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const workFile = { kind: 'file', name: 'Brennan Hand.gs2', getFile: async () => ({}), createWritable: async () => ({}) };

let app, saved, editor;
beforeEach(() => {
	app = getGlyphrStudioApp();
	saved = { editors: app.projectEditors, selected: app._selectedProjectEditor };
	editor = new ProjectEditor();
	editor.loadedFileHandle = workFile; // a saved work file, as reopening one leaves it
	editor.project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Settings test',
				id: `settings-${Math.random()}`,
				characterRanges: [
					{ name: 'Basic Latin', begin: 0x20, end: 0x7f, enabled: true },
					{ name: 'Latin-1 Supplement', begin: 0x80, end: 0xff, enabled: true },
				],
			},
		},
	});
	app.projectEditors = [editor];
	app._selectedProjectEditor = editor;
	document.body.innerHTML = '';
	expect(getSaveStatus(editor).file).toBe('saved');
});
afterEach(() => {
	closeEveryTypeOfDialog();
	app.projectEditors = saved.editors;
	app._selectedProjectEditor = saved.selected;
	document.body.innerHTML = '';
});

const click = (element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('Settings writes outside the rows', () => {
	it('saving a new PANOSE value marks the font changed', () => {
		document.body.append(makeSettingsTabContentFont());
		click([...document.querySelectorAll('fancy-button')].find((b) => b.textContent.includes('Edit PANOSE')));
		const before = editor.project.settings.font.panose;
		click(document.querySelectorAll('#panose-0-chooser option')[2]); // Family Kind: the third choice
		click(document.querySelector('#panose-builder__save-button'));
		expect(editor.project.settings.font.panose).not.toBe(before);
		expect(getSaveStatus(editor).file).toBe('pending');
	});

	it('saving PANOSE unchanged changes nothing', () => {
		document.body.append(makeSettingsTabContentFont());
		click([...document.querySelectorAll('fancy-button')].find((b) => b.textContent.includes('Edit PANOSE')));
		click(document.querySelector('#panose-builder__save-button'));
		expect(getSaveStatus(editor).file).toBe('saved');
	});

	it('hiding a character range marks the font changed', () => {
		document.body.append(makeSettingsTabContentProject());
		expect(getSaveStatus(editor).file).toBe('saved'); // showing the tab is not a change
		click([...document.querySelectorAll('#enabled-range-table__wrapper a')].find((a) => a.textContent === 'Hide'));
		expect(editor.project.settings.project.characterRanges.filter((range) => !range.enabled)).toHaveLength(1);
		expect(getSaveStatus(editor).file).toBe('pending');
	});

	it('showing a hidden character range again marks the font changed', () => {
		editor.project.settings.project.characterRanges[1].enabled = false;
		document.body.append(makeSettingsTabContentProject());
		click([...document.querySelectorAll('#hidden-range-table__wrapper a')].find((a) => a.textContent === 'Show'));
		expect(editor.project.settings.project.characterRanges.every((range) => range.enabled)).toBe(true);
		expect(getSaveStatus(editor).file).toBe('pending');
	});

	it('adding a character range marks the font changed', () => {
		addCharacterRangeToCurrentProject({ name: 'Latin Extended-A', begin: 0x100, end: 0x17f }, false, false);
		expect(getSaveStatus(editor).file).toBe('pending');
	});

	it('adding a range that is already there and on changes nothing', () => {
		addCharacterRangeToCurrentProject({ name: 'Basic Latin', begin: 0x20, end: 0x7f }, false, false);
		expect(getSaveStatus(editor).file).toBe('saved');
	});
});
