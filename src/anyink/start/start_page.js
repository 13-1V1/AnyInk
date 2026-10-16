// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: Simple's start screen (UX-BEGINNER.md 4.1), in place of the four-tab Open Project page.
	open_project.js draws it in Simple with the 'startScreen' flag on; All tools keeps the tabs.

	  ANY-INK
	  Continue where you left off
	  [ Brennan Hand            last used yesterday       [ Continue ] ]
	  Other fonts:  Test Caps . Old Hand                 Open a saved font...
	  Make a new font
	  Name it: [ My Font ]  [ Create my font ]
	           Next, Windows asks where to keep your work file. Documents is fine.
	           This is your work file, not the font.
	  Other ways to start...                       Built on Glyphr Studio 2 (GPL)

	The card on top (start_state.js chooseCard) is one of four, never two, and holds the one green
	button when there is one:
	  continue       the newest recent work file: [Continue] asks Chrome for the file inside the
	                 click (recents_ui.js openRecentHandle), then opens the font on the board. Chrome
	                 said no: "Chrome needs your OK to open this file. Press Continue again and choose
	                 Allow." The first-time hint shows while Chrome would still ask.
	  crashWithFile  a backup copy newer than its work file: [Continue with them] asks for the file
	                 (inside the click), then restores the backup (D-026), so autosave writes the
	                 restored work into the file; "Open the saved file instead" opens the older file
	                 and leaves the backup in the backups list
	  crashNoFile    a backup copy with no work file: [Continue with it] restores it ("Not saved yet
	                 [Save]"); "Throw it away" asks the only start-screen confirm (7.4 #1)
	  none           nothing to continue: [Create my font] is the green one
	[Create my font] is outlined whenever a card shows. Other fonts (up to 3) and "Open a saved
	font..." show always. The name field (#input__new-project-name) says "My Font", or "My Font 2"
	... when a recent font or a backup copy already has that name; [Create my font]
	(#button__create-new-project) starts the save box without waiting for it (create_font.js). A
	work file dropped anywhere on the page opens. "Other ways to start..." opens the original tabs
	under the purple More tools band. The page lists again whenever a backup copy comes or goes.

	  makeStartPage(deps)   the page (#app__page > #open-project__page.anyink-start), with
	                        page.ready (the first listing) and page.refill()
	  deps: load (content, handle) -> editor, the open_project.js loader; create () -> editor,
	        makes the font from the name field and opens the board; openFiles(items), a drop;
	        moreTools(), Other ways to start. Tests also pass listRecents, listSessions,
	        readRecord, restore, discard, confirmThrow, removeRecent, openRecent, openPicker,
	        askPermission, createFont, now.
*/
import './start.css';
import { cancelDefaultEventActions } from '../../edit_canvas/events.js';
import { ensurePermission, listRecentProjects, removeRecentProject } from '../files/handles.js';
import { openProjectFromPicker } from '../files/project_files.js';
import { openRecentHandle } from '../files/recents_ui.js';
import { formatRelativeTime } from '../files/relative_time.js';
import { runFileCommand } from '../files/run_command.js';
import { isFeatureOn } from '../mode/features.js';
import {
	RECOVERY_CHANGE_EVENT,
	discardSession,
	isRecoveryGoneError,
	listRecoverableSessions,
	restoreSession,
} from '../recovery/recovery.js';
import { confirmThrowAway } from '../recovery/recovery_ui.js';
import { recGet } from '../storage/kv.js';
import { word } from '../words/words.js';
import { sessionFacts } from './card_facts.js';
import { createFont } from './create_font.js';
import { chooseCard, defaultFontName, otherFonts, whenParts } from './start_state.js';

export const START_CLASS = 'anyink-start';

/**
 * @param {Object} deps - see the header
 * @returns {HTMLElement}
 */
export function makeStartPage(deps = {}) {
	const d = {
		listRecents: listRecentProjects,
		listSessions: listRecoverableSessions,
		readRecord: recGet,
		restore: restoreSession,
		discard: discardSession,
		confirmThrow: confirmThrowAway,
		removeRecent: removeRecentProject,
		openRecent: (entry) => openRecentHandle(entry, { load: deps.load }),
		openPicker: () => runFileCommand(() => openProjectFromPicker({ load: deps.load })),
		askPermission: (handle) => ensurePermission(handle, 'readwrite'),
		createFont,
		create: () => undefined,
		openFiles: () => undefined,
		moreTools: () => undefined,
		now: () => Date.now(),
		isOn: isFeatureOn,
		...deps,
	};

	const wrapper = el('div', { id: 'app__page' });
	const page = el('div', { id: 'open-project__page', className: START_CLASS });
	page.setAttribute('data-anyink-start', '');
	const main = el('div', { id: 'open-project__right-area', className: `${START_CLASS}__main` });
	const dropNote = el('div', { id: 'open-project__drop-note', className: `${START_CLASS}__drop` });
	page.append(main, dropNote);
	wrapper.append(page);

	main.append(el('h1', { className: `${START_CLASS}__logo`, text: word('startScreen.appName') }));
	const top = el('section', { className: `${START_CLASS}__top` });
	const note = el('p', { className: `${START_CLASS}__note` });
	note.setAttribute('role', 'status');
	note.hidden = true;
	const others = el('div', { className: `${START_CLASS}__others` });
	main.append(top, note, others, el('hr', { className: `${START_CLASS}__rule` }));

	// Make a new font: drawn at once, so a mode switch can put back a name he typed
	const initialName = word('startScreen.defaultName');
	const form = el('section', { className: `${START_CLASS}__new` });
	const title = el('h2', {
		className: `${START_CLASS}__heading`,
		text: word('startScreen.newTitle'),
	});
	const row = el('div', { className: `${START_CLASS}__name-row` });
	const label = el('label', { text: word('startScreen.nameIt') });
	label.setAttribute('for', 'input__new-project-name');
	const input = el('input', { id: 'input__new-project-name' });
	input.type = 'text';
	input.value = initialName;
	input.setAttribute('autocomplete', 'off');
	const createButton = el('button', {
		id: 'button__create-new-project',
		className: 'anyink-primary',
		text: word('startScreen.create'),
	});
	createButton.type = 'button';
	row.append(label, input, createButton);
	const workNote = d.isOn('useInWord')
		? 'startScreen.workFileNoteStep3'
		: 'startScreen.workFileNote';
	form.append(
		title,
		row,
		el('p', { className: `${START_CLASS}__hint`, text: word('startScreen.whereNote') }),
		el('p', { className: `${START_CLASS}__hint`, text: word(workNote) })
	);
	main.append(form, el('hr', { className: `${START_CLASS}__rule` }));

	const foot = el('div', { className: `${START_CLASS}__foot` });
	const otherWays = linkButton('startScreen.otherWays', () => d.moreTools());
	otherWays.classList.add(`${START_CLASS}__other-ways`);
	foot.append(
		otherWays,
		el('span', { className: `${START_CLASS}__credit`, text: word('startScreen.credit') })
	);
	main.append(foot);

	let defaultName = initialName;
	const pressCreate = () => {
		const name = input.value.trim() || defaultName;
		input.value = name;
		page.lastCreate = d.createFont({ name, create: d.create });
		return page.lastCreate;
	};
	createButton.addEventListener('click', pressCreate);
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			pressCreate();
		}
	});

	/** One sentence under the card; it stays through a new listing. */
	const say = (key, vars) => {
		note.textContent = key ? word(key, vars) : '';
		note.hidden = !key;
	};

	/** What a Continue (or a font name) press does with openRecent's answer. */
	const afterOpen = async (entry, status) => {
		if (status === 'opened') return status;
		if (status === 'prompt' || status === 'denied') say('startScreen.note.refused');
		else if (status === 'missing') {
			try {
				await d.removeRecent(entry.handle);
			} catch {
				// the list stays as it was; the sentence still says where to look
			}
			say('startScreen.note.gone', { name: entry.name || entry.handle?.name || '' });
			await refill();
		}
		return status;
	};
	const openEntry = (entry) => {
		say(null);
		page.lastAction = Promise.resolve(d.openRecent(entry)).then((status) =>
			afterOpen(entry, status)
		);
		return page.lastAction;
	};

	let latest = 0;
	const refill = async () => {
		const run = ++latest;
		const [recents, listed] = await Promise.all([quietly(d.listRecents), quietly(d.listSessions)]);
		if (run !== latest) return;
		// a Replace it copy, or one his work file is as new as, is no crash (card_facts.js)
		const sessions = await sessionFacts(listed, recents, { readRecord: d.readRecord });
		if (run !== latest) return;
		const card = chooseCard({ recents, sessions });
		const fileHandle = card.kind === 'crashWithFile' ? card.session.fileHandle || null : null;
		top.replaceChildren(...makeCard(card, fileHandle));
		const shown = await withoutFile(
			otherFonts(recents, card, 3 + (fileHandle ? 1 : 0)),
			fileHandle
		);
		if (run !== latest) return;
		others.replaceChildren(...makeOthers(shown.slice(0, 3)));
		const greenElsewhere = card.kind !== 'none';
		createButton.className = greenElsewhere ? 'anyink-outlined' : 'anyink-primary';
		const taken = [...recents.map((entry) => entry?.name), ...sessions.map((s) => s?.name)];
		const nextDefault = defaultFontName(taken, {
			base: initialName,
			numbered: (number) => word('startScreen.defaultNameNumbered', { number }),
		});
		if (input.value === defaultName) input.value = nextDefault;
		defaultName = nextDefault;
		page.card = card;
	};

	function makeCard(card, fileHandle) {
		if (card.kind === 'none') return [];
		const box = el('div', { className: `${START_CLASS}__card` });
		box.setAttribute('data-anyink-card', card.kind);
		if (card.kind === 'continue') {
			const entry = card.recent;
			const heading = el('h2', {
				className: `${START_CLASS}__heading`,
				text: word('startScreen.continueTitle'),
			});
			const line = el('div', { className: `${START_CLASS}__card-row` });
			const name = el('span', {
				className: `${START_CLASS}__font-name`,
				text: entry.name || entry.handle?.name || '',
			});
			const when = el('span', {
				className: `${START_CLASS}__when`,
				text: word('startScreen.lastUsed', { ago: formatRelativeTime(entry.time, d.now()) }),
			});
			const go = el('button', { className: 'anyink-primary', text: word('startScreen.continue') });
			go.type = 'button';
			go.setAttribute('data-anyink-choice', 'continue');
			go.addEventListener('click', () => openEntry(entry));
			line.append(name, when, go);
			const hint = el('p', {
				className: `${START_CLASS}__hint`,
				text: word('startScreen.allowHint'),
			});
			hint.hidden = true;
			showHintIfChromeWillAsk(entry.handle, hint);
			box.append(line, hint);
			return [heading, box];
		}
		const session = card.session;
		const when = whenParts(session.time, d.now());
		const vars = { name: session.name || '', when: word(when.key, when.vars) };
		const withFile = card.kind === 'crashWithFile';
		box.classList.add(`${START_CLASS}__card--crash`);
		const sentence = el('p', {
			className: `${START_CLASS}__crash-text`,
			text: word(withFile ? 'startScreen.crash.withFile' : 'startScreen.crash.noFile', vars),
		});
		const line = el('div', { className: `${START_CLASS}__card-row` });
		const go = el('button', {
			className: 'anyink-primary',
			text: word(
				withFile ? 'startScreen.crash.continueWithThem' : 'startScreen.crash.continueWithIt'
			),
		});
		go.type = 'button';
		go.setAttribute('data-anyink-choice', 'continue');
		go.addEventListener('click', () => {
			say(null);
			// the file first, inside the click; the backup copy goes in after it
			const asked =
				withFile && fileHandle
					? Promise.resolve(d.askPermission(fileHandle)).catch(() => 'prompt')
					: null;
			page.lastAction = restoreBackup(session.id).then(async (restored) => {
				if (asked) await asked;
				return restored;
			});
		});
		const other = withFile
			? linkButton('startScreen.crash.openSaved', () => {
					say(null);
					if (fileHandle) return openEntry({ handle: fileHandle, name: session.name });
					page.lastAction = Promise.resolve(d.openPicker());
					return page.lastAction;
			  })
			: linkButton('recover.throwAway', () => {
					page.lastAction = throwAway(session.id);
					return page.lastAction;
			  });
		other.setAttribute('data-anyink-choice', withFile ? 'open-saved' : 'throw-away');
		line.append(go, other);
		box.append(sentence, line);
		return [box];
	}

	const restoreBackup = async (id) => {
		try {
			await d.restore(id);
			return true;
		} catch (error) {
			if (!isRecoveryGoneError(error)) console.warn('ANY-INK: the backup copy did not open', error);
			await refill();
			return false;
		}
	};

	const throwAway = async (id) => {
		if (!(await d.confirmThrow())) return false;
		try {
			await d.discard(id);
		} catch (error) {
			console.warn('ANY-INK: the backup copy was not thrown away', error);
		}
		await refill();
		return true;
	};

	function makeOthers(entries) {
		const parts = [];
		if (entries.length) {
			const list = el('span', { className: `${START_CLASS}__font-list` });
			list.append(
				el('span', { className: `${START_CLASS}__label`, text: word('startScreen.otherFonts') })
			);
			entries.forEach((entry) => {
				const name = el('button', {
					className: `${START_CLASS}__link ${START_CLASS}__font`,
					text: entry.name || entry.handle?.name || '',
				});
				name.type = 'button';
				name.addEventListener('click', () => openEntry(entry));
				list.append(name);
			});
			parts.push(list);
		}
		const open = linkButton('startScreen.openSaved', () => {
			say(null);
			page.lastAction = Promise.resolve(d.openPicker());
			return page.lastAction;
		});
		open.classList.add(`${START_CLASS}__open-saved`);
		parts.push(open);
		return parts;
	}

	// A work file dropped anywhere opens (4.1 "Drop a .gs2 anywhere")
	page.addEventListener('dragenter', (event) => {
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		dropNote.textContent = word('startScreen.dropNote');
		dropNote.classList.add(`${START_CLASS}__drop--on`);
	});
	page.addEventListener('dragover', cancelDefaultEventActions);
	dropNote.addEventListener('dragleave', () =>
		dropNote.classList.remove(`${START_CLASS}__drop--on`)
	);
	page.addEventListener('drop', (event) => {
		cancelDefaultEventActions(event);
		dropNote.classList.remove(`${START_CLASS}__drop--on`);
		d.openFiles(event?.dataTransfer?.items || event?.dataTransfer?.files || []);
	});

	// A backup copy that comes or goes (restored, thrown away, a tab closing) lists again
	const onChange = () => {
		if (!page.isConnected) {
			globalThis.removeEventListener?.(RECOVERY_CHANGE_EVENT, onChange);
			return;
		}
		refill();
	};
	globalThis.addEventListener?.(RECOVERY_CHANGE_EVENT, onChange);

	wrapper.refill = refill;
	wrapper.page = page;
	wrapper.ready = refill();
	page.ready = wrapper.ready;
	page.refill = refill;
	page.lastAction = Promise.resolve();
	return wrapper;
}

