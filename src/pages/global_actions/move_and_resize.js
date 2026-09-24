// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { makeElement } from '../../common/dom.js';
import { showToast } from '../../controls/dialogs/dialogs.js';
import { Glyph } from '../../project_data/glyph.js';
import { getComponentInstancesFromRoot } from '../../project_editor/cross_item_actions.js';
import { makeSliderRow, makeSliderTable } from '../../anyink/controls/slider_row.js';
import { glyphIterator } from './page.js';

/*
	ANY-INK (Milestone 5, audit D3): every typed number here is a slider with a live readout
	and a Reset. The Apply buttons stay, because a global action runs as a batch with progress
	and one undo step (glyphIterator, unchanged); the values are set by dragging.
	Ranges: move -1000..1000 em, scale 0.25..4 (step 0.01), resize -500..500 em, skew
	-45..45 deg, side bearings -200..500 em.
*/

// --------------------------------------------------------------
// Move
// --------------------------------------------------------------
/**
 * Makes the content for the Move global action card.
 * @returns {Element}
 */
export function makeCard_Move() {
	const card = makeElement({ className: 'global-actions__card' });

	card.appendChild(makeElement({ tag: 'h2', content: 'Move all glyphs' }));

	let description = makeElement({
		className: 'global-actions__description',
		content: `Drag the X and/or Y sliders, then press the button: all the glyphs in this font will have their position updated by that many Em units.`,
	});
	card.appendChild(description);

	let effect = makeElement({
		className: 'global-actions__effect-description',
		content: `Individual Glyphs, Ligatures, and Components will be moved.
		<br>
		<strong>Note:</strong> Component Instances that are linked to Items that are also moved will be skipped. If a Component Root and an Item that contains a Component Instance are both moved, the Component Instance would have been moved twice.`,
	});
	card.appendChild(effect);

	const moveXRow = makeSliderRow({
		id: 'moveX',
		label: 'X move',
		min: -1000,
		max: 1000,
		unit: 'em',
	});
	const moveYRow = makeSliderRow({
		id: 'moveY',
		label: 'Y move',
		min: -1000,
		max: 1000,
		unit: 'em',
	});
	card.appendChild(makeSliderTable([moveXRow, moveYRow]));

	const button = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '' },
		content: 'Move all glyphs',
	});
	button.addEventListener('click', () => {
		const moveX = moveXRow.value || 0;
		const moveY = moveYRow.value || 0;

		glyphIterator({
			title: 'Moving glyph',
			action: (/** @type {Glyph} */ glyph) => {
				if (!glyph.shapes || !glyph.shapes.length) return;
				glyph.shapes.forEach((shape) => {
					if (shape.objType !== 'ComponentInstance') {
						shape.updateShapePosition(moveX, moveY);
						glyph.changed();
					}
				});
			},
		});
	});

	card.appendChild(button);

	return card;
}

// --------------------------------------------------------------
// Scale Horizontal
// --------------------------------------------------------------
/**
 * Makes the content for the Scale Horizontal global action card.
 * @returns {Element}
 */
