/**
 * Migra organizations/{orgId} del modelo antiguo (freeTrialUsed booleano,
 * pensado para una suscripción recurrente) al modelo de lotes prepagados
 * (ADR-007): un saldo numérico `championshipCredits` que se descuenta 1 por
 * cada campeonato/evento creado.
 *
 * Reglas de conversión:
 * - `billingExempt: true` (GT7 ESP, orgs internas de prueba): no le aplica
 *   el conteo (firestore.rules lo salta), se deja en 0 solo por consistencia
 *   de esquema.
 * - `plan: 'free'` sin exención: `championshipCredits = freeTrialUsed ? 0 : 1`
 *   — equivalente exacto de "le queda su prueba única" o no.
 * - Cualquier otra combinación (plan de pago sin exención, ej. una org que
 *   activó Pro vía Paddle antes de este cambio): no tiene un lote real
 *   comprado bajo el nuevo modelo, así que se le otorga un saldo de cortesía
 *   de transición (`GRANDFATHER_CREDITS`) para no bloquearla de golpe. Se
 *   loguea explícitamente para que el Administrador de Plataforma lo
 *   ajuste a mano si corresponde (ver /organizacionesAdmin).
 *
 * Uso:
 *   node scripts/migrate-freetrial-to-credits.js           # dry-run (solo muestra)
 *   node scripts/migrate-freetrial-to-credits.js --apply   # aplica los cambios
 *
 * Correr primero un backup (scripts/backup-firestore.js).
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const GRANDFATHER_CREDITS = 10;
const APPLY = process.argv.includes('--apply');

async function main() {
    const snap = await db.collection('organizations').get();
    console.log(`Organizaciones encontradas: ${snap.size}\n`);

    const updates = [];

    snap.forEach(doc => {
        const org = doc.data();
        if ('championshipCredits' in org) {
            console.log(`- ${doc.id}: ya tiene championshipCredits=${org.championshipCredits}, se omite`);
            return;
        }

        let credits;
        let reason;
        if (org.billingExempt) {
            credits = 0;
            reason = 'billingExempt=true, el conteo no le aplica';
        } else if (org.plan === 'free') {
            credits = org.freeTrialUsed ? 0 : 1;
            reason = `plan free, freeTrialUsed=${!!org.freeTrialUsed}`;
        } else {
            credits = GRANDFATHER_CREDITS;
            reason = `plan de pago (${org.plan}) sin exención, sin lote real bajo el nuevo modelo — cortesía de transición, AJUSTAR A MANO`;
        }

        console.log(`- ${doc.id}: championshipCredits=${credits}  (${reason})`);
        updates.push({ ref: doc.ref, credits });
    });

    if (!APPLY) {
        console.log('\nDry-run — nada se escribió. Correr con --apply para aplicar.');
        process.exit(0);
    }

    const batch = db.batch();
    updates.forEach(({ ref, credits }) => {
        batch.update(ref, {
            championshipCredits: credits,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
    console.log(`\n✅ ${updates.length} organizaciones actualizadas.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error migrando a championshipCredits:', err);
    process.exit(1);
});
