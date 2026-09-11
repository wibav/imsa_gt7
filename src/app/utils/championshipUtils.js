/**
 * Utilidades de campeonatos compartidas
 * Centraliza lógica duplicada de progreso, próxima carrera y clasificaciones
 */
import { preQualyEnd } from './dateUtils';

/**
 * Calcula el progreso del campeonato basado en tracks completadas
 * Una track se considera completada si tiene puntos asignados
 * Fallback: usa fechas de inicio/fin si no hay tracks
 * 
 * @param {Array} tracks - Array de pistas del campeonato
 * @param {Object} championship - Datos del campeonato (para fechas como fallback)
 * @returns {{ completed: number, total: number, percentage: number }}
 */
export const calculateProgress = (tracks, championship) => {
    if (!tracks || tracks.length === 0) {
        // Si no hay tracks, calcular por fechas si están disponibles
        if (championship?.startDate && championship?.endDate) {
            const now = new Date();
            const start = new Date(championship.startDate.includes('T') ? championship.startDate : championship.startDate + 'T00:00:00');
            const end = new Date(championship.endDate.includes('T') ? championship.endDate : championship.endDate + 'T00:00:00');

            if (now < start) return { completed: 0, total: 0, percentage: 0 };
            if (now > end || championship.status === 'completed') {
                return { completed: 0, total: 0, percentage: 100 };
            }

            const total = end.getTime() - start.getTime();
            const elapsed = now.getTime() - start.getTime();
            const percentage = Math.round((elapsed / total) * 100);

            return { completed: 0, total: 0, percentage: Math.min(100, Math.max(0, percentage)) };
        }

        return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = tracks.filter(track =>
        track.points && Object.keys(track.points).length > 0
    ).length;

    const total = tracks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
};

/**
 * Obtiene la próxima carrera (incluyendo hoy si no está completada)
 * 
 * @param {Array} tracks - Array de pistas del campeonato
 * @returns {Object|null} Próxima pista o null
 */
/**
 * Mapa `nombre o psnId` → `GT7 ID`, a partir de las inscripciones.
 *
 * Todo el modelo se cruza por nombre (no hay ids relacionales) y ese nombre
 * puede ser el psnId, el nombre real o el gt7Id según cómo se inscribiera
 * cada piloto. Para que las listas no muestren unas veces el PSN y otras el
 * GT7 ID, se cotejan contra las inscripciones y se muestra siempre el GT7 ID.
 *
 * Acepta un campeonato o una lista (la página de pilotos agrega varios).
 *
 * El segundo argumento son las identidades fusionadas a mano desde
 * /pilotsAdmin (colección `pilotIdentities`). Se aplican DESPUÉS de las
 * inscripciones y mandan sobre ellas: una fusión confirmada por el
 * Administrador de Plataforma sabe más que lo que se tecleó al inscribirse.
 *
 * Sin identidades el resultado es exactamente el de antes: la fusión es
 * aditiva y no puede alterar el histórico por sí sola.
 *
 * @param {Object|Array} championships
 * @param {Array} [identities] - Documentos de `pilotIdentities`
 * @returns {Object} { [nombreOPsn]: gt7Id }
 */
export const buildGt7IdMap = (championships, identities = []) => {
    const lista = Array.isArray(championships) ? championships : [championships];
    const map = {};
    lista.filter(Boolean).forEach(champ => {
        (champ.registrations || []).forEach(reg => {
            // Inscripción de equipo: cada piloto trae sus propios ids
            const entradas = Array.isArray(reg.drivers) && reg.drivers.length > 0
                ? reg.drivers
                : [reg];
            entradas.forEach(e => {
                if (!e.gt7Id) return;
                [e.name, e.psnId].forEach(alias => {
                    if (alias && alias !== e.gt7Id) map[alias] = e.gt7Id;
                });
            });
        });
    });
    return applyPilotIdentities(map, identities);
};

/**
 * Superpone las identidades fusionadas sobre un mapa de alias.
 *
 * Además de mapear cada alias al nombre canónico, reescribe las entradas que
 * ya apuntaban a un alias fusionado: si las inscripciones decían
 * `Dayo → Hgt_dayo21` y la identidad canoniza `Hgt_dayo21 → HGT_dayo21`,
 * `Dayo` tiene que acabar en `HGT_dayo21`, no quedarse a medio camino.
 *
 * @param {Object} map - Mapa alias → nombre (se copia, no se muta)
 * @param {Array} identities
 */
export const applyPilotIdentities = (map = {}, identities = []) => {
    if (!identities || identities.length === 0) return map;

    const resultado = { ...map };
    const canonicoDe = {};

    identities.filter(Boolean).forEach(ident => {
        const canonical = String(ident.canonical || '').trim();
        if (!canonical) return;
        (ident.aliases || []).forEach(alias => {
            const limpio = String(alias || '').trim();
            if (!limpio || limpio === canonical) return;
            canonicoDe[limpio] = canonical;
        });
    });

    Object.entries(canonicoDe).forEach(([alias, canonical]) => {
        resultado[alias] = canonical;
    });

    // Segundo paso: encadenar los alias que apuntaban a un nombre ya fusionado.
    Object.keys(resultado).forEach(alias => {
        const destino = resultado[alias];
        if (canonicoDe[destino]) resultado[alias] = canonicoDe[destino];
    });

    return resultado;
};

/** Nombre a mostrar de un piloto: su GT7 ID si se conoce. */
export const displayDriverName = (name, gt7Map = {}) => gt7Map[name] || name;

/**
 * Próximo evento del campeonato: la Pre-Qualy si está pendiente y cae antes
 * que la siguiente carrera, o la carrera en caso contrario.
 *
 * La Pre-Qualy sigue anunciada mientras no haya terminado su franja, o
 * mientras no tenga resultados. Mirar solo los resultados no bastaba: en una
 * franja larga ("de 21:00 a 00:30") los tiempos se cargan a medida que se
 * corre, y con el primero la tarjeta ya saltaba a la Ronda 1 en plena
 * Pre-Qualy.
 *
 * @returns {{tipo: 'prequaly'|'carrera', date: string, name: string, track?: Object}|null}
 */
export const getNextEvent = (championship, tracks) => {
    const nextRace = getNextRace(tracks);

    const pq = championship?.preQualy;
    const fin = preQualyEnd(championship);
    const pqPendiente = pq?.enabled
        && pq.date
        && ((fin && new Date() < fin) || (pq.results || []).length === 0);

    if (pqPendiente) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaPq = new Date(pq.date + 'T00:00:00');
        // Mientras la franja siga abierta no ha pasado, aunque el día sí: la
        // de 21:00 a 00:30 sigue en marcha a las 00:10 del día siguiente.
        const yaPaso = fechaPq < hoy && !(fin && new Date() < fin);
        const antesQueLaCarrera = !nextRace || fechaPq <= new Date(nextRace.date + 'T00:00:00');
        // Pasado su día, deja de anunciarse aunque falten resultados: la
        // tarjeta pasa a la siguiente carrera.
        if (!yaPaso && antesQueLaCarrera) {
            return { tipo: 'prequaly', date: pq.date, name: pq.track || 'Pre-Qualy', prequaly: pq };
        }
    }

    return nextRace ? { tipo: 'carrera', date: nextRace.date, name: nextRace.name, track: nextRace } : null;
};

