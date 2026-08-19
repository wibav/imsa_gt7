/*
 * Sincroniza la colección `tracks` (catálogo global de circuitos/layouts)
 * contra la lista oficial de GT7 (gran-turismo.com/us/gt7/tracklist/,
 * consultada en agosto 2026 — 41 ubicaciones, 121 trazados).
 *
 * Hace dos cosas:
 * 1. Renombra los docs existentes cuyo `name` no coincide exactamente con
 *    el nombre oficial (quedaron con nombres aproximados de una limpieza
 *    anterior basada en la constante GT7_TRACKS, que a su vez era una
 *    simplificación manual, no el nombre oficial real).
 * 2. Agrega como nuevos docs los 100 trazados oficiales que todavía no
 *    existen en Firestore (sin layoutImage — eso queda pendiente, aparte,
 *    por el tema de derechos de autor de las capturas del juego).
 *
 * IDs: continúa la numeración simple existente (docs actuales: 1-21).
 *
 * Usage:
 *   node scripts/sync-official-tracks-catalog.js            (dry-run)
 *   node scripts/sync-official-tracks-catalog.js --apply     (aplica)
 */

const admin = require("firebase-admin");
const path = require("path");

function initFirebaseAdmin() {
    if (admin.apps.length) return admin.app();
    const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.app();
}

// id del doc existente → nombre oficial correcto
const RENAME_MAP = {
    1: "Watkins Glen Long Course",
    2: "Autodromo Nazionale Monza",
    3: "24 Heures du Mans race track",
    4: "Brands Hatch Grand Prix Circuit",
    6: "Daytona Tri-Oval",
    7: "Nürburgring GP",
    9: "WeatherTech Raceway Laguna Seca",
    14: "Mount Panorama Motor Racing Circuit",
    15: "Circuit de Barcelona-Catalunya GP Layout",
    16: "Daytona Road Course",
    17: "Circuit Gilles-Villeneuve",
};

