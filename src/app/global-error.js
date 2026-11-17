"use client";

/**
 * Último recurso: el fallo está en el propio layout (proveedores, cabecera),
 * así que no hay traducciones ni estilos de la web disponibles.
 */
export default function ErrorGlobal() {
    const recargar = async () => {
        try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* se recarga igual */ }
        window.location.reload();
    };
    return (
        <html lang="es">
            <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
                <div style={{ textAlign: 'center', maxWidth: 420 }}>
                    <p style={{ fontSize: 40, margin: 0 }}>🛠️</p>
                    <h1 style={{ fontSize: 20 }}>Algo no ha cargado bien · Something did not load</h1>
                    <p style={{ color: '#cbd5e1', fontSize: 14 }}>Vuelve a cargar la página · Please reload the page</p>
                    <button type="button" onClick={recargar} style={{ background: '#ea580c', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 15 }}>
                        🔄 Recargar · Reload
                    </button>
                </div>
            </body>
        </html>
    );
}
