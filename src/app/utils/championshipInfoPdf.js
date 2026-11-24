/**
 * PDF con toda la información de un campeonato para los pilotos: datos
 * generales, calendario, Pre-Qualy, salas, autos y reglamento.
 *
 * Módulo puro (JSON para pdfmake): no importa pdfmake. Los textos llegan
 * traducidos con `t` (claves formularios.pdfInfo.*) para que el PDF salga en
 * el idioma en que el piloto ve la web.
 */
import { buildChampionshipHeader, PDF_THEME } from './regulationsPdf.js';
import { getRaceTime, getPreQualySessions, formatTimeWindow, formatDateFull } from './dateUtils.js';

const seccion = (texto) => ({ text: texto, style: 'sectionHeading', margin: [0, 16, 0, 8] });

const tabla = (cabecera, filas, widths) => ({
    table: {
        headerRows: 1,
        widths,
        body: [
            cabecera.map(c => ({ text: c, bold: true, color: PDF_THEME.heading, fontSize: 9 })),
            ...filas.map(f => f.map(c => ({ text: c == null || c === '' ? '—' : String(c), fontSize: 9 }))),
        ],
    },
    layout: 'lightHorizontalLines',
});

const parDatos = (etiqueta, valor) => (valor
    ? [{ text: etiqueta, bold: true, color: PDF_THEME.muted, fontSize: 9 }, { text: String(valor), fontSize: 9 }]
    : null);

/**
 * @param {object} params
 * @param {object} params.championship
 * @param {object|null} [params.org]
 * @param {Array} [params.tracks]
 * @param {Array} [params.divisions]
 * @param {Array|null} [params.regulationsContent] - nodos pdfmake del reglamento (o null si no hay)
 * @param {string} params.generatedAt
 * @param {object} [params.logos]
 * @param {Function} params.t - (clave, vars) → texto; claves relativas a formularios.pdfInfo
 * @param {string} [params.lang]
 * @param {string} [params.locale]
 */
