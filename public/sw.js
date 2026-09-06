// Subir esta versión purga la caché anterior al activarse el nuevo SW (ver
// el listener 'activate'). Hacerlo cuando cambie la estrategia de caché o si
// hay que forzar que los usuarios suelten assets viejos.
const CACHE_NAME = 'gt7-champs-v2';

// Archivos del shell de la app que siempre deben estar disponibles offline
const PRECACHE_ASSETS = [
    '/',
    '/favicon.ico',
    '/logo_gt7.png',
    '/manifest.json',
];

// Instalar: precachear el shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
    );
    self.skipWaiting();
});

// Activar: eliminar caches antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch: network-first para navegación, cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Solo interceptar peticiones GET y http/https
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    // Ignorar peticiones a Firebase, Google Ads, Analytics y APIs externas
    const url = new URL(request.url);
    const BYPASS_HOSTS = [
        'firestore.googleapis.com',
        'firebasestorage.googleapis.com',
        'identitytoolkit.googleapis.com',
        'securetoken.googleapis.com',
        'pagead2.googlesyndication.com',
        'www.google-analytics.com',
        'www.googletagmanager.com',
        'www.googletagservices.com',
    ];
    if (BYPASS_HOSTS.some((host) => url.hostname.includes(host))) return;

    // Network-first para navegación HTML (para que siempre cargue la última versión)
    if (request.mode === 'navigate') {
        event.respondWith(
            // `cache: 'no-store'` salta la caché HTTP del navegador: sin esto,
            // aunque la estrategia sea network-first, el propio fetch podía
            // devolver una copia cacheada y el usuario seguía viendo la versión
            // anterior tras un deploy.
            fetch(request, { cache: 'no-store' })
                .catch(() => fetch(request).catch(() => caches.match('/')))
        );
        return;
    }

    // Cache-first para assets estáticos (JS, CSS, imágenes, fuentes)
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok && response.type !== 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
