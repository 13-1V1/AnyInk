// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getGlyphrStudioApp } from '../../app/main.js';
import { getRecoveryStatus, snapshotNow } from '../recovery/recovery.js';
import { peekProject } from '../recovery/snapshot.js';
import { isPersistent } from '../storage/kv.js';
import { checkpoint, makeSafeReload } from './checkpoint.js';
import './pwa.css';

function notice(message, label, action) {
	const panel = document.createElement('section');
	panel.className = 'anyink-pwa-notice';
	panel.setAttribute('aria-label', 'ANY-INK app');
	const text = document.createElement('p');
	text.setAttribute('role', 'status');
	text.textContent = message;
	panel.append(text);
	if (action) {
		const button = document.createElement('button');
		button.textContent = label;
		button.onclick = async () => {
			button.disabled = true;
			try {
				await action();
				panel.remove();
			} catch (error) {
				text.textContent = error.message;
			} finally {
				button.disabled = false;
			}
		};
		panel.append(button);
	}
	const later = document.createElement('button');
	later.textContent = action ? 'Later' : 'OK';
	later.onclick = () => panel.remove();
	panel.append(later);
	let notices = document.querySelector('#anyink-pwa-notices');
	if (!notices) {
		notices = document.createElement('aside');
		notices.id = 'anyink-pwa-notices';
		document.body.append(notices);
	}
	notices.append(panel);
	return panel;
}

export function activateWaiting(worker) {
	if (!worker || worker.state === 'activated') return Promise.resolve();
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const finish = (error) => {
			clearTimeout(timeout);
			worker.removeEventListener('statechange', changed);
			channel.port1.close();
			if (error) reject(error);
			else resolve();
		};
		const changed = () => {
			if (worker.state === 'activated') finish();
			else if (worker.state === 'redundant')
				finish(new Error('The update was replaced. Check again.'));
		};
		const timeout = setTimeout(
			() => finish(new Error('The update timed out. Your work is still open; try again.')),
			15000
		);
		channel.port1.onmessage = ({ data }) => {
			if (data.error) finish(new Error(data.error));
		};
		worker.addEventListener('statechange', changed);
		worker.postMessage({ type: 'ANYINK_ACTIVATE' }, [channel.port2]);
	});
}

async function start() {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
	let updatePanel;
	const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
		scope: import.meta.env.BASE_URL,
		updateViaCache: 'none',
	});
	const update = makeSafeReload({
		protect: () => {
			if (!isPersistent())
				throw new Error(
					'Persistent recovery is unavailable. Save your work before closing the app.'
				);
			return checkpoint({
				getEditors: () =>
					getGlyphrStudioApp().projectEditors.filter((editor) => peekProject(editor)),
				getStatus: getRecoveryStatus,
				snapshot: snapshotNow,
			});
		},
		activate: () => activateWaiting(registration.waiting),
		reload: () => location.reload(),
	});
	const offerUpdate = () => {
		if (updatePanel?.isConnected) return;
		updatePanel = notice(
			'Update ready. Reload after protecting open projects in recovery.',
			'Update and reload',
			async () => {
				const busy = document.createElement('dialog');
				busy.className = 'anyink-pwa-busy';
				busy.textContent = 'Protecting your work and preparing the update…';
				busy.addEventListener('cancel', (event) => event.preventDefault());
				// The upstream editor has document keyboard shortcuts even with a dialog open.
				const block = (event) => {
					event.stopImmediatePropagation();
					event.preventDefault();
				};
				document.body.append(busy);
				busy.showModal();
				window.addEventListener('keydown', block, true);
				window.addEventListener('keyup', block, true);
				try {
					await update();
				} finally {
					window.removeEventListener('keydown', block, true);
					window.removeEventListener('keyup', block, true);
					busy.close();
					busy.remove();
				}
			}
		);
	};
	if (registration.waiting) offerUpdate();
	const observe = (worker) =>
		worker?.addEventListener('statechange', () => {
			if (worker.state === 'installed') {
				if (registration.active) offerUpdate();
				else notice('ANY-INK is ready to open offline.');
			}
		});
	observe(registration.installing);
	registration.addEventListener('updatefound', () => observe(registration.installing));
	// An external activation can only offer a prompt. It never reloads this page.
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (registration.active) offerUpdate();
	});
	window.addEventListener('focus', () => {
		if (registration.waiting) offerUpdate();
		if (navigator.onLine) registration.update().catch(() => {});
	});
}

let installPanel;
window.addEventListener('beforeinstallprompt', (event) => {
	event.preventDefault();
	installPanel?.remove();
	installPanel = notice(
		'Install ANY-INK to open it from your desktop.',
		'Install ANY-INK',
		async () => {
			await event.prompt();
			await event.userChoice;
		}
	);
});
window.addEventListener('appinstalled', () => installPanel?.remove());

const boot = () =>
	start().catch(() =>
		notice(
			'Offline setup could not finish. Connect to the internet and reopen ANY-INK to try again.'
		)
	);
if (document.readyState === 'loading')
	document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
