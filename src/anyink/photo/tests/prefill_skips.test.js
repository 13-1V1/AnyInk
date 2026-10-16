// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize (critic: "Photo dialog fills in the wrong letter after a skipped part, and
// on a crossed-out scribble"). Written to fail first:
//   - a part he skipped (VW written touching) breaks the alphabet run: after U, X is not "V";
//   - a part the finder skipped as junk (markJunk) does not break it;
//   - the notebook's crossed-out Q is junk (UX-BEGINNER.md 4.4: "a crossed-out letter is never a
//     part he is asked about"); no letter of any fixture is.
import { beforeAll, describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { findInk, photoInk } from '../ink_parts.js';
import { isJunkPart } from '../photo_flow_ink.js';
import {
	addPhoto,
	getPhoto,
	markJunk,
	prefillChar,
	skipPart,
	usePart,
} from '../photo_registry.js';
import { loadPhotoFixture } from './fixture_image.js';

const ROW = Array.from({ length: 6 }, (_, i) => ({
	id: `p${i + 1}`,
	left: 100 + i * 120,
	top: 100,
	right: 180 + i * 120,
	bottom: 220,
	row: 0,
}));

function record() {
	const project = new GlyphrStudioProject();
	addPhoto(project, {
		asset: 'img-pref0001',
		width: 1000,
		height: 400,
		parts: ROW.map((p) => ({ ...p, mask: new Uint8Array(4) })),
	});
	return getPhoto(project, 'img-pref0001');
}

describe('the alphabet prefill and skipped parts', () => {
	it('after T U, a part he skipped (VW touching) means the next part is not filled in', () => {
		const r = record();
		usePart(r, 'p1', { char: 'T', itemId: 'glyph-0x54' });
		usePart(r, 'p2', { char: 'U', itemId: 'glyph-0x55' });
		expect(prefillChar(r, 'p3')).toBe('V');
		skipPart(r, 'p3');
		expect(prefillChar(r, 'p4')).toBe('');
	});

	it('a part the finder skipped as junk does not break the run', () => {
		const r = record();
		usePart(r, 'p1', { char: 'N', itemId: 'glyph-0x4e' });
		usePart(r, 'p2', { char: 'O', itemId: 'glyph-0x4f' });
		expect(markJunk(r, 'p3')).toBe(true);
		expect(r.skipped).toContain('p3');
		expect(prefillChar(r, 'p4')).toBe('P');
	});
});

describe('a crossed-out letter is junk', () => {
	const NAMES = [
		'first-try-phone',
		'notebook-alphabet-phone',
		'single-g-phone',
		'alphabet-loose-phone',
		'alphabet-tight-scan',
		'brenna-loose-phone',
		'brenna-tight-phone',
		'single-j-phone',
	];
	const seen = {};
	beforeAll(async () => {
		for (const name of NAMES) {
			const { image, key } = await loadPhotoFixture(name);
			const { mask } = photoInk(image, { paper: key.paper });
			seen[name] = { key, found: findInk(mask, image.width, image.height) };
		}
	}, 120000);

	it("the notebook's crossed-out Q", () => {
		const { key, found } = seen['notebook-alphabet-phone'];
		const [l, t, r, b] = key.crossedOut.box;
		const crossed = found.parts.filter(
			(p) => p.left < r && p.right > l && p.top < b && p.bottom > t
		);
		expect(crossed).toHaveLength(1);
		expect(isJunkPart(crossed[0], found.stroke)).toBe(true);
	});

	it.each(NAMES)('%s: no part holding a written letter is junk', (name) => {
		const { key, found } = seen[name];
		const inside = (p, [x, y]) => x >= p.left && x < p.right && y >= p.top && y < p.bottom;
		for (const letter of key.letters) {
			const part = found.parts.find((p) => inside(p, letter.center));
			if (!part) continue;
			expect(isJunkPart(part, found.stroke), `${name} ${letter.char}`).toBe(false);
		}
	});
});
