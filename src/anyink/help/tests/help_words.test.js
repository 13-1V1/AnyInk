// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Help: the banned-word scan (UX-BEGINNER.md 2.3) over Simple's Help page, drawn by the real
	Navigator, with the flags as shipped and with every flag on (strict).
*/
import { FEATURE_NAMES, setFeaturesForTests } from '../../mode/features.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';

function helpPage() {
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = 'Help';
	editor.navigate();
	return document.querySelector('[data-anyink-help]');
}

scanSimpleScreen('Help page, flags as shipped', () => helpPage(), { strict: true });

scanSimpleScreen(
	'Help page, every flag on',
	() => {
		setFeaturesForTests(Object.fromEntries(FEATURE_NAMES.map((name) => [name, true])));
		return helpPage();
	},
	{ strict: true }
);
