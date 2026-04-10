/*
 * Script de restauración de resultados Pre-Qualy
 * Campeonato: CAMPEONATO PRIMAVERA (6vKJPdQR8OVAv1goDMal)
 *
 * Usage: node scripts/restore-prequaly.js
 */

const admin = require("firebase-admin");
const path = require("path");

const CHAMPIONSHIP_ID = "6vKJPdQR8OVAv1goDMal";

// Datos extraídos de la captura de pantalla — 57 clasificados
const PREQUALY_RESULTS = [
    { driverName: "Litri_23", time: "1:43.535", classified: true },
    { driverName: "NNT_A.Covelo", time: "1:43.578", classified: true },
    { driverName: "AF81_ktulu", time: "1:43.703", classified: true },
    { driverName: "Dailoscrf", time: "1:43.703", classified: true },
    { driverName: "Pichis94528", time: "1:43.793", classified: true },
    { driverName: "Maziger1987", time: "1:43.800", classified: true },
    { driverName: "RRT_QUIQUEjrSFC", time: "1:43.873", classified: true },
    { driverName: "RRT_SZUNZU", time: "1:43.881", classified: true },
    { driverName: "RRT_DANI-PAN", time: "1:43.903", classified: true },
    { driverName: "ERIC_MADRID", time: "1:43.997", classified: true },
    { driverName: "FIR_GIIGII_20", time: "1:44.035", classified: true },
    { driverName: "Erikjaky93", time: "1:44.054", classified: true },
    { driverName: "Elric_mel", time: "1:44.054", classified: true },
    { driverName: "DonVilches", time: "1:44.112", classified: true },
    { driverName: "SFD-CATALAN", time: "1:44.125", classified: true },
    { driverName: "Ramirez", time: "1:44.150", classified: true },
    { driverName: "PTR_Ojer", time: "1:44.193", classified: true },
    { driverName: "LEo_Alabau", time: "1:44.197", classified: true },
    { driverName: "Jsierra_1993", time: "1:44.223", classified: true },
    { driverName: "D. Alvarado", time: "1:44.254", classified: true },
    { driverName: "RRT_JONASKS", time: "1:44.271", classified: true },
    { driverName: "o0Chak0o", time: "1:44.283", classified: true },
    { driverName: "luisPAdepor", time: "1:44.320", classified: true },
    { driverName: "A77_tony", time: "1:44.349", classified: true },
    { driverName: "TMC_Adrianqh46", time: "1:44.364", classified: true },
    { driverName: "nicolas_ecg", time: "1:44.420", classified: true },
    { driverName: "Pucela_77", time: "1:44.439", classified: true },
    { driverName: "TARANTO28JR", time: "1:44.447", classified: true },
    { driverName: "Dayo_21", time: "1:44.483", classified: true },
    { driverName: "Davidfus", time: "1:44.626", classified: true },
    { driverName: "xxFERRExxx", time: "1:44.642", classified: true },
    { driverName: "Lillo_FR", time: "1:44.671", classified: true },
    { driverName: "Leopool6648-2", time: "1:44.678", classified: true },
    { driverName: "Vivelesport", time: "1:44.762", classified: true },
    { driverName: "NNT_Daynel79", time: "1:44.778", classified: true },
    { driverName: "Toromotroco81", time: "1:44.795", classified: true },
    { driverName: "Shyra_troya", time: "1:44.810", classified: true },
    { driverName: "RRT_VENGADOR", time: "1:44.878", classified: true },
    { driverName: "Arevalo1990", time: "1:44.884", classified: true },
    { driverName: "Jose_Pz-91", time: "1:44.891", classified: true },
    { driverName: "RRT_Vakinen", time: "1:45.014", classified: true },
    { driverName: "oO_Jorge_RB_Oo", time: "1:45.070", classified: true },
    { driverName: "Lokoracing", time: "1:45.103", classified: true },
    { driverName: "mejjiia", time: "1:45.136", classified: true },
    { driverName: "Jose_racing78", time: "1:45.156", classified: true },
    { driverName: "Suragoth_85", time: "1:45.157", classified: true },
    { driverName: "Albertovic2", time: "1:45.195", classified: true },
    { driverName: "AKRTAstroboy691@", time: "1:45.472", classified: true },
    { driverName: "Pinzapo125", time: "1:45.670", classified: true },
    { driverName: "Jose60txus", time: "1:45.809", classified: true },
    { driverName: "RRT_BLAS", time: "1:45.823", classified: true },
    { driverName: "SALVAEXPO2805", time: "1:45.827", classified: true },
    { driverName: "Carlos_llsp", time: "1:45.919", classified: true },
    { driverName: "Cristian_fh", time: "1:46.480", classified: true },
    { driverName: "Coyantino", time: "1:46.777", classified: true },
    { driverName: "JJrojas23", time: "1:47.299", classified: true },
    { driverName: "Kelmarcano", time: "1:47.847", classified: true },
];

function initFirebaseAdmin() {
    if (admin.apps.length) return admin.app();
    const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.app();
}

async function restore() {
    initFirebaseAdmin();
    const db = admin.firestore();

    const docRef = db.collection("championships").doc(CHAMPIONSHIP_ID);
    const snap = await docRef.get();

    if (!snap.exists) {
        console.error(`❌ No se encontró el campeonato con ID: ${CHAMPIONSHIP_ID}`);
        process.exit(1);
    }

    const data = snap.data();
    console.log(`✅ Campeonato encontrado: "${data.name}"`);

    // Construir mapa driverName → gt7Id desde registrations aprobadas
    const registrations = (data.registrations || []).filter(r => r.status === 'approved');
    const gt7Map = {};
    registrations.forEach(r => {
        const key = r.name || r.psnId || r.gt7Id;
        if (key) gt7Map[key] = r.gt7Id || '';
    });

    // Enriquecer resultados con gt7Id
    const results = PREQUALY_RESULTS.map(r => ({
        ...r,
        gt7Id: gt7Map[r.driverName] || '',
    }));

    console.log(`📋 Restaurando ${results.length} resultados de Pre-Qualy (con gt7Id)...`);
    await docRef.update({ "preQualy.results": results });
    console.log(`✅ Pre-Qualy restaurada correctamente (${results.length} pilotos).`);
    process.exit(0);
}

restore().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
