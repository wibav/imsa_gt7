/**
 * Motor de clasificación avanzado para campeonatos GT7.
 * 
 * Características:
 * - Desempate multinivel: puntos → victorias → podiums → mejor posición
 * - Estadísticas por piloto: wins, podiums, poles, fastestLaps, DNFs
 * - Puntos desglosados por carrera (racePoints[])
 * - Soporte para campeonatos por equipos e individuales
 * - Compatible con track.results (source of truth para posiciones)
 *   y track.points (fallback para puntos totales)
 * 
 * Portado y adaptado de hgt_gt7/standingsCalculator.js
 */

/**
 * Calcula la clasificación avanzada con estadísticas y desempate.
 * Usa track.results.racePositions como fuente de posiciones detalladas
 * y track.points como fuente de puntos totales.
 *
 * @param {Object} championship - Datos del campeonato
 * @param {Array} teams - Equipos del campeonato
 * @param {Array} tracks - Pistas con points/results
 * @param {Array} [penalties] - Sanciones aplicadas (opcional)
 * @param {Object} [options] - Opciones adicionales
 * @param {Array<string>} [options.divisionDrivers] - Filtrar solo estos pilotos (Fase 6: divisiones)
 * @returns {{ 
 *   driverStandings: Array, 
 *   teamStandings: Array, 
 *   raceColumns: Array<{round, name, trackId}> 
 * }}
 */
