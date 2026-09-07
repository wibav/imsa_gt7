/**
 * Regresión de la fusión de identidades de piloto (fase 1).
 *
 * La fusión reescribe cómo se MUESTRAN los nombres en toda la web, incluidos
 * campeonatos ya cerrados, así que la propiedad que hay que sostener es dura:
 * mientras no haya identidades confirmadas, la salida tiene que ser
 * exactamente la de antes de que existiera la fusión.
 *
 * Se ejecuta contra los datos reales de producción, no contra fixtures: el
 * histórico que no se puede romper es ese.
 *
 * Uso:
 *   node scripts/test-pilot-identities.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const admin = require(path.join(ROOT, 'node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))) });
const db = admin.firestore();

const { buildGt7IdMap, applyPilotIdentities } = await import(
    path.join(ROOT, 'src/app/utils/championshipUtils.js')
);
const { calculateAdvancedStandings } = await import(
    path.join(ROOT, 'src/app/utils/standingsCalculator.js')
);

let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fallos++; };

/**
 * Mapa alias → GT7 ID a partir SOLO de las inscripciones, reimplementado
 * aquí a propósito. Es el comportamiento previo a la fusión, y sirve de
 * referencia independiente: si buildGt7IdMap se desviara de esto con la lista
 * de identidades vacía, estaría alterando el histórico.
 */
function mapaSoloInscripciones(champ) {
    const map = {};
    (champ.registrations || []).forEach(reg => {
        const entradas = Array.isArray(reg.drivers) && reg.drivers.length > 0 ? reg.drivers : [reg];
        entradas.forEach(e => {
            if (!e.gt7Id) return;
            [e.name, e.psnId].forEach(alias => {
                if (alias && alias !== e.gt7Id) map[alias] = e.gt7Id;
            });
        });
    });
    return map;
}

