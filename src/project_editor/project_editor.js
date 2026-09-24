// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { AssetStore } from '../anyink/assets/asset_store.js';
import { systemGuidesFromList } from '../anyink/history/settings_snapshot.js';
import { saveProject, saveProjectAs } from '../anyink/files/project_files.js';
import { isProjectFileHandle } from '../anyink/files/write_file.js';
import { ASSET_PRUNING_READY, collectReferencedAssetIds } from '../anyink/trace/trace_model.js';
import { decToHex } from '../common/character_ids.js';
import { clone, getFirstID, round } from '../common/functions.js';
import { calculateKernOffset } from '../display_canvas/text_block.js';
import { TextBlockOptions } from '../display_canvas/text_block_options.js';
import { getItemStringAdvanceWidth } from '../edit_canvas/context_characters.js';
import { EditCanvas } from '../edit_canvas/edit_canvas.js';
import { isCharInRange } from '../lib/unicode/unicode_blocks.js';
import { findCharacterRange } from '../pages/settings_project.js';
import { CharacterRange } from '../project_data/character_range.js';
import { Glyph } from '../project_data/glyph.js';
import { GlyphrStudioProject } from '../project_data/glyphr_studio_project.js';
import { KernGroup } from '../project_data/kern_group.js';
import {
	kernGroupDisplayWidth,
	kernGroupSideMaxWidth,
	resolveItemLinks,
} from './cross_item_actions.js';
import { History } from './history.js';
import { MultiSelectPoints, MultiSelectShapes } from './multiselect.js';
import { Navigator } from './navigator.js';
import { publish, subscribe, unsubscribe } from './pub_sub.js';

/**
 * Creates a new Glyphr Studio Project Editor.
 * An Editor is all the UI it takes to edit a project,
 * including Pages, Panels, History, Saved State,
 * Import/Export, etc.
 *
 * Many Project Editors can be run side-by-side,
 * editing many Glyphr Studio Projects. Could be
 * in tabs or separate windows, but the App has
 * access to all the Project Editors, enabling
 * cross-project features like glyph copy/paste.
 *
 * @class
 * @public
 */
export class ProjectEditor {
	/**
	 * Initialize a project editor, with defaults
	 * @param {Object} newProjectEditor
	 */
	constructor(newProjectEditor) {
		// log('ProjectEditor.constructor', 'start');
		if (newProjectEditor) {
			// log(`\n⮟Passed: newProjectEditor⮟`);
			// log(newProjectEditor);
		}

		// File reference
		this.loadedFileHandle = false;
		// ANY-INK: binary assets (trace images) live on the editor, not in the project (D-012)
		this.assets = new AssetStore();

		// Project
		this.project = undefined;
		// log(`this.project`);
		// log(this.project);

		// History
		this.history = new History();

		// Saving
		this.projectSaved = true;
		this.stopPageNavigation = true;

		// PubSub
		this.subscribers = {};
		this.publish = publish;
		this.subscribe = subscribe;
		this.unsubscribe = unsubscribe;

		// Selections
		this.selectedGlyphID = false;
		this.selectedComponentID = false;
		this.selectedLigatureID = false;
		this.selectedKernGroupID = false;
		this.selectedCharacterRange = false;
		this.chooserPage = {
			characters: 0,
			components: 0,
			ligatures: 0,
			kerning: 0,
		};
		this.kernGroupListSortBy = 'ID';

		// Navigation
		this.nav = new Navigator();
		this.showPageTransitions = true;

		// Canvas
		/** @type {EditCanvas} */
		this.editCanvas = undefined;

		// Views
		this._views = {};
		this.defaultView = { dx: -1000, dy: -1000, dz: 0.5, default: true };

		// Guides
		this.systemGuides = {
			ascent: false,
			capHeight: false,
			xHeight: false,
			baseline: true,
			descent: false,
			leftSide: true,
			rightSide: true,
		};

		// Pop Out Window
		/** @type {HTMLElement | false} */
		this.popOutWindow = false;

		// Live previews - livePreviews[0] is for the Live Preview Page
		// The rest are for the Pop Out Window
		this.livePreviews = false;

		// Event handlers
		this.eventHandlers = {};
		this.selectedTool = 'resize';

		// MultiSelect
		this.multiSelect = {
			points: new MultiSelectPoints(),
			shapes: new MultiSelectShapes(),
		};

		// Clipboard
		this.clipboard = {};

		// Dialogs
		this.closeAllDialogsOverride = false;

		// Project (set last, after PubSub and selection defaults are
		// initialized, since the project setter publishes selection changes)
		if (newProjectEditor && newProjectEditor.project) this.project = newProjectEditor.project;

		// log(`\n⮟ProjectEditor⮟`);
		// log(this);
		// log('ProjectEditor.constructor', 'end');
	}

	// --------------------------------------------------------------
	// Navigate
	// --------------------------------------------------------------

	/**
	 * Refreshes the whole UI
	 * @param {Boolean =} test - set to true when running from Vitest
	 */
	navigate(test = false) {
		// log(`ProjectEditor.navigate`, 'start');
		this.nav.navigate(test);
		// log(`ProjectEditor.navigate`, 'end');
	}

	// --------------------------------------------------------------
	// Project
	// --------------------------------------------------------------

