// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S2 (docs/SKETCH.md 2): install.js puts the five real tools behind their names once a page, each
// with the methods tool_route.js hands presses, keys and the picture to.
import { afterEach, describe, expect, it } from 'vitest';
import { installSketchTools, uninstallSketchToolsForTests } from '../install.js';
import { clearSketchToolsForTests, sketchToolHandler } from '../tool_route.js';
import { SKETCH_TOOLS } from '../tool_names.js';

afterEach(() => {
	uninstallSketchToolsForTests();
	clearSketchToolsForTests();
});

describe('installSketchTools', () => {
	it('registers all five, each able to take presses, keys and say what to draw', () => {
		const handlers = installSketchTools();
		expect(Object.keys(handlers)).toEqual(SKETCH_TOOLS);
		SKETCH_TOOLS.forEach((tool) => {
			const handler = sketchToolHandler(tool);
			expect(handler, tool).toBe(handlers[tool]);
			['down', 'move', 'up', 'key', 'drawState'].forEach((method) =>
				expect(typeof handler[method], `${tool}.${method}`).toBe('function')
			);
		});
	});

	it('a second call (every new edit canvas) keeps the same tools', () => {
		const first = installSketchTools();
		expect(installSketchTools()).toBe(first);
		expect(sketchToolHandler('sketchLine')).toBe(first.sketchLine);
	});
});
