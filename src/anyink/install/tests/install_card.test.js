// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 (UX-BEGINNER.md 4.7, section 8): the install card. Step 4 (Word's gap-fix setting) only
// when the font has gap fixes, highlighted; the uninstall line only when an earlier test build
// exists, with that exact name; the final font's card has no test lines; a download says
// "Downloads". Windows' and Word's labels are quotes.
import { afterEach, describe, expect, it } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { word } from '../../words/words.js';
import { cardSteps, hasGapFixes, makeInstallCard } from '../install_card.js';
import { openBrennanHand } from './install_fixture.js';

const model = (extra = {}) => ({
	kind: 'test',
	name: 'Brennan Hand',
	fileName: 'BrennanHand-Test3.otf',
	family: 'Brennan Hand Test 3',
	finalFamily: 'Brennan Hand',
	folder: 'My Fonts',
	downloaded: false,
	earlier: { number: 2, family: 'Brennan Hand Test 2' },
	number: 3,
	gapFixes: false,
	versions: false,
	...extra,
});

const text = (html) => {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.textContent;
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('hasGapFixes', () => {
	it('is true only for a gap fix the font file will hold', () => {
		expect(hasGapFixes(openBrennanHand().project)).toBe(false);
		expect(hasGapFixes(openBrennanHand({ gapFix: true }).project)).toBe(true);
		const zero = openBrennanHand({ gapFix: true });
		zero.project.kerning['kern-0'].value = 0;
		expect(hasGapFixes(zero.project)).toBe(false);
		const off = openBrennanHand({ gapFix: true });
		off.project.settings.app.exportKerning = false;
		expect(hasGapFixes(off.project)).toBe(false);
	});
});

describe('cardSteps', () => {
	it('step 4 shows only with gap fixes, highlighted', () => {
		expect(cardSteps(model()).map((s) => s.id)).toEqual(['find', 'install', 'restart']);
		const steps = cardSteps(model({ gapFixes: true }));
		expect(steps.map((s) => s.id)).toEqual(['find', 'install', 'restart', 'gaps']);
		expect(steps[3].highlight).toBe(true);
		expect(steps.slice(0, 3).every((s) => !s.highlight)).toBe(true);
		const gaps = [steps[3].html, ...steps[3].subs].map(text).join(' ');
		expect(gaps).toContain('Kerning for fonts');
		expect(gaps).toContain('All documents based on the Normal template');
		expect(gaps).toContain('8 is the lowest');
	});

	it('the versions step waits for M11', () => {
		const on = (flag) => flag === 'alternates';
		expect(cardSteps(model({ versions: true })).map((s) => s.id)).not.toContain('versions');
		expect(cardSteps(model({ versions: true }), { isOn: on }).map((s) => s.id)).toContain(
			'versions'
		);
	});

	it('names the real folder, file and font, as quotes', () => {
		const [find, install, restart] = cardSteps(model());
		expect(text(find.html)).toBe('Open File Explorer, then Documents > My Fonts.');
		expect(find.html).toContain('<span class="anyink-quote">My Fonts</span>');
		expect(install.html).toContain('<span class="anyink-quote">BrennanHand-Test3.otf</span>');
		expect(install.html).toContain('<span class="anyink-quote">Install</span>');
		expect(text(restart.html)).toContain("type Brennan Hand Test 3 in Word's font box");
		// fact-check: no "at the top", only Chrome's / Windows' labels are quoted
		expect(text(install.html)).not.toContain('at the top');
	});

	it('the uninstall line names the earlier test, and only when there is one', () => {
		const [, install] = cardSteps(model());
		expect(text(install.earlierHTML)).toBe(
			"If you installed Brennan Hand Test 2 earlier, you can uninstall it first so Word's font list stays short."
		);
		const [, first] = cardSteps(model({ earlier: null }));
		expect(first.earlierHTML).toBe('');
	});

	it('a download says Downloads', () => {
		const [find] = cardSteps(model({ downloaded: true, folder: '' }));
		expect(text(find.html)).toBe('Open File Explorer, then Downloads.');
	});

	it("the final font's card says to uninstall an older one of its name", () => {
		const final = model({
			kind: 'final',
			fileName: 'BrennanHand-Regular.otf',
			family: 'Brennan Hand',
			earlier: null,
		});
		const [, install] = cardSteps(final);
		expect(text(install.earlierHTML)).toBe(
			'If an older Brennan Hand is installed, uninstall it first.'
		);
	});
});

describe('makeInstallCard', () => {
	it('draws the steps, Done, and the closed parts', () => {
		let done = 0;
		let final = 0;
		const card = makeInstallCard(model({ gapFixes: true }), {
			onDone: () => done++,
			onMakeFinal: () => final++,
		});
		document.body.appendChild(card);
		expect(card.querySelector('.anyink-install-card__made').textContent).toBe(
			'Made BrennanHand-Test3.otf.'
		);
		expect(card.querySelector('.anyink-install-card__name').textContent).toBe(
			"In Word it's called Brennan Hand Test 3."
		);
		const steps = [...card.querySelectorAll('[data-anyink-install-step]')];
		expect(steps.map((s) => s.dataset.anyinkInstallStep)).toEqual([
			'find',
			'install',
			'restart',
			'gaps',
		]);
		expect(steps[3].classList.contains('is-highlight')).toBe(true);
		const happy = card.querySelector('[data-anyink-install-more="happy"]');
		expect(happy.open).toBe(false);
		expect(happy.querySelector('summary').textContent).toBe(word('install.more.happy'));
		expect(happy.textContent).toContain("A web app can't install fonts for you");
		expect(happy.querySelector('[data-anyink-install-more="whyTest"] summary').textContent).toBe(
			'Why Test 3?'
		);

		// How opens "Remove old test fonts: how"
		card.querySelector('[data-anyink-install-action="how"]').click();
		expect(happy.open).toBe(true);
		const removeOld = card.querySelector('[data-anyink-install-more="removeOld"]');
		expect(removeOld.open).toBe(true);
		expect(removeOld.textContent).toContain(
			'Open Windows Settings > Personalization > Fonts, search Brennan Hand Test, press the ... next to one, then Uninstall.'
		);

		card.querySelector('[data-anyink-install-action="done"]').click();
		card.querySelector('[data-anyink-install-action="makeFinal"]').click();
		expect([done, final]).toEqual([1, 1]);
		// one green button
		expect(card.querySelectorAll('.anyink-primary')).toHaveLength(1);
	});

	it('no step 4 without gap fixes', () => {
		const card = makeInstallCard(model());
		expect(card.querySelector('[data-anyink-install-step="gaps"]')).toBeNull();
		expect(card.querySelector('.is-highlight')).toBeNull();
	});

	it('the final card has no Make the final font and no test lines', () => {
		setFeaturesForTests({ useInWord: true });
		const card = makeInstallCard(
			model({
				kind: 'final',
				fileName: 'BrennanHand-Regular.otf',
				family: 'Brennan Hand',
				earlier: null,
			})
		);
		expect(card.querySelector('[data-anyink-install-action="makeFinal"]')).toBeNull();
		expect(card.querySelector('[data-anyink-install-action="how"]')).toBeNull();
		expect(card.querySelector('[data-anyink-install-more="whyTest"]')).toBeNull();
	});
});