/**
 * Estado de las inscripciones de un campeonato.
 *
 * Existe porque la lógica estaba duplicada y divergía: la tarjeta miraba plazo
 * y cupos, y el panel de la página de detalle solo miraba `enabled` y el
 * estado — así que un campeonato ya disputado seguía ofreciendo "Inscribirme".
 *
 * Un campeonato con todas las carreras puntuadas se considera terminado
 * aunque su `status` siga en "active": nadie cambia el estado a mano al
 * acabar la última carrera, y ese es justo el caso que se colaba.
 *
 * @param {Object} championship
 * @param {Array} tracks - Pistas del campeonato (para saber si ya se corrió)
 * @returns {{abierta: boolean, motivo: string|null, etiqueta: string,
 *            inscritos: number, cupos: number}}
 */
export const getRegistrationState = (championship, tracks = []) => {
    const reg = championship?.registration || {};
    const cupos = reg.maxParticipants || 0;

    const inscritos = (championship?.registrations || []).filter(
        r => r.status === 'approved' || (!reg.requiresApproval && r.status !== 'rejected')
    ).length;

    const cerrada = (motivo, etiqueta) => ({ abierta: false, motivo, etiqueta, inscritos, cupos });

    if (!reg.enabled) return cerrada('deshabilitada', 'Inscripción cerrada');
    if (['completed', 'archived'].includes(championship?.status)) {
        return cerrada('finalizado', 'Campeonato finalizado');
    }

    const progreso = calculateProgress(tracks, championship);
    if (tracks.length > 0 && progreso.completed >= progreso.total) {
        return cerrada('finalizado', 'Campeonato finalizado');
    }

    if (reg.deadline && new Date() > new Date(reg.deadline + 'T23:59:59')) {
        return cerrada('plazo', 'Plazo de inscripción vencido');
    }
    if (cupos > 0 && inscritos >= cupos) return cerrada('completo', 'Inscripción cerrada');

    return { abierta: true, motivo: null, etiqueta: 'Inscripción abierta', inscritos, cupos };
};

