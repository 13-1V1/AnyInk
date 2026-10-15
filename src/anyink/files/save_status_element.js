// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix pass (UX-BEGINNER.md 4.11): the text and tooltip come from saveStatusWords. In
// Simple the tooltip says what to press, data-status names the state (saved / saving /
// not-saved / failed), and only a failed write turns it red: a backup copy that failed is said
// by its own toast (7.7), never by the status. All tools is as before.
import { getCurrentProjectEditor } from '../../app/main.js';
import { isSimpleMode } from '../mode/mode.js';
import { getSaveStatus, SAVE_STATUS_EVENT, saveStatusWords } from './save_status.js';
import { isProjectFileHandle } from './write_file.js';
import './save_status.css';

export class SaveStatusElement extends HTMLElement {
	connectedCallback() {
		this.setAttribute('role', 'status');
		this.setAttribute('aria-live', 'polite');
		this.update = () => {
			const editor = getCurrentProjectEditor();
			const state = getSaveStatus(editor);
			const simple = isSimpleMode();
			const words = saveStatusWords(state, {
				simple,
				workFile: isProjectFileHandle(editor?.loadedFileHandle),
			});
			if (this.textContent !== words.text) this.textContent = words.text;
			this.title = words.hint;
			if (words.status) this.dataset.status = words.status;
			else delete this.dataset.status;
			const backupFailed = !simple && state.recovery === 'failed';
			this.dataset.failed = String(state.file === 'failed' || backupFailed);
		};
		window.addEventListener(SAVE_STATUS_EVENT, this.update);
		this.update();
	}
	disconnectedCallback() {
		window.removeEventListener(SAVE_STATUS_EVENT, this.update);
	}
}
