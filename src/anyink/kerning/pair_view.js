// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kerning pair view (Milestone 5, D-010).
	Draws sample-word context around the current kern pair on the Kerning page canvas and
	the drag affordance on the right-hand group. Hit testing and the drag itself live in
	src/edit_canvas/tools/kern.js.

	Contract used by the hook in src/edit_canvas/edit_canvas.js redrawKernEdit():
	- drawKernPairView(ctx, view, kernGroup): called after the left and right groups are drawn.

	This file is a scaffold; the milestone-5 kerning track fills it in.
*/

/**
 * @param {CanvasRenderingContext2D} _ctx
 * @param {Object} _view - {dx, dy, dz}
 * @param {Object} _kernGroup - the KernGroup being edited
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function drawKernPairView(_ctx, _view, _kernGroup) {}
