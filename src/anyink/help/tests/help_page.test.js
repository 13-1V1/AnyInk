// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Help (UX-BEGINNER.md 4.10): Simple's Help page.
	  - the glossary is words.js glossary() for the flags on: no entry whose flag is off
	  - section 1 has the three steps and the How card's text, each only with its flag
	  - section 3 (section 8's steps) only with 'useInWord'; the versions step only with
	    'alternates'; Windows' and Word's labels are quotes
	  - section 4 lists keys.js's keys for Simple (the Brush only with 'brush')
	  - section 5: Show tips again, the full manual, About
	  - the stand-in Help (B5) is gone: no tabs, none of its sentences
	  - the top bar's 'anyink-open-help' door opens Help at its section
*/
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FEATURE_NAMES, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { HELP_EVENT, openDoor } from '../../topbar/doors.js';
import { findBanned, QUOTE_CLASS, PRO_WORD_CLASS } from '../../words/banned.js';
import { glossary, labelCase, word } from '../../words/words.js';
import { keysShown } from '../../mode/keys.js';
import { toolWordKey } from '../../sketch/tools/tool_names.js';
import { helpKeyRows } from '../help_keys.js';
import { HELP_SECTIONS, makeHelpPage } from '../help_page.js';

const ALL_ON = Object.fromEntries(FEATURE_NAMES.map((name) => [name, true]));

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
	quiet?.forEach((spy) => spy.mockRestore());
	setModeForTests('all');
	document.body.innerHTML = '';
});
const hush = () =>
	(quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	]);

const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
const section = (root, id) => root.querySelector(`[data-anyink-help-section="${id}"]`);
const page = (options = {}) => {
	setModeForTests('simple');
	const root = makeHelpPage({ editor: sampleEditor(), ...options });
	document.body.appendChild(root);
	return root;
};
const terms = (root) =>
	[...root.querySelectorAll('[data-anyink-term]')].map((term) => term.dataset.anyinkTerm);

describe('section 2: the glossary, filtered by feature flags', () => {
	it('is exactly glossary() for the flags on, in its order', () => {
		hush();
		const root = page();
		expect(terms(root)).toEqual(glossary().map((entry) => entry.key));
		expect(terms(root).length).toBeGreaterThan(0);
	});

	it('shows no entry whose flag is off', () => {
		hush();
		setFeaturesForTests({ board: false, brush: false, alternates: false, weight: false });
		const root = page();
		const shown = terms(root);
		['term.letterSet', 'term.brush', 'term.versions', 'term.boldness'].forEach((key) =>
			expect(shown).not.toContain(key)
		);
		expect(shown).toContain('term.letter');
	});

	it('an entry shows once its flag is on', () => {
		hush();
		setFeaturesForTests({ alternates: true });
		expect(terms(page())).toContain('term.versions');
	});

	it('each entry: the word, what it means, the comparison, and the pro word as small print', () => {
		hush();
		const root = page();
		const letter = root.querySelector('[data-anyink-term="term.letter"]');
		const entry = glossary().find((e) => e.key === 'term.letter');
		expect(text(letter)).toContain(labelCase(entry.text));
		expect(text(letter.nextElementSibling)).toContain(entry.hint);
		expect(text(letter.nextElementSibling)).toContain(entry.like);
		const pro = letter.nextElementSibling.querySelector(`.${PRO_WORD_CLASS}`);
		expect(text(pro)).toContain('glyph');
	});
});

describe('section 1: how a font gets made', () => {
	it('the three steps, and the How card text with photos on', () => {
		hush();
		setFeaturesForTests({ useInWord: true });
		const how = section(page(), 'how');
		expect(text(how)).toContain(word('helpPage.how.letters'));
		expect(text(how)).toContain(word('helpPage.how.tryIt'));
		expect(text(how)).toContain(word('helpPage.how.useInWord'));
		expect(text(how)).toContain(word('photo.how.title'));
		expect(text(how)).toContain(word('photo.how.pen'));
		expect(text(how)).toContain(word('photo.how.transfer'));
	});

	it('no step or How card text whose flag is off', () => {
		hush();
		setFeaturesForTests({ photo: false, tryIt: false, useInWord: false });
		const how = section(page(), 'how');
		expect(text(how)).not.toContain(word('photo.how.pen'));
		expect(text(how)).not.toContain(word('helpPage.how.lettersPhoto'));
		expect(text(how)).not.toContain(word('helpPage.how.tryIt'));
		expect(text(how)).not.toContain(word('helpPage.how.useInWord'));
		expect(text(how)).toContain(word('helpPage.how.letters'));
	});
});

