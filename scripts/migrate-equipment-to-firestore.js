/**
 * Migración única: mueve el catálogo de /equipamiento (antes un array
 * hardcodeado en el bundle) a la colección Firestore `equipment`, para que
 * sea editable desde /equipamientoAdmin (solo por el Administrador de
 * Plataforma — ver firestore.rules).
 *
 * Idempotente: si la colección ya tiene documentos, no hace nada (evita
 * duplicar si se corre más de una vez).
 *
 * Uso: node scripts/migrate-equipment-to-firestore.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const PRODUCTS = [
    {
        title: "Thrustmaster T300 RS GT Edition",
        description: "Force Feedback 1080°, motor brushless y 3 pedales ajustables. Licencia oficial Gran Turismo para PS5, PS4 y PC.",
        url: "https://amzn.to/47kmjsH",
        emoji: "🏎️",
        tag: "Volante",
        tagColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    },
    {
        title: "Fanatec CSL Elite — Licencia GT",
        description: "Base y pedales con licencia oficial Gran Turismo. FluxBarrier Direct Drive de Polyphony Digital. Compatible con PS5, PS4 y PC.",
        url: "https://amzn.to/40N0MoK",
        emoji: "⚡",
        tag: "Volante Premium",
        tagColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    },
    {
        title: "Thrustmaster T248",
        description: "Force Feedback 3,5 N·m, pantalla interactiva, 25 botones y 3 pedales magnéticos T3PM incluidos. PS5, PS4 y PC.",
        url: "https://amzn.to/4sz3sCC",
        emoji: "🕹️",
        tag: "Iniciación",
        tagColor: "bg-green-500/20 text-green-300 border-green-500/30",
    },
    {
        title: "Fuente Fanatec Boost Kit 180 (8Nm)",
        description: "Adaptador AC/DC compatible con Fanatec Boost Kit 180 y CSL DD / GT DD Pro. Necesario para liberar la potencia máxima de 8Nm.",
        url: "https://amzn.to/40fhME4",
        emoji: "🔌",
        tag: "Accesorio Fanatec",
        tagColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    {
        title: "HORI Volante Apex (con cable)",
        description: "Volante licencia oficial PlayStation con Force Feedback. Conexión USB, compatible con PS5, PS4 y PC.",
        url: "https://amzn.to/4sorW16",
        emoji: "🎮",
        tag: "Volante",
        tagColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
    {
        title: "HORI Wireless Racing Wheel Apex",
        description: "Volante inalámbrico para PlayStation 5, PlayStation 4 y Windows 11/10. Sin cables, máxima libertad de movimiento.",
        url: "https://amzn.to/4rUZK6l",
        emoji: "📡",
        tag: "Inalámbrico",
        tagColor: "bg-red-500/20 text-red-300 border-red-500/30",
    },
    {
        title: "Logitech G G29 Driving Force",
        description: "Volante y pedales con Force Feedback, aluminio anodizado y palancas de cambio. Compatible con PS4, PS3 y PC vía USB.",
        url: "https://amzn.to/4srrzCV",
        emoji: "🏁",
        tag: "Volante + Pedales",
        tagColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
];

async function main() {
    const existing = await db.collection('equipment').limit(1).get();
    if (!existing.empty) {
        console.log('⏭️  La colección equipment ya tiene documentos, se omite la migración.');
        process.exit(0);
    }

    const batch = db.batch();
    PRODUCTS.forEach((product, idx) => {
        const ref = db.collection('equipment').doc();
        batch.set(ref, {
            ...product,
            order: idx,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
    console.log(`✅ ${PRODUCTS.length} productos migrados a la colección equipment.`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