export function makeCard_ScaleHorizontal() {
	const card = makeElement({ className: 'global-actions__card' });
	card.appendChild(makeElement({ tag: 'h2', content: 'Horizontally scale all glyphs' }));

	let description = makeElement({
		className: 'global-actions__description',
		content: `Drag a multiplier to scale all the glyph shapes in the horizontal direction. <code>1.00</code> is no change, below one narrows, above one widens. Optionally scale the advance width of the glyph as well.`,
	});
	card.appendChild(description);

	let effect = makeElement({
		className: 'global-actions__effect-description',
		content: `Individual Glyphs, Ligatures, and Components will have a new width calculated based on the overall width of the shapes in that glyph (not the advance width of the glyph). The new width will be applied.
		<br>
		<strong>Note:</strong> Component Instances that are linked to Items that are also re-sized will be skipped. If a Component Root and an Item that contains a Component Instance are both re-sized, the Component Instance would have been re-sized twice.`,
	});
	card.appendChild(effect);

	const scaleRow = makeSliderRow({
		id: 'scaleHorizontal',
		label: 'Scale factor',
		value: 1,
		min: 0.25,
		max: 4,
		step: 0.01,
		unit: '×',
	});
	card.appendChild(makeSliderTable([scaleRow]));

	let table = makeElement({
		className: 'settings-table',
		innerHTML: `
			<span><input id="scaleHorizontalUpdateAdvanceWidth" type="checkbox" checked></span>
			<label for="scaleHorizontalUpdateAdvanceWidth">Scale the item's advance width and side bearings</label>
		`,
	});
	card.appendChild(table);

	const button = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '' },
		content: 'Scale all glyphs',
	});
	button.addEventListener('click', () => {
		const scaleHorizontal = scaleRow.value || 1;

		/** @type {HTMLInputElement} */
		const updateAdvanceWidthBox = document.querySelector('#scaleHorizontalUpdateAdvanceWidth');
		const updateAdvanceWidth = updateAdvanceWidthBox.checked;

		glyphIterator({
			title: 'Horizontally scaling glyph',
			action: (/** @type {Glyph} */ glyph, otherScaledItems) => {
				if (!glyph.shapes || !glyph.shapes.length) return;
				let newWidth = (glyph.maxes.xMax - glyph.maxes.xMin) * scaleHorizontal;
				glyph.setGlyphSize({
					width: newWidth,
					transformOrigin: 'baseline-left',
					instanceIDsToSkip: otherScaledItems,
				});
				if (updateAdvanceWidth) {
					const oldLSB = glyph.leftSideBearing;
					glyph.advanceWidth = glyph.advanceWidth * scaleHorizontal;
					glyph.setGlyphPosition(oldLSB * scaleHorizontal);
				}
			},
		});
	});
	card.appendChild(button);

	return card;
}

// --------------------------------------------------------------
// Scale Vertical
// --------------------------------------------------------------
/**
 * Makes the content for the Scale Vertical global action card.
 * @returns {Element}
 */
export function makeCard_ScaleVertical() {
	const card = makeElement({ className: 'global-actions__card' });

	card.appendChild(makeElement({ tag: 'h2', content: 'Vertically scale all glyphs' }));

	let description = makeElement({
		className: 'global-actions__description',
		content: `Drag a multiplier to scale all the glyph shapes in the vertical direction. <code>1.00</code> is no change, below one shortens, above one makes them taller.`,
	});
	card.appendChild(description);

	let effect = makeElement({
		className: 'global-actions__effect-description',
		content: `Individual Glyphs, Ligatures, and Components will have a new height calculated based on the overall height of the shapes in that glyph (not the ascender or descender values from the font). The new height will be applied, and the shapes will be moved to maintain a common baseline.
		<br>
		<strong>Note:</strong> Component Instances that are linked to Items that are also re-sized will be skipped. If a Component Root and an Item that contains a Component Instance are both re-sized, the Component Instance would have been re-sized twice.`,
	});
	card.appendChild(effect);

	const scaleRow = makeSliderRow({
		id: 'scaleVertical',
		label: 'Scale factor',
		value: 1,
		min: 0.25,
		max: 4,
		step: 0.01,
		unit: '×',
	});
	card.appendChild(makeSliderTable([scaleRow]));

	const button = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '' },
		content: 'Scale all glyphs',
	});
	button.addEventListener('click', () => {
		const scaleVertical = scaleRow.value || 1;

		glyphIterator({
			title: 'Vertically scaling glyph',
			action: (/** @type {Glyph} */ glyph, otherScaledItems) => {
				if (!glyph.shapes || !glyph.shapes.length) return;
				const newHeight = (glyph.maxes.yMax - glyph.maxes.yMin) * scaleVertical;
				glyph.setGlyphSize({
					height: newHeight,
					transformOrigin: 'baseline-left',
					instanceIDsToSkip: otherScaledItems,
				});
			},
		});
	});

	card.appendChild(button);

	return card;
}

// --------------------------------------------------------------
// Resize
// --------------------------------------------------------------
/**
 * Makes the content for the Resize global action card.
 * @returns {Element}
 */
