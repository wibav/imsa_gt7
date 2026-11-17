/**
 * Subida de clips de prueba a YouTube (ver src/app/utils/videoEvidencia.js).
 *
 * POST { accion: 'iniciar', tipo, championshipId, trackId?, claimId?, tamano, mime }
 *   → { ok, uploadUrl, registroId }
 *   Abre en YouTube una sesión de subida reanudable como «Oculto» y devuelve
 *   su dirección: el navegador envía ahí el archivo. La sesión solo admite
 *   ese vídeo, con ese tamaño, así que no expone la autorización de la cuenta.
 *
 * POST { accion: 'confirmar', registroId, videoId }
 *   → { ok, url }
 *   Anota el vídeo en el registro (videoUploads) para tener trazabilidad.
 *
 * Sin sesión de Firebase, como las reclamaciones. El abuso se acota con un
 * cupo diario por IP y otro total (videoUploadsCupos/{día}). Un comisario o
 * administrador de la organización del campeonato (token en Authorization)
 * no gasta cupo por IP: al poner al día reclamaciones viejas sube muchos.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import {
    VIDEO_MAX_BYTES, SUBIDAS_POR_IP_DIA, SUBIDAS_TOTALES_DIA, TIPOS_VIDEO, tituloVideo,
} from '../../src/app/utils/videoEvidencia.js';

const YOUTUBE_OAUTH = defineSecret('YOUTUBE_OAUTH');

const ORIGENES = [
    'https://imsa.trenkit.com',
    'https://imsa-bd5b6.web.app',
    'https://imsa-bd5b6.firebaseapp.com',
    /^http:\/\/localhost:\d+$/,
];
const origenPermitido = (o) => !!o && ORIGENES.some(p => (typeof p === 'string' ? p === o : p.test(o)));

class ErrorVideo extends Error {
    constructor(codigo, mensaje, estado = 400) { super(mensaje); this.codigo = codigo; this.estado = estado; }
}

// Token de acceso en caché mientras la instancia siga viva (dura 1 h)
let tokenCache = { valor: null, caduca: 0 };
async function tokenDeAcceso() {
    if (tokenCache.valor && Date.now() < tokenCache.caduca - 60_000) return tokenCache.valor;
    const s = JSON.parse(YOUTUBE_OAUTH.value());
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: s.client_id, client_secret: s.client_secret,
            refresh_token: s.refresh_token, grant_type: 'refresh_token',
        }),
    });
    const datos = await res.json();
    if (!datos.access_token) throw new Error(`Google no renovó la autorización de YouTube: ${datos.error || res.status}`);
    tokenCache = { valor: datos.access_token, caduca: Date.now() + (datos.expires_in || 3600) * 1000 };
    return tokenCache.valor;
}

const diaUTC = () => new Date().toISOString().slice(0, 10);
const hashIp = (ip) => createHash('sha256').update(`videos:${ip || 'sin-ip'}`).digest('hex').slice(0, 32);

/** ¿El token es de un comisario o administrador de esta organización? */
async function esPersonal(idToken, orgId) {
    if (!idToken) return false;
    try {
        const c = await getAuth().verifyIdToken(idToken);
        return c.platformOwner === true || (!!orgId && !!(c.orgs || {})[orgId]);
    } catch {
        return false;
    }
}

/** Reserva una subida en el cupo del día; lanza ErrorVideo('limite') si no hay. */
async function reservarCupo(db, ipHash, personal) {
    const ref = db.collection('videoUploadsCupos').doc(diaUTC());
    await db.runTransaction(async (tx) => {
        const cupo = (await tx.get(ref)).data() || {};
        if ((cupo.total || 0) >= SUBIDAS_TOTALES_DIA) throw new ErrorVideo('limite', 'Cupo diario total agotado', 429);
        if (!personal && (cupo.porIp?.[ipHash] || 0) >= SUBIDAS_POR_IP_DIA) throw new ErrorVideo('limite', 'Cupo diario por IP agotado', 429);
        tx.set(ref, {
            total: FieldValue.increment(1),
            ...(personal ? {} : { porIp: { [ipHash]: FieldValue.increment(1) } }),
            actualizado: FieldValue.serverTimestamp(),
        }, { merge: true });
    });
}

