/*
 * Renombra las entradas legacy de la colección `tracks` (catálogo global de
 * layouts, usado por TracksAdmin/ChampionshipForm) para que coincidan con
 * los nombres oficiales de GT7_TRACKS (src/app/utils/constants.js).
 *
 * Por qué: TracksAdmin fusiona `tracks` (Firestore) con GT7_TRACKS
 * (constante estática) comparando nombres normalizados (minúsculas, sin
 * acentos). Nombres viejos/abreviados como "Fuji" o "LeMans" no matchean
 * ningún nombre de GT7_TRACKS, así que aparecen DOS VECES en el admin: una
 * vez con imagen (el nombre viejo) y otra fantasma sin imagen (el nombre
 * oficial). Renombrar el doc a su nombre oficial hace que el merge los
 * reconozca como el mismo circuito.
 *
 * Seguro de correr: los campeonatos ya creados guardan su propia copia de
 * `name`/`layoutImage` en cada ronda (championships/{id}/tracks/{trackId}),
 * no una referencia a este catálogo — renombrar aquí no rompe nada ya
 * cargado, solo corrige el catálogo para futuras selecciones.
 *
 * Usage:
 *   node scripts/dedupe-tracks-catalog.js           (dry-run, solo muestra)
 *   node scripts/dedupe-tracks-catalog.js --apply    (aplica los cambios)
 *   (requiere serviceAccountKey.json en la raíz del proyecto)
 */

const admin = require("firebase-admin");
const path = require("path");

function initFirebaseAdmin() {
    if (admin.apps.length) return admin.app();
    const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.app();
}

// id del doc en `tracks` → nuevo nombre oficial (de GT7_TRACKS)
const RENAME_MAP = {
    4: "Brands Hatch - GP",
    15: "Barcelona-Catalunya - GP",
    6: "Daytona International Speedway - Oval",
    10: "Fuji International Speedway",
    5: "Autódromo de Interlagos",
    3: "Circuit de la Sarthe (Le Mans)",
    14: "Mount Panorama (Bathurst)",
    7: "Nürburgring - GP",
    12: "Red Bull Ring",
    11: "Michelin Raceway Road Atlanta",
    13: "Circuit de Spa-Francorchamps",
    8: "Suzuka Circuit",
    1: "Watkins Glen International",
};

async function run() {
    initFirebaseAdmin();
    const db = admin.firestore();
    const apply = process.argv.includes("--apply");

    console.log(apply ? "Aplicando renombres...\n" : "Dry-run (usa --apply para escribir)\n");

    for (const [id, newName] of Object.entries(RENAME_MAP)) {
        const ref = db.collection("tracks").doc(String(id));
        const snap = await ref.get();
        if (!snap.exists) {
            console.log(`⚠️  id=${id} no existe, se omite`);
            continue;
        }
        const oldName = snap.data().name;
        console.log(`${apply ? "✏️ " : "  "} [${id}] "${oldName}" → "${newName}"`);
        if (apply) {
            await ref.update({ name: newName });
        }
    }

    console.log(apply ? "\n✅ Listo." : "\nNada escrito — corre con --apply para confirmar.");
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
