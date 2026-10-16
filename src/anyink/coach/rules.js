// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the Next line's 17 rules (UX-BEGINNER.md 4.0), checked in order; the first match wins.
	Pure: a state in, one line out. coach_state.js builds the state from the editor; tests and
	tests/coach.html build it by hand (tests/fake_state.js).

	Each rule names its feature flags and is skipped while one of them is off (principle 8: no
	doors to unbuilt rooms), and the whole line says nothing while 'coach' itself is off.

	The state (every field optional except letters):
	  flags            { name: Boolean } (or isOn(name)): the feature flags
	  page             'board' (the Overview), 'letter' (the Characters page), 'other', or
	                   'start' (the app's own page: no top bar, so the line says nothing)
	  dialog           the open ANY-INK dialog ('howCard', 'photoDialog', 'useInWord',
	                   'fontDetails', or any name), or null
	  photoCard        { step: 'pick' | 'result', char, status, green } while the photo card
	                   runs (4.4 A, C); status and green (its green button's words key) say
	                   when step C has nothing to use (B8 + B9 integration)
	  tryItOpen        Try it (4.6) is open
	  otherPrimary     a card, overlay or dialog on screen already shows a green button
	  letter           the open letter (page 'letter'): { char, ink, shapes, ready, needsLook,
	                   drawing }
	  letters          every letter of the board's set: [{ char, ink, shapes, ready, needsLook,
	                   drawing }]; ink: finished shapes with an area; shapes: any finished shape
	                   (B6 + B7 finalize; when left out, ink stands for it); needsLook (B11) is
	                   { id, reason, fixLabel, action, args } or null; drawing is { points }
	                   while the Point pen has a shape open in it (open_shape.js): never ready
	                   until it is finished
	  tool             the picked tool's internal name in the letter view ('newPath', ...)
	  numbersAdded     "+ Numbers & symbols" is on
	  boardFilter      the board's filter in effect ('all', 'needsLook', 'empty'; B10 + B11
	                   integration): on Needs a look, where [Show me] would do nothing, rule 9
	                   goes through the letters one at a time in rule 7's words with the fix as
	                   its button (Something else moves to the next letter)
	  fontProblem      the font check's first problem: { itemId, problem, text, fixable }
	  fontProblems     every problem it found, in order (B6 + B7 finalize); rule 6 shows the
	                   first one not skipped
	  save             Simple's save status: 'saved', 'saving', 'not-saved', 'failed'
	  hasPhoto         some letter or photo record holds a photo
	  photos           [{ id, unused, done }]: photos with their unused parts (B9)
	  tryItText        the Try-it text (it starts as the font name)
	  changedSinceTryIt            a letter with ink changed since Try it was last opened
	  fontFileBehind               something changed since the last font file
	  lettersChangedSinceFontFile  how many letters changed since then
	  turnsUsed        Try-it letters whose one turn is used (rule 15)
	  skips            { key: stamp } from "Something else" (skips.js)

	The line: { rule, name, sentence, label, button, action, args, primary, somethingElse,
	  skipKey, stamp, letter, fromTryIt }
	  rule        1 to 18, or 0 when no rule matches (the line is empty). Rule 18 (B8 + B9
	              finalize, second hostile pass: the line went blank once every letter was
	              ready): "All 58 letters are ready." with no button, while rules 16 and 17
	              (the board, Try it) aren't built
	  sentence    one sentence ('' for rule 1: the dialog has its own green button)
	  label       true when the line shows "Next:" before the sentence (rule 15's sentences
	              carry their own "Next:")
	  button      the button's words, '' for none; action and args say what it does
	              (actions.js)
	  primary     the button is the screen's one green button: true unless otherPrimary, or the
	              rule shows its button outlined (rule 15 while the Brush is picked on a letter
	              with ink: he may still be drawing, so "looks done" and a green way on would
	              hurry him; B8 + B9 finalize)
	  somethingElse   "Something else" would show another suggestion
	  skipKey, stamp  what "Something else" remembers (skips.js)
	  letter, fromTryIt   rule 15's letter, and whether it came from the Try-it text

	  RULES          [{ id, name, flags, match(state, on), live(state, on) }]; live lists the
	                 suggestions the rule holds in the state behind it, whatever the screen
	                 shows: [[skipKey, stamp]]
	  pickLine(state)
	  liveSkips(state)   Map skipKey -> stamp of every suggestion the state holds now, for
	                 coach_state.js to end the skips whose state changed (skips.js prune)
	  MIN_READY (3), MANY_CHANGED (10)
