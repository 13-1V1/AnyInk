// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import {
	cleanupOutdatedCaches,
	createHandlerBoundToURL,
	precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Never claim live pages or activate an update during installation.
// Only the explicit update button sends this message after awaiting recovery.
self.addEventListener('message', (event) => {
	if (event.data?.type !== 'ANYINK_ACTIVATE' || !event.ports[0]) return;
	event.waitUntil(
		(async () => {
			const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const others = clients.filter(
				(client) => client.url.startsWith(self.registration.scope) && client.id !== event.source?.id
			);
			if (others.length) {
				event.ports[0].postMessage({
					error: 'Close other ANY-INK tabs or windows before updating.',
				});
				return;
			}
			await self.skipWaiting();
			event.ports[0].postMessage({ ok: true });
		})()
	);
});
