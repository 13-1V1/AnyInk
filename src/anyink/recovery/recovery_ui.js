// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK recovery card (Milestone 6).
	The "unsaved work found" card for the Open Project page, the Recover tab's
	self-filling area, and the confirm dialog behind Settings > App > "Forget
	crash-recovery snapshots". Theme tokens only (recovery.css): the card frame is
	structure purple, Restore is the green touch button, Discard is secondary.

	  makeRecoveryCard(sessions, { onRestore, onDiscard, onEmpty, now })
	      One row per session (name, "n minutes ago", "from file" badge, Restore,
	      Discard). Defaults call restoreSession / discardSession. In Simple (B4 fix
	      track, until B13's crash card): the badge says "has a saved file", only the
	      first Restore is green (principle 1), and Discard on unsaved work with no work
	      file first asks the one start-screen confirm (UX-BEGINNER 7.4 #1,
	      confirmThrowAway): that backup is the only copy of the work. A Restore whose
	      snapshot is gone (isRecoveryGoneError: discarded elsewhere, restored in
	      another tab, saved) drops the row instead of showing an error. When the
	      last row goes, onEmpty(card) runs when given, otherwise the empty message
	      replaces the rows. Callers only build it when sessions.length > 0.
	  makeRecoverArea({ banner, list })
	      A container that lists sessions asynchronously and fills itself with a
	      card, or the empty message (tab; Simple says "backup copy", 2.4 G) / removes
	      itself (banner). A listing that
	      fails is not "nothing to recover": the tab says the snapshots could not be
	      read (the banner removes itself). It re-lists on
	      every RECOVERY_CHANGE_EVENT (restore, discard, forget, a session ending),
	      so the banner and the Recover tab never disagree, and stops listening once
	      it has left the document. area.refresh() re-lists on demand; area.ready is
	      the first listing.
	  confirmForgetSnapshots()
	      Modal "Forget crash-recovery snapshots?" -> Promise<Boolean>.
	  confirmThrowAway()
	      Simple: modal "Throw away this unsaved work? This can't be undone. [Throw it
	      away] [Keep it]" -> Promise<Boolean>; Keep it is the green one, and closing the
	      box any other way keeps the work.
	  forgetSnapshotsWithFeedback()
	      Settings > App > Forget: forgetAllSnapshots() with a toast either way
	      ('...were forgotten...' or 'Could not forget the snapshots: <reason>').
	      Never rejects -> Promise<Boolean>.
*/

import { addAsChildren, makeElement } from '../../common/dom.js';
import {
	closeEveryTypeOfDialog,
	showError,
	showModalDialog,
	showToast,
} from '../../controls/dialogs/dialogs.js';
import './recovery.css';
import {
	RECOVERY_CHANGE_EVENT,
	discardSession,
	forgetAllSnapshots,
	isRecoveryGoneError,
	listRecoverableSessions,
	restoreSession,
} from './recovery.js';
import { formatAgo } from './snapshot.js';
import { isSimpleMode } from '../mode/mode.js';
import { word } from '../words/words.js';

/** All tools' empty Recover tab (Simple: 'recover.nothing'). */
export const EMPTY_MESSAGE =
	'Nothing to recover. Unsaved work is snapshotted every few seconds while you edit.';
export const LOADING_MESSAGE = 'Looking for unsaved work…';

/**
 * @param {Array<{id: String, name: String, time: Number, dirty: Boolean, hasFile: Boolean}>} sessions
 * @param {Object} [options]
 * @param {Function} [options.onRestore] - (id) => Promise; default restoreSession
 * @param {Function} [options.onDiscard] - (id) => Promise; default discardSession
 * @param {Function} [options.onEmpty] - (card) => void, after the last row is discarded
 * @param {Number} [options.now] - epoch ms for the "ago" wording (tests)
 * @returns {HTMLElement}
 */
