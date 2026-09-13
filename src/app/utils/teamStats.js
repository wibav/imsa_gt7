import { miembrosActuales } from './teamTagMatcher.js';

/**
 * Estadísticas de un equipo: la suma del historial COMPLETO de sus miembros
 * actuales (decisión del 2026-09-13). Si un piloto entra hoy, sus podios de
 * antes cuentan para el equipo; si se va, sus números salen del total. Los
 * ex-miembros se muestran, pero no suman.
 *
 * Parte de las mismas estadísticas que la página de Pilotos
 * (cargarEstadisticasPilotos), así que el total del equipo cuadra con lo que
 * cada piloto ve en su perfil.
 *
 * @param {Object} equipo - Documento de racingTeams
 * @param {Array} statsPilotos - statsArray de cargarEstadisticasPilotos
 */
export function estadisticasDeEquipo(equipo, statsPilotos = []) {
    const buscar = (nombre) => statsPilotos.find(p => p.name === nombre || (p.aliases || []).includes(nombre));

    const plantilla = miembrosActuales(equipo)
        .map(m => ({ ...m, stats: buscar(m.pilot) || null }))
        .sort((a, b) => (b.stats?.totalPoints || 0) - (a.stats?.totalPoints || 0) || a.pilot.localeCompare(b.pilot));

    const exMiembros = (equipo?.members || [])
        .filter(m => m?.pilot && m.to)
        .sort((a, b) => String(b.to).localeCompare(String(a.to)));

    const total = {
        pilotos: plantilla.length,
        puntos: 0, victorias: 0, podios: 0, carreras: 0, poles: 0, titulos: 0,
    };
    const campeonatos = new Map(); // id → {id, name, season, status, pilotos, mejor}
    const eventos = new Map();     // id → {id, title, date, pilotos, mejor}

    plantilla.forEach(({ pilot, stats }) => {
        if (!stats) return;
        total.puntos += stats.totalPoints || 0;
        total.victorias += stats.totalWins || 0;
        total.podios += stats.totalPodiums || 0;
        total.carreras += stats.totalRaces || 0;
        total.poles += stats.totalPoles || 0;
        total.titulos += stats.championsCount || 0;

        (stats.championships || []).forEach(c => {
            const e = campeonatos.get(c.id) || { id: c.id, name: c.name, season: c.season, status: c.status, pilotos: [], mejor: null };
            e.pilotos.push(pilot);
            if (c.finalPosition && (!e.mejor || c.finalPosition < e.mejor.posicion)) {
                e.mejor = { pilot, posicion: c.finalPosition, de: c.totalDrivers };
            }
            campeonatos.set(c.id, e);
        });

        (stats.events || []).forEach(ev => {
            const e = eventos.get(ev.id) || { id: ev.id, title: ev.title, date: ev.date, pilotos: [], mejor: null };
            e.pilotos.push(pilot);
            if (ev.position != null && (!e.mejor || ev.position < e.mejor.posicion)) {
                e.mejor = { pilot, posicion: ev.position };
            }
            eventos.set(ev.id, e);
        });
    });

    const listaEventos = [...eventos.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    total.campeonatos = campeonatos.size;
    total.eventos = eventos.size;
    total.victoriasEventos = listaEventos.filter(e => e.mejor?.posicion === 1).length;

    return {
        total,
        plantilla,
        exMiembros,
        campeonatos: [...campeonatos.values()],
        eventos: listaEventos,
    };
}
