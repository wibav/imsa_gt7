/**
 * Rotación automática de divisiones (ascensos y descensos durante el
 * campeonato). Ver src/app/utils/divisionRotation.js.
 *
 * Vive en Node y no en functions/main.py para usar el mismo cálculo de
 * clasificación que la web: portarlo a Python haría que la función y la
 * página pudieran discrepar sobre quién sube y quién baja.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { prepararRotacion } from '../../src/app/utils/divisionRotation.js';

initializeApp();
const db = getFirestore();

const leer = async (ref) => (await ref.get()).docs.map(d => ({ id: d.id, ...d.data() }));

async function rotarCampeonato(doc, pilotIdentities) {
    const championship = { id: doc.id, ...doc.data() };
    const ref = doc.ref;
    const [tracks, divisions, penalties, claims, teams, decl] = await Promise.all(
        ['tracks', 'divisions', 'penalties', 'claims', 'teams', 'declarations'].map(c => leer(ref.collection(c)))
    );
    const declarations = Object.fromEntries(decl.map(d => [d.id, d.cars || []]));

    const rotacion = prepararRotacion({ championship, tracks, divisions, penalties, claims, teams, pilotIdentities, declarations });
    if (!rotacion) return false;

    // Todo en una transacción: si dos ejecuciones coinciden, la segunda ve
    // el registro de la primera y no vuelve a mover a nadie.
    await db.runTransaction(async (tx) => {
        const actual = await tx.get(ref);
        const hechas = (actual.data()?.divisionRotations || []).map(r => r.corte);
        if (hechas.includes(rotacion.corte)) return;
        const ahora = new Date().toISOString();
        Object.entries(rotacion.cambios).forEach(([divId, drivers]) => {
            tx.update(ref.collection('divisions').doc(divId), { drivers, updatedAt: ahora });
        });
        tx.update(ref, {
            divisionRotations: FieldValue.arrayUnion({
                corte: rotacion.corte,
                trackId: rotacion.cierre.id,
                trackName: rotacion.cierre.name || '',
                appliedAt: ahora,
                moves: rotacion.movimientos.map(({ driver, fromId, toId, type }) => ({ driver, fromId, toId, type })),
            }),
            updatedAt: ahora,
        });
    });
    logger.info(`Rotación aplicada en "${championship.name}" tras la carrera ${rotacion.corte}: ${rotacion.movimientos.length} movimientos`);
    return true;
}

export const rotar_divisiones = onSchedule(
    { schedule: 'every 60 minutes', timeZone: 'Europe/Madrid', region: 'us-central1', memory: '512MiB', timeoutSeconds: 300 },
    async () => {
        const snap = await db.collection('championships').where('divisionsConfig.enabled', '==', true).get();
        const candidatos = snap.docs.filter(d => {
            const c = d.data();
            const modo = c.divisionsConfig?.rotation?.mode;
            return c.status !== 'completed' && (modo === 'cada' || modo === 'mitad');
        });
        if (candidatos.length === 0) return;

        const pilotIdentities = await leer(db.collection('pilotIdentities'));
        // Secuencial a propósito: son pocos campeonatos y así un fallo en
        // uno queda aislado en el log sin afectar a los demás.
        for (const doc of candidatos) {
            try {
                await rotarCampeonato(doc, pilotIdentities);
            } catch (error) {
                logger.error(`Error rotando divisiones de ${doc.id}`, error);
            }
        }
    }
);