export function makeRecoveryCard(sessions, { onRestore, onDiscard, onEmpty, now } = {}) {
	const restore = onRestore || restoreSession;
	const discard = onDiscard || discardSession;
	const nowMs = now ?? Date.now();

	const card = makeElement({ tag: 'div', className: 'anyink-recovery-card' });
	card.setAttribute('role', 'region');
	card.setAttribute('aria-label', 'Recover unsaved work');
	const header = makeElement({
		tag: 'div',
		className: 'anyink-recovery-card__header',
		innerHTML: `
			<span class="anyink-recovery-card__eyebrow">Unsaved work found</span>
			<span class="anyink-recovery-card__hint">ANY-INK closed before this was saved. Restore it to keep editing, or discard it.</span>
		`,
	});
	const rows = makeElement({ tag: 'div', className: 'anyink-recovery-card__rows' });
	addAsChildren(card, [header, rows]);

	function showEmpty() {
		if (typeof onEmpty === 'function') onEmpty(card);
		else {
			card.innerHTML = '';
			card.appendChild(makeEmptyMessage());
		}
	}

	const simple = isSimpleMode();
	(sessions || []).forEach((session, index) => {
		const row = makeElement({ tag: 'div', className: 'anyink-recovery-row' });
		row.dataset.sessionId = session.id;

		const title = makeElement({ tag: 'div', className: 'anyink-recovery-row__title' });
		title.appendChild(
			makeElement({
				tag: 'span',
				className: 'anyink-recovery-row__name',
				content: escapeHTML(session.name),
			})
		);
		if (session.hasFile) {
			title.appendChild(
				makeElement({
					tag: 'span',
					className: 'anyink-recovery-row__badge',
					content: simple ? escapeHTML(word('recover.hasFile')) : 'from file',
				})
			);
		}
		const when = makeElement({
			tag: 'span',
			className: 'anyink-recovery-row__when',
			content: formatAgo(session.time, nowMs),
		});
		const restoreButton = makeElement({
			tag: 'fancy-button',
			className: 'anyink-recovery-row__restore',
			// Simple: one green button (principle 1), the newest backup's Restore
			attributes: simple && index > 0 ? { secondary: '' } : {},
			innerHTML: 'Restore',
		});
		const discardButton = makeElement({
			tag: 'fancy-button',
			className: 'anyink-recovery-row__discard',
			attributes: { secondary: '' },
			innerHTML: 'Discard',
		});
		const buttons = makeElement({ tag: 'div', className: 'anyink-recovery-row__buttons' });
		addAsChildren(buttons, [restoreButton, discardButton]);
		addAsChildren(row, [title, when, buttons]);

		const setBusy = (busy) => {
			[restoreButton, discardButton].forEach((button) => {
				if (busy) button.setAttribute('disabled', '');
				else button.removeAttribute('disabled');
			});
		};

		restoreButton.addEventListener('click', async () => {
			if (restoreButton.hasAttribute('disabled')) return;
			setBusy(true);
			try {
				await restore(session.id);
			} catch (error) {
				if (isRecoveryGoneError(error)) {
					// Already restored, discarded or saved elsewhere: nothing to show but a fresh list.
					row.remove();
					if (!rows.children.length) showEmpty();
					return;
				}
				setBusy(false);
				showError(
					`Could not recover ${escapeHTML(session.name)}: ${escapeHTML(error?.message || error)}`
				);
			}
		});

		discardButton.addEventListener('click', async () => {
			if (discardButton.hasAttribute('disabled')) return;
			setBusy(true);
			// Simple: unsaved work with no work file is the only copy, so ask first (7.4 #1)
			if (simple && !session.hasFile && !(await confirmThrowAway())) {
				setBusy(false);
				return;
			}
			try {
				await discard(session.id);
				row.remove();
				if (!rows.children.length) showEmpty();
			} catch (error) {
				setBusy(false);
				showError(
					`Could not discard ${escapeHTML(session.name)}: ${escapeHTML(error?.message || error)}`
				);
			}
		});

		rows.appendChild(row);
	});

	if (!rows.children.length) showEmpty();
	return card;
}

/** @returns {HTMLElement} the empty-state line */
export function makeEmptyMessage() {
	return makeElement({
		tag: 'i',
		className: 'anyink-recovery__empty',
		// B4 fix track: Simple says "backup copy" (2.4 G), the editor's own word, never "snapshot"
		content: isSimpleMode() ? escapeHTML(word('recover.nothing')) : EMPTY_MESSAGE,
	});
}

/**
 * A container that fills itself from listRecoverableSessions() and keeps itself
 * current: every live area re-lists on RECOVERY_CHANGE_EVENT.
 * @param {Object} [options]
 * @param {Boolean} [options.banner=false] - true above the tabs: removes itself when
 *   there is nothing to recover instead of showing the empty message
 * @param {Function} [options.list] - () => Promise<sessions>; default listRecoverableSessions
 * @returns {HTMLElement} with refresh() and ready
 */
export function makeRecoverArea({ banner = false, list } = {}) {
	const area = makeElement({
		tag: 'div',
		className: banner
			? 'anyink-recovery-area anyink-recovery-area--banner'
			: 'anyink-recovery-area',
	});
	if (!banner) {
		area.appendChild(
			makeElement({ tag: 'i', className: 'anyink-recovery__empty', content: LOADING_MESSAGE })
		);
	}
	const load = list || listRecoverableSessions;
	let listening = false;
	let latest = 0;

	const stopListening = () => {
		if (!listening) return;
		listening = false;
		globalThis.removeEventListener?.(RECOVERY_CHANGE_EVENT, onChange);
	};
	const finishEmpty = () => {
		if (banner) {
			area.remove();
			stopListening();
		} else {
			area.innerHTML = '';
			area.appendChild(makeEmptyMessage());
		}
	};
	const refresh = () => {
		const run = ++latest;
		return Promise.resolve()
			.then(() => load())
			.then((sessions) => {
				if (run !== latest) return; // a newer listing is on its way
				area.innerHTML = '';
				if (sessions?.length) {
					area.appendChild(makeRecoveryCard(sessions, { onEmpty: finishEmpty }));
				} else {
					finishEmpty();
				}
			})
			.catch((error) => {
				console.warn('ANY-INK recovery: could not list sessions', error);
				if (run !== latest) return;
				if (banner) {
					finishEmpty();
					return;
				}
				area.innerHTML = '';
				area.appendChild(makeListErrorMessage(error));
			});
	};
	function onChange() {
		// Pages are rebuilt, not hidden: an area that left the document is gone for good.
		if (!area.isConnected) {
			stopListening();
			return;
		}
		refresh();
	}

	if (typeof globalThis.addEventListener === 'function') {
		globalThis.addEventListener(RECOVERY_CHANGE_EVENT, onChange);
		listening = true;
	}
	area.refresh = refresh;
	area.ready = refresh();
	return area;
}

