// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14: the install card (UX-BEGINNER.md 4.7 "After making it", section 8), what Use in Word shows
	once the font file is made. Only the steps, in the fact-checked wording (docs/FACTCHECK_LOG.md
	section 8, words/sets/install.js):
	  Made "BrennanHand-Test3.otf".
	  In Word it's called "Brennan Hand Test 3".
	   1. Open File Explorer, then Documents > "My Fonts".          (or "Downloads" for a download)
	   2. Double-click "BrennanHand-Test3.otf", then press "Install".
	      If you installed "Brennan Hand Test 2" earlier, you can uninstall it first ... [How]
	   3. Close Word completely, open it again, and type "Brennan Hand Test 3" in Word's font box.
	   4. Turn on your gap fixes in Word:    highlighted, only when the font file holds a gap fix
	        - Press Ctrl+D and open "Advanced".
	        - Tick "Kerning for fonts".
	        - If your text is smaller than the number beside it, ...
	        - To keep it for new files, press "Set As Default", choose "...", then "OK".
	   5. Turn on your versions: ...         highlighted, only after M11 ('alternates') with versions
	  [Done] (green)
	  > When you're happy with it            closed: [Make the final font] and its name line,
	                                         > Why "Test 3"?, > Remove old test fonts: how, and
	                                         "A web app can't install fonts for you, ..."
	  > Not in Word's font list after a restart?   closed: Install for all users
	The final font's card has no test lines: step 2 says to uninstall an older one of that name.
	Windows', Word's and Chrome's labels, the file, folder and font names are .anyink-quote (2.3),
	bold on the card as in Help (install_card.css), so a label's start and end are plain to see.
	[How] opens "When you're happy with it" at "Remove old test fonts: how".

	  hasGapFixes(project)                 a gap fix the font file will hold: a kern pair with a
	                                       value whose two sides are both letters the file holds
	                                       (word_export.js writtenGapFixes)
	  cardSteps(model, { isOn })           [{ id, html, highlight, earlierHTML, subs }] in order
	  makeInstallCard(model, { onDone, onMakeFinal, isOn })   the card's element
	  model: { kind: 'test' | 'final', name, fileName, family, finalFamily, folder, downloaded,
	          earlier: { number, family } | null, renamedFrom: [base, ...], number, gapFixes,
	          versions }
	B14 + B15 finalize: after a rename, "Remove old test fonts: how" also says to search each old
	name's tests (renamedFrom, at most 3), on the test card and the final card.
*/
import { isFeatureOn } from '../mode/features.js';
import { wordHTML } from '../words/word_html.js';
import { word, wordEntry } from '../words/words.js';
import { writtenGapFixes } from './word_export.js';
import './install_card.css';

