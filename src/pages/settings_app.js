// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import {
	confirmForgetSnapshots,
	forgetSnapshotsWithFeedback,
} from '../anyink/recovery/recovery_ui.js';
import { settingRow, settingsSections } from '../anyink/mode/settings_rows.js';
import { updateWindowUnloadEvent } from '../app/app';
import { addAsChildren, makeElement, textToNode } from '../common/dom';
import { makeOneSettingsRow } from './settings';

/**
 * Makes the content for the Settings > App tab
 * @returns {Element}
 */
export function makeSettingsTabContentApp() {
	const tabContent = makeElement({
		tag: 'div',
		className: 'settings-page__tab-content settings-table',
		id: 'tab-content__app',
		innerHTML: `
			<h1>App preferences</h1>
			<p>These settings adjust how the ANY-INK App behaves.</p>
		`,
	});

	// ANY-INK (B5, UX-BEGINNER 6.2): only the rows the mode shows, and the headings over them
	addAsChildren(
		tabContent,
		settingsSections([
			textToNode('<h3>Saving</h3>'),
			makeOneSettingsRow('app', 'stopPageNavigation', updateWindowUnloadEvent),
			// ANY-INK (M6, audit A9 / A10): formatSaveFile, autoSave, saveLivePreviews and
			// "delete auto-saved backups" have no row. Project files always save compact JSON
			// with their live previews, and unsaved work is always snapshotted by crash
			// recovery (src/anyink/recovery). The project template keeps the three values so
			// older files still load.
			settingRow('app', 'forgetSnapshots', () => [
				textToNode('<label class="settings__label">Forget crash-recovery snapshots:</label>'),
				makeElement({
					tag: 'info-bubble',
					content: `ANY-INK keeps a rolling snapshot of unsaved work in this browser, so a crash or a closed tab loses nothing. Forgetting the snapshots removes every one on this computer; the project you are editing is snapshotted again on your next edit.`,
				}),
				makeElement({
					tag: 'fancy-button',
					attributes: { danger: '', style: 'height: 24px;' },
					innerHTML: 'Forget',
					onClick: async () => {
						if (!(await confirmForgetSnapshots())) return;
						// Toasts either way and never rejects (a failed clear says why).
						await forgetSnapshotsWithFeedback();
					},
				}),
				textToNode('<span></span>'),
			]),
			textToNode('<br>'),
			textToNode('<h3>Behavior</h3>'),
			makeOneSettingsRow('app', 'unlinkComponentInstances'),
			makeOneSettingsRow('app', 'directlyDragCurves'),
			textToNode('<br>'),
			textToNode('<h3>Visibility</h3>'),
			makeOneSettingsRow('app', 'canvasDisplayModeFilled'),
			makeOneSettingsRow('app', 'showNonCharPoints'),
			makeOneSettingsRow('app', 'itemChooserPageSize'),
			makeOneSettingsRow('app', 'previewText'),
			textToNode('<br>'),
			textToNode('<h3>Importing & exporting</h3>'),
			makeOneSettingsRow('app', 'exportLigatures'),
			makeOneSettingsRow('app', 'exportKerning'),
			makeOneSettingsRow('app', 'exportUneditedItems'),
			makeOneSettingsRow('app', 'moveShapesOnSVGDragDrop'),
			makeOneSettingsRow('app', 'autoSideBearingsOnSVGDragDrop'),
			makeOneSettingsRow('app', 'autoRightBearingOnFirstShape'),
			textToNode('<br>'),
			textToNode('<h3>Quality checks</h3>'),
			makeOneSettingsRow('app', 'highlightPointsNearPoints'),
			makeOneSettingsRow('app', 'highlightPointsNearHandles'),
			makeOneSettingsRow('app', 'highlightPointsNearXZero'),
			makeOneSettingsRow('app', 'highlightPointsNearYZero'),
		])
	);

	return tabContent;
}