*/
import { hexesToChars } from '../../common/character_ids.js';
import { letterName, letterPhrase, sentenceStart } from '../words/letter_name.js';
import { hasWord, labelCase, word } from '../words/words.js';
import { buttonLetter, suggestionOrder, tryItLetters } from './letter_order.js';
import { isSkippedIn } from './skips.js';

/** Rules 4, 13, 14: "3 or more letters are ready" */
export const MIN_READY = 3;
/** Rule 14: "or 10 or more letters changed" */
export const MANY_CHANGED = 10;

/** The line when nothing matches */
const EMPTY = Object.freeze({
	rule: 0,
	name: '',
	sentence: '',
	label: false,
	button: '',
	action: '',
	args: null,
	primary: false,
	somethingElse: false,
	skipKey: '',
	stamp: '',
	letter: null,
	fromTryIt: false,
});

/**
 * @param {Object} state
 * @returns {(flag: String) => Boolean}
 */
function flagsOf(state) {
	if (typeof state?.isOn === 'function') return (name) => state.isOn(name) === true;
	const flags = state?.flags || {};
	return (name) => flags[name] === true;
}

/** @returns {Array<Object>} the set's letters */
const lettersOf = (state) => (Array.isArray(state?.letters) ? state.letters : []);
/** Ready (4.2), and never while a shape in it is still being drawn */
const isReady = (letter) => !!letter?.ready && !letter.drawing;
const readyCount = (state) => lettersOf(state).filter(isReady).length;
const needsLookCount = (state) => lettersOf(state).filter((l) => !!l.needsLook).length;
const anyInk = (state) => lettersOf(state).some((l) => l.ink);
const allReady = (state) => lettersOf(state).length > 0 && lettersOf(state).every(isReady);
const noEmptyLeft = (state) => lettersOf(state).every((l) => l.ink);
const openLetter = (state) =>
	state?.page === 'letter' && state.letter?.char ? state.letter : null;
/** The open letter has a Point pen shape still open (B6 + B7 fix pass) */
const drawingOpen = (state) => !!openLetter(state)?.drawing;
/**
 * B10 + B11 finalize: the Brush is the tool on an open letter with ink (picked, or the one the
 * letter opened with once it has ink: font_facts.js). He may still be drawing, so the line never
 * gives a green button for that letter's check (rule 15's outlined variant, B8 + B9 finalize)
 */
const brushingOpen = (state) => state?.tool === 'nib' && !!openLetter(state)?.ink;
/** No finished shape (B6 + B7 finalize); a state that gives no shapes says it by its ink */
const isEmpty = (letter) => !(letter?.shapes ?? letter?.ink);

/** @returns {Number} ready letters of the Try-it text, each counted once */
function tryItReady(state) {
	const letters = lettersOf(state);
	const ready = new Set(letters.filter(isReady).map((l) => l.char));
	return tryItLetters(
		state?.tryItText,
		letters.map((l) => l.char)
	).filter((char) => ready.has(char)).length;
}

/**
 * @param {String} key - a words key
 * @param {Object} [vars]
 * @param {String} action
 * @param {Object | null} [args]
 * @returns {{label: String, action: String, args: Object | null}}
 */
