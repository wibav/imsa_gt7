/**
 * Recarga la página descartando lo que guardó el service worker: si el
 * navegador se quedó con archivos de una versión anterior de la web, una
 * recarga normal los vuelve a servir desde la caché.
 *
 * Solo navegador.
 */
export async function recargarLimpio() {
    try {
        if (typeof caches !== 'undefined') {
            const claves = await caches.keys();
            await Promise.all(claves.map(k => caches.delete(k)));
        }
    } catch { /* sin acceso a la caché: se recarga igual */ }
    window.location.reload();
}