	/**
	 * Get the project for this editor
	 * @returns {GlyphrStudioProject}
	 */
	get project() {
		if (!this._project) {
			this._project = new GlyphrStudioProject({});
			this.initializeHistory(this._project);
		}
		return this._project;
	}

	/**
	 * Set the project for this editor
	 * @param {GlyphrStudioProject} gsp - project to set
	 * @returns {GlyphrStudioProject}
	 */
	set project(gsp) {
		// log(`ProjectEditor SET project`, 'start');
		// log(gsp);
		if (gsp) {
			// log(`Importing project...`);
			this._project = gsp;
			// ANY-INK: the canvas and the guides layer read editor.systemGuides, so it must
			// follow the project's saved list for every load (new, sample, file, restore),
			// not only the import path. Merged in place: the guides layer holds a reference.
			const shown = gsp.settings?.app?.guides?.systemGuides;
			if (Array.isArray(shown)) Object.assign(this.systemGuides, systemGuidesFromList(shown));
			this.initializeHistory(gsp);
			// ANY-INK (M6): the open paths set loadedFileHandle before assigning the project,
			// and only for a .gs2. Such a project matches its file until the first edit, so
			// undo back to here clears the dot. Anything else (new, sample, imported font or
			// SVG, a v1 .txt) matches no file: undo never claims it is saved.
			if (isProjectFileHandle(this.loadedFileHandle)) this.history.markSavedState();
			this.selectedGlyphID = 'glyph-0x41';
		} else {
			// log(`Setting to false`);
			// this._project = false;
		}
		// log(`ProjectEditor SET project`, 'end');
	}

	initializeHistory(project) {
		this.history = new History();
		this.history.queue = [];
		this.history.initialTimeStamp = new Date().getTime();
		this.history.initialize(project);
	}

	// --------------------------------------------------------------
	// Get Individual Selected Work Items
	// --------------------------------------------------------------

	/**
	 * Returns the appropriate Glyph, Ligature, or Component
	 * based on the current page
	 */
	get selectedItem() {
		// log(`ProjectEditor GET selectedItem`, 'start');

		if (this.nav.page === 'Characters') {
			// log(`this.selectedGlyph: ${this.selectedGlyph}`);
			// log(`ProjectEditor GET selectedItem`, 'end');
			return this.selectedGlyph;
		} else if (this.nav.page === 'Ligatures') {
			// log(`this.selectedLigature: ${this.selectedLigature}`);
			// log(`ProjectEditor GET selectedItem`, 'end');
			return this.selectedLigature;
		} else if (this.nav.page === 'Components') {
			// log(`this.selectedComponent: ${this.selectedComponent}`);
			// log(`ProjectEditor GET selectedItem`, 'end');
			return this.selectedComponent;
		} else if (this.nav.page === 'Kerning') {
			// log(`this.selectedKernGroup: ${this.selectedKernGroup}`);
			// log(`ProjectEditor GET selectedItem`, 'end');
			return this.selectedKernGroup;
		} else {
			// log(`Nav page not detected`);
			// log(`ProjectEditor GET selectedItem`, 'end');
			return false;
		}
	}

	/**
	 * Returns the appropriate Glyph, Ligature or Component
	 * ID based on the current page
	 * @returns {String | false}
	 */
	get selectedItemID() {
		if (this.nav.page === 'Characters') return this.selectedGlyphID;
		else if (this.nav.page === 'Components') return this.selectedComponentID;
		else if (this.nav.page === 'Ligatures') return this.selectedLigatureID;
		else if (this.nav.page === 'Kerning') return this.selectedKernGroupID;
		else return false;
	}

	/**
	 * Returns the selected glyph
	 * @returns {Object}
	 */
	get selectedGlyph() {
		// log('ProjectEditor GET selectedGlyph', 'start');
		const selectedID = this.selectedGlyphID;
		// log(`selectedGlyphID ${selectedID}`);
		if (!this.project.glyphs[selectedID]) {
			// ANY-INK: record the creation as a pre / post pair so undo removes
			// the new glyph. Skipped while an undo / redo is applying state.
			const recordHistory = !this.history.isRestoring;
			if (recordHistory) {
				const name = this.project.getItemName(selectedID, true);
				this.history.addWholeProjectChangePreState(`Created ${name}`);
			}
			this.project.addItemByType(new Glyph(), 'Glyph', selectedID);
			if (recordHistory) this.history.addWholeProjectChangePostState();
		}
		let re = this.project.glyphs[selectedID];
		// log(re);
		// log('ProjectEditor GET selectedGlyph', 'end');
		return re;
	}

	/**
	 * Returns the selected glyph ID
	 * @returns {String | false}
	 */
	get selectedGlyphID() {
		// log('ProjectEditor GET selectedGlyphID', 'start');

		if (!this._selectedGlyphID) {
			const rangeBegin = this.selectedCharacterRange.begin;
			// Special case Basic Latin (return Capital A, not Space)
			if (rangeBegin === 0x20 && isCharInRange(0x41, this.selectedCharacterRange)) {
				this._selectedGlyphID = 'glyph-0x41';
			} else {
				// Otherwise, just return the first char of the selected range
				let begin = decToHex(rangeBegin) || '0x41';
				this._selectedGlyphID = `glyph-${begin}`;
			}
		}
		// log(`RETURNING this._selectedGlyphID: ${this._selectedGlyphID}`);
		// log('ProjectEditor GET selectedGlyphID', 'end');
		if (typeof this._selectedGlyphID === 'boolean') return false;
		return this._selectedGlyphID;
	}

