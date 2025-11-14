"use client";

import { useChampionship } from '../context/ChampionshipContext';

/**
 * Componente selector de campeonatos
 * Dropdown para seleccionar entre los campeonatos disponibles
 */
export default function ChampionshipSelector({
    className = '',
    showAllOption = false,
    filter = null, // 'active' | 'completed' | 'archived' | null
}) {
    const {
        championships,
        selectedChampionship,
        selectChampionship,
        loading
    } = useChampionship();

    // Filtrar campeonatos según el prop filter
    const filteredChampionships = filter
        ? championships.filter(c => c.status === filter)
        : championships;

    const handleChange = (e) => {
        const championshipId = e.target.value;
        if (championshipId === 'all') {
            // Manejar opción "Todos" si está habilitada
            return;
        }
        selectChampionship(championshipId);
    };

    if (loading) {
        return (
            <div className={`relative ${className}`}>
                <select
                    disabled
                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white appearance-none cursor-not-allowed"
                >
                    <option>Cargando...</option>
                </select>
            </div>
        );
    }

    if (filteredChampionships.length === 0) {
        return (
            <div className={`relative ${className}`}>
                <select
                    disabled
                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white appearance-none cursor-not-allowed"
                >
                    <option>No hay campeonatos</option>
                </select>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <select
                value={selectedChampionship?.id || ''}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white appearance-none cursor-pointer hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            >
                {showAllOption && (
                    <option value="all" className="bg-slate-800">
                        📊 Todos los campeonatos
                    </option>
                )}

                {filteredChampionships.map((championship) => (
                    <option
                        key={championship.id}
                        value={championship.id}
                        className="bg-slate-800"
                    >
                        {getChampionshipIcon(championship.status)} {championship.shortName || championship.name} - {championship.season}
                    </option>
                ))}
            </select>

            {/* Icono de dropdown */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                    className="w-5 h-5 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </div>
        </div>
    );
}

/**
 * Obtener icono según el estado del campeonato
 */
function getChampionshipIcon(status) {
    const icons = {
        active: '🏁',
        draft: '📝',
        completed: '🏆',
        archived: '📦'
    };
    return icons[status] || '📊';
}

/**
 * Variante compacta del selector (para headers/navbars)
 */
export function ChampionshipSelectorCompact({ className = '' }) {
    const {
        championships,
        selectedChampionship,
        selectChampionship,
        loading
    } = useChampionship();

    if (loading || !selectedChampionship) {
        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg ${className}`}>
                <span className="text-sm text-white/70">Cargando...</span>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <select
                value={selectedChampionship.id}
                onChange={(e) => selectChampionship(e.target.value)}
                className="px-3 py-1.5 pr-8 bg-white/10 border border-white/30 rounded-lg text-sm text-white appearance-none cursor-pointer hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            >
                {championships.map((championship) => (
                    <option
                        key={championship.id}
                        value={championship.id}
                        className="bg-slate-800"
                    >
                        {championship.shortName || championship.name}
                    </option>
                ))}
            </select>

            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                    className="w-4 h-4 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </div>
        </div>
    );
}

/**
 * Badge informativo del campeonato seleccionado
 */
export function ChampionshipBadge({ className = '' }) {
    const { selectedChampionship } = useChampionship();

    if (!selectedChampionship) return null;

    const statusColors = {
        active: 'bg-green-500/20 text-green-300 border-green-500/30',
        draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
        completed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        archived: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    };

    const statusColor = statusColors[selectedChampionship.status] || statusColors.draft;

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg ${statusColor} ${className}`}>
            <span className="text-lg">
                {getChampionshipIcon(selectedChampionship.status)}
            </span>
            <div className="flex flex-col">
                <span className="text-xs font-medium">
                    {selectedChampionship.shortName || selectedChampionship.name}
                </span>
                <span className="text-xs opacity-70">
                    {selectedChampionship.season}
                </span>
            </div>
        </div>
    );
}
