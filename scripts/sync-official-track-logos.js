/*
 * Logos oficiales de los circuitos de GT7 (gran-turismo.com/us/gt7/tracklist/).
 *
 * La web oficial no publica mapas de trazado, solo un logo por ubicación
 * (PNG 400×200, logo oscuro sobre fondo transparente). Este script:
 * 1. Descarga cada logo de scripts/data/gt7-track-logos.json.
 * 2. Lo sube a Storage (tracks/logos/<archivo>) con token de descarga.
 * 3. Escribe `logo` en cada doc de `tracks` cuyo nombre contenga la clave
 *    de la ubicación (la clave más larga gana: «Sardegna - Windmills» antes
 *    que «Sardegna»). No toca `layoutImage`.
 *
 * Usage:
 *   node scripts/sync-official-track-logos.js            (dry-run)
 *   node scripts/sync-official-track-logos.js --apply    (sube y escribe)
 */

const admin = require("firebase-admin");
const path = require("path");
const crypto = require("crypto");
const datos = require("./data/gt7-track-logos.json");

const APLICAR = process.argv.includes("--apply");
const BUCKET = "imsa-bd5b6.firebasestorage.app";

const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: BUCKET });
const db = admin.firestore();
const bucket = admin.storage().bucket();

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const claves = Object.keys(datos.logos).sort((a, b) => b.length - a.length);

function claveDe(nombre) {
    const n = norm(nombre);
    // «Spa» como palabra suelta, para no confundirla con otras cadenas
    return claves.find((k) => (k === "Spa" ? /\bspa\b/.test(n) : n.includes(norm(k))));
}

async function subir(archivo) {
    const res = await fetch(datos.base + archivo);
    if (!res.ok) throw new Error(`${archivo}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const destino = `tracks/logos/${archivo}`;
    const token = crypto.randomUUID();
    await bucket.file(destino).save(buf, {
        contentType: "image/png",
        metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
    });
    return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(destino)}?alt=media&token=${token}`;
}

(async () => {
    const snap = await db.collection("tracks").get();
    const asignaciones = [];
    const sinLogo = [];
    snap.forEach((d) => {
        const clave = claveDe(d.data().name);
        if (clave) asignaciones.push({ id: d.id, name: d.data().name, clave });
        else sinLogo.push(d.data().name);
    });
    const usadas = new Set(asignaciones.map((a) => a.clave));
    console.log(`Trazados: ${snap.size} · con logo: ${asignaciones.length} · sin logo: ${sinLogo.length}`);
    sinLogo.forEach((n) => console.log(`  ✗ ${n}`));
    Object.keys(datos.logos).filter((k) => !usadas.has(k)).forEach((k) => console.log(`  (logo sin uso: ${k})`));
    if (!APLICAR) return console.log("\nDry-run. Usa --apply para subir y escribir.");

    const urls = {};
    for (const k of usadas) {
        urls[k] = await subir(datos.logos[k]);
        console.log(`↑ ${k}`);
    }
    const batch = db.batch();
    asignaciones.forEach((a) =>
        batch.update(db.collection("tracks").doc(a.id), {
            logo: urls[a.clave],
            logoFuente: datos.fuente,
        })
    );
    await batch.commit();
    console.log(`✓ ${asignaciones.length} trazados con logo.`);
})().catch((e) => { console.error(e); process.exit(1); });