/**
 * @param {*} error - why the snapshots could not be listed
 * @returns {HTMLElement} the tab's message for a failed listing
 */
function makeListErrorMessage(error) {
	const said = error?.message || error?.name || String(error);
	const reason = escapeHTML(said);
	return makeElement({
		tag: 'i',
		className: 'anyink-recovery__empty',
		// B4 + B5 integration: Simple says it in house words (2.4 G: "backup copy", never
		// "snapshot"), until B13's crash card
		content: isSimpleMode()
			? escapeHTML(word('start.backupsUnreadable', { reason: said }))
			: `Could not read the crash-recovery snapshots (${reason}). Reload ANY-INK to try again.`,
	});
}

/**
 * Settings > App > Forget: deletes every snapshot and says how it went.
 * @returns {Promise<Boolean>} true when every snapshot is gone
 */
export async function forgetSnapshotsWithFeedback() {
	try {
		await forgetAllSnapshots();
	} catch (error) {
		console.warn('ANY-INK recovery: could not forget the snapshots', error);
		const reason = escapeHTML(error?.message || error?.name || String(error));
		showToast(`Could not forget the snapshots: ${reason}`);
		return false;
	}
	showToast('Crash-recovery snapshots were forgotten for this browser.');
	return true;
}

/**
 * Asks before deleting every snapshot. Resolves false on Cancel; closing the dialog
 * by its × or backdrop leaves the promise pending, which is harmless.
 * @returns {Promise<Boolean>}
 */
export function confirmForgetSnapshots() {
	return new Promise((resolve) => {
		const content = makeElement({
			tag: 'div',
			className: 'anyink-recovery-confirm',
			innerHTML: `
				<h2>Forget crash-recovery snapshots?</h2>
				<p>Every snapshot of unsaved work kept in this browser is deleted. Saved project files are not touched. The project you are editing is snapshotted again on your next edit.</p>
			`,
		});
		const cancel = makeElement({
			tag: 'fancy-button',
			attributes: { secondary: '' },
			innerHTML: 'Cancel',
			onClick: () => {
				closeEveryTypeOfDialog();
				resolve(false);
			},
		});
		const forget = makeElement({
			tag: 'fancy-button',
			attributes: { danger: '' },
			innerHTML: 'Forget snapshots',
			onClick: () => {
				closeEveryTypeOfDialog();
				resolve(true);
			},
		});
		const buttons = makeElement({ tag: 'div', className: 'anyink-recovery-confirm__buttons' });
		addAsChildren(buttons, [cancel, forget]);
		content.appendChild(buttons);
		showModalDialog(content, 440);
	});
}

/**
 * Simple's one start-screen confirm (UX-BEGINNER 7.4 #1): unsaved work with no work file is
 * thrown away only after this. Keep it is the green button (principle 1: the safe choice is
 * the obvious one); Throw it away is outlined. Closing the box by its x or the backdrop keeps
 * the work. Buttons carry data-anyink-choice ('throw-away', 'keep') for tests and B13.
 * @returns {Promise<Boolean>} true: throw it away
 */
export function confirmThrowAway() {
	return new Promise((resolve) => {
		let answered = false;
		let watcher = null;
		const answer = (value) => {
			if (answered) return;
			answered = true;
			watcher?.disconnect();
			closeEveryTypeOfDialog();
			resolve(value);
		};
		const content = makeElement({ tag: 'div', className: 'anyink-recovery-confirm' });
		content.appendChild(
			makeElement({ tag: 'p', content: escapeHTML(word('recover.throwAwayQuestion')) })
		);
		const button = (choice, key, outlined, value) =>
			makeElement({
				tag: 'fancy-button',
				attributes: { 'data-anyink-choice': choice, ...(outlined ? { secondary: '' } : {}) },
				content: escapeHTML(word(key)),
				onClick: () => answer(value),
			});
		const buttons = makeElement({ tag: 'div', className: 'anyink-recovery-confirm__buttons' });
		addAsChildren(buttons, [
			button('throw-away', 'recover.throwAway', true, true),
			button('keep', 'recover.keep', false, false),
		]);
		content.appendChild(buttons);
		showModalDialog(content, 440);
		// The x, the backdrop or Esc take the box down without an answer: that keeps the work
		const box = content.closest('dialog');
		if (box && typeof MutationObserver === 'function') {
			watcher = new MutationObserver(() => {
				if (!box.isConnected) answer(false);
			});
			watcher.observe(box.parentNode || document.body, { childList: true });
		}
	});
}

function escapeHTML(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
