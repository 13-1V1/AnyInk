// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { getGlyphrStudioApp, setCurrentProjectEditor } from '../../main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { updateOverwriteSettingsTable } from '../action_overwrite_settings.js';
import { makePage_CrossProjectActions } from '../cross_project_actions.js';

function editorFor(id, name) {
	return new ProjectEditor({
		project: new GlyphrStudioProject({ settings: { project: { id, name } } }),
	});
}

describe('Cross-project actions: Overwrite settings', () => {
	// Finding 9: autoSave, saveLivePreviews and formatSaveFile do nothing in ANY-INK.
	it('does not offer the dead autoSave, saveLivePreviews and formatSaveFile settings', () => {
		const app = getGlyphrStudioApp();
		const source = editorFor('g2_SOURCE', 'Source');
		const destination = editorFor('g2_DESTINATION', 'Destination');
		app.projectEditors = [source, destination];
		setCurrentProjectEditor(destination);
		makePage_CrossProjectActions(); // picks source = the other editor, destination = current

		const table = document.createElement('div');
		updateOverwriteSettingsTable(table);
		const rows = [...table.querySelectorAll('input.item-select-checkbox[item-id]')].map((input) =>
			input.getAttribute('item-id')
		);
		expect(rows).toContain('project.name');
		expect(rows).toContain('app.stopPageNavigation');
		expect(rows).toContain('font.family');
		expect(rows).not.toContain('app.autoSave');
		expect(rows).not.toContain('app.saveLivePreviews');
		expect(rows).not.toContain('app.formatSaveFile');
	});
});