	/**
	 * Returns the selected ligature
	 * @returns {Object}
	 */
	get selectedLigature() {
		// log(`ProjectEditor GET selectedLigature`, 'start');
		const selectedID = this.selectedLigatureID;
		const re = this.project.ligatures[selectedID];
		// log(`ProjectEditor GET selectedLigature`, 'end');
		return re;
	}

	/**
	 * Returns the selected ligature ID
	 * @returns {String | false}
	 */
	get selectedLigatureID() {
		// log(`ProjectEditor GET selectedLigatureID`, 'start');
		if (!this._selectedLigatureID) {
			this._selectedLigatureID = getFirstID(this.project.ligatures);
		}
		// log(`ProjectEditor GET selectedLigatureID`, 'end');
		if (typeof this._selectedLigatureID === 'boolean') return false;
		return this._selectedLigatureID;
	}

	/**
	 * Returns the selected component
	 * @returns {Object}
	 */
	get selectedComponent() {
		const re = this.project.components[this.selectedComponentID];
		return re;
	}

	/**
	 * Returns the selected component ID
	 * @returns {String | false}
	 */
	get selectedComponentID() {
		if (!this._selectedComponentID) {
			this._selectedComponentID = getFirstID(this.project.components);
		}

		if (typeof this._selectedComponentID === 'boolean') return false;
		return this._selectedComponentID;
	}

	/**
	 * Returns the selected kern
	 * @returns {Object}
	 */
	get selectedKernGroup() {
		const selectedID = this.selectedKernGroupID;
		const re = this.project.kerning[selectedID];
		return re;
	}

	/**
	 * Returns the selected kern ID
	 * @returns {String | false}
	 */
	get selectedKernGroupID() {
		// log(`ProjectEditor GET selectedKernGroupID`, 'start');
		if (!this._selectedKernGroupID) {
			this._selectedKernGroupID = getFirstID(this.project.kerning);
		}
		// log(`ProjectEditor GET selectedKernGroupID`, 'end');
		if (typeof this._selectedKernGroupID === 'boolean') return false;
		return this._selectedKernGroupID;
	}

	/**
	 * Returns the selected Glyph Range
	 * @returns {Object}
	 */
	get selectedCharacterRange() {
		// log(`ProjectEditor GET selectedCharacterRange`, 'start');
		// log('current ranges');
		const ranges = this.project.settings.project.characterRanges;
		// log(ranges);
		// log('currently selected');
		// log(this._selectedCharacterRange);

		if (
			!this._selectedCharacterRange ||
			!this._selectedCharacterRange?.isValid ||
			!this._selectedCharacterRange?.enabled
		) {
			// log('detected none selected:');
			if (ranges.length) {
				let basicRange = findCharacterRange({ begin: 0x20, end: 0x7f }, ranges);
				if (basicRange && basicRange.enabled) {
					// If Basic Latin is a range, select it
					this._selectedCharacterRange = basicRange;
				} else {
					// Otherwise, just select the first range
					for (let r = 0; r < ranges.length; r++) {
						if (ranges[r].enabled) {
							this._selectedCharacterRange = new CharacterRange(ranges[r]);
							break;
						}
					}
				}
			}
		}

		if (!this._selectedCharacterRange) {
			// If there is still no ranges, create one
			this._selectedCharacterRange = new CharacterRange({
				begin: 0x20,
				end: 0x7f,
				name: 'Basic Latin (default)',
			});
		}

		// log(`returning`);
		// log(this._selectedCharacterRange);
		// log(`ProjectEditor GET selectedCharacterRange`, 'end');
		return this._selectedCharacterRange;
	}

	// --------------------------------------------------------------
	// Set Selected Work Items
	// --------------------------------------------------------------

	/**
	 * Sets the appropriate Glyph, Ligature, or Component
	 * based on the current page
	 */
	set selectedItem(newItem) {
		// log(`ProjectEditor SET selectedItem`, 'start');

		if (this.nav.page === 'Characters') {
			// log(`this.selectedGlyph: ${this.selectedGlyph}`);
			// log(`ProjectEditor SET selectedItem`, 'end');
			this.selectedGlyph = newItem;
		} else if (this.nav.page === 'Ligatures') {
			// log(`this.selectedLigature: ${this.selectedLigature}`);
			// log(`ProjectEditor SET selectedItem`, 'end');
			this.selectedLigature = newItem;
		} else if (this.nav.page === 'Components') {
			// log(`this.selectedComponent: ${this.selectedComponent}`);
			// log(`ProjectEditor SET selectedItem`, 'end');
			this.selectedComponent = newItem;
		} else if (this.nav.page === 'Kerning') {
			// log(`this.selectedKernGroup: ${this.selectedKernGroup}`);
			// log(`ProjectEditor SET selectedItem`, 'end');
			this.selectedKernGroup = newItem;
		}
	}

	/**
	 * Sets the selected item based on nav.page
	 * @param {String} newID - ID to select
	 */
	set selectedItemID(newID) {
		if (typeof newID === 'string') {
			if (newID.startsWith('glyph-')) this.selectedGlyphID = newID;
			else if (newID.startsWith('comp-')) this.selectedComponentID = newID;
			else if (newID.startsWith('liga-')) this.selectedLigatureID = newID;
			else if (newID.startsWith('kern-')) this.selectedKernGroupID = newID;
		}
	}

