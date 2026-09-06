/**
 * Historial de eventos sueltos de cada piloto.
 *
 * Los campeonatos ya se agregan vía calculateAdvancedStandings, pero los
 * eventos (carreras de un día, sin clasificación acumulada) no aparecían en
 * ninguna parte del perfil del piloto, aunque son la mayor parte de lo que se
 * corre en la liga.
 *
 * Como en el resto del proyecto, aquí no hay ids relacionales: un piloto se
 * cruza por nombre, y ese nombre puede ser su GT7 ID o su PSN ID según cómo se
 * apuntara. Se normaliza todo al GT7 ID con el mismo mapa que usan las
 * clasificaciones (buildGt7IdMap), para que un piloto inscrito por PSN en un
 * evento y por GT7 en otro no salga partido en dos.
 */

const norm = (valor) => String(valor || '').trim().toLowerCase();

/** Identificadores por los que se puede reconocer a un participante. */
function aliasesDe(entrada) {
    return [entrada?.gt7Id, entrada?.psnId, entrada?.driverName, entrada?.name]
        .map(norm)
        .filter(Boolean);
}

/**
 * Nombre canónico de un participante: su GT7 ID si el mapa lo conoce, y si no
 * el primer identificador no vacío que traiga.
 */
function canonico(entrada, gt7Map = {}) {
    const candidatos = [entrada?.gt7Id, entrada?.psnId, entrada?.driverName, entrada?.name]
        .map(v => String(v || '').trim())
        .filter(Boolean);
    for (const c of candidatos) {
        if (gt7Map[c]) return gt7Map[c];
    }
    return candidatos[0] || null;
}

/**
 * Agrupa los eventos por piloto.
 *
 * @param {Array} events - Eventos con `participants` y `results` ya cargados
 *                         (FirebaseService.getEvents los trae de las subcolecciones)
 * @param {Object} gt7Map - Mapa alias → GT7 ID (buildGt7IdMap)
 * @returns {Object} { [gt7Id]: Array<{id, title, date, track, position, ...}> }
 */
export function buildPilotEventHistory(events = [], gt7Map = {}) {
    const porPiloto = {};

    events.forEach(evento => {
        const participantes = evento.participants || [];
        const resultados = evento.results || [];

        // Se parte de los participantes y se añaden los resultados que no
        // casen con ninguno: en eventos viejos la lista de inscritos puede
        // estar incompleta, pero quien tiene resultado sí corrió.
        const entradas = [...participantes];
        resultados.forEach(res => {
            const aliasRes = aliasesDe(res);
            const yaEsta = participantes.some(p =>
                aliasesDe(p).some(a => aliasRes.includes(a))
            );
            if (!yaEsta) entradas.push(res);
        });

        entradas.forEach(entrada => {
            const nombre = canonico(entrada, gt7Map);
            if (!nombre) return;

            const alias = aliasesDe(entrada);
            const resultado = resultados.find(r =>
                aliasesDe(r).some(a => alias.includes(a))
            );

            if (!porPiloto[nombre]) porPiloto[nombre] = [];
            // Un mismo piloto puede figurar en participants y en results del
            // mismo evento: no se duplica la tarjeta.
            if (porPiloto[nombre].some(e => e.id === evento.id)) return;

            porPiloto[nombre].push({
                id: evento.id,
                title: evento.title || 'Evento sin título',
                date: evento.date || null,
                track: evento.track || '',
                banner: evento.banner || '',
                category: evento.category || '',
                status: evento.status || '',
                participantes: participantes.length || evento.participantCount || 0,
                totalResultados: resultados.length,
                position: resultado?.position ?? null,
                dnf: !!resultado?.dnf,
                pole: !!resultado?.polePosition,
                fastestLap: !!resultado?.fastestLap,
            });
        });
    });

    // Más recientes primero; los que no tienen fecha, al final.
    Object.values(porPiloto).forEach(lista => {
        lista.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });
    });

    return porPiloto;
}

/** Resumen para las tarjetas de cabecera: eventos, victorias y podios. */
export function resumirEventos(eventos = []) {
    const conResultado = eventos.filter(e => e.position != null);
    return {
        total: eventos.length,
        victorias: conResultado.filter(e => e.position === 1).length,
        podios: conResultado.filter(e => e.position <= 3).length,
        conResultado: conResultado.length,
    };
}
