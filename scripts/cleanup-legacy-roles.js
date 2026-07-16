/**
 * Limpieza única post-Fase 2 (ADR-006 resuelta): elimina los claims legacy
 * planos { admin: true } / { comisario: true } de los usuarios ya migrados a
 * { orgs: { gt7-esp: role } }, y borra la colección `userRoles` (mirror
 * legacy de solo lectura, ya reemplazada por `memberships`).
 *
 * Seguridad: por cada usuario, solo quita admin/comisario si YA tiene un rol
 * equivalente o superior en orgs.gt7-esp (para no dejar a nadie sin acceso
 * por un desfase entre ambos modelos). Si no lo tiene, lo deja intacto y lo
 * reporta como advertencia en vez de tocarlo.
 *
 * Antes de correr: toma un dump de los claims actuales (para poder revertir)
 * y confirma con `node scripts/dump-claims.js` que el resultado esperado es
 * razonable, y que ya se corrió `scripts/backup-firestore.js` (incluye
 * `userRoles` antes de borrarla).
 *
 * Uso:
 *   node scripts/cleanup-legacy-roles.js            (dry-run, no escribe nada)
 *   node scripts/cleanup-legacy-roles.js --apply    (aplica los cambios)
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const ORG_ID = 'gt7-esp';
const APPLY = process.argv.includes('--apply');

const ROLE_RANK = { comisario: 1, director_liga: 2, organizador: 3 };
const legacyRankNeeded = { admin: ROLE_RANK.director_liga, comisario: ROLE_RANK.comisario };

async function cleanupClaims() {
    console.log(`── Claims legacy (modo: ${APPLY ? 'APLICAR' : 'DRY-RUN'}) ──\n`);
    let cleaned = 0;
    let skipped = 0;
    let nextPageToken;
    do {
        const page = await admin.auth().listUsers(1000, nextPageToken);
        for (const userRecord of page.users) {
            const claims = userRecord.customClaims || {};
            const hasLegacy = claims.admin === true || claims.comisario === true;
            if (!hasLegacy) continue;

            const orgRole = (claims.orgs || {})[ORG_ID];
            const orgRank = ROLE_RANK[orgRole] || 0;
            const neededRank = claims.admin === true ? legacyRankNeeded.admin : legacyRankNeeded.comisario;

            if (orgRank < neededRank) {
                console.warn(`⚠️  ${userRecord.email}: NO se toca — legacy exige rank ${neededRank} pero orgs.${ORG_ID} es '${orgRole || 'ninguno'}' (rank ${orgRank})`);
                skipped++;
                continue;
            }

            const { admin: _a, comisario: _c, ...restClaims } = claims;
            console.log(`✅ ${userRecord.email}: quitando claim legacy (admin=${claims.admin}, comisario=${claims.comisario}), conserva orgs.${ORG_ID}='${orgRole}'`);
            if (APPLY) {
                await admin.auth().setCustomUserClaims(userRecord.uid, restClaims);
            }
            cleaned++;
        }
        nextPageToken = page.pageToken;
    } while (nextPageToken);

    console.log(`\n${cleaned} usuario(s) ${APPLY ? 'limpiados' : 'serían limpiados'}, ${skipped} omitido(s) por seguridad.`);
}

async function cleanupUserRolesCollection() {
    console.log(`\n── Colección userRoles (modo: ${APPLY ? 'APLICAR' : 'DRY-RUN'}) ──\n`);
    const db = admin.firestore();
    const snap = await db.collection('userRoles').get();
    console.log(`${snap.size} documento(s) encontrados.`);
    if (APPLY) {
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log('✅ Colección userRoles vaciada.');
    } else {
        console.log('(dry-run: no se borra nada, correr con --apply)');
    }
}

async function main() {
    await cleanupClaims();
    await cleanupUserRolesCollection();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