	/**
	 * Replaces the current Glyph
	 * @param {Glyph | Object} newGlyph - new glyph to set
	 */
	set selectedGlyph(newGlyph) {
		let id = this.selectedGlyphID;
		newGlyph = new Glyph(newGlyph);
		newGlyph.parent = this.project;
		this.project.glyphs[id] = newGlyph;
	}

	/**
	 * Sets the selected glyph
	 * @param {String | false} id - ID to select
	 */
	set selectedGlyphID(id) {
		// log(`ProjectEditor SET selectedGlyphID`, 'start');
		// log(`id: ${id}`);
		if (typeof id !== 'string' || !id.startsWith('glyph-')) {
			this._selectedGlyphID = false;
		} else if (this.project.glyphs[id]) {
			this._selectedGlyphID = id;
		} else if (id.startsWith('glyph-')) {
			this.project.glyphs[id] = new Glyph({ id: id, parent: this.project });
			this._selectedGlyphID = id;
		}
		this.publish('whichGlyphIsSelected', this.selectedGlyphID);
		// log(`ProjectEditor SET selectedGlyphID`, 'end');
	}

	/**
	 * Replaces the current Ligature
	 * @param {Glyph | Object} newLigature - new ligature to set
	 */
	set selectedLigature(newLigature) {
		let id = this.selectedLigatureID;
		newLigature = new Glyph(newLigature);
		newLigature.parent = this.project;
		this.project.ligatures[id] = newLigature;
	}

	/**
	 * Sets the selected ligature
	 * @param {String | false} id - ID to select
	 */
	set selectedLigatureID(id) {
		if (typeof id !== 'string' || !id.startsWith('liga-')) {
			this._selectedLigatureID = false;
		} else if (this.project.ligatures[id]) {
			this._selectedLigatureID = id;
		} else {
			console.warn(`Ligature ID ${id} does not exist in the project.`);
			this._selectedLigatureID = getFirstID(this.project.ligatures);
		}

		if (this._selectedLigatureID) {
			this.publish('whichLigatureIsSelected', this.selectedLigatureID);
		}
	}

	/**
	 * Replaces the current Component
	 * @param {Glyph | Object} newComponent - new component to set
	 */
	set selectedComponent(newComponent) {
		let id = this.selectedComponentID;
		newComponent = new Glyph(newComponent);
		newComponent.parent = this.project;
		this.project.components[id] = newComponent;
	}

	/**
	 * Sets the selected component
	 * @param {String | false} id - ID to select
	 */
	set selectedComponentID(id) {
		if (typeof id !== 'string' || !id.startsWith('comp-')) {
			this._selectedComponentID = false;
		} else if (this.project.components[id]) {
			this._selectedComponentID = id;
		} else {
			console.warn(`Component ID ${id} does not exist in the project.`);
			this._selectedComponentID = getFirstID(this.project.components);
		}

		if (this._selectedComponentID) {
			this.publish('whichComponentIsSelected', this.selectedComponentID);
		}
	}

	/**
	 * Replaces the current Kern
	 * @param {KernGroup} newKern - new kern to set
	 */
	set selectedKernGroup(newKern) {
		let id = this.selectedKernGroupID;
		newKern = new KernGroup(newKern);
		this.project.kerning[id] = newKern;
	}

	/**
	 * Sets the selected kern
	 * @param {String | false} id - ID to select
	 */
	set selectedKernGroupID(id) {
		if (typeof id !== 'string' || !id.startsWith('kern-')) {
			this._selectedKernGroupID = false;
			return;
		}
		if (this.project.kerning[id]) {
			this._selectedKernGroupID = id;
		} else {
			console.warn(`Kern ID ${id} does not exist in the project.`);
			this._selectedKernGroupID = getFirstID(this.project.kerning);
		}

		if (this._selectedKernGroupID) {
			this.publish('whichKernGroupIsSelected', this.selectedKernGroupID);
		}
	}

	/**
	 * Sets the selected character range
	 * @param {Object} newRange - range object
	 */
	set selectedCharacterRange(newRange) {
		// log(`ProjectEditor SET selectedCharacterRange`, 'start');
		// log(`\n⮟newRange⮟`);
		// log(newRange);
		this._selectedCharacterRange = new CharacterRange(newRange);
		// log(`\n⮟this._selectedCharacterRange⮟`);
		// log(this._selectedCharacterRange);
		// log(`ProjectEditor SET selectedCharacterRange`, 'end');
	}

	// --------------------------------------------------------------
	// Project-level actions
	// --------------------------------------------------------------

