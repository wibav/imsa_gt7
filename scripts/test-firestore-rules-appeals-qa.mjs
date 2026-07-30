/**
 * QA adversarial adicional sobre firestore.rules — bloque `appeals`
 * (incidencia 3, CA-3.18), complementando los 9 casos ya añadidos por el
 * programador en scripts/test-firestore-rules.mjs.
 *
 * Casos nuevos cubiertos aquí:
 *  - anónimo crea con `resolvedAt` ya puesto (el bloque original solo
 *    probó `resolvedBy`, no `resolvedAt`, pese a que la regla exige AMBOS
 *    ausentes).
 *  - `reason` justo por DEBAJO del mínimo (9 caracteres) y justo en el
 *    mínimo (10) — no solo el máximo.
 *  - un comisario asignado al campeonato intenta DELETE (no solo update)
 *    sobre una alegación.
 *  - anónimo intenta DELETE una alegación.
 *  - anónimo crea una alegación en un campeonato que directamente no
 *    existe (referencia rota) — no debe colgar ni dar error 500-like.
 *  - anónimo crea sin campo `status` en absoluto (debe tomar el default
 *    'pending' de get() y pasar SOLO si el resto de condiciones se cumplen).
 *  - un comisario (no admin) SÍ puede leer una alegación (CA-3.11: lee y
 *    comenta, pero no resuelve).
 *
 * Uso: firebase emulators:exec --only firestore "node scripts/test-firestore-rules-appeals-qa.mjs"
 */
import { readFileSync } from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-rules-test-appeals-qa';
let passed = 0, failed = 0;

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
        firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.doc('championships/champAppealsQA').set({
            orgId: 'gt7-esp', name: 'QA Appeals', categories: ['Gr1'],
            settings: { pointsSystem: {} }, drivers: [], registrations: [],
            penaltiesConfig: { enabled: true, allowAppeals: true, appealWindowHours: 48 },
            comisarioUids: ['uidComisarioQA'],
        });
        await db.doc('championships/champAppealsQA/appeals/appealQA1').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto QA', reason: 'Motivo suficientemente largo QA',
        });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const comisario = testEnv.authenticatedContext('uidComisarioQA', { orgs: { 'gt7-esp': 'comisario' } }).firestore();
    const dirLiga = testEnv.authenticatedContext('dirLigaQA', { orgs: { 'gt7-esp': 'director_liga' } }).firestore();

    await check('Anónimo NO puede crear una alegación con resolvedAt ya puesto (aunque resolvedBy esté vacío)', () =>
        assertFails(anon.doc('championships/champAppealsQA/appeals/x1').set({
            status: 'pending', resolvedAt: new Date().toISOString(), claimId: 'claim1',
            appellantName: 'Piloto X', reason: 'Motivo de prueba suficientemente largo',
        })));

    await check('Anónimo NO puede crear una alegación con reason de 9 caracteres (justo por debajo del mínimo de 10)', () =>
        assertFails(anon.doc('championships/champAppealsQA/appeals/x2').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X', reason: '123456789',
        })));

    await check('Anónimo SÍ puede crear una alegación con reason de exactamente 10 caracteres (límite admisible)', () =>
        assertSucceeds(anon.doc('championships/champAppealsQA/appeals/x3').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X', reason: '1234567890',
        })));

    await check('Anónimo NO puede crear sin el campo "reason" en absoluto (get() con default vacío falla el size() mínimo)', () =>
        assertFails(anon.doc('championships/champAppealsQA/appeals/x4').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X',
        })));

    await check('Anónimo SÍ puede crear una alegación SIN el campo "status" explícito (toma el default "pending" vía get())', () =>
        assertSucceeds(anon.doc('championships/champAppealsQA/appeals/x5').set({
            claimId: 'claim1', appellantName: 'Piloto X', reason: 'Motivo de prueba suficientemente largo',
        })));

    await check('Un comisario asignado NO puede hacer DELETE sobre una alegación (solo isOrgAdmin, CA-3.11/ADR-009)', () =>
        assertFails(comisario.doc('championships/champAppealsQA/appeals/appealQA1').delete()));

    await check('Anónimo NO puede hacer DELETE sobre una alegación', () =>
        assertFails(anon.doc('championships/champAppealsQA/appeals/appealQA1').delete()));

    await check('Un director_liga SÍ puede hacer DELETE sobre una alegación', () =>
        assertSucceeds(dirLiga.doc('championships/champAppealsQA/appeals/appealQA1').delete()));

    await check('Un comisario (no admin) SÍ puede LEER una alegación — puede leer/comentar, no resolver (CA-3.11)', () =>
        assertSucceeds(comisario.doc('championships/champAppealsQA/appeals/x3').get()));

    await check('Anónimo SÍ puede LEER alegaciones (read: if true, coherente con ADR-009)', () =>
        assertSucceeds(anon.doc('championships/champAppealsQA/appeals/x3').get()));

    await check('Anónimo NO puede crear una alegación en un campeonato que NO EXISTE (referencia rota, no debe colgar ni dar falso positivo)', () =>
        assertFails(anon.doc('championships/champInexistenteQA/appeals/y1').set({
            status: 'pending', claimId: 'claim1', appellantName: 'Piloto X', reason: 'Motivo de prueba suficientemente largo',
        })));

    await testEnv.cleanup();
    console.log(`\n${passed} pasaron, ${failed} fallaron`);
    if (failed > 0) process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
