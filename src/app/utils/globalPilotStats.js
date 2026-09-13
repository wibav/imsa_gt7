import { FirebaseService } from "../services/firebaseService";
import { calculateAdvancedStandings } from "./standingsCalculator";
import { buildGt7IdMap, applyPilotIdentities } from "./championshipUtils";
import { buildPilotEventHistory } from "./pilotEvents";
import {
    aplicarIdentidadesACampeonato,
    aplicarIdentidadesAEquipos,
    aplicarIdentidadesAPistas,
} from "./pilotIdentityApply";

/**
 * Estadísticas globales de cada piloto: suma de todos sus campeonatos, más su
 * historial de eventos.
 *
 * Sale de la página de Pilotos para que la ficha de un equipo sume
 * exactamente los mismos números que ven sus pilotos en su perfil.
 *
 * @param {{allOrgs?: boolean}} [opciones] - allOrgs: todas las organizaciones
 *        (los equipos son de toda la plataforma); por defecto, la activa.
 * @returns {Promise<{statsArray: Array, allDetails: Array, gt7Map: Object}>}
 */
export async function cargarEstadisticasPilotos({ allOrgs = false } = {}) {
    // Obtener todos los campeonatos (no drafts)
    const allChampionships = await FirebaseService.getChampionships({ allOrgs });
    const championships = allChampionships.filter(c => c.status !== 'draft');

    // Para cada campeonato, cargar tracks y teams en paralelo
    const detailsPromises = championships.map(async (champ) => {
        const [teams, tracks, penalties] = await Promise.all([
            FirebaseService.getTeamsByChampionship(champ.id).catch(() => []),
            FirebaseService.getTracksByChampionship(champ.id).catch(() => []),
            FirebaseService.getPenaltiesByChampionship(champ.id).catch(() => [])
        ]);
        return { championship: champ, teams, tracks, penalties };
    });

    // Identidades fusionadas a mano: mandan sobre lo que digan las
    // inscripciones. Si la lectura falla, getPilotIdentities devuelve
    // [] y todo se comporta como antes de existir la fusión.
    const identities = await FirebaseService.getPilotIdentities();

    const allDetails = await Promise.all(detailsPromises);

    // Los eventos sueltos no entran en ninguna clasificación, así que
    // se cargan aparte para el historial del perfil.
    const events = await FirebaseService.getEvents({ allOrgs }).catch(() => []);

    // Agregar stats globales por piloto.
    // Se normaliza al GT7 ID (cotejando contra las inscripciones de
    // TODOS los campeonatos, igual que la clasificación): antes cada
    // piloto se listaba con el identificador con el que se hubiera
    // inscrito — normalmente el psnId — y uno que figurase por psnId
    // en un campeonato y por gt7Id en otro salía como dos pilotos.
    const gt7Map = buildGt7IdMap(allDetails.map(d => d.championship), identities);

    // Mapa SOLO de las fusiones confirmadas a mano. Se usa para
    // consolidar los datos antes de calcular, y se mantiene aparte de
    // gt7Map a propósito: gt7Map incluye además los alias psnId↔gt7Id
    // de las inscripciones, y consolidar por esos alteraría
    // clasificaciones ya publicadas sin que nadie lo haya decidido.
    const mapaFusiones = applyPilotIdentities({}, identities);
    const pilotMap = {};

    allDetails.forEach(({ championship: champRaw, teams: teamsRaw, tracks: tracksRaw, penalties }) => {
        // Los datos se consolidan ANTES de calcular. Si no, un piloto
        // que cambió de nombre a mitad de temporada sigue teniendo dos
        // entradas en la clasificación —con los puntos partidos— y su
        // perfil muestra el mismo campeonato dos veces.
        const championship = aplicarIdentidadesACampeonato(champRaw, mapaFusiones);
        const teams = aplicarIdentidadesAEquipos(teamsRaw, mapaFusiones);
        const tracks = aplicarIdentidadesAPistas(tracksRaw, mapaFusiones);
        const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);

        driverStandings.forEach(driver => {
            const nombre = gt7Map[driver.name] || driver.name;
            if (!pilotMap[nombre]) {
                pilotMap[nombre] = {
                    name: nombre,
                    aliases: new Set(),
                    totalPoints: 0,
                    totalWins: 0,
                    totalPodiums: 0,
                    totalPoles: 0,
                    totalFastestLaps: 0,
                    totalDNFs: 0,
                    totalRaces: 0,
                    championships: [],
                    bestPosition: null,
                    teams: new Set(),
                    categories: new Set()
                };
            }

            const pilot = pilotMap[nombre];
            // Se guardan los alias para que los enlaces antiguos
            // (?name=psnId) sigan resolviendo al piloto correcto.
            if (driver.name !== nombre) pilot.aliases.add(driver.name);
            pilot.totalPoints += driver.totalPoints;
            pilot.totalWins += driver.wins;
            pilot.totalPodiums += driver.podiums;
            pilot.totalPoles += driver.poles;
            pilot.totalFastestLaps += driver.fastestLaps;
            pilot.totalDNFs += driver.dnfs;
            pilot.totalRaces += driver.races;

            if (driver.bestPosition !== null) {
                if (pilot.bestPosition === null || driver.bestPosition < pilot.bestPosition) {
                    pilot.bestPosition = driver.bestPosition;
                }
            }

            if (driver.team) pilot.teams.add(driver.team);
            if (driver.category) pilot.categories.add(driver.category);

            // Posición final en este campeonato
            const finalPosition = driverStandings.findIndex(d => d.name === driver.name) + 1;

            pilot.championships.push({
                id: championship.id,
                name: championship.name,
                shortName: championship.shortName,
                season: championship.season,
                status: championship.status,
                points: driver.totalPoints,
                wins: driver.wins,
                podiums: driver.podiums,
                poles: driver.poles,
                fastestLaps: driver.fastestLaps,
                dnfs: driver.dnfs,
                races: driver.races,
                finalPosition,
                totalDrivers: driverStandings.length,
                team: driver.team,
                category: driver.category,
                penaltyPoints: driver.penaltyPoints || 0
            });
        });
    });

    const eventosPorPiloto = buildPilotEventHistory(events, gt7Map);

    // Un piloto que solo ha corrido eventos no aparece en ninguna
    // clasificación, así que no tenía ficha y su historial no se podía
    // consultar. Se le crea una entrada vacía para que exista perfil.
    Object.keys(eventosPorPiloto).forEach(nombre => {
        const yaConocido = pilotMap[nombre]
            || Object.values(pilotMap).some(p => p.aliases.has(nombre));
        if (yaConocido) return;
        pilotMap[nombre] = {
            name: nombre,
            aliases: new Set(),
            totalPoints: 0,
            totalWins: 0,
            totalPodiums: 0,
            totalPoles: 0,
            totalFastestLaps: 0,
            totalDNFs: 0,
            totalRaces: 0,
            championships: [],
            bestPosition: null,
            teams: new Set(),
            categories: new Set()
        };
    });

    // Convertir Sets a Arrays y ordenar por puntos totales
    const statsArray = Object.values(pilotMap).map(p => ({
        ...p,
        aliases: [...p.aliases],
        teams: [...p.teams],
        categories: [...p.categories],
        championsCount: p.championships.filter(c => c.finalPosition === 1).length,
        avgPointsPerRace: p.totalRaces > 0 ? (p.totalPoints / p.totalRaces).toFixed(1) : '0',
        // El piloto puede figurar en los eventos por su psnId aunque
        // aquí ya esté normalizado al GT7 ID. Se fusionan las listas de
        // todos sus alias (no basta con quedarse con la primera que
        // aparezca: puede haber participaciones repartidas) y se
        // deduplica por evento.
        events: Object.values(
            [p.name, ...p.aliases]
                .flatMap(alias => eventosPorPiloto[alias] || [])
                .reduce((acc, evento) => ({ ...acc, [evento.id]: evento }), {})
        ).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    })).sort((a, b) => b.totalPoints - a.totalPoints || b.events.length - a.events.length);

    return { statsArray, allDetails, gt7Map };
}
