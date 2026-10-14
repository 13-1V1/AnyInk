// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3: the spacing engine is pure and loads nothing of the app. History imports it (the refit
// hook), so if it reached into the app's module graph it could change the order the app loads
// in; the font check, for one, sits in an import loop (validate -> ... -> preview/font_status ->
// validate) that breaks a page that reaches it first. tests/spacing.html is the page that found it.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const folder = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The engine's modules; the hook that wires it into History is another track's, and may import the app */
const ENGINE = [
	'auto_space.js',
	'extra.js',
	'gap_rule.js',
	'letter_classes.js',
	'measure.js',
	'outline.js',
	'owner.js',
	'round.js',
	'sides.js',
	'slant.js',
	'trace_follow.js',
];
/** All an engine module may import: its own folder and the trace model (itself pure) */
const ALLOWED = /^\.\/[a-z_]+\.js$|^\.\.\/trace\/trace_model\.js$/;

describe('the spacing engine', () => {
	it('has the modules this test knows about', () => {
		const found = readdirSync(folder).filter((name) => name.endsWith('.js'));
		ENGINE.forEach((name) => expect(found).toContain(name));
	});

	it.each(ENGINE)('%s imports only the engine and the trace model', (name) => {
		const text = readFileSync(join(folder, name), 'utf8');
		const sources = [...text.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
		sources.forEach((source) => expect(source, `${name} imports ${source}`).toMatch(ALLOWED));
	});

	it('the trace model it uses imports nothing', () => {
		const text = readFileSync(join(folder, '../trace/trace_model.js'), 'utf8');
		expect(text).not.toMatch(/^import /m);
	});
});