async function iniciar(db, body, origen, ip, idToken) {
    const { tipo, championshipId, trackId, claimId } = body;
    const tamano = Number(body.tamano);
    const mime = String(body.mime || '');
    if (!TIPOS_VIDEO[tipo]) throw new ErrorVideo('tipo', 'Tipo de formulario desconocido');
    if (!/^video\//.test(mime)) throw new ErrorVideo('tipo', 'El archivo no es un vídeo');
    if (!Number.isFinite(tamano) || tamano <= 0 || tamano > VIDEO_MAX_BYTES) throw new ErrorVideo('tamano', 'Tamaño fuera de límites');
    if (typeof championshipId !== 'string' || !/^[\w-]{1,64}$/.test(championshipId)) throw new ErrorVideo('campeonato', 'Campeonato no válido');

    const champRef = db.collection('championships').doc(championshipId);
    const champ = (await champRef.get()).data();
    if (!champ || !champ.penaltiesConfig?.enabled) throw new ErrorVideo('campeonato', 'El campeonato no admite reclamaciones', 404);

    // Carrera, para el título: la del formulario o la de la reclamación
    let idCarrera = typeof trackId === 'string' ? trackId : '';
    if (!idCarrera && typeof claimId === 'string' && /^[\w-]{1,64}$/.test(claimId)) {
        idCarrera = (await champRef.collection('claims').doc(claimId).get()).data()?.trackId || '';
    }
    const pista = /^[\w-]{1,64}$/.test(idCarrera)
        ? (await champRef.collection('tracks').doc(idCarrera).get()).data()
        : null;

    const ipHash = hashIp(ip);
    const personal = await esPersonal(idToken, champ.orgId);
    await reservarCupo(db, ipHash, personal);

    const titulo = tituloVideo({ tipo, campeonato: champ.name, carrera: pista?.name, ronda: pista?.round });
    const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${await tokenDeAcceso()}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mime,
            'X-Upload-Content-Length': String(tamano),
            // Con el Origin de la web, YouTube responde con CORS al navegador
            Origin: origen,
        },
        body: JSON.stringify({
            snippet: {
                title: titulo,
                description: `${TIPOS_VIDEO[tipo]} enviada desde ${origen}/championships/?id=${championshipId}`,
                categoryId: '20', // Gaming
            },
            status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false, embeddable: true },
        }),
    });
    if (!res.ok) {
        const detalle = (await res.text()).slice(0, 500);
        const cupoYoutube = /quota|uploadLimitExceeded|rateLimitExceeded/i.test(detalle);
        logger.error('YouTube rechazó abrir la subida', { estado: res.status, detalle });
        throw new ErrorVideo(cupoYoutube ? 'limite' : 'youtube', 'YouTube no aceptó la subida', cupoYoutube ? 429 : 502);
    }
    const uploadUrl = res.headers.get('location');

    const registro = await db.collection('videoUploads').add({
        tipo, championshipId, trackId: idCarrera || null, claimId: claimId || null,
        titulo, tamano, mime, ipHash, personal,
        estado: 'iniciada',
        creado: FieldValue.serverTimestamp(),
    });
    return { ok: true, uploadUrl, registroId: registro.id };
}

async function confirmar(db, body) {
    const { registroId, videoId } = body;
    if (typeof registroId !== 'string' || !/^[\w-]{1,64}$/.test(registroId)) throw new ErrorVideo('registro', 'Registro no válido');
    if (typeof videoId !== 'string' || !/^[\w-]{6,20}$/.test(videoId)) throw new ErrorVideo('registro', 'Vídeo no válido');
    const ref = db.collection('videoUploads').doc(registroId);
    const reg = (await ref.get()).data();
    if (!reg || reg.estado !== 'iniciada') throw new ErrorVideo('registro', 'Registro desconocido o ya confirmado', 404);
    const url = `https://youtu.be/${videoId}`;
    await ref.update({ estado: 'subida', videoId, url, subido: FieldValue.serverTimestamp() });
    return { ok: true, url };
}

export const subir_video_youtube = onRequest(
    { region: 'us-central1', secrets: [YOUTUBE_OAUTH], cors: ORIGENES, timeoutSeconds: 60, memory: '256MiB', maxInstances: 5 },
    async (req, res) => {
        const origen = req.get('origin') || '';
        if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'metodo' }); return; }
        if (!origenPermitido(origen)) { res.status(403).json({ ok: false, error: 'origen' }); return; }
        const db = getFirestore();
        try {
            const body = typeof req.body === 'object' && req.body ? req.body : {};
            const ip = (req.get('x-forwarded-for') || '').split(',')[0].trim() || req.ip;
            const idToken = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
            const resultado = body.accion === 'confirmar'
                ? await confirmar(db, body)
                : await iniciar(db, body, origen, ip, idToken);
            res.json(resultado);
        } catch (e) {
            if (e instanceof ErrorVideo) {
                res.status(e.estado).json({ ok: false, error: e.codigo });
            } else {
                logger.error('Fallo en subir_video_youtube', e);
                res.status(500).json({ ok: false, error: 'interno' });
            }
        }
    }
);
