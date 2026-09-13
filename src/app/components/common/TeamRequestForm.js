"use client";
import { useState } from "react";
import { notifyTeamRequest } from "../../utils/telegram";

const ESPERA_MS = 60 * 1000;
const CLAVE_ULTIMO_ENVIO = 'equipos:ultimaSolicitud';

/**
 * "Quiero que mi equipo aparezca": un texto libre que llega al bot de
 * Telegram del Administrador de Plataforma, que es quien crea los equipos en
 * /equiposAdmin.
 *
 * /api/notify es público, así que hay dos frenos mínimos contra el spam: un
 * minuto de espera entre envíos desde el mismo navegador y un campo trampa
 * invisible que un humano nunca rellena.
 */
export default function TeamRequestForm() {
    const [mensaje, setMensaje] = useState('');
    const [trampa, setTrampa] = useState('');
    const [estado, setEstado] = useState('idle'); // idle | enviando | enviado | error | espera

    const enviar = async (e) => {
        e.preventDefault();
        const texto = mensaje.trim();
        if (texto.length < 10) return;
        if (trampa) { setEstado('enviado'); return; }

        let ultimo = 0;
        try { ultimo = Number(localStorage.getItem(CLAVE_ULTIMO_ENVIO)) || 0; } catch { }
        if (Date.now() - ultimo < ESPERA_MS) { setEstado('espera'); return; }

        setEstado('enviando');
        const ok = await notifyTeamRequest(texto);
        if (ok) {
            try { localStorage.setItem(CLAVE_ULTIMO_ENVIO, String(Date.now())); } catch { }
            setMensaje('');
            setEstado('enviado');
        } else {
            setEstado('error');
        }
    };

    return (
        <section className="mt-10 bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
            <h2 className="text-white font-bold text-lg">¿Tu equipo no aparece?</h2>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
                Si quieres que tu equipo aparezca aquí y ya has participado en nuestros eventos o campeonatos,
                puedes notificarlo aquí:
            </p>

            {estado === 'enviado' ? (
                <div className="mt-4 bg-green-500/10 border border-green-400/30 text-green-300 rounded-lg px-4 py-3 text-sm">
                    ✅ Recibido. Revisaremos tu equipo y lo publicaremos si sus pilotos ya han corrido con nosotros.
                </div>
            ) : (
                <form onSubmit={enviar} className="mt-4 space-y-3">
                    <textarea
                        value={mensaje}
                        onChange={e => { setMensaje(e.target.value); if (estado !== 'enviando') setEstado('idle'); }}
                        rows={4}
                        maxLength={800}
                        required
                        placeholder="Nombre del equipo, siglas, GT7 ID de sus pilotos y cómo contactarte (Discord, PSN…)"
                        className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {/* Campo trampa: oculto para las personas, visible para los bots */}
                    <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
                        value={trampa} onChange={e => setTrampa(e.target.value)}
                        className="hidden" name="website" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-gray-500">{mensaje.length}/800</span>
                        <button
                            type="submit"
                            disabled={estado === 'enviando' || mensaje.trim().length < 10}
                            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                        >
                            {estado === 'enviando' ? 'Enviando…' : 'Enviar solicitud'}
                        </button>
                    </div>
                    {estado === 'error' && (
                        <p className="text-red-300 text-sm">No se pudo enviar. Inténtalo de nuevo en unos minutos.</p>
                    )}
                    {estado === 'espera' && (
                        <p className="text-amber-300 text-sm">Ya enviaste una solicitud hace menos de un minuto. Espera un momento antes de mandar otra.</p>
                    )}
                </form>
            )}
        </section>
    );
}
