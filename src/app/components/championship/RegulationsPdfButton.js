"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { sanitizeRegulationsHtml } from '../../utils/regulationsSanitize';
import { plainTextToRegulationsHtml, regulationsFilename, isRegulationsEmpty } from '../../utils/regulations';
import { buildRegulationsDocDefinition } from '../../utils/regulationsPdf';

/**
 * Extrae el mapa de fuentes (VFS) del módulo `pdfmake/build/vfs_fonts` sea
 * cual sea la forma en la que el bundler (webpack/Next.js) exponga el
 * módulo CommonJS tras un `import()` dinámico. En pdfmake 0.3.x ese módulo
 * hace `module.exports = vfs` (un objeto plano `{ 'Roboto-Regular.ttf': '<base64>', ... }`),
 * pero según el interop de ESM/CJS del bundler puede aparecer como el
 * propio namespace, bajo `.default`, o (formatos legacy de pdfmake <0.2)
 * anidado en `.pdfMake.vfs`. Se detecta por duck-typing (busca una clave de
 * fuente conocida) en vez de asumir una forma fija.
 * @param {unknown} vfsModule
 * @returns {object|null}
 */
function extractVfs(vfsModule) {
    const isVfsObject = (candidate) =>
        candidate && typeof candidate === 'object' && 'Roboto-Regular.ttf' in candidate;

    const candidates = [
        vfsModule,
        vfsModule?.default,
        vfsModule?.pdfMake?.vfs,
        vfsModule?.default?.pdfMake?.vfs
    ];

    const found = candidates.find(isVfsObject);
    if (!found) return null;

    // Con `import()` dinámico, webpack puede envolver el módulo CommonJS en
    // un "module namespace object" (exotic object sin Object.prototype en su
    // cadena de prototipos, y que además añade una clave `default` propia
    // apuntando al propio módulo). pdfMake.addVirtualFileSystem() usa
    // `vfs.hasOwnProperty(key)` internamente (no existe en ese tipo de
    // objeto) y espera que cada valor sea un string base64 (o `{data,
    // encoding}`), no el módulo completo. Se copia a un objeto plano
    // quedándose solo con las entradas de fuente reales.
    const plain = {};
    for (const key of Object.keys(found)) {
        const value = found[key];
        const isFontEntry = typeof value === 'string' || (value && typeof value === 'object' && 'data' in value);
        if (isFontEntry) plain[key] = value;
    }
    return plain;
}

async function fetchAsDataUrl(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

/**
 * Botón de descarga de PDF del reglamento de campeonato.
 * Genera el PDF 100% en cliente (pdfmake cargado por import() dinámico).
 *
 * @param {{ championship: object, compact?: boolean }} props
 */
export default function RegulationsPdfButton({ championship, compact = false }) {
    const [status, setStatus] = useState('idle'); // idle | loading | error

    if (isRegulationsEmpty(championship?.regulations, championship?.regulationsFormat)) {
        return null;
    }

    const handleClick = async () => {
        setStatus('loading');
        try {
            const [{ default: pdfMake }, vfsModule, { default: htmlToPdfmake }] = await Promise.all([
                import('pdfmake/build/pdfmake'),
                import('pdfmake/build/vfs_fonts'),
                import('html-to-pdfmake')
            ]);

            const vfs = extractVfs(vfsModule);
            if (!vfs) {
                throw new Error("No se pudo cargar el set de fuentes de pdfmake (VFS con 'Roboto-Regular.ttf' no encontrado).");
            }
            // pdfMake 0.3.x expone un `virtualfs` (instancia de VirtualFs) en vez
            // del viejo objeto plano `pdfMake.vfs`; hay que registrar las fuentes
            // con addVirtualFileSystem(), no asignando la propiedad `.vfs`.
            pdfMake.addVirtualFileSystem(vfs);

            const raw = championship.regulations || '';
            const clean = championship.regulationsFormat === 'html'
                ? sanitizeRegulationsHtml(raw)
                : plainTextToRegulationsHtml(raw);

            const bodyContent = htmlToPdfmake(clean, { window });

            const org = championship.orgId
                ? await FirebaseService.getOrganization(championship.orgId).catch(() => null)
                : null;

            const [championshipLogo, orgLogo] = await Promise.all([
                fetchAsDataUrl(championship.logo),
                fetchAsDataUrl(org?.branding?.logo || org?.logo)
            ]);

            const generatedAt = new Date().toLocaleString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const docDefinition = buildRegulationsDocDefinition({
                championship,
                org,
                bodyContent,
                generatedAt,
                logos: { championshipLogo, orgLogo }
            });

            // download() es async (devuelve una Promise) en pdfmake 0.3.x: hay que
            // esperarla para que un fallo dentro de la generación del PDF sea
            // capturado por este try/catch en vez de escapar como rechazo no
            // manejado.
            await pdfMake.createPdf(docDefinition).download(regulationsFilename(championship));
            setStatus('idle');
        } catch (err) {
            console.error('Error generando PDF del reglamento:', err);
            setStatus('error');
        }
    };

    return (
        <div className={compact ? 'inline-flex flex-col items-start gap-1' : 'flex flex-col items-start gap-1'}>
            <button
                type="button"
                onClick={handleClick}
                disabled={status === 'loading'}
                className={compact
                    ? 'px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-orange-300 rounded-lg transition-all disabled:opacity-50'
                    : 'px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-50'}
            >
                {status === 'loading' ? 'Generando PDF…' : '📄 Descargar reglamento (PDF)'}
            </button>
            {status === 'error' && (
                <span className="text-xs text-red-400">No se pudo generar el PDF. Intenta de nuevo.</span>
            )}
        </div>
    );
}
