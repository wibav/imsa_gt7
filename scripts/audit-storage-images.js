#!/usr/bin/env node
/**
 * Inventario de Firebase Storage: detecta objetos duplicados (mismo contenido)
 * y huérfanos (no referenciados por ningún documento de Firestore).
 *
 * Nace de un problema real: en toda la app se sube (FirebaseService.uploadImage)
 * pero nunca se borra — `deleteImage` no tiene ni una sola llamada. Cada vez que
 * alguien reemplaza el banner de un campeonato, la imagen de un circuito o el
 * logo de una organización, el archivo anterior se queda en el bucket para
 * siempre. Y como el nombre lleva `Date.now()`, subir dos veces el mismo archivo
 * genera dos objetos idénticos con nombres distintos.
 *
 * En vez de ir campo por campo (banner, logo, layoutImage, …) recorre TODOS los
 * documentos de Firestore, incluidas subcolecciones, y extrae cualquier URL de
 * Storage que aparezca en cualquier string. Así no se cuela como huérfano una
 * imagen referenciada desde un campo que nadie recordaba.
 *
 * Uso:
 *   node scripts/audit-storage-images.js                 # solo informe
 *   node scripts/audit-storage-images.js --json out.json # informe + JSON
 *   node scripts/audit-storage-images.js --delete-orphans  # BORRA (irreversible)
 *
 * Requiere serviceAccountKey.json en la raíz del proyecto.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.resolve(__dirname, '..');
const BUCKET = 'imsa-bd5b6.firebasestorage.app';

const args = process.argv.slice(2);
const DELETE_ORPHANS = args.includes('--delete-orphans');
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx !== -1 ? args[jsonIdx + 1] : null;

admin.initializeApp({
    credential: admin.credential.cert(require(path.join(ROOT, 'serviceAccountKey.json'))),
    storageBucket: BUCKET,
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Extrae rutas de objeto de Storage a partir de un texto cualquiera.
 * Cubre las dos formas en que aparecen en esta base de datos:
 *   - URL de descarga:  .../v0/b/<bucket>/o/tracks%2F123_foo.png?alt=media&token=…
 *   - gs://bucket/ruta  (no se usa hoy, pero es barato contemplarlo)
 */
