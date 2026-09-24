// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { merge } from '../glyphr_studio_project.js';

/**
 * Upstream merge() copied only strings and numbers from the importing object onto the
 * template, so a saved boolean that differed from the template default was lost on load
 * (a saved `false` over a `true` default came back `true`). ANY-INK stores booleans under
 * settings.anyink, so merge must copy them too (DESIGN_DOC section 8).
 */
describe('merge() booleans', () => {
	it('copies a saved false over a true default', () => {
		const result = merge({ flag: true }, { flag: false });
		expect(result.flag).toBe(false);
	});

	it('copies a saved true over a false default', () => {
		const result = merge({ flag: false }, { flag: true });
		expect(result.flag).toBe(true);
	});

	it('keeps the template boolean when the import has no value', () => {
		expect(merge({ flag: true }, {}).flag).toBe(true);
		expect(merge({ flag: false }, {}).flag).toBe(false);
	});

	it('copies booleans inside nested objects', () => {
		const result = merge({ app: { a: true, b: false } }, { app: { a: false, b: true } });
		expect(result.app).toEqual({ a: false, b: true });
	});

	it('still copies strings and numbers', () => {
		const result = merge({ s: 'x', n: 1 }, { s: 'y', n: 2 });
		expect(result).toEqual({ s: 'y', n: 2 });
	});

	it('still ignores keys the template does not have', () => {
		const result = merge({ a: 1 }, { a: 2, extra: true });
		expect(result).toEqual({ a: 2 });
	});

	it('still merges arrays index by index and leaves an empty template array alone', () => {
		// Upstream behavior kept on purpose: the constructor rebuilds arrays itself.
		expect(merge({ list: ['a', 'b'] }, { list: ['c'] }).list).toEqual(['c', 'b']);
		expect(merge({ list: [] }, { list: ['c'] }).list).toEqual([]);
	});

	it('still trims strings when asked', () => {
		expect(merge({ s: 'x' }, { s: '  y  ' }, true).s).toBe('y');
	});
});
