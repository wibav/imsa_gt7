/**
 * Definición pdfmake del PDF del reglamento general de la organización.
 *
 * Módulo puro (JSON): no importa pdfmake, así que lo usan tanto el botón de
 * descarga de /reglamento como el script que genera el borrador en Node.
 * La numeración (sección.bloque.punto) es la misma que muestra la web y que
 * cita la IA de reclamaciones.
 */

const TEMA = {
    texto: '#1f2937',
    suave: '#6b7280',
    titulo: '#111827',
    acento: '#c2410c',
    borde: '#e5e7eb',
};

// pdfmake no trae fuentes con emoji: se quitan de títulos y celdas
const sinEmoji = (t) => String(t ?? '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * @param {object}   params
 * @param {Array}    params.sections   - secciones (filas de tabla como arrays o {cells})
 * @param {string}   [params.orgName]
 * @param {string}   [params.version]
 * @param {string}   [params.fecha]    - fecha de la versión, ya formateada
 * @param {string}   params.generadoEl - fecha/hora de generación, ya formateada
 * @param {Object}   [params.svgs]     - { [src]: '<svg…>' } contenido de las figuras
 * @param {Object}   [params.logos]    - { escudo?: '<svg…>', insignia?: 'data:image/png;base64,…' }
 * @returns {object} docDefinition
 */
export function buildReglamentoGeneralDoc({ sections = [], orgName = '', version = '', fecha = '', generadoEl, svgs = {}, logos = {} }) {
    const indice = sections.map((s, i) => ({ text: `${i + 1}. ${sinEmoji(s.title)}`, style: 'indice' }));

    const cuerpo = [];
    sections.forEach((seccion, i) => {
        const n = i + 1;
        cuerpo.push({ text: `${n}. ${sinEmoji(seccion.title)}`, style: 'seccion', pageBreak: 'before' });

        (seccion.content || []).forEach((bloque, j) => {
            const nb = `${n}.${j + 1}`;
            cuerpo.push({ text: `${nb} ${sinEmoji(bloque.subtitle)}`, style: 'bloque' });

            if (bloque.type === 'table') {
                const filas = (bloque.rows || []).map(r => (Array.isArray(r) ? r : r.cells || []));
                cuerpo.push({
                    table: {
                        headerRows: 1,
                        widths: (bloque.headers || []).map((_, k) => (k === 0 ? '*' : 'auto')),
                        body: [
                            (bloque.headers || []).map(h => ({ text: sinEmoji(h), style: 'cabecera' })),
                            ...filas.map(f => f.map((c, k) => ({ text: sinEmoji(c), style: k === 0 ? 'celdaFuerte' : 'celda' }))),
                        ],
                    },
                    layout: {
                        hLineColor: () => TEMA.borde,
                        vLineWidth: () => 0,
                        hLineWidth: (k) => (k === 1 ? 1 : 0.5),
                        paddingTop: () => 4,
                        paddingBottom: () => 4,
                    },
                    margin: [0, 2, 0, 10],
                });
            } else {
                (bloque.items || []).forEach((item, k) => {
                    cuerpo.push({
                        columns: [
                            { text: `${nb}.${k + 1}`, width: 38, style: 'numero' },
                            { text: sinEmoji(item), width: '*', style: 'item' },
                        ],
                        columnGap: 6,
                        margin: [0, 0, 0, 5],
                    });
                });
            }

            (bloque.figuras || []).forEach(fig => {
                const svg = svgs[fig.src];
                if (!svg) return;
                cuerpo.push({ svg, width: 440, alignment: 'center', margin: [0, 6, 0, 2] });
                cuerpo.push({ text: `Figura · ${fig.alt}`, style: 'pie', margin: [0, 0, 0, 10] });
            });
        });
    });

    return {
        pageSize: 'A4',
        pageMargins: [48, 56, 48, 56],
        info: { title: `Reglamento General${orgName ? ` — ${orgName}` : ''}` },
        header: (pagina) => (pagina === 1 ? null : {
            columns: [
                { text: `Reglamento General${orgName ? ` · ${sinEmoji(orgName)}` : ''}${version ? ` · v${version}` : ''}`, style: 'cabeceraPagina', margin: [0, 6, 0, 0] },
                logos.escudo ? { svg: logos.escudo, width: 26, alignment: 'right' } : { text: '' },
            ],
            margin: [48, 18, 48, 0],
        }),
        footer: (pagina, total) => ({
            columns: [
                { text: `Generado el ${generadoEl}`, style: 'piePagina' },
                { text: `${pagina} / ${total}`, style: 'piePagina', alignment: 'right' },
            ],
            margin: [48, 16, 48, 0],
        }),
        content: [
            // Portada: escudo del campeonato y, si la hay, la insignia del organizador
            (logos.escudo || logos.insignia) ? {
                columns: [
                    { width: '*', text: '' },
                    ...(logos.escudo ? [{ svg: logos.escudo, width: 150 }] : []),
                    ...(logos.insignia ? [{ image: logos.insignia, width: 130, margin: [24, 10, 0, 0] }] : []),
                    { width: '*', text: '' },
                ],
                margin: [0, 40, 0, 0],
            } : null,
            { text: 'Reglamento General', style: 'portada', alignment: (logos.escudo || logos.insignia) ? 'center' : 'left', margin: (logos.escudo || logos.insignia) ? [0, 36, 0, 6] : undefined },
            orgName ? { text: sinEmoji(orgName), style: 'portadaOrg', alignment: (logos.escudo || logos.insignia) ? 'center' : 'left' } : null,
            { text: [version ? `Versión ${version}` : '', version && fecha ? ' · ' : '', fecha ? `Actualizado el ${fecha}` : ''].join(''), style: 'portadaMeta', alignment: (logos.escudo || logos.insignia) ? 'center' : 'left' },
            { text: 'Índice', style: 'bloque', margin: [0, 24, 0, 6], pageBreak: (logos.escudo || logos.insignia) ? 'before' : undefined },
            ...indice,
            { text: 'Los artículos se citan con su numeración (por ejemplo, 5.3.2). El reglamento de cada campeonato prevalece sobre este en lo que regule de forma distinta.', style: 'nota', margin: [0, 16, 0, 0] },
            ...cuerpo,
        ].filter(Boolean),
        defaultStyle: { font: 'Roboto', fontSize: 9.5, color: TEMA.texto, lineHeight: 1.25 },
        styles: {
            portada: { fontSize: 26, bold: true, color: TEMA.titulo, margin: [0, 120, 0, 6] },
            portadaOrg: { fontSize: 14, color: TEMA.acento, bold: true },
            portadaMeta: { fontSize: 10, color: TEMA.suave, margin: [0, 4, 0, 0] },
            indice: { fontSize: 11, margin: [0, 2, 0, 2] },
            nota: { fontSize: 9, italics: true, color: TEMA.suave },
            seccion: { fontSize: 16, bold: true, color: TEMA.titulo, margin: [0, 0, 0, 10] },
            bloque: { fontSize: 11, bold: true, color: TEMA.acento, margin: [0, 10, 0, 6] },
            numero: { fontSize: 8.5, bold: true, color: TEMA.acento },
            item: { fontSize: 9.5 },
            cabecera: { fontSize: 8.5, bold: true, color: TEMA.suave },
            celda: { fontSize: 9 },
            celdaFuerte: { fontSize: 9, bold: true, color: TEMA.titulo },
            pie: { fontSize: 8, italics: true, color: TEMA.suave, alignment: 'center' },
            cabeceraPagina: { fontSize: 8, color: TEMA.suave },
            piePagina: { fontSize: 8, color: TEMA.suave },
        },
    };
}

/** Nombre de archivo: reglamento-general-<org>-v<version>.pdf */
export function reglamentoGeneralFilename(orgName = '', version = '') {
    const slug = String(orgName || 'organizacion').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `reglamento-general-${slug}${version ? `-v${version}` : ''}.pdf`;
}
