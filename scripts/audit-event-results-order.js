/*
 * SOLO LECTURA — SIN MODO DE REPARACIÓN. Este script NO tiene ni tendrá
 * flag --fix. El orden real con el que un admin cargó los resultados de un
 * evento NO es reconstruible desde los datos si ese admin ya "corrigió a
 * mano" un orden que veía mal en la UI (mientras el bug de lectura estaba
 * activo) y volvió a guardar — cualquier reparación automática sería una
 * adivinanza destructiva sobre datos de producción. El entregable de este
 * script es un INFORME para que un humano decida qué eventos recargar/
 * verificar a mano.
 *
 * Qué detecta, por evento (subcolecciones participants/waitlist/results/
 * rounds de events/{id}):
 *   - Eventos con 11+ documentos en una subcolección (umbral exacto en el
 *     que el bug de `a.id.localeCompare(b.id)` empieza a desordenar).
 *   - Desacuerdo entre el `position` guardado y el sufijo numérico del ID
 *     del documento (p.ej. doc `r2` con `position: 9`) — señal de que la
 *     lectura desordenada ya se guardó de vuelta sobre sí misma.
 *   - Mezcla de IDs administrativos (`p0`, `p1`...) con IDs públicos
 *     (`p{timestamp}_{rand}`) en la misma subcolección de participantes.
 *   - `updatedAt` del evento posterior a 2026-07-30 (fecha del commit
 *     6d98868 que introdujo Sala Única) — ventana en la que el bug estuvo
 *     más expuesto en el flujo normal de guardado desde la UI.
 *
 * Para cada evento marcado, imprime el top-5 de resultados en el orden
 * ACTUAL en que se recuperarían (para que el usuario compare contra lo que
 * recuerda que debería mostrar el podio).
 *
 * Uso:
 *   node scripts/audit-event-results-order.js
 *   (requiere serviceAccountKey.json en la raíz del proyecto)
 */

const admin = require("firebase-admin");
const path = require("path");

const BUGGY_SINCE = new Date("2026-07-30T00:00:00.000Z");

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

function numericSuffix(id, prefix) {
  if (typeof id !== "string" || !id.startsWith(prefix)) return null;
  const suffix = id.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) return null;
  return parseInt(suffix, 10);
}

// Recupera los docs en el mismo orden que producía el bug (localeCompare de
// string) — así el informe muestra exactamente lo que un admin/la web
// pública verían/vieron hoy, antes de aplicar el fix.
function buggyOrder(docs) {
  return [...docs].sort((a, b) => a.id.localeCompare(b.id));
}

async function auditSubcollection(eventRef, subcolName, prefix, orderField) {
  const snap = await eventRef.collection(subcolName).get();
  const docs = snap.docs;
  const count = docs.length;

  const findings = [];

  if (count >= 11) {
    findings.push(`≥11 documentos (${count}) — el bug de localeCompare desordena a partir de aquí`);
  }

  // Desacuerdo position vs sufijo numérico del ID
  if (orderField) {
    const mismatches = docs.filter(d => {
      const n = numericSuffix(d.id, prefix);
      if (n === null) return false;
      const data = d.data();
      const fieldVal = data[orderField];
      if (typeof fieldVal !== "number") return false;
      // position es 1-based, sufijo de ID es 0-based
      const expected = orderField === "position" || orderField === "roundNumber" ? n + 1 : n;
      return fieldVal !== expected;
    });
    if (mismatches.length > 0) {
      findings.push(`${mismatches.length} doc(s) con "${orderField}" desalineado del sufijo de su ID (ej: ${mismatches.slice(0, 3).map(d => `${d.id}→${orderField}=${d.data()[orderField]}`).join(", ")})`);
    }
  }

  // Mezcla de IDs administrativos vs públicos (solo aplica a participants/waitlist)
  const withNumericSuffix = docs.filter(d => numericSuffix(d.id, prefix) !== null).length;
  const withoutNumericSuffix = count - withNumericSuffix;
  if (withNumericSuffix > 0 && withoutNumericSuffix > 0) {
    findings.push(`Mezcla de ${withNumericSuffix} doc(s) administrativos ("${prefix}N") y ${withoutNumericSuffix} doc(s) públicos (ids con timestamp)`);
  }

  const buggyTop5 = buggyOrder(docs).slice(0, 5).map(d => {
    const data = d.data();
    const label = data.driverName || data.gt7Id || data.psnId || "(sin nombre)";
    return `${d.id}:${label}`;
  });

  return { count, findings, buggyTop5 };
}

async function audit() {
  initFirebaseAdmin();
  const db = admin.firestore();

  const snapshot = await db.collection("events").get();
  if (snapshot.empty) {
    console.log("No hay eventos.");
    return;
  }

  console.log(`\n=== Auditoría de orden de subcolecciones — ${snapshot.size} eventos ===\n`);

  const flagged = [];

  for (const docSnap of snapshot.docs) {
    const eventId = docSnap.id;
    const data = docSnap.data();
    const eventRef = db.collection("events").doc(eventId);

    const [participants, waitlist, results, rounds] = await Promise.all([
      auditSubcollection(eventRef, "participants", "p", null),
      auditSubcollection(eventRef, "waitlist", "w", "waitlistPosition"),
      auditSubcollection(eventRef, "results", "r", "position"),
      auditSubcollection(eventRef, "rounds", "rnd", "roundNumber"),
    ]);

    const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
    const updatedAfterBug = updatedAt && !isNaN(updatedAt) && updatedAt > BUGGY_SINCE;

    const anyFindings = [participants, waitlist, results, rounds].some(s => s.findings.length > 0);

    if (!anyFindings && !updatedAfterBug) continue;

    flagged.push({ eventId, title: data.title || "(sin título)", updatedAt: data.updatedAt || null, updatedAfterBug, participants, waitlist, results, rounds });
  }

  if (flagged.length === 0) {
    console.log("Ningún evento con señales de orden corrompido detectadas.");
    console.log("\nListo.");
    return;
  }

  console.log(`⚠️  ${flagged.length} evento(s) con señales a revisar manualmente:\n`);

  flagged.forEach(f => {
    console.log(`--- ${f.title} [${f.eventId}] ---`);
    console.log(`  updatedAt: ${f.updatedAt || "(sin fecha)"}${f.updatedAfterBug ? "  ⚠️ posterior a 2026-07-30 (Sala Única)" : ""}`);
    ["participants", "waitlist", "results", "rounds"].forEach(key => {
      const s = f[key];
      if (s.count === 0) return;
      console.log(`  ${key} (${s.count} docs):`);
      if (s.findings.length > 0) {
        s.findings.forEach(msg => console.log(`    • ${msg}`));
      }
      if (key === "results" && s.count > 0) {
        console.log(`    Top-5 en el orden con el que se recupera HOY (antes del fix): ${s.buggyTop5.join(" | ")}`);
      }
    });
    console.log("");
  });

  console.log("Recomendación: para cada evento listado arriba, un admin debe abrir /eventsAdmin,");
  console.log("revisar la pestaña Sala Única y confirmar que el orden P1..Pn es el real (recordado");
  console.log("de la carrera), reordenando y guardando de nuevo si no lo es. Este script NO modifica nada.");
  console.log("\nListo.");
}

audit().catch(err => {
  console.error("Auditoría falló:", err);
  process.exitCode = 1;
});
