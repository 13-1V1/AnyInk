// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it, vi } from 'vitest';
import { makeSliderRow, makeSliderTable } from '../slider_row.js';

function key(target, keyName, extra = {}) {
	const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...extra });
	target.dispatchEvent(event);
	return event;
}

function drag(bar, value, shift = false) {
	// jsdom has no PointerEvent; the row only reads shiftKey, so a MouseEvent stands in
	bar.dispatchEvent(new MouseEvent('pointermove', { shiftKey: shift, bubbles: true }));
	bar.value = String(value);
	bar.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('makeSliderRow', () => {
	it('builds label, bar, readout, unit and reset with the given range', () => {
		const row = makeSliderRow({ id: 'moveX', label: 'X move', min: -1000, max: 1000, unit: 'em' });
		expect(row.element.classList.contains('anyink-slider-row')).toBe(true);
		expect(row.element.querySelector('label').getAttribute('for')).toBe('moveX');
		expect(row.bar.type).toBe('range');
		expect(row.bar.getAttribute('min')).toBe('-1000');
		expect(row.bar.getAttribute('max')).toBe('1000');
		expect(row.value).toBe(0);
		expect(row.neutral).toBe(0);
		expect(row.readout.textContent).toBe('0');
		expect(row.element.querySelector('.anyink-slider-row__unit').textContent).toBe('em');
		expect(row.resetButton.getAttribute('title')).toBe('Reset to 0em');
	});

	it('marks a bare row when there is no label', () => {
		const row = makeSliderRow({ min: -45, max: 45 });
		expect(row.element.classList.contains('anyink-slider-row--no-label')).toBe(true);
		expect(row.element.querySelector('label')).toBeNull();
	});

	it('defaults neutral to the starting value and formats by step', () => {
		const row = makeSliderRow({ value: 1, min: 0.25, max: 4, step: 0.01, unit: '×' });
		expect(row.neutral).toBe(1);
		expect(row.readout.textContent).toBe('1.00');
		row.value = 1.256;
		expect(row.value).toBe(1.26);
		expect(row.readout.textContent).toBe('1.26');
	});

	it('fires onInput per tick and onChange on release with numbers', () => {
		const onInput = vi.fn();
		const onChange = vi.fn();
		const row = makeSliderRow({ min: -45, max: 45, onInput, onChange });
		drag(row.bar, 30);
		expect(onInput).toHaveBeenCalledWith(30);
		expect(onChange).not.toHaveBeenCalled();
		expect(row.readout.textContent).toBe('30');
		row.bar.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(30);
	});

	it('snaps to 10 while Shift is held during a drag', () => {
		const onInput = vi.fn();
		const row = makeSliderRow({ min: -45, max: 45, onInput });
		drag(row.bar, 33, true);
		expect(row.value).toBe(30);
		expect(onInput).toHaveBeenLastCalledWith(30);
		drag(row.bar, 33, false);
		expect(row.value).toBe(33);
	});

	it('nudges with arrows, ten with Shift, and treats each key as a release', () => {
		const onChange = vi.fn();
		const row = makeSliderRow({ min: -45, max: 45, onChange });
		let event = key(row.bar, 'ArrowRight');
		expect(event.defaultPrevented).toBe(true);
		expect(row.value).toBe(1);
		key(row.bar, 'ArrowUp', { shiftKey: true });
		expect(row.value).toBe(11);
		key(row.bar, 'ArrowLeft', { shiftKey: true });
		key(row.bar, 'ArrowDown');
		expect(row.value).toBe(0);
		key(row.bar, 'End');
		expect(row.value).toBe(45);
		key(row.bar, 'Home');
		expect(row.value).toBe(-45);
		key(row.bar, 'PageUp');
		expect(row.value).toBe(-35);
		expect(onChange).toHaveBeenCalledTimes(7);
		// keys the row does not own are left alone
		event = key(row.bar, 'z', { ctrlKey: true });
		expect(event.defaultPrevented).toBe(false);
		expect(onChange).toHaveBeenCalledTimes(7);
		// no change at the end stop means no release
		key(row.bar, 'Home');
		expect(row.value).toBe(-45);
		expect(onChange).toHaveBeenCalledTimes(8);
		key(row.bar, 'Home');
		expect(onChange).toHaveBeenCalledTimes(8);
	});

	it('resets to neutral from the button and from a readout double-click', () => {
		const onChange = vi.fn();
		const row = makeSliderRow({ value: 1, min: 0.25, max: 4, step: 0.01, onChange });
		row.value = 2.5;
		row.resetButton.click();
		expect(row.value).toBe(1);
		expect(onChange).toHaveBeenLastCalledWith(1);
		row.value = 3;
		row.readout.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(row.value).toBe(1);
		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it('silent set does not fire callbacks and clamps to the range', () => {
		const onInput = vi.fn();
		const onChange = vi.fn();
		const row = makeSliderRow({ min: -200, max: 200, onInput, onChange });
		row.value = 999;
		expect(row.value).toBe(200);
		row.value = -999;
		expect(row.value).toBe(-200);
		expect(onInput).not.toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('disables the bar and reset together, and reset is inert while disabled', () => {
		const onChange = vi.fn();
		const row = makeSliderRow({ min: 0, max: 10, value: 5, onChange, disabled: true });
		expect(row.bar.disabled).toBe(true);
		expect(row.resetButton.disabled).toBe(true);
		expect(row.element.classList.contains('anyink-slider-row--disabled')).toBe(true);
		row.reset();
		expect(onChange).not.toHaveBeenCalled();
		row.setDisabled(false);
		expect(row.bar.disabled).toBe(false);
		expect(row.element.classList.contains('anyink-slider-row--disabled')).toBe(false);
	});

	it('setRange re-clamps the value and neutral', () => {
		const row = makeSliderRow({ value: 500, min: 0, max: 2048, unit: 'em' });
		row.value = 1800;
		row.setRange({ max: 1000 });
		expect(row.bar.getAttribute('max')).toBe('1000');
		expect(row.value).toBe(1000);
		expect(row.neutral).toBe(500);
		row.setRange({ max: 400 });
		expect(row.neutral).toBe(400);
		expect(row.resetButton.getAttribute('title')).toBe('Reset to 400em');
	});

	it('labelHTML keeps markup and sets no for attribute', () => {
		const row = makeSliderRow({
			id: 'lsb',
			labelHTML: '<input type="checkbox" id="lsbBox"> Left',
			min: -200,
			max: 500,
		});
		const label = row.element.querySelector('label');
		expect(label.hasAttribute('for')).toBe(false);
		expect(label.querySelector('#lsbBox')).not.toBeNull();
	});
});

describe('makeSliderTable', () => {
	it('wraps rows in one grid', () => {
		const a = makeSliderRow({ label: 'A', min: 0, max: 1 });
		const b = makeSliderRow({ label: 'B', min: 0, max: 1 });
		const table = makeSliderTable([a, b]);
		expect(table.classList.contains('anyink-slider-table')).toBe(true);
		expect(table.children.length).toBe(2);
		expect(table.children[0]).toBe(a.element);
	});
});
