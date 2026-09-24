// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Fakes for the files-track tests: stand-ins for FileSystemFileHandle,
	FileSystemDirectoryHandle, the picker API (file_api.js seam) and a ProjectEditor.
	jsdom has none of the real ones.
*/

/** Fake disk clock: every file write gets a later lastModified, like a real disk. */
let fakeClock = 1_760_000_000_000;

/**
 * @param {String} name - file name
 * @param {Object} options
 * @param {String} [options.id] - identity for isSameEntry (default: the name). Files a
 *   fakeDirectoryHandle creates get '<folder>/<file>', so same-named files in two
 *   folders are different entries, as on a real disk.
 * @param {String | Function} [options.query] - queryPermission result. A string is
 *   sticky like the browser's: after requestPermission answers 'granted' or 'denied',
 *   later queries return that answer.
 * @param {String} [options.request] - requestPermission result
 * @param {String} [options.text] - what getFile() returns as content until something
 *   is written (then getFile() returns the written data, like a real file)
 * @param {*} [options.initial] - content already in the file (what `written` starts as)
 * @param {Number} [options.lastModified] - the file's modification time (default: the
 *   fake clock's next tick); every close() and externalWrite() moves it forward
 * @param {Boolean} [options.missing] - getFile() throws NotFoundError
 * @param {Boolean} [options.rejectExclusive] - createWritable({mode:'exclusive'}) throws TypeError
 * @param {Error} [options.createError] - createWritable() throws this (a moved file: NotFoundError)
 * @param {Error} [options.writeError] - write() throws this
 */
export function fakeFileHandle(
	name,
	{
		id = name,
		query = 'granted',
		request = 'granted',
		text = '',
		initial = undefined,
		lastModified = undefined,
		missing = false,
		rejectExclusive = false,
		createError = null,
		writeError = null,
	} = {}
) {
	let permission = query;
	const handle = {
		kind: 'file',
		name,
		id,
		calls: { query: 0, request: 0, createWritable: 0, getFile: 0, abort: 0 },
		/** createWritable options, one entry per call */
		options: [],
		/** the last data written and closed (or options.initial) */
		written: initial,
		/** lastModified of what getFile() returns */
		modified: lastModified ?? ++fakeClock,
		/**
		 * Another program rewrites the file (a font tool, a restore from backup).
		 * @param {*} data - the new content
		 */
		externalWrite(data) {
			handle.written = data;
			handle.modified = ++fakeClock;
		},
		async isSameEntry(other) {
			return other?.kind === 'file' && (other?.id ?? other?.name) === id;
		},
		async queryPermission() {
			handle.calls.query++;
			return typeof permission === 'function' ? permission() : permission;
		},
		async requestPermission() {
			handle.calls.request++;
			if (typeof permission === 'string' && (request === 'granted' || request === 'denied')) {
				permission = request;
			}
			return request;
		},
		async getFile() {
			handle.calls.getFile++;
			if (missing) throw namedError('NotFoundError', `${name} not found`);
			const content = handle.written === undefined ? text : handle.written;
			const parts = Array.isArray(content) ? content : [content];
			return new File(parts, name, { type: 'application/json', lastModified: handle.modified });
		},
		async createWritable(options) {
			handle.calls.createWritable++;
			handle.options.push(options);
			if (createError) throw createError;
			if (rejectExclusive && options?.mode === 'exclusive') {
				throw new TypeError("Failed to read the 'mode' property from 'FileSystemCreateWritableOptions'");
			}
			const chunks = [];
			return {
				async write(data) {
					if (writeError) throw writeError;
					chunks.push(data);
				},
				async close() {
					handle.written = chunks.length === 1 ? chunks[0] : chunks;
					handle.modified = ++fakeClock;
				},
				async abort() {
					handle.calls.abort++;
				},
			};
		},
	};
	return handle;
}

/**
 * @param {String} name
 * @param {Object} options
 * @param {String} [options.query] - queryPermission result (sticky, as for files)
 * @param {String} [options.request] - requestPermission result
 * @param {Error} [options.getFileError] - getFileHandle() throws this
 * @param {Object} [options.fileOptions] - fakeFileHandle options for files this folder
 *   creates (e.g. { writeError } for a disk that fills up mid-write)
 * @param {Error} [options.removeError] - removeEntry() throws this
 */
export function fakeDirectoryHandle(
	name,
	{
		query = 'granted',
		request = 'granted',
		getFileError = null,
		fileOptions = {},
		removeError = null,
	} = {}
) {
	let permission = query;
	const dir = {
		kind: 'directory',
		name,
		/** @type {Map<String, Object>} file name -> fakeFileHandle */
		files: new Map(),
		calls: { query: 0, request: 0, getFileHandle: 0, removeEntry: 0 },
		/** [fileName, options] per getFileHandle call */
		getFileHandleArgs: [],
		/** Puts a file in the folder, as if something else had written it. */
		addFile(fileName, options = {}) {
			const file = fakeFileHandle(fileName, { id: `${name}/${fileName}`, ...options });
			dir.files.set(fileName, file);
			return file;
		},
		async isSameEntry(other) {
			return other?.kind === 'directory' && other?.name === name;
		},
		async queryPermission() {
			dir.calls.query++;
			return permission;
		},
		async requestPermission() {
			dir.calls.request++;
			if (request === 'granted' || request === 'denied') permission = request;
			return request;
		},
		async getFileHandle(fileName, options = {}) {
			dir.calls.getFileHandle++;
			dir.getFileHandleArgs.push([fileName, options]);
			if (getFileError) throw getFileError;
			if (!dir.files.has(fileName)) {
				if (!options.create) throw namedError('NotFoundError', `${fileName} not found`);
				dir.addFile(fileName, fileOptions);
			}
			return dir.files.get(fileName);
		},
		async removeEntry(fileName) {
			dir.calls.removeEntry++;
			if (removeError) throw removeError;
			if (!dir.files.has(fileName)) throw namedError('NotFoundError', `${fileName} not found`);
			dir.files.delete(fileName);
		},
	};
	return dir;
}

