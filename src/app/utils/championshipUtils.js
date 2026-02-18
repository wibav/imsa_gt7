/**
 * Utilidades de campeonatos compartidas
 * Centraliza lógica duplicada de progreso, próxima carrera y clasificaciones
 */

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
            const start = new Date(championship.startDate + 'T00:00:00');
            const end = new Date(championship.endDate + 'T00:00:00');

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
