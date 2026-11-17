// Subir esta versión purga la caché anterior al activarse el nuevo SW (ver
// el listener 'activate'). Hacerlo cuando cambie la estrategia de caché o si
// hay que forzar que los usuarios suelten assets viejos.
// v3: deja de guardar los index.txt de Next (sin versión en el nombre), que
// tras un despliegue apuntaban a código que ya no existía.
const CACHE_NAME = 'gt7-champs-v3';

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

    // Cache-first solo para lo que no cambia sin cambiar de nombre: el código
    // de Next (lleva un hash en la ruta) y las imágenes y fuentes de la web.
    // El resto (index.txt de navegación, JSON, otros dominios) va siempre a
    // la red: servirlo de la caché dejaba páginas a medias tras publicar.
    const mismoOrigen = url.origin === self.location.origin;
    const inmutable = mismoOrigen && url.pathname.startsWith('/_next/static/');
    const imagen = mismoOrigen && /\.(png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);
    if (!inmutable && !imagen) return;

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
