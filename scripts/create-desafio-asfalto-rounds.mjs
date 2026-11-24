/*
 * Crea las cuatro rondas de «Desafío del Asfalto»: un coche específico por
 * circuito, neumáticos deportivos y configuración de sala completa.
 *
 *   Radical SR3 SL '13             → Montmeló (Barcelona-Catalunya GP)
 *   Caterham Seven Superlight R500 → Alsace - Village
 *   BAC Mono '16                   → SUGO
 *   KTM X-BOW R '12                → Brands Hatch Grand Prix
 *
 * Base de la sala: REGLAS_POR_DEFECTO de la app, con neumáticos deportivos
 * (Deportivo Duro / Medio / Blando) y el formato de los otros campeonatos de
 * la organización: viernes a las 23:00 y 50 minutos de carrera.
 *
 * Desgaste y consumo tomados de los eventos únicos de la organización con
 * neumático deportivo, sobre todo los de 50 minutos:
 *   JAPAN FEST (Tokyo, Deportivo Medio)        desgaste 8 · consumo 4
 *   AUTOPOLIS RAIN MASTERS (lluvia, deportivo) desgaste 7 · consumo 5 · 3 L/s
 * Por eso el desgaste va de x7 a x8 y el consumo de x3 a x6. La recarga va de
 * 3 a 6 L/s, a la inversa del consumo: donde más se gasta, más tarda en llenarse.
 *
 * Climas tomados de los reglamentos de la World Series League RR (carpeta
 * «Base»). Solo SUGO admite lluvia en GT7.
 *
 * Uso:
 *   node scripts/create-desafio-asfalto-rounds.mjs           (dry-run, solo muestra)
 *   node scripts/create-desafio-asfalto-rounds.mjs --apply   (crea las rondas)
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

const CHAMPIONSHIP_ID = "maZZgjYqijfF3zXtVsh5";

const slots = (codigos) => codigos.split("/").map(weather => ({ weather, transition: "gradual" }));

const BASE = {
    ...REGLAS_POR_DEFECTO,
    mechanicalDamage: "heavy",
    startingFuel: 100,
    qualyDuration: 10,
    qualySlipstream: "off",
    usableTyres: "sport",
    usableCompounds: [],
    mandatoryCompoundChanges: true,
    weather: "variable",
};

// `nombre` y `coche` tal como están en los catálogos (`tracks` y `cars`).
const RONDAS = [
    {
        // El circuito que más neumático gasta, con el coche de más carga
        // aerodinámica. Duros y medios obligatorios.
        // Clima: 10.ª edición, Barcelona, tal cual (Tarde x6, cielo cubierto).
        nombre: "Circuit de Barcelona-Catalunya GP Layout", coche: "Radical SR3 SL '13", fecha: "2026-11-27",
        reglas: {
            tireWear: 8, fuelConsumption: 4, fuelRefillRate: 5,
            requiredCompounds: ["hard", "medium"],
            timeOfDay: "Tarde", timeMultiplier: 6,
            weatherSlots: slots("C06/C04/C05/C03/C01/S15/S17/C02/C04"),
        },
    },
    {
        // Pueblo estrecho y curvas lentas con el coche más ligero: el
        // neumático decide y la recarga es la más rápida. Medios y blandos.
        // Clima: 9.ª edición, Alsace Pueblo, tal cual (Crepúsculo x3).
        nombre: "Alsace - Village", coche: "Caterham Seven Superlight R500 '08", fecha: "2026-12-04",
        reglas: {
            tireWear: 8, fuelConsumption: 3, fuelRefillRate: 6,
            requiredCompounds: ["medium", "soft"],
            timeOfDay: "Crepúsculo", timeMultiplier: 3,
            weatherSlots: slots("S10/S12/S09/S06/S04/S05/S07/S06/S08"),
        },
    },
    {
        // El coche más rápido en el circuito con lluvia: sale mojado y se
        // seca. Medio obligatorio.
        // Desgaste, consumo y recarga de AUTOPOLIS RAIN MASTERS (7/5/3), el
        // evento con lluvia y neumático deportivo.
        // Clima: 12.ª edición, Red Bull Ring (Última h. mañana x9). Mismos
        // tipos de preset, con menos lluvia y el final seco para que el medio
        // se pueda montar antes de la bandera.
        nombre: "SUGO International Racing Course", coche: "BAC Mono '16", fecha: "2026-12-11",
        reglas: {
            tireWear: 7, fuelConsumption: 5, fuelRefillRate: 3,
            requiredCompounds: ["medium"],
            timeOfDay: "Última h. mañana", timeMultiplier: 9,
            weatherSlots: slots("R06/R08/R06/C02/C03/C02/S15/S17/S15"),
        },
    },
    {
        // Final: sube y baja sin parar, el consumo más alto y la recarga más
        // lenta, para que ahorrar combustible compense. Duros y blandos.
        // Clima: 12.ª edición, Goodwood (también en Inglaterra), tal cual
        // (Puesta del sol x4); los reglamentos no tienen Brands Hatch.
        nombre: "Brands Hatch Grand Prix Circuit", coche: "KTM X-BOW R '12", fecha: "2026-12-18",
        reglas: {
            tireWear: 7, fuelConsumption: 6, fuelRefillRate: 3,
            requiredCompounds: ["hard", "soft"],
            timeOfDay: "Puesta del Sol", timeMultiplier: 4,
            weatherSlots: slots("C06/C03/C03/S18/C01/C03/S18/S15/S10"),
        },
    },
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
    const coches = new Set((await db.collection("cars").get()).docs.map(d => d.data().name));
    const tracks = RONDAS.map((r, i) => {
        const entrada = circuitos.find(t => t.name === r.nombre);
        if (!entrada) throw new Error(`Circuito no encontrado en el catálogo: ${r.nombre}`);
        if (!coches.has(r.coche)) throw new Error(`Coche no encontrado en el catálogo: ${r.coche}`);
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
            specificCars: true,
            allowedCars: [r.coche],
            rules: { ...BASE, ...r.reglas },
        });
        const { isValid, errors } = track.validate();
        if (!isValid) throw new Error(`${r.nombre}: ${errors.join(", ")}`);
        return track;
    });

    console.log(apply ? "Creando rondas...\n" : "Dry-run (usa --apply para escribir)\n");
    for (const t of tracks) {
        const r = t.rules;
        console.log(`R${t.round} ${t.date} ${t.time} · ${t.name} · ${t.allowedCars[0]} · ${t.category} · ${t.duration} min`);
        console.log(`  neumáticos ${r.usableTyres} · desgaste ${r.tireWear}x · consumo ${r.fuelConsumption}x · recarga ${r.fuelRefillRate} L/s · requeridos ${r.requiredCompounds.join("+")}`);
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
