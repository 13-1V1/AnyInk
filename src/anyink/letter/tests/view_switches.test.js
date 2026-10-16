// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 view switches (UX-BEGINNER.md 4.3 Canvas): "Fine-tune this letter" is closed by default and
	hides the edges, the neighbors and the extra tools until it is opened; a tool key for a tool
	inside Fine-tune opens it (7.6); the four switches (Dark paper, Outline only, Neighbors, Guide
	letter) show what they say; toggling Neighbors never marks the work file changed (looking
	around is never a change, 7.3). All tools, and Simple before B7's flag, hide nothing.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSaveStatus } from '../../files/save_status.js';
import { openFineTune } from '../../mode/doors.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { getDirtyGeneration } from '../../recovery/recovery.js';
import { getCanvasTheme, setCanvasTheme, toggleCanvasTheme } from '../../theme/theme.js';
import { word } from '../../words/words.js';
import { square } from '../../history/tests/two_letters.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import {
	FINE_TUNE_PARTS,
	fineTuneShows,
	isFineTuneOpen,
	isGuideLetterOn,
	isNeighborsOn,
	makeViewSwitches,
	noteLetterOpened,
	refreshViewSwitches,
	resetLetterViewForTests,
	setFineTuneOpen,
	setGuideLetter,
	setNeighbors,
	switchStates,
} from '../view_switches.js';

// S4 turned 'sketch' on; these tests read Simple as B16 shipped it, with the
// flag off (the sketch's own column, keys and door are the S2 / S3 tests)
beforeEach(() => {
	setFeaturesForTests({ sketch: false });
});

/** A letter with ink, and one with none */
const inked = { id: 'glyph-0x61', shapes: [{}] };
const empty = { id: 'glyph-0x62', shapes: [] };

const simpleLetterView = () => {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
};

let theme;
beforeEach(() => {
	resetLetterViewForTests();
	theme = getCanvasTheme();
});
afterEach(() => {
	setCanvasTheme(theme, { remember: false });
	document.body.innerHTML = '';
});

describe('Fine-tune is closed by default and hides edges, neighbors and the extra tools', () => {
	it('closed: nothing of Fine-tune shows in Simple with the letter view', () => {
		simpleLetterView();
		expect(isFineTuneOpen()).toBe(false);
		FINE_TUNE_PARTS.forEach((part) => expect(fineTuneShows(part, inked), part).toBe(false));
	});

	it('open: the edges, the neighbors, the extra tools and the switches show', () => {
		simpleLetterView();
		setFineTuneOpen(true);
		FINE_TUNE_PARTS.forEach((part) => expect(fineTuneShows(part, inked), part).toBe(true));
	});

	it('an empty letter has no Fine-tune section: only its tools show (they put the ink there)', () => {
		simpleLetterView();
		setFineTuneOpen(true);
		expect(fineTuneShows('tools', empty)).toBe(true);
		['edges', 'neighbors', 'switches'].forEach((part) =>
			expect(fineTuneShows(part, empty), part).toBe(false)
		);
	});

	it('the Neighbors switch turns only the neighbors off', () => {
		simpleLetterView();
		setFineTuneOpen(true);
		setNeighbors(false);
		expect(fineTuneShows('neighbors', inked)).toBe(false);
		expect(fineTuneShows('edges', inked)).toBe(true);
		expect(fineTuneShows('tools', inked)).toBe(true);
	});

	it('All tools, and Simple before the letter view lands, hide nothing', () => {
		setModeForTests('all');
		setFeaturesForTests({ letterView: true });
		FINE_TUNE_PARTS.forEach((part) => expect(fineTuneShows(part, empty), part).toBe(true));
		setModeForTests('simple');
		setFeaturesForTests({ letterView: false });
		FINE_TUNE_PARTS.forEach((part) => expect(fineTuneShows(part, empty), part).toBe(true));
	});

	it('an unknown part is never hidden by Fine-tune', () => {
		simpleLetterView();
		expect(() => fineTuneShows('photo', inked)).toThrow(/fineTuneShows/);
	});

	it('a tool key for a tool inside Fine-tune opens it (doors.js)', () => {
		simpleLetterView();
		openFineTune('newRectangle');
		expect(isFineTuneOpen()).toBe(true);
	});

	it('opening or closing tells the editor once, as a view change (the canvas redraws)', () => {
		simpleLetterView();
		const editor = { publish: vi.fn(), view: { dx: 1, dy: 2, dz: 0.5 } };
		expect(setFineTuneOpen(true, editor)).toBe(true);
		expect(setFineTuneOpen(true, editor)).toBe(false);
		expect(editor.publish).toHaveBeenCalledTimes(1);
		expect(editor.publish).toHaveBeenCalledWith('editCanvasView', editor.view);
	});

	it('stays as he left it for the session (another letter keeps it open)', () => {
		simpleLetterView();
		setFineTuneOpen(true);
		noteLetterOpened({ id: 'glyph-0x61', shapes: [] });
		noteLetterOpened({ id: 'glyph-0x62', shapes: [{}] });
		expect(isFineTuneOpen()).toBe(true);
	});
});

