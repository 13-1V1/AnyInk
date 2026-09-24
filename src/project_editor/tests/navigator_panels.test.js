// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { Navigator, panelForPage } from '../navigator.js';

describe('Navigator: panel falls back when the page does not offer it', () => {
	it('panelForPage keeps an offered panel and falls back to Attributes otherwise', () => {
		expect(panelForPage('Characters', 'Trace')).toBe('Trace');
		expect(panelForPage('Ligatures', 'Trace')).toBe('Trace');
		expect(panelForPage('Components', 'Trace')).toBe('Trace');
		expect(panelForPage('Kerning', 'Trace')).toBe('Attributes');
		expect(panelForPage('Kerning', 'Layers')).toBe('Attributes');
		expect(panelForPage('Kerning', 'History')).toBe('History');
		// Pages without a panel list keep the request
		expect(panelForPage('Overview', 'Trace')).toBe('Trace');
	});

	it('navigate() applies the fallback, as undo does when it changes the page in code', () => {
		const navigator = new Navigator();
		navigator.page = 'Kerning';
		navigator.panel = 'Trace';
		navigator.navigate(true);
		expect(navigator.panel).toBe('Attributes');
	});
});
