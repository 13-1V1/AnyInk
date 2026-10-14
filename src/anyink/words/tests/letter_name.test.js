// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: letter names in plain words (UX-BEGINNER 2.2). Never a Unicode name, never a code.
*/
import { describe, expect, it } from 'vitest';
import { letterName, letterPhrase, sentenceStart } from '../letter_name.js';

describe('letterName', () => {
	it('names small and capital letters in full', () => {
		expect(letterName('a')).toBe('small a');
		expect(letterName('A')).toBe('Capital A');
		expect(letterName('r')).toBe('small r');
		expect(letterName('é')).toBe('small é');
		expect(letterName('Ç')).toBe('Capital Ç');
	});

	it('names numbers and punctuation the house way', () => {
		expect(letterName('1')).toBe('number 1');
		expect(letterName('7')).toBe('number 7');
		expect(letterName('?')).toBe('question mark');
		expect(letterName('!')).toBe('exclamation mark');
		expect(letterName('.')).toBe('period');
		expect(letterName(',')).toBe('comma');
		expect(letterName("'")).toBe('apostrophe');
		expect(letterName('-')).toBe('hyphen');
		expect(letterName(' ')).toBe('space');
	});

	it('never uses a banned word for a dash', () => {
		expect(letterName('—')).toBe('long dash');
		expect(letterName('–')).toBe('short dash');
	});

	it('names joined letters (several characters)', () => {
		expect(letterName('fi')).toBe('joined letters fi');
	});

	it('takes a code point number too', () => {
		expect(letterName(0x61)).toBe('small a');
		expect(letterName(0x3f)).toBe('question mark');
	});

	it('returns an empty string when there is nothing to name', () => {
		expect(letterName('')).toBe('');
		expect(letterName(undefined)).toBe('');
		expect(letterName('\u0007')).toBe('');
	});
});

describe('letterPhrase (the name inside a sentence)', () => {
	it('adds "the" to numbers, punctuation and joined letters, never to a letter', () => {
		expect(letterPhrase('a')).toBe('small a');
		expect(letterPhrase('A')).toBe('Capital A');
		expect(letterPhrase('1')).toBe('the number 1');
		expect(letterPhrase('?')).toBe('the question mark');
		expect(letterPhrase(' ')).toBe('the space');
		expect(letterPhrase('fi')).toBe('the joined letters fi');
	});

	it('sentenceStart capitalizes "the" only, so "small a" keeps its name', () => {
		expect(sentenceStart(letterPhrase('?'))).toBe('The question mark');
		expect(sentenceStart(letterPhrase('a'))).toBe('small a');
		expect(sentenceStart(letterPhrase('A'))).toBe('Capital A');
	});
});
