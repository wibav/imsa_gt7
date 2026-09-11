/**
 * Ficha técnica con BoP de los coches de un campeonato.
 *
 * El catálogo trae los datos de serie, pero en las carreras de la liga el BoP
 * está activado: la potencia y el peso que se corren son otros. Los valores con
 * BoP vienen de GT Engine (scripts/sync-gtengine-bop.js), en las tres
 * configuraciones que usa el juego según el tipo de circuito.
 */

// Etiquetas cortas a propósito: con "Circuito rápido" los tres botones no
// cabían en una fila en el móvil.
export const CONFIGS_BOP = [
    { id: 'rapido', etiqueta: 'Rápido' },
    { id: 'medio', etiqueta: 'Medio' },
    { id: 'lento', etiqueta: 'Lento' },
];

// Solo cinco columnas en total (coche, tracción y estas tres). Con relación
// peso/potencia, aceleración y reparto la tabla obligaba a desplazarse en
// horizontal en el móvil. El dato completo sigue guardado en `bop` por si
// hace falta más adelante.
//
// "PR" y no "PP": es como llama GT7 en español a los Puntos de Rendimiento.
const COLUMNAS_ORDENABLES = {
    pp: { etiqueta: 'PR', mejorEsMayor: true },
    cv: { etiqueta: 'CV', mejorEsMayor: true },
    kg: { etiqueta: 'kg', mejorEsMayor: false },
};

/**
 * Filas de la tabla para una configuración de BoP.
 *
 * @param {Array} coches - Documentos del catálogo `cars`, con su campo `bop`
 * @param {string} config - 'rapido' | 'medio' | 'lento'
 * @param {{campo: string, desc: boolean}} [orden]
 */
export function filasFichaTecnica(coches = [], config = 'medio', orden = { campo: 'nombre', desc: false }) {
    const filas = coches
        .filter(c => c?.bop?.[config])
        .map(c => {
            const v = c.bop[config];
            return {
                id: c.id,
                nombre: c.name,
                traccion: c.bop.traccion || c.driveTrain || '—',
                pp: v.pp,
                cv: v.cv,
                kg: v.kg,
            };
        });

    const { campo, desc } = orden;
    filas.sort((a, b) => {
        // Por nombre, orden alfabético del español (la ñ y los acentos en su
        // sitio). Es el orden por defecto: con 34 coches, lo primero que hace
        // un piloto es buscar el suyo.
        if (campo === 'nombre') {
            const r = String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' });
            return desc ? -r : r;
        }
        const x = a[campo], y = b[campo];
        if (x == null) return 1;
        if (y == null) return -1;
        return desc ? y - x : x - y;
    });

    // Mejor valor de cada columna, para destacarlo.
    const mejores = {};
    Object.entries(COLUMNAS_ORDENABLES).forEach(([k, { mejorEsMayor }]) => {
        const valores = filas.map(f => f[k]).filter(v => v != null);
        if (valores.length) mejores[k] = mejorEsMayor ? Math.max(...valores) : Math.min(...valores);
    });

    return { filas, mejores };
}

/**
 * ¿Cambia algo según el tipo de circuito?
 *
 * En la versión 1.71 el BoP de Gr.1 es el mismo en los tres; en ese caso el
 * selector de circuito sobra y solo confundiría.
 */
export function bopVariaPorCircuito(coches = []) {
    return coches.some(c => {
        const b = c?.bop;
        if (!b) return false;
        const clave = (k) => JSON.stringify(b[k] || null);
        return clave('rapido') !== clave('medio') || clave('medio') !== clave('lento');
    });
}

/** Versión del juego y fecha de los datos, para citarlos al pie. */
export function origenFicha(coches = []) {
    const con = coches.find(c => c?.bop?.versionJuego);
    return con ? { version: con.bop.versionJuego, fuente: con.bop.fuente || 'gt-engine.com' } : null;
}

export { COLUMNAS_ORDENABLES };

const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim();

/**
 * Busca en el catálogo el coche que el organizador escribió a mano.
 *
 * El catálogo de un campeonato son nombres tecleados: en el Campeonato de
 * Verano pone "Ferrari 499P" y el catálogo oficial "Ferrari 499P '23", y
 * "Toyota" frente a "TOYOTA". Con una búsqueda exacta solo casaba uno de los
 * seis coches.
 *
 * Solo acepta un resultado si es único: ante la duda, mejor no mostrar la ficha
 * que mostrar la de otro coche.
 *
 * Ojo: esto es solo para encontrar los datos. No sustituye al nombre que usa
 * el campeonato, que es el que figura en `carsUsed` y en las validaciones.
 */
export function resolverCoche(nombre, catalogo = []) {
    const buscado = normalizar(nombre);
    if (!buscado) return null;

    const exacto = catalogo.filter(c => normalizar(c.name) === buscado);
    if (exacto.length === 1) return exacto[0];

    // El nombre sin el año: "Ferrari 499P" frente a "Ferrari 499P '23".
    const conAnio = catalogo.filter(c => {
        const n = normalizar(c.name);
        return n.startsWith(`${buscado} '`) && /^'\d\d$/.test(n.slice(buscado.length + 1));
    });
    if (conAnio.length === 1) return conAnio[0];

    return null;
}

/**
 * Filtra las filas por nombre, sin distinguir mayúsculas ni acentos.
 *
 * Se aplica DESPUÉS de calcular los mejores de cada columna, a propósito: el
 * verde significa "el mejor del campeonato", y si se recalculara sobre lo
 * filtrado, buscar "Mazda" pintaría de verde al mejor de dos coches.
 */
export function filtrarPorNombre(filas = [], texto = '') {
    const t = normalizar(texto);
    if (!t) return filas;
    return filas.filter(f => normalizar(f.nombre).includes(t));
}

/** A partir de cuántos coches merece la pena mostrar el buscador. */
export const MINIMO_PARA_BUSCAR = 9;

/**
 * Cuántos coches cambian según el tipo de circuito.
 *
 * Se muestra junto al selector para que se entienda para qué sirve: en la
 * GR.4 son 16 de 34, así que elegir el tipo de circuito importa; en Gr.1 son
 * cero y el selector ni aparece.
 */
export function cochesQueVarian(coches = []) {
    return coches.filter(c => {
        const b = c?.bop;
        if (!b) return false;
        const k = (x) => JSON.stringify(b[x] || null);
        return k('rapido') !== k('medio') || k('medio') !== k('lento');
    }).length;
}
