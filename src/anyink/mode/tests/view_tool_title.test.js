// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration: the view tool 'displayMode' is named "See-through" in Simple with 'sketch' on
	(the same name as Fine-tune's switch, letter/view_switches.js displayModeKey), "Outline only"
	with it off, and upstream's own words in All tools.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../features.js';
import { setModeForTests } from '../mode.js';
import { viewToolTitle } from '../simple_labels.js';
import { word } from '../../words/words.js';
import { displayModeKey } from '../../letter/view_switches.js';

afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('viewToolTitle displayMode', () => {
	it('Simple, sketch on: See-through, the same words as the Fine-tune switch', () => {
		setModeForTests('simple');
		setFeaturesForTests({ sketch: true });
		expect(viewToolTitle('displayMode', 'upstream')).toBe(word('view.seeThrough'));
		expect(viewToolTitle('displayMode', 'upstream')).toBe(word(displayModeKey()));
	});

	it('Simple, sketch off: Outline only, as before', () => {
		setModeForTests('simple');
		setFeaturesForTests({ sketch: false });
		expect(viewToolTitle('displayMode', 'upstream')).toBe(word('view.displayMode'));
	});

	it("All tools: upstream's words", () => {
		setFeaturesForTests({ sketch: true });
		expect(viewToolTitle('displayMode', 'Toggle outline')).toBe('Toggle outline');
	});
});
