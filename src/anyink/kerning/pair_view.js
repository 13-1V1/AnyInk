// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kerning pair view (Milestone 5, D-010).
	Draws sample-word context around the current kern pair on the Kerning page canvas and
	the drag affordance on the right-hand group. Hit testing and the drag itself live in
	src/edit_canvas/tools/kern.js; positions come from pair_layout.js.

	Contract used by the hook in src/edit_canvas/edit_canvas.js redrawKernEdit():
	- drawKernPairView(ctx, view, kernGroup): called after the left and right groups are drawn.

	What it draws, in order:
	1. the kern gap tint between em x = 0 and x = value (negative darker, positive lighter)
	2. one faint sample glyph outside each representative ('n'/'H' by case, 'o'/'O' fallback)
	3. the two representatives again at full ink, so they stay solid over the tint and over
	   upstream's alpha-stacked class members
	4. a grab handle on the x = value line, green while hovered or dragging, with the value
	   as a live readout beside it
	Colors come from theme tokens read at draw time.
*/
import { drawGlyph } from '../../display_canvas/draw_paths.js';
import { token } from '../theme/theme.js';
import { layoutPairView } from './pair_layout.js';
import { getRepresentatives, kernPairState } from './pair_state.js';

export const HANDLE_WIDTH_PX = 6;
export const HANDLE_HEIGHT_PX = 16;
export const HANDLE_GAP_PX = 6; // space between the ascent line and the handle

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} view - {dx, dy, dz}
 * @param {Object} kernGroup - the KernGroup being edited
 * @param {Object} [project] - defaults to the kern group's parent project
 */
export function drawKernPairView(ctx, view, kernGroup, project = kernGroup?.parent) {
	if (!ctx || !view || !kernGroup || !project) return;
	const font = project.settings?.font || {};
	const ascent = Number(font.ascent) || 0;
	const descent = Number(font.descent) || 0;
	const reps = getRepresentatives(kernGroup);
	const layout = layoutPairView(project, kernGroup, reps);

	drawGapTint(ctx, view, layout.value, ascent, descent);

	// Sample word context, faint
	const faint = token('--canvas-ink-faint');
	if (layout.leftContext) drawAt(ctx, view, layout.leftContext.glyph, layout.leftContext.x, faint);
	if (layout.rightContext) {
		drawAt(ctx, view, layout.rightContext.glyph, layout.rightContext.x, faint);
	}

	// Representatives solid on top of the tint and the alpha-stacked members
	const ink = token('--canvas-ink');
	if (layout.left?.glyph) drawAt(ctx, view, layout.left.glyph, layout.left.x, ink);
	if (layout.right?.glyph) drawAt(ctx, view, layout.right.glyph, layout.right.x, ink);

	drawHandle(ctx, view, layout.value, ascent);
}

/**
 * Draw one glyph with its left edge at an em x position.
 */
function drawAt(ctx, view, glyph, emX, fill) {
	if (!glyph?.shapes?.length) return;
	const shifted = { dx: view.dx + emX * view.dz, dy: view.dy, dz: view.dz };
	drawGlyph(glyph, ctx, shifted, 1, fill);
}

/**
 * Tint the kern gap between x = 0 and x = value, descent to ascent.
 */
function drawGapTint(ctx, view, value, ascent, descent) {
	if (!value) return;
	const x0 = view.dx + Math.min(0, value) * view.dz;
	const width = Math.abs(value) * view.dz;
	const top = view.dy - ascent * view.dz;
	const height = (ascent - descent) * view.dz;
	ctx.fillStyle = value < 0 ? token('--canvas-kern-negative') : token('--canvas-kern-positive');
	ctx.fillRect(Math.floor(x0), Math.floor(top), Math.ceil(width), Math.ceil(height));
}

/**
 * Grab handle on the x = value line, just above the ascent line, plus a live readout
 * while the pointer is on the drag zone or a drag is in progress.
 */
function drawHandle(ctx, view, value, ascent) {
	const active = kernPairState.hover || kernPairState.dragging;
	const lineX = Math.floor(view.dx + value * view.dz);
	const ascentY = view.dy - ascent * view.dz;
	const top = Math.floor(ascentY - HANDLE_GAP_PX - HANDLE_HEIGHT_PX);
	const left = lineX - Math.floor(HANDLE_WIDTH_PX / 2) + 1;

	ctx.fillStyle = active ? token('--canvas-guide-hover') : token('--canvas-kern');
	roundedRect(ctx, left, top, HANDLE_WIDTH_PX, HANDLE_HEIGHT_PX, 2);
	ctx.fill();

	if (!active) return;
	const text = `${value}`;
	ctx.font = '10px Tahoma, Verdana, sans-serif';
	ctx.textBaseline = 'middle';
	const textX = left + HANDLE_WIDTH_PX + 6;
	const textY = top + HANDLE_HEIGHT_PX / 2;
	ctx.strokeStyle = token('--canvas-label-halo');
	ctx.lineWidth = 3;
	ctx.strokeText(text, textX, textY);
	ctx.fillStyle = token('--canvas-guide-hover');
	ctx.fillText(text, textX, textY);
	ctx.textBaseline = 'alphabetic';
}

function roundedRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	if (typeof ctx.roundRect === 'function') {
		ctx.roundRect(x, y, w, h, r);
	} else {
		ctx.rect(x, y, w, h);
	}
	ctx.closePath();
}