/**
 * @param {Array<{handle: Object}>} entries
 * @param {Object | null} fileHandle - the crash card's work file
 * @returns {Promise<Array>} entries that aren't that file
 */
async function withoutFile(entries, fileHandle) {
	if (!fileHandle) return entries;
	const kept = [];
	for (const entry of entries) {
		let same = entry?.handle === fileHandle;
		if (!same && typeof entry?.handle?.isSameEntry === 'function') {
			try {
				same = await entry.handle.isSameEntry(fileHandle);
			} catch {
				same = false;
			}
		}
		if (!same) kept.push(entry);
	}
	return kept;
}

/** The first-time hint: shown while Chrome would still ask about this file. */
async function showHintIfChromeWillAsk(handle, hint) {
	if (typeof handle?.queryPermission !== 'function') return;
	try {
		hint.hidden = (await handle.queryPermission({ mode: 'readwrite' })) !== 'prompt';
	} catch {
		hint.hidden = true;
	}
}

/** @returns {Promise<Array>} the list, or [] when it can't be read */
async function quietly(list) {
	try {
		const result = await list();
		return Array.isArray(result) ? result : [];
	} catch (error) {
		console.warn('ANY-INK: the start screen could not read a list', error);
		return [];
	}
}

/**
 * @param {String} key - words key
 * @param {Function} run
 * @returns {HTMLButtonElement} a link-looking button (never green)
 */
function linkButton(key, run) {
	const button = el('button', { className: `${START_CLASS}__link`, text: word(key) });
	button.type = 'button';
	button.addEventListener('click', run);
	return button;
}

/**
 * @param {String} tag
 * @param {{id?: String, className?: String, text?: String}} [options]
 * @returns {HTMLElement}
 */
function el(tag, { id, className, text } = {}) {
	const element = document.createElement(tag);
	if (id) element.id = id;
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}
