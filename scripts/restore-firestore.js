/**
 * Restaura un backup generado por scripts/backup-firestore.js.
 *
 * ⚠️ SOBRESCRIBE los documentos existentes con los mismos IDs (usa .set(),
 * no merge). Pensado para rollback de emergencia, no para uso rutinario.
 *
 * Uso: node scripts/restore-firestore.js backups/firestore-backup-<ts>.json
 */

const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/** Revierte los marcadores { __type: 'timestamp', value } a Firestore Timestamp */
function deserializeValue(value) {
    if (value && typeof value === 'object' && value.__type === 'timestamp') {
        return admin.firestore.Timestamp.fromDate(new Date(value.value));
    }
    if (Array.isArray(value)) {
        return value.map(deserializeValue);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = deserializeValue(v);
        return out;
    }
    return value;
}

async function restoreSubcollections(docRef, subcollections) {
    for (const [name, docs] of Object.entries(subcollections || {})) {
        for (const doc of docs) {
            await docRef.collection(name).doc(doc.id).set(deserializeValue(doc.data));
        }
    }
}

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Uso: node scripts/restore-firestore.js <ruta-al-backup.json>');
        process.exit(1);
    }
    const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`Restaurando backup del ${backup.exportedAt}...`);
    let totalDocs = 0;

    for (const [collectionName, docs] of Object.entries(backup.collections)) {
        process.stdout.write(`Restaurando ${collectionName}... `);
        for (const doc of docs) {
            const docRef = db.collection(collectionName).doc(doc.id);
            await docRef.set(deserializeValue(doc.data));
            await restoreSubcollections(docRef, doc.subcollections);
            totalDocs++;
        }
        console.log(`${docs.length} documentos`);
    }

    console.log(`\n✅ Restauración completada. Total de documentos: ${totalDocs}`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error durante la restauración:', err);
    process.exit(1);
});
