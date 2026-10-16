// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: <anyink-coach>, the Next line (UX-BEGINNER.md 4.0): one sentence, at most one button, a
// quiet "Something else" and "x"; the button green unless a card, overlay or dialog already
// shows a green button (principle 1), and gone for rules 1, 2, 3, 5 and 8; the Tip line under
// the sentence; a rebuilt top bar draws it at once; the "Next" chip brings a hidden line back.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { resetCoachActionsForTests, setCoachAction } from '../actions.js';
import { CoachElement, makeNextChip } from '../coach_element.js';
import { makeCoach } from '../coach_state.js';
import { ALL_FLAGS, fakeState } from './fake_state.js';

const SEVEN = 'BrenaHd';

/** A coach on a fake font whose state the test changes */
function fakeCoach(initial) {
	let state = initial;
	const queue = [];
	const coach = makeCoach({
		getEditor: () => null,
		deriveState: () => state,
		schedule: (fn) => queue.push(fn),
		listen: false,
	});
	coach.set = (next) => {
		state = next;
		coach.refresh();
		queue.splice(0).forEach((fn) => fn());
	};
	coach.run = () => queue.splice(0).forEach((fn) => fn());
	return coach;
}

/** @returns {CoachElement} */
function mount(coach) {
	const element = /** @type {CoachElement} */ (document.createElement('anyink-coach'));
	element.coach = coach;
	document.body.appendChild(element);
	return element;
}

const sentenceOf = (el) => el.querySelector('.anyink-coach__sentence').textContent;
const buttonOf = (el) => el.querySelector('.anyink-coach__button');
const shown = (node) => !!node && !node.hidden;

beforeAll(() => {
	if (!customElements.get('anyink-coach')) customElements.define('anyink-coach', CoachElement);
});
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	setModeForTests('simple');
	setFeaturesForTests({ coach: true });
});
afterEach(() => {
	resetCoachActionsForTests();
	document.body.innerHTML = '';
});

