"use client";
import { useEffect } from 'react';
import { useI18n } from './i18n';
import { recargarLimpio } from './utils/recarga';

/**
 * Pantalla de error de cualquier página: antes, un fallo al pintar dejaba
 * el contenido en blanco sin explicación.
 */
export default function ErrorDePagina({ error, reset }) {
    const { t } = useI18n();
    useEffect(() => { console.error('Error de página:', error); }, [error]);
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="max-w-md text-center bg-white/5 border border-white/10 rounded-2xl p-8 space-y-4">
                <div className="text-5xl" aria-hidden="true">🛠️</div>
                <h1 className="text-white text-xl font-bold">{t('comun.error.titulo')}</h1>
                <p className="text-gray-300 text-sm">{t('comun.error.texto')}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    <button type="button" onClick={recargarLimpio}
                        className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                        🔄 {t('comun.carga.reintentar')}
                    </button>
                    {reset && (
                        <button type="button" onClick={() => reset()}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                            ↩︎
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
