// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getCurrentProjectEditor } from '../app/main.js';
import { makeElement } from '../common/dom.js';
import { clone, rad, round } from '../common/functions.js';
import { makeSliderRow } from '../anyink/controls/slider_row.js';
import { additiveDelta, skewAngleDelta } from '../anyink/controls/slider_math.js';

// --------------------------------------------------------------
// Transforms panel
// --------------------------------------------------------------
/*
	ANY-INK (Milestone 5, audit C4): the typed values and Apply buttons became sliders.
	- Skew angle, skew distance and rotation apply on the slider's release, in place, relative
	  to the value last applied: dragging further keeps transforming, dragging back or
	  pressing Reset transforms back. One history entry per release; undo already works.
	- The sliders return to neutral (without applying) whenever the selection changes or the
	  item is edited elsewhere, so the slider always reads "transform applied since then".
	- Offset path keeps a slider plus Apply: upstream's offset replaces the shapes with a
	  new poly-segment path, which cannot be reversed by offsetting back.
*/

const SUBSCRIBER_ID = 'anyink.transforms.sliders';
let applying = false;

export function makePanel_Transforms() {
	// log(`makePanel_Transforms`, 'start');
	const editor = getCurrentProjectEditor();
	// Upstream never unsubscribes the Transforms panel, so drop closures from earlier builds
	editor.unsubscribe({ idToRemove: SUBSCRIBER_ID });

	/** @type {Array<{row: Object, resetSilently: Function}>} */
	const transformSliders = [];
	const skewCard = makeSkewCard(transformSliders);
	const offsetPath = makeOffsetCard();
	const rotationCard = makeRotationCard(transformSliders);

	const syncToSelection = () => {
		if (applying) return;
		const hasShapes = getCurrentProjectEditor().multiSelect.shapes.length > 0;
		transformSliders.forEach((slider) => {
			slider.resetSilently();
			slider.row.setDisabled(!hasShapes);
		});
		offsetPath.updateApplyButton();
	};

	editor.subscribe({
		topic: ['whichShapeIsSelected', 'currentItem'],
		subscriberID: SUBSCRIBER_ID,
		callback: syncToSelection,
	});
	syncToSelection();

	// log(`makePanel_Transforms`, 'end');
	return [skewCard, offsetPath.card, rotationCard];
}

// --------------------------------------------------------------
// Relative transform slider
// --------------------------------------------------------------

/**
 * A slider that applies an in-place transform to the selected shapes on release, relative
 * to the last value it applied. Reset (back to 0) transforms back.
 * @param {Object} o
 * @param {String} o.id - range input id
 * @param {Number} o.min
 * @param {Number} o.max
 * @param {String} o.unit - '°' or 'em'
 * @param {Function} o.deltaOf - (lastValue, nextValue) => amount to apply now
 * @param {Function} o.apply - (delta, editor, isFirstApply) => number of shapes touched
 * @param {Function} o.historyTitle - (shapeCount, delta) => String
 * @returns {{row: Object, resetSilently: Function}}
 */
function makeTransformSlider({ id, min, max, unit, deltaOf, apply, historyTitle }) {
	let lastApplied = 0;

	const row = makeSliderRow({
		id,
		value: 0,
		neutral: 0,
		min,
		max,
		step: 1,
		unit,
		disabled: true,
		onChange: (value) => {
			const editor = getCurrentProjectEditor();
			if (editor.multiSelect.shapes.length === 0) {
				row.value = 0;
				lastApplied = 0;
				return;
			}
			const delta = deltaOf(lastApplied, value);
			if (!delta) {
				lastApplied = value;
				return;
			}
			applying = true;
			try {
				const touched = apply(delta, editor, lastApplied === 0);
				if (touched) {
					editor.history.addState(historyTitle(touched, delta));
					editor.publish('currentItem', editor.selectedItem);
				}
			} finally {
				applying = false;
			}
			lastApplied = value;
		},
	});

	return {
		row,
		resetSilently: () => {
			lastApplied = 0;
			row.value = 0;
		},
	};
}

/**
 * Runs a mutation on every selected Path (component instances are skipped, as upstream did).
 * Coord setters call changed(), so caches refresh on their own.
 * @param {Object} editor
 * @param {Function} mutate - (path) => void
 * @returns {Number} - how many paths were touched
 */
function forSelectedPaths(editor, mutate) {
	let count = 0;
	editor.multiSelect.shapes.members.forEach((shape) => {
		if (shape.objType === 'Path') {
			mutate(shape);
			count++;
		}
	});
	return count;
}

function shapeWord(count) {
	return count === 1 ? 'shape' : 'shapes';
}

function makeInfoLabel(text, info) {
	return makeElement({
		tag: 'label',
		className: 'info',
		innerHTML: `<span>${text}</span><info-bubble>${info}</info-bubble>`,
	});
}

// --------------------------------------------------------------
// Skew
// --------------------------------------------------------------

