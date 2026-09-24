// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getCurrentProjectEditor } from '../app/main.js';
import { addAsChildren, makeElement } from '../common/dom.js';
import { makeFancySlider } from '../controls/fancy-slider/fancy_slider.js';
import settingsData from '../pages/settings_data.js';
import { enabledQualityChecks, runQualityChecksForItem } from '../project_editor/quality_checks.js';
import { refreshPanel } from './panels.js';

// --------------------------------------------------------------
// Quality Checks panel
// --------------------------------------------------------------

export function makePanel_QualityChecks() {
	// log(`makePanel_QualityChecks`, 'start');

	// log(`makePanel_QualityChecks`, 'end');
	return [makeCard_PointsAndHandles()];
}

function makeCard_PointsAndHandles() {
	// log(`makeCard_PointsAndHandles`, 'start');
	// log(`\n⮟enabledQualityChecks⮟`);
	// log(enabledQualityChecks);

	const editor = getCurrentProjectEditor();
	let card = makeElement({
		className: 'panel__card quality-check__points-and-handles',
		content: `
			<h3>Points and handles</h3>
			<p class="spanAll" style="margin-bottom: 10px;">
				These quality checks help identify small data errors that may be a result of importing from SVG.
			</p>
			`,
	});

	const checks = [
		'highlightPointsNearPoints',
		'highlightPointsNearHandles',
		'highlightPointsNearXZero',
		'highlightPointsNearYZero',
	];

	checks.forEach((checkName) => {
		const checkbox = makeElement({
			tag: 'input',
			attributes: {
				type: 'checkbox',
			},
			id: `checkbox-for-${checkName}`,
		});

		checkbox.addEventListener('change', (e) => {
			// @ts-expect-error 'property does exist'
			enabledQualityChecks[checkName] = e.target.checked;
			editor.publish('qualityChecks', 'update');
		});

		const label = makeElement({
			tag: 'label',
			attributes: {
				for: `checkbox-for-${checkName}`,
			},
			content: settingsData.app[checkName].label,
		});

		// Threshold slider: same range as the Settings > App row for this check.
		// The value is written when the drag ends ('change'), which also
		// refreshes this panel, so writing on every 'input' tick would tear
		// the slider out from under the pointer.
		const check = settingsData.app[checkName];
		const min = check.min ?? 0;
		const max = check.max ?? 20;
		const step = check.step ?? 1;
		const currentValue = parseInt(editor.project.settings.app[checkName]);
		const slider = makeFancySlider(isNaN(currentValue) ? min : currentValue, false, min, max, step);
		const bar = slider.querySelector('.fancy-slider__bar');

		bar.addEventListener('change', (event) => {
			// @ts-expect-error 'property does exist'
			const newValue = parseInt(event.target.value);
			if (isNaN(newValue)) return;
			editor.project.settings.app[checkName] = newValue;
			runQualityChecksForItem(editor.selectedItem);
			editor.publish('qualityChecks', 'update');
		});

		if (enabledQualityChecks[checkName]) {
			checkbox.setAttribute('checked', '');
		} else {
			bar.setAttribute('disabled', '');
			label.setAttribute('disabled', '');
		}

		addAsChildren(card, [checkbox, label, slider]);
	});

	// Overall, watch for changes:
	editor.subscribe({
		topic: ['currentPath', 'currentItem', 'qualityChecks'],
		subscriberID: 'qualityChecksPanel',
		callback: () => {
			refreshPanel();
		},
	});

	// log(`makeCard_PointsAndHandles`, 'end');
	return card;
}
