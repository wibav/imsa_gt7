/**
 * Fase 1 — Migración a multi-tenant: crea la organización GT7 ESP y añade
 * `orgId: "gt7-esp"` a los documentos existentes.
 *
 * Es un UPDATE ADITIVO: solo agrega el campo `orgId` (merge), no toca ningún
 * otro campo, no borra nada, no reescribe estructura. Idempotente — correrlo
 * más de una vez no duplica ni rompe nada (los docs que ya tienen orgId se
 * omiten).
 *
 * Colecciones migradas (ver 02-ESPECIFICACIONES.md SPEC-2/SPEC-6):
 * - championships (doc raíz — sus subcolecciones penalties/claims/teams/
 *   tracks/divisions heredan el aislamiento del padre, no necesitan orgId
 *   propio)
 * - events (doc raíz — participants/waitlist/results/rounds heredan igual)
 * - teams (catálogo global legacy)
 *
 * NOTA: el catálogo global `tracks` (imágenes/layouts de circuitos reales de
 * GT7) queda FUERA de este backfill a propósito — es un recurso compartido
 * entre todas las organizaciones (cualquier liga puede reutilizar el mismo
 * circuito de Spa, Monza, etc.), no pertenece a una sola organización.
 *
 * Uso: node scripts/migrate-orgid-backfill.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ORG_ID = 'gt7-esp';
const OWNER_UID = 'Nng5Zn7YXRUNsz6zHM7ItOHolGH2'; // wolcutor@gmail.com (ver bootstrap-roles.js)

// 'tracks' excluido intencionalmente: catálogo global compartido entre orgs
const COLLECTIONS_TO_BACKFILL = ['championships', 'events', 'teams'];

async function ensureOrganization() {
    const ref = db.collection('organizations').doc(ORG_ID);
    const snap = await ref.get();
    if (snap.exists) {
        console.log(`✅ organizations/${ORG_ID} ya existe, no se sobrescribe`);
        return;
    }
    await ref.set({
        id: ORG_ID,
        name: 'GT7 ESP',
        slug: ORG_ID,
        plan: 'pro', // exenta de límites — ver billingExempt
        status: 'active',
        freeTrialUsed: false,
        billingExempt: true,
        ownerUid: OWNER_UID,
        branding: { logoUrl: null, colorPrimary: null, colorSecondary: null },
        limits: {
            maxActiveChampionshipsOrEvents: null,
            maxDrivers: null,
            maxAdmins: null,
            maxComisarios: null,
        },
        subscription: { provider: null, externalId: null, currentPeriodEnd: null, cycle: null },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Creada organizations/${ORG_ID}`);
}

async function backfillCollection(name) {
    const snap = await db.collection(name).get();
    let updated = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
        if (doc.data().orgId === ORG_ID) {
            skipped++;
            continue;
        }
        await doc.ref.set({ orgId: ORG_ID }, { merge: true });
        updated++;
    }

    console.log(`${name}: ${updated} actualizados, ${skipped} ya tenían orgId (total ${snap.size})`);
    return { updated, skipped, total: snap.size };
}

async function main() {
    console.log(`── Backfill orgId="${ORG_ID}" ──\n`);

    await ensureOrganization();
    console.log('');

    let totals = { updated: 0, skipped: 0, total: 0 };
    for (const name of COLLECTIONS_TO_BACKFILL) {
        const r = await backfillCollection(name);
        totals.updated += r.updated;
        totals.skipped += r.skipped;
        totals.total += r.total;
    }

    console.log(`\n✅ Backfill completado: ${totals.updated} documentos actualizados, ${totals.skipped} ya migrados, ${totals.total} en total.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error durante el backfill:', err);
    process.exit(1);
});