const button = (key, vars, action, args = null) => ({ label: word(key, vars), action, args });

/**
 * B10 + B11 integration: the board on Needs a look (rule 9): the first letter in board order
 * whose look he hasn't skipped, in rule 7's words, with its fix; null once every one is skipped.
 * @param {Object} s - the state
 * @returns {Object | null} a rule match
 */
function nextLookOnBoard(s) {
	for (const letter of lettersOf(s)) {
		const look = letter.needsLook;
		if (!look || letter.drawing) continue;
		const skipKey = `needsLook:${letter.char}:${look.id ?? ''}`;
		const sentence = String(look.reason || '');
		if (isSkippedIn(s.skips, skipKey, sentence)) continue;
		return {
			sentence,
			button: look.fixLabel
				? {
						label: String(look.fixLabel),
						action: look.action || 'fixLetter',
						args: { char: letter.char, check: look.id ?? null, ...(look.args || {}) },
				  }
				: null,
			skipKey,
			stamp: sentence,
		};
	}
	return null;
}

/** 'Capital B', 'The period': a letter at the start of a sentence */
const startName = (char) => sentenceStart(letterPhrase(char));

/** The letter a font check id names ('glyph-0x61' -> 'a'), or '' */
function charOfItem(itemId) {
	const match = /^glyph-(0x[0-9a-f]+)$/i.exec(String(itemId || ''));
	return match ? hexesToChars(match[1]) || '' : '';
}

/**
 * @typedef {Object} Suggestion
 * @property {String} sentence
 * @property {{label: String, action: String, args: Object | null} | null} [button]
 * @property {String} skipKey
 * @property {String} [stamp]
 * @property {Boolean} [label] - default true
 * @property {String} [letter]
 * @property {Boolean} [fromTryIt]
 */

/** A shape needs 3 points to hold any ink (the font check's "a shape with only 2 points") */
export const MIN_SHAPE_POINTS = 3;

/** Rule 8: what a picked drawing tool does on an empty letter (B6 + B7 fix pass) */
const TOOL_SENTENCES = Object.freeze({
	// B8 + B9 integration: the Brush once he picked it (the Brush a letter opens with is no
	// pick of his: coach_state.js gives no tool for it, so the line still offers the photo)
	nib: 'brush.next.drag',
	newPath: 'coach.rule.drawFirstPoint',
	newRectangle: 'coach.rule.drawRectangle',
	newOval: 'coach.rule.drawOval',
});

/**
 * Rule 8 on an empty letter: the picked drawing tool's sentence, else the ways to fill a letter
 * that exist (principle 8). The stamp is the tool, so a skip ends when he picks one.
 * @param {Object} state
 * @param {(flag: String) => Boolean} on
 * @returns {{key: String, stamp: String}}
 */
function emptyLine(state, on) {
	const tool = String(state?.tool || '');
	if (Object.hasOwn(TOOL_SENTENCES, tool)) return { key: TOOL_SENTENCES[tool], stamp: tool };
	const key =
		on('photo') && on('brush')
			? 'coach.rule.emptyPhotoBrush'
			: on('photo')
			? 'coach.rule.emptyPhoto'
			: on('brush')
			? 'coach.rule.emptyBrush'
			: 'coach.rule.emptyPoints';
	return { key, stamp: '' };
}

/**
 * Rule 3's sentence (B8 + B9 integration): "Look right? Press Use it..." while there is a result
 * to use; with nothing to use (no ink in the part, or the trace failed) [Use it] is gone, so the
 * sentence names the card's green button ({ status, green } from photo_card.js).
 * @param {{status?: String, green?: String}} card
 * @returns {String}
 */
function photoResultSentence(card) {
	const stuck = card?.status === 'no-ink' || card?.status === 'error';
	if (!stuck || typeof card.green !== 'string' || !hasWord(card.green)) {
		return word('coach.rule.photoResult');
	}
	return word('coach.rule.photoStuck', { button: word(card.green) });
}

