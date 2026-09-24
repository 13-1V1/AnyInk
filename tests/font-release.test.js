// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { FontFlux } from 'font-flux-js';
import { setCurrentProjectEditor } from '../src/app/main.js';
import { ioFont_exportFont } from '../src/formats_io/otf/font_export.js';
import { GlyphrStudioProject } from '../src/project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../src/project_editor/project_editor.js';
import { Glyph } from '../src/project_data/glyph.js';
import { KernGroup } from '../src/project_data/kern_group.js';
import sample from '../src/samples/simpleExampleProject.json';
import { potraceSvgToShapes } from '../src/anyink/autotrace/svg_to_shapes.js';

it.skipIf(process.platform !== 'win32')(
	'exports a real CFF OTF and verifies it in Windows GDI',
	async () => {
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
		const directory = mkdtempSync(join(tmpdir(), 'anyink-font-release-'));
		console.log(`Font release artifacts: ${directory}`);
		const family = `AnyInk-${randomUUID().slice(0, 8)}`;
		const project = new GlyphrStudioProject(structuredClone(sample));
		project.settings.font.family = family;
		project.settings.app.exportKerning = true;
		project.settings.app.exportLigatures = false;
		project.glyphs = {};
		project.components = {};
		project.kerning = {};
		const editor = new ProjectEditor({ project });
		setCurrentProjectEditor(editor);
		const probes = [];
		// Samples are well inside ink/paper, away from antialiased boundaries.
		const fixtures = [
			[
				'A',
				'letter_o',
				2,
				[
					[100, 100, false],
					[35, 100, true],
					[100, 165, true],
					[5, 5, false],
				],
			],
			[
				'B',
				'bullseye',
				3,
				[
					[60, 60, true],
					[87, 60, false],
					[102, 60, true],
					[116, 60, false],
				],
			],
			['C', 'letter_a', 2, [[135, 150, false]]],
			[
				'D',
				'square_hole',
				2,
				[
					[32, 32, false],
					[12, 32, true],
				],
			],
			[
				'E',
				'letter_i',
				2,
				[
					[80, 80, true],
					[80, 110, false],
					[80, 180, true],
				],
			],
		];
		for (const [character, fixture, contours, points] of fixtures) {
			const svg = readFileSync(
				resolve(`src/anyink/autotrace/tests/fixtures/${fixture}.svg`),
				'utf8'
			);
			const height = Number(svg.match(/height="([\d.]+)"/)[1]);
			const scale = 1000 / height;
			const id = `glyph-0x${character.charCodeAt(0).toString(16).toUpperCase()}`;
			project.glyphs[id] = new Glyph({
				id,
				parent: project,
				advanceWidth: 1000,
				shapes: potraceSvgToShapes(svg, { x: 0, y: 800, scale }).map((p) => p.save()),
			});
			probes.push({
				character,
				contours,
				width: 1000,
				points: points.map(([x, y, ink]) => ({ x: x * scale, y: 800 - y * scale, ink })),
			});
		}
		// F uses a translated component instance: OTF must flatten it and retain its hole.
		project.components['comp-ring'] = new Glyph({
			id: 'comp-ring',
			parent: project,
			shapes: project.glyphs['glyph-0x41'].shapes.map((p) => p.save()),
		});
		project.glyphs['glyph-0x46'] = new Glyph({
			id: 'glyph-0x46',
			parent: project,
			advanceWidth: 1000,
			shapes: [
				{ objType: 'ComponentInstance', link: 'comp-ring', translateX: 50, translateY: -25 },
			],
		});
		probes.push({
			character: 'F',
			contours: 2,
			width: 1000,
			points: [
				{ x: 550, y: 275, ink: false },
				{ x: 225, y: 275, ink: true },
			],
		});
		project.glyphs['glyph-0x20'] = new Glyph({
			id: 'glyph-0x20',
			parent: project,
			advanceWidth: 250,
		});
		project.kerning['kern-release'] = new KernGroup({
			leftGroup: ['0x41'],
			rightGroup: ['0x42'],
			value: -100,
		});
		const buffer = Buffer.from(await ioFont_exportFont('otf', true));
		expect(buffer.subarray(0, 4).toString()).toBe('OTTO');
		const tables = Array.from({ length: buffer.readUInt16BE(4) }, (_, i) =>
			buffer.toString('ascii', 12 + i * 16, 16 + i * 16)
		);
		expect(tables).toContain('CFF ');
		expect(tables).toContain('GPOS');
		const parsed = FontFlux.open(
			buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
		);
		for (const probe of probes) {
			const glyph = parsed.glyphs.find((g) => g.unicode === probe.character.charCodeAt(0));
			expect(glyph.contours.length, probe.character).toBe(probe.contours);
			expect(glyph.advanceWidth).toBe(probe.width);
		}
		const a = parsed.glyphs.find((g) => g.unicode === 65).name;
		const b = parsed.glyphs.find((g) => g.unicode === 66).name;
		expect(parsed.kerning, 'exported kerning pairs').toContainEqual({
			left: a,
			right: b,
			value: -100,
		});
		const fontPath = join(directory, 'representative.otf');
		writeFileSync(fontPath, buffer);
		const manifest = {
			family,
			probes,
			fontPath,
			sha256: createHash('sha256').update(buffer).digest('hex'),
			fontFluxVersion: JSON.parse(readFileSync('node_modules/font-flux-js/package.json', 'utf8'))
				.version,
			tables,
		};
		const manifestPath = join(directory, 'manifest.json');
		writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
		const native = spawnSync(
			'powershell.exe',
			[
				'-NoProfile',
				'-NonInteractive',
				'-File',
				resolve('tests/font-release-native.ps1'),
				'-Manifest',
				manifestPath,
			],
			{ encoding: 'utf8', timeout: 60000, windowsHide: true }
		);
		writeFileSync(
			join(directory, 'native-output.txt'),
			`${native.stdout || ''}\n${native.stderr || ''}`
		);
		expect(native.error, native.error?.message).toBeUndefined();
		expect(native.status, `${native.stdout}\n${native.stderr}`).toBe(0);
		const report = JSON.parse(
			readFileSync(join(directory, 'native-results.json'), 'utf8').replace(/^\uFEFF/, '')
		);
		expect(report.removed).toBe(true);
		expect(report.glyphs).toHaveLength(6);
		console.log(JSON.stringify(report));
	},
	90000
);
