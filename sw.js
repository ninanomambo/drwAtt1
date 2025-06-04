const CACHE_NAME = 'attendance-tracker-v1';
const STATIC_CACHE = 'static-v1';
const DATA_CACHE = 'data-v1';

const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/app.js',
    '/js/database.js',
    '/js/location.js',
    '/js/sync.js',
    '/manifest.json'
];

const API_ENDPOINTS = [
    '/api/attendance',
    '/api/sync'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Install');
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] Caching static files');
                return cache.addAll(STATIC_FILES);
            }),
            caches.open(DATA_CACHE)
        ])
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
        event.respondWith(
            handleNonGetRequest(request)
        );
        return;
    }

    if (isStaticFile(url.pathname)) {
        event.respondWith(
            caches.match(request).then((response) => {
                return response || fetch(request);
            })
        );
        return;
    }

    if (isAPIRequest(url.pathname)) {
        event.respondWith(
            handleAPIRequest(request)
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((response) => {
            return response || fetch(request).catch(() => {
                if (request.destination === 'document') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

function isStaticFile(pathname) {
    return STATIC_FILES.some(file => {
        return file === pathname || file === pathname + 'index.html';
    }) || pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/);
}

function isAPIRequest(pathname) {
    return API_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint));
}

async function handleAPIRequest(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            const cache = await caches.open(DATA_CACHE);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('[SW] Network request failed, trying cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response(
            JSON.stringify({ error: 'Network unavailable', offline: true }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

async function handleNonGetRequest(request) {
    try {
        return await fetch(request);
    } catch (error) {
        if (request.method === 'POST') {
            const data = await request.clone().json();
            await storeOfflineRequest(request.url, request.method, data);
            
            return new Response(
                JSON.stringify({ 
                    success: true, 
                    offline: true, 
                    message: 'Request stored for sync when online' 
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        return new Response(
            JSON.stringify({ error: 'Network unavailable' }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

async function storeOfflineRequest(url, method, data) {
    const db = await openDB();
    const transaction = db.transaction(['offlineRequests'], 'readwrite');
    const store = transaction.objectStore('offlineRequests');
    
    await store.add({
        url,
        method,
        data,
        timestamp: Date.now()
    });
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AttendanceTracker', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('attendance')) {
                const attendanceStore = db.createObjectStore('attendance', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                attendanceStore.createIndex('date', 'date');
                attendanceStore.createIndex('type', 'type');
                attendanceStore.createIndex('synced', 'synced');
            }
            
            if (!db.objectStoreNames.contains('offlineRequests')) {
                db.createObjectStore('offlineRequests', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
            }
        };
    });
}

self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-attendance') {
        event.waitUntil(syncOfflineData());
    }
});

async function syncOfflineData() {
    try {
        const db = await openDB();
        const transaction = db.transaction(['offlineRequests'], 'readwrite');
        const store = transaction.objectStore('offlineRequests');
        const requests = await store.getAll();
        
        for (const req of requests) {
            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(req.data)
                });
                
                if (response.ok) {
                    await store.delete(req.id);
                    console.log('[SW] Synced offline request:', req.id);
                }
            } catch (error) {
                console.log('[SW] Failed to sync request:', req.id, error);
            }
        }
        
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({ type: 'SYNC_COMPLETE' });
            });
        });
        
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});