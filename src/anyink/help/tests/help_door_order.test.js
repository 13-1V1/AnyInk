// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, written to fail first: a page that loads the Help door before the app
// (tests/help.html) stopped with "Cannot access 'stop' before initialization": pages/help.js
// started listening while help_door.js was still loading (they import each other through
// main.js). The listening now starts once everything has loaded.
import { describe, expect, it, vi } from 'vitest';

describe('the Help door loads first', () => {
	it('loads with no error, and the door answers after', async () => {
		vi.resetModules();
		const door = await import('../help_door.js');
		expect(typeof door.openHelp).toBe('function');
		await Promise.resolve();
		const stop = door.listenForHelpDoor();
		expect(typeof stop).toBe('function');
		// listening once: a second ask gives the same stop
		expect(door.listenForHelpDoor()).toBe(stop);
		stop();
	});
});
