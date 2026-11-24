/*
 * Crea las ocho rondas de la «GR.4 ENDURANCE CUP 2 EDT» (enero a marzo de
 * 2027), sin repetir ningún circuito de la edición 2026 (Sainte-Croix, Road
 * Atlanta, Lago Maggiore, Suzuka, Red Bull Ring, Spa, Interlagos y Monza).
 *
 * Los coches los controla el campeonato (8 coches Gr.4, un uso por coche), así
 * que las rondas no fijan coche. La recarga va de 3 a 6 L/s, a la inversa del
 * consumo. En las rondas con lluvia la pista queda seca al menos los últimos
 * 20 minutos, para que dé tiempo a las 3 vueltas mínimas de cada compuesto
 * obligatorio que exige el reglamento particular.
 *
 * Uso:
 *   node scripts/create-gr4-cup-2-edt-rounds.mjs           (dry-run, solo muestra)
 *   node scripts/create-gr4-cup-2-edt-rounds.mjs --apply   (crea las rondas)
 *   (requiere serviceAccountKey.json en la raíz del proyecto)
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { REGLAS_POR_DEFECTO } from "../src/app/utils/roomConfig.js";
import { Track } from "../src/app/models/Championship.js";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHAMPIONSHIP_ID = "yw20gj4Z6IC7FGhusCLJ";

const slots = (codigos) => codigos.split("/").map(weather => ({ weather, transition: "gradual" }));

const BASE = {
    ...REGLAS_POR_DEFECTO,
    mechanicalDamage: "heavy",
    startingFuel: 100,
    qualyDuration: 10,
    qualySlipstream: "off",
    usableCompounds: [],
    mandatoryCompoundChanges: true,
    weather: "variable",
};

const ronda = (nombre, fecha, [tireWear, fuelConsumption, fuelRefillRate], requiredCompounds, timeOfDay, timeMultiplier, clima) =>
    ({ nombre, fecha, reglas: { tireWear, fuelConsumption, fuelRefillRate, requiredCompounds, timeOfDay, timeMultiplier, weatherSlots: slots(clima) } });

// `nombre` tal como está en el catálogo `tracks`.
const RONDAS = [
    // Apertura con lluvia del minuto 11 al 28, aproximadamente, y final seco.
    ronda("SUGO International Racing Course", "2027-01-15", [5, 5, 4], ["medium", "soft"], "Crepúsculo", 7, "C01/C04/R02/R05/R03/C05/C04/S18/S15"),
    ronda("WeatherTech Raceway Laguna Seca", "2027-01-22", [6, 4, 5], ["hard", "medium"], "Puesta del Sol", 7, "C06/C06/C06/C04/C02/S18/S14/S10/S06"),
    // Lluvia en el primer tercio.
    ronda("Autopolis International Racing Course", "2027-01-29", [5, 5, 4], ["medium", "soft"], "Primera h. mañana", 6, "C06/R02/R05/R03/C05/C03/S17/S15/S18"),
    ronda("Mount Panorama Motor Racing Circuit", "2027-02-05", [3, 6, 3], ["hard", "soft"], "Tarde", 5, "S10/S12/S14/S15/S17/S18/C01/C03/C02"),
    // Llovizna a mitad de carrera.
    ronda("Dragon Trail - Gardens", "2027-02-12", [5, 4, 5], ["medium"], "Crepúsculo", 6, "S08/S10/C02/C05/R01/R03/C04/S18/S15"),
    ronda("Watkins Glen Long Course", "2027-02-19", [4, 6, 3], ["hard", "medium"], "Atardecer", 5, "S06/S09/S12/S15/S18/C01/C03/C04/C02"),
    ronda("Circuit Gilles-Villeneuve", "2027-02-26", [3, 6, 3], ["hard", "soft"], "Primera h. mañana", 7, "S15/S13/S16/S14/S10/S06/S02/S01/S04"),
    // Final: lluvia fuerte del minuto 11 al 22, aproximadamente, y final seco.
    ronda("Fuji International Speedway", "2027-03-05", [4, 5, 4], ["medium"], "Última h. mañana", 8, "S18/C05/R07/R03/C04/S15/C05/C04/S18"),
];

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
    const champ = await champRef.get();
    if (!champ.exists) throw new Error(`No existe el campeonato ${CHAMPIONSHIP_ID}`);

    const existentes = await champRef.collection("tracks").get();
    if (!existentes.empty) throw new Error(`El campeonato ya tiene ${existentes.size} rondas: no se crea nada`);

    const circuitos = (await db.collection("tracks").get()).docs.map(d => d.data());
    const tracks = RONDAS.map((r, i) => {
        const entrada = circuitos.find(t => t.name === r.nombre);
        if (!entrada) throw new Error(`Circuito no encontrado en el catálogo: ${r.nombre}`);
        const track = new Track({
            championshipId: CHAMPIONSHIP_ID,
            name: r.nombre,
            country: entrada.country || "",
            layoutImage: entrada.layoutImage || "",
            date: r.fecha,
            time: champ.data().settings?.defaultRaceTime || "23:00",
            round: i + 1,
            category: champ.data().categories?.[0] || "",
            raceType: "resistencia",
            duration: 50,
            status: "upcoming",
            rules: { ...BASE, ...r.reglas },
        });
        const { isValid, errors } = track.validate();
        if (!isValid) throw new Error(`${r.nombre}: ${errors.join(", ")}`);
        return track;
    });

    console.log(apply ? "Creando rondas...\n" : "Dry-run (usa --apply para escribir)\n");
    for (const t of tracks) {
        const r = t.rules;
        console.log(`R${t.round} ${t.date} ${t.time} · ${t.name} · ${t.category} · ${t.duration} min`);
        console.log(`  desgaste ${r.tireWear}x · consumo ${r.fuelConsumption}x · recarga ${r.fuelRefillRate} L/s · requeridos ${r.requiredCompounds.join("+")}`);
        console.log(`  ${r.timeOfDay} x${r.timeMultiplier} · ${r.weatherSlots.map(s => s.weather).join("/")}`);
    }

    if (!apply) {
        console.log("\nNada escrito — corre con --apply para confirmar.");
        return;
    }

    const batch = db.batch();
    for (const t of tracks) batch.set(champRef.collection("tracks").doc(), t.toFirestore());
    await batch.commit();
    console.log(`\n✅ ${tracks.length} rondas creadas.`);
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