	/**
	 * Deletes the selected item, based on the current page
	 * @param {String | false} page - currently selected page
	 */
	deleteSelectedItemFromProject(page = false) {
		// log(`deleteSelectedItemFromProject`, 'start');
		// log(`page: ${page}`);
		// log(`this.nav.page: ${this.nav.page}`);
		const itemPageName = page || this.nav.page || 'Overview';
		// log(`itemPageName: ${itemPageName}`);

		let id;
		const unlinkComponentInstances = this.project.settings.app.unlinkComponentInstances;

		if (itemPageName === 'Characters') {
			// log(`deleting selectedGlyphID: ${this.selectedGlyphID}`);
			id = this.selectedGlyphID;
			if (id) this.deleteItem(id, this.project.glyphs, unlinkComponentInstances);
		} else if (itemPageName === 'Components') {
			// log(`deleting selectedComponentID: ${this.selectedComponentID}`);
			id = this.selectedComponentID;
			if (id) this.deleteItem(id, this.project.components, unlinkComponentInstances);
		} else if (itemPageName === 'Ligatures') {
			// log(`deleting selectedLigatureID: ${this.selectedLigatureID}`);
			id = this.selectedLigatureID;
			if (id) this.deleteItem(id, this.project.ligatures, unlinkComponentInstances);
		} else if (itemPageName === 'Kerning') {
			// log(`deleting selectedKernGroupID: ${this.selectedKernGroupID}`);
			id = this.selectedKernGroupID;
			if (id) this.deleteItem(id, this.project.kerning);
		}

		const fallbackAcrossItemType = this.selectFallbackItem(itemPageName);
		// log(`fallbackAcrossItemType: ${fallbackAcrossItemType}`);
		if (fallbackAcrossItemType) {
			this.nav.page = 'Characters';
			this.navigate();
		}
		// log(`deleteSelectedItemFromProject`, 'end');
	}

	/**
	 *
	 * @param {String} itemID - ID of item to delete
	 * @param {Object} projectGroup - collection of project items
	 * @param {Boolean} unlinkComponentInstances
	 */
	deleteItem(itemID, projectGroup, unlinkComponentInstances = false) {
		const item = this.project.getItem(itemID);
		if (item) {
			let historyTitle = `Deleted ${item.displayType} ${itemID} : ${item.name}`;
			if (item?.usedIn?.length) {
				historyTitle += ', and unlinked instances where it was used as a component.';
				this.history.addWholeProjectChangePreState(historyTitle);
			} else {
				this.history.addState(historyTitle, true);
			}
			resolveItemLinks(item, unlinkComponentInstances);
			delete projectGroup[itemID];
			if (item?.usedIn?.length) this.history.addWholeProjectChangePostState();
		}
	}

	/**
	 * When an item is deleted, this finds the next best item to select.
	 * For Glyphs, there is additional logic to stay within the current
	 * selected range, and to special case Basic Latin order.
	 * For Ligatures, Components, and Kerns, it's just the first item.
	 * @param {String | false} page name of object type's page to fallback to
	 */
	selectFallbackItem(page = false) {
		// log(`ProjectEditor.selectFallbackItem`, 'start');
		const itemPageName = page || this.nav.page;
		// log(`itemPageName: ${itemPageName}`);
		let fallbackAcrossItemType = false;

		if (itemPageName === 'Components') {
			// log(`\n⮟this.project.components⮟`);
			// log(this.project.components);
			this.selectedComponentID = getFirstID(this.project.components);
			if (!this.selectedComponentID) fallbackAcrossItemType = true;
			// log(`new selectedComponentID: ${this.selectedComponentID}`);
		} else if (itemPageName === 'Ligatures') {
			// log(`\n⮟this.project.ligatures⮟`);
			// log(this.project.ligatures);
			// log(Object.keys(this.project.ligatures));
			this.selectedLigatureID = getFirstID(this.project.ligatures);
			if (!this.selectedLigatureID) fallbackAcrossItemType = true;
			// log(`new selectedLigatureID: ${this.selectedLigatureID}`);
		} else if (itemPageName === 'Kerning') {
			// log(`\n⮟this.project.kerning⮟`);
			// log(this.project.kerning);
			this.selectedKernGroupID = getFirstID(this.project.kerning);
			if (!this.selectedKernGroupID) fallbackAcrossItemType = true;
			// log(`new selectedKernGroupID: ${this.selectedKernGroupID}`);
		}

		// log(`fallbackAcrossItemType: ${fallbackAcrossItemType}`);

		if (itemPageName === 'Characters' || fallbackAcrossItemType) {
			const selectedRange = this.selectedCharacterRange;
			if (selectedRange) {
				// log(`Selected Range detected as ${selectedRange.name}`);
				let rangeList = selectedRange.getMemberIDs();
				for (let i = 0; i < rangeList.length; i++) {
					let id = `glyph-${rangeList[i]}`;
					// log(`checking id ${id}`);
					if (this.project.glyphs[id]) {
						this.selectedGlyphID = id;
						break;
					}
				}
			}
			// log(`new selectedGlyphID: ${this.selectedGlyphID}`);
		}

		// log(`ProjectEditor.selectFallbackItem`, 'end');
		return fallbackAcrossItemType;
	}

	// --------------------------------------------------------------
	// Multi-select
	// --------------------------------------------------------------