describe('<anyink-coach>', () => {
	it('draws the sentence after "Next:", and its button as the one green button', () => {
		const coach = fakeCoach(
			fakeState({ ready: 'B', hasPhoto: true, photos: [{ id: 'p', unused: 6 }] })
		);
		const el = mount(coach);
		expect(el.getAttribute('role')).toBe('region');
		expect(el.getAttribute('aria-label')).toBe('What to do next');
		expect(el.querySelector('.anyink-coach__label').textContent).toBe('Next:');
		expect(sentenceOf(el)).toBe('This photo has 6 more letters.');
		expect(buttonOf(el).textContent).toBe('Do the next one');
		expect(buttonOf(el).classList.contains('anyink-primary')).toBe(true);
		expect(el.querySelectorAll('.anyink-primary')).toHaveLength(1);
		expect(el.dataset.rule).toBe('12');
	});

	it("rule 15's sentence carries its own Next:, so the label steps aside", () => {
		const el = mount(fakeCoach(fakeState({ ready: SEVEN, tryItText: 'Brennan Hand' })));
		expect(sentenceOf(el)).toBe('Next: small b.');
		expect(shown(el.querySelector('.anyink-coach__label'))).toBe(false);
		expect(buttonOf(el).textContent).toBe('Make b');
	});

	it('no button for rules 1, 2, 3, 5 and 8; rule 1 leaves the line empty', () => {
		const coach = fakeCoach(fakeState({ page: 'letter', current: 'B' }));
		const el = mount(coach);
		expect(el.dataset.rule).toBe('8');
		expect(shown(buttonOf(el))).toBe(false);
		expect(el.querySelectorAll('.anyink-primary')).toHaveLength(0);
		coach.set(fakeState({ dialog: 'howCard' }));
		expect(el.dataset.rule).toBe('1');
		expect(sentenceOf(el)).toBe('');
		expect(shown(el.querySelector('.anyink-coach__label'))).toBe(false);
		expect(shown(el.querySelector('.anyink-coach__else'))).toBe(false);
	});

	it('outlined, not green, while a card on screen shows a green button (one-green rule)', () => {
		const coach = fakeCoach(fakeState({ ready: 'a', save: 'not-saved' }));
		const el = mount(coach);
		expect(buttonOf(el).classList.contains('anyink-primary')).toBe(true);
		const card = document.createElement('div');
		card.innerHTML = '<button class="anyink-primary">Use the same photo</button>';
		document.body.appendChild(card);
		el.checkScreen();
		coach.run();
		expect(buttonOf(el).textContent).toBe('Save');
		expect(buttonOf(el).classList.contains('anyink-primary')).toBe(false);
		expect(buttonOf(el).classList.contains('anyink-coach__button--outlined')).toBe(true);
		expect(document.querySelectorAll('.anyink-primary')).toHaveLength(1);
		card.hidden = true;
		el.checkScreen();
		coach.run();
		expect(buttonOf(el).classList.contains('anyink-primary')).toBe(true);
	});

	it('an open ANY-INK dialog on screen empties the line (rule 1)', () => {
		const coach = fakeCoach(fakeState({ ready: 'a', save: 'not-saved' }));
		const el = mount(coach);
		const dialog = document.createElement('div');
		dialog.dataset.anyinkDialog = 'useInWord';
		document.body.appendChild(dialog);
		el.checkScreen();
		coach.run();
		expect(el.dataset.rule).toBe('1');
		expect(sentenceOf(el)).toBe('');
	});

	it('the button runs its action with its args, in the press', () => {
		const go = vi.fn();
		setCoachAction('goToLetter', go);
		const el = mount(fakeCoach(fakeState({ ready: 'a' })));
		buttonOf(el).click();
		expect(go).toHaveBeenCalledWith({ char: 'b' }, expect.objectContaining({ editor: null }));
	});

	it('Something else moves to the next suggestion, and shows only when there is one', () => {
		const coach = fakeCoach(fakeState({ ready: 'a', save: 'not-saved' }));
		const el = mount(coach);
		const other = el.querySelector('.anyink-coach__else');
		expect(other.textContent).toBe('Something else');
		expect(shown(other)).toBe(true);
		other.click();
		expect(sentenceOf(el)).toBe('Next: small b.');
		coach.set(fakeState({ dialog: 'howCard' }));
		expect(shown(other)).toBe(false);
	});

	it('"x" hides the line for the session; the Next chip brings it back', () => {
		const coach = fakeCoach(fakeState({ ready: 'a' }));
		const el = mount(coach);
		const chip = makeNextChip(coach);
		document.body.appendChild(chip);
		expect(chip.hidden).toBe(true);
		const hide = el.querySelector('.anyink-coach__hide');
		expect(hide.getAttribute('aria-label')).toBe('Hide the next step');
		hide.click();
		expect(el.hidden).toBe(true);
		expect(chip.hidden).toBe(false);
		expect(chip.textContent).toBe('Next');
		chip.click();
		expect(el.hidden).toBe(false);
		expect(chip.hidden).toBe(true);
	});

	it('the Tip line sits under the sentence and goes after his next action', async () => {
		const coach = fakeCoach(fakeState({ ready: 'a' }));
		const el = mount(coach);
		const tip = el.querySelector('.anyink-coach__tip');
		expect(shown(tip)).toBe(false);
		coach.tips.show('pointPen');
		coach.run();
		expect(shown(tip)).toBe(true);
		expect(tip.textContent).toBe(
			'Tip: Click to drop points. Hold and drag to bend the curve. Click the first point to finish.'
		);
		coach.note('action'); // the press that picked the tool
		coach.run();
		expect(shown(tip)).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		coach.note('action'); // his next press
		coach.run();
		expect(shown(tip)).toBe(false);
	});

	// B6 + B7 fix pass (first-timer 02, 06, 15, 16): with no tip, the room kept for the Tip line
	// was an empty band under the sentence on every screen. The tip sits beside the sentence
	// now, in the one row, so there is no second line to keep (D-036 "Revisit if")
	it('the tip sits beside the sentence in the one row; there is no second line', () => {
		const coach = fakeCoach(fakeState({ ready: 'a' }));
		const el = mount(coach);
		const row = el.querySelector('.anyink-coach__row');
		expect([...el.children]).toEqual([row]);
		const tip = row.querySelector(':scope > .anyink-coach__tip');
		expect(tip).not.toBe(null);
		const order = [...row.children].map((child) => child.className.split(' ')[0]);
		expect(order.indexOf('anyink-coach__tip')).toBe(order.indexOf('anyink-coach__sentence') + 1);
		coach.tips.show('pointPen');
		coach.run();
		expect(shown(tip)).toBe(true);
		// the whole tip is its tooltip, for when the row is too narrow to show it all
		expect(tip.title).toBe(
			'Click to drop points. Hold and drag to bend the curve. Click the first point to finish.'
		);
	});

	it('a rebuilt top bar draws the line at once, with no wait for a frame', () => {
		const coach = fakeCoach(fakeState({ ready: 'a', save: 'not-saved' }));
		mount(coach).remove();
		const again = mount(coach);
		expect(sentenceOf(again)).toBe("Your work isn't saved yet.");
		expect(buttonOf(again).textContent).toBe('Save');
	});

	it('stops listening when it leaves the page', () => {
		const coach = fakeCoach(fakeState({ ready: 'a' }));
		const el = mount(coach);
		el.remove();
		const render = vi.spyOn(el, 'render');
		coach.set(fakeState({ ready: 'a', save: 'not-saved' }));
		expect(render).not.toHaveBeenCalled();
	});

	it('S3 integration: a line with a quiet second button draws it in place of "Something else"; a press runs its action', () => {
		const run = vi.fn();
		setCoachAction('sketchJustThisOne', run);
		const sketch = {
			pieceOpen: false,
			gap: false,
			centerInk: true,
			thickness: 120,
			fontThickness: 120,
			differ: 4,
			sketched: 5,
			canUseOnAll: true,
			canClose: false,
			offer: { count: 5, thickness: 120 },
		};
		const coach = fakeCoach(
			fakeState({ page: 'letter', current: 'n', ready: 'n', sketch, flags: ALL_FLAGS })
		);
		const el = mount(coach);
		expect(el.dataset.rule).toBe('25');
		const quiet = el.querySelector('.anyink-coach__quiet');
		expect(shown(quiet)).toBe(true);
		expect(quiet.textContent).toBe('Just this one');
		expect(quiet.classList.contains('anyink-primary')).toBe(false);
		expect(shown(el.querySelector('.anyink-coach__else'))).toBe(false);
		expect(el.querySelectorAll('.anyink-primary')).toHaveLength(1);
		quiet.click();
		expect(run).toHaveBeenCalledTimes(1);
		coach.set(fakeState({ ready: 'a', save: 'not-saved' }));
		expect(shown(el.querySelector('.anyink-coach__quiet'))).toBe(false);
	});
});
