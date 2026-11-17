/**
 * Rotación automática de divisiones (ascensos y descensos durante el
 * campeonato). Ver src/app/utils/divisionRotation.js.
 *
 * Vive en Node y no en functions/main.py para usar el mismo cálculo de
 * clasificación que la web: portarlo a Python haría que la función y la
 * página pudieran discrepar sobre quién sube y quién baja.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { prepararRotacion } from '../../src/app/utils/divisionRotation.js';
import { construirPromptPodio, ESTADO_IMAGEN } from '../../src/app/utils/podiumImages.js';

initializeApp();
const db = getFirestore();

const leer = async (ref) => (await ref.get()).docs.map(d => ({ id: d.id, ...d.data() }));

async function rotarCampeonato(doc, pilotIdentities) {
    const championship = { id: doc.id, ...doc.data() };
    const ref = doc.ref;
    const [tracks, divisions, penalties, claims, teams, decl] = await Promise.all(
        ['tracks', 'divisions', 'penalties', 'claims', 'teams', 'declarations'].map(c => leer(ref.collection(c)))
    );
    const declarations = Object.fromEntries(decl.map(d => [d.id, d.cars || []]));

    const rotacion = prepararRotacion({ championship, tracks, divisions, penalties, claims, teams, pilotIdentities, declarations });
    if (!rotacion) return false;

    // Todo en una transacción: si dos ejecuciones coinciden, la segunda ve
    // el registro de la primera y no vuelve a mover a nadie.
    await db.runTransaction(async (tx) => {
        const actual = await tx.get(ref);
        const hechas = (actual.data()?.divisionRotations || []).map(r => r.corte);
        if (hechas.includes(rotacion.corte)) return;
        const ahora = new Date().toISOString();
        Object.entries(rotacion.cambios).forEach(([divId, drivers]) => {
            tx.update(ref.collection('divisions').doc(divId), { drivers, updatedAt: ahora });
        });
        tx.update(ref, {
            divisionRotations: FieldValue.arrayUnion({
                corte: rotacion.corte,
                trackId: rotacion.cierre.id,
                trackName: rotacion.cierre.name || '',
                appliedAt: ahora,
                moves: rotacion.movimientos.map(({ driver, fromId, toId, type }) => ({ driver, fromId, toId, type })),
            }),
            updatedAt: ahora,
        });
    });
    logger.info(`Rotación aplicada en "${championship.name}" tras la carrera ${rotacion.corte}: ${rotacion.movimientos.length} movimientos`);
    return true;
}

export const rotar_divisiones = onSchedule(
    { schedule: 'every 60 minutes', timeZone: 'Europe/Madrid', region: 'us-central1', memory: '512MiB', timeoutSeconds: 300 },
    async () => {
        const snap = await db.collection('championships').where('divisionsConfig.enabled', '==', true).get();
        const candidatos = snap.docs.filter(d => {
            const c = d.data();
            const modo = c.divisionsConfig?.rotation?.mode;
            return c.status !== 'completed' && (modo === 'cada' || modo === 'mitad');
        });
        if (candidatos.length === 0) return;

        const pilotIdentities = await leer(db.collection('pilotIdentities'));
        // Secuencial a propósito: son pocos campeonatos y así un fallo en
        // uno queda aislado en el log sin afectar a los demás.
        for (const doc of candidatos) {
            try {
                await rotarCampeonato(doc, pilotIdentities);
            } catch (error) {
                logger.error(`Error rotando divisiones de ${doc.id}`, error);
            }
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────
// Imagen de campeones de una sala con IA (src/app/utils/podiumImages.js).
//
// No se dispara sola al terminar una sala: el administrador elige en la
// pestaña «Imágenes» entre generarla o subir una propia. Generar pone el
// documento en estado «generando» y esta función hace el resto. Cada imagen
// cuesta dinero en Gemini, por eso solo actúa en el cambio a «generando».
// ─────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** Modelo de imagen disponible para la clave: los ids cambian con cada versión. */
async function modeloDeImagen(clave) {
    const res = await fetch(`${GEMINI}/models?pageSize=200&key=${clave}`);
    if (!res.ok) throw new Error(`No se pudo consultar la lista de modelos (${res.status})`);
    const { models = [] } = await res.json();
    const nombres = models
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''))
        .filter(n => /image/.test(n) && !/imagen|edit/.test(n));
    // Flash antes que Pro (más barato), estable antes que preview, versión más alta primero
    const puntuar = n => (/flash/.test(n) ? 0 : 10) + (/preview|exp/.test(n) ? 1 : 0);
    nombres.sort((a, b) => puntuar(a) - puntuar(b) || b.localeCompare(a, undefined, { numeric: true }));
    if (!nombres.length) throw new Error('La clave de Gemini no tiene ningún modelo de imagen disponible');
    return nombres[0];
}

async function generarImagen(prompt, clave) {
    const modelo = await modeloDeImagen(clave);
    const res = await fetch(`${GEMINI}/models/${modelo}:generateContent?key=${clave}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
        }),
    });
    if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const datos = await res.json();
    const parte = (datos.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
    if (!parte) throw new Error(`Gemini no devolvió ninguna imagen (${datos.candidates?.[0]?.finishReason || 'sin motivo'})`);
    return { modelo, mime: parte.inlineData.mimeType || 'image/png', datos: Buffer.from(parte.inlineData.data, 'base64') };
}

export const generar_imagen_podio = onDocumentWritten(
    {
        document: 'championships/{champId}/podiumImages/{clave}',
        region: 'us-central1', memory: '512MiB', timeoutSeconds: 180, secrets: [GEMINI_API_KEY],
    },
    async (event) => {
        const antes = event.data?.before?.data();
        const despues = event.data?.after?.data();
        if (!despues || despues.status !== ESTADO_IMAGEN.GENERANDO || antes?.status === ESTADO_IMAGEN.GENERANDO) return;

        const { champId, clave } = event.params;
        const ref = event.data.after.ref;
        try {
            const prompt = construirPromptPodio(despues);
            const { modelo, mime, datos } = await generarImagen(prompt, GEMINI_API_KEY.value());
            const extension = mime.includes('jpeg') ? 'jpg' : mime.split('/')[1] || 'png';
            const ruta = `championships/${champId}/podios/${clave}-${Date.now()}.${extension}`;
            const token = randomUUID();
            const bucket = getStorage().bucket();
            await bucket.file(ruta).save(datos, {
                contentType: mime,
                metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } },
            });
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
            await ref.update({
                status: ESTADO_IMAGEN.LISTA, imageUrl, source: 'ia', model: modelo, prompt,
                error: FieldValue.delete(), updatedAt: new Date().toISOString(),
            });
            logger.info(`Imagen de campeones generada: ${champId}/${clave} con ${modelo}`);
        } catch (error) {
            logger.error(`Error generando la imagen de campeones ${champId}/${clave}`, error);
            await ref.update({ status: ESTADO_IMAGEN.ERROR, error: String(error.message || error).slice(0, 500), updatedAt: new Date().toISOString() });
        }
    }
);

// Clips de prueba de reclamaciones, descargos y alegaciones → YouTube
export { subir_video_youtube } from './videoYoutube.mjs';
