/*
 * Publica el reglamento general v2 en una organización y alinea el apartado
 * de paralelos del reglamento de la GR.4 Endurance Cup con el general.
 *
 * Antes de escribir guarda copia de lo actual en scripts/backups/.
 *
 * Usage:
 *   node scripts/reglamento/publicar-reglamento.js            (simulación)
 *   node scripts/reglamento/publicar-reglamento.js --apply    (publica)
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const APLICAR = process.argv.includes("--apply");
const ORG_ID = "gt7-esp";
const GR4_ID = "Z6OWfPAOc5gVML4Fg4Gx";

const raiz = path.join(__dirname, "..", "..");
admin.initializeApp({ credential: admin.credential.cert(require(path.join(raiz, "serviceAccountKey.json"))) });
const db = admin.firestore();

// Mismo criterio que el reglamento general (5.3), con referencia al artículo
const GR4_PARALELO_ANTES = '<p>El paralelo comienza cuando el piloto introduce el morro de su vehículo junto al rival.</p>';
const GR4_PARALELO_DESPUES = '<p>Hay paralelo cuando, antes del punto de giro, el eje delantero del atacante está como mínimo a la altura del retrovisor del rival, y se mantiene así hasta el vértice (reglamento general, artículo 5.3).</p>';

(async () => {
    const v2 = JSON.parse(fs.readFileSync(path.join(raiz, "src/app/data/reglamento-general.json"), "utf8"));
    const orgRef = db.collection("organizations").doc(ORG_ID);
    const gr4Ref = db.collection("championships").doc(GR4_ID);
    const [org, gr4] = await Promise.all([orgRef.get(), gr4Ref.get()]);

    const actual = org.data()?.reglamento || {};
    const htmlGr4 = gr4.data()?.regulations || "";
    const gr4Cambia = htmlGr4.includes(GR4_PARALELO_ANTES);

    console.log(`Organización ${ORG_ID}: ${(actual.sections || []).length} secciones → ${v2.sections.length} (v${v2.version}, ${v2.fecha})`);
    console.log(`GR.4: apartado de paralelo ${gr4Cambia ? "se actualiza" : "no encontrado (sin cambios)"}`);
    if (!APLICAR) return console.log("\nSimulación. Usa --apply para publicar.");

    const dirBackup = path.join(raiz, "scripts", "backups");
    fs.mkdirSync(dirBackup, { recursive: true });
    const sello = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dirBackup, `reglamento-${ORG_ID}-antes-v2-${sello}.json`), JSON.stringify(actual, null, 1));
    fs.writeFileSync(path.join(dirBackup, `regulations-gr4-antes-v2-${sello}.html`), htmlGr4);

    await orgRef.update({
        reglamento: {
            version: v2.version,
            fecha: v2.fecha,
            sections: v2.sections,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
    });
    if (gr4Cambia) await gr4Ref.update({ regulations: htmlGr4.replace(GR4_PARALELO_ANTES, GR4_PARALELO_DESPUES) });
    console.log("✓ Publicado. Copias en scripts/backups/.");
})().catch((e) => { console.error(e); process.exit(1); });
