/**
 * QA adversarial — reproduce el flujo real "Admitir a trámite → Resolver"
 * de una alegación (PenaltiesTab.js: handleAdmitAppeal / handleResolveAppeal)
 * contra el emulador de Firestore, usando EXACTAMENTE la misma lógica de
 * transacción que FirebaseService.resolveAppealTransactional().
 *
 * Se usa firebase-admin (bypassa firestore.rules) porque el objetivo es
 * aislar un bug de LÓGICA DE APLICACIÓN (el guard `status !== 'pending'`
 * de la transacción), no un problema de autorización — eso ya está cubierto
 * por scripts/test-firestore-rules.mjs.
 *
 * Requiere el emulador de Firestore corriendo en 127.0.0.1:8080:
 *   firebase emulators:exec --only firestore "node scripts/test-appeal-resolve-flow-qa.mjs"
 */
import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const app = admin.initializeApp({ projectId: 'demo-rules-test' }, 'qa-appeal-flow-admin');
const db = app.firestore();

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
function assertEqual(actual, expected, msg) {
    if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
}

// Copia literal del guard de FirebaseService.resolveAppealTransactional
// (firebaseService.js): exige status === 'pending' antes de escribir.
async function resolveAppealTransactional(ref, updates) {
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error('La alegación ya no existe');
        if (snap.data().status !== 'pending') {
            throw new Error('Esta alegación ya fue resuelta por otra persona');
        }
        tx.update(ref, { ...updates, updatedAt: new Date().toISOString() });
    });
}

const CHAMP = 'championships/qaFlowChamp';

await check('Setup: sembrar campeonato y alegación pending', async () => {
    await db.doc(CHAMP).set({ orgId: 'gt7-esp', name: 'QA Flow' });
    await db.doc(`${CHAMP}/appeals/appealFlow1`).set({
        status: 'pending', claimId: 'claim1', appellantName: 'Piloto Flow',
        reason: 'Motivo suficientemente largo para pasar validación',
    });
});

await check('Resolver DIRECTAMENTE una alegación "pending" (sin pasar por "Admitir a trámite") funciona', async () => {
    const ref = db.doc(`${CHAMP}/appeals/appealFlow1`);
    await resolveAppealTransactional(ref, { status: 'upheld', resolvedBy: 'dirLiga1', resolution: 'ok' });
    const snap = await ref.get();
    assertEqual(snap.data().status, 'upheld');
});

// ── Reproducción del flujo real recomendado por S3.8 ──
await check('Setup 2: nueva alegación pending, para probar el flujo con "Admitir a trámite" primero', async () => {
    await db.doc(`${CHAMP}/appeals/appealFlow2`).set({
        status: 'pending', claimId: 'claim2', appellantName: 'Piloto Flow 2',
        reason: 'Motivo suficientemente largo para pasar validación',
    });
});

await check('Paso 1 — "Admitir a trámite" (handleAdmitAppeal) pone la alegación en "reviewing", tal como hace la UI', async () => {
    const ref = db.doc(`${CHAMP}/appeals/appealFlow2`);
    // Réplica literal de handleAdmitAppeal en PenaltiesTab.js:
    //   await FirebaseService.updateAppeal(championshipId, appeal.id, { status: 'reviewing' });
    await ref.set({ status: 'reviewing' }, { merge: true });
    const snap = await ref.get();
    assertEqual(snap.data().status, 'reviewing');
});

// Este check PASA si logra REPRODUCIR el bug (documenta el estado real del
// código) y FALLA (ruidosamente) si en el futuro la resolución llegara a
// tener éxito sin haberse corregido el guard — momento en el que este test
// debe reescribirse en sentido positivo.
await check('BUG CONFIRMADO — Paso 2: resolver una alegación ya "Admitida a trámite" (status="reviewing") falla SIEMPRE con "ya fue resuelta por otra persona" (mensaje engañoso: nadie más la resolvió, solo fue admitida)', async () => {
    const ref = db.doc(`${CHAMP}/appeals/appealFlow2`);
    let threw = null;
    try {
        await resolveAppealTransactional(ref, { status: 'upheld', resolvedBy: 'dirLiga1', resolution: 'ok' });
    } catch (err) {
        threw = err;
    }
    if (!threw) {
        throw new Error('La resolución tuvo éxito — si esto es intencional, el bug fue corregido: reescribir este test en sentido positivo.');
    }
    if (!/ya fue resuelta/.test(threw.message)) {
        throw new Error(`Falló, pero con un mensaje distinto al esperado: ${threw.message}`);
    }
    // No relanzamos: llegar aquí demuestra que el bug sigue presente tal
    // como se documentó, así que el check se considera "pasado" (bug
    // reproducido con éxito), no un fallo del test.
});

await app.delete();

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