// Lista oficial completa (121), tal cual gran-turismo.com/us/gt7/tracklist/
const OFFICIAL_TRACKS = [
    ["24 Heures du Mans race track", "France"],
    ["24 Heures du Mans race track, no chicane", "France"],
    ["Alsace - Test Course", "France"],
    ["Alsace - Test Course Reverse", "France"],
    ["Alsace - Village", "France"],
    ["Alsace - Village Reverse", "France"],
    ["Autodrome Lago Maggiore - Center", "Italy"],
    ["Autodrome Lago Maggiore - Center Reverse", "Italy"],
    ["Autodrome Lago Maggiore - East", "Italy"],
    ["Autodrome Lago Maggiore - East End", "Italy"],
    ["Autodrome Lago Maggiore - East End Reverse", "Italy"],
    ["Autodrome Lago Maggiore - East Reverse", "Italy"],
    ["Autodrome Lago Maggiore - Full Course", "Italy"],
    ["Autodrome Lago Maggiore - Full Course Reverse", "Italy"],
    ["Autodrome Lago Maggiore - West", "Italy"],
    ["Autodrome Lago Maggiore - West End", "Italy"],
    ["Autodrome Lago Maggiore - West End Reverse", "Italy"],
    ["Autodrome Lago Maggiore - West Reverse", "Italy"],
    ["Autodromo Nazionale Monza", "Italy"],
    ["Autodromo Nazionale Monza No Chicane", "Italy"],
    ["Autódromo de Interlagos", "Brazil"],
    ["Autopolis International Racing Course", "Japan"],
    ["Autopolis International Racing Course - Short Course", "Japan"],
    ["Blue Moon Bay Speedway", "U.S."],
    ["Blue Moon Bay Speedway - Infield A", "U.S."],
    ["Blue Moon Bay Speedway - Infield A Reverse", "U.S."],
    ["Blue Moon Bay Speedway - Infield B", "U.S."],
    ["Blue Moon Bay Speedway - Infield B Reverse", "U.S."],
    ["Blue Moon Bay Speedway Reverse", "U.S."],
    ["Brands Hatch Grand Prix Circuit", "United Kingdom"],
    ["Brands Hatch Indy Circuit", "United Kingdom"],
    ["BB Raceway", "Japan"],
    ["BB Raceway Reverse", "Japan"],
    ["Circuit Gilles-Villeneuve", "Canada"],
    ["Circuit de Barcelona-Catalunya GP Layout", "Spain"],
    ["Circuit de Barcelona-Catalunya GP Layout No Chicane", "Spain"],
    ["Circuit de Barcelona-Catalunya National Layout", "Spain"],
    ["Circuit de Barcelona-Catalunya Rallycross Layout", "Spain"],
    ["Circuit de Sainte-Croix - A", "France"],
    ["Circuit de Sainte-Croix - A Reverse", "France"],
    ["Circuit de Sainte-Croix - B", "France"],
    ["Circuit de Sainte-Croix - B Reverse", "France"],
    ["Circuit de Sainte-Croix - C", "France"],
    ["Circuit de Sainte-Croix - C Reverse", "France"],
    ["Circuit de Spa-Francorchamps", "Belgium"],
    ["Spa 24h layout", "Belgium"],
    ["Colorado Springs - Lake", "U.S."],
    ["Colorado Springs - Lake Reverse", "U.S."],
    ["Daytona Road Course", "U.S."],
    ["Daytona Tri-Oval", "U.S."],
    ["Deep Forest Raceway", "Switzerland"],
    ["Deep Forest Raceway Reverse", "Switzerland"],
    ["Dragon Trail - Gardens", "Croatia"],
    ["Dragon Trail - Gardens Reverse", "Croatia"],
    ["Dragon Trail - Seaside", "Croatia"],
    ["Dragon Trail - Seaside Reverse", "Croatia"],
    ["Eiger Nordwand", "Switzerland"],
    ["Eiger Nordwand Reverse", "Switzerland"],
    ["Fishermans Ranch", "U.S."],
    ["Fishermans Ranch Reverse", "U.S."],
    ["Fuji International Speedway", "Japan"],
    ["Fuji International Speedway (Short)", "Japan"],
    ["Goodwood Motor Circuit", "United Kingdom"],
    ["Grand Valley - Highway 1", "U.S."],
    ["Grand Valley - Highway 1 Reverse", "U.S."],
    ["Grand Valley - South", "U.S."],
    ["Grand Valley - South Reverse", "U.S."],
    ["High Speed Ring", "Japan"],
    ["High Speed Ring Reverse", "Japan"],
    ["Kyoto Driving Park - Miyabi", "Japan"],
    ["Kyoto Driving Park - Yamagiwa", "Japan"],
    ["Kyoto Driving Park - Yamagiwa Reverse", "Japan"],
    ["Kyoto Driving Park - Yamagiwa+Miyabi", "Japan"],
    ["Kyoto Driving Park - Yamagiwa+Miyabi Reverse", "Japan"],
    ["Lake Louise Long Track", "Canada"],
    ["Lake Louise Long Track Reverse", "Canada"],
    ["Lake Louise Short Track", "Canada"],
    ["Lake Louise Short Track Reverse", "Canada"],
    ["Lake Louise Tri-Oval", "Canada"],
    ["Lake Louise Tri-Oval Reverse", "Canada"],
    ["Michelin Raceway Road Atlanta", "U.S."],
    ["Mount Panorama Motor Racing Circuit", "Australia"],
    ["Northern Isle Speedway", "U.S."],
    ["Nürburgring 24h", "Germany"],
    ["Nürburgring Endurance", "Germany"],
    ["Nürburgring Endurance II", "Germany"],
    ["Nürburgring GP", "Germany"],
    ["Nürburgring Nordschleife", "Germany"],
    ["Nürburgring Nordschleife Tourist", "Germany"],
    ["Nürburgring Sprint", "Germany"],
    ["Red Bull Ring", "Austria"],
    ["Red Bull Ring Short Track", "Austria"],
    ["Sardegna - Road Track - A", "Italy"],
    ["Sardegna - Road Track - A Reverse", "Italy"],
    ["Sardegna - Road Track - B", "Italy"],
    ["Sardegna - Road Track - B Reverse", "Italy"],
    ["Sardegna - Road Track - C", "Italy"],
    ["Sardegna - Road Track - C Reverse", "Italy"],
    ["Sardegna - Windmills", "Italy"],
    ["Sardegna - Windmills Reverse", "Italy"],
    ["Special Stage Route X", "U.S."],
    ["Suzuka Circuit", "Japan"],
    ["Suzuka Circuit East Course", "Japan"],
    ["Tokyo Expressway - Central Clockwise", "Japan"],
    ["Tokyo Expressway - Central Counterclockwise", "Japan"],
    ["Tokyo Expressway - East Clockwise", "Japan"],
    ["Tokyo Expressway - East Counterclockwise", "Japan"],
    ["Tokyo Expressway - South Clockwise", "Japan"],
    ["Tokyo Expressway - South Counterclockwise", "Japan"],
    ["Trial Mountain Circuit", "U.S."],
    ["Trial Mountain Circuit Reverse", "U.S."],
    ["Tsukuba Circuit", "Japan"],
    ["Watkins Glen Long Course", "U.S."],
    ["Watkins Glen Short Course", "U.S."],
    ["WeatherTech Raceway Laguna Seca", "U.S."],
    ["Willow Springs International Raceway: Big Willow", "U.S."],
    ["Willow Springs International Raceway: Horse Thief Mile", "U.S."],
    ["Willow Springs International Raceway: Horse Thief Mile Reverse", "U.S."],
    ["Willow Springs International Raceway: Streets of Willow Springs", "U.S."],
    ["Willow Springs International Raceway: Streets of Willow Springs Reverse", "U.S."],
    ["Yas Marina Circuit", "UAE"],
];

