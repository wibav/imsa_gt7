/**
 * Migra el reglamento hoy hardcodeado en src/app/reglamento/page.js hacia
 * organizations/{orgId}.reglamento — cada organización podrá tener el suyo
 * propio en vez de un único reglamento global compartido por todo el sitio.
 *
 * Extrae el array SECTIONS directamente del código fuente (para no
 * retranscribir manualmente sus ~480 líneas y arriesgar errores) y lo
 * guarda tal cual en Firestore. Update aditivo (merge) sobre el doc de
 * organización ya creado en la Fase 1 (migrate-orgid-backfill.js).
 *
 * Uso: node scripts/migrate-reglamento-to-org.js
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ORG_ID = 'gt7-esp';
const REGLAMENTO_SOURCE = path.join(__dirname, '..', 'src', 'app', 'reglamento', 'page.js');

function extractSections() {
    const src = fs.readFileSync(REGLAMENTO_SOURCE, 'utf8');
    const start = src.indexOf('const DEFAULT_SECTIONS = [');
    if (start === -1) throw new Error('No se encontró "const DEFAULT_SECTIONS = [" en reglamento/page.js');
    const end = src.indexOf('\n];', start) + 3;
    const arrayLiteral = src.slice(start + 'const DEFAULT_SECTIONS = '.length, end - 1);
    // eslint-disable-next-line no-eval
    return eval(arrayLiteral);
}

/**
 * Firestore no admite arrays anidados dentro de arrays (solo arrays de
 * mapas/escalares). Algunas secciones tienen bloques tipo tabla con
 * `rows: [["a","b"], ["c","d"]]` — se envuelve cada fila en un objeto
 * `{ cells: [...] }` para que sea representable. El cliente lo revierte
 * al leer (ver reglamento/page.js).
 */
function toFirestoreSafe(sections) {
    return sections.map(section => ({
        ...section,
        content: section.content.map(block => {
            if (!Array.isArray(block.rows)) return block;
            return { ...block, rows: block.rows.map(cells => ({ cells })) };
        }),
    }));
}

async function main() {
    const sections = extractSections();
    console.log(`Secciones extraídas de reglamento/page.js: ${sections.length}`);
    console.log(sections.map(s => `  - ${s.id}: ${s.title}`).join('\n'));

    const ref = db.collection('organizations').doc(ORG_ID);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new Error(`organizations/${ORG_ID} no existe — correr primero migrate-orgid-backfill.js`);
    }

    await ref.set({
        reglamento: {
            sections: toFirestoreSafe(sections),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`\n✅ Reglamento migrado a organizations/${ORG_ID}.reglamento (${sections.length} secciones)`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error migrando el reglamento:', err);
    process.exit(1);
});