/** Rule 2's letter while the photo card is at step A, else null */
const photoPickChar = (s) =>
	s.photoCard?.step === 'pick' ? s.photoCard.char || openLetter(s)?.char || '' : null;

/** Rules 4 and 14's stamp: how many letters changed since the last font file */
const changedStamp = (s) => String(s.lettersChangedSinceFontFile || 0);

/**
 * B6 + B7 finalize: every problem the last font check found, in its order (fontProblems), or
 * the first one alone (a state that gives only fontProblem)
 * @param {Object} s
 * @returns {Array<Object>}
 */
function problemsOf(s) {
	if (Array.isArray(s?.fontProblems)) return s.fontProblems.filter(Boolean);
	return s?.fontProblem ? [s.fontProblem] : [];
}

/**
 * Rule 6's suggestion: the first problem he hasn't skipped. B6 + B7 finalize: a skip lasts while
 * another letter's problem shows first (each problem is its own suggestion), and nothing is said
 * about the font while a shape in the open letter is still being drawn: the line keeps to the
 * drawing (rule 8), whose shape the font check doesn't judge yet either.
 * @param {Object} s
 * @returns {Suggestion | null}
 */
function fontProblemLine(s) {
	if (drawingOpen(s)) return null;
	for (const problem of problemsOf(s)) {
		const line = lineForProblem(problem);
		if (!isSkippedIn(s.skips, line.skipKey, line.stamp)) return line;
	}
	return null;
}

/**
 * @param {Object} problem - { itemId, problem, text, fixable }
 * @returns {Suggestion}
 */
function lineForProblem(problem) {
	const char = charOfItem(problem.itemId);
	const sentence =
		(typeof problem.text === 'string' && problem.text.trim()) ||
		word('coach.rule.fontProblem', {
			letter: char ? startName(char) : labelCase(word('check.aLetter')),
		});
	const args = { itemId: problem.itemId ?? null, problem: problem.problem ?? null };
	return {
		sentence,
		button: problem.fixable
			? button('check.fixIt', {}, 'fixFontProblem', args)
			: button('check.showMe', {}, 'showFontProblem', args),
		skipKey: `fontProblem:${problem.itemId}:${problem.problem}`,
		stamp: sentence,
	};
}

/**
 * Rule 12: the photos with parts not used yet, and "Done with this photo" not pressed
 * @param {Object} s
 * @returns {Array<{photo: Object, count: Number}>}
 */
function photosWithParts(s) {
	const photos = Array.isArray(s.photos) ? s.photos : [];
	return photos
		.map((photo) => ({ photo, count: Math.max(0, Math.floor(Number(photo?.unused) || 0)) }))
		.filter(({ photo, count }) => count > 0 && !photo.done);
}

/** Rule 13 */
const wantsTryIt = (s) => tryItReady(s) >= MIN_READY && !!s.changedSinceTryIt;

/**
 * B16 (the alphabet-photo run: "Do the next one" never let Try it through): every letter of the
 * Try-it text is ready and Try it would be offered, so rule 13 goes before rule 12, once: until
 * Try it is opened (changedSinceTryIt) or he presses Something else on it.
 */
function tryItFirst(s, on) {
	if (typeof on === 'function' && !on('tryIt')) return false;
	if (!wantsTryIt(s) || isSkippedIn(s.skips, 'tryLetters', '')) return false;
	const letters = lettersOf(s);
	const wanted = tryItLetters(
		s.tryItText,
		letters.map((l) => l.char)
	);
	return wanted.length > 0 && tryItReady(s) === wanted.length;
}

/** Rule 14 */
const wantsFontFile = (s) =>
	readyCount(s) >= MIN_READY &&
	!!s.fontFileBehind &&
	(!s.changedSinceTryIt || (s.lettersChangedSinceFontFile || 0) >= MANY_CHANGED);

