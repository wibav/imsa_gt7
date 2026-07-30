/**
 * Test del motor de clasificaciones (standingsCalculator.js) — foco en el
 * efecto de las sanciones 'applied'/'appealed'/'revoked' sobre los puntos
 * publicados (CA-3.9, CA-3.13, R3.1).
 *
 * standingsCalculator.js no depende de React ni de Firebase — es
 * directamente importable desde Node. No requiere emulador ni credenciales.
 *
 * Uso: node scripts/test-standings-penalties.mjs
 */
import { calculateAdvancedStandings } from '../src/app/utils/standingsCalculator.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || 'assertEqual failed'}: esperado ${expected}, obtenido ${actual}`);
    }
}

// ── Fixtures base ──
const championship = {
    id: 'champ-1',
    drivers: [{ name: 'Driver-A' }, { name: 'Driver-B' }],
    registrations: [],
    penaltiesConfig: { enabled: true, warningThreshold: 8, autoPointsPenalty: 10 }
};
const teams = [];
const tracks = [
    { id: 't1', round: 1, name: 'Race 1', points: { 'Driver-A': 100, 'Driver-B': 50 } }
];

function getDriver(standings, name) {
    return standings.find(d => d.name === name);
}

// ── CA-3.9: una sanción 'appealed' descuenta puntos exactamente igual que 'applied' ──
check('CA-3.9: sanción "applied" descuenta -5 puntos', () => {
    const penalties = [{ driverName: 'Driver-A', points: 5, status: 'applied' }];
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 95);
});

check('CA-3.9: sanción "appealed" descuenta EXACTAMENTE lo mismo que "applied" (−5, no se suspende)', () => {
    const appliedPenalties = [{ driverName: 'Driver-A', points: 5, status: 'applied' }];
    const appealedPenalties = [{ driverName: 'Driver-A', points: 5, status: 'appealed' }];
    const applied = calculateAdvancedStandings(championship, teams, tracks, appliedPenalties);
    const appealed = calculateAdvancedStandings(championship, teams, tracks, appealedPenalties);
    assertEqual(
        getDriver(appealed.driverStandings, 'Driver-A').totalPoints,
        getDriver(applied.driverStandings, 'Driver-A').totalPoints,
        'appealed debe dar el mismo totalPoints que applied'
    );
    assertEqual(getDriver(appealed.driverStandings, 'Driver-A').totalPoints, 95);
});

// ── CA-3.13: tras "overturned" (penalty pasa a 'revoked'), los puntos se restituyen ──
check('CA-3.13: 100 pts brutos, -5 en appealed → 95; tras overturned (revoked) → 100', () => {
    const duringAppeal = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 5, status: 'appealed' }]);
    assertEqual(getDriver(duringAppeal.driverStandings, 'Driver-A').totalPoints, 95);

    const afterOverturned = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 5, status: 'revoked' }]);
    assertEqual(getDriver(afterOverturned.driverStandings, 'Driver-A').totalPoints, 100);
});

// ── Regresión: 'revoked' sigue sin descontar (comportamiento preexistente intacto) ──
check('Regresión: sanción "revoked" no descuenta puntos', () => {
    const penalties = [{ driverName: 'Driver-A', points: 20, status: 'revoked' }];
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 100);
});

// ── warningPoints acumulados y umbral de descalificación automática incluyen 'appealed' ──
check('warningPoints/umbral automático: una sanción "appealed" cuenta igual que "applied"', () => {
    // warningThreshold=8, autoPointsPenalty=10 (fixture championship de arriba)
    const penalties = [{ driverName: 'Driver-A', points: 0, warningPoints: 8, status: 'appealed' }];
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    const driver = getDriver(driverStandings, 'Driver-A');
    // 8 >= threshold(8) → 1 disparo * autoPointsPenalty(10) = -10 adicionales
    assertEqual(driver.totalPoints, 90, 'debe aplicar la deducción automática por umbral de amonestaciones');
});

// ── Cruce de nombres con normalizeName: guiones unicode, espacios invisibles ──
check('Cruce de nombres: guión en-dash unicode en driverName de la sanción se normaliza', () => {
    const champ2 = { ...championship, drivers: [{ name: 'Driver-A' }] };
    const tracks2 = [{ id: 't1', round: 1, points: { 'Driver-A': 100 } }];
    // "Driver–A" con en-dash (U+2013) en vez de guión normal
    const penalties = [{ driverName: 'Driver–A', points: 5, status: 'applied' }];
    const { driverStandings } = calculateAdvancedStandings(champ2, teams, tracks2, penalties);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 95, 'debe cruzar pese al guión unicode distinto');
});

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