export function buildChampionshipInfoDocDefinition({
    championship, org = null, tracks = [], divisions = [], regulationsContent = null,
    generatedAt, logos = {}, t, lang = 'es', locale = 'es-ES',
}) {
    const champ = championship || {};
    const content = [...buildChampionshipHeader({ championship: champ, org, logos })];

    // ── Datos generales ────────────────────────────────────────────────
    const fechas = [champ.startDate, champ.endDate].filter(Boolean).map(d => formatDateFull(d, locale)).join(' – ');
    const datos = [
        parDatos(t('temporada'), champ.season),
        parDatos(t('fechas'), fechas),
        parDatos(t('tipo'), champ.settings?.isTeamChampionship ? t('equipos') : t('individual')),
        parDatos(t('categorias'), (champ.categories || []).join(' · ')),
        parDatos(t('organizacion'), org?.name),
    ].filter(Boolean);
    content.push(seccion(t('datos')));
    if (datos.length) {
        content.push({ table: { widths: [110, '*'], body: datos }, layout: 'noBorders' });
    }
    if (champ.description) content.push({ text: champ.description, margin: [0, 8, 0, 0] });

    // ── Calendario ─────────────────────────────────────────────────────
    const carreras = [...tracks].sort((a, b) => (a.round || 0) - (b.round || 0));
    const conAutos = carreras.some(tr => tr.specificCars && (tr.allowedCars || []).length > 0);
    content.push(seccion(t('calendario')));
    if (carreras.length === 0) {
        content.push({ text: t('sinCalendario'), color: PDF_THEME.muted });
    } else {
        const formato = (tr) => (tr.raceType === 'resistencia' && tr.duration
            ? t('minutos', { n: tr.duration })
            : tr.laps ? t('vueltas', { n: tr.laps }) : '');
        const cabecera = [t('ronda'), t('fecha'), t('hora'), t('circuito'), t('formato')];
        const widths = [35, 60, 45, '*', 60];
        if (conAutos) { cabecera.push(t('autosCarrera')); widths.push(110); }
        content.push(tabla(
            cabecera,
            carreras.map(tr => {
                const fila = [
                    tr.round ? `R${tr.round}` : '',
                    tr.date ? formatDateFull(tr.date, locale) : '',
                    tr.date ? `${getRaceTime(champ, tr)}h` : '',
                    tr.name,
                    formato(tr),
                ];
                if (conAutos) fila.push(tr.specificCars ? (tr.allowedCars || []).join(', ') : '');
                return fila;
            }),
            widths,
        ));
        content.push({ text: t('horaEspana'), fontSize: 8, color: PDF_THEME.muted, margin: [0, 4, 0, 0] });
    }

    // ── Pre-Qualy ──────────────────────────────────────────────────────
    const pq = champ.preQualy;
    if (pq?.enabled) {
        content.push(seccion(t('preQualy')));
        const sesiones = getPreQualySessions(champ);
        const lineas = [];
        if (pq.track) lineas.push(`${t('circuito')}: ${pq.track}`);
        sesiones.forEach(s => lineas.push(`• ${formatDateFull(s.date, locale)} ${formatTimeWindow(s, lang)}`));
        content.push({ stack: lineas.map(l => ({ text: l })) });
    }

    // ── Salas ──────────────────────────────────────────────────────────
    const salas = [...divisions].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (salas.length > 0) {
        content.push(seccion(t('salas')));
        content.push(tabla(
            [t('sala'), t('hora'), t('pilotos')],
            salas.map(d => [d.name, d.hour ? `${d.hour}h` : '', (d.drivers || []).length]),
            ['*', 60, 60],
        ));
    }

    // ── Autos ──────────────────────────────────────────────────────────
    const autos = champ.carUsageTracking;
    if (autos?.enabled) {
        content.push(seccion(t('autos')));
        if (autos.mode === 'fixed') {
            content.push({ text: t('autosFijo', { n: autos.maxUsesPerCar ?? 1 }), margin: [0, 0, 0, 6] });
            content.push({ ul: (autos.carCatalog || []).map(c => ({ text: c })) });
        } else {
            content.push({ text: t('autosDeclarados', { autos: autos.maxCarsPerDriver ?? 3, usos: autos.maxUsesPerCar ?? 2 }) });
            if (autos.declarationDeadline) {
                content.push({ text: `${t('plazoDeclaracion')}: ${formatDateFull(autos.declarationDeadline, locale)}`, margin: [0, 4, 0, 0] });
            }
            if ((autos.carCatalog || []).length > 0) {
                content.push({ ul: autos.carCatalog.map(c => ({ text: c })), margin: [0, 6, 0, 0] });
            }
        }
    }

    // ── Reglamento ─────────────────────────────────────────────────────
    if (regulationsContent) {
        content.push({ text: t('reglamento'), style: 'sectionHeading', pageBreak: 'before', margin: [0, 0, 0, 10] });
        content.push(...(Array.isArray(regulationsContent) ? regulationsContent : [regulationsContent]));
    }

    return {
        pageSize: 'A4',
        pageMargins: [40, 50, 40, 50],
        defaultStyle: { fontSize: 10, color: PDF_THEME.text, lineHeight: 1.3 },
        styles: {
            title: { fontSize: 16, bold: true, color: PDF_THEME.heading },
            subtitle: { fontSize: 9, color: PDF_THEME.muted },
            sectionHeading: { fontSize: 13, bold: true, color: PDF_THEME.accent },
        },
        content,
        footer: (currentPage, pageCount) => ({
            text: t('pie', { pagina: currentPage, total: pageCount, fecha: generatedAt }),
            style: { fontSize: 7, color: PDF_THEME.muted },
            alignment: 'center',
            margin: [40, 10, 40, 0],
        }),
    };
}

/** «info-gr4-endurance-cup-2-edt-2027.pdf» */
export function championshipInfoFilename(championship) {
    const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = slug(championship?.shortName || championship?.name) || 'campeonato';
    const temporada = slug(championship?.season);
    return `${`info-${base}${temporada ? `-${temporada}` : ''}`.slice(0, 76)}.pdf`;
}
