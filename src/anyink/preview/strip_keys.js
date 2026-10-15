// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Which key presses on the preview strip are the strip's own (B4 + B5 fix pass). The strip is
	shared by both modes and sits in the page, so a press there bubbles up to the app's key
	handler (events_keyboard.js, on document). It keeps only the keys its controls use:
	  - the text field, and the real-font sheet's own text box (a shadow root, so its presses
	    arrive with the <font-preview> as their target): every key, as a text field does
	  - Escape: the strip leaves its text field
	  - the size slider: its moving keys (arrows, Home, End, Page Up / Down), Shift too
	  - a button, the Samples button or a checkbox: Enter and Space press it
	Every other press reaches the app: Ctrl+Z after [Fix it] undoes it, Ctrl+S saves, Ctrl+E
	makes the font file, R picks Rectangle. A press with Ctrl, Alt or Meta is never a slider's or
	a button's.

	  stripOwnsKey(event, { isTextTarget })   -> true when the strip keeps the press
	    isTextTarget(target)  true for the strip's own text targets (its field, its sheet)
*/

const MOVING_KEYS = [
	'ArrowLeft',
	'ArrowRight',
	'ArrowUp',
	'ArrowDown',
	'Home',
	'End',
	'PageUp',
	'PageDown',
];
const PRESSING_KEYS = ['Enter', ' ', 'Spacebar'];
const TEXT_INPUTS = ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''];

/**
 * @param {{key: String, target?: Element, ctrlKey?: Boolean, altKey?: Boolean,
 *   metaKey?: Boolean}} event - a keydown
 * @param {{isTextTarget?: (target: Element) => Boolean}} [options]
 * @returns {Boolean} true when the press belongs to the strip and must not reach the app
 */
export function stripOwnsKey(event, { isTextTarget = () => false } = {}) {
	const target = event?.target;
	if (!target) return false;
	if (event.key === 'Escape') return true;
	if (isTextTarget(target)) return true;
	const tag = String(target.tagName || '').toLowerCase();
	const type = String(target.type || target.getAttribute?.('type') || '').toLowerCase();
	if (tag === 'textarea' || target.isContentEditable === true) return true;
	if (tag === 'input' && TEXT_INPUTS.includes(type)) return true;
	const plain = !event.ctrlKey && !event.altKey && !event.metaKey;
	if (tag === 'input' && type === 'range') return plain && MOVING_KEYS.includes(event.key);
	const pressable =
		tag === 'button' || tag === 'input' || target.getAttribute?.('role') === 'button';
	return pressable && plain && PRESSING_KEYS.includes(event.key);
}
