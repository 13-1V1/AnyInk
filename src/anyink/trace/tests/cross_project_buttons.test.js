// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 finalize: the real cross-project buttons ("Overwrite selected items" and
// "Add components") bring a traced item's image into the other project, and the trace
// follows the outline when "Scale items to match destination Em size" is checked.
// Two real ProjectEditors, the real Cross-project actions page, the button clicked.
import { beforeEach, describe, expect, it } from 'vitest';
import {
	updateContent_addComponents,
	updateFooter_addComponents,
} from '../../../app/cross_project_actions/action_add_components.js';
import {
	updateContent_overwriteItems,
	updateFooter_overwriteItems,
} from '../../../app/cross_project_actions/action_overwrite_items.js';
import {
	clearAllSelections,
	makePage_CrossProjectActions,
	updateSelectedIDs,
} from '../../../app/cross_project_actions/cross_project_actions.js';
import { getGlyphrStudioApp, setCurrentProjectEditor } from '../../../app/main.js';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { getTrace, setTrace } from '../trace_model.js';

const GLYPH = 'glyph-0x41';
const png = (text = 'png') => new Blob([text], { type: 'image/png' });

function editorFor(id, { upm = 1000 } = {}) {
	const data = structuredClone(simpleExampleProject);
	data.settings.project.id = id;
	data.settings.project.name = id;
	data.settings.font.upm = upm;
	return new ProjectEditor({ project: new GlyphrStudioProject(data) });
}

function traceOn(item, asset, overrides = {}) {
	setTrace(item, { asset, width: 300, height: 600, x: 10, y: 800, scale: 1.5, ...overrides });
	return getTrace(item);
}

/** Plain copy of an item's outline box (Glyph.maxes can be a live object). */
function box(item) {
	const { xMin, yMin, xMax, yMax } = item.maxes;
	return { xMin, yMin, width: xMax - xMin, height: yMax - yMin };
}

/** Opens the Cross-project actions page with src as the source and dst as the destination. */
function openPage(src, dst) {
	const app = getGlyphrStudioApp();
	app.projectEditors = [src, dst];
	app.selectedProjectEditor = dst;
	setCurrentProjectEditor(dst);
	document.body.innerHTML = '';
	document.body.appendChild(makePage_CrossProjectActions());
	clearAllSelections();
}

/**
 * Builds an action's content and footer as the page does, ticks the boxes, selects the
 * items, and clicks the action's button.
 */
function runAction({ content, footer }, itemIDs, { scale = false } = {}) {
	const pageContent = document.querySelector('#cross-project-actions__page-content');
	const pageFooter = document.querySelector('#cross-project-actions__page-footer');
	content(pageContent);
	footer(pageFooter);
	/** @type {HTMLInputElement} */
	const scaleBox = document.querySelector('#checkbox-scale');
	if (scale) {
		expect(scaleBox).not.toBe(null); // offered only when the two em sizes differ
		scaleBox.checked = true;
	}
	itemIDs.forEach((id) => updateSelectedIDs(id));
	pageFooter.querySelector('fancy-button').click();
}

const overwrite = { content: updateContent_overwriteItems, footer: updateFooter_overwriteItems };
const addComponents = { content: updateContent_addComponents, footer: updateFooter_addComponents };

beforeEach(() => {
	// jsdom has no Element.animate; showToast's removal timer calls it
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
});

