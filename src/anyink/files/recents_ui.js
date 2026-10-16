// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK recent projects card (Milestone 6, D-012).
	Owner: FILES track (open / save / recents).

	makeRecentFilesCard(options) builds the "Recent projects" card for the Open
	Project page: one row per listRecentProjects() entry (project name, file name,
	relative time, remove button) plus a Clear link. Clicking a row runs
	ensurePermission('readwrite') inside the click, then openProjectFromHandle.
	Denied or missing files are dropped from the list with a toast; 'prompt'
	(the click's activation was gone) asks for one more click.

	The card fills itself asynchronously (recents come from IndexedDB) and
	re-renders on the current editor's 'projectFile' topic, unsubscribing once it
	has left the DOM. Returns false when hasFileSystemAccess() is false so callers
	can `if (card)`. Colors and spacing are theme tokens only (recents.css).

	Hooks on the element (tests and test pages):
	  card.ready    Promise of the first render
	  card.refresh()  re-render from storage, resolves the entries
	  card.openRecent(entry)  what a row click does; resolves the open status
	options: { load } is forwarded to openProjectFromHandle (a loader that does not
	navigate, for test pages); { openHandle } replaces openProjectFromHandle in tests;
	{ now } is a clock for the relative time labels.

	B13: the card shows only on the tabs "Other ways to start..." opens, which are All tools
	under the More tools band, so it says Glyphr Studio's words again (B4 + B5's Simple words are
	retired; Simple's start screen, src/anyink/start, lists recent fonts its own way).
	  openRecentHandle(entry, { load, openHandle })   the open on its own, shared with the start
	      screen's Continue and other fonts: permission inside the click ('readwrite', so the next
	      Save doesn't ask again), then openHandle. Resolves 'opened' | 'denied' | 'prompt' |
	      'missing' | 'invalid'; says nothing (each caller words it)
*/

import { getCurrentProjectEditor } from '../../app/main.js';
import { addAsChildren, makeElement } from '../../common/dom.js';
import { showToast } from '../../controls/dialogs/dialogs.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import { hasFileSystemAccess } from './file_api.js';
import {
	clearRecentProjects,
	ensurePermission,
	listRecentProjects,
	removeRecentProject,
} from './handles.js';
import { openProjectFromHandle } from './project_files.js';
import style from './recents.css?inline';
import { formatRelativeTime } from './relative_time.js';

export const STYLE_ID = 'anyink-recents-style';
/** pub/sub subscriber id: not a substring of any other anyink.* id */
export const SUBSCRIBER_ID = 'anyink.recentsCard.refresh';

/**
 * @param {Object} [options]
 * @param {Function} [options.load] - forwarded to openProjectFromHandle
 * @param {Function} [options.openHandle] - replaces openProjectFromHandle (tests)
 * @param {Function} [options.now] - () => epoch ms, for the time labels
 * @returns {HTMLElement | false}
 */
export function makeRecentFilesCard({ load, openHandle = openProjectFromHandle, now } = {}) {
	if (!hasFileSystemAccess()) return false;
	injectStyleOnce(STYLE_ID, style);

	const card = makeElement({ tag: 'div', className: 'anyink-recents' });
	const title = makeElement({
		tag: 'h3',
		className: 'anyink-recents__title',
		content: 'Recent projects',
	});
	const clear = makeElement({
		tag: 'button',
		className: 'anyink-recents__clear',
		content: 'Clear',
		attributes: { type: 'button', title: 'Forget every recent project' },
	});
	const head = makeElement({ tag: 'div', className: 'anyink-recents__head' });
	addAsChildren(head, [title, clear]);
	const list = makeElement({
		tag: 'div',
		className: 'anyink-recents__list',
		attributes: { role: 'list' },
	});
	addAsChildren(card, [head, list]);

	async function refresh() {
		const entries = await listRecentProjects();
		list.innerHTML = '';
		clear.hidden = entries.length === 0;
		if (entries.length === 0) {
			list.appendChild(
				makeElement({ className: 'anyink-recents__empty', content: 'Nothing opened yet' })
			);
		} else {
			entries.forEach((entry) => list.appendChild(makeRow(entry)));
		}
		return entries;
	}

	async function dropEntry(entry, message) {
		showToast(message);
		await removeRecentProject(entry.handle);
		await refresh();
	}

	/**
	 * @param {{handle: FileSystemFileHandle, name: String, time: Number}} entry
	 * @returns {Promise<String>} 'opened' | 'denied' | 'prompt' | 'missing' | 'invalid'
	 */
	async function openRecent(entry) {
		const label = entry.name || entry.handle?.name || 'this project';
		const status = await openRecentHandle(entry, { load, openHandle });
		if (status === 'prompt') {
			showToast(`Click once more to let ANY-INK open ${label}.`);
			return 'prompt';
		}
		if (status === 'missing') {
			await dropEntry(entry, `${label} could not be found.<br>Removed from recent projects.`);
		} else if (status === 'denied') {
			await dropEntry(entry, `Access to ${label} was refused.<br>Removed from recent projects.`);
		}
		return status;
	}

	function makeRow(entry) {
		const fileName = entry.handle?.name || '';
		const row = makeElement({
			tag: 'div',
			className: 'anyink-recents__row',
			attributes: {
				role: 'listitem',
				tabindex: '0',
				title: `Open ${fileName || entry.name}`,
			},
		});
		const name = makeElement({
			className: 'anyink-recents__name',
			content: entry.name || fileName,
		});
		const meta = makeElement({ className: 'anyink-recents__meta' });
		const file = makeElement({ className: 'anyink-recents__file', content: fileName });
		const time = makeElement({
			className: 'anyink-recents__time',
			content: formatRelativeTime(entry.time, now ? now() : Date.now()),
		});
		addAsChildren(meta, [file, time]);
		const remove = makeElement({
			tag: 'button',
			className: 'anyink-recents__remove',
			content: '&times;',
			attributes: {
				type: 'button',
				title: 'Remove from recent projects',
			},
		});
		remove.addEventListener('click', (event) => {
			event.stopPropagation();
			card.lastAction = removeRecentProject(entry.handle).then(refresh);
		});
		row.addEventListener('click', () => {
			card.lastAction = openRecent(entry);
		});
		row.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				card.lastAction = openRecent(entry);
			}
		});
		addAsChildren(row, [name, meta, remove]);
		return row;
	}

	clear.addEventListener('click', () => {
		card.lastAction = clearRecentProjects().then(refresh);
	});

	// Re-render when a project is opened or saved; let go once the card is gone.
	const editor = safeCurrentEditor();
	if (editor && typeof editor.subscribe === 'function') {
		editor.subscribe({
			topic: 'projectFile',
			subscriberID: SUBSCRIBER_ID,
			callback: () => {
				if (!card.isConnected) {
					editor.unsubscribe({ idToRemove: SUBSCRIBER_ID });
					return;
				}
				card.lastAction = refresh();
			},
		});
	}

	card.refresh = refresh;
	card.openRecent = openRecent;
	card.lastAction = Promise.resolve();
	card.ready = refresh();
	return card;
}

/**
 * @param {{handle: FileSystemFileHandle}} entry - a recents entry
 * @param {Object} [options]
 * @param {Function} [options.load] - forwarded to openHandle
 * @param {Function} [options.openHandle] - default openProjectFromHandle
 * @returns {Promise<'opened' | 'denied' | 'prompt' | 'missing' | 'invalid'>}
 */
export async function openRecentHandle(entry, { load, openHandle = openProjectFromHandle } = {}) {
	// Asked first, inside the click that called this: the open itself reads the file after awaits
	const permission = await ensurePermission(entry?.handle, 'readwrite');
	if (permission !== 'granted') return permission;
	return openHandle(entry.handle, { mode: 'readwrite', load });
}

function safeCurrentEditor() {
	try {
		return getCurrentProjectEditor();
	} catch {
		return null;
	}
}
