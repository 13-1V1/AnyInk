// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 fix (panel track): a traced item copied from one open project to another
// brings its image along (src/anyink/trace/trace_carry.js). Runs the same steps as the
// cross-project 'Overwrite items' and 'Add components' actions (upstream's
// makeGlyphWithResolvedLinks, then addItemByType) against two real ProjectEditors, and
// checks what the destination's .gs2 file would hold.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { makeGlyphWithResolvedLinks } from '../../../project_editor/cross_item_actions.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { carryTraceAsset } from '../trace_carry.js';
import { getTrace, setTrace } from '../trace_model.js';

const png = (text = 'png') => new Blob([text], { type: 'image/png' });

function editorFor(id) {
	const data = structuredClone(simpleExampleProject);
	data.settings.project.id = id;
	return new ProjectEditor({ project: new GlyphrStudioProject(data) });
}

function traceOn(item, asset, overrides = {}) {
	setTrace(item, { asset, width: 300, height: 600, x: 10, y: 800, scale: 1.5, ...overrides });
	return getTrace(item);
}

/** The steps both cross-project actions take for one item, with the fix in place. */
function copyItem(src, dst, itemID, objType = 'Glyph') {
	const sourceItem = src.project.getItem(itemID);
	const replacing = objType === 'Component' ? null : dst.project.getItem(itemID);
	const resolved = makeGlyphWithResolvedLinks(sourceItem);
	carryTraceAsset(src, dst, resolved, { replacing });
	// addItemByType returns the added item
	if (objType === 'Component') return dst.project.addItemByType(resolved, 'Component');
	dst.project.addItemByType(resolved, objType, itemID);
	return dst.project.getItem(itemID);
}

describe('carryTraceAsset: copying a traced item to another project', () => {
	it('Overwrite items: the destination holds the image and its .gs2 saves it', async () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const blob = png();
		const id = src.assets.add(blob);
		const before = traceOn(src.project.getItem('glyph-0x41'), id);

		const copied = copyItem(src, dst, 'glyph-0x41');

		expect(dst.assets.has(id)).toBe(true);
		expect(dst.assets.get(id).blob).toBe(blob);
		expect(getTrace(copied)).toEqual(before);
		const saved = JSON.parse(await dst.makeProjectFileText());
		expect(saved.glyphs['glyph-0x41'].anyink.trace.asset).toBe(id);
		expect(Object.keys(saved.assets)).toEqual([id]);
		expect(saved.assets[id].type).toBe('image/png');
		// The source project is untouched
		expect(src.assets.ids()).toEqual([id]);
		expect(getTrace(src.project.getItem('glyph-0x41'))).toEqual(before);
	});

	it('Add components: the new component keeps its image in the destination', async () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const id = src.assets.add(png());
		const componentID = src.project.addItemByType(new Glyph({ name: 'bowl' }), 'Component').id;
		traceOn(src.project.getItem(componentID), id);

		const added = copyItem(src, dst, componentID, 'Component');

		expect(dst.assets.has(id)).toBe(true);
		expect(getTrace(added).asset).toBe(id);
		const saved = JSON.parse(await dst.makeProjectFileText());
		expect(Object.keys(saved.assets)).toEqual([id]);
	});

	it('gives the image a new id when the destination uses that id for another image', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const id = src.assets.add(png('source'));
		const theirs = png('destination');
		dst.assets.add(theirs, { id });
		traceOn(src.project.getItem('glyph-0x41'), id);

		const copied = copyItem(src, dst, 'glyph-0x41');

		const newID = getTrace(copied).asset;
		expect(newID).not.toBe(id);
		expect(newID).toMatch(/^img-[a-z0-9]{8}$/);
		expect(dst.assets.get(newID).blob).toBe(src.assets.get(id).blob);
		// The destination's own image under the old id is left alone
		expect(dst.assets.get(id).blob).toBe(theirs);
		// The source item still points at its own id
		expect(getTrace(src.project.getItem('glyph-0x41')).asset).toBe(id);
	});

	it('stores an image shared by several copied items once', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const id = src.assets.add(png('shared'));
		dst.assets.add(png('taken'), { id }); // forces a new id, so reuse must go by the Blob
		traceOn(src.project.getItem('glyph-0x41'), id);
		traceOn(src.project.getItem('glyph-0x42'), id, { x: 500 });

		const a = copyItem(src, dst, 'glyph-0x41');
		const b = copyItem(src, dst, 'glyph-0x42');

		expect(getTrace(a).asset).toBe(getTrace(b).asset);
		expect(dst.assets.ids()).toHaveLength(2);
	});

	it('drops a trace whose image the source does not have, instead of saving a broken one', async () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		traceOn(src.project.getItem('glyph-0x41'), 'img-gone0000');

		const copied = copyItem(src, dst, 'glyph-0x41');

		expect(getTrace(copied)).toBeNull();
		const saved = JSON.parse(await dst.makeProjectFileText());
		expect(saved.glyphs['glyph-0x41'].anyink).toBeUndefined();
		expect(saved.assets).toBeUndefined();
	});

	it('keeps the destination item trace when the copied item brings none', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const own = dst.assets.add(png('mine'));
		const mine = traceOn(dst.project.getItem('glyph-0x41'), own, { opacity: 0.7 });

		const copied = copyItem(src, dst, 'glyph-0x41');

		expect(getTrace(copied)).toEqual(mine);
		expect(dst.assets.ids()).toEqual([own]);
	});

	it('the copied item image wins over the destination item trace', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const theirs = src.assets.add(png('theirs'));
		traceOn(src.project.getItem('glyph-0x41'), theirs);
		const own = dst.assets.add(png('mine'));
		traceOn(dst.project.getItem('glyph-0x41'), own);

		const copied = copyItem(src, dst, 'glyph-0x41');

		expect(getTrace(copied).asset).toBe(theirs);
		// The destination's own image stays in its store (undo of the overwrite needs it)
		expect(dst.assets.has(own)).toBe(true);
	});

	it('does nothing for an item without a trace, or inside one project', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const plain = makeGlyphWithResolvedLinks(src.project.getItem('glyph-0x41'));
		expect(carryTraceAsset(src, dst, plain)).toBeNull();
		expect(getTrace(plain)).toBeNull();
		expect(dst.assets.ids()).toEqual([]);

		const id = src.assets.add(png());
		const item = src.project.getItem('glyph-0x42');
		traceOn(item, id);
		expect(carryTraceAsset(src, src, item)).toBe(id);
		expect(src.assets.ids()).toEqual([id]);
	});

	it('never puts a Blob inside the item', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const id = src.assets.add(png());
		traceOn(src.project.getItem('glyph-0x41'), id);
		const copied = copyItem(src, dst, 'glyph-0x41');
		const values = Object.values(copied.anyink.trace);
		expect(values.some((v) => v instanceof Blob)).toBe(false);
		expect(() => structuredClone(copied.save())).not.toThrow();
	});
});
