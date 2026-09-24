// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { makeMetricSettingsInput } from '../anyink/metrics/readouts.js';
import { isFontMetricKey } from '../anyink/metrics/metrics_math.js';
import { getCurrentProject, getCurrentProjectEditor } from '../app/main.js';
import { addAsChildren, makeElement, textToNode } from '../common/dom.js';
import { showToast } from '../controls/dialogs/dialogs.js';
import { makeFancySlider } from '../controls/fancy-slider/fancy_slider.js';
import { TabControl } from '../controls/tabs/tab_control.js';
import { makeDirectCheckbox } from '../panels/cards.js';
import { makeNavButton, toggleNavDropdown } from '../project_editor/navigator.js';
import { makeSettingsTabContentApp } from './settings_app.js';
import settingsMap from './settings_data.js';
import { makeSettingsTabContentFont } from './settings_font.js';
import { makeSettingsTabContentProject } from './settings_project.js';

/**
 * Page > Settings
 * One place to edit all the settings for Glyphr Studio.
 * @returns {Element} - page content
 */
export function makePage_Settings() {
	const content = makeElement({
		tag: 'div',
		id: 'app__page',
		innerHTML: `
		<div class="content__page">
			<div class="content-page__left-area">
				<div class="content-page__nav-area">
					${makeNavButton({ level: 'l1', superTitle: 'PAGE', title: 'Settings' })}
				</div>
				<div id="content-page__panel">
				</div>
			</div>
			<div class="content-page__right-area">
			</div>
		</div>
		`,
	});

	let panelArea = content.querySelector('#content-page__panel');
	let rightArea = content.querySelector('.content-page__right-area');

	const tabControl = new TabControl(rightArea);

	tabControl.registerTab('Project', makeSettingsTabContentProject);
	tabControl.registerTab('Font', makeSettingsTabContentFont);
	tabControl.registerTab('App', makeSettingsTabContentApp);

	addAsChildren(panelArea, tabControl.makeTabs());
	tabControl.selectTab('Project');

	// Page Selector
	let l1 = content.querySelector('#nav-button-l1');
	l1.addEventListener('click', function () {
		toggleNavDropdown(l1);
	});

	return content;
}

// --------------------------------------------------------------
// Individual settings
// --------------------------------------------------------------
/**
 * Makes the label and info-bubble for one settings row. Shared by
 * makeOneSettingsRow and by rows that need a custom input (like PANOSE).
 * @param {String} groupName - section
 * @param {String} propertyName - property
 * @param {Boolean =} inputFirst - true when the input comes before the label
 * @returns {Array} - [label, info]
 */
export function makeSettingsLabelAndInfo(groupName, propertyName, inputFirst = false) {
	const thisSetting = settingsMap[groupName][propertyName];

	let displayLabel = thisSetting.label;
	displayLabel = displayLabel.replaceAll(' ', '&nbsp;');
	displayLabel = displayLabel.replaceAll('-', '&#8209;');
	displayLabel = `${displayLabel}${inputFirst ? '' : ':&emsp;'}`;

	const label = makeElement({
		tag: 'label',
		className: 'settings__label',
		innerHTML: displayLabel,
	});

	let info;
	if (thisSetting?.description) {
		info = makeElement({
			tag: 'info-bubble',
			innerHTML: thisSetting?.description || `${groupName}.${propertyName}`,
		});

		if (thisSetting?.example) {
			info.innerHTML += `
			<h4>Example</h4>
			${thisSetting.example}
			`;
		}
	} else {
		info = textToNode('<span></span>');
	}

	return [label, info];
}

/**
 * Centralized way to make one row in a settings table.
 * @param {String} groupName - section
 * @param {String} propertyName - property
 * @param {Function =} callback - called after a change
 * @param {Boolean =} inputFirst - switch the order of the label / input
 * @returns {Array}
 */
