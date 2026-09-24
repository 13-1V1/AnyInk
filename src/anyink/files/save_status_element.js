// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getCurrentProjectEditor } from '../../app/main.js';
import { getSaveStatus, SAVE_STATUS_EVENT, saveStatusText } from './save_status.js';
import './save_status.css';

export class SaveStatusElement extends HTMLElement {
	connectedCallback() {
		this.setAttribute('role', 'status');
		this.setAttribute('aria-live', 'polite');
		this.update = () => {
			const state = getSaveStatus(getCurrentProjectEditor());
			const text = saveStatusText(state);
			if (this.textContent !== text) this.textContent = text;
			this.title = this.textContent;
			this.dataset.failed = String(state.file === 'failed' || state.recovery === 'failed');
		};
		window.addEventListener(SAVE_STATUS_EVENT, this.update);
		this.update();
	}
	disconnectedCallback() {
		window.removeEventListener(SAVE_STATUS_EVENT, this.update);
	}
}