describe("section 3: section 8's steps", () => {
	it("is not there while 'useInWord' is off", () => {
		hush();
		setFeaturesForTests({ useInWord: false });
		const root = page();
		expect(section(root, 'word')).toBe(null);
		expect(root.querySelector('[data-anyink-help-link="word"]')).toBe(null);
	});

	it('the steps, with the labels of Windows and Word as quotes', () => {
		hush();
		setFeaturesForTests({ useInWord: true, alternates: false });
		const steps = section(page(), 'word');
		const quotes = [...steps.querySelectorAll(`.${QUOTE_CLASS}`)].map((q) => q.textContent);
		['Install', 'Kerning for fonts', 'Set As Default', 'Allow', 'My Fonts'].forEach((label) =>
			expect(quotes).toContain(label)
		);
		// B14 + B15 finalize: the gap-fix step's four short steps are list items of their own
		expect(steps.querySelectorAll('li.anyink-help__step').length).toBe(8);
		expect(steps.querySelectorAll('li.anyink-help__sub').length).toBe(4);
		expect(quotes).not.toContain('Use Contextual Alternates');
	});

	it("the versions step only with 'alternates'", () => {
		hush();
		setFeaturesForTests({ useInWord: true, alternates: true });
		const steps = section(page(), 'word');
		expect(steps.querySelectorAll('li.anyink-help__step').length).toBe(9);
		expect([...steps.querySelectorAll(`.${QUOTE_CLASS}`)].map((q) => q.textContent)).toContain(
			'Use Contextual Alternates'
		);
	});

	it("names the font's own file and test name", () => {
		hush();
		setFeaturesForTests({ useInWord: true });
		setModeForTests('simple');
		const editor = sampleEditor();
		editor.project.settings.project.name = 'Brennan Hand';
		const steps = section(makeHelpPage({ editor }), 'word');
		const quotes = [...steps.querySelectorAll(`.${QUOTE_CLASS}`)].map((q) => q.textContent);
		expect(quotes).toContain('BrennanHand-Test1.otf');
		expect(quotes).toContain('Brennan Hand Test 1');
	});
});

describe('section 4: keyboard keys', () => {
	it("keys.js's keys for Simple, the tools with the key their tooltips show", () => {
		hush();
		const keys = section(page(), 'keys');
		const said = text(keys);
		['Ctrl+Z', 'Ctrl+Y', 'Ctrl+S', 'Ctrl+O', 'Ctrl+E', 'Ctrl+C', 'Ctrl+V', 'Space', 'Esc'].forEach(
			(combo) => expect(said).toContain(combo)
		);
		keysShown({ mode: 'simple' })
			.filter((key) => key.action === 'selectTool')
			.forEach((key) => {
				const row = helpKeyRows().find((r) => r.id === key.id);
				expect(row?.keys).toBe(key.keys[0]);
				expect(row?.label).toBe(word('helpPage.keys.tool', { tool: word(toolWordKey(key.tool)) }));
			});
	});

	it("the Brush row only with 'brush', the letters' row only with 'board'", () => {
		setFeaturesForTests({ brush: false, board: false });
		const ids = helpKeyRows().map((r) => r.id);
		expect(ids).not.toContain('tool.nib');
		expect(ids).not.toContain('board.openLetter');
		setFeaturesForTests({ brush: true, board: true });
		const on = helpKeyRows().map((r) => r.id);
		expect(on).toContain('tool.nib');
		expect(on).toContain('board.openLetter');
		expect(helpKeyRows().find((r) => r.id === 'tool.nib').keys).toBe('B');
	});

	it('Simple has no key for Add a point', () => {
		expect(helpKeyRows().map((r) => r.id)).not.toContain('tool.pathAddPoint');
	});
});

