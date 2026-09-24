// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { it, expect, vi } from 'vitest';
import { ProjectEditor } from '../src/project_editor/project_editor.js';
import { GlyphrStudioProject } from '../src/project_data/glyphr_studio_project.js';
import { setCurrentProjectEditor } from '../src/app/main.js';
import * as recovery from '../src/anyink/recovery/recovery.js';
import { recEntries, setStorageDriver } from '../src/anyink/storage/kv.js';
import { fakeDriver } from '../src/anyink/storage/tests/fake_driver.js';
import { rememberFileVersion } from '../src/anyink/files/save_queue.js';
import { getSaveStatus } from '../src/anyink/files/save_status.js';

it.each(['granted', 'denied'])(
	'continuous edits are protected within three seconds with %s file permission',
	async (permission) => {
		vi.useFakeTimers();
		const resetStorage = setStorageDriver(fakeDriver());
		const editor = new ProjectEditor({
			project: new GlyphrStudioProject({
				settings: { project: { id: `critic-${permission}`, name: 'Disposable critic fixture' } },
				glyphs: {
					'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600 },
					'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 600 },
				},
			}),
		});
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.editCanvas = { redraw() {} };
		let diskText = '{}';
		let version = 1;
		const createWritable = vi.fn(async () => {
			let staged;
			return {
				write: async (text) => {
					staged = text;
				},
				close: async () => {
					diskText = staged;
					version++;
				},
			};
		});
		editor.loadedFileHandle = {
			kind: 'file',
			name: 'critic.gs2',
			queryPermission: async () => permission,
			createWritable,
			getFile: async () => ({ lastModified: version, size: diskText.length }),
		};
		const resetDeps = recovery.setRecoveryDeps({
			getEditor: () => editor,
			getEditors: () => [editor],
			locks: () => undefined,
			toast: () => {},
		});
		try {
			await rememberFileVersion(editor, editor.loadedFileHandle);
			recovery.initRecovery();
			for (let second = 1; second <= 15; second++) {
				editor.project.glyphs['glyph-0x41'].advanceWidth++;
				editor.history.addState('Critic width edit');
				await vi.advanceTimersByTimeAsync(1000);
				if (second % 3 === 0) {
					if (permission === 'granted') {
						expect(JSON.parse(diskText).glyphs['glyph-0x41'].advanceWidth).toBe(600 + second);
						expect(getSaveStatus(editor).file).toBe('saved');
					} else {
						const records = await recEntries();
						expect(records).toHaveLength(1);
						expect(records[0][1].project.glyphs['glyph-0x41'].advanceWidth).toBe(600 + second);
						expect(getSaveStatus(editor)).toMatchObject({ file: 'failed', recovery: 'saved' });
					}
				}
			}
			editor.project.glyphs['glyph-0x41'].advanceWidth = 616;
			editor.history.addState('Edit before glyph switch');
			editor.selectedGlyphID = 'glyph-0x42';
			await vi.advanceTimersByTimeAsync(0);
			if (permission === 'granted') {
				expect(JSON.parse(diskText).glyphs['glyph-0x41'].advanceWidth).toBe(616);
				expect(createWritable).toHaveBeenCalledTimes(6);
			} else {
				expect((await recEntries())[0][1].project.glyphs['glyph-0x41'].advanceWidth).toBe(616);
				expect(createWritable).not.toHaveBeenCalled();
			}
		} finally {
			recovery.stopRecovery();
			await vi.advanceTimersByTimeAsync(0);
			resetDeps();
			resetStorage();
			vi.useRealTimers();
		}
	}
);
