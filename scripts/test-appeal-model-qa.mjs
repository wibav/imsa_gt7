/**
 * QA adversarial — models/Penalty.js: clase Appeal, isPenaltyCounting, y
 * el resto de la superficie tocada por la incidencia 3.
 *
 * Foco (punto 3 del encargo de QA): Appeal.toFirestore() usa `{...this}`,
 * el MISMO patrón que causó que `reporterPsnId` nunca llegara a Firestore
 * (D3.1). Construimos un Appeal con TODOS los campos poblados y verificamos
 * que ninguno se pierda al serializar.
 *
 * Uso: node scripts/test-appeal-model-qa.mjs
 */
import { Appeal, isPenaltyCounting } from '../src/app/models/Penalty.js';

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
    if (actual !== expected) throw new Error(`${msg || 'assertEqual'}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
}

// ── D3.1-bis: Appeal.toFirestore() no debe perder campos ──
const fullAppealInput = {
    id: 'should-be-stripped',
    championshipId: 'champ-1',
    claimId: 'claim-1',
    penaltyId: 'penalty-1',
    appellantName: 'Piloto Test',
    appellantPsnId: 'PSN_TEST_123',
    appellantRole: 'accused',
    reason: 'Motivo detallado de la alegación con suficiente longitud',
    evidence: ['https://example.com/clip1', 'https://example.com/clip2'],
    status: 'pending',
    resolution: '',
    resolvedBy: '',
    resolvedAt: null,
    createdAt: '2026-07-01T10:00:00.000Z',
};

check('Appeal.toFirestore() preserva TODOS los campos declarados en el constructor', () => {
    const appeal = new Appeal(fullAppealInput);
    const data = appeal.toFirestore();

    const fieldsToCheck = [
        'championshipId', 'claimId', 'penaltyId', 'appellantName', 'appellantPsnId',
        'appellantRole', 'reason', 'evidence', 'status', 'resolution', 'resolvedBy', 'resolvedAt'
    ];
    const missing = fieldsToCheck.filter(f => !(f in data));
    if (missing.length > 0) throw new Error(`Campos perdidos en toFirestore(): ${missing.join(', ')}`);

    assertEqual(data.appellantPsnId, 'PSN_TEST_123', 'appellantPsnId debe llegar a Firestore (mismo bug que D3.1 con reporterPsnId)');
    assertEqual(data.penaltyId, 'penalty-1');
    assertEqual(data.evidence.length, 2);
});

check('Appeal.toFirestore() SÍ elimina `id` (no debe guardarse como campo del documento)', () => {
    const appeal = new Appeal(fullAppealInput);
    const data = appeal.toFirestore();
    assertEqual('id' in data, false, 'id no debe estar en el payload de Firestore');
});

check('Appeal.toFirestore() actualiza updatedAt en cada serialización', () => {
    const appeal = new Appeal({ ...fullAppealInput, updatedAt: '2020-01-01T00:00:00.000Z' });
    const data = appeal.toFirestore();
    const now = new Date();
    const updatedAt = new Date(data.updatedAt);
    // Debe ser "reciente" (creado en este mismo test run), no el valor viejo pasado.
    if (Math.abs(now - updatedAt) > 5000) throw new Error('updatedAt no se refrescó al serializar');
});

check('Appeal con datos vacíos no explota y aplica defaults sensatos', () => {
    const appeal = new Appeal({});
    assertEqual(appeal.status, 'pending');
    assertEqual(appeal.appellantRole, 'accused');
    assertEqual(Array.isArray(appeal.evidence), true);
    assertEqual(appeal.evidence.length, 0);
});

check('Appeal.evidence acepta un string suelto (no array) y lo normaliza a array de 1', () => {
    const appeal = new Appeal({ evidence: 'https://example.com/solo-un-link' });
    assertEqual(appeal.evidence.length, 1);
    assertEqual(appeal.evidence[0], 'https://example.com/solo-un-link');
});

check('Appeal.fromFirestore reconstruye con el id del documento', () => {
    const appeal = Appeal.fromFirestore('doc123', { claimId: 'c1', appellantName: 'X', reason: 'y'.repeat(20) });
    assertEqual(appeal.id, 'doc123');
});

// ── validate() ──
check('validate(): rechaza Appeal sin claimId', () => {
    const appeal = new Appeal({ appellantName: 'X', reason: 'y'.repeat(20) });
    const { isValid, errors } = appeal.validate();
    assertEqual(isValid, false);
    if (!errors.some(e => /reclamación/.test(e))) throw new Error('debería señalar claimId faltante');
});

check('validate(): rechaza reason vacío o solo espacios', () => {
    const appeal = new Appeal({ claimId: 'c1', appellantName: 'X', reason: '    ' });
    assertEqual(appeal.validate().isValid, false);
});

check('validate(): rechaza reason de más de 4000 caracteres', () => {
    const appeal = new Appeal({ claimId: 'c1', appellantName: 'X', reason: 'a'.repeat(4001) });
    assertEqual(appeal.validate().isValid, false);
});

check('validate(): acepta un Appeal mínimo válido', () => {
    const appeal = new Appeal({ claimId: 'c1', appellantName: 'X', reason: 'Motivo suficientemente largo' });
    assertEqual(appeal.validate().isValid, true);
});

// ── isPenaltyCounting: adversarial de estados ──
check('isPenaltyCounting: "applied" cuenta', () => assertEqual(isPenaltyCounting({ status: 'applied' }), true));
check('isPenaltyCounting: "appealed" cuenta (CA-3.9, decisión explícita: no se suspende)', () => assertEqual(isPenaltyCounting({ status: 'appealed' }), true));
check('isPenaltyCounting: "revoked" NO cuenta', () => assertEqual(isPenaltyCounting({ status: 'revoked' }), false));
check('isPenaltyCounting: "pending" NO cuenta (no es un estado válido de Penalty, pero fail-safe)', () => assertEqual(isPenaltyCounting({ status: 'pending' }), false));
check('isPenaltyCounting: estado inventado/desconocido NO cuenta', () => assertEqual(isPenaltyCounting({ status: 'quien-sabe' }), false));
check('isPenaltyCounting: status ausente/undefined NO cuenta', () => assertEqual(isPenaltyCounting({}), false));
check('isPenaltyCounting: penalty null/undefined NO explota y NO cuenta', () => {
    assertEqual(isPenaltyCounting(null), false);
    assertEqual(isPenaltyCounting(undefined), false);
});

console.log(`\n${passed} pasaron, ${failed} fallaron`);
if (failed > 0) process.exit(1);
