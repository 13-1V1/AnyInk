// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Dev-only Vite config for the minimal test pages in tests/.
// Root is the repo, so pages live at /tests/<name>.html and import ../src/... directly.
// The production build uses src/vite.config.js (root = src/), so tests/ can never ship.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	root: fileURLToPath(new URL('..', import.meta.url)),
	server: { port: 5174, strictPort: true, open: '/tests/' },
});