/**
 * @param {Boolean} condition
 * @param {String} key
 * @param {String} [stamp]
 * @returns {Array<[String, String]>} one live suggestion, or none
 */
const one = (condition, key, stamp = '') => (condition ? [[key, String(stamp ?? '')]] : []);

/** @type {ReadonlyArray<{id: Number, name: String, flags: Array<String>,
 *   match: (state: Object, on: Function) => Suggestion | null,
 *   live: (state: Object, on: Function) => Array<[String, String]>}>} */
export const RULES = Object.freeze([
	{
		id: 1,
		name: 'dialogOpen',
		flags: ['coach'],
		// The line is empty; the dialog has its own green button
		match: (s) => (s.dialog ? { sentence: '', skipKey: '', label: false } : null),
		live: () => [],
	},
	{
		id: 2,
		name: 'photoPick',
		flags: ['photo'],
		match: (s) => {
			const char = photoPickChar(s);
			if (char === null) return null;
			return {
				sentence: word('coach.rule.photoPick', { letter: letterName(char) }),
				skipKey: `photoPick:${char}`,
			};
		},
		live: (s) => {
			const char = photoPickChar(s);
			return one(char !== null, `photoPick:${char}`);
		},
	},
	{
		id: 3,
		name: 'photoResult',
		flags: ['photo'],
		match: (s) =>
			s.photoCard?.step === 'result'
				? {
						sentence: photoResultSentence(s.photoCard),
						skipKey: `photoResult:${s.photoCard.char || ''}`,
				  }
				: null,
		live: (s) => one(s.photoCard?.step === 'result', `photoResult:${s.photoCard?.char || ''}`),
	},
	{
		id: 4,
		name: 'tryItHappy',
		flags: ['tryIt', 'useInWord'],
		match: (s) =>
			s.tryItOpen && readyCount(s) >= MIN_READY && s.fontFileBehind
				? {
						sentence: word('coach.rule.tryItHappy'),
						button: button('coach.button.useInWord', {}, 'useInWord'),
						skipKey: 'tryItHappy',
						stamp: changedStamp(s),
				  }
				: null,
		// the state behind it is the font file being behind; Try it closing and opening again
		// doesn't change it
		live: (s) =>
			one(readyCount(s) >= MIN_READY && !!s.fontFileBehind, 'tryItHappy', changedStamp(s)),
	},
	{
		id: 5,
		name: 'tryItTyping',
		flags: ['tryIt'],
		match: (s) =>
			s.tryItOpen ? { sentence: word('coach.rule.tryItTyping'), skipKey: 'tryItTyping' } : null,
		live: (s) => one(!!s.tryItOpen, 'tryItTyping'),
	},
	{
		id: 6,
		name: 'fontProblem',
		flags: ['coach'],
		match: (s) => fontProblemLine(s),
		// every problem holds its own skip, whatever the line shows now
		live: (s) =>
			problemsOf(s).map((problem) => {
				const line = lineForProblem(problem);
				return [line.skipKey, line.stamp];
			}),
	},
	{
		id: 7,
		name: 'letterNeedsLook',
		flags: ['letterView', 'checks'],
		match: (s) => {
			const letter = openLetter(s);
			const look = letter?.needsLook;
			// B6 + B7 fix pass: a shape still being drawn is never judged
			if (!look || letter.drawing) return null;
			const sentence = String(look.reason || '');
			return {
				sentence,
				button: look.fixLabel
					? {
							label: String(look.fixLabel),
							action: look.action || 'fixLetter',
							args: { char: letter.char, check: look.id ?? null, ...(look.args || {}) },
					  }
					: null,
				skipKey: `needsLook:${letter.char}:${look.id ?? ''}`,
				stamp: sentence,
				// B10 + B11 finalize: said, never pushed, while the Brush may still be drawing
				primary: !brushingOpen(s),
			};
		},
		live: (s) =>
			lettersOf(s)
				.filter((l) => l.needsLook && !l.drawing)
				.map((l) => [
					`needsLook:${l.char}:${l.needsLook.id ?? ''}`,
					String(l.needsLook.reason || ''),
				]),
	},
	{
		id: 8,
		name: 'letterEmpty',
		flags: ['letterView'],
		match: (s, on) => {
			const letter = openLetter(s);
			if (!letter) return null;
			// B6 + B7 fix pass: a Point pen shape still open is no letter yet. The green "Finish
			// the shape" is by the canvas, so the line names it and has no button (principle 1),
			// and nothing to skip to: the next step is on the paper
			if (letter.drawing) {
				const points = Math.floor(Number(letter.drawing.points) || 0);
				const key =
					points >= MIN_SHAPE_POINTS ? 'coach.rule.closeShape' : 'coach.rule.keepClicking';
				return { sentence: word(key, { button: word('letterTools.finishShape') }), skipKey: '' };
			}
			// B6 + B7 finalize: empty is no finished shape (board/letter_set.js), as the overlay
			// says it: a stray line makes a letter neither empty nor Ready
			if (!isEmpty(letter)) return null;
			const { key, stamp } = emptyLine(s, on);
			return {
				sentence: word(key, { letter: startName(letter.char) }),
				skipKey: `empty:${letter.char}`,
				stamp,
			};
		},
		live: (s, on) => {
			const open = openLetter(s);
			return lettersOf(s)
				.filter(isEmpty)
				.map((l) => [`empty:${l.char}`, l.char === open?.char ? emptyLine(s, on).stamp : '']);
		},
	},
	{
		id: 9,
		name: 'needsLook',
		flags: ['board', 'checks'],
		// The board; and the letter view once no letter is empty, so a letter that needs a look
		// is never passed over for "Your font is up to date"
		match: (s) => {
			const count = needsLookCount(s);
			if (!count) return null;
			if (s.page !== 'board' && !(s.page === 'letter' && noEmptyLeft(s))) return null;
			// B10 + B11 integration: the board already shows them, each tile with its fixes; the
			// line takes them one at a time, the fix its green button, so it always does something
			// B10 + B11 finalize: once he skipped every one, the line stays on the board's letters
			// (their fixes are on the tiles), never a green way on to a letter not on screen
			if (s.page === 'board' && s.boardFilter === 'needsLook') {
				return (
					nextLookOnBoard(s) || { sentence: word('coach.rule.needsLook', { count }), skipKey: '' }
				);
			}
			return {
				sentence: word('coach.rule.needsLook', { count }),
				button: button('check.showMe', {}, 'showNeedsLook'),
				skipKey: 'needsLook',
				stamp: String(count),
				primary: !brushingOpen(s),
			};
		},
		live: (s) => one(needsLookCount(s) > 0, 'needsLook', String(needsLookCount(s))),
	},
	{
		id: 10,
		name: 'notSaved',
		flags: ['coach'],
		match: (s) => {
			// B6 + B7 fix pass: not while a shape is still being drawn (it isn't a letter yet)
			if (drawingOpen(s) || !anyInk(s)) return null;
			// after a failed save: the pill's words and its Fix, so both lead to one box (4.11)
			if (s.save === 'failed') {
				return {
					sentence: word('coach.rule.saveFailed'),
					button: button('topbar.status.fix', {}, 'fixSave'),
					skipKey: 'save',
					stamp: s.save,
				};
			}
			if (s.save !== 'not-saved') return null;
			return {
				sentence: word('coach.rule.notSaved'),
				button: button('coach.button.save', {}, 'save'),
				skipKey: 'save',
				stamp: s.save,
			};
		},
		live: (s) => one((s.save === 'not-saved' || s.save === 'failed') && anyInk(s), 'save', s.save),
	},
	{
		id: 11,
		name: 'firstPhoto',
		flags: ['photo'],
		match: (s) =>
			!anyInk(s) && !s.hasPhoto
				? {
						sentence: word('coach.rule.firstPhoto'),
						button: button('coach.button.how', {}, 'how'),
						skipKey: 'firstPhoto',
				  }
				: null,
		live: (s) => one(!anyInk(s) && !s.hasPhoto, 'firstPhoto'),
	},
	{
		id: 12,
		name: 'photoParts',
		flags: ['photo'],
		match: (s, on) => {
			// B16: once every letter of the Try-it text is ready, Try it comes first, once
			if (tryItFirst(s, on)) return null;
			for (const { photo, count } of photosWithParts(s)) {
				const skipKey = `photo:${photo.id}`;
				const stamp = String(count);
				if (isSkippedIn(s.skips, skipKey, stamp)) continue;
				return {
					sentence: word('coach.rule.morePhotoLetters', { count }),
					button: button('coach.button.nextPart', {}, 'nextPart', { photoId: photo.id }),
					skipKey,
					stamp,
				};
			}
			return null;
		},
		live: (s) => photosWithParts(s).map(({ photo, count }) => [`photo:${photo.id}`, String(count)]),
	},
	{
		id: 13,
		name: 'tryLetters',
		flags: ['tryIt'],
		match: (s) =>
			wantsTryIt(s)
				? {
						sentence: word('coach.rule.tryLetters'),
						button: button('coach.button.tryIt', {}, 'tryIt'),
						skipKey: 'tryLetters',
				  }
				: null,
		live: (s) => one(wantsTryIt(s), 'tryLetters'),
	},
	{
		id: 14,
		name: 'makeFontFile',
		flags: ['useInWord'],
		match: (s) =>
			wantsFontFile(s)
				? {
						sentence: word('coach.rule.makeFontFile'),
						button: button('coach.button.useInWord', {}, 'useInWord'),
						skipKey: 'makeFontFile',
						stamp: changedStamp(s),
				  }
				: null,
		live: (s) => one(wantsFontFile(s), 'makeFontFile', changedStamp(s)),
	},
	{
		id: 15,
		name: 'nextLetter',
		flags: ['coach'],
		match: (s) => {
			// B6 + B7 fix pass: never "looks done", or on to the next letter, mid-shape
			if (drawingOpen(s)) return null;
			const letters = lettersOf(s);
			const byChar = new Map(letters.map((l) => [l.char, l]));
			const open = openLetter(s);
			const order = suggestionOrder({
				tryItText: s.tryItText,
				set: letters.map((l) => l.char),
				turnsUsed: s.turnsUsed || [],
			});
			const next = order.find(
				({ char }) =>
					char !== open?.char &&
					!byChar.get(char)?.ink &&
					!isSkippedIn(s.skips, `next:${char}`, 'empty')
			);
			if (!next) return null;
			const letter = letterPhrase(next.char);
			// the Brush picked on a letter with ink: he may still be drawing (B8 + B9 finalize)
			const brushing = brushingOpen(s);
			const sentence = brushing
				? word('coach.rule.whenReadyNextLetter', { done: letterPhrase(open.char), letter })
				: isReady(open) && s.page === 'letter'
				? word('coach.rule.doneNextLetter', { done: startName(open.char), letter })
				: word('coach.rule.nextLetter', { letter });
			const name = buttonLetter(next.char);
			return {
				sentence,
				label: false,
				primary: !brushing,
				button:
					s.page === 'letter'
						? button('action.goTo', { letter: name }, 'goToLetter', { char: next.char })
						: button('coach.button.make', { letter: name }, 'goToLetter', { char: next.char }),
				skipKey: `next:${next.char}`,
				stamp: 'empty',
				letter: next.char,
				fromTryIt: next.fromTryIt,
			};
		},
		// the state behind "next letter: c" is c still being empty, wherever he is
		live: (s) =>
			lettersOf(s)
				.filter((l) => !l.ink)
				.map((l) => [`next:${l.char}`, 'empty']),
	},
	{
		id: 16,
		name: 'addNumbers',
		flags: ['board'],
		match: (s) =>
			allReady(s) && !s.numbersAdded
				? {
						sentence: word('coach.rule.allReady', { count: lettersOf(s).length }),
						button: button('coach.button.addNumbers', {}, 'addNumbers'),
						skipKey: 'addNumbers',
				  }
				: null,
		live: (s) => one(allReady(s) && !s.numbersAdded, 'addNumbers'),
	},
	{
		id: 17,
		name: 'upToDate',
		flags: ['tryIt'],
		match: (s) =>
			allReady(s)
				? {
						sentence: word('coach.rule.upToDate'),
						button: button('coach.button.tryIt', {}, 'tryIt'),
						skipKey: 'upToDate',
				  }
				: null,
		live: (s) => one(allReady(s), 'upToDate'),
	},
	{
		// B8 + B9 finalize: every letter ready, and nothing after it built yet (16, 17 off)
		id: 18,
		name: 'allDone',
		flags: ['coach'],
		// only while rules 13, 14, 16 and 17 can't show (their screens aren't built)
		match: (s, on) =>
			allReady(s) && !['tryIt', 'useInWord', 'board'].some(on)
				? { sentence: word('coach.rule.allLettersReady', { count: lettersOf(s).length }) }
				: null,
		live: () => [],
	},
]);

