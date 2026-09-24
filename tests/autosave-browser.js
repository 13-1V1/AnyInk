// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { ProjectEditor } from '../src/project_editor/project_editor.js';
import { GlyphrStudioProject } from '../src/project_data/glyphr_studio_project.js';
import { setCurrentProjectEditor } from '../src/app/main.js';
import { rememberFileVersion } from '../src/anyink/files/save_queue.js';
import { getSaveStatus, saveStatusText } from '../src/anyink/files/save_status.js';
import { autosaveNow } from '../src/anyink/files/autosave.js';
import * as recovery from '../src/anyink/recovery/recovery.js';
import { recEntries } from '../src/anyink/storage/kv.js';

const result = document.querySelector('#result');
const say = (text) => {
	result.textContent += `\n${text}`;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(predicate, timeout = 5000) {
	const deadline = performance.now() + timeout;
	do {
		if (await predicate()) return true;
		await delay(25);
	} while (performance.now() < deadline);
	return false;
}
let editor;
function createEditor(id) {
	recovery.stopRecovery();
	editor = new ProjectEditor({
		project: new GlyphrStudioProject({
			settings: { project: { id, name: 'Autosave disposable test' } },
			glyphs: {
				'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600 },
				'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 600 },
			},
		}),
	});
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.editCanvas = { redraw() {} };
	recovery.setRecoveryDeps({
		getEditor: () => editor,
		getEditors: () => [editor],
		toast: say,
		importProject: (data) => {
			editor.project = new GlyphrStudioProject(data);
		},
	});
	recovery.initRecovery();
	return editor;
}
function edit() {
	editor.project.glyphs['glyph-0x41'].advanceWidth++;
	editor.history.addState('Native autosave width');
}
const width = async (handle) =>
	JSON.parse(await (await handle.getFile()).text()).glyphs['glyph-0x41'].advanceWidth;
function check(ok, message) {
	if (!ok) throw new Error(message);
	say(`PASS ${message}`);
}

document.querySelector('#run').onclick = async () => {
	result.textContent = 'Running…';
	try {
		const root = await navigator.storage.getDirectory();
		const id = `critic-native-${crypto.randomUUID()}`;
		createEditor(id);
		const handle = await root.getFileHandle(`${id}.gs2`, { create: true });
		const stream = await handle.createWritable();
		await stream.write(await editor.makeProjectFileText());
		await stream.close();
		editor.loadedFileHandle = handle;
		await rememberFileVersion(editor, handle);
		const start = performance.now();
		for (let n = 0; n < 4; n++) {
			edit();
			await delay(800);
		}
		await delay(400);
		check(
			(await width(handle)) >= 603,
			`continuous edits reached real file within ${Math.round(performance.now() - start)} ms`
		);
		edit();
		editor.selectedGlyphID = 'glyph-0x42';
		check(await eventually(async () => (await width(handle)) === 605), 'glyph switch wrote width 605 to real file');
		const outside = await handle.createWritable();
		await outside.write('external change');
		await outside.close();
		edit();
		await autosaveNow(editor);
		check(
			(await (await handle.getFile()).text()) === 'external change',
			'external change preserved'
		);
		check(getSaveStatus(editor).file === 'failed', 'file conflict has visible failed status');
		say(saveStatusText(getSaveStatus(editor)));
		// Recovery-only project avoids carrying a deliberately conflicted file into restore.
		createEditor(`${id}-recovery`);
		localStorage.setItem('critic-native-recovery', editor.project.settings.project.id);
		for (let n = 0; n < 4; n++) {
			edit();
			await delay(800);
		}
		const records = (await recEntries()).filter(
			([, r]) => r.id === editor.project.settings.project.id
		);
		check(
			records.length === 1 && records[0][1].project.glyphs['glyph-0x41'].advanceWidth >= 603,
			'continuous editing reached actual IndexedDB within the first 3 seconds'
		);
		await recovery.snapshotNow();
		say('READY FOR RELOAD: restore should recover width 604 and four history entries.');
	} catch (error) {
		say(`FAIL ${error.stack || error}`);
	}
};
document.querySelector('#recover').onclick = async () => {
	try {
		const id = localStorage.getItem('critic-native-recovery');
		createEditor(`critic-restoring-${crypto.randomUUID()}`);
		const sessions = await recovery.listRecoverableSessions();
		const record = sessions.find((s) => s.projectId === id);
		check(!!record, 'previous test session is recoverable after reload');
		await recovery.restoreSession(record.id);
		check(editor.project.glyphs['glyph-0x41'].advanceWidth === 604, 'restored width 604');
		check(editor.history.queue.length === 4, 'restored four undo entries');
	} catch (error) {
		say(`FAIL ${error.stack || error}`);
	}
};
