/**
 * Backfill de `comisarioUids` en `championships/{id}` — ADR-009 (asignación
 * de comisarios por campeonato).
 *
 * Convierte el estado IMPLÍCITO de hoy ("cualquier comisario de la
 * organización puede actuar en cualquiera de sus campeonatos") en estado
 * EXPLÍCITO: cada campeonato queda con `comisarioUids` = los uids de todos
 * los comisarios actuales de su organización (vía `memberships`).
 *
 * Es un NO-OP DE COMPORTAMIENTO a propósito: firestore.rules ya trata
 * `comisarioUids` ausente/null como "sin restringir" (mismo resultado que
 * la lista explícita que este script escribe), así que correr esto no
 * cambia quién puede actuar sobre qué — solo hace visible en la UI
 * (/championshipsAdmin, tab Información → "Comisarios asignados") el roster
 * real, para que un admin pueda empezar a estrecharlo desde ahí.
 *
 * Idempotente: un campeonato que YA tiene el campo `comisarioUids` (aunque
 * sea `[]` o `null` explícito) se omite — este script solo rellena campos
 * ausentes, nunca pisa una asignación ya decidida por un admin.
 *
 * Uso:
 *   node scripts/migrate-comisario-assignments.js             # dry-run (solo muestra)
 *   node scripts/migrate-comisario-assignments.js --apply     # aplica los cambios
 *
 * Correr primero un backup (scripts/backup-firestore.js). Rollback: no hay
 * un flag --revert — el inverso es borrar el campo `comisarioUids` a mano
 * (o con un script aparte) en los campeonatos que este script haya tocado,
 * lo que los devuelve al comportamiento legacy (sin restringir).
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

async function main() {
    const [champSnap, membershipSnap] = await Promise.all([
        db.collection('championships').get(),
        db.collection('memberships').where('role', '==', 'comisario').get(),
    ]);

    // uids de comisarios, agrupados por orgId — una sola pasada sobre
    // memberships en vez de una query por campeonato.
    const comisarioUidsByOrg = {};
    membershipSnap.forEach(doc => {
        const m = doc.data();
        if (!m.orgId || !m.uid) return;
        (comisarioUidsByOrg[m.orgId] ||= []).push(m.uid);
    });

    console.log(`Campeonatos encontrados: ${champSnap.size}`);
    console.log(`Comisarios encontrados (memberships): ${membershipSnap.size}, en ${Object.keys(comisarioUidsByOrg).length} organizaciones\n`);

    const updates = [];

    champSnap.forEach(doc => {
        const champ = doc.data();
        if ('comisarioUids' in champ) {
            console.log(`- ${doc.id} (${champ.name || 'sin nombre'}): ya tiene comisarioUids, se omite`);
            return;
        }
        const uids = comisarioUidsByOrg[champ.orgId] || [];
        console.log(`- ${doc.id} (${champ.name || 'sin nombre'}, org=${champ.orgId}): comisarioUids=[${uids.join(', ') || '—'}] (${uids.length} comisario(s))`);
        updates.push({ ref: doc.ref, uids });
    });

    if (!APPLY) {
        console.log(`\nDry-run — nada se escribió. ${updates.length} campeonato(s) se actualizarían. Correr con --apply para aplicar.`);
        process.exit(0);
    }

    if (updates.length === 0) {
        console.log('\nNada que actualizar.');
        process.exit(0);
    }

    // Firestore limita un batch a 500 escrituras — trocear por si acaso.
    const BATCH_SIZE = 400;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const { ref, uids } of updates.slice(i, i + BATCH_SIZE)) {
            batch.update(ref, {
                comisarioUids: uids,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
    }
    console.log(`\n✅ ${updates.length} campeonato(s) actualizados con su roster de comisarios.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error durante el backfill de comisarioUids:', err);
    process.exit(1);
});
