"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useChampionship } from '../context/ChampionshipContext';
import { FirebaseService } from '../services/firebaseService';
import TracksManager from '../components/TracksManager';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PenaltiesTab from '../components/championship/PenaltiesTab';
import DivisionsTab from '../components/championship/DivisionsTab';
import { DEFAULT_SPRINT_POINTS } from '../utils/constants';

export default function ChampionshipDetail() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const championshipId = searchParams.get("id");

    const { currentUser, loading: authLoading } = useAuth();
    const { championships, updateChampionship, deleteChampionship, loading: championshipsLoading } = useChampionship();

    const [championship, setChampionship] = useState(null);
    const [teams, setTeams] = useState([]);
    const [tracks, setTracks] = useState([]);
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState('info');
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [penalties, setPenalties] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [championshipsTeams, setChampionshipsTeams] = useState({}); // Equipos por campeonato

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push('/login');
        }
    }, [currentUser, authLoading, router]);

    // Cargar equipos de todos los campeonatos para mostrar en la lista
    useEffect(() => {
        if (championships && championships.length > 0 && !championshipId) {
            loadAllChampionshipsTeams();
        }
    }, [championships, championshipId]);

    const loadAllChampionshipsTeams = async () => {
        try {
            const teamsData = {};
            for (const champ of championships) {
                if (champ.settings?.isTeamChampionship) {
                    const champTeams = await FirebaseService.getTeamsByChampionship(champ.id);
                    teamsData[champ.id] = champTeams || [];
                }
            }
            setChampionshipsTeams(teamsData);
        } catch (error) {
            console.error("Error loading championships teams:", error);
        }
    };

    const loadChampionshipData = async () => {
        if (!championshipId) return;

        setLoading(true);
        setChampionship(null);
        setTeams([]);
        setTracks([]);
        setEvents([]);

        try {
            // Cargar todo en paralelo
            const [champData, teamsData, tracksData, eventsData, penaltiesData, divisionsData] = await Promise.all([
                FirebaseService.getChampionship(championshipId),
                FirebaseService.getTeamsByChampionship(championshipId).catch(() => []),
                FirebaseService.getTracksByChampionship(championshipId).catch(() => []),
                FirebaseService.getEventsByChampionship(championshipId).catch(() => []),
                FirebaseService.getPenaltiesByChampionship(championshipId).catch(() => []),
                FirebaseService.getDivisionsByChampionship(championshipId).catch(() => [])
            ]);

            setChampionship(champData);
            setTeams(teamsData || []);
            setTracks(tracksData || []);
            setEvents(eventsData || []);
            setPenalties(penaltiesData || []);
            setDivisions(divisionsData || []);
        } catch (error) {
            console.error('Error cargando datos del campeonato:', error);
        } finally {
            setLoading(false);
        }
    };

    // Cargar datos del campeonato
    useEffect(() => {
        if (championshipId) {
            loadChampionshipData();
        } else {
            setLoading(false);
        }
    }, [championshipId]);

    if (authLoading || (championshipId && loading)) {
        return <LoadingSkeleton variant="page" message="Cargando..." />;
    }

    if (!currentUser) {
        return null;
    }

    // Si NO hay championshipId, mostrar lista de campeonatos
    if (!championshipId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-4xl font-bold text-white">
                            🏆 Administrar Campeonatos
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all border border-white/30"
                            >
                                🏠 Dashboard
                            </button>
                            <button
                                onClick={() => router.push('/championshipsAdmin/new')}
                                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-bold hover:from-orange-700 hover:to-red-700"
                            >
                                + Nuevo Campeonato
                            </button>
                        </div>
                    </div>

                    {championshipsLoading ? (
                        <LoadingSkeleton variant="spinner" message="Cargando campeonatos..." />
                    ) : championships.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            No hay campeonatos creados. Crea uno nuevo para comenzar.
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {championships.map((champ) => (
                                <div
                                    key={champ.id}
                                    className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg overflow-hidden hover:border-orange-500/50 transition-all cursor-pointer"
                                    onClick={() => router.push(`/championshipsAdmin?id=${champ.id}`)}
                                >
                                    <div className="p-6">
                                        <div className="flex items-start justify-between mb-3">
                                            <h3 className="text-xl font-bold text-white flex-1">{champ.name}</h3>
                                            <StatusBadge status={champ.status} />
                                        </div>

                                        <p className="text-gray-300 text-sm mb-4">
                                            {champ.shortName} • Temporada {champ.season}
                                        </p>

                                        {champ.description && (
                                            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                                                {champ.description}
                                            </p>
                                        )}

                                        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                            <div className="bg-white/5 rounded-lg p-2">
                                                <div className="text-gray-400">Tipo</div>
                                                <div className="text-white font-medium">
                                                    {champ.settings?.isTeamChampionship ? '👥 Equipos' : '🏎️ Individual'}
                                                </div>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2">
                                                <div className="text-gray-400">Pilotos</div>
                                                <div className="text-white font-medium">
                                                    {(() => {
                                                        if (champ.settings?.isTeamChampionship) {
                                                            // Para campeonatos por equipos, contar pilotos en todos los equipos
                                                            const champTeams = championshipsTeams[champ.id] || [];
                                                            return champTeams.reduce((total, team) => {
                                                                return total + (team.drivers?.length || 0);
                                                            }, 0);
                                                        }
                                                        // Para campeonatos individuales, contar directamente
                                                        return champ.drivers?.length || 0;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {(champ.startDate || champ.endDate) && (
                                            <div className="text-xs text-gray-400 mb-4">
                                                {champ.startDate && new Date(champ.startDate).toLocaleDateString('es-ES')}
                                                {champ.startDate && champ.endDate && ' - '}
                                                {champ.endDate && new Date(champ.endDate).toLocaleDateString('es-ES')}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/championshipsAdmin?id=${champ.id}`);
                                                }}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-sm font-medium"
                                            >
                                                📊 Ver Detalles
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/championshipsAdmin/edit?id=${champ.id}`);
                                                }}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all text-sm font-medium"
                                            >
                                                ✏️
                                            </button>
                                            {champ.status === 'draft' && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`¿Eliminar el campeonato "${champ.name}"? Esta acción no se puede deshacer.`)) {
                                                            try {
                                                                await deleteChampionship(champ.id);
                                                            } catch (err) {
                                                                alert('Error al eliminar: ' + err.message);
                                                            }
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all text-sm font-medium"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (!championship) {
        return null;
    }

    // Construir tabs según el tipo de campeonato
    const tabs = [
        { id: 'info', label: '📋 Información', icon: '📋' }
    ];

    // Solo mostrar equipos si es campeonato por equipos
    if (championship.settings?.isTeamChampionship) {
        tabs.push({ id: 'teams', label: '🏁 Equipos', icon: '🏁', count: teams.length });
    }

    // Siempre mostrar pilotos
    const driversCount = championship.settings?.isTeamChampionship
        ? teams.reduce((sum, t) => sum + (t.drivers?.length || 0), 0)
        : (championship.drivers?.length || 0);
    tabs.push({ id: 'drivers', label: '🏎️ Pilotos', icon: '🏎️', count: driversCount });

    // Siempre mostrar pistas
    tabs.push({ id: 'tracks', label: '🗺 Pistas', icon: '🗺', count: tracks.length });

    // Mostrar inscripciones si están habilitadas
    if (championship.registration?.enabled) {
        const pendingCount = (championship.registrations || []).filter(r => r.status === 'pending').length;
        tabs.push({
            id: 'registrations',
            label: '📝 Inscripciones',
            icon: '📝',
            count: (championship.registrations || []).length,
            badge: pendingCount > 0 ? pendingCount : undefined
        });
    }

    // Mostrar sanciones si están habilitadas
    if (championship.penaltiesConfig?.enabled) {
        tabs.push({
            id: 'penalties',
            label: '⚠️ Sanciones',
            icon: '⚠️',
            count: penalties.filter(p => p.status === 'applied').length
        });
    }

    // Mostrar divisiones si están habilitadas
    if (championship.divisionsConfig?.enabled) {
        tabs.push({
            id: 'divisions',
            label: '🏆 Divisiones',
            icon: '🏆',
            count: divisions.length
        });
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <button
                                    onClick={() => router.push('/championshipsAdmin')}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-lg transition-all"
                                >
                                    ← Volver
                                </button>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                                    {championship.name}
                                </h1>
                                <StatusBadge status={championship.status} />
                            </div>
                            <p className="text-gray-300">
                                Temporada {championship.season} • {championship.shortName}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditMode(!editMode)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                            >
                                {editMode ? '✅ Guardar' : '✏️ Editar'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg mb-6">
                    <div className="flex overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 min-w-[120px] px-4 py-4 text-center transition-all border-b-2 relative ${activeTab === tab.id
                                    ? 'border-orange-500 text-white bg-white/10'
                                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xl">{tab.icon}</span>
                                    <span className="text-sm font-medium">{tab.label.split(' ')[1]}</span>
                                    {tab.count !== undefined && (
                                        <span className="text-xs bg-orange-500/30 px-2 py-0.5 rounded-full">
                                            {tab.count}
                                        </span>
                                    )}
                                </div>
                                {/* Badge de pendientes */}
                                {tab.badge > 0 && (
                                    <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Contenido de tabs */}
                <div className="bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg p-6">
                    {activeTab === 'info' && (
                        <InfoTab
                            championship={championship}
                            editMode={editMode}
                            onUpdate={loadChampionshipData}
                        />
                    )}

                    {activeTab === 'teams' && (
                        <TeamsTab
                            championshipId={championshipId}
                            teams={teams}
                            tracks={tracks}
                            editMode={editMode}
                            onUpdate={loadChampionshipData}
                        />
                    )}

                    {activeTab === 'drivers' && (
                        <DriversTab
                            championshipId={championshipId}
                            championship={championship}
                            teams={teams}
                            tracks={tracks}
                            editMode={editMode}
                            onUpdate={loadChampionshipData}
                        />
                    )}

                    {activeTab === 'tracks' && (
                        <TracksTab
                            championshipId={championshipId}
                            tracks={tracks}
                            teams={teams}
                            championship={championship}
                            editMode={editMode}
                            onUpdate={loadChampionshipData}
                        />
                    )}

                    {activeTab === 'registrations' && (
                        <RegistrationsTab
                            championshipId={championshipId}
                            championship={championship}
                            onUpdate={loadChampionshipData}
                        />
                    )}

                    {activeTab === 'penalties' && (
                        <PenaltiesTab
                            championshipId={championshipId}
                            championship={championship}
                            teams={teams}
                            tracks={tracks}
                            onUpdate={loadChampionshipData}
                        />
                    )}

                    {activeTab === 'divisions' && (
                        <DivisionsTab
                            championshipId={championshipId}
                            championship={championship}
                            divisions={divisions}
                            teams={teams}
                            tracks={tracks}
                            penalties={penalties}
                            onUpdate={loadChampionshipData}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Badge de estado (importado de components/common/StatusBadge)
import StatusBadge from '../components/common/StatusBadge';

// Tab de Información
function InfoTab({ championship, editMode, onUpdate }) {
    const [formData, setFormData] = useState({
        name: championship.name,
        shortName: championship.shortName,
        description: championship.description,
        season: championship.season,
        status: championship.status,
        startDate: championship.startDate?.split('T')[0] || '',
        endDate: championship.endDate?.split('T')[0] || ''
    });

    const handleSave = async () => {
        try {
            await FirebaseService.updateChampionship(championship.id, {
                ...formData,
                startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
                endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null
            });
            onUpdate();
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Información General</h2>

            {editMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nombre Corto</label>
                        <input
                            type="text"
                            value={formData.shortName}
                            onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Temporada</label>
                        <input
                            type="text"
                            value={formData.season}
                            onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Estado</label>
                        {championship.status === 'completed' ? (
                            <div className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-gray-400 cursor-not-allowed flex items-center gap-2">
                                🔒 Finalizado <span className="text-xs">(no editable)</span>
                            </div>
                        ) : (
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                            >
                                <option value="draft" className="bg-slate-800">Borrador</option>
                                <option value="active" className="bg-slate-800">Activo</option>
                                <option value="completed" className="bg-slate-800">Completado</option>
                                <option value="archived" className="bg-slate-800">Archivado</option>
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Inicio</label>
                        <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Fin</label>
                        <input
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg"
                        >
                            💾 Guardar Cambios
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoField label="Nombre" value={championship.name} />
                    <InfoField label="Nombre Corto" value={championship.shortName} />
                    <InfoField label="Descripción" value={championship.description} className="md:col-span-2" />
                    <InfoField label="Temporada" value={championship.season} />
                    <InfoField label="Estado" value={<StatusBadge status={championship.status} />} />
                    {championship.startDate && (
                        <InfoField label="Fecha Inicio" value={new Date(championship.startDate).toLocaleDateString()} />
                    )}
                    {championship.endDate && (
                        <InfoField label="Fecha Fin" value={new Date(championship.endDate).toLocaleDateString()} />
                    )}
                </div>
            )}
        </div>
    );
}

function InfoField({ label, value, className = '' }) {
    return (
        <div className={className}>
            <p className="text-sm text-gray-400 mb-1">{label}</p>
            <p className="text-white text-lg">{value || '-'}</p>
        </div>
    );
}

// Tab de Equipos con puntajes ordenados y edición
function TeamsTab({ championshipId, teams, tracks, editMode, onUpdate }) {
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [teamFormData, setTeamFormData] = useState(null);
    const [showAddDriverModal, setShowAddDriverModal] = useState(false);
    const [newDriver, setNewDriver] = useState({ name: '', category: 'Gr1' });

    // Calcular puntaje total de cada equipo sumando los puntos de todos sus pilotos
    const teamsWithScores = teams.map(team => {
        let totalPoints = 0;

        // Sumar puntos de cada piloto en cada pista
        team.drivers?.forEach(driver => {
            tracks.forEach(track => {
                const driverPoints = track.points?.[driver.name] || 0;
                totalPoints += driverPoints;
            });
        });

        return {
            ...team,
            totalPoints
        };
    });

    // Ordenar por puntaje total (mayor a menor)
    const sortedTeams = teamsWithScores.sort((a, b) => b.totalPoints - a.totalPoints);

    const handleEditTeam = (team) => {
        setEditingTeamId(team.id);
        setTeamFormData({
            name: team.name,
            color: team.color,
            drivers: [...team.drivers]
        });
    };

    const handleSaveTeam = async (teamId) => {
        try {
            await FirebaseService.updateTeam(championshipId, teamId, teamFormData);
            setEditingTeamId(null);
            setTeamFormData(null);
            onUpdate();
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    };

    const handleCancelEdit = () => {
        setEditingTeamId(null);
        setTeamFormData(null);
    };

    const handleRemoveDriver = (driverIndex) => {
        const updatedDrivers = teamFormData.drivers.filter((_, index) => index !== driverIndex);
        setTeamFormData({ ...teamFormData, drivers: updatedDrivers });
    };

    const handleAddDriver = () => {
        if (newDriver.name.trim()) {
            setTeamFormData({
                ...teamFormData,
                drivers: [...teamFormData.drivers, { ...newDriver }]
            });
            setNewDriver({ name: '', category: 'Gr1' });
            setShowAddDriverModal(false);
        }
    };

    const handleUpdateDriverCategory = (driverIndex, newCategory) => {
        const updatedDrivers = [...teamFormData.drivers];
        updatedDrivers[driverIndex].category = newCategory;
        setTeamFormData({ ...teamFormData, drivers: updatedDrivers });
    };

    return (
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">🏁 Clasificación de Equipos</h2>
                {!editMode && (
                    <p className="text-sm text-gray-400">
                        Activa el modo edición para modificar equipos
                    </p>
                )}
            </div>

            {sortedTeams.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    No hay equipos registrados en este campeonato
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedTeams.map((team, index) => {
                        const isEditing = editingTeamId === team.id;
                        const displayData = isEditing ? { ...team, ...teamFormData } : team;

                        return (
                            <div
                                key={team.id}
                                className="bg-white/10 border border-white/30 rounded-lg p-4 hover:bg-white/15 transition-all"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    {/* Posición y equipo */}
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* Posición */}
                                        <div className={`text-3xl font-bold w-12 text-center ${index === 0 ? 'text-yellow-400' :
                                            index === 1 ? 'text-gray-300' :
                                                index === 2 ? 'text-orange-400' :
                                                    'text-gray-500'
                                            }`}>
                                            {index + 1}°
                                        </div>

                                        {/* Color del equipo */}
                                        {isEditing ? (
                                            <input
                                                type="color"
                                                value={displayData.color}
                                                onChange={(e) => setTeamFormData({ ...teamFormData, color: e.target.value })}
                                                className="w-12 h-12 rounded-full border-2 border-white/50 cursor-pointer"
                                            />
                                        ) : (
                                            <div
                                                className="w-8 h-8 rounded-full border-2 border-white/50"
                                                style={{ backgroundColor: displayData.color }}
                                            ></div>
                                        )}

                                        {/* Info del equipo */}
                                        <div className="flex-1">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={displayData.name}
                                                    onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                                                    className="text-xl font-bold bg-white/10 border border-white/30 rounded px-3 py-1 w-full mb-2"
                                                />
                                            ) : (
                                                <h3 className="text-xl font-bold">{displayData.name}</h3>
                                            )}

                                            {/* Lista de pilotos */}
                                            <div className="mt-2 space-y-1">
                                                {displayData.drivers?.map((driver, driverIndex) => (
                                                    <div key={driverIndex} className="flex items-center gap-2 text-sm">
                                                        <span className="text-gray-400">{driver.name}</span>
                                                        {isEditing ? (
                                                            <>
                                                                <select
                                                                    value={driver.category}
                                                                    onChange={(e) => handleUpdateDriverCategory(driverIndex, e.target.value)}
                                                                    className="bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/50 text-xs"
                                                                >
                                                                    <option value="Gr1">Gr1</option>
                                                                    <option value="Gr2">Gr2</option>
                                                                    <option value="Gr3">Gr3</option>
                                                                    <option value="Gr4">Gr4</option>
                                                                    <option value="GrB">GrB</option>
                                                                    <option value="Street">Street</option>
                                                                </select>
                                                                <button
                                                                    onClick={() => handleRemoveDriver(driverIndex)}
                                                                    className="text-red-400 hover:text-red-300 ml-2"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/50">
                                                                {driver.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}

                                                {isEditing && (
                                                    <button
                                                        onClick={() => setShowAddDriverModal(true)}
                                                        className="text-xs text-green-400 hover:text-green-300 mt-2"
                                                    >
                                                        + Agregar Piloto
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Puntaje y acciones */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-3xl font-bold text-orange-500">
                                                {team.totalPoints}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                puntos
                                            </div>
                                        </div>

                                        {editMode && (
                                            <div className="flex flex-col gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSaveTeam(team.id)}
                                                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                                                        >
                                                            💾
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
                                                        >
                                                            ✖️
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleEditTeam(team)}
                                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal para agregar piloto */}
            {showAddDriverModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-800 border border-white/30 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Agregar Piloto</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Nombre del Piloto
                                </label>
                                <input
                                    type="text"
                                    value={newDriver.name}
                                    onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                                    placeholder="Nombre del piloto"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Categoría
                                </label>
                                <select
                                    value={newDriver.category}
                                    onChange={(e) => setNewDriver({ ...newDriver, category: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                                >
                                    <option value="Gr1">Gr1</option>
                                    <option value="Gr2">Gr2</option>
                                    <option value="Gr3">Gr3</option>
                                    <option value="Gr4">Gr4</option>
                                    <option value="GrB">GrB</option>
                                    <option value="Street">Street</option>
                                </select>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAddDriverModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddDriver}
                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <p className="text-gray-400 mt-6 text-center text-sm">
                {editMode ? '✏️ Modo edición activo - Puedes modificar equipos y pilotos' : '🚧 Activa el modo edición para gestionar equipos'}
            </p>
        </div>
    );
}

// Tab de Pistas con edición de puntajes
function TracksTab({ championshipId, tracks, teams, championship, editMode, onUpdate }) {
    // Estados para modal de asignación de posiciones
    const [showPositionsModal, setShowPositionsModal] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [positions, setPositions] = useState({});
    const [sprintPositions, setSprintPositions] = useState({});
    const [qualyTop3, setQualyTop3] = useState({ first: '', second: '', third: '' });
    const [fastestLapDriver, setFastestLapDriver] = useState('');
    const [savingResults, setSavingResults] = useState(false);

    // Obtener todos los pilotos según tipo de campeonato
    const allDrivers = championship?.settings?.isTeamChampionship
        ? teams.flatMap(team =>
            team.drivers?.map(driver => ({ name: driver.name, team: team.name, category: driver.category })) || []
        )
        : (championship?.drivers || []).map(driver => ({
            name: driver.name,
            team: '-',
            category: driver.category
        }));

    const allDriverNames = allDrivers.map(d => d.name);

    // Calcular puntos según posición usando la tabla del campeonato
    const calculateRacePoints = (position) => {
        const pointsTable = championship?.settings?.pointsSystem?.race || {};
        return pointsTable[position] || 0;
    };

    // Abrir modal para asignar resultados de la pista
    const handleOpenResultsModal = (track) => {
        setSelectedTrack(track);

        // Inicializar posiciones vacías
        const currentPositions = {};
        const currentSprintPositions = {};
        allDriverNames.forEach(driver => {
            currentPositions[driver] = '';
            currentSprintPositions[driver] = '';
        });
        setPositions(currentPositions);
        setSprintPositions(currentSprintPositions);

        // Resetear qualy y vuelta rápida
        setQualyTop3({ first: '', second: '', third: '' });
        setFastestLapDriver('');

        setShowPositionsModal(true);
    };

    // Guardar resultados completos de la pista
    const handleSaveResults = async () => {
        setSavingResults(true);
        try {
            // 1. Calcular puntos de carrera
            const racePoints = {};
            Object.entries(positions).forEach(([driver, position]) => {
                if (position && position !== '') {
                    const pos = parseInt(position);
                    racePoints[driver] = calculateRacePoints(pos);
                }
            });

            // 2. Agregar puntos de qualy si está habilitado
            const qualyPoints = {};
            if (championship?.settings?.pointsSystem?.qualifying?.enabled) {
                const qualyTable = championship.settings.pointsSystem.qualifying.positions || {};
                if (qualyTop3.first) qualyPoints[qualyTop3.first] = qualyTable[1] || 0;
                if (qualyTop3.second) qualyPoints[qualyTop3.second] = qualyTable[2] || 0;
                if (qualyTop3.third) qualyPoints[qualyTop3.third] = qualyTable[3] || 0;
            }

            // 3. Agregar puntos de vuelta rápida si está habilitado
            const fastestLapPoints = {};
            if (championship?.settings?.pointsSystem?.fastestLap?.enabled && fastestLapDriver) {
                fastestLapPoints[fastestLapDriver] = championship.settings.pointsSystem.fastestLap.points || 0;
            }

            // 4. Combinar todos los puntos
            const totalPoints = { ...racePoints };

            // Sumar puntos de sprint si es formato sprint+carrera
            const sprintPtsMap = {};
            if (selectedTrack.raceType === 'sprint_carrera') {
                Object.entries(sprintPositions).forEach(([driver, position]) => {
                    if (position && position !== '') {
                        const pos = parseInt(position);
                        sprintPtsMap[driver] = DEFAULT_SPRINT_POINTS[pos] || 0;
                    }
                });
                Object.entries(sprintPtsMap).forEach(([driver, pts]) => {
                    totalPoints[driver] = (totalPoints[driver] || 0) + pts;
                });
            }

            // Sumar puntos de qualy
            Object.entries(qualyPoints).forEach(([driver, pts]) => {
                totalPoints[driver] = (totalPoints[driver] || 0) + pts;
            });

            // Sumar puntos de vuelta rápida
            Object.entries(fastestLapPoints).forEach(([driver, pts]) => {
                totalPoints[driver] = (totalPoints[driver] || 0) + pts;
            });

            // 5. Preparar datos para guardar
            const trackUpdate = {
                points: totalPoints,
                results: {
                    racePositions: positions,
                    racePoints: racePoints
                }
            };

            // Agregar sprint si es formato dual
            if (selectedTrack.raceType === 'sprint_carrera') {
                trackUpdate.sprintPoints = sprintPtsMap;
                trackUpdate.results.sprintPositions = sprintPositions;
            }

            // Agregar qualy si está habilitado
            if (championship?.settings?.pointsSystem?.qualifying?.enabled) {
                trackUpdate.results.qualifying = {
                    top3: qualyTop3,
                    points: qualyPoints
                };
            }

            // Agregar vuelta rápida si está habilitado
            if (championship?.settings?.pointsSystem?.fastestLap?.enabled) {
                trackUpdate.results.fastestLap = {
                    driver: fastestLapDriver,
                    points: fastestLapPoints
                };
            }

            // 6. Actualizar pista en Firebase
            await FirebaseService.updateTrack(championshipId, selectedTrack.id, trackUpdate);

            // 7. Resetear y refrescar
            setShowPositionsModal(false);
            setSelectedTrack(null);
            setPositions({});
            setSprintPositions({});
            setQualyTop3({ first: '', second: '', third: '' });
            setFastestLapDriver('');
            await onUpdate();
        } catch (error) {
            console.error('Error al guardar resultados:', error);
            alert('Error al guardar resultados de la pista');
        } finally {
            setSavingResults(false);
        }
    };

    // Resetear todos los resultados de una pista
    const handleResetResults = async (track) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar TODOS los resultados de ${track.name}?\n\nEsto borrará:\n- Posiciones de carrera\n- Puntos de qualifying\n- Vuelta rápida\n\nEsta acción no se puede deshacer.`)) {
            return;
        }

        try {
            // Limpiar completamente los resultados
            await FirebaseService.updateTrack(championshipId, track.id, {
                points: {},
                results: {}
            });
            await onUpdate();
            alert('✅ Resultados eliminados correctamente');
        } catch (error) {
            console.error('Error al resetear resultados:', error);
            alert('Error al eliminar los resultados');
        }
    };

    return (
        <div className="text-white">
            {/* Usar el nuevo componente TracksManager */}
            <TracksManager
                championshipId={championshipId}
                tracks={tracks}
                onTracksUpdate={onUpdate}
                editMode={editMode}
                allDriverNames={allDriverNames}
                championship={championship}
                handleOpenResultsModal={handleOpenResultsModal}
                handleResetResults={handleResetResults}
            />

            {/* Modal para asignar resultados completos de la pista */}
            {showPositionsModal && selectedTrack && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/30 rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white">🏁 Asignar Resultados de Carrera</h3>
                                <p className="text-gray-400 mt-1">
                                    {selectedTrack.name} - Ronda {selectedTrack.round}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPositionsModal(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Sección 1: Posiciones de Carrera */}
                        <div className="mb-8">
                            <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                🏎️ Posiciones de Carrera
                            </h4>
                            <p className="text-sm text-gray-400 mb-4">
                                Ingresa la posición final de cada piloto (1, 2, 3...). Los puntos se calcularán automáticamente.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {allDriverNames.map(driver => (
                                    <div key={driver} className="bg-white/5 border border-white/20 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-white font-medium text-sm">{driver}</span>
                                            {positions[driver] && (
                                                <span className="text-sm text-orange-400 font-bold">
                                                    = {calculateRacePoints(parseInt(positions[driver]))} pts
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            max="99"
                                            value={positions[driver] || ''}
                                            onChange={(e) => setPositions({ ...positions, [driver]: e.target.value })}
                                            placeholder="Pos (1, 2, 3...)"
                                            className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-500 text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sección Sprint (condicional: solo para sprint_carrera) */}
                        {selectedTrack.raceType === 'sprint_carrera' && (
                            <div className="mb-8 pt-6 border-t border-white/20">
                                <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                    ⚡ Posiciones del Sprint
                                </h4>
                                <p className="text-sm text-gray-400 mb-2">
                                    Ingresa la posición del sprint ({selectedTrack.sprintLaps || 5} vueltas). Puntos: P1={DEFAULT_SPRINT_POINTS[1]}, P2={DEFAULT_SPRINT_POINTS[2]}, P3={DEFAULT_SPRINT_POINTS[3]}...
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {allDriverNames.map(driver => (
                                        <div key={driver} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white font-medium text-sm">{driver}</span>
                                                {sprintPositions[driver] && (
                                                    <span className="text-sm text-purple-400 font-bold">
                                                        = {DEFAULT_SPRINT_POINTS[parseInt(sprintPositions[driver])] || 0} pts
                                                    </span>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                max="99"
                                                value={sprintPositions[driver] || ''}
                                                onChange={(e) => setSprintPositions({ ...sprintPositions, [driver]: e.target.value })}
                                                placeholder="Pos sprint (1, 2, 3...)"
                                                className="w-full px-3 py-2 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sección 2: Qualifying (condicional) */}
                        {championship?.settings?.pointsSystem?.qualifying?.enabled === true ? (
                            <div className="mb-8 pt-6 border-t border-white/20">
                                <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                    ⏱️ Qualifying - Top 3
                                </h4>
                                <p className="text-sm text-gray-400 mb-4">
                                    Selecciona los 3 pilotos más rápidos en clasificación.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-500/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">🥇</span>
                                            <span className="text-white font-bold">1º Lugar</span>
                                            <span className="text-yellow-400 text-sm">
                                                (+{championship.settings.pointsSystem.qualifying.positions[1] || 0} pts)
                                            </span>
                                        </div>
                                        <select
                                            value={qualyTop3.first}
                                            onChange={(e) => setQualyTop3({ ...qualyTop3, first: e.target.value })}
                                            className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                                        >
                                            <option value="" className="bg-slate-800">Seleccionar piloto</option>
                                            {allDriverNames.map(driver => (
                                                <option key={driver} value={driver} className="bg-slate-800">
                                                    {driver}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-gradient-to-br from-gray-400/20 to-gray-500/20 border border-gray-400/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">🥈</span>
                                            <span className="text-white font-bold">2º Lugar</span>
                                            <span className="text-gray-300 text-sm">
                                                (+{championship.settings.pointsSystem.qualifying.positions[2] || 0} pts)
                                            </span>
                                        </div>
                                        <select
                                            value={qualyTop3.second}
                                            onChange={(e) => setQualyTop3({ ...qualyTop3, second: e.target.value })}
                                            className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                                        >
                                            <option value="" className="bg-slate-800">Seleccionar piloto</option>
                                            {allDriverNames.map(driver => (
                                                <option key={driver} value={driver} className="bg-slate-800">
                                                    {driver}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-gradient-to-br from-orange-700/20 to-orange-800/20 border border-orange-600/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">🥉</span>
                                            <span className="text-white font-bold">3º Lugar</span>
                                            <span className="text-orange-300 text-sm">
                                                (+{championship.settings.pointsSystem.qualifying.positions[3] || 0} pts)
                                            </span>
                                        </div>
                                        <select
                                            value={qualyTop3.third}
                                            onChange={(e) => setQualyTop3({ ...qualyTop3, third: e.target.value })}
                                            className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                                        >
                                            <option value="" className="bg-slate-800">Seleccionar piloto</option>
                                            {allDriverNames.map(driver => (
                                                <option key={driver} value={driver} className="bg-slate-800">
                                                    {driver}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {/* Sección 3: Vuelta Rápida (condicional) */}
                        {championship?.settings?.pointsSystem?.fastestLap?.enabled === true ? (
                            <div className="mb-8 pt-6 border-t border-white/20">
                                <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                    ⚡ Vuelta Rápida en Carrera
                                </h4>
                                <p className="text-sm text-gray-400 mb-4">
                                    Selecciona el piloto que hizo la vuelta más rápida durante la carrera.
                                </p>
                                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-4 max-w-md">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">🏆</span>
                                        <span className="text-white font-bold">Vuelta Rápida</span>
                                        <span className="text-purple-300 text-sm">
                                            (+{championship.settings.pointsSystem.fastestLap.points || 0} pts)
                                        </span>
                                    </div>
                                    <select
                                        value={fastestLapDriver}
                                        onChange={(e) => setFastestLapDriver(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white"
                                    >
                                        <option value="" className="bg-slate-800">Seleccionar piloto</option>
                                        {allDriverNames.map(driver => (
                                            <option key={driver} value={driver} className="bg-slate-800">
                                                {driver}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : null}

                        {/* Botones de acción */}
                        <div className="flex gap-3 pt-6 border-t border-white/20">
                            <button
                                onClick={() => setShowPositionsModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveResults}
                                disabled={savingResults}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                                {savingResults ? '⏳ Guardando...' : '💾 Guardar Todos los Resultados'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Tab de Pilotos con clasificación individual
function DriversTab({ championshipId, championship, teams, tracks, onUpdate, editMode }) {

    // Extraer todos los pilotos con su equipo y calcular puntos totales
    const driversData = [];

    // Si es campeonato por equipos, extraer de teams
    if (championship?.settings?.isTeamChampionship) {
        teams.forEach(team => {
            team.drivers?.forEach(driver => {
                let totalPoints = 0;
                let racesByCategory = {};

                // Normalizar categories: puede venir como 'category' (string) o 'categories' (array)
                const categories = driver.categories
                    ? (Array.isArray(driver.categories) ? driver.categories : [driver.categories])
                    : (driver.category ? [driver.category] : []);

                // Calcular puntos en cada pista
                tracks.forEach(track => {
                    const points = track.points?.[driver.name] || 0;
                    totalPoints += points;

                    // Agrupar por categoría si existe
                    categories.forEach(cat => {
                        if (!racesByCategory[cat]) {
                            racesByCategory[cat] = 0;
                        }
                        if (points > 0) {
                            racesByCategory[cat]++;
                        }
                    });
                });

                driversData.push({
                    name: driver.name,
                    teamName: team.name,
                    teamColor: team.color,
                    categories: categories,
                    totalPoints,
                    racesByCategory,
                    racesCompleted: tracks.filter(t => (t.points?.[driver.name] || 0) > 0).length
                });
            });
        });
    } else {
        // Campeonato individual - extraer pilotos directamente del campeonato
        championship.drivers?.forEach(driver => {
            let totalPoints = 0;
            let racesByCategory = {};

            // Normalizar categories
            const categories = Array.isArray(driver.category) ? driver.category : [driver.category];

            // Calcular puntos en cada pista
            tracks.forEach(track => {
                const points = track.points?.[driver.name] || 0;
                totalPoints += points;

                // Agrupar por categoría si existe
                categories.forEach(cat => {
                    if (!racesByCategory[cat]) {
                        racesByCategory[cat] = 0;
                    }
                    if (points > 0) {
                        racesByCategory[cat]++;
                    }
                });
            });

            driversData.push({
                name: driver.name,
                teamName: 'Individual',
                teamColor: '#888888',
                categories: categories,
                totalPoints,
                racesByCategory,
                racesCompleted: tracks.filter(t => (t.points?.[driver.name] || 0) > 0).length
            });
        });
    }

    // Ordenar por puntos totales (mayor a menor)
    const sortedDrivers = driversData.sort((a, b) => b.totalPoints - a.totalPoints);

    return (
        <div className="text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">🏎️ Clasificación de Pilotos</h2>
            </div>

            {sortedDrivers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    No hay pilotos registrados en este campeonato
                </div>
            ) : (
                <div className="space-y-2">
                    {sortedDrivers.map((driver, index) => (
                        <div
                            key={`${driver.name}-${driver.teamName}`}
                            className="bg-white/10 border border-white/30 rounded-lg p-4 hover:bg-white/15 transition-all"
                        >
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                {/* Posición y piloto */}
                                <div className="flex items-center gap-4 flex-1">
                                    {/* Posición */}
                                    <div className={`text-2xl font-bold w-10 text-center ${index === 0 ? 'text-yellow-400' :
                                        index === 1 ? 'text-gray-300' :
                                            index === 2 ? 'text-orange-400' :
                                                'text-gray-500'
                                        }`}>
                                        {index + 1}°
                                    </div>

                                    {/* Color del equipo */}
                                    <div
                                        className="w-6 h-6 rounded-full border-2 border-white/50"
                                        style={{ backgroundColor: driver.teamColor }}
                                    ></div>

                                    {/* Info del piloto */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold">{driver.name}</h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm text-gray-400">
                                                {driver.teamName}
                                            </p>
                                            {driver.categories.length > 0 && (
                                                <div className="flex gap-1">
                                                    {driver.categories.map(cat => (
                                                        <span
                                                            key={cat}
                                                            className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/50"
                                                        >
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-sm text-gray-400">Carreras</div>
                                        <div className="text-lg font-bold">
                                            {driver.racesCompleted}/{tracks.length}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-sm text-gray-400">Puntos</div>
                                        <div className="text-2xl font-bold text-orange-500">
                                            {driver.totalPoints}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Desglose por categoría */}
                            {Object.keys(driver.racesByCategory).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-white/20">
                                    <div className="flex gap-4 text-xs text-gray-400">
                                        {Object.entries(driver.racesByCategory).map(([cat, count]) => (
                                            <span key={cat}>
                                                {cat}: {count} carrera{count !== 1 ? 's' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}


        </div>
    );
}

function EventsTab({ championshipId, events, onUpdate }) {
    return (
        <div className="text-white">
            <h2 className="text-2xl font-bold mb-4">Eventos ({events.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map(event => (
                    <div key={event.id} className="bg-white/10 p-4 rounded-lg border border-white/30">
                        <h3 className="font-bold text-lg mb-2">{event.title}</h3>
                        <p className="text-sm text-gray-300 mb-2">{event.description}</p>
                        <p className="text-sm text-gray-400">🏎️ {event.track}</p>
                        {event.date && (
                            <p className="text-sm text-gray-400 mt-2">
                                📅 {new Date(event.date).toLocaleDateString()} • {event.hour}
                            </p>
                        )}
                    </div>
                ))}
            </div>
            <p className="text-gray-400 mt-4 text-center">
                🚧 Gestión completa de eventos próximamente (FASE 3)
            </p>
        </div>
    );
}

function StatsTab({ championship, teams, tracks, events }) {
    return (
        <div className="text-white">
            <h2 className="text-2xl font-bold mb-6">Estadísticas del Campeonato</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="🏁" label="Equipos" value={teams.length} />
                <StatCard icon="🏎️" label="Pistas" value={tracks.length} />
                <StatCard icon="🎉" label="Eventos" value={events.length} />
                <StatCard icon="👥" label="Pilotos" value={teams.reduce((acc, team) => acc + (team.drivers?.length || 0), 0)} />
            </div>
        </div>
    );
}

function StatCard({ icon, label, value }) {
    return (
        <div className="bg-white/10 p-6 rounded-lg border border-white/30 text-center">
            <div className="text-4xl mb-2">{icon}</div>
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
        </div>
    );
}

// ============================================================
// Tab de Inscripciones (Fase 2)
// ============================================================
function RegistrationsTab({ championshipId, championship, onUpdate }) {
    const [filter, setFilter] = useState('all');
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const registrations = championship.registrations || [];
    const filtered = filter === 'all' ? registrations : registrations.filter(r => r.status === filter);

    const counts = {
        all: registrations.length,
        pending: registrations.filter(r => r.status === 'pending').length,
        approved: registrations.filter(r => r.status === 'approved').length,
        rejected: registrations.filter(r => r.status === 'rejected').length
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(r => r.id));
        }
    };

    const handleBatchAction = async (status) => {
        if (selectedIds.length === 0) return;
        setSaving(true);
        try {
            const updates = selectedIds.map(id => ({ id, status }));
            await FirebaseService.updateRegistrations(championshipId, updates);
            setSelectedIds([]);
            onUpdate();
        } catch (error) {
            console.error('Error updating registrations:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSingleAction = async (id, status) => {
        setSaving(true);
        try {
            await FirebaseService.updateRegistrations(championshipId, [{ id, status }]);
            onUpdate();
        } catch (error) {
            console.error('Error updating registration:', error);
        } finally {
            setSaving(false);
        }
    };

    const statusStyles = {
        pending: { bg: 'bg-yellow-500/20', border: 'border-yellow-400/50', text: 'text-yellow-200', label: '⏳ Pendiente' },
        approved: { bg: 'bg-green-500/20', border: 'border-green-400/50', text: 'text-green-200', label: '✅ Aprobado' },
        rejected: { bg: 'bg-red-500/20', border: 'border-red-400/50', text: 'text-red-200', label: '❌ Rechazado' }
    };

    return (
        <div className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { key: 'all', label: 'Total', icon: '📋', color: 'bg-blue-500/20 border-blue-400/50' },
                    { key: 'pending', label: 'Pendientes', icon: '⏳', color: 'bg-yellow-500/20 border-yellow-400/50' },
                    { key: 'approved', label: 'Aprobados', icon: '✅', color: 'bg-green-500/20 border-green-400/50' },
                    { key: 'rejected', label: 'Rechazados', icon: '❌', color: 'bg-red-500/20 border-red-400/50' }
                ].map(item => (
                    <button
                        key={item.key}
                        onClick={() => setFilter(item.key)}
                        className={`p-4 rounded-lg border text-center transition-all ${item.color} ${filter === item.key ? 'ring-2 ring-orange-500 scale-105' : 'hover:scale-105'}`}
                    >
                        <div className="text-2xl mb-1">{item.icon}</div>
                        <div className="text-2xl font-bold text-white">{counts[item.key]}</div>
                        <div className="text-xs text-gray-300">{item.label}</div>
                    </button>
                ))}
            </div>

            {/* Acciones en batch */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-4 bg-white/10 border border-white/30 rounded-lg">
                    <span className="text-white font-medium">{selectedIds.length} seleccionado(s)</span>
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={() => handleBatchAction('approved')}
                            disabled={saving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                            ✅ Aprobar
                        </button>
                        <button
                            onClick={() => handleBatchAction('rejected')}
                            disabled={saving}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                            ❌ Rechazar
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de inscripciones */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <div className="text-5xl mb-3">📝</div>
                    <p className="text-lg">No hay inscripciones {filter !== 'all' ? `con estado "${filter}"` : ''}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Select all */}
                    <div className="flex items-center gap-3 px-4 py-2">
                        <input
                            type="checkbox"
                            checked={selectedIds.length === filtered.length && filtered.length > 0}
                            onChange={selectAll}
                            className="w-4 h-4 accent-orange-500"
                        />
                        <span className="text-sm text-gray-400">Seleccionar todos</span>
                    </div>

                    {filtered.map(reg => {
                        const style = statusStyles[reg.status] || statusStyles.pending;
                        return (
                            <div key={reg.id} className={`${style.bg} border ${style.border} rounded-lg p-4`}>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(reg.id)}
                                        onChange={() => toggleSelect(reg.id)}
                                        className="w-4 h-4 accent-orange-500"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-white font-bold text-lg">{reg.name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                                {style.label}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                                            {reg.psnId && <span>🎮 {reg.psnId}</span>}
                                            {reg.country && <span>🌍 {reg.country}</span>}
                                            {reg.experience && <span>⭐ {reg.experience}</span>}
                                            {reg.preferredCar && <span>🚗 {reg.preferredCar}</span>}
                                            <span>📅 {new Date(reg.createdAt).toLocaleDateString('es-ES')}</span>
                                            {reg.reviewedAt && <span>✏️ Revisado: {new Date(reg.reviewedAt).toLocaleDateString('es-ES')}</span>}
                                        </div>
                                    </div>
                                    {/* Acciones individuales */}
                                    {reg.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSingleAction(reg.id, 'approved')}
                                                disabled={saving}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                onClick={() => handleSingleAction(reg.id, 'rejected')}
                                                disabled={saving}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                                            >
                                                ❌
                                            </button>
                                        </div>
                                    )}
                                    {reg.status !== 'pending' && (
                                        <button
                                            onClick={() => handleSingleAction(reg.id, 'pending')}
                                            disabled={saving}
                                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-all disabled:opacity-50"
                                            title="Devolver a pendiente"
                                        >
                                            ↩️
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
