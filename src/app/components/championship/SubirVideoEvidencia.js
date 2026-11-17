"use client";
import { useRef, useState } from 'react';
import { useI18n, traducir } from '../../i18n';
import { auth } from '../../api/firebase/firebaseConfig';
import {
    VIDEO_MAX_BYTES, VIDEO_MAX_MB, VIDEO_MAX_SEGUNDOS, VIDEOS_POR_FORMULARIO, ERRORES_VIDEO,
} from '../../utils/videoEvidencia';

const FUNCION = 'https://us-central1-imsa-bd5b6.cloudfunctions.net/subir_video_youtube';

async function llamarFuncion(cuerpo) {
    // Con sesión de comisario o admin, la función no aplica el cupo por conexión
    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const res = await fetch(FUNCION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(cuerpo),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || !datos.ok) throw Object.assign(new Error(datos.error || `HTTP ${res.status}`), { codigo: datos.error });
    return datos;
}

/** Duración del clip en segundos, o null si el navegador no sabe leerla. */
function duracionDe(file) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        const fin = (valor) => { URL.revokeObjectURL(url); resolve(valor); };
        video.preload = 'metadata';
        video.onloadedmetadata = () => fin(Number.isFinite(video.duration) ? video.duration : null);
        video.onerror = () => fin(null);
        setTimeout(() => fin(null), 8000);
        video.src = url;
    });
}

/** PUT del archivo a la sesión de YouTube, con progreso. Devuelve el id del vídeo. */
function enviarAYoutube(uploadUrl, file, onProgreso) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
            try {
                const datos = JSON.parse(xhr.responseText || '{}');
                if (xhr.status >= 200 && xhr.status < 300 && datos.id) resolve(datos.id);
                else reject(new Error(datos.error?.message || `YouTube ${xhr.status}`));
            } catch { reject(new Error(`YouTube ${xhr.status}`)); }
        };
        xhr.onerror = () => reject(new Error('red'));
        xhr.send(file);
    });
}

/**
 * Botón «Subir clip a YouTube» de los formularios de reclamación, descargo y
 * alegación. El clip va directo del navegador a YouTube como «Oculto» y su
 * enlace se añade a las pruebas con onSubido(url). Ver utils/videoEvidencia.
 *
 * Con `admin` (panel de comisarios): textos en español y sin el máximo de
 * clips por formulario ni el de duración; el de tamaño se mantiene.
 *
 * @param {'reclamacion'|'descargo'|'alegacion'} tipo
 */
export default function SubirVideoEvidencia({ tipo, championshipId, trackId, claimId, onSubido, onOcupado, admin = false }) {
    const { t } = useI18n();
    const v = (clave, vars) => (admin
        ? traducir('es', `formularios.video.${clave}`, vars)
        : t(`formularios.video.${clave}`, vars));
    const [estado, setEstado] = useState('libre'); // libre | preparando | subiendo
    const [progreso, setProgreso] = useState(0);
    const [error, setError] = useState('');
    const [subidos, setSubidos] = useState(0);
    const [aviso, setAviso] = useState('');
    const archivo = useRef(null);

    const ocupado = estado !== 'libre';
    const agotado = !admin && subidos >= VIDEOS_POR_FORMULARIO;
    const cambiarEstado = (e) => { setEstado(e); onOcupado?.(e !== 'libre'); };

    const elegir = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        setAviso('');
        if (!file.type.startsWith('video/')) { setError(v('errTipo')); return; }
        if (file.size > VIDEO_MAX_BYTES) { setError(v('errTamano', { mb: VIDEO_MAX_MB })); return; }
        const segundos = await duracionDe(file);
        if (!admin && segundos !== null && segundos > VIDEO_MAX_SEGUNDOS + 1) { setError(v('errDuracion', { seg: VIDEO_MAX_SEGUNDOS })); return; }

        cambiarEstado('preparando');
        setProgreso(0);
        try {
            const { uploadUrl, registroId } = await llamarFuncion({
                accion: 'iniciar', tipo, championshipId,
                trackId: trackId || undefined, claimId: claimId || undefined,
                tamano: file.size, mime: file.type,
            });
            cambiarEstado('subiendo');
            const videoId = await enviarAYoutube(uploadUrl, file, setProgreso);
            const url = `https://youtu.be/${videoId}`;
            onSubido(url);
            setSubidos(n => n + 1);
            setAviso(v('subido'));
            // La confirmación solo deja traza: si falla, el enlace ya sirve
            llamarFuncion({ accion: 'confirmar', registroId, videoId }).catch(() => {});
        } catch (err) {
            setError(v(ERRORES_VIDEO[err.codigo] || 'errRed', { mb: VIDEO_MAX_MB }));
        } finally {
            cambiarEstado('libre');
        }
    };

    return (
        <div className="space-y-2">
            <button type="button" onClick={() => archivo.current?.click()} disabled={ocupado || agotado}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-all">
                {estado === 'preparando' ? `⏳ ${v('preparando')}`
                    : estado === 'subiendo' ? `⏳ ${v('subiendo', { p: progreso })}`
                        : `🎬 ${v('subir')}`}
            </button>
            {estado === 'subiendo' && (
                <div className="h-2 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${progreso}%` }} />
                </div>
            )}
            <input ref={archivo} type="file" accept="video/*" onChange={elegir} className="hidden" aria-label={v('subir')} />
            <p className="text-gray-500 text-xs">
                {agotado ? v('errMaximo', { n: VIDEOS_POR_FORMULARIO }) : v(admin ? 'ayudaAdmin' : 'ayuda', { seg: VIDEO_MAX_SEGUNDOS, mb: VIDEO_MAX_MB })}
            </p>
            {aviso && <p className="text-green-300 text-xs" role="status">✅ {aviso}</p>}
            {error && <p className="text-red-300 text-xs" role="alert">❌ {error}</p>}
            {!admin && <p className="text-gray-400 text-xs pt-1">{v('o')}</p>}
        </div>
    );
}
