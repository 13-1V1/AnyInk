// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getCurrentProject } from '../../app/main.js';
import { hexesToChars } from '../../common/character_ids.js';
import { makeElement } from '../../common/dom.js';
import { addZWNJCharacters, remove } from '../../common/functions.js';
import { isWhitespace } from '../../lib/unicode/unicode_names.js';
import { getItemNameWithFallback } from '../../pages/characters.js';
import { tileTitle } from '../../anyink/mode/simple_labels.js';
import style from './glyph-tile.css?inline';
// ANY-INK (B10): the letter board's tile states (src/anyink/board/tile_state.js)
import boardStyle from '../../anyink/board/tile_state.css?inline';

/** ANY-INK (B10): the board tile's ink, drawn this big (the tile is 96 x 112 px) */
const BOARD_INK_SIZE = 72;

/**
 * A clickable mini-preview tile of a single glyph
 */
export class GlyphTile extends HTMLElement {
	// Specify observed attributes so that
	// attributeChangedCallback will work
	static get observedAttributes() {
		// ANY-INK (B10): a board tile changes its state, caption and badge in place
		return ['selected', 'session-state', 'caption', 'badge'];
	}

	/**
	 * Create an GlyphTile
	 * @param {Object} attributes - collection of key: value pairs to set as attributes
	 */
	constructor(attributes = {}) {
		super();
		// log(`GlyphTile.constructor`, 'start');
		// log(attributes);

		Object.keys(attributes).forEach((key) => {
			if (key !== 'project') this.setAttribute(key, attributes[key]);
		});
		this.project = attributes.project || getCurrentProject();
		const displayedItemID = this.getAttribute('displayed-item-id');
		// ANY-INK (B10, UX-BEGINNER.md 4.2): a tile on the letter board (attribute "board") draws
		// the board's states, a caption and a badge; every other tile is upstream's, as before
		if (this.hasAttribute('board')) {
			this.makeBoardTile(displayedItemID);
			return;
		}
		this.glyph = this.project.getItem(displayedItemID);
		const chars = this.glyph?.chars || hexesToChars(remove(displayedItemID, 'glyph-'));

		const name = this.glyph?.name || getItemNameWithFallback(displayedItemID);
		this.view = {};

		// log(this.project);
		// log(this.glyph);
		// log(`displayedItemID: ${displayedItemID}`);
		// log(`chars: ${chars}`);
		// log(`name: ${name}`);

		const overallSize = 50;

		this.wrapper = makeElement({ className: 'wrapper' });
		this.wrapper.style.backgroundSize = `auto ${overallSize}px`;

		// Session-state information
		let sessionState = 'notCreated';
		if (attributes['session-state']) {
			sessionState = attributes['session-state'];
		} else if (this?.glyph?.sessionState) {
			sessionState = this?.glyph?.sessionState;
		}

		let sessionMessage = '';
		this.wrapper.setAttribute('session-state', sessionState);
		if (sessionState === 'notCreated')
			sessionMessage = '\n\nItem does not exist yet, click to create';
		if (sessionState === 'new')
			sessionMessage = '\n\nItem was created, but has not yet been edited';
		if (sessionState === 'changed') sessionMessage = '\n\nItem was recently edited';

		// Selection
		if (this.hasAttribute('selected')) this.wrapper.setAttribute('selected', '');

		// ANY-INK (B4 + B5 integration): Simple names the letter in words, with no id or "Item"
		// (B4 + B5 finalize: from this tile's own letter, so another font's tile says its ink)
		const title = tileTitle(
			chars,
			sessionState,
			`${name}\n${displayedItemID}${sessionMessage}`,
			this.glyph || null
		);
		if (this.glyph && this.glyph.hasChangedThisSession === true) {
			this.setAttribute('title', title);
			this.thumbnail = makeElement({
				tag: 'span',
				className: 'thumbnail',
			});
			// @ts-expect-error 'property does exist'
			this.thumbnail.width = overallSize;
			// @ts-expect-error 'property does exist'
			this.thumbnail.height = overallSize;
		} else {
			this.setAttribute('title', title);
			this.thumbnail = makeElement({
				className: 'thumbnail',
			});
			if (isWhitespace(remove(displayedItemID, 'glyph-'))) {
				this.thumbnail.innerHTML = `
					<div class="whitespace-char-thumbnail">white space</div>
				`;
			} else {
				if (chars) {
					this.thumbnail.innerHTML = chars;
				} else {
					this.thumbnail.innerHTML = `
						<div class="whitespace-char-thumbnail">${displayedItemID}</div>
					`;
				}
			}
			// log(`no glyph`);
		}

		this.name = makeElement({ className: 'name' });
		if (chars) {
			if (displayedItemID === 'glyph-0x20') {
				this.name.innerHTML = 'Space';
			} else {
				this.name.innerHTML = addZWNJCharacters(chars);
			}
		} else {
			this.name.innerHTML = name.replaceAll('Component ', 'comp-');
		}


		// Put it all together
		const shadow = this.attachShadow({ mode: 'open' });
		const styles = makeElement({ tag: 'style', innerHTML: style });
		shadow.appendChild(styles);

		this.wrapper.appendChild(this.thumbnail);
		this.wrapper.appendChild(this.name);

		shadow.appendChild(this.wrapper);
		this.redraw();

		// log(`GlyphTile.constructor`, 'end');
	}