describe('cross-project buttons carry the trace image (finalize)', () => {
	it('Overwrite selected items: the destination holds the image and its .gs2 saves it', async () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const id = src.assets.add(png());
		const before = traceOn(src.project.getItem(GLYPH), id);
		openPage(src, dst);

		runAction(overwrite, [GLYPH]);

		expect(dst.assets.has(id)).toBe(true);
		expect(getTrace(dst.project.getItem(GLYPH))).toEqual(before);
		const saved = JSON.parse(await dst.makeProjectFileText());
		expect(saved.glyphs[GLYPH].anyink.trace.asset).toBe(id);
		expect(Object.keys(saved.assets)).toEqual([id]);
	});

	it('Add components: the new component keeps its image in the destination', async () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST');
		const id = src.assets.add(png());
		const componentID = src.project.addItemByType(new Glyph({ name: 'bowl' }), 'Component').id;
		traceOn(src.project.getItem(componentID), id);
		openPage(src, dst);
		const componentsBefore = Object.keys(dst.project.components);

		runAction(addComponents, [componentID]);

		const added = Object.keys(dst.project.components).filter((c) => !componentsBefore.includes(c));
		expect(added.length).toBe(1);
		expect(getTrace(dst.project.getItem(added[0])).asset).toBe(id);
		expect(dst.assets.has(id)).toBe(true);
		const saved = JSON.parse(await dst.makeProjectFileText());
		expect(Object.keys(saved.assets)).toEqual([id]);
	});

	it('an overwrite that brings no trace keeps the destination item its own trace', () => {
		const src = editorFor('g2_SRC');
		const dst = editorFor('g2_DST', { upm: 2000 });
		const own = traceOn(dst.project.getItem(GLYPH), dst.assets.add(png('mine')), { x: 40 });
		openPage(src, dst);

		runAction(overwrite, [GLYPH], { scale: true });

		expect(getTrace(dst.project.getItem(GLYPH))).toEqual(own); // not rescaled either
	});
});

describe('Scale items to match destination Em size (finalize)', () => {
	it('the trace follows the outline it was traced for', () => {
		const src = editorFor('g2_SRC', { upm: 1000 });
		const dst = editorFor('g2_DST', { upm: 2000 });
		const item = src.project.getItem(GLYPH);
		const was = traceOn(item, src.assets.add(png()));
		const from = box(item);
		openPage(src, dst);

		runAction(overwrite, [GLYPH], { scale: true });

		const copied = dst.project.getItem(GLYPH);
		const to = box(copied);
		const ratio = to.width / from.width;
		expect(ratio).toBeGreaterThan(1.5); // the outline did grow
		const now = getTrace(copied);
		expect(now.scale).toBeCloseTo(was.scale * ratio, 6);
		expect(now.x).toBeCloseTo(to.xMin + (was.x - from.xMin) * ratio, 4);
		expect(now.y).toBeCloseTo(to.yMin + (was.y - from.yMin) * ratio, 4);
		expect([now.width, now.height, now.asset]).toEqual([was.width, was.height, was.asset]);
	});

	it('a traced item with no outline yet scales with the em, from the left side on the baseline', () => {
		const src = editorFor('g2_SRC', { upm: 1000 });
		const dst = editorFor('g2_DST', { upm: 2000 });
		const item = src.project.getItem(GLYPH);
		item.shapes = [];
		const was = traceOn(item, src.assets.add(png()));
		openPage(src, dst);

		runAction(overwrite, [GLYPH], { scale: true });

		const now = getTrace(dst.project.getItem(GLYPH));
		expect(now.scale).toBeCloseTo(was.scale * 2, 6);
		expect(now.x).toBeCloseTo(was.x * 2, 6);
		expect(now.y).toBeCloseTo(was.y * 2, 6);
	});

	it('Add components scales the trace with the component', () => {
		const src = editorFor('g2_SRC', { upm: 1000 });
		const dst = editorFor('g2_DST', { upm: 500 });
		const componentID = src.project.addItemByType(new Glyph({ name: 'bowl' }), 'Component').id;
		const was = traceOn(src.project.getItem(componentID), src.assets.add(png()));
		openPage(src, dst);
		const componentsBefore = Object.keys(dst.project.components);

		runAction(addComponents, [componentID], { scale: true });

		const added = Object.keys(dst.project.components).filter((c) => !componentsBefore.includes(c));
		const now = getTrace(dst.project.getItem(added[0]));
		expect(now.scale).toBeCloseTo(was.scale / 2, 6);
		expect(now.y).toBeCloseTo(was.y / 2, 6);
	});
});
