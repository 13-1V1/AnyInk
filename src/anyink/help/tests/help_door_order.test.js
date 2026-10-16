// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, written to fail first: a page that loads the Help door before the app
// (tests/help.html) stopped with "Cannot access 'stop' before initialization": pages/help.js
// started listening while help_door.js was still loading (they import each other through
// main.js). B16: the queueMicrotask guard did not cover vitest's module loader (a microtask runs
// between two imports), so the full run still ended with an unhandled error. The door now starts
// itself at the end of its own module; pages/help.js only loads it. This test fails on any
// uncaught error or unhandled rejection while the modules load.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELP_EVENT } from '../../topbar/doors.js';

let caught;
const onError = (error) => caught.push(error);
beforeEach(() => {
	caught = [];
	process.on('uncaughtException', onError);
	process.on('unhandledRejection', onError);
});
afterEach(() => {
	process.off('uncaughtException', onError);
	process.off('unhandledRejection', onError);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the Help door loads first', () => {
	it('loads with no error, and the door answers after', async () => {
		vi.resetModules();
		const door = await import('../help_door.js');
		await settle();
		expect(caught.map((error) => String(error?.message || error))).toEqual([]);
		expect(typeof door.openHelp).toBe('function');
		// already listening once loaded: asking again gives the same stop
		const stop = door.listenForHelpDoor();
		expect(typeof stop).toBe('function');
		expect(door.listenForHelpDoor()).toBe(stop);
		stop();
		expect(door.listenForHelpDoor()).not.toBe(stop);
		door.listenForHelpDoor()();
	});

	it('loads through the Help page with no error, and listens with nobody asking', async () => {
		vi.resetModules();
		const spy = vi.spyOn(globalThis, 'addEventListener');
		await import('../../../pages/help.js');
		await settle();
		const added = spy.mock.calls.filter(([type]) => type === HELP_EVENT).length;
		spy.mockRestore();
		expect(caught.map((error) => String(error?.message || error))).toEqual([]);
		expect(added).toBe(1);
		const door = await import('../help_door.js');
		door.listenForHelpDoor()();
	});
});
