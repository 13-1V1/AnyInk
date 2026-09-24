// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { saveProjectText } from '../anyink/files/project_files.js';
import { getCurrentProject, getCurrentProjectEditor } from '../app/main.js';

/**
 * Saves a text file. Project files ('gs2') go through ANY-INK's file module
 * (src/anyink/files/project_files.js, D-012): in place through the open file
 * handle, Save As through the picker, or a download when the File System
 * Access API is missing. Every other suffix ('svg') downloads as before.
 * @param {String} fileSuffix - 'gs2' or 'svg'
 * @param {String} fileContent - Text content of the file
 * @param {Boolean} saveAsCopy - 'gs2' only: pick a new file instead of writing in place
 */
export async function saveTextFile(fileSuffix, fileContent, saveAsCopy = false) {
	// log(`saveTextFile`, 'start');
	if (fileSuffix === 'gs2') {
		await saveProjectText(getCurrentProjectEditor(), fileContent, saveAsCopy);
	} else {
		saveTextFileAsDownload(fileSuffix, fileContent);
	}
	// log(`saveTextFile`, 'end');
}

/**
 * Saves a file as a browser download
 * @param {String} fileSuffix - name for the saved file
 * @param {String} fileContent - data for the file
 */
function saveTextFileAsDownload(fileSuffix, fileContent) {
	const fileType = 'text/plain;charset=utf-8';
	const fileBlob = new Blob([fileContent], { type: fileType, endings: 'native' });
	let fileName = makeFileName(fileSuffix, true);
	saveFile(fileBlob, fileName);
}

/**
 * Generic file saving to downloads folder
 * @param {Object} fileBlob - file content
 * @param {String} fileName - name of the file
 */
export function saveFile(fileBlob, fileName) {
	try {
		// IE
		// @ts-expect-error 'property does exist'
		window.navigator.msSaveBlob(fileBlob, fileName);
	} catch {
		// Others
		const link = document.createElement('a');
		window.URL = window.URL || window.webkitURL;
		link.href = window.URL.createObjectURL(fileBlob);
		link.download = fileName;

		const event = new MouseEvent('click', {
			view: window,
			bubbles: true,
			cancelable: true,
		});
		link.dispatchEvent(event);
	}
}

// --------------------------------------------------------------
// Naming helpers
// --------------------------------------------------------------

/**
 * Creates a file name based on the project name, the type of file,
 * and the type of download
 * @param {String} suffix - 'gs2' or 'svg'
 * @param {Boolean} includeDateString - add a unique date stamp to the file name
 * @returns {String} - appropriate file name
 */
export function makeFileName(suffix, includeDateString = false) {
	const project = getCurrentProject();
	let fileName = project.settings.project.name;

	if (suffix === 'gs2') {
		if (includeDateString) fileName += ` - ${makeFileDateString()}`;
	} else if (suffix === 'svg') {
		fileName += ` - SVG Font - ${makeFileDateString()}`;
	}

	fileName += `.${suffix}`;

	return fileName;
}

/**
 * Generates a date suffix for file saves
 * @returns {String}
 */
export function makeFileDateString() {
	const d = new Date();
	const yr = d.getFullYear();
	const mo = d.getMonth() + 1;
	const day = d.getDate();
	const hr = d.getHours();
	const min = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
	const sec = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();

	return `${yr}.${mo}.${day}-${hr}.${min}.${sec}`;
}