/**
 * @param {String} name - DOMException name, e.g. 'NotFoundError'
 * @param {String} [message]
 * @returns {Error} an Error whose name matches what Chromium throws
 */
export function namedError(name, message = name) {
	const error = new Error(message);
	error.name = name;
	return error;
}

/** What a picker throws when the click's transient activation has run out. */
export function securityError() {
	return namedError('SecurityError', 'Must be handling a user gesture to show a file picker.');
}

/** The error a real picker throws when the user closes it. */
export function abortError() {
	return namedError('AbortError', 'The user aborted a request.');
}

/**
 * Builds an object for setFileApi(). A picker exists when its key is present:
 * its function records the options on api.calls.<picker> and returns the given
 * value (a function is called with the options; an Error is thrown; undefined
 * means "exists but must not be called"). A missing key = the browser lacks it.
 * @param {Object} [results] - { open, save, directory } results, { download } spy
 */
export function fakeApi(results = {}) {
	const api = { calls: { open: [], save: [], directory: [], download: [] } };
	const make = (key, name) => {
		if (!(name in results)) return undefined;
		const result = results[name];
		return async (options) => {
			api.calls[key].push(options);
			if (result === undefined) throw new Error(`${name} picker was not expected to open`);
			const value = typeof result === 'function' ? result(options) : result;
			if (value instanceof Error) throw value;
			return value;
		};
	};
	api.showOpenFilePicker = make('open', 'open');
	api.showSaveFilePicker = make('save', 'save');
	api.showDirectoryPicker = make('directory', 'directory');
	api.download =
		results.download === undefined
			? (blob, fileName) => {
					api.calls.download.push({ blob, fileName });
				}
			: results.download;
	return api;
}

/**
 * A minimal editor: enough for project_files.js and recents_ui.js.
 * @param {String} name - project name
 * @param {String} [text] - what makeProjectFileText resolves
 */
export function fakeEditor(name = 'Fake Font', text = '{"fake":true}') {
	const editor = {
		project: { settings: { project: { name } }, resetSessionStateForAllItems() {} },
		loadedFileHandle: false,
		published: [],
		savedCalls: 0,
		async makeProjectFileText() {
			return text;
		},
		setProjectAsSaved() {
			editor.savedCalls++;
		},
		publish(topic, data) {
			editor.published.push({ topic, data });
		},
	};
	return editor;
}

/** Text of the smallest project file the reader accepts. */
export function minimalProjectText(name = 'Opened Font', version = '2.10.5') {
	return JSON.stringify({ settings: { project: { name, latestVersion: version } } });
}

/** Removes the toast / error / context menu / modal elements a test left behind. */
export function clearDialogs() {
	document
		.querySelectorAll('#toast, #error, #context-menu, #modal-dialog')
		.forEach((el) => el.remove());
}

/** @returns {String} the current toast text, or '' */
export function toastText() {
	return document.querySelector('#toast')?.innerHTML || '';
}

/**
 * Waits for the "already exists" export dialog and clicks one of its buttons.
 * @param {'replace' | 'keepBoth' | 'cancel'} choice
 * @param {Number} [ticks] - macrotasks to wait for the dialog
 * @returns {Promise<String>} the dialog's text, for assertions
 */
export async function answerExistingFileDialog(choice, ticks = 50) {
	for (let i = 0; i < ticks; i++) {
		const button = document.querySelector(`#modal-dialog [data-anyink-choice="${choice}"]`);
		if (button) {
			const text = document.querySelector('#modal-dialog').textContent;
			button.click();
			return text;
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error('the existing-file dialog never opened');
}

/**
 * Stands in for navigator.userActivation. The click's activation is live until
 * expire() (or the first timer after expireOnFirstTimer()), like Chromium's
 * transient activation running out during a long export.
 * @returns {{ expire: Function, expireOnFirstTimer: Function, restore: Function, active: Boolean }}
 */
export function fakeUserActivation() {
	const nav = globalThis.navigator;
	const had = Object.prototype.hasOwnProperty.call(nav, 'userActivation');
	const before = nav.userActivation;
	let active = true;
	Object.defineProperty(nav, 'userActivation', {
		configurable: true,
		value: {
			get isActive() {
				return active;
			},
			get hasBeenActive() {
				return true;
			},
		},
	});
	return {
		get active() {
			return active;
		},
		expire() {
			active = false;
		},
		expireOnFirstTimer() {
			setTimeout(() => (active = false), 0);
		},
		restore() {
			if (had) Object.defineProperty(nav, 'userActivation', { configurable: true, value: before });
			else delete nav.userActivation;
		},
	};
}
