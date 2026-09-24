# PWA implementation and release verification

Implemented and checked by Codex on 09/24/2026. No commit or deployment was made.

## Integration and ownership

No edits to `src/index.html`, `src/app/main.js`, or `src/app/menu.js` are required.
`src/vite.config.js` injects this separate module into the build's HTML before bundling:

```html
<script type="module" src="/anyink/pwa/register.js"></script>
```

The same transform removes the legacy `manifest.json` link from the generated HTML.
The PWA plugin inserts the single `/AnyInk/manifest.webmanifest` link, and the transform
inserts the theme-color meta tag. Do not also import the registration module from main
or add a second script to index. Production registration is deliberately absent in dev.
Install and update buttons are independent notices mounted outside the app wrapper.

Changes are confined to PWA/build configuration, package files, `src/anyink/pwa/`,
generated `src/public/icons/`, `tests/pwa*`, and this document. Existing auto-trace and
the coordinator's file/recovery changes were preserved. Project context is recorded here;
the coordinator owns any `/init`/AGENTS milestone update outside this assignment.

## Build and dependencies

- `vite-plugin-pwa` 1.3.0, using `injectManifest` with explicit prompt registration.
- `workbox-precaching` and `workbox-routing` 7.4.1, pinned direct development dependencies.
- `sharp` 0.35.4 generates PNGs from the existing `anyink-icon.svg`, without changing it.
- `@playwright/test` 1.63.0 drives disposable Chrome/Edge verification profiles.
- The existing `esm-potrace-wasm` package and all other pre-existing dependencies are retained.
- Production base is `/AnyInk/`; relative manifest id/start URL/scope resolve to that base.
- `npm run build` now builds without rewriting `app_config.json`. The build transform
  forces its bundled `devMode` to false. Existing version/date metadata is retained.
- The GitHub Pages workflow uses `npm run build` after its existing unit-test gate.
  It has not been dispatched or deployed. Browser verification is an explicit local
  command and is not yet an extra CI gate.

PNG sizes are 48, 72, 96, 144, 180, 192, 256, 384, and 512 pixels; a separate opaque
512-pixel maskable icon insets the existing artwork into the safe zone. The manifest
advertises 192/512 ordinary icons and the maskable icon. Its colors and the maskable
background are read from the existing theme tokens. The maskable output was visually inspected.

The worker precaches the generated app shell, JavaScript, CSS, font, PNG/SVG icons,
trace worker, and Brotli WASM. Samples already bundled by Vite remain in the app bundle.
There is no general network cache, analytics, or caching of user project files.
The per-file cache ceiling is 8 MiB and an oversized asset fails the PWA build.
The verified build contains 24 precache entries, about 4.4 MiB in total.

## Update safety

The worker does not call `skipWaiting()` during installation and does not call
`clients.claim()`. Native worker registration is used instead of the virtual helper's
reload behavior so every `location.reload()` belongs to the explicit button path.
`controllerchange` only offers a notice. A waiting update is offered again on window focus.

On **Update and reload**, a modal blocks editing and document keyboard shortcuts while:

1. Persistent recovery and its initialized state are checked.
2. Every loaded project from `getGlyphrStudioApp().projectEditors` is protected with
   `await snapshotNow('manual', editor)`. Any false result or thrown error blocks reload.
3. Dirty generation, editor/session identity, and undo/redo state are checked.
4. The waiting worker refuses activation if another window under the app's scope is open.
5. After activation completes, the same editor/generation checks run again before reload.

No update operation calls `markClean`, saves over a user file, or changes file-clean state.
Unsaved work remains available through Recover after reload. Already clean projects can
be reopened normally. Recovery failures remain visible in the update notice and permit
retry. A timeout leaves the current page open. **Later** never reloads. Background
installation/activation can happen when all old windows have closed, per browser lifecycle;
it cannot silently reload a live editor. Other windows must be closed before explicitly
activating an update. Opening another window during the final activation remains a browser
lifecycle race; it does not grant permission to reload that window.

