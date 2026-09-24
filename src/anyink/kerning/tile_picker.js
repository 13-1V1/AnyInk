// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK glyph tile picker (Milestone 5, audit B1 / B4).
	Kern group members are picked by clicking glyph tiles instead of typing characters.

	makeTilePicker({ project, selected, multi, onChange }) returns
	{ element, getSelected, setSelected, isSelected }:
	- a scrollable grid of <glyph-tile> elements for every enabled character range of the
	  project, one section per range, large ranges paged with a "show more" button
	- click toggles membership (multi) or replaces the pick (single); picked tiles carry the
	  tile's own `selected` state
	- selection is a list of hex ids exactly as KernGroup stores them ('0x41')

	makeMemberChips(members, { project, onRemove }) renders the picked members as chips;
	clicking a chip removes it.
*/
import { hexesToChars } from '../../common/character_ids.js';
import { makeElement } from '../../common/dom.js';
import { GlyphTile } from '../../controls/glyph-tile/glyph_tile.js';
import { getUnicodeName } from '../../lib/unicode/unicode_names.js';
import { CharacterRange } from '../../project_data/character_range.js';
import './kerning.css';

export const DEFAULT_PAGE_SIZE = 96; // Basic Latin's 95 printable characters fit one page

/** The app registers glyph-tile in main.js; test pages and unit tests may not have. */
export function ensureGlyphTileDefined() {
	if (typeof customElements === 'undefined') return;
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
}

/**
 * Enabled character ranges of a project as CharacterRange instances.
 * @param {Object} project
 * @returns {Array<CharacterRange>}
 */
export function enabledRanges(project) {
	const ranges = project?.settings?.project?.characterRanges || [];
	return ranges
		.filter((range) => range && range.enabled !== false)
		.map((range) => (range instanceof CharacterRange ? range : new CharacterRange(range)));
}

/**
 * @param {Object} options
 * @param {Object} options.project - GlyphrStudioProject
 * @param {Array<String>} [options.selected] - initial hex ids
 * @param {Boolean} [options.multi=true] - toggle many, or pick exactly one
 * @param {Function} [options.onChange] - called with the selected hex array after each click
 * @param {Number} [options.pageSize] - tiles shown per range before "show more"
 * @param {Array} [options.ranges] - override the project's enabled ranges
 * @returns {{element: HTMLElement, getSelected: Function, setSelected: Function, isSelected: Function}}
 */
export function makeTilePicker({
	project,
	selected = [],
	multi = true,
	onChange,
	pageSize = DEFAULT_PAGE_SIZE,
	ranges,
} = {}) {
	ensureGlyphTileDefined();
	const picked = new Set(selected.filter(Boolean));
	const tiles = new Map(); // hex -> glyph-tile
	const element = makeElement({ tag: 'div', className: 'anyink-tile-picker' });
	element.setAttribute('role', 'listbox');
	if (multi) element.setAttribute('aria-multiselectable', 'true');

	const rangeList = ranges || enabledRanges(project);
	if (!rangeList.length) {
		element.appendChild(
			makeElement({
				tag: 'i',
				className: 'anyink-kern-chips__empty',
				content: 'No character ranges are enabled in this project.',
			})
		);
	}

	rangeList.forEach((range) => {
		const members = range.getMemberIDs ? range.getMemberIDs() : [];
		if (!members.length) return;
		const section = makeElement({ tag: 'div', className: 'anyink-tile-picker__range' });
		section.appendChild(
			makeElement({ tag: 'div', className: 'anyink-tile-picker__eyebrow', content: range.name })
		);
		const grid = makeElement({ tag: 'div', className: 'anyink-tile-picker__grid' });
		section.appendChild(grid);
		element.appendChild(section);

		let shown = 0;
		const showMore = () => {
			const next = members.slice(shown, shown + pageSize);
			next.forEach((hex) => {
				if (tiles.has(hex)) return;
				grid.appendChild(makeTile(hex));
			});
			shown += next.length;
			if (shown < members.length) {
				const button = makeElement({
					tag: 'button',
					className: 'anyink-tile-picker__more',
					content: `Show ${Math.min(pageSize, members.length - shown)} more`,
					attributes: { type: 'button' },
				});
				button.addEventListener('click', () => {
					button.remove();
					showMore();
				});
				section.appendChild(button);
			}
		};
		showMore();
	});

	function makeTile(hex) {
		const tile = new GlyphTile({ 'displayed-item-id': `glyph-${hex}`, project });
		tile.dataset.hex = hex;
		tile.setAttribute('role', 'option');
		if (picked.has(hex)) tile.setAttribute('selected', '');
		tile.addEventListener('click', () => toggle(hex));
		tiles.set(hex, tile);
		return tile;
	}

	function toggle(hex) {
		if (multi) {
			if (picked.has(hex)) picked.delete(hex);
			else picked.add(hex);
		} else {
			const was = picked.has(hex);
			picked.clear();
			if (!was) picked.add(hex);
		}
		paint();
		if (onChange) onChange(getSelected());
	}

	function paint() {
		tiles.forEach((tile, hex) => {
			if (picked.has(hex)) tile.setAttribute('selected', '');
			else tile.removeAttribute('selected');
		});
	}

	function getSelected() {
		return Array.from(picked);
	}

	function setSelected(list = []) {
		picked.clear();
		list.filter(Boolean).forEach((hex) => picked.add(hex));
		paint();
	}

	function isSelected(hex) {
		return picked.has(hex);
	}

	return { element, getSelected, setSelected, isSelected, toggle };
}

/**
 * Chips for the picked members; clicking a chip removes it.
 * @param {Array<String>} members - hex ids
 * @param {Object} options
 * @param {Object} options.project - to warn on glyphs that do not exist
 * @param {Function} [options.onRemove] - called with the hex of the clicked chip
 * @param {String} [options.emptyText]
 * @returns {HTMLElement}
 */
export function makeMemberChips(members = [], { project, onRemove, emptyText = 'none yet' } = {}) {
	const wrapper = makeElement({ tag: 'div', className: 'anyink-kern-chips' });
	if (!members.length) {
		wrapper.appendChild(
			makeElement({ tag: 'span', className: 'anyink-kern-chips__empty', content: emptyText })
		);
		return wrapper;
	}
	members.forEach((hex) => {
		const char = hexesToChars(hex) || '';
		const name = getUnicodeName(hex);
		let title = name ? `${name}\n${hex}` : hex;
		const exists = project ? !!project.getItem(`glyph-${hex}`, false) : true;
		if (!exists) title += '\nWarning: This character does not exist in the project.';
		if (onRemove) title += '\nClick to remove';
		const chip = makeElement({ tag: 'code', content: char || hex, attributes: { title } });
		chip.dataset.hex = hex;
		if (!exists) chip.classList.add('warning');
		if (onRemove) {
			chip.dataset.removable = '';
			chip.addEventListener('click', () => onRemove(hex));
		}
		wrapper.appendChild(chip);
	});
	return wrapper;
}
