// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: <anyink-coach>, the Next line (UX-BEGINNER.md 4.0), the second row of Simple's top bar.
	It holds one sentence, at most one button, a quiet "Something else" and "x", and a quiet
	"Tip:" when a tip shows. B6 + B7 fix pass (D-036 "Revisit if"): the tip sits beside the
	sentence in the one row, not on a line of its own under it, so there is no empty band under
	the sentence on screens with no tip, and a tip coming or going never moves the page (its
	room in the row is kept; a long tip wraps to two short lines inside the row's fixed height,
	and the whole tip is its tooltip). Registered in src/app/main.js registerCustomComponents;
	B6's top bar puts it under the bar on every editor screen, with makeNextChip() at the end of
	the rail.

	  - The words come from rules.js through the coach (coach_state.js), which keeps the state,
	    so a top bar rebuilt on every navigate draws the line again at once (no frame's wait).
	  - The button is the screen's one green button (.anyink-primary) unless a card, overlay or
	    dialog already shows one; then it is outlined (principle 1). The element reads the page
	    for those (dom_probe.js) whenever the page changes under it.
	  - Pressing the button runs its action in the press (actions.js), so a picker it opens
	    keeps the click. Something else skips the suggestion (skips.js); "x" hides the line
	    for the session and the chip brings it back.
	  - Light DOM, so the one-green count (9.4) and the banned-word scan read it like the rest
	    of the page. Sentence case; every color a token (coach.css).

	  CoachElement            the element; .coach is the coach it draws (default: the app's,
	                          started on first connect); render(); checkScreen()
	  makeNextChip(coach)     the "Next" chip for the rail: shows only while the line is hidden
*/
import { word, wordEntry } from '../words/words.js';
import { runCoachAction } from './actions.js';
import { getCoach } from './coach_state.js';
import { probeScreen } from './dom_probe.js';
import { repeatsSentence } from './tips.js';
import './coach.css';

/** What can show or hide a dialog or a green button */
const OBSERVED_ATTRIBUTES = ['class', 'hidden', 'style', 'open', 'data-anyink-hidden'];

/**
 * @param {String} tag
 * @param {String} className
 * @param {Object<String, String>} [attributes]
 * @returns {HTMLElement}
 */
function make(tag, className, attributes = {}) {
	const element = document.createElement(tag);
	element.className = className;
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	return element;
}

/** @param {Node} node @param {String} text */
function setText(node, text) {
	if (node.textContent !== text) node.textContent = text;
}

/** @param {String} key @returns {String} the key's hint, '' for none */
const hintOf = (key) => wordEntry(key)?.hint || '';

export class CoachElement extends HTMLElement {
	constructor() {
		super();
		/** @type {Object | null} */
		this.ownCoach = null;
		/** @type {Function | null} */
		this.unsubscribe = null;
		/** @type {MutationObserver | null} */
		this.observer = null;
		this.lastScreen = '';
		this.checkQueued = false;
		/** @type {Object | null} */
		this.parts = null;
	}

	/** @returns {Object} the coach this line draws */
	get coach() {
		if (!this.ownCoach) this.ownCoach = getCoach();
		return this.ownCoach;
	}

	set coach(value) {
		const listening = !!this.unsubscribe;
		if (listening) this.disconnectedCallback();
		this.ownCoach = value || null;
		if (listening && this.isConnected) this.connectedCallback();
	}

	connectedCallback() {
		if (!this.parts) this.build();
		const coach = this.coach;
		if (typeof coach.isStarted === 'function' && !coach.isStarted()) coach.start();
		this.unsubscribe?.();
		this.unsubscribe = coach.subscribe(() => this.render());
		this.watchScreen();
		this.lastScreen = JSON.stringify(probeScreen());
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.observer?.disconnect();
		this.observer = null;
	}

	/** The parts, made once; render() only changes their words and classes. */
	build() {
		this.setAttribute('role', 'region');
		this.setAttribute('aria-label', word('coach.region'));
		const row = make('div', 'anyink-coach__row');
		const label = make('span', 'anyink-coach__label');
		label.textContent = word('coach.next');
		const sentence = make('span', 'anyink-coach__sentence', { 'aria-live': 'polite' });
		const button = make('button', 'anyink-coach__button', { type: 'button' });
		button.addEventListener('click', () => this.press());
		const other = make('button', 'anyink-coach__else', {
			type: 'button',
			title: hintOf('coach.somethingElse'),
		});
		other.textContent = word('coach.somethingElse');
		other.addEventListener('click', () => this.coach.skip());
		const hide = make('button', 'anyink-coach__hide', {
			type: 'button',
			'aria-label': word('coach.hide'),
			title: word('coach.hide'),
		});
		hide.textContent = '×';
		hide.addEventListener('click', () => this.coach.hide());
		const tip = make('span', 'anyink-coach__tip');
		const tipLabel = make('span', 'anyink-coach__tip-label');
		tipLabel.textContent = word('coach.tipLabel');
		const tipText = make('span', 'anyink-coach__tip-text');
		tip.append(tipLabel, ' ', tipText);
		// the tip beside the sentence, in the row's free room before the button
		row.append(label, sentence, tip, button, other, hide);
		this.append(row);
		this.parts = { label, sentence, button, other, hide, tip, tipText };
	}

	/** Draws the line the coach has now. */
	render() {
		if (!this.parts) this.build();
		const coach = this.coach;
		const line = coach.line();
		const { label, sentence, button, other, hide, tip, tipText } = this.parts;
		this.hidden = coach.isHidden();
		this.dataset.rule = String(line.rule);
		label.hidden = !line.label;
		setText(sentence, line.sentence);
		button.hidden = !line.button;
		setText(button, line.button);
		if (line.button) button.title = line.button;
		button.classList.toggle('anyink-primary', !!line.button && line.primary);
		button.classList.toggle('anyink-coach__button--outlined', !!line.button && !line.primary);
		if (line.action) button.dataset.coachAction = line.action;
		else delete button.dataset.coachAction;
		other.hidden = !line.somethingElse;
		hide.hidden = !line.sentence;
		const current = coach.tips?.current?.() || null;
		const showTip = !!current && !!line.sentence && !repeatsSentence(current.text, line.sentence);
		tip.hidden = !showTip;
		setText(tipText, showTip ? current.text : '');
		if (showTip) tip.title = current.text;
		else tip.removeAttribute('title');
	}

	/** The button: its action, in the press. */
	press() {
		const line = this.coach.line();
		if (!line.action) return;
		runCoachAction(line.action, line.args, { editor: this.coach.editor?.() ?? null });
	}

	/**
	 * Looks at the page again: a dialog or another green button came or went. The coach then
	 * works the line out again.
	 */
	checkScreen() {
		this.checkQueued = false;
		const screen = JSON.stringify(probeScreen());
		if (screen === this.lastScreen) return;
		this.lastScreen = screen;
		this.coach.refresh();
	}

	/** Watches the page for dialogs and green buttons (not this line's own changes). */
	watchScreen() {
		this.observer?.disconnect();
		this.observer = null;
		if (typeof MutationObserver === 'undefined' || !document.body) return;
		this.observer = new MutationObserver((records) => {
			if (records.every((record) => this.contains(record.target))) return;
			if (this.checkQueued) return;
			this.checkQueued = true;
			queueMicrotask(() => this.checkScreen());
		});
		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: OBSERVED_ATTRIBUTES,
		});
	}
}

/**
 * The "Next" chip at the end of the rail (4.0): shown only while the line is hidden; a press
 * brings the line back. A chip the rebuilt top bar dropped lets go of the coach at its next
 * change.
 * @param {Object} [coach] - default: the app's coach
 * @returns {HTMLButtonElement}
 */
export function makeNextChip(coach = getCoach()) {
	const chip = /** @type {HTMLButtonElement} */ (
		make('button', 'anyink-coach-chip', { type: 'button', title: hintOf('coach.chip') })
	);
	chip.textContent = word('coach.chip');
	let wasShown = false;
	const update = () => {
		if (chip.isConnected) wasShown = true;
		else if (wasShown) {
			stop();
			return;
		}
		chip.hidden = !coach.isHidden();
	};
	const stop = coach.subscribe(update);
	chip.addEventListener('click', () => coach.show());
	update();
	return chip;
}
