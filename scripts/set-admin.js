/**
 * Script para establecer custom claims de admin en Firebase Auth
 * Ejecutar: node scripts/set-admin.js <email-del-usuario>
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Archivo de credenciales de Firebase

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
async function setAdminClaim(email) {
    try {
        // Buscar usuario por email
        const user = await admin.auth().getUserByEmail(email);

        // Establecer custom claim 'admin'
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });

        console.log(`✅ Usuario ${email} (${user.uid}) ahora es administrador`);
        console.log('El usuario debe cerrar sesión y volver a iniciar para que los cambios tomen efecto');

        // Verificar claims
        const updatedUser = await admin.auth().getUser(user.uid);
        console.log('Custom claims:', updatedUser.customClaims);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Obtener email desde argumentos de línea de comandos
const email = process.argv[2];

if (!email) {
    console.error('❌ Debes proporcionar un email');
    console.log('Uso: node scripts/set-admin.js usuario@ejemplo.com');
    process.exit(1);
}

setAdminClaim(email);
