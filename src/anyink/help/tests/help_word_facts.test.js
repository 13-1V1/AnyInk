// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 integration (the dialog track's NEEDS 5, FACTCHECK_LOG section 8): Help's Windows and
// Word steps say what Use in Word's card says, in the fact-checked wording, with the same labels
// (install.quote.*) and B14's real names. Written to fail first: Help said "at the top", "don't
// show up", "click one, then Uninstall", and "Set As Default" with no Normal-template choice.
import { describe, expect, it } from 'vitest';
import { flagsOn } from '../../mode/features.js';
import { word } from '../../words/words.js';
import { exampleNames, wordSteps } from '../help_word_steps.js';

const plain = (html) =>
	html
		.replace(/<[^>]+>/g, '')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");

describe("Help's Windows and Word steps", () => {
	const steps = wordSteps({ name: 'Brennan Hand', isOn: flagsOn('useInWord', 'help') });
	// B14 + B15 finalize: the gap-fix step's short steps are its subs
	const text = steps
		.map((step) => [step.html, ...(step.subs || [])].map(plain).join('\n'))
		.join('\n');

	it('use the fact-checked wording', () => {
		expect(text).not.toMatch(/at the top/);
		expect(text).not.toMatch(/don't show up/);
		expect(text).not.toMatch(/click one/);
		expect(text).toContain(word('install.quote.normal'));
		expect(text).toContain(word('install.quote.ok'));
		expect(text).toMatch(/8 is the lowest/);
		expect(text).toMatch(/press the "?\.\.\."? next to one/);
	});

	it("name things the way Use in Word's card does (B14's names)", () => {
		expect(exampleNames('Brennan Hand')).toEqual({
			file: 'BrennanHand-Test1.otf',
			testName: 'Brennan Hand Test 1',
			search: 'Brennan Hand Test',
			finalName: 'Brennan Hand',
		});
		const long = exampleNames('Brennan Meyer Everyday Handwriting');
		expect(long.testName.length).toBeLessThanOrEqual(31);
	});
});
