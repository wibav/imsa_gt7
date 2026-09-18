"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { FirebaseService } from "../../services/firebaseService";
import { getCarsForCategories, resolveCarName } from "../../utils/carUsageCalculator";

/**
 * Campo de texto con autocompletado sobre el catálogo oficial de GT7.
 *
 * Los nombres de autos se escribían a mano en varios formularios y cada error
 * de tecleo ("Toyota GR86" frente a "Toyota GR86 RZ '21") rompía el cruce con
 * las declaraciones y el uso de autos. El navegador sugiere los nombres
 * exactos del catálogo (`<datalist>`) mientras se escribe.
 *
 * @param {string}   value
 * @param {Function} onChange    - (texto) => void
 * @param {Function} [onEnter]   - Enter en el campo
 * @param {string[]} [categories] - championship.categories para acotar las sugerencias
 * @param {string[]} [exclude]   - nombres ya elegidos, que no se vuelven a sugerir
 */
export default function CarNameInput({ value, onChange, onEnter, categories, exclude = [], placeholder = 'Escribe para buscar un auto…', className = '', ...rest }) {
    const listId = useId();
    const [allCars, setAllCars] = useState([]);

    useEffect(() => {
        FirebaseService.getCars().then(setAllCars).catch(() => setAllCars([]));
    }, []);

    const sugerencias = useMemo(() => {
        const base = categories?.length ? getCarsForCategories(categories, allCars) : allCars;
        return base.filter(c => c.name && !exclude.includes(c.name));
    }, [allCars, categories, exclude]);

    return (
        <>
            <input
                type="text"
                list={listId}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
                placeholder={placeholder}
                autoComplete="off"
                className={className}
                {...rest}
            />
            <datalist id={listId}>
                {sugerencias.map(c => (
                    <option key={c.id || c.name} value={c.name}>{c.carClass || ''}</option>
                ))}
            </datalist>
        </>
    );
}

/**
 * Campo + botón «Agregar» para listas de autos (autos permitidos de una
 * carrera, de la Pre-Qualy o de un evento).
 *
 * Solo deja agregar nombres del catálogo: corrige mayúsculas y espacios, y
 * si no encuentra el auto lo dice en lugar de guardar un nombre mal escrito.
 * Si el catálogo no se pudo cargar, acepta el texto tal cual.
 *
 * @param {Function} onAdd - (nombreExacto) => void
 * @param {string[]} [existing] - autos ya en la lista
 * @param {string[]} [categories]
 */
export function CarAdder({ onAdd, existing = [], categories, placeholder, inputClassName, buttonClassName }) {
    const [texto, setTexto] = useState('');
    const [error, setError] = useState('');
    const [allCars, setAllCars] = useState([]);

    useEffect(() => {
        FirebaseService.getCars().then(setAllCars).catch(() => setAllCars([]));
    }, []);

    const agregar = () => {
        const escrito = texto.trim();
        if (!escrito) { setError('Escribe el nombre de un auto.'); return; }
        // Primero entre los autos de la categoría (donde "elantra" solo es
        // uno), y si no, en todo el catálogo.
        const deCategoria = categories?.length ? getCarsForCategories(categories, allCars) : [];
        const nombre = allCars.length > 0
            ? (resolveCarName(escrito, deCategoria) || resolveCarName(escrito, allCars))
            : escrito;
        if (!nombre) {
            setError(`«${escrito}» no está en el catálogo de GT7. Elige una de las sugerencias mientras escribes.`);
            return;
        }
        if (existing.includes(nombre)) { setError('Ese auto ya está en la lista.'); return; }
        onAdd(nombre);
        setTexto('');
        setError('');
    };

    return (
        <div>
            <div className="flex gap-2">
                <CarNameInput
                    value={texto}
                    onChange={v => { setTexto(v); setError(''); }}
                    onEnter={agregar}
                    categories={categories}
                    exclude={existing}
                    placeholder={placeholder}
                    className={inputClassName || 'flex-1 min-w-0 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500'}
                />
                <button
                    type="button"
                    onClick={agregar}
                    className={buttonClassName || 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors'}
                >
                    Agregar
                </button>
            </div>
            {error && <p className="text-orange-300 text-xs mt-1">⚠️ {error}</p>}
        </div>
    );
}
