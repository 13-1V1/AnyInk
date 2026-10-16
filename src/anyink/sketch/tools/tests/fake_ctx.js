// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 tools track, test helper: a tool context for the five drawing tools, in font units on the
	new-font lines (upm 2048, capitals 1480, small-letter 1100, tail -440, top 1550), and
	synthetic pointer events shaped like tool_route.js's. The tools use the real chain.js and
	snap.js; the view is zoomed so the snap radius is 20 font units (HIT_ZONE_PX / 0.3).

	  FONT, VIEW, RADIUS, THICKNESS
	  makeCtx({ sketch, use, thickness })   ctx with ctx.commits (every finished piece) and
	                                        ctx.stored (the letter's sketch, updated on commit)
	  pointer(tool)                          { click, down, up, move, drag, path, doubleClick,
	                                        key }: time spaced so no two clicks read as a
	                                        double-click unless asked; key(name) sends a
	                                        key-down press and returns what the tool said
*/
import { HIT_ZONE_PX } from '../../../metrics/hit_test.js';

export const FONT = Object.freeze({ upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 });
export const VIEW = Object.freeze({ dx: 0, dy: 0, dz: HIT_ZONE_PX / 20 });
export const RADIUS = 20;
export const THICKNESS = 99;

/**
 * @param {Object} [options]
 * @returns {Object} the tool context
 */
export function makeCtx({ sketch = null, use, thickness = THICKNESS } = {}) {
	const ctx = {
		stored: sketch,
		commits: [],
		font: FONT,
		view: VIEW,
		thickness,
		use,
		getSketch: () => ctx.stored,
		commit: (result) => {
			ctx.commits.push(result);
			ctx.stored = result.sketch;
		},
	};
	return ctx;
}

/**
 * @param {Object} tool
 * @returns {Object} event helpers
 */
export function pointer(tool) {
	let time = 0;
	const ev = (x, y, extra = {}) => {
		time += extra.gap ?? 1000;
		const rest = { ...extra };
		delete rest.gap;
		return { x, y, time, detail: 1, buttons: 0, shift: false, ctrl: false, snapsOff: !!rest.ctrl, ...rest };
	};
	const move = (x, y, extra) => tool.move(ev(x, y, extra));
	return {
		down: (x, y, extra) => tool.down(ev(x, y, extra)),
		up: (x, y, extra) => tool.up(ev(x, y, { gap: 10, ...extra })),
		move,
		click: (x, y, extra = {}) => {
			move(x, y, extra);
			tool.down(ev(x, y, extra));
			return tool.up(ev(x, y, { ...extra, gap: 10 }));
		},
		doubleClick: (x, y) => {
			move(x, y);
			tool.down(ev(x, y));
			tool.up(ev(x, y, { gap: 10 }));
			tool.down(ev(x, y, { gap: 80, detail: 2 }));
			tool.up(ev(x, y, { gap: 10, detail: 2 }));
			return tool.doubleClick?.(ev(x, y, { gap: 5, detail: 2 }));
		},
		drag: (from, to, extra = {}) => {
			move(from[0], from[1], extra);
			tool.down(ev(from[0], from[1], { ...extra, buttons: 1 }));
			const steps = 6;
			for (let i = 1; i <= steps; i++) {
				const x = from[0] + ((to[0] - from[0]) * i) / steps;
				const y = from[1] + ((to[1] - from[1]) * i) / steps;
				tool.move(ev(x, y, { ...extra, gap: 16, buttons: 1 }));
			}
			return tool.up(ev(to[0], to[1], { ...extra, gap: 16 }));
		},
		/** a pointer path (no button) through each [x, y] */
		path: (points, extra = {}) => points.forEach(([x, y]) => move(x, y, { ...extra, gap: 16 })),
		key: (name, extra = {}) => tool.key({ type: 'down', key: name, shift: false, ctrl: false, alt: false, ...extra }),
	};
}
