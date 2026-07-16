/**
 * Bootstrap único: migra los admins/comisarios actuales (hardcodeados en
 * ADMIN_EMAILS / userRoles) hacia Custom Claims de Firebase Auth, la nueva
 * fuente de verdad de permisos (ver Fase 0 / ADR-003).
 *
 * SIN esto, tras desplegar firestore.rules + el AuthContext basado en claims,
 * NADIE tendría el claim admin=true y quedaría bloqueado del panel admin
 * (incluido el propio dueño de la app) — este script debe correr ANTES de
 * desplegar esos cambios a producción.
 *
 * Idempotente: se puede correr más de una vez sin duplicar ni romper nada.
 *
 * Uso: node scripts/bootstrap-roles.js
 *
 * Requiere serviceAccountKey.json en la raíz del proyecto (ya existe local,
 * gitignoreado). NO se ejecuta automáticamente — correr manualmente y con
 * confirmación antes de apuntar a producción.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// Lista histórica de ADMIN_EMAILS (removida de AuthContext.js en este mismo
// cambio — se preserva aquí solo para el bootstrap único).
const LEGACY_ADMIN_EMAILS = [
    'eric.jce@gmail.com',
    'wolcutor@gmail.com',
    'yecherm@hotmail.com',
    'storricosan@gmail.com',
    'ojervoley@hotmail.com',
];

function emailToDocId(email) {
    return email.toLowerCase().replace(/\./g, '_').replace(/@/g, '__at__');
}

async function grantRole(email, role) {
    const db = admin.firestore();
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { [role]: true });

        const docRef = db.collection('userRoles').doc(emailToDocId(email));
        const existing = await docRef.get();
        await docRef.set(
            {
                email: email.toLowerCase(),
                role,
                displayName: existing.exists ? (existing.data().displayName || '') : '',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        console.log(`✅ ${email} -> ${role} (uid: ${user.uid})`);
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            console.warn(`⚠️  ${email}: no tiene cuenta de Firebase Auth aún (nunca inició sesión). Se omite — correr de nuevo este script cuando inicie sesión por primera vez.`);
        } else {
            console.error(`❌ ${email}: ${err.message}`);
        }
    }
}

async function main() {
    console.log('── Bootstrap de roles: admins (ADMIN_EMAILS legacy) ──');
    for (const email of LEGACY_ADMIN_EMAILS) {
        await grantRole(email, 'admin');
    }

    console.log('\n── Bootstrap de roles: comisarios (userRoles existentes) ──');
    const db = admin.firestore();
    const snap = await db.collection('userRoles').where('role', '==', 'comisario').get();
    if (snap.empty) {
        console.log('(sin comisarios registrados en userRoles)');
    }
    for (const doc of snap.docs) {
        const email = doc.data().email;
        if (email) await grantRole(email, 'comisario');
    }

    console.log('\nListo. Cada usuario migrado debe cerrar sesión y volver a iniciar (o esperar el refresh automático del token) para que el claim tome efecto.');
    process.exit(0);
}

main().catch(err => {
    console.error('Error en el bootstrap:', err);
    process.exit(1);
});
