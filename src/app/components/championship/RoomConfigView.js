"use client";
import { seccionesVisibles } from "../../utils/roomConfig";

/**
 * Configuración de sala de una carrera, con el mismo orden, nombres y
 * disposición que el menú «Crear sala» de GT7: secciones con su título
 * centrado y los ajustes en dos columnas.
 *
 * Así el anfitrión puede copiarla opción por opción, y el piloto reconoce lo
 * que verá en la sala. Antes era una lista estrecha con nombres propios
 * ("Engine Swap", "Contravolante") que no coincidían con el juego.
 */
export default function RoomConfigView({ track }) {
    const secciones = seccionesVisibles(track);
    if (secciones.length === 0) return null;

    return (
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
            {secciones.map(seccion => (
                <section key={seccion.id} aria-labelledby={`sala-${seccion.id}`}>
                    <h3
                        id={`sala-${seccion.id}`}
                        className="bg-white/5 border-y border-white/10 first:border-t-0 px-4 py-2.5 text-center text-sm font-medium text-gray-300"
                    >
                        {seccion.titulo}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4">
                        {seccion.campos.map(campo => (
                            <div
                                key={campo.id}
                                className={`rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 ${campo.ancho === 'completo' ? 'sm:col-span-2' : ''}`}
                            >
                                <div className="text-xs text-gray-400">{campo.etiqueta}</div>
                                <div className="mt-1 font-semibold text-amber-200 break-words">{campo.valor}</div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
