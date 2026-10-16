// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 acceptance (impatient run): on the touching "na" part named n, step C said "This part may
// be two letters that touch..." but the green button stayed Use it, so a press without reading
// made "na" his n. Now [Draw a box] is the one green button there and Use it is plain (still
// there: a part the finder got wrong can be used). Written to fail on the code before the fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { word } from '../../words/words.js';
import { closePhotoCard, makePhotoCard, resetPhotoCardForTests } from '../photo_card.js';
import { stepNotes } from '../photo_flow_notes.js';
import { resetPhotoFlowForTests } from '../photo_flow_state.js';
import { greens, photoOn, shown } from './photo_dialog_fixture.js';

const two = { key: 'photoFlow.note.twoLetters', vars: {} };
const result = (notes) => ({ step: 'result', char: 'n', status: 'ready', notes });
/** The one green button that shows is this one. */
const expectGreen = (card, name) => {
	const green = greens();
	expect(green.map((b) => b.getAttribute('data-anyink-photo-card-action'))).toEqual([name]);
	expect(green[0]).toBe(button(card, name));
};
const button = (card, name) =>
	card.element.querySelector(`[data-anyink-photo-card-action="${name}"]`);

beforeEach(() => {
	photoOn();
	resetPhotoCardForTests();
});
afterEach(() => {
	closePhotoCard();
	resetPhotoFlowForTests();
	document.body.innerHTML = '';
});

describe('step C on a part that may be two letters', () => {
	it('[Draw a box] is the one green button; Use it shows, plain', () => {
		const handlers = { onUseIt: vi.fn(), onDrawBox: vi.fn() };
		const card = makePhotoCard(result([two]), handlers);
		document.body.appendChild(card.element);
		expectGreen(card, 'drawBox');
		expect(shown(button(card, 'useIt'))).toBe(true);
		expect(button(card, 'useIt').classList.contains('anyink-outlined')).toBe(true);
		expect(card.state().green).toBe('photo.card.drawBox');
		expect(word(card.state().green)).toBe(word('photoFlow.button.drawBox'));
	});

	it('any other result keeps Use it green', () => {
		const card = makePhotoCard(result([]), {});
		document.body.appendChild(card.element);
		expectGreen(card, 'useIt');
		card.update(result([two]));
		expectGreen(card, 'drawBox');
		card.update(result([]));
		expectGreen(card, 'useIt');
	});
});

describe('the note itself (photo_flow_notes.js)', () => {
	// B r e (na) H d, as the first-timer wrote them: the "na" part is 236 x 166
	const record = {
		parts: [
			{ id: 'p1', left: 261, top: 176, right: 484, bottom: 396, row: 0 },
			{ id: 'p2', left: 594, top: 317, right: 668, bottom: 421, row: 0 },
			{ id: 'p3', left: 757, top: 277, right: 884, bottom: 428, row: 0 },
			{ id: 'p4', left: 986, top: 261, right: 1222, bottom: 427, row: 0 },
			{ id: 'p5', left: 1411, top: 160, right: 1644, bottom: 493, row: 0 },
			{ id: 'p6', left: 1753, top: 239, right: 1870, bottom: 445, row: 0 },
		],
		used: {},
		skipped: [],
	};

	it('a wide part named m or w is one wide letter: no note, so Use it stays green', () => {
		expect(stepNotes({ record, partId: 'p4', char: 'n' })).toEqual([two]);
		for (const char of ['m', 'w', 'M', 'W']) {
			expect(stepNotes({ record, partId: 'p4', char }), char).toEqual([]);
		}
	});

	it('twice as wide as the others or more, even a W is two letters (the "VW" of the notebook page)', () => {
		const wide = structuredClone(record);
		wide.parts[3].right = 986 + 2.3 * 127;
		expect(stepNotes({ record: wide, partId: 'p4', char: 'W' })).toEqual([two]);
	});
});
