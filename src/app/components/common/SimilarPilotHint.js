"use client";
import { useEffect, useRef, useState } from 'react';
import { FirebaseService } from '../../services/firebaseService';
import { nombresParecidosA } from '../../utils/pilotIdentityMatcher';
import { extraerSiglas, claveSiglas } from '../../utils/teamTagMatcher';
import TeamAvatar from './TeamAvatar';
import { useI18n } from '../../i18n';

/**
 * Aviso bajo el campo de GT7 ID cuando lo escrito se parece a un piloto que ya
 * corre en la liga.
 *
 * GT7 permite cambiar el GT7 ID tres veces, así que el mismo piloto acaba
 * inscrito con nombres distintos temporada tras temporada y sus estadísticas
 * se parten. Limpiarlo después es trabajo manual (ver /pilotsAdmin); es mucho
 * más barato preguntárselo aquí a quien lo sabe seguro.
 *
 * No corrige el campo: un piloto nuevo puede llamarse parecido a otro y tiene
 * todo el derecho a inscribirse. Pero hay que contestar («Sí, soy X» o «No,
 * soy otro piloto») antes de enviar: como aviso opcional se ignoraba.
 *
 * @param {Function} [onPendiente] - recibe true mientras haya una pregunta
 *        sin contestar (y false al desmontarse)
 * @param {boolean}  [marcar] - resalta el aviso tras intentar enviar
 */
export default function SimilarPilotHint({ value, onUsar, onPendiente, marcar = false }) {
    const { t } = useI18n();
    const [conocidos, setConocidos] = useState([]);
    const [equipos, setEquipos] = useState([]);
    const [descartado, setDescartado] = useState(false);

    useEffect(() => {
        let vivo = true;
        FirebaseService.getKnownPilotNames()
            .then(n => { if (vivo) setConocidos(n); })
            .catch(() => { }); // el aviso es una ayuda: si no carga, no pasa nada
        FirebaseService.getRacingTeams()
            .then(e => { if (vivo) setEquipos(e); })
            .catch(() => { });
        return () => { vivo = false; };
    }, []);

    // Si el piloto cambia lo escrito, el descarte anterior deja de aplicar.
    useEffect(() => { setDescartado(false); }, [value]);

    const parecidos = descartado ? [] : nombresParecidosA(value, conocidos);

    // El formulario no deja enviar mientras haya un «¿Eres tú?» sin contestar:
    // como aviso opcional se ignoraba («Francis 125» frente a «HPR_FRANCIS125»).
    const pendiente = parecidos.length > 0;
    const avisar = useRef(onPendiente);
    avisar.current = onPendiente;
    useEffect(() => { avisar.current?.(pendiente); }, [pendiente]);
    useEffect(() => () => avisar.current?.(false), []);

    // Siglas de un equipo conocido al principio del GT7 ID. Solo informa:
    // pertenecer a un equipo lo confirma la organización en /equiposAdmin,
    // y quien se inscribe con estas siglas aparece allí para revisarlo.
    const siglas = extraerSiglas(value);
    const equipo = siglas && equipos.find(e =>
        [e.tag, ...(e.tagVariants || [])].some(v => claveSiglas(v) === siglas.tag));

    if (parecidos.length === 0 && !equipo) return null;

    return (
        <>
        {equipo && (
            <div className="mt-2 flex items-center gap-2 bg-white/5 border border-white/15 rounded-lg px-3 py-2">
                <TeamAvatar team={equipo} size="sm" />
                <p className="text-gray-300 text-xs">
                    <span className="font-mono font-semibold text-white">{siglas.tag}</span> {t('formularios.similar.sonSiglasDe')}{' '}
                    <span className="font-semibold text-white">{equipo.name}</span>. {t('formularios.similar.orgConfirma')}
                </p>
            </div>
        )}
        {parecidos.length > 0 && (
        <div className={`mt-2 bg-blue-500/10 border rounded-lg px-3 py-2 ${marcar ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-blue-400/30'}`} role="group" aria-label={t('formularios.similar.eresTu')}>
            <p className="text-blue-200 text-xs">
                {t('formularios.similar.eresTu')}{' '}
                <span className="font-semibold text-white">{parecidos.join(', ')}</span>
            </p>
            <p className="text-blue-200/60 text-xs mt-1">{t('formularios.similar.siEsTuCaso')}</p>
            <div className="flex flex-wrap gap-2 mt-2">
                {parecidos.map(n => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onUsar?.(n)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/30 hover:bg-blue-500/50 text-white border border-blue-300/40"
                    >
                        {t('formularios.similar.siSoy', { n })}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setDescartado(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-gray-200 border border-white/20"
                >
                    {t('formularios.similar.noSoyYo')}
                </button>
            </div>
            <p className={`text-xs mt-2 ${marcar ? 'text-amber-300 font-semibold' : 'text-blue-200/60'}`}>
                {t('formularios.similar.responde')}
            </p>
        </div>
        )}
        </>
    );
}
