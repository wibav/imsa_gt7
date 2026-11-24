"use client";

import { useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { sanitizeRegulationsHtml } from '../../utils/regulationsSanitize';
import { plainTextToRegulationsHtml, isRegulationsEmpty } from '../../utils/regulations';
import { buildChampionshipInfoDocDefinition, championshipInfoFilename } from '../../utils/championshipInfoPdf';
import { extractVfs, fetchAsDataUrl } from './RegulationsPdfButton';
import { useI18n } from '../../i18n';

/**
 * «Descargar información»: un PDF con todo lo que un piloto necesita del
 * campeonato (datos, calendario, Pre-Qualy, salas, autos y reglamento), fácil
 * de pasar por WhatsApp. Se genera en el navegador, como el del reglamento.
 */
export default function ChampionshipInfoPdfButton({ championship, tracks = [], divisions = [] }) {
    const { t, lang, locale } = useI18n();
    const [estado, setEstado] = useState('idle'); // idle | loading | error

    const descargar = async () => {
        setEstado('loading');
        try {
            const [{ default: pdfMake }, vfsModule, { default: htmlToPdfmake }] = await Promise.all([
                import('pdfmake/build/pdfmake'),
                import('pdfmake/build/vfs_fonts'),
                import('html-to-pdfmake'),
            ]);
            const vfs = extractVfs(vfsModule);
            if (!vfs) throw new Error('No se pudo cargar el set de fuentes de pdfmake');
            pdfMake.addVirtualFileSystem(vfs);

            const hayReglamento = !isRegulationsEmpty(championship.regulations, championship.regulationsFormat);
            const regulationsContent = hayReglamento
                ? htmlToPdfmake(championship.regulationsFormat === 'html'
                    ? sanitizeRegulationsHtml(championship.regulations)
                    : plainTextToRegulationsHtml(championship.regulations), { window })
                : null;

            const org = championship.orgId
                ? await FirebaseService.getOrganization(championship.orgId).catch(() => null)
                : null;
            const [championshipLogo, orgLogo] = await Promise.all([
                fetchAsDataUrl(championship.logo),
                fetchAsDataUrl(org?.branding?.logo || org?.logo),
            ]);

            const docDefinition = buildChampionshipInfoDocDefinition({
                championship,
                org,
                tracks,
                divisions,
                regulationsContent,
                generatedAt: new Date().toLocaleString(locale, {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                }),
                logos: { championshipLogo, orgLogo },
                t: (clave, vars) => t(`formularios.pdfInfo.${clave}`, vars),
                lang,
                locale,
            });
            await pdfMake.createPdf(docDefinition).download(championshipInfoFilename(championship));
            setEstado('idle');
        } catch (err) {
            console.error('Error generando el PDF del campeonato:', err);
            setEstado('error');
        }
    };

    return (
        <div className="inline-flex flex-col items-start gap-1">
            <button
                type="button"
                onClick={descargar}
                disabled={estado === 'loading'}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
            >
                {estado === 'loading' ? t('formularios.pdf.generando') : `📄 ${t('formularios.pdfInfo.boton')}`}
            </button>
            {estado === 'error' && <span className="text-xs text-red-400">{t('formularios.pdf.error')}</span>}
        </div>
    );
}
