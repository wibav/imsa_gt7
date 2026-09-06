/*
 * Sincroniza la colección `cars` (catálogo global de coches) contra la lista
 * oficial de GT7 — mismo enfoque que scripts/sync-official-tracks-catalog.js
 * para los circuitos.
 *
 * De dónde salen los datos: gran-turismo.com/es/gt7/carlist/ es una app React
 * que NO hace ninguna petición JSON — el catálogo viaja dentro de bundles JS
 * cuyos nombres llevan un hash que cambia con cada actualización del juego.
 * Por eso el script descubre las URLs en cadena en vez de hardcodearlas:
 *
 *   página HTML  →  assets/index-<hash>.js  →  assets/cars.es-<hash>.js
 *                                              assets/tuners.es-<hash>.js
 *
 * Cada bundle es `var e={...};export{e as X}` — se le quita el `export` y se
 * evalúa. Se guarda un subconjunto útil por coche (nombre, clase, fabricante,
 * PR, potencia, peso, tracción); el resto de campos del bundle (medidas,
 * cilindrada, par…) se omite porque la app no los usa.
 *
 * Uso:
 *   node scripts/sync-official-cars-catalog.js            (dry-run)
 *   node scripts/sync-official-cars-catalog.js --apply     (aplica)
 *   (requiere serviceAccountKey.json en la raíz del proyecto)
 */

const admin = require("firebase-admin");
const path = require("path");

const BASE = "https://www.gran-turismo.com";
const CARLIST_URL = `${BASE}/es/gt7/carlist/`;

function initFirebaseAdmin() {
    if (admin.apps.length) return admin.app();
    const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.app();
}

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} al pedir ${url}`);
    return res.text();
}

/** Evalúa un bundle `var e={...};export{e as X}` y devuelve el objeto `e`. */
function evalBundle(src) {
    const cleaned = src.replace(/export\s*\{[^}]*\}\s*;?\s*$/m, "");
    // eslint-disable-next-line no-eval
    return eval(`${cleaned}; e`);
}

/** Descubre las URLs de los bundles siguiendo la cadena HTML → index → datos. */
async function resolveBundleUrls() {
    const html = await fetchText(CARLIST_URL);
    const indexMatch = html.match(/\/common\/dist\/gt7\/carlist\/assets\/index-[A-Za-z0-9_-]+\.js/);
    if (!indexMatch) throw new Error("No se encontró el bundle index en el HTML de carlist");

    const indexSrc = await fetchText(`${BASE}${indexMatch[0]}`);
    const find = (name) => {
        const m = indexSrc.match(new RegExp(`${name}\\.es-[A-Za-z0-9_-]+\\.js`));
        if (!m) throw new Error(`No se encontró el bundle ${name} dentro del index`);
        return `${BASE}/common/dist/gt7/carlist/assets/${m[0]}`;
    };
    return { carsUrl: find("cars"), tunersUrl: find("tuners") };
}

/** `"PR 650.24"` → `650.24`; devuelve null si no hay número. */
function parsePP(value) {
    const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
}

async function loadOfficialCars() {
    const { carsUrl, tunersUrl } = await resolveBundleUrls();
    console.log(`[cars] bundle coches:      ${carsUrl.split("/").pop()}`);
    console.log(`[cars] bundle fabricantes: ${tunersUrl.split("/").pop()}`);

    const [carsSrc, tunersSrc] = await Promise.all([fetchText(carsUrl), fetchText(tunersUrl)]);
    const cars = evalBundle(carsSrc);
    const tuners = evalBundle(tunersSrc);

    return Object.values(cars)
        .map((c) => ({
            id: c.id,
            name: c.nameLong,
            carClass: c.carClass,
            manufacturer: tuners[c.manufacturerId]?.name || "",
            pp: parsePP(c.performancePoint),
            power: c.power_v ?? null,
            weight: c.weight_v ?? null,
            driveTrain: c.driveTrain || "",
        }))
        .filter((c) => c.id && c.name)
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function run() {
    const apply = process.argv.includes("--apply");

    const cars = await loadOfficialCars();
    const byClass = cars.reduce((acc, c) => {
        acc[c.carClass] = (acc[c.carClass] || 0) + 1;
        return acc;
    }, {});
    console.log(`\n[cars] ${cars.length} coches en el catálogo oficial`);
    Object.entries(byClass)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cls, n]) => console.log(`  ${cls.padEnd(6)} ${n}`));

    if (!apply) {
        console.log("\nDry-run — usa --apply para escribir en Firestore.");
        console.log("Muestra (primeros 3):");
        cars.slice(0, 3).forEach((c) => console.log("  ", JSON.stringify(c)));
        return;
    }

    initFirebaseAdmin();
    const db = admin.firestore();

    // Firestore acepta como mucho 500 operaciones por batch.
    const CHUNK = 400;
    let written = 0;
    for (let i = 0; i < cars.length; i += CHUNK) {
        const batch = db.batch();
        cars.slice(i, i + CHUNK).forEach((car) => {
            batch.set(db.collection("cars").doc(car.id), car);
        });
        await batch.commit();
        written += Math.min(CHUNK, cars.length - i);
        console.log(`[cars] ${written}/${cars.length} escritos...`);
    }

    // Coches que ya no existen en el catálogo oficial (retirados del juego).
    const snap = await db.collection("cars").get();
    const officialIds = new Set(cars.map((c) => c.id));
    const stale = snap.docs.filter((d) => !officialIds.has(d.id));
    if (stale.length > 0) {
        const batch = db.batch();
        stale.forEach((d) => {
            console.log(`[cars] eliminando obsoleto: ${d.id} (${d.data().name})`);
            batch.delete(d.ref);
        });
        await batch.commit();
    }

    console.log(`\n✅ Listo. ${cars.length} coches sincronizados, ${stale.length} obsoletos eliminados.`);
}

run()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
