// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16, written to fail first: Simple's Menu drew Keyboard keys with upstream's 'keyboard' icon,
// which is drawn in 0 to 50 units inside makeIcon's 20 by 20 box, so it spilled over "Show tips
// again" below it. Every Menu row's icon must fit its 20 by 20 box.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeIcon } from '../../../common/graphics.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { menuRows } from '../simple_menu.js';

const nums = (text) => (String(text || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);

/**
 * The outer box of an icon's drawing. Rects, polygons, polylines, circles and lines exactly;
 * a path by its absolute points (M, L, H, V and the end of C / S / Q), enough to catch a whole
 * icon drawn at another scale.
 * @param {SVGElement} svg
 * @returns {{minX: Number, minY: Number, maxX: Number, maxY: Number}}
 */
function drawnBox(svg) {
	const xs = [];
	const ys = [];
	const at = (x, y) => {
		xs.push(x);
		ys.push(y);
	};
	for (const el of svg.querySelectorAll('g *')) {
		const n = (name) => Number(el.getAttribute(name) || 0);
		const tag = el.tagName.toLowerCase();
		if (tag === 'rect') {
			at(n('x'), n('y'));
			at(n('x') + n('width'), n('y') + n('height'));
		} else if (tag === 'polygon' || tag === 'polyline') {
			const p = nums(el.getAttribute('points'));
			for (let i = 0; i + 1 < p.length; i += 2) at(p[i], p[i + 1]);
		} else if (tag === 'circle') {
			at(n('cx') - n('r'), n('cy') - n('r'));
			at(n('cx') + n('r'), n('cy') + n('r'));
		} else if (tag === 'line') {
			at(n('x1'), n('y1'));
			at(n('x2'), n('y2'));
		} else if (tag === 'path') {
			const cmds = String(el.getAttribute('d')).match(/[A-Za-z][^A-Za-z]*/g) || [];
			for (const cmd of cmds) {
				const c = cmd[0];
				const p = nums(cmd.slice(1));
				if (c === 'M' || c === 'L') for (let i = 0; i + 1 < p.length; i += 2) at(p[i], p[i + 1]);
				if (c === 'C' && p.length >= 6) at(p[4], p[5]);
				if ((c === 'S' || c === 'Q') && p.length >= 4) at(p[2], p[3]);
				if (c === 'H') for (const x of p) xs.push(x);
				if (c === 'V') for (const y of p) ys.push(y);
			}
		}
	}
	return {
		minX: Math.min(...xs),
		minY: Math.min(...ys),
		maxX: Math.max(...xs),
		maxY: Math.max(...ys),
	};
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

describe('every Simple Menu icon fits its row', () => {
	it('with every row on, each icon is drawn inside its 20 by 20 box', () => {
		setFeaturesForTests({
			coach: true,
			startScreen: true,
			useInWord: true,
			fontDetails: true,
			help: true,
			photo: true,
		});
		const rows = menuRows(twoLetterEditor()).filter((row) => row.icon);
		expect(rows.length).toBeGreaterThan(5);
		const spills = [];
		for (const row of rows) {
			const holder = document.createElement('div');
			holder.innerHTML = makeIcon({ name: row.icon });
			const svg = holder.querySelector('svg');
			const size = Number(svg.getAttribute('width').replace('px', ''));
			const box = drawnBox(svg);
			const id = /data-anyink-row="([\w-]+)"/.exec(row.name)?.[1];
			if (box.minX < 0 || box.minY < 0 || box.maxX > size || box.maxY > size) {
				spills.push(`${id}: ${row.icon} ${JSON.stringify(box)} in ${size}`);
			}
		}
		expect(spills).toEqual([]);
	});

	it('Keyboard keys shows (so the check above covers it)', () => {
		setFeaturesForTests({ coach: true, help: true });
		const ids = menuRows(twoLetterEditor()).map(
			(row) => /data-anyink-row="([\w-]+)"/.exec(row.name || '')?.[1]
		);
		expect(ids).toContain('help-keys');
	});
});
