/**
 * Service Worker for BitChat PWA
 * Handles caching, offline functionality, and background sync
 */

const CACHE_NAME = 'bitchat-v1.0.0';
const STATIC_CACHE = 'bitchat-static-v1.0.0';
const DYNAMIC_CACHE = 'bitchat-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles/main.css',
    '/js/crypto.js',
    '/js/bluetooth-service.js',
    '/js/chat-service.js',
    '/js/ui.js',
    '/js/app.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Files that can be cached dynamically
const CACHE_STRATEGIES = {
    // Cache first for static assets
    cacheFirst: [
        /\.css$/,
        /\.js$/,
        /\.png$/,
        /\.jpg$/,
        /\.jpeg$/,
        /\.gif$/,
        /\.svg$/,
        /\.woff2?$/,
        /\.ttf$/
    ],
    
    // Network first for API calls and dynamic content
    networkFirst: [
        /\/api\//,
        /\/signaling\//
    ],
    
    // Stale while revalidate for HTML pages
    staleWhileRevalidate: [
        /\.html$/,
        /\/$/
    ]
};

/**
 * Install event - cache static files
 */
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            }),
            
            // Skip waiting to activate immediately
            self.skipWaiting()
        ])
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => 
                            cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE &&
                            cacheName.startsWith('bitchat-')
                        )
                        .map(cacheName => {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            }),
            
            // Take control of all clients
            self.clients.claim()
        ])
    );
});

/**
 * Fetch event - handle network requests
 */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip external requests
    if (url.origin !== location.origin) {
        return;
    }
    
    // Determine caching strategy
    const strategy = getCachingStrategy(url.pathname);
    
    event.respondWith(
        handleRequest(request, strategy)
    );
});

/**
 * Determine caching strategy for a URL
 */
function getCachingStrategy(pathname) {
    // Check cache first patterns
    for (const pattern of CACHE_STRATEGIES.cacheFirst) {
        if (pattern.test(pathname)) {
            return 'cacheFirst';
        }
    }
    
    // Check network first patterns
    for (const pattern of CACHE_STRATEGIES.networkFirst) {
        if (pattern.test(pathname)) {
            return 'networkFirst';
        }
    }
    
    // Check stale while revalidate patterns
    for (const pattern of CACHE_STRATEGIES.staleWhileRevalidate) {
        if (pattern.test(pathname)) {
            return 'staleWhileRevalidate';
        }
    }
    
    // Default to cache first
    return 'cacheFirst';
}

/**
 * Handle request based on caching strategy
 */
async function handleRequest(request, strategy) {
    switch (strategy) {
        case 'cacheFirst':
            return cacheFirst(request);
        
        case 'networkFirst':
            return networkFirst(request);
        
        case 'staleWhileRevalidate':
            return staleWhileRevalidate(request);
        
        default:
            return cacheFirst(request);
    }
}

/**
 * Cache first strategy
 */
async function cacheFirst(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback to network
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.warn('Cache first failed:', error);
        
        // Try to return cached version or offline page
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback
        return createOfflineResponse(request);
    }
}

/**
 * Network first strategy
 */
async function networkFirst(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.warn('Network first failed, trying cache:', error);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback
        return createOfflineResponse(request);
    }
}

