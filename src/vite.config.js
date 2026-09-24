// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('./anyink/theme/tokens.css', import.meta.url), 'utf8');
const background = tokens.match(/--chrome-bg:\s*([^;]+);/)[1];

export default defineConfig(({ command }) => ({
	base: command === 'serve' ? '/' : '/AnyInk/',
	preview: { host: '127.0.0.1', port: 4173, strictPort: true },
	plugins: [
		{
			name: 'anyink-pwa-entry',
			apply: 'build',
			enforce: 'pre',
			transform(code, id) {
				if (id.endsWith('/app/app_config.json')) {
					return JSON.stringify({ ...JSON.parse(code), devMode: false });
				}
			},
			transformIndexHtml: {
				order: 'pre',
				handler: (html) => ({
					html: html.replace(/<link\s+rel="manifest"[^>]*>/g, ''),
					tags: [
						{
							tag: 'script',
							attrs: { type: 'module', src: '/anyink/pwa/register.js' },
							injectTo: 'body',
						},
						{ tag: 'meta', attrs: { name: 'theme-color', content: background }, injectTo: 'head' },
					],
				}),
			},
		},
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'anyink/pwa',
			filename: 'sw.js',
			registerType: 'prompt',
			injectRegister: false,
			manifest: {
				id: './',
				name: 'ANY-INK',
				short_name: 'ANY-INK',
				description: 'A personal visual font editor.',
				start_url: './',
				scope: './',
				display: 'standalone',
				theme_color: background,
				background_color: background,
				icons: [
					...[192, 512].map((size) => ({
						src: `icons/icon-${size}.png`,
						sizes: `${size}x${size}`,
						type: 'image/png',
						purpose: 'any',
					})),
					{
						src: 'icons/maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			injectManifest: {
				globPatterns: [
					'**/*.{html,js,css,png,svg,ico,woff,woff2,ttf,otf,wasm,json,txt,gs2,webmanifest}',
				],
				maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
			},
			devOptions: { enabled: false },
		}),
	],
	build: {
		outDir: '../dist/',
		manifest: false,
		emptyOutDir: true,
		chunkSizeWarningLimit: 3000,
		rollupOptions: {
			treeshake: true,
		},
	},
}));
