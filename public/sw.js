const CACHE_NAME = 'novira-cache-cec586f4'; // Updated version
const STATIC_ASSETS = [
    '/Novira.png',
    '/manifest.json',
    '/offline.html',
    '/offline-illustration.png'
];

// Install: pre-cache essential static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Take over immediately — don't wait for old SW to be released.
    // Without this, a broken old SW stays active until all tabs are closed,
    // which can lock users out if the old SW breaks a critical flow (e.g. auth callback).
    self.skipWaiting();
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Push Notifications
self.addEventListener('push', (event) => {
    let payload = { title: 'Novira', body: 'You have a new notification', icon: '/Novira.png', url: '/' };
    if (event.data) {
        try { payload = { ...payload, ...JSON.parse(event.data.text()) }; } catch {}
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon,
            badge: '/Novira.png',
            data: { url: payload.url },
            vibrate: [100, 50, 100],
        })
    );
});

// Notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const match = clients.find(c => c.url.includes(self.location.origin) && 'focus' in c);
            if (match) {
                match.focus();
                match.navigate(url);
            } else {
                self.clients.openWindow(url);
            }
        })
    );
});

// Background Sync: wake up all open clients so they can run the sync queue
self.addEventListener('sync', (event) => {
    if (event.tag === 'novira-sync-queue') {
        event.waitUntil(notifyClientsToSync());
    }
});

async function notifyClientsToSync() {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.length > 0) {
        clients.forEach(client => client.postMessage({ type: 'BG_SYNC_TRIGGERED' }));
    }
}

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Helper function to add a custom header to a cached response
function addXFromCacheHeader(response) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-From-Cache', 'true');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

// Fetch: network-first for auth, stale-while-revalidate for data, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Supabase realtime WebSocket connections
    if (url.protocol === 'wss:' || url.protocol === 'ws:') return;

    // Never intercept auth routes — the OAuth callback sets session cookies via
    // HTTP redirect headers. If the SW intercepts and follows the redirect internally
    // via fetch(), those cookies are never applied to the browser's cookie jar,
    // causing ERR_FAILED and breaking the entire sign-in flow.
    if (
        url.pathname.startsWith('/auth/') ||
        url.pathname.startsWith('/signin') ||
        url.pathname.startsWith('/signup') ||
        url.pathname.startsWith('/forgot-password') ||
        url.pathname.startsWith('/update-password')
    ) {
        return;
    }

    // --- 1. Supabase Auth Layer (Must always be Network-First) ---
    if (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/v1/')) {
        event.respondWith(
            fetch(request).catch(() => caches.match(request))
        );
        return;
    }

    // --- 2. API Data Layer (Stale-While-Revalidate) ---
    if (url.hostname.includes('supabase.co') || url.hostname.includes('frankfurter')) {
         event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                         // Network failed, silently fail over to cached if available
                         return cachedResponse;
                    });
                    
                    if (cachedResponse) {
                        // Return the cached response immediately, but flagged
                        // The network promise will still run in the background
                        return addXFromCacheHeader(cachedResponse.clone());
                    }
                    
                    // If no cache, wait for the network
                    return fetchPromise;
                });
            })
        );
        return;
    }

    // --- 3. Static Assets (Cache-First) ---
    if (
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/_next/image') ||
        url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot)$/)
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(request).then((response) => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // --- 4. Navigation requests (Network-first with offline fallback) ---
    // Navigation requests use redirect:'manual' by default, so we must create a new
    // request with redirect:'follow' — otherwise redirect responses (e.g. auth middleware
    // redirecting / → /signin) cause a network error in the service worker.
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const followRequest = new Request(request.url, { redirect: 'follow' });
                const fetchPromise = fetch(followRequest).then((response) => {
                    // Only cache final, non-redirected OK responses
                    if (response.ok && !response.redirected) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Network failed — fall back to cache, then offline page
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return caches.match('/offline.html');
                });

                // Only serve cached response if it's not a redirected response.
                // Redirected responses cause ERR_FAILED when the SW serves them
                // for navigate requests (redirect mode defaults to 'manual').
                return (cachedResponse && !cachedResponse.redirected) ? cachedResponse : fetchPromise;
            })
        );
        return;
    }
});
