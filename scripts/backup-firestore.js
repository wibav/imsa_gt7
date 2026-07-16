/**
 * Backup completo de Firestore a un archivo JSON local, para tener un punto
 * de restauración antes de cambios sensibles (p.ej. bootstrap de roles /
 * despliegue de firestore.rules).
 *
 * No requiere permisos de IAM adicionales — usa el mismo serviceAccountKey.json
 * que ya usan los demás scripts (lectura/escritura estándar de Firestore, no
 * el rol especial de gcloud firestore export/import).
 *
 * Uso: node scripts/backup-firestore.js
 * Restaurar: node scripts/restore-firestore.js backups/firestore-backup-<ts>.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Subcolecciones conocidas por documento padre (ver 01-CONTEXTO.md)
const CHAMPIONSHIP_SUBCOLLECTIONS = ['teams', 'tracks', 'divisions', 'events', 'penalties', 'claims'];
const EVENT_SUBCOLLECTIONS = ['participants', 'waitlist', 'results', 'rounds'];
const TOP_LEVEL_COLLECTIONS = ['championships', 'events', 'teams', 'tracks', 'userRoles'];

/** Convierte tipos especiales de Firestore (Timestamp) a algo serializable en JSON */
function serializeValue(value) {
    if (value instanceof admin.firestore.Timestamp) {
        return { __type: 'timestamp', value: value.toDate().toISOString() };
    }
    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
        return out;
    }
    return value;
}

async function dumpSubcollections(docRef, subcollectionNames) {
    const result = {};
    for (const name of subcollectionNames) {
        const snap = await docRef.collection(name).get();
        if (!snap.empty) {
            result[name] = snap.docs.map(d => ({ id: d.id, data: serializeValue(d.data()) }));
        }
    }
    return result;
}

async function dumpCollection(name) {
    const snap = await db.collection(name).get();
    const docs = [];
    for (const d of snap.docs) {
        const entry = { id: d.id, data: serializeValue(d.data()) };
        if (name === 'championships') {
            entry.subcollections = await dumpSubcollections(d.ref, CHAMPIONSHIP_SUBCOLLECTIONS);
        } else if (name === 'events') {
            entry.subcollections = await dumpSubcollections(d.ref, EVENT_SUBCOLLECTIONS);
        }
        docs.push(entry);
    }
    return docs;
}

async function main() {
    const backup = { exportedAt: new Date().toISOString(), collections: {} };
    let totalDocs = 0;

    for (const name of TOP_LEVEL_COLLECTIONS) {
        process.stdout.write(`Exportando ${name}... `);
        const docs = await dumpCollection(name);
        backup.collections[name] = docs;
        const subCount = docs.reduce((acc, d) => acc + Object.values(d.subcollections || {}).reduce((a, arr) => a + arr.length, 0), 0);
        totalDocs += docs.length + subCount;
        console.log(`${docs.length} documentos${subCount ? ` (+ ${subCount} en subcolecciones)` : ''}`);
    }

    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(dir, `firestore-backup-${ts}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

    console.log(`\n✅ Backup guardado en: ${filePath}`);
    console.log(`Total de documentos respaldados: ${totalDocs}`);
    console.log(`Para restaurar: node scripts/restore-firestore.js ${path.relative(process.cwd(), filePath)}`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error durante el backup:', err);
    process.exit(1);
});