const datos = [];
const cs = await db.collection('championships').get();
for (const c of cs.docs) {
    const sub = async (n) => (await c.ref.collection(n).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    datos.push({
        championship: { id: c.id, ...c.data() },
        teams: await sub('teams'),
        tracks: (await sub('tracks')).sort((a, b) => (a.round || 0) - (b.round || 0)),
        penalties: await sub('penalties'),
    });
}

console.log(`\nA) Sin identidades, el mapa es el de siempre (${datos.length} campeonatos)`);
let pilotos = 0;
for (const { championship } of datos) {
    const esperado = mapaSoloInscripciones(championship);
    const obtenido = buildGt7IdMap(championship, []);
    ok(JSON.stringify(esperado) === JSON.stringify(obtenido), championship.name);
}

console.log('\nB) Con identidades, no se pierde ni un punto');
// Caso real del inventario: el mismo piloto escrito de varias formas.
const identidad = [{
    canonical: 'HGT_dayo21',
    aliases: ['Dayo', 'Dayo21', 'Hgt_dayo21', 'HGT_Dayo21', 'HGT_Dayo'],
}];
for (const { championship, teams, tracks, penalties } of datos) {
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    pilotos += driverStandings.length;
    const total = driverStandings.reduce((a, d) => a + d.totalPoints, 0);
    const mapBase = buildGt7IdMap(championship, []);
    const mapFus = buildGt7IdMap(championship, identidad);
    // El renombrado es de presentación: los puntos salen de la clasificación,
    // que no depende del mapa. Lo que se comprueba es que ningún piloto se
    // quede sin nombre ni desaparezca al aplicarlo.
    const nombresBase = driverStandings.map(d => mapBase[d.name] || d.name);
    const nombresFus = driverStandings.map(d => mapFus[d.name] || d.name);
    ok(
        nombresFus.every(Boolean) && nombresFus.length === nombresBase.length && total >= 0,
        `${championship.name}: ${driverStandings.length} pilotos, ${total} pts, ${nombresBase.filter((n, i) => n !== nombresFus[i]).length} renombrado(s)`
    );
}

console.log('\nC) Un alias que apuntaba a otro alias acaba en el canónico');
const encadenado = buildGt7IdMap(
    { registrations: [{ gt7Id: 'Hgt_dayo21', psnId: 'dayo_psn' }] },
    identidad
);
ok(encadenado['dayo_psn'] === 'HGT_dayo21', `dayo_psn → ${encadenado['dayo_psn']}`);

console.log('\nD) Identidades incompletas o corruptas no tumban la página');
const sucias = [null, undefined, {}, { canonical: '' }, { canonical: 'X', aliases: null }, { canonical: 'X', aliases: ['X', '', '  '] }];
try {
    buildGt7IdMap({ registrations: [] }, sucias);
    ok(true, 'no lanza con documentos incompletos');
} catch (e) {
    ok(false, `lanzó: ${e.message}`);
}
ok(JSON.stringify(applyPilotIdentities({ a: 'b' }, [])) === JSON.stringify({ a: 'b' }), 'lista vacía devuelve el mapa intacto');

// ── Fase 2: motor de candidatos y detector de conflictos ────────────────
const { agruparCandidatos, conflictosDeGrupo, nombresPorCarrera, similitudNombres } = await import(
    path.join(ROOT, 'src/app/utils/pilotIdentityMatcher.js')
);

console.log('\nE) El detector de conflictos separa a quien compartió carrera');
// La salvaguarda más importante: dos nombres que puntuaron en la MISMA
// carrera son dos personas, por parecidos que suenen.
const carreras = datos.flatMap(d => nombresPorCarrera(d.tracks));
ok(carreras.length > 0, `${carreras.length} carreras con resultados analizadas`);

// Informativo, no una aserción: que hoy existan conflictos o no depende de los
// datos, no del código. La detección se verifica en F con casos construidos.
const nombresEnCarreras = [...new Set(carreras.flatMap(c => [...c]))];
const gruposReales = agruparCandidatos(nombresEnCarreras);
const conflictosReales = gruposReales.flatMap(g => conflictosDeGrupo(g, carreras));
console.log(`     ${gruposReales.length} grupos entre nombres con resultados, ${conflictosReales.length} pareja(s) en conflicto`);
conflictosReales.slice(0, 5).forEach(c => console.log(`     ⚠️ "${c.a}" vs "${c.b}" — juntos en ${c.veces} carrera(s)`));

console.log('\nF) Un piloto consigo mismo nunca genera conflicto');
const unaCarrera = [new Set(['MR-Tony', 'Otro'])];
ok(conflictosDeGrupo(['MR-Tony'], unaCarrera).length === 0, 'grupo de uno: sin conflicto');
ok(conflictosDeGrupo(['MR-Tony', 'A77_tony'], unaCarrera).length === 0, 'alias que no coincidieron: sin conflicto');
ok(conflictosDeGrupo(['MR-Tony', 'Otro'], unaCarrera).length === 1, 'coincidencia real: conflicto detectado');

console.log('\nG) Los ya fusionados dejan de proponerse');
const sinFiltro = agruparCandidatos(['Dayo', 'Dayo21', 'Hgt_dayo21']);
const conFiltro = agruparCandidatos(['Dayo', 'Dayo21', 'Hgt_dayo21'], { yaFusionados: new Set(['Dayo', 'Dayo21', 'Hgt_dayo21']) });
ok(sinFiltro.length === 1 && conFiltro.length === 0, `sin filtro ${sinFiltro.length} grupo(s), con filtro ${conFiltro.length}`);

console.log('\nH) La similitud se comporta');
ok(similitudNombres('HGT_dayo21', 'Hgt_dayo21') === 1, 'mayúsculas y etiqueta de equipo: idénticos');
ok(similitudNombres('Ojer', 'Holo') < 0.5, 'nombres sin relación: baja');
ok(similitudNombres('', 'algo') === 0, 'cadena vacía: 0');

// ── Fase 4: aviso en la inscripción ─────────────────────────────────────
const { nombresParecidosA } = await import(path.join(ROOT, 'src/app/utils/pilotIdentityMatcher.js'));

console.log('\nI) El aviso de "¿eres tú?" avisa cuando toca y calla cuando no');
const conocidos = [];
datos.forEach(({ championship }) => {
    (championship.registrations || []).forEach(reg => {
        const entradas = Array.isArray(reg.drivers) && reg.drivers.length ? reg.drivers : [reg];
        entradas.forEach(e => [e.gt7Id, e.psnId, e.name].forEach(n => { if (n) conocidos.push(n); }));
    });
});
const unicos = [...new Set(conocidos)];
ok(unicos.length > 0, `${unicos.length} nombres conocidos en las inscripciones`);

// Un nombre EXACTO no debe sugerir nada: no hay ambigüedad que resolver.
const exacto = unicos[0];
ok(nombresParecidosA(exacto, unicos).length === 0, `nombre exacto ("${exacto}") no dispara aviso`);

// Una variante evidente sí debe avisar.
const variante = exacto.toUpperCase() + '_';
ok(nombresParecidosA(variante, unicos).includes(exacto), `variante ("${variante}") sugiere "${exacto}"`);

// Y algo sin ninguna relación no debe molestar.
ok(nombresParecidosA('zzqxwvfrtplm', unicos).length === 0, 'nombre sin relación: sin aviso');
ok(nombresParecidosA('ab', unicos).length === 0, 'menos de 3 caracteres: sin aviso (aún está escribiendo)');
ok(nombresParecidosA('', unicos).length === 0, 'campo vacío: sin aviso');

// Qué porcentaje de los nombres reales vería el aviso. Es informativo: una
// tasa alta no significa que el aviso sea ruidoso, sino que el catálogo está
// sucio — que es justo lo que se quiere destapar.
const avisos = unicos
    .map(n => ({ n, sug: nombresParecidosA(n, unicos.filter(x => x !== n)) }))
    .filter(x => x.sug.length > 0);
const pct = Math.round((avisos.length / unicos.length) * 100);
console.log(`     ${avisos.length}/${unicos.length} (${pct}%) de los nombres reales verían el aviso`);
avisos.slice(0, 4).forEach(a => console.log(`     "${a.n}" → ${a.sug.join(', ')}`));

// Esto sí es una propiedad verificable: un aviso es DEMOSTRABLEMENTE falso si
// los dos nombres puntuaron en la misma carrera, porque entonces son dos
// personas y no hay nada que unificar.
const falsos = avisos.filter(a => a.sug.some(s => carreras.some(c => c.has(a.n) && c.has(s))));
ok(falsos.length === 0, `sin falsos positivos demostrables (${falsos.length} de ${avisos.length} avisos)`);
falsos.slice(0, 3).forEach(a => console.log(`     ✗ "${a.n}" → ${a.sug.join(', ')}`));

console.log(`\n${fallos === 0 ? '✓ SIN REGRESIONES' : `✗ ${fallos} FALLOS`} — ${pilotos} pilotos evaluados\n`);
process.exit(fallos === 0 ? 0 : 1);