function makeSkewCard(transformSliders) {
	const skewCard = makeElement({
		className: 'panel__card',
		innerHTML: `<h3>Horizontal skew</h3>`,
	});

	const skewAngle = makeTransformSlider({
		id: 'skewAngle_slider',
		min: -45,
		max: 45,
		unit: '°',
		deltaOf: skewAngleDelta,
		apply: (delta, editor) => forSelectedPaths(editor, (path) => path.skewAngle(delta)),
		historyTitle: (count, delta) => `Skew ${count} ${shapeWord(count)} by ${round(delta, 1)}°`,
	});
	transformSliders.push(skewAngle);

	const skewDistance = makeTransformSlider({
		id: 'skewDistance_slider',
		min: -500,
		max: 500,
		unit: 'em',
		deltaOf: additiveDelta,
		apply: (delta, editor) => forSelectedPaths(editor, (path) => path.skewDistance(delta)),
		historyTitle: (count, delta) => `Skew ${count} ${shapeWord(count)} by ${round(delta)}em`,
	});
	transformSliders.push(skewDistance);

	skewCard.appendChild(
		makeInfoLabel(
			'Skew angle:',
			`Select shapes, then drag. The shapes skew as soon as you let go, and dragging
			further keeps skewing. Positive leans right, negative leans left. Reset (&#x21BA;)
			returns the shapes to where they started. Shift snaps to 10&deg;, arrow keys nudge 1&deg;.`
		)
	);
	skewCard.appendChild(skewAngle.row.element);

	skewCard.appendChild(
		makeInfoLabel(
			'Skew distance:',
			`How far the top of each shape travels, in em units. Positive moves it right,
			negative moves it left. Applies when you let go; Reset (&#x21BA;) returns the shapes.
			Shift snaps to 10, arrow keys nudge 1.`
		)
	);
	skewCard.appendChild(skewDistance.row.element);

	return skewCard;
}

// --------------------------------------------------------------
// Offset path
// --------------------------------------------------------------

function makeOffsetCard() {
	const offsetPathCard = makeElement({
		className: 'panel__card',
		innerHTML: `<h3>Offset path</h3>`,
	});

	offsetPathCard.appendChild(
		makeInfoLabel(
			'Offset distance:',
			`Select shapes, pick a distance, then press Apply. Positive expands the path,
			negative contracts it. Offsetting rebuilds the outline, so it cannot preview live;
			undo takes it back.`
		)
	);

	const applyButton = makeElement({
		tag: 'fancy-button',
		attributes: { secondary: '', id: 'offsetPath_applyButton' },
		content: 'Apply',
	});
	applyButton.style.display = 'none';

	const offsetRow = makeSliderRow({
		id: 'offsetPath_slider',
		value: 0,
		neutral: 0,
		min: -200,
		max: 200,
		step: 1,
		unit: 'em',
		onInput: () => updateApplyButton(),
		onChange: () => updateApplyButton(),
	});
	offsetPathCard.appendChild(offsetRow.element);

	const buttonRow = makeElement({ className: 'full-width' });
	buttonRow.appendChild(applyButton);
	offsetPathCard.appendChild(buttonRow);

	function updateApplyButton() {
		const editor = getCurrentProjectEditor();
		const hasShapes = editor.multiSelect.shapes.length > 0;
		offsetRow.setDisabled(!hasShapes);
		if (!hasShapes) {
			applyButton.style.display = 'none';
			return;
		}
		applyButton.style.display = 'block';
		if (offsetRow.value === 0) applyButton.setAttribute('disabled', '');
		else applyButton.removeAttribute('disabled');
	}

	applyButton.addEventListener('click', () => {
		const editor = getCurrentProjectEditor();
		const offsetDistance = offsetRow.value;
		if (!offsetDistance || editor.multiSelect.shapes.length === 0) return;
		let selShapes = editor.multiSelect.shapes.members;
		let newShapes = [];
		selShapes.forEach((shape) => {
			if (shape.objType === 'Path') {
				const newPolySegment = shape.makePolySegment().makeOffsetPolySegment(offsetDistance);
				newShapes.push(newPolySegment.path);
			}
		});

		// Not guarded by `applying`: the new shapes are new objects, so the relative
		// transform sliders should reset along with the selection publishes below.
		editor.multiSelect.shapes.deleteShapes(false);
		editor.multiSelect.shapes.clear();

		newShapes.forEach((shape) => {
			const addedShape = editor.selectedItem.addOneShape(shape);
			editor.multiSelect.shapes.add(addedShape);
		});

		editor.history.addState(`Offset path for ${selShapes.length} ${shapeWord(selShapes.length)}`);
		editor.publish('currentItem', editor.selectedItem);
		updateApplyButton();
	});

	return { card: offsetPathCard, updateApplyButton };
}

// --------------------------------------------------------------
// Rotation
// --------------------------------------------------------------

function makeRotationCard(transformSliders) {
	const rotationCard = makeElement({
		className: 'panel__card',
		innerHTML: `<h3>Rotation</h3>`,
	});

	// The center is captured on the first apply of a session and kept until the slider is
	// back at 0, so successive drags rotate about one point instead of drifting.
	let center = null;
	const rotation = makeTransformSlider({
		id: 'rotation_slider',
		min: -180,
		max: 180,
		unit: '°',
		deltaOf: additiveDelta,
		apply: (delta, editor, isFirstApply) => {
			const msShapes = editor.multiSelect.shapes;
			if (isFirstApply || !center) center = clone(msShapes.maxes.center);
			msShapes.rotate(rad(delta * -1), center);
			return msShapes.length;
		},
		historyTitle: (count, delta) => `Rotated ${count} ${shapeWord(count)} by ${round(delta)}°`,
	});
	const baseReset = rotation.resetSilently;
	rotation.resetSilently = () => {
		center = null;
		baseReset();
	};
	transformSliders.push(rotation);

	rotationCard.appendChild(
		makeInfoLabel(
			'Rotation angle:',
			`Select shapes, then drag. The shapes rotate about their center as soon as you let
			go, and dragging further keeps rotating. Positive is clockwise. Reset (&#x21BA;)
			returns the shapes to where they started. Shift snaps to 10&deg;, arrow keys nudge 1&deg;.`
		)
	);
	rotationCard.appendChild(rotation.row.element);

	return rotationCard;
}
