// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK project file reader (Milestone 6, D-012).
	Owner: FILES track.

	Reads a .gs2 / v1 .txt project through a FileSystemFileHandle and runs the
	same checks as upstream's readerValidateTXTandGS2 (formats_io/validate_file_input.js),
	with its error codes, but as a Promise and without that module's shared
	mutable result object or FileReader callbacks. Returns a status instead of
	throwing so callers can tell "file is gone" (drop it from recents) from
	"file is not a project" (show the message).

	  readProjectFile(handle)  -> { status: 'ok', content, fileName }
	                            | { status: 'missing' | 'unreadable' | 'invalid', message, fileName }
	  validateProjectText(text, appVersion) -> { content } | { message }
*/

import { getGlyphrStudioApp } from '../../app/main.js';
import {
	isSemVerLessThan,
	parseSemVer,
	tryToGetProjectVersion,
} from '../../formats_io/validate_file_input.js';

/** Glyphr Studio v1 files older than this cannot be imported (upstream rule) */
const OLDEST_V1 = [1, 13, 2];

/**
 * @param {String} text - file content
 * @param {String} [appVersion] - this build's version, default from the app
 * @returns {{content?: Object, message?: String}}
 */
export function validateProjectText(text, appVersion = getGlyphrStudioApp().version) {
	let projectData;
	try {
		projectData = JSON.parse(text);
	} catch (error) {
		return {
			message: `The file could not be read. Expecting an ANY-INK project file in JSON format. [PF0]<hr>${error.message}`,
		};
	}
	if (!projectData || typeof projectData !== 'object') {
		return { message: 'The file is not an ANY-INK project file. [PF0]' };
	}
	if (!projectData.settings && !projectData.projectsettings) {
		return {
			message:
				'The file is missing project settings. It may not be an ANY-INK project file. [PF1]',
		};
	}
	if (!projectData?.settings?.project?.latestVersion && !projectData?.projectsettings?.versionnum) {
		return {
			message:
				'The file has no version information. It may not be an ANY-INK project file. [PF2]',
		};
	}
	const version = tryToGetProjectVersion(projectData);
	if (!version) {
		return { message: 'The version information could not be read for this project file. [PF3]' };
	}
	if (isSemVerLessThan(parseSemVer(appVersion), version)) {
		return {
			message:
				'This project file was created with a newer version of ANY-INK or Glyphr Studio than this build. Update the app and try again. [PF4]',
		};
	}
	if (isSemVerLessThan(version, OLDEST_V1)) {
		return {
			message:
				'Only Glyphr Studio project files with version 1.13.2 and above can be imported into ANY-INK. Open and re-save the file with the Glyphr Studio v1 app first. [PF5]',
		};
	}
	return { content: projectData };
}

/**
 * Reads a File as text. jsdom's File has no text(), so FileReader is the fallback.
 * @param {File | Blob} file
 * @returns {Promise<String>}
 */
export function readFileText(file) {
	if (typeof file.text === 'function') return file.text();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
		reader.onload = () => resolve(String(reader.result));
		reader.readAsText(file);
	});
}

/**
 * @param {FileSystemFileHandle} handle - permission must already be granted
 * @returns {Promise<{status: String, content?: Object, message?: String, fileName: String}>}
 */
export async function readProjectFile(handle) {
	const fileName = handle?.name || '';
	if (!handle || typeof handle.getFile !== 'function') {
		return { status: 'unreadable', message: 'Not a file handle.', fileName };
	}
	let text;
	try {
		const file = await handle.getFile();
		text = await readFileText(file);
	} catch (error) {
		const missing = error?.name === 'NotFoundError';
		return {
			status: missing ? 'missing' : 'unreadable',
			message: missing
				? `${fileName} is no longer where it was.`
				: `${fileName} could not be read.<hr>${error?.message || error}`,
			fileName,
		};
	}
	const result = validateProjectText(text);
	if (result.message) return { status: 'invalid', message: result.message, fileName };
	return { status: 'ok', content: result.content, fileName };
}
