"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FirebaseService } from "../../services/firebaseService";
import { getCarsForCategories, resolveCarName, CHAMPIONSHIP_CATEGORIES } from "../../utils/carUsageCalculator";

/**
 * Selección de autos del catálogo oficial de GT7.
 *
 * Los nombres se escribían a mano en varios formularios y cada error de
 * tecleo ("Hyundai Elantra Gr4" frente a "Hyundai ELANTRA N TC '24") rompía
 * el cruce con las declaraciones y el uso de autos.
 *
 * La primera versión usaba un `<datalist>` del navegador, pero en la práctica
 * no desplegaba sugerencias (depende del navegador y no siempre aparece), así
 * que el buscador pinta su propia lista. La lista va en el flujo de la página
 * y no flotando: varias secciones del admin llevan `overflow-hidden` y la
 * recortaban.
 */

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const MAX_RESULTADOS = 60;

function useCatalogo() {
    const [allCars, setAllCars] = useState([]);
    useEffect(() => {
        FirebaseService.getCars().then(setAllCars).catch(() => setAllCars([]));
    }, []);
    return allCars;
}

/**
 * Buscador con lista desplegable. Escribir filtra; clic, o flechas + Enter,
 * elige un auto y llama a `onPick(nombreExacto)`.
 *
 * @param {Array}    cars      - autos entre los que buscar ({name, carClass, manufacturer})
 * @param {string}   value     - texto del campo
 * @param {Function} onChange  - (texto) => void
 * @param {Function} onPick    - (nombre) => void
 * @param {Function} [onEnterFree] - Enter sin sugerencia resaltada
 */