## Repeatable checks

```powershell
npm run test:pwa
npm run verify:pwa
npm run verify:pwa-storage
npm run pwa:icons
npm run build
npm run preview
```

`preview` serves the built application at `http://127.0.0.1:4173/AnyInk/` with a strict port.
Both verification scripts start their own servers on free localhost ports and shut down
only their own resources. They never attach to the user's browser, reuse port 5184, install
a Windows app, or stop an existing server. `verify:pwa-storage` uses the coordinator's
`tests/autosave.html`/`autosave-browser.js` fixture through its own Vite test server; HMR
and file watching are disabled for the run. Tests are never included in the production build.

Chrome is the default. To use the installed Edge browser:

```powershell
$env:PWA_BROWSER = 'msedge'
npm run verify:pwa
Remove-Item Env:PWA_BROWSER
```

## Verified evidence

- Ten isolated Vitest cases passed: all editor snapshots awaited, duplicate clicks,
  false/rejected writes and retry, uninitialized recovery, undo/redo, edits/replacements/
  session changes during snapshots, edits during activation, and activation failure.
- ESLint passed for PWA modules and Vite configuration. Production build passed.
- Chrome and Edge CDP installability checks returned no errors in fresh persistent test profiles.
  Manifest count, ordinary/maskable PNG dimensions, and `/AnyInk/` asset paths were checked.
- Production app booted offline after first caching. Trace worker, WASM and font entries
  were present; no test pages were cached.
- A controlled second release was served from memory: changed HTML plus its precache
  revision and worker bytes. The old page stayed alive until the update button was pressed.
  An additional app tab blocked activation. An injected IndexedDB recovery-write exception
  with an open project blocked activation/reload; restoring writes allowed retry.
  Explicit update loaded release 2, which also booted offline, with no page errors.
  This production release harness passed in both installed Chrome and Edge.
- The storage harness used actual Chrome OPFS handles, writable streams, Web Locks and
  IndexedDB. Continuous edits reached the OPFS file, glyph switching wrote width 605,
  and an externally changed file remained intact with a failed-save status.
- **Actual renderer crash passed:** after the fixture reported READY FOR RELOAD, CDP
  `Page.crash` killed only that isolated renderer. No `pagehide` callback ran. The same
  target was reloaded with CDP (Playwright keeps a stale crashed-target flag), and recovery
  restored width **604** with **four undo entries** from IndexedDB.

## Release limits and remaining native verification

The OPFS checks exercise browser file handles, not a Windows picker-selected file.
The crash check is a renderer kill, not an OS power loss or full browser-process kill.
The release-pair harness changes served HTML/worker revisions rather than deploying
two GitHub Pages releases. These are explicit bounds on the evidence.

Still needed in an ordinary Chrome/Edge window, after authorized deployment:

1. Install from GitHub Pages; confirm the Windows launcher icon and standalone window.
2. Close/reopen that installed app with networking disabled and edit/export a real font.
3. Verify a real deployment update with unsaved edits, **Later**, explicit reload, and Recover.
4. Verify native picker permissions and real disk save/export after restart/offline use.
   The coordinator's separate native-file evidence is not claimed by this harness.

The first online visit must finish caching before offline launch can work. Browser storage
eviction/clearing removes caches and recovery; this feature cannot guarantee durability
against explicit data deletion. Full-app export/auto-trace correctness and the broad unit
suite remain the coordinator's integration checks while those files are being edited.

The build still reports upstream font-flux/potrace Node-module externalization, the potrace
CommonJS/ESM warning, a large app chunk, and the plugin's deprecated inlineDynamicImports
warning. They did not prevent build or the checks above; they are not hidden by raising
the chunk-warning threshold.

## Official sources checked before implementation

- [npm package](https://www.npmjs.com/package/vite-plugin-pwa) and `npm view` version/peer metadata.
- [Prompt updates](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html).
- [Custom worker and injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest.html).
- [Static assets](https://vite-pwa-org.netlify.app/guide/static-assets.html).
- [Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching).
