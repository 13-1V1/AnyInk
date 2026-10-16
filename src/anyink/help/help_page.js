// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15: Simple's Help page (UX-BEGINNER.md 4.10). One page, five sections, each entry tagged with
	its feature, so Help shows nothing whose flag is off (principle 8):
	  1. how    How a font gets made: the three steps in short paragraphs, and the How card's text
	            (B9's photo.how.* words, with 'photo')
	  2. words  What these words mean: words.js glossary(), the 2.1 table for the flags on; each
	            entry its word, what it means, the everyday comparison, and the pro word as small
	            print (.anyink-pro-word)
	  3. word   Get your font into Windows and Word: section 8's steps (help_word_steps.js), only
	            with 'useInWord'
	  4. keys   Keyboard keys: keys.js's keys for Simple (help_keys.js)
	  5. more   Look at an example font (a new window, example_font.js), Show tips again (with
	            'coach'), the full manual (Glyphr Studio's help site, said to
	            use pro words, D-003), About and credits
	It replaces B5's stand-in Help (pages/help.js makeSimpleHelp and simple_pages.js help.*). The
	page has no green button of its own: the page's [Back to my letters] is the one (principle 1).
	Colors: help_page.css, tokens only. No uppercase transforms (2.2).

	  HELP_SECTIONS                 ['how', 'words', 'word', 'keys', 'more'] in 4.10's order
	  makeHelpPage({ editor, isOn })   the page (<article data-anyink-help>); a section with
	                                nothing to show is left out, and so is its contents link
	  showHelpSection(root, id)     scrolls to that section and puts the keyboard on its heading;
	                                an id that isn't there goes to the page's title; true when
	                                the section was there
*/
import { defaultTryItText, fontNameOf } from '../coach/font_facts.js';
import { resetTips } from '../coach/coach_state.js';
import { isFeatureOn } from '../mode/features.js';
import { howLetters, MAX_FIRST_TRY } from '../photo/how_card.js';
import { toast } from '../toast/toast.js';
import { PRO_WORD_CLASS } from '../words/banned.js';
import { glossary, isLanded, labelCase, word, wordEntry } from '../words/words.js';
import { helpKeyRows } from './help_keys.js';
import { renamedLines, wordSteps } from './help_word_steps.js';
import { openExampleFont } from './example_font.js';
import { renamedTestNames } from '../install/build_names.js';
import './help_page.css';

/** @type {ReadonlyArray<String>} */
export const HELP_SECTIONS = Object.freeze(['how', 'words', 'word', 'keys', 'more']);

/** The full manual (D-003): Glyphr Studio's help site */
export const MANUAL_URL = 'https://www.glyphrstudio.com/help';

const MAKERS = { how: makeHow, words: makeWords, word: makeWord, keys: makeKeys, more: makeMore };

/**
 * @param {{editor?: Object, isOn?: (flag: String) => Boolean}} [options]
 * @returns {HTMLElement}
 */
export function makeHelpPage({ editor, isOn = isFeatureOn } = {}) {
	// the one shared rule makes Windows' and Word's labels bold (common/resets.css)
	const root = el('article', 'anyink-help', { 'data-anyink-help': '', 'data-anyink-quotes': 'bold' });
	const title = el('h1', 'anyink-help__title', { tabindex: '-1' }, word('helpPage.title'));
	root.appendChild(title);

	const sections = HELP_SECTIONS.map((id) => {
		const body = MAKERS[id]({ editor, isOn, root });
		if (!body || !body.length) return null;
		const section = el('section', 'anyink-help__section', {
			id: `anyink-help-${id}`,
			'data-anyink-help-section': id,
		});
		section.appendChild(
			el('h2', 'anyink-help__heading', { tabindex: '-1' }, word(`helpPage.section.${id}`))
		);
		body.forEach((child) => section.appendChild(child));
		return section;
	}).filter(Boolean);

	// a div, not a <nav>: upstream styles every <nav> as its floating page chooser (nav.css)
	const contents = el('div', 'anyink-help__contents', {
		role: 'navigation',
		'aria-label': word('helpPage.contents'),
	});
	contents.appendChild(el('p', 'anyink-help__contents-title', {}, word('helpPage.contents')));
	const list = el('ul', 'anyink-help__contents-list');
	sections.forEach((section) => {
		const id = section.dataset.anyinkHelpSection;
		const link = el(
			'button',
			'anyink-help__link',
			{ type: 'button', 'data-anyink-help-link': id },
			word(`helpPage.section.${id}`)
		);
		link.addEventListener('click', () => showHelpSection(root, id));
		const item = el('li');
		item.appendChild(link);
		list.appendChild(item);
	});
	contents.appendChild(list);
	root.appendChild(contents);
	sections.forEach((section) => root.appendChild(section));
	return root;
}

/**
 * @param {ParentNode} root - the page, or anything holding it
 * @param {String} id - a section id
 * @returns {Boolean} true when that section was there
 */
export function showHelpSection(root, id) {
	const page = root?.matches?.('[data-anyink-help]') ? root : root?.querySelector?.('[data-anyink-help]');
	if (!page) return false;
	const section = HELP_SECTIONS.includes(id)
		? page.querySelector(`[data-anyink-help-section="${id}"]`)
		: null;
	const target = section ? section.querySelector('h2') : page.querySelector('h1');
	if (!target) return false;
	target.scrollIntoView?.({ block: 'start' });
	target.focus?.({ preventScroll: true });
	return !!section;
}

// --------------------------------------------------------------
// Sections: each returns its children ([] for nothing to show)
// --------------------------------------------------------------

/** 1. The three steps, then the How card's text */
function makeHow({ editor, isOn }) {
	const children = [];
	[
		'helpPage.how.letters',
		'helpPage.how.lettersPhoto',
		'helpPage.how.lettersBrush',
		'helpPage.how.tryIt',
		'helpPage.how.useInWord',
	]
		.filter((key) => isLanded(key, isOn))
		.forEach((key) => children.push(el('p', 'anyink-help__text', {}, word(key))));

	if (isOn('photo')) {
		children.push(el('h3', 'anyink-help__subheading', {}, word('photo.how.title')));
		const steps = el('ol', 'anyink-help__steps', { 'data-anyink-help-how-card': '' });
		howCardSteps(tryItText(editor)).forEach((sentences) =>
			steps.appendChild(el('li', 'anyink-help__step', {}, sentences.join(' ')))
		);
		children.push(steps);
	}
	return children;
}

/**
 * The How card's five steps (photo/how_card.js, 4.4), as sentences.
 * @param {String} text - the Try-it text
 * @returns {Array<Array<String>>}
 */
function howCardSteps(text) {
	const letters = howLetters(text);
	const firstTry =
		letters.length && letters.length <= MAX_FIRST_TRY
			? [
					word('photo.how.firstTry', { text: text.trim(), letters: letters.join(' ') }),
					word('photo.how.orAlphabet'),
			  ]
			: [word('photo.how.alphabet')];
	return [
		[word('photo.how.pen')],
		[word('photo.how.size')],
		firstTry,
		[word('photo.how.light')],
		[word('photo.how.transfer')],
	];
}

/** 2. The glossary for the flags on */
function makeWords({ isOn }) {
	const entries = glossary(isOn);
	if (!entries.length) return [];
	const list = el('dl', 'anyink-help__glossary');
	entries.forEach((entry) => {
		list.appendChild(
			el('dt', 'anyink-help__term', { 'data-anyink-term': entry.key }, labelCase(entry.text))
		);
		const meaning = el('dd', 'anyink-help__meaning');
		if (entry.hint) meaning.appendChild(el('p', 'anyink-help__text', {}, entry.hint));
		if (entry.like) {
			meaning.appendChild(
				el('p', 'anyink-help__like', {}, word('helpPage.words.like', { like: entry.like }))
			);
		}
		if (entry.pro) {
			const pro = el('p', 'anyink-help__pro');
			pro.appendChild(el('span', PRO_WORD_CLASS, {}, word('helpPage.words.pro', { pro: entry.pro })));
			meaning.appendChild(pro);
		}
		list.appendChild(meaning);
	});
	return [el('p', 'anyink-help__text', {}, word('helpPage.words.intro')), list];
}

/** 3. Section 8's steps */
function makeWord({ editor, isOn }) {
	const steps = wordSteps({ name: fontNameOf(editor?.project), isOn });
	if (!steps.length) return [];
	const list = el('ol', 'anyink-help__steps');
	steps.forEach((step) => {
		const item = el('li', 'anyink-help__step', { 'data-anyink-help-step': step.id });
		item.innerHTML = step.html;
		if (step.subs?.length) {
			const subs = el('ul', 'anyink-help__subs');
			step.subs.forEach((markup) => {
				const sub = el('li', 'anyink-help__sub');
				sub.innerHTML = markup;
				subs.appendChild(sub);
			});
			item.appendChild(subs);
		}
		list.appendChild(item);
	});
	addRenamedLines(editor, list.querySelector('[data-anyink-help-step="cleanUp"]'));
	return [el('p', 'anyink-help__text', {}, word('helpPage.word.intro')), list];
}

/**
 * B14 + B15 finalize: after a rename, "Clean up old tests" also names the old name's tests
 * (the work file's test builds, kept in app storage: install/build_names.js).
 * @param {Object} editor
 * @param {HTMLElement | null} item - the clean-up step
 */
function addRenamedLines(editor, item) {
	const project = editor?.project;
	const workId = project?.settings?.project?.id;
	if (!item || !workId) return;
	renamedTestNames(fontNameOf(project), workId)
		.then((oldNames) => {
			renamedLines(oldNames).forEach((markup, index) => {
				const line = el('p', 'anyink-help__text', { 'data-anyink-help-renamed': oldNames[index] });
				line.innerHTML = markup;
				item.appendChild(line);
			});
		})
		.catch(() => {});
}

/** 4. The keys */
function makeKeys({ isOn }) {
	const rows = helpKeyRows({ isOn });
	if (!rows.length) return [];
	const table = el('dl', 'anyink-help__keys');
	rows.forEach((row) => {
		const key = el('dt', 'anyink-help__key-cell', { 'data-anyink-help-key': row.id });
		key.appendChild(el('kbd', 'anyink-help__key', {}, row.keys));
		table.appendChild(key);
		table.appendChild(el('dd', 'anyink-help__key-label', {}, row.label));
	});
	return [el('p', 'anyink-help__text', {}, word('helpPage.keys.intro')), table];
}

/** 5. Show tips again, the full manual, About */
function makeMore({ editor, isOn }) {
	const row = el('div', 'anyink-help__more');
	// 4.10: the example opens in a new window; the font he is making stays here
	const example = button('example', 'helpPage.more.example');
	example.title = wordEntry('helpPage.more.example')?.hint || '';
	example.addEventListener('click', () => openExampleFont());
	row.appendChild(example);
	if (isOn('coach')) {
		const tips = button('tipsAgain', 'helpPage.more.tipsAgain');
		tips.addEventListener('click', () => {
			resetTips();
			toast('topbar.toast.tipsAgain');
		});
		row.appendChild(tips);
	}
	const manual = el(
		'a',
		'anyink-help__button',
		{
			href: MANUAL_URL,
			target: '_blank',
			rel: 'noopener',
			'data-anyink-help-action': 'manual',
		},
		word('helpPage.more.manual')
	);
	row.appendChild(manual);
	const about = button('about', 'helpPage.more.about');
	about.addEventListener('click', () => {
		if (!editor?.nav || typeof editor.navigate !== 'function') return;
		editor.nav.page = 'About';
		editor.navigate();
	});
	row.appendChild(about);
	return [row];
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/** The Try-it text the How card works from (the font name until he types another). */
function tryItText(editor) {
	try {
		return defaultTryItText(editor?.project);
	} catch {
		return '';
	}
}

/** An outlined button (never green: the page's one green button is [Back to my letters]). */
function button(action, key) {
	return el(
		'button',
		'anyink-help__button',
		{ type: 'button', 'data-anyink-help-action': action },
		word(key)
	);
}

/**
 * @param {String} tag
 * @param {String} [className]
 * @param {Object<String, String>} [attributes]
 * @param {String} [text]
 * @returns {HTMLElement}
 */
function el(tag, className = '', attributes = {}, text = '') {
	const element = globalThis.document.createElement(tag);
	if (className) element.className = className;
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	if (text) element.textContent = text;
	return element;
}
