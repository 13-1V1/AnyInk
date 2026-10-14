// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: the default export is byte-for-byte what it was before the font check moved the
	exporter's list of letters into src/anyink/fontcheck/export_list.js. The hashes below
	were recorded from the unchanged exporter (v2.10.5 + ANY-INK through B0) on 10/14/2026,
	with the clock pinned (font-flux-js writes the time into the head table).
*/
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { openEdge, openOblegg, openSimpleExample } from './fixtures.js';

const FIXED_TIME = new Date('2026-10-14T12:00:00Z');

const sha256 = (arrayBuffer) => createHash('sha256').update(Buffer.from(arrayBuffer)).digest('hex');

async function exportHash(open, suffix, options) {
	open();
	const buffer =
		options === undefined
			? await ioFont_exportFont(suffix, true)
			: await ioFont_exportFont(suffix, true, options);
	return sha256(buffer);
}

const RECORDED = {
	'simple example otf': '498570afe1ce30608afad532ab857d4bf2b900f8c92218b231253a0a1adfcc07',
	'simple example ttf': 'c7147021a5f7e8b0e1e02c6518128541d9d2e33adb95027be624d6fbe174b4d0',
	'simple example woff': '47b1ebbef6627e3c2dd66ada06594de747a6f2d08afac0b7d51f9e28861ab1ba',
	'oblegg otf': 'cb1550b2e2e3876454162f93bb9a66e97eb744da02a7cece6eaa9e64fe330959',
	'edge otf': '616c121751ba0c84907b3aa5be1cd3e1c8ffafce0b85565927887408d1cd554f',
	'edge ttf': 'b29dc04ff1e04aa57acbe76dcb26adc8af04a8fbb4f570e9710926efd7a3663c',
	'edge ttf flattened': '26f3d22b25938981f29c23099e21fd3868336b9bd5e80d8ce17f5efc752138a5',
	'edge otf, unedited and ligatures off':
		'4509b5eda3387fc7bc948ffe74c174e0815ce37eb5d4e3106a30e764969501b7',
};

const CASES = [
	['simple example otf', openSimpleExample, 'otf'],
	['simple example ttf', openSimpleExample, 'ttf'],
	['simple example woff', openSimpleExample, 'woff'],
	['oblegg otf', openOblegg, 'otf'],
	['edge otf', () => openEdge(), 'otf'],
	['edge ttf', () => openEdge(), 'ttf'],
	[
		'edge ttf flattened',
		() => openEdge({ project: { exportComponentsAsComposites: false } }),
		'ttf',
	],
	[
		'edge otf, unedited and ligatures off',
		() => {
			const editor = openEdge({ app: { exportUneditedItems: false, exportLigatures: false } });
			editor.selectedGlyphID = 'glyph-0x45'; // opening E creates it, unedited
			return editor.selectedGlyph;
		},
		'otf',
	],
];

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(FIXED_TIME);
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('default export unchanged by the font check refactor', () => {
	it('is deterministic with the clock pinned', async () => {
		expect(await exportHash(() => openEdge(), 'otf')).toBe(
			await exportHash(() => openEdge(), 'otf')
		);
	}, 30000);

	for (const [name, open, suffix] of CASES) {
		it(`${name}: same bytes as before`, async () => {
			expect(await exportHash(open, suffix)).toBe(RECORDED[name]);
		}, 60000);
	}
});
