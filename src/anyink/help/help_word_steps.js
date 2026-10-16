// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Help > Get your font into Windows and Word (UX-BEGINNER.md 4.10 section 3, section 8): the
	steps as safe HTML, in order. Windows' and Word's own labels, the folder, the file and the font
	names are quotes (.anyink-quote, 2.3); the labels are Use in Word's install.quote.* entries
	(B14 + B15 integration: one copy with the install card). The names are the first test build's,
	by B14's own rule (install/build_names.js: "Brennan Hand" -> "BrennanHand-Test1.otf",
	"Brennan Hand Test 1", final "Brennan Hand"). A step shows only while its flag is on (the
	versions step is M11's 'alternates'). Pure: no DOM.

	  wordSteps({ name, isOn })   [{ id, html, subs }]; [] while 'useInWord' is off; subs: the
	                              gap-fix step's short steps (the card's install.step.gaps.*)
	  renamedLines(oldNames)      the clean-up step's lines for a renamed font (B14 + B15
	                              finalize)
	  exampleNames(name)          { file, testName, search, finalName }
*/
import { familyBase, finalBuildNames, testBuildNames } from '../install/build_names.js';
import { isFeatureOn } from '../mode/features.js';
import { isLanded, word } from '../words/words.js';
import { wordHTML } from '../words/word_html.js';

/** Windows' and Word's own labels, by the placeholder that shows each one (Use in Word's) */
const LABELS = Object.freeze({
	folder: 'install.quote.myFonts',
	allow: 'install.quote.allow',
	install: 'install.quote.install',
	moreOptions: 'install.quote.moreOptions',
	installAll: 'install.quote.installAll',
	advanced: 'install.quote.advanced',
	gapSetting: 'install.quote.gapSetting',
	setDefault: 'install.quote.setDefault',
	normal: 'install.quote.normal',
	ok: 'install.quote.ok',
	versionSetting: 'install.quote.versionSetting',
	fontSettings: 'install.quote.fontSettings',
	options: 'install.quote.options',
	uninstall: 'install.quote.uninstall',
});

/** The gap-fix step's short steps: Use in Word's card's own (one copy) */
const GAP_STEPS = Object.freeze([
	'install.step.gaps.open',
	'install.step.gaps.tick',
	'install.step.gaps.size',
	'install.step.gaps.keep',
]);

/** The most old names the clean-up step lists */
const MAX_OLD_NAMES = 3;

/** Section 8's steps, in order */
const STEPS = Object.freeze([
	'make',
	'find',
	'install',
	'restart',
	'use',
	'gaps',
	'versions',
	'nextTime',
	'cleanUp',
]);

/**
 * @param {String} [name] - the font's name
 * @returns {{file: String, testName: String, search: String, finalName: String}}
 */
export function exampleNames(name) {
	const first = testBuildNames(name, 1);
	const finalName = finalBuildNames(name).family;
	return {
		file: first.fileName,
		testName: first.family,
		// B14 + B15 fix pass: the base the fonts are really named with (a long name is cut once)
		search: word('install.more.searchName', { name: familyBase(name) }),
		finalName,
	};
}

/**
 * @param {{name?: String, isOn?: (flag: String) => Boolean}} [options]
 * @returns {Array<{id: String, html: String}>}
 */
export function wordSteps({ name, isOn = isFeatureOn } = {}) {
	if (!isOn('useInWord')) return [];
	const names = exampleNames(name);
	const vars = { ...names };
	Object.entries(LABELS).forEach(([slot, key]) => {
		if (isLanded(key, isOn)) vars[slot] = word(key);
	});
	const quotes = [...Object.keys(LABELS), 'file', 'testName', 'search', 'finalName'];
	return STEPS.map((id) => `helpPage.word.${id}`)
		.filter((key) => isLanded(key, isOn))
		.map((key) => {
			const id = key.split('.').pop();
			const subs = id === 'gaps' ? GAP_STEPS.map((sub) => wordHTML(sub, vars, quotes)) : [];
			return { id, html: wordHTML(key, vars, quotes), subs };
		});
}

/**
 * B14 + B15 finalize: "Clean up old tests" after a rename, one line per old name.
 * @param {Array<String>} oldNames - install/build_names.js renamedTestNames
 * @returns {Array<String>} safe HTML, the search quoted
 */
export function renamedLines(oldNames) {
	return (oldNames || []).slice(0, MAX_OLD_NAMES).map((old) =>
		wordHTML(
			'helpPage.word.cleanUpRenamed',
			{ search: word('install.more.searchName', { name: old }) },
			['search']
		)
	);
}