	/**
	 * Syncs changes to multiselected paths from path point selections
	 * @returns nothing
	 */
	selectPathsThatHaveSelectedPoints() {
		// log('ProjectEditor.selectPathsThatHaveSelectedPoints', 'start');
		const msPoints = this.multiSelect.points;
		const selectedPoints = msPoints.members;
		if (selectedPoints.length === 0) return;

		const msShapes = this.multiSelect.shapes;
		const selectedItemShapes = this.selectedItem.shapes;

		let parentPath;
		let changed = false;

		for (let p = 0; p < selectedPoints.length; p++) {
			parentPath = selectedPoints[p].parent;
			// if(!msShapes.isSelected(parentPath)) {
			// log(`selecting path`);
			// 	msShapes.add(parentPath);
			// 	changed = true;
			// }
			for (let p = 0; p < selectedItemShapes.length; p++) {
				if (selectedItemShapes[p].objType !== 'ComponentInstance') {
					if (parentPath === selectedItemShapes[p]) {
						// log(`selecting path!`);
						msShapes.add(selectedItemShapes[p]);
						changed = true;
					}
				}
			}
		}

		if (changed) msShapes.publishChanges();
		// log('ProjectEditor.selectPathsThatHaveSelectedPoints', 'end');
	}

	// --------------------------------------------------------------
	// Tool
	// --------------------------------------------------------------

	set selectedTool(newTool) {
		// log(`ProjectEditor.selectedTool SET to ${newTool}`);
		this._selectedTool = newTool;
	}

	get selectedTool() {
		return this._selectedTool;
	}

	// --------------------------------------------------------------
	// Views
	// --------------------------------------------------------------
	/**
	 * Sets the view for the current work item on the current page
	 * @param {Object} oa
	 */
	set view(oa) {
		// log(`ProjectEditor SET view`, 'start');
		let id = this.selectedItemID;

		// Ensure there are at least defaults
		if (!this._views[id]) {
			// log(`\t no view, getting default`);
			this._views[id] = this.view;
		}
		// log(`\t setting ${JSON.stringify(oa)}`);

		// Check for which to set
		if (Number.isFinite(oa.dx)) {
			// log(`oa.dx: ${oa.dx}`);
			this._views[id].dx = oa.dx;
		}

		if (Number.isFinite(oa.dy)) {
			// log(`oa.dy: ${oa.dy}`);
			this._views[id].dy = oa.dy;
		}

		if (Number.isFinite(oa.dz)) {
			// log(`oa.dz: ${oa.dz}`);
			this._views[id].dz = oa.dz;
		}

		if (this._views[id].default) delete this._views[id].default;
		// log(`set as ${JSON.stringify(this._views[id])}`);
		// log(`ProjectEditor SET view`, 'end');
	}

	/**
	 * Gets the current view for the current work item on the current page
	 */
	get view() {
		// log(`ProjectEditor GET view`, 'start');

		let id = this.selectedItemID;
		let re = false;

		if (this._views[id]) {
			re = this._views[id];
		} else {
			re = clone(this.defaultView);
		}

		// log(`returning ${JSON.stringify(re)}`);
		// log(`ProjectEditor GET view`, 'end');

		return re;
	}

	/**
	 * Check to see if a work item has a view set already
	 * @param {String} id - work item id to check
	 * @returns boolean
	 */
	viewExists(id) {
		return !!this._views[id];
	}

	updateViewZoom(zoomInput, center = {}) {
		// log(`updateViewZoom`, 'start');
		// log(`zoomInput: ${zoomInput}`);
		// log(`center: ${center.x}, ${center.y}`);

		zoomInput = parseFloat(zoomInput);
		const v = this.view;
		const cx = center.x;
		const cy = center.y;

		this.view = {
			dz: zoomInput * v.dz,
			dx: cx ? cx - (cx - v.dx) * zoomInput : v.dx,
			dy: cy ? cy - (cy - v.dy) * zoomInput : v.dy,
		};

		this.publish('editCanvasView', this.view);
		// log(`updateViewZoom`, 'end');
	}

	setViewZoom(zoomInput) {
		const newValue = parseFloat(zoomInput) / 100;
		this.view = { dz: newValue };
		this.publish('editCanvasView', this.view);
	}

