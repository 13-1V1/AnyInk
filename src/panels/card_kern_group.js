// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { notifyKernPairsChanged } from '../anyink/kerning/kern_lookup.js';
import { getRepresentatives, setRepresentative } from '../anyink/kerning/pair_state.js';
import { getCurrentProjectEditor } from '../app/main.js';
import { addAsChildren, makeElement } from '../common/dom.js';
import { makeKernGroupCharChips } from '../pages/kerning.js';
import { addChildActions, getActionData, makeActionsArea_KernGroup } from './actions.js';
import { makeSingleInput, makeSingleLabel, rowPad } from './cards.js';

// --------------------------------------------------------------
// Kern Group Attributes Card
// --------------------------------------------------------------

/**
 * ANY-INK (audit B3): the Value field is a secondary readout bound to the canvas drag
 * (still editable), and the member chips pick the representative glyph the pair view shows.
 * @param {Object} kernGroup - KernGroup
 * @returns {Element}
 */
export function makeCard_kernGroup(kernGroup) {
	// log(`makeCard_kernGroup`, 'start');
	// log(kernGroup);

	let kernGroupCard = makeElement({
		tag: 'div',
		className: 'panel__card',
		innerHTML: '<h3>Kern Group</h3>',
	});

	let valueLabel = makeSingleLabel(
		'Value',
		"The value of a kern group is an adjustment to the left group's advance width.<br><br>Drag the right letter on the canvas to change it (Shift snaps to 10, arrow keys nudge). Typing a number here works too."
	);
	let valueInput = makeSingleInput(kernGroup, 'value', 'currentKernGroup', 'input-number');
	// A typed value is a kern edit like any other: refresh the lookup and tell the strip
	valueInput.addEventListener('change', () => {
		notifyKernPairsChanged(getCurrentProjectEditor(), {
			groupID: kernGroup.id,
			value: kernGroup.value,
		});
	});

	const reps = getRepresentatives(kernGroup);
	const chipTitle = 'Click to show this glyph in the pair view';

	let leftLabel = makeSingleLabel('Left group', 'Click a chip to make it the left glyph shown on the canvas.');
	let leftInput = makeKernGroupCharChips(kernGroup.leftGroup, {
		representative: reps.left,
		title: chipTitle,
		onClick: (hex) => pickRepresentative(kernGroup, 'left', hex, leftInput),
	});

	let rightLabel = makeSingleLabel('Right group', 'Click a chip to make it the right glyph shown on the canvas. Alt-drag on the canvas kerns just the shown pair.');
	let rightInput = makeKernGroupCharChips(kernGroup.rightGroup, {
		representative: reps.right,
		title: chipTitle,
		onClick: (hex) => pickRepresentative(kernGroup, 'right', hex, rightInput),
	});

	// Put it all together
	addAsChildren(kernGroupCard, [
		valueLabel,
		valueInput,
		leftLabel,
		leftInput,
		rightLabel,
		rightInput,
	]);

	addAsChildren(kernGroupCard, rowPad());
	addAsChildren(kernGroupCard, makeActionsArea_KernGroup());

	// log(`makeCard_kernGroup`, 'end');
	return kernGroupCard;
}

/**
 * Remember the representative, mark its chip, and redraw the pair view.
 * @param {Object} kernGroup
 * @param {'left'|'right'} side
 * @param {String} hex
 * @param {Element} chipWrapper
 */
function pickRepresentative(kernGroup, side, hex, chipWrapper) {
	if (!setRepresentative(kernGroup, side, hex)) return;
	chipWrapper.querySelectorAll('code').forEach((chip) => {
		if (chip.dataset.hex === hex) chip.dataset.representative = '';
		else delete chip.dataset.representative;
	});
	const editor = getCurrentProjectEditor();
	if (editor.editCanvas?.redraw) editor.editCanvas.redraw('anyink.kerning.representative');
}

export function makeCard_otherKernGroupActions() {
	let actionsCard = makeElement({
		tag: 'div',
		className: 'panel__card',
		innerHTML: '<h3>Other kern group actions</h3>',
	});

	let actionsArea = makeElement({ tag: 'div', className: 'panel__actions-area' });
	addChildActions(actionsArea, getActionData('otherKernGroupActions'));
	actionsCard.appendChild(actionsArea);

	return actionsCard;
}