export function makeOneSettingsRow(groupName, propertyName, callback, inputFirst = false) {
	// log(`makeOneSettingsRow`, 'start');
	// log(`groupName: ${groupName}`);
	// log(`propertyName: ${propertyName}`);
	const settings = getCurrentProject().settings;
	const thisSetting = settingsMap[groupName][propertyName];
	const settingType = thisSetting?.type;
	const settingValue = settings[groupName][propertyName];
	// log(`thisSetting: ${thisSetting}`);
	// log(`settingValue: ${settingValue}`);

	const [label, info] = makeSettingsLabelAndInfo(groupName, propertyName, inputFirst);

	let type = textToNode('<span></span>');
	let input;

	if (groupName === 'font' && settingType === 'Em' && isFontMetricKey(propertyName)) {
		// ANY-INK (audit A1): vertical metrics are dragged on the canvas; this field is a
		// secondary readout. Writes go through setFontMetric (clamped, published, undoable)
		// and the field follows canvas drags through the 'fontMetrics' topic.
		input = makeMetricSettingsInput(propertyName);
		if (callback) input.addEventListener('change', () => callback());
	} else if (settingType === 'Degree' || settingType === 'Em' || settingType === 'Number') {
		input = makeElement({
			tag: 'input-number',
			attributes: { value: parseInt(settingValue) },
		});

		input.addEventListener('change', (event) => {
			// @ts-expect-error 'property does exist'
			let newValue = parseInt(event.target.value);
			if (isNaN(newValue)) {
				showToast(`Could not save value - needs to be a number.`);
			} else {
				settings[groupName][propertyName] = newValue;
			}
			if (callback) callback();
		});
	}

	if (settingType === 'Slider') {
		// Range input with a live readout. The value is written once the drag
		// ends ('change' on the range input), not on every 'input' tick.
		const min = thisSetting.min ?? 0;
		const max = thisSetting.max ?? 100;
		const step = thisSetting.step ?? 1;
		const currentValue = parseInt(settingValue);
		input = makeFancySlider(isNaN(currentValue) ? min : currentValue, false, min, max, step);

		const bar = input.querySelector('.fancy-slider__bar');
		bar.addEventListener('change', (event) => {
			// @ts-expect-error 'property does exist'
			let newValue = parseInt(event.target.value);
			if (isNaN(newValue)) {
				showToast(`Could not save value - needs to be a number.`);
			} else {
				settings[groupName][propertyName] = newValue;
			}
			if (callback) callback();
		});
	}

	if (settingType === 'Options') {
		// Fixed list of keywords, picked from an option-chooser dropdown.
		const currentValue = String(settingValue ?? '');
		input = makeElement({
			tag: 'option-chooser',
			attributes: { 'selected-id': currentValue, 'selected-name': currentValue },
		});

		(thisSetting.options || []).forEach((optionValue) => {
			input.appendChild(
				makeElement({
					tag: 'option',
					attributes: { 'selection-id': optionValue },
					innerHTML: optionValue,
				})
			);
		});

		// option-chooser dispatches 'change' whenever selected-id is set
		input.addEventListener('change', () => {
			const newValue = input.getAttribute('selected-id');
			if (newValue) settings[groupName][propertyName] = newValue;
			if (callback) callback();
		});
	}

	if (!settingType) {
		input = makeElement({
			tag: 'input',
			attributes: { type: 'text', value: sanitizeValueWithJSON(settingValue) },
		});

		input.addEventListener('change', (event) => {
			// @ts-expect-error 'property does exist'
			let newValue = sanitizeValueWithJSON(event.target.value);
			settings[groupName][propertyName] = newValue;
			if (callback) callback();
		});
	}

	if (settingType === 'Boolean') {
		input = makeDirectCheckbox(settings[groupName], propertyName, callback);
		if (propertyName === 'showNonCharPoints') {
			input.addEventListener('change', () => {
				const project = getCurrentProject();
				// log(`Clearing all Character Range Caches`);
				// log(`\n⮟project.settings.project.characterRanges⮟`);
				// log(project.settings.project.characterRanges);
				project.settings.project.characterRanges.forEach((range) => {
					range.cachedArray = false;
				});
				getCurrentProjectEditor().selectedCharacterRange.cachedArray = false;
			});
		}
	} else {
		type = makeElement({
			tag: 'pre',
			innerHTML: makeValueTypeText(thisSetting),
			title: `Expected value type`,
			className: 'value-type',
		});
	}

	if (settingType === 'Read only') {
		input = makeElement({
			innerHTML: settingValue,
			className: 'settings_read-only-value',
		});
	}

	input.setAttribute('id', `settings-page-input__${groupName}-${propertyName}`);

	// log(`makeOneSettingsRow`, 'end');
	if (inputFirst) return [input, label, info, type];
	else return [label, info, input, type];
}

/**
 * Text for the small "expected value type" chip next to a setting.
 * Sliders show the unit of the number they set, not the control type.
 * @param {Object} thisSetting - entry from settings_data
 * @returns {String}
 */
function makeValueTypeText(thisSetting) {
	const settingType = thisSetting?.type;
	if (settingType === 'Slider') return thisSetting.units || 'Number';
	return settingType || 'Text';
}

/**
 * Use JSON stringify / parse to sanitize input.
 * @param {String} input - input from a form field
 * @returns {String}
 */
function sanitizeValueWithJSON(input) {
	let j = JSON.stringify(input);

	if (j) {
		let p = JSON.parse(j);
		return p || '';
	}

	return '';
}
