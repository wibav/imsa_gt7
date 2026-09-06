/**
 * Test de las Firestore Security Rules para la declaración de autos.
 *
 * Cubre los dos cambios que motivaron mover las declaraciones fuera de
 * `championships.registrations[]`:
 *   1. La subcolección `declarations` acepta escritura pública (los pilotos
 *      no tienen cuenta) pero solo con la forma esperada.
 *   2. `registrations` deja de ser reescribible en bloque por un anónimo:
 *      solo puede CRECER de una en una (alta de inscripción). Antes se podía
 *      reenviar el array entero — cambiando estados, renombrando pilotos o
 *      vaciándolo.
 *
 * Uso: firebase emulators:exec --only firestore "node scripts/test-firestore-rules-declarations-qa.mjs"
 * No requiere credenciales de producción — corre 100% contra el emulador.
 */
import { readFileSync } from 'fs';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-rules-declarations';

let passed = 0;
let failed = 0;

async function check(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
    }
}

async function main() {
    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: readFileSync('firestore.rules', 'utf8'),
            host: '127.0.0.1',
            port: 8080,
        },
    });

    const REG_A = { id: 'reg_a', gt7Id: 'PilotoA', status: 'approved' };
    const REG_B = { id: 'reg_b', gt7Id: 'PilotoB', status: 'pending' };

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('organizations/gt7-esp').set({ name: 'GT7 ESP', slug: 'gt7-esp', billingExempt: true });
        await db.doc('championships/champ1').set({
            orgId: 'gt7-esp',
            name: 'Campeonato con tracking',
            categories: ['Gr4'],
            settings: { pointsSystem: {} },
            drivers: [{ name: 'PilotoA' }, { name: 'PilotoB' }],
            registrations: [REG_A, REG_B],
            carUsageTracking: { enabled: true, mode: 'declared', maxCarsPerDriver: 2 },
        });
        await db.doc('championships/champ1/declarations/reg_a').set({
            cars: ['Nissan GT-R Gr.4'],
            updatedAt: '2026-09-01T00:00:00.000Z',
        });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const champ = () => anon.doc('championships/champ1');
    const decl = (id) => anon.doc(`championships/champ1/declarations/${id}`);

    // ── Subcolección declarations ──────────────────────────────────────
    await check('anónimo puede LEER una declaración', async () => {
        await assertSucceeds(decl('reg_a').get());
    });

    await check('anónimo puede CREAR su declaración', async () => {
        await assertSucceeds(decl('reg_b').set({
            cars: ['Toyota GR Supra Gr.4', 'Alfa Romeo 4C Gr.4'],
            updatedAt: new Date().toISOString(),
        }));
    });

    await check('anónimo puede ACTUALIZAR una declaración existente', async () => {
        await assertSucceeds(decl('reg_a').set({
            cars: ['Ford Mustang Gr.4'],
            updatedAt: new Date().toISOString(),
        }));
    });

    await check('rechaza campos extra (solo cars + updatedAt)', async () => {
        await assertFails(decl('reg_a').set({
            cars: ['Ford Mustang Gr.4'],
            updatedAt: new Date().toISOString(),
            status: 'approved',
        }));
    });

    await check('rechaza cars que no sea lista', async () => {
        await assertFails(decl('reg_a').set({ cars: 'Ford Mustang Gr.4', updatedAt: 'x' }));
    });

    await check('rechaza más de 20 autos (tope de sanidad)', async () => {
        await assertFails(decl('reg_a').set({
            cars: Array.from({ length: 21 }, (_, i) => `Auto ${i}`),
            updatedAt: new Date().toISOString(),
        }));
    });

    await check('anónimo NO puede borrar una declaración', async () => {
        await assertFails(decl('reg_a').delete());
    });

    // ── championships.registrations ya no es reescribible en bloque ─────
    await check('anónimo puede dar de alta UNA inscripción (crece en 1)', async () => {
        await assertSucceeds(champ().update({
            registrations: [REG_A, REG_B, { id: 'reg_c', gt7Id: 'PilotoC', status: 'pending' }],
            drivers: [{ name: 'PilotoA' }, { name: 'PilotoB' }],
        }));
    });

    await check('anónimo NO puede vaciar las inscripciones', async () => {
        await assertFails(champ().update({ registrations: [], drivers: [{ name: 'PilotoA' }, { name: 'PilotoB' }] }));
    });

    await check('anónimo NO puede cambiar el status de otro (mismo tamaño)', async () => {
        await assertFails(champ().update({
            registrations: [REG_A, { ...REG_B, status: 'approved' }],
            drivers: [{ name: 'PilotoA' }, { name: 'PilotoB' }],
        }));
    });

    await check('anónimo NO puede renombrar a un piloto (mismo tamaño)', async () => {
        await assertFails(champ().update({
            registrations: [{ ...REG_A, gt7Id: 'Impostor' }, REG_B],
            drivers: [{ name: 'PilotoA' }, { name: 'PilotoB' }],
        }));
    });

    await check('anónimo NO puede colar 2 inscripciones de golpe', async () => {
        await assertFails(champ().update({
            registrations: [REG_A, REG_B, { id: 'x1' }, { id: 'x2' }],
            drivers: [{ name: 'PilotoA' }, { name: 'PilotoB' }],
        }));
    });

    await check('anónimo NO puede tocar otros campos del campeonato', async () => {
        await assertFails(champ().update({ name: 'Hackeado' }));
    });

    await testEnv.cleanup();

    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