export function calculateAdvancedStandings(championship, teams, tracks, penalties = [], options = {}) {
    if (!championship) {
        return { driverStandings: [], teamStandings: [], raceColumns: [] };
    }

    // Ordenar tracks por round
    const sortedTracks = [...tracks]
        .filter(t => t.points && Object.keys(t.points).length > 0)
        .sort((a, b) => (a.round || 0) - (b.round || 0));

    // Columnas de carreras (para la tabla)
    const raceColumns = sortedTracks.map(t => ({
        round: t.round,
        name: t.name,
        trackId: t.id,
        date: t.date,
        category: t.category,
        raceType: t.raceType || 'carrera'
    }));

    // Recopilar todos los drivers
    let allDrivers = getAllDrivers(championship, teams);

    // Fase 6: Filtrar por división si se especifica
    if (options.divisionDrivers && options.divisionDrivers.length > 0) {
        const divSet = new Set(options.divisionDrivers);
        allDrivers = allDrivers.filter(d => divSet.has(d.name));
    }

    // Inicializar mapa de stats
    const driverStats = {};
    allDrivers.forEach(driver => {
        driverStats[driver.name] = {
            name: driver.name,
            team: driver.team || '',
            teamColor: driver.teamColor || '',
            category: driver.category || '',
            totalPoints: 0,
            wins: 0,
            podiums: 0,
            poles: 0,
            fastestLaps: 0,
            dnfs: 0,
            races: 0,
            bestPosition: null,
            racePoints: [],    // Array de puntos por carrera (en orden de raceColumns)
            racePositions: [],  // Array de posiciones por carrera
            penaltyPoints: 0,   // Puntos deducidos por sanciones
            warningPoints: 0,   // Puntos de amonestación acumulados
            penalties: []       // Lista de sanciones aplicadas
        };
    });

    // Procesar cada track
    sortedTracks.forEach((track) => {
        const results = track.results || {};
        const racePositions = results.racePositions || {};
        const pointsMap = track.points || {};
        const sprintPointsMap = track.sprintPoints || {};
        const qualyData = results.qualifying || {};
        const fastestLap = results.fastestLap || {};
        const isSprint = track.raceType === 'sprint_carrera';

        // Para cada driver, calcular stats de esta carrera
        Object.keys(driverStats).forEach(driverName => {
            const stat = driverStats[driverName];

            // Obtener posición de carrera
            const positionStr = racePositions[driverName];
            const position = positionStr ? parseInt(positionStr) : null;
            const racePoints = pointsMap[driverName] || 0;
            const sprintPts = isSprint ? (sprintPointsMap[driverName] || 0) : 0;
            const points = racePoints + sprintPts;

            // Si no participó en esta carrera
            if (!position && points === 0) {
                stat.racePoints.push(null);
                stat.racePositions.push(null);
                return;
            }

            // Registrar puntos y posición
            stat.racePoints.push(points);
            stat.racePositions.push(position);
            stat.totalPoints += points;
            stat.races += 1;

            if (position) {
                // Estadísticas basadas en posición
                if (position === 1) stat.wins += 1;
                if (position <= 3) stat.podiums += 1;

                // Mejor posición
                if (stat.bestPosition === null || position < stat.bestPosition) {
                    stat.bestPosition = position;
                }
            }

            // DNF: posición "DNF", "DSQ", o posición > 90
            if (positionStr && (
                positionStr.toString().toUpperCase() === 'DNF' ||
                positionStr.toString().toUpperCase() === 'DSQ' ||
                positionStr.toString().toUpperCase() === 'DNS' ||
                (position && position > 90)
            )) {
                stat.dnfs += 1;
            }

            // Pole position
            if (qualyData?.top3?.first === driverName) {
                stat.poles += 1;
            }

            // Vuelta rápida
            if (fastestLap?.driver === driverName) {
                stat.fastestLaps += 1;
            }
        });
    });

    // ── Aplicar sanciones ──
    const activePenalties = penalties.filter(p => p.status === 'applied');
    activePenalties.forEach(penalty => {
        const stat = driverStats[penalty.driverName];
        if (stat) {
            stat.penaltyPoints += (penalty.points || 0);
            stat.warningPoints += (penalty.warningPoints || 0);
            stat.totalPoints -= (penalty.points || 0);
            stat.penalties.push(penalty);
        }
    });

    // ── Amonestaciones acumulativas ──
    if (championship.penaltiesConfig?.enabled && championship.penaltiesConfig?.warningThreshold > 0) {
        const threshold = championship.penaltiesConfig.warningThreshold;
        const autoPenalty = championship.penaltiesConfig.autoPointsPenalty || 10;
        Object.values(driverStats).forEach(stat => {
            if (stat.warningPoints >= threshold) {
                const timesTriggered = Math.floor(stat.warningPoints / threshold);
                const autoDeduction = timesTriggered * autoPenalty;
                stat.totalPoints -= autoDeduction;
                stat.penaltyPoints += autoDeduction;
            }
        });
    }

    // Ordenar drivers con desempate multinivel
    const driverStandings = Object.values(driverStats)
        .filter(d => d.races > 0 || d.totalPoints > 0 || d.penaltyPoints > 0)
        .sort((a, b) => {
            // 1. Total de puntos (desc)
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            // 2. Victorias (desc)
            if (b.wins !== a.wins) return b.wins - a.wins;
            // 3. Podiums (desc)
            if (b.podiums !== a.podiums) return b.podiums - a.podiums;
            // 4. Mejor posición (asc — menor es mejor)
            return (a.bestPosition || 999) - (b.bestPosition || 999);
        });

    // Calcular standings por equipos
    let teamStandings = [];
    if (championship.settings?.isTeamChampionship && teams.length > 0) {
        teamStandings = teams.map(team => {
            const teamDriverNames = (team.drivers || []).map(d => d.name);
            const teamDriverStats = teamDriverNames
                .map(name => driverStats[name])
                .filter(Boolean);

            const totalPoints = teamDriverStats.reduce((sum, d) => sum + d.totalPoints, 0);
            const wins = teamDriverStats.reduce((sum, d) => sum + d.wins, 0);
            const podiums = teamDriverStats.reduce((sum, d) => sum + d.podiums, 0);
            const bestPosition = teamDriverStats.reduce((best, d) => {
                if (d.bestPosition === null) return best;
                if (best === null) return d.bestPosition;
                return Math.min(best, d.bestPosition);
            }, null);

            // Puntos por carrera del equipo (suma de pilotos)
            const racePoints = raceColumns.map((_, raceIdx) => {
                return teamDriverStats.reduce((sum, d) => {
                    return sum + (d.racePoints[raceIdx] || 0);
                }, 0);
            });

            return {
                name: team.name,
                color: team.color,
                logo: team.logo,
                drivers: team.drivers || [],
                totalPoints,
                wins,
                podiums,
                bestPosition,
                racePoints
            };
        }).sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.podiums !== a.podiums) return b.podiums - a.podiums;
            return (a.bestPosition || 999) - (b.bestPosition || 999);
        });
    }

    return { driverStandings, teamStandings, raceColumns };
}

/**
 * Extrae todos los pilotos del campeonato con su info de equipo/categoría.
 */
function getAllDrivers(championship, teams) {
    const drivers = [];

    if (championship.settings?.isTeamChampionship || teams.length > 0) {
        teams.forEach(team => {
            (team.drivers || []).forEach(driver => {
                drivers.push({
                    name: driver.name,
                    team: team.name,
                    teamColor: team.color,
                    category: driver.category || ''
                });
            });
        });
    }

    if (championship.drivers && championship.drivers.length > 0) {
        championship.drivers.forEach(driver => {
            const name = typeof driver === 'string' ? driver : driver.name;
            const category = typeof driver === 'string' ? '' : driver.category;
            // No duplicar si ya está desde teams
            if (!drivers.find(d => d.name === name)) {
                drivers.push({ name, team: '', teamColor: '', category });
            }
        });
    }

    return drivers;
}

