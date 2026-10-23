// Sustituye el catálogo de sanciones (penaltiesConfig.presets) de los
// campeonatos activos por el que sale del reglamento general
// (src/app/data/sanciones.js). Guarda antes copia en scripts/backups/.
// Las sanciones ya impuestas no cambian.
//
//   node scripts/reglamento/aplicar-catalogo-sanciones.mjs            (simulación)
//   node scripts/reglamento/aplicar-catalogo-sanciones.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import catalogo from '../../src/app/data/sanciones.js';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
admin.initializeApp({ credential: admin.credential.cert(require(path.join(raiz, 'serviceAccountKey.json'))) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');
const ORG = 'gt7-esp';
const TERMINADOS = new Set(['finished', 'completed', 'archived', 'cancelled']);

const snap = await db.collection('championships').where('orgId', '==', ORG).get();
const objetivo = snap.docs.filter(d => !TERMINADOS.has(d.data().status) && d.data().penaltiesConfig);
snap.docs.forEach(d => console.log(`${objetivo.includes(d) ? '→' : '  '} ${d.data().name} [${d.data().status}] ${(d.data().penaltiesConfig?.presets || []).length} sanciones`));
console.log(`\n${objetivo.length} campeonato(s) recibirán ${catalogo.presets.length} sanciones (v${catalogo.version}).`);
if (!APLICAR) { console.log('Simulación. Usa --apply para aplicar.'); process.exit(0); }

const backup = Object.fromEntries(objetivo.map(d => [d.id, d.data().penaltiesConfig.presets || []]));
fs.writeFileSync(path.join(raiz, 'scripts/backups', `presets-sanciones-antes-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`), JSON.stringify(backup, null, 1));
for (const d of objetivo) {
    await d.ref.update({ 'penaltiesConfig.presets': catalogo.presets.map(p => ({ ...p, active: true })) });
    console.log('✓', d.data().name);
}
process.exit(0);
