/**
 * Construcción de la definición de documento pdfmake para el PDF del
 * reglamento de campeonato. Módulo puro (JSON), NO importa pdfmake ni
 * html-to-pdfmake — testeable en Node sin navegador.
 */
import { STATUS_LABELS } from './constants.js';

const THEME = {
    text: '#1f2937',
    muted: '#6b7280',
    heading: '#111827',
    accent: '#c2410c',
    border: '#e5e7eb'
};

function formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    const fmt = (d) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * @param {object} params
 * @param {object} params.championship
 * @param {object|null} [params.org]
 * @param {Array} params.bodyContent - nodos pdfmake ya convertidos desde HTML por el caller
 * @param {string} params.generatedAt - fecha/hora ya formateada
 * @param {{ championshipLogo?: string|null, orgLogo?: string|null }} [params.logos]
 * @returns {object} docDefinition de pdfmake
 */
export function buildRegulationsDocDefinition({ championship, org = null, bodyContent, generatedAt, logos = {} }) {
    const champ = championship || {};
    const headerLines = [];

    const titleParts = [champ.name || 'Campeonato'];
    if (champ.shortName) titleParts.push(`(${champ.shortName})`);
    headerLines.push({ text: titleParts.join(' '), style: 'title' });

    const metaBits = [];
    if (champ.season) metaBits.push(`Temporada ${champ.season}`);
    const dateRange = formatDateRange(champ.startDate, champ.endDate);
    if (dateRange) metaBits.push(dateRange);
    const statusLabel = STATUS_LABELS[champ.status];
    if (statusLabel) metaBits.push(statusLabel);
    if (Array.isArray(champ.categories) && champ.categories.length > 0) {
        metaBits.push(champ.categories.join(' · '));
    }
    if (org?.name) metaBits.push(org.name);

    if (metaBits.length > 0) {
        headerLines.push({ text: metaBits.join('  ·  '), style: 'subtitle', margin: [0, 4, 0, 0] });
    }

    const logoNodes = [];
    if (logos?.championshipLogo) {
        logoNodes.push({ image: logos.championshipLogo, width: 60, alignment: 'right' });
    } else if (logos?.orgLogo) {
        logoNodes.push({ image: logos.orgLogo, width: 60, alignment: 'right' });
    }

    const headerColumns = logoNodes.length > 0
        ? [{ stack: headerLines, width: '*' }, { stack: logoNodes, width: 70 }]
        : [{ stack: headerLines, width: '*' }];

    const content = [
        { columns: headerColumns, margin: [0, 0, 0, 10] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: THEME.border }], margin: [0, 0, 0, 16] },
        { text: 'Reglamento', style: 'sectionHeading', margin: [0, 0, 0, 10] },
        ...(Array.isArray(bodyContent) ? bodyContent : [bodyContent].filter(Boolean))
    ];

    return {
        pageSize: 'A4',
        pageMargins: [40, 70, 40, 50],
        defaultStyle: {
            fontSize: 10,
            color: THEME.text,
            lineHeight: 1.35
        },
        styles: {
            title: { fontSize: 16, bold: true, color: THEME.heading },
            subtitle: { fontSize: 9, color: THEME.muted },
            sectionHeading: { fontSize: 13, bold: true, color: THEME.accent }
        },
        content,
        footer: (currentPage, pageCount) => ({
            text: `Página ${currentPage} de ${pageCount} · Generado el ${generatedAt} · Este reglamento puede ser actualizado por la organización`,
            style: { fontSize: 7, color: THEME.muted },
            alignment: 'center',
            margin: [40, 10, 40, 0]
        })
    };
}
