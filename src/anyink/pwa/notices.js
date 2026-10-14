// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK app notices (install offer, update ready, offline ready, offline setup failed).
	B1 (UX-BEGINNER 7.1): one notice on screen at a time; the rest wait their turn, highest
	priority first. Only an update cuts in, because it protects open work; the notice it moved
	comes back after it. Asking for a notice that is already showing or waiting never adds a
	second one; the newest action replaces the old (Chrome's install event can fire again).
	A notice with `once: '<pref name>'` is shown once ever: the app pref is set the moment it
	appears on screen, so one that only waited in line still shows next launch.
	A notice with `waits: false` never waits in line (B1 fix pass): it shows only when the screen
	is free, and an update that cuts in drops it instead of bringing it back right after.

	showNotice(spec)    spec = { key, kind, message, actionLabel?, action?, dismissLabel?,
	                    onDismiss?, once?, waits? }; kind = 'update' | 'problem' | 'offer' | 'info'.
	                    Returns the notice's key, or null when a once-ever notice was already seen
	                    or a notice that doesn't wait found the screen taken.
	closeNotice(key)    removes it, showing or waiting.
	activeNotice()      key on screen, or null.   waitingNotices()  keys in line.
	resetNotices()      tests only: forget everything (a fresh launch).
*/
import { getPref, setPref } from '../prefs/prefs.js';
import { watchNoticePlace } from './notice_place.js';

const KINDS = {
	update: { rank: 3, cutsIn: true },
	problem: { rank: 2 },
	offer: { rank: 1 },
	info: { rank: 0 },
};
const rank = (entry) => (KINDS[entry.spec.kind] || KINDS.info).rank;

let current = null; // { spec, panel, text }
let waiting = [];

export function showNotice(spec) {
	const existing = find(spec.key);
	if (existing) {
		existing.spec = { ...existing.spec, ...spec };
		return spec.key;
	}
	if (spec.once && getPref(spec.once)) return null;
	const entry = { spec };
	if (!current) display(entry);
	else if (KINDS[spec.kind]?.cutsIn && rank(entry) > rank(current)) {
		const moved = current;
		moved.panel.remove();
		current = null;
		if (moved.spec.waits !== false) enqueue(moved, true);
		display(entry);
	} else if (spec.waits === false) return null;
	else enqueue(entry);
	return spec.key;
}

export function closeNotice(key) {
	waiting = waiting.filter((entry) => entry.spec.key !== key);
	if (current?.spec.key !== key) return;
	current.panel.remove();
	current = null;
	const next = waiting.shift();
	if (next) display(next);
}

export function activeNotice() {
	return current ? current.spec.key : null;
}

export function waitingNotices() {
	return waiting.map((entry) => entry.spec.key);
}

export function resetNotices() {
	current?.panel.remove();
	current = null;
	waiting = [];
}

function find(key) {
	if (current?.spec.key === key) return current;
	return waiting.find((entry) => entry.spec.key === key);
}

/** Highest rank first; within a rank, oldest first (or first of all for a notice that was moved). */
function enqueue(entry, front = false) {
	const at = waiting.findIndex((other) =>
		front ? rank(other) <= rank(entry) : rank(other) < rank(entry)
	);
	if (at === -1) waiting.push(entry);
	else waiting.splice(at, 0, entry);
}

function display(entry) {
	current = entry;
	if (entry.spec.once) setPref(entry.spec.once, true);
	if (!entry.panel) build(entry);
	container().append(entry.panel);
}

function container() {
	let notices = document.querySelector('#anyink-pwa-notices');
	if (!notices) {
		notices = document.createElement('aside');
		notices.id = 'anyink-pwa-notices';
		document.body.append(notices);
	}
	// B1 fix pass: one line in the top bar, beside the save status (notice_place.js)
	watchNoticePlace(notices);
	return notices;
}

function build(entry) {
	const { spec } = entry;
	const panel = document.createElement('section');
	panel.className = 'anyink-pwa-notice';
	panel.setAttribute('aria-label', 'ANY-INK app');
	const text = document.createElement('p');
	text.setAttribute('role', 'status');
	text.textContent = spec.message;
	text.title = spec.message; // the whole sentence, when one line shortens it
	panel.append(text);
	if (spec.action) {
		const button = document.createElement('button');
		button.textContent = spec.actionLabel;
		button.onclick = async () => {
			button.disabled = true;
			try {
				// Read at click time: a repeat request may have brought a newer action.
				await entry.spec.action();
				closeNotice(spec.key);
			} catch (error) {
				text.textContent = error.message;
			} finally {
				button.disabled = false;
			}
		};
		panel.append(button);
	}
	const dismiss = document.createElement('button');
	dismiss.textContent = spec.dismissLabel || (spec.action ? 'Later' : 'OK');
	dismiss.onclick = () => {
		entry.spec.onDismiss?.();
		closeNotice(spec.key);
	};
	panel.append(dismiss);
	entry.panel = panel;
}
