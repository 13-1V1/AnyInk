// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 fix pass (UX-BEGINNER principle 6): Projects > "Cross-project actions" was greyed out with no
// reason. A greyed-out row now says why, next to it, in the menu's readable greyed-out color.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeEveryTypeOfDialog } from '../../controls/dialogs/dialogs.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import { getGlyphrStudioApp } from '../main.js';
import { makeAppTopBar } from '../menu.js';

// jsdom has no Web Animations; menus fade out with element.animate.
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const editorNamed = (name) => {
	const editor = new ProjectEditor();
	editor.project = new GlyphrStudioProject({ settings: { project: { name, id: `menu-${name}` } } });
	return editor;
};

let app, saved;
beforeEach(() => {
	app = getGlyphrStudioApp();
	saved = { editors: app.projectEditors, selected: app._selectedProjectEditor };
	document.body.innerHTML = '';
});
afterEach(() => {
	closeEveryTypeOfDialog();
	app.projectEditors = saved.editors;
	app._selectedProjectEditor = saved.selected;
	document.body.innerHTML = '';
});

function openProjectsMenu(...editors) {
	app.projectEditors = editors;
	app._selectedProjectEditor = editors[0];
	const topBar = makeAppTopBar();
	document.body.append(topBar);
	[...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'Projects').click();
	const row = [...document.querySelectorAll('#context-menu .context-menu-row')].find((r) =>
		r.querySelector('.row-name')?.textContent.includes('Cross-project actions')
	);
	return { row, reason: row?.querySelector('.row-notes span')?.textContent.trim() };
}

describe('Projects menu: the card that opens another font', () => {
	it('says font, not project', () => {
		openProjectsMenu(editorNamed('Brennan Hand'));
		const card = document.querySelector('.project-preview__no-project h3');
		expect(card.textContent).toBe('Open another font');
	});
});

describe('Projects menu: Cross-project actions', () => {
	it('with one font open it is greyed out and says why', () => {
		const { row, reason } = openProjectsMenu(editorNamed('Brennan Hand'));
		expect(row.hasAttribute('disabled')).toBe(true);
		// B1 fix pass: house words (UX-BEGINNER 2.2): what he opens is a font
		expect(reason).toBe('Open another font first');
	});

	it('with two fonts open it works and needs no reason', () => {
		const { row, reason } = openProjectsMenu(editorNamed('Brennan Hand'), editorNamed('Brennan Script'));
		expect(row.hasAttribute('disabled')).toBe(false);
		expect(reason).toBe('');
	});
});
