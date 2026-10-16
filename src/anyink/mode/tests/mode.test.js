// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B2 + B5 (UX-BEGINNER.md 6.1): the mode switch. Since B16 Simple is the launch default (the
// address with no ui, the installed app's start_url, a reopened tab); ?ui=all opens All tools for
// one load. B5: the mode is mirrored to html[data-ui-mode] the way
// theme.js mirrors the canvas theme, a real change is announced once ('anyink-mode-change'), the
// session remembers whether Simple has been on (the band shows only then), and All tools turned on
// for one visit to a page Simple hides (6.3) carries that visit.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	LAUNCH_MODE,
	MODE_EVENT,
	getMode,
	getVisit,
	hasUsedSimple,
	isSimpleMode,
	modeFromSearch,
	setMode,
	setModeForTests,
} from '../mode.js';

const here = dirname(fileURLToPath(import.meta.url));

afterEach(() => setModeForTests('all'));

const attribute = () => document.documentElement.getAttribute('data-ui-mode');

/** Records 'anyink-mode-change' events while fn runs. */
function eventsDuring(fn) {
	const seen = [];
	const listen = (event) => seen.push(event.detail);
	window.addEventListener(MODE_EVENT, listen);
	try {
		fn();
	} finally {
		window.removeEventListener(MODE_EVENT, listen);
	}
	return seen;
}

describe('mode', () => {
	it('B16: launches in Simple when the address does not ask for All tools', async () => {
		expect(LAUNCH_MODE).toBe('simple');
		// the address with no ui (vitest-setup.js loads every test page with ?ui=all)
		const before = window.location.search;
		window.history.replaceState(null, '', window.location.pathname);
		vi.resetModules();
		const fresh = await import('../mode.js').finally(() =>
			window.history.replaceState(null, '', before)
		);
		expect(fresh.getMode()).toBe('simple');
		expect(fresh.isSimpleMode()).toBe(true);
		expect(fresh.hasUsedSimple()).toBe(true);
		expect(attribute()).toBe('simple');
	});

	it('?ui=all opens All tools for that load; anything else opens Simple', () => {
		expect(modeFromSearch('?ui=all')).toBe('all');
		expect(modeFromSearch('?project=x&ui=all')).toBe('all');
		expect(modeFromSearch('ui=all')).toBe('all');
		expect(modeFromSearch('?ui=simple')).toBe('simple');
		expect(modeFromSearch('?project=x&ui=simple')).toBe('simple');
		expect(modeFromSearch('')).toBe('simple');
		expect(modeFromSearch(undefined)).toBe('simple');
		expect(modeFromSearch('?ui=ALL')).toBe('simple');
		expect(modeFromSearch('?ui=simplex')).toBe('simple');
	});

	it("the installed app's start_url opens in Simple", () => {
		const manifest = JSON.parse(readFileSync(join(here, '../../../manifest.json'), 'utf8'));
		const start = new URL(manifest.start_url, 'https://13-1v1.github.io/AnyInk/');
		expect(modeFromSearch(start.search)).toBe('simple');
	});

	it('set and get', () => {
		expect(setMode('simple')).toBe(true);
		expect(getMode()).toBe('simple');
		expect(isSimpleMode()).toBe(true);
		expect(setMode('all')).toBe(true);
		expect(getMode()).toBe('all');
	});

	it('refuses a mode it does not know and keeps the current one', () => {
		setMode('simple');
		expect(setMode('expert')).toBe(false);
		expect(setMode(undefined)).toBe(false);
		expect(getMode()).toBe('simple');
	});

	it('setModeForTests switches and hands back the mode it replaced', () => {
		expect(setModeForTests('simple')).toBe('all');
		expect(isSimpleMode()).toBe(true);
		expect(setModeForTests('all')).toBe('simple');
		expect(getMode()).toBe('all');
		expect(setModeForTests()).toBe('all');
		expect(getMode()).toBe(LAUNCH_MODE);
	});
});

describe('html[data-ui-mode]', () => {
	it('mirrors the mode, the way html[data-canvas] mirrors the canvas theme', () => {
		expect(attribute()).toBe('all');
		setMode('simple');
		expect(attribute()).toBe('simple');
		setMode('all');
		expect(attribute()).toBe('all');
	});

	it('follows setModeForTests too, and is left alone by a refused mode', () => {
		setModeForTests('simple');
		expect(attribute()).toBe('simple');
		setMode('expert');
		expect(attribute()).toBe('simple');
		setModeForTests('all');
		expect(attribute()).toBe('all');
	});
});

describe('anyink-mode-change', () => {
	it('is announced once for a real change, with the mode it replaced', () => {
		const seen = eventsDuring(() => {
			setMode('simple');
			setMode('simple');
			setMode('all');
		});
		expect(seen).toEqual([
			{ mode: 'simple', previous: 'all', visit: null },
			{ mode: 'all', previous: 'simple', visit: null },
		]);
	});

	it('is not announced by setModeForTests or a refused mode', () => {
		const seen = eventsDuring(() => {
			setModeForTests('simple');
			setMode('expert');
			setModeForTests('all');
		});
		expect(seen).toEqual([]);
	});
});

describe('hasUsedSimple', () => {
	it('is false at an All tools launch and true once Simple has been on this session', () => {
		expect(hasUsedSimple()).toBe(false);
		setMode('simple');
		expect(hasUsedSimple()).toBe(true);
		setMode('all');
		expect(hasUsedSimple()).toBe(true);
	});

	it('setModeForTests starts the session over', () => {
		setMode('simple');
		setModeForTests('all');
		expect(hasUsedSimple()).toBe(false);
		setModeForTests('simple');
		expect(hasUsedSimple()).toBe(true);
	});
});

describe('a visit (6.3: All tools turned on for one page Simple hides)', () => {
	it('is kept with All tools and given back frozen', () => {
		setMode('simple');
		setMode('all', { visit: { page: 'Kerning', cause: 'undo' } });
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'undo' });
		expect(Object.isFrozen(getVisit())).toBe(true);
	});

	it('is cleared by any other setMode, and never kept in Simple', () => {
		setMode('all', { visit: { page: 'Kerning', cause: 'undo' } });
		setMode('all');
		expect(getVisit()).toBe(null);
		setMode('simple', { visit: { page: 'Kerning', cause: 'undo' } });
		expect(getVisit()).toBe(null);
		setMode('all', { visit: { page: 'Kerning', cause: 'other' } });
		setModeForTests('all');
		expect(getVisit()).toBe(null);
	});

	it('is in the change event that starts it', () => {
		setMode('simple');
		const seen = eventsDuring(() => setMode('all', { visit: { page: 'Kerning', cause: 'undo' } }));
		expect(seen).toEqual([
			{ mode: 'all', previous: 'simple', visit: { page: 'Kerning', cause: 'undo' } },
		]);
	});
});