	/**
	 * Calculates a view based on the screen size
	 * @param {Object} rect - width and height
	 * @returns {Object} - new View object: dx/dy/dz
	 */
	makeAutoFitView(rect = false) {
		// log(`ProjectEditor.makeAutoFitView`, 'start');
		// log(`rect:`);
		// log(rect);

		/*
			Gather measurements from project data (Em) units
		*/
		const isKern = this.selectedItem.objType === 'KernGroup';
		// log(`isKern: ${isKern}`);

		const emPadding = this.project.defaultAdvanceWidth / 2;
		let emWidth = emPadding * 2;
		let emLeftOffset = 0;
		const emHeight = this.project.totalVertical + emPadding * 2;

		if (isKern) {
			// Kerning
			emWidth += kernGroupDisplayWidth(this.selectedItem);
			emLeftOffset = kernGroupSideMaxWidth(this.selectedItem.leftGroup);
			emLeftOffset -= this.selectedItem.value;
		} else if (this.project.settings.app.contextCharacters.showCharacters) {
			// Context Characters
			let ctxChars = this.selectedItem.contextCharacters;
			// log(`ctxChars: ${ctxChars}`);
			let selChar = this.selectedItem.char;
			if (ctxChars === selChar) {
				emWidth += this.selectedItem.advanceWidth;
			} else {
				let selCharIndex = ctxChars.indexOf(selChar);
				// log(`selCharIndex: ${selCharIndex}`);
				// Context Characters do not contain the current selected char
				// Add it implicitly
				if (selCharIndex === -1) {
					ctxChars += selChar;
					selCharIndex = 1;
				}
				// Need to separate the two sides, because the
				// selected item char will not be combined with
				// the characters on either side to form ligatures
				let leftChars = ctxChars.substring(0, selCharIndex);
				let rightChars = ctxChars.substring(selCharIndex + 1);
				emWidth += getItemStringAdvanceWidth(leftChars);
				emWidth += this.selectedItem.advanceWidth;
				emWidth += getItemStringAdvanceWidth(rightChars);
				emWidth += calculateKernOffset(leftChars.charAt(leftChars.length), selChar);
				emWidth += calculateKernOffset(selChar, rightChars.charAt(0));
				// log(`leftChars: ${leftChars}`);
				// log(`rightChars: ${rightChars}`);

				emLeftOffset = getItemStringAdvanceWidth(leftChars);
			}
		} else {
			emWidth += this.selectedItem.advanceWidth || this.project.defaultAdvanceWidth;
		}

		// log(`emHeight: ${emHeight}`);
		// log(`emWidth: ${emWidth}`);
		// log(`emLeftOffset: ${emLeftOffset}`);

		/*
			Calculate measurements in Canvas (px) units
		*/

		//Zoom
		const newZ = Math.min(rect.height / emHeight, rect.width / emWidth);
		// log(`newZ: ${newZ}`);

		// Vertical
		const canvasPadding = emPadding * newZ;
		const canvasItemsHeight = emHeight * newZ;
		let newY = (rect.height - canvasItemsHeight) / 2;
		newY += canvasPadding;
		newY += this.project.settings.font.ascent * newZ;
		// log(`newY: ${newY}`);

		// Horizontal
		let canvasItemsWidth = emWidth * newZ;
		// log(`canvasItemsWidth: ${canvasItemsWidth}`);

		if (canvasItemsWidth === 0) canvasItemsWidth = rect.width / 3;
		let newX = (rect.width - canvasItemsWidth) / 2;
		newX += emLeftOffset * newZ;
		newX += canvasPadding;
		// log(`newX: ${newX}`);

		/*
			Assemble final view
		*/
		const newView = { dx: round(newX, 3), dy: round(newY, 3), dz: round(newZ, 3) };

		// log(`newView: ${JSON.stringify(newView)}`);
		// log(`ProjectEditor.makeAutoFitView`, 'end');
		return newView;
	}

	autoFitIfViewIsDefault() {
		// log(`ProjectEditor.autoFitIfViewIsDefault`, 'start');
		// log(`this.nav.isOnEditCanvasPage: ${this.nav.isOnEditCanvasPage}`);
		// log(`this.selectedItemID: ${this.selectedItemID}`);
		if (this.nav.isOnEditCanvasPage && this.selectedItemID) {
			// log(`this.view.default: ${this.view.default}`);
			if (this.view.default) {
				this.autoFitView();
			}
		}
		// log(`ProjectEditor.autoFitIfViewIsDefault`, 'end');
	}

	autoFitView() {
		// log(`ProjectEditor.autoFitView`, 'start');
		const bounds = this.getEditCanvasWrapperBounds();
		if (bounds) {
			this.view = this.makeAutoFitView(bounds);
			this.publish('editCanvasView', this.view);
		} else {
			console.warn('autoFitView called before DOM was ready');
			this.view = clone(this.defaultView);
		}
		// log(`ProjectEditor.autoFitView`, 'end');
		return this.view;
	}

	getEditCanvasWrapperBounds() {
		// log(`getEditCanvasWrapperBounds`, 'start');

		let wrapper = document.querySelector('.editor-page__edit-canvas-wrapper');
		// log(wrapper);
		if (wrapper) {
			// log(`getEditCanvasWrapperBounds`, 'end');
			return wrapper.getBoundingClientRect();
		}

		// log(`getEditCanvasWrapperBounds`, 'end');
		return false;
	}

	// --------------------------------------------------------------
	// Live Previews
	// --------------------------------------------------------------
	/**
	 * editor.livePreviews holds all the live previews for both the
	 * Live Previews page and the Pop Out Live Previews.
	 * editor.livePreviews[0] is reserved for the Live Previews Page.
	 * The rest are for the Pop Out Window.
	 */
	get livePreviews() {
		// log(`ProjectEditor GET livePreviews`, 'start');
		// log(`this._livePreviews: ${this._livePreviews}`);
		// log(`this._livePreviews.length: ${this._livePreviews.length}`);
		// log(`Array.isArray(this._livePreviews): ${Array.isArray(this._livePreviews)}`);
		// log(`this?.project?.settings?.app?.livePreviews`);
		// log(this?.project?.settings?.app?.livePreviews);
		if (
			!Array.isArray(this._livePreviews) ||
			this._livePreviews.length === 0 ||
			!this._livePreviews
		) {
			this._livePreviews = [];
			if (this.project?.settings?.app?.livePreviews.length) {
				this._livePreviews = this.project.settings.app.livePreviews.map(
					(preview) => new TextBlockOptions(preview)
				);
			}
			if (!this._livePreviews[0]?.text) {
				this._livePreviews[0] = new TextBlockOptions({
					text: 'the five boxing wizards jump quickly',
				});
			}
		}

		// log(`Returning:`);
		// log(this._livePreviews);
		// log(`ProjectEditor GET livePreviews`, 'end');
		return this._livePreviews;
	}

