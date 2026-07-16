/**
 * Otorga el claim platformOwner:true a wolcutor@gmail.com — el Administrador
 * de Plataforma (dueño de trenkit, por encima de todas las organizaciones).
 *
 * A diferencia de admin/comisario (gestionados vía manage_user_role para
 * cualquier usuario), este claim se otorga UNA SOLA VEZ, manualmente, y solo
 * para el dueño de la plataforma — no forma parte del flujo normal de
 * gestión de roles en /usersAdmin.
 *
 * Idempotente. Uso: node scripts/grant-platform-owner.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const PLATFORM_OWNER_EMAIL = 'wolcutor@gmail.com';

async function main() {
    const user = await admin.auth().getUserByEmail(PLATFORM_OWNER_EMAIL);
    const existingClaims = user.customClaims || {};

    await admin.auth().setCustomUserClaims(user.uid, {
        ...existingClaims,
        platformOwner: true,
    });

    console.log(`✅ ${PLATFORM_OWNER_EMAIL} (uid: ${user.uid}) ahora es Administrador de Plataforma`);
    console.log('Claims resultantes:', { ...existingClaims, platformOwner: true });
    console.log('\nDebe cerrar sesión y volver a iniciar (o esperar el refresh automático del token) para que el claim tome efecto.');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