/**
 * Stale while revalidate strategy
 */
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    // Start network request in background
    const networkPromise = fetch(request).then(networkResponse => {
        if (networkResponse.status === 200) {
            const cache = caches.open(DYNAMIC_CACHE);
            cache.then(c => c.put(request, networkResponse.clone()));
        }
        return networkResponse;
    }).catch(error => {
        console.warn('Stale while revalidate network failed:', error);
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Otherwise wait for network
    try {
        return await networkPromise;
    } catch (error) {
        return createOfflineResponse(request);
    }
}

/**
 * Create offline response
 */
function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
        return new Response(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>BitChat - Hors ligne</title>
                <style>
                    body {
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
                        background: #000;
                        color: #00ff00;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        text-align: center;
                    }
                    .offline-message {
                        max-width: 400px;
                        padding: 20px;
                    }
                    h1 { color: #00ff00; margin-bottom: 20px; }
                    p { margin-bottom: 15px; line-height: 1.5; }
                    button {
                        background: #00ff00;
                        color: #000;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="offline-message">
                    <h1>BitChat - Mode Hors Ligne</h1>
                    <p>Vous êtes actuellement hors ligne.</p>
                    <p>BitChat peut toujours fonctionner en mode local via Bluetooth/WebRTC.</p>
                    <p>Les messages seront synchronisés une fois la connexion rétablie.</p>
                    <button onclick="location.reload()">Réessayer</button>
                </div>
            </body>
            </html>
        `, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            }
        });
    }
    
    // Return generic offline response for other requests
    return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

/**
 * Background sync for queued messages
 */
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync-messages') {
        console.log('Background sync: syncing queued messages');
        event.waitUntil(syncQueuedMessages());
    }
});

/**
 * Sync queued messages
 */
async function syncQueuedMessages() {
    try {
        // Get queued messages from IndexedDB or localStorage
        const queuedMessages = await getQueuedMessages();
        
        for (const message of queuedMessages) {
            try {
                // Try to send queued message
                await sendMessage(message);
                
                // Remove from queue on success
                await removeQueuedMessage(message.id);
                
            } catch (error) {
                console.warn('Failed to sync message:', message.id, error);
            }
        }
        
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

/**
 * Get queued messages (placeholder implementation)
 */
async function getQueuedMessages() {
    // In a real implementation, this would read from IndexedDB
    return [];
}

/**
 * Send message (placeholder implementation)
 */
async function sendMessage(message) {
    // In a real implementation, this would send via WebRTC or queue for later
    console.log('Sending queued message:', message);
}

/**
 * Remove queued message (placeholder implementation)
 */
async function removeQueuedMessage(messageId) {
    // In a real implementation, this would remove from IndexedDB
    console.log('Removed queued message:', messageId);
}

/**
 * Push notification handling
 */
self.addEventListener('push', event => {
    if (!event.data) {
        return;
    }
    
    try {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'Nouveau message BitChat',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: 'bitchat-message',
            data: data,
            actions: [
                {
                    action: 'reply',
                    title: 'Répondre'
                },
                {
                    action: 'ignore',
                    title: 'Ignorer'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'BitChat', options)
        );
        
    } catch (error) {
        console.error('Push notification error:', error);
    }
});

/**
 * Notification click handling
 */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const action = event.action;
    const data = event.notification.data;
    
    if (action === 'reply') {
        // Open app to reply
        event.waitUntil(
            clients.matchAll().then(clientList => {
                if (clientList.length > 0) {
                    // Focus existing client
                    return clientList[0].focus();
                } else {
                    // Open new client
                    return clients.openWindow('/');
                }
            })
        );
    } else if (action === 'ignore') {
        // Just close notification
        return;
    } else {
        // Default click - open app
        event.waitUntil(
            clients.matchAll().then(clientList => {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                } else {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

/**
 * Message handling from main thread
 */
self.addEventListener('message', event => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'QUEUE_MESSAGE':
            queueMessage(data);
            break;
            
        case 'GET_CACHE_INFO':
            getCacheInfo().then(info => {
                event.ports[0].postMessage(info);
            });
            break;
            
        case 'CLEAR_CACHE':
            clearCache().then(success => {
                event.ports[0].postMessage({ success });
            });
            break;
    }
});

/**
 * Queue message for background sync
 */
async function queueMessage(message) {
    // In a real implementation, store in IndexedDB
    console.log('Queued message for sync:', message);
}

/**
 * Get cache information
 */
async function getCacheInfo() {
    const cacheNames = await caches.keys();
    const info = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        info[cacheName] = keys.length;
    }
    
    return info;
}

/**
 * Clear all caches
 */
async function clearCache() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        return true;
    } catch (error) {
        console.error('Failed to clear cache:', error);
        return false;
    }
}

console.log('BitChat Service Worker loaded');