export function makeCard_Resize() {
	const card = makeElement({ className: 'global-actions__card' });

	card.appendChild(makeElement({ tag: 'h2', content: 'Re-size all glyphs' }));

	let description = makeElement({
		className: 'global-actions__description',
		content: `Drag a positive or negative Width and/or Height change, then press the button: all the glyphs in this font will have their size updated by that many Em units.`,
	});
	card.appendChild(description);

	let effect = makeElement({
		className: 'global-actions__effect-description',
		content: `Individual Glyphs, Ligatures, and Components will be re-sized.
		<br>
		<strong>Note:</strong> Component Instances that are linked to Items that are also re-sized will be skipped. If a Component Root and an Item that contains a Component Instance are both re-sized, the Component Instance would have been re-sized twice.`,
	});
	card.appendChild(effect);

	const widthRow = makeSliderRow({
		id: 'resizeWidth',
		label: 'Δ Width',
		min: -500,
		max: 500,
		unit: 'em',
	});
	const heightRow = makeSliderRow({
		id: 'resizeHeight',
		label: 'Δ Height',
		min: -500,
		max: 500,
		unit: 'em',
	});
	card.appendChild(makeSliderTable([widthRow, heightRow]));

	let table = makeElement({
		className: 'settings-table',
		innerHTML: `
			<span><input id="resizeUpdateAdvanceWidth" type="checkbox" checked></span>
			<label for="resizeUpdateAdvanceWidth">Maintain the item's right side bearing</label>
			<span>&nbsp;</span>

			<span><input id="resizeMaintainAspectRatio" type="checkbox"></span>
			<label for="resizeMaintainAspectRatio">Maintain aspect ratio (<i>leave either &#916;&nbsp;Width or &#916;&nbsp;Height at zero</i>)</label>
			<span>&nbsp;</span>
		`,
	});
	card.appendChild(table);

	const button = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '' },
		content: 'Re-size all glyphs',
	});
	button.addEventListener('click', () => {
		// log('updateAllGlyphSizesByEm', 'start');
		let resizeW = widthRow.value || 0;
		const resizeH = heightRow.value || 0;

		/** @type {HTMLInputElement} */
		const ratioBox = document.querySelector('#resizeMaintainAspectRatio');
		const ratio = ratioBox.checked;

		/** @type {HTMLInputElement} */
		const updateAdvanceWidthBox = document.querySelector('#resizeUpdateAdvanceWidth');
		const updateAdvanceWidth = updateAdvanceWidthBox.checked;

		if (ratio && !resizeH && !resizeW) {
			// For ratio lock to work, one delta value has to be zero
			// Let's just choose width so we can still do scaleH calculations
			resizeW = 0;
		}
		// log(`after sanitizing - resizeW: ${resizeW}, resizeH: ${resizeH}, ratio lock: ${ratio}`);

		glyphIterator({
			title: 'Re-sizing glyph',
			action: (/** @type {Glyph} */ glyph, otherResizedItems) => {
				if (!glyph.shapes || !glyph.shapes.length) return;
				glyph.updateGlyphSize({
					width: resizeW,
					height: resizeH,
					ratioLock: ratio,
					transformOrigin: 'baseline-left',
					instanceIDsToSkip: otherResizedItems,
				});
				if (updateAdvanceWidth) glyph.advanceWidth += resizeW;
			},
		});

		// log('updateAllGlyphSizesByEm', 'end');
	});
	card.appendChild(button);

	return card;
}

// --------------------------------------------------------------
// Skew
// --------------------------------------------------------------
export function makeCard_Skew() {
	const card = makeElement({ className: 'global-actions__card' });
	card.appendChild(makeElement({ tag: 'h2', content: 'Skew all paths' }));

	let description = makeElement({
		className: 'global-actions__description',
		content: `Skew all paths by an angle, measured in degrees. The degrees system starts with the
		twelve o'clock / up position as zero, and positive degrees will slant paths to the right, and
		negative degrees will slant paths to the left.<br><br>This could be a good first step if you
		are trying to make an italic version of an existing font.`,
	});
	card.appendChild(description);

	let effect = makeElement({
		className: 'global-actions__effect-description',
		content: `Individual Glyphs, Ligatures, and Components will have have all of their paths skewed by the given angle.
		<br>
		<strong>Note:</strong> Component Instances will <strong>not</strong> be skewed.`,
	});
	card.appendChild(effect);

	const skewRow = makeSliderRow({
		id: 'skewAngle',
		label: 'Skew angle',
		min: -45,
		max: 45,
		unit: '°',
	});
	card.appendChild(makeSliderTable([skewRow]));

	let table = makeElement({
		className: 'settings-table',
		innerHTML: `
			<span><input id="skewAngleUpdateAdvanceWidth" type="checkbox" checked></span>
			<label for="skewAngleUpdateAdvanceWidth">Maintain the item's right side bearing</label>
		`,
	});
	card.appendChild(table);

	const button = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '' },
		content: 'Skew all glyphs',
	});
	button.addEventListener('click', () => {
		const skewAngle = skewRow.value || 0;

		/** @type {HTMLInputElement} */
		const updateAdvanceWidthBox = document.querySelector('#skewAngleUpdateAdvanceWidth');
		const updateAdvanceWidth = updateAdvanceWidthBox.checked;

		glyphIterator({
			title: 'Skewing glyphs',
			action: (/** @type {Glyph} */ glyph) => {
				if (!glyph.shapes || !glyph.shapes.length) return;
				const oldRSB = glyph.rightSideBearing;
				glyph.skewAngle(skewAngle);
				if (updateAdvanceWidth) glyph.rightSideBearing = oldRSB;
			},
		});
	});
	card.appendChild(button);

	return card;
}