describe('section 5 and the page', () => {
	it('Show tips again, the full manual, About', () => {
		hush();
		const more = section(page(), 'more');
		expect(text(more)).toContain(word('helpPage.more.tipsAgain'));
		expect(text(more)).toContain(word('helpPage.more.manual'));
		expect(text(more)).toContain(word('helpPage.more.about'));
	});

	it('About and credits opens the About page', () => {
		hush();
		setModeForTests('simple');
		const editor = sampleEditor();
		editor.navigate = vi.fn();
		const root = makeHelpPage({ editor });
		root.querySelector('[data-anyink-help-action="about"]').click();
		expect(editor.nav.page).toBe('About');
		expect(editor.navigate).toHaveBeenCalledOnce();
	});

	it('sections in 4.10 order, each named in the contents list', () => {
		hush();
		setFeaturesForTests({ useInWord: true });
		const root = page();
		const ids = [...root.querySelectorAll('[data-anyink-help-section]')].map(
			(s) => s.dataset.anyinkHelpSection
		);
		expect(ids).toEqual(HELP_SECTIONS);
		expect(
			[...root.querySelectorAll('[data-anyink-help-link]')].map((a) => a.dataset.anyinkHelpLink)
		).toEqual(HELP_SECTIONS);
	});

	it('says no banned word with every flag on (strict), and no green button of its own', () => {
		hush();
		setFeaturesForTests(ALL_ON);
		const root = page();
		const visible = root.cloneNode(true);
		visible.querySelectorAll(`.${QUOTE_CLASS}, .${PRO_WORD_CLASS}`).forEach((el) => el.remove());
		expect(findBanned(text(visible), { strict: true })).toEqual([]);
		expect(root.querySelectorAll('.anyink-primary, fancy-button').length).toBe(0);
	});
});

describe('the Help page in the app', () => {
	function open(mode) {
		hush();
		setModeForTests(mode);
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Help';
		editor.navigate();
		return editor;
	}

	it("Simple: B15's page, not B5's stand-in (no tabs, none of its sentences)", () => {
		open('simple');
		expect(document.querySelector('[data-anyink-help]')).not.toBe(null);
		expect(document.querySelectorAll('.tab-control__tab').length).toBe(0);
		expect(text(document.body)).not.toContain(
			'Pick a letter to open it. To go back to a letter later'
		);
		expect(document.querySelector('[data-anyink-choice="backToLetters"]')).not.toBe(null);
	});

	it('All tools keeps its Overview and Keyboard shortcuts tabs', () => {
		open('all');
		expect(
			[...document.querySelectorAll('.tab-control__tab')].map((t) => t.textContent)
		).toEqual(['Overview', 'Keyboard shortcuts']);
		expect(document.querySelector('[data-anyink-help]')).toBe(null);
	});
});

describe("the top bar's door: 'anyink-open-help'", () => {
	it.each(['how', 'words', 'keys', 'more'])('opens Help at its %s section', (id) => {
		hush();
		setModeForTests('simple');
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Characters';
		editor.navigate();
		const steps = editor.history.queue.length;
		openDoor(HELP_EVENT, { section: id });
		expect(editor.nav.page).toBe('Help');
		const heading = section(document, id).querySelector('h2');
		expect(document.activeElement).toBe(heading);
		expect(editor.history.queue.length).toBe(steps);
	});

	it('already on Help: goes to the section without drawing the page again', () => {
		hush();
		setModeForTests('simple');
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Help';
		editor.navigate();
		const root = document.querySelector('[data-anyink-help]');
		openDoor(HELP_EVENT, { section: 'keys' });
		expect(document.querySelector('[data-anyink-help]')).toBe(root);
		expect(document.activeElement).toBe(section(document, 'keys').querySelector('h2'));
	});

	it('a Help page drawn before its flag turned on is drawn again for that section', () => {
		hush();
		setFeaturesForTests({ useInWord: false });
		setModeForTests('simple');
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Help';
		editor.navigate();
		setFeaturesForTests({ useInWord: true });
		openDoor(HELP_EVENT, { section: 'word' });
		expect(document.activeElement).toBe(section(document, 'word').querySelector('h2'));
	});

	it("a section that isn't there opens Help at the top", () => {
		hush();
		setFeaturesForTests({ useInWord: false });
		setModeForTests('simple');
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Characters';
		editor.navigate();
		openDoor(HELP_EVENT, { section: 'word' });
		expect(editor.nav.page).toBe('Help');
		expect(document.activeElement).toBe(document.querySelector('[data-anyink-help] h1'));
	});

	it('All tools: the door does nothing', () => {
		hush();
		setModeForTests('all');
		const editor = sampleEditor();
		document.body.innerHTML = '<div id="app__wrapper"></div>';
		editor.nav.page = 'Characters';
		editor.navigate();
		openDoor(HELP_EVENT, { section: 'keys' });
		expect(editor.nav.page).toBe('Characters');
	});
});