/**
 * Genera estadísticas de pilotos para la vista de stats.
 * 
 * @param {Array} driverStandings - Output de calculateAdvancedStandings().driverStandings
 * @returns {Object} Secciones de estadísticas listas para renderizar
 */
export function getDriverStats(driverStandings) {
    if (!driverStandings || driverStandings.length === 0) {
        return { topWinners: [], topPodiums: [], topPoles: [], topFastestLaps: [], records: {} };
    }

    // Top pilotos por categoría
    const topWinners = [...driverStandings].filter(d => d.wins > 0).sort((a, b) => b.wins - a.wins);
    const topPodiums = [...driverStandings].filter(d => d.podiums > 0).sort((a, b) => b.podiums - a.podiums);
    const topPoles = [...driverStandings].filter(d => d.poles > 0).sort((a, b) => b.poles - a.poles);
    const topFastestLaps = [...driverStandings].filter(d => d.fastestLaps > 0).sort((a, b) => b.fastestLaps - a.fastestLaps);

    // Records del campeonato
    const bestSingleRace = driverStandings.reduce((best, d) => {
        const maxPts = Math.max(...d.racePoints.filter(p => p !== null));
        if (maxPts > best.points) {
            return { driver: d.name, points: maxPts };
        }
        return best;
    }, { driver: '', points: 0 });

    const mostDNFs = [...driverStandings].filter(d => d.dnfs > 0).sort((a, b) => b.dnfs - a.dnfs);

    const records = {
        bestSingleRace,
        mostConsistent: driverStandings.length > 0
            ? [...driverStandings]
                .filter(d => d.races > 0)
                .sort((a, b) => (b.totalPoints / b.races) - (a.totalPoints / a.races))[0]
            : null,
        mostDNFs: mostDNFs[0] || null
    };

    return { topWinners, topPodiums, topPoles, topFastestLaps, records };
}

/**
 * Compara dos pilotos head-to-head.
 * 
 * @param {Object} driver1 - Stats del piloto 1 (de driverStandings)
 * @param {Object} driver2 - Stats del piloto 2 (de driverStandings)
 * @returns {Object} Comparación detallada
 */
export function compareDrivers(driver1, driver2) {
    if (!driver1 || !driver2) return null;

    // Carreras en las que ambos participaron
    let headToHead = { driver1Wins: 0, driver2Wins: 0, ties: 0 };
    const minLen = Math.min(driver1.racePositions.length, driver2.racePositions.length);

    for (let i = 0; i < minLen; i++) {
        const pos1 = driver1.racePositions[i];
        const pos2 = driver2.racePositions[i];
        if (pos1 !== null && pos2 !== null) {
            if (pos1 < pos2) headToHead.driver1Wins++;
            else if (pos2 < pos1) headToHead.driver2Wins++;
            else headToHead.ties++;
        }
    }

    // Puntos en carreras compartidas
    let sharedRacePoints = { driver1: 0, driver2: 0 };
    for (let i = 0; i < minLen; i++) {
        if (driver1.racePoints[i] !== null && driver2.racePoints[i] !== null) {
            sharedRacePoints.driver1 += driver1.racePoints[i];
            sharedRacePoints.driver2 += driver2.racePoints[i];
        }
    }

    return {
        headToHead,
        sharedRacePoints,
        comparison: [
            { label: 'Puntos Totales', v1: driver1.totalPoints, v2: driver2.totalPoints, higher: 'better' },
            { label: 'Victorias', v1: driver1.wins, v2: driver2.wins, higher: 'better' },
            { label: 'Podiums', v1: driver1.podiums, v2: driver2.podiums, higher: 'better' },
            { label: 'Poles', v1: driver1.poles, v2: driver2.poles, higher: 'better' },
            { label: 'Vueltas Rápidas', v1: driver1.fastestLaps, v2: driver2.fastestLaps, higher: 'better' },
            { label: 'Mejor Posición', v1: driver1.bestPosition, v2: driver2.bestPosition, higher: 'worse' },
            { label: 'Carreras', v1: driver1.races, v2: driver2.races, higher: 'neutral' },
            { label: 'DNFs', v1: driver1.dnfs, v2: driver2.dnfs, higher: 'worse' },
            { label: 'Pts promedio', v1: driver1.races > 0 ? (driver1.totalPoints / driver1.races).toFixed(1) : '0', v2: driver2.races > 0 ? (driver2.totalPoints / driver2.races).toFixed(1) : '0', higher: 'better' }
        ]
    };
}
