// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK kern pair view state (Milestone 5, D-010).
	Session-only state shared by the kern tool (writes), the pair view drawing (reads), and
	the kern group card chips (choose the representative). Nothing here is saved to the
	project file: the representative glyph is a viewing choice, not font data.

	- hover / dragging: is the pointer over the drag zone, is a drag in progress.
	- representative: which member of each side the pair view shows solid. Falls back to
	  the first member when the remembered one is not in the group.
*/

export const kernPairState = {
	/** @type {Boolean} pointer is over the right group's ink or the x = value line */
	hover: false,
	/** @type {Boolean} a drag is in progress */
	dragging: false,
	/** remembered representative hex per side, keyed by kern group id */
	representative: {},
};

/**
 * Which member of each side the pair view shows.
 * @param {Object} kernGroup - KernGroup
 * @returns {{left: String|false, right: String|false}} hex ids
 */
export function getRepresentatives(kernGroup) {
	if (!kernGroup) return { left: false, right: false };
	const remembered = kernPairState.representative[kernGroup.id] || {};
	return {
		left: pickSide(kernGroup.leftGroup, remembered.left),
		right: pickSide(kernGroup.rightGroup, remembered.right),
	};
}

function pickSide(members = [], wanted = false) {
	if (wanted && members.includes(wanted)) return wanted;
	return members.length ? members[0] : false;
}

/**
 * Remember a representative for one side of a group.
 * @param {Object} kernGroup - KernGroup
 * @param {'left'|'right'} side
 * @param {String} hex - member id
 * @returns {Boolean} true when it changed
 */
export function setRepresentative(kernGroup, side, hex) {
	if (!kernGroup?.id || (side !== 'left' && side !== 'right')) return false;
	const members = side === 'left' ? kernGroup.leftGroup : kernGroup.rightGroup;
	if (!members.includes(hex)) return false;
	const current = kernPairState.representative[kernGroup.id] || {};
	if (current[side] === hex) return false;
	kernPairState.representative[kernGroup.id] = { ...current, [side]: hex };
	return true;
}

/** Forget every remembered representative (tests, project switch). */
export function resetKernPairState() {
	kernPairState.hover = false;
	kernPairState.dragging = false;
	kernPairState.representative = {};
}
