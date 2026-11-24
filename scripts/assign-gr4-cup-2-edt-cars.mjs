/*
 * GR.4 ENDURANCE CUP 2 EDT: asigna un coche fijo a cada ronda, actualiza la
 * descripción y el punto 1 del reglamento particular, y desactiva el control
 * de uso de coches (ya no hace falta declarar coches: los fija cada ronda).
 *
 * Guarda una copia de seguridad en scripts/backups/ antes de escribir.
 *
 * Uso:
 *   node scripts/assign-gr4-cup-2-edt-cars.mjs           (dry-run, solo muestra)
 *   node scripts/assign-gr4-cup-2-edt-cars.mjs --apply   (aplica los cambios)
 */

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHAMPIONSHIP_ID = "yw20gj4Z6IC7FGhusCLJ";

// Circuito (nombre del catálogo) → coche (nombre del catálogo).
const COCHES = {
    "SUGO International Racing Course": "Nissan Silvia spec-R Aero (S15) Touring Car",
    "WeatherTech Raceway Laguna Seca": "Chevrolet Corvette C7 Gr.4",
    "Autopolis International Racing Course": "Peugeot RCZ Gr.4",
    "Mount Panorama Motor Racing Circuit": "Ford Mustang Gr.4",
    "Dragon Trail - Gardens": "Jaguar F-type Gr.4",
    "Watkins Glen Long Course": "Dodge Viper Gr.4",
    "Circuit Gilles-Villeneuve": "BMW M4 Gr.4",
    "Fuji International Speedway": "Honda NSX Gr.4",
};

const DESCRIPCION = "Ocho circuitos, ocho coches Gr.4 y una sola oportunidad con cada uno. Desde la lluvia de SUGO hasta la gran final en Fuji, cada ronda tiene su propia máquina, su propio clima y su propia estrategia. Neumáticos, combustible y boxes deciden la carrera: solo el piloto más completo se lleva la segunda edición de la GR.4 ENDURANCE CUP.";

const PUNTO_1_ANTES = "Cada ronda se corre con un coche de los 8 disponibles pero no se pueden volver a usar.";
const PUNTO_1_DESPUES = "Cada ronda se corre con el coche que indica su ficha. Usar otro coche supone la descalificación de la carrera.";

function initFirebaseAdmin() {
    if (admin.apps.length) return admin.app();
    const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function main() {
    const apply = process.argv.includes("--apply");
    initFirebaseAdmin();
    const db = admin.firestore();
    const champRef = db.collection("championships").doc(CHAMPIONSHIP_ID);
    const champ = (await champRef.get()).data();
    if (!champ) throw new Error(`No existe el campeonato ${CHAMPIONSHIP_ID}`);

    if (!champ.regulations?.includes(PUNTO_1_ANTES)) throw new Error("El punto 1 del reglamento ya no coincide con el texto esperado");
    const catalogo = new Set((await db.collection("cars").get()).docs.map(d => d.data().name));
    const rondas = (await champRef.collection("tracks").orderBy("round").get()).docs;
    if (rondas.length !== 8) throw new Error(`Se esperaban 8 rondas y hay ${rondas.length}`);

    const cambios = rondas.map(d => {
        const t = d.data();
        const coche = COCHES[t.name];
        if (!coche) throw new Error(`Sin coche asignado para ${t.name}`);
        if (!catalogo.has(coche)) throw new Error(`Coche no encontrado en el catálogo: ${coche}`);
        return { ref: d.ref, ronda: t.round, circuito: t.name, coche, antes: { specificCars: t.specificCars ?? false, allowedCars: t.allowedCars ?? [] } };
    });
    if (new Set(cambios.map(c => c.coche)).size !== 8) throw new Error("Hay coches repetidos");

    console.log(apply ? "Aplicando...\n" : "Dry-run (usa --apply para escribir)\n");
    for (const c of cambios) console.log(`R${c.ronda} ${c.circuito} → ${c.coche}`);
    console.log(`\nDescripción: ${DESCRIPCION}`);
    console.log(`Reglamento, punto 1: ${PUNTO_1_DESPUES}`);
    console.log(`Control de uso de coches: ${champ.carUsageTracking?.enabled} → false`);

    if (!apply) {
        console.log("\nNada escrito — corre con --apply para confirmar.");
        return;
    }

    const backupDir = path.join(__dirname, "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `gr4-cup-2-edt-coches-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupFile, JSON.stringify({
        description: champ.description,
        regulations: champ.regulations,
        carUsageTracking: champ.carUsageTracking,
        rondas: cambios.map(c => ({ id: c.ref.id, ronda: c.ronda, ...c.antes })),
    }, null, 2));
    console.log(`\nCopia de seguridad: ${path.relative(process.cwd(), backupFile)}`);

    const batch = db.batch();
    for (const c of cambios) batch.update(c.ref, { specificCars: true, allowedCars: [c.coche] });
    batch.update(champRef, {
        description: DESCRIPCION,
        regulations: champ.regulations.replace(PUNTO_1_ANTES, PUNTO_1_DESPUES),
        "carUsageTracking.enabled": false,
        updatedAt: new Date().toISOString(),
    });
    await batch.commit();
    console.log("✅ Cambios aplicados.");
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