function extractStoragePaths(text) {
    const out = [];
    // Ojo con los paréntesis: encodeURIComponent NO escapa ( ) . ! * ' ~, así
    // que un archivo llamado "Captura de pantalla a la(s) 5.22.png" aparece con
    // paréntesis literales en la URL. Excluirlos del match trocea la ruta y hace
    // que el objeto se reporte como huérfano estando en uso. Solo cortan aquí el
    // '?' de la query, las comillas y el espacio.
    const downloadUrl = /firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?"'\s\\]+)/g;
    let m;
    while ((m = downloadUrl.exec(text))) out.push(decodeURIComponent(m[1]));
    const gs = /gs:\/\/[^/]+\/([^\s"']+)/g;
    while ((m = gs.exec(text))) out.push(m[1]);
    return out;
}

/** Recorre un valor de Firestore buscando strings con URLs de Storage. */
function walkValue(value, onPath) {
    if (typeof value === 'string') {
        for (const p of extractStoragePaths(value)) onPath(p);
    } else if (Array.isArray(value)) {
        value.forEach(v => walkValue(v, onPath));
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        Object.values(value).forEach(v => walkValue(v, onPath));
    }
}

/** Recorre una colección y sus subcolecciones en profundidad. */
async function scanCollection(colRef, refs, stats) {
    const snap = await colRef.get();
    stats.docs += snap.size;
    for (const docSnap of snap.docs) {
        const where = docSnap.ref.path;
        walkValue(docSnap.data(), (p) => {
            if (!refs.has(p)) refs.set(p, new Set());
            refs.get(p).add(where);
        });
        const subs = await docSnap.ref.listCollections();
        for (const sub of subs) await scanCollection(sub, refs, stats);
    }
}

function human(bytes) {
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0, n = Number(bytes);
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

(async () => {
    console.log('Leyendo Firestore (todas las colecciones y subcolecciones)…');
    const refs = new Map();          // ruta de objeto -> Set(documentos que la citan)
    const stats = { docs: 0 };
    for (const col of await db.listCollections()) {
        await scanCollection(col, refs, stats);
    }
    console.log(`  ${stats.docs} documentos leídos, ${refs.size} rutas de Storage referenciadas.\n`);

    console.log('Listando objetos del bucket…');
    const [files] = await bucket.getFiles();
    console.log(`  ${files.length} objetos en gs://${BUCKET}\n`);

    const objects = files.map(f => ({
        name: f.name,
        size: Number(f.metadata.size || 0),
        md5: f.metadata.md5Hash || null,
        updated: f.metadata.updated,
        referencedBy: [...(refs.get(f.name) || [])],
    }));

    const known = new Set(objects.map(o => o.name));
    const missing = [...refs.keys()].filter(p => !known.has(p));

    // Huérfanos: en el bucket pero citados por cero documentos.
    const orphans = objects.filter(o => o.referencedBy.length === 0 && o.size > 0);

    // Duplicados: mismo md5 (mismo contenido byte a byte) en más de un objeto.
    const byMd5 = new Map();
    for (const o of objects) {
        if (!o.md5 || o.size === 0) continue;
        if (!byMd5.has(o.md5)) byMd5.set(o.md5, []);
        byMd5.get(o.md5).push(o);
    }
    const dupGroups = [...byMd5.values()].filter(g => g.length > 1);

    const totalSize = objects.reduce((a, o) => a + o.size, 0);
    const orphanSize = orphans.reduce((a, o) => a + o.size, 0);
    // Espacio recuperable si de cada grupo duplicado se conservara una copia.
    const dupWaste = dupGroups.reduce((a, g) => a + g.slice(1).reduce((b, o) => b + o.size, 0), 0);

    console.log('═'.repeat(72));
    console.log(`OBJETOS: ${objects.length}  •  ${human(totalSize)} en total`);
    console.log(`HUÉRFANOS: ${orphans.length}  •  ${human(orphanSize)}`);
    console.log(`GRUPOS DUPLICADOS: ${dupGroups.length}  •  ${human(dupWaste)} recuperables`);
    console.log(`REFERENCIAS ROTAS (documento apunta a un objeto inexistente): ${missing.length}`);
    console.log('═'.repeat(72));

    // Desglose por prefijo de primer nivel, para ver de dónde sale la basura.
    const byPrefix = new Map();
    for (const o of objects) {
        const pfx = o.name.split('/')[0] || '(raíz)';
        const e = byPrefix.get(pfx) || { n: 0, size: 0, orphans: 0, orphanSize: 0 };
        e.n++; e.size += o.size;
        if (o.referencedBy.length === 0 && o.size > 0) { e.orphans++; e.orphanSize += o.size; }
        byPrefix.set(pfx, e);
    }
    console.log('\nPor prefijo:');
    for (const [pfx, e] of [...byPrefix].sort((a, b) => b[1].size - a[1].size)) {
        console.log(`  ${pfx.padEnd(20)} ${String(e.n).padStart(4)} obj  ${human(e.size).padStart(9)}   huérfanos: ${String(e.orphans).padStart(4)} (${human(e.orphanSize)})`);
    }

    if (dupGroups.length) {
        console.log('\nDuplicados (mismo contenido, distinto nombre):');
        for (const g of dupGroups.sort((a, b) => b[0].size - a[0].size)) {
            console.log(`  ${human(g[0].size)} × ${g.length}`);
            for (const o of g) {
                const tag = o.referencedBy.length ? `usado por ${o.referencedBy.length} doc(s)` : 'SIN REFERENCIAS';
                console.log(`     ${o.name}  — ${tag}`);
            }
        }
    }

    if (orphans.length) {
        console.log('\nHuérfanos (ningún documento de Firestore los cita):');
        for (const o of orphans.sort((a, b) => b.size - a.size)) {
            console.log(`  ${human(o.size).padStart(9)}  ${o.updated?.slice(0, 10)}  ${o.name}`);
        }
    }

    if (missing.length) {
        console.log('\nReferencias rotas:');
        for (const p of missing) {
            console.log(`  ${p}\n     citado en: ${[...refs.get(p)].join(', ')}`);
        }
    }

    if (JSON_OUT) {
        fs.writeFileSync(JSON_OUT, JSON.stringify({ objects, orphans, dupGroups, missing }, null, 2));
        console.log(`\nInforme JSON: ${JSON_OUT}`);
    }

    if (DELETE_ORPHANS) {
        console.log(`\n⚠️  Borrando ${orphans.length} objetos huérfanos (irreversible)…`);
        for (const o of orphans) {
            await bucket.file(o.name).delete();
            console.log(`  borrado ${o.name}`);
        }
        console.log('Hecho.');
    } else if (orphans.length) {
        console.log('\nNada se ha borrado. Para borrar los huérfanos: --delete-orphans');
    }

    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
