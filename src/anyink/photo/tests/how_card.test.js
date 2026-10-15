// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-ui: the How card (docs/UX-BEGINNER.md 4.4 "The How card", section 3 at 0:01 and 0:02):
// black felt-tip on plain white paper, letters about 1 inch tall a finger's width apart, the
// letters of the Try-it text once each, the photo straight down, onto the PC by email or Phone
// Link. [I have my photo] opens the picker. Written before how_card.js existed (failed on the
// missing module).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDialogName } from '../../coach/dom_probe.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import {
	HOW_CARD_NAME,
	closeHowCard,
	howLetters,
	isHowCardOpen,
	openHowCard,
} from '../how_card.js';
import { isPhotoDialogOpen, openPhotoDialog } from '../photo_dialog.js';
import { greens, key, photoFont, photoOn } from './photo_dialog_fixture.js';

const card = () => document.querySelector('[data-anyink-dialog="howCard"]');
const steps = () => [...card().querySelectorAll('ol > li')].map((li) => li.textContent);
const action = (name) => card()?.querySelector(`[data-anyink-how-action="${name}"]`) || null;

beforeEach(() => photoOn());
afterEach(() => {
	closeHowCard();
	document.body.innerHTML = '';
});

describe('the letters of the Try-it text, once each', () => {
	it('"Brennan Hand" is B r e n a H d', () => {
		expect(howLetters('Brennan Hand')).toEqual(['B', 'r', 'e', 'n', 'a', 'H', 'd']);
	});

	it('no spaces, no repeats, capitals and small letters apart', () => {
		expect(howLetters('  Aa aA  ')).toEqual(['A', 'a']);
		expect(howLetters('')).toEqual([]);
		expect(howLetters(null)).toEqual([]);
	});
});

describe('the card', () => {
	it('says the five steps in house words, step 3 naming his letters', () => {
		openHowCard({ text: 'Brennan Hand' });
		expect(card().querySelector('h2').textContent).toBe(word('photo.how.title'));
		expect(steps()).toEqual([
			word('photo.how.pen'),
			word('photo.how.size'),
			`${word('photo.how.firstTry', { text: 'Brennan Hand', letters: 'B r e n a H d' })} ${word(
				'photo.how.orAlphabet'
			)}`,
			word('photo.how.light'),
			word('photo.how.transfer'),
		]);
		expect(steps()[0]).toContain('black felt-tip');
		expect(steps()[1]).toContain('about 1 inch tall');
		expect(steps()[1]).toContain("a finger's width between letters");
		expect(steps()[3]).toContain('straight above');
		expect(steps()[4]).toContain('email it to yourself, or use Phone Link');
	});

	// First-timer finding 4: "capitals on one line, small letters on the next" asked for about
	// 30 inches of line (26 one-inch capitals a finger apart) on an 8.5 inch page, and nothing
	// steered him off lined notebook paper, whose lines made most of the junk parts. Written
	// before the new words (failed on each).
	it('asks for plain printer paper, not lined, and the alphabet in rows, a photo of each page', () => {
		openHowCard({ text: 'Brennan Hand' });
		expect(steps()[0]).toContain('plain white printer paper, not lined notebook paper');
		expect(steps()[2]).toContain('capitals in rows, then small letters in rows');
		expect(steps()[2]).not.toContain('on one line');
		expect(steps()[3]).toContain('More than one page? Take one photo of each.');
		closeHowCard();
		openHowCard({ text: '' });
		expect(steps()[2]).toContain('capitals in rows, then small letters in rows');
		expect(steps()[2]).not.toContain('on one line');
	});

	it('with no letters to name, step 3 is the whole alphabet', () => {
		openHowCard({ text: '   ' });
		expect(steps()[2]).toBe(word('photo.how.alphabet'));
	});

	it('is an ANY-INK dialog with one green button, I have my photo', () => {
		openHowCard({ text: 'Brennan Hand' });
		expect(isHowCardOpen()).toBe(true);
		expect(openDialogName(document)).toBe(HOW_CARD_NAME);
		expect(greens()).toEqual([action('havePhoto')]);
		expect(action('havePhoto').textContent).toBe(word('photo.how.havePhoto'));
		expect(action('close').textContent).toBe(word('photo.how.close'));
		expect(document.activeElement).toBe(action('havePhoto'));
	});

	it('opens nothing in All tools or while the photo flag is off', () => {
		setModeForTests('all');
		expect(openHowCard({ text: 'a' })).toBe(null);
		setModeForTests('simple');
		setFeaturesForTests({ photo: false });
		expect(openHowCard({ text: 'a' })).toBe(null);
		expect(card()).toBe(null);
	});
});

describe('I have my photo', () => {
	it('opens the picker inside the press itself (the browser keeps the click)', () => {
		let inPress = false;
		const onHavePhoto = vi.fn(() => {
			inPress = true;
		});
		openHowCard({ text: 'a', onHavePhoto });
		action('havePhoto').addEventListener('click', () => expect(inPress).toBe(true));
		action('havePhoto').click();
		expect(onHavePhoto).toHaveBeenCalledTimes(1);
		// nothing said whether a photo came: the card goes
		expect(card()).toBe(null);
	});

	it('a photo picked: the card goes; the picker cancelled: it stays (7.7: nothing said)', async () => {
		let answer;
		openHowCard({ text: 'a', onHavePhoto: () => new Promise((resolve) => (answer = resolve)) });
		action('havePhoto').click();
		expect(card()).not.toBe(null);
		answer(false);
		await Promise.resolve();
		await Promise.resolve();
		expect(card()).not.toBe(null);
		action('havePhoto').click();
		answer(true);
		await Promise.resolve();
		await Promise.resolve();
		expect(card()).toBe(null);
	});

	it('the photo dialog opening in its place closes it, without calling onClose', () => {
		const onClose = vi.fn();
		openHowCard({ text: 'a', onClose });
		const { record } = photoFont();
		openPhotoDialog({ record });
		expect(card()).toBe(null);
		expect(isPhotoDialogOpen()).toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});
});

describe('closing', () => {
	it('Close, the x and Escape close it and call onClose', () => {
		for (const how of ['close', 'x', 'escape']) {
			const onClose = vi.fn();
			openHowCard({ text: 'a', onClose });
			if (how === 'escape') key(document.activeElement, 'Escape');
			else action(how).click();
			expect(onClose).toHaveBeenCalledTimes(1);
			expect(card()).toBe(null);
			expect(isHowCardOpen()).toBe(false);
		}
	});
});

describe('plain words (2.3)', () => {
	scanSimpleScreen('How card, "Brennan Hand"', () => {
		openHowCard({ text: 'Brennan Hand' });
		return card();
	});
	scanSimpleScreen('How card, no Try-it letters', () => {
		openHowCard({ text: '' });
		return card();
	});
});