export const getNextRace = (tracks) => {
    if (!tracks || tracks.length === 0) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcomingRaces = tracks
        .filter(t => {
            const trackDate = new Date(t.date + 'T00:00:00');
            return trackDate >= now && t.status !== 'completed';
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    return upcomingRaces[0] || null;
};

/**
 * Calcula la clasificación del campeonato
 * FUENTE ÚNICA DE VERDAD: los puntos siempre se calculan desde track.points[driverName]
 * 
 * @param {Object} championship - Datos del campeonato
 * @param {Array} teams - Equipos del campeonato
 * @param {Array} tracks - Pistas con resultados
 * @returns {Array} Clasificación ordenada por puntos descendente
 */
export const getStandings = (championship, teams, tracks) => {
    if (!championship) return [];

    if (championship.settings?.isTeamChampionship) {
        // Clasificación por equipos - puntos = suma de puntos de cada driver en cada track
        return teams.map(team => {
            const totalPoints = (team.drivers || []).reduce((sum, driver) => {
                const driverName = driver.name;
                const pointsFromTracks = tracks.reduce(
                    (acc, track) => acc + (track.points?.[driverName] || 0), 0
                );
                return sum + pointsFromTracks;
            }, 0);

            return {
                name: team.name,
                color: team.color,
                points: totalPoints,
                drivers: team.drivers || []
            };
        }).sort((a, b) => b.points - a.points);
    }

    // Clasificación individual
    if (championship.drivers && championship.drivers.length > 0) {
        return championship.drivers.map(driver => {
            const driverName = typeof driver === 'string' ? driver : driver.name;
            const driverCategory = typeof driver === 'string' ? '' : driver.category;

            // Puntos desde las pistas (fuente única)
            const points = tracks.reduce(
                (total, track) => total + (track.points?.[driverName] || 0), 0
            );

            return {
                name: driverName,
                category: driverCategory,
                points
            };
        }).sort((a, b) => b.points - a.points);
    }

    // Fallback: pilotos desde equipos (campeonatos viejos migrados)
    // También usa track.points como fuente de verdad
    const allDrivers = teams.flatMap(team =>
        (team.drivers || []).map(driver => {
            const driverName = driver.name;
            const pointsFromTracks = tracks.reduce(
                (acc, track) => acc + (track.points?.[driverName] || 0), 0
            );

            return {
                name: driverName,
                team: team.name,
                teamColor: team.color,
                category: driver.category,
                points: pointsFromTracks
            };
        })
    );
    return allDrivers.sort((a, b) => b.points - a.points);
};

/**
 * Obtiene la clasificación individual de pilotos para campeonatos por equipos
 * CORRIGE BUG: usaba Object.values(driver.points) en vez de track.points[driverName]
 * Ahora usa la misma fuente de verdad que getStandings()
 * 
 * @param {Object} championship - Datos del campeonato
 * @param {Array} teams - Equipos del campeonato
 * @param {Array} tracks - Pistas con resultados
 * @returns {Array} Pilotos ordenados por puntos
 */
export const getDriverStandings = (championship, teams, tracks) => {
    if (!championship) return [];

    let allDrivers = [];

    if (championship.settings?.isTeamChampionship || teams.length > 0) {
        // Campeonatos por equipos: calcular puntos desde track.points (fuente única)
        allDrivers = teams.flatMap(team =>
            (team.drivers || []).map(driver => {
                const driverName = driver.name;
                // FIX: Usar track.points[driverName] en vez de Object.values(driver.points)
                const points = tracks.reduce(
                    (total, track) => total + (track.points?.[driverName] || 0), 0
                );

                return {
                    name: driverName,
                    team: team.name,
                    teamColor: team.color,
                    category: driver.category,
                    points
                };
            })
        );
    } else if (championship.drivers && championship.drivers.length > 0) {
        // Campeonatos individuales
        allDrivers = championship.drivers.map(driver => {
            const driverName = typeof driver === 'string' ? driver : driver.name;
            const driverCategory = typeof driver === 'string' ? '' : driver.category;

            const points = tracks.reduce(
                (total, track) => total + (track.points?.[driverName] || 0), 0
            );

            return {
                name: driverName,
                category: driverCategory,
                points
            };
        });
    }

    return allDrivers.sort((a, b) => b.points - a.points);
};

/**
 * Estado real de una carrera.
 *
 * `track.status` lo pone quien crea el calendario y nadie lo vuelve a tocar al
 * correr la carrera, así que en el Campeonato de Verano las seis carreras
 * seguían en "scheduled" con sus 30 puntos cargados y el calendario las
 * marcaba como "Pendiente" con el campeonato ya terminado.
 *
 * Una carrera con puntos o posiciones cargadas está disputada, diga lo que
 * diga el campo. Es el mismo criterio que ya usa calculateProgress().
 *
 * @returns {'completada'|'en-curso'|'pendiente'|'programada'}
 */
export const estadoCarrera = (track) => {
    if (!track) return 'programada';

    const tienePuntos = track.points && Object.keys(track.points).length > 0;
    const tienePosiciones = Object.keys(track.results?.racePositions || {}).length > 0
        || Object.values(track.results?.divisions || {})
            .some(div => Object.keys(div?.racePositions || {}).length > 0);

    if (track.status === 'completed' || tienePuntos || tienePosiciones) return 'completada';
    if (track.status === 'in-progress') return 'en-curso';

    if (track.date) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (new Date(track.date + 'T00:00:00') < hoy) return 'pendiente';
    }
    return 'programada';
};