function CarCombobox({ cars, value, onChange, onPick, onEnterFree, placeholder, className, exclude = [] }) {
    const [abierto, setAbierto] = useState(false);
    const [activo, setActivo] = useState(0);
    const cajaRef = useRef(null);
    const listaId = useId();

    const resultados = useMemo(() => {
        const q = sinAcentos(value).trim();
        const disponibles = cars.filter(c => c.name && !exclude.includes(c.name));
        const lista = q
            ? disponibles.filter(c => sinAcentos(`${c.name} ${c.manufacturer || ''}`).includes(q))
            : disponibles;
        return lista.slice(0, MAX_RESULTADOS);
    }, [cars, value, exclude]);

    // Cerrar al hacer clic fuera.
    useEffect(() => {
        const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, []);

    const elegir = (nombre) => {
        onPick(nombre);
        setAbierto(false);
        setActivo(0);
    };

    const alPulsar = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo(i => Math.min(i + 1, resultados.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Escape') { setAbierto(false); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (abierto && resultados[activo]) elegir(resultados[activo].name);
            else onEnterFree?.();
        }
    };

    return (
        <div ref={cajaRef} className="relative flex-1 min-w-0">
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
            {abierto && cars.length > 0 && (
                <ul
                    id={listaId}
                    role="listbox"
                    className="mt-1 max-h-64 overflow-y-auto bg-slate-800 border border-white/20 rounded-lg shadow-2xl text-sm"
                >
                    {resultados.length === 0 ? (
                        <li className="px-3 py-2 text-gray-400">Ningún auto coincide con «{value}».</li>
                    ) : resultados.map((c, i) => (
                        <li
                            key={c.id || c.name}
                            role="option"
                            aria-selected={i === activo}
                            onMouseDown={e => { e.preventDefault(); elegir(c.name); }}
                            onMouseEnter={() => setActivo(i)}
                            className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 ${i === activo ? 'bg-orange-600/40 text-white' : 'text-gray-200 hover:bg-white/10'}`}
                        >
                            <span className="truncate">{c.name}</span>
                            {c.carClass && <span className="text-[11px] text-gray-400 flex-shrink-0">{c.carClass}</span>}
                        </li>
                    ))}
                    {resultados.length === MAX_RESULTADOS && (
                        <li className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-white/10">Sigue escribiendo para acotar la lista…</li>
                    )}
                </ul>
            )}
        </div>
    );
}

/**
 * Campo de un solo auto (p. ej. el auto usado al cargar resultados). Sugiere
 * del catálogo pero deja escribir libremente.
 */
export default function CarNameInput({ value, onChange, categories, exclude = [], placeholder = 'Escribe para buscar un auto…', className = '' }) {
    const allCars = useCatalogo();
    const cars = useMemo(
        () => (categories?.length ? getCarsForCategories(categories, allCars) : allCars),
        [allCars, categories]
    );
    return (
        <CarCombobox
            cars={cars}
            value={value}
            onChange={onChange}
            onPick={onChange}
            exclude={exclude}
            placeholder={placeholder}
            className={className}
        />
    );
}

/**
 * Filtro de categoría + buscador + «Agregar», para listas de autos (autos
 * permitidos de una carrera, de la Pre-Qualy o de un evento).
 *
 * Elegir un auto de la lista lo agrega directamente. Si se escribe y se pulsa
 * «Agregar», solo se acepta un auto del catálogo (corrige mayúsculas y
 * completa si lo escrito solo encaja con uno).
 *
 * @param {Function} onAdd - (nombreExacto) => void
 * @param {string[]} [existing] - autos ya en la lista
 * @param {string[]} [categories] - categorías del campeonato: filtro inicial
 */
export function CarAdder({ onAdd, existing = [], categories, placeholder = 'Busca un auto…', inputClassName, buttonClassName }) {
    const allCars = useCatalogo();
    const [categoria, setCategoria] = useState(() => (categories?.length === 1 ? categories[0] : ''));
    const [texto, setTexto] = useState('');
    const [error, setError] = useState('');

    const cars = useMemo(
        () => (categoria ? getCarsForCategories([categoria], allCars) : allCars),
        [allCars, categoria]
    );

    const agregarNombre = (nombre) => {
        if (existing.includes(nombre)) { setError('Ese auto ya está en la lista.'); return; }
        onAdd(nombre);
        setTexto('');
        setError('');
    };

    const agregarEscrito = () => {
        const escrito = texto.trim();
        if (!escrito) { setError('Busca un auto y elígelo de la lista.'); return; }
        if (allCars.length === 0) { agregarNombre(escrito); return; }
        const nombre = resolveCarName(escrito, cars) || resolveCarName(escrito, allCars);
        if (!nombre) {
            setError(`«${escrito}» no está en el catálogo de GT7, o coincide con varios autos. Elígelo de la lista.`);
            return;
        }
        agregarNombre(nombre);
    };

    const claseCampo = 'px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500';

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <select
                    value={categoria}
                    onChange={e => { setCategoria(e.target.value); setError(''); }}
                    className={`${claseCampo} sm:w-48`}
                    aria-label="Filtrar por categoría"
                >
                    <option value="" className="bg-slate-800">Todas las categorías</option>
                    {CHAMPIONSHIP_CATEGORIES.map(c => {
                        const n = getCarsForCategories([c.value], allCars).length;
                        return (
                            <option key={c.value} value={c.value} className="bg-slate-800">
                                {c.label} — {c.descripcion}{allCars.length ? ` (${n})` : ''}
                            </option>
                        );
                    })}
                </select>
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <CarCombobox
                        cars={cars}
                        value={texto}
                        onChange={v => { setTexto(v); setError(''); }}
                        onPick={agregarNombre}
                        onEnterFree={agregarEscrito}
                        exclude={existing}
                        placeholder={placeholder}
                        className={inputClassName || `w-full ${claseCampo}`}
                    />
                    <button
                        type="button"
                        onClick={agregarEscrito}
                        className={buttonClassName || 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex-shrink-0'}
                    >
                        Agregar
                    </button>
                </div>
            </div>
            {error
                ? <p className="text-orange-300 text-xs mt-1">⚠️ {error}</p>
                : <p className="text-gray-500 text-xs mt-1">{cars.length} autos{categoria ? ' en esta categoría' : ' en el catálogo'} · elige uno de la lista para agregarlo</p>}
        </div>
    );
}
