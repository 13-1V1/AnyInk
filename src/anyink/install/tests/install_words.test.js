// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14: every Use in Word screen says no banned word (UX-BEGINNER.md 2.3, strict 2.4 E and G):
// the dialog before the file is made (its notes and the blocked line), the folder Chrome won't let
// it write, and the install card with every closed part open. Windows' and Word's labels and the
// file names are quotes, the scan's one exemption.
import { afterEach, beforeEach } from 'vitest';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { fakeApi } from '../../files/tests/fakes.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { makeInstallCard } from '../install_card.js';
import { closeUseInWord, openUseInWord } from '../use_in_word_dialog.js';
import { openBrennanHand } from './install_fixture.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

beforeEach(() => setFeaturesForTests({ useInWord: true, alternates: true }));
afterEach(() => {
	closeUseInWord();
	document.body.innerHTML = '';
});

const dialog = () => document.querySelector('dialog[data-anyink-dialog="useInWord"]');

scanSimpleScreen('Use in Word, before the file is made, with a letter that blocks it', () => {
	const editor = openBrennanHand({ strayInA: true });
	openUseInWord({ editor });
	dialog().querySelector('[data-anyink-install-action="make"]').click();
	return dialog();
});

scanSimpleScreen("Use in Word, a folder it can't write to", () => {
	const editor = openBrennanHand();
	const view = openUseInWord({ editor });
	view.setPhase('notWritable', 'test');
	return dialog();
});

scanSimpleScreen('Use in Word, the install card with every part open', () => {
	const card = makeInstallCard({
		kind: 'test',
		name: 'Brennan Hand',
		fileName: 'BrennanHand-Test3.otf',
		family: 'Brennan Hand Test 3',
		finalFamily: 'Brennan Hand',
		folder: 'My Fonts',
		downloaded: false,
		earlier: { number: 2, family: 'Brennan Hand Test 2' },
		number: 3,
		gapFixes: true,
		versions: true,
	});
	card.querySelectorAll('details').forEach((details) => {
		details.open = true;
	});
	document.body.appendChild(card);
	return card;
});

scanSimpleScreen('Use in Word, the final font card from a download', () => {
	const card = makeInstallCard({
		kind: 'final',
		name: 'Brennan Hand',
		fileName: 'BrennanHand-Regular.otf',
		family: 'Brennan Hand',
		finalFamily: 'Brennan Hand',
		folder: '',
		downloaded: true,
		earlier: null,
		number: null,
		gapFixes: false,
		versions: false,
	});
	card.querySelectorAll('details').forEach((details) => {
		details.open = true;
	});
	document.body.appendChild(card);
	return card;
});

// fix pass: the screens the critic pass added
scanSimpleScreen('Use in Word, a font with no letter made', () => {
	const editor = openBrennanHand({ empty: true });
	openUseInWord({ editor });
	return dialog();
});

scanSimpleScreen('Use in Word, the folder picker closed with nothing picked', async () => {
	const editor = openBrennanHand();
	setFileApi(
		fakeApi({
			open: undefined,
			save: undefined,
			directory: Object.assign(new Error('closed'), { name: 'AbortError' }),
		})
	);
	openUseInWord({ editor });
	dialog().querySelector('[data-anyink-install-action="pick"]').click();
	for (let i = 0; i < 100 && !dialog().querySelector('[data-anyink-install-note="folder"]'); i++) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	resetFileApi();
	return dialog();
});