// --------------------------------------------------------------
// Side Bearings
// --------------------------------------------------------------
/**
 * Makes the content for the Side Bearings global action card.
 * @returns {Element}
 */
export function makeCard_SideBearings() {
	const card = makeElement({ className: 'global-actions__card' });

	card.appendChild(makeElement({ tag: 'h2', content: 'Side bearings' }));

	let description = makeElement({
		className: 'global-actions__description',
		content: `Side Bearing is the empty space around a glyph's shapes. The Left Side Bearing is the space between x=0 to the leftmost side of the glyph shapes. The Right Side Bearing is the distance between the rightmost side of the glyph shapes and the advance width. Side Bearings will probably have to be adjusted for each glyph in order for it to work well... but this action could be useful if you want to re-set all Side Bearings to some common value.`,
	});
	card.appendChild(description);

	let effect = makeElement({
		className: 'global-actions__effect-description',
		content: `Each ligature and glyph will have their shapes moved and/or their advance width updated to create the specified side bearing widths. Tick a side to include it.`,
	});
	card.appendChild(effect);

	const leftRow = makeSliderRow({
		id: 'sideBearingLeft',
		labelHTML: `<input type="checkbox" id="sideBearingLeftCheckbox">Left side bearing`,
		min: -200,
		max: 500,
		unit: 'em',
	});
	const rightRow = makeSliderRow({
		id: 'sideBearingRight',
		labelHTML: `<input type="checkbox" id="sideBearingRightCheckbox">Right side bearing`,
		min: -200,
		max: 500,
		unit: 'em',
	});
	card.appendChild(makeSliderTable([leftRow, rightRow]));

	/** @type {HTMLInputElement} */
	const leftCheckboxBox = leftRow.element.querySelector('#sideBearingLeftCheckbox');
	/** @type {HTMLInputElement} */
	const rightCheckboxBox = rightRow.element.querySelector('#sideBearingRightCheckbox');
	// Touching a side's slider is a clear signal to include that side
	leftRow.bar.addEventListener('input', () => (leftCheckboxBox.checked = true));
	rightRow.bar.addEventListener('input', () => (rightCheckboxBox.checked = true));

	let button = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '' },
		content: 'Update Side Bearings',
	});
	button.addEventListener('click', () => {
		// log('updateSideBearings', 'start');
		const left = leftRow.value;
		const right = rightRow.value;
		let leftCheckbox = leftCheckboxBox.checked;
		let rightCheckbox = rightCheckboxBox.checked;

		if (leftCheckbox || rightCheckbox) {
			if (isNaN(left) || isNaN(right)) {
				showToast('Side Bearing values must be numbers.');
			} else {
				glyphIterator({
					title: 'Updating Side Bearings',
					includeComponents: false,
					action: (/** @type {Glyph} */ glyph) => {
						if (glyph.shapes.length) {
							if (leftCheckbox && !isNaN(left)) {
								glyph.leftSideBearing = left;
								getComponentInstancesFromRoot(glyph).forEach((instance) => {
									instance.translateX -= left;
								});
							}
							if (rightCheckbox && !isNaN(right)) glyph.rightSideBearing = right;
						}
					},
				});
			}
		} else {
			showToast('Tick a checkbox to enable Left and/or Right Side Bearings.');
		}

		// log('updateSideBearings', 'end');
	});
	card.appendChild(button);

	return card;
}
