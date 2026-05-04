const CACHE_NAME = 'novira-cache-b94a3678'; // Updated version
const STATIC_ASSETS = [
    '/Novira.png',
    '/manifest.json',
    '/offline.html',
    '/offline-illustration.png'
];
// Navigation routes to warm so the app shell loads if the user goes offline before
// their first navigation has populated the cache (e.g. install PWA → quit → open offline).
// Failures are non-fatal — they're best-effort warmers, not invariants.
const WARM_NAVIGATION_ROUTES = ['/', '/add', '/analytics', '/subscriptions'];

// Extract same-origin <script src> and <link rel="modulepreload" href> URLs from
// HTML text. Used during install to pre-cache the JS chunks the warmed routes
// reference, so a fresh-installed PWA mounts cleanly even if the user goes
// offline before navigating.
function extractAssetUrls(html, origin) {
    const urls = new Set();
    const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
    const preloadRe = /<link[^>]+rel=["'](?:modulepreload|preload)["'][^>]*href=["']([^"']+)["']/gi;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
        try {
            const url = new URL(m[1], origin);
            if (url.origin === origin) urls.add(url.href);
        } catch {}
    }
    while ((m = preloadRe.exec(html)) !== null) {
        try {
            const url = new URL(m[1], origin);
            if (url.origin === origin) urls.add(url.href);
        } catch {}
    }
    return Array.from(urls);
}

// Install: pre-cache essential static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(STATIC_ASSETS);
            await Promise.all(
                WARM_NAVIGATION_ROUTES.map(async (route) => {
                    try {
                        const response = await fetch(route, { credentials: 'include' });
                        if (!response.ok || response.redirected) return;
                        // Cache the HTML itself so navigation falls back here when offline.
                        const cloneForCache = response.clone();
                        await cache.put(route, cloneForCache);

                        // Parse HTML and pre-cache its referenced JS chunks. Failures are
                        // non-fatal — best-effort warming.
                        try {
                            const html = await response.text();
                            const assetUrls = extractAssetUrls(html, self.location.origin);
                            await Promise.all(
                                assetUrls.map(async (url) => {
                                    try {
                                        const assetResponse = await fetch(url, { credentials: 'include' });
                                        if (assetResponse.ok) {
                                            await cache.put(url, assetResponse.clone());
                                        }
                                    } catch {
                                        /* skip individual asset failures */
                                    }
                                })
                            );
                        } catch {
                            /* HTML parse failure — skip warming */
                        }
                    } catch {
                        /* offline at install time — skip silently */
                    }
                })
            );
        })
    );
    // Take over immediately — don't wait for old SW to be released.
    // Without this, a broken old SW stays active until all tabs are closed,
    // which can lock users out if the old SW breaks a critical flow (e.g. auth callback).
    self.skipWaiting();
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
    // Only accept messages from same-origin clients. Cross-origin pages (iframes,
    // embeds) shouldn't be able to drop our caches.
    const sourceUrl = event.source && event.source.url;
    if (sourceUrl) {
        try {
            if (new URL(sourceUrl).origin !== self.location.origin) return;
        } catch {
            return;
        }
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }
    if (event.data && event.data.type === 'INVALIDATE_SUPABASE_CACHE') {
        // After a mutation, the SWR cache for matching SELECT queries is stale.
        // Drop those entries so the next read goes to network instead of returning
        // a list missing the freshly-inserted row.
        const pattern = event.data.pattern;
        if (!pattern) return;
        event.waitUntil(
            caches.open(CACHE_NAME).then(async (cache) => {
                const requests = await cache.keys();
                await Promise.all(
                    requests
                        .filter((req) => {
                            try {
                                const u = new URL(req.url);
                                return u.hostname.includes('supabase.co') && u.pathname.includes(pattern);
                            } catch {
                                return false;
                            }
                        })
                        .map((req) => cache.delete(req))
                );
            })
        );
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

// Activate: clean up old caches, then claim clients (in that order, inside waitUntil
// so activation isn't reported complete until both finish).
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((name) => name !== CACHE_NAME)
                .map((name) => caches.delete(name))
        );
        await self.clients.claim();
    })());
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

// Web Share Target: receive a shared image from the OS share sheet, stash the
// blob in a dedicated IndexedDB store, then redirect to /add?from-share=1.
// The /add page reads the blob and triggers receipt scanning automatically.
const SHARE_DB_NAME = 'novira-share-target';
const SHARE_STORE = 'files';
const SHARE_KEY = 'pending';

function openShareDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(SHARE_DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SHARE_STORE)) {
                db.createObjectStore(SHARE_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function putSharedFile(blob) {
    const db = await openShareDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SHARE_STORE, 'readwrite');
        tx.objectStore(SHARE_STORE).put(blob, SHARE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function handleShareTarget(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('receipt');
        if (file && file instanceof Blob) {
            await putSharedFile(file);
        }
    } catch (err) {
        console.error('[share-target]', err);
    }
    return Response.redirect('/add?from-share=1', 303);
}

// Fetch: network-first for auth, stale-while-revalidate for data, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Web Share Target POST — intercept before the GET-only guard.
    if (request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(handleShareTarget(request));
        return;
    }

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
        // Exchange-rate hosts get a 6h max-age. Without it, a single bad upstream
        // response could be served from cache for days until the SW version bumps.
        const RATE_API_MAX_AGE_MS = 6 * 60 * 60 * 1000;
        const isRateApi = url.hostname.includes('frankfurter');

        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            // Stamp a cached-at header on rate-API responses so we
                            // can age them out without bumping the cache version.
                            if (isRateApi) {
                                const stamped = new Response(networkResponse.clone().body, {
                                    status: networkResponse.status,
                                    statusText: networkResponse.statusText,
                                    headers: (() => {
                                        const h = new Headers(networkResponse.headers);
                                        h.set('x-novira-cached-at', String(Date.now()));
                                        return h;
                                    })(),
                                });
                                cache.put(request, stamped);
                            } else {
                                cache.put(request, networkResponse.clone());
                            }
                        }
                        return networkResponse;
                    }).catch(() => {
                         // Network failed, silently fail over to cached if available
                         return cachedResponse;
                    });

                    if (cachedResponse) {
                        if (isRateApi) {
                            const stamped = cachedResponse.headers.get('x-novira-cached-at');
                            const cachedAt = stamped ? parseInt(stamped, 10) : 0;
                            if (!cachedAt || (Date.now() - cachedAt) > RATE_API_MAX_AGE_MS) {
                                // Cache expired — wait for fresh network instead of serving stale.
                                return fetchPromise;
                            }
                        }
                        // Return the cached response immediately; network refresh runs in background.
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
    // Always try the network first for navigate requests. Pages are server-rendered
    // with live auth state, so serving a stale cached HTML immediately (cache-first)
    // risks showing outdated content or auth-redirect loops.
    // On failure (e.g. brief network gap when app resumes from background) we fall back
    // to any previously cached version of that URL, then /offline.html.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(new Request(request.url, { redirect: 'follow', credentials: 'include' }))
                .then((response) => {
                    // Cache successful, non-redirected responses for offline fallback
                    if (response.ok && !response.redirected) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response.clone());
                        });
                    }
                    return response;
                })
                .catch(() =>
                    // Network failed — serve any cached version of this URL, else offline page
                    caches.match(request).then(cached => cached || caches.match('/offline.html'))
                )
        );
        return;
    }
});