/**
 * The first rule that matches and isn't skipped.
 * @param {Object} state
 * @returns {Object} the line
 */
function pick(state) {
	const on = flagsOf(state);
	// The start page has no top bar, so no Next line (4.0: the frame of every editor screen)
	if (!on('coach') || state.page === 'start') return { ...EMPTY };
	for (const rule of RULES) {
		if (!rule.flags.every(on)) continue;
		const found = rule.match(state, on);
		if (!found) continue;
		const stamp = String(found.stamp ?? '');
		if (found.skipKey && isSkippedIn(state.skips, found.skipKey, stamp)) continue;
		return {
			...EMPTY,
			rule: rule.id,
			name: rule.name,
			sentence: found.sentence,
			label: found.label !== false && !!found.sentence,
			button: found.button?.label || '',
			action: found.button?.action || '',
			args: found.button?.args ?? null,
			primary: !!found.button && !state.otherPrimary && found.primary !== false,
			skipKey: found.skipKey || '',
			stamp,
			letter: found.letter ?? null,
			fromTryIt: !!found.fromTryIt,
		};
	}
	return { ...EMPTY };
}

/**
 * The Next line for a state (4.0): the first rule that matches wins.
 * @param {Object} state - see the top of this file
 * @returns {Object} the line
 */
export function pickLine(state = {}) {
	const line = pick(state);
	if (!line.sentence || !line.skipKey) return line;
	const skips = { ...(state.skips || {}), [line.skipKey]: line.stamp };
	const other = pick({ ...state, skips });
	return { ...line, somethingElse: !!other.sentence };
}

/**
 * B6 + B7 fix pass: every suggestion the state holds now, by its skip key, with the stamp of
 * the state behind it, whatever the screen shows (a dialog, the page, a shape being drawn). A
 * "Something else" skip whose key is missing here, or here with another stamp, is over
 * (skips.js prune): the state behind it changed, as 4.0 says.
 * @param {Object} state - see the top of this file
 * @returns {Map<String, String>}
 */
export function liveSkips(state = {}) {
	const on = flagsOf(state);
	const live = new Map();
	if (!on('coach')) return live;
	RULES.forEach((rule) => {
		if (!rule.flags.every(on)) return;
		rule.live(state, on).forEach(([key, stamp]) => {
			if (key && !live.has(key)) live.set(key, String(stamp ?? ''));
		});
	});
	return live;
}
