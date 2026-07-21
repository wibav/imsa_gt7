/**
 * Renombra al piloto "zeusguerrero.m@gmail.com" (email usado por error como
 * GT7 ID) a su GT7 ID real "Zeus GM" en TODAS las ubicaciones donde el
 * modelo de datos guarda ese identificador de forma denormalizada (sin IDs
 * relacionales, todo por nombre de string) dentro del campeonato "Campeonato
 * de Verano de Gran Turismo 7" (EmPr0pZG1SPGWQbubvRx):
 *
 *   1. championship.drivers[] (name)
 *   2. divisions/{Division Loky}.drivers[] (entrada de array)
 *   3. tracks/{Spa Francorchamps}.points[OLD] -> points[NEW]
 *   4. tracks/{Spa Francorchamps}.carsUsed[OLD] -> carsUsed[NEW]
 *   5. tracks/{Spa Francorchamps}.results.divisions[Division Loky].racePositions[OLD] -> [NEW]
 *   6. tracks/{Spa Francorchamps}.results.divisions[Division Loky].racePoints[OLD] -> [NEW]
 *   7. claims/{BCjHqkjfIJyRZBAI6cbh}.reporterName
 *
 * Verificado previamente (read-only) que NO aparece en: registrations[],
 * teams, penalties, otras claims, otras pistas, otras divisiones.
 *
 * Uso:
 *   node scripts/rename-driver-zeusguerrero.js           # dry-run
 *   node scripts/rename-driver-zeusguerrero.js --apply    # aplica
 *
 * Correr primero scripts/backup-firestore.js (ya hecho antes de este script).
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CHAMP_ID = 'EmPr0pZG1SPGWQbubvRx';
const TRACK_ID = 'XaQo0KAC4GafrbV2hJvt';
const DIVISION_ID = 'nmhNv3fQfd6yKXdeRIXm';
const CLAIM_ID = 'BCjHqkjfIJyRZBAI6cbh';
const OLD = 'zeusguerrero.m@gmail.com';
const NEW = 'Zeus GM';

const APPLY = process.argv.includes('--apply');

function renameKey(obj, oldKey, newKey) {
    if (!obj || !(oldKey in obj)) return obj;
    const { [oldKey]: value, ...rest } = obj;
    return { ...rest, [newKey]: value };
}

async function main() {
    const champRef = db.collection('championships').doc(CHAMP_ID);
    const champSnap = await champRef.get();
    const champ = champSnap.data();

    const updatedDrivers = (champ.drivers || []).map(d => d.name === OLD ? { ...d, name: NEW } : d);
    console.log('championship.drivers: renombrado?', JSON.stringify(updatedDrivers.find(d => d.name === NEW)));

    const divRef = db.collection('championships').doc(CHAMP_ID).collection('divisions').doc(DIVISION_ID);
    const divSnap = await divRef.get();
    const division = divSnap.data();
    const updatedDivDrivers = (division.drivers || []).map(d => d === OLD ? NEW : d);
    console.log('division.drivers: incluye NEW?', updatedDivDrivers.includes(NEW), '| incluye OLD?', updatedDivDrivers.includes(OLD));

    const trackRef = db.collection('championships').doc(CHAMP_ID).collection('tracks').doc(TRACK_ID);
    const trackSnap = await trackRef.get();
    const track = trackSnap.data();

    const updatedPoints = renameKey(track.points, OLD, NEW);
    const updatedCarsUsed = renameKey(track.carsUsed, OLD, NEW);
    const divResult = track.results.divisions[DIVISION_ID];
    const updatedDivResult = {
        ...divResult,
        racePositions: renameKey(divResult.racePositions, OLD, NEW),
        racePoints: renameKey(divResult.racePoints, OLD, NEW),
    };
    console.log('track.points[NEW]=', updatedPoints[NEW], '| track.points[OLD] sigue?', OLD in updatedPoints);
    console.log('track.carsUsed[NEW]=', updatedCarsUsed[NEW]);
    console.log('racePositions[NEW]=', updatedDivResult.racePositions[NEW]);
    console.log('racePoints[NEW]=', updatedDivResult.racePoints[NEW]);

    const claimRef = db.collection('championships').doc(CHAMP_ID).collection('claims').doc(CLAIM_ID);
    const claimSnap = await claimRef.get();
    const claim = claimSnap.data();
    console.log('claim.reporterName actual=', claim.reporterName, '-> nuevo=', NEW);

    if (!APPLY) {
        console.log('\nDry-run — nada se escribió. Correr con --apply para aplicar.');
        process.exit(0);
    }

    const batch = db.batch();
    batch.update(champRef, { drivers: updatedDrivers });
    batch.update(divRef, { drivers: updatedDivDrivers });
    batch.update(trackRef, {
        points: updatedPoints,
        carsUsed: updatedCarsUsed,
        [`results.divisions.${DIVISION_ID}`]: updatedDivResult,
    });
    batch.update(claimRef, { reporterName: NEW });
    await batch.commit();

    console.log('\n✅ Renombrado aplicado en las 4 ubicaciones (batch atómico).');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error renombrando:', err);
    process.exit(1);
});