	set livePreviews(newPreviews) {
		if (!Array.isArray(newPreviews)) {
			this._livePreviews = [];
		} else {
			this._livePreviews = newPreviews.map((preview) => new TextBlockOptions(preview));
		}
	}

	get livePreviewPageOptions() {
		if (!this.livePreviews.length) {
			this.livePreviews[0] = new TextBlockOptions({
				text: 'the five boxing wizards jump quickly',
			});
		}

		return this.livePreviews[0];
	}

	set livePreviewPageOptions(newOptions) {
		this.livePreviews[0] = new TextBlockOptions(newOptions);
	}

	// --------------------------------------------------------------
	// Save
	// --------------------------------------------------------------

	/**
	 * Builds the .gs2 text for this project: upstream's save data with default
	 * settings trimmed, live previews, and (ANY-INK, D-012) binary assets embedded
	 * as base64 under a top-level 'assets' key, only when there are any. Every
	 * save path (in place, Save As, download) uses this so the format never forks.
	 * ANY-INK (audit A9): always compact JSON. formatSaveFile has no control anywhere
	 * in the UI, so a value carried in from a sample or an upstream file is ignored.
	 * @returns {Promise<String>}
	 */
	async makeProjectFileText() {
		// log(`ProjectEditor.makeProjectFileText`, 'start');
		let saveData = this.project.save();

		const defaultValues = new GlyphrStudioProject({});
		saveData = removeDefaultValues(saveData, defaultValues, 'settings');

		// ANY-INK (M6, audit A10): saveLivePreviews has no control any more, so live
		// previews are always saved; a project that arrived with it off keeps them.
		saveData.settings.app.livePreviews = [];
		this.livePreviews.forEach((preview) => {
			saveData.settings.app.livePreviews.push(preview.save());
		});

		// ANY-INK (M7): only images some trace still uses go in the .gs2 (a removed trace
		// leaves its Blob in editor.assets for undo; crash snapshots keep all of them).
		// Until the trace model is real, ASSET_PRUNING_READY is false and every asset is written.
		const ids = ASSET_PRUNING_READY ? collectReferencedAssetIds(this.project) : undefined;
		const assets = this.assets ? await this.assets.toSaveObject({ ids }) : {};
		if (assets && Object.keys(assets).length) saveData.assets = assets;

		// log(`ProjectEditor.makeProjectFileText`, 'end');
		return JSON.stringify(saveData);
	}

	/**
	 * Save a Glyphr Project Text File.
	 * ANY-INK (D-012): in place through the open file handle, Save As through the
	 * picker, or a download when the File System Access API is missing
	 * (src/anyink/files/project_files.js). Call from a click or Ctrl+S.
	 * @param {Boolean} saveAsCopy - true = Save As (pick a new file)
	 * @returns {Promise<Boolean>} true when written, false when cancelled
	 */
	async saveProjectFile(saveAsCopy = false) {
		return saveAsCopy ? saveProjectAs(this) : saveProject(this);
	}

	/**
	 * The file on disk now holds this project (called by every save path after a
	 * successful write, only when no edit landed during the save). ANY-INK: records
	 * the undo state on top of the queue as the saved one, so undo / redo can tell
	 * when they are back on it (History.isAtSavedState).
	 */
	setProjectAsSaved() {
		this.project.resetSessionStateForAllItems();
		if (typeof this.history?.markSavedState === 'function') this.history.markSavedState();
		this.showSavedIndicator(true, 'saved');
	}
	setProjectAsUnsaved() {
		this.showSavedIndicator(false, 'edit');
	}

	/**
	 * ANY-INK: after an undo or redo the title dot follows History's saved marker. It
	 * is cleared only on the undo state the file on disk holds, never merely because
	 * the queue is empty (a recovered project matches no file at all).
	 * @param {Object} [history] - the History that changed; default this editor's
	 */
	updateSavedIndicator(history = this.history) {
		const saved = typeof history?.isAtSavedState === 'function' && history.isAtSavedState();
		this.showSavedIndicator(saved, 'history');
	}

	/**
	 * Shows or clears the title dot and publishes 'projectFile' only on a change.
	 * @param {Boolean} saved
	 * @param {String} reason - 'saved' | 'edit' | 'history'
	 */
	showSavedIndicator(saved, reason) {
		// Only trim the unsaved marker when it is there (indexOf -1 would chop a character)
		const marker = document.title.indexOf(' •');
		if (saved && marker > -1) {
			document.title = document.title.slice(0, marker);
			this.publish('projectFile', { saved: true, handle: this.loadedFileHandle, reason });
		} else if (!saved && marker < 0) {
			document.title += ' •';
			this.publish('projectFile', { saved: false, handle: this.loadedFileHandle, reason });
		}
	}
}

function removeDefaultValues(target, defaults, filterName) {
	Object.keys(target[filterName]).forEach((key) => {
		if (target[filterName][key] === defaults[filterName][key]) {
			delete target[filterName][key];
		}
	});

	return target;
}

// https://en.wikipedia.org/wiki/Typographic_ligature
export const ligatureToUnicode = {
	ff: '0xFB00',
	fi: '0xFB01',
	fl: '0xFB02',
	ft: '0xFB05',
	ffi: '0xFB03',
	ffl: '0xFB04',
};