async function run() {
    initFirebaseAdmin();
    const db = admin.firestore();
    const apply = process.argv.includes("--apply");

    console.log(`Lista oficial: ${OFFICIAL_TRACKS.length} trazados (esperado 121)\n`);
    console.log(apply ? "Aplicando cambios...\n" : "Dry-run (usa --apply para escribir)\n");

    // 1) Renombrar los docs existentes que aún no coinciden con el oficial
    const finalNames = new Set();
    const snap = await db.collection("tracks").get();
    const existingIds = new Set();
    snap.forEach(d => existingIds.add(Number(d.id)));

    for (const [id, newName] of Object.entries(RENAME_MAP)) {
        const ref = db.collection("tracks").doc(String(id));
        const docSnap = await ref.get();
        if (!docSnap.exists) { console.log(`⚠️  id=${id} no existe, se omite`); continue; }
        const oldName = docSnap.data().name;
        if (oldName !== newName) {
            console.log(`${apply ? "✏️ " : "  "} rename [${id}] "${oldName}" → "${newName}"`);
            if (apply) await ref.update({ name: newName });
        }
        finalNames.add(newName);
    }

    // Nombres de docs que no se tocan (ya estaban correctos)
    snap.forEach(d => {
        if (!RENAME_MAP[Number(d.id)]) finalNames.add(d.data().name);
    });

    // 2) Insertar los oficiales que todavía no están cubiertos
    let nextId = Math.max(...existingIds, 0) + 1;
    let inserted = 0;
    for (const [name, country] of OFFICIAL_TRACKS) {
        if (finalNames.has(name)) continue;
        const id = nextId++;
        console.log(`${apply ? "➕" : "  "} insert [${id}] "${name}" (${country})`);
        if (apply) {
            await db.collection("tracks").doc(String(id)).set({
                id,
                name,
                country,
                layoutImage: "",
            });
        }
        inserted++;
    }

    console.log(`\n${apply ? "✅ Listo." : "Nada escrito."} Renombrados: ${Object.keys(RENAME_MAP).length}, insertados: ${inserted}.`);
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
