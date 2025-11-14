/**
 * Cloud Function para establecer custom claims de admin
 * Solo puede ser llamada por super-admins
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.setAdminRole = functions.https.onCall(async (data, context) => {
    // Verificar que quien llama está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Solo usuarios autenticados pueden llamar esta función'
        );
    }

    // Verificar que quien llama es admin (opcional - para que solo admins puedan crear otros admins)
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Solo administradores pueden otorgar permisos de admin'
        );
    }

    const { email, isAdmin } = data;

    try {
        // Obtener usuario por email
        const user = await admin.auth().getUserByEmail(email);

        // Establecer custom claim
        await admin.auth().setCustomUserClaims(user.uid, { admin: isAdmin });

        return {
            success: true,
            message: `Usuario ${email} ${isAdmin ? 'ahora es' : 'ya no es'} administrador`
        };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
