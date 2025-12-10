/*
 * Audit script for championships data consistency.
 * - Lists championships missing createdAt or status.
 * - Shows counts of teams/tracks/events per championship.
 * - Read-only: does NOT modify any data.
 *
 * Usage:
 *   node scripts/audit-championships.js
 *   (requires serviceAccountKey.json at project root)
 */

const admin = require("firebase-admin");
const path = require("path");

function initFirebaseAdmin() {
    if (admin.apps.length) return admin.app();

    const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    return admin.app();
}

async function audit() {
    initFirebaseAdmin();
    const db = admin.firestore();

    const snapshot = await db.collection("championships").get();
    if (snapshot.empty) {
        console.log("No championships found.");
        return;
    }

    const results = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const id = doc.id;

        const [teamsSnap, tracksSnap, eventsSnap] = await Promise.all([
            db.collection("championships").doc(id).collection("teams").get(),
            db.collection("championships").doc(id).collection("tracks").get(),
            db.collection("championships").doc(id).collection("events").get(),
        ]);

        results.push({
            id,
            name: data.name || "(sin nombre)",
            status: data.status || "(sin status)",
            createdAt: data.createdAt || null,
            teams: teamsSnap.size,
            tracks: tracksSnap.size,
            events: eventsSnap.size,
        });
    }

    const missingCreatedAt = results.filter(r => !r.createdAt);
    const missingStatus = results.filter(r => !r.status || r.status === "(sin status)");

    console.log("\n=== Championships Audit ===");
    results.forEach(r => {
        console.log(
            `- ${r.name} [${r.id}] | status: ${r.status} | createdAt: ${r.createdAt || "MISSING"} | teams: ${r.teams} | tracks: ${r.tracks} | events: ${r.events}`
        );
    });

    if (missingCreatedAt.length || missingStatus.length) {
        console.log("\nWarnings:");
        if (missingCreatedAt.length) {
            console.log(`• Missing createdAt: ${missingCreatedAt.map(r => r.name).join(", ")}`);
        }
        if (missingStatus.length) {
            console.log(`• Missing status: ${missingStatus.map(r => r.name).join(", ")}`);
        }
    } else {
        console.log("\nNo missing createdAt/status fields detected.");
    }

    console.log("\nDone.");
}

audit().catch(err => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
});
