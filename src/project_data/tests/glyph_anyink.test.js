// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { Glyph } from '../glyph.js';
import { GlyphrStudioProject } from '../glyphr_studio_project.js';

const traceData = {
	trace: { asset: 'img-abcd1234', x: 10, y: -20, scale: 1.5, opacity: 0.4, visible: true, locked: false },
	altOf: 'glyph-0x61',
};

describe('Glyph.anyink', () => {
	it('defaults to an empty object and is not saved', () => {
		const glyph = new Glyph({ id: 'glyph-0x41' });
		expect(glyph.anyink).toEqual({});
		expect('anyink' in glyph.save()).toBe(false);
		expect('anyink' in glyph.save(true)).toBe(false);
	});

	it('stores a clone of the passed object', () => {
		const input = structuredClone(traceData);
		const glyph = new Glyph({ id: 'glyph-0x41', anyink: input });
		expect(glyph.anyink).toEqual(traceData);
		expect(glyph.anyink).not.toBe(input);
		input.trace.x = 999;
		expect(glyph.anyink.trace.x).toBe(10);
	});

	it('treats empty or non-object input as nothing', () => {
		expect(new Glyph({ anyink: {} }).anyink).toEqual({});
		expect(new Glyph({ anyink: null }).anyink).toEqual({});
		expect(new Glyph({ anyink: [1, 2] }).anyink).toEqual({});
		expect(new Glyph({ anyink: 'trace' }).anyink).toEqual({});
		expect('anyink' in new Glyph({ anyink: {} }).save()).toBe(false);
	});

	it('save() emits anyink only when non-empty, as a clone', () => {
		const glyph = new Glyph({ id: 'glyph-0x41', anyink: traceData });
		const saved = glyph.save();
		expect(saved.anyink).toEqual(traceData);
		expect(saved.anyink).not.toBe(glyph.anyink);
		saved.anyink.trace.opacity = 1;
		expect(glyph.anyink.trace.opacity).toBe(0.4);
	});

	it('data added after construction is saved', () => {
		const glyph = new Glyph({ id: 'glyph-0x61' });
		glyph.anyink.alternates = ['alt-0x61-1'];
		expect(glyph.save().anyink).toEqual({ alternates: ['alt-0x61-1'] });
		delete glyph.anyink.alternates;
		expect('anyink' in glyph.save()).toBe(false);
	});

	it('round trips through save() and clone()', () => {
		const glyph = new Glyph({ id: 'glyph-0x41', anyink: traceData });
		expect(new Glyph(glyph.save()).anyink).toEqual(traceData);
		expect(new Glyph(glyph.clone()).anyink).toEqual(traceData);
		expect(new Glyph(JSON.parse(JSON.stringify(glyph.save()))).anyink).toEqual(traceData);
	});

	it('leaves the rest of the saved glyph as before', () => {
		const glyph = new Glyph({
			id: 'glyph-0x41',
			advanceWidth: 500,
			shapes: [
				{ pathPoints: [{ p: { coord: { x: 0, y: 0 } } }, { p: { coord: { x: 10, y: 10 } } }] },
			],
		});
		const plain = glyph.save();
		glyph.anyink.altOf = 'glyph-0x61';
		const withData = glyph.save();
		delete withData.anyink;
		expect(withData).toEqual(plain);
	});

	it('hydrates and saves through a GlyphrStudioProject', () => {
		const project = new GlyphrStudioProject({
			settings: { project: { name: 'T', latestVersion: '2.10.5' } },
			glyphs: {
				'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600, anyink: traceData },
				'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 600 },
			},
		});
		expect(project.glyphs['glyph-0x41'].anyink).toEqual(traceData);
		expect(project.glyphs['glyph-0x42'].anyink).toEqual({});
		const saved = project.save();
		expect(saved.glyphs['glyph-0x41'].anyink).toEqual(traceData);
		expect('anyink' in saved.glyphs['glyph-0x42']).toBe(false);
		const again = new GlyphrStudioProject(saved);
		expect(again.glyphs['glyph-0x41'].anyink).toEqual(traceData);
	});
});
