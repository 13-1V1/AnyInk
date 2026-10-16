// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, written to fail first: Windows' and Word's labels are bold by ONE shared
// rule (resets.css, [data-anyink-quotes="bold"]) that Help, the install card and Use in Word turn
// on, instead of three copies; and the card's "Made <file>." line and the dialog's folder line
// are no longer bold all the way through, so the quote inside them shows where it starts and ends.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeHelpPage } from '../../help/help_page.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { makeInstallCard } from '../install_card.js';
import { closeUseInWord, openUseInWord } from '../use_in_word_dialog.js';
import { openBrennanHand } from './install_fixture.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const css = (path) => readFileSync(resolve(__dirname, path), 'utf8');
/** The declarations of one exact selector in a stylesheet ('' when it has none) */
const rule = (sheet, selector) => {
	const at = sheet.indexOf(`${selector} {`);
	return at < 0 ? '' : sheet.slice(at, sheet.indexOf('}', at));
};

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
	closeUseInWord();
	vi.restoreAllMocks();
	resetFeaturesForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('one shared bold rule for quotes', () => {
	it('lives in resets.css; the three screens keep no copy', () => {
		expect(rule(css('../../../common/resets.css'), "[data-anyink-quotes='bold'] .anyink-quote")).toMatch(
			/font-weight: 600/
		);
		expect(css('../install_card.css')).not.toMatch(/\.anyink-quote\s*{/);
		expect(css('../use_in_word_dialog.css')).not.toMatch(/\.anyink-quote\s*{/);
		expect(css('../../help/help_page.css')).not.toMatch(/\.anyink-quote\s*{/);
	});

	it('Help, the card and Use in Word turn it on', () => {
		setModeForTests('simple');
		setFeaturesForTests({ useInWord: true, help: true });
		const help = makeHelpPage({ editor: sampleEditor(), isOn: () => true });
		expect(help.dataset.anyinkQuotes).toBe('bold');
		const card = makeInstallCard({ kind: 'test', fileName: 'A-Test1.otf', family: 'A Test 1' });
		expect(card.dataset.anyinkQuotes).toBe('bold');
		openUseInWord({ editor: openBrennanHand() });
		const dialog = document.querySelector('dialog[data-anyink-dialog="useInWord"]');
		expect(dialog.dataset.anyinkQuotes).toBe('bold');
	});

	it('the made line and the folder line are not bold all the way through', () => {
		expect(rule(css('../install_card.css'), '.anyink-install-card__made')).not.toMatch(
			/font-weight: 600/
		);
		expect(rule(css('../use_in_word_dialog.css'), '.anyink-use-in-word__folder')).not.toMatch(
			/font-weight: 600/
		);
	});
});