describe('the guide letter', () => {
	it('shows on a letter that was empty when opened, and stays while he draws', () => {
		simpleLetterView();
		const a = { id: 'glyph-0x61', shapes: [] };
		noteLetterOpened(a);
		expect(isGuideLetterOn(a)).toBe(true);
		a.shapes.push({});
		expect(isGuideLetterOn(a)).toBe(true);
	});

	it('is off on a letter that had ink, until he turns it on for this visit', () => {
		simpleLetterView();
		const b = { id: 'glyph-0x62', shapes: [{}] };
		expect(isGuideLetterOn(b)).toBe(false);
		setGuideLetter(true);
		expect(isGuideLetterOn(b)).toBe(true);
		// leaving the letter ends the visit
		noteLetterOpened({ id: 'glyph-0x63', shapes: [{}] });
		expect(isGuideLetterOn(b)).toBe(false);
	});

	it('never shows in All tools', () => {
		setModeForTests('all');
		setFeaturesForTests({ letterView: true });
		expect(isGuideLetterOn({ id: 'glyph-0x61', shapes: [] })).toBe(false);
	});
});

describe('the four switches', () => {
	const open = () => {
		simpleLetterView();
		const editor = sampleEditor();
		editor.nav.page = 'Characters';
		// Capital A has ink in the sample (the switches live in Fine-tune, which needs ink)
		editor.selectedGlyphID = 'glyph-0x41';
		setFineTuneOpen(true, editor);
		const switches = makeViewSwitches(editor);
		document.body.appendChild(switches);
		return { editor, switches };
	};
	const button = (name) => document.querySelector(`[data-anyink-switch="${name}"]`);

	it('are real on/off switches named for what they show', () => {
		const { switches } = open();
		const buttons = [...switches.querySelectorAll('[role="switch"]')];
		expect(buttons.map((b) => b.dataset.anyinkSwitch)).toEqual([
			'darkPaper',
			'outlineOnly',
			'neighbors',
			'guideLetter',
		]);
		expect(buttons.map((b) => b.textContent.trim())).toEqual([
			word('view.canvasTheme'),
			word('view.displayMode'),
			word('letter.switch.neighbors'),
			word('letter.switch.guideLetter'),
		]);
		buttons.forEach((b) => expect(['true', 'false']).toContain(b.getAttribute('aria-checked')));
	});

	// B6 + B7 integration: the letter in words (2.2), and the same neighbor the canvas draws
	// (neighbors.js neighborChar: a number stands beside his H)
	it('the Neighbors tooltip names his H on a capital or a number and his n on a small letter', () => {
		const { editor } = open();
		expect(button('neighbors').title).toBe(
			word('letter.switch.neighborsTip', { letter: 'Capital H' })
		);
		const tipOn = (id) => {
			editor.selectedGlyphID = id;
			return makeViewSwitches(editor).querySelector('[data-anyink-switch="neighbors"]').title;
		};
		expect(tipOn('glyph-0x61')).toBe(word('letter.switch.neighborsTip', { letter: 'small n' }));
		expect(tipOn('glyph-0x37')).toBe(word('letter.switch.neighborsTip', { letter: 'Capital H' }));
	});

	// B6 + B7 integration (4.3: "on by default once n or H is ready"; a section shows only when it
	// applies): with no ready n or H there is nothing for the switch to show, so it isn't there
	it('the Neighbors switch shows only once his n or H is ready', () => {
		const { editor, switches } = open(); // the sample font has no H
		expect(button('neighbors').hidden).toBe(true);
		const H = editor.project.getItem('glyph-0x48', true);
		H.addOneShape(square());
		H.advanceWidth = 600;
		refreshViewSwitches(switches);
		expect(button('neighbors').hidden).toBe(false);
	});

	it('show only while Fine-tune is open on a letter with ink', () => {
		const { editor, switches } = open();
		expect(switches.hidden).toBe(false);
		setFineTuneOpen(false, editor);
		refreshViewSwitches(switches);
		expect(switches.hidden).toBe(true);
		setFineTuneOpen(true, editor);
		editor.selectedGlyphID = 'glyph-0x7A'; // small z: no ink
		refreshViewSwitches(switches);
		expect(switches.hidden).toBe(true);
	});

	it('Dark paper and Outline only switch what they say', () => {
		const { editor } = open();
		setCanvasTheme('light', { remember: false });
		button('darkPaper').click();
		expect(getCanvasTheme()).toBe('dark');
		expect(button('darkPaper').getAttribute('aria-checked')).toBe('true');
		const filled = editor.project.settings.app.canvasDisplayModeFilled;
		button('outlineOnly').click();
		expect(editor.project.settings.app.canvasDisplayModeFilled).toBe(!filled);
		expect(button('outlineOnly').getAttribute('aria-checked')).toBe(String(filled));
	});

	it('Neighbors and Guide letter switch the letter view', () => {
		open();
		expect(button('neighbors').getAttribute('aria-checked')).toBe('true');
		button('neighbors').click();
		expect(isNeighborsOn()).toBe(false);
		expect(button('neighbors').getAttribute('aria-checked')).toBe('false');
		const guide = button('guideLetter').getAttribute('aria-checked');
		button('guideLetter').click();
		expect(button('guideLetter').getAttribute('aria-checked')).not.toBe(guide);
		expect(switchStates().guideLetter).toBe(guide !== 'true');
	});

	// B6 + B7 fix pass (letter-card track): Menu > Dark paper (simple_menu.js calls theme.js
	// toggleCanvasTheme) turned the paper dark while this switch still said off, and its next press
	// turned the paper light with the switch still off. Two controls with one name must agree.
	it('Dark paper from the Menu (theme.js) shows on the switch at once', () => {
		open();
		setCanvasTheme('light', { remember: false });
		expect(button('darkPaper').getAttribute('aria-checked')).toBe('false');
		toggleCanvasTheme(); // what the Menu's Dark paper row does
		expect(getCanvasTheme()).toBe('dark');
		expect(button('darkPaper').getAttribute('aria-checked')).toBe('true');
		// the next press on the switch turns it off, and the switch says so
		button('darkPaper').click();
		expect(getCanvasTheme()).toBe('light');
		expect(button('darkPaper').getAttribute('aria-checked')).toBe('false');
	});

	it('a switch group dropped with its page is let go: a theme change leaves it alone', () => {
		const { switches } = open();
		setCanvasTheme('light', { remember: false });
		switches.remove();
		const dropped = switches.querySelector('[data-anyink-switch="darkPaper"]');
		setCanvasTheme('dark', { remember: false });
		expect(dropped.getAttribute('aria-checked')).toBe('false');
	});

	it('toggling Neighbors does not mark the file changed', () => {
		const { editor } = open();
		const before = {
			dirty: getDirtyGeneration(),
			status: getSaveStatus(editor),
			steps: editor.history.queue.length,
			file: JSON.stringify(editor.project.save()),
		};
		button('neighbors').click();
		button('neighbors').click();
		expect(getDirtyGeneration()).toBe(before.dirty);
		expect(getSaveStatus(editor)).toEqual(before.status);
		expect(editor.history.queue.length).toBe(before.steps);
		expect(JSON.stringify(editor.project.save())).toBe(before.file);
	});
});
