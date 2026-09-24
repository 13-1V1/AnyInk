// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/*
	Integration test for the Transforms panel sliders (src/panels/transforms.js) against a
	real ProjectEditor and the simple sample project, in jsdom. Covers: apply on release,
	relative application across releases, one history entry per release, Reset returning the
	shapes, silent reset on selection change, and the Offset card keeping its Apply button.
*/
import { beforeEach, describe, expect, it } from 'vitest';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makePanel_Transforms } from '../../../panels/transforms.js';

const tan = (deg) => Math.tan((deg * Math.PI) / 180);

function release(bar, value) {
	bar.value = String(value);
	bar.dispatchEvent(new Event('input', { bubbles: true }));
	bar.dispatchEvent(new Event('change', { bubbles: true }));
}

function pointsOf(path) {
	return path.pathPoints.map((pp) => ({
		p: { x: pp.p.x, y: pp.p.y },
		h1: { x: pp.h1.x, y: pp.h1.y },
		h2: { x: pp.h2.x, y: pp.h2.y },
	}));
}

function expectPoints(path, expected, digits = 6) {
	const actual = pointsOf(path);
	actual.forEach((pt, i) => {
		['p', 'h1', 'h2'].forEach((k) => {
			expect(pt[k].x).toBeCloseTo(expected[i][k].x, digits);
			expect(pt[k].y).toBeCloseTo(expected[i][k].y, digits);
		});
	});
}

