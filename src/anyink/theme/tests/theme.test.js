// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import { resetPrefsCache } from '../../prefs/prefs.js';
import {
	getCanvasTheme,
	initTheme,
	onThemeChange,
	parseToRGB,
	setCanvasTheme,
	toggleCanvasTheme,
	token,
	withAlpha,
} from '../theme.js';

describe('parseToRGB', () => {
	it('parses short and long hex', () => {
		expect(parseToRGB('#fff')).toEqual({ r: 255, g: 255, b: 255 });
		expect(parseToRGB('#16a34a')).toEqual({ r: 22, g: 163, b: 74 });
		expect(parseToRGB('#7C3AEDcc')).toEqual({ r: 124, g: 58, b: 237 });
	});

	it('parses rgb() and rgba() with commas or spaces', () => {
		expect(parseToRGB('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
		expect(parseToRGB('rgba(10 20 30 / 0.5)')).toEqual({ r: 10, g: 20, b: 30 });
	});

	it('parses hsl()', () => {
		expect(parseToRGB('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
		expect(parseToRGB('hsl(120, 100%, 25%)')).toEqual({ r: 0, g: 128, b: 0 });
	});

	it('falls back to black for garbage', () => {
		expect(parseToRGB('not a color')).toEqual({ r: 0, g: 0, b: 0 });
		expect(parseToRGB(undefined)).toEqual({ r: 0, g: 0, b: 0 });
	});
});

describe('withAlpha', () => {
	it('returns rgba with a clamped alpha', () => {
		expect(withAlpha('#16a34a', 0.5)).toBe('rgba(22, 163, 74, 0.5)');
		expect(withAlpha('#16a34a', 4)).toBe('rgba(22, 163, 74, 1)');
		expect(withAlpha('#16a34a', -1)).toBe('rgba(22, 163, 74, 0)');
	});
});

describe('canvas theme', () => {
	beforeEach(() => {
		localStorage.clear();
		resetPrefsCache();
		delete document.documentElement.dataset.canvas;
	});

	it('defaults to light and remembers a change', () => {
		initTheme();
		expect(getCanvasTheme()).toBe('light');
		setCanvasTheme('dark');
		expect(document.documentElement.dataset.canvas).toBe('dark');
		resetPrefsCache();
		delete document.documentElement.dataset.canvas;
		initTheme();
		expect(getCanvasTheme()).toBe('dark');
	});

	it('toggles and notifies listeners once per change', () => {
		setCanvasTheme('light');
		const seen = [];
		const off = onThemeChange((t) => seen.push(t));
		expect(toggleCanvasTheme()).toBe('dark');
		expect(toggleCanvasTheme()).toBe('light');
		off();
		toggleCanvasTheme();
		expect(seen).toEqual(['dark', 'light']);
	});

	it('token() reads a custom property and forgets it when the theme changes', () => {
		document.documentElement.style.setProperty('--anyink-test-token', '#16a34a');
		expect(token('--anyink-test-token')).toBe('#16a34a');
		document.documentElement.style.setProperty('--anyink-test-token', '#7c3aed');
		// cached until a theme change
		expect(token('--anyink-test-token')).toBe('#16a34a');
		setCanvasTheme('dark');
		expect(token('--anyink-test-token')).toBe('#7c3aed');
	});
});
