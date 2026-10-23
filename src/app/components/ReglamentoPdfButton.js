"use client";

import { useState } from 'react';
import { extractVfs, fetchAsDataUrl } from './championship/RegulationsPdfButton';
import { buildReglamentoGeneralDoc, reglamentoGeneralFilename } from '../utils/reglamentoGeneralPdf';

/** Lee un SVG de /public como texto (pdfmake lo dibuja como vectorial). */
async function fetchTexto(url) {
    try {
        const r = await fetch(url);
        return r.ok ? await r.text() : null;
    } catch {
        return null;
    }
}

/**
 * Descarga el reglamento general en PDF, generado en el navegador con pdfmake
 * (misma numeración y figuras que la página).
 *
 * @param {Array}  sections - secciones ya normalizadas (filas como arrays)
 * @param {string} [orgName]
 * @param {string} [version]
 * @param {string} [fecha]  - fecha de la versión, ya formateada
 */
export default function ReglamentoPdfButton({ sections = [], orgName = '', version = '', fecha = '' }) {
    const [estado, setEstado] = useState('listo'); // listo | generando | error

    const descargar = async () => {
        setEstado('generando');
        try {
            const [{ default: pdfMake }, vfsModule] = await Promise.all([
                import('pdfmake/build/pdfmake'),
                import('pdfmake/build/vfs_fonts'),
            ]);
            const vfs = extractVfs(vfsModule);
            if (!vfs) throw new Error('No se pudo cargar la fuente del PDF');
            pdfMake.addVirtualFileSystem(vfs);

            const fuentes = [...new Set(sections.flatMap(s => (s.content || []).flatMap(b => (b.figuras || []).map(f => f.src))))];
            const [svgsLeidos, escudo, insignia] = await Promise.all([
                Promise.all(fuentes.map(fetchTexto)),
                fetchTexto('/reglamento/logo-gt7-esp.svg'),
                fetchAsDataUrl('/reglamento/logo-deshbourne.png'),
            ]);
            const svgs = Object.fromEntries(fuentes.map((src, i) => [src, svgsLeidos[i]]).filter(([, v]) => v));

            const doc = buildReglamentoGeneralDoc({
                sections, orgName, version, fecha, svgs,
                logos: { escudo, insignia },
                generadoEl: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            });
            await pdfMake.createPdf(doc).download(reglamentoGeneralFilename(orgName, version));
            setEstado('listo');
        } catch (err) {
            console.error('Error generando el PDF del reglamento:', err);
            setEstado('error');
        }
    };

    return (
        <div className="flex flex-col items-start gap-1">
            <button
                type="button"
                onClick={descargar}
                disabled={estado === 'generando' || sections.length === 0}
                className="px-4 py-2 bg-white text-orange-700 hover:bg-orange-50 text-sm font-bold rounded-lg shadow transition-all disabled:opacity-60"
            >
                {estado === 'generando' ? 'Generando PDF…' : '📄 Descargar PDF'}
            </button>
            {estado === 'error' && <span className="text-xs text-red-100">No se pudo generar el PDF. Inténtalo de nuevo.</span>}
        </div>
    );
}
