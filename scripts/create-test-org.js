/**
 * Crea una organización de prueba real (con datos propios) para validar el
 * aislamiento multi-tenant con un caso concreto — ver ADR-006 y README de
 * Notas/Proyectos/GT7 Championships.
 *
 * NO toca ningún dato de GT7 ESP. Crea:
 * - organizations/test-liga (slug navegable: trenkit.com/l/test-liga)
 * - Un campeonato de prueba con orgId: 'test-liga'
 *
 * Uso: node scripts/create-test-org.js
 * Limpiar después: node scripts/create-test-org.js --cleanup
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TEST_ORG_ID = 'test-liga-2';

async function cleanup() {
    console.log(`Eliminando organización de prueba "${TEST_ORG_ID}" y su data...`);

    const champsSnap = await db.collection('championships').where('orgId', '==', TEST_ORG_ID).get();
    for (const doc of champsSnap.docs) {
        await doc.ref.delete();
        console.log(`  - championships/${doc.id} eliminado`);
    }

    await db.collection('organizations').doc(TEST_ORG_ID).delete();
    console.log(`  - organizations/${TEST_ORG_ID} eliminada`);
    console.log('\n✅ Limpieza completada.');
}

async function create() {
    const orgRef = db.collection('organizations').doc(TEST_ORG_ID);
    await orgRef.set({
        id: TEST_ORG_ID,
        name: 'Liga de Prueba',
        slug: TEST_ORG_ID,
        plan: 'pro',
        status: 'active',
        freeTrialUsed: false,
        billingExempt: true, // organización de prueba, no de cliente real
        ownerUid: null,
        branding: { logoUrl: null, colorPrimary: null, colorSecondary: null },
        limits: { maxActiveChampionshipsOrEvents: null, maxDrivers: null, maxAdmins: null, maxComisarios: null },
        subscription: { provider: null, externalId: null, currentPeriodEnd: null, cycle: null },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Creada organizations/${TEST_ORG_ID}`);

    const champRef = await db.collection('championships').add({
        orgId: TEST_ORG_ID,
        name: 'Campeonato de Prueba (Liga de Prueba)',
        shortName: 'Prueba',
        description: 'Campeonato creado solo para validar aislamiento multi-tenant.',
        season: '2026',
        status: 'draft',
        startDate: null,
        endDate: null,
        banner: '',
        logo: '',
        categories: ['Gr3'],
        settings: {
            pointsSystem: { 1: 25, 2: 18, 3: 15 },
            allowMultipleTeamsPerDriver: false,
            maxTeams: 20,
            maxDriversPerTeam: 2,
            isTeamChampionship: false,
            isMultiCategory: false,
            requiredCategoriesPerTeam: [],
        },
        drivers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: null,
        registration: null,
        registrations: [],
        streaming: null,
        penaltiesConfig: null,
        regulations: null,
        carUsageTracking: null,
        preQualy: null,
        divisionsConfig: null,
    });
    console.log(`✅ Creado championships/${champRef.id} (orgId: ${TEST_ORG_ID})`);

    console.log(`\nProbar en: https://imsa.trenkit.com/l/${TEST_ORG_ID}`);
    console.log(`Limpiar con: node scripts/create-test-org.js --cleanup`);
}

async function main() {
    if (process.argv.includes('--cleanup')) {
        await cleanup();
    } else {
        await create();
    }
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
