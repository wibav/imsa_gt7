/**
 * QA adversarial adicional sobre standingsCalculator.js / isPenaltyCounting,
 * complementando scripts/test-standings-penalties.mjs (del programador).
 *
 * Uso: node scripts/test-standings-penalties-qa.mjs
 */
import { calculateAdvancedStandings } from '../src/app/utils/standingsCalculator.js';

let passed = 0, failed = 0;
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
    if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: esperado ${expected}, obtenido ${actual}`);
}

const championship = {
    id: 'champ-qa',
    drivers: [{ name: 'Driver-A' }],
    registrations: [],
    penaltiesConfig: { enabled: true, warningThreshold: 8, autoPointsPenalty: 10 }
};
const teams = [];
const tracks = [{ id: 't1', round: 1, name: 'Race 1', points: { 'Driver-A': 100 } }];

function getDriver(standings, name) {
    return standings.find(d => d.name === name);
}

check('Sanción "pending" (estado inventado que NO es válido de Penalty) NO descuenta puntos', () => {
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 20, status: 'pending' }]);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 100);
});

check('Sanción con status inventado ("cualquier-cosa") NO descuenta puntos (fail-safe, solo applied/appealed cuentan)', () => {
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 20, status: 'cualquier-cosa' }]);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 100);
});

check('Sanción sin status (undefined) NO descuenta puntos', () => {
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 20 }]);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 100);
});

check('Múltiples sanciones mixtas: solo applied/appealed descuentan, pending/revoked no', () => {
    const penalties = [
        { driverName: 'Driver-A', points: 5, status: 'applied' },
        { driverName: 'Driver-A', points: 5, status: 'appealed' },
        { driverName: 'Driver-A', points: 100, status: 'revoked' },
        { driverName: 'Driver-A', points: 100, status: 'pending' },
    ];
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    // Solo -5 (applied) -5 (appealed) = -10; las de revoked/pending no cuentan.
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 90);
});

check('Transición completa: applied(-5) → appealed(-5, idéntico) → revoked(0, restituido)', () => {
    const applied = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 5, status: 'applied' }]);
    const appealed = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 5, status: 'appealed' }]);
    const revoked = calculateAdvancedStandings(championship, teams, tracks,
        [{ driverName: 'Driver-A', points: 5, status: 'revoked' }]);

    assertEqual(getDriver(applied.driverStandings, 'Driver-A').totalPoints, 95);
    assertEqual(getDriver(appealed.driverStandings, 'Driver-A').totalPoints, 95, 'appealed debe ser idéntico a applied');
    assertEqual(getDriver(revoked.driverStandings, 'Driver-A').totalPoints, 100, 'revoked debe restituir los puntos');
});

check('warningPoints acumulados de una sanción "appealed" disparan el umbral automático igual que "applied"', () => {
    // warningThreshold=8, autoPointsPenalty=10
    const penalties = [{ driverName: 'Driver-A', points: 0, warningPoints: 9, status: 'appealed' }];
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 90, 'floor(9/8)=1 disparo * 10 = -10');
});

check('warningPoints de una sanción "pending" NO dispara el umbral automático', () => {
    const penalties = [{ driverName: 'Driver-A', points: 0, warningPoints: 9, status: 'pending' }];
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, penalties);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 100, 'una sanción pending no debe sumar warningPoints');
});

check('Array de sanciones vacío no descuenta nada', () => {
    const { driverStandings } = calculateAdvancedStandings(championship, teams, tracks, []);
    assertEqual(getDriver(driverStandings, 'Driver-A').totalPoints, 100);
});

check('penalties undefined/null no explota calculateAdvancedStandings', () => {
    // Defensa mínima: si en algún punto se llama sin el array de sanciones.
    try {
        calculateAdvancedStandings(championship, teams, tracks, undefined);
        // Si no explota, ok (comportamiento tolerante deseable). Si explota,
        // el catch de abajo lo reporta como hallazgo.
    } catch (err) {
        throw new Error(`calculateAdvancedStandings(..., undefined) lanzó: ${err.message} — llamador debe pasar siempre [] `);
    }
});

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
