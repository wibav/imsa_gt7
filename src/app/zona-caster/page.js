"use client";
import { useEffect, useState } from "react";
import { FirebaseService } from "../services/firebaseService";
import { barajar, estiloRed, redesDe } from "../utils/casterLinks";
import PageHeader from "../components/PageHeader";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { useI18n } from "../i18n";

/**
 * Zona Caster: los casters de la comunidad con su banner y sus redes.
 *
 * El orden se baraja en cada visita para que ningún caster quede siempre
 * arriba. Se baraja en el cliente, después de leer Firestore: la página es
 * una exportación estática y el HTML no lleva casters.
 * Se gestionan en /castersAdmin.
 */
export default function ZonaCasterPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [casters, setCasters] = useState([]);

    useEffect(() => {
        (async () => {
            const lista = await FirebaseService.getCasters();
            setCasters(barajar(lista.filter(c => c.active !== false)));
            setLoading(false);
        })();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
            <PageHeader
                migas={[{ label: t('caster.titulo') }]}
                icono="🎙️"
                titulo={t('caster.titulo')}
                subtitulo={t('caster.subtitulo')}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {loading ? (
                    <LoadingSkeleton variant="card" message={t('caster.cargando')} />
                ) : casters.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
                        <div className="text-6xl mb-4">🎙️</div>
                        <p className="text-gray-300 text-lg">{t('caster.sinCasters')}</p>
                    </div>
                ) : (
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {casters.map(c => <TarjetaCaster key={c.id} caster={c} />)}
                    </ul>
                )}
            </div>
        </div>
    );
}

function TarjetaCaster({ caster }) {
    const redes = redesDe(caster);
    return (
        <li className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
            <div className="aspect-video bg-black/40">
                {caster.bannerUrl
                    ? <img src={caster.bannerUrl} alt={caster.name} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center text-6xl">🎙️</div>}
            </div>
            <div className="p-4 flex flex-col gap-3 flex-1">
                <h2 className="text-lg font-bold text-white">{caster.name}</h2>
                {redes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto">
                        {redes.map(r => {
                            const { etiqueta, color } = estiloRed(r);
                            return (
                                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                                    className={`${color} text-sm font-semibold px-3 py-1.5 rounded-lg transition-all`}>
                                    {etiqueta}
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        </li>
    );
}
