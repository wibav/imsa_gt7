"use client";
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { FirebaseService } from "../../services/firebaseService";
import { applyPilotIdentities } from "../../utils/championshipUtils";

/**
 * Campo de GT7 ID con sugerencias de los pilotos que ya existen en la web
 * (inscripciones de cualquier campeonato y participantes de eventos), para
 * no dar de alta dos veces al mismo piloto con el nombre mal escrito.
 *
 * Con las fusiones de Identidad de pilotos, sugiere el GT7 ID canónico.
 * Elegir un piloto rellena también su PSN.
 */

const limpio = (t) => String(t || '').trim().toLowerCase();
const MAX_RESULTADOS = 40;

let promesaPilotos = null;
function cargarPilotosConocidos() {
    if (!promesaPilotos) {
        promesaPilotos = Promise.all([
            FirebaseService.getChampionships({ allOrgs: true }).catch(() => []),
            FirebaseService.getEvents({ allOrgs: true }).catch(() => []),
            FirebaseService.getPilotIdentities().catch(() => []),
        ]).then(([campeonatos, eventos, identidades]) => {
            const canon = applyPilotIdentities({}, identidades);
            const porClave = new Map();
            const anotar = (gt7Id, psnId, origen) => {
                const g = String(gt7Id || '').trim();
                if (!g) return;
                const nombre = canon[g] || g;
                const k = limpio(nombre);
                const previo = porClave.get(k) || { gt7Id: nombre, psnId: '', veces: 0, origenes: new Set(), alias: new Set() };
                if (!previo.psnId && psnId) previo.psnId = String(psnId).trim();
                previo.veces += 1;
                previo.origenes.add(origen);
                if (g !== nombre) previo.alias.add(g);
                porClave.set(k, previo);
            };
            campeonatos.forEach(c => (c.registrations || []).forEach(r => {
                const pilotos = Array.isArray(r.drivers) && r.drivers.length ? r.drivers : [r];
                pilotos.forEach(p => anotar(p.gt7Id || p.name, p.psnId, c.name));
            }));
            eventos.forEach(e => (e.participants || []).forEach(p => anotar(p.gt7Id || p.name, p.psnId, e.title)));
            return [...porClave.values()]
                .map(p => ({ ...p, origenes: [...p.origenes], alias: [...p.alias] }))
                .sort((a, b) => b.veces - a.veces || a.gt7Id.localeCompare(b.gt7Id));
        }).catch(() => {
            promesaPilotos = null;
            return [];
        });
    }
    return promesaPilotos;
}

/**
 * @param {string}   value
 * @param {Function} onChange - (texto) => void
 * @param {Function} onPick   - ({gt7Id, psnId}) => void
 * @param {Array}    [inscritos] - inscripciones del campeonato, para avisar si ya está
 */
export default function PilotIdInput({ value, onChange, onPick, inscritos = [], className = '', placeholder = 'Escribe para buscar…' }) {
    const [pilotos, setPilotos] = useState([]);
    const [cargado, setCargado] = useState(false);
    const [abierto, setAbierto] = useState(false);
    const [activo, setActivo] = useState(0);
    const cajaRef = useRef(null);
    const listaId = useId();

    useEffect(() => {
        let vivo = true;
        cargarPilotosConocidos().then(p => { if (vivo) { setPilotos(p); setCargado(true); } });
        return () => { vivo = false; };
    }, []);

    useEffect(() => {
        const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, []);

    const yaInscrito = useMemo(() => {
        const claves = new Set();
        inscritos.forEach(r => [r.gt7Id, r.psnId, r.name].forEach(n => n && claves.add(limpio(n))));
        return (p) => [p.gt7Id, p.psnId, ...p.alias].some(n => n && claves.has(limpio(n)));
    }, [inscritos]);

    const q = limpio(value);
    const resultados = useMemo(() => {
        if (!q) return [];
        return pilotos
            .filter(p => [p.gt7Id, p.psnId, ...p.alias].some(n => limpio(n).includes(q)))
            .slice(0, MAX_RESULTADOS);
    }, [pilotos, q]);

    const exacto = pilotos.find(p => [p.gt7Id, p.psnId, ...p.alias].some(n => limpio(n) === q));

    const elegir = (p) => {
        onPick({ gt7Id: p.gt7Id, psnId: p.psnId });
        setAbierto(false);
        setActivo(0);
    };

    const alPulsar = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo(i => Math.min(i + 1, resultados.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Escape') setAbierto(false);
        else if (e.key === 'Enter' && abierto && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); }
    };

    return (
        <div ref={cajaRef} className="relative">
            <input
                type="text"
                value={value}
                onChange={e => { onChange(e.target.value); setAbierto(true); setActivo(0); }}
                onFocus={() => setAbierto(true)}
                onKeyDown={alPulsar}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={abierto}
                aria-controls={listaId}
                aria-autocomplete="list"
                className={className}
            />
            {abierto && q && resultados.length > 0 && (
                <ul id={listaId} role="listbox"
                    className="mt-1 max-h-64 overflow-y-auto bg-slate-800 border border-white/20 rounded-lg shadow-2xl text-sm">
                    {resultados.map((p, i) => (
                        <li
                            key={p.gt7Id}
                            role="option"
                            aria-selected={i === activo}
                            onMouseDown={e => { e.preventDefault(); elegir(p); }}
                            onMouseEnter={() => setActivo(i)}
                            className={`px-3 py-2 cursor-pointer ${i === activo ? 'bg-orange-600/40 text-white' : 'text-gray-200 hover:bg-white/10'}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{p.gt7Id}</span>
                                {yaInscrito(p) && <span className="text-[11px] text-yellow-300 flex-shrink-0">ya inscrito aquí</span>}
                            </div>
                            <div className="text-[11px] text-gray-400 truncate">
                                {p.psnId ? `PSN: ${p.psnId} · ` : ''}{p.origenes.slice(0, 2).join(' · ')}{p.origenes.length > 2 ? ` +${p.origenes.length - 2}` : ''}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {q && cargado && (exacto || resultados.length === 0) && (
                <p className={`text-[11px] mt-1 ${exacto ? (yaInscrito(exacto) ? 'text-yellow-300' : 'text-green-300') : 'text-orange-300'}`}>
                    {exacto
                        ? (yaInscrito(exacto) ? '⚠️ Este piloto ya está inscrito en este campeonato' : `✅ Piloto conocido${exacto.gt7Id !== value.trim() ? ` (${exacto.gt7Id})` : ''}`)
                        : '🆕 No aparece en ningún campeonato ni evento: revisa que esté bien escrito'}
                </p>
            )}
            {q && cargado && !exacto && resultados.length > 0 && !abierto && (
                <p className="text-[11px] mt-1 text-gray-400">Hay {resultados.length} piloto(s) parecidos: vuelve al campo para elegir uno.</p>
            )}
        </div>
    );
}