describe('Transforms panel sliders', () => {
	let editor;
	let glyph;
	let path;
	let holder;

	beforeEach(() => {
		const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		editor = new ProjectEditor({ project });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x41';
		glyph = editor.selectedItem;
		path = glyph.shapes[0];
		holder = document.createElement('div');
		makePanel_Transforms().forEach((card) => holder.appendChild(card));
		document.body.innerHTML = '';
		document.body.appendChild(holder);
	});

	it('has no typed inputs and no Apply buttons for skew and rotation', () => {
		expect(holder.querySelector('input-number')).toBeNull();
		expect(holder.querySelector('#skewAngle_applyButton')).toBeNull();
		expect(holder.querySelector('#rotation_applyButton')).toBeNull();
		expect(holder.querySelector('#skewAngle_slider').type).toBe('range');
		expect(holder.querySelector('#skewDistance_slider').type).toBe('range');
		expect(holder.querySelector('#rotation_slider').type).toBe('range');
		expect(holder.querySelector('#skewAngle_slider').getAttribute('min')).toBe('-45');
		expect(holder.querySelector('#skewDistance_slider').getAttribute('max')).toBe('500');
		expect(holder.querySelector('#rotation_slider').getAttribute('max')).toBe('180');
	});

	it('is disabled until a shape is selected', () => {
		const bar = holder.querySelector('#skewAngle_slider');
		expect(bar.disabled).toBe(true);
		editor.multiSelect.shapes.add(path);
		expect(bar.disabled).toBe(false);
		editor.multiSelect.shapes.clear();
		expect(bar.disabled).toBe(true);
	});

	it('skews on release, keeps skewing relative to the last value, one history entry each', () => {
		const before = pointsOf(path);
		editor.multiSelect.shapes.add(path);
		const bar = holder.querySelector('#skewAngle_slider');
		const historyBefore = editor.history.length;

		release(bar, 20);
		expect(editor.history.length).toBe(historyBefore + 1);
		expect(editor.history.queue[0].title).toBe('Skew 1 shape by 20°');
		expectPoints(
			path,
			before.map((pt) => ({
				p: { x: pt.p.x + pt.p.y * tan(20), y: pt.p.y },
				h1: { x: pt.h1.x + pt.h1.y * tan(20), y: pt.h1.y },
				h2: { x: pt.h2.x + pt.h2.y * tan(20), y: pt.h2.y },
			}))
		);

		// Dragging further lands on the new angle, not 20 + 35
		release(bar, 35);
		expect(editor.history.length).toBe(historyBefore + 2);
		expectPoints(
			path,
			before.map((pt) => ({
				p: { x: pt.p.x + pt.p.y * tan(35), y: pt.p.y },
				h1: { x: pt.h1.x + pt.h1.y * tan(35), y: pt.h1.y },
				h2: { x: pt.h2.x + pt.h2.y * tan(35), y: pt.h2.y },
			}))
		);

		// Releasing at the same value adds nothing
		release(bar, 35);
		expect(editor.history.length).toBe(historyBefore + 2);

		// Reset returns the shape
		holder.querySelector('#skewAngle_slider').closest('.anyink-slider-row').querySelector('.anyink-slider-row__reset').click();
		expect(bar.value).toBe('0');
		expect(editor.history.length).toBe(historyBefore + 3);
		expectPoints(path, before);
	});

	it('skew distance is additive and returns on reset', () => {
		const before = pointsOf(path);
		const yMax = path.maxes.yMax;
		editor.multiSelect.shapes.add(path);
		const bar = holder.querySelector('#skewDistance_slider');

		release(bar, 100);
		release(bar, 250);
		expect(editor.history.queue[0].title).toBe('Skew 1 shape by 150em');
		expectPoints(
			path,
			before.map((pt) => ({
				p: { x: pt.p.x + (pt.p.y / yMax) * 250, y: pt.p.y },
				h1: { x: pt.h1.x + (pt.h1.y / yMax) * 250, y: pt.h1.y },
				h2: { x: pt.h2.x + (pt.h2.y / yMax) * 250, y: pt.h2.y },
			}))
		);
		release(bar, 0);
		expectPoints(path, before);
	});

	it('rotates about one center across releases and returns on reset', () => {
		const before = pointsOf(path);
		editor.multiSelect.shapes.add(path);
		// the panel captures the selection's center on the first release of a session
		const center = { ...editor.multiSelect.shapes.maxes.center };
		const bar = holder.querySelector('#rotation_slider');
		const historyBefore = editor.history.length;

		release(bar, 30);
		release(bar, 45);
		expect(editor.history.length).toBe(historyBefore + 2);
		expect(editor.history.queue[0].title).toBe('Rotated 1 shape by 15°');
		// upstream rotates by -angle radians about the center
		const a = (-45 * Math.PI) / 180;
		const rot = ({ x, y }) => ({
			x: center.x + (x - center.x) * Math.cos(a) - (y - center.y) * Math.sin(a),
			y: center.y + (x - center.x) * Math.sin(a) + (y - center.y) * Math.cos(a),
		});
		expectPoints(path, before.map((pt) => ({ p: rot(pt.p), h1: rot(pt.h1), h2: rot(pt.h2) })), 4);

		release(bar, 0);
		expectPoints(path, before, 4);
	});

	it('goes back to neutral silently when the selection changes', () => {
		editor.multiSelect.shapes.add(path);
		const bar = holder.querySelector('#rotation_slider');
		release(bar, 30);
		const afterRotate = pointsOf(path);
		const historyAfter = editor.history.length;

		editor.multiSelect.shapes.clear();
		expect(bar.value).toBe('0');
		expect(editor.history.length).toBe(historyAfter);
		expectPoints(path, afterRotate);

		// a fresh selection starts a new relative session from the rotated state
		editor.multiSelect.shapes.add(path);
		release(bar, 30);
		expect(editor.history.length).toBe(historyAfter + 1);
	});

	it('offset keeps a slider plus Apply that only shows with a selection and a non-zero value', () => {
		const bar = holder.querySelector('#offsetPath_slider');
		const applyButton = holder.querySelector('#offsetPath_applyButton');
		expect(bar.getAttribute('min')).toBe('-200');
		expect(applyButton.style.display).toBe('none');

		editor.multiSelect.shapes.add(path);
		expect(applyButton.style.display).toBe('block');
		expect(applyButton.hasAttribute('disabled')).toBe(true);

		release(bar, 20);
		expect(applyButton.hasAttribute('disabled')).toBe(false);
		// the slider alone changes nothing
		expect(editor.history.length).toBe(0);

		editor.multiSelect.shapes.clear();
		expect(applyButton.style.display).toBe('none');
	});
});
