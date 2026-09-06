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

// Las colecciones se descubren en tiempo de ejecución, no se enumeran a mano.
// La lista fija se había quedado atrás: no incluía `cars` (574 documentos),
// `equipment` ni la subcolección `declarations` de los campeonatos, así que un
// backup hecho para tener punto de restauración se los dejaba fuera en
// silencio — justo lo que no puede pasar en un backup.

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

/** Vuelca las subcolecciones de un documento, a cualquier profundidad. */
async function dumpSubcollections(docRef) {
    const result = {};
    for (const sub of await docRef.listCollections()) {
        const snap = await sub.get();
        if (snap.empty) continue;
        result[sub.id] = [];
        for (const d of snap.docs) {
            const entry = { id: d.id, data: serializeValue(d.data()) };
            const anidadas = await dumpSubcollections(d.ref);
            if (Object.keys(anidadas).length) entry.subcollections = anidadas;
            result[sub.id].push(entry);
        }
    }
    return result;
}

async function dumpCollection(colRef) {
    const snap = await colRef.get();
    const docs = [];
    for (const d of snap.docs) {
        const entry = { id: d.id, data: serializeValue(d.data()) };
        const subs = await dumpSubcollections(d.ref);
        if (Object.keys(subs).length) entry.subcollections = subs;
        docs.push(entry);
    }
    return docs;
}

/** Cuenta documentos incluyendo los de subcolecciones anidadas. */
function contar(docs) {
    return docs.reduce((total, d) => total + 1 + Object.values(d.subcollections || {})
        .reduce((a, arr) => a + contar(arr), 0), 0);
}

async function main() {
    const backup = { exportedAt: new Date().toISOString(), collections: {} };
    let totalDocs = 0;

    const colecciones = await db.listCollections();
    for (const col of colecciones) {
        process.stdout.write(`Exportando ${col.id}... `);
        const docs = await dumpCollection(col);
        backup.collections[col.id] = docs;
        const total = contar(docs);
        totalDocs += total;
        console.log(`${docs.length} documentos${total > docs.length ? ` (+ ${total - docs.length} en subcolecciones)` : ''}`);
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