/** Every label the steps quote, by the placeholder that shows it */
const LABELS = Object.freeze({
	downloads: 'install.quote.downloads',
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

/** The most old names "Remove old test fonts: how" lists after renames */
const MAX_OLD_NAMES = 3;

/** What a file, folder or font name fills, always quoted */
const NAMES = Object.freeze(['file', 'folder', 'family', 'earlier', 'test', 'search']);

/**
 * @param {Object} project
 * @returns {Boolean} true when the font file will hold at least one gap fix
 */
export function hasGapFixes(project) {
	return writtenGapFixes(project).length > 0;
}

/** Step 4's short steps, in order */
const GAP_STEPS = Object.freeze([
	'install.step.gaps.open',
	'install.step.gaps.tick',
	'install.step.gaps.size',
	'install.step.gaps.keep',
]);

/**
 * A step's HTML: the model's names and every label as quotes.
 * @param {String} key
 * @param {Object} vars
 * @returns {String}
 */
function html(key, vars = {}) {
	const filled = { ...vars };
	Object.entries(LABELS).forEach(([slot, labelKey]) => {
		if (wordEntry(labelKey)) filled[slot] = word(labelKey);
	});
	return wordHTML(key, filled, [...Object.keys(LABELS), ...NAMES]);
}

/**
 * @param {Object} model - see the header
 * @param {{isOn?: (flag: String) => Boolean}} [options]
 * @returns {Array<{id: String, html: String, highlight: Boolean, earlierHTML: String,
 *   subs: Array<String>}>} subs: a step's short steps, as HTML
 */
export function cardSteps(model, { isOn = isFeatureOn } = {}) {
	const m = model || {};
	const steps = [];
	const add = (id, key, vars, extra = {}) =>
		steps.push({
			id,
			html: html(key, vars),
			highlight: false,
			earlierHTML: '',
			subs: [],
			...extra,
		});

	if (m.downloaded || !m.folder) add('find', 'install.step.findDownloads', {});
	else add('find', 'install.step.find', { folder: m.folder });

	let earlierHTML = '';
	if (m.kind === 'final') {
		earlierHTML = html('install.step.olderFinal', { family: m.family });
	} else if (m.earlier?.family) {
		earlierHTML = html('install.step.earlier', { earlier: m.earlier.family });
	}
	add('install', 'install.step.install', { file: m.fileName }, { earlierHTML });
	add('restart', 'install.step.restart', { family: m.family });
	if (m.gapFixes) {
		add(
			'gaps',
			'install.step.gaps',
			{},
			{ highlight: true, subs: GAP_STEPS.map((key) => html(key)) }
		);
	}
	if (m.versions && isOn('alternates')) {
		add('versions', 'install.step.versions', {}, { highlight: true });
	}
	return steps;
}

/**
 * @param {Object} model - see the header
 * @param {{onDone?: Function, onMakeFinal?: Function, isOn?: Function}} [options]
 * @returns {HTMLElement}
 */
export function makeInstallCard(model, { onDone, onMakeFinal, isOn = isFeatureOn } = {}) {
	const m = model || {};
	const card = el('div', 'anyink-install-card');
	card.dataset.anyinkInstallCard = m.kind === 'final' ? 'final' : 'test';
	// the one shared rule makes the labels and names bold (common/resets.css)
	card.dataset.anyinkQuotes = 'bold';

	card.appendChild(para('anyink-install-card__made', html('install.made', { file: m.fileName })));
	card.appendChild(
		para('anyink-install-card__name', html('install.madeName', { family: m.family }))
	);

	const happy = el('details', 'anyink-install-card__more');
	happy.dataset.anyinkInstallMore = 'happy';
	const removeOld = el('details', 'anyink-install-card__inner');
	removeOld.dataset.anyinkInstallMore = 'removeOld';

	const list = el('ol', 'anyink-install-card__steps');
	cardSteps(m, { isOn }).forEach((step) => {
		const item = el('li', 'anyink-install-card__step');
		item.dataset.anyinkInstallStep = step.id;
		if (step.highlight) item.classList.add('is-highlight');
		item.appendChild(para('anyink-install-card__text', step.html));
		if (step.subs.length) {
			const subs = el('ul', 'anyink-install-card__subs');
			step.subs.forEach((markup) => {
				const sub = el('li', 'anyink-install-card__sub');
				sub.innerHTML = markup;
				subs.appendChild(sub);
			});
			item.appendChild(subs);
		}
		if (step.earlierHTML) {
			const line = para('anyink-install-card__earlier', step.earlierHTML);
			if (m.kind !== 'final') {
				const how = button('how', 'install.how', 'anyink-install-card__how');
				how.addEventListener('click', () => {
					happy.open = true;
					removeOld.open = true;
					removeOld.querySelector('summary')?.focus?.();
				});
				line.append(' ', how);
			}
			item.appendChild(line);
		}
		list.appendChild(item);
	});
	card.appendChild(list);

	const row = el('div', 'anyink-modal__buttons');
	const done = button('done', 'install.done', 'anyink-modal__button anyink-primary');
	done.addEventListener('click', () => onDone?.());
	row.appendChild(done);
	card.appendChild(row);

	// When you're happy with it
	happy.appendChild(summary('install.more.happy'));
	if (m.kind !== 'final') {
		const makeFinal = button(
			'makeFinal',
			'install.more.makeFinal',
			'anyink-modal__button anyink-outlined'
		);
		makeFinal.addEventListener('click', () => onMakeFinal?.());
		happy.appendChild(makeFinal);
		happy.appendChild(
			para(
				'anyink-install-card__note',
				html('install.more.finalName', { family: m.finalFamily || m.name || m.family })
			)
		);
		const why = el('details', 'anyink-install-card__inner');
		why.dataset.anyinkInstallMore = 'whyTest';
		why.appendChild(
			summaryHTML(
				html('install.more.whyTest', {
					test: word('install.more.testName', { number: String(m.number ?? '') }),
				})
			)
		);
		why.appendChild(para('anyink-install-card__note', html('install.more.whyTestText')));
		happy.appendChild(why);
	}
	removeOld.appendChild(summary('install.more.removeOld'));
	removeOld.appendChild(
		para(
			'anyink-install-card__note',
			html('install.more.removeOldText', {
				search: word('install.more.searchName', { name: m.name || m.family || '' }),
			})
		)
	);
	// B14 + B15 finalize: after a rename the old name's test fonts are still installed
	(m.renamedFrom || []).slice(0, MAX_OLD_NAMES).forEach((old) => {
		const line = para(
			'anyink-install-card__note',
			html('install.more.removeOldRenamed', {
				search: word('install.more.searchName', { name: old }),
			})
		);
		line.dataset.anyinkInstallRenamed = old;
		removeOld.appendChild(line);
	});
	happy.appendChild(removeOld);
	happy.appendChild(para('anyink-install-card__note', html('install.more.cantInstall')));
	card.appendChild(happy);

	// Not in Word's font list after a restart?
	const notInList = el('details', 'anyink-install-card__more');
	notInList.dataset.anyinkInstallMore = 'notInList';
	notInList.appendChild(summary('install.more.notInList'));
	notInList.appendChild(para('anyink-install-card__note', html('install.more.notInListText')));
	card.appendChild(notInList);

	return card;
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

function el(tag, className = '') {
	const element = globalThis.document.createElement(tag);
	if (className) element.className = className;
	return element;
}

/** A paragraph from safe HTML (wordHTML escapes every value) */
function para(className, markup) {
	const p = el('p', className);
	p.innerHTML = markup;
	return p;
}

function summary(key) {
	const element = el('summary', 'anyink-install-card__summary');
	element.textContent = word(key);
	return element;
}

function summaryHTML(markup) {
	const element = el('summary', 'anyink-install-card__summary');
	element.innerHTML = markup;
	return element;
}

function button(name, key, className) {
	const element = el('button', className);
	element.type = 'button';
	element.dataset.anyinkInstallAction = name;
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	return element;
}
