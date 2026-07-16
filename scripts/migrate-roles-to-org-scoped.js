/**
 * Migración única (ADR-006 resuelto, Fase 2): convierte los Custom Claims
 * planos { admin: true } / { comisario: true } (Fase 0) al nuevo modelo
 * org-scoped { orgs: { [orgId]: role } } que exige el firestore.rules /
 * manage_user_role de Fase 2.
 *
 * SIN esto, al desplegar el nuevo firestore.rules TODOS los admins y
 * comisarios actuales (11 personas, incluido el dueño de la plataforma)
 * perderían acceso inmediatamente, porque sus claims siguen en la forma
 * vieja que las reglas nuevas ya no leen.
 *
 * Regla de conversión (todos los usuarios legacy pertenecen hoy a la única
 * organización existente, 'gt7-esp'):
 *   - wolcutor@gmail.com (admin legacy)         -> orgs.gt7-esp = 'organizador'
 *     (además conserva su claim platformOwner, intacto)
 *   - resto con { admin: true }                 -> orgs.gt7-esp = 'director_liga'
 *   - usuarios con { comisario: true }           -> orgs.gt7-esp = 'comisario'
 *
 * Por cada usuario migrado también escribe/actualiza el documento espejo
 * memberships/{uid}_gt7-esp (mismo shape que escribe manage_user_role), y dado
 * que la migración es aditiva (no borra el claim legacy admin/comisario),
 * es segura de correr más de una vez sin duplicar nada: si un usuario ya
 * tiene claims.orgs['gt7-esp'] asignado, se omite.
 *
 * Uso: node scripts/migrate-roles-to-org-scoped.js
 *
 * Requiere serviceAccountKey.json en la raíz del proyecto (gitignoreado).
 * Correr DESPUÉS de tomar un backup fresco (scripts/backup-firestore.js) y
 * ANTES de desplegar firestore.rules/functions de Fase 2.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const ORG_ID = 'gt7-esp';
const PLATFORM_OWNER_EMAIL = 'wolcutor@gmail.com';

function targetRoleFor(email, claims) {
    if (claims.admin === true) {
        return email.toLowerCase() === PLATFORM_OWNER_EMAIL ? 'organizador' : 'director_liga';
    }
    if (claims.comisario === true) {
        return 'comisario';
    }
    return null;
}

async function migrateUser(userRecord) {
    const email = (userRecord.email || '').toLowerCase();
    const claims = userRecord.customClaims || {};

    if (claims.orgs && claims.orgs[ORG_ID]) {
        console.log(`⏭️  ${email}: ya tiene orgs.${ORG_ID} = '${claims.orgs[ORG_ID]}', se omite`);
        return;
    }

    const role = targetRoleFor(email, claims);
    if (!role) return; // no es admin ni comisario legacy, nada que migrar

    const newOrgs = { ...(claims.orgs || {}), [ORG_ID]: role };
    const newClaims = { ...claims, orgs: newOrgs };

    await admin.auth().setCustomUserClaims(userRecord.uid, newClaims);

    const db = admin.firestore();
    await db.collection('memberships').doc(`${userRecord.uid}_${ORG_ID}`).set(
        {
            uid: userRecord.uid,
            email,
            orgId: ORG_ID,
            role,
            displayName: '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    console.log(`✅ ${email} -> orgs.${ORG_ID} = '${role}' (uid: ${userRecord.uid})`);
}

async function main() {
    console.log(`── Migración de roles legacy -> org-scoped (org: ${ORG_ID}) ──\n`);

    let migrated = 0;
    let nextPageToken;
    do {
        const page = await admin.auth().listUsers(1000, nextPageToken);
        for (const userRecord of page.users) {
            const claims = userRecord.customClaims || {};
            if (claims.admin === true || claims.comisario === true) {
                await migrateUser(userRecord);
                migrated++;
            }
        }
        nextPageToken = page.pageToken;
    } while (nextPageToken);

    console.log(`\nListo. ${migrated} usuario(s) con claims legacy revisados.`);
    console.log('Cada usuario migrado debe cerrar sesión y volver a iniciar (o esperar el refresh automático del token) para que el claim tome efecto.');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
});
