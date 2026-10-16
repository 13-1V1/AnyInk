// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, Help's Windows and Word section and its More row, written to fail first:
//  - step "Install it" gives one way, the double-click, as Use in Word's card does (no "Or
//    right-click", no "may be under"); the right-click way is for a font not in Word's list;
//  - the gap-fix step is the card's four short steps (install.step.gaps.*), not one paragraph;
//  - after a rename, "Clean up old tests" also says to search the old name's tests;
//  - More has "Look at an example font" (4.10), which opens the example in a new window.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteTestBuilt } from '../../install/build_names.js';
import {
	FEATURE_NAMES,
	flagsOn,
	resetFeaturesForTests,
	setFeaturesForTests,
} from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { kvClear } from '../../storage/kv.js';
import { expectNoBanned, scanState } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { EXAMPLE_PARAM, exampleFontURL } from '../example_font.js';
import { makeHelpPage } from '../help_page.js';
import { wordSteps } from '../help_word_steps.js';

const ALL_ON = Object.fromEntries(FEATURE_NAMES.map((name) => [name, true]));
const plain = (html) => {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.textContent.replace(/\s+/g, ' ').trim();
};

async function waitFor(check, ms = 4000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

let quiet = [];
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});
beforeEach(async () => {
	await kvClear();
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	];
});
afterEach(() => {
	quiet.forEach((spy) => spy.mockRestore());
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe("Help's install and gap steps say what the card says", () => {
	const steps = wordSteps({ name: 'Brennan Hand', isOn: flagsOn('useInWord', 'help') });
	const step = (id) => steps.find((entry) => entry.id === id);

	it('Install it: the double-click, one way', () => {
		const install = plain(step('install').html);
		expect(install).toBe('Install it. Double-click BrennanHand-Test1.otf, then press Install.');
		expect(plain(step('restart').html)).toContain('Install for all users');
	});

	it('gap fixes: the lead line and the four short steps from the card', () => {
		const gaps = step('gaps');
		expect(plain(gaps.html)).not.toMatch(/Ctrl\+D/);
		expect(gaps.subs.map(plain)).toEqual([
			'Press Ctrl+D and open Advanced.',
			'Tick Kerning for fonts.',
			plain(word('install.step.gaps.size')),
			'To keep it for new files, press Set As Default, choose All documents based on the Normal template, then OK.',
		]);
	});
});

describe('Help after a rename', () => {
	it("Clean up old tests also names the old name's tests", async () => {
		setModeForTests('simple');
		setFeaturesForTests(ALL_ON);
		const editor = sampleEditor();
		const workId = editor.project.settings.project.id;
		await noteTestBuilt('Brennan Hand', 2, { workId });
		editor.project.settings.font.family = 'Brennan Script';
		editor.project.settings.project.name = 'Brennan Script';
		const root = makeHelpPage({ editor, isOn: () => true });
		document.body.appendChild(root);
		const old = () => root.querySelector('[data-anyink-help-renamed]');
		expect(await waitFor(() => !!old())).toBe(true);
		expect(old().textContent).toContain('Brennan Hand Test');
		expectNoBanned(scanState({ root }, { strict: true }));
	});
});

describe('Look at an example font', () => {
	it('is in More and opens the example in a new window', () => {
		setModeForTests('simple');
		setFeaturesForTests(ALL_ON);
		const open = vi.fn();
		vi.stubGlobal('open', open);
		const root = makeHelpPage({ editor: sampleEditor(), isOn: () => true });
		document.body.appendChild(root);
		const button = root.querySelector('[data-anyink-help-action="example"]');
		expect(button.textContent).toBe(word('helpPage.more.example'));
		button.click();
		expect(open).toHaveBeenCalledTimes(1);
		const url = new URL(open.mock.calls[0][0], 'https://example.test/AnyInk/');
		expect(url.searchParams.get('ui')).toBe('simple');
		expect(url.searchParams.get(EXAMPLE_PARAM)).toBe('1');
		expect(open.mock.calls[0][1]).toBe('_blank');
		vi.unstubAllGlobals();
	});

	it('the address keeps the page and adds only ui and the example', () => {
		const url = new URL(exampleFontURL('https://13-1v1.github.io/AnyInk/?ui=simple#x'));
		expect(url.pathname).toBe('/AnyInk/');
		expect(url.searchParams.get('ui')).toBe('simple');
		expect(url.searchParams.get(EXAMPLE_PARAM)).toBe('1');
		expect(url.hash).toBe('');
	});
});

describe('the example window at boot', () => {
	it('opens the example only in Simple, with help on, when the address asks', async () => {
		const { openExampleIfAsked } = await import('../example_font.js');
		const openExample = vi.fn();
		const on = () => true;
		expect(openExampleIfAsked({ search: '?ui=simple&example=1', isOn: on, simple: true, openExample })).toBe(true);
		expect(openExampleIfAsked({ search: '?ui=simple', isOn: on, simple: true, openExample })).toBe(false);
		expect(openExampleIfAsked({ search: '?example=1', isOn: on, simple: false, openExample })).toBe(false);
		expect(
			openExampleIfAsked({ search: '?ui=simple&example=1', isOn: () => false, simple: true, openExample })
		).toBe(false);
		expect(openExample).toHaveBeenCalledTimes(1);
	});
});
