const CACHE_NAME = 'novira-v2.6.0'; // Updated version
const STATIC_ASSETS = [
    '/',
    '/Novira.png',
    '/manifest.json',
];

// Install: pre-cache essential static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Listen for the "SKIP_WAITING" message to trigger the update
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

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

    // --- 4. Navigation requests (Stale-While-Revalidate as before) ---
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((response) => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Network failed, cachedResponse will be used (or fallback to root)
                    return cachedResponse || caches.match('/');
                });

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }
});
