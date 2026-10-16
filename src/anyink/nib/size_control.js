// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: "Size: thin --o-- thick" (UX-BEGINNER.md 4.3, the letter card's Brush section,
	shown while the Brush is picked). A slider with a word at each end and no number (principle 3:
	look and drag, never type numbers). Moving it sets the size for new strokes (brush_size.js);
	strokes already drawn keep theirs. It is never an Undo step: it changes the pen, not the font.

	  makeBrushSize({ onChange, project })   the control; onChange(share) after each move.
	                                project: the font it sizes the Brush for (default the open
	                                one), so the slider starts where the Brush will draw (B16: a
	                                font traced from a photo starts at its pen, brush_size.js)
	  makeBrushSection({ onChange, project })   the card's Brush section: its heading, then the
	                                control (the letter card puts it in; NEEDS FROM OTHER TRACK)
	Words: brush.* (words/sets/brush.js). Look: brush.css, tokens only.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { word, wordEntry } from '../words/words.js';
import { MAX_SHARE, MIN_SHARE, brushShare, setBrushShare } from './brush_size.js';
import './brush.css';

/** The slider's step, a share of the small-letter height */
const STEP = 0.005;

/**
 * @param {{onChange?: (share: Number) => void, project?: Object}} [options]
 * @returns {HTMLElement}
 */
export function makeBrushSize({ onChange, project = openProject() } = {}) {
	const hint = wordEntry('brush.size.label')?.hint || '';
	const control = makeElement({
		tag: 'div',
		className: 'anyink-brush-size',
		attributes: { 'data-anyink-brush': 'size', title: hint },
	});
	const label = makeElement({ tag: 'span', className: 'anyink-brush-size__label' });
	label.textContent = word('brush.size.label');
	const thin = makeElement({ tag: 'span', className: 'anyink-brush-size__end' });
	thin.textContent = word('brush.size.thin');
	const thick = makeElement({ tag: 'span', className: 'anyink-brush-size__end' });
	thick.textContent = word('brush.size.thick');
	const slider = makeElement({
		tag: 'input',
		className: 'anyink-brush-size__slider',
		attributes: {
			type: 'range',
			min: String(MIN_SHARE),
			max: String(MAX_SHARE),
			step: String(STEP),
			'aria-label': word('brush.size.slider'),
		},
	});
	slider.value = String(brushShare(project));
	const take = () => {
		const share = setBrushShare(Number(slider.value), project);
		onChange?.(share);
	};
	slider.addEventListener('input', take);
	slider.addEventListener('change', take);
	control.append(label, thin, slider, thick);
	return control;
}

/**
 * @param {{onChange?: (share: Number) => void, project?: Object}} [options]
 * @returns {HTMLElement}
 */
export function makeBrushSection(options = {}) {
	const section = makeElement({
		tag: 'div',
		className: 'anyink-brush-section',
		attributes: { 'data-anyink-card': 'brush' },
	});
	const heading = makeElement({ tag: 'h4', className: 'anyink-brush-section__heading' });
	heading.textContent = word('brush.section');
	section.append(heading, makeBrushSize(options));
	return section;
}

/** @returns {Object | undefined} the open font */
function openProject() {
	try {
		return getCurrentProjectEditor()?.project;
	} catch {
		return undefined;
	}
}
