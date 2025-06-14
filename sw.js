// Define a name for the cache
const CACHE_NAME = 'nic-prevention-cache-v1';

// List of files to cache on installation
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css'
];

/**
 * Install event: triggered when the service worker is first installed.
 * It opens the cache and adds the essential files to it.
 */
self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

/**
 * Fetch event: triggered for every network request made by the page.
 * It checks if the request is in the cache. If so, it serves from the cache.
 * If not, it fetches from the network, serves it to the page, and caches the response for future use.
 */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time-use stream
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              // For third-party resources like Google Fonts, we get an 'opaque' response.
              // We don't need to cache them if they fail, but we also don't want to throw an error.
              // We will just return the response without caching it.
              if (response.type === 'opaque') {
                 return response;
              }
               return response;
            }

            // Clone the response because it's also a one-time-use stream
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // We don't cache POST requests
                if(event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
    );
});

/**
 * Activate event: This event is used to clean up old caches.
 */
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
