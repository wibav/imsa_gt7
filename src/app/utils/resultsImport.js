/**
 * Emparejamiento de los resultados leídos de una captura de GT7 con los
 * pilotos y coches del campeonato. Módulo puro (sin React ni Firebase).
 *
 * El juego muestra el apodo del momento, que no siempre coincide con el
 * registrado («Dani.Pan» ↔ RRT_DANIPAN, «MGR-Vivelesport» ↔ vivelesport,
 * «AAM Chak» ↔ AAM_Chak). Se compara ignorando mayúsculas, acentos y signos,
 * y quitando el prefijo de equipo; lo que no se resuelve lo asigna el admin
 * y queda aprendido en championship.aliasCapturas.
 */

/** «Dani.Pan» → «danipan»; «Huracán Gr.4» → «huracangr4» */
export function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Quita un prefijo de equipo: «RRT_ZUNZU» → «ZUNZU», «MGR-Vivelesport» → «Vivelesport» */
export function sinPrefijo(texto) {
    const t = String(texto ?? '').trim();
    const m = t.match(/^[A-Za-z0-9]{2,6}[_\-\s.]+(.+)$/);
    return m ? m[1] : t;
}

function distancia(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return d[a.length][b.length];
}

function parecido(a, b) {
    if (!a || !b) return 0;
    return 1 - distancia(a, b) / Math.max(a.length, b.length);
}

/** Puntuación 0-100 de que el nombre leído sea uno de los nombres del piloto. */
function puntuarNombre(leido, nombres) {
    const n = normalizar(leido);
    const np = normalizar(sinPrefijo(leido));
    let mejor = 0;
    for (const nombre of nombres) {
        const c = normalizar(nombre);
        const cp = normalizar(sinPrefijo(nombre));
        if (!c) continue;
        if (n === c) return 95;
        if (np && (np === cp || np === c || n === cp)) mejor = Math.max(mejor, 90);
        else if (Math.min(n.length, c.length) >= 4 && (n.includes(c) || c.includes(n))) mejor = Math.max(mejor, 75);
        else if (Math.min(np.length, cp.length) >= 4 && (np.includes(cp) || cp.includes(np))) mejor = Math.max(mejor, 70);
        else {
            const r = Math.max(parecido(n, c), parecido(np, cp));
            if (r >= 0.75) mejor = Math.max(mejor, Math.round(r * 65));
        }
    }
    return mejor;
}

/**
 * Asigna cada fila leída a un piloto (cada piloto, como mucho, a una fila).
 *
 * @param {Array<{piloto: string}>} filas
 * @param {Array<{driver: string, nombres: string[]}>} candidatos
 * @param {Object} [aprendidos] - { [nombreNormalizado]: driver }
 * @returns {Array<{driver: string|null, confianza: 'aprendida'|'segura'|'probable'|null}>} en el orden de `filas`
 */
export function emparejarPilotos(filas, candidatos, aprendidos = {}) {
    const resultado = filas.map(() => ({ driver: null, confianza: null }));
    const usados = new Set();

    // 1) lo aprendido de lecturas anteriores manda
    filas.forEach((f, i) => {
        const d = aprendidos[normalizar(f.piloto)];
        if (d && candidatos.some(c => c.driver === d) && !usados.has(d)) {
            resultado[i] = { driver: d, confianza: 'aprendida' };
            usados.add(d);
        }
    });

    // 2) el resto, de la pareja más parecida a la menos
    const parejas = [];
    filas.forEach((f, i) => {
        if (resultado[i].driver) return;
        candidatos.forEach(c => {
            if (usados.has(c.driver)) return;
            const p = puntuarNombre(f.piloto, c.nombres);
            if (p >= 45) parejas.push({ i, driver: c.driver, p });
        });
    });
    parejas.sort((a, b) => b.p - a.p);
    for (const { i, driver, p } of parejas) {
        if (resultado[i].driver || usados.has(driver)) continue;
        resultado[i] = { driver, confianza: p >= 85 ? 'segura' : 'probable' };
        usados.add(driver);
    }
    return resultado;
}

/**
 * Coche de la lista que corresponde al nombre corto del juego
 * («Scirocco Gr.4» → «Volkswagen Scirocco Gr.4»). null si no hay uno claro.
 */
export function emparejarCoche(leido, opciones = []) {
    const n = normalizar(leido);
    if (!n) return null;
    let mejor = null;
    let mejorP = 0;
    for (const op of opciones) {
        const c = normalizar(op);
        if (!c) continue;
        let p = 0;
        if (c === n) p = 100;
        else if (c.includes(n) || n.includes(c)) p = 80 - Math.abs(c.length - n.length) / 10;
        else {
            // por palabras: «Genesis Gr.4» ↔ «Genesis X Gr.4»
            const pal = (t) => new Set(String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 2));
            const a = pal(leido); const b = pal(op);
            const comunes = [...a].filter(w => b.has(w)).length;
            if (comunes >= 2 && comunes === a.size) p = 60;
        }
        if (p > mejorP) { mejorP = p; mejor = op; }
    }
    return mejorP >= 60 ? mejor : null;
}

/** «2:10.097» → 130097 ms · «+07.178» → 7178 · «50:06.565» → 3006565 · otro → null */
export function aMilisegundos(texto) {
    const t = String(texto ?? '').trim().replace(/^\+/, '');
    const m = t.match(/^(?:(\d+):)?(\d{1,2})\.(\d{1,3})$/);
    if (!m) return null;
    return (Number(m[1] || 0) * 60 + Number(m[2])) * 1000 + Number(m[3].padEnd(3, '0'));
}

/** Índice de la fila con la mejor vuelta válida, o -1. */
export function filaVueltaRapida(filas) {
    let mejor = -1;
    let mejorMs = Infinity;
    filas.forEach((f, i) => {
        const ms = aMilisegundos(f.mejorVuelta);
        if (ms != null && ms < mejorMs) { mejorMs = ms; mejor = i; }
    });
    return mejor;
}