	/**
	 * what to do when an attribute is changed
	 */
	attributeChangedCallback() {
		// log(`GlyphTile.attributeChangedCallback`, 'start');
		if (this.board) {
			this.drawBoardState();
			return;
		}
		const wrapper = this.shadowRoot ? this.shadowRoot.querySelector('.wrapper') : false;
		// log(wrapper);
		if (wrapper) {
			if (this.hasAttribute('selected')) wrapper.setAttribute('selected', '');
			else wrapper.removeAttribute('selected');
		}
		// log(`GlyphTile.attributeChangedCallback`, 'end');
	}

	/**
	 * redraw this thumbnail
	 */
	redraw() {
		if (this.board) {
			this.drawBoardState();
			return;
		}
		if (this.glyph?.shapes?.length) {
			// const project = getCurrentProject();
			this.thumbnail.innerHTML = this.project.makeItemThumbnail(this.glyph);
		}
	}

	// --------------------------------------------------------------
	// ANY-INK (B10): the letter board's tile (UX-BEGINNER.md 4.2 Tiles)
	// --------------------------------------------------------------

	/**
	 * Builds a board tile: the letter's name in the corner, its ink (or, while it is empty, a
	 * faint outlined letter), a caption, an amber "!" for "Needs a look" and a badge. The state,
	 * caption, title and badge come in as attributes (src/anyink/board/tile_state.js), so the
	 * tile holds no rule of its own; it is a button named by its title.
	 * @param {String} displayedItemID - 'glyph-0x42'
	 */
	makeBoardTile(displayedItemID) {
		this.board = true;
		this.glyph = this.project.getItem(displayedItemID);
		this.chars = this.glyph?.chars || hexesToChars(remove(displayedItemID, 'glyph-'));
		this.view = {};
		if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
		if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');

		const shadow = this.attachShadow({ mode: 'open' });
		shadow.appendChild(makeElement({ tag: 'style', innerHTML: style }));
		shadow.appendChild(makeElement({ tag: 'style', innerHTML: boardStyle }));

		this.wrapper = makeElement({ className: 'wrapper' });
		this.name = makeElement({ tag: 'span', className: 'name' });
		this.name.textContent = this.chars;
		this.mark = makeElement({ tag: 'span', className: 'mark' });
		this.mark.textContent = '!';
		this.mark.setAttribute('aria-hidden', 'true');
		this.badge = makeElement({ tag: 'span', className: 'badge' });
		this.thumbnail = makeElement({ className: 'thumbnail' });
		this.caption = makeElement({ tag: 'span', className: 'caption' });
		[this.name, this.mark, this.badge, this.thumbnail, this.caption].forEach((part) =>
			this.wrapper.appendChild(part)
		);
		shadow.appendChild(this.wrapper);
		this.drawBoardState();
	}

	/** Draws the board tile's state, caption and badge from its attributes. */
	drawBoardState() {
		if (!this.board || !this.wrapper) return;
		const state = this.getAttribute('session-state') || 'empty';
		this.wrapper.setAttribute('session-state', state);
		this.caption.textContent = this.getAttribute('caption') || '';
		const badge = this.getAttribute('badge') || '';
		this.badge.textContent = badge;
		this.badge.hidden = !badge;
		const ink = state !== 'empty' && !!this.glyph?.shapes?.length;
		if (ink) {
			this.thumbnail.innerHTML = this.project.makeItemThumbnail(this.glyph, BOARD_INK_SIZE);
		} else {
			const standIn = makeElement({ tag: 'span', className: 'stand-in' });
			standIn.textContent = this.chars;
			standIn.setAttribute('aria-hidden', 'true');
			this.thumbnail.replaceChildren(standIn);
		}
	}

	/** A board tile reads its letter again (it may have been made, or changed) and redraws. */
	refresh() {
		if (!this.board) return this.redraw();
		this.glyph = this.project.getItem(this.getAttribute('displayed-item-id'));
		this.drawBoardState();
	}
}
