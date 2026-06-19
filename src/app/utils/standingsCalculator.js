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
 * @param {Set<string>} [options.invalidatedEntries] - Set "driver::trackId" con puntos anulados por uso de autos
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

    // Mapa de aliases de registro: psnId → gt7Id (canónico).
    // Necesario porque las divisiones almacenan el psnId del piloto, pero championship.drivers
    // y las sanciones usan el gt7Id. Se construye ANTES del filtro de división.
    const registrationAliases = {};
    (championship.registrations || []).forEach(reg => {
        if (reg.gt7Id && reg.psnId && reg.psnId !== reg.gt7Id) {
            registrationAliases[reg.psnId] = reg.gt7Id;
        }
    });

    // Recopilar todos los drivers
    let allDrivers = getAllDrivers(championship, teams);

    // Fase 6: Filtrar/agregar pilotos por división si se especifica
    if (options.divisionDrivers && options.divisionDrivers.length > 0) {
        // Normalizar los nombres de la división al gt7Id canónico (resuelve psnId → gt7Id)
        const resolvedDivNames = options.divisionDrivers.map(d => {
            const rawName = typeof d === 'string' ? d : d.name;
            return registrationAliases[rawName] || rawName;
        });
        const divSet = new Set(resolvedDivNames);
        // Filtrar solo los que pertenecen a la división
        allDrivers = allDrivers.filter(d => divSet.has(d.name));
        // Agregar los pilotos de la división que no estén ya en allDrivers
        // (caso: pilotos en divisiones pero no en championship.drivers ni teams)
        const knownNames = new Set(allDrivers.map(d => d.name));
        resolvedDivNames.forEach(name => {
            if (name && !knownNames.has(name)) {
                allDrivers.push({ name, team: '', teamColor: '', category: '' });
            }
        });
    }

    // Set de entradas invalidadas por uso de autos: "driver::trackId"
    const invalidatedEntries = options.invalidatedEntries || new Set();

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
            racePoints: [],       // Array de puntos por carrera (en orden de raceColumns)
            racePositions: [],    // Array de posiciones por carrera
            raceFastestLap: [],   // Array de boolean: tuvo vuelta rápida en esa carrera
            racePole: [],         // Array de boolean: tuvo pole en esa carrera
            invalidatedRaces: [], // Array de boolean: puntos anulados por uso de autos
            categoryWins: 0,      // Victorias dentro de la categoría (multicategoría)
            categoryPodiums: 0,   // Podiums dentro de la categoría (multicategoría)
            penaltyPoints: 0,     // Puntos deducidos por sanciones
            warningPoints: 0,     // Puntos de amonestación acumulados
            penalties: []         // Lista de sanciones aplicadas
        };
    });

    // Construir mapa de aliases: psnId/otrosNombres → nombre canónico en driverStats.
    // Necesario cuando track.points guarda resultados bajo psnId pero championship.drivers usa gt7Id.
    // Ejemplo: track.points["A77_tony"] pero championship.drivers tiene {name: "MR-Tony"} (gt7Id).
    const aliasToCanonical = {};
    const canonicalToAliases = {};
    (championship.registrations || []).forEach(reg => {
        const canonical = [reg.gt7Id, reg.name, reg.psnId].find(n => n && driverStats[n]);
        if (!canonical) return;
        [reg.gt7Id, reg.name, reg.psnId].forEach(alias => {
            if (alias && alias !== canonical) {
                aliasToCanonical[alias] = canonical;
                if (!canonicalToAliases[canonical]) canonicalToAliases[canonical] = [];
                if (!canonicalToAliases[canonical].includes(alias)) {
                    canonicalToAliases[canonical].push(alias);
                }
            }
        });
    });

    // Incluir en driverStats todos los pilotos que aparecen en track.points
    // (cubre pilotos con resultados pero no registrados en championship.drivers / teams)
    // Se omiten las claves que son alias de un driver ya registrado.
    // En modo divisiones, solo se incluyen pilotos que pertenezcan a esa división.
    // divisionSet usa nombres canónicos (gt7Id) para que psnIds alias queden cubiertos
    // por el check aliasToCanonical anterior.
    const divisionSet = options.divisionDrivers && options.divisionDrivers.length > 0
        ? new Set(options.divisionDrivers.map(d => {
            const rawName = typeof d === 'string' ? d : d.name;
            return registrationAliases[rawName] || rawName;
        }))
        : null;

    sortedTracks.forEach(track => {
        Object.keys(track.points || {}).forEach(name => {
            if (!name) return;
            if (aliasToCanonical[name]) return; // alias conocido → no crear entrada duplicada
            // En modo divisiones: ignorar pilotos que no pertenecen a esta división
            if (divisionSet && !divisionSet.has(name)) return;
            if (!driverStats[name]) {
                driverStats[name] = {
                    name,
                    team: '',
                    teamColor: '',
                    category: '',
                    totalPoints: 0,
                    wins: 0,
                    podiums: 0,
                    poles: 0,
                    fastestLaps: 0,
                    dnfs: 0,
                    races: 0,
                    bestPosition: null,
                    racePoints: [],
                    racePositions: [],
                    raceFastestLap: [],
                    racePole: [],
                    invalidatedRaces: [],
                    categoryWins: 0,
                    categoryPodiums: 0,
                    penaltyPoints: 0,
                    warningPoints: 0,
                    penalties: []
                };
            }
        });
    });

    const isMultiCategory = !!championship.settings?.isMultiCategory;
    const basePointsSystem = championship.settings?.pointsSystem || {};

    // Procesar cada track
    sortedTracks.forEach((track) => {
        const results = track.results || {};
        const pointsMap = track.points || {};

        // Compatibilidad con formato dividido por salas (results.divisions) y formato plano
        // Si hay divisions, fusionar racePositions, qualifying y fastestLap de todas las divisiones
        let racePositions = {};
        let qualyData = {};
        let fastestLap = {};
        let sprintPointsMap = track.sprintPoints || {};

        if (results.divisions && Object.keys(results.divisions).length > 0) {
            // Nuevo formato: resultados por división
            Object.values(results.divisions).forEach(divResult => {
                Object.assign(racePositions, divResult.racePositions || {});
                // Qualy: el primero que tenga datos gana (por división)
                if (!qualyData.top3 && divResult.qualifying?.top3) qualyData = divResult.qualifying;
                // Fastest lap: igual, tomar el primero que tenga driver
                if (!fastestLap.driver && divResult.fastestLap?.driver) fastestLap = divResult.fastestLap;
                // Sprint: fusionar también
                if (divResult.sprintPositions) {
                    Object.assign(sprintPointsMap, divResult.sprintPoints || {});
                }
            });
        } else {
            // Formato legado: plano
            racePositions = results.racePositions || {};
            qualyData = results.qualifying || {};
            fastestLap = results.fastestLap || {};
        }

        const isSprint = track.raceType === 'sprint_carrera';

        // ── Puntos por categoría separada (campeonatos multicategoría) ──
        // Cuando isMultiCategory, los puntos se calculan por ranking intra-categoría:
        // el 1º de GR1 y el 1º de Gr3 reciben los mismos puntos del pointsSystem,
        // independientemente de su posición global de llegada.
        // Esto se aplica SOLO a los racePoints; las posiciones globales se conservan
        // para estadísticas (wins, podiums, bestPosition) con base en orden de llegada real.
        let effectivePointsMap = pointsMap;
        if (isMultiCategory && Object.keys(racePositions).length > 0) {
            // Agrupar drivers participantes por categoría, resolviendo aliases
            const byCategory = {};
            Object.entries(racePositions).forEach(([nameOrAlias, posStr]) => {
                if (!posStr) return;
                const canonical = aliasToCanonical[nameOrAlias] || nameOrAlias;
                const cat = driverStats[canonical]?.category || 'Sin categoría';
                const pos = parseInt(posStr);
                if (isNaN(pos)) return; // DNF/DSQ sin número no participan en el ranking intra-cat
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push({ canonical, pos });
            });

            // Por cada categoría, ordenar por posición global y asignar puntos del sistema
            const catPointsMap = {};
            Object.values(byCategory).forEach(entries => {
                entries
                    .sort((a, b) => a.pos - b.pos)
                    .forEach(({ canonical }, rankIdx) => {
                        const rank = rankIdx + 1; // 1-based
                        catPointsMap[canonical] = basePointsSystem[rank] ?? 0;
                    });
            });
            effectivePointsMap = catPointsMap;
        }

        // Para cada driver, calcular stats de esta carrera
        Object.keys(driverStats).forEach(driverName => {
            const stat = driverStats[driverName];
            // Aliases del driver (ej: "A77_tony" para "MR-Tony" cuyo psnId es A77_tony)
            const aliases = canonicalToAliases[driverName] || [];
            // Helper: busca en un mapa primero por nombre canónico, luego por aliases
            const fromMap = (map, fallback) => {
                if (map[driverName] !== undefined) return map[driverName];
                for (const alias of aliases) {
                    if (map[alias] !== undefined) return map[alias];
                }
                return fallback;
            };

            // Obtener posición de carrera
            const positionStr = fromMap(racePositions, null);
            const position = positionStr ? parseInt(positionStr) : null;
            // En multicategoría usar puntos del ranking intra-categoría; en modo normal usar track.points
            const racePoints = fromMap(effectivePointsMap, 0);
            const sprintPts = isSprint ? fromMap(sprintPointsMap, 0) : 0;
            const points = racePoints + sprintPts;

            const hasFl = fastestLap?.driver === driverName || aliases.includes(fastestLap?.driver);
            const hasPole = qualyData?.top3?.first === driverName || aliases.includes(qualyData?.top3?.first);

            // Si no participó en esta carrera
            // Si el driver está en track.points (aunque con 0), sí participó — no saltar
            // En multicategoría, usar también racePositions para detectar participación
            const isInPointsMap = (driverName in pointsMap) || aliases.some(a => a in pointsMap)
                || (isMultiCategory && ((driverName in racePositions) || aliases.some(a => a in racePositions)));
            if (!position && points === 0 && !isInPointsMap) {
                stat.racePoints.push(null);
                stat.racePositions.push(null);
                stat.raceFastestLap.push(hasFl);
                stat.racePole.push(hasPole);
                stat.invalidatedRaces.push(false);
                return;
            }

            // Verificar si esta entrada está invalidada por uso de autos
            const entryKey = `${driverName}::${track.id}`;
            const aliasKey = aliases.map(a => `${a}::${track.id}`).find(k => invalidatedEntries.has(k));
            const isInvalidated = invalidatedEntries.has(entryKey) || !!aliasKey;
            const effectivePoints = isInvalidated ? 0 : points;

            // Registrar puntos y posición
            stat.racePoints.push(effectivePoints);
            stat.racePositions.push(position);
            stat.raceFastestLap.push(hasFl);
            stat.racePole.push(hasPole);
            stat.invalidatedRaces.push(isInvalidated);
            stat.totalPoints += effectivePoints;
            stat.races += 1;

            if (position) {
                // Estadísticas basadas en posición global
                if (position === 1) stat.wins += 1;
                if (position <= 3) stat.podiums += 1;

                // Mejor posición global
                if (stat.bestPosition === null || position < stat.bestPosition) {
                    stat.bestPosition = position;
                }
            }

            // En multicategoría: victorias/podiums dentro de la categoría (por racePoints intra-cat)
            if (isMultiCategory && !isInvalidated) {
                const p1 = basePointsSystem[1] ?? 25;
                const p3 = basePointsSystem[3] ?? 15;
                if (effectivePoints >= p1) stat.categoryWins += 1;
                else if (effectivePoints >= p3) stat.categoryPodiums += 1;
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
            if (hasPole) stat.poles += 1;

            // Vuelta rápida
            if (hasFl) stat.fastestLaps += 1;
        });
    });

    // ── Aplicar sanciones ──
    // Normaliza caracteres unicode problemáticos para comparar nombres:
    // guiones variantes (en-dash, em-dash, etc.) → guión normal; espacios invisibles eliminados
    const normalizeName = (s) =>
        s.trim()
            .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
            .replace(/[\u00A0\u200B\uFEFF\u202F]/g, ' ')
            .toLowerCase();

    // Construir mapa normalizado → clave real en driverStats (para búsqueda rápida)
    const normalizedStatsKeys = {};
    Object.keys(driverStats).forEach(k => {
        normalizedStatsKeys[normalizeName(k)] = k;
    });

    const activePenalties = penalties.filter(p => p.status === 'applied');

    activePenalties.forEach(penalty => {
        if (!penalty.driverName) return;

        // 1. Coincidencia exacta
        let stat = driverStats[penalty.driverName];

        // 2. Coincidencia normalizada (cubre guiones unicode, espacios invisibles, mayúsculas)
        if (!stat) {
            const realKey = normalizedStatsKeys[normalizeName(penalty.driverName)];
            if (realKey) stat = driverStats[realKey];
        }

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

            // Desglose de puntos por categoría (para campeonatos multicategoría)
            // En isMultiCategory, wins/podiums se calculan por ranking intra-cat (no global):
            // una "victoria de categoría" es ser el 1° de tu categoría en esa carrera.
            const byCategory = {};
            teamDriverStats.forEach(d => {
                const cat = d.category || 'Sin categoría';
                if (!byCategory[cat]) byCategory[cat] = { points: 0, driver: d.name, wins: 0, podiums: 0 };
                byCategory[cat].points += d.totalPoints;
                if (isMultiCategory) {
                    // Contar victorias/podiums dentro de categoría según racePoints
                    // (1° de cat recibe pointsSystem[1], 2° recibe pointsSystem[2], etc.)
                    const p1 = basePointsSystem[1] ?? 25;
                    const p3 = basePointsSystem[3] ?? 15;
                    d.racePoints.forEach(pts => {
                        if (pts === null) return;
                        if (pts >= p1) byCategory[cat].wins += 1;
                        else if (pts >= p3) byCategory[cat].podiums += 1;
                    });
                } else {
                    byCategory[cat].wins += d.wins;
                    byCategory[cat].podiums += d.podiums;
                }
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
                racePoints,
                byCategory
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

/**
 * Agrupa driverStandings por categoría.
 * Útil para campeonatos multicategoría: muestra la sub-clasificación Campeón Gr2, Campeón Gr3, etc.
 *
 * @param {Array} driverStandings - Output de calculateAdvancedStandings().driverStandings
 * @returns {Object} { [category]: Array<driverStat> } — cada array ya ordenado por puntos
 */
export function getStandingsByCategory(driverStandings) {
    if (!driverStandings || driverStandings.length === 0) return {};

    const byCat = {};
    driverStandings.forEach(d => {
        const cat = d.category || 'Sin categoría';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(d);
    });

    // Cada sub-array ya viene ordenado (hereda el orden de driverStandings)
    return byCat;
}
