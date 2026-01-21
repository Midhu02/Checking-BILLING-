// static/sw.js - Service Worker for Mobile Billing PWA
// This handles offline caching, precaches core assets, and provides basic offline support

const CACHE_NAME = 'mobile-billing-pwa-v1';
const urlsToCache = [
    '/',                          // Root (login page)
    '/billing/',                  // Billing page
    '/service/',                  // Service page
    '/static/css/style.css',      // Main CSS
    '/static/css/print.css',      // Print styles
    '/static/js/app.js',          // Core app logic
    '/static/js/billing.js',      // Billing JS
    '/static/js/inventory.js',    // Inventory JS
    '/static/js/service.js',      // Service JS
    '/static/js/invoice.js',      // Invoice JS
    '/static/js/reports.js',      // Reports JS
    '/static/js/pwa.js',          // PWA features
    '/static/manifest.json',      // Manifest
    // '/static/images/favicon.ico'  // Favicon
    // Add more critical assets like templates or additional JS/CSS if needed
];

// Install event: Cache all essential files during SW installation
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('SW: Caching core files');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('SW: Caching failed:', error);
            })
    );
    
    // Skip waiting to activate the new SW immediately
    self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Take control of all clients immediately
    self.clients.claim();
});

// Fetch event: Serve from cache first, then network (cache-first strategy)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // If found in cache, return it
                if (response) {
                    return response;
                }
                
                // Otherwise, fetch from network
                return fetch(event.request).catch(() => {
                    // Fallback for offline: Return a custom offline response if needed
                    console.log('SW: Offline mode - serving from cache or fallback');
                    // Optional: return caches.match('/offline.html'); // If you add an offline page
                });
            })
    );
});

// Optional: Handle push notifications (if you add push later)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Mobile Billing Update';
    const options = {
        body: data.body || 'You have a new notification from your billing app.',
        icon: '/static/images/icon.png'
        // badge: '/static/images/favicon.ico'
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Optional: Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});